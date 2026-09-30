/*
 * action-authorization/content-publication-state.ts — CONTENT-PUBLICATION-STATE-1: the vocabulary of
 * what the ledger records about publishing ONE content revision.
 *
 * ── A READ OF THE LEDGER, NOT A LIFECYCLE ────────────────────────────────────
 *
 * The question it answers is exactly: "what publication activity is recorded for
 * `work-artifact/<id>@<n>`?" Every value is taken from a row that already exists:
 *
 *   request            heby_action_requests     (Action Authorization; target_ref = the revision)
 *   decision           heby_action_requests.approved_at / rejected_at (set by the decision writer)
 *   permit             action_permits           (one per request — action_permits_request_uq)
 *   attempt            action_execution_attempts (one per permit — action_execution_attempts_permit_uq)
 *
 * Nothing here is stored. There is no "current publication state" column anywhere, and this file
 * does not become one: a revision can legitimately carry several requests (rejected then re-proposed,
 * or executed then proposed again), so the answer is a HISTORY and never a single chosen row.
 *
 *     REQUEST RECORDED  != APPROVED         APPROVED != EXECUTED
 *     ATTEMPT ACCEPTED  != LIVE ON PROVIDER NO ROW   != READ FAILED
 *
 * An accepted attempt means the provider returned an id when Hebun sent the act. What the provider
 * shows NOW (processing, privacy, deletion) is a live provider read this vocabulary does not carry.
 *
 * Pure types, frozen values and pure functions. No I/O.
 */
import type {
  ExecutionAttemptStatus,
  ExecutionFailureClass,
  ProviderResponseClass,
} from "@/features/action-execution/contracts";
import { PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND } from "@/features/instagram-publishing/contracts";
import { PUBLISH_YOUTUBE_VIDEO_ACTION_KIND } from "@/features/youtube-publishing/contracts";

/** The action kinds that publish content. Closed: a `send` or `record-work` is not a publication. */
export const PUBLICATION_ACTION_KINDS = [
  PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND,
  PUBLISH_YOUTUBE_VIDEO_ACTION_KIND,
] as const;
export type PublicationActionKind = (typeof PUBLICATION_ACTION_KINDS)[number];

/** Which destination an action kind publishes to. Read from the kind, never from a payload. */
export const PUBLICATION_DESTINATION: Readonly<Record<PublicationActionKind, "instagram" | "youtube">> = Object.freeze({
  [PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND]: "instagram",
  [PUBLISH_YOUTUBE_VIDEO_ACTION_KIND]: "youtube",
});

export function isPublicationActionKind(value: string): value is PublicationActionKind {
  return (PUBLICATION_ACTION_KINDS as readonly string[]).includes(value);
}

/** Newest requests kept per revision. More than this is reported as truncated, never dropped silently. */
export const PUBLICATION_HISTORY_LIMIT = 20 as const;

/** `heby_action_request_status`, verbatim. */
export type PublicationRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";

/** R3A's derived permit display state (`derivePermitState`), taken — never recomputed here. */
export type PublicationPermitState = "active" | "expired" | "consumed" | "revoked" | "none";

export interface PublicationPermitFacts {
  readonly state: PublicationPermitState;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly revokedAt: string | null;
}

