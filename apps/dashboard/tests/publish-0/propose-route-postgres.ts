/*
 * PUBLISH-0 — `/publish` through the AUTHORITATIVE propose inlet (`runHebyProposeCommand`, the
 * function `proposeHebyActionCommandAction` calls with `resolveTenantContext`), on a disposable
 * PostgreSQL. Storage is an in-memory FAKE holding real bytes; every network call throws.
 *
 *   correct tenant files ONE pending request binding original + derivative · wrong tenant refused ·
 *   unauthenticated refused · no permit · no execution attempt · no Meta call · derivation grants
 *   nothing · client args cannot carry authority
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { publishDerivativeId } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { runHebyProposeCommand } from "../../src/features/heby-action-inlet/propose-commands.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const APP_ID = "28295264780115792";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.padEnd(64, "a").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "publish0-request",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_publish0_route");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  /* FAKE: the storage port, in memory, holding real bytes. */
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const baseDeps = { getDb: () => handle.db, resolveStorage };

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme-pr", email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex-pr", email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "a1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b1"));
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status, "established");
    }

    /* FIXTURE: a connected Instagram connection (the connection authority's writer is not under test). */
    const connect = async (tenantId: string, userId: string, scopes: string[]) =>
      (await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, created_by, created_by_type)
         values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,$3,$4,'human') returning id`,
        [tenantId, JSON.stringify(scopes), APP_ID, userId],
      )).rows[0]!.id;
    const acmeIntegration = await connect(acme.tenantId, acme.userId, ["instagram_business_basic", "instagram_business_content_publish"]);
    /* Globex is ALSO publish-capable here, so a refusal below is tenant isolation, not scope. */
    await connect(globex.tenantId, globex.userId, ["instagram_business_basic", "instagram_business_content_publish"]);

    const agent = (await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
       values ($1,'Heby','active',$2,'human') returning id`,
      [acme.tenantId, acme.userId],
    )).rows[0]!.id;

    /* FIXTURE: an Instagram content draft and an admitted, REAL image of it, stored. */
    const imageBytes = async (mime: string) => {
      const img = sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 120, b: 200, alpha: 0.5 } } });
      return new Uint8Array(await (mime === "image/png" ? img.png() : img.flatten({ background: "#000" }).jpeg()).toBuffer());
    };
    const seedContent = async (mime = "image/png", tenant: Seeded = acme, agentId = agent) => {
      const caption = `Kilim ${randomUUID()}`;
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
            current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Post','draft','operations',1,'instagram',$2,'human') returning id`,
        [tenant.tenantId, tenant.userId],
      )).rows[0]!.id;
      await setup.query(
        `insert into work_artifact_revisions
           (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,1,$3,$4,'human',$5)`,
        [tenant.tenantId, artifact, caption, sha(caption), tenant.userId],
      );
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now())
         returning id`,
        [tenant.tenantId, randomUUID(), tenant.userId, agentId, artifact, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const bytes = await imageBytes(mime);
      const digest = createHash("sha256").update(bytes).digest("hex");
      const key = `tenants/${tenant.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: mime, sha256Hex: digest });
      await setup.query(
        `insert into media_assets
           (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
            storage_backend, storage_key, admitted_at, asset_lifecycle_status)
         values ($1,$2,$3,$4,$5,$6,64,48,'test-memory',$7, now(),'admitted')`,
        [assetId, tenant.tenantId, inv, mime, bytes.length, digest, key],
      );
      const derivedId = publishDerivativeId(tenant.tenantId, assetId);
      return {
        draftRef: formatWorkArtifactRef(artifact, 1), assetId, digest, caption, key,
        derivedId, derivedKey: `tenants/${tenant.tenantId}/media/${derivedId}`,
      };
    };


    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls++;
      throw new Error("REAL NETWORK REACHED");
    }) as typeof fetch;
    const counts = async () => ({
      requests: (await setup.query<{ n: number }>("select count(*)::int n from heby_action_requests")).rows[0]!.n,
      permits: (await setup.query<{ n: number }>("select count(*)::int n from action_permits")).rows[0]!.n,
      attempts: (await setup.query<{ n: number }>("select count(*)::int n from action_execution_attempts")).rows[0]!.n,
      decisions: (await setup.query<{ n: number }>("select count(*)::int n from decision_records where subject_type <> 'governance-authority'")).rows[0]!.n,
    });
    const run = (resolveTenant: () => Promise<TenantContext | null>, args: string[]) =>
      runHebyProposeCommand({ commandId: "publish", args }, { ...baseDeps, resolveTenant });

    /* ══ 1. UNAUTHENTICATED ══ */
    const c = await seedContent();
    const before = await counts();
    assert.deepEqual(await run(async () => null, [c.draftRef, c.assetId]), { status: "unauthorized" });
    assert.deepEqual(await counts(), before, "unauthenticated: nothing written");
    assert.equal(store.puts.includes(c.derivedKey), false, "unauthenticated: no derivative");

    /* ══ 2. WRONG TENANT — Globex names Acme's draft and image ══ */
    const wrong = await run(async () => globexCtx, [c.draftRef, c.assetId]);
    assert.equal(wrong.status, "ok");
    assert.equal(wrong.status === "ok" && wrong.kind, "publish-instagram");
    assert.equal(
      wrong.status === "ok" && wrong.result.status === "refused" && wrong.result.reason,
      "draft-not-found",
      JSON.stringify(wrong),
    );
    assert.deepEqual(await counts(), before, "wrong tenant: nothing written");
    assert.equal(store.puts.includes(c.derivedKey), false, "wrong tenant: Acme's image was never converted");
    assert.equal(
      (await setup.query("select count(*)::int n from media_assets where tenant_id=$1", [globex.tenantId])).rows[0]!.n,
      0,
      "wrong tenant: no derivative row in either tenant",
    );

    /* Globex's OWN draft with Acme's image: the image is unresolvable in Globex. */
    const g = await seedContent("image/png", globex, (await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
       values ($1,'Heby','active',$2,'human') returning id`, [globex.tenantId, globex.userId])).rows[0]!.id);
    const crossImage = await run(async () => globexCtx, [g.draftRef, c.assetId]);
    assert.equal(
      crossImage.status === "ok" && crossImage.result.status === "refused" && crossImage.result.reason,
      "media-not-found",
      JSON.stringify(crossImage),
    );
    assert.deepEqual(await counts(), before);

    /* ══ 3. MALFORMED / EXTRA ARGS — the registry and handler refuse before any write ══ */
    assert.deepEqual(await run(async () => acmeCtx, [c.draftRef]), { status: "refused", reason: "invalid-arguments" });
    assert.deepEqual(
      await run(async () => acmeCtx, [c.draftRef, c.assetId, globex.tenantId]),
      { status: "refused", reason: "invalid-arguments" },
      "a third argument (e.g. a tenant) is not accepted",
    );
    assert.deepEqual(await counts(), before);

    /* ══ 4. CORRECT TENANT — one pending request, both identities bound, nothing authorized ══ */
    const ok = await run(async () => acmeCtx, [c.draftRef, c.assetId]);
    assert.equal(ok.status === "ok" && ok.kind, "publish-instagram", JSON.stringify(ok));
    assert.equal(ok.status === "ok" && ok.result.status, "proposed", JSON.stringify(ok));
    const after = await counts();
    assert.equal(after.requests, before.requests + 1, "exactly one request");
    assert.equal(after.permits, 0, "no permit");
    assert.equal(after.attempts, 0, "no execution attempt");
    assert.equal(after.decisions, before.decisions, "no decision");
    assert.equal(fetchCalls, 0, "no Meta (or any network) call");
    const req = (await setup.query<{ tenant_id: string; status: string; action_kind: string; canonical_payload: Record<string, string> }>(
      "select tenant_id, status, action_kind, canonical_payload from heby_action_requests",
    )).rows[0]!;
    assert.equal(req.tenant_id, acme.tenantId, "filed under the SESSION tenant");
    assert.equal(req.action_kind, "publish-instagram-media");
    assert.equal(req.status, "pending");
    const d = (await setup.query("select * from media_assets where id=$1", [c.derivedId])).rows[0];
    assert.equal(req.canonical_payload.mediaAssetRef, c.assetId);
    assert.equal(req.canonical_payload.mediaAssetDigest, c.digest);
    assert.equal(req.canonical_payload.publishAssetRef, c.derivedId);
    assert.equal(req.canonical_payload.publishAssetDigest, d.byte_digest);
    assert.equal(req.canonical_payload.integrationId, acmeIntegration);

    /* ══ 5. DERIVATION GRANTS NOTHING — a duplicate proposal is refused, the derivative is reused ══ */
    const again = await run(async () => acmeCtx, [c.draftRef, c.assetId]);
    assert.equal(again.status === "ok" && again.result.status === "refused" && again.result.reason, "already-pending");
    assert.equal((await counts()).permits, 0);
    assert.equal(
      (await setup.query("select count(*)::int n from media_assets where derived_from_asset_id=$1", [c.assetId])).rows[0]!.n,
      1,
    );
    assert.equal(store.readGrants.length, 0, "proposal mints no read grant");

    /* ══ 6. FAIL CLOSED when storage truth is unavailable ══ */
    const c2 = await seedContent();
    const noStore = await runHebyProposeCommand(
      { commandId: "publish", args: [c2.draftRef, c2.assetId] },
      { ...baseDeps, resolveStorage: () => ({ status: "unavailable" as const, reason: "storage-not-connected" as const }), resolveTenant: async () => acmeCtx },
    );
    assert.equal(noStore.status === "ok" && noStore.result.status, "refused");
    assert.equal((await counts()).requests, after.requests);
    void agent;

    console.log("PASS publish-0 propose route (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
