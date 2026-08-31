/*
 * agent-mandate/contracts.ts — the vocabulary of the Agent Mandate Authority (AMA-1).
 *
 * ── THE ONE SENTENCE THIS FEATURE EXISTS TO MAKE TRUE ────────────────────────
 *
 * "A mandate is the organization's recorded statement of the bounded purpose an agent serves and
 *  the maximum surface inside which it may propose."
 *
 * A CEILING, never a grant. Formally:
 *
 *   proposal_allowed(agent, action)  REQUIRES  action ∈ mandate.scope      (necessary)
 *   action ∈ mandate.scope           IMPLIES   nothing                     (never sufficient)
 *
 * ── WHAT AMA-1 IS, AND THE FOUR THINGS IT IS NOT ─────────────────────────────
 *
 * AMA-1 is the AUTHORITY FOUNDATION: a mandate can be designed, persisted, bound to a Governance
 * decision, and audited. It is deliberately NOT proposal-enforced, NOT Heby-grounded, and NOT
 * production-accepted, and this file must never be edited to imply otherwise.
 *
 *   DESIGNED / PERSISTED / GOVERNANCE-BOUND / AUDITED   yes, at AMA-1
 *   PROPOSAL-ENFORCED                                   no — AMA-2 owns that seam
 *   HEBY-GROUNDED                                       no — nothing reads this for an answer
 *   PRODUCTION-ACCEPTED                                 no — an independent later fact
 *
 * Pure types and constants. No React, no I/O, no database, no authority.
 */

import {
  AGENT_ORIGINABLE_ACTION_KINDS,
  type AgentOriginableActionKind,
} from "@/features/agent-origination/contracts";

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CEILING VOCABULARY
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The action kinds a mandate may admit.
 *
 * THIS IS NOT A COPY. It is the released `AGENT_ORIGINABLE_ACTION_KINDS` itself, re-exported under
 * the name this feature uses. A mandate scope is therefore typed `AgentOriginableActionKind[]`,
 * which makes a superset a COMPILE ERROR rather than a runtime refusal — and it makes it
 * impossible for this feature to drift into offering a kind the origination path never admitted.
 *
 * A mandate may name FEWER kinds. It may never name more, and it may never name a different one.
 */
export const MANDATE_SCOPE_VOCABULARY: readonly AgentOriginableActionKind[] =
  AGENT_ORIGINABLE_ACTION_KINDS;

export type MandateScopeKind = AgentOriginableActionKind;

/** Whether a value is an admissible scope member. Membership, never repair. */
export function isMandateScopeKind(value: unknown): value is MandateScopeKind {
  return (
    typeof value === "string" &&
    (MANDATE_SCOPE_VOCABULARY as readonly string[]).includes(value)
  );
}

/**
 * Canonicalise a proposed scope: de-duplicated, and ordered by the released vocabulary's own order.
 *
 * ORDER COMES FROM THE VOCABULARY, NOT FROM `sort()`. Two mandates admitting the same kinds must
 * store the same array, so a reader can compare scopes without normalising them again; deriving the
 * order from the vocabulary means the canonical form cannot depend on locale collation.
 *
 * Returns `null` when the input is not an array of admissible kinds. It never drops an unknown
 * member and continues — a scope naming something outside the vocabulary is refused whole, because
 * silently narrowing what a human typed would record a mandate nobody authorized.
 */
export function canonicaliseMandateScope(value: unknown): readonly MandateScopeKind[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isMandateScopeKind)) return null;
  const present = new Set<string>(value as readonly string[]);
  return MANDATE_SCOPE_VOCABULARY.filter((kind) => present.has(kind));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * BOUNDS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Prose bounds for the purpose statement. Generous enough for a real organizational sentence,
 * bounded because an unbounded text column reachable from a request is both a denial-of-service
 * surface and a place to hide a payload — the reasoning SIA-3 already applied to its own prose.
 */
export const MAX_MANDATE_PURPOSE_CHARACTERS = 2_000;
/** Short enough that a purpose cannot be a single word standing in for a decision. */
export const MIN_MANDATE_PURPOSE_CHARACTERS = 12;

/** The first revision's ordinal. Every mandate chain starts here. */
export const FIRST_MANDATE_REVISION = 1;

