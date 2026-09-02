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
import { RECORD_WORK_ACTION_KIND, SEND_ACTION_KIND } from "@/features/heby-action-inlet/contracts";
import type { HebyActionKind } from "@/features/heby-actions/contracts";

/**
 * The action kinds an agent may originate. EXACTLY TWO, on purpose.
 *
 * The registry declares nine action kinds. Seven of them are not here: `device-action` is
 * Platform-restricted and database-refused, `grant-permission` and `modify-governance-policy` are
 * authority changes no machine should ever draft, `restart-workflow` has no substrate, and the
 * three read/preparation kinds need no proposal at all. Admitting a kind is a deliberate act, and
 * the set is smaller than the registry rather than equal to it.
 *
 * `send-external-communication` qualifies for one reason: BOTH of its referents can be resolved
 * authoritatively against released read seams, so every argument the agent chooses is checkable
 * against a row the tenant already owns.
 *
 * `record-work` (GIA-1) qualifies for the same reason and no other: its one reference names an
 * in-service department of this tenant, resolvable against the released Organization Structure read
 * seam. Its title is prose, and prose is why a human still reads every proposal before it becomes
 * an act — being admitted here is permission to ASK, and nothing else.
 *
 * ADMITTING A KIND HERE GRANTS NO AGENT ANYTHING. A mandate must separately name it, a human must
 * separately decide it, and a permit must separately be spent. This list is the CEILING of the
 * ceiling: nothing outside it can be mandated, because the mandate vocabulary IS this list.
 */
export const AGENT_ORIGINABLE_ACTION_KINDS = ["send", "record-work"] as const;

export type AgentOriginableActionKind = (typeof AGENT_ORIGINABLE_ACTION_KINDS)[number];

/** The registry kind each admitted alias maps to. The alias never becomes the kind by string. */
export const SEND_ORIGINATION_ALIAS = "send" as const;

/**
 * GIA-1's alias. It happens to READ the same as its registry kind, and it is still not the same
 * string by construction: every consumer resolves it through {@link AGENT_ORIGINABLE_REGISTRY_KIND}
 * exactly as `send` is resolved, so a later rename of either vocabulary moves one side only and the
 * total map is what fails to compile.
 */
export const RECORD_WORK_ORIGINATION_ALIAS = "record-work" as const;

/**
 * THE ALIAS-TO-REGISTRY-KIND MAP — stated once, here, where the alias vocabulary lives (AMA-2).
 *
 * ── WHY THIS HAD TO EXIST BEFORE A MANDATE COULD BE ENFORCED ─────────────────
 *
 * A mandate's `proposal_scope` is `AgentOriginableActionKind[]` — ALIASES, the vocabulary a model
 * selects from. A prepared action carries a `HebyActionKind` — the REGISTRY kind, the vocabulary
 * the authorization chain speaks. Those two are deliberately different strings: `"send"` is not
 * `"send-external-communication"`, and this file has said since AGENT-PROPOSAL-1 that "the alias
 * never becomes the kind by string".
 *
 * Until AMA-2 the translation existed only as a fact about control flow — the inlet's
 * `proposeAgentOriginatedSendAction` passes the CONSTANT `SEND_ACTION_KIND` because the origination
 * selected the alias. Nothing named the correspondence, so nothing could check it. A ceiling
 * comparing `mandate.proposalScope` against `prepared.actionKind` directly would have matched
 * NOTHING and refused every proposal — fail-closed, and wrong, because it would report an
 * in-scope act as out of scope.
 *
 * ── WHY IT IS A TOTAL RECORD, AND WHY THE VALUE IS IMPORTED ──────────────────
 *
 * `Record<AgentOriginableActionKind, HebyActionKind>` is TOTAL: admitting a new alias without
 * declaring what registry kind it denotes is a COMPILE ERROR, not a silent hole a ceiling would
 * read as "outside scope". And the value is the released `SEND_ACTION_KIND` itself rather than a
 * repeated literal, so the inlet's constant and this map cannot drift apart.
 *
 * It maps and nothing else. It admits no kind, grants nothing, and reverses nothing: there is no
 * registry-kind-to-alias direction here, because a registry kind that no alias denotes is exactly
 * what a ceiling must be able to refuse.
 */
export const AGENT_ORIGINABLE_REGISTRY_KIND: Readonly<
  Record<AgentOriginableActionKind, HebyActionKind>
> = Object.freeze({
  [SEND_ORIGINATION_ALIAS]: SEND_ACTION_KIND,
  [RECORD_WORK_ORIGINATION_ALIAS]: RECORD_WORK_ACTION_KIND,
});

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
