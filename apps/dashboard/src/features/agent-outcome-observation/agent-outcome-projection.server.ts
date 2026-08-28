/*
 * agent-outcome-observation/agent-outcome-projection.server.ts — what a Director may READ about
 * what each durable agent proposed, and what became of it (SELF-IMPROVING-AGENTS-1).
 *
 * ── THE GAP THIS CLOSES, AND ONLY THIS ONE ───────────────────────────────────
 *
 * Hebun already holds every fact: agent identity, model invocation provenance, agent-originated
 * proposals, Governance decisions, permits, execution attempts, and — since GOVERNED-EXECUTION-1 —
 * a ledger a human can read. What it could not do is answer the question PER AGENT. Every one of
 * those records is organized around an act; none is organized around the actor that caused it. So
 * "what happened to what this agent proposed" required a person to hold six surfaces in their head
 * and do the join by eye.
 *
 * This module is a READ. It introduces no authority, owns no table, adds no column and grants no
 * capability. It cannot create or retire an agent, originate a proposal, approve, reject, permit,
 * revoke, execute, retry, or call any provider — and it holds no representation in which any of
 * those could be asked for.
 *
 * ── OBSERVE AND MEASURE. NOTHING ELSE ────────────────────────────────────────
 *
 * This is the baseline a later self-improvement phase would need, and it deliberately stops at the
 * baseline. There is no score, no rate, no ranking, no threshold, no trend and no recommendation.
 * Every value below is a count of rows that exist. A "success rate" would be the first derived
 * claim, and it would immediately be a false one: its numerator would have to be `accepted`, and
 * accepted is not delivered.
 *
 * ── WHY THE COMPOSER IS PURE, AND SEPARATE ───────────────────────────────────
 *
 * `composeAgentOutcomes` takes facts and returns the observation. It touches no database and no
 * clock, so every scenario this phase must be honest about — a historical proposal with no
 * provenance, an approved act that was never executed, an attempt that ended `unknown`, an agent
 * that has done nothing at all — is testable exactly, without a fixture that could be wrong in the
 * same direction as the code.
 *
 * ── WHY SIX STATEMENTS AND NOT ONE ───────────────────────────────────────────
 *
 * One statement with five joins would multiply rows: an agent with 3 proposals, 2 permits and 1
 * attempt would produce 6 rows, and every `count(*)` over it would be wrong in a way that looks
 * plausible. Aggregating each concern in its own pass and joining the ANSWERS in memory is the only
 * shape in which each number counts the thing it names.
 *
 * THE COST, STATED. Six statements can disagree transiently — a proposal approved between the
 * first and the second appears as `pending` in the activity counts and as an issued permit below
 * it. That is a stale reading which the next load corrects. It is strictly preferable to a
 * fan-out-inflated number, which no reload corrects because it is not stale, it is wrong.
 *
 * ── WHAT THE PROJECTION DELIBERATELY DROPS ───────────────────────────────────
 *
 * The agent's `agents.id` is NOT carried to the surface. APP-2 settled the principle for the
 * proposer id on `/approvals` and AGENT-PROPOSAL-2 built the seam that made it unnecessary: a raw
 * uuid is not a name. Here the name is already in hand from the identity read, so carrying the id
 * as well would ship an internal identifier that nothing renders and nobody can resolve.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readDurableAgentIdentityState,
  type DurableAgentIdentityRecord,
} from "@/features/agent-identity/read-durable-agent-identity.server";
import {
  MODEL_DISTRIBUTION_LIMIT,
  readAgentExecutionFacts,
  readAgentInvocationFacts,
  readAgentModelDistribution,
  readAgentPermitFacts,
  readAgentProposalFacts,
  readUnattributedInvocationCount,
  type AgentExecutionFacts,
  type AgentInvocationFacts,
  type AgentModelDistributionFact,
  type AgentOutcomeFactsDeps,
  type AgentPermitFacts,
  type AgentProposalFacts,
} from "./read-agent-outcome-facts.server";

/* ═══════════════════════════════════════════════════════════════════════════
 * THE VIEW
 * ═════════════════════════════════════════════════════════════════════════ */

