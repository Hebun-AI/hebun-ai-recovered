/*
 * agent-evaluation/agent-evaluation-projection.server.ts — the derived evaluation over SIA-1's
 * observation (SELF-IMPROVING-AGENTS-2).
 *
 * ── IT IS A SECOND READER, NEVER A SECOND SOURCE OF TRUTH ────────────────────
 *
 * This module issues NO statement. It calls `readAgentOutcomeObservation` — the released SIA-1
 * projection — and interprets what comes back. It does not re-read proposals, permits, attempts or
 * invocations, and it holds no handle through which it could: a second query stack over the same
 * rows would be a second answer to "what did this agent do", and the two could disagree.
 *
 * The consequence worth stating: SIA-2 inherits every bound, every tenant predicate and every
 * truncation disclosure SIA-1 established, because it inherits SIA-1's answer whole.
 *
 * ── WHAT "EVALUATION" MEANS HERE, AND WHY IT IS SO NARROW ────────────────────
 *
 * Hebun holds no record of delivery, no record of business outcome, no definition of a good
 * decision, and no writer for the agent's own performance-target column. So the honest evaluation
 * is not a verdict on the agent — it is a statement of how complete Hebun's records about that
 * agent are.
 *
 * Every derived figure below is therefore a COVERAGE measure, and each one is built so that its
 * numerator cannot be mistaken for a success count:
 *
 *   decisionCoverage           how much of what the agent filed has been decided — by EITHER outcome
 *   authorizationFollowThrough how many authorized acts have an attempt — succeeded or not
 *   executionResolution        how many attempts reached a CONFIRMED outcome — failures included
 *   provenanceCoverage         for how many proposals the causing model call is nameable
 *   usageReportingCoverage     for how many invocations the provider reported complete usage
 *
 * `executionResolution` is the load-bearing example. Its numerator deliberately counts `failed` and
 * `refused` alongside `accepted`, because what it measures is whether Hebun KNOWS what happened —
 * not whether the news was good. A reader who mistakes it for a success rate will find failures in
 * the numerator, which is the fastest possible correction.
 *
 * ── NO QUOTIENT EXISTS ───────────────────────────────────────────────────────
 *
 * Nothing in this module divides. A derived metric carries a numerator and a denominator and
 * stops. That is not a style preference: every plausible quotient here asserts something Hebun
 * cannot support, and a representation that cannot express a percentage cannot leak one.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readAgentOutcomeObservation,
  type AgentOutcomeObservation,
  type AgentOutcomeObservationRead,
} from "@/features/agent-outcome-observation/agent-outcome-projection.server";
import type { AgentOutcomeFactsDeps } from "@/features/agent-outcome-observation/read-agent-outcome-facts.server";
import {
  shareAvailability,
  UNAVAILABLE_DIMENSIONS,
  type DerivedMetric,
  type ObservedMetric,
  type UnavailableDimension,
} from "./contracts";

/* ═══════════════════════════════════════════════════════════════════════════
 * THE VIEW
 * ═════════════════════════════════════════════════════════════════════════ */

/** One agent's evidence profile. Three lists, three kinds, never blended. */
export interface AgentEvaluation {
  /** From the identity authority, through SIA-1. The raw agent id is not carried, as in SIA-1. */
  readonly agentName: string;
  readonly inService: boolean;
  /** True when the agent has filed nothing — every derived figure is then unavailable, not zero. */
  readonly hasNoEvidence: boolean;
  readonly observed: readonly ObservedMetric[];
  readonly derived: readonly DerivedMetric[];
  readonly unavailable: readonly UnavailableDimension[];
}

export type AgentEvaluationRead =
  | {
      readonly status: "read";
      readonly agents: readonly AgentEvaluation[];
      /** Carried through from SIA-1 so the evaluation inherits its truncation disclosure. */
      readonly distributionTruncated: boolean;
    }
  | { readonly status: "unavailable"; readonly reason: string };

/* ═══════════════════════════════════════════════════════════════════════════
 * THE PURE DERIVATION
 * ═════════════════════════════════════════════════════════════════════════ */

const observed = (
  key: string,
  label: string,
  source: string,
  value: number,
  means: string,
  doesNotMean: string,
): ObservedMetric => ({ kind: "observed", key, label, source, means, doesNotMean, value });

