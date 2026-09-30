/*
 * tests/content-publication-duplicate-guard-1/guard-postgres.ts — CONTENT-PUBLICATION-DUPLICATE-GUARD-1
 * against a real migrated database, with REAL ledger rows written by the released writers
 * (proposal, decision, execution). Every provider seam is faked; the real network is unreachable.
 *
 * V1 identity: tenant + action kind + destination account (Instagram externalAccountId / YouTube
 * expectedChannelId) + EXACT revision. Proves the policy at proposal (early) and at execution
 * (authoritative, under the revision row lock), with real concurrent transactions.
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
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { approveActionRequest, rejectActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { recordActionRequest } from "../../src/features/action-authorization/record-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { prepareAction } from "../../src/features/heby-actions/action-preparer";
import { SEND_OWNER_WORKSPACE } from "../../src/features/heby-action-inlet/contracts";
import {
  executeAuthorizedAction,
  type InstagramPublishExecutionPorts,
  type YouTubePublishExecutionPorts,
} from "../../src/features/action-execution/execute-authorized-action.server";
import { proposeYouTubePublish } from "../../src/features/heby-action-inlet/youtube-publish-proposal.server";
import { proposeInstagramPublish } from "../../src/features/heby-action-inlet/instagram-publish-proposal.server";
import { verifyYouTubePackageBinding } from "../../src/features/youtube-publishing/resolve-youtube-publish.server";
import { openYouTubeUploadSession, sendYouTubeUploadBytes } from "../../src/features/provider-google/google-transport.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Publishing this is a deliberate organizational act and I accept responsibility.";
const SECRET = "FAKE-DG1-TOKEN-never-real";
const SUB = "117622225072141590877";
const CHANNEL = { channelId: "UC5Yf5U_YOKR0K38tWF82kjA", title: "Turkish Rug House" };
const OTHER_CHANNEL = { channelId: "UCqTzRYJBwFsITzxFuqx6YQw", title: "Hebun Tech" };
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=test";
const YT_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];
const IG_APP_ID = "28295264780115792";
const IG_ID = "17841408635351823";
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }

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
    tenantId: seeded.tenantId, userId: seeded.userId, authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId, membershipVersion: 1, roleId: seeded.roleId, sessionContextId,
    provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "dg1-request",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_dg1_guard");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const baseDeps = { getDb: () => handle.db, resolveStorage };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-dg1", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-dg1", email: "d@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "c1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "c2"));
    const agents = new Map<string, string>();
    let acmeIgIntegration = "";
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status, "established");
      await setup.query(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, external_account_label, created_by, created_by_type)
         values ($1,'google-youtube','YouTube','connected','connected','healthy',$2::jsonb,$3,'owner@example.test',$4,'human')`,
        [s.tenantId, JSON.stringify(YT_SCOPES), SUB, s.userId],
      );
      const ig = (await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, created_by, created_by_type)
         values ($1,'instagram','instagram','connected','connected','healthy',$2::jsonb,$3,$4,'human') returning id`,
        [s.tenantId, JSON.stringify(["instagram_business_basic", "instagram_business_content_publish"]), IG_APP_ID, s.userId],
      )).rows[0]!.id;
      if (s === acme) acmeIgIntegration = ig;
      agents.set(s.tenantId, (await setup.query<{ id: string }>(
        `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type) values ($1,'Heby','active',$2,'human') returning id`,
        [s.tenantId, s.userId],
      )).rows[0]!.id);
    }

    /* ── FIXTURES: a content draft (YouTube video or Instagram image) with admitted media in the store ── */
    const seedDraft = async (s: Seeded, destination: "youtube" | "instagram") => {
      const copy = `A kilim, woven slowly. ${randomUUID()}`;
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace, current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Black Rose Kilim','draft','operations',1,$2,$3,'human') returning id`,
        [s.tenantId, destination, s.userId],
      )).rows[0]!.id;
      await setup.query(
        `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,1,$3,$4,'human',$5)`,
        [s.tenantId, artifact, copy, sha(copy), s.userId],
      );
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id, source_artifact_id, source_revision_no,
            prompt_text, input_digest, transport, provider, model, state, admission_outcome, requested_at, finalized_at)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now()) returning id`,
        [s.tenantId, randomUUID(), s.userId, agents.get(s.tenantId), artifact, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const key = `tenants/${s.tenantId}/media/${assetId}`;
      if (destination === "youtube") {
        const bytes = new Uint8Array(Array.from({ length: 2048 }, (_, i) => (i * 13 + assetId.charCodeAt(0)) % 256));
        await store.put({ key, bytes, contentType: "video/mp4", sha256Hex: sha(bytes) });
        await setup.query(
          `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
             storage_backend, storage_key, admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate)
           values ($1,$2,$3,'video/mp4',$4,$5,1280,720,'test-memory',$6, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',5000,'h264','24/1')`,
          [assetId, s.tenantId, inv, bytes.length, sha(bytes), key],
        );
      } else {
        const bytes = new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().toBuffer());
        await store.put({ key, bytes, contentType: "image/jpeg", sha256Hex: sha(bytes) });
        await setup.query(
          `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
             storage_backend, storage_key, admitted_at, asset_lifecycle_status)
           values ($1,$2,$3,'image/jpeg',$4,$5,64,48,'test-memory',$6, now(),'admitted')`,
          [assetId, s.tenantId, inv, bytes.length, sha(bytes), key],
        );
      }
      return { tenant: s, artifact, revisionNo: 1, draftRef: formatWorkArtifactRef(artifact, 1), assetId, copy, title: "Black Rose Kilim" };
    };
    type Draft = Awaited<ReturnType<typeof seedDraft>>;

    /* ── YouTube: fake package + channel reads; real proposal, decision and execution ── */
    /* Keyed by artifact, so concurrent executions each read THEIR package. */
    const drafts = new Map<string, Draft>();
    let current: Draft | null = null;
    const readPackage = (async (_t: unknown, input: { artifactId: string; revisionNo: number }) => {
      const d = drafts.get(`${input.artifactId}@${input.revisionNo}`) ?? current!;
      return {
        status: "read",
        package: {
          artifactId: d.artifact, revisionNo: d.revisionNo, title: d.title, destination: "youtube", copy: d.copy, copyReviewState: "approved",
          selected: [{ mediaAssetId: d.assetId, mediaKind: "video", selectedAt: new Date().toISOString() }],
          mediaReviewStates: { [d.assetId]: "approved" }, blockers: [], ready: true,
        },
      };
    }) as never;
    let channels = [CHANNEL];
    const readChannel = async () => ({ status: "one-channel", channel: channels[0]! }) as const;
    const track = (d: Draft) => {
      drafts.set(`${d.artifact}@${d.revisionNo}`, d);
      current = d;
    };
    const ctxOf = (d: Draft) => (d.tenant === acme ? acmeCtx : globexCtx);

    const proposeYT = (d: Draft, opts: { privacy?: "private" | "unlisted" | "public"; ack?: string } = {}) => {
      track(d);
      return proposeYouTubePublish(
        ctxOf(d),
        {
          draftRef: d.draftRef, videoAssetId: d.assetId, privacyStatus: opts.privacy ?? "private", categoryId: "22", madeForKids: "no", syntheticMedia: "yes",
          ...(opts.ack ? { acknowledgesPriorAttemptId: opts.ack } : {}),
        },
        { ...baseDeps, readPackage, readChannel },
      );
    };
    const mustPropose = async (p: Promise<{ status: string; requestId?: string }>) => {
      const r = await p;
      assert.equal(r.status, "proposed", JSON.stringify(r));
      return r.requestId!;
    };
    const refusalOf = async (p: Promise<{ status: string; reason?: string; detail?: string }>) => {
      const r = await p;
      return r.status === "refused" ? { reason: r.reason!, detail: r.detail } : { reason: r.status, detail: undefined };
    };
    const approve = async (requestId: string, ctx: TenantContext = acmeCtx) => {
      const r = await approveActionRequest(ctx, { requestId, justification: JUSTIFICATION }, baseDeps);
      assert.equal(r.status, "authorized", JSON.stringify(r));
      if (r.status !== "authorized") throw new Error("unreachable");
      return r.permitId;
    };

    let uploads = 0;
    type Answer = (method: string) => Response | Promise<Response>;
    const accept = (id: string): Answer => (method) =>
      method === "POST"
        ? new Response(null, { status: 200, headers: { location: SESSION } })
        : new Response(JSON.stringify({ kind: "youtube#video", id, status: { uploadStatus: "uploaded", privacyStatus: "private" } }), { status: 201 });
    const reject400: Answer = (m) => (m === "POST" ? new Response(null, { status: 400 }) : new Response(null, { status: 500 }));
    const lost: Answer = (m) => (m === "POST" ? new Response(null, { status: 200, headers: { location: SESSION } }) : Promise.reject(new Error("reset")));
    const fetchFor = (answer: Answer) => async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") uploads++;
      return answer(init?.method ?? "GET");
    };
    const ytPorts = (answer: Answer): YouTubePublishExecutionPorts => ({
      verifyPackage: (t, p) => verifyYouTubePackageBinding(t, p, { readPackage }),
      readChannel,
      resolveStorage,
      withToken: (async (_t: unknown, _id: string, run: (token: string) => Promise<unknown>) => run(SECRET)) as never,
      listChannels: async () => ({ ok: true, channels: [channels[0]!], truncated: false }),
      openSession: (input, token) => openYouTubeUploadSession(input, token, { fetchImpl: fetchFor(answer) }),
      sendBytes: (uri, input, token) => sendYouTubeUploadBytes(uri, input, token, { fetchImpl: fetchFor(answer), sleep: async () => {} }),
    });
    const executeYT = (d: Draft, permitId: string, answer: Answer, extra: object = {}, db = handle.db) => {
      track(d);
      return executeAuthorizedAction(ctxOf(d), { permitId }, {
        getDb: () => db,
        readTenant: (async () => ({ status: "read", effective: { state: "active" } })) as never,
        rootEnabled: async () => true,
        youtubePublish: ytPorts(answer),
        ...extra,
      });
    };
    const attemptOf = async (d: Draft, permitId: string, answer: Answer) => {
      const r = await executeYT(d, permitId, answer);
      assert.equal(r.status, "attempted", JSON.stringify(r));
      if (r.status !== "attempted") throw new Error("unreachable");
      return r.attempt.attemptId;
    };
    const publishYT = async (d: Draft, answer: Answer, opts: { privacy?: "private" | "unlisted" | "public"; ack?: string } = {}) =>
      attemptOf(d, await approve(await mustPropose(proposeYT(d, opts)), ctxOf(d)), answer);

    /* A request filed WITHOUT the inlet's early check — what a raced or bypassing caller leaves behind. */
    const directRequest = async (ctx: TenantContext, kind: string, draftRef: string, args: Record<string, string | boolean>) => {
      const prepared = prepareAction({
        actionKind: kind,
        requestingWorkspace: SEND_OWNER_WORKSPACE,
        target: { kind: "record", ref: draftRef, label: "direct" },
        proposedArguments: args,
        evidence: [{ sourceClass: "work-artifacts", recordRef: draftRef, lifecycle: "settled" }],
      } as never);
      const r = await recordActionRequest(ctx, prepared, baseDeps);
      assert.equal(r.status, "recorded", JSON.stringify(r));
      return (r as { requestId: string }).requestId;
    };
    const payloadOf = async (requestId: string) =>
      (await setup.query<{ canonical_payload: Record<string, string | boolean>; payload_digest: string }>(
        "select canonical_payload, payload_digest from heby_action_requests where id=$1", [requestId])).rows[0]!;
    const permitStatus = async (id: string) => (await setup.query<{ status: string }>("select status from action_permits where id=$1", [id])).rows[0]!.status;
    const revoke = async (permitId: string) => {
      const r = await revokeActionPermit(acmeCtx, { permitId, justification: JUSTIFICATION, revocationReason: "test cleanup" }, baseDeps);
      assert.equal(r.status, "revoked", JSON.stringify(r));
    };
    const count = async (table: string) => (await setup.query<{ n: number }>(`select count(*)::int n from ${table}`)).rows[0]!.n;

    /* ══ Y1–Y4 · ACCEPTED history: unacknowledged / mismatch / acknowledged, and digest binding ══ */
    const a = await seedDraft(acme, "youtube");
    const r1 = await mustPropose(proposeYT(a));
    const A1 = await attemptOf(a, await approve(r1), accept("vid_A1"));
    {
      const before = await count("heby_action_requests");
      const un = await refusalOf(proposeYT(a));
      assert.deepEqual(un, { reason: "prior-publication-unacknowledged", detail: `latest-attempt=${A1}` }, "the refusal names the attempt to acknowledge");
      assert.equal((await refusalOf(proposeYT(a, { ack: randomUUID() }))).reason, "prior-publication-acknowledgement-mismatch", "an unknown UUID is not trusted");
      assert.equal((await refusalOf(proposeYT(a, { privacy: "public" }))).reason, "prior-publication-unacknowledged", "different parameters, same identity: still needs acknowledgement");
      assert.equal(await count("heby_action_requests"), before, "no refused proposal files a request");
    }
    const r2 = await mustPropose(proposeYT(a, { ack: A1 }));
    {
      const p1 = await payloadOf(r1);
      const p2 = await payloadOf(r2);
      assert.equal(p2.canonical_payload.acknowledgesPriorAttemptId, A1, "the acknowledgement is IN the governed payload");
      const rest = { ...p2.canonical_payload };
      delete rest.acknowledgesPriorAttemptId;
      assert.deepEqual(rest, p1.canonical_payload, "and is the only difference");
      assert.notEqual(p2.payload_digest, p1.payload_digest, "so it is digest-bound");
      assert.equal("acknowledgesPriorAttemptId" in p1.canonical_payload, false, "an unacknowledged request carries no such key");
    }
    /* Tamper after approval: removing the acknowledgement breaks the bound digest — nothing is sent. */
    const p2permit = await approve(r2);
    const original = (await payloadOf(r2)).canonical_payload;
    await setup.query("update heby_action_requests set canonical_payload = canonical_payload - 'acknowledgesPriorAttemptId' where id=$1", [r2]);
    const uploadsBeforeTamper = uploads;
    assert.deepEqual(await executeYT(a, p2permit, accept("never")), { status: "refused", reason: "digest-mismatch" });
    assert.equal(uploads, uploadsBeforeTamper);
    await setup.query("update heby_action_requests set canonical_payload = $2::jsonb where id=$1", [r2, JSON.stringify(original)]);
    const A2 = await attemptOf(a, p2permit, accept("vid_A2"));

    /* ══ Y5 · STALE acknowledgement — proposal AND execution (a request that skipped the inlet) ══ */
    assert.deepEqual(await refusalOf(proposeYT(a, { ack: A1 })), { reason: "prior-publication-acknowledgement-stale", detail: `latest-attempt=${A2}` });
    {
      const staleReq = await directRequest(acmeCtx, "publish-youtube-video", a.draftRef, { ...(await payloadOf(r2)).canonical_payload, privacyStatus: "unlisted", acknowledgesPriorAttemptId: A1 });
      const permit = await approve(staleReq);
      const attemptsBefore = await count("action_execution_attempts");
      const up = uploads;
      assert.deepEqual(await executeYT(a, permit, accept("never")), { status: "refused", reason: "prior-publication-acknowledgement-stale" });
      assert.equal(await permitStatus(permit), "active", "a guard refusal spends nothing");
      assert.equal(await count("action_execution_attempts"), attemptsBefore, "and records no attempt");
      assert.equal(uploads, up, "and reaches no provider");
      /* Unacknowledged at execution too. */
      const bare = await directRequest(acmeCtx, "publish-youtube-video", a.draftRef, { ...(await payloadOf(r1)).canonical_payload, privacyStatus: "public" });
      const bp = await approve(bare);
      assert.deepEqual(await executeYT(a, bp, accept("never")), { status: "refused", reason: "prior-publication-unacknowledged" });
      assert.equal(await permitStatus(bp), "active");
      /* These two leave active permits: in flight for any further PROPOSAL on this identity. */
      assert.equal((await refusalOf(proposeYT(a, { ack: A2 }))).reason, "publication-in-flight");
      for (const id of [permit, bp]) await revoke(id);
    }

    /* ══ Y6 · IN FLIGHT at proposal; a later REJECTED request does not erase the need to acknowledge ══ */
    const r3 = await mustPropose(proposeYT(a, { ack: A2 }));
    assert.equal((await refusalOf(proposeYT(a, { privacy: "unlisted", ack: A2 }))).reason, "publication-in-flight", "pending → in flight");
    const rej = await rejectActionRequest(acmeCtx, { requestId: r3, justification: JUSTIFICATION, rejectionReason: "not now" }, baseDeps);
    assert.equal(rej.status, "rejected");
    assert.equal((await refusalOf(proposeYT(a))).reason, "prior-publication-unacknowledged", "a harmless later request hides nothing");

    /* ══ Y7 · UNKNOWN: fail closed; only an exact acknowledgement proceeds; a later FAILED does not reset it ══ */
    const u = await seedDraft(acme, "youtube");
    const U1 = await publishYT(u, lost);
    assert.deepEqual(await refusalOf(proposeYT(u)), { reason: "prior-publication-unacknowledged", detail: `latest-attempt=${U1}` }, "unknown is never read as failed");
    const F1 = await publishYT(u, reject400, { ack: U1 });
    assert.deepEqual(await refusalOf(proposeYT(u)), { reason: "prior-publication-unacknowledged", detail: `latest-attempt=${U1}` }, "unknown → failed: the unknown is still latest consequential");
    assert.equal((await refusalOf(proposeYT(u, { ack: F1 }))).reason, "prior-publication-acknowledgement-mismatch", "a failed attempt is not an acknowledgeable publication");
    await mustPropose(proposeYT(u, { ack: U1 }));

    /* ══ Y8 · FAILED only: allowed without acknowledgement; a false acknowledgement is refused ══ */
    const f = await seedDraft(acme, "youtube");
    const Ff = await publishYT(f, reject400);
    assert.equal((await refusalOf(proposeYT(f, { ack: Ff }))).reason, "prior-publication-acknowledgement-mismatch", "supplied but not required: validated, not ignored");
    /* failed → accepted: the accepted one must now be acknowledged */
    const Af = await publishYT(f, accept("vid_Af"));
    assert.deepEqual(await refusalOf(proposeYT(f)), { reason: "prior-publication-unacknowledged", detail: `latest-attempt=${Af}` });
    /* accepted → failed republish: the accepted one is still what must be acknowledged */
    await publishYT(f, reject400, { ack: Af });
    assert.deepEqual(await refusalOf(proposeYT(f)), { reason: "prior-publication-unacknowledged", detail: `latest-attempt=${Af}` });

    /* ══ Y9 · CROSS-CHANNEL and CROSS-DESTINATION identities do not block each other ══ */
    channels = [OTHER_CHANNEL];
    await mustPropose(proposeYT(a));
    channels = [CHANNEL];
    {
      /* the same revision's accepted history, relabelled as an INSTAGRAM publication, is another identity */
      const x = await seedDraft(acme, "youtube");
      const Ax = await publishYT(x, accept("vid_Ax"));
      assert.equal((await refusalOf(proposeYT(x))).reason, "prior-publication-unacknowledged");
      await setup.query(
        `update heby_action_requests set action_kind='publish-instagram-media' where id =
           (select action_request_id from action_execution_attempts where id=$1)`, [Ax]);
      await setup.query("update action_execution_attempts set action_kind='publish-instagram-media' where id=$1", [Ax]);
      await mustPropose(proposeYT(x));
    }

    /* ══ Y10 · NEW REVISION with identical content is NOT blocked (V1 policy) ══ */
    {
      const n = await seedDraft(acme, "youtube");
      await publishYT(n, accept("vid_N1"));
      await setup.query(
        `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,2,$3,$4,'human',$5)`, [acme.tenantId, n.artifact, n.copy, sha(n.copy), acme.userId]);
      await setup.query("update work_artifacts set current_revision=2 where id=$1", [n.artifact]);
      const n2 = { ...n, revisionNo: 2, draftRef: formatWorkArtifactRef(n.artifact, 2) };
      const r = await mustPropose(proposeYT(n2));
      const pr = (await payloadOf(r)).canonical_payload;
      assert.equal(pr.draftRef, n2.draftRef, "the new revision is the target");
      assert.equal(pr.draftRevisionDigest, sha(n.copy), "with the SAME content fingerprint as the accepted revision 1 — allowed in V1");
      assert.equal(pr.videoAssetRef, n.assetId, "and the same video");
    }

    /* ══ Y11 · TENANT ISOLATION ══ */
    {
      const g = await seedDraft(globex, "youtube");
      const G1 = await publishYT(g, accept("vid_G1"));
      /* Globex's attempt id is no acknowledgement for Acme */
      assert.equal((await refusalOf(proposeYT(a, { ack: G1 }))).reason, "prior-publication-acknowledgement-mismatch");
      /* Globex history planted on an Acme revision (same kind, same channel id) is invisible to Acme */
      const clean = await seedDraft(acme, "youtube");
      await setup.query(
        `update heby_action_requests set target_ref=$2 where id = (select action_request_id from action_execution_attempts where id=$1)`,
        [G1, clean.draftRef]);
      await mustPropose(proposeYT(clean));
    }

    /* ══ C · REAL CONCURRENT TRANSACTIONS: at most one send per identity crosses the boundary ══ */
    {
      const c = await seedDraft(acme, "youtube");
      const base = { ...(await payloadOf(r1)).canonical_payload };
      delete base.acknowledgesPriorAttemptId;
      const argsFor = (privacy: string) => ({
        ...base, draftRef: c.draftRef, draftRevisionDigest: sha(c.copy), videoAssetRef: c.assetId,
        videoAssetDigest: (base.videoAssetDigest as string), privacyStatus: privacy, description: c.copy,
      });
      /* bind the real video digest */
      const vd = (await setup.query<{ byte_digest: string }>("select byte_digest from media_assets where id=$1", [c.assetId])).rows[0]!.byte_digest;
      const ra = await directRequest(acmeCtx, "publish-youtube-video", c.draftRef, { ...argsFor("private"), videoAssetDigest: vd });
      const rb = await directRequest(acmeCtx, "publish-youtube-video", c.draftRef, { ...argsFor("unlisted"), videoAssetDigest: vd });
      const [pa, pb] = [await approve(ra), await approve(rb)];
      const second = createControlPlaneDb(harness.dbUrl);
      try {
        const up = uploads;
        const hold = { afterPublicationGuardRead: () => sleep(600) };
        const [ea, eb] = await Promise.all([
          executeYT(c, pa, accept("vid_Ca"), hold, handle.db),
          executeYT(c, pb, accept("vid_Cb"), hold, second.db),
        ]);
        const results = [ea, eb];
        const attempted = results.filter((r) => r.status === "attempted");
        const refusedR = results.filter((r) => r.status === "refused");
        assert.equal(attempted.length, 1, `exactly one crosses the boundary: ${JSON.stringify(results)}`);
        assert.equal(refusedR.length, 1);
        assert.ok(
          ["publication-in-flight", "prior-publication-unacknowledged"].includes((refusedR[0] as { reason: string }).reason),
          JSON.stringify(refusedR[0]),
        );
        assert.equal(uploads - up, 1, "ONE upload session was opened");
        const loserPermit = ea.status === "refused" ? pa : pb;
        assert.equal(await permitStatus(loserPermit), "active", "the loser spent nothing");
        const rows = (await setup.query<{ n: number }>(
          `select count(*)::int n from action_execution_attempts t join heby_action_requests q on q.id=t.action_request_id where q.target_ref=$1`, [c.draftRef])).rows[0]!.n;
        assert.equal(rows, 1, "one attempt row for the identity");

        /* different revisions (and a different tenant) under the same hold do NOT block each other */
        const d1 = await seedDraft(acme, "youtube");
        const d2 = await seedDraft(globex, "youtube");
        const q1 = await approve(await mustPropose(proposeYT(d1)));
        const q2 = await approve(await mustPropose(proposeYT(d2)), globexCtx);
        const [x1, x2] = await Promise.all([
          executeYT(d1, q1, accept("vid_D1"), hold, handle.db),
          executeYT(d2, q2, accept("vid_D2"), hold, second.db),
        ]);
        assert.deepEqual([x1.status, x2.status], ["attempted", "attempted"], `independent identities both proceed: ${JSON.stringify([x1, x2])}`);
      } finally {
        await second.dispose();
      }
    }

    /* ══ I · INSTAGRAM: same policy at proposal and at execution ══ */
    {
      const igCalls: string[] = [];
      const igPorts = (mediaId: string): InstagramPublishExecutionPorts => ({
        resolveCapability: async () => ({ status: "available", integrationId: acmeIgIntegration, publishingAccountId: IG_ID }),
        resolveStorage,
        withToken: async (_t, _id, run) => run(SECRET),
        publish: async () => {
          igCalls.push(mediaId);
          return { class: "accepted", mediaId, containerId: "c1" };
        },
      });
      const igExec = (permitId: string, mediaId: string) =>
        executeAuthorizedAction(acmeCtx, { permitId }, {
          ...baseDeps,
          readTenant: (async () => ({ status: "read", effective: { state: "active" } })) as never,
          rootEnabled: async () => true,
          instagramPublish: igPorts(mediaId),
        });
      const ig = await seedDraft(acme, "instagram");
      const proposeIG = (ack?: string) =>
        proposeInstagramPublish(acmeCtx, { draftRef: ig.draftRef, mediaAssetId: ig.assetId, ...(ack ? { acknowledgesPriorAttemptId: ack } : {}) }, baseDeps);
      const i1 = await mustPropose(proposeIG());
      const e1 = await igExec(await approve(i1), "1801");
      assert.equal(e1.status, "attempted", JSON.stringify(e1));
      const I1 = (e1 as { attempt: { attemptId: string } }).attempt.attemptId;
      assert.equal((await payloadOf(i1)).canonical_payload.externalAccountId, IG_APP_ID, "the IG identity account is the bound app-scoped id");
      assert.deepEqual(await refusalOf(proposeIG()), { reason: "prior-publication-unacknowledged", detail: `latest-attempt=${I1}` });
      /* a bypassing request is refused at execution, before Meta */
      const bypass = await directRequest(acmeCtx, "publish-instagram-media", ig.draftRef, { ...(await payloadOf(i1)).canonical_payload });
      /* same digest as i1 is allowed as a NEW request once i1 is not pending — the exact case this phase closes */
      const bp = await approve(bypass);
      const before = igCalls.length;
      assert.deepEqual(await igExec(bp, "never"), { status: "refused", reason: "prior-publication-unacknowledged" });
      assert.equal(igCalls.length, before, "Meta was never asked");
      assert.equal(await permitStatus(bp), "active");
      await revoke(bp);
      const i2 = await mustPropose(proposeIG(I1));
      const e2 = await igExec(await approve(i2), "1802");
      assert.equal(e2.status, "attempted", "an acknowledged republish executes");
      /* the YouTube history of other drafts never blocked this Instagram identity, and vice versa */
    }

    console.log("PASS content-publication-duplicate-guard-1 guard (postgres, real ledger rows, real concurrency, provider seams faked)");
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
