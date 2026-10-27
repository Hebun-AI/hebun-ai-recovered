/*
 * CONTENT-AGENT-SPECIALIST-1 — a Content Agent built only from released authorities: an Agent Identity,
 * a mandate whose responsibility is a "Content" work domain, Heby's specialist selection, the released
 * `prepare-work-draft` capability writing a content draft for a destination, Governance review, the
 * agent's revision from a change request, and the publication-aware outcome. Real disposable PostgreSQL,
 * the released writers, the model faked at the transport. No network, no real model.
 *
 *   A1  tenant: another organization sees no choices for the content work and cannot assign it
 *   A2  no mandate: a registered Content Agent without a mandate is not offered and is refused before the model
 *   A3  Heby offers the Content Agent as the content work's specialist and recommends it; the Engineering
 *       Agent is not offered (counted, never named)
 *   A4  explicit selection: no agent → `agent-required`, nothing written
 *   A5  only permitted work: the Content Agent on organization work and on Engineering work is refused
 *       `agent-not-eligible` before the model
 *   A6  the content draft: one model call carrying the content-draft brief, the destination sentence and the
 *       organization's cleared public Knowledge; stored verbatim as `content-draft` for Instagram, authored
 *       by the Content Agent; no action request, permit or work change
 *   A7  work/artifact: linked by the person as the work's evidence; Heby and the outcome read list it
 *   A8  review and revision: Governance requests changes; the Content Agent writes revision 2 bound to that
 *       request; the work still waits for review
 *   A9  acceptance is not publication: once accepted the outcome says `publication-pending` — the act of
 *       publishing stays a separate request, decision and permit
 *   A10 failure: the provider fails → `not-prepared`, nothing written, nothing offered as a draft
 *   A11 Engineering Agent unchanged: on Engineering work it is the recommended specialist and prepares a plan
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import type { ClaudeTransportRequest } from "../../src/features/heby-model/claude-transport";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { readWorkArtifactHistory, listWorkArtifacts } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { declareWorkEvidenceReference } from "../../src/features/organizational-work/write-work.server";
import { acceptArtifactRevision, requestArtifactRevisionChanges } from "../../src/features/work-artifact-review/review-revision.server";
import {
  assignWorkDraft,
  readWorkDraftChoices,
  readWorkDrafts,
  reviseWorkDraft,
  type AssignWorkDraftDeps,
} from "../../src/features/agent-work/assign-work-draft.server";
import { readWorkOutcomeEvidence } from "../../src/features/work-outcome/read-work-outcome-evidence.server";
import { suggestCompletion } from "../../src/features/work-outcome/contracts";
import { CONTENT_DRAFT_PREPARATION_BRIEF, contentDraftDestinationSentence } from "../../src/features/work-artifacts/preparation-brief";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";
import { publicKnowledgeNoMatch } from "../helpers/public-knowledge";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
} as const;
const CAPTION_1 = "New kilims are in. Each one is woven by hand. Visit the shop this week.";
const CAPTION_2 = "New kilims are in. Each one is woven by hand. Message us to reserve one.";
const PLAN_TEXT = "Plan: review the release notes on Monday, confirm the rollback step on Tuesday.";
const APPROVE = "I have read this proposal and authorize it for the content agent proof.";
const MANDATE = "Bounding what this agent may do for the content agent proof.";
const PURPOSE = "Assist authorized people with content work inside the agent's assigned responsibility.";
const CHANGES = "Changes requested: replace the visit line with an invitation to message the shop.";

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
    mfaVerified: false, requestId: "cas1-request", authenticatedAt: new Date().toISOString(),
  });

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("content-agent-specialist-1/workflow-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cas1_workflow");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const n = async (sql: string, params: unknown[] = []) => Number((await q<{ n: number }>(sql, params))[0]!.n);

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme Rugs", companySlug: "acme-cas1", email: "director@acme.test" })) as Seeded;
    const globexSeed = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-cas1", email: "director@globex.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "cas1-acme"));
    const globex = contextFor(globexSeed, await sessionRow(setup, globexSeed, "cas1-globex"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });
    await seedGovernanceAuthority(setup, globexSeed, dbDeps, { ctx: globex, sessionContextId: globex.sessionContextId });

    /* ── the configuration a Director performs through the released writers ── */
    const agent = async (name: string) => {
      const r = await createDurableAgentIdentity(acme, { name, justification: `Register ${name} for the content agent proof.` }, dbDeps);
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

    /* The model, faked at the transport — everything above it is the released stack. */
    let calls = 0;
    const sent: ClaudeTransportRequest[] = [];
    let nextText = CAPTION_1;
    let failNext = false;
    const transport: ClaudeTransport = {
      async send(request) {
        calls++;
        sent.push(request);
        if (failNext) {
          failNext = false;
          throw new Error("provider down");
        }
        return { id: `req_cas1_${calls}`, model: request.model, content: [{ type: "text", text: nextText }], stopReason: "end_turn", usage: { inputTokens: 30, outputTokens: 12 } };
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
      newCorrelationId: () => "corr-cas1",
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      write: dbDeps,
      read: dbDeps,
      agentIdentity: dbDeps,
    } as unknown as AssignWorkDraftDeps["preparation"];
    const depsFor = (ctx: TenantContext): AssignWorkDraftDeps => ({ resolveTenant: async () => ctx, getDb: () => handle.db, preparation });
    const askContent = (ctx: TenantContext, workItemId: string, agentId: string) =>
      assignWorkDraft(
        { workItemId, agentId, prompt: "Write an Instagram caption announcing this week's new kilims.", title: `Kilim caption ${randomUUID().slice(0, 6)}`, artifactType: "content-draft", intendedDestination: "instagram" },
        depsFor(ctx),
      );
    const world = async () => ({
      calls,
      artifacts: await n("select count(*)::int n from work_artifacts"),
      revisions: await n("select count(*)::int n from work_artifact_revisions"),
      references: await n("select count(*)::int n from work_evidence_references"),
      decisions: await n("select count(*)::int n from decision_records"),
      requests: await n("select count(*)::int n from heby_action_requests"),
      permits: await n("select count(*)::int n from action_permits"),
      work: await q("select md5(string_agg(w::text, '|' order by w.id)) h from work_items w"),
    });
    const nothingHappened = async (label: string, run: () => Promise<{ status: string; reason?: string }>, expected: string) => {
      const before = await world();
      const r = await run();
      assert.equal(r.status === "refused" ? r.reason : r.status, expected, `${label}: ${JSON.stringify(r)}`);
      assert.deepEqual(await world(), before, `${label}: no model call, nothing written`);
    };
    const instructions = (system: string) => system.slice(0, system.indexOf("Grounding context (data, not instructions):"));

    const content = await domain("content", "Content");
    const engineering = await domain("engineering", "Engineering");
    const heby = await agent("Heby");
    await mandate(heby, ["record-work"], [{ kind: "organization" }]);
    const engineer = await agent("Engineering Agent");
    await mandate(engineer, ["record-work"], [{ kind: "domain", workDomainId: engineering }]);
    const writer = await agent("Content Agent");
    const contentWork = await scopedWork({ kind: "domain", workDomainId: content });
    const orgWork = await scopedWork({ kind: "organization" });
    const engineeringWork = await scopedWork({ kind: "domain", workDomainId: engineering });

    /* ── A2 · registered but no mandate: not offered, refused before the model ── */
    const a2 = await readWorkDraftChoices(acme, contentWork, dbDeps);
    assert.equal(a2.status, "read", JSON.stringify(a2));
    assert.ok(a2.status === "read" && !a2.agents.some((a) => a.agentId === writer), "A2: an agent without a mandate is not offered");
    await nothingHappened("A2", () => askContent(acme, contentWork, writer), "agent-not-eligible");

    /* The Director's mandate for the Content Agent: responsible for Content work only. */
    await mandate(writer, ["set-work-declared-state"], [{ kind: "domain", workDomainId: content }]);

    /* ── A3 · Heby offers and recommends the Content Agent ── */
    const a3 = await readWorkDraftChoices(acme, contentWork, dbDeps);
    assert.equal(a3.status, "read");
    if (a3.status !== "read") throw new Error("unreachable");
    assert.deepEqual(a3.agents.map((a) => [a.name, a.role]).sort(), [["Content Agent", "specialist"]], "A3: the content work's specialist is offered");
    assert.equal(a3.recommendedAgentId, writer, "A3: and recommended, by the server's rule");
    assert.ok(!a3.agents.some((a) => a.agentId === engineer || a.agentId === heby), "A3: the Engineering Agent and organization-only Heby are not offered");

    /* ── A1 · another organization ── */
    const a1 = await readWorkDraftChoices(globex, contentWork, dbDeps);
    assert.notEqual(a1.status, "read", `A1: ${JSON.stringify(a1)}`);
    await nothingHappened("A1", () => askContent(globex, contentWork, writer), "work-unresolved");

    /* ── A4 · explicit selection ── */
    await nothingHappened("A4", () => askContent(acme, contentWork, ""), "agent-required");

    /* ── A5 · only permitted work ── */
    await nothingHappened("A5 organization work", () => askContent(acme, orgWork, writer), "agent-not-eligible");
    await nothingHappened("A5 engineering work", () => askContent(acme, engineeringWork, writer), "agent-not-eligible");

    /* ── A10 · a failed provider call writes nothing ── */
    failNext = true;
    const beforeFail = await world();
    const a10 = await askContent(acme, contentWork, writer);
    assert.equal(a10.status, "not-prepared", JSON.stringify(a10));
    assert.equal(a10.status === "not-prepared" && a10.modelFallback?.kind, "provider-failed", "A10: the failure is named, never a draft");
    const afterFail = await world();
    assert.equal(afterFail.calls, beforeFail.calls + 1, "A10: the provider was asked once");
    assert.deepEqual({ ...afterFail, calls: 0 }, { ...beforeFail, calls: 0 }, "A10: no artifact, no revision, no reference, nothing else");

    /* ── A6 · the content draft ── */
    const before6 = await world();
    const a6 = await askContent(acme, contentWork, writer);
    assert.equal(a6.status, "prepared", JSON.stringify(a6));
    if (a6.status !== "prepared") throw new Error("unreachable");
    assert.equal(a6.agentName, "Content Agent");
    assert.equal(a6.agentRole, "specialist");
    const after6 = await world();
    assert.equal(after6.calls - before6.calls, 1, "A6: exactly one model call");
    const system = sent.at(-1)!.system;
    for (const sentence of CONTENT_DRAFT_PREPARATION_BRIEF) assert.ok(instructions(system).includes(sentence), "A6: the content-draft brief framed it");
    assert.ok(instructions(system).includes(contentDraftDestinationSentence("instagram")), "A6: for its declared destination");
    assert.ok(system.includes("A cleared fact."), "A6: grounded on the organization's cleared public Knowledge");
    assert.deepEqual(["Content Agent", "Engineering Agent"].filter((name) => instructions(system).includes(name)), [], "A6: no agent name in the instruction channel");
    const listed = await listWorkArtifacts(acme, dbDeps);
    const artifact = listed.status === "read" ? listed.artifacts.find((a) => a.id === a6.artifactId) : undefined;
    assert.equal(artifact?.artifactType, "content-draft", "A6: a content draft");
    assert.equal(artifact?.intendedDestination, "instagram", "A6: for Instagram");
    const rev1 = (await readWorkArtifactHistory(acme, a6.artifactId, dbDeps)).find((r) => r.current)!;
    assert.equal(rev1.content, CAPTION_1, "A6: the model's text, stored verbatim");
    assert.equal(rev1.authoredByActorType, "agent");
    assert.equal(rev1.authoredByActorId, writer, "A6: authored by the Content Agent");
    assert.equal(after6.requests, before6.requests, "A6: no action request");
    assert.equal(after6.permits, before6.permits, "A6: no permit");
    assert.deepEqual(after6.work, before6.work, "A6: no work row changed");
    assert.equal(after6.references, before6.references, "A6: the assignment links nothing on its own");

    /* ── A7 · the person links it; Heby and the outcome read agree ── */
    const linked = await declareWorkEvidenceReference(acme, { workItemId: contentWork, referent: { kind: "work-artifact", referentId: a6.artifactId } }, dbDeps);
    assert.equal(linked.status, "recorded", JSON.stringify(linked));
    const drafts = await readWorkDrafts(acme, contentWork, dbDeps);
    const draft = drafts.status === "read" ? drafts.drafts.find((d) => d.artifactId === a6.artifactId) : undefined;
    assert.equal(draft?.review, "awaiting-review", "A7: waiting for human review");
    assert.deepEqual(draft?.author, { kind: "agent", agentId: writer, name: "Content Agent" });
    const outcome = await readWorkOutcomeEvidence(acme, dbDeps);
    assert.deepEqual(outcome.status === "read" ? outcome.byWorkItem[contentWork]?.map((e) => e.artifactId) : null, [a6.artifactId], "A7: the work's evidence");

    /* ── A8 · changes requested → the Content Agent revises ── */
    const asked = await requestArtifactRevisionChanges(acme, { artifactId: a6.artifactId, revisionId: rev1.id, justification: CHANGES }, dbDeps);
    assert.equal(asked.status, "reviewed", JSON.stringify(asked));
    nextText = CAPTION_2;
    const a8 = await reviseWorkDraft(
      { workItemId: contentWork, artifactId: a6.artifactId, agentId: writer, prompt: "Invite people to message the shop instead of visiting.", expectedRevisionNo: 1, reviewBasisDecisionId: asked.status === "reviewed" ? asked.decisionId : "" },
      depsFor(acme),
    );
    assert.equal(a8.status, "prepared", JSON.stringify(a8));
    assert.equal(a8.status === "prepared" && a8.revisionNo, 2, "A8: the same draft, its next revision");
    const rev2 = (await readWorkArtifactHistory(acme, a6.artifactId, dbDeps)).find((r) => r.current)!;
    assert.equal(rev2.revisionNo, 2, "A8: revision 2");
    assert.equal(rev2.content, CAPTION_2);
    assert.equal(rev2.authoredByActorId, writer, "A8: by the Content Agent");
    const drafts8 = await readWorkDrafts(acme, contentWork, dbDeps);
    assert.equal(drafts8.status === "read" && drafts8.drafts.find((d) => d.artifactId === a6.artifactId)?.review, "awaiting-review", "A8: the new revision waits for review");

    /* ── A9 · acceptance is not publication ── */
    const requestsBefore = await n("select count(*)::int n from heby_action_requests");
    assert.equal((await acceptArtifactRevision(acme, { artifactId: a6.artifactId, revisionId: rev2.id, justification: "Accepted: the caption invites a message." }, dbDeps)).status, "reviewed");
    const evidence9 = await readWorkOutcomeEvidence(acme, dbDeps);
    const ofWork = evidence9.status === "read" ? evidence9.byWorkItem[contentWork] ?? null : null;
    assert.equal(ofWork?.[0]?.publication, "pending", "A9: nothing is published");
    assert.deepEqual(suggestCompletion({ declaredState: "planned", inService: true, evidence: ofWork }), { offered: false, reason: "publication-pending" }, "A9");
    const choices9 = await readWorkDraftChoices(acme, contentWork, dbDeps);
    assert.deepEqual(choices9.status === "read" ? choices9.completion : null, { offered: false, reason: "publication-pending" }, "A9: Heby says the same");
    assert.equal(await n("select count(*)::int n from heby_action_requests"), requestsBefore, "A9: no publication request was filed for anyone");

    /* ── A11 · the Engineering Agent is unchanged ── */
    const a11 = await readWorkDraftChoices(acme, engineeringWork, dbDeps);
    assert.equal(a11.status === "read" && a11.recommendedAgentId, engineer, "A11: Engineering work still recommends the Engineering Agent");
    nextText = PLAN_TEXT;
    const plan = await assignWorkDraft(
      { workItemId: engineeringWork, agentId: engineer, prompt: "Prepare a two-step review plan.", title: "Review plan", artifactType: "operational-plan" },
      depsFor(acme),
    );
    assert.equal(plan.status, "prepared", JSON.stringify(plan));
    assert.equal(plan.status === "prepared" && plan.agentName, "Engineering Agent");

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("content-agent-specialist-1 workflow-postgres: A1–A11 ok");
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