/** Activity — what this agent put into the world. Stage PROPOSED. */
export interface AgentActivityView {
  readonly proposalsFiled: number;
  readonly pending: number;
  readonly withdrawn: number;
}

/**
 * Governance outcomes — what human authority did with those proposals. Stages AUTHORIZED, PERMITTED.
 *
 * `approved` and `permitsIssued` are two numbers because they are two facts. A proposal can be
 * approved and its permit revoked; a permit can be issued and never spent. One number would have
 * to pick which of those it meant.
 */
export interface AgentGovernanceView {
  readonly approved: number;
  readonly rejected: number;
  readonly permitsIssued: number;
  readonly permitsActive: number;
  /** DERIVED from `expires_at <= now`, exactly as the released `/approvals` display derives it. */
  readonly permitsExpired: number;
  readonly permitsConsumed: number;
  readonly permitsRevoked: number;
  /**
   * Approved proposals with no execution attempt behind them.
   *
   * The clearest statement this surface makes that APPROVED IS NOT EXECUTED. Computed as
   * `approved - attempts` and floored at zero — see {@link approvedButUnexecuted}.
   */
  readonly approvedWithoutExecution: number;
}

/** Execution outcomes — what the machine tried and what came back. Stages EXECUTED..UNKNOWN. */
export interface AgentExecutionView {
  readonly attempts: number;
  readonly pending: number;
  readonly accepted: number;
  readonly refused: number;
  readonly failed: number;
  readonly unknown: number;
}

/** One provider/model bucket, as recorded. Null means the provider supplied none. */
export interface AgentModelBucket {
  readonly provider: string | null;
  readonly model: string | null;
  readonly invocations: number;
}

/** Model usage — LINKED invocations only. See the reader's header for what "linked" excludes. */
export interface AgentModelUsageView {
  readonly linkedInvocations: number;
  /** A LOWER BOUND. Invocations the provider reported no usage for are counted, never summed. */
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly invocationsWithoutReportedUsage: number;
  readonly distribution: readonly AgentModelBucket[];
}

/** Provenance coverage — how much of this agent's authorship Hebun can actually trace. */
export interface AgentProvenanceView {
  /** Proposals naming the model invocation that caused them. */
  readonly proposalsWithInvocation: number;
  /** Proposals filed before that record existed. NOT evidence that no model was used. */
  readonly proposalsWithoutInvocation: number;
}

/** One durable agent, and what became of what it proposed. */
export interface AgentOutcomeObservation {
  /** The name, from the identity authority. The raw agent id is deliberately not carried. */
  readonly agentName: string;
  /** Derived by the identity seam from the absence of retirement. Never stored. */
  readonly inService: boolean;
  readonly retiredAt: string | null;
  readonly establishedAt: string;
  readonly activity: AgentActivityView;
  readonly governance: AgentGovernanceView;
  readonly execution: AgentExecutionView;
  readonly modelUsage: AgentModelUsageView;
  readonly provenance: AgentProvenanceView;
}

/**
 * The observation, or an honest statement that it could not be read.
 *
 * `unavailable` is a THIRD thing, distinct from an organization with no agents: "this tenant has
 * established no durable agent" and "the store did not answer" are different truths, and collapsing
 * them would let a broken read render as a clean, empty workforce.
 */
export type AgentOutcomeObservationRead =
  | {
      readonly status: "read";
      readonly agents: readonly AgentOutcomeObservation[];
      /**
       * Model invocations this tenant recorded that no proposal names. Tenant-level by necessity:
       * the invocation row carries no agent.
       */
      readonly unattributedInvocations: number;
      /**
       * Proposals attributed to an agent id the identity read did not return. Counted so the
       * per-agent totals are never quietly short. Expected to be zero.
       */
      readonly unresolvedAgentProposals: number;
      /** True when the provider/model breakdown filled its bound, so buckets exist and are not shown. */
      readonly distributionTruncated: boolean;
      /** The bound actually applied, so the surface states a number it did not invent. */
      readonly distributionLimit: number;
    }
  | { readonly status: "unavailable"; readonly reason: string };

