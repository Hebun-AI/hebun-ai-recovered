/*
 * GOOGLE-OAUTH-FIRST-BIND-RACE-1 — concurrent Google callbacks cannot leave a credential for an
 * account the connection is not bound to.
 *
 * Real (disposable) Postgres, real authorities (Integration, INT-2 with real sealing and audit),
 * Google `userinfo` answered by a fixture keyed on the Bearer token. Concurrency is COORDINATED, not
 * hoped for: the first callback holds its row lock (`whileLockedForTest`) until the database reports
 * the second one waiting on a lock (`pg_stat_activity.wait_event_type = 'Lock'`), or — for callbacks that must NOT
 * wait — until the second one has already committed.
 *
 * Every verdict is read from DURABLE state: the row's binding, the live credential's decrypted token
 * mapped to the account it was issued for (never printed), credential row counts, audit rows.
 *
 *   P   pre-fix: the released three-commit order, interleaved → bound to A, live token of B (violation)
 *   1   same connection, SAME account, concurrent first binds → connected, coherent
 *   2   same connection, DIFFERENT accounts, concurrent first binds → one winner; the loser waited,
 *       saw the winner's binding and wrote NOTHING; live token = winner's account
 *   3   already bound, same account → connected
 *   4   already bound, different account → refused, zero mutation
 *   5   different connections → no waiting, no contamination
 *   6   google-workspace vs google-youtube in one tenant → independent, different accounts allowed
 *   7   different tenants → independent
 *   8   failure after the first write inside the serialized section → rolled back entirely;
 *       identity failure before it → nothing written
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { createConnection, recordVerifiedConnectionWithin } from "../../src/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  replaceCredential,
  storeCredential,
  withDecryptedSecret,
} from "../../src/features/integration-credentials/credential-repository.server";
import { CREDENTIAL_LIMITS } from "../../src/features/integration-credentials/contracts";
import { commitGoogleGrant } from "../../src/features/provider-google/bind-google-grant.server";
import { GOOGLE_PROVIDER_KEY, GOOGLE_YOUTUBE_PROVIDER_KEY } from "../../src/features/provider-google/contracts";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { verifyGoogleConnection } from "../../src/features/provider-google/verify-google-connection.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const NOW = new Date("2026-09-28T17:00:00.000Z");
const TENANT_A = "10000000-0000-4000-8000-00000000d1d1";
const TENANT_B = "10000000-0000-4000-8000-00000000d2d2";
const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "race1-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "race1-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "race1-fixture-state-secret-0123456789abcdef",
};
const SCOPES = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

/* Every token this file mints, and the Google account it belongs to. */
const ACCOUNT_OF_TOKEN = new Map<string, string>();
const SUBJECT: Record<string, string> = { A: "111111111111111111111", B: "222222222222222222222", C: "333333333333333333333" };
let tokenSeq = 0;
function tokenFor(account: "A" | "B" | "C"): string {
  tokenSeq += 1;
  const t = `race1-${account}-${tokenSeq}-${randomBytes(4).toString("hex")}`;
  ACCOUNT_OF_TOKEN.set(t, account);
  return t;
}

