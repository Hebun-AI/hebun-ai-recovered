/*
 * INSTAGRAM-APPROVAL-PREVIEW-1 — the approval preview describes THE GOVERNED REQUEST, proven against
 * its frozen digests, and keeps today's Content Package readiness beside it as context. On a
 * disposable PostgreSQL; preparation only through the released writers; storage is an in-memory fake
 * with real bytes; every network call throws and is counted.
 *
 *   A governed image + exact caption · B draft advances → still the governed revision · C selection
 *   changes → still image X, readiness BLOCKED · D image declined → X identifiable, readiness says so ·
 *   E wrong tenant → nothing · F image digest mismatch → no substitute image, no grant · G revision
 *   digest mismatch → no substitute caption · H republish acknowledgement shown with its ledger record
 *   · I no acknowledgement → no warning · J only Instagram requests are previewed · K no provider call
 *   · L read failure → unavailable, never empty · and every preview read writes nothing.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { instagramPackagePreparation } from "../helpers/instagram-package-fixture";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import {
  executeAuthorizedAction,
  type InstagramPublishExecutionPorts,
} from "../../src/features/action-execution/execute-authorized-action.server";
import { proposeInstagramPublish } from "../../src/features/heby-action-inlet/instagram-publish-proposal.server";
import {
  openInstagramApprovalImage,
  readInstagramApprovalPreview,
  readPendingInstagramApprovalPreviews,
  type InstagramApprovalPreview,
} from "../../src/features/instagram-publishing/approval-preview.server";
import { publishDerivativeId } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const APP_ID = "28295264780115792";
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

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
    requestId: "iap1-request",
    authenticatedAt: new Date().toISOString(),
  });
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("instagram-approval-preview-1/preview-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_iap1_preview");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const baseDeps = { getDb: () => handle.db, resolveStorage };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-iap1", email: "director@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-iap1", email: "director@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "a1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b1"));
    const agents = new Map<string, string>();
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status, "established");
      /* Both tenants are publish-capable, so a cross-tenant refusal below is isolation, not scope. */
      await setup.query(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, created_by, created_by_type)
         values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,$3,$4,'human')`,
        [s.tenantId, JSON.stringify(["instagram_business_basic", "instagram_business_content_publish"]), APP_ID, s.userId],
      );
      agents.set(
        s.tenantId,
        (await setup.query<{ id: string }>(
          `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type)
           values ($1,'Heby','active',$2,'human') returning id`,
          [s.tenantId, s.userId],
        )).rows[0]!.id,
      );
    }
    const acmeIntegration = (await setup.query<{ id: string }>(
      `select id from integrations where tenant_id=$1 and provider_key='instagram'`, [acme.tenantId],
    )).rows[0]!.id;
    const prep = instagramPackagePreparation(setup, () => handle.db);

    /* ── FIXTURES: a draft (1..n revisions), images and a video generated FROM it, stored. ── */
    const seedDraft = async (s: Seeded = acme, revisions = 1) => {
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
            current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Post','draft','operations',$2,'instagram',$3,'human') returning id`,
        [s.tenantId, revisions, s.userId],
      )).rows[0]!.id;
      for (let r = 1; r <= revisions; r++) {
        const caption = `Kilim r${r} ${randomUUID()}`;
        await setup.query(
          `insert into work_artifact_revisions
             (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
           values ($1,$2,$3,$4,$5,'human',$6)`,
          [s.tenantId, artifact, r, caption, sha(caption), s.userId],
        );
      }
      return { tenant: s, artifact, current: { artifactId: artifact, revisionNo: revisions }, ref: (r = revisions) => formatWorkArtifactRef(artifact, r) };
    };
    type Draft = Awaited<ReturnType<typeof seedDraft>>;
    const invocation = async (d: Draft, kind: "image" | "video") =>
      (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at, output_media_kind)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now(), $7)
         returning id`,
        [d.tenant.tenantId, randomUUID(), d.tenant.userId, agents.get(d.tenant.tenantId), d.artifact, sha(randomUUID()), kind],
      )).rows[0]!.id;
    const seedImage = async (d: Draft) => {
      const inv = await invocation(d, "image");
      const assetId = randomUUID();
      const bytes = new Uint8Array(
        await sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 120, b: Math.floor(Math.random() * 255), alpha: 0.5 } } }).png().toBuffer(),
      );
      const key = `tenants/${d.tenant.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: "image/png", sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets
           (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
            storage_backend, storage_key, admitted_at, asset_lifecycle_status)
         values ($1,$2,$3,'image/png',$4,$5,64,48,'test-memory',$6, now(),'admitted')`,
        [assetId, d.tenant.tenantId, inv, bytes.length, sha(bytes), key],
      );
      const derivedId = publishDerivativeId(d.tenant.tenantId, assetId);
      return { assetId, derivedId, derivedKey: `tenants/${d.tenant.tenantId}/media/${derivedId}` };
    };


    /* ── helpers ── */
    const n = async (q: string, p: unknown[] = []) => (await setup.query<{ n: number }>(q, p)).rows[0]!.n;
    const world = async () => ({
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      attempts: await n("select count(*)::int n from action_execution_attempts"),
      decisions: await n("select count(*)::int n from decision_records"),
      mediaAssets: await n("select count(*)::int n from media_assets"),
      selections: await n("select count(*)::int n from content_selected_media"),
      audit: await n("select count(*)::int n from audit_log"),
      revisions: await n("select count(*)::int n from work_artifact_revisions"),
    });
    const captionOf = async (d: Draft, r = 1) =>
      (await setup.query<{ content: string }>(`select content from work_artifact_revisions where artifact_id=$1 and revision_no=$2`, [d.artifact, r])).rows[0]!.content;
    const keyOf = (d: Draft, assetId: string) => `tenants/${d.tenant.tenantId}/media/${assetId}`;
    const propose = async (d: Draft, image: { assetId: string }, ack?: string) => {
      const r = await proposeInstagramPublish(acmeCtx, { draftRef: d.ref(), mediaAssetId: image.assetId, ...(ack ? { acknowledgesPriorAttemptId: ack } : {}) }, baseDeps);
      assert.equal(r.status, "proposed", JSON.stringify(r));
      return (r as { requestId: string }).requestId;
    };
    const preview = async (requestId: string, ctx: TenantContext = acmeCtx): Promise<InstagramApprovalPreview> => {
      const r = await readInstagramApprovalPreview(ctx, { requestId }, baseDeps);
      assert.equal(r.status, "read", JSON.stringify(r));
      return (r as { preview: InstagramApprovalPreview }).preview;
    };
    const readyRequest = async () => {
      const d = await seedDraft();
      const x = await seedImage(d);
      await prep.makeReady(acmeCtx, d.current, x.assetId);
      return { d, x, requestId: await propose(d, x) };
    };
    const tamperPayload = (requestId: string, field: string, value: string) =>
      setup.query(`update heby_action_requests set canonical_payload = jsonb_set(canonical_payload, $2, to_jsonb($3::text)) where id=$1`, [requestId, `{${field}}`, value]);

    const before = await world();

    /* ══ A · governed image + exact caption; I · no acknowledgement → no warning ══ */
    const a = await readyRequest();
    const pa = await preview(a.requestId);
    assert.equal(pa.caption.status === "verified" && pa.caption.text, await captionOf(a.d), "A: the exact governed caption");
    assert.equal(pa.caption.status === "verified" && pa.caption.revisionStanding, "current");
    assert.equal(pa.governed.originalAssetId, a.x.assetId, "A: the governed original");
    assert.equal(pa.governed.publishAssetId, a.x.derivedId, "A: the governed derivative id");
    assert.equal(pa.image.status, "bound", `A: ${JSON.stringify(pa.image)}`);
    assert.equal(pa.derivative.status, "lineage-verified");
    assert.equal(pa.account.status, "bound-connection");
    assert.equal(pa.governed.externalAccountId, APP_ID);
    assert.deepEqual(pa.readiness, { status: "ready" });
    assert.deepEqual(pa.acknowledgement, { status: "none-in-payload" }, "I: no fake republish warning");
    const grantsBefore = store.readGrants.length;
    const openA = await openInstagramApprovalImage(acmeCtx, { requestId: a.requestId }, baseDeps);
    assert.equal(openA.status, "read", JSON.stringify(openA));
    assert.ok(openA.status === "read" && openA.url.includes(keyOf(a.d, a.x.assetId)), "A: the grant is for the governed ORIGINAL");
    assert.ok(openA.status === "read" && !openA.url.includes(a.x.derivedId), "A: never the derivative");
    assert.equal(store.readGrants.length, grantsBefore + 1, "A: exactly one grant, minted on open");
    const pending = await readPendingInstagramApprovalPreviews(acmeCtx, baseDeps);
    assert.equal(pending.status === "read" && pending.previews[a.requestId]?.status, "read", "A: listed for Approvals");

    /* ══ B · the draft advances after the request: still the governed revision ══ */
    const b = await readyRequest();
    const governedCaption = await captionOf(b.d);
    const newer = `A newer caption ${randomUUID()}`;
    await setup.query(
      `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
       values ($1,$2,2,$3,$4,'human',$5)`,
      [acme.tenantId, b.d.artifact, newer, sha(newer), acme.userId],
    );
    await setup.query(`update work_artifacts set current_revision=2 where id=$1`, [b.d.artifact]);
    const pb = await preview(b.requestId);
    assert.equal(pb.caption.status === "verified" && pb.caption.text, governedCaption, "B: still revision 1");
    assert.equal(pb.caption.status === "verified" && pb.caption.revisionStanding, "superseded", "B: and it says a newer one exists");
    assert.equal(pb.governed.revisionNo, 1);

    /* ══ C · selection changes: still image X; readiness BLOCKED beside it ══ */
    const c = await readyRequest();
    const cy = await seedImage(c.d);
    await prep.deselect(acmeCtx, c.d.current, c.x.assetId);
    await prep.select(acmeCtx, c.d.current, cy.assetId);
    await prep.approveMedia(acmeCtx, cy.assetId);
    const pc = await preview(c.requestId);
    assert.equal(pc.governed.originalAssetId, c.x.assetId, "C: the requested image is still X");
    assert.equal(pc.image.status, "bound", "C: X is still the bound image");
    assert.equal(pc.readiness.status === "not-ready" && pc.readiness.failure, "image-not-selected", "C: current readiness says X is no longer selected");
    const openC = await openInstagramApprovalImage(acmeCtx, { requestId: c.requestId }, baseDeps);
    assert.ok(openC.status === "read" && openC.url.includes(keyOf(c.d, c.x.assetId)) && !openC.url.includes(cy.assetId), "C: the grant is X, never the newly selected Y");

    /* ══ D · the requested image is declined afterwards ══ */
    const d = await readyRequest();
    await prep.declineMedia(acmeCtx, d.x.assetId);
    const pd = await preview(d.requestId);
    assert.equal(pd.governed.originalAssetId, d.x.assetId, "D: X remains identifiable");
    assert.equal(pd.image.status, "bound");
    assert.equal(pd.readiness.status === "not-ready" && pd.readiness.failure, "image-not-approved", "D: readiness reflects the decline");

    /* ══ E · wrong tenant: nothing ══ */
    assert.deepEqual(await readInstagramApprovalPreview(globexCtx, { requestId: a.requestId }, baseDeps), { status: "not-found" });
    assert.deepEqual(await openInstagramApprovalImage(globexCtx, { requestId: a.requestId }, baseDeps), { status: "refused", reason: "not-found" });
    const globexPending = await readPendingInstagramApprovalPreviews(globexCtx, baseDeps);
    assert.deepEqual(globexPending, { status: "read", previews: {} }, "E: Globex sees none of Acme's requests");

    /* ══ F · image digest mismatch: no substitute, no grant ══ */
    const f = await readyRequest();
    await tamperPayload(f.requestId, "mediaAssetDigest", "0".repeat(64));
    const pf = await preview(f.requestId);
    assert.deepEqual(pf.image, { status: "digest-mismatch" }, "F: mismatch, not a picture");
    const fGrants = store.readGrants.length;
    assert.deepEqual(await openInstagramApprovalImage(acmeCtx, { requestId: f.requestId }, baseDeps), { status: "refused", reason: "digest-mismatch" });
    assert.equal(store.readGrants.length, fGrants, "F: no grant is minted for an image that is not the governed one");
    /* stored bytes tampered: the released verified read refuses before any grant */
    const f2 = await readyRequest();
    store.objects.get(keyOf(f2.d, f2.x.assetId))!.bytes[20] ^= 0xff;
    const f2Grants = store.readGrants.length;
    assert.deepEqual(await openInstagramApprovalImage(acmeCtx, { requestId: f2.requestId }, baseDeps), { status: "refused", reason: "unavailable" });
    assert.equal(store.readGrants.length, f2Grants, "F2: tampered bytes mint nothing");

    /* ══ G · revision digest mismatch: no substitute caption ══ */
    const g = await readyRequest();
    await tamperPayload(g.requestId, "draftRevisionDigest", "f".repeat(64));
    assert.deepEqual((await preview(g.requestId)).caption, { status: "digest-mismatch" }, "G: no caption shown");
    /* and the stored content itself altered under its digest */
    const g2 = await readyRequest();
    await setup.query(`update work_artifact_revisions set content = content || ' (edited)' where artifact_id=$1 and revision_no=1`, [g2.d.artifact]).catch(() => {});
    const g2Caption = (await preview(g2.requestId)).caption;
    if ((await captionOf(g2.d)).endsWith("(edited)")) {
      assert.deepEqual(g2Caption, { status: "digest-mismatch" }, "G2: bytes altered under their digest are not shown");
    } else {
      assert.equal(g2Caption.status, "verified", "G2: the store refused the edit; the governed caption stands");
    }

    /* ══ H · republish acknowledgement shown with its ledger record ══ */
    const h = await readyRequest();
    const approved = await approveActionRequest(acmeCtx, { requestId: h.requestId, justification: JUSTIFICATION }, baseDeps);
    assert.equal(approved.status, "authorized", JSON.stringify(approved));
    const ports: InstagramPublishExecutionPorts = {
      resolveCapability: async () => ({ status: "available", integrationId: acmeIntegration, publishingAccountId: "17841408635351823" }),
      resolveStorage,
      withToken: async (_t, _id, run) => run("FAKE-TOKEN"),
      publish: async () => ({ class: "accepted", mediaId: "18000000000000777", containerId: "c1" }),
    };
    const executed = await executeAuthorizedAction(acmeCtx, { permitId: (approved as { permitId: string }).permitId }, {
      ...baseDeps,
      readTenant: (async () => ({ status: "read", effective: { state: "active" } })) as never,
      rootEnabled: async () => true,
      instagramPublish: ports,
    });
    assert.equal(executed.status === "attempted" && executed.attempt.status, "accepted", JSON.stringify(executed));
    const priorAttempt = (executed as { attempt: { attemptId: string } }).attempt.attemptId;
    const republish = await propose(h.d, h.x, priorAttempt);
    const ph = await preview(republish);
    assert.deepEqual(ph.acknowledgement, { status: "recorded", attemptId: priorAttempt, attemptStatus: "accepted", providerResultId: "18000000000000777" }, "H: the acknowledged attempt and its ledger record");

    /* ══ J · only Instagram publication requests are previewed ══ */
    const pendingAll = await readPendingInstagramApprovalPreviews(acmeCtx, baseDeps);
    const igPending = (await setup.query<{ id: string }>(`select id from heby_action_requests where tenant_id=$1 and status='pending' and action_kind='publish-instagram-media'`, [acme.tenantId])).rows.map((r) => r.id).sort();
    assert.deepEqual(pendingAll.status === "read" && Object.keys(pendingAll.previews).sort(), igPending, "J: exactly the pending Instagram requests");
    assert.ok(pendingAll.status === "read" && !(h.requestId in pendingAll.previews), "J: an executed request is not pending");

    /* ══ L · read failure → unavailable, never empty ══ */
    assert.deepEqual(await readPendingInstagramApprovalPreviews(acmeCtx, { getDb: () => null }), { status: "unavailable" });
    const throwing = { select: () => { throw new Error("db down"); } } as unknown as ControlPlaneDatabase;
    assert.deepEqual(await readPendingInstagramApprovalPreviews(acmeCtx, { getDb: () => throwing }), { status: "unavailable" }, "L: a failed read is unknown, not {}");
    assert.deepEqual(await readInstagramApprovalPreview(acmeCtx, { requestId: a.requestId }, { getDb: () => throwing }), { status: "unavailable" });
    assert.deepEqual(await readInstagramApprovalPreview(null, { requestId: a.requestId }, baseDeps), { status: "unavailable" });
    const noStore = await openInstagramApprovalImage(acmeCtx, { requestId: a.requestId }, { ...baseDeps, resolveStorage: () => ({ status: "unavailable" as const, reason: "storage-not-connected" as const }) });
    assert.deepEqual(noStore, { status: "refused", reason: "unavailable" }, "L: storage down is unavailable, not a substitute");

    /* ══ the preview reads wrote nothing ══ */
    const probe = await world();
    for (const id of [a.requestId, b.requestId, c.requestId, d.requestId, republish]) {
      await readInstagramApprovalPreview(acmeCtx, { requestId: id }, baseDeps);
      await openInstagramApprovalImage(acmeCtx, { requestId: id }, baseDeps);
    }
    await readPendingInstagramApprovalPreviews(acmeCtx, baseDeps);
    assert.deepEqual(await world(), probe, "preview + open write no row of any kind");
    void before;

    /* ══ K · no provider call anywhere ══ */
    assert.equal(networkCalls, 0, "K: the preview never contacts Meta or any network");

    finished = true;
    console.log("PASS instagram-approval-preview-1 preview (postgres, released writers and readers, provider seams faked)");
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
