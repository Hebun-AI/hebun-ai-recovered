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
