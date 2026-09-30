/*
 * INSTAGRAM-PACKAGE-READINESS-1 — Instagram publication requires the CURRENT Content Package of the
 * exact revision to be READY, with the requested original selected as an image and approved, both
 * at proposal and at execution (pre-flight AND after the spend, immediately before Meta). On a
 * disposable PostgreSQL; readiness is prepared ONLY through the released writers (selection, MEDIA-3
 * review, TRH-10 copy review). Storage is an in-memory fake with real bytes; every network call throws.
 *
 *   PROPOSAL   A ready → filed · B unreviewed · C approved-unselected · D other image selected ·
 *              E copy unreviewed / changes requested · F ready with X, propose Y · G superseded
 *              revision / current package does not authorize it · H cross-tenant · I multi-image ·
 *              J image + video — and EVERY readiness refusal writes nothing: no request, no
 *              derivative row, no derivative object, no decision, no permit, no network.
 *   EXECUTION  1 deselect · 2 decline · 3 copy changes → pre-flight refusal, permit active, no attempt,
 *              no Meta · 4 valid at pre-flight, invalidated after the spend → refused-after-spend,
 *              no Meta · 5 still ready → the existing path publishes.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import sharp from "sharp";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { instagramPackagePreparation } from "../helpers/instagram-package-fixture";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import {
  executeAuthorizedAction,
  type InstagramPublishExecutionPorts,
} from "../../src/features/action-execution/execute-authorized-action.server";
import { proposeInstagramPublish } from "../../src/features/heby-action-inlet/instagram-publish-proposal.server";
import { verifyInstagramPackageReadiness } from "../../src/features/instagram-publishing/verify-instagram-package.server";
import { publishDerivativeId } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { InstagramPublishOutcome } from "../../src/features/provider-instagram/instagram-publish-transport.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this post is a deliberate organizational act and I accept responsibility.";
const SECRET = "FAKE-TOKEN-never-real-must-not-persist";
const APP_ID = "28295264780115792";
const IG_ID = "17841408635351823";
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
    requestId: "ipr1-request",
    authenticatedAt: new Date().toISOString(),
  });
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("instagram-package-readiness-1/readiness-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ipr1_readiness");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const baseDeps = { getDb: () => handle.db, resolveStorage };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ipr1", email: "director@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ipr1", email: "director@globex.test" })) as Seeded;
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
    const ctxOf = (s: Seeded) => (s === acme ? acmeCtx : globexCtx);
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
    type Image = Awaited<ReturnType<typeof seedImage>>;
    const seedVideo = async (d: Draft) => {
      const inv = await invocation(d, "video");
      const assetId = randomUUID();
      const bytes = new Uint8Array(Array.from({ length: 2048 }, (_, i) => (i * 7 + 3) % 256));
      const key = `tenants/${d.tenant.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: "video/mp4", sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
           storage_backend, storage_key, admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate)
         values ($1,$2,$3,'video/mp4',$4,$5,1280,720,'test-memory',$6, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',5000,'h264','24/1')`,
        [assetId, d.tenant.tenantId, inv, bytes.length, sha(bytes), key],
      );
      return assetId;
    };

    /* ── WHAT A REFUSAL MUST NOT WRITE ── */
    const n = async (q: string, p: unknown[] = []) => (await setup.query<{ n: number }>(q, p)).rows[0]!.n;
    const world = async () => ({
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      attempts: await n("select count(*)::int n from action_execution_attempts"),
      decisions: await n("select count(*)::int n from decision_records"),
      mediaAssets: await n("select count(*)::int n from media_assets"),
      derivatives: await n("select count(*)::int n from media_assets where derived_from_asset_id is not null"),
      storePuts: store.puts.length,
      network: networkCalls,
    });
    const propose = (d: Draft, image: { assetId: string }, ctx: TenantContext = ctxOf(d.tenant), r?: number) =>
      proposeInstagramPublish(ctx, { draftRef: d.ref(r), mediaAssetId: image.assetId }, baseDeps);
    const refusedCleanly = async (
      label: string,
      run: () => ReturnType<typeof proposeInstagramPublish>,
      reason: string,
      image: Image,
      detail?: string,
    ) => {
      const before = await world();
      const result = await run();
      assert.equal(result.status === "refused" && result.reason, reason, `${label}: ${JSON.stringify(result)}`);
      if (detail !== undefined) assert.equal(result.status === "refused" && result.detail, detail, `${label}: detail`);
      assert.deepEqual(await world(), before, `${label}: nothing written (no request, derivative, object, decision, permit, network)`);
      assert.equal(await n("select count(*)::int n from media_assets where id=$1", [image.derivedId]), 0, `${label}: no derivative row`);
      assert.equal(store.puts.includes(image.derivedKey), false, `${label}: no derivative object`);
    };

    /* ══ A · READY → filed, exactly one request, derivative bound ══ */
    const a = await seedDraft();
    const ax = await seedImage(a);
    await prep.makeReady(acmeCtx, a.current, ax.assetId);
    const aBefore = await world();
    const aResult = await propose(a, ax);
    assert.equal(aResult.status, "proposed", `A: ${JSON.stringify(aResult)}`);
    const aAfter = await world();
    assert.equal(aAfter.requests, aBefore.requests + 1, "A: one request");
    assert.equal(aAfter.permits, aBefore.permits, "A: no permit");
    assert.equal(aAfter.attempts, aBefore.attempts, "A: no attempt");
    assert.equal(await n("select count(*)::int n from media_assets where id=$1", [ax.derivedId]), 1, "A: derivative produced only now");

    /* ══ B · image selected, copy approved, image NEVER reviewed ══ */
    const b = await seedDraft();
    const bx = await seedImage(b);
    await prep.select(acmeCtx, b.current, bx.assetId);
    await prep.approveCopy(acmeCtx, b.current);
    await refusedCleanly("B", () => propose(b, bx), "image-not-approved", bx);

    /* ══ C · image approved, copy approved, image NOT selected ══ */
    const c = await seedDraft();
    const cx = await seedImage(c);
    await prep.approveMedia(acmeCtx, cx.assetId);
    await prep.approveCopy(acmeCtx, c.current);
    await refusedCleanly("C", () => propose(c, cx), "image-not-selected", cx);

    /* ══ D · a DIFFERENT image is selected (and ready); the requested one is admitted, of this draft, unselected ══ */
    const d = await seedDraft();
    const dx = await seedImage(d);
    const dy = await seedImage(d);
    await prep.makeReady(acmeCtx, d.current, dy.assetId);
    await refusedCleanly("D", () => propose(d, dx), "image-not-selected", dx);

    /* ══ E · copy unreviewed → BLOCKED; copy changes requested → BLOCKED ══ */
    const e = await seedDraft();
    const ex = await seedImage(e);
    await prep.select(acmeCtx, e.current, ex.assetId);
    await prep.approveMedia(acmeCtx, ex.assetId);
    await refusedCleanly("E1 copy unreviewed", () => propose(e, ex), "package-not-ready", ex, "copy-unreviewed");
    await prep.requestCopyChanges(acmeCtx, e.current);
    await refusedCleanly("E2 copy changes requested", () => propose(e, ex), "package-not-ready", ex, "copy-declined");

    /* ══ F · package READY with image X; propose image Y (approved too, but not selected) ══ */
    const f = await seedDraft();
    const fx = await seedImage(f);
    const fy = await seedImage(f);
    await prep.makeReady(acmeCtx, f.current, fx.assetId);
    await prep.approveMedia(acmeCtx, fy.assetId);
    await refusedCleanly("F", () => propose(f, fy), "image-not-selected", fy);

    /* ══ G · old revision prepared, current revision's package does not authorize the image ══ */
    const g = await seedDraft(acme, 2);
    const gx = await seedImage(g);
    await prep.makeReady(acmeCtx, { artifactId: g.artifact, revisionNo: 1 }, gx.assetId);
    await prep.approveCopy(acmeCtx, g.current);
    await refusedCleanly("G1 superseded revision", () => propose(g, gx, acmeCtx, 1), "draft-superseded", gx);
    await refusedCleanly("G2 current package lacks the image", () => propose(g, gx, acmeCtx, 2), "image-not-selected", gx);
    await prep.select(acmeCtx, g.current, gx.assetId);
    assert.equal((await propose(g, gx, acmeCtx, 2)).status, "proposed", "G3: once the CURRENT package authorizes it, it files");

    /* ══ H · cross-tenant: tenant-safe refusals preserved; the verifier is tenant-predicated ══ */
    const h = await seedDraft(globex);
    const hx = await seedImage(h);
    await prep.makeReady(globexCtx, h.current, hx.assetId);
    /* A fresh Acme image, selected + approved into Acme's READY package, never derived. */
    const ay = await seedImage(a);
    await prep.select(acmeCtx, a.current, ay.assetId);
    await prep.approveMedia(acmeCtx, ay.assetId);
    await refusedCleanly("H1 foreign draft", () => propose(a, ay, globexCtx), "draft-not-found", ay);
    await refusedCleanly("H2 own draft, foreign image", () => propose(h, ay, globexCtx), "media-not-found", ay);
    assert.deepEqual(
      await verifyInstagramPackageReadiness(globexCtx, { ...a.current, mediaAssetId: ax.assetId }, { getDb: () => handle.db }),
      { ok: false, failure: "package-unresolvable" },
      "H3: Acme's READY package does not exist for Globex",
    );
    assert.equal(
      (await verifyInstagramPackageReadiness(acmeCtx, { ...a.current, mediaAssetId: ax.assetId }, { getDb: () => handle.db })).ok,
      true,
      "H4: and does for Acme",
    );

    /* ══ I · two images selected, both approved; the requested one is a member → allowed ══ */
    const i = await seedDraft();
    const ix = await seedImage(i);
    const iy = await seedImage(i);
    await prep.makeReady(acmeCtx, i.current, ix.assetId);
    await prep.select(acmeCtx, i.current, iy.assetId);
    await prep.approveMedia(acmeCtx, iy.assetId);
    const iResult = await propose(i, ix);
    assert.equal(iResult.status, "proposed", `I: another selected image does not block (${JSON.stringify(iResult)})`);

    /* ══ J · image + video selected, both approved, package READY → the image is allowed ══ */
    const j = await seedDraft();
    const jx = await seedImage(j);
    const jv = await seedVideo(j);
    await prep.makeReady(acmeCtx, j.current, jx.assetId);
    await prep.select(acmeCtx, j.current, jv);
    await prep.approveMedia(acmeCtx, jv);
    const jPkg = await verifyInstagramPackageReadiness(acmeCtx, { ...j.current, mediaAssetId: jx.assetId }, { getDb: () => handle.db });
    assert.equal(jPkg.ok && jPkg.pkg.selected.length, 2, "J: the package holds both");
    const jResult = await propose(j, jx);
    assert.equal(jResult.status, "proposed", `J: a selected video does not block (${JSON.stringify(jResult)})`);
    /* …and the video itself is not an Instagram image: the image-only Media read already refuses it. */
    await refusedCleanly(
      "J2 video as the image",
      () => proposeInstagramPublish(acmeCtx, { draftRef: j.ref(), mediaAssetId: jv }, baseDeps),
      "media-not-found",
      { assetId: jv, derivedId: publishDerivativeId(acme.tenantId, jv), derivedKey: `tenants/${acme.tenantId}/media/${publishDerivativeId(acme.tenantId, jv)}` },
    );
    assert.deepEqual(
      await verifyInstagramPackageReadiness(acmeCtx, { ...j.current, mediaAssetId: jv }, { getDb: () => handle.db }),
      { ok: false, failure: "image-not-selected" },
      "J3: the verifier never treats a selected, approved VIDEO as the Instagram image",
    );
    assert.equal(networkCalls, 0, "no proposal reached any network");

    /* ══════════════════════════ EXECUTION ══════════════════════════ */
    const metaCalls: string[] = [];
    const ports: InstagramPublishExecutionPorts = {
      resolveCapability: async () => ({ status: "available", integrationId: acmeIntegration, publishingAccountId: IG_ID }),
      resolveStorage,
      withToken: async (_t, _id, run) => run(SECRET),
      publish: async (input) => {
        metaCalls.push(input.caption);
        return { class: "accepted", mediaId: "18000000000000001", containerId: "c1" } satisfies InstagramPublishOutcome;
      },
    };
    const exec = (permitId: string, extra: Record<string, unknown> = {}) =>
      executeAuthorizedAction(acmeCtx, { permitId }, {
        ...baseDeps,
        readTenant: (async () => ({ status: "read", effective: { state: "active" } })) as never,
        rootEnabled: async () => true,
        instagramPublish: ports,
        ...extra,
      });
    const readyPermit = async () => {
      const dr = await seedDraft();
      const im = await seedImage(dr);
      await prep.makeReady(acmeCtx, dr.current, im.assetId);
      const proposed = await propose(dr, im);
      assert.equal(proposed.status, "proposed", JSON.stringify(proposed));
      const approved = await approveActionRequest(acmeCtx, { requestId: (proposed as { requestId: string }).requestId, justification: JUSTIFICATION }, baseDeps);
      assert.equal(approved.status, "authorized", JSON.stringify(approved));
      return { draft: dr, image: im, permitId: (approved as { permitId: string }).permitId };
    };
    const permitStatus = async (id: string) => (await setup.query<{ status: string }>("select status from action_permits where id=$1", [id])).rows[0]!.status;
    const attemptsFor = async (permitId: string) => n("select count(*)::int n from action_execution_attempts where permit_id=$1", [permitId]);
    const preflightRefused = async (label: string, permitId: string) => {
      const metaBefore = metaCalls.length;
      const result = await exec(permitId);
      assert.deepEqual(result, { status: "refused", reason: "content-package-not-ready" }, `${label}: ${JSON.stringify(result)}`);
      assert.equal(await permitStatus(permitId), "active", `${label}: the permit is still active`);
      assert.equal(await attemptsFor(permitId), 0, `${label}: no attempt row`);
      assert.equal(metaCalls.length, metaBefore, `${label}: Meta never asked`);
    };

    /* 1 · deselect the requested image before execution */
    const x1 = await readyPermit();
    await prep.deselect(acmeCtx, x1.draft.current, x1.image.assetId);
    await preflightRefused("X1 deselected", x1.permitId);
    /* the same permit executes once the package authorizes the image again — nothing was burned */
    await prep.select(acmeCtx, x1.draft.current, x1.image.assetId);
    const x1Again = await exec(x1.permitId);
    assert.equal(x1Again.status === "attempted" && x1Again.attempt.status, "accepted", `X1: re-selected → executes (${JSON.stringify(x1Again)})`);

    /* 2 · decline the requested image before execution */
    const x2 = await readyPermit();
    await prep.declineMedia(acmeCtx, x2.image.assetId);
    await preflightRefused("X2 declined", x2.permitId);

    /* 3 · copy changes requested → package BLOCKED before execution */
    const x3 = await readyPermit();
    await prep.requestCopyChanges(acmeCtx, x3.draft.current);
    await preflightRefused("X3 copy blocked", x3.permitId);

    /*
     * 4 · valid at pre-flight, invalidated after the spend and before Meta. The EXISTING seam
     * `afterPublicationGuardRead` runs inside the spend transaction; the deselection it performs
     * commits on another connection, so only the post-commit re-read can see it.
     */
    const x4 = await readyPermit();
    const metaBefore4 = metaCalls.length;
    const x4Result = await exec(x4.permitId, {
      afterPublicationGuardRead: async () => {
        await prep.deselect(acmeCtx, x4.draft.current, x4.image.assetId);
      },
    });
    assert.equal(x4Result.status, "refused-after-spend", `X4: ${JSON.stringify(x4Result)}`);
    if (x4Result.status !== "refused-after-spend") throw new Error("unreachable");
    assert.equal(x4Result.attempt.status, "refused", "X4: the attempt closes refused — not failed, not accepted");
    assert.equal(x4Result.attempt.failureClass, "digest-mismatch", "X4: no longer the authorized package (the ledger's closed enum)");
    assert.equal(x4Result.attempt.providerMessageId, null, "X4: no provider id");
    assert.equal(x4Result.attempt.providerResponseClass, null, "X4: no provider response");
    assert.equal(metaCalls.length, metaBefore4, "X4: Meta never asked");
    assert.equal(await permitStatus(x4.permitId), "consumed", "X4: the spent permit is not resurrected");
    assert.deepEqual(await exec(x4.permitId), { status: "refused", reason: "permit-not-executable" }, "X4: and cannot be replayed");

    /* 5 · still ready → the existing path proceeds unchanged */
    const x5 = await readyPermit();
    const x5Result = await exec(x5.permitId);
    assert.equal(x5Result.status === "attempted" && x5Result.attempt.status, "accepted", `X5: ${JSON.stringify(x5Result)}`);
    assert.equal(x5Result.status === "attempted" && x5Result.attempt.providerMessageId, "18000000000000001");
    assert.equal(networkCalls, 0, "no real network anywhere");

    finished = true;
    console.log("PASS instagram-package-readiness-1 readiness (postgres, released writers only, provider seams faked)");
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
