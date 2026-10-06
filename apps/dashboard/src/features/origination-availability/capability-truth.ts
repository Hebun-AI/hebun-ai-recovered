/*
 * origination-availability/capability-truth.ts — what Agent #1 can PROPOSE right now, kept apart from
 * what its mandate permits and from what it has no authority to do at all (WF-2).
 *
 * A PURE DERIVATION of the WF-1 availability projection. It reads nothing and decides nothing: the
 * projection already asked every authority, and this only arranges its answer so four facts cannot
 * merge on screen:
 *
 *     MANDATE PERMITS  !=  REACHABLE NOW  !=  AVAILABLE  !=  AUTHORIZED  !=  EXECUTED
 *
 * "Not exposed" is the mandate's scope minus the one kind the released origination path can file.
 * An unavailable projection yields NO capability claims — absence of an answer is not a "cannot".
 */
import type { AgentOriginationAvailability, OriginationUnavailableReason } from "./contracts";

/** Agent #1 itself never holds these. A human-governed subsystem may still do them, after a human. */
export const AGENT_HAS_NO_AUTHORITY_TO = Object.freeze([
  "approve its own proposals",
  "issue permits",
  "execute actions",
  "create organizational work directly",
  "send external communications directly",
  "grant itself more authority",
] as const);

export type AgentCapabilityTruth =
  | {
      readonly status: "known";
      readonly mandateRevision: number;
      readonly mandatePermits: readonly string[];
      readonly canProposeNow: readonly string[];
      readonly permittedButNotExposed: readonly string[];
    }
  | { readonly status: "unavailable"; readonly reason: OriginationUnavailableReason };

export function deriveAgentCapabilityTruth(availability: AgentOriginationAvailability): AgentCapabilityTruth {
  if (availability.status !== "available") return { status: "unavailable", reason: availability.reason };
  const scope = availability.mandate.proposalScope;
  return {
    status: "known",
    mandateRevision: availability.mandate.revision,
    mandatePermits: scope,
    canProposeNow: [availability.originable],
    permittedButNotExposed: scope.filter((kind) => kind !== availability.originable),
  };
}
