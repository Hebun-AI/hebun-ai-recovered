/*
 * agent-origination/contracts.ts — the closed contract a durable agent must satisfy to ORIGINATE
 * a bounded action proposal (AGENT-PROPOSAL-1).
 *
 * ── WHY THIS FEATURE IS NOT PART OF THE ACTION INLET ─────────────────────────
 *
 * R3A.1's released firewall asserts, over the whole `heby-action-inlet` feature, that
 * "THE MODEL SELECTS NOTHING" — no provider import, no model seam, no generated text. That claim
 * is TRUE and must stay true, because it is what makes the `/send` slash command a deterministic
 * human act rather than something a model nudged.
 *
 * AGENT-PROPOSAL-1 introduces a genuinely different path in which a model DOES select. Rather than
 * weakening a released guarantee so two incompatible truths could share one directory, the model
 * lives HERE and hands the inlet nothing but two already-validated references. Two paths, two
 * firewalls, two truths — and neither one has to lie about the other.
 *
 * ── THE CHOICE SPACE IS A SERVER-BUILT LIST, NOT A VOCABULARY ────────────────
 *
 * The agent does not name arbitrary strings. The server reads this tenant's active recipients and
 * proposable drafts, offers exactly those as CANDIDATES, and then requires the selection to be a
 * member of what was offered. A reference the model invented is not merely unresolvable — it was
 * never in the set, and it is refused before any authority is asked to resolve it.
 *
 * That is the containment property this phase actually rests on. Prompt-injected content can, at
 * absolute worst, push the agent toward proposing a real draft to a real recorded recipient — a
 * proposal a human must still read and approve. It cannot reach an address the tenant never
 * recorded, bytes the tenant never wrote, another tenant's anything, or any act outside the one
 * admitted kind.
 */

/**
 * The action kinds an agent may originate. EXACTLY ONE, on purpose.
 *
 * The registry declares eight action kinds. Seven of them are not here: `device-action` is
 * Platform-restricted and database-refused, `grant-permission` and `modify-governance-policy` are
 * authority changes no machine should ever draft, `restart-workflow` has no substrate, and the
 * three read/preparation kinds need no proposal at all. Admitting a kind is a deliberate act, and
 * the set is smaller than the registry rather than equal to it.
 *
 * `send-external-communication` qualifies for one reason: BOTH of its referents can be resolved
 * authoritatively against released read seams, so every argument the agent chooses is checkable
 * against a row the tenant already owns.
 */
export const AGENT_ORIGINABLE_ACTION_KINDS = ["send"] as const;

export type AgentOriginableActionKind = (typeof AGENT_ORIGINABLE_ACTION_KINDS)[number];

/** The registry kind each admitted alias maps to. The alias never becomes the kind by string. */
export const SEND_ORIGINATION_ALIAS = "send" as const;

/**
 * The abstain value.
 *
 * A model that must always name an action will invent one. Offering an explicit "nothing here
 * warrants a proposal" is not a convenience — it is the difference between an honest refusal and a
 * fabricated act, and it is the answer the agent is instructed to prefer when unsure.
 */
export const NO_ACTION_KIND = "none" as const;

/** The maximum length of the agent's stated reason. Bounded so a reason cannot become a payload. */
export const MAX_ORIGINATION_REASON_LENGTH = 400;

/** The bound on how many candidates are offered, so a prompt cannot become a data export. */
export const MAX_CANDIDATES_PER_KIND = 25;

/**
 * One thing the agent may choose. A REFERENCE and a LABEL — nothing else.
 *
 * Deliberately NOT the read seams' own views. `RecipientView` carries `endpointValue`, the raw
 * address, and R3A.1's privacy boundary already forbids that from entering a proposal. Projecting
 * a narrow shape here means the address is absent from the model's context by CONSTRUCTION rather
 * than by a caller remembering to delete it.
 */
export interface OriginationCandidate {
  readonly ref: string;
  readonly label: string;
}

/** What the agent is allowed to see and choose from, for one tenant, at one moment. */
export interface OriginationCandidateSet {
  readonly recipients: readonly OriginationCandidate[];
  readonly drafts: readonly OriginationCandidate[];
}

/**
 * The STRUCTURED selection, after parsing and validation. Never a partial or repaired object.
 *
 * There are exactly two shapes because there are exactly two honest outcomes: the agent named an
 * admitted action with a complete argument set, or it named nothing.
 */
export type AgentActionSelection =
  | {
      readonly kind: typeof SEND_ORIGINATION_ALIAS;
      readonly recipientRef: string;
      readonly draftRef: string;
      readonly reason: string;
    }
  | { readonly kind: typeof NO_ACTION_KIND; readonly reason: string };

/**
 * Why a model response did not become a selection. Closed, and each value names WHAT was wrong so
 * a human reading a failed origination learns something rather than seeing "invalid".
 *
 * Every one of these is a REJECTION. Nothing in this feature repairs, coerces, trims-to-fit or
 * best-effort-extracts a malformed response: a response that is not exactly the contract is not a
 * selection, and the correct outcome is that no proposal exists.
 */
export type StructuredOutputRefusal =
  /** The response was not a single JSON object — prose, an array, a fragment, or nothing. */
  | "not-a-structured-object"
  /** The object's keys are not exactly the contract's keys. */
  | "unexpected-shape"
  /** `kind` is not an admitted action kind and is not the abstain value. */
  | "unsupported-action-kind"
  /** `args` is missing, is not an object, or its keys are not exactly the declared ones. */
  | "invalid-arguments"
  /** A reference is not a well-formed reference of its declared kind. */
  | "malformed-reference"
  /** A reference is well-formed but was never offered as a candidate for this tenant. */
  | "reference-not-offered"
  /** `reason` is missing, empty, not a string, or longer than the bound. */
  | "invalid-reason";

export type ParseAgentSelectionResult =
  | { readonly status: "selected"; readonly selection: AgentActionSelection }
  | { readonly status: "refused"; readonly reason: StructuredOutputRefusal };

/**
 * Why an origination attempt produced no proposal. A superset of the parse vocabulary, plus the
 * facts that have nothing to do with what the model said.
 */
export type OriginationRefusal =
  | "unauthenticated"
  /** The human's goal did not survive the released prompt validator. */
  | "goal-rejected"
  /** This tenant has nothing an agent could propose about. */
  | "no-candidates"
  /** The model runtime is not connected, or the Director's control is off. Never a fake proposal. */
  | "model-unavailable"
  /** The model responded, but not with the contract. Carries the specific parse refusal. */
  | StructuredOutputRefusal
  /** The agent declined to propose anything. An honest outcome, not an error. */
  | "no-action-proposed"
  /** The durable agent could not be resolved. Carries the specific proposer refusal. */
  | "no-authorized-tenant-context"
  | "agent-identity-authority-unavailable"
  | "no-durable-agent-identity"
  | "durable-agent-identity-retired"
  | "ambiguous-durable-agent-identity"
  /** The inlet refused the selected references. Carries the inlet's own reason. */
  | "proposal-refused";
