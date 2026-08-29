/*
 * SELF-IMPROVING-AGENTS-3 — improvement hypotheses, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Hebun can observe, evaluate, form an evidence-backed hypothesis about ONE durable agent's
 *    selection behaviour, and submit it to Governance — without being able to apply it, approve it
 *    itself, or claim it worked. The evidence is READ by the writer rather than accepted from the
 *    caller. Another tenant's agent cannot be named. A decision is a Governance record and never a
 *    column here. And an approved hypothesis changes nothing."
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no credential.
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import {
  resolveAgentProposer,
  type AgentProposer,
} from "../../src/features/action-authorization/agent-proposer.server";
import {
  registerInvocation,
  finalizeInvocation,
} from "../../src/features/agent-origination/invocation-provenance.server";
import { fileImprovementHypothesis } from "../../src/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";
import { decideImprovementHypothesis } from "../../src/features/agent-improvement-hypothesis/decide-improvement-hypothesis.server";
import { readImprovementHypotheses } from "../../src/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";
import { IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE } from "../../src/features/agent-improvement-hypothesis/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "This external message is a deliberate organizational act and I accept responsibility for it.";
const DECISION_JUSTIFICATION =
  "The observed selection-invalid rate is worth investigating, and I authorize an investigation only.";

const CANDIDATE =
  "Narrow the action vocabulary offered to this agent so the closed contract is easier to satisfy.";
const EFFECT = "Fewer selections rejected by the contract, measured on the same recorded column.";
const LIMITS = "It does not know why the output failed to parse, and it may change nothing at all.";

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
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
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
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sia3_hypothesis");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE MIGRATION IS APPLIED, AND CARRIES NO EXECUTION TRUTH.
     * ═════════════════════════════════════════════════════════════════════ */
    const columns = await setup.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
        where table_name = 'agent_improvement_hypotheses' order by column_name`,
    );
    assert.ok(columns.rows.length > 0, "the hypothesis table exists");
    const names = columns.rows.map((r) => r.column_name);

    /*
     * THE ABSENT COLUMNS ARE THE POINT. Every one of these would be a fact SIA-3 cannot prove, and
     * a nullable column nobody writes is indistinguishable from one somebody forgot to write.
     */
    for (const forbidden of [
      "status",
      "applied_at",
      "rolled_back_at",
      "approved_at",
      "decision_record_id",
      "governance_session_id",
      "score",
      "confidence",
      "success_probability",
      "business_impact",
    ]) {
      assert.ok(
        !names.includes(forbidden),
        `the hypothesis carries no '${forbidden}' — SIA-3 cannot prove that fact`,
      );
    }

    /* The subject and the evidence are REQUIRED. A hypothesis about nobody is not a hypothesis. */
    for (const required of [
      "agent_id",
      "improvement_target",
      "evidence_finding_key",
      "evidence_source",
      "evidence_observed_value",
      "evidence_observed_total",
      "evidence_observed_at",
      "candidate_change",
      "expected_effect",
      "limitations",
      "proposed_by_actor_type",
      "proposed_by_actor_id",
    ]) {
      const row = columns.rows.find((r) => r.column_name === required);
      assert.ok(row, `${required} exists`);
      assert.equal(row!.is_nullable, "NO", `${required} is NOT NULL`);
    }

    const fk = await setup.query<{ n: number }>(
      `select count(*)::int as n from information_schema.table_constraints
        where constraint_name = 'agent_improvement_hypotheses_tenant_agent_fk'
          and constraint_type = 'FOREIGN KEY'`,
    );
    assert.equal(fk.rows[0]!.n, 1, "the composite tenant-safe foreign key exists");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH GOVERNANCE AND A DURABLE AGENT.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-sia3",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-sia3",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "sia3-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "sia3-globex");

    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [globex, globexCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status,
        "established",
      );
    }

    assert.equal(
      (await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, baseDeps)).status,
      "established",
    );
    assert.equal(
      (await createDurableAgentIdentity(globexCtx, { name: "Globex Agent" }, baseDeps)).status,
      "established",
    );

    const resolve = async (ctx: TenantContext): Promise<AgentProposer> => {
      const r = await resolveAgentProposer(ctx, baseDeps);
      assert.equal(r.status, "resolved");
      if (r.status !== "resolved") throw new Error("unreachable");
      return r.proposer;
    };
    const acmeProposer = await resolve(acmeCtx);
    const globexProposer = await resolve(globexCtx);
    const acmeAgentId = acmeProposer.agentId;
    const globexAgentId = globexProposer.agentId;

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. NO EVIDENCE YET ⇒ REFUSED. An absence is never stored as a clean record.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const early = await fileImprovementHypothesis(
        acmeCtx,
        {
          agentId: acmeAgentId,
          improvementTarget: "selection-behaviour",
          evidenceFindingKey: "selection-invalid",
          candidateChange: CANDIDATE,
          expectedEffect: EFFECT,
          limitations: LIMITS,
        },
        baseDeps,
      );
      assert.equal(early.status, "refused");
      if (early.status === "refused") {
        assert.equal(
          early.reason,
          "no-evidence-yet",
          "a hypothesis resting on a zero denominator is refused, never filed citing zero",
        );
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. REAL EVIDENCE, THROUGH THE RELEASED ORIGINATION WRITER.
     *
     * Four attributed calls for Acme: two that FAILED THE CONTRACT, one that chose no action, one
     * that was valid. None of the first three produced a proposal — which is exactly the evidence
     * SIA-2.6 made attributable and SIA-3 exists to reason about.
     * ═════════════════════════════════════════════════════════════════════ */
    const invoke = async (
      ctx: TenantContext,
      proposer: AgentProposer,
      state: "selection-invalid" | "no-action" | "selection-valid",
    ): Promise<void> => {
      const id = await registerInvocation(ctx, { transport: "fake", proposer }, baseDeps);
      assert.ok(id, "an invocation must register");
      await finalizeInvocation(
        ctx,
        { invocationId: id!, state, filingOutcome: "not-attempted" },
        baseDeps,
      );
    };
    await invoke(acmeCtx, acmeProposer, "selection-invalid");
    await invoke(acmeCtx, acmeProposer, "selection-invalid");
    await invoke(acmeCtx, acmeProposer, "no-action");
    await invoke(acmeCtx, acmeProposer, "selection-valid");
    /* Globex gets its own, so a cross-tenant leak would show up as a wrong NUMBER, not just a miss. */
    await invoke(globexCtx, globexProposer, "selection-invalid");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE EVIDENCE IS READ BY THE WRITER, NOT ACCEPTED FROM THE CALLER.
     * ═════════════════════════════════════════════════════════════════════ */
    const filed = await fileImprovementHypothesis(
      acmeCtx,
      {
        agentId: acmeAgentId,
        improvementTarget: "selection-behaviour",
        evidenceFindingKey: "selection-invalid",
        candidateChange: CANDIDATE,
        expectedEffect: EFFECT,
        limitations: LIMITS,
      },
      baseDeps,
    );
    assert.equal(filed.status, "filed");
    if (filed.status !== "filed") throw new Error("unreachable");

    const stored = await setup.query<{
      value: number;
      total: number;
      source: string;
      actorType: string;
      actorId: string;
      agentId: string;
      target: string;
    }>(
      `select evidence_observed_value as "value", evidence_observed_total as "total",
              evidence_source as "source", proposed_by_actor_type as "actorType",
              proposed_by_actor_id as "actorId", agent_id as "agentId",
              improvement_target as "target"
         from agent_improvement_hypotheses where id = $1`,
      [filed.hypothesisId],
    );
    const row = stored.rows[0]!;
    /*
     * FOUR ATTRIBUTED CALLS FOR ACME, TWO OF THEM CONTRACT-INVALID. Globex's invocation is not in
     * either number — the tenant predicate holds, and the count would be 5 if it did not.
     */
    assert.equal(Number(row.value), 2, "the numerator is what the released seam actually reported");
    assert.equal(Number(row.total), 4, "and the denominator is this agent's attributed calls");
    assert.equal(row.source, "heby_origination_invocations.state", "the authoritative column, named");
    assert.equal(row.agentId, acmeAgentId, "the subject is the tenant's own agent");
    assert.equal(row.target, "selection-behaviour");
    /* THE ACTUAL AUTHOR: a human. Never the agent the hypothesis is about. */
    assert.equal(row.actorType, "human");
    assert.equal(row.actorId, acme.userId);
    assert.notEqual(row.actorId, row.agentId, "the author is not the subject");

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. ANOTHER TENANT'S AGENT CANNOT BE NAMED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const cross = await fileImprovementHypothesis(
        acmeCtx,
        {
          agentId: globexAgentId,
          improvementTarget: "selection-behaviour",
          evidenceFindingKey: "selection-invalid",
          candidateChange: CANDIDATE,
          expectedEffect: EFFECT,
          limitations: LIMITS,
        },
        baseDeps,
      );
      assert.equal(cross.status, "refused");
      if (cross.status === "refused") {
        assert.equal(
          cross.reason,
          "agent-unresolvable",
          "another tenant's agent is indistinguishable from one that never existed",
        );
      }
    }

    /* The closed vocabularies are refused before anything is read. */
    for (const [field, bad, reason] of [
      ["improvementTarget", "prompt", "invalid-improvement-target"],
      ["improvementTarget", "preferred-model", "invalid-improvement-target"],
      ["improvementTarget", "tool-permission", "invalid-improvement-target"],
      ["evidenceFindingKey", "business-outcome", "invalid-evidence-finding"],
    ] as const) {
      const bad_ = await fileImprovementHypothesis(
        acmeCtx,
        {
          agentId: acmeAgentId,
          improvementTarget: field === "improvementTarget" ? bad : "selection-behaviour",
          evidenceFindingKey: field === "evidenceFindingKey" ? bad : "selection-invalid",
          candidateChange: CANDIDATE,
          expectedEffect: EFFECT,
          limitations: LIMITS,
        },
        baseDeps,
      );
      assert.equal(bad_.status, "refused");
      if (bad_.status === "refused") assert.equal(bad_.reason, reason, `${bad} is refused`);
    }

    /* A hypothesis with no stated limitation is being presented as a finding. */
    {
      const noLimits = await fileImprovementHypothesis(
        acmeCtx,
        {
          agentId: acmeAgentId,
          improvementTarget: "selection-behaviour",
          evidenceFindingKey: "selection-invalid",
          candidateChange: CANDIDATE,
          expectedEffect: EFFECT,
          limitations: "   ",
        },
        baseDeps,
      );
      assert.equal(noLimits.status, "refused");
      if (noLimits.status === "refused") assert.equal(noLimits.reason, "hypothesis-prose-required");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. A HYPOTHESIS EXISTS BEFORE ANY GOVERNANCE DECISION, AND READS AS UNDECIDED.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const read = await readImprovementHypotheses(acmeCtx, baseDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      assert.equal(read.hypotheses.length, 1);
      const view = read.hypotheses[0]!;
      assert.equal(view.decision.status, "undecided", "undecided is a THIRD state, not a rejection");
      assert.equal(view.agentName, "Heby");
      assert.equal(view.evidenceObservedValue, 2);
      assert.equal(view.evidenceObservedTotal, 4);
      assert.equal(view.supersededByCount, 0);
    }

    /* And the other tenant sees none of it. */
    {
      const other = await readImprovementHypotheses(globexCtx, baseDeps);
      assert.equal(other.status, "read");
      if (other.status !== "read") throw new Error("unreachable");
      assert.equal(other.hypotheses.length, 0, "tenant isolation on the read seam");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. ONLY A GOVERNANCE AUTHORITY DECIDES. SIA-3 CANNOT APPROVE ITSELF.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      /* Globex's authority is not Acme's, and the hypothesis is not even visible to it. */
      const foreign = await decideImprovementHypothesis(
        globexCtx,
        { hypothesisId: filed.hypothesisId, decision: "approve", justification: DECISION_JUSTIFICATION },
        baseDeps,
      );
      assert.equal(foreign.status, "refused");
      if (foreign.status === "refused") assert.equal(foreign.reason, "hypothesis-unresolvable");
    }

    const decided = await decideImprovementHypothesis(
      acmeCtx,
      { hypothesisId: filed.hypothesisId, decision: "approve", justification: DECISION_JUSTIFICATION },
      baseDeps,
    );
    assert.equal(decided.status, "decided");
    if (decided.status !== "decided") throw new Error("unreachable");

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE DECISION IS A GOVERNANCE RECORD — AND THE HYPOTHESIS ROW DID NOT MOVE.
     * ═════════════════════════════════════════════════════════════════════ */
    const ledger = await setup.query<{
      subjectType: string;
      subjectId: string;
      outcome: string;
      domain: string;
      actorType: string;
      bootstrap: boolean;
    }>(
      `select d.subject_type as "subjectType", d.subject_id as "subjectId", d.outcome,
              s.governance_domain as "domain", d.actor_type as "actorType", d.bootstrap
         from decision_records d join governance_sessions s on s.id = d.session_id
        where d.id = $1`,
      [decided.decisionId],
    );
    const ledgerRow = ledger.rows[0]!;
    assert.equal(ledgerRow.subjectType, IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE);
    assert.equal(ledgerRow.subjectId, filed.hypothesisId);
    /*
     * THE OUTCOME WORD IS `accepted`, NOT `approved`. What a human accepted is a HYPOTHESIS, and a
     * ledger row read years later must not suggest an improvement was made.
     */
    assert.equal(ledgerRow.outcome, "improvement-hypothesis-accepted");
    assert.ok(!/applied|improved|succeeded/.test(ledgerRow.outcome), "and it claims no application");
    assert.equal(ledgerRow.domain, "learning");
    assert.equal(ledgerRow.actorType, "human", "only a human decides");
    assert.equal(ledgerRow.bootstrap, false, "never a genesis");

    /*
     * AND THE HYPOTHESIS ROW IS BYTE-FOR-BYTE WHAT IT WAS. This is what "HYPOTHESIS STATUS ≠
     * GOVERNANCE DECISION" means in practice: an approval wrote nothing here, so there is no second
     * copy to disagree with the ledger.
     */
    const after = await setup.query<{ n: number }>(
      `select count(*)::int as n from agent_improvement_hypotheses
        where id = $1 and updated_at = created_at and version = 1`,
      [filed.hypothesisId],
    );
    assert.equal(after.rows[0]!.n, 1, "the decision changed nothing on the hypothesis row");

    /* One decision per hypothesis. There is no re-deciding and no reversal. */
    {
      const again = await decideImprovementHypothesis(
        acmeCtx,
        { hypothesisId: filed.hypothesisId, decision: "reject", justification: DECISION_JUSTIFICATION },
        baseDeps,
      );
      assert.equal(again.status, "refused");
      if (again.status === "refused") assert.equal(again.reason, "already-decided");
    }

    /* The read now reports the decision BY REFERENCE, and says it is not an application. */
    {
      const read = await readImprovementHypotheses(acmeCtx, baseDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      const view = read.hypotheses[0]!;
      assert.equal(view.decision.status, "decided");
      if (view.decision.status !== "decided") throw new Error("unreachable");
      assert.equal(view.decision.decisionId, decided.decisionId);
      assert.equal(view.decision.accepted, true);
      assert.equal(view.decision.outcome, "improvement-hypothesis-accepted");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. AN APPROVED HYPOTHESIS CHANGED NO AGENT. THE WHOLE PHASE RESTS ON THIS.
     * ═════════════════════════════════════════════════════════════════════ */
    const agentAfter = await setup.query<{ n: number }>(
      `select count(*)::int as n from agents where tenant_id = $1 and version = 1
         and updated_at = created_at and retired_at is null`,
      [acme.tenantId],
    );
    assert.equal(agentAfter.rows[0]!.n, 1, "the agent row is untouched by an approved hypothesis");

    /* No permit, no execution attempt, no learning session, no memory came into existence. */
    for (const table of [
      "action_permits",
      "action_execution_attempts",
      "learning_sessions",
      "improvement_proposals",
      "memories",
    ]) {
      const count = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(count.rows[0]!.n, 0, `${table} is still empty — SIA-3 wrote nothing there`);
    }

    /*
     * `improvement_proposals` IN PARTICULAR STAYS DEAD. SIA-3 measured it, refused it, and did not
     * quietly start writing it — a second source of truth is exactly what this phase avoided.
     */

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. SUPERSESSION IS LINEAGE, NOT WITHDRAWAL.
     * ═════════════════════════════════════════════════════════════════════ */
    const successor = await fileImprovementHypothesis(
      acmeCtx,
      {
        agentId: acmeAgentId,
        improvementTarget: "selection-behaviour",
        evidenceFindingKey: "no-action",
        candidateChange: CANDIDATE,
        expectedEffect: EFFECT,
        limitations: LIMITS,
        supersedesHypothesisId: filed.hypothesisId,
      },
      baseDeps,
    );
    assert.equal(successor.status, "filed");
    if (successor.status !== "filed") throw new Error("unreachable");

    {
      const read = await readImprovementHypotheses(acmeCtx, baseDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      assert.equal(read.hypotheses.length, 2);
      const predecessor = read.hypotheses.find((h) => h.hypothesisId === filed.hypothesisId)!;
      /*
       * THE PREDECESSOR IS STILL DECIDED AND STILL SAYS WHAT IT SAID. Being superseded neither
       * withdrew it nor altered its evidence — a record a later write could edit was never a record.
       */
      assert.equal(predecessor.supersededByCount, 1);
      assert.equal(predecessor.decision.status, "decided");
      assert.equal(predecessor.evidenceObservedValue, 2);
      const later = read.hypotheses.find((h) => h.hypothesisId === successor.hypothesisId)!;
      assert.equal(later.supersedesHypothesisId, filed.hypothesisId);
      assert.equal(later.decision.status, "undecided", "a successor is not decided by inheritance");
      /* `no-action` is 1 of 4 — a different finding drawing a different pair from the same seam. */
      assert.equal(later.evidenceObservedValue, 1);
      assert.equal(later.evidenceObservedTotal, 4);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10b. REJECTION IS ITS OWN AUTHORITATIVE RECORD, WITH ITS OWN OUTCOME.
     *
     * Tested separately from approval and not inferred from it. A ledger that recorded only
     * acceptances would make every refusal look like an absence, and "declined" and "never asked"
     * are different facts about a hypothesis.
     * ═════════════════════════════════════════════════════════════════════ */
    const declined = await decideImprovementHypothesis(
      acmeCtx,
      {
        hypothesisId: successor.hypothesisId,
        decision: "reject",
        justification: "The observed no-action count reflects correct behaviour, so there is nothing to pursue.",
      },
      baseDeps,
    );
    assert.equal(declined.status, "decided");
    if (declined.status !== "decided") throw new Error("unreachable");

    const declinedLedger = await setup.query<{ outcome: string; subjectType: string; domain: string }>(
      `select d.outcome, d.subject_type as "subjectType", s.governance_domain as "domain"
         from decision_records d join governance_sessions s on s.id = d.session_id
        where d.id = $1`,
      [declined.decisionId],
    );
    assert.equal(declinedLedger.rows[0]!.outcome, "improvement-hypothesis-declined");
    assert.equal(declinedLedger.rows[0]!.subjectType, IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE);
    assert.equal(declinedLedger.rows[0]!.domain, "learning");

    {
      const read = await readImprovementHypotheses(acmeCtx, baseDeps);
      assert.equal(read.status, "read");
      if (read.status !== "read") throw new Error("unreachable");
      const rejected = read.hypotheses.find((h) => h.hypothesisId === successor.hypothesisId)!;
      assert.equal(rejected.decision.status, "decided");
      if (rejected.decision.status !== "decided") throw new Error("unreachable");
      /*
       * `accepted` IS FALSE, AND IT IS COMPUTED FROM THE OUTCOME CONSTANT rather than from "not
       * rejected". A future third outcome would read as not-accepted rather than being silently
       * treated as an acceptance.
       */
      assert.equal(rejected.decision.accepted, false);
      assert.equal(rejected.decision.outcome, "improvement-hypothesis-declined");
      /* And the rejected hypothesis is still ON THE RECORD, with its evidence intact. */
      assert.equal(rejected.evidenceObservedValue, 1);
      assert.equal(rejected.evidenceObservedTotal, 4);
    }

    /* A rejected hypothesis is not re-decidable either. */
    {
      const again = await decideImprovementHypothesis(
        acmeCtx,
        { hypothesisId: successor.hypothesisId, decision: "approve", justification: DECISION_JUSTIFICATION },
        baseDeps,
      );
      assert.equal(again.status, "refused");
      if (again.status === "refused") assert.equal(again.reason, "already-decided");
    }

    /* A hypothesis may not name another tenant's hypothesis as its predecessor. */
    {
      const crossLineage = await fileImprovementHypothesis(
        globexCtx,
        {
          agentId: globexAgentId,
          improvementTarget: "selection-behaviour",
          evidenceFindingKey: "selection-invalid",
          candidateChange: CANDIDATE,
          expectedEffect: EFFECT,
          limitations: LIMITS,
          supersedesHypothesisId: filed.hypothesisId,
        },
        baseDeps,
      );
      assert.equal(crossLineage.status, "refused");
      if (crossLineage.status === "refused") {
        assert.equal(crossLineage.reason, "supersedes-unresolvable");
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. A RETIRED AGENT IS REFUSED — and its history stays readable.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.equal(
        (
          await retireDurableAgentIdentity(globexCtx, { agentId: globexAgentId }, baseDeps)
        ).status,
        "retired",
      );
      const retired = await fileImprovementHypothesis(
        globexCtx,
        {
          agentId: globexAgentId,
          improvementTarget: "selection-behaviour",
          evidenceFindingKey: "selection-invalid",
          candidateChange: CANDIDATE,
          expectedEffect: EFFECT,
          limitations: LIMITS,
        },
        baseDeps,
      );
      assert.equal(retired.status, "refused");
      if (retired.status === "refused") assert.equal(retired.reason, "agent-retired");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. THE DATABASE REFUSES WHAT THE WRITER WOULD NEVER SEND.
     *
     * Asserted against real constraints, because a guard that exists only in TypeScript is a guard
     * a future writer can forget.
     * ═════════════════════════════════════════════════════════════════════ */
    const rejects = async (sqlText: string, params: unknown[], why: string): Promise<void> => {
      let threw = false;
      try {
        await setup.query(sqlText, params as never[]);
      } catch {
        threw = true;
      }
      assert.ok(threw, why);
    };
    const insert = `insert into agent_improvement_hypotheses
       (tenant_id, agent_id, improvement_target, evidence_finding_key, evidence_source,
        evidence_observed_value, evidence_observed_total, evidence_observed_at,
        candidate_change, expected_effect, limitations, proposed_by_actor_type, proposed_by_actor_id)
       values ($1,$2,$3,$4,'heby_origination_invocations.state',$5,$6, now(), 'c','e','l',$7,$8)`;

    await rejects(
      insert,
      [acme.tenantId, acmeAgentId, "prompt", "selection-invalid", 1, 4, "human", acme.userId],
      "a prompt-mutation target is UNREPRESENTABLE, not merely unwritten",
    );
    await rejects(
      insert,
      [acme.tenantId, acmeAgentId, "selection-behaviour", "business-outcome", 1, 4, "human", acme.userId],
      "evidence Hebun does not hold cannot be cited",
    );
    await rejects(
      insert,
      [acme.tenantId, acmeAgentId, "selection-behaviour", "selection-invalid", 9, 3, "human", acme.userId],
      "a part cannot exceed its whole",
    );
    await rejects(
      insert,
      [acme.tenantId, acmeAgentId, "selection-behaviour", "selection-invalid", 1, 4, "agent", acmeAgentId],
      "an AGENT cannot author a hypothesis about itself — the database refuses it",
    );
    await rejects(
      insert,
      [acme.tenantId, globexAgentId, "selection-behaviour", "selection-invalid", 1, 4, "human", acme.userId],
      "the composite key refuses another tenant's agent even by raw SQL",
    );

    console.log("sia3-improvement-hypothesis/hypothesis-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
