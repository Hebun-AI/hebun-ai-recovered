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
 * URL come from the same file; no value is ever printed.
 */
import { createHash } from "node:crypto";
import { loadQuietEnv } from "./lib/quiet-env";

/*
 * Production possession lives in `.env.hosted.local`: the proven production DATABASE_URL, the
 * production encryption keys the Director copied from Vercel, and the API key. The pulled
 * `.env.production.local` masks every sensitive value as `[SENSITIVE]` and is not consulted.
 */
loadQuietEnv([".env.hosted.local"], [
  "DATABASE_URL",
  "HEBUN_INTEGRATION_ENCRYPTION_KEYS",
  "HEBUN_INTEGRATION_ENCRYPTION_KEYS_ADDITIONAL",
  "HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID",
  "HEBUN_YOUTUBE_API_KEY",
]);
process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";

const DRY_RUN = process.argv.includes("--dry-run");
/*
 * The operator may hold ONLY a key added through the ADDITIONAL variable (the deployment's primary
 * key cannot be read back from the host). Then no existing row names a locally held key and equality
 * with production cannot be proved before the store. Continuing is a Director decision, stated on the
 * command line; the proof then moves to production acceptance, where the deployed runtime decrypts.
 */
const ACCEPT_UNPROVEN_KEYS = process.argv.includes("--accept-unproven-keys");
const DIRECTOR_EMAIL = process.env.CGO5_DIRECTOR_EMAIL ?? "senoltr@gmail.com";
/*
 * TRH-20 — WHICH ORGANIZATION IS BEING CONNECTED, STATED OUT LOUD.
 *
 * The Director holds an active membership in more than one organization, so "the Director's tenant"
 * stopped being a single thing. Defaulting to whichever membership the query happened to return
 * first would let a ceremony connect a provider to an organization nobody named — the same class of
 * error as a wrong-workspace acceptance, and one a tenant-isolated system must not be able to make
 * by accident.
 *
 * So the organization is selected BY SLUG on the command line, the membership must belong to that
 * organization, and the resolved name is printed before anything is written. Without the flag the
 * ceremony behaves exactly as it did for CGO-5: the Director's single membership, or a refusal if
 * more than one exists.
 */
