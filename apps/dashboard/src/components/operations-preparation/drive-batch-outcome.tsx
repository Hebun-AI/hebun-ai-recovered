"use client";

import {
  summarizeBatchOutcomes,
  type SuppliedDriveBatchFileOutcome,
  type SuppliedDriveBatchRefusal,
  type SuppliedDriveBatchResult,
  type SuppliedDriveBatchStop,
} from "@/features/content-intake/contracts";

/*
 * CONTENT-INTAKE-1 — what the two Drive doors share AFTER the chooser: submitting one ceremony's files,
 * and saying truthfully what happened to each.
 *
 * Only `not-attempted` files are ever resubmitted, and only after a `time-budget` stop in a request
 * that did attempt something: nothing was read for them, so a second request cannot repeat an
 * external effect. A refused file is never retried here, and a request the server refused outright is
 * never resubmitted.
 */

export interface DriveBatchRun {
  readonly files: readonly SuppliedDriveBatchFileOutcome[];
  readonly stoppedBy: SuppliedDriveBatchStop | null;
  /** A continuation request the server refused outright; its files stay `not-attempted`. */
  readonly continuationRefused: SuppliedDriveBatchRefusal | null;
}

export async function runDriveBatch(
  fileIds: readonly string[],
  submit: (ids: string[]) => Promise<SuppliedDriveBatchResult>,
): Promise<{ readonly status: "refused"; readonly reason: SuppliedDriveBatchRefusal } | ({ readonly status: "processed" } & DriveBatchRun)> {
  const first = await submit([...fileIds]);
  if (first.status === "refused") return { status: "refused", reason: first.reason };

  let result = first;
  const settled: SuppliedDriveBatchFileOutcome[] = [];
  for (;;) {
    const waiting = result.files.filter((f) => f.status === "not-attempted");
    const attempted = result.files.filter((f) => f.status !== "not-attempted" && f.status !== "duplicate-selection");
    settled.push(...result.files.filter((f) => f.status !== "not-attempted"));
    if (result.stoppedBy !== "time-budget" || waiting.length === 0 || attempted.length === 0) {
      return { status: "processed", files: [...settled, ...waiting], stoppedBy: result.stoppedBy, continuationRefused: null };
    }
    const next = await submit(waiting.map((f) => f.fileId));
    if (next.status === "refused") {
      return { status: "processed", files: [...settled, ...waiting], stoppedBy: "time-budget", continuationRefused: next.reason };
    }
    result = next;
  }
}

export const BATCH_REFUSAL_WORDING: Record<SuppliedDriveBatchRefusal, string> = {
  unauthenticated: "Your session could not be resolved. Nothing was read or stored.",
  "invalid-input": "The selection or the draft revision is not valid. Nothing was read or stored.",
  "batch-empty": "No file was chosen. Nothing was read or stored.",
  "batch-too-large": "More files were chosen than one batch accepts. Nothing was read or stored — choose fewer.",
  "drive-connection-not-bound":
    "The Google account you chose the files with is no longer the one connected, or the chooser session expired. Nothing was read through any other account. Open the chooser again.",
  "drive-capability-not-available": "Hebun has not been granted access to files you choose in Google Drive. Nothing was read or stored.",
};

const STOP_WORDING: Record<SuppliedDriveBatchStop, string> = {
  "time-budget": "Hebun ran out of time for this request before reaching every file.",
  "batch-condition": "Hebun stopped after a refusal that applies to the whole batch, not to one file.",
  "provenance-mismatch": "Hebun stopped: an admitted file named an unexpected Google connection. This should be raised.",
};

export function DriveBatchOutcome({
  run,
  names,
  refusalWording,
  noun,
}: {
  readonly run: DriveBatchRun;
  readonly names: ReadonlyMap<string, string>;
  readonly refusalWording: Readonly<Record<string, string>>;
  readonly noun: { readonly one: string; readonly many: string };
}) {
  const s = summarizeBatchOutcomes(run.files);
  const clean = s.refused === 0 && s.notAttempted === 0;
  const parts = [
    `${s.requested} selected`,
    s.admitted ? `${s.admitted} admitted` : null,
    s.existing ? `${s.existing} already supplied` : null,
    s.refused ? `${s.refused} refused` : null,
    s.notAttempted ? `${s.notAttempted} not attempted` : null,
    s.duplicateSelections ? `${s.duplicateSelections} chosen twice` : null,
  ].filter(Boolean);

  const headline = clean
    ? s.admitted > 0
      ? `Admitted as supplied Media for this draft. ${s.admitted === 1 ? `The ${noun.one} is` : `These ${noun.many} are`} not reviewed, approved or published.`
      : `Every chosen ${noun.one} was already supplied for this revision. Nothing new was stored.`
    : s.admitted + s.existing > 0
      ? `Only part of this batch was admitted. Admitted ${noun.many} are not reviewed, approved or published; the others were not admitted.`
      : `No ${noun.one} from this batch was admitted.`;

  const line = (f: SuppliedDriveBatchFileOutcome): string => {
    switch (f.status) {
      case "admitted":
        return "Admitted as supplied Media — not reviewed, approved or published.";
      case "existing":
        return "Already supplied for this revision. Nothing new was stored.";
      case "refused":
        return refusalWording[f.reason] ?? "Refused. Nothing was filed for it.";
      case "not-attempted":
        return "Not attempted. Nothing was read for it — choose it again.";
      case "duplicate-selection":
        return "Chosen twice; read once.";
    }
  };

  return (
    <div role="status" aria-live="polite" className="min-w-0 space-y-2 text-sm text-fg-primary">
      <p className="font-medium">{parts.join(" · ")}</p>
      <p>{headline}</p>
      {run.stoppedBy ? <p className="text-fg-secondary">{STOP_WORDING[run.stoppedBy]}</p> : null}
      {run.continuationRefused ? <p className="text-fg-secondary">{BATCH_REFUSAL_WORDING[run.continuationRefused]}</p> : null}
      <details open={!clean} className="min-w-0">
        <summary className="cursor-pointer select-none text-xs font-medium text-fg-secondary">Each file</summary>
        <ul className="mt-2 min-w-0 space-y-1">
          {run.files.map((f, i) => (
            <li key={`${f.fileId}-${i}`} className="min-w-0 text-xs">
              <span className="break-words font-medium">{names.get(f.fileId) || "Unnamed file"}</span>
              <span className="text-fg-secondary"> — {line(f)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
