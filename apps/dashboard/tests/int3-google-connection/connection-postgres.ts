/*
 * INT-3 — THE CONNECTION LIFECYCLE, AGAINST A REAL DATABASE AND A MOCKED GOOGLE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A stored, decryptable Google credential is NOT a connection. Only a real answer from Google
 *    produces `connected` — and a Google outage never ends a grant that is still valid."
 *
 * Google is mocked so every branch is reachable on demand; the credential authority, the vault, the
 * connection authority and the database are all REAL. Disposable database, dropped on exit.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createConnection,
  recordVerificationFailureWithin,
  recordVerifiedConnectionWithin,
} from "../../src/features/integration-authority/integration-repository.server";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import { storeCredential, listCredentialMetadata } from "../../src/features/integration-credentials/credential-repository.server";
import { verifyGoogleConnection, lifecycleClassFor } from "../../src/features/provider-google/verify-google-connection.server";
import { GOOGLE_PROVIDER_KEY } from "../../src/features/provider-google/contracts";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000f001";
const TENANT_B = "10000000-0000-4000-8000-00000000f002";
const ACTOR_A = "20000000-0000-4000-8000-00000000f101";
const ACTOR_B = "20000000-0000-4000-8000-00000000f102";
const NOW = new Date("2026-08-23T10:00:00.000Z");

/** THE FIXTURE TOKEN. Its absence from metadata, audit and logs is asserted below. */
const ACCESS_TOKEN = "int3-fixture-google-access-token-9f21";
const SUBJECT = "104729000000000000001";
const EMAIL = "director@example-workspace.com";

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "int3-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "int3-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "int3-fixture-state-secret-0123456789abcdef",
};

const GRANTED = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

function tenantOf(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, requestId: "test-request" } as TenantContext;
}