const TENANT_SLUG = (() => {
  const flag = process.argv.find((a) => a.startsWith("--tenant="));
  return flag ? flag.slice("--tenant=".length).trim() : "";
})();

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
    const who = await client.query<{ user_id: string; tenant_id: string; membership_id: string; role_id: string; ai: string; provider: string; company: string; slug: string }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider,
              c.name as company, c.slug
         from users u join memberships m on m.user_id = u.id and m.status = 'active'
         join companies c on c.id = m.tenant_id
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1 and ($2 = '' or c.slug = $2)
        order by ai.is_primary desc`,
      [DIRECTOR_EMAIL, TENANT_SLUG],
    );
    const distinct = [...new Set(who.rows.map((r) => r.slug))];
    if (distinct.length === 0) {
      throw new Error(
        TENANT_SLUG
          ? `no active membership for ${DIRECTOR_EMAIL} in organization "${TENANT_SLUG}"`
          : `no active membership for ${DIRECTOR_EMAIL}`,
      );
    }
    if (distinct.length > 1) {
      throw new Error(
        `${DIRECTOR_EMAIL} is a member of ${distinct.length} organizations [${distinct.join(", ")}] — name one with --tenant=<slug>`,
      );
    }
    const w = who.rows[0]!;
    const tenant = asHumanTenantContext({
      tenantId: w.tenant_id, userId: w.user_id, authIdentityId: w.ai, membershipId: w.membership_id, membershipVersion: 1,
      roleId: w.role_id, sessionContextId: "00000000-0000-4000-8000-000000000005", provider: w.provider as never,
      assuranceLevel: "aal1", mfaVerified: false, requestId: "cgo5-youtube-admission", authenticatedAt: new Date().toISOString(),
    });
    console.log(`organization: "${w.company}" (${w.slug}) · tenant ${w.tenant_id} · user ${w.user_id}`);

    const listing = await listConnections(tenant);
    if (listing.status !== "read") throw new Error(`connections unreadable: ${listing.reason}`);
    const live = listing.connections.filter((c) => c.providerKey === YOUTUBE_PROVIDER_KEY && c.connectionState !== "revoked" && c.connectionState !== "disconnected");
    console.log(`youtube connections (live): ${live.length}${live[0] ? ` · ${live[0].integrationId} ${live[0].connectionState}/${live[0].health}` : ""}`);
    console.log(`other connections: ${listing.connections.filter((c) => c.providerKey !== YOUTUBE_PROVIDER_KEY).map((c) => `${c.providerKey}:${c.connectionState}`).join(", ")}`);

    /*
     * THE KEYS MUST BE PRODUCTION'S. A credential sealed with any other key would pass a local
     * acceptance and fail in the deployed runtime. Proved by opening one EXISTING live credential
     * whose key id is registered locally — the result is a boolean, the plaintext is never held
     * outside the callback. If no such row exists the proof is UNAVAILABLE, and that is said.
     */
    const { withDecryptedSecret } = await import("../src/features/integration-credentials/credential-repository.server");
    const { resolveIntegrationEncryptionKeys } = await import("../src/features/secret-encryption/key-registry.server");
    const registry = resolveIntegrationEncryptionKeys(process.env);
    if (registry.status !== "configured") throw new Error(`local encryption key registry unusable: missing ${registry.missingKeys.join(",") || "-"} invalid ${registry.invalidKeys.join(",") || "-"}`);
    const localKeyIds = [...registry.keys.keys()];
    console.log(`local registry: keys [${localKeyIds.join(", ")}] · active ${registry.activeKeyId} (material never shown)`);
    /*
     * TRH-20 — THE PROOF IS ABOUT THE KEY REGISTRY, NOT ABOUT ONE ORGANIZATION.
     *
     * A NEW organization holds no credential yet, so its own rows can never prove that the loaded
     * material is production's — and the first organization to be connected would always have to be
     * admitted under `--accept-unproven-keys`, permanently, by construction. That is a safety check
     * defeated by arithmetic rather than by evidence.
     *
     * The question the check actually asks is whether THESE KEYS open something production sealed.
     * Any credential production sealed answers it. So when the selected organization has none, the
     * probe continues through the OTHER organizations this same Director is an active member of —
     * each one read inside ITS OWN tenant context, resolved from its own membership row. No context
     * reads another organization's rows, and the organization that supplied the proof is named.
     *
     * `--accept-unproven-keys` remains, for the case where the Director holds exactly one
     * organization and it has no credential at all. It is now the last resort it was meant to be
     * rather than the only path.
     */
    const probeMemberships = await client.query<{ user_id: string; tenant_id: string; membership_id: string; role_id: string; ai: string; provider: string; company: string }>(
      `select u.id as user_id, m.tenant_id, m.id as membership_id, m.role_id, ai.id as ai, ai.provider,
              c.name as company
         from users u join memberships m on m.user_id = u.id and m.status = 'active'
         join companies c on c.id = m.tenant_id
         join auth_identities ai on ai.user_id = u.id and ai.revoked_at is null
        where u.email = $1
        order by (m.tenant_id = $2) desc, ai.is_primary desc`,
      [DIRECTOR_EMAIL, w.tenant_id],
    );
    let probeLive: { credentialId: string; keyId: string; context: typeof tenant; company: string } | undefined;
    for (const row of probeMemberships.rows) {
      const probeCtx =
        row.tenant_id === w.tenant_id
          ? tenant
          : asHumanTenantContext({
              tenantId: row.tenant_id, userId: row.user_id, authIdentityId: row.ai,
              membershipId: row.membership_id, membershipVersion: 1, roleId: row.role_id,
              sessionContextId: "00000000-0000-4000-8000-000000000005", provider: row.provider as never,
              assuranceLevel: "aal1", mfaVerified: false, requestId: "youtube-admission-key-probe",
              authenticatedAt: new Date().toISOString(),
            });
      const conns = await listConnections(probeCtx);
      if (conns.status !== "read") continue;
      for (const c of conns.connections) {
        const meta = await listCredentialMetadata(probeCtx, c.integrationId);
        const found = meta.status === "read" ? meta.credentials.find((cr) => cr.live && localKeyIds.includes(cr.keyId)) : undefined;
        if (found) {
          probeLive = { credentialId: found.credentialId, keyId: found.keyId, context: probeCtx, company: row.company };
          break;
        }
      }
      if (probeLive) break;
    }
    if (probeLive) {
      const opened = await withDecryptedSecret(probeLive.context, probeLive.credentialId, async (secret) => secret.length > 0);
      console.log(`encryption keys open an existing production credential (key ${probeLive.keyId}, held by "${probeLive.company}"): ${opened.status === "used" ? "YES" : `NO (${opened.reason})`}`);
      if (opened.status !== "used") throw new Error("the loaded encryption keys are not production's — refusing to store anything");
    } else {
      console.log(`key equality with production: UNPROVABLE here — no live credential names a locally held key id [${localKeyIds.join(", ")}]`);
      if (!ACCEPT_UNPROVEN_KEYS) throw new Error("refusing to store under an unproven key; re-run with --accept-unproven-keys after the Director confirms the production registry holds the same key id and material");
      console.log("continuing on Director instruction (--accept-unproven-keys); production acceptance is the proof");
    }

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