/* ═══════════════════════════════════════════════════════════════════════════
 * THE PURE COMPOSER
 * ═════════════════════════════════════════════════════════════════════════ */

/** Everything the composer needs. Facts in, observation out; no clock, no handle, no I/O. */
export interface AgentOutcomeFacts {
  readonly identities: readonly DurableAgentIdentityRecord[];
  readonly proposals: readonly AgentProposalFacts[];
  readonly permits: readonly AgentPermitFacts[];
  readonly executions: readonly AgentExecutionFacts[];
  readonly invocations: readonly AgentInvocationFacts[];
  readonly distribution: readonly AgentModelDistributionFact[];
}

/**
 * APPROVED IS NOT EXECUTED, as arithmetic.
 *
 * Floored at zero deliberately. The two numbers come from two statements taken microseconds apart,
 * so an approval that gained an attempt in between can make `attempts` exceed `approved` for one
 * read. A negative "approved but never executed" would be a nonsense a reader would have to
 * interpret; zero is the honest floor, and the next load corrects it.
 *
 * It is a LOWER BOUND on the real gap in one further way: a proposal approved, permitted, and whose
 * permit was then revoked never gains an attempt, and it is counted here — correctly, because
 * nothing was executed.
 */
export function approvedButUnexecuted(approved: number, attempts: number): number {
  return Math.max(0, approved - attempts);
}

const EMPTY_PROPOSALS: Omit<AgentProposalFacts, "agentId"> = {
  filed: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  withdrawn: 0,
  withInvocationLink: 0,
  withoutInvocationLink: 0,
};

const EMPTY_PERMITS: Omit<AgentPermitFacts, "agentId"> = {
  issued: 0,
  active: 0,
  expired: 0,
  consumed: 0,
  revoked: 0,
};

const EMPTY_EXECUTIONS: Omit<AgentExecutionFacts, "agentId"> = {
  attempts: 0,
  pending: 0,
  accepted: 0,
  refused: 0,
  failed: 0,
  unknown: 0,
};

const EMPTY_INVOCATIONS: Omit<AgentInvocationFacts, "agentId"> = {
  linkedInvocations: 0,
  inputTokens: 0,
  outputTokens: 0,
  invocationsWithoutReportedUsage: 0,
};

function index<T extends { readonly agentId: string }>(rows: readonly T[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) map.set(row.agentId, row);
  return map;
}

/**
 * Compose one tenant's agent outcome observation.
 *
 * PURE. The identity list drives the result, so an agent that has done nothing gets a row of zeros
 * rather than disappearing — a durable identity with no activity is an ANSWER, and the surface says
 * so in words rather than rendering a blank.
 *
 * Fact rows whose agent id is not in the identity list are NOT dropped silently. They are counted
 * into `unresolvedAgentProposals`, because a join that discards rows under-reports, and an
 * under-report here reads as an agent having proposed less than it did.
 */