const derived = (
  key: string,
  label: string,
  source: string,
  definition: string,
  numerator: number,
  denominator: number,
  means: string,
  doesNotMean: string,
): DerivedMetric => ({
  kind: "derived",
  key,
  label,
  source,
  definition,
  means,
  doesNotMean,
  numerator,
  denominator,
  availability: shareAvailability(denominator),
});

/**
 * Derive one agent's evaluation from one agent's observation.
 *
 * PURE. No database, no clock, no handle — so every scenario this phase must be honest about is
 * testable exactly, and the arithmetic can be checked by reading it.
 *
 * Numerators are floored at zero. SIA-1 already documents why: its six aggregate statements are
 * taken microseconds apart, so a proposal decided between two of them can briefly make one count
 * exceed another. A negative "n of d" would be a nonsense a reader has to interpret; zero is the
 * honest floor, and the next load corrects it.
 */
export function deriveAgentEvaluation(observation: AgentOutcomeObservation): AgentEvaluation {
  const { activity, governance, execution, modelUsage, provenance } = observation;

  const decided = governance.approved + governance.rejected;
  const attemptsWithConfirmedOutcome = Math.max(
    0,
    execution.attempts - execution.pending - execution.unknown,
  );
  const authorizedWithAttempt = Math.max(0, governance.approved - governance.approvedWithoutExecution);
  const invocationsWithFullUsage = Math.max(
    0,
    modelUsage.linkedInvocations - modelUsage.invocationsWithoutReportedUsage,
  );

  return {
    agentName: observation.agentName,
    inService: observation.inService,
    hasNoEvidence: activity.proposalsFiled === 0,

    /* ── OBSERVED: copied, not computed ────────────────────────────────── */
    observed: [
      observed(
        "proposals-filed",
        "Proposals filed",
        "heby_action_requests",
        activity.proposalsFiled,
        "This agent originated this many proposals.",
        "It says nothing about whether any of them were good.",
      ),
      observed(
        "proposals-pending",
        "Awaiting a decision",
        "heby_action_requests.status = 'pending'",
        activity.pending,
        "These proposals are still waiting on a human.",
        "Waiting is not rejection, and it is not a backlog the agent caused.",
      ),
      observed(
        "governance-approved",
        "Authorized",
        "heby_action_requests.status = 'approved'",
        governance.approved,
        "A Governance authority approved this many proposals.",
        "Approved is not successful, and it is not executed.",
      ),
      observed(
        "governance-rejected",
        "Rejected",
        "heby_action_requests.status = 'rejected'",
        governance.rejected,
        "A Governance authority rejected this many proposals.",
        "Rejected is not failed. A Director may decline a sound proposal for reasons of timing.",
      ),
      observed(
        "execution-attempts",
        "Execution attempts",
        "action_execution_attempts",
        execution.attempts,
        "An authorization was spent this many times and an attempt was recorded.",
        "It does not mean anything was sent, and it does not mean anything succeeded.",
      ),
      observed(
        "execution-accepted",
        "Provider accepted",
        "action_execution_attempts.status = 'accepted'",
        execution.accepted,
        "A provider took the request and returned its own id.",
        "Accepted is not delivered, not received, not read, and not business success.",
      ),
      observed(
        "execution-failed",
        "Failed",
        "action_execution_attempts.status = 'failed'",
        execution.failed,
        "A provider answered and declined, or the connection provably never came up.",
        "An execution failure is not an agent failure — the provider is not the agent.",
      ),
      observed(
        "execution-unknown",
        "Unknown outcome",
        "action_execution_attempts.status = 'unknown'",
        execution.unknown,
        "The request was sent and the answer was lost. The effect may already have happened.",
        "Unknown is not failed, and it must never be counted as one.",
      ),
      observed(
        "execution-refused",
        "Refused before sending",
        "action_execution_attempts.status = 'refused'",
        execution.refused,
        "Hebun declined before any external call. Nothing left this process.",
        "A refusal is Hebun's own guard working, not an agent defect.",
      ),
      observed(
        "model-invocations",
        "Linked model invocations",
        "heby_origination_invocations",
        modelUsage.linkedInvocations,
        "This many recorded model calls are named by one of this agent's proposals.",
        "It is not every model call made on this agent's behalf — only the ones a proposal names.",
      ),
      observed(
        "model-input-tokens",
        "Input tokens",
        "heby_origination_invocations.input_tokens",
        modelUsage.inputTokens,
        "A lower bound: only fully-reported invocations are summed.",
        "Token count is not quality, in either direction.",
      ),
      observed(
        "model-output-tokens",
        "Output tokens",
        "heby_origination_invocations.output_tokens",
        modelUsage.outputTokens,
        "A lower bound, on the same rule as input tokens.",
        "Token count is not quality, in either direction.",
      ),
      observed(
        "model-variants",
        "Provider/model combinations",
        "heby_origination_invocations.provider, .model",
        modelUsage.distribution.length,
        "This many distinct provider and model pairs appear in the linked invocations.",
        "It says nothing about whether any of them was the right choice.",
      ),
    ],

    /* ── DERIVED: coverage of the record, never quality of the agent ───── */
    derived: [
      derived(
        "decision-coverage",
        "Proposals decided",
        "heby_action_requests.status",
        "approved + rejected, over every proposal this agent filed",
        decided,
        activity.proposalsFiled,
        "How much of what this agent proposed has received a recorded human decision.",
        "It counts BOTH outcomes. A high figure means decisions were made, not that they favoured " +
          "the agent. Withdrawn proposals are in the denominator and in neither outcome.",
      ),
      derived(
        "authorization-follow-through",
        "Authorized acts with an attempt",
        "action_execution_attempts vs heby_action_requests",
        "approved proposals that have a recorded execution attempt, over approved proposals",
        authorizedWithAttempt,
        governance.approved,
        "How many authorized acts actually reached an execution attempt.",
        "An attempt that failed is counted here. This measures follow-through, not success.",
      ),
      derived(
        "execution-resolution",
        "Attempts with a confirmed outcome",
        "action_execution_attempts.status",
        "attempts that are neither pending nor unknown, over all attempts",
        attemptsWithConfirmedOutcome,
        execution.attempts,
        "For how many attempts Hebun knows what happened.",
        "NOT a success rate. Failed and refused attempts are in the numerator, because a known " +
          "failure is a confirmed outcome.",
      ),
      derived(
        "provenance-coverage",
        "Proposals with traceable origin",
        "heby_action_requests.origination_invocation_id",
        "proposals naming the model invocation that caused them, over every proposal filed",
        provenance.proposalsWithInvocation,
        activity.proposalsFiled,
        "For how many proposals Hebun can name the model call that produced them.",
        "A missing link is not proof that no model was used, and not proof the proposal was " +
          "deterministic. It is a gap in Hebun's records, not a fact about the agent.",
      ),
      derived(
        "usage-reporting-coverage",
        "Invocations with complete usage",
        "heby_origination_invocations.input_tokens, .output_tokens",
        "linked invocations where the provider reported both token counts, over linked invocations",
        invocationsWithFullUsage,
        modelUsage.linkedInvocations,
        "For how many linked invocations the provider reported complete token usage.",
        "This is about what the PROVIDER reported. It says nothing about the agent and nothing " +
          "about efficiency.",
      ),
    ],

    /* ── UNAVAILABLE: named, so the lists above are not over-read ──────── */
    unavailable: UNAVAILABLE_DIMENSIONS,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE READ
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Derive the evaluation from an observation ALREADY READ. Pure.
 *
 * This exists so the `/agents` route can issue SIA-1's six statements ONCE and render both
 * surfaces from the same answer. Reading twice would double the statement count and — worse — let
 * the observation card and the evaluation card disagree on the same page, because the two reads
 * would be taken at different instants. One read, one instant, two views of it.
 */
export function deriveAgentEvaluationRead(
  observation: AgentOutcomeObservationRead,
): AgentEvaluationRead {
  if (observation.status !== "read") {
    return { status: "unavailable", reason: observation.reason };
  }
  return {
    status: "read",
    agents: observation.agents.map(deriveAgentEvaluation),
    distributionTruncated: observation.distributionTruncated,
  };
}

/**
 * Read this tenant's agent evaluation.
 *
 * The tenant comes from the authorized server context and is handed straight to SIA-1. This module
 * adds no parameter through which another tenant could be named, and issues no statement of its
 * own — SIA-1's predicates are the only scope, unchanged.
 *
 * An unreadable observation makes the evaluation unavailable, carrying SIA-1's reason verbatim: an
 * evaluation assembled from a failed read would be a confident answer about nothing.
 */
export async function readAgentEvaluation(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentEvaluationRead> {
  if (typeof window !== "undefined") {
    throw new Error("Agent evaluation reads are server-only.");
  }

  const observation: AgentOutcomeObservationRead = await readAgentOutcomeObservation(tenant, deps);
  return deriveAgentEvaluationRead(observation);
}
