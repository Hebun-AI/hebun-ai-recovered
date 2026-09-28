/*
 * GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1 — a refused Google account change writes NOTHING.
 *
 * Against a real (disposable) Postgres and the RELEASED authorities — Integration (connections,
 * `recordVerifiedConnectionWithin`), INT-2 credentials (`storeCredential` / `replaceCredential`),
 * the Google verifier — with Google's `userinfo` answered by a fixture. `runCallbackTail` runs what
 * the route runs after the scope check — `commitGoogleGrant` (since GOOGLE-OAUTH-FIRST-BIND-RACE-1,
 * one transaction: lock → compare → INT-2 write → bind); §0 pins that the route calls exactly that.
 *
 *   §0  route order: exchange → scope check → commitGoogleGrant, and no credential write of its own
 *   §1  bound + SAME account → the released path runs (credential replaced, connected)
 *   §2  bound + DIFFERENT account → `record-account-changed`, credential rows byte-identical,
 *       account/label/state/scopes/health unchanged — and the pre-fix order is shown to leak (bite)
 *   §3  unbound (first binding) → binds exactly as before
 *   §4  tenant isolation — tenant B's Google rows untouched by everything above
 *   §5  family isolation — google-youtube bound to a DIFFERENT account than google-workspace is
 *       legitimate, and each is compared only with itself
 *   §6  identity unreadable before a write (401 / 5xx) → nothing written
 *
 * No token value is printed: credential rows are compared by an md5 over the row text.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createConnection,
  isAccountChange,
  recordVerifiedConnectionWithin,
} from "../../src/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  replaceCredential,
  storeCredential,
} from "../../src/features/integration-credentials/credential-repository.server";
import { GOOGLE_PROVIDER_KEY, GOOGLE_YOUTUBE_PROVIDER_KEY } from "../../src/features/provider-google/contracts";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { commitGoogleGrant } from "../../src/features/provider-google/bind-google-grant.server";
import { verifyGoogleConnection } from "../../src/features/provider-google/verify-google-connection.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const TENANT_A = "10000000-0000-4000-8000-00000000a1a1";
const TENANT_B = "10000000-0000-4000-8000-00000000b2b2";
const ACTOR_A = "20000000-0000-4000-8000-00000000a1a1";
const ACTOR_B = "20000000-0000-4000-8000-00000000b2b2";
const NOW = new Date("2026-09-28T16:00:00.000Z");

const ACCOUNT_1 = { sub: "111111111111111111111", email: "owner@acme.test" };
const ACCOUNT_2 = { sub: "222222222222222222222", email: "someone-else@other.test" };
const ACCOUNT_3 = { sub: "333333333333333333333", email: "channel@acme.test" };

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "gai1-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "gai1-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "gai1-fixture-state-secret-0123456789abcdef",
};

const WORKSPACE_SCOPES = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
]);
const WIDER_SCOPES = Object.freeze([...WORKSPACE_SCOPES, "https://www.googleapis.com/auth/drive.readonly"]);

const tenantOf = (tenantId: string, userId: string): TenantContext => ({ tenantId, userId, requestId: "gai1" }) as TenantContext;

/** Google `userinfo`, answered as `account` for every call. Counts calls. */
function googleAs(account: { sub: string; email: string } | { status: number }) {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if ("status" in account) {
      return new Response(JSON.stringify({ error: "fixture" }), { status: account.status, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ sub: account.sub, email: account.email, email_verified: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls: () => calls };
}

interface Grant {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly grantedScopes: readonly string[];
}

async function main(): Promise<void> {
  /* ═══ §0 THE ROUTE'S ORDER ═══ */
  const route = readFileSync(path.join(process.cwd(), "src/app/api/integrations/google/callback/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const body = route.slice(route.indexOf("export async function GET"));
  const at = (needle: string) => {
    const i = body.indexOf(needle);
    assert.ok(i > 0, `callback contains ${needle}`);
    return i;
  };
  const sequence = ["exchangeAuthorizationCode(", "coversRequiredScopes(", "commitGoogleGrant("];
  for (let i = 1; i < sequence.length; i += 1) {
    assert.ok(at(sequence[i - 1]!) < at(sequence[i]!), `${sequence[i - 1]} precedes ${sequence[i]} in the callback`);
  }
  for (const own of ["storeCredential(", "replaceCredential(", "recordVerifiedConnectionWithin(", "verifyGoogleConnection("]) {
    assert.ok(!body.includes(own), `the callback makes no ${own} of its own — the one commit does`);
  }
  assert.equal(isAccountChange(null, "x"), false, "an unbound row may bind its first account");
  assert.equal(isAccountChange("x", "x"), false, "the same account is not a change");
  assert.equal(isAccountChange("x", "y"), true, "a different account is a change");
  assert.equal(isAccountChange("x", null), true, "a bound row never becomes accountless");

  const harness = createDisposablePostgresHarness("hebun_gai1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const deps = { getDb, now: () => NOW, env: ENV } as const;

  /**
   * The callback after `coversRequiredScopes`, step for step (route steps 3b–6). `guarded: false`
   * is the PRE-FIX order, kept only to prove the defect this phase removes.
   */
  async function runCallbackTail(
    tenant: TenantContext,
    integrationId: string,
    grant: Grant,
    google: ReturnType<typeof googleAs>,
    guarded = true,
  ): Promise<string> {
    if (guarded) {
      return commitGoogleGrant(
        tenant,
        integrationId,
        { accessToken: grant.accessToken, refreshToken: grant.refreshToken, expiresAt: null, grantedScopes: grant.grantedScopes },
        NOW,
        { getDb, env: ENV, fetchImpl: google.fetchImpl },
      );
    }
    /* PRE-FIX (released before GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1): write → verify → bind, three commits. */
    const existing = await listCredentialMetadata(tenant, integrationId, deps);
    const live = existing.status === "read" ? existing.credentials.filter((c) => c.live) : [];
    const access = { integrationId, kind: "oauth_access" as const, plaintext: grant.accessToken };
    const storedAccess = live.some((c) => c.kind === "oauth_access")
      ? await replaceCredential(tenant, access, deps)
      : await storeCredential(tenant, access, deps);
    if (storedAccess.status === "refused") return `credential-${storedAccess.reason}`;
    if (grant.refreshToken) {
      const refresh = { integrationId, kind: "oauth_refresh" as const, plaintext: grant.refreshToken };
      const storedRefresh = live.some((c) => c.kind === "oauth_refresh")
        ? await replaceCredential(tenant, refresh, deps)
        : await storeCredential(tenant, refresh, deps);
      if (storedRefresh.status === "refused") return `credential-${storedRefresh.reason}`;
    }
    const verification = await verifyGoogleConnection(tenant, integrationId, { ...deps, fetchImpl: google.fetchImpl });
    if (!verification.ok) return `verification-${verification.failure}`;
    const recorded = await db.transaction(async (tx) =>
      recordVerifiedConnectionWithin(
        tx,
        tenant,
        integrationId,
        {
          externalAccountId: verification.identity.subject,
          externalAccountLabel: verification.identity.email,
          grantedScopes: grant.grantedScopes,
        },
        NOW,
      ),
    );
    return recorded.status === "verified" ? "connected" : `record-${recorded.reason}`;
  }

  /** Everything this phase promises not to touch, for one connection. Token values never leave SQL. */
  async function snapshot(integrationId: string) {
    const row = (
      await client.query(
        `select connection_state, health, external_account_id, external_account_label, scopes, last_verified_at, updated_at
           from integrations where id = $1`,
        [integrationId],
      )
    ).rows[0];
    const creds = (
      await client.query<{ n: number; h: string | null }>(
        `select count(*)::int n, md5(string_agg(t::text, '|' order by t.id)) h from integration_credentials t where integration_id = $1`,
        [integrationId],
      )
    ).rows[0]!;
    return { row, credentialRows: creds.n, credentialDigest: creds.h };
  }

  try {
    await client.query(
      `insert into companies (id, name, slug) values ($1,'Acme','acme-gai1'),($2,'Globex','globex-gai1')`,
      [TENANT_A, TENANT_B],
    );
    const a = tenantOf(TENANT_A, ACTOR_A);
    const b = tenantOf(TENANT_B, ACTOR_B);

    const newConnection = async (tenant: TenantContext, providerKey: string, name: string) => {
      const created = await createConnection(tenant, { providerKey, name }, { getDb, now: () => NOW });
      assert.ok(created.status === "created", `create refused: ${JSON.stringify(created)}`);
      return created.connection.integrationId;
    };

    /* ═══ §3 FIRST BINDING (unbound row) — unchanged behaviour ═══ */
    const wsA = await newConnection(a, GOOGLE_PROVIDER_KEY, "Google Workspace");
    {
      const google = googleAs(ACCOUNT_1);
      const result = await runCallbackTail(a, wsA, { accessToken: "gai1-a1-access-1", refreshToken: "gai1-a1-refresh-1", grantedScopes: WORKSPACE_SCOPES }, google);
      assert.equal(result, "connected", "a first binding connects");
      assert.equal(google.calls(), 1, "one identity call, for the token being bound");
      const s = await snapshot(wsA);
      assert.equal(s.row.external_account_id, ACCOUNT_1.sub);
      assert.equal(s.row.connection_state, "connected");
      assert.equal(s.credentialRows, 2, "access + refresh stored");
    }

    /* Tenant B holds its own Google connection, bound to ACCOUNT_2. Watched through every section. */
    const wsB = await newConnection(b, GOOGLE_PROVIDER_KEY, "Google Workspace");
    assert.equal(
      await runCallbackTail(b, wsB, { accessToken: "gai1-b-access", refreshToken: "gai1-b-refresh", grantedScopes: WORKSPACE_SCOPES }, googleAs(ACCOUNT_2)),
      "connected",
    );
    const tenantBBefore = await snapshot(wsB);

    /* ═══ §1 BOUND + SAME ACCOUNT — the released path runs ═══ */
    {
      const before = await snapshot(wsA);
      const google = googleAs(ACCOUNT_1);
      const result = await runCallbackTail(a, wsA, { accessToken: "gai1-a1-access-2", grantedScopes: WIDER_SCOPES }, google);
      assert.equal(result, "connected", "re-consent as the same account is accepted");
      assert.equal(google.calls(), 1, "one identity call, before anything is written");
      const after = await snapshot(wsA);
      assert.notEqual(after.credentialDigest, before.credentialDigest, "the access credential was replaced through INT-2");
      assert.equal(after.row.external_account_id, ACCOUNT_1.sub, "binding unchanged");
      assert.deepEqual(after.row.scopes, [...WIDER_SCOPES], "scopes are Google's statement of the new grant");
    }

    /* ═══ §2 BOUND + DIFFERENT ACCOUNT — refused, nothing written ═══ */
    {
      const before = await snapshot(wsA);
      const google = googleAs(ACCOUNT_2);
      const result = await runCallbackTail(
        a,
        wsA,
        { accessToken: "gai1-a2-WRONG-access", refreshToken: "gai1-a2-WRONG-refresh", grantedScopes: WIDER_SCOPES },
        google,
      );
      assert.equal(result, "record-account-changed", "the established outcome label");
      assert.equal(google.calls(), 1, "refused on the one identity call; nothing else ran");
      const after = await snapshot(wsA);
      assert.equal(after.credentialDigest, before.credentialDigest, "credential rows are byte-identical");
      assert.equal(after.credentialRows, before.credentialRows, "no credential row added");
      assert.deepEqual(after.row, before.row, "account, label, state, health, scopes and timestamps unchanged");
    }

    /* BITE: the PRE-FIX order leaks the other account's token while still refusing. */
    {
      const leakA = await newConnection(a, GOOGLE_YOUTUBE_PROVIDER_KEY, "YouTube (pre-fix proof)");
      assert.equal(
        await runCallbackTail(a, leakA, { accessToken: "gai1-leak-1", grantedScopes: WORKSPACE_SCOPES }, googleAs(ACCOUNT_1)),
        "connected",
      );
      const before = await snapshot(leakA);
      const result = await runCallbackTail(a, leakA, { accessToken: "gai1-leak-WRONG", grantedScopes: WORKSPACE_SCOPES }, googleAs(ACCOUNT_2), false);
      assert.equal(result, "record-account-changed", "pre-fix also refuses …");
      const after = await snapshot(leakA);
      assert.notEqual(after.credentialDigest, before.credentialDigest, "… but only after the wrong account's token was written");
      assert.notEqual(after.row.connection_state, before.row.connection_state, "… and the row was moved off `connected`");
      await client.query(`update integrations set connection_state = 'disconnected' where id = $1`, [leakA]).catch(() => {});
    }

    /* ═══ §5 FAMILY ISOLATION — a different account on google-youtube is legitimate ═══ */
    {
      const ytA = await newConnection(a, GOOGLE_YOUTUBE_PROVIDER_KEY, "YouTube");
      const wsBefore = await snapshot(wsA);
      assert.equal(
        await runCallbackTail(a, ytA, { accessToken: "gai1-yt-access", grantedScopes: WORKSPACE_SCOPES }, googleAs(ACCOUNT_3)),
        "connected",
        "google-youtube binds ACCOUNT_3 while google-workspace holds ACCOUNT_1",
      );
      assert.equal((await snapshot(ytA)).row.external_account_id, ACCOUNT_3.sub);
      assert.deepEqual(await snapshot(wsA), wsBefore, "binding the YouTube row touched nothing on the Workspace row");
      /* and each row is compared only with itself */
      assert.equal(
        await runCallbackTail(a, ytA, { accessToken: "gai1-yt-as-ws-account", grantedScopes: WORKSPACE_SCOPES }, googleAs(ACCOUNT_1)),
        "record-account-changed",
        "the Workspace account is still a DIFFERENT account for the YouTube row",
      );
      assert.equal(
        await runCallbackTail(a, wsA, { accessToken: "gai1-ws-as-yt-account", grantedScopes: WORKSPACE_SCOPES }, googleAs(ACCOUNT_3)),
        "record-account-changed",
        "and vice versa",
      );
      assert.deepEqual(await snapshot(wsA), wsBefore, "neither refusal wrote to the Workspace row");
    }

    /* ═══ §6 IDENTITY UNREADABLE BEFORE A WRITE — nothing written ═══ */
    for (const status of [401, 503]) {
      const before = await snapshot(wsA);
      const result = await runCallbackTail(a, wsA, { accessToken: `gai1-unreadable-${status}`, grantedScopes: WORKSPACE_SCOPES }, googleAs({ status }));
      assert.ok(result.startsWith("verification-"), `${status}: refused as a verification outcome (${result})`);
      assert.deepEqual(await snapshot(wsA), before, `${status}: credential and row unchanged`);
    }

    /* A connection of ANOTHER tenant is not found, never compared. */
    assert.equal(
      await commitGoogleGrant(a, wsB, { accessToken: "gai1-cross", refreshToken: null, expiresAt: null, grantedScopes: WORKSPACE_SCOPES }, NOW, {
        getDb,
        env: ENV,
        fetchImpl: googleAs(ACCOUNT_2).fetchImpl,
      }),
      "record-not-found",
      "tenant A cannot even address tenant B's connection",
    );

    /* ═══ §4 TENANT ISOLATION ═══ */
    assert.deepEqual(await snapshot(wsB), tenantBBefore, "tenant B's Google connection and credentials are untouched by all of the above");

    console.log("GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1 account integrity (postgres): PASS");
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