export function composeAgentOutcomes(facts: AgentOutcomeFacts): {
  readonly agents: readonly AgentOutcomeObservation[];
  readonly unresolvedAgentProposals: number;
} {
  const proposals = index(facts.proposals);
  const permits = index(facts.permits);
  const executions = index(facts.executions);
  const invocations = index(facts.invocations);

  const known = new Set(facts.identities.map((identity) => identity.agentId));
  let unresolved = 0;
  for (const row of facts.proposals) {
    if (!known.has(row.agentId)) unresolved += row.filed;
  }

  const agents = facts.identities.map((identity): AgentOutcomeObservation => {
    const p = proposals.get(identity.agentId) ?? { agentId: identity.agentId, ...EMPTY_PROPOSALS };
    const m = permits.get(identity.agentId) ?? { agentId: identity.agentId, ...EMPTY_PERMITS };
    const e = executions.get(identity.agentId) ?? { agentId: identity.agentId, ...EMPTY_EXECUTIONS };
    const i = invocations.get(identity.agentId) ?? { agentId: identity.agentId, ...EMPTY_INVOCATIONS };

    return {
      agentName: identity.name,
      inService: identity.inService,
      retiredAt: identity.retiredAt,
      establishedAt: identity.createdAt,
      activity: {
        proposalsFiled: p.filed,
        pending: p.pending,
        withdrawn: p.withdrawn,
      },
      governance: {
        approved: p.approved,
        rejected: p.rejected,
        permitsIssued: m.issued,
        permitsActive: m.active,
        permitsExpired: m.expired,
        permitsConsumed: m.consumed,
        permitsRevoked: m.revoked,
        approvedWithoutExecution: approvedButUnexecuted(p.approved, e.attempts),
      },
      execution: {
        attempts: e.attempts,
        pending: e.pending,
        accepted: e.accepted,
        refused: e.refused,
        failed: e.failed,
        unknown: e.unknown,
      },
      modelUsage: {
        linkedInvocations: i.linkedInvocations,
        inputTokens: i.inputTokens,
        outputTokens: i.outputTokens,
        invocationsWithoutReportedUsage: i.invocationsWithoutReportedUsage,
        distribution: facts.distribution
          .filter((bucket) => bucket.agentId === identity.agentId)
          .map((bucket) => ({
            provider: bucket.provider,
            model: bucket.model,
            invocations: bucket.invocations,
          })),
      },
      provenance: {
        proposalsWithInvocation: p.withInvocationLink,
        proposalsWithoutInvocation: p.withoutInvocationLink,
      },
    };
  });

  return { agents, unresolvedAgentProposals: unresolved };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE READ
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Read this tenant's agent outcome observation.
 *
 * The tenant comes from the authorized server context and there is no parameter through which a
 * caller could name another one — every underlying statement scopes itself by predicate, and this
 * function issues no statement of its own.
 *
 * ANY read failing makes the whole observation unavailable. A page assembled from four successful
 * reads and one failure would render as a complete answer with a silently-zeroed section, which is
 * the same class of defect as a bounded list that does not say it is bounded.
 */
export async function readAgentOutcomeObservation(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<AgentOutcomeObservationRead> {
  if (typeof window !== "undefined") {
    throw new Error("Agent outcome observation reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const distributionLimit = deps.distributionLimit ?? MODEL_DISTRIBUTION_LIMIT;
  const bounded: AgentOutcomeFactsDeps = { ...deps, distributionLimit };

  const [identityState, proposals, permits, executions, invocations, distribution, unattributed] =
    await Promise.all([
      readDurableAgentIdentityState(tenant, { getDb: deps.getDb }),
      readAgentProposalFacts(tenant, bounded),
      readAgentPermitFacts(tenant, bounded),
      readAgentExecutionFacts(tenant, bounded),
      readAgentInvocationFacts(tenant, bounded),
      readAgentModelDistribution(tenant, bounded),
      readUnattributedInvocationCount(tenant, bounded),
    ]);

  if (identityState.status !== "known") {
    return { status: "unavailable", reason: "agent-identity-authority-unavailable" };
  }
  if (proposals.status !== "read") return { status: "unavailable", reason: proposals.reason };
  if (permits.status !== "read") return { status: "unavailable", reason: permits.reason };
  if (executions.status !== "read") return { status: "unavailable", reason: executions.reason };
  if (invocations.status !== "read") return { status: "unavailable", reason: invocations.reason };
  if (distribution.status !== "read") return { status: "unavailable", reason: distribution.reason };
  if (unattributed.status !== "read") return { status: "unavailable", reason: unattributed.reason };

  const composed = composeAgentOutcomes({
    identities: identityState.identities,
    proposals: proposals.rows,
    permits: permits.rows,
    executions: executions.rows,
    invocations: invocations.rows,
    distribution: distribution.rows,
  });

  return {
    status: "read",
    agents: composed.agents,
    unresolvedAgentProposals: composed.unresolvedAgentProposals,
    unattributedInvocations: unattributed.rows[0] ?? 0,
    distributionTruncated: distribution.rows.length >= distributionLimit,
    distributionLimit,
  };
}
