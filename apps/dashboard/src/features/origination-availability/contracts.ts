/*
 * origination-availability/contracts.ts — what a browser may learn about whether a human can be
 * OFFERED governed Agent origination right now (WF-1). Client-safe: types and a closed vocabulary.
 *
 * AVAILABLE is a derived, point-in-time projection. It means only that current authoritative state
 * permits Hebun to offer the option. It is not a promise that origination will succeed, that a
 * provider will answer, that a proposal will be filed, or that anything will be authorized or
 * executed. The origination seam re-checks every authority when the human confirms, and it wins.
 *
 * Nothing here names a model, a credential, an account, an attestation or an authorization id.
 */
import type { WorkScope } from "@/features/work-domain/work-scope";

export const ORIGINATION_UNAVAILABLE_REASONS = [
  "tenant-unavailable",
  "no-agent",
  "agent-retired",
  "multiple-agents",
  /** AP-1 — the explicitly selected agent is not one of this organization's identities. */
  "selected-agent-unresolvable",
  "mandate-unavailable",
  "proposal-scope-unavailable",
  /** AP-4B — the agent's mandate grants responsibility for no work scope that is in service. */
  "no-work-responsibility",
  "model-unavailable",
  "external-ai-not-authorized",
  "temporarily-unavailable",
] as const;
export type OriginationUnavailableReason = (typeof ORIGINATION_UNAVAILABLE_REASONS)[number];

export type AgentOriginationAvailability =
  | {
      readonly status: "available";
      /** AP-1 — `agentId` is the lookup key the client sends back when it confirms; never authority. */
      readonly agent: { readonly agentId: string; readonly name: string };
      /** The effective mandate as the Agent Mandate Authority recorded it. Purpose is descriptive. */
      readonly mandate: {
        readonly revision: number;
        readonly purpose: string;
        readonly proposalScope: readonly string[];
      };
      /** The one kind this path may originate today (APF-3 narrow arm). */
      readonly originable: "record-work";
      /** AP-4B — the work scopes a human may choose from, each with who is eligible for it. */
      readonly workScopes: readonly WorkScopeOption[];
    }
  | {
      readonly status: "unavailable";
      readonly reason: OriginationUnavailableReason;
      /**
       * AP-1 — only with `multiple-agents`: the IN-SERVICE identities a human may choose between.
       * Choosing one asks this projection again with that agentId; nothing is offered until then.
       */
      readonly candidates?: readonly { readonly agentId: string; readonly name: string }[];
      /** AP-4B — only with `multiple-agents`: the scopes, and which candidates are eligible for each. */
      readonly workScopes?: readonly WorkScopeOption[];
    };

/**
 * AP-4B. One work scope a human may choose, and the agents eligible for it — a PROJECTION of the
 * Agent Mandate Authority's answer (`listEligibleAgents`), in the identity read's own order. It ranks
 * nobody, selects nobody and authorizes nothing: the inlet re-asks the authority when the human
 * confirms, and its answer wins.
 */
export interface WorkScopeOption {
  readonly scope: WorkScope;
  readonly label: string;
  readonly eligibleAgentIds: readonly string[];
}
