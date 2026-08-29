/*
 * live-map/awareness.ts — LIVE MAP LIVE, the compact awareness summary.
 *
 * ── IT IS A SECOND VIEW, NEVER A SECOND MAP ──────────────────────────────────
 *
 * This is a PURE function over the released `LiveMapProjection`. It performs no read, holds no
 * handle, resolves no tenant and consults no authority — every value below is already present in
 * the projection its caller resolved. So there is no second Live Map to keep in agreement with the
 * first: if the two ever disagreed, it would be because somebody added a read here, and there is
 * nowhere in this file for one to go.
 *
 *     LIVE MAP LIVE != A SECOND LIVE MAP AUTHORITY
 *
 * ── WHAT IT MAY SAY, AND THE THREE STATES IT MAY NOT COLLAPSE ────────────────
 *
 * The projection distinguishes `available`, `known-empty`, `unavailable` and `no-authority`, and a
 * summary is exactly where those get flattened into one reassuring number. They are carried
 * through instead: an organization Hebun could not read is not an organization with no agents, and
 * an agent domain that answered zero is not one that failed to answer.
 *
 *     UNAVAILABLE != EMPTY        UNAVAILABLE != ZERO
 *
 * ── AND WHAT IT MAY NEVER SAY ────────────────────────────────────────────────
 *
 * No activity figure, no health, no risk, no ranking, no event count, no department count. The
 * projection holds none of those, so none can be summarised from it; the summary's job is to be
 * smaller than the map, never to be more confident than it.
 */
import type { LiveMapProjection } from "./contracts";

/** What the awareness panel is allowed to say about the organization. */
export type LiveMapAwarenessOrganization =
  | { readonly status: "named"; readonly name: string }
  | { readonly status: "unavailable"; readonly detail: string };

/** What it is allowed to say about durable agents. Three answers, never two. */
export type LiveMapAwarenessAgents =
  | { readonly status: "counted"; readonly count: number }
  | { readonly status: "known-empty" }
  | { readonly status: "unavailable" };

/**
 * Whether E2-3's derived observation could be read at all.
 *
 * A boolean is honest here ONLY because the projection already distinguishes the two: the
 * completeness signal is present when the evidence was read and absent when it was not, so this
 * reads a fact rather than inferring one from an empty result.
 */
export type LiveMapAwarenessIntelligence =
  | { readonly status: "available"; readonly unresolvedAgentProposals: number }
  | { readonly status: "unavailable" };

export interface LiveMapAwareness {
  readonly organization: LiveMapAwarenessOrganization;
  readonly agents: LiveMapAwarenessAgents;
  readonly intelligence: LiveMapAwarenessIntelligence;
  /** The projection's own freshness sentence, carried verbatim. This panel owns no claim about it. */
  readonly freshness: string;
}

/** Summarise a resolved projection. Pure: no read, no clock, no handle, no tenant. */
export function summariseLiveMap(projection: LiveMapProjection): LiveMapAwareness {
  const organizationDomain = projection.domains.find((d) => d.domainId === "organization");
  const agentDomain = projection.domains.find((d) => d.domainId === "agents");

  const organization: LiveMapAwarenessOrganization =
    organizationDomain?.state.status === "available" && organizationDomain.state.nodes[0]
      ? { status: "named", name: organizationDomain.state.nodes[0].label }
      : {
          status: "unavailable",
          detail:
            organizationDomain?.state.status === "unavailable"
              ? organizationDomain.state.detail
              : "Hebun could not establish which organization to map.",
        };

  /*
   * `known-empty` is kept as its own answer rather than reported as `counted: 0`. The agent
   * authority answering "this organization has established none" and the agent authority not
   * answering at all are different facts, and a zero cannot tell them apart.
   */
  const agents: LiveMapAwarenessAgents =
    agentDomain?.state.status === "available"
      ? { status: "counted", count: agentDomain.state.nodes.length }
      : agentDomain?.state.status === "known-empty"
        ? { status: "known-empty" }
        : { status: "unavailable" };

  const intelligence: LiveMapAwarenessIntelligence = projection.intelligenceCompleteness
    ? {
        status: "available",
        unresolvedAgentProposals: projection.intelligenceCompleteness.unresolvedAgentProposals,
      }
    : { status: "unavailable" };

  return { organization, agents, intelligence, freshness: projection.freshness };
}