export interface PublicationAttemptFacts {
  /** The attempt's own id — the value an intentional republish acknowledges. */
  readonly attemptId: string;
  readonly status: ExecutionAttemptStatus;
  readonly providerResponseClass: ProviderResponseClass | null;
  /** `provider_message_id`: the Instagram media id or YouTube video id the provider returned. */
  readonly providerResultId: string | null;
  readonly failureClass: ExecutionFailureClass | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

/**
 * Where one request stands, composed from the existing words of the three owners. It is derived from
 * the row it describes and from nothing else, so two entries can never disagree about one request.
 */
export const PUBLICATION_STAGES = [
  "request-pending",
  "request-rejected",
  "request-withdrawn",
  /** Approved, but no permit row is recorded for it. Reported as the ledger has it. */
  "request-approved-without-permit",
  "permit-active",
  "permit-expired",
  "permit-revoked",
  /** The permit was consumed but no attempt row exists. Reported, never repaired or guessed at. */
  "permit-consumed-without-attempt",
  "execution-pending",
  "execution-accepted",
  "execution-refused",
  "execution-failed",
  "execution-unknown",
] as const;
export type PublicationStage = (typeof PUBLICATION_STAGES)[number];

export interface PublicationHistoryEntry {
  readonly requestId: string;
  readonly actionKind: PublicationActionKind;
  readonly destination: "instagram" | "youtube";
  /**
   * DUPLICATE-GUARD-1 — WHERE it publishes, as the governed payload bound it: the Instagram
   * `externalAccountId` or the YouTube `expectedChannelId`. Never a display label. `null` only if a
   * stored payload lacks it, which the guard treats as an identity it cannot match.
   */
  readonly destinationAccountId: string | null;
  /** The prior attempt this request's payload acknowledges, when it carries one. */
  readonly acknowledgesPriorAttemptId: string | null;
  /** The request's bound payload digest — lets an identical re-proposal keep its `already-pending` answer. */
  readonly payloadDigest: string;
  readonly requestStatus: PublicationRequestStatus;
  readonly proposedAt: string;
  readonly approvedAt: string | null;
  readonly rejectedAt: string | null;
  readonly permit: PublicationPermitFacts | null;
  readonly attempt: PublicationAttemptFacts | null;
  readonly stage: PublicationStage;
}

/**
 * The answer for one revision.
 *
 *   unknown              the ledger could not be read, or the question was malformed. NOT "none".
 *   no-request-recorded  the ledger WAS read and holds no publication request for this revision.
 *   recorded             the ledger holds these requests, oldest first (created_at, then id).
 */
export type ContentPublicationState =
  | {
      readonly status: "unknown";
      readonly artifactRef: string | null;
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed" | "invalid-reference";
    }
  | { readonly status: "no-request-recorded"; readonly artifactRef: string }
  | {
      readonly status: "recorded";
      readonly artifactRef: string;
      readonly entries: readonly PublicationHistoryEntry[];
      /** True when more than `PUBLICATION_HISTORY_LIMIT` requests exist; the OLDEST were left out. */
      readonly truncated: boolean;
    };

/** One request's stage, from its own row, permit and attempt. Pure and total. */
export function derivePublicationStage(entry: {
  readonly requestStatus: PublicationRequestStatus;
  readonly permit: { readonly state: PublicationPermitState } | null;
  readonly attempt: { readonly status: ExecutionAttemptStatus } | null;
}): PublicationStage {
  if (entry.attempt) return `execution-${entry.attempt.status}`;
  if (entry.requestStatus === "pending") return "request-pending";
  if (entry.requestStatus === "rejected") return "request-rejected";
  if (entry.requestStatus === "withdrawn") return "request-withdrawn";
  if (!entry.permit || entry.permit.state === "none") return "request-approved-without-permit";
  if (entry.permit.state === "consumed") return "permit-consumed-without-attempt";
  return `permit-${entry.permit.state}`;
}

/** The words a human and Heby read for a stage. Ledger words only; none says "published" or "live". */
export const PUBLICATION_STAGE_WORDING: Readonly<Record<PublicationStage, string>> = Object.freeze({
  "request-pending": "request awaiting a human decision",
  "request-rejected": "request rejected",
  "request-withdrawn": "request withdrawn",
  "request-approved-without-permit": "request approved; no permit is recorded for it",
  "permit-active": "request approved; permit active, not yet used",
  "permit-expired": "request approved; permit expired unused",
  "permit-revoked": "request approved; permit revoked",
  "permit-consumed-without-attempt": "request approved; permit consumed, but no execution attempt is recorded",
  "execution-pending": "execution attempt started; no outcome recorded",
  "execution-accepted": "execution attempt accepted by the provider",
  "execution-refused": "execution attempt refused",
  "execution-failed": "execution attempt failed",
  "execution-unknown": "execution attempt outcome unknown — whether the provider received it cannot be confirmed",
});

/** What this record never claims. Rendered beside it. */
export const CONTENT_PUBLICATION_NON_CLAIM =
  "This is what Hebun's action ledger records for this revision only. An accepted attempt means the provider returned an id when the act was sent; it is not a live read of what the provider shows now." as const;

/** One line per entry, for grounding and for a plain surface. */
export function formatPublicationEntry(entry: PublicationHistoryEntry): string {
  return [
    `${entry.destination} request ${entry.requestId}`,
    `proposed ${entry.proposedAt}`,
    PUBLICATION_STAGE_WORDING[entry.stage],
    ...(entry.attempt ? [`attempt ${entry.attempt.attemptId}`] : []),
    ...(entry.attempt?.providerResultId ? [`provider id ${entry.attempt.providerResultId}`] : []),
    ...(entry.attempt?.failureClass ? [`failure ${entry.attempt.failureClass}`] : []),
  ].join(" · ");
}

/* ════════════════════════════════════════════════════════════════════════════
 * CONTENT-PUBLICATION-DUPLICATE-GUARD-1 — the policy, as a pure function of the history above.
 *
 * V1 PUBLICATION IDENTITY (Director decision 1): tenant + action kind + destination account +
 * EXACT revision. The tenant and the revision are the history's own read predicates; the kind and
 * the account are matched here. Nothing crosses revisions — the same content in a new revision is
 * NOT a duplicate in this phase (deferred: CONTENT-PUBLICATION-CROSS-REVISION-DUPLICATE-1).
 *
 *   in flight                          → refuse until it resolves
 *   latest consequential = accepted     → the new act must acknowledge THAT attempt
 *   latest consequential = unknown      → the new act must acknowledge THAT attempt
 *   only failed / refused (or nothing) → allowed; an acknowledgement, if supplied, must still be true
 *
 * "Consequential" = an attempt whose provider outcome is `accepted` or `unknown`. `failed` and
 * `refused` are recorded only when the executor could prove nothing left or the provider refused
 * it, so they establish no publication and demand no acknowledgement. UNKNOWN is never read as
 * failed.
 *
 * An acknowledgement authorizes NOTHING. It is one more bound fact in a request Governance still
 * decides, a permit still gates, and the tenant's arming still contains.
 * ════════════════════════════════════════════════════════════════════════════ */

export interface PublicationIdentity {
  readonly actionKind: PublicationActionKind;
  /** Instagram `externalAccountId` / YouTube `expectedChannelId`, as the payload binds it. */
  readonly destinationAccountId: string;
  /** `work-artifact/<id>@<n>` — the exact revision. */
  readonly artifactRef: string;
}

export const PUBLICATION_GUARD_REFUSALS = [
  /** Another publication for this identity is pending, authorized-unused, or being executed. */
  "publication-in-flight",
  /** An accepted or unknown attempt exists and this act does not acknowledge it. */
  "prior-publication-unacknowledged",
  /** The acknowledgement names an older consequential attempt; a newer one exists. */
  "prior-publication-acknowledgement-stale",
  /** The acknowledgement names no consequential attempt of THIS identity. */
  "prior-publication-acknowledgement-mismatch",
] as const;
export type PublicationGuardRefusal = (typeof PUBLICATION_GUARD_REFUSALS)[number];

export type PublicationGuardVerdict =
  | { readonly status: "clear"; readonly latestConsequentialAttemptId: string | null }
  | { readonly status: "refused"; readonly reason: PublicationGuardRefusal; readonly latestConsequentialAttemptId: string | null };

/** Stages that mean a publication for this identity may still reach the provider. */
const IN_FLIGHT_AT_PROPOSAL: readonly PublicationStage[] = [
  "request-pending",
  "permit-active",
  "execution-pending",
  /* Impossible by construction (spend and attempt are one transaction); fail closed if ever seen. */
  "permit-consumed-without-attempt",
];
/*
 * At EXECUTION the act being executed is itself authorized-unused, and another authorized-unused
 * permit cannot send without passing this same guard later. What can race a send is an attempt
 * already started.
 */
const IN_FLIGHT_AT_EXECUTION: readonly PublicationStage[] = ["execution-pending", "permit-consumed-without-attempt"];

export function evaluatePublicationGuard(
  history: readonly PublicationHistoryEntry[],
  identity: PublicationIdentity,
  acknowledgesPriorAttemptId: string | null,
  phase:
    /*
     * At proposal, a PENDING request with exactly the proposed payload digest is not reported as "in
     * flight": the request writer's unique index answers that case as `already-pending`, the
     * released contract for an identical re-proposal.
     */
    | { readonly at: "proposal"; readonly proposedPayloadDigest?: string }
    | { readonly at: "execution"; readonly executingRequestId: string },
): PublicationGuardVerdict {
  const same = history.filter(
    (e) => e.actionKind === identity.actionKind && e.destinationAccountId === identity.destinationAccountId,
  );
  const consequential = same
    .filter((e) => e.attempt !== null && (e.attempt.status === "accepted" || e.attempt.status === "unknown"))
    .map((e) => e.attempt!)
    /* Deterministic: the attempt's own start time, then its id. */
    .sort((a, b) => (a.startedAt === b.startedAt ? (a.attemptId < b.attemptId ? -1 : 1) : a.startedAt < b.startedAt ? -1 : 1));
  const latest = consequential.length > 0 ? consequential[consequential.length - 1]!.attemptId : null;

  const inFlight =
    phase.at === "proposal"
      ? same.some(
          (e) =>
            IN_FLIGHT_AT_PROPOSAL.includes(e.stage) &&
            !(e.stage === "request-pending" && phase.proposedPayloadDigest !== undefined && e.payloadDigest === phase.proposedPayloadDigest),
        )
      : same.some((e) => e.requestId !== phase.executingRequestId && IN_FLIGHT_AT_EXECUTION.includes(e.stage));
  if (inFlight) return { status: "refused", reason: "publication-in-flight", latestConsequentialAttemptId: latest };

  if (acknowledgesPriorAttemptId !== null) {
    if (acknowledgesPriorAttemptId === latest) return { status: "clear", latestConsequentialAttemptId: latest };
    const older = consequential.some((a) => a.attemptId === acknowledgesPriorAttemptId);
    return {
      status: "refused",
      reason: older ? "prior-publication-acknowledgement-stale" : "prior-publication-acknowledgement-mismatch",
      latestConsequentialAttemptId: latest,
    };
  }
  if (latest !== null) return { status: "refused", reason: "prior-publication-unacknowledged", latestConsequentialAttemptId: latest };
  return { status: "clear", latestConsequentialAttemptId: null };
}