/** Google `userinfo`: answers for whichever account the Bearer token belongs to; `fail` → 401. */
function google(fail = false) {
  return async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    if (fail) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { "content-type": "application/json" } });
    const bearer = String(init?.headers?.authorization ?? "").replace(/^Bearer /, "");
    const account = ACCOUNT_OF_TOKEN.get(bearer);
    if (!account) return new Response("{}", { status: 401, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ sub: SUBJECT[account], email: `${account.toLowerCase()}@race1.test`, email_verified: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

const tenantOf = (tenantId: string): TenantContext =>
  ({ tenantId, userId: `20000000-0000-4000-8000-${tenantId.slice(-12)}`, requestId: "race1" }) as TenantContext;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_race1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const credDeps = { getDb, env: ENV, now: () => NOW } as const;

  const commit = (tenant: TenantContext, id: string, token: string, extra: { refreshToken?: string; whileLockedForTest?: () => Promise<void>; fail?: boolean } = {}) =>
    commitGoogleGrant(
      tenant,
      id,
      { accessToken: token, refreshToken: extra.refreshToken ?? null, expiresAt: null, grantedScopes: SCOPES },
      NOW,
      { getDb, env: ENV, fetchImpl: google(extra.fail) as never, whileLockedForTest: extra.whileLockedForTest },
    );

  /** Durable truth for one connection. The live token is mapped to its account inside the callback. */
  async function truth(tenant: TenantContext, id: string) {
    const row = (await client.query(`select external_account_id, connection_state, health, scopes from integrations where id = $1`, [id])).rows[0];
    const listing = await listCredentialMetadata(tenant, id, credDeps);
    assert.ok(listing.status === "read");
    const liveAccess = listing.credentials.filter((c) => c.live && c.kind === "oauth_access");
    let liveAccessAccount: string | null = null;
    if (liveAccess.length === 1) {
      const opened = await withDecryptedSecret(tenant, liveAccess[0]!.credentialId, (s) => ACCOUNT_OF_TOKEN.get(s) ?? "unknown", credDeps);
      assert.ok(opened.status === "used", "the live credential opens");
      liveAccessAccount = opened.value;
    }
    const counts = (
      await client.query<{ creds: number; audits: number }>(
        `select (select count(*)::int from integration_credentials where integration_id = $1) creds,
                (select count(*)::int from audit_log where entity_id in (select id from integration_credentials where integration_id = $1)) audits`,
        [id],
      )
    ).rows[0]!;
    const boundAccount = Object.entries(SUBJECT).find(([, sub]) => sub === row.external_account_id)?.[0] ?? null;
    return { boundAccount, state: row.connection_state, health: row.health, liveAccessCount: liveAccess.length, liveAccessAccount, ...counts };
  }
  const coherent = (t: Awaited<ReturnType<typeof truth>>, label: string) => {
    assert.equal(t.liveAccessCount, 1, `${label}: exactly one live access credential`);
    assert.equal(t.liveAccessAccount, t.boundAccount, `${label}: the live token belongs to the BOUND account`);
    assert.equal(t.state, "connected", `${label}: connected`);
    assert.equal(t.health, "healthy", `${label}: healthy`);
  };

  /** Resolves once some other session is WAITING on a lock in this database. */
  async function untilSomeoneWaitsOnALock(): Promise<void> {
    for (let i = 0; i < 200; i += 1) {
      const n = (await client.query<{ n: number }>(`select count(*)::int n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`)).rows[0]!.n;
      if (n > 0) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("the second callback never waited on the row lock");
  }

  /** X holds its row lock until Y is blocked on it; then both finish. */
  async function raceOnOneRow(first: () => (hold: () => Promise<void>) => Promise<string>, second: () => Promise<string>) {
    const xLocked = deferred();
    const release = deferred();
    const x = first()(async () => {
      xLocked.resolve();
      await release.promise;
    });
    await xLocked.promise;
    const y = second();
    try {
      await untilSomeoneWaitsOnALock();
    } finally {
      release.resolve(); /* never leave the first callback holding its transaction open */
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

  try {
    await client.query(`insert into companies (id, name, slug) values ($1,'Acme','acme-race1'),($2,'Globex','globex-race1')`, [TENANT_A, TENANT_B]);
    const b = tenantOf(TENANT_B);
    /*
     * One tenant per section: a tenant may hold only ONE live connection per family per Google
     * account (`integrations_tenant_provider_account_uq`), a rule this phase does not touch.
     */
    let tenantSeq = 0;
    const newTenant = async (): Promise<TenantContext> => {
      tenantSeq += 1;
      const id = `10000000-0000-4000-8000-0000000e${String(tenantSeq).padStart(4, "0")}`;
      await client.query(`insert into companies (id, name, slug) values ($1, $2, $3)`, [id, `Race ${tenantSeq}`, `race1-t${tenantSeq}`]);
      return tenantOf(id);
    };
    let a = tenantOf(TENANT_A);
    const fresh = async (tenant: TenantContext, key: string = GOOGLE_PROVIDER_KEY, name = "Google") => {
      const created = await createConnection(tenant, { providerKey: key, name }, { getDb, now: () => NOW });
      assert.ok(created.status === "created");
      return created.connection.integrationId;
    };

    /* ═══ P · PRE-FIX: the released three-commit order violates the invariant ═══ */
    {
      const id = await fresh(a, GOOGLE_YOUTUBE_PROVIDER_KEY, "pre-fix proof");
      const write = async (token: string) => {
        const l = await listCredentialMetadata(a, id, credDeps);
        const live = l.status === "read" && l.credentials.some((c) => c.live && c.kind === "oauth_access");
        const input = { integrationId: id, kind: "oauth_access" as const, plaintext: token };
        return live ? replaceCredential(a, input, credDeps) : storeCredential(a, input, credDeps);
      };
      const verify = () => verifyGoogleConnection(a, id, { ...credDeps, fetchImpl: google() as never });
      const bind = (v: Awaited<ReturnType<typeof verify>>) =>
        db.transaction((tx) =>
          recordVerifiedConnectionWithin(tx, a, id, { externalAccountId: v.ok ? v.identity.subject : null, externalAccountLabel: v.ok ? v.identity.email : "", grantedScopes: SCOPES }, NOW),
        );
      const tA = tokenFor("A");
      const tB = tokenFor("B");
      await write(tA);
      const vA = await verify();
      await write(tB);
      assert.equal((await bind(vA)).status, "verified");
      const rB = await bind(await verify());
      assert.equal(rB.status === "refused" && rB.reason, "account-changed");
      const t = await truth(a, id);
      assert.equal(t.boundAccount, "A");
      assert.equal(t.liveAccessAccount, "B", "PRE-FIX VIOLATION: the row is bound to A, the live token is B's");
      assert.equal(t.state, "connected", "… and it reads connected");
    }

    /* ═══ 1 · SAME connection, SAME account, concurrent first binds ═══ */
    {
      a = await newTenant();
      const id = await fresh(a);
      const [x, y] = await raceOnOneRow(
        () => (hold) => commit(a, id, tokenFor("A"), { whileLockedForTest: hold }),
        () => commit(a, id, tokenFor("A")),
      );
      assert.deepEqual([x, y], ["connected", "connected"], "both bind the same account");
      const t = await truth(a, id);
      coherent(t, "§1");
      assert.equal(t.boundAccount, "A");
      assert.equal(t.creds, 2, "first stored, second replaced (one revoked row, one live)");
    }

    /* ═══ 2 · SAME connection, DIFFERENT accounts, concurrent first binds ═══ */
    let raced2 = "";
    let raced2Tenant = a;
    for (const [winner, loser] of [["A", "B"], ["B", "A"]] as const) {
      a = await newTenant();
      const id = await fresh(a, GOOGLE_PROVIDER_KEY, `race-${winner}`);
      if (winner === "A") {
        raced2 = id;
        raced2Tenant = a;
      }
      const [x, y] = await raceOnOneRow(
        () => (hold) => commit(a, id, tokenFor(winner), { refreshToken: tokenFor(winner), whileLockedForTest: hold }),
        () => commit(a, id, tokenFor(loser), { refreshToken: tokenFor(loser) }),
      );
      assert.equal(x, "connected", `§2 ${winner} wins the lock and binds`);
      assert.equal(y, "record-account-changed", `§2 ${loser} waited, saw ${winner}'s binding, and was refused`);
      const t = await truth(a, id);
      coherent(t, `§2 ${winner}-first`);
      assert.equal(t.boundAccount, winner, "exactly the winner is authoritative");
      assert.equal(t.creds, 2, "only the winner's access + refresh rows exist — the loser wrote NOTHING");
      assert.equal(t.audits, 2, "and only the winner's two credential audit rows");
    }

    /* ═══ 3 · already bound, SAME account ═══ */
    a = raced2Tenant;
    {
      assert.equal(await commit(a, raced2, tokenFor("A")), "connected");
      const t = await truth(a, raced2);
      coherent(t, "§3");
      assert.equal(t.boundAccount, "A");
    }

    /* ═══ 4 · already bound, DIFFERENT account — zero mutation ═══ */
    {
      const before = await truth(a, raced2);
      assert.equal(await commit(a, raced2, tokenFor("B"), { refreshToken: tokenFor("B") }), "record-account-changed");
      assert.deepEqual(await truth(a, raced2), before, "§4 nothing changed");
    }

    /* ═══ 5 · DIFFERENT connections do not wait on or touch each other ═══ */
    {
      a = await newTenant();
      const id1 = await fresh(a, GOOGLE_PROVIDER_KEY, "c1");
      const id2 = await fresh(a, GOOGLE_PROVIDER_KEY, "c2");
      const [x, y] = await mustNotWait((hold) => commit(a, id1, tokenFor("A"), { whileLockedForTest: hold }), () => commit(a, id2, tokenFor("B")));
      assert.equal(y, "connected", "§5 the other connection committed while the first held its lock");
      assert.equal(x, "connected");
      assert.equal((await truth(a, id1)).boundAccount, "A");
      assert.equal((await truth(a, id2)).boundAccount, "B");
      coherent(await truth(a, id1), "§5 c1");
      coherent(await truth(a, id2), "§5 c2");
      /* A THIRD row of the same family for an account this tenant already holds: the released unique rule, fail closed. */
      const id3 = await fresh(a, GOOGLE_PROVIDER_KEY, "c3");
      assert.equal(await commit(a, id3, tokenFor("A"), { refreshToken: tokenFor("A") }), "record-account-already-connected");
      const t3 = await truth(a, id3);
      assert.deepEqual({ creds: t3.creds, audits: t3.audits, state: t3.state, bound: t3.boundAccount }, { creds: 0, audits: 0, state: "draft", bound: null }, "§5 rolled back entirely");
    }

    /* ═══ 6 · google-workspace vs google-youtube, same tenant ═══ */
    {
      a = await newTenant();
      const ws = await fresh(a, GOOGLE_PROVIDER_KEY, "ws");
      const yt = await fresh(a, GOOGLE_YOUTUBE_PROVIDER_KEY, "yt");
      const [x, y] = await mustNotWait((hold) => commit(a, ws, tokenFor("A"), { whileLockedForTest: hold }), () => commit(a, yt, tokenFor("C")));
      assert.deepEqual([x, y], ["connected", "connected"], "§6 both families bind, to DIFFERENT accounts");
      coherent(await truth(a, ws), "§6 workspace");
      coherent(await truth(a, yt), "§6 youtube");
      assert.equal((await truth(a, ws)).boundAccount, "A");
      assert.equal((await truth(a, yt)).boundAccount, "C");
    }

    /* ═══ 7 · different tenants ═══ */
    a = tenantOf(TENANT_A);
    {
      const ia = await fresh(a, GOOGLE_PROVIDER_KEY, "ta");
      const ib = await fresh(b, GOOGLE_PROVIDER_KEY, "tb");
      const [x, y] = await mustNotWait((hold) => commit(a, ia, tokenFor("A"), { whileLockedForTest: hold }), () => commit(b, ib, tokenFor("B")));
      assert.deepEqual([x, y], ["connected", "connected"], "§7 tenant B never waits on tenant A");
      assert.equal((await truth(b, ib)).boundAccount, "B");
      assert.equal(await commit(b, ia, tokenFor("B")), "record-not-found", "§7 and cannot address A's row");
      assert.equal((await truth(a, ia)).boundAccount, "A");
    }

    /* ═══ 8 · failure inside the serialized section rolls back everything; identity failure writes nothing ═══ */
    {
      a = await newTenant();
      const id = await fresh(a, GOOGLE_PROVIDER_KEY, "fail");
      const tooLong = "x".repeat(CREDENTIAL_LIMITS.plaintextMaxLength + 1);
      const r = await commit(a, id, tokenFor("A"), { refreshToken: tooLong });
      assert.equal(r, "credential-invalid-input", "§8 the refresh write is refused AFTER the access write");
      const t = await truth(a, id);
      assert.deepEqual(
        { bound: t.boundAccount, creds: t.creds, audits: t.audits, state: t.state },
        { bound: null, creds: 0, audits: 0, state: "draft" },
        "§8 the access credential written earlier in the same transaction was rolled back; the row is as it was",
      );
      assert.equal(await commit(a, id, tokenFor("A"), { fail: true }), "verification-auth", "§8 Google refused the token");
      const t2 = await truth(a, id);
      assert.deepEqual({ creds: t2.creds, state: t2.state, bound: t2.boundAccount }, { creds: 0, state: "draft", bound: null }, "§8 nothing written");
    }

    console.log("GOOGLE-OAUTH-FIRST-BIND-RACE-1 concurrency (postgres): PASS");
  } finally {
    await handle.dispose().catch(() => {});
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