/* ═══════════════════════════════════════════════════════════════════════════
 * THE GOVERNANCE SUBJECT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The Governance subject type for a mandate revision.
 *
 * THE SUBJECT IS THE REVISION, NOT THE AGENT. A decision bound to the agent would silently mean
 * "whatever mandate is current when someone reads this" — the exact defect K4 found when G2's
 * subject was a Knowledge fact rather than a Knowledge version. Each revision carries its own
 * decision, and a decision for revision 2 can never be read as a decision for revision 3.
 *
 * `decision_records.subject_type` is `text`, so this costs no migration. It is the ninth subject
 * type the transaction-joinable Governance writer accepts, and Governance owns none of the state
 * it names — the same relationship Knowledge, Membership, Identity enrollment, Action
 * authorization and Agent improvement already have with it.
 */
export const AGENT_MANDATE_SUBJECT_TYPE = "agent_mandate" as const;

/**
 * The decision type. `approve` — an existing enum value, and the honest one.
 *
 * NOT `ratify`: ratification is the organization endorsing a statement as true, and a mandate is
 * not a truth claim. NOT `delegate-authority`: a mandate moves no Governance authority and grants
 * nothing. NOT `certify` or `promote`: nothing is elevated. What a human does here is approve that
 * this bounded purpose shall stand.
 */
export const AGENT_MANDATE_DECISION_TYPE = "approve" as const;

/**
 * The `governance_domain` a mandate decision belongs to. Added at AMA-1 — see the enum's own
 * comment for why `agent-registration` was refused despite existing and being unused.
 */
export const AGENT_MANDATE_DOMAIN = "agent-mandate" as const;

/**
 * The ledger outcome. One value, because a mandate decision has one outcome: this bounded purpose
 * shall stand.
 *
 * DELIBERATELY NOT `approved`. A ledger row read years later must not suggest that an agent was
 * approved, or that an act was authorized. What was approved is a BOUND, and the word says so.
 *
 * There is no `-refused` counterpart at AMA-1, because refusing to establish a mandate leaves the
 * organization exactly where it was and writes nothing anywhere — the same reason
 * `knowledge.reject` is absent from the Knowledge audit vocabulary. A decision type that could
 * record a refusal would need its own runtime, and this phase ships none.
 */
export const AGENT_MANDATE_BOUNDED_OUTCOME = "agent-mandate-bounded" as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * AUDIT VOCABULARY
 * ═════════════════════════════════════════════════════════════════════════ */

/** The `audit_log.entity_type` for a mandate revision. Free text on that table; no migration. */
export const AGENT_MANDATE_ENTITY_TYPE = "agent_mandate" as const;

/**
 * The mutation classes AMA-1 actually performs. Exactly two, and they are the same write.
 *
 * `agent-mandate.established` — the first revision for an agent.
 * `agent-mandate.revised`     — a later revision, superseding exactly one predecessor.
 *
 * DELIBERATELY ABSENT: `agent-mandate.withdrawn`. Withdrawal is a revision whose scope is empty,
 * and it is filed as `agent-mandate.revised` because that is what happened — a new revision was
 * established. A separate action name would let a reader believe some other kind of write occurred,
 * and would need its own writer to stay honest.
 *
 * ALSO ABSENT: `agent-mandate.applied`, `agent-mandate.enforced`, `agent-mandate.consumed`. None
 * of those capabilities exists, and a vocabulary entry is a claim.
 */
export type AgentMandateAuditAction = "agent-mandate.established" | "agent-mandate.revised";

export const AGENT_MANDATE_AUDIT_ESTABLISHED = "agent-mandate.established" as const;
export const AGENT_MANDATE_AUDIT_REVISED = "agent-mandate.revised" as const;

export const AGENT_MANDATE_AUDIT_ACTIONS: readonly AgentMandateAuditAction[] = [
  AGENT_MANDATE_AUDIT_ESTABLISHED,
  AGENT_MANDATE_AUDIT_REVISED,
];

/* ═══════════════════════════════════════════════════════════════════════════
 * REFUSALS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Why a mandate was not established. Closed on purpose: each value is a fact about the request or
 * the organization's state, never a judgement about the mandate's content.
 */
