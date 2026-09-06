/*
 * heby-action-inlet/contracts.ts — the R3A.1 proposal vocabulary (pure).
 *
 * WHAT THE CALLER MAY SAY. Two references. That is the entire input surface.
 *
 * It carries no tenant, no actor, no authority, no digest, no action id, no lifecycle and no
 * approval — the types make them unrepresentable rather than merely discouraged, exactly as
 * `CreateWorkArtifactInput` and `CreateRecipientInput` do. Tenant and actor come from the R1
 * session; both digests are DERIVED by the inlet from what it actually read; the action kind comes
 * from the slash command, never from a model.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

import type { ActionRequestRefusal } from "@/features/action-authorization/contracts";

/** The only action R3A.1 can propose. One command, one kind, chosen deterministically. */
export const SEND_ACTION_KIND = "send-external-communication" as const;
export const SEND_TOOL_ID = "heby.operations.send-communication" as const;
export const SEND_OWNER_WORKSPACE = "operations" as const;

export interface SendProposalInput {
  /** `external-recipient/<uuid>` — resolved against R3R. Never a raw address. */
  readonly recipientRef: string;
  /** `work-artifact/<uuid>@<n>` — resolved against R3W. Never raw text. */
  readonly draftRef: string;
}

/**
 * Every way a proposal can honestly fail.
 *
 * `recipient-not-found` covers absent, foreign-tenant and malformed with ONE answer, so a probe
 * cannot use the difference between refusals to discover that a recipient exists in a tenant the
 * caller cannot see. `draft-not-found` does the same for artifacts. The states that are NOT
 * collapsed are the ones a person can act on: a retired recipient and a superseded draft are real,
 * visible things the operator can fix, and telling them apart is help rather than disclosure.
 */
export type SendProposalRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "persistence-unavailable"
  | "recipient-not-found"
  | "recipient-retired"
  | "draft-not-found"
  | "draft-retired"
  | "draft-superseded"
  | "not-authorizable"
  | "already-pending";

/** What a surface may truthfully show after a proposal is filed. */
export interface SendProposalReceipt {
  readonly requestId: string;
  readonly actionKind: typeof SEND_ACTION_KIND;
  readonly recipientRef: string;
  readonly recipientLabel: string;
  readonly draftRef: string;
  readonly draftTitle: string;
  /** Always `pending-review`. There is no other value this type can hold. */
  readonly status: "pending-review";
}

/**
 * Two outcomes, not three.
 *
 * `already-pending` is a REFUSAL and not a success variant, because that is exactly what R3A's own
 * writer returns and it deliberately hands back no request id. Modelling it as a success would
 * force this module to go looking for the existing row — a second dedup lookup layered on top of
 * the unique index that already decided the question. R3A owns duplicate semantics; this module
 * reports them.
 */
export type SendProposalResult =
  | { readonly status: "proposed"; readonly receipt: SendProposalReceipt }
  | {
      readonly status: "refused";
      readonly reason: SendProposalRefusal;
      /** Human-readable, deterministic, and never model-authored. */
      readonly detail: string;
      /**
       * The AUTHORITATIVE writer's own refusal, carried verbatim when this inlet's closed
       * vocabulary is coarser than the one it received.
       *
       * `not-authorizable` is the collapse point: `recordActionRequest` and
       * `recordAgentOriginatedActionRequest` refuse in a vocabulary this inlet does not
       * reproduce, and every value it cannot name arrives here as that one reason. The three
       * mandate states `action-authorization/contracts.ts` documents as ones that "MAY NEVER
       * COLLAPSE" were collapsing anyway, one seam downstream of the comment that forbids it.
       *
       * INVENTED NOTHING. It is `ActionRequestRefusal` exactly as the writer returned it — this
       * inlet adds no value, renames none and interprets none. Optional because it exists only
       * when a writer was actually reached: a refusal raised BEFORE the writer (a retired
       * recipient, a superseded draft, an unpreparable action) has no authoritative refusal to
       * carry, and a caller must not be able to mistake this inlet's own verdict for one.
       *
       * NOT the prose in `detail`. That sentence embeds a recipient's display name for some
       * refusals, and a provenance column is not a place to put one.
       */
      readonly authorityRefusal?: ActionRequestRefusal;
    };

