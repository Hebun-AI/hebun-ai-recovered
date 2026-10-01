/*
 * tests/youtube-recorded-measurement-1/measurement-postgres.ts — YOUTUBE-RECORDED-MEASUREMENT-1,
 * against a real migrated database with REAL ledger rows written by the released writers (proposal,
 * decision, execution) and the REAL capability authority. Only the credential spend and YouTube's
 * answer are faked; the real network is unreachable.
 *
 * Proves: the identity reader resolves only an accepted YouTube publication of the session's own
 * tenant · a matching fresh read stores exactly one append-only human-provenance observation · a
 * later click with identical counts stores another · 0 stays 0 and a missing count stays null ·
 * wrong channel, not found, no channel, an unreadable provider, an unavailable capability and a
 * foreign permit store NOTHING · the existing read-back stores nothing · existing observation
 * readers do not see the new rows · the ledger, the audit log and the credentials are untouched.
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
import { openYouTubeUploadSession, sendYouTubeUploadBytes, type YouTubeVideoReadResult } from "../../src/features/provider-google/google-transport.server";
import { GOOGLE_YOUTUBE_PROVIDER_KEY, GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY } from "../../src/features/provider-google/contracts";
import { readYouTubeVideoMetrics } from "../../src/features/provider-google/read-youtube-video-metrics.server";
import { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, YOUTUBE_PROVIDER_KEY } from "../../src/features/provider-youtube/contracts";
import { INSTAGRAM_PROVIDER_KEY } from "../../src/features/provider-instagram/contracts";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import { readYouTubePublicationIdentity } from "../../src/features/action-authorization/content-publication-state.server";
import { readProviderObservations } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { recordYouTubePublicationMeasurement } from "../../src/features/youtube-recorded-measurement/record-youtube-publication-measurement.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Uploading this video is a deliberate organizational act and I accept responsibility.";
const SECRET = "FAKE-YTRM1-TOKEN-never-real";
const SUB = "117622225072141590877";
const CHANNEL = { channelId: "UC5Yf5U_YOKR0K38tWF82kjA", title: "Turkish Rug House" };
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=test";
const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
];
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
    provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "ytrm1-request",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ytrm1_measurement");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  const baseDeps = { getDb: () => handle.db, resolveStorage };
  const readDeps = { getDb: () => handle.db };

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ytrm1", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ytrm1", email: "d@globex.test" })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "c1"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "c2"));
    const integrations = new Map<string, string>();
    for (const [s, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status, "established");
      const integration = await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, external_account_label, created_by, created_by_type)
         values ($1,'google-youtube','YouTube','connected','connected','healthy',$2::jsonb,$3,'owner@example.test',$4,'human')
         returning id`,
        [s.tenantId, JSON.stringify(SCOPES), SUB, s.userId],
      );
      integrations.set(s.tenantId, integration.rows[0]!.id);
    }

    const agentFor = async (s: Seeded) =>
      (await setup.query<{ id: string }>(
        `insert into agents (tenant_id, name, agent_lifecycle_status, created_by, created_by_type) values ($1,'Heby','active',$2,'human') returning id`,
        [s.tenantId, s.userId],
      )).rows[0]!.id;
    const agents = new Map([[acme.tenantId, await agentFor(acme)], [globex.tenantId, await agentFor(globex)]]);

    /* FIXTURE: a YouTube content draft with an admitted video whose bytes sit in the memory store. */
    const seedContent = async (s: Seeded) => {
      const copy = `A kilim, woven slowly. ${randomUUID()}`;
      const title = "Black Rose Kilim";
      const artifact = (await setup.query<{ id: string }>(
        `insert into work_artifacts
           (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace, current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft',$2,'draft','operations',1,'youtube',$3,'human') returning id`,
        [s.tenantId, title, s.userId],
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
      const bytes = new Uint8Array(Array.from({ length: 2048 }, (_, i) => (i * 11 + assetId.charCodeAt(0)) % 256));
      const key = `tenants/${s.tenantId}/media/${assetId}`;
      await store.put({ key, bytes, contentType: "video/mp4", sha256Hex: sha(bytes) });
      await setup.query(
        `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
           storage_backend, storage_key, admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate)
         values ($1,$2,$3,'video/mp4',$4,$5,1280,720,'test-memory',$6, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',5000,'h264','24/1')`,
        [assetId, s.tenantId, inv, bytes.length, sha(bytes), key],
      );
      return { artifact, draftRef: formatWorkArtifactRef(artifact, 1), assetId, copy, title };
    };
    type Content = Awaited<ReturnType<typeof seedContent>>;

    /* FAKE Content Package read (ready, video selected and approved) and channel read. */
    let current: Content | null = null;
    const readPackage = (async () => ({
      status: "read",
      package: {
        artifactId: current!.artifact, revisionNo: 1, title: current!.title, destination: "youtube", copy: current!.copy, copyReviewState: "approved",
        selected: [{ mediaAssetId: current!.assetId, mediaKind: "video", selectedAt: new Date().toISOString() }],
        mediaReviewStates: { [current!.assetId]: "approved" }, blockers: [], ready: true,
      },
    })) as never;
    const readChannel = async () => ({ status: "one-channel", channel: CHANNEL }) as const;

    const propose = async (c: Content, ctx: TenantContext = acmeCtx, privacy: "private" | "unlisted" = "private", ack?: string) => {
      current = c;
      const r = await proposeYouTubePublish(
        ctx,
        {
          draftRef: c.draftRef, videoAssetId: c.assetId, privacyStatus: privacy, categoryId: "22", madeForKids: "no", syntheticMedia: "yes",
          /* DUPLICATE-GUARD-1: an intentional republish names the attempt it follows. */
          ...(ack ? { acknowledgesPriorAttemptId: ack } : {}),
        },
        { ...baseDeps, readPackage, readChannel },
      );
      assert.equal(r.status, "proposed", JSON.stringify(r));
      if (r.status !== "proposed") throw new Error("unreachable");
      return r.requestId;
    };
    const approve = async (requestId: string, ctx: TenantContext = acmeCtx) => {
      const r = await approveActionRequest(ctx, { requestId, justification: JUSTIFICATION }, baseDeps);
      assert.equal(r.status, "authorized", JSON.stringify(r));
      if (r.status !== "authorized") throw new Error("unreachable");
      return r.permitId;
    };

    type Answer = (method: string) => Response | Promise<Response>;
    const accept = (id: string): Answer => (method) =>
      method === "POST"
        ? new Response(null, { status: 200, headers: { location: SESSION } })
        : new Response(JSON.stringify({ kind: "youtube#video", id, status: { uploadStatus: "uploaded", privacyStatus: "private" } }), { status: 201 });
    const fetchFor = (answer: Answer) => async (_url: string, init?: RequestInit) => answer(init?.method ?? "GET");
    const ports = (answer: Answer): YouTubePublishExecutionPorts => ({
      verifyPackage: (t, p) => verifyYouTubePackageBinding(t, p, { readPackage }),
      readChannel,
      resolveStorage,
      withToken: (async (_t: unknown, _id: string, run: (token: string) => Promise<unknown>) => run(SECRET)) as never,
      listChannels: async () => ({ ok: true, channels: [CHANNEL], truncated: false }),
      openSession: (input, token) => openYouTubeUploadSession(input, token, { fetchImpl: fetchFor(answer) }),
      sendBytes: (uri, input, token) => sendYouTubeUploadBytes(uri, input, token, { fetchImpl: fetchFor(answer), sleep: async () => {} }),
    });
    const execute = async (c: Content, permitId: string, answer: Answer, ctx: TenantContext = acmeCtx) => {
      current = c;
      const r = await executeAuthorizedAction(ctx, { permitId }, {
        ...baseDeps,
        readTenant: (async () => ({ status: "read", effective: { state: "active" } })) as never,
        rootEnabled: async () => true,
        youtubePublish: ports(answer),
      });
      assert.equal(r.status, "attempted", JSON.stringify(r));
    };
    const ledgerCounts = async () =>
      (await setup.query(
        `select (select count(*) from heby_action_requests)::int requests, (select count(*) from action_permits)::int permits,
                (select count(*) from action_execution_attempts)::int attempts, (select count(*) from decision_records)::int decisions,
                (select count(*) from audit_log)::int audits,
                (select count(*) from integration_credentials)::int credentials`,
      )).rows[0];

    /* ── fixtures: one accepted upload, one approved-only, one failed, one lost, one re-kinded ── */
    const acceptedC = await seedContent(acme);
    const acceptedPermit = await approve(await propose(acceptedC));
    await execute(acceptedC, acceptedPermit, accept("vid_Recorded1"));

    const approvedOnlyPermit = await approve(await propose(await seedContent(acme)));

    const failedC = await seedContent(acme);
    const failedPermit = await approve(await propose(failedC));
    await execute(failedC, failedPermit, (m) => (m === "POST" ? new Response(null, { status: 400 }) : new Response(null, { status: 500 })));

    const lostC = await seedContent(acme);
    const lostPermit = await approve(await propose(lostC));
    await execute(lostC, lostPermit, (m) => (m === "POST" ? new Response(null, { status: 200, headers: { location: SESSION } }) : Promise.reject(new Error("reset"))));

    const rekindedC = await seedContent(acme);
    const rekindedRequest = await propose(rekindedC);
    const rekindedPermit = await approve(rekindedRequest);
    await execute(rekindedC, rekindedPermit, accept("vid_Rekinded1"));

    const acmeIntegration = integrations.get(acme.tenantId)!;
    const observationRows = async () =>
      (await setup.query("select * from provider_observations order by observed_at asc")).rows as Record<string, unknown>[];
    const before = await ledgerCounts();

    /* ══ 1. THE IDENTITY READER: one accepted YouTube publication of THIS tenant, or nothing ══ */
    assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId: acceptedPermit }, readDeps), {
      status: "resolved",
      videoId: "vid_Recorded1",
      expectedChannelId: CHANNEL.channelId,
      integrationId: acmeIntegration,
    });
    const noSuch = { status: "not-resolved", reason: "no-such-publication" };
    assert.deepEqual(await readYouTubePublicationIdentity(globexCtx, { permitId: acceptedPermit }, readDeps), noSuch, "another tenant's permit is not found, never refused differently");
    assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId: randomUUID() }, readDeps), noSuch);
    assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId: "' or 1=1 --" }, readDeps), noSuch, "a malformed id never reaches a uuid column");
    for (const permitId of [approvedOnlyPermit, failedPermit, lostPermit]) {
      assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId }, readDeps), { status: "not-resolved", reason: "not-accepted" }, "no accepted attempt with a provider id → not accepted");
    }
    /*
     * "Accepted" and "has a provider id" are ONE fact in the ledger: the database refuses a row that
     * carries an id without being accepted, so the reader's two conditions cannot disagree.
     */
    await assert.rejects(
      setup.query("update action_execution_attempts set status='unknown' where permit_id=$1", [acceptedPermit]),
      "the ledger itself refuses a provider id on a non-accepted attempt",
    );
    await setup.query("update heby_action_requests set action_kind='publish-instagram-media' where id=$1", [rekindedRequest]);
    assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId: rekindedPermit }, readDeps), noSuch, "an accepted permit of another action kind is not a YouTube publication");
    await setup.query("update heby_action_requests set action_kind='record-work' where id=$1", [rekindedRequest]);
    assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId: rekindedPermit }, readDeps), noSuch);
    await setup.query("update heby_action_requests set action_kind='publish-youtube-video' where id=$1", [rekindedRequest]);
    assert.deepEqual(await readYouTubePublicationIdentity(null, { permitId: acceptedPermit }, readDeps), { status: "unknown", reason: "no-authorized-tenant-context" });
    assert.deepEqual(await readYouTubePublicationIdentity(acmeCtx, { permitId: acceptedPermit }, { getDb: () => null }), { status: "unknown", reason: "persistence-not-configured" });
    assert.deepEqual(await ledgerCounts(), before, "resolving identity writes nothing");

    /* ── the provider fake: YouTube's answer and Hebun's clock, both scripted ── */
    let videoAnswer: YouTubeVideoReadResult = { ok: false, failure: "transport", reason: "unset" };
    let clock = "2026-10-01T10:00:00.000Z";
    let providerReads = 0;
    const askedFor: string[] = [];
    const spentConnections: string[] = [];
    const found = (over: Partial<Extract<YouTubeVideoReadResult, { found: true }>> = {}): YouTubeVideoReadResult => ({
      ok: true, found: true, videoId: "vid_Recorded1", channelId: CHANNEL.channelId, uploadStatus: "processed", failureReason: null,
      rejectionReason: null, privacyStatus: "private", processingStatus: "succeeded", publishedAt: "2026-09-28T15:38:19Z",
      viewCount: 0, likeCount: null, commentCount: 3, ...over,
    });
    const observation = {
      getDb: () => handle.db,
      now: () => new Date(clock),
      withToken: (async (_t: unknown, integrationId: string, run: (token: string) => Promise<unknown>) => {
        spentConnections.push(integrationId);
        return run(SECRET);
      }) as never,
      readVideo: (async (videoId: string) => {
        providerReads += 1;
        askedFor.push(videoId);
        return videoAnswer;
      }) as never,
    };
    const record = (permitId: string, ctx: TenantContext | null = acmeCtx) =>
      recordYouTubePublicationMeasurement(ctx, { permitId }, { identity: readDeps, observation });

    /* ══ 2. A MATCHING FRESH READ → EXACTLY ONE APPEND-ONLY OBSERVATION ══ */
    videoAnswer = found();
    const first = await record(acceptedPermit);
    assert.equal(first.status, "recorded", JSON.stringify(first));
    if (first.status !== "recorded") throw new Error("unreachable");
    assert.deepEqual(
      [first.videoId, first.publishedAt, first.viewCount, first.likeCount, first.commentCount, first.observedAt],
      ["vid_Recorded1", "2026-09-28T15:38:19Z", 0, null, 3, clock],
    );
    assert.deepEqual(askedFor, ["vid_Recorded1"], "the video asked about is the ledger's, not a caller's");
    assert.deepEqual(spentConnections, [acmeIntegration], "the connection spent is the one the capability authority confirmed");
    {
      const rows = await observationRows();
      assert.equal(rows.length, 1);
      const row = rows[0]!;
      assert.equal(row.id, first.observationId);
      assert.deepEqual(
        [row.tenant_id, row.provider_key, row.capability_key, row.subject_kind, row.subject_ref, row.integration_id],
        [acme.tenantId, GOOGLE_YOUTUBE_PROVIDER_KEY, GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY, "youtube-channel", `youtube/channel/${CHANNEL.channelId}`, acmeIntegration],
      );
      assert.equal((row.observed_at as Date).toISOString(), clock, "observed_at is the fresh read instant");
      /* HUMAN PROVENANCE, read off the context; the standing pair is NULL. */
      assert.deepEqual(
        [row.observed_by_actor_type, row.observed_by_actor_id, row.standing_authorization_id, row.invocation_id],
        ["human", acme.userId, null, null],
      );
      /* CLOSED AND MINIMAL. 0 stays 0; a count YouTube did not report stays null. */
      assert.deepEqual(row.facts, {
        channelId: CHANNEL.channelId,
        videos: [{ videoId: "vid_Recorded1", publishedAt: "2026-09-28T15:38:19Z", viewCount: 0, likeCount: null, commentCount: 3 }],
      });
      const stored = JSON.stringify(row);
      for (const absent of [acceptedPermit, SECRET, "expectedChannelId", "permitId"]) {
        assert.equal(stored.includes(absent), false, `the row must not carry ${absent}`);
      }
    }

    /* ══ 3. THE SAME COUNTS, LATER → ANOTHER OBSERVATION. Never deduplicated on values. ══ */
    clock = "2026-10-01T11:00:00.000Z";
    const second = await record(acceptedPermit);
    assert.equal(second.status, "recorded", JSON.stringify(second));
    {
      const rows = await observationRows();
      assert.equal(rows.length, 2, "a later explicit click is a new observation");
      assert.equal(rows[0]!.facts_digest, rows[1]!.facts_digest, "identical facts");
      assert.notEqual((rows[0]!.observed_at as Date).toISOString(), (rows[1]!.observed_at as Date).toISOString());
      assert.equal((rows[1]!.observed_at as Date).toISOString(), clock);
    }
    /* The SAME instant again is the idempotency contract answering: nothing new, and it says so. */
    assert.deepEqual(await record(acceptedPermit), { status: "not-recorded", reason: "write-failed" });
    assert.equal((await observationRows()).length, 2);

    /* ══ 4. EVERYTHING ELSE STORES NOTHING ══ */
    clock = "2026-10-01T12:00:00.000Z";
    const refusals: [string, YouTubeVideoReadResult, string][] = [
      ["wrong channel", found({ channelId: "UCsomeOtherChannel0000000" }), "channel-mismatch"],
      ["no channel reported", found({ channelId: null }), "channel-not-reported"],
      ["a channel id the subject format cannot express", found({ channelId: "bad/channel id" }), "channel-not-reported"],
      ["not found at YouTube", { ok: true, found: false }, "not-found-at-youtube"],
      ["YouTube unreachable", { ok: false, failure: "transport", reason: "youtube-unreachable" }, "youtube-unreadable"],
      ["YouTube refused the credential", { ok: false, failure: "auth", reason: "youtube-rejected-credential" }, "youtube-unreadable"],
    ];
    for (const [label, answer, reason] of refusals) {
      videoAnswer = answer;
      assert.deepEqual(await record(acceptedPermit), { status: "not-recorded", reason }, label);
      assert.equal((await observationRows()).length, 2, `${label}: zero new observation rows`);
    }
    videoAnswer = found();

    /* Identity failures never reach the provider at all. */
    const readsBefore = providerReads;
    assert.deepEqual(await record(approvedOnlyPermit), { status: "not-recorded", reason: "not-accepted" });
    assert.deepEqual(await record(randomUUID()), { status: "not-recorded", reason: "no-such-upload" });
    assert.deepEqual(await record(acceptedPermit, globexCtx), { status: "not-recorded", reason: "no-such-upload" }, "another tenant cannot record against this permit");
    assert.deepEqual(await record(acceptedPermit, null), { status: "not-recorded", reason: "unauthenticated" });
    assert.equal(providerReads, readsBefore, "no provider read without a resolved identity");

    /* ══ 5. THE CAPABILITY AUTHORITY DECIDES, FOR THE EXACT CONNECTION, BEFORE ANY CREDENTIAL ══ */
    await setup.query("update integrations set scopes=$2::jsonb where id=$1", [acmeIntegration, JSON.stringify(SCOPES.filter((s) => !s.endsWith("youtube.readonly")))]);
    {
      const r = await record(acceptedPermit);
      assert.equal(r.status, "not-recorded");
      assert.ok(r.status === "not-recorded" && (r.reason === "capability-not-available" || r.reason === "connection-not-available"), JSON.stringify(r));
    }
    /* The same, with the capability still answerable elsewhere: an unhealthy connection is not read. */
    await setup.query("update integrations set scopes=$2::jsonb where id=$1", [acmeIntegration, JSON.stringify(SCOPES)]);
    {
      const r = await readYouTubeVideoMetrics(acmeCtx, { videoId: "vid_Recorded1", integrationId: acmeIntegration }, {
        ...observation,
        getAvailability: (async () => ({
          readiness: "catalog-ready",
          capabilities: [{
            capability: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY, state: "available", reason: "",
            sources: [
              { integrationId: acmeIntegration, providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, readAvailable: false, writeCapable: false },
              { integrationId: randomUUID(), providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, readAvailable: true, writeCapable: false },
            ],
          }],
        })) as never,
      });
      assert.deepEqual(r, { status: "refused", reason: "connection-not-available" }, "the named connection must itself be readable");
    }
    await setup.query("update integrations set scopes=$2::jsonb where id=$1", [acmeIntegration, JSON.stringify(SCOPES)]);
    /* A DIFFERENT available connection does not substitute for the one the publication bound. */
    {
      const other = randomUUID();
      const r = await readYouTubeVideoMetrics(acmeCtx, { videoId: "vid_Recorded1", integrationId: acmeIntegration }, {
        ...observation,
        getAvailability: (async () => ({
          readiness: "catalog-ready",
          capabilities: [{
            capability: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY, state: "available", reason: "",
            sources: [{ integrationId: other, providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, readAvailable: true, writeCapable: false }],
          }],
        })) as never,
      });
      assert.deepEqual(r, { status: "refused", reason: "connection-not-available" });
      /* …and neither does the right connection on the wrong provider. */
      const wrongProvider = await readYouTubeVideoMetrics(acmeCtx, { videoId: "vid_Recorded1", integrationId: acmeIntegration }, {
        ...observation,
        getAvailability: (async () => ({
          readiness: "catalog-ready",
          capabilities: [{
            capability: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY, state: "available", reason: "",
            sources: [{ integrationId: acmeIntegration, providerKey: "google-workspace", readAvailable: true, writeCapable: false }],
          }],
        })) as never,
      });
      assert.deepEqual(wrongProvider, { status: "refused", reason: "connection-not-available" });
    }
    assert.equal(providerReads, readsBefore, "a refused gate touches no credential and reads nothing");
    assert.equal((await observationRows()).length, 2);

    /* ══ 6. THE EXISTING READ-BACK STILL STORES NOTHING ══ */
    {
      const r = await readYouTubeUploadedVideo(acmeCtx, { permitId: acceptedPermit }, {
        getDb: () => handle.db,
        withToken: observation.withToken,
        readVideo: observation.readVideo,
        now: observation.now,
      });
      assert.equal(r.status, "read", JSON.stringify(r));
      assert.equal((await observationRows()).length, 2, "“Read YouTube status” writes no observation");
    }

    /* ══ 7. EXISTING OBSERVATION CONSUMERS DO NOT SEE THE NEW ROWS ══ */
    const readObs = async (ctx: TenantContext, query: object) => {
      const r = await readProviderObservations(ctx, query, { getDb: () => handle.db });
      assert.equal(r.status, "read");
      return r.status === "read" ? r.observations : [];
    };
    assert.equal((await readObs(acmeCtx, { providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY })).length, 0, "the public-channel reader's filter matches none of them");
    assert.equal((await readObs(acmeCtx, { providerKey: YOUTUBE_PROVIDER_KEY })).length, 0);
    assert.equal((await readObs(acmeCtx, { providerKey: INSTAGRAM_PROVIDER_KEY })).length, 0);
    {
      const mine = await readObs(acmeCtx, { providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY, capabilityKey: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY });
      assert.equal(mine.length, 2);
      for (const o of mine) {
        assert.deepEqual([o.provenance, o.observedByActorType, o.standingAuthorizationId, o.invocationId], ["human", "human", null, null]);
      }
    }
    assert.equal((await readObs(globexCtx, {})).length, 0, "tenant isolation on the read side");

    /* ══ 8. NOTHING ELSE MOVED ══ */
    assert.deepEqual(await ledgerCounts(), before, "no request, permit, attempt, decision, audit or credential row was written");
    assert.equal(
      (await setup.query("select count(*)::int n from standing_observation_authorizations")).rows[0].n,
      0,
      "no standing authorization exists or was created",
    );

    console.log("PASS youtube-recorded-measurement-1 measurement (postgres, real ledger + capability authority, provider faked)");
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
