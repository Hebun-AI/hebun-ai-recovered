"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { createDurableAgentIdentity } from "@/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "@/features/agent-identity/retire-durable-agent-identity.server";
/*
 * The RESULT SHAPES come from the contracts modules, not from the writers. Those two files declare
 * types and refusal codes and nothing else — no database handle, no query, no authority — so
 * importing them widens this boundary's reach by exactly nothing.
 */
import type { CreateDurableAgentIdentityResult } from "@/features/agent-identity/contracts";
import type { RetireDurableAgentIdentityResult } from "@/features/agent-identity/retirement-contracts";
import { establishAgentMandate } from "@/features/agent-mandate/establish-agent-mandate.server";
import type { EstablishAgentMandateResult } from "@/features/agent-mandate/contracts";
import { fileImprovementHypothesis } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";
import type { HypothesisResult } from "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";

/*
 * ── THE AGENT-ID-0.1 BOUNDARY ───────────────────────────────────────────────────────────────────
 *
 * The ONLY client-crossable way to reach the durable agent identity authority. It is deliberately
 * thin, and it holds no gate of its own — every refusal below is produced by the authority itself,
 * so this boundary cannot drift from the rules it fronts.
 *
 * WHAT THE CLIENT MAY SEND. A name, to create. An identifier, to retire. That is the whole payload.
 *
 * WHAT THE CLIENT CANNOT SEND, BECAUSE NO FIELD EXISTS FOR IT: tenant id, owner id, owner actor
 * type, created_by, created_by_type, manager, department, authority ceiling, role, permission,
 * credential, session, lifecycle status, retirement timestamp, retiring actor, execution capability,
 * governance state, successor. The types make every one of them unrepresentable; the authorities
 * resolve the tenant and the human from the R1 session and stamp their own clock.
 *
 * FAIL CLOSED. `resolveTenantContext()` returns `null` for an unauthenticated request and for an
 * unconfigured environment alike. That null is passed straight through, and both authorities refuse
 * `no-authorized-tenant-context` on it. There is no fallback identity, no anonymous tenant, and no
 * demo path — an unreachable authority is refused, never simulated.
 *
 * WHAT THESE ACTIONS DO NOT DO. They issue no credential, open no session, grant no permission,
 * assign no role, authorize no action, widen no Governance subject type, start no runtime and
 * execute nothing. Creating an identity and retiring one are the only two effects reachable here,
 * and neither of the authorities behind them imports a credential, session, permit, decision or
 * execution module.
 *
 * WHAT THESE ACTIONS ARE NOT. They are not the in-memory Agent Registry simulation. That subsystem
 * (`features/agent-crud`, over the "memory" persistence provider) is a client-side Command Bus
 * exercise that writes no database row; it is unchanged, unreachable from here, and labelled as
 * simulation at every control it offers.
 */

/**
 * ESTABLISH this tenant's first durable agent identity (AGENT-ID-0's ceremony).
 *
 * A ONE-SHOT. A tenant that already possesses a durable agent identity — including a RETIRED one —
 * is refused `agent-identity-already-exists`, because retirement leaves the row in place and the
 * genesis count is existence, not health.
 */
export async function createDurableAgentIdentityAction(input: {
  name: string;
}): Promise<CreateDurableAgentIdentityResult> {
  const tenant = await resolveTenantContext();
  const result = await createDurableAgentIdentity(tenant, { name: input?.name });
  if (result.status === "established") revalidatePath("/agents");
  return result;
}

/**
 * RETIRE a durable agent identity, on the authority of the human who owns it.
 *
 * The identifier is the only client-shaped value, and it is a LOOKUP KEY, never authority: an id
 * belonging to another organization selects no row and is refused `agent-identity-not-found`,
 * indistinguishably from an id that does not exist.
 *
 * Retirement is a WITHDRAWAL, not a deletion. Nothing is removed, no history is erased, the tenant
 * does not return to "no agent has ever existed", and no successor is created. There is no action in
 * this file that reinstates a retired identity, because no such authority was written.
 */
