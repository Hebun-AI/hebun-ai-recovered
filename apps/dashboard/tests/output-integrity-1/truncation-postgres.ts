/*
 * OUTPUT-INTEGRITY-1 — a model reply cut at the output limit is never filed as a review-ready draft.
 * Real disposable PostgreSQL, the released writers and assignment seams, the model faked at the transport.
 * No network, no real model.
 *
 *   T1  end_turn + valid text → the Security Planning Agent's operational plan is filed (one artifact, one revision)
 *   T2  max_tokens + otherwise valid text → `output-truncated`: no artifact, no revision; the message record stays
 *   T3  a validator-withheld reply (AOR-1b) → no artifact
 *   T4  provider failure → no artifact
 *   T5  Content Agent: content draft filed on end_turn, refused on max_tokens
 *   T6  Engineering Agent: plan filed on end_turn, refused on max_tokens
 *   T7  revision from a change request: max_tokens files no revision; end_turn files exactly revision 2
 *   T8  no work row, action request or permit changes in any case
 *   T9  no duplicate: every filing adds exactly one artifact or revision, every refusal adds none
 *   T10 the seam asks the stop reason after the answer and before either writer
 *   T11 refusal + otherwise valid text → `model-refused`: no artifact, no revision; the message record stays
 *   T12 the refusal guard sits beside the max_tokens guard: after the answer, before either writer
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { declareWorkEvidenceReference } from "../../src/features/organizational-work/write-work.server";
import { requestArtifactRevisionChanges } from "../../src/features/work-artifact-review/review-revision.server";
import { assignWorkDraft, reviseWorkDraft, type AssignWorkDraftDeps } from "../../src/features/agent-work/assign-work-draft.server";
import { HEBUN_PREPARATION_REFUSAL_WORDING } from "../../src/components/operations-preparation/prepare-with-hebun";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";
import { publicKnowledgeNoMatch } from "../helpers/public-knowledge";

const ROOT = path.resolve(__dirname, "../..");
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
} as const;
const PLAN = "Review objective: confirm each grant must be approved by the Director. Evidence to request: approved access list.";
const CUT = "Review objective: confirm each grant must be approved by the Director. Acceptance criterion: documented rotation practices, sample";
const CAPTION = "New kilims are in. Each one is woven by hand. Message us to reserve one.";
const WITHHELD = "The access request was approved.";
const DECLINED = "I can't help prepare this plan.";
const APPROVE = "I have read this proposal and authorize it for the output integrity proof.";
const MANDATE = "Bounding what this agent may do for the output integrity proof.";
const PURPOSE = "Assist authorized people with work inside the agent's assigned responsibility.";
const CHANGES = "Changes requested: finish the last criterion and mark missing evidence as UNKNOWN.";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRow(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, createHash("sha256").update(tag).digest("hex"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

const contextFor = (s: Seeded, sessionContextId: string): TenantContext =>
  asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId: "oi1-request", authenticatedAt: new Date().toISOString(),
  });

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("output-integrity-1/truncation-postgres: exited before completing");
    process.exitCode = 1;
  }
});

/* T10 — source order: the stop reason is asked after the answer exists and before either writer. */
function theGuardPrecedesTheWriters(): void {
  const seam = readFileSync(path.join(ROOT, "src/features/work-artifacts/prepare-work-artifact.server.ts"), "utf8");
  const body = seam.slice(seam.indexOf("export async function prepareWorkArtifact"));
  const guard = body.indexOf('if (answer.modelStopReason === "max_tokens") {');
  assert.ok(guard > 0, "T10: the seam refuses an explicit max_tokens");
  assert.ok(guard > body.indexOf('reason: "no-model-answer"'), "T10: after the answer is known to be the model's");
  assert.ok(guard < body.indexOf("reviseWorkArtifactFromHebyPreparation("), "T10: before the revision writer");
  assert.ok(guard < body.indexOf("createWorkArtifactFromHebyPreparation("), "T10: before the creation writer");
  assert.match(HEBUN_PREPARATION_REFUSAL_WORDING["output-truncated"], /No prepared work was written/, "T10: the surface says nothing was filed");
}

