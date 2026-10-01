/*
 * tests/youtube-write-2/execution-postgres.ts — the governed YouTube upload on a disposable
 * PostgreSQL (migration 68 applied), end to end, with EVERY provider seam faked (labelled below).
 * No Google call, no real media store, no credential is opened.
 *
 *   proposal binds every consequential fact · proposal ≠ authorization ≠ execution ·
 *   capability/arming/root are pre-spend prerequisites · channel re-verified before spend AND with
 *   the uploading token · package re-read after spend · bytes verified against the authorized
 *   digest · accepted records the real video id · rejected/unreachable are failed · ambiguous is
 *   unknown · substitution after authorization refused · replay refused · wrong tenant refused ·
 *   no secret in the ledger · migration 68's recipient CHECK
 *
 * FAKES: the media store (in memory, real bytes), the Content Package read, the channel list,
 * the token spend, and `fetch` behind the REAL resumable transport.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeAuthorizedAction, type YouTubePublishExecutionPorts } from "../../src/features/action-execution/execute-authorized-action.server";
import { proposeYouTubePublish } from "../../src/features/heby-action-inlet/youtube-publish-proposal.server";
import { verifyYouTubePackageBinding } from "../../src/features/youtube-publishing/resolve-youtube-publish.server";
import { readYouTubeUploadedVideo } from "../../src/features/youtube-publishing/read-youtube-upload.server";
import { openYouTubeUploadSession, sendYouTubeUploadBytes } from "../../src/features/provider-google/google-transport.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Uploading this video is a deliberate organizational act and I accept responsibility.";
const SECRET = "FAKE-YT-TOKEN-never-real-must-not-persist";
const SUB = "117622225072141590877";
const CHANNEL = { channelId: "UC5Yf5U_YOKR0K38tWF82kjA", title: "Turkish Rug House" };
const OTHER_CHANNEL = { channelId: "UCqTzRYJBwFsITzxFuqx6YQw", title: "Hebun Tech" };
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=test";
const IDENTITY = ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"];
const READONLY = "https://www.googleapis.com/auth/youtube.readonly";
const UPLOAD = "https://www.googleapis.com/auth/youtube.upload";
const sha = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

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
    provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "ytw2-request",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_youtube_write2_execution");
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
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-yt2", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-yt2", email: "d@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "c1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "c2"));
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

    /* FIXTURE: connected google-youtube connections (the connection writer is not under test). */
    const connect = async (tenantId: string, userId: string, scopes: string[]) =>
      (await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, external_account_label, created_by, created_by_type)
         values ($1,'google-youtube','YouTube','connected','connected','healthy',$2::jsonb,$3,'owner@example.test',$4,'human') returning id`,
        [tenantId, JSON.stringify(scopes), SUB, userId],
      )).rows[0]!.id;
    const acmeIntegration = await connect(acme.tenantId, acme.userId, [...IDENTITY, READONLY, UPLOAD]);
    await connect(globex.tenantId, globex.userId, [...IDENTITY, READONLY]);

    const agent = (await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type) values ($1,'Heby','active',$2,'human') returning id`,
      [acme.tenantId, acme.userId],
    )).rows[0]!.id;

    /* FIXTURE: a YouTube content draft and an admitted video with REAL bytes in the store. */
    const seedContent = async (opts: { destination?: string; title?: string } = {}) => {
      const copy = `A kilim, woven slowly. ${randomUUID()}`;
      const title = opts.title ?? "Black Rose Kilim";
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace, current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft',$2,'draft','operations',1,$3,$4,'human') returning id`,
        [acme.tenantId, title, opts.destination ?? "youtube", acme.userId],
      )).rows[0]!.id;
      await setup.query(
        `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
         values ($1,$2,1,$3,$4,'human',$5)`,
        [acme.tenantId, artifact, copy, sha(copy), acme.userId],
      );
      const inv = (await setup.query<{ id: string }>(
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id, source_artifact_id, source_revision_no,
            prompt_text, input_digest, transport, provider, model, state, admission_outcome, requested_at, finalized_at)
         values ($1,$2,'human',$3,$4,$5,1,'prompt',$6,'fake','fake','fake','provider-succeeded','admitted', now(), now()) returning id`,
        [acme.tenantId, randomUUID(), acme.userId, agent, artifact, sha(randomUUID())],
      )).rows[0]!.id;
      const assetId = randomUUID();
      const bytes = new Uint8Array(Array.from({ length: 4096 }, (_, i) => (i * 7 + assetId.charCodeAt(0)) % 256));
      const key = `tenants/${acme.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: "video/mp4", sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
           storage_backend, storage_key, admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate)
         values ($1,$2,$3,'video/mp4',$4,$5,1280,720,'test-memory',$6, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',5000,'h264','24/1')`,
        [assetId, acme.tenantId, inv, bytes.length, sha(bytes), key],
      );
      return { artifact, draftRef: formatWorkArtifactRef(artifact, 1), assetId, key, bytes, copy, title };
    };
    type Content = Awaited<ReturnType<typeof seedContent>>;

    /* FAKE: the Content Package read. `ready` and review state are the package's, never computed here. */
    let packageReady = true;
    const packageFor = (c: Content) => async () => ({
      status: "read" as const,
      package: {
        artifactId: c.artifact, revisionNo: 1, title: c.title, destination: "youtube", copy: c.copy, copyReviewState: "approved",
        selected: [{ mediaAssetId: c.assetId, mediaKind: "video", selectedAt: new Date().toISOString() }],
        mediaReviewStates: { [c.assetId]: "approved" }, blockers: packageReady ? [] : ["copy-unreviewed"], ready: packageReady,
      },
    }) as never;
    let currentPackage: (() => Promise<never>) | null = null;
    const readPackage = (async (...args: unknown[]) => currentPackage!(...(args as []))) as never;
    /* FAKE: the channel YouTube names for the connection. */
    let channels = [CHANNEL];
    const readChannel = async () =>
      channels.length === 1 ? ({ status: "one-channel", channel: channels[0]! } as const) : ({ status: "not-one-channel", count: channels.length, truncated: false } as const);
    const proposalDeps = { ...baseDeps, readPackage, readChannel };

    const propose = (c: Content, over: Partial<Parameters<typeof proposeYouTubePublish>[1] & object> = {}, ctx = acmeCtx) => {
      currentPackage = packageFor(c);
      return proposeYouTubePublish(
        ctx,
        { draftRef: c.draftRef, videoAssetId: c.assetId, privacyStatus: "private", categoryId: "22", madeForKids: "no", syntheticMedia: "yes", ...over },
        proposalDeps,
      );
    };
    const permitFor = async (c: Content) => {
      const proposed = await propose(c);
      assert.equal(proposed.status, "proposed", JSON.stringify(proposed));
      if (proposed.status !== "proposed") throw new Error("unreachable");
      const approved = await approveActionRequest(acmeCtx, { requestId: proposed.requestId, justification: JUSTIFICATION }, baseDeps);
      assert.equal(approved.status, "authorized", JSON.stringify(approved));
      if (approved.status !== "authorized") throw new Error("unreachable");
      return { requestId: proposed.requestId, permitId: approved.permitId };
    };

    /* FAKE fetch behind the REAL transport. Records every request; answers as the case requires. */
    const requests: Array<{ method: string; url: string; body: string | null; bytes: number }> = [];
    type Answer = (method: string, index: number) => Response | Promise<Response>;
    const accept = (id: string): Answer => (method) =>
      method === "POST"
        ? new Response(null, { status: 200, headers: { location: SESSION } })
        : new Response(JSON.stringify({ kind: "youtube#video", id, status: { uploadStatus: "uploaded", privacyStatus: "private" } }), { status: 201 });
    const fetchFor = (answer: Answer) => async (url: string, init?: RequestInit) => {
      const body = init?.body;
      requests.push({ method: init?.method ?? "GET", url, body: typeof body === "string" ? body : null, bytes: body instanceof Uint8Array ? body.byteLength : 0 });
      return answer(init?.method ?? "GET", requests.length);
    };
    let tokenChannels = [CHANNEL];
    const portsFor = (answer: Answer, over: Partial<YouTubePublishExecutionPorts> = {}): YouTubePublishExecutionPorts => ({
      verifyPackage: (t, p) => verifyYouTubePackageBinding(t, p, { readPackage }),
      readChannel,
      resolveStorage,
      withToken: (async (_t: unknown, _id: string, run: (token: string) => Promise<unknown>) => run(SECRET)) as never,
      listChannels: async () => ({ ok: true, channels: tokenChannels, truncated: false }),
      openSession: (input, token) => openYouTubeUploadSession(input, token, { fetchImpl: fetchFor(answer) }),
      sendBytes: (uri, input, token) => sendYouTubeUploadBytes(uri, input, token, { fetchImpl: fetchFor(answer), sleep: async () => {} }),
      ...over,
    });
    let tenantArmed = true;
    let rootOn = true;
    const execDeps = (ports: YouTubePublishExecutionPorts) => ({
      ...baseDeps,
      readTenant: (async () => (tenantArmed ? { status: "read", effective: { state: "active" } } : { status: "absent" })) as never,
      rootEnabled: async () => rootOn,
      youtubePublish: ports,
    });
    const permitStatus = async (id: string) => (await setup.query<{ status: string }>("select status from action_permits where id=$1", [id])).rows[0]!.status;
    const uploads = () => requests.filter((r) => r.method === "POST").length;

    /* ══ 1. PROPOSAL: every consequential fact read and bound; no permit ══ */
    const c1 = await seedContent();
    const p1 = await propose(c1);
    assert.equal(p1.status, "proposed", JSON.stringify(p1));
    if (p1.status !== "proposed") throw new Error("unreachable");
    const bound = (await setup.query<{ canonical_payload: Record<string, unknown> }>("select canonical_payload from heby_action_requests where id=$1", [p1.requestId])).rows[0]!.canonical_payload;
    assert.deepEqual(bound, {
      integrationId: acmeIntegration, externalAccountId: SUB, expectedChannelId: CHANNEL.channelId, channelTitle: CHANNEL.title,
      draftRef: c1.draftRef, draftRevisionDigest: sha(c1.copy), videoAssetRef: c1.assetId, videoAssetDigest: sha(c1.bytes),
      title: c1.title, description: c1.copy, privacyStatus: "private", categoryId: "22", selfDeclaredMadeForKids: false, containsSyntheticMedia: true,
    });
    assert.equal((await setup.query("select count(*)::int n from action_permits")).rows[0]!.n, 0, "a proposal mints no permit");

    const refusal = async (p: Promise<{ status: string; reason?: string }>) => {
      const r = await p;
      return r.status === "refused" ? r.reason : r.status;
    };
    assert.equal(await refusal(propose(await seedContent(), {}, globexCtx)), "publish-not-possible", "readonly-only connection cannot upload");
    assert.equal(await refusal(propose(await seedContent({ destination: "instagram" }))), "draft-not-youtube-content");
    assert.equal(await refusal(propose(await seedContent({ title: "T".repeat(101) }))), "metadata-invalid", "refused, not truncated");
    assert.equal(await refusal(propose(c1, { privacyStatus: "friends" })), "invalid-input");
    packageReady = false;
    assert.equal(await refusal(propose(await seedContent())), "package-not-ready", "the package's own readiness decides");
    packageReady = true;
    channels = [CHANNEL, OTHER_CHANNEL];
    assert.equal(await refusal(propose(await seedContent())), "channel-not-verified", "several channels is a refusal, never a choice");
    channels = [CHANNEL];

    /* ══ 2. PREREQUISITES are pre-spend ══ */
    const c2 = await seedContent();
    const q2 = await permitFor(c2);
    currentPackage = packageFor(c2);
    assert.deepEqual(await executeAuthorizedAction(acmeCtx, { permitId: randomUUID() }, execDeps(portsFor(accept("x")))), { status: "refused", reason: "permit-not-executable" });
    tenantArmed = false;
    assert.deepEqual(await executeAuthorizedAction(acmeCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("x")))), { status: "refused", reason: "tenant-not-armed" });
    tenantArmed = true;
    rootOn = false;
    assert.deepEqual(await executeAuthorizedAction(acmeCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("x")))), { status: "refused", reason: "execution-disabled" });
    rootOn = true;
    assert.deepEqual(
      await executeAuthorizedAction(acmeCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("x"), { resolveConnection: async () => ({ status: "unavailable", reason: "upload-not-granted" }) }))),
      { status: "refused", reason: "capability-unavailable" },
    );
    channels = [OTHER_CHANNEL];
    assert.deepEqual(
      await executeAuthorizedAction(acmeCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("x")))),
      { status: "refused", reason: "digest-mismatch" },
      "the account now names another channel: refused before spend",
    );
    channels = [CHANNEL];
    assert.deepEqual(await executeAuthorizedAction(globexCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("x")))), { status: "refused", reason: "permit-not-executable" }, "wrong tenant");
    assert.equal(await permitStatus(q2.permitId), "active", "no prerequisite refusal spends the permit");
    assert.equal(uploads(), 0);

    /* ══ 3. ACCEPTED: the real video id, recipient-less, exact metadata and bytes ══ */
    const done = await executeAuthorizedAction(acmeCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("vid_Accepted1"))));
    assert.equal(done.status, "attempted", JSON.stringify(done));
    if (done.status !== "attempted") throw new Error("unreachable");
    assert.equal(done.attempt.status, "accepted");
    assert.equal(done.attempt.providerMessageId, "vid_Accepted1");
    assert.equal(done.attempt.adapterId, "youtube-resumable-upload-v1");
    assert.equal(done.attempt.recipientId, null);
    const post = requests.find((r) => r.method === "POST")!;
    assert.deepEqual(JSON.parse(post.body!), {
      snippet: { title: c2.title, description: c2.copy, categoryId: "22" },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    });
    assert.equal(requests.find((r) => r.method === "PUT")!.bytes, c2.bytes.length, "the verified bytes, whole");
    assert.equal(await permitStatus(q2.permitId), "consumed");
    assert.deepEqual(await executeAuthorizedAction(acmeCtx, { permitId: q2.permitId }, execDeps(portsFor(accept("again")))), { status: "refused", reason: "permit-not-executable" }, "one permit, one upload");
    assert.equal(uploads(), 1);

    /* read-back: on demand, through the same connection, nothing stored.
     * YOUTUBE-OWNER-SIDE-MEASUREMENT-1: the projection now carries YouTube's publication instant, its
     * three counts exactly as reported (a withheld count stays null) and Hebun's own read instant. */
    const attemptsBeforeRead = (await setup.query("select count(*)::int n from action_execution_attempts")).rows[0]!.n;
    const observationsBeforeRead = (await setup.query("select count(*)::int n from provider_observations")).rows[0]!.n;
    const back = await readYouTubeUploadedVideo(acmeCtx, { permitId: q2.permitId }, {
      getDb: () => handle.db,
      withToken: (async (_t: unknown, _id: string, run: (token: string) => Promise<unknown>) => run(SECRET)) as never,
      readVideo: async (id) => ({ ok: true, found: true, videoId: id, channelId: CHANNEL.channelId, uploadStatus: "processed", failureReason: null, rejectionReason: null, privacyStatus: "private", processingStatus: "succeeded", publishedAt: "2026-09-28T15:38:20Z", viewCount: 12, likeCount: null, commentCount: 0 }),
      now: () => new Date("2026-10-01T09:00:00.000Z"),
    });
    assert.deepEqual(back, {
      status: "read", videoId: "vid_Accepted1", uploadStatus: "processed", processingStatus: "succeeded", failureReason: null,
      rejectionReason: null, privacyStatus: "private", authorizedPrivacy: "private", onAuthorizedChannel: true,
      publishedAt: "2026-09-28T15:38:20Z", viewCount: 12, likeCount: null, commentCount: 0, readAt: "2026-10-01T09:00:00.000Z",
    });
    assert.ok(back.status === "read" && back.readAt !== back.publishedAt, "the read instant is never the publication instant");
    assert.equal((await setup.query("select count(*)::int n from action_execution_attempts")).rows[0]!.n, attemptsBeforeRead, "a read-back records no attempt");
    assert.equal((await setup.query("select count(*)::int n from provider_observations")).rows[0]!.n, observationsBeforeRead, "and stores no observation");
    const offChannel = await readYouTubeUploadedVideo(acmeCtx, { permitId: q2.permitId }, {
      getDb: () => handle.db,
      withToken: (async (_t: unknown, _id: string, run: (token: string) => Promise<unknown>) => run(SECRET)) as never,
      readVideo: async (id) => ({ ok: true, found: true, videoId: id, channelId: "UC_someone_else", uploadStatus: "processed", failureReason: null, rejectionReason: null, privacyStatus: "private", processingStatus: "succeeded", publishedAt: null, viewCount: null, likeCount: null, commentCount: null }),
    });
    assert.ok(offChannel.status === "read" && offChannel.onAuthorizedChannel === false, "the expected-channel check is unchanged");
    assert.deepEqual(await readYouTubeUploadedVideo(globexCtx, { permitId: q2.permitId }, { getDb: () => handle.db }), { status: "no-video", reason: "no-such-upload" }, "another tenant reads nothing");

    /* ══ 4. AFTER SPEND: channel changed at the token, package changed, bytes tampered — nothing uploaded ══ */
    const c4 = await seedContent();
    const q4 = await permitFor(c4);
    currentPackage = packageFor(c4);
    tokenChannels = [OTHER_CHANNEL];
    const wrongChannel = await executeAuthorizedAction(acmeCtx, { permitId: q4.permitId }, execDeps(portsFor(accept("never"))));
    assert.equal(wrongChannel.status === "refused-after-spend" && wrongChannel.attempt.failureClass, "digest-mismatch", "the uploading token names another channel");
    tokenChannels = [CHANNEL];

    const c5 = await seedContent();
    const q5 = await permitFor(c5);
    currentPackage = packageFor(c5);
    let verifyCalls = 0;
    const changed = await executeAuthorizedAction(acmeCtx, { permitId: q5.permitId }, execDeps(portsFor(accept("never"), {
      verifyPackage: async (t, p) => (++verifyCalls === 1 ? verifyYouTubePackageBinding(t, p, { readPackage }) : { ok: false, failure: "package-not-ready" }),
    })));
    assert.equal(changed.status === "refused-after-spend" && changed.attempt.failureClass, "digest-mismatch", "the package stopped being ready after spend");

    const c6 = await seedContent();
    const q6 = await permitFor(c6);
    currentPackage = packageFor(c6);
    store.objects.get(c6.key)!.bytes[10] ^= 0xff;
    const tampered = await executeAuthorizedAction(acmeCtx, { permitId: q6.permitId }, execDeps(portsFor(accept("never"))));
    assert.equal(tampered.status === "refused-after-spend" && tampered.attempt.failureClass, "artifact-unresolvable", "bytes that no longer match are never sent");
    assert.equal(uploads(), 1, "none of these opened an upload session");

    /* ══ 5. SUBSTITUTION after authorization: title, privacy, video, channel ══ */
    for (const [field, value] of [
      ["title", "Another title"],
      ["privacyStatus", "public"],
      ["expectedChannelId", OTHER_CHANNEL.channelId],
    ] as const) {
      const c = await seedContent();
      const q = await permitFor(c);
      currentPackage = packageFor(c);
      await setup.query(
        "update heby_action_requests set canonical_payload = jsonb_set(canonical_payload, $2, to_jsonb($3::text)) where id=$1",
        [q.requestId, `{${field}}`, value],
      );
      const r = await executeAuthorizedAction(acmeCtx, { permitId: q.permitId }, execDeps(portsFor(accept("never"))));
      assert.equal(r.status, "refused", `${field} substituted: ${JSON.stringify(r)}`);
      assert.equal(await permitStatus(q.permitId), "active", `${field}: nothing spent`);
    }
    {
      const c = await seedContent();
      const other = await seedContent();
      const q = await permitFor(c);
      currentPackage = packageFor(c);
      await setup.query(
        "update heby_action_requests set canonical_payload = jsonb_set(jsonb_set(canonical_payload, '{videoAssetRef}', to_jsonb($2::text)), '{videoAssetDigest}', to_jsonb($3::text)) where id=$1",
        [q.requestId, other.assetId, sha(other.bytes)],
      );
      const r = await executeAuthorizedAction(acmeCtx, { permitId: q.permitId }, execDeps(portsFor(accept("never"))));
      assert.notEqual(r.status, "attempted", "another video cannot be substituted");
    }
    assert.equal(uploads(), 1);

    /* ══ 6. OUTCOMES: rejected / unreachable are failed; a lost answer is unknown ══ */
    const run = async (answer: Answer) => {
      const c = await seedContent();
      const q = await permitFor(c);
      currentPackage = packageFor(c);
      const r = await executeAuthorizedAction(acmeCtx, { permitId: q.permitId }, execDeps(portsFor(answer)));
      assert.equal(r.status, "attempted", JSON.stringify(r));
      return r.status === "attempted" ? r.attempt : null;
    };
    const rejected = await run((m) => (m === "POST" ? new Response(null, { status: 400 }) : new Response(null, { status: 500 })));
    assert.deepEqual([rejected!.status, rejected!.failureClass, rejected!.providerMessageId], ["failed", "provider-rejected", null]);
    const unreachable = await run((m) => (m === "POST" ? new Response(null, { status: 503 }) : new Response(null, { status: 500 })));
    assert.deepEqual([unreachable!.status, unreachable!.failureClass], ["failed", "provider-unreachable"]);
    const lost = await run((m) => (m === "POST" ? new Response(null, { status: 200, headers: { location: SESSION } }) : Promise.reject(new Error("reset"))));
    assert.deepEqual([lost!.status, lost!.providerMessageId, lost!.failureClass], ["unknown", null, null], "never failed: a retry could upload twice");

    /* ══ 7. NO SECRET anywhere durable ══ */
    const dump = JSON.stringify([
      (await setup.query("select * from action_execution_attempts")).rows,
      (await setup.query("select metadata from audit_log")).rows,
      (await setup.query("select canonical_payload from heby_action_requests")).rows,
    ]);
    assert.equal(dump.includes(SECRET), false, "the token is in no row");
    assert.equal(dump.includes("upload_id"), false, "the session URI is in no row");

    /* ══ 8. MIGRATION 68: recipient-less for this kind, recipient-bound for everything else ══ */
    const ytRow = (await setup.query("select * from action_execution_attempts where action_kind='publish-youtube-video' and status='accepted'")).rows[0]!;
    await assert.rejects(
      setup.query("update action_execution_attempts set recipient_id=$2, recipient_endpoint_digest=$3 where id=$1", [ytRow.id, randomUUID(), sha("x")]),
      (e: { constraint?: string }) => e.constraint === "action_execution_attempts_recipient_binding_chk" || e.constraint === "action_execution_attempts_tenant_recipient_fk",
    );
    await assert.rejects(
      setup.query("update action_execution_attempts set action_kind='some-future-kind' where id=$1", [ytRow.id]),
      (e: { constraint?: string }) => e.constraint === "action_execution_attempts_recipient_binding_chk",
      "the allowlist stays closed",
    );

    console.log("PASS youtube-write-2 execution (postgres, all provider seams faked)");
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
