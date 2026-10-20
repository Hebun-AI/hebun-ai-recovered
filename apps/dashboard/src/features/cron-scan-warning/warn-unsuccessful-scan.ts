/*
 * cron-scan-warning/warn-unsuccessful-scan.ts — ONE structured warning line for an unsuccessful
 * scheduled scan (OPERATIONAL-OBSERVABILITY-V1).
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * The three scheduled scans answer HTTP 200 for a tick in which every candidate was refused, threw,
 * or was observed and not recorded. The breakdown lives only in the response body, which the host
 * does not log, so such a tick was indistinguishable from a healthy one everywhere. This writes one
 * line to the host's runtime log when a tick was not wholly successful, and nothing otherwise.
 *
 * ── IT PERSISTS NOTHING AND DECIDES NOTHING ──────────────────────────────────
 *
 * No table, no counter, no next-run, no retry. The triggers' doctrine stands — a trigger that
 * remembered anything would be a second execution ledger — and a log line is not a record anyone
 * reads back. It does not change a status code, a response body, or what any scan does.
 *
 * ── WHAT A LINE MAY CARRY ────────────────────────────────────────────────────
 *
 * The scan name, the tick status, the number of candidates considered, and per-STATUS counts. Every
 * key is a literal from the tables below, never a value read from an outcome: no reason word (some
 * are free strings), no tenant, permit, authorization or invocation id, no payload, no secret.
 *
 * Each table is TOTAL over its trigger's outcome vocabulary, so a status added to a trigger fails to
 * compile here rather than being silently counted as success.
 *
 * Server-safe: pure functions plus one injected `log`. No I/O of its own.
 */
import type { ScanOutcome } from "@/features/observation-trigger/contracts";
import type { DeliveryOutcome } from "@/features/machine-delivery-trigger/contracts";
import type { IssuanceOutcome } from "@/features/standing-issuance-trigger/contracts";

export const CRON_SCAN_WARNING_EVENT = "cron-scan-unsuccessful";

/** `true` = the outcome is counted as unsuccessful. Not-due and duplicate suppression are normal. */
const OBSERVATION_UNSUCCESSFUL: Readonly<Record<ScanOutcome["status"], boolean>> = Object.freeze({
  "not-due": false,
  "due-unknown": true,
  "not-authorized": true,
  refused: true,
  "provider-failed": true,
  "unsupported-subject": true,
  recorded: false,
  "duplicate-suppressed": false,
  "observed-not-recorded": true,
});

const DELIVERY_UNSUCCESSFUL: Readonly<Record<DeliveryOutcome["status"], boolean>> = Object.freeze({
  delivered: false,
  refused: true,
  failed: true,
});

const ISSUANCE_UNSUCCESSFUL: Readonly<Record<IssuanceOutcome["status"], boolean>> = Object.freeze({
  issued: false,
  refused: true,
  failed: true,
});

export const UNSUCCESSFUL_SCAN_OUTCOMES = Object.freeze({
  observation: OBSERVATION_UNSUCCESSFUL,
  "machine-delivery": DELIVERY_UNSUCCESSFUL,
  "standing-issuance": ISSUANCE_UNSUCCESSFUL,
});

export type CronScanName = keyof typeof UNSUCCESSFUL_SCAN_OUTCOMES;

/** What one tick reported, reduced to what a log line may carry. */
export type CronScanReport =
  | { readonly status: "unavailable" }
  | {
      readonly status: "scanned";
      readonly considered: number;
      readonly outcomes: readonly { readonly outcome: { readonly status: string } }[];
    };

/**
 * Pure. Per-status counts of unsuccessful outcomes; keys come only from the scan's own table.
 * Reads `outcome.status` and nothing else.
 */
export function countUnsuccessfulOutcomes(
  scan: CronScanName,
  outcomes: readonly { readonly outcome: { readonly status: string } }[],
): Record<string, number> {
  const table = UNSUCCESSFUL_SCAN_OUTCOMES[scan] as Readonly<Record<string, boolean>>;
  const counts: Record<string, number> = {};
  for (const status of Object.keys(table)) {
    if (!table[status]) continue;
    const n = outcomes.filter((o) => o.outcome.status === status).length;
    if (n > 0) counts[status] = n;
  }
  return counts;
}

/**
 * Write at most ONE warning line for this tick. Returns whether it wrote.
 *
 * A wholly successful tick — including one with nothing to do — writes nothing.
 */
export function warnUnsuccessfulScan(
  scan: CronScanName,
  report: CronScanReport,
  log: (line: string) => void = (line) => console.warn(line),
): boolean {
  if (report.status === "unavailable") {
    log(JSON.stringify({ event: CRON_SCAN_WARNING_EVENT, scan, status: "unavailable" }));
    return true;
  }
  const unsuccessful = countUnsuccessfulOutcomes(scan, report.outcomes);
  if (Object.keys(unsuccessful).length === 0) return false;
  log(
    JSON.stringify({
      event: CRON_SCAN_WARNING_EVENT,
      scan,
      status: "scanned",
      considered: report.considered,
      unsuccessful,
    }),
  );
  return true;
}
