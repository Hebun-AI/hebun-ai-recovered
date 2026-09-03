/*
 * GOOGLE-PICKER-1 — AN EXPIRED ACCESS TOKEN IS REPLACED BEFORE IT IS HANDED OUT.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   NO CALLER RECEIVES AN ACCESS TOKEN GOOGLE HAS ALREADY DECLARED OVER.
 *
 * The defect it pins: `withGoogleAccessToken` could only refresh REACTIVELY, after Google refused
 * the token. Every caller that spends the token against Google gets that refusal for free. The
 * Picker ceremony does not — it asks for the token and hands it to a browser — so the refusal never
 * came back, the reactive rule never fired, and a token that had expired ~92 hours earlier was put
 * into Google's own iframe, which answered 403.
 *
 * Every case below runs against a REAL Postgres and the REAL credential authority. The refresh is
 * the released one; nothing here constructs a second way to obtain a token.
 *
 * NO SECRET IS PRINTED. The fixtures are obviously-fake strings and are asserted on by identity,
 * never logged.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";

import { createControlPlaneDb } from "../../src/db/client.server";
import { createConnection, recordVerifiedConnectionWithin } from "../../src/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  storeCredential,
  withDecryptedSecret,
} from "../../src/features/integration-credentials/credential-repository.server";
import {
  ACCESS_TOKEN_EXPIRY_SKEW_MS,
  isAccessCredentialUsable,
  withGoogleAccessToken,
} from "../../src/features/provider-google/google-authorized-call.server";
import {
  GOOGLE_PROVIDER_KEY,
  GOOGLE_DRIVE_METADATA_SCOPE,
} from "../../src/features/provider-google/contracts";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000f5001";
const TENANT_B = "10000000-0000-4000-8000-0000000f5002";
const ACTOR_A = "20000000-0000-4000-8000-0000000f5101";
const ACTOR_B = "20000000-0000-4000-8000-0000000f5102";

const NOW = new Date("2026-09-03T19:00:00.000Z");
const EXPIRED_AT = new Date("2026-08-30T22:50:48.000Z"); /* production's own stale token */
const FRESH_UNTIL = new Date("2026-09-03T19:55:00.000Z");

const STALE_ACCESS = "picker1-fixture-access-STALE";
const FRESH_ACCESS = "picker1-fixture-access-FRESH";
const ROTATED_ACCESS = "picker1-fixture-access-ROTATED";
const REFRESH_SECRET = "picker1-fixture-refresh-ORIGINAL";

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "picker1-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "picker1-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "picker1-fixture-state-secret-0123456789abcdef",
};

const DRIVE_GRANT = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  GOOGLE_DRIVE_METADATA_SCOPE,
]);

function tenantOf(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, requestId: "picker1-test" } as TenantContext;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 0. THE RULE, READ AS A RULE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theFreshnessRuleIsStatedOnce(): void {
  const now = new Date("2026-09-03T19:00:00.000Z");

  assert.equal(
    isAccessCredentialUsable(null, now),
    true,
    "no stated expiry is NOT evidence of staleness — Google simply sent none",
  );
  assert.equal(
    isAccessCredentialUsable("not-a-date", now),
    true,
    "an unreadable expiry is not evidence either; the reactive rule still applies",
  );
  assert.equal(
    isAccessCredentialUsable(new Date(now.getTime() + 3_600_000).toISOString(), now),
    true,
    "an hour of life left is usable",
  );
  assert.equal(
    isAccessCredentialUsable(EXPIRED_AT.toISOString(), now),
    false,
    "production's own token, expired days earlier, is not usable",
  );

  /* The skew is a boundary, so it is asserted on both sides of itself. */
  const justInside = new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_SKEW_MS + 1_000).toISOString();
  const justOutside = new Date(now.getTime() + ACCESS_TOKEN_EXPIRY_SKEW_MS - 1_000).toISOString();
  assert.equal(isAccessCredentialUsable(justInside, now), true, "beyond the skew is usable");
  assert.equal(
    isAccessCredentialUsable(justOutside, now),
    false,
    "inside the skew is treated as spent — a token that dies in flight fails at Google",
  );
  assert.equal(
    isAccessCredentialUsable(now.toISOString(), now),
    false,
    "expiring exactly now is not usable",
  );
}

