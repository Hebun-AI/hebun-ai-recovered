/*
 * tests/content-publication-state-1/publication-postgres.ts — CONTENT-PUBLICATION-STATE-1, against a
 * real migrated database with REAL ledger rows written by the released writers (proposal, decision,
 * execution). Every provider seam is faked; the real network is unreachable.
 *
 * Proves: no request · pending · rejected · withdrawn · approved + active / expired permit · accepted
 * · failed · unknown · several requests on one revision (history, oldest first) · a non-publication
 * kind on the same revision is not publication · Instagram kind maps to Instagram · tenant isolation
 * · UNKNOWN (no tenant, no database, a failing read) is never "no request" · the read writes nothing.
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
import { approveActionRequest, rejectActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeAuthorizedAction, type YouTubePublishExecutionPorts } from "../../src/features/action-execution/execute-authorized-action.server";
import { proposeYouTubePublish } from "../../src/features/heby-action-inlet/youtube-publish-proposal.server";
import { verifyYouTubePackageBinding } from "../../src/features/youtube-publishing/resolve-youtube-publish.server";
import { openYouTubeUploadSession, sendYouTubeUploadBytes } from "../../src/features/provider-google/google-transport.server";
import { formatWorkArtifactRef } from "../../src/features/work-artifacts/artifact-ref";
import {
  readContentPublicationState,
  readContentPublicationStates,
} from "../../src/features/action-authorization/content-publication-state.server";
import type { ContentPublicationState } from "../../src/features/action-authorization/content-publication-state";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — every provider seam must be faked here");
}) as typeof fetch;

const JUSTIFICATION = "Uploading this video is a deliberate organizational act and I accept responsibility.";
const SECRET = "FAKE-CPS1-TOKEN-never-real";
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
    provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "cps1-request",
    authenticatedAt: new Date().toISOString(),
  });
}

const recorded = (s: ContentPublicationState) => {
  assert.equal(s.status, "recorded", JSON.stringify(s));
  if (s.status !== "recorded") throw new Error("unreachable");
  return s;
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cps1_publication");
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
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-cps1", email: "d@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-cps1", email: "d@globex.test" })) as Seeded;
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
      await setup.query(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, external_account_id, external_account_label, created_by, created_by_type)
         values ($1,'google-youtube','YouTube','connected','connected','healthy',$2::jsonb,$3,'owner@example.test',$4,'human')`,
        [s.tenantId, JSON.stringify(SCOPES), SUB, s.userId],
      );
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
    const stateOf = (c: Content, ctx: TenantContext | null = acmeCtx, deps: object = readDeps) =>
      readContentPublicationState(ctx, { artifactId: c.artifact, revisionNo: 1 }, deps);

    const ledgerCounts = async () =>
      (await setup.query(
        `select (select count(*) from heby_action_requests)::int requests, (select count(*) from action_permits)::int permits,
                (select count(*) from action_execution_attempts)::int attempts, (select count(*) from decision_records)::int decisions,
                (select count(*) from audit_log)::int audits`,
      )).rows[0];

    /* ══ 1. NO REQUEST: a successful read with nothing matching ══ */
    const none = await seedContent(acme);
    assert.deepEqual(await stateOf(none), { status: "no-request-recorded", artifactRef: none.draftRef });

    /* ══ 2. PENDING ══ */
    const pendingC = await seedContent(acme);
    const pendingId = await propose(pendingC);
    {
      const s = recorded(await stateOf(pendingC));
      assert.equal(s.entries.length, 1);
      assert.deepEqual(
        [s.entries[0]!.requestId, s.entries[0]!.actionKind, s.entries[0]!.destination, s.entries[0]!.requestStatus, s.entries[0]!.stage, s.entries[0]!.permit, s.entries[0]!.attempt],
        [pendingId, "publish-youtube-video", "youtube", "pending", "request-pending", null, null],
      );
      assert.equal(s.truncated, false);
    }

    /* ══ 3. REJECTED ══ */
    const rejectedC = await seedContent(acme);
    const rejectedId = await propose(rejectedC);
    const rej = await rejectActionRequest(acmeCtx, { requestId: rejectedId, justification: JUSTIFICATION, rejectionReason: "not this one" }, baseDeps);
    assert.equal(rej.status, "rejected", JSON.stringify(rej));
    {
      const e = recorded(await stateOf(rejectedC)).entries[0]!;
      assert.deepEqual([e.requestStatus, e.stage, e.permit], ["rejected", "request-rejected", null]);
      assert.ok(e.rejectedAt, "the decision time is carried");
    }

    /* ══ 4. APPROVED: permit active, then the same row read later is expired ══ */
    const approvedC = await seedContent(acme);
    await approve(await propose(approvedC));
    {
      const e = recorded(await stateOf(approvedC)).entries[0]!;
      assert.deepEqual([e.requestStatus, e.stage, e.permit?.state, e.attempt], ["approved", "permit-active", "active", null]);
      assert.ok(e.approvedAt);
      const later = recorded(await stateOf(approvedC, acmeCtx, { ...readDeps, now: () => new Date(Date.now() + 365 * 86400_000) })).entries[0]!;
      assert.deepEqual([later.stage, later.permit?.state], ["permit-expired", "expired"], "expiry is R3A's derived state, taken");
    }

    /* ══ 5. ACCEPTED, then the SAME revision proposed again: history, oldest first, nothing chosen ══ */
    const acceptedC = await seedContent(acme);
    const firstId = await propose(acceptedC);
    await execute(acceptedC, await approve(firstId), accept("vid_Accepted1"));
    {
      const e = recorded(await stateOf(acceptedC)).entries[0]!;
      assert.deepEqual(
        [e.stage, e.permit?.state, e.attempt?.status, e.attempt?.providerResultId, e.attempt?.providerResponseClass, e.attempt?.failureClass],
        ["execution-accepted", "consumed", "accepted", "vid_Accepted1", "accepted", null],
      );
    }
    const acceptedAttempt = recorded(await stateOf(acceptedC)).entries[0]!.attempt!.attemptId;
    const secondId = await propose(acceptedC, acmeCtx, "private", acceptedAttempt);
    {
      const s = recorded(await stateOf(acceptedC));
      assert.deepEqual(s.entries.map((x) => [x.requestId, x.stage]), [[firstId, "execution-accepted"], [secondId, "request-pending"]],
        "an executed revision re-proposed shows BOTH, oldest first; the projection does not block the second");
    }

    /* ══ 6. FAILED and UNKNOWN outcomes ══ */
    const failedC = await seedContent(acme);
    await execute(failedC, await approve(await propose(failedC)), (m) => (m === "POST" ? new Response(null, { status: 400 }) : new Response(null, { status: 500 })));
    {
      const e = recorded(await stateOf(failedC)).entries[0]!;
      assert.deepEqual([e.stage, e.attempt?.status, e.attempt?.failureClass, e.attempt?.providerResultId], ["execution-failed", "failed", "provider-rejected", null]);
    }
    const lostC = await seedContent(acme);
    await execute(lostC, await approve(await propose(lostC)), (m) => (m === "POST" ? new Response(null, { status: 200, headers: { location: SESSION } }) : Promise.reject(new Error("reset"))));
    {
      const e = recorded(await stateOf(lostC)).entries[0]!;
      assert.deepEqual([e.stage, e.attempt?.status], ["execution-unknown", "unknown"], "an unconfirmed send is unknown, never failed or accepted");
    }

    /* ══ 7. WITHDRAWN, an Instagram kind, and a non-publication kind on the same revision ══ */
    const mixedC = await seedContent(acme);
    const withdrawnId = await propose(mixedC, acmeCtx, "private");
    await setup.query("update heby_action_requests set status='withdrawn' where id=$1", [withdrawnId]);
    const igId = await propose(mixedC, acmeCtx, "unlisted");
    await setup.query("update heby_action_requests set action_kind='publish-instagram-media' where id=$1", [igId]);
    const otherId = await propose(mixedC, acmeCtx, "private");
    await setup.query("update heby_action_requests set action_kind='record-work' where id=$1", [otherId]);
    {
      const s = recorded(await stateOf(mixedC));
      assert.deepEqual(
        s.entries.map((x) => [x.requestId, x.destination, x.stage]),
        [[withdrawnId, "youtube", "request-withdrawn"], [igId, "instagram", "request-pending"]],
        "withdrawn is its own stage; the Instagram kind maps to Instagram; a record-work request is not publication",
      );
    }

    /* ══ 8. TENANT ISOLATION ══ */
    const globexC = await seedContent(globex);
    const globexReq = await propose(globexC, globexCtx);
    await execute(globexC, await approve(globexReq, globexCtx), accept("vid_Globex_SECRET"), globexCtx);
    assert.deepEqual(await stateOf(acceptedC, globexCtx), { status: "no-request-recorded", artifactRef: acceptedC.draftRef },
      "Globex asking about Acme's revision learns nothing about it");
    assert.deepEqual(await stateOf(globexC, acmeCtx), { status: "no-request-recorded", artifactRef: globexC.draftRef },
      "Acme asking about Globex's revision sees no Globex request, permit, attempt or provider id");
    {
      /* A cross-tenant id collision cannot join: Acme's target_ref pointed at Globex's revision stays Acme's. */
      const planted = await propose(await seedContent(acme));
      await setup.query("update heby_action_requests set target_ref=$2 where id=$1", [planted, globexC.draftRef]);
      const g = recorded(await stateOf(globexC, globexCtx));
      assert.deepEqual(g.entries.map((x) => x.requestId), [globexReq], "Globex sees only its own request on its own revision");
      assert.equal(g.entries[0]!.attempt?.providerResultId, "vid_Globex_SECRET");
      const a = recorded(await stateOf(globexC, acmeCtx));
      assert.deepEqual(a.entries.map((x) => x.requestId), [planted], "Acme sees only its own row, never Globex's attempt");
      assert.equal(JSON.stringify(a).includes("vid_Globex_SECRET"), false);
    }

    /* ══ 9. UNKNOWN is never "no request" ══ */
    assert.deepEqual(await stateOf(none, null), { status: "unknown", artifactRef: none.draftRef, reason: "no-authorized-tenant-context" });
    assert.deepEqual(await stateOf(none, acmeCtx, { getDb: () => null }), { status: "unknown", artifactRef: none.draftRef, reason: "persistence-not-configured" });
    const broken = createControlPlaneDb(harness.dbUrl);
    await broken.dispose();
    assert.deepEqual(await stateOf(none, acmeCtx, { getDb: () => broken.db }), { status: "unknown", artifactRef: none.draftRef, reason: "read-failed" });
    assert.deepEqual(
      await readContentPublicationState(acmeCtx, { artifactId: "not-a-uuid", revisionNo: 1 }, readDeps),
      { status: "unknown", artifactRef: null, reason: "invalid-reference" },
    );

    /* ══ 10. BATCH = the singles, and THE READ WRITES NOTHING ══ */
    const before = await ledgerCounts();
    const batch = await readContentPublicationStates(
      acmeCtx,
      [none, pendingC, acceptedC, mixedC].map((c) => ({ artifactId: c.artifact, revisionNo: 1 })),
      readDeps,
    );
    for (const c of [none, pendingC, acceptedC, mixedC]) {
      assert.deepEqual(batch.get(c.draftRef), await stateOf(c), `batch and single agree for ${c.draftRef}`);
    }
    assert.deepEqual(await ledgerCounts(), before, "reading publication state creates no request, decision, permit, attempt or audit row");

    console.log("PASS content-publication-state-1 publication (postgres, real ledger rows, provider seams faked)");
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