export async function retireDurableAgentIdentityAction(input: {
  agentId: string;
}): Promise<RetireDurableAgentIdentityResult> {
  const tenant = await resolveTenantContext();
  const result = await retireDurableAgentIdentity(tenant, { agentId: input?.agentId });
  if (result.status === "retired") revalidatePath("/agents");
  return result;
}

/*
 * ── SIA-3.1: FILING ONE IMPROVEMENT HYPOTHESIS ──────────────────────────────────────────────────
 *
 * The first product write path SIA-3 has ever had. SIA-3 shipped its authority, its persistence and
 * its Governance integration with nothing that could reach them; this action is that reach, and it
 * is deliberately the thinnest possible one.
 *
 * IT IS TRANSPORT, NOT AUTHORITY. It resolves the tenant, calls the ONE released writer, and
 * returns what that writer said. It holds no gate: every refusal below is produced inside
 * `fileImprovementHypothesis`, so this boundary cannot drift from the rules it fronts, and it
 * contains no INSERT of its own — the census that proves exactly one module writes a hypothesis is
 * unchanged by this file's existence.
 *
 * WHAT THE CLIENT MAY SEND, EXHAUSTIVELY: which agent, which closed target, which closed evidence
 * finding, three pieces of prose, and optionally which earlier hypothesis this replaces.
 *
 * WHAT THE CLIENT CANNOT SEND, BECAUSE NO FIELD EXISTS FOR IT: the tenant, the author, the author's
 * actor type, the evidence counts, the evidence source column, the instant the evidence was read,
 * any timestamp, any Governance decision, outcome, approval or authority, any agent configuration,
 * and any lifecycle or version value. The evidence in particular is READ by the writer at write
 * time through SIA-1's released seams — there is no parameter through which a count could be
 * supplied, so fabricated evidence is unrepresentable here rather than filtered downstream.
 *
 * AUTHORSHIP IS HUMAN, AND STRUCTURALLY SO. The writer stamps `proposed_by_actor_type = 'human'`
 * from the resolved session, and a database CHECK refuses anything else. This action adds no way
 * for an agent, a service or a system actor to author a hypothesis, because the authority it fronts
 * has none.
 *
 * FILING IS NOT DECIDING. This writes no `decision_records` row and imports no Governance module.
 * A filed hypothesis is UNDECIDED, which is a legitimate resting state SIA-3 established — the
 * decision is a separate act, by a separate authority, on `/governance/authority`.
 *
 * FILING TWICE WRITES TWO HYPOTHESES. There is no deduplication here and none in the writer, and
 * that is a decision rather than an omission: nothing in this repository defines when two arguments
 * are the same argument, and silently discarding the second would answer that question on the
 * author's behalf. Accidental double-submit is prevented where it is actually created — the control
 * is disabled while its transition is pending — and replacing an earlier hypothesis has its own
 * representation, `supersedesHypothesisId`, which withdraws nothing.
 *
 * HEBY CANNOT REACH THIS FILE. Heby's server actions do not import this module, so no message,
 * model answer, slash command or voice transcript has a representation in which it could file a
 * hypothesis about the agent it is running as.
 */
export async function fileImprovementHypothesisAction(input: {
  readonly agentId: string;
  readonly improvementTarget: string;
  readonly evidenceFindingKey: string;
  readonly candidateChange: string;
  readonly expectedEffect: string;
  readonly limitations: string;
  readonly supersedesHypothesisId?: string | null;
}): Promise<HypothesisResult> {
  const tenant = await resolveTenantContext();
  const result = await fileImprovementHypothesis(tenant, {
    agentId: String(input?.agentId ?? ""),
    improvementTarget: String(input?.improvementTarget ?? ""),
    evidenceFindingKey: String(input?.evidenceFindingKey ?? ""),
    candidateChange: String(input?.candidateChange ?? ""),
    expectedEffect: String(input?.expectedEffect ?? ""),
    limitations: String(input?.limitations ?? ""),
    supersedesHypothesisId:
      typeof input?.supersedesHypothesisId === "string" ? input.supersedesHypothesisId : null,
  });
  if (result.status === "filed") revalidatePath("/agents");
  return result;
}

