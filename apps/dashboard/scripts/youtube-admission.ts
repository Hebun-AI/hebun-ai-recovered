/*
 * scripts/youtube-admission.ts — THE YOUTUBE API-KEY ADMISSION CEREMONY (CGO-5).
 *
 * Operator terminal only. Never imported by the app.
 *
 * Admits ONE API key for the Director's tenant through the released Integration Authority and the
 * released encrypted credential store, then makes ONE real verification call and records its
 * outcome through the lifecycle writer — exactly the Google callback's sequence, without OAuth.
 *
 * Idempotent by construction: an existing live YouTube connection is reused, an existing live
 * `api_key` credential is NOT replaced, and `--dry-run` performs every read and stops before any
 * write or provider call.
 *
 * The key is read from `.env.hosted.local` into process.env by `quiet-env` (no shell, no echo),
 * handed to `storeCredential`, and never printed. Encryption keys and the production database
 * URL come from `.env.production.local`.
 */
import { createHash } from "node:crypto";
import { loadQuietEnv } from "./lib/quiet-env";

loadQuietEnv([".env.production.local"], [
  "DATABASE_URL",
  "HEBUN_INTEGRATION_ENCRYPTION_KEYS",
  "HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID",
]);
const productionDatabaseDigest = createHash("sha256").update(process.env.DATABASE_URL ?? "").digest("hex").slice(0, 12);
loadQuietEnv([".env.hosted.local"], ["HEBUN_YOUTUBE_API_KEY"]);
{
  const hosted: Record<string, string | undefined> = {};
  const saved = process.env.DATABASE_URL;
  loadQuietEnv([".env.hosted.local"], ["DATABASE_URL"]);
  hosted.DATABASE_URL = process.env.DATABASE_URL;
  process.env.DATABASE_URL = saved;
  const hostedDigest = createHash("sha256").update(hosted.DATABASE_URL ?? "").digest("hex").slice(0, 12);
  console.log(`database: production.local ${productionDatabaseDigest} · hosted.local ${hostedDigest} · same=${productionDatabaseDigest === hostedDigest}`);
}
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DRY_RUN = process.argv.includes("--dry-run");
const DIRECTOR_EMAIL = process.env.CGO5_DIRECTOR_EMAIL ?? "senoltr@gmail.com";

