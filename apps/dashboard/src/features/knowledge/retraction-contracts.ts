/*
 * knowledge/retraction-contracts.ts — the vocabulary of a source-level Knowledge retraction (R6D).
 *
 * Pure. No React, no I/O, no server, no authority.
 */

/** A sha256 as ingestion writes it: 64 lowercase hex characters. */
const SOURCE_DIGEST_RE = /^[0-9a-f]{64}$/;

/**
 * Whether a value is shaped like the digest ingestion records.
 *
 * Checked BEFORE any query, so a malformed identity is refused rather than becoming a lookup that
 * happens to match nothing — the two are different answers and only one of them is true.
 */
export function isSourceDigest(value: string | undefined): boolean {
  return SOURCE_DIGEST_RE.test((value ?? "").trim());
}

/**
 * Why a retraction did not happen. A closed set: an operator is told which of these it was, never a
 * generic failure.
 */
export type RetractionRefusal =
  /** No authorized tenant context. Nothing was read and nothing was written. */
  | "unauthorized"
  /** Signed in, but the durable role band does not permit mutating Knowledge. */
  | "forbidden"
  /** The durable control-plane database is not configured. */
  | "persistence-unavailable"
  /** The value supplied is not a source digest. Refused before any statement ran. */
  | "invalid-source-identity"
  /**
   * No live Knowledge in this tenant carries that digest. A digest belonging only to ANOTHER tenant
   * is indistinguishable from one that does not exist — deliberately, so this cannot be used to
   * probe what other organizations hold. A source already fully retracted lands here too, which is
   * what makes a repeated request deterministic instead of a second mutation.
   */
  | "source-not-found"
  /**
   * At least one fact from this source carries a bound Governance ratification.
   *
   * THE AUTHORITY BOUNDARY, NOT A MISSING FEATURE. Ratification is a decision by the tenant's
   * Governance authority; retraction is gated on the Knowledge authoring band, and K4 states plainly
   * that authoring authority is not Governance authority. Letting the weaker band withdraw what the
   * stronger one approved would reverse a Governance decision through a side door — and K4 has no
   * reversal runtime, deliberately. So this refuses, and says why, rather than inventing one.
   */
  | "source-contains-ratified-knowledge"
  /** The transaction was attempted and did not survive. Nothing changed. */
  | "write-failed";

export interface RetractedSource {
  readonly sourceDigest: string;
  /** How many facts were withdrawn from service. Never zero — a no-op refuses instead. */
  readonly retractedFactCount: number;
}

export type RetractionResult =
  | { readonly status: "retracted"; readonly source: RetractedSource }
  | { readonly status: "refused"; readonly reason: RetractionRefusal; readonly detail: string };

/** Operator-facing text for each refusal. Stated once so the UI cannot invent its own wording. */
export const RETRACTION_REFUSAL_DETAIL: Readonly<Record<RetractionRefusal, string>> = Object.freeze({
  unauthorized: "Sign in to your organization before retracting a source.",
  forbidden:
    "Retracting a source requires the same authority as adding one. Your role does not hold it.",
  "persistence-unavailable":
    "Durable persistence is not configured, so no Knowledge could be read or changed.",
  "invalid-source-identity": "That is not a source identity. Nothing was looked up.",
  "source-not-found":
    "No active Knowledge in your organization came from that source. Nothing was changed.",
  "source-contains-ratified-knowledge":
    "Some Knowledge from this source has been ratified by your Governance authority. Withdrawing it " +
    "would reverse a Governance decision, which this act cannot do. Nothing was changed.",
  "write-failed": "The retraction did not complete, so nothing was changed.",
});

/**
 * The one sentence the surface must carry.
 *
 * Hebun never kept the file: `knowledge-file-ingest.server.ts` reads the bytes into one buffer and
 * lets them go, and the `documents` table has no consumer. So a control saying "delete" would claim
 * a capability Hebun does not have and imply a cleanup it cannot perform.
 */
export const RETRACTION_SUMMARY =
  "Retracting a source withdraws the Knowledge it produced from active use: Heby stops reading it " +
  "and it stops counting toward company coverage. Nothing is deleted — every record keeps its text, " +
  "its version and its history. Hebun never stored the file itself, so there is no file to remove.";
