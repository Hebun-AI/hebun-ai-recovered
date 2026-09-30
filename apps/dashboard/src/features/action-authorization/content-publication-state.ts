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
    ...(entry.attempt?.providerResultId ? [`provider id ${entry.attempt.providerResultId}`] : []),
    ...(entry.attempt?.failureClass ? [`failure ${entry.attempt.failureClass}`] : []),
  ].join(" · ");
}