function googleAnswers(status: number, body: unknown) {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const IDENTITY_OK = googleAnswers(200, {
  sub: SUBJECT,
  email: EMAIL,
  email_verified: true,
  hd: "example-workspace.com",
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_int3_google");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const deps = { getDb, now: () => NOW, env: ENV } as const;

  try {
    await client.query(
      `insert into companies (id, name, slug) values ($1,'Acme','acme-int3'),($2,'Globex','globex-int3')`,
      [TENANT_A, TENANT_B],
    );
    const a = tenantOf(TENANT_A, ACTOR_A);
    const b = tenantOf(TENANT_B, ACTOR_B);

    /* ── 1. THE REAL CATALOG NOW OFFERS GOOGLE, AND ONLY GOOGLE ─────────────── */
    const created = await createConnection(
      a,
      { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
      { getDb, now: () => NOW },
    );
    assert.ok(created.status === "created", `create refused: ${JSON.stringify(created)}`);
    const idA = created.connection.integrationId;
    assert.equal(created.connection.connectionState, "draft");

    const bogus = await createConnection(a, { providerKey: "slack", name: "Slack" }, { getDb, now: () => NOW });
    assert.deepEqual(bogus, { status: "refused", reason: "unknown-provider" }, "only Google exists");

    /* ── 2. STORING A GOOGLE TOKEN PRODUCES `unverified`, NEVER `connected` ── */
    const stored = await storeCredential(
      a,
      { integrationId: idA, kind: "oauth_access", plaintext: ACCESS_TOKEN },
      deps,
    );
    assert.ok(stored.status === "stored");
    assert.equal(
      stored.connectionState,
      "unverified",
      "a stored Google token is an UNPROVEN token — Google has said nothing yet",
    );

    {
      const state = await client.query<{ connection_state: string; external_account_id: string | null }>(
        `select connection_state, external_account_id from integrations where id = $1`,
        [idA],
      );
      assert.equal(state.rows[0]!.connection_state, "unverified");
      assert.equal(state.rows[0]!.external_account_id, null, "no account is claimed before Google answers");
    }

    /* AND DECRYPTING IT CHANGES NOTHING. Decryption is not verification. */
    {
      const listing = await listCredentialMetadata(a, idA, deps);
      assert.ok(listing.status === "read" && listing.credentials.length === 1);
      const state = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [idA],
      );
      assert.equal(state.rows[0]!.connection_state, "unverified");
    }

    /* ── 3. A TRANSPORT FAILURE NEVER ENDS A GRANT ───────────────────────────── */
    for (const [label, status] of [["503", 503], ["429", 429]] as const) {
      const outcome = await verifyGoogleConnection(a, idA, {
        ...deps,
        fetchImpl: googleAnswers(status, { error: "backendError" }),
      });
      assert.ok(!outcome.ok, `${label} must not verify`);
      assert.equal(outcome.failure, "transport", `${label} is a provider problem, not a grant problem`);
      assert.equal(lifecycleClassFor(outcome.failure), "unreachable");

      await db.transaction(async (tx) => {
        await recordVerificationFailureWithin(
          tx,
          a,
          idA,
          { kind: lifecycleClassFor(outcome.failure), reason: outcome.reason },
          NOW,
        );
      });
      const row = await client.query<{ connection_state: string; health: string; failure_reason: string }>(
        `select connection_state, health, failure_reason from integrations where id = $1`,
        [idA],
      );
      assert.equal(
        row.rows[0]!.connection_state,
        "unverified",
        `${label} must NOT move the lifecycle — the grant is untouched`,
      );
      assert.equal(row.rows[0]!.health, "unreachable", "only health moved");
      assert.ok(!row.rows[0]!.failure_reason.includes(ACCESS_TOKEN), "and the reason carries no token");
    }

    /* ── 4. AND ONLY NOW, A REAL ANSWER FROM GOOGLE ──────────────────────────── */
    {
      const outcome = await verifyGoogleConnection(a, idA, { ...deps, fetchImpl: IDENTITY_OK });
      assert.ok(outcome.ok, `verification failed: ${JSON.stringify(outcome)}`);
      assert.equal(outcome.identity.subject, SUBJECT);
      assert.equal(outcome.identity.hostedDomain, "example-workspace.com");

      const recorded = await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          idA,
          {
            externalAccountId: outcome.identity.subject,
            externalAccountLabel: outcome.identity.email,
            grantedScopes: GRANTED,
          },
          NOW,
        ),
      );
      assert.ok(recorded.status === "verified");
      assert.equal(recorded.connection.connectionState, "connected");
      assert.equal(recorded.connection.health, "healthy");
      assert.equal(recorded.connection.externalAccountId, SUBJECT, "`sub` is the identity");
      assert.equal(recorded.connection.externalAccountLabel, EMAIL, "email is only the label");
      assert.deepEqual(recorded.connection.scopes, [...GRANTED], "scopes are Google's own statement");
      assert.equal(recorded.connection.lastVerifiedAt, NOW.toISOString());

      const row = await client.query<{ connection_state: string; health: string; last_verified_at: Date }>(
        `select connection_state, health, last_verified_at from integrations where id = $1`,
        [idA],
      );
      assert.equal(row.rows[0]!.connection_state, "connected", "THE FIRST REAL CONNECTED ROW");
      assert.equal(row.rows[0]!.health, "healthy");
      assert.ok(row.rows[0]!.last_verified_at instanceof Date);
    }

    /* ── 5. THE ACCOUNT MAY NOT CHANGE UNDER A CONNECTION ────────────────────── */
    {
      const substituted = await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          idA,
          {
            externalAccountId: "999999999999999999999",
            externalAccountLabel: "attacker@example.com",
            grantedScopes: GRANTED,
          },
          NOW,
        ),
      );
      assert.deepEqual(
        substituted,
        { status: "refused", reason: "account-changed" },
        "a connection authorized for one Google account must never silently become another",
      );
      const row = await client.query<{ external_account_id: string }>(
        `select external_account_id from integrations where id = $1`,
        [idA],
      );
      assert.equal(row.rows[0]!.external_account_id, SUBJECT, "and the original account is untouched");
    }

    /* ── 6. AN AUTH FAILURE IS `expired`, NEVER `revoked` ────────────────────── */
    {
      const outcome = await verifyGoogleConnection(a, idA, {
        ...deps,
        fetchImpl: googleAnswers(401, { error: "invalid_token" }),
      });
      assert.ok(!outcome.ok && outcome.failure === "auth");

      await db.transaction(async (tx) => {
        await recordVerificationFailureWithin(
          tx,
          a,
          idA,
          { kind: lifecycleClassFor(outcome.failure), reason: outcome.reason },
          NOW,
        );
      });
      const row = await client.query<{ connection_state: string; health: string }>(
        `select connection_state, health from integrations where id = $1`,
        [idA],
      );
      assert.equal(
        row.rows[0]!.connection_state,
        "expired",
        "Google's refusal cannot distinguish revocation from lapse, so the weaker true claim is made",
      );
      assert.notEqual(row.rows[0]!.connection_state, "revoked");
      assert.equal(row.rows[0]!.health, "unknown", "the provider answered fine — no outage is claimed");
    }

    /* ── 7. TENANT ISOLATION ACROSS THE WHOLE FLOW ───────────────────────────── */
    {
      const createdB = await createConnection(
        b,
        { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
        { getDb, now: () => NOW },
      );
      assert.ok(createdB.status === "created");
      const idB = createdB.connection.integrationId;

      /* A cannot store on B's connection, verify B, or mark B connected. */
      const foreignStore = await storeCredential(
        a,
        { integrationId: idB, kind: "oauth_access", plaintext: "stolen" },
        deps,
      );
      assert.deepEqual(foreignStore, { status: "refused", reason: "not-found" }, "A cannot store on B's connection");

      const foreignVerify = await verifyGoogleConnection(a, idB, { ...deps, fetchImpl: IDENTITY_OK });
      assert.ok(!foreignVerify.ok, "A cannot verify B's connection");

      const foreignRecord = await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          idB,
          { externalAccountId: SUBJECT, externalAccountLabel: EMAIL, grantedScopes: GRANTED },
          NOW,
        ),
      );
      assert.deepEqual(foreignRecord, { status: "refused", reason: "not-found" }, "A cannot connect B");

      const rowB = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [idB],
      );
      assert.equal(rowB.rows[0]!.connection_state, "draft", "and B's row is untouched by all of it");
    }

    /* ── 8. THE AVAILABILITY SEAM STAYS HONEST ───────────────────────────────── */
    {
      const view = await getCapabilityAvailability(a, { getDb });
      assert.equal(
        view.readiness,
        "catalog-ready",
        "a connectable provider exists now, so the deployment is no longer `no-connectable-provider`",
      );
/*
       * ── AMENDED BY INT-4 ────────────────────────────────────────────────
       *
       * This pinned the capability list EMPTY because INT-3 requested no scope that reads
       * anything. INT-4 adds the Drive metadata read, so exactly one capability is mapped — and
       * the assertion becomes the stronger one: it is that capability, and for a connection with
       * identity-only scopes it is NOT available. A connection is not a data capability.
       */
      assert.deepEqual(
        view.capabilities.map((c) => c.capability),
        ["google.drive.metadata.read"],
        "INT-4 offers exactly one capability",
      );
      assert.notEqual(
        view.capabilities[0]!.state,
        "available",
        "and this connection's identity-only grant does not make it available",
      );
    }

    /* ── 9. NO TOKEN ESCAPED ANYWHERE ────────────────────────────────────────── */
    {
      const rows = await client.query(`select * from integrations`);
      const credentials = await client.query(`select * from integration_credentials`);
      const audit = await client.query(`select * from audit_log`);
      for (const [label, result] of [
        ["integrations", rows],
        ["integration_credentials", credentials],
        ["audit_log", audit],
      ] as const) {
        const serialized = JSON.stringify(result.rows);
        assert.ok(!serialized.includes(ACCESS_TOKEN), `${label} must not contain the access token`);
      }
      /* The ciphertext is present and is not the token. */
      const ciphertext = await client.query<{ ciphertext: string }>(
        `select ciphertext from integration_credentials limit 1`,
      );
      assert.ok(ciphertext.rows[0]!.ciphertext.length > 0);
      assert.notEqual(ciphertext.rows[0]!.ciphertext, ACCESS_TOKEN);
    }

    console.log("int3-google-connection/connection-postgres: all assertions passed");
  } finally {
    await client.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
