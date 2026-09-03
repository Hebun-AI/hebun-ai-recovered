/*
 * CGO-5 — THE ACCOUNTLESS CONNECTION, END TO END, AGAINST A REAL SCHEMA.
 *
 * Runs the RELEASED Integration Authority, the RELEASED encrypted credential store, the REAL
 * catalog (which now carries `youtube`), the real verifier and the real observation seam. Only
 * the network is replaced. Uses a disposable local database, dropped on exit.
 *
 * Proves Option A both ways:
 *   - a YouTube connection verifies with NO account and becomes connected + healthy
 *   - an account-bearing provider still refuses a null, and still refuses a changed account
 *   - a YouTube connection refuses to be verified WITH an account
 *   - one live YouTube connection per tenant, even though the index cannot see it
 * and the observation chain:
 *   - unverified ⇒ the key is never decrypted and nothing is observed
 *   - connected ⇒ one observation, live, and NOTHING about the channel is written anywhere
 *   - a rejected key ⇒ `expired`; a disabled API ⇒ `degraded`, lifecycle untouched
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import {
  createConnection,
  recordVerificationFailureWithin,
  recordVerifiedConnectionWithin,
} from "../../src/features/integration-authority/integration-repository.server";
import { getCapabilityAvailability } from "../../src/features/integration-authority/capability-availability.server";
import { storeCredential } from "../../src/features/integration-credentials/credential-repository.server";
import { PROVIDER_CATALOG } from "../../src/features/provider-catalog/catalog";
import type { ConnectionDefinition } from "../../src/features/integration-authority/contracts";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_CONNECTION_LABEL,
  YOUTUBE_PROVIDER_KEY,
} from "../../src/features/provider-youtube/contracts";
import { lifecycleClassFor, verifyYouTubeConnection } from "../../src/features/provider-youtube/verify-youtube-connection.server";
import { readPublicChannelObservation } from "../../src/features/provider-youtube/read-channel-observation.server";
import type { FetchLike } from "../../src/features/provider-youtube/youtube-transport.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-03T18:00:00.000Z");
const API_KEY = "cgo5-fixture-key-never-persisted-in-clear";
const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};

/* An account-bearing definition beside the real catalog, so the negative cases have a subject. */
const ACCOUNT_BEARING: ConnectionDefinition = Object.freeze({
  providerKey: "test-account-provider",
  label: "Test (account)",
  authMethod: "oauth2",
  accountIdentity: "account",
  connectivity: "connectable",
  minimumScopes: Object.freeze([]),
  capabilityScopes: Object.freeze({ "test.read": Object.freeze({ read: Object.freeze(["x"]), write: Object.freeze([]) }) }),
});
const CATALOG = Object.freeze([...PROVIDER_CATALOG, ACCOUNT_BEARING]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function channel(id: string, title: string) {
  return json(200, {
    items: [{ id, snippet: { title, customUrl: `@${title.toLowerCase()}`, publishedAt: "2015-01-01T00:00:00Z" }, statistics: { viewCount: "42", subscriberCount: "7", hiddenSubscriberCount: false, videoCount: "2" }, contentDetails: { relatedPlaylists: { uploads: `UU${id.slice(2)}` } } }],
  });
}
const okFetch = (log: string[]): FetchLike => async (url) => {
  const u = new URL(url);
  log.push(u.pathname);
  assert.equal(u.searchParams.get("key"), API_KEY, "the decrypted key is the one stored");
  if (u.pathname.endsWith("/channels")) return channel(u.searchParams.get("forHandle") === "@YouTube" ? "UCyt" : "UC777", u.searchParams.get("forHandle") === "@YouTube" ? "YouTube" : "Candamlalari");
  if (u.pathname.endsWith("/playlistItems")) return json(200, { pageInfo: { totalResults: 2 }, items: [{ contentDetails: { videoId: "a1" } }, { contentDetails: { videoId: "a2" } }] });
  if (u.pathname.endsWith("/videos")) return json(200, { items: [{ id: "a1", snippet: { title: "One" }, statistics: { viewCount: "10" } }, { id: "a2", snippet: { title: "Two" }, statistics: { viewCount: "20", likeCount: "1", commentCount: "0" } }] });
  throw new Error(`unexpected ${u.pathname}`);
};

interface Seeded { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string }
function contextFor(s: Seeded): TenantContext {
  return asHumanTenantContext({ tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId, membershipVersion: 1, roleId: s.roleId, sessionContextId: "00000000-0000-4000-8000-000000000005", provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "cgo5", authenticatedAt: NOW.toISOString() });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cgo5_youtube");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const deps = { getDb, now: () => NOW, catalog: CATALOG } as const;

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-cgo5", email: "director@acme.test" })) as Seeded;
    const tenant = contextFor(acme);

    /* ── 1. CREATE: a YouTube connection is a draft, and there can be only one live ── */
    const created = await createConnection(tenant, { providerKey: YOUTUBE_PROVIDER_KEY, name: "YouTube" }, deps);
    assert.equal(created.status, "created");
    if (created.status !== "created") return;
    const integrationId = created.connection.integrationId;
    assert.equal(created.connection.connectionState, "draft");
    assert.equal(created.connection.externalAccountId, null);
    const second = await createConnection(tenant, { providerKey: YOUTUBE_PROVIDER_KEY, name: "YouTube again" }, deps);
    assert.deepEqual(second, { status: "refused", reason: "duplicate-live-connection" }, "one live accountless connection per provider, enforced without the index");

    /* ── 2. UNVERIFIED: the key is stored sealed and the capability is NOT available ── */
    {
      const stored = await storeCredential(tenant, { integrationId, kind: "api_key", plaintext: API_KEY }, { getDb, env: ENV });
      assert.equal(stored.status, "stored");
      if (stored.status === "stored") assert.equal(stored.connectionState, "unverified", "a supplied secret is an unproven secret");
      const { rows } = await setup.query<{ n: number }>(`select count(*)::int as n from integration_credentials where integration_id = $1 and kind = 'api_key' and revoked_at is null`, [integrationId]);
      assert.equal(rows[0]!.n, 1);
      const clear = await setup.query<{ n: number }>(`select count(*)::int as n from integration_credentials where ciphertext like $1`, [`%${API_KEY}%`]);
      assert.equal(clear.rows[0]!.n, 0, "the key is never at rest in the clear");

      const availability = await getCapabilityAvailability(tenant, { getDb });
      const entry = availability.capabilities.find((c) => c.capability === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
      assert.ok(entry);
      assert.equal(entry.state, "unverified");

      const calls: string[] = [];
      const observed = await readPublicChannelObservation(tenant, "@Candamlalari", { getDb, env: ENV, fetchImpl: okFetch(calls) });
      assert.deepEqual(observed, { ok: false, refusal: "capability-not-available" }, "unverified ⇒ refused before any decryption");
      assert.deepEqual(calls, [], "and YouTube was never contacted");
    }

    /* ── 3. VERIFY: one real-shaped call, then connected + healthy with NO account ── */
    {
      const calls: string[] = [];
      const verification = await verifyYouTubeConnection(tenant, integrationId, { getDb, env: ENV, fetchImpl: okFetch(calls) });
      assert.ok(verification.ok, "verification succeeded");
      if (!verification.ok) return;
      assert.deepEqual(calls, ["/youtube/v3/channels"], "exactly one call");
      assert.equal(verification.facts.externalAccountId, null, "no account — the fact, not a placeholder");
      assert.equal(verification.facts.externalAccountLabel, YOUTUBE_CONNECTION_LABEL);
      assert.deepEqual(verification.facts.grantedScopes, []);
      assert.equal(verification.probedChannelId, "UCyt", "the probe hit YouTube's own channel, not a tenant's");

      const recorded = await handle.db.transaction((tx) => recordVerifiedConnectionWithin(tx, tenant, integrationId, verification.facts, NOW, { catalog: CATALOG }));
      assert.equal(recorded.status, "verified", `recorded: ${JSON.stringify(recorded)}`);
      if (recorded.status !== "verified") return;
      assert.equal(recorded.connection.connectionState, "connected");
      assert.equal(recorded.connection.health, "healthy");
      assert.equal(recorded.connection.externalAccountId, null, "connected, and still no account");
      assert.equal(recorded.connection.externalAccountLabel, YOUTUBE_CONNECTION_LABEL);
      const row = await setup.query<{ external_account_id: string | null }>(`select external_account_id from integrations where id = $1`, [integrationId]);
      assert.equal(row.rows[0]!.external_account_id, null);

      /* A YouTube connection refuses to be verified WITH an account — the other direction. */
      const dressed = await handle.db.transaction((tx) =>
        recordVerifiedConnectionWithin(tx, tenant, integrationId, { externalAccountId: "UC777", externalAccountLabel: "@Candamlalari", grantedScopes: [] }, NOW, { catalog: CATALOG }),
      );
      assert.deepEqual(dressed, { status: "refused", reason: "account-identity-mismatch" }, "an observed channel cannot be dressed up as the connected account");
    }

    /* ── 4. ACCOUNT-BEARING PROVIDERS ARE UNCHANGED ── */
    {
      const google = await createConnection(tenant, { providerKey: ACCOUNT_BEARING.providerKey, name: "Acct" }, deps);
      assert.equal(google.status, "created");
      if (google.status !== "created") return;
      const id = google.connection.integrationId;
      const supplied = await storeCredential(tenant, { integrationId: id, kind: "oauth_access", plaintext: "acct-secret" }, { getDb, env: ENV });
      assert.equal(supplied.status, "stored", "draft → unverified, as every account-bearing provider does");
      const nullFacts = await handle.db.transaction((tx) =>
        recordVerifiedConnectionWithin(tx, tenant, id, { externalAccountId: null, externalAccountLabel: "x", grantedScopes: ["x"] }, NOW, { catalog: CATALOG }),
      );
      assert.deepEqual(nullFacts, { status: "refused", reason: "account-identity-mismatch" }, "an account-bearing provider still cannot verify without an account");
      const first = await handle.db.transaction((tx) =>
        recordVerifiedConnectionWithin(tx, tenant, id, { externalAccountId: "acct-A", externalAccountLabel: "A", grantedScopes: ["x"] }, NOW, { catalog: CATALOG }),
      );
      assert.equal(first.status, "verified");
      const changed = await handle.db.transaction((tx) =>
        recordVerifiedConnectionWithin(tx, tenant, id, { externalAccountId: "acct-B", externalAccountLabel: "B", grantedScopes: ["x"] }, NOW, { catalog: CATALOG }),
      );
      assert.deepEqual(changed, { status: "refused", reason: "account-changed" }, "the account-change refusal is intact");
      const nulledLater = await handle.db.transaction((tx) =>
        recordVerifiedConnectionWithin(tx, tenant, id, { externalAccountId: null, externalAccountLabel: "A", grantedScopes: ["x"] }, NOW, { catalog: CATALOG }),
      );
      assert.equal(nulledLater.status, "refused", "and an account-bearing row can never lose its account");
    }

    /* ── 5. CONNECTED: one observation, live, three calls, and NOTHING written about the channel ── */
    {
      const before = await setup.query<{ v: number; u: Date }>(`select version as v, updated_at as u from integrations where id = $1`, [integrationId]);
      const calls: string[] = [];
      const observed = await readPublicChannelObservation(tenant, "Candamlalari", { getDb, env: ENV, fetchImpl: okFetch(calls), now: () => NOW });
      assert.ok(observed.ok, `observed: ${JSON.stringify(observed)}`);
      if (!observed.ok) return;
      assert.deepEqual(calls, ["/youtube/v3/channels", "/youtube/v3/playlistItems", "/youtube/v3/videos"]);
      assert.equal(observed.value.channel.channelId, "UC777");
      assert.equal(observed.value.recentVideos.length, 2);
      assert.equal(observed.value.recentVideos[0]!.likeCount, null, "withheld stays null");
      assert.equal(observed.value.recentVideos[1]!.commentCount, 0, "a reported zero stays zero");

      const after = await setup.query<{ v: number; u: Date }>(`select version as v, updated_at as u from integrations where id = $1`, [integrationId]);
      assert.deepEqual(after.rows[0], before.rows[0], "an observation touches no connection row");
      for (const needle of ["UC777", "Candamlalari", "candamlalari"]) {
        const hits = await setup.query<{ n: number }>(
          `select count(*)::int as n from (select external_account_id as t from integrations union all select external_account_label from integrations union all select name from integrations union all select failure_reason from integrations) x where t ilike $1`,
          [`%${needle}%`],
        );
        assert.equal(hits.rows[0]!.n, 0, `"${needle}" is written to no connection column`);
      }
      const tables = await setup.query<{ n: number }>(`select count(*)::int as n from information_schema.tables where table_schema = 'public' and (table_name ilike '%youtube%' or table_name ilike '%channel%' or table_name ilike '%video%')`);
      assert.equal(tables.rows[0]!.n, 0, "no table exists that could hold the observation");
    }

    /* ── 6. FAILURES REACH THE LIFECYCLE TRUTHFULLY ── */
    {
      const disabled = await verifyYouTubeConnection(tenant, integrationId, { getDb, env: ENV, fetchImpl: async () => json(403, { error: { errors: [{ reason: "accessNotConfigured" }] } }) });
      assert.equal(disabled.ok, false);
      if (!disabled.ok) {
        assert.equal(disabled.failure, "disabled");
        assert.equal(lifecycleClassFor(disabled.failure), "degraded");
        const recorded = await handle.db.transaction((tx) => recordVerificationFailureWithin(tx, tenant, integrationId, { kind: lifecycleClassFor(disabled.failure), reason: disabled.reason }, NOW));
        assert.equal(recorded.status, "transitioned");
        if (recorded.status === "transitioned") {
          assert.equal(recorded.connection.connectionState, "connected", "a disabled API does not end the grant");
          assert.equal(recorded.connection.health, "degraded");
        }
      }
      const availability = await getCapabilityAvailability(tenant, { getDb });
      assert.equal(availability.capabilities.find((c) => c.capability === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY)!.state, "degraded", "and the capability is degraded, not available");

      const rejected = await verifyYouTubeConnection(tenant, integrationId, { getDb, env: ENV, fetchImpl: async () => json(400, { error: { errors: [{ reason: "keyInvalid" }] } }) });
      assert.equal(rejected.ok, false);
      if (!rejected.ok) {
        assert.equal(rejected.failure, "auth");
        assert.equal(lifecycleClassFor(rejected.failure), "auth");
        const recorded = await handle.db.transaction((tx) => recordVerificationFailureWithin(tx, tenant, integrationId, { kind: "auth", reason: rejected.reason }, NOW));
        assert.equal(recorded.status, "transitioned");
        if (recorded.status === "transitioned") assert.equal(recorded.connection.connectionState, "expired", "a rejected key ends the grant");
        assert.ok(!rejected.reason.includes(API_KEY));
      }
    }

    /* ── 7. NON-EFFECTS ── */
    for (const table of ["decision_records", "heby_action_requests", "action_execution_attempts", "agent_mandates", "knowledge_nodes", "work_artifacts"]) {
      const { rows } = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`).catch(() => ({ rows: [{ n: 0 }] }));
      assert.equal(rows[0]!.n, 0, `observing wrote no ${table} row`);
    }
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS cgo5 accountless authority (postgres)");
}

void main();