/**
 * The sentences a surface may use about a filed proposal, stated in code so a test can assert the
 * claim matches the repository and a surface can quote rather than invent.
 *
 * NOTE WHAT IS ABSENT: approved, authorized, sent, sending, scheduled, queued, delivered,
 * successful, executing. Filing a proposal moves no authority whatsoever.
 */
export const SEND_PROPOSAL_NON_EFFECTS: readonly string[] = [
  "Filing a proposal sends nothing and performs no external act.",
  "No permit is created, and nothing is authorized.",
  "No Governance decision is made; a human decides in /approvals.",
] as const;

/**
 * What filing a proposal DOES do. Kept separate from the list above on purpose: a test asserts that
 * every NON_EFFECT is a denial, and "the draft and the address are frozen by digest" is a positive
 * fact that was sitting in the wrong list. A statement about what happened does not belong in a
 * list whose whole meaning is what did not.
 */
export const SEND_PROPOSAL_EFFECTS: readonly string[] = [
  "One pending action request is filed for Director review.",
  "The exact draft revision and the exact recorded address are frozen by digest.",
] as const;

/* ═══════════════════════════════════════════════════════════════════════════
 * GIA-1 — THE GOVERNED INTERNAL ACT: RECORD ORGANIZATIONAL WORK.
 *
 * The second proposable action, and the FIRST whose execution never leaves this system. It is the
 * same shape as `/send` and deliberately so: one caller-supplied reference plus one caller-supplied
 * scalar, resolved server-side against the authority that owns the referent, frozen by digest, and
 * decided by a human before anything happens.
 *
 *   WHAT DIFFERS FROM A SEND, AND ONLY THIS
 *     the substrate       an internal authority, not a provider
 *     the reversibility   a deterministic inverse exists (`retireWork`) — it is NOT erasure
 *     the payload         a title and a department, never an address and never a draft's bytes
 *
 *   WHAT IS IDENTICAL, AND MUST STAY SO
 *     a proposal authorizes nothing, mints nothing, and performs nothing
 *     a human decides at the Governance surface, and a SECOND deliberate act spends the permit
 *     an agent may propose only inside a mandate a human recorded
 * ═════════════════════════════════════════════════════════════════════════ */

/** The registry kind GIA-1 proposes. A constant, chosen by the surface — never by a model. */
export const RECORD_WORK_ACTION_KIND = "record-work" as const;
export const RECORD_WORK_OWNER_WORKSPACE = "command" as const;

/**
 * What the caller may say. A title, and one department reference.
 *
 * It carries no tenant, no actor, no authority, no digest, no declared state and no accountable
 * human — the types make them unrepresentable rather than merely discouraged. The declared state is
 * absent because the Work Authority's own default (`planned`) is the only honest value for work
 * nobody has observed yet, and letting a proposal choose one would put an unverified claim about
 * the world inside an approval.
 */
/**
 * WHICH PART OF THE ORGANIZATION CARRIES THIS WORK — declared, never inferred (TRH-16).
 *
 * ── WHY A DISCRIMINATED UNION AND NOT AN OPTIONAL FIELD ──────────────────────
 *
 * `departmentRef?: string` would make three different facts indistinguishable: work the
 * organization deliberately holds at organization level, a caller who forgot the field, and a
 * malformed proposal. Silence would then have to MEAN something, and the meaning a reader picks is
 * whichever one is convenient. A closed union makes the caller say which of the two organizational
 * truths it is asserting, and makes saying neither a refusal.
 *
 * ── THE THREAT THIS PRESERVES, AND THE ONE IT STOPS MANUFACTURING ────────────
 *
 * The governed path is stricter than the human path because "a proposal that named nothing real
 * would put a decision about a fiction in front of the Director". THE THREAT IS FICTION, NOT
 * ABSENCE. A fabricated, foreign-tenant or retired department reference is fiction and still
 * refuses. Explicit organization-level work invents nothing: it names no department because there
 * is none, which is exactly what `work_items.department_id` NULL has always meant and what the
 * human path has always allowed.
 *
 *     EXPLICIT ABSENCE   != MALFORMED REFERENCE
 *     DEPARTMENTLESS WORK != FICTIONAL DEPARTMENT
 */
export type RecordWorkProposalDepartmentScope =
  | {
      readonly kind: "department";
      /** `department/<uuid>` — resolved against Organization Structure Authority. Never a name. */
      readonly departmentRef: string;
    }
  | {
      /**
       * Work this organization holds at organization level. NO department is looked up, and none
       * is invented — an organization with zero departments is a valid organization.
       */
      readonly kind: "organization-level";
    };