/*
 * ── AMA-3: ESTABLISHING OR REVISING ONE AGENT MANDATE ───────────────────────────────────────────
 *
 * The first product write path Agent Mandate Authority has ever had. AMA-1 shipped the authority,
 * its persistence, its Governance binding and its audit sibling with nothing that could reach them;
 * AMA-2 made the recorded ceiling actually refuse agent proposals. Until this action, every mandate
 * in existence had been written by a test or a script — the authority was live and unreachable.
 *
 * IT IS TRANSPORT, NOT AUTHORITY. It resolves the tenant, calls the ONE released writer, and
 * returns what that writer said. It holds no gate: every refusal is produced inside
 * `establishAgentMandate`, so this boundary cannot drift from the rules it fronts, and it contains
 * no INSERT of its own — AMA-1's census that exactly one module writes `agent_mandates` is
 * unchanged by this file's existence.
 *
 * WHAT THE CLIENT MAY SEND, EXHAUSTIVELY: which agent, a purpose, a proposal scope, a
 * justification, and the revision the human was shown.
 *
 * WHAT THE CLIENT CANNOT SEND, BECAUSE NO FIELD EXISTS FOR IT: the tenant, the actor, the actor's
 * type, the Governance authority, the Governance decision id, the Governance session id, the
 * revision ordinal, the predecessor mandate id, `effective_from`, any timestamp, any audit row, any
 * permit, any lifecycle or agent field. Every one of those is derived by the writer inside its own
 * transaction. The types make them unrepresentable here rather than filtered downstream.
 *
 * THE SCOPE IS NOT VALIDATED HERE, DELIBERATELY. `canonicaliseMandateScope` refuses a scope naming
 * anything outside the released vocabulary WHOLE, and never narrows it — silently dropping an
 * inadmissible member would record a mandate nobody authorized. Re-checking here would create a
 * second opinion about what is admissible, and the second opinion is always the one that drifts.
 * The UI offers only the released vocabulary; the writer is what enforces it.
 *
 * AUTHORITY IS GOVERNANCE'S, AND STRUCTURALLY SO. The writer resolves `resolveGovernanceAuthority`
 * and refuses `no-governance-authority` or `not-the-governance-authority`. A tenant owner without
 * Governance authority is refused exactly like a stranger, and this action adds no path around it.
 *
 * CONCURRENCY FAILS CLOSED. `observedMandateRevision` is the revision the human was actually shown.
 * A ceiling revised by somebody else in the meantime is refused `stale-mandate-revision`, never
 * merged and never overwritten — K4's rule, that a compare-and-swap can only ever REFUSE.
 *
 * WITHDRAWAL IS AN EMPTY SCOPE, NOT A BOOLEAN AND NOT A LIFECYCLE. It is the same one transition,
 * recorded as a new revision, and there is no separate withdraw action here because no such
 * authority was written.
 *
 * ESTABLISHING A MANDATE AUTHORIZES NOTHING. It writes no permit, starts no execution, reaches no
 * provider, mutates no agent row and grants no permission. It can only ever SUBTRACT from what the
 * agent could already propose.
 *
 * HEBY CANNOT REACH THIS FILE. Heby's server actions do not import this module, and Heby's
 * grounding imports the mandate READ seam only — so no message, model answer, slash command or
 * voice transcript has a representation in which Heby could bound, widen or withdraw its own
 * mandate.
 */
export async function establishAgentMandateAction(input: {
  readonly agentId: string;
  readonly purpose: string;
  readonly proposalScope: readonly string[];
  readonly justification: string;
  readonly observedMandateRevision: number | null;
}): Promise<EstablishAgentMandateResult> {
  const tenant = await resolveTenantContext();
  const result = await establishAgentMandate(tenant, {
    agentId: String(input?.agentId ?? ""),
    purpose: String(input?.purpose ?? ""),
    proposalScope: Array.isArray(input?.proposalScope) ? input.proposalScope.map(String) : [],
    justification: String(input?.justification ?? ""),
    observedMandateRevision:
      typeof input?.observedMandateRevision === "number" ? input.observedMandateRevision : null,
  });
  if (result.status === "established") revalidatePath("/agents");
  return result;
}