/* T12 — the provider's refusal is asked at the same point as its output limit. */
function theRefusalGuardPrecedesTheWriters(): void {
  const seam = readFileSync(path.join(ROOT, "src/features/work-artifacts/prepare-work-artifact.server.ts"), "utf8");
  const body = seam.slice(seam.indexOf("export async function prepareWorkArtifact"));
  const guard = body.indexOf('if (answer.modelStopReason === "refusal") {');
  assert.ok(guard > 0, "T12: the seam refuses an explicit provider refusal");
  assert.ok(guard > body.indexOf('reason: "no-model-answer"'), "T12: after the answer is known to be the model's");
  assert.ok(guard < body.indexOf("reviseWorkArtifactFromHebyPreparation("), "T12: before the revision writer");
  assert.ok(guard < body.indexOf("createWorkArtifactFromHebyPreparation("), "T12: before the creation writer");
  assert.match(HEBUN_PREPARATION_REFUSAL_WORDING["model-refused"], /No prepared work was written/, "T12: the surface says nothing was filed");
}

async function main(): Promise<void> {
  theGuardPrecedesTheWriters();
  theRefusalGuardPrecedesTheWriters();
  const harness = createDisposablePostgresHarness("hebun_oi1_truncation");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const n = async (sql: string, params: unknown[] = []) => Number((await q<{ n: number }>(sql, params))[0]!.n);

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-oi1", email: "director@acme.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "oi1-acme"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });

    const agent = async (name: string) => {
      const r = await createDurableAgentIdentity(acme, { name, justification: `Register ${name} for the output integrity proof.` }, dbDeps);
      assert.equal(r.status, "established", JSON.stringify(r));
      return r.status === "established" ? r.identity.agentId : "";
    };
    const mandate = async (agentId: string, proposalScope: string[], responsibility: unknown[]) => {
      const r = await establishAgentMandateWithResponsibility(
        acme,
        { agentId, purpose: PURPOSE, proposalScope, justification: MANDATE, observedMandateRevision: null, responsibility },
        dbDeps,
      );
      assert.equal(r.status, "established", JSON.stringify(r));
    };
    const domain = async (slug: string, name: string) => {
      const r = await recordWorkDomain(acme, { slug, name }, dbDeps);
      assert.equal(r.status, "recorded", JSON.stringify(r));
      return (r as { workDomain: { workDomainId: string } }).workDomain.workDomainId;
    };
    let titles = 0;
    const scopedWork = async (workScope: WorkScope): Promise<string> => {
      const p = await proposeRecordWorkAction(acme, { title: `Work ${++titles}`, department: { kind: "organization-level" }, workScope } as never, dbDeps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      const a = await approveActionRequest(acme, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      const e = await executeRecordWork(acme, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
      assert.equal(e.status, "executed", JSON.stringify(e));
      return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
    };

    /* The model, faked at the transport; each call's text and stop reason are set by the case. */
    let calls = 0;
    let nextText = PLAN;
    let nextStop = "end_turn";
    let failNext = false;
    const transport: ClaudeTransport = {
      async send(request) {
        calls++;
        if (failNext) {
          failNext = false;
          throw new Error("provider down");
        }
        return { id: `req_oi1_${calls}`, model: request.model, content: [{ type: "text", text: nextText }], stopReason: nextStop, usage: { inputTokens: 30, outputTokens: 200 } };
      },
    };
    const repo = createDurableConversationRepository(handle.db);
    const preparation = {
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      resolvePublicKnowledge: publicKnowledgeNoMatch,
      newCorrelationId: () => "corr-oi1",
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      write: dbDeps,
      read: dbDeps,
      agentIdentity: dbDeps,
      log: () => {},
    } as unknown as AssignWorkDraftDeps["preparation"];
    const deps: AssignWorkDraftDeps = { resolveTenant: async () => acme, getDb: () => handle.db, preparation };
    const assign = (workItemId: string, agentId: string, artifactType: string, extra: Record<string, unknown> = {}) =>
      assignWorkDraft({ workItemId, agentId, prompt: "Prepare the draft.", title: `Draft ${randomUUID().slice(0, 6)}`, artifactType, ...extra } as never, deps);
    const world = async () => ({
      calls,
      artifacts: await n("select count(*)::int n from work_artifacts"),
      revisions: await n("select count(*)::int n from work_artifact_revisions"),
      messages: await n("select count(*)::int n from messages"),
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      work: await q("select md5(string_agg(w::text, '|' order by w.id)) h from work_items w"),
    });
    /* T8 + T9 — one model call; the given artifact/revision deltas; nothing else moved. */
    const expectDelta = async (label: string, run: () => Promise<unknown>, artifacts: number, revisions: number) => {
      const before = await world();
      const result = await run();
      const after = await world();
      assert.equal(after.calls - before.calls, 1, `${label}: exactly one model call`);
      assert.equal(after.artifacts - before.artifacts, artifacts, `${label}: artifacts +${artifacts}`);
      assert.equal(after.revisions - before.revisions, revisions, `${label}: revisions +${revisions}`);
      assert.deepEqual([after.requests, after.permits, after.work], [before.requests, before.permits, before.work], `${label}: no request, permit or work change`);
      return { result: result as { status: string; reason?: string; artifactId?: string; revisionNo?: number; modelFallback?: { kind: string } }, before, after };
    };

    const security = await domain("security", "Security");
    const content = await domain("content", "Content");
    const engineering = await domain("engineering", "Engineering");
    const planner = await agent("Security Planning Agent");
    await mandate(planner, ["set-work-declared-state"], [{ kind: "domain", workDomainId: security }]);
    const writer = await agent("Content Agent");
    await mandate(writer, ["set-work-declared-state"], [{ kind: "domain", workDomainId: content }]);
    const engineer = await agent("Engineering Agent");
    await mandate(engineer, ["record-work"], [{ kind: "domain", workDomainId: engineering }]);
    const securityWork = await scopedWork({ kind: "domain", workDomainId: security });
    const contentWork = await scopedWork({ kind: "domain", workDomainId: content });
    const engineeringWork = await scopedWork({ kind: "domain", workDomainId: engineering });

    /* ── T2 · max_tokens: refused, nothing filed, the message record stays ── */
    nextText = CUT;
    nextStop = "max_tokens";
    const t2 = await expectDelta("T2", () => assign(securityWork, planner, "operational-plan"), 0, 0);
    assert.deepEqual([t2.result.status, t2.result.reason], ["not-prepared", "output-truncated"], `T2: ${JSON.stringify(t2.result)}`);
    assert.ok(t2.after.messages > t2.before.messages, "T2: the model exchange stays in its message record");

    /* ── T3 · AOR-withheld: nothing filed ── */
    nextText = WITHHELD;
    nextStop = "end_turn";
    const t3 = await expectDelta("T3", () => assign(securityWork, planner, "operational-plan"), 0, 0);
    assert.deepEqual([t3.result.status, t3.result.reason, t3.result.modelFallback?.kind], ["not-prepared", "no-model-answer", "withheld"], `T3: ${JSON.stringify(t3.result)}`);

    /* ── T11 · refusal: the provider declined; refused, nothing filed, the message record stays ── */
    nextText = DECLINED;
    nextStop = "refusal";
    const t11 = await expectDelta("T11", () => assign(securityWork, planner, "operational-plan"), 0, 0);
    assert.deepEqual([t11.result.status, t11.result.reason], ["not-prepared", "model-refused"], `T11: ${JSON.stringify(t11.result)}`);
    assert.ok(t11.after.messages > t11.before.messages, "T11: the model exchange stays in its message record");
    const t11content = await expectDelta("T11 content", () => assign(contentWork, writer, "content-draft", { intendedDestination: "instagram" }), 0, 0);
    assert.equal(t11content.result.reason, "model-refused", `T11: ${JSON.stringify(t11content.result)}`);
    nextStop = "end_turn";

    /* ── T4 · provider failure: nothing filed ── */
    failNext = true;
    const t4 = await expectDelta("T4", () => assign(securityWork, planner, "operational-plan"), 0, 0);
    assert.deepEqual([t4.result.status, t4.result.modelFallback?.kind], ["not-prepared", "provider-failed"], `T4: ${JSON.stringify(t4.result)}`);

    /* ── T1 + T7(agent) · end_turn: the Security Planning Agent's plan is filed once ── */
    nextText = PLAN;
    nextStop = "end_turn";
    const t1 = await expectDelta("T1", () => assign(securityWork, planner, "operational-plan"), 1, 1);
    assert.equal(t1.result.status, "prepared", `T1: ${JSON.stringify(t1.result)}`);
    const rev1 = (await readWorkArtifactHistory(acme, t1.result.artifactId!, dbDeps)).find((r) => r.current)!;
    assert.deepEqual([rev1.content, rev1.authoredByActorType, rev1.authoredByActorId], [PLAN, "agent", planner], "T1: stored verbatim, authored by the agent");

    /* ── T7 · revision from a change request ── */
    assert.equal((await declareWorkEvidenceReference(acme, { workItemId: securityWork, referent: { kind: "work-artifact", referentId: t1.result.artifactId! } }, dbDeps)).status, "recorded");
    const asked = await requestArtifactRevisionChanges(acme, { artifactId: t1.result.artifactId!, revisionId: rev1.id, justification: CHANGES }, dbDeps);
    assert.equal(asked.status, "reviewed", JSON.stringify(asked));
    const basis = asked.status === "reviewed" ? asked.decisionId : "";
    const revise = () =>
      reviseWorkDraft({ workItemId: securityWork, artifactId: t1.result.artifactId!, agentId: planner, prompt: "Finish the plan.", expectedRevisionNo: 1, reviewBasisDecisionId: basis } as never, deps);
    nextText = CUT;
    nextStop = "max_tokens";
    const t7cut = await expectDelta("T7 max_tokens", revise, 0, 0);
    assert.deepEqual([t7cut.result.status, t7cut.result.reason], ["not-prepared", "output-truncated"], `T7: ${JSON.stringify(t7cut.result)}`);
    assert.equal((await readWorkArtifactHistory(acme, t1.result.artifactId!, dbDeps)).length, 1, "T7: revision 1 stays the only revision");
    nextText = PLAN;
    nextStop = "end_turn";
    const t7 = await expectDelta("T7 end_turn", revise, 0, 1);
    assert.deepEqual([t7.result.status, t7.result.revisionNo], ["prepared", 2], `T7: ${JSON.stringify(t7.result)}`);

    /* ── T5 · Content Agent ── */
    nextText = CAPTION;
    nextStop = "max_tokens";
    const t5cut = await expectDelta("T5 max_tokens", () => assign(contentWork, writer, "content-draft", { intendedDestination: "instagram" }), 0, 0);
    assert.equal(t5cut.result.reason, "output-truncated", `T5: ${JSON.stringify(t5cut.result)}`);
    nextStop = "end_turn";
    const t5 = await expectDelta("T5 end_turn", () => assign(contentWork, writer, "content-draft", { intendedDestination: "instagram" }), 1, 1);
    assert.equal(t5.result.status, "prepared", `T5: ${JSON.stringify(t5.result)}`);

    /* ── T6 · Engineering Agent ── */
    nextText = PLAN;
    nextStop = "max_tokens";
    const t6cut = await expectDelta("T6 max_tokens", () => assign(engineeringWork, engineer, "operational-plan"), 0, 0);
    assert.equal(t6cut.result.reason, "output-truncated", `T6: ${JSON.stringify(t6cut.result)}`);
    nextStop = "end_turn";
    const t6 = await expectDelta("T6 end_turn", () => assign(engineeringWork, engineer, "operational-plan"), 1, 1);
    assert.equal(t6.result.status, "prepared", `T6: ${JSON.stringify(t6.result)}`);

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("output-integrity-1/truncation-postgres: T1–T12 ok");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