export interface RecordWorkProposalInput {
  /** The organization's own words for what the work is. Never model-authored on the human path. */
  readonly title: string;
  /** Declared, and refused when it is neither of the two organizational truths. */
  readonly department: RecordWorkProposalDepartmentScope;
}

/**
 * Every way a record-work proposal can honestly fail.
 *
 * `department-not-found` covers absent, foreign-tenant and malformed with ONE answer, so a probe
 * cannot use the difference between refusals to discover that a department exists in an
 * organization the caller cannot see. `department-retired` is deliberately NOT collapsed into it:
 * a retired department is a real thing the operator can see and fix, and saying so is help.
 */
export type RecordWorkProposalRefusal =
  | "unauthenticated"
  | "invalid-input"
  /*
   * THE DISCRIMINATOR ITSELF WAS NOT DECLARED, or contradicts itself — a missing `kind`, an
   * unknown one, `department` with no reference, or `organization-level` carrying one anyway.
   *
   * DELIBERATELY DISTINCT FROM `department-not-found`, and it leaks nothing by being so. That
   * refusal is collapsed because it answers "does this department exist?", a question about rows
   * a caller may not be allowed to see. This one answers "what did you claim?", a question about
   * the caller's own envelope — and a caller always knows what it sent.
   */
  | "invalid-department-scope"
  | "persistence-unavailable"
  | "department-not-found"
  | "department-retired"
  | "not-authorizable"
  | "already-pending";

/** What a surface may truthfully show after a record-work proposal is filed. */
export interface RecordWorkProposalReceipt {
  readonly requestId: string;
  readonly actionKind: typeof RECORD_WORK_ACTION_KIND;
  readonly title: string;
  /*
   * WHAT WAS FILED, IN THE SAME SHAPE IT WAS DECLARED. A receipt that carried
   * `departmentRef: string` would have to invent a value for organization-level work, which is the
   * fiction this phase exists to stop manufacturing. `null` here is the declared absence, and a
   * surface renders it as organization-level rather than as a missing name.
   */
  readonly departmentRef: string | null;
  readonly departmentName: string | null;
  /** Always `pending-review`. There is no other value this type can hold. */
  readonly status: "pending-review";
}

export type RecordWorkProposalResult =
  | { readonly status: "proposed"; readonly receipt: RecordWorkProposalReceipt }
  | {
      readonly status: "refused";
      readonly reason: RecordWorkProposalRefusal;
      /** Human-readable, deterministic, and never model-authored. */
      readonly detail: string;
      /** The AUTHORITATIVE writer's own refusal, carried verbatim. See `SendProposalResult`. */
      readonly authorityRefusal?: ActionRequestRefusal;
    };

/**
 * The sentences a surface may use about a filed record-work proposal.
 *
 * NOTE WHAT IS ABSENT: recorded, created, approved, authorized, executed. Filing a proposal creates
 * no work item whatsoever — the register is unchanged until a human decides and a permit is spent.
 */
export const RECORD_WORK_PROPOSAL_NON_EFFECTS: readonly string[] = [
  "Filing a proposal records no work item and changes the register not at all.",
  "No permit is created, and nothing is authorized.",
  "No Governance decision is made; a human decides in /approvals.",
] as const;

/** What filing a record-work proposal DOES do. Positive facts, kept out of the denial list. */
export const RECORD_WORK_PROPOSAL_EFFECTS: readonly string[] = [
  "One pending action request is filed for Director review.",
  "The exact title and the exact department are frozen by digest.",
] as const;

/**
 * WHAT EXECUTING IT WOULD DO, AND WHAT REVERSIBLE DOES NOT MEAN.
 *
 * Stated in code so the decision surface quotes rather than invents, and so a test can assert the
 * claim matches the repository. The second half is the load-bearing half: "reversible" is the word
 * a reader is most likely to hear as "undoable", and it is not.
 */
export const RECORD_WORK_REVERSIBILITY_MEANING: readonly string[] = [
  "The work item can be retired through the Organizational Work Authority that owns it.",
  "Retirement does not erase the creation, its audit event, or this Governance decision.",
  "Nothing rolls a committed transaction backwards, and no automatic rollback exists.",
] as const;
