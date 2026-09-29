/*
 * content-intake/contracts.ts — the vocabulary of ONE human batch supply from Google Drive
 * (CONTENT-INTAKE-1). Pure and client-safe: no server module is named here, type-only or otherwise.
 *
 *     ONE PICKER CEREMONY  →  MANY INDEPENDENT ADMISSIONS  →  ONE HONEST OUTCOME PER FILE
 *
 * A batch is orchestration, not authority. It belongs to exactly one tenant, one human, one signed
 * Picker binding, one content draft and one exact revision; every file in it is admitted — or refused —
 * by the existing per-file Media admission on its own. There is no "all or none": a Drive read and an
 * object write are external facts, and a batch that pretended to roll them back would be lying. So a
 * batch never reports one word for many files. It reports each file.
 *
 * WHAT A BATCH NEVER DOES: review, select, package, authorize, publish, send media to a generative
 * model, or create Knowledge. Admission is custody.
 */

/** Which admission a batch runs. Chosen by the server action the human's control calls — never by a MIME claim. */
export type SuppliedDriveBatchKind = "image" | "video";

/*
 * ── THE BOUND ────────────────────────────────────────────────────────────────
 *
 * `maxFiles` — the most files ONE request may name. Enforced by the server before anything is read;
 * the chooser's own limit (`setMaxItems`) is the same number, but it is a convenience, not the bound.
 *
 *   image  10   each ≤ 20 MiB, read whole into memory ONE AT A TIME (sequential, never concurrent), so
 *               the peak is one image, not ten.
 *   video   3   each ≤ 20 MiB, streamed Drive → VPS and probed there with ffprobe — the costly path.
 *
 * `startCutoffMs` — a file is STARTED only while the request is younger than this. The Operations
 * route runs for at most 180 s (`maxDuration`), and a file already started cannot be stopped cleanly,
 * so the cutoff leaves one worst-case file's time after it:
 *
 *   image  100 s   + meta 10 s + download headers 10 s + object put 30 s + verify 15 s ≈ 165 s
 *   video   20 s   + meta 10 s + body 120 s + probe/row                             ≈ 160 s
 *
 * A file not started is `not-attempted`: NOTHING was read for it. That is the one outcome the door may
 * resubmit on its own, because resubmitting it cannot repeat an ambiguous external effect.
 *
 * These are conservative engineering bounds chosen from the timeouts above, not provider limits —
 * Google documents no maximum for `setMaxItems`.
 */
export const CONTENT_INTAKE_BATCH_LIMITS = Object.freeze({
  image: Object.freeze({ maxFiles: 10, startCutoffMs: 100_000 }),
  video: Object.freeze({ maxFiles: 3, startCutoffMs: 20_000 }),
});

/** Refusals of the WHOLE batch. Every one of them is decided before any Drive file is read. */
export type SuppliedDriveBatchRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "batch-empty"
  | "batch-too-large"
  /** The binding is missing, forged, expired, another session's, or its account changed. */
  | "drive-connection-not-bound"
  /** The bound connection can no longer read the per-file capability. */
  | "drive-capability-not-available";

/**
 * One file's outcome. `R` is the per-file admission's own refusal vocabulary — reused, never restated.
 *
 *   admitted             a new supplied Media asset — NOT reviewed, selected, approved or published
 *   existing             this exact file, with these exact bytes, was already supplied for this revision
 *   refused              the admission refused this file; nothing was filed for it
 *   not-attempted        the batch stopped before this file; nothing was read for it
 *   duplicate-selection  the same file id appeared earlier in this batch; it was not read twice
 */
export type SuppliedDriveBatchFileOutcome<R extends string = string> =
  | {
      readonly fileId: string;
      readonly status: "admitted" | "existing";
      readonly assetId: string;
      /** The connection the ROW names (NULL only for a historical `existing` row admitted before it was recorded). */
      readonly suppliedSourceIntegrationId: string | null;
    }
  | { readonly fileId: string; readonly status: "refused"; readonly reason: R; readonly detail?: string }
  | { readonly fileId: string; readonly status: "not-attempted" }
  | { readonly fileId: string; readonly status: "duplicate-selection" };

/**
 * Why a batch stopped before its last file, if it did.
 *
 *   time-budget         the start cutoff passed; the rest are `not-attempted` and may be resubmitted
 *   batch-condition     a refusal that is not about ONE file (session, storage, database, the draft
 *                       revision, the binding or the connection) — repeating it per file would only
 *                       repeat the refusal, and the next file must not be read under it
 *   provenance-mismatch an admitted row named a connection other than the bound one — impossible by
 *                       construction; if it ever happens, nothing more is read
 */
export type SuppliedDriveBatchStop = "time-budget" | "batch-condition" | "provenance-mismatch";

export interface SuppliedDriveBatchSummary {
  readonly requested: number;
  readonly admitted: number;
  readonly existing: number;
  readonly refused: number;
  readonly notAttempted: number;
  readonly duplicateSelections: number;
}

export type SuppliedDriveBatchResult<R extends string = string> =
  | { readonly status: "refused"; readonly reason: SuppliedDriveBatchRefusal; readonly detail?: string }
  | {
      readonly status: "processed";
      readonly kind: SuppliedDriveBatchKind;
      readonly files: readonly SuppliedDriveBatchFileOutcome<R>[];
      readonly summary: SuppliedDriveBatchSummary;
      readonly stoppedBy: SuppliedDriveBatchStop | null;
    };

/** Count outcomes. Pure — the summary is always derived from the files, never kept beside them. */
export function summarizeBatchOutcomes(files: readonly SuppliedDriveBatchFileOutcome[]): SuppliedDriveBatchSummary {
  const n = (s: SuppliedDriveBatchFileOutcome["status"]) => files.filter((f) => f.status === s).length;
  return {
    requested: files.length,
    admitted: n("admitted"),
    existing: n("existing"),
    refused: n("refused"),
    notAttempted: n("not-attempted"),
    duplicateSelections: n("duplicate-selection"),
  };
}