async function main(): Promise<void> {
  theFreshnessRuleIsStatedOnce();

  const harness = createDisposablePostgresHarness("hebun_picker1_freshness");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const deps = { getDb, now: () => NOW, env: ENV } as const;

  const a = tenantOf(TENANT_A, ACTOR_A);
  const b = tenantOf(TENANT_B, ACTOR_B);

  /*
   * A connected Google connection holding the Drive grant, for whichever tenant is asked.
   *
   * Each case gets its OWN connection under a distinct external account, because
   * `integrations_tenant_provider_account_uq` allows one connection per (tenant, provider, account)
   * — and because a case that inherited another case's credential rows would prove nothing about
   * its own.
   */
  let accountSeq = 0;
  async function connectedGoogle(tenant: TenantContext): Promise<string> {
    accountSeq += 1;
    const created = await createConnection(
      tenant,
      { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
      { getDb, now: () => NOW },
    );
    assert.ok(created.status === "created");
    const id = created.connection.integrationId;
    await storeCredential(
      tenant,
      { integrationId: id, kind: "oauth_access", plaintext: STALE_ACCESS, expiresAt: EXPIRED_AT },
      deps,
    );
    await db.transaction(async (tx) =>
      recordVerifiedConnectionWithin(
        tx,
        tenant,
        id,
        {
          externalAccountId: `sub-${tenant.tenantId.slice(-4)}-${accountSeq}`,
          externalAccountLabel: "director@example.test",
          grantedScopes: [...DRIVE_GRANT],
        },
        NOW,
      ),
    );
    return id;
  }

  /** How many live access credentials this connection holds. The invariant is always exactly one. */
  async function liveAccessCount(tenant: TenantContext, integrationId: string): Promise<number> {
    const listing = await listCredentialMetadata(tenant, integrationId, deps);
    assert.ok(listing.status === "read");
    return listing.credentials.filter((c) => c.kind === "oauth_access" && c.live).length;
  }

  async function liveAccess(tenant: TenantContext, integrationId: string) {
    const listing = await listCredentialMetadata(tenant, integrationId, deps);
    assert.ok(listing.status === "read");
    const row = listing.credentials.find((c) => c.kind === "oauth_access" && c.live);
    assert.ok(row, "a live access credential exists");
    return row;
  }

  try {
    await client.query(
      `insert into companies (id, name, slug) values ($1,'Acme','acme-picker1'),($2,'Globex','globex-picker1')`,
      [TENANT_A, TENANT_B],
    );

    /* ══ 1. FRESH TOKEN — NO REFRESH, AND THE PROVIDER IS NEVER ASKED FOR ONE ══ */
    {
      const id = await connectedGoogle(a);
      /* Replace the stale fixture with a fresh one through the ordinary authority. */
      const { replaceCredentialFromProviderRefresh } = await import(
        "../../src/features/integration-credentials/credential-repository.server"
      );
      const fresh = await replaceCredentialFromProviderRefresh(
        a,
        { integrationId: id, kind: "oauth_access", plaintext: FRESH_ACCESS, expiresAt: FRESH_UNTIL },
        deps,
      );
      assert.equal(fresh.status, "replaced");
      await storeCredential(
        a,
        { integrationId: id, kind: "oauth_refresh", plaintext: REFRESH_SECRET },
        deps,
      );

      let tokenEndpointCalls = 0;
      let seen: string | null = null;
      const result = await withGoogleAccessToken(
        a,
        id,
        async (accessToken) => {
          seen = accessToken;
          return { ok: true as const, value: "spent" };
        },
        {
          ...deps,
          fetchImpl: async () => {
            tokenEndpointCalls += 1;
            return json(200, { access_token: ROTATED_ACCESS, expires_in: 3600 });
          },
        },
      );

      assert.ok(result.ok, "a fresh token is spent as it always was");
      assert.equal(seen, FRESH_ACCESS, "the caller received the live token, unchanged");
      assert.equal(tokenEndpointCalls, 0, "and Google's token endpoint was never contacted");
      assert.equal(await liveAccessCount(a, id), 1, "exactly one live access credential remains");
    }

    /* ══ 2. EXPIRED + VALID REFRESH — REPLACED BEFORE THE ATTEMPT ═════════════ */
    {
      const id = await connectedGoogle(b);
      await storeCredential(
        b,
        { integrationId: id, kind: "oauth_refresh", plaintext: REFRESH_SECRET },
        deps,
      );
      const before = await liveAccess(b, id);

      let tokenEndpointCalls = 0;
      let sentRefreshCredential: string | null = null;
      let seen: string | null = null;
      const result = await withGoogleAccessToken(
        b,
        id,
        async (accessToken) => {
          seen = accessToken;
          return { ok: true as const, value: "spent" };
        },
        {
          ...deps,
          fetchImpl: async (_url: unknown, init?: { body?: unknown }) => {
            tokenEndpointCalls += 1;
            const body = String(init?.body ?? "");
            sentRefreshCredential = new URLSearchParams(body).get("refresh_token");
            return json(200, { access_token: ROTATED_ACCESS, expires_in: 3600 });
          },
        },
      );

      assert.ok(result.ok, "the call succeeds on the replacement");
      assert.equal(
        seen,
        ROTATED_ACCESS,
        "THE POINT OF THE REPAIR — the caller received the FRESH token, never the stale one",
      );
      assert.notEqual(seen, STALE_ACCESS, "and never the token Google had already declared over");
      assert.equal(tokenEndpointCalls, 1, "exactly one exchange, through the existing authority");
      assert.equal(
        sentRefreshCredential,
        REFRESH_SECRET,
        "the released refresh credential was the one spent",
      );

      /* PERSISTED, not held in memory: the replacement is a durable credential. */
      const after = await liveAccess(b, id);
      assert.notEqual(after.credentialId, before.credentialId, "a new credential row is live");
      assert.equal(await liveAccessCount(b, id), 1, "and exactly one is live — never two");
      const opened = await withDecryptedSecret(
        b,
        after.credentialId,
        async (secret) => secret === ROTATED_ACCESS,
        deps,
      );
      assert.ok(opened.status === "used" && opened.value === true, "the persisted row is the fresh token");
      assert.equal(
        after.expiresAt,
        new Date(NOW.getTime() + 3_600_000).toISOString(),
        "with Google's own stated expiry recorded, so the next call can read it",
      );

      /* And the SECOND call needs no exchange at all — the freshness rule now says usable. */
      let secondCalls = 0;
      const again = await withGoogleAccessToken(
        b,
        id,
        async () => ({ ok: true as const, value: "spent-again" }),
        { ...deps, fetchImpl: async () => { secondCalls += 1; return json(200, {}); } },
      );
      assert.ok(again.ok);
      assert.equal(secondCalls, 0, "a replacement is not refreshed again on the next call");
    }

    /* ══ 3. EXPIRED + REFRESH FAILURE — FAIL CLOSED, NO STALE TOKEN ═══════════ */
    {
      const id = await connectedGoogle(a);
      await storeCredential(
        a,
        { integrationId: id, kind: "oauth_refresh", plaintext: REFRESH_SECRET },
        deps,
      );

      let callbackRan = false;
      const result = await withGoogleAccessToken(
        a,
        id,
        async () => {
          callbackRan = true;
          return { ok: true as const, value: "must-never-run" };
        },
        { ...deps, fetchImpl: async () => json(400, { error: "invalid_grant" }) },
      );

      assert.ok(!result.ok, "a refusal, not a token");
      assert.equal(
        callbackRan,
        false,
        "THE FAIL-CLOSED ASSERTION — the stale token is never handed to the caller",
      );
      if (!result.ok) assert.equal(result.failure, "auth");
      assert.equal(
        await liveAccessCount(a, id),
        1,
        "and a failed exchange left the existing credential alone",
      );
    }

    /* ══ 4. EXPIRED + NO REFRESH CREDENTIAL — FAIL CLOSED ════════════════════ */
    {
      const id = await connectedGoogle(b);

      let callbackRan = false;
      let providerCalls = 0;
      const result = await withGoogleAccessToken(
        b,
        id,
        async () => {
          callbackRan = true;
          return { ok: true as const, value: "must-never-run" };
        },
        { ...deps, fetchImpl: async () => { providerCalls += 1; return json(200, {}); } },
      );

      assert.ok(!result.ok, "with nothing to replace it, the expired token is refused");
      assert.equal(callbackRan, false, "the stale token never reaches a caller");
      assert.equal(providerCalls, 0, "and no provider call is attempted on a token known to be over");
      if (!result.ok) {
        assert.equal(result.failure, "auth");
        assert.equal(
          result.reason,
          "access-credential-expired-no-refresh",
          "the reason names the actual situation, not a Google refusal that never happened",
        );
      }
    }

    /* ══ 5. DECRYPTION FAILURE ON THE REPLACEMENT PATH — FAIL CLOSED ═════════ */
    {
      const id = await connectedGoogle(a);
      await storeCredential(
        a,
        { integrationId: id, kind: "oauth_refresh", plaintext: REFRESH_SECRET },
        deps,
      );

      /* A registry that cannot open the rows this connection holds. Fail closed, not fall through. */
      const wrongKeys = {
        ...ENV,
        [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k9:${randomBytes(32).toString("base64")}`,
        [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k9",
      };
      let callbackRan = false;
      const result = await withGoogleAccessToken(
        a,
        id,
        async () => {
          callbackRan = true;
          return { ok: true as const, value: "must-never-run" };
        },
        { ...deps, env: wrongKeys, fetchImpl: async () => json(200, { access_token: ROTATED_ACCESS }) },
      );

      assert.ok(!result.ok, "an unopenable credential is a refusal");
      assert.equal(callbackRan, false, "and no plaintext reaches the caller");
      if (!result.ok) assert.equal(result.failure, "auth");
    }

    /* ══ 6. TENANT ISOLATION — THE REPAIR OPENED NO CROSS-TENANT DOOR ════════ */
    {
      const idA = await connectedGoogle(a);
      await storeCredential(
        a,
        { integrationId: idA, kind: "oauth_refresh", plaintext: REFRESH_SECRET },
        deps,
      );

      let callbackRan = false;
      let providerCalls = 0;
      const attempted = await withGoogleAccessToken(
        b,
        idA,
        async () => {
          callbackRan = true;
          return { ok: true as const, value: "must-never-run" };
        },
        { ...deps, fetchImpl: async () => { providerCalls += 1; return json(200, {}); } },
      );

      assert.ok(!attempted.ok, "another tenant's expired credential is not this tenant's to replace");
      assert.equal(callbackRan, false);
      assert.equal(providerCalls, 0, "and no refresh is spent on a credential the caller cannot see");
      if (!attempted.ok) {
        assert.equal(
          attempted.reason,
          "no-live-access-credential",
          "it reads as ABSENT — the freshness rule is never reached for a credential of another tenant",
        );
      }
      assert.equal(
        await liveAccessCount(a, idA),
        1,
        "and tenant A's own credential was not touched by tenant B's attempt",
      );
    }

    console.log("google-picker-1-token-freshness/access-token-freshness: all assertions passed");
  } finally {
    await client.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
