/*
 * INSTAGRAM-OAUTH-INTEGRITY-AUDIT-1 — an Instagram callback cannot leave a credential for an account
 * the connection is not bound to, whether the account changes on a bound row or two first-binding
 * callbacks race on an unbound one.
 *
 * Real (disposable) Postgres, real authorities (Integration, INT-2 with real sealing and audit),
 * Instagram `/me` answered by a fixture keyed on the Bearer token. Concurrency is COORDINATED, not
 * hoped for: the first callback holds its row lock (`whileLockedForTest`) until the database reports
 * the second one waiting on a lock, or — for callbacks that must NOT wait — until the second one has
 * already finished.
 *
 * Every verdict is read from DURABLE state: the row, the live credential's decrypted token mapped to
 * the account it was issued for (never printed), credential rows and audit rows. "Zero mutation" is a
 * byte comparison of the integration row, every credential row and the audit count.
 *
 *   P   the RELEASED order (store → verify stored copy → bind, three commits), driven with the
 *       released authorities: A) bound + different account leaves B's token under A's binding;
 *       B) interleaved first binds leave A bound, connected, healthy, holding B's token
 *   1   bound + same account → connected, token replaced, coherent
 *   2   bound + different account → refused, ZERO mutation
 *   3   concurrent first binds, same account → coherent
 *   4   concurrent first binds, different accounts → one winner; the loser waited, saw the binding
 *       and wrote NOTHING
 *   5   different connections of one tenant (switch candidate beside its incumbent) → no waiting, no
 *       contamination; the released switch semantics (real switch, same-account re-pick) hold
 *   6   different tenants → no waiting; a foreign row cannot be reached
 *   7   identity failure → nothing written; a refusal AFTER the credential write rolls it back
 *   R   the route calls the verifier on the in-memory token before the one committing seam
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*. */
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createConnection,
  listConnections,
  recordVerifiedConnectionWithin,
} from "../../src/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  replaceCredential,
  storeCredential,
  withDecryptedSecret,
} from "../../src/features/integration-credentials/credential-repository.server";
import { retireSupersededConnection } from "../../src/features/provider-connection-lifecycle/disconnect-connection.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { INSTAGRAM_PROVIDER_KEY } from "../../src/features/provider-instagram/contracts";
import { commitInstagramGrant } from "../../src/features/provider-instagram/bind-instagram-grant.server";
import {
  verifyInstagramAccessToken,
  verifyInstagramConnection,
} from "../../src/features/provider-instagram/verify-instagram-connection.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-28T18:00:00.000Z");
const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};
const STATED = ["instagram_business_basic"];
const ACCOUNT_ID: Record<string, string> = { A: "28295264780115792", B: "17998877665544332", C: "17841400000000003" };

/* Every token this file mints, and the Instagram account it belongs to. */
const ACCOUNT_OF_TOKEN = new Map<string, string>();
let seq = 0;
const tokenFor = (account: "A" | "B" | "C") => {
  seq += 1;
  const t = `igint1-${account}-${seq}-${randomBytes(4).toString("hex")}`;
  ACCOUNT_OF_TOKEN.set(t, account);
  return t;
};