export type AgentMandateRefusal =
  /** No server-resolved tenant, or no human. There is no parameter that could supply one. */
  | "unauthenticated"
  /** The control plane is not reachable. Fail closed; never fall back to memory. */
  | "persistence-unavailable"
  /** A justification is required for every Governance decision, and this one was absent or thin. */
  | "justification-required"
  /** The purpose statement is missing, empty, or outside its bounds. Never trimmed into shape. */
  | "mandate-purpose-required"
  /**
   * The proposed scope is not an array of admissible kinds. A scope naming anything outside the
   * released origination vocabulary lands here, and it is refused WHOLE rather than narrowed.
   */
  | "mandate-scope-invalid"
  /**
   * The agent identity authority could not be reached. DELIBERATELY DISTINCT from
   * `agent-unresolvable`: telling a tenant that owns an agent that it owns none would be a
   * fabricated absence.
   */
  | "agent-identity-authority-unavailable"
  /** No durable agent with that id exists IN THIS TENANT. Another tenant's agent resolves here. */
  | "agent-unresolvable"
  /**
   * The agent exists and has been withdrawn from service. Bounding the future proposals of
   * something that no longer proposes states a constraint on nothing.
   */
  | "agent-retired"
  /** The tenant has no Governance authority yet — no bootstrap decision exists. */
  | "no-governance-authority"
  /**
   * Authenticated, and not the human Governance established. A tenant owner without Governance
   * authority is refused exactly like a stranger.
   */
  | "not-the-governance-authority"
  /**
   * The caller stated which revision they were shown, and the effective revision has moved since.
   * K4's lesson: a compare-and-swap stops two SIMULTANEOUS writers and cannot see the slower human
   * case — a review opened against revision 2 and submitted after someone committed revision 3.
   * It can only ever REFUSE.
   */
  | "stale-mandate-revision"
  /** Two establishments raced and this one lost. Nothing was written, and nothing was overwritten. */
  | "concurrent-mandate-change";

export interface EstablishedAgentMandate {
  readonly mandateId: string;
  readonly agentId: string;
  readonly mandateRevision: number;
  readonly purpose: string;
  readonly proposalScope: readonly MandateScopeKind[];
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly effectiveFrom: string;
  readonly supersedesMandateId: string | null;
}

export type EstablishAgentMandateResult =
  | { readonly status: "established"; readonly mandate: EstablishedAgentMandate }
  | { readonly status: "refused"; readonly reason: AgentMandateRefusal };

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BOUNDARY, AS DATA
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * WHAT A MANDATE NEVER MEANS.
 *
 * Data rather than prose in a comment, for the reason `agent-identity/ceremony-disclosure.ts`
 * already established: a sentence buried in a file can be quietly softened by anyone editing near
 * it, and no test would notice. As a frozen list it can be asserted — the list cannot lose an
 * entry, and each entry names a capability this repository can independently prove absent.
 */
export const MANDATE_DOES_NOT_MEAN = Object.freeze([
  "authorized to execute",
  "authorized to approve",
  "authorized to issue permits",
  "authorized to access a provider",
  "authorized to grant permissions",
  "authorized to modify Governance",
  "authorized to widen its own mandate",
  "authorized to perform every technically available capability",
] as const);

/**
 * WHAT AMA-1 REACHED, AND WHAT IT DID NOT.
 *
 * The `agent-identity` capability ladder's shape, applied to this authority. Every rung above the
 * first is unreached in this repository at AMA-1, and each `reached: false` is a claim a test
 * proves structurally rather than a promise this file makes.
 */
export const MANDATE_CAPABILITY_LADDER = Object.freeze([
  {
    rung: "MANDATE RECORDED",
    reached: true,
    detail:
      "A durable, versioned row exists, bound to one agent and to the Governance decision that authorized it.",
  },
  {
    rung: "PROPOSAL-ENFORCED",
    reached: false,
    detail:
      "No proposal path reads a mandate. What an agent may originate is still the released global vocabulary.",
  },
  {
    rung: "HEBY-GROUNDED",
    reached: false,
    detail: "No answer flow reads a mandate. Heby cannot state what an agent is for.",
  },
  {
    rung: "PERMIT-BEARING",
    reached: false,
    detail: "A mandate mints nothing. Every consequential act still needs its own human decision.",
  },
  {
    rung: "EXECUTABLE",
    reached: false,
    detail: "Nothing is dispatched. Establishing a mandate performs no work and executes nothing.",
  },
] as const);

/**
 * THE AUTHORITY BOUNDARY, STATED ONCE, AS DATA.
 *
 * Six owners, six concerns, and the whole point of AMA-1 is that establishing the second one moved
 * none of the other five.
 */
export const AGENT_MANDATE_AUTHORITY_BOUNDARY = Object.freeze({
  agentIdentity: "owns who the agent is — establishment and retirement, and nothing else",
  agentMandate: "owns what organizational purpose the agent serves, and its maximum proposal surface",
  capabilityRegistry: "owns what action kinds technically exist",
  governance: "owns the human authorization decision concerning a mandate",
  actionAuthorization: "owns authorization of each consequential act",
  execution: "owns whether an authorized act actually runs",
} as const);