async function main(): Promise<void> {
  /* The schema barrel has an import-order cycle; enter it through the client first. */
  await import("../src/db/client.server");
  const { Client } = await import("pg");
  const { asHumanTenantContext } = await import("../src/features/auth/tenant/tenant-context");
  const { createConnection, recordVerifiedConnectionWithin, recordVerificationFailureWithin } = await import(
    "../src/features/integration-authority/integration-repository.server"
  );
  const { listConnections } = await import("../src/features/integration-authority/integration-read.server");
  const { listCredentialMetadata, storeCredential } = await import(
    "../src/features/integration-credentials/credential-repository.server"
  );
  const { getCapabilityAvailability } = await import("../src/features/integration-authority/capability-availability.server");
  const { getControlPlaneDb } = await import("../src/db/client.server");
  const { YOUTUBE_PROVIDER_KEY, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY } = await import("../src/features/provider-youtube/contracts");
  const { verifyYouTubeConnection, lifecycleClassFor } = await import("../src/features/provider-youtube/verify-youtube-connection.server");

  const apiKey = process.env.HEBUN_YOUTUBE_API_KEY?.trim() ?? "";
  if (apiKey.length < 20) throw new Error("HEBUN_YOUTUBE_API_KEY is absent or too short (value not shown)");
  if (!process.env.HEBUN_INTEGRATION_ENCRYPTION_KEYS) throw new Error("production encryption keys not loaded");
  console.log(`key: present, ${apiKey.length} chars, sha256 ${createHash("sha256").update(apiKey).digest("hex").slice(0, 8)}… (value never shown)`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const who = await client.query<{ user_id: string; tenant_id: string; membership_id: string; role_id: string; ai: string; provider: string }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider
         from users u join memberships m on m.user_id = u.id and m.status = 'active'
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 order by ai.is_primary desc limit 1`,
      [DIRECTOR_EMAIL],
    );
    const w = who.rows[0];
    if (!w) throw new Error(`no active membership for ${DIRECTOR_EMAIL}`);
    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id, userId: w.user_id, authIdentityId: w.ai, membershipId: w.membership_id, membershipVersion: 1,
      roleId: w.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005", provider: w.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "cgo5-youtube-admission", authenticatedAt: new Date().toISOString(),
    });
    console.log(`tenant: ${w.tenant_id} · user ${w.user_id}`);

    const listing = await listConnections(tenant);
    if (listing.status !== "read") throw new Error(`connections unreadable: ${listing.reason}`);
    const live = listing.connections.filter((c) => c.providerKey === YOUTUBE_PROVIDER_KEY && c.connectionState !== "revoked" && c.connectionState !== "disconnected");
    console.log(`youtube connections (live): ${live.length}${live[0] ? ` · ${live[0].integrationId} ${live[0].connectionState}/${live[0].health}` : ""}`);
    console.log(`other connections: ${listing.connections.filter((c) => c.providerKey !== YOUTUBE_PROVIDER_KEY).map((c) => `${c.providerKey}:${c.connectionState}`).join(", ")}`);

    let integrationId = live[0]?.integrationId;
    if (integrationId) {
      const creds = await listCredentialMetadata(tenant, integrationId);
      const liveKey = creds.status === "read" ? creds.credentials.filter((c) => c.kind === "api_key" && c.live) : [];
      console.log(`live api_key credentials on it: ${liveKey.length}`);
    }

    if (DRY_RUN) {
      console.log(`DRY RUN — would ${integrationId ? "reuse" : "create"} the connection, ${integrationId ? "keep or store" : "store"} one api_key, verify once. Nothing written.`);
      return;
    }

    const now = new Date();
    if (!integrationId) {
      const created = await createConnection(tenant, { providerKey: YOUTUBE_PROVIDER_KEY, name: "YouTube" });
      if (created.status !== "created") throw new Error(`createConnection refused: ${created.reason}`);
      integrationId = created.connection.integrationId;
      console.log(`created connection ${integrationId} (${created.connection.connectionState})`);
    }

    const creds = await listCredentialMetadata(tenant, integrationId);
    const hasLiveKey = creds.status === "read" && creds.credentials.some((c) => c.kind === "api_key" && c.live);
    if (hasLiveKey) {
      console.log("a live api_key credential already exists — NOT storing a second one");
    } else {
      const stored = await storeCredential(tenant, { integrationId, kind: "api_key", plaintext: apiKey });
      if (stored.status !== "stored") throw new Error(`storeCredential refused: ${stored.reason}`);
      console.log(`stored api_key credential ${stored.credential.credentialId} (key ${stored.credential.keyId}) · connection ${stored.connectionState}`);
    }

    const verification = await verifyYouTubeConnection(tenant, integrationId);
    const db = getControlPlaneDb();
    if (!verification.ok) {
      const recorded = await db.transaction((tx) => recordVerificationFailureWithin(tx, tenant, integrationId!, { kind: lifecycleClassFor(verification.failure), reason: verification.reason }, now));
      console.log(`verification FAILED: ${verification.failure} (${verification.reason}) → recorded ${recorded.status}${recorded.status === "transitioned" ? ` ${recorded.connection.connectionState}/${recorded.connection.health}` : ""}`);
      process.exitCode = 2;
      return;
    }
    const recorded = await db.transaction((tx) => recordVerifiedConnectionWithin(tx, tenant, integrationId!, verification.facts, now));
    if (recorded.status !== "verified") throw new Error(`recordVerified refused: ${recorded.reason}`);
    console.log(`verified: probe channel ${verification.probedChannelId} · connection ${recorded.connection.connectionState}/${recorded.connection.health} · account ${recorded.connection.externalAccountId} · label "${recorded.connection.externalAccountLabel}"`);

    const availability = await getCapabilityAvailability(tenant);
    const entry = availability.capabilities.find((c) => c.capability === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
    console.log(`capability ${YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY}: ${entry?.state} · writeCapable ${entry?.sources[0]?.writeCapable}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error).replace(/AIza[0-9A-Za-z_-]{20,}/g, "<redacted>"));
  process.exitCode = 1;
});
