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
export const ORIGINATION_UNAVAILABLE_REASONS = [
  "tenant-unavailable",
  "no-agent",
  "agent-retired",
  "multiple-agents",
  "mandate-unavailable",
  "proposal-scope-unavailable",
  "model-unavailable",
  "external-ai-not-authorized",
  "temporarily-unavailable",
] as const;
export type OriginationUnavailableReason = (typeof ORIGINATION_UNAVAILABLE_REASONS)[number];

export type AgentOriginationAvailability =
  | {
      readonly status: "available";
      readonly agent: { readonly name: string };
      /** The effective mandate as the Agent Mandate Authority recorded it. Purpose is descriptive. */
      readonly mandate: {
        readonly revision: number;
        readonly purpose: string;
        readonly proposalScope: readonly string[];
      };
      /** The one kind this path may originate today (APF-3 narrow arm). */
      readonly originable: "record-work";
    }
  | { readonly status: "unavailable"; readonly reason: OriginationUnavailableReason };
