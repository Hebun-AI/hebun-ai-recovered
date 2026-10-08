/*
 * AP-5A — PLURALITY READINESS, proved against a REAL PostgreSQL (PG 18).
 *
 * Every agent-attributed surface can be used with more than one agent in service: the human NAMES
 * the agent, the released resolvers verify the name, and nothing is ever attributed to an agent
 * nobody named.
 *
 *   O. ORIGINATION. With two agents, no selection refuses before any model call; selecting Atlas
 *      files the proposal under Atlas, and the instruction the model receives names NO agent.
 *   P. CONTENT PREPARATION. One agent and no selection: exactly as before. Two: no selection refuses
 *      in preflight (no model call, no write); selecting Atlas makes Atlas the revision's author; a
 *      foreign or retired selection refuses with its own reason.
 *   M. MEDIA, SYNC AND ASYNC (G2-A). `agent_id` keeps MEDIA-1's meaning — the agent NAMED for the
 *      attempt — and is NOT the source revision's author: naming Atlas on a revision Heby wrote, or
 *      one a human wrote, records Atlas. No selection with two agents refuses; a malformed id is
 *      invalid input; foreign and retired selections refuse with their own reasons. One agent and no
 *      selection records that agent, exactly as before.
 *
 * A disposable local database, dropped on exit. No production data, no provider contacted.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore, pngBytes } from "../helpers/media-fakes";
import { createFakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { publicKnowledgeNoMatch } from "../helpers/public-knowledge";
import { seedTenant } from "../mv4-async-generation/scenarios";
import { createControlPlaneDb } from "../../src/db/client.server";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { registerAsyncMediaGeneration } from "../../src/features/media-assets/async-generation-lifecycle.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-08T12:00:00.000Z");
const WHY = "Register this agent for the AP-5A plurality readiness organization.";
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
} as const;
const CAPTION = "Every knot on this loom is tied by hand, one row at a time.";
const NOBODY = "00000000-0000-4000-8000-0000000000ff";

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string): TenantContext {
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
    requestId: "ap5a-readiness",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap5a_readiness");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const dbDeps = { getDb } as never;
  const writeDeps = { getDb, now: () => NOW } as never;
  const count = async (table: string, where = "true", params: unknown[] = []): Promise<number> =>
    (await setup.query<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`, params)).rows[0]!.n;

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("AP-5A test makes no network call");
  }) as typeof fetch;

  try {
    /* ── shared fixture: an organization with Governance, Heby (+ mandate) ─────── */
    const seedOrg = async (slug: string, tag: string) => {
      const seeded = await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test`, password: `${slug}-correct-password-7Qx` });
      const ctx = contextFor(seeded, await sessionRowFor(setup, seeded, tag));
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: "Establishing Governance for the AP-5A fixture." }, writeDeps)).status, "established");
      return { seeded, ctx };
    };
    const register = async (ctx: TenantContext, name: string): Promise<string> => {
      const made = await createDurableAgentIdentity(ctx, { name, justification: WHY }, writeDeps);
      assert.equal(made.status, "established", `${name} is registered`);
      if (made.status !== "established") throw new Error("unreachable");
      return made.identity.agentId;
    };

    const acme = await seedOrg("acme-ap5a", "a");
    const globex = await seedOrg("globex-ap5a", "b");
    const heby = await register(acme.ctx, "Heby");
    const foreign = await register(globex.ctx, "Heby");
    await seedAgentMandate(setup, acme.seeded, heby, writeDeps, { tag: "a", now: NOW, proposalScope: ["record-work"] });

    /* ════════════ P. CONTENT PREPARATION — one agent first ════════════════════ */
    const repo = createDurableConversationRepository(handle.db);
    let modelCalls = 0;
    const transport: ClaudeTransport = {
      async send(request) {
        modelCalls += 1;
        return { id: "req_ap5a", model: request.model, content: [{ type: "text", text: CAPTION }], stopReason: "end_turn", usage: { inputTokens: 50, outputTokens: 12 } };
      },
    };
    const prepDeps = {
      resolveTenant: async () => acme.ctx,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      resolvePublicKnowledge: publicKnowledgeNoMatch,
      newCorrelationId: () => "corr-ap5a",
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      write: dbDeps,
      agentIdentity: dbDeps,
    };
    const draft = {
      prompt: "Draft an Instagram caption about hand-knotting on the loom.",
      route: "/operations",
      artifactType: "content-draft" as const,
      intendedDestination: "instagram" as const,
      title: "Loom caption",
    };
    const authorOf = async (artifactId: string): Promise<string> =>
      (await setup.query<{ a: string }>(`select authored_by_actor_id as a from work_artifact_revisions where artifact_id = $1 order by revision_no desc limit 1`, [artifactId])).rows[0]!.a;

    {
      const prepared = await prepareWorkArtifact(draft, prepDeps);
      assert.equal(prepared.status, "prepared", "P1: one agent, no selection — prepared exactly as before");
      if (prepared.status !== "prepared") throw new Error("unreachable");
      assert.equal(await authorOf(prepared.artifactId), heby, "P1: the single in-service agent is the author");
    }

    /* ════════════ the second agent ════════════════════════════════════════════ */
    const atlas = await register(acme.ctx, "Atlas");
    await seedAgentMandate(setup, acme.seeded, atlas, writeDeps, { tag: "c", now: NOW, proposalScope: ["record-work"] });

    {
      const calls = modelCalls;
      const artifacts = await count("work_artifacts");
      const refused = await prepareWorkArtifact(draft, prepDeps);
      assert.deepEqual(
        refused.status === "refused" ? refused.reason : refused.status,
        "ambiguous-durable-agent-identity",
        "P2: two agents and no selection — refused, never a pick",
      );
      assert.equal(modelCalls, calls, "P2: in preflight — the model was not asked");
      assert.equal(await count("work_artifacts"), artifacts, "P2: nothing was written");

      const named = await prepareWorkArtifact({ ...draft, agentId: atlas }, prepDeps);
      assert.equal(named.status, "prepared", "P3: naming Atlas prepares");
      if (named.status !== "prepared") throw new Error("unreachable");
      assert.equal(await authorOf(named.artifactId), atlas, "P3: Atlas, the NAMED agent, is the author");

      for (const [label, agentId, reason] of [
        ["another organization's agent", foreign, "selected-agent-unresolvable"],
        ["an id nobody holds", NOBODY, "selected-agent-unresolvable"],
      ] as const) {
        const before = modelCalls;
        const r = await prepareWorkArtifact({ ...draft, agentId }, prepDeps);
        assert.equal(r.status === "refused" && r.reason, reason, `P4: ${label} names nobody`);
        assert.equal(modelCalls, before, `P4: ${label} — no model call`);
      }
    }

    /* ════════════ O. ORIGINATION ══════════════════════════════════════════════ */
    {
      const sent: ModelGenerationRequest[] = [];
      const reply = JSON.stringify({
        kind: "record-work",
        args: { title: "Record the loom maintenance review", scope: { kind: "organization-level" } },
        reason: "The goal asks for the review to be recorded as organizational work.",
      });
      const originationTransport: ClaudeTransport = {
        async send(request) {
          return { id: "req_ap5a_o", model: request.model, content: [{ type: "text", text: reply }], stopReason: "end_turn", usage: { inputTokens: 90, outputTokens: 30 } };
        },
      };
      const originate = (agentId?: string) =>
        originateAgentAction(
          { workScope: { kind: "organization" as const }, goal: "Record the loom maintenance review as organizational work.", ...(agentId ? { agentId } : {}) },
          {
            resolveTenant: async () => acme.ctx,
            env: MODEL_ENV,
            resolveDirectorEnabled: async () => true,
            selectTransport: () => ({ transport: originationTransport, transportProvenance: "fake" }),
            generate: async (request: ModelGenerationRequest, generationDeps: Parameters<typeof generateHebyModelAnswer>[1] = {}) => {
              sent.push(request);
              return generateHebyModelAnswer(request, generationDeps);
            },
            agentIdentity: dbDeps,
            candidates: { recipients: dbDeps, artifacts: dbDeps, organization: dbDeps },
            proposal: writeDeps,
            recordWork: writeDeps,
            provenance: dbDeps,
          } as never,
        );

      const invocations = await count("heby_origination_invocations");
      const ambiguous = await originate();
      assert.deepEqual(ambiguous, { status: "refused", reason: "ambiguous-durable-agent-identity" }, "O1: two agents, no selection");
      assert.equal(sent.length, 0, "O1: no model request was built");
      assert.equal(await count("heby_origination_invocations"), invocations, "O1: no invocation registered");

      const proposed = await originate(atlas);
      assert.equal(proposed.status, "proposed", `O2: Atlas proposes (${JSON.stringify(proposed)})`);
      assert.equal(
        await count("heby_action_requests", "proposed_by_actor_type = 'agent' and proposed_by_actor_id = $1", [atlas]),
        1,
        "O2: the request is filed under Atlas, the server-resolved proposer",
      );
      assert.equal(sent.length, 1, "O2: exactly one model request");
      const system = String(sent[0]!.systemInstructions);
      assert.ok(system.startsWith("You are a durable organizational agent inside the Hebun runtime."), "O3: the agent-neutral persona");
      assert.ok(!/\bHeby\b|\bAtlas\b/.test(system), "O3: the instruction names no agent — neither Agent #1 nor the one chosen");
      assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(`${system} ${sent[0]!.userPrompt}`), "O3: and carries no agent id (E2-5)");
    }

    /* ════════════ M. MEDIA — the NAMED agent, not the revision's author ═══════ */
    const store = createMemoryMediaObjectStore();
    const mediaDeps = {
      getDb,
      now: () => NOW,
      resolveStorage: (): MediaStorageResolution => ({ status: "available", store }),
      resolveTransport: () => ({
        status: "available" as const,
        transport: createFakeMediaGenerationTransport({ kind: "bytes", bytes: pngBytes(1080, 1080) }),
      }),
    };
    const video = createFakeAsyncVideoTransport();
    const asyncDeps = { getDb, now: () => NOW, resolveTransport: () => ({ status: "available" as const, transport: video }) };

    /* mv4's fixture: Governance, one agent "Heby", a HUMAN-authored content draft at revision 1. */
    const solo = await seedTenant(setup, getDb, "Solo");
    const soloAgent = (await setup.query<{ id: string }>(`select id from agents where tenant_id = $1`, [solo.tenantId])).rows[0]!.id;
    const media = await seedTenant(setup, getDb, "Media");
    const mediaHeby = (await setup.query<{ id: string }>(`select id from agents where tenant_id = $1`, [media.tenantId])).rows[0]!.id;
    const ask = (draftId: string, revisionNo = 1) => ({
      artifactId: draftId,
      revisionNo,
      promptText: "A rug on a wooden floor.",
      requestKey: randomUUID(),
    });
    const agentOfRequest = async (requestKey: string): Promise<string | null> =>
      (await setup.query<{ a: string }>(`select agent_id as a from media_generation_invocations where request_key = $1`, [requestKey])).rows[0]?.a ?? null;

    {
      /* M1 — one agent, no selection: exactly as before, sync and async. */
      const sync = ask(solo.draft);
      const r = await requestMediaGeneration(solo.ctx, sync, mediaDeps);
      assert.notEqual(r.status, "refused", `M1: one agent, no selection proceeds (${JSON.stringify(r)})`);
      assert.equal(await agentOfRequest(sync.requestKey), soloAgent, "M1: the single in-service agent is recorded");
      const asyncAsk = ask(solo.draft);
      const ra = await registerAsyncMediaGeneration(solo.ctx, asyncAsk, asyncDeps);
      assert.equal(ra.status, "registered", `M1: async, one agent, no selection (${JSON.stringify(ra)})`);
      assert.equal(await agentOfRequest(asyncAsk.requestKey), soloAgent);
    }

    const mediaAtlas = await register(media.ctx, "Atlas");
    /* A second revision written BY Heby, so "named" and "author" can be told apart. */
    const content = `Heby wrote this revision ${randomUUID()}`;
    await setup.query(
      `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
       values ($1,$2,2,$3,$4,'agent',$5)`,
      [media.tenantId, media.draft, content, createHash("sha256").update(content).digest("hex"), mediaHeby],
    );
    await setup.query(`update work_artifacts set current_revision = 2 where id = $1`, [media.draft]);

    for (const [label, run] of [
      ["sync", (input: ReturnType<typeof ask> & { agentId?: string | null }) => requestMediaGeneration(media.ctx, input, mediaDeps)],
      ["async", (input: ReturnType<typeof ask> & { agentId?: string | null }) => registerAsyncMediaGeneration(media.ctx, input, asyncDeps)],
    ] as const) {
      const invocations = await count("media_generation_invocations");
      const none = await run(ask(media.draft, 2));
      assert.equal(none.status === "refused" && none.reason, "ambiguous-durable-agent", `M2 ${label}: two agents, no selection`);
      assert.equal(await count("media_generation_invocations"), invocations, `M2 ${label}: nothing registered`);

      const onHebysRevision = ask(media.draft, 2);
      const named = await run({ ...onHebysRevision, agentId: mediaAtlas });
      assert.notEqual(named.status, "refused", `M3 ${label}: naming Atlas proceeds (${JSON.stringify(named)})`);
      assert.equal(
        await agentOfRequest(onHebysRevision.requestKey),
        mediaAtlas,
        `M3 ${label}: Atlas is recorded although HEBY wrote the revision — the named agent, not the author`,
      );

      const onHumanRevision = ask(media.draft, 1);
      assert.notEqual((await run({ ...onHumanRevision, agentId: mediaHeby })).status, "refused", `M4 ${label}: a human-authored revision`);
      assert.equal(await agentOfRequest(onHumanRevision.requestKey), mediaHeby, `M4 ${label}: the named agent is recorded for a human-authored revision`);

      for (const [what, agentId, reason] of [
        ["another organization's agent", soloAgent, "selected-agent-unresolvable"],
        ["an id nobody holds", NOBODY, "selected-agent-unresolvable"],
        ["a malformed id", "not-an-id", "invalid-input"],
      ] as const) {
        const before = await count("media_generation_invocations");
        const r = await run({ ...ask(media.draft, 2), agentId });
        assert.equal(r.status === "refused" && r.reason, reason, `M5 ${label}: ${what}`);
        assert.equal(await count("media_generation_invocations"), before, `M5 ${label}: ${what} registers nothing`);
      }
    }

    /* M6 — a retired named agent cannot be named for new work; the other path is intact. */
    assert.equal((await retireDurableAgentIdentity(media.ctx, { agentId: mediaAtlas, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, dbDeps)).status, "retired");
    const retiredSync = await requestMediaGeneration(media.ctx, { ...ask(media.draft, 2), agentId: mediaAtlas }, mediaDeps);
    assert.equal(retiredSync.status === "refused" && retiredSync.reason, "selected-agent-retired", "M6 sync: retired");
    const retiredAsync = await registerAsyncMediaGeneration(media.ctx, { ...ask(media.draft, 2), agentId: mediaAtlas }, asyncDeps);
    assert.equal(retiredAsync.status === "refused" && retiredAsync.reason, "selected-agent-retired", "M6 async: retired");
    const back = ask(media.draft, 2);
    assert.notEqual((await requestMediaGeneration(media.ctx, back, mediaDeps)).status, "refused", "M6: with Atlas retired, no selection works again");
    assert.equal(await agentOfRequest(back.requestKey), mediaHeby, "M6: and records Heby, as before");

    /* P5 — a retired selection on preparation, after the media section retired nothing in Acme. */
    assert.equal((await retireDurableAgentIdentity(acme.ctx, { agentId: atlas, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, dbDeps)).status, "retired");
    const retiredPrep = await prepareWorkArtifact({ ...draft, agentId: atlas }, prepDeps);
    assert.equal(retiredPrep.status === "refused" && retiredPrep.reason, "selected-agent-retired", "P5: retired");

    console.log("ap5a-plurality-readiness/readiness-postgres: passed");
  } finally {
    globalThis.fetch = realFetch;
    await setup.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
