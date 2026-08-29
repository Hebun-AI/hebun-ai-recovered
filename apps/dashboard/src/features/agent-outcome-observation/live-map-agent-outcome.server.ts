/*
 * agent-outcome-observation/live-map-agent-outcome.server.ts — THE ID-KEYED LIVE MAP PROJECTION
 * (E2-3).
 *
 * ── WHY THIS LIVES HERE AND NOT IN LIVE MAP ──────────────────────────────────
 *
 * Live Map draws authoritative agent nodes. It does not, and must not, know how a proposal becomes
 * an approval becomes a permit becomes an execution attempt — that ladder belongs to SELF-IMPROVING
 * -AGENTS-1, which already owns the nine grouped statements that count it and the seven stages that
 * keep the counts from collapsing into one another.
 *
 * So the seam that hands Live Map its evidence is owned by the authority that produces the
 * evidence. Live Map imports THIS; it never reaches the proposal, Governance, permit or execution
 * tables, and it never restates a join.
 *
 *     LIVE MAP -> this projection -> readAgentOutcomeObservationIndexed -> the released fact readers
 *
 *     LIVE MAP != AGENT OUTCOME AUTHORITY
 *
 * ── WHAT IT NARROWS, AND WHY NARROWING IS THE POINT ──────────────────────────
 *
 * A map node is a small object a reader glances at. It carries the three concerns that answer
 * "what has this agent proposed, and what became of it" — activity, Governance outcome, execution
 * outcome — and NOT model usage, selection outcomes, provider/model distribution or provenance
 * coverage. Those are real and they are already rendered in full on `/agents`; copying them onto a
 * map node would ship a payload nobody reads to a surface that cannot explain it.
 *
 * ── WHAT IT REFUSES TO DERIVE ────────────────────────────────────────────────
 *
 * Nothing here divides one count by another. The released contract's whole argument is that the
 * strongest positive value available is `accepted`, and `accepted` is not delivered — so any
 * proportion built from these numbers would be a claim no record supports. This module therefore
 * carries counts across unchanged and computes exactly one thing beyond them: nothing.
 *
 *     COUNT != RATE        COUNT != A COMPARISON BETWEEN AGENTS
 *
 * ── IT WRITES NOTHING AND CAN REACH NOTHING THAT WRITES ──────────────────────
 *
 * No handle, no schema import, no statement of its own. It calls one released read and reshapes the
 * answer.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readAgentOutcomeObservationIndexed,
  type AgentActivityView,
  type AgentExecutionView,
  type AgentGovernanceView,
} from "./agent-outcome-projection.server";
import type { AgentOutcomeFactsDeps } from "./read-agent-outcome-facts.server";

/* ═══════════════════════════════════════════════════════════════════════════
 * WHAT A MAP NODE MAY BE HANDED
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * One agent's outcome evidence, addressed by the durable id the identity authority issued.
 *
 * `agentId` IS the join key and it is the only reason it is here. It is not display data: the
 * consumer already holds the agent's name from the identity authority, and a raw identifier on a
 * surface is an internal detail nobody can resolve.
 *
 *     AGENT NAME != AGENT IDENTITY        JOIN BY ID, NEVER BY NAME
 */
export interface LiveMapAgentOutcome {
  readonly agentId: string;
  readonly activity: AgentActivityView;
  readonly governance: AgentGovernanceView;
  readonly execution: AgentExecutionView;
}

/**
 * The evidence, or an honest statement that it could not be read.
 *
 * There is no third variant meaning "read, but empty". An organization whose agents have proposed
 * nothing is a successful read whose every count is zero, and those zeros are MEASURED — they are
 * not the same object as a read that failed, and the consumer must be able to tell them apart.
 *
 *     UNAVAILABLE != ZERO ACTIVITY
 */
export type LiveMapAgentOutcomeRead =
  | {
      readonly status: "read";
      readonly byAgentId: ReadonlyMap<string, LiveMapAgentOutcome>;
      /**
       * Proposals attributed to an agent id the identity read did not return.
       *
       * Carried, never dropped. A join that silently discards rows under-reports, and an
       * under-report attached to a map node reads as an agent having proposed less than it did.
       *
       *     UNKNOWN AGENT ID != PERMISSION TO INVENT AN AGENT
       */
      readonly unresolvedAgentProposals: number;
    }
  | { readonly status: "unavailable"; readonly reason: string };