/** Instagram `/me`: answers for whichever account the Bearer token belongs to; unknown → 401/190. */
const instagram = async (_url: unknown, init?: { headers?: Record<string, string> }) => {
  const bearer = String(init?.headers?.Authorization ?? "").replace(/^Bearer /, "");
  const account = ACCOUNT_OF_TOKEN.get(bearer);
  if (!account) {
    return new Response(JSON.stringify({ error: { code: 190 } }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return new Response(
    JSON.stringify({ id: ACCOUNT_ID[account], username: `acct${account.toLowerCase()}`, account_type: "BUSINESS" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_igint1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const deps = { getDb, env: ENV } as const;

  try {
    let tn = 0;
    const newTenant = async (): Promise<TenantContext> => {
      tn += 1;
      const id = (await client.query<{ id: string }>(
        `insert into companies (name, slug) values ($1,$1) returning id`, [`igint1-${tn}`],
      )).rows[0]!.id;
      return { tenantId: id, userId: `20000000-0000-4000-8000-${String(tn).padStart(12, "0")}`, requestId: "igint1" } as TenantContext;
    };
    const newRow = async (t: TenantContext) => {
      const c = await createConnection(t, { providerKey: INSTAGRAM_PROVIDER_KEY, name: "Instagram" }, deps);
      assert.equal(c.status, "created");
      return c.status === "created" ? c.connection.integrationId : "";
    };

    /*
     * THE CALLBACK'S POST-EXCHANGE TAIL, in the route's order (section R pins that order): `/me` for
     * the in-memory token → switch same-account check → one committing seam → retire the superseded.
     */
    const callback = async (
      t: TenantContext,
      id: string,
      token: string,
      opts: { supersedes?: string; whileLockedForTest?: () => Promise<void> } = {},
    ): Promise<string> => {
      const verification = await verifyInstagramAccessToken(token, { fetchImpl: instagram as never }, STATED);
      if (!verification.ok) return `verification-${verification.failure}`;
      if (opts.supersedes) {
        const l = await listConnections(t, deps);
        const incumbent = l.status === "read" ? l.connections.find((c) => c.integrationId === opts.supersedes) : undefined;
        if (incumbent && incumbent.externalAccountId === verification.facts.externalAccountId) {
          await retireSupersededConnection(t, id, deps);
          return "connected";
        }
      }
      const recorded = await commitInstagramGrant(t, id, { accessToken: token, expiresAt: null }, verification.facts, NOW, {
        getDb,
        env: ENV,
        whileLockedForTest: opts.whileLockedForTest,
      });
      if (recorded !== "connected") return recorded;
      if (opts.supersedes) {
        const retired = await retireSupersededConnection(t, opts.supersedes, deps);
        if (retired.status === "refused") return `retire-${retired.reason}`;
      }
      return "connected";
    };

    /** Durable truth for one connection. The live token is mapped to its account inside the callback. */
    const truth = async (t: TenantContext, id: string) => {
      const row = (await client.query(`select external_account_id, connection_state, health from integrations where id=$1`, [id])).rows[0];
      const l = await listCredentialMetadata(t, id, deps);
      assert.ok(l.status === "read");
      const live = l.credentials.filter((c) => c.live && c.kind === "oauth_access");
      let liveAccount: string | null = null;
      if (live.length === 1) {
        const o = await withDecryptedSecret(t, live[0]!.credentialId, (s) => ACCOUNT_OF_TOKEN.get(s) ?? "unknown", deps);
        assert.ok(o.status === "used", "the live credential opens");
        liveAccount = o.value;
      }
      const creds = (await client.query<{ n: number }>(`select count(*)::int n from integration_credentials where integration_id=$1`, [id])).rows[0]!.n;
      const bound = Object.entries(ACCOUNT_ID).find(([, v]) => v === row.external_account_id)?.[0] ?? null;
      return { bound, state: row.connection_state as string, health: row.health as string, liveCount: live.length, liveAccount, creds };
    };
    const coherent = (x: Awaited<ReturnType<typeof truth>>, account: string, label: string) => {
      assert.equal(x.bound, account, `${label}: bound to ${account}`);
      assert.equal(x.liveCount, 1, `${label}: exactly one live access credential`);
      assert.equal(x.liveAccount, account, `${label}: the live token belongs to the BOUND account`);
      assert.equal(x.state, "connected", `${label}: connected`);
      assert.equal(x.health, "healthy", `${label}: healthy`);
    };

    /** Byte-level durable snapshot: the row, every credential row, and the whole audit count. */
    const snapshot = async (id: string) => ({
      row: (await client.query(`select row_to_json(i)::text j from integrations i where id=$1`, [id])).rows[0]?.j ?? null,
      creds: (await client.query(`select row_to_json(c)::text j from integration_credentials c where integration_id=$1 order by id`, [id])).rows.map((r) => r.j),
      audits: (await client.query<{ n: number }>(`select count(*)::int n from audit_log`)).rows[0]!.n,
    });

    /** Resolves once some other session is WAITING on a lock in this database. */
    async function untilSomeoneWaitsOnALock(): Promise<void> {
      for (let i = 0; i < 200; i += 1) {
        const n = (await client.query<{ n: number }>(
          `select count(*)::int n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
        )).rows[0]!.n;
        if (n > 0) return;
        await new Promise((r) => setTimeout(r, 25));
      }
      throw new Error("the second callback never waited on the row lock");
    }
    /** X holds its row lock until Y is blocked on it; then both finish. */
    async function raceOnOneRow(first: (hold: () => Promise<void>) => Promise<string>, second: () => Promise<string>) {
      const xLocked = deferred();
      const release = deferred();
      const x = first(async () => {
        xLocked.resolve();
        await release.promise;
      });
      await xLocked.promise;
      const y = second();
      try {
        await untilSomeoneWaitsOnALock();
      } finally {
        release.resolve();
      }
      return Promise.all([x, y]);
    }
    /** X holds its row lock while Y (another row) must finish without waiting. */
    async function mustNotWait(first: (hold: () => Promise<void>) => Promise<string>, second: () => Promise<string>) {
      const xLocked = deferred();
      const release = deferred();
      const x = first(async () => {
        xLocked.resolve();
        await release.promise;
      });
      await xLocked.promise;
      const pending = second();
      const y = await Promise.race([pending, new Promise<string>((r) => setTimeout(() => r("TIMED-OUT (it waited)"), 5000))]);
      release.resolve();
      await pending.catch(() => undefined);
      return [await x, y] as const;
    }

    /* ═══ P. THE RELEASED ORDER IS UNSAFE (the defect this phase repairs) ═══════════════════ */
    {
      const oldStore = async (t: TenantContext, id: string, token: string) => {
        const e = await listCredentialMetadata(t, id, deps);
        const live = e.status === "read" ? e.credentials.filter((c) => c.live) : [];
        const input = { integrationId: id, kind: "oauth_access" as const, plaintext: token };
        return live.some((c) => c.kind === "oauth_access") ? replaceCredential(t, input, deps) : storeCredential(t, input, deps);
      };
      const oldVerify = (t: TenantContext, id: string) => verifyInstagramConnection(t, id, { ...deps, fetchImpl: instagram as never }, STATED);
      const oldRecord = async (t: TenantContext, id: string, v: Awaited<ReturnType<typeof oldVerify>>) => {
        assert.ok(v.ok);
        return db.transaction((tx) => recordVerifiedConnectionWithin(tx, t, id, v.ok ? v.facts : (null as never), NOW));
      };

      /* A. bound + different account, non-switch reconnect on the bound row */
      const t = await newTenant();
      const id = await newRow(t);
      assert.equal((await oldStore(t, id, tokenFor("A"))).status, "stored");
      assert.equal((await oldRecord(t, id, await oldVerify(t, id))).status, "verified");
      assert.equal((await oldStore(t, id, tokenFor("B"))).status, "replaced");
      const r = await oldRecord(t, id, await oldVerify(t, id));
      assert.equal(r.status === "refused" && r.reason, "account-changed");
      const a = await truth(t, id);
      assert.equal(a.bound, "A");
      assert.equal(a.liveAccount, "B", "P-A: the released order left B's token under A's binding");
      assert.equal(a.state, "unverified", "P-A: and moved the bound connection to unverified");

      /* B. interleaved first binds */
      const t2 = await newTenant();
      const id2 = await newRow(t2);
      assert.equal((await oldStore(t2, id2, tokenFor("A"))).status, "stored");
      const vx = await oldVerify(t2, id2);
      assert.equal((await oldStore(t2, id2, tokenFor("B"))).status, "replaced");
      assert.equal((await oldRecord(t2, id2, vx)).status, "verified");
      const ry = await oldRecord(t2, id2, await oldVerify(t2, id2));
      assert.equal(ry.status === "refused" && ry.reason, "account-changed");
      const b = await truth(t2, id2);
      assert.deepEqual([b.bound, b.state, b.health, b.liveAccount], ["A", "connected", "healthy", "B"], "P-B: bound A, connected, healthy, holding B's token");
    }

    /* ═══ 1. BOUND + SAME ACCOUNT ═══════════════════════════════════════════════════════════ */
    {
      const t = await newTenant();
      const id = await newRow(t);
      assert.equal(await callback(t, id, tokenFor("A")), "connected");
      const first = await truth(t, id);
      coherent(first, "A", "1 first bind");
      assert.equal(await callback(t, id, tokenFor("A")), "connected");
      const again = await truth(t, id);
      coherent(again, "A", "1 same-account reconnect");
      assert.equal(again.creds, 2, "1: the token was REPLACED (one revoked, one live)");
    }

    /* ═══ 2. BOUND + DIFFERENT ACCOUNT → ZERO MUTATION ═════════════════════════════════════ */
    {
      const t = await newTenant();
      const id = await newRow(t);
      assert.equal(await callback(t, id, tokenFor("A")), "connected");
      const before = await snapshot(id);
      assert.equal(await callback(t, id, tokenFor("B")), "record-account-changed");
      assert.deepEqual(await snapshot(id), before, "2: row, credential rows and audit are byte-identical");
      coherent(await truth(t, id), "A", "2 after the refusal");
    }

    /* ═══ 3. CONCURRENT FIRST BINDS, SAME ACCOUNT ══════════════════════════════════════════ */
    {
      const t = await newTenant();
      const id = await newRow(t);
      const [x, y] = await raceOnOneRow(
        (hold) => callback(t, id, tokenFor("A"), { whileLockedForTest: hold }),
        () => callback(t, id, tokenFor("A")),
      );
      assert.deepEqual([x, y], ["connected", "connected"], "3: both succeed");
      const s = await truth(t, id);
      coherent(s, "A", "3");
      assert.equal(s.creds, 2, "3: the second replaced the first, serially");
    }

    /* ═══ 4. CONCURRENT FIRST BINDS, DIFFERENT ACCOUNTS ════════════════════════════════════ */
    {
      const t = await newTenant();
      const id = await newRow(t);
      const auditsBefore = (await snapshot(id)).audits;
      const [x, y] = await raceOnOneRow(
        (hold) => callback(t, id, tokenFor("A"), { whileLockedForTest: hold }),
        () => callback(t, id, tokenFor("B")),
      );
      assert.equal(x, "connected", "4: the first to lock wins");
      assert.equal(y, "record-account-changed", "4: the loser waited, then saw the winner's binding");
      const s = await truth(t, id);
      coherent(s, "A", "4");
      assert.equal(s.creds, 1, "4: the loser stored NO credential row");
      const auditsAfter = (await snapshot(id)).audits;
      /* The loser's zero: re-run the loser alone against the settled row and compare bytes. */
      const settled = await snapshot(id);
      assert.equal(await callback(t, id, tokenFor("B")), "record-account-changed");
      assert.deepEqual(await snapshot(id), settled, "4: a losing callback leaves row, credentials and audit byte-identical");
      assert.ok(auditsAfter > auditsBefore, "4: the winner's write was audited (the counter is live)");
    }

    /* ═══ 5. DIFFERENT CONNECTIONS OF ONE TENANT; SWITCH SEMANTICS PRESERVED ═══════════════ */
    {
      const t = await newTenant();
      const incumbent = await newRow(t);
      assert.equal(await callback(t, incumbent, tokenFor("A")), "connected");

      /* A candidate row binds while the incumbent is locked by a same-account reconnect: no waiting. */
      const candidate = await newRow(t);
      const [x, y] = await mustNotWait(
        (hold) => callback(t, incumbent, tokenFor("A"), { whileLockedForTest: hold }),
        () => callback(t, candidate, tokenFor("B")),
      );
      assert.deepEqual([x, y], ["connected", "connected"], "5: another row of the tenant never waits");
      coherent(await truth(t, incumbent), "A", "5 incumbent");
      coherent(await truth(t, candidate), "B", "5 candidate");

      /* A real switch: candidate binds C, the superseded row is retired last. */
      const t2 = await newTenant();
      const old = await newRow(t2);
      assert.equal(await callback(t2, old, tokenFor("A")), "connected");
      const cand = await newRow(t2);
      assert.equal(await callback(t2, cand, tokenFor("C"), { supersedes: old }), "connected");
      coherent(await truth(t2, cand), "C", "5 switch replacement");
      const retired = await truth(t2, old);
      assert.equal(retired.state, "disconnected", "5: the superseded row is retired");
      assert.equal(retired.liveCount, 0, "5: and holds no live credential");

      /* Same-account re-pick on a switch: the candidate is retired, the incumbent is untouched. */
      const t3 = await newTenant();
      const inc = await newRow(t3);
      assert.equal(await callback(t3, inc, tokenFor("A")), "connected");
      const incBefore = await snapshot(inc);
      const cand3 = await newRow(t3);
      assert.equal(await callback(t3, cand3, tokenFor("A"), { supersedes: inc }), "connected");
      assert.deepEqual((await snapshot(inc)).row, incBefore.row, "5: incumbent row untouched");
      assert.deepEqual((await snapshot(inc)).creds, incBefore.creds, "5: incumbent credential untouched");
      const c3 = await truth(t3, cand3);
      assert.equal(c3.state, "disconnected", "5: the candidate is retired");
      assert.equal(c3.creds, 0, "5: and the re-picked token was never stored anywhere");
    }

    /* ═══ 6. DIFFERENT TENANTS ═════════════════════════════════════════════════════════════ */
    {
      const t1 = await newTenant();
      const t2 = await newTenant();
      const r1 = await newRow(t1);
      const r2 = await newRow(t2);
      /* The same Instagram account may be connected by two tenants (the production shape). */
      const [x, y] = await mustNotWait(
        (hold) => callback(t1, r1, tokenFor("A"), { whileLockedForTest: hold }),
        () => callback(t2, r2, tokenFor("A")),
      );
      assert.deepEqual([x, y], ["connected", "connected"], "6: tenants never wait on each other");
      coherent(await truth(t1, r1), "A", "6 tenant 1");
      coherent(await truth(t2, r2), "A", "6 tenant 2");

      /* A foreign row is not found, not locked, not written. */
      const before = await snapshot(r1);
      assert.equal(await callback(t2, r1, tokenFor("A")), "record-not-found");
      assert.deepEqual(await snapshot(r1), before, "6: another tenant's callback cannot touch the row");
    }

    /* ═══ 7. IDENTITY FAILURE, AND A REFUSAL AFTER THE FIRST WRITE ═════════════════════════ */
    {
      const t = await newTenant();
      const unbound = await newRow(t);
      const b0 = await snapshot(unbound);
      assert.equal(await callback(t, unbound, "igint1-unknown-token"), "verification-auth");
      assert.deepEqual(await snapshot(unbound), b0, "7: identity failure on an unbound row writes nothing");

      const bound = await newRow(t);
      assert.equal(await callback(t, bound, tokenFor("A")), "connected");
      const b1 = await snapshot(bound);
      assert.equal(await callback(t, bound, "igint1-unknown-token"), "verification-auth");
      assert.deepEqual(await snapshot(bound), b1, "7: identity failure on a bound row writes nothing — its working token is kept");

      /* A refusal INSIDE the serialized section, after the credential was written: rolled back. */
      const facts = { externalAccountId: null, externalAccountLabel: "x", grantedScopes: STATED };
      const b2 = await snapshot(unbound);
      assert.equal(
        await commitInstagramGrant(t, unbound, { accessToken: tokenFor("A"), expiresAt: null }, facts, NOW, { getDb, env: ENV }),
        "record-account-identity-mismatch",
      );
      assert.deepEqual(await snapshot(unbound), b2, "7: the credential write rolled back with the refused binding");
    }

    /* ═══ R. THE ROUTE'S ORDER ═════════════════════════════════════════════════════════════ */
    {
      const route = readFileSync("src/app/api/integrations/instagram/callback/route.ts", "utf8");
      const verifyAt = route.indexOf("await verifyInstagramAccessToken(");
      const supersedeAt = route.indexOf("verified.payload.supersedesIntegrationId");
      const commitAt = route.indexOf("await commitInstagramGrant(");
      const retireLastAt = route.lastIndexOf("retireSupersededConnection(tenant, supersedes");
      assert.ok(verifyAt > 0 && verifyAt < supersedeAt && supersedeAt < commitAt && commitAt < retireLastAt, "R: verify → switch check → commit → retire");
      assert.ok(!route.includes("integration-credentials"), "R: the route no longer reaches the credential authority itself");
      assert.ok(!/recordVerifiedConnectionWithin|verifyInstagramConnection\(/.test(route), "R: no second binding or stored-copy verification path");
    }

    console.log("INSTAGRAM-OAUTH-INTEGRITY-AUDIT-1: P, 1–7, R passed");
  } finally {
    await handle.dispose().catch(() => {});
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
