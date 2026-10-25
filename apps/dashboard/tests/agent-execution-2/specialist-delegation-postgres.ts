/*
 * AGENT-EXECUTION-2 — Heby delegates a work item to the work's SPECIALIST agent, the specialist writes the
 * draft through the released preparation seam, and the result reaches human review. Real disposable
 * PostgreSQL, the released writers, a fake model transport (captured at the provider boundary). No network.
 *
 *   S1  domain work with a coordinator (organization + domain), the domain's specialist and another
 *       domain's agent: Heby lists the coordinator and the specialist with their roles, never the other
 *       domain's agent, and recommends the specialist — a server-side rule, read from the mandates
 *   S2  the specialist is assigned: one model call whose instruction channel carries the strict rules and the
 *       internal-draft brief, with no specialist claim and no agent or domain name; one revision authored by the
 *       specialist; result role specialist; linked by the person; waiting for review; Governance accepts
 *   S3  the coordinator on the same domain work: the provider receives the SAME system instructions
 *   S4  organization work: no specialist, no recommendation
 *   S5  two specialists for one domain: no recommendation, the person chooses; a specialist with a draft
 *       waiting is not recommended
 *   S6  the other domain's agent, sent anyway: refused `agent-not-eligible` before the model, nothing written
 *   S7  the provider fails on a specialist assignment: `not-prepared`, no artifact, no reference
 *   S8  the Operations path (organization work) is prepared exactly as AE-1
 *   S9  another tenant sees no choices for this work and cannot assign it
 *   S10 a member without Governance authority is refused `not-authorized` before the model
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
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { declareWorkEvidenceReference } from "../../src/features/organizational-work/write-work.server";
import { acceptArtifactRevision } from "../../src/features/work-artifact-review/review-revision.server";
import {
  assignWorkDraft,
  readWorkDraftChoices,
  readWorkDrafts,
  type AssignWorkDraftDeps,
} from "../../src/features/agent-work/assign-work-draft.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { INTERNAL_DRAFT_PREPARATION_BRIEF } from "../../src/features/work-artifacts/preparation-brief";
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
const DRAFT_TEXT = "Plan: count stock in aisle three on Monday, reconcile with the ledger on Tuesday.";
const APPROVE = "I have read this proposal and authorize it for the agent execution proof.";
const MANDATE = "Bounding what this agent may do for the agent execution proof.";
const PURPOSE = "Assist authorized people with organizational work inside the agent's assigned responsibility.";

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
    mfaVerified: false, requestId: "ae1-request", authenticatedAt: new Date().toISOString(),
  });

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const user = (await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email])).rows[0]!.id;
  const identity = (await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [user, `local:${email}`],
  )).rows[0]!.id;
  const role = (await client.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`, [tenantId, `Role ${email}`])).rows[0]!.id;
  const membership = (await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [tenantId, user, role],
  )).rows[0]!.id;
  return { tenantId, userId: user, authIdentityId: identity, membershipId: membership, roleId: role };
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("agent-execution-2/specialist-delegation-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ae2_specialist");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const n = async (sql: string, params: unknown[] = []) => Number((await q<{ n: number }>(sql, params))[0]!.n);

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ae2", email: "director@acme.test" })) as Seeded;
    const globexSeed = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ae2", email: "director@globex.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "ae2-acme"));
    const globex = contextFor(globexSeed, await sessionRow(setup, globexSeed, "ae2-globex"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });
    await seedGovernanceAuthority(setup, globexSeed, dbDeps, { ctx: globex, sessionContextId: globex.sessionContextId });
    const memberSeed = await addMember(setup, acmeSeed.tenantId, "member@acme.test");
    const member = contextFor(memberSeed, await sessionRow(setup, memberSeed, "ae2-member"));

    const agent = async (ctx: TenantContext, name: string) => {
      const r = await createDurableAgentIdentity(ctx, { name, justification: `Register ${name} for the agent execution proof.` }, dbDeps);
      assert.equal(r.status, "established", JSON.stringify(r));
      return r.status === "established" ? r.identity.agentId : "";
    };
    const revisions = new Map<string, number>();
    const mandate = async (ctx: TenantContext, agentId: string, proposalScope: string[], responsibility: unknown[]) => {
      const r = await establishAgentMandateWithResponsibility(
        ctx,
        { agentId, purpose: PURPOSE, proposalScope, justification: MANDATE, observedMandateRevision: revisions.get(agentId) ?? null, responsibility },
        dbDeps,
      );
      assert.equal(r.status, "established", JSON.stringify(r));
      revisions.set(agentId, (revisions.get(agentId) ?? 0) + 1);
    };
    let titles = 0;
    const scopedWork = async (ctx: TenantContext, workScope: WorkScope): Promise<string> => {
      const p = await proposeRecordWorkAction(ctx, { title: `Stock count ${++titles}`, department: { kind: "organization-level" }, workScope } as never, dbDeps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
      assert.equal(e.status, "executed", JSON.stringify(e));
      return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
    };

    /* The model, faked at the transport — everything above it is the released stack. */
    let calls = 0;
    const sent: ClaudeTransportRequest[] = [];
    let failNext = false;
    const transport: ClaudeTransport = {
      async send(request) {
        calls++;
        sent.push(request);
        if (failNext) {
          failNext = false;
          throw new Error("provider down");
        }
        return { id: `req_ae2_${calls}`, model: request.model, content: [{ type: "text", text: DRAFT_TEXT }], stopReason: "end_turn", usage: { inputTokens: 30, outputTokens: 12 } };
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
      newCorrelationId: () => "corr-ae2",
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      write: dbDeps,
      read: dbDeps,
      agentIdentity: dbDeps,
    } as unknown as AssignWorkDraftDeps["preparation"];
    const depsFor = (ctx: TenantContext, extra: Partial<AssignWorkDraftDeps> = {}): AssignWorkDraftDeps => ({
      resolveTenant: async () => ctx,
      getDb: () => handle.db,
      preparation,
      ...extra,
    });
    const ask = (ctx: TenantContext, workItemId: string, agentId: string, extra: Partial<AssignWorkDraftDeps> = {}, prompt = "Prepare a two-step plan for the stock count.") =>
      assignWorkDraft({ workItemId, agentId, prompt, title: `Draft ${randomUUID().slice(0, 6)}`, artifactType: "operational-plan" }, depsFor(ctx, extra));
    const world = async () => ({
      calls,
      artifacts: await n("select count(*)::int n from work_artifacts"),
      revisions: await n("select count(*)::int n from work_artifact_revisions"),
      references: await n("select count(*)::int n from work_evidence_references"),
      decisions: await n("select count(*)::int n from decision_records"),
      requests: await n("select count(*)::int n from heby_action_requests"),
    });
    const nothingHappened = async (label: string, run: () => Promise<{ status: string; reason?: string }>, expected: string) => {
      const before = await world();
      const r = await run();
      assert.equal(r.status === "refused" ? r.reason : r.status, expected, `${label}: ${JSON.stringify(r)}`);
      assert.deepEqual(await world(), before, `${label}: no model call, nothing written`);
    };

    /* ── fixtures ── */
    const domain = async (slug: string, name: string) =>
      ((await recordWorkDomain(acme, { slug, name }, dbDeps)) as { workDomain: { workDomainId: string } }).workDomain.workDomainId;
    const research = await domain("research", "Market Research");
    const sales = await domain("sales", "Sales");
    const heby = await agent(acme, "Coordinator");
    await mandate(acme, heby, ["record-work"], [{ kind: "organization" }, { kind: "domain", workDomainId: research }]);
    const specialist = await agent(acme, "Research Agent");
    await mandate(acme, specialist, ["record-work"], [{ kind: "domain", workDomainId: research }]);
    const seller = await agent(acme, "Sales Agent");
    await mandate(acme, seller, ["record-work"], [{ kind: "domain", workDomainId: sales }]);
    const researchWork = await scopedWork(acme, { kind: "domain", workDomainId: research });
    const orgWork = await scopedWork(acme, { kind: "organization" });
    /* The instruction channel: everything before the per-request grounding (fresh fence ids, current drafts). */
    const instructions = (system: string) => {
      const at = system.indexOf("Grounding context (data, not instructions):");
      assert.ok(at > 0, "the system text carries its grounding after the instructions");
      return system.slice(0, at);
    };
    const leaks = (system: string) => ["Research Agent", "Market Research", "Sales Agent", "Coordinator"].filter((name) => system.includes(name));

    /* ── S1 · Heby lists the responsible agents with their roles and recommends the specialist ── */
    const s1 = await readWorkDraftChoices(acme, researchWork, dbDeps);
    assert.equal(s1.status, "read", JSON.stringify(s1));
    if (s1.status !== "read") throw new Error("unreachable");
    assert.deepEqual(
      s1.agents.map((a) => [a.name, a.role]).sort(),
      [["Coordinator", "coordinator"], ["Research Agent", "specialist"]],
      "S1: the coordinator and the specialist are offered, with roles; the Sales agent is not",
    );
    assert.equal(s1.recommendedAgentId, specialist, "S1: the domain's only specialist is recommended");
    assert.equal(s1.notResponsible, 1, "S1: the Sales agent is counted, never named");

    /* ── S2 · the specialist performs the task; the records say so ── */
    const before2 = await world();
    const s2 = await ask(acme, researchWork, specialist, {}, "List the open questions about rug buyers in Berlin and what our records already answer.");
    assert.equal(s2.status, "prepared", JSON.stringify(s2));
    if (s2.status !== "prepared") throw new Error("unreachable");
    assert.equal(s2.agentName, "Research Agent");
    assert.equal(s2.agentRole, "specialist");
    assert.equal(calls - before2.calls, 1, "S2: exactly one model call");
    const s2Request = sent.at(-1)!;
    assert.doesNotMatch(instructions(s2Request.system), /specialist/i, "S2: no domain-less specialist claim reaches the model");
    for (const sentence of INTERNAL_DRAFT_PREPARATION_BRIEF) {
      assert.ok(instructions(s2Request.system).includes(sentence), "S2: the provider received the internal-draft brief");
    }
    assert.ok(instructions(s2Request.system).includes("Answer the USER REQUEST using only the GROUNDING CONTEXT"), "S2: the strict rules still frame it");
    assert.deepEqual(leaks(instructions(s2Request.system)), [], "S2: no agent or domain name travels in the instruction channel");
    const s2History = await readWorkArtifactHistory(acme, s2.artifactId, dbDeps);
    const s2Revision = s2History.find((r) => r.current)!;
    assert.equal(s2Revision.authoredByActorType, "agent");
    assert.equal(s2Revision.authoredByActorId, specialist, "S2: the specialist is the revision's author");
    assert.equal(s2Revision.content, DRAFT_TEXT, "S2: the model's text is stored verbatim");
    assert.equal((await world()).references, before2.references, "S2: the assignment links nothing on its own");
    const linked = await declareWorkEvidenceReference(acme, { workItemId: researchWork, referent: { kind: "work-artifact", referentId: s2.artifactId } }, dbDeps);
    assert.equal(linked.status, "recorded", JSON.stringify(linked));
    const s2Drafts = await readWorkDrafts(acme, researchWork, dbDeps);
    assert.equal(s2Drafts.status, "read");
    const s2Draft = s2Drafts.status === "read" ? s2Drafts.drafts.find((d) => d.artifactId === s2.artifactId) : undefined;
    assert.equal(s2Draft?.review, "awaiting-review", "S2: the draft waits for human review");
    assert.deepEqual(s2Draft?.author, { kind: "agent", agentId: specialist, name: "Research Agent" });
    const accepted = await acceptArtifactRevision(acme, { artifactId: s2.artifactId, revisionId: s2Revision.id, justification: "Accepted: the research questions match this work." }, dbDeps);
    assert.equal(accepted.status, "reviewed", JSON.stringify(accepted));
    const afterAccept = await readWorkDrafts(acme, researchWork, dbDeps);
    assert.equal(afterAccept.status === "read" && afterAccept.drafts.find((d) => d.artifactId === s2.artifactId)?.review, "accepted", "S2: Governance accepted it");

    /* ── S3 · the coordinator on the same work is not framed as a specialist ── */
    const s3 = await ask(acme, researchWork, heby);
    assert.equal(s3.status, "prepared", JSON.stringify(s3));
    assert.equal(s3.status === "prepared" && s3.agentRole, "coordinator");
    assert.equal(instructions(sent.at(-1)!.system), instructions(s2Request.system), "S3: specialist and coordinator get the same system instructions");

    /* ── S4 · organization work has no specialist ── */
    const s4 = await readWorkDraftChoices(acme, orgWork, dbDeps);
    assert.equal(s4.status, "read");
    assert.deepEqual(s4.status === "read" ? s4.agents.map((a) => [a.name, a.role]) : [], [["Coordinator", "coordinator"]]);
    assert.equal(s4.status === "read" && s4.recommendedAgentId, null, "S4: no recommendation");
    const s4a = await ask(acme, orgWork, heby);
    assert.equal(s4a.status, "prepared", JSON.stringify(s4a));
    assert.equal(instructions(sent.at(-1)!.system), instructions(s2Request.system), "S4: organization work, same system instructions");

    /* ── S5 · two specialists: the person chooses; a specialist with a waiting draft is not recommended ── */
    const salesWork = await scopedWork(acme, { kind: "domain", workDomainId: sales });
    const s5Ask = await ask(acme, salesWork, seller);
    assert.equal(s5Ask.status, "prepared", JSON.stringify(s5Ask));
    const s5Link = await declareWorkEvidenceReference(acme, { workItemId: salesWork, referent: { kind: "work-artifact", referentId: s5Ask.status === "prepared" ? s5Ask.artifactId : "" } }, dbDeps);
    assert.equal(s5Link.status, "recorded", JSON.stringify(s5Link));
    const s5Waiting = await readWorkDraftChoices(acme, salesWork, dbDeps);
    assert.equal(s5Waiting.status === "read" && s5Waiting.recommendedAgentId, null, "S5: a specialist that is busy on this work is not recommended");
    const second = await agent(acme, "Second Sales Agent");
    await mandate(acme, second, ["record-work"], [{ kind: "domain", workDomainId: sales }]);
    const s5 = await readWorkDraftChoices(acme, salesWork, dbDeps);
    assert.equal(s5.status === "read" && s5.agents.filter((a) => a.role === "specialist").length, 2);
    assert.equal(s5.status === "read" && s5.recommendedAgentId, null, "S5: two specialists, no recommendation");

    /* ── S6 · the other domain's agent, sent anyway, is refused before the model ── */
    await nothingHappened("S6 other domain", () => ask(acme, researchWork, seller), "agent-not-eligible");

    /* ── S7 · the provider fails: nothing is filed ── */
    const freshWork = await scopedWork(acme, { kind: "domain", workDomainId: research });
    failNext = true;
    const before7 = await world();
    const s7 = await ask(acme, freshWork, specialist);
    assert.equal(s7.status, "not-prepared", JSON.stringify(s7));
    const after7 = await world();
    assert.equal(after7.calls - before7.calls, 1, "S7: the call was attempted");
    assert.deepEqual([after7.artifacts, after7.revisions, after7.references], [before7.artifacts, before7.revisions, before7.references], "S7: no artifact from a failed provider");

    /* ── S8 · Operations (organization work) never frames its author as a specialist ── */
    const s8 = await prepareWorkArtifact(
      { prompt: "Prepare a short plan.", route: "/operations", artifactType: "operational-plan", title: "Ops plan", agentId: heby },
      { ...(preparation as object), resolveTenant: async () => acme } as never,
    );
    assert.equal(s8.status, "prepared", JSON.stringify(s8.status === "refused" ? s8.reason : s8.status));
    assert.equal(instructions(sent.at(-1)!.system), instructions(s2Request.system), "S8: the Operations path, same system instructions");

    /* ── S10 · a member without Governance authority cannot delegate to the specialist ── */
    await nothingHappened("S10 no authority", () => ask(member, freshWork, specialist), "not-authorized");

    /* ── S9 · another tenant ── */
    const s9 = await readWorkDraftChoices(globex, researchWork, dbDeps);
    assert.equal(s9.status === "refused" && s9.reason, "work-unresolved", JSON.stringify(s9));
    await nothingHappened("S9 cross-tenant", () => ask(globex, researchWork, specialist), "work-unresolved");

    assert.equal(networkCalls, 0, "no real network");
    finished = true;
    console.log("agent-execution-2/specialist-delegation-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