/* ═══════════════════════════════════════════════════════════════════════════
 * THE SENTENCES THAT TRAVEL WITH THE NUMBERS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * What this evidence IS, said rather than left for a reader to assume.
 *
 * CUMULATIVE, NOT A WINDOW. The released statements carry no date predicate at all, so every count
 * covers the whole record from the moment the agent identity was established. Labelling it as a
 * period would be the easiest lie on this surface to believe, and the hardest to notice.
 *
 *     CUMULATIVE != CURRENT        REQUEST-TIME READ != A STREAM
 */
export const LIVE_MAP_AGENT_OUTCOME_BASIS =
  "Counted from records other authorities already wrote, covering everything since this agent " +
  "identity was established. It is not limited to a period, and no number here is a proportion, a " +
  "comparison between agents or a judgement of any kind.";

/** The authority named on the attachment. Live Map is never named as the owner of a fact it draws. */
export const LIVE_MAP_AGENT_OUTCOME_AUTHORITY = "Agent Outcome Observation";

/**
 * An unread observation. NOT an agent that has done nothing.
 *
 * The distinction is the whole reason this is a sentence and not an absence: a node rendered with
 * no evidence and no explanation reads as a node with nothing to show.
 */
export const LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE =
  "Hebun could not read this agent's outcome evidence. That is an unread observation, and it says " +
  "nothing about what this agent has proposed.";

/**
 * The identity read and the outcome read disagreed about which agents exist.
 *
 * Both come from the same authority in the same request, so this is a transient disagreement a
 * reload corrects — and it is still reported, because an unexplained blank is indistinguishable
 * from a measured zero.
 */
export const LIVE_MAP_AGENT_OUTCOME_NOT_OBSERVED =
  "The outcome evidence for this reading holds no entry for this agent identity. The two reads " +
  "disagreed; reading again resolves it. It is not a record of an agent that has proposed nothing.";

/** What the whole attachment refuses to say, carried onto the map rather than left on `/agents`. */
export const LIVE_MAP_AGENT_OUTCOME_NON_CLAIMS: readonly string[] = Object.freeze([
  "approved is not executed — an approval authorizes an act, it does not perform one",
  "a permit is not an execution — an unspent permit expires having caused nothing",
  "accepted is not delivered — no provider reports whether a recipient received or read anything",
  "an unknown outcome is not a failure — the external effect may already have happened",
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * THE READ
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Read this tenant's agent outcome evidence, keyed for attachment to an authoritative agent node.
 *
 * The tenant arrives as the already-resolved server context and there is no parameter through which
 * a caller could name another organization. This function issues no statement of its own: the
 * tenant predicate lives in the released fact readers, where it is bound once per statement from
 * the guard's resolved value.
 *
 * ONE READ, WHATEVER THE ORGANIZATION'S SIZE. The nine grouped statements underneath are issued
 * once and grouped per agent, so nothing here iterates agents to fetch anything.
 */
export async function readLiveMapAgentOutcome(
  tenant: TenantContext | null,
  deps: AgentOutcomeFactsDeps = {},
): Promise<LiveMapAgentOutcomeRead> {
  if (typeof window !== "undefined") {
    throw new Error("Live Map agent outcome reads are server-only.");
  }

  const indexed = await readAgentOutcomeObservationIndexed(tenant, deps);
  if (indexed.status !== "read") return { status: "unavailable", reason: indexed.reason };

  const byAgentId = new Map<string, LiveMapAgentOutcome>();
  for (const [agentId, observation] of indexed.byAgentId) {
    /* The key is carried through unchanged — the narrowing is of FIELDS, never of identity. */
    byAgentId.set(agentId, {
      agentId,
      activity: observation.activity,
      governance: observation.governance,
      execution: observation.execution,
    });
  }

  return {
    status: "read",
    byAgentId,
    unresolvedAgentProposals: indexed.unresolvedAgentProposals,
  };
}
