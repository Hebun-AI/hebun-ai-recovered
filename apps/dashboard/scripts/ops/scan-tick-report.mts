/*
 * scripts/ops/scan-tick-report.mts — a LOCAL, READ-ONLY health report of the three hourly cron scans,
 * built from Vercel runtime logs (SCAN-FAILURE-LEGIBILITY-1).
 *
 * Usage (the operator's own Vercel CLI session; this script holds no credential):
 *
 *   vercel logs --scope hebuntechs-projects -p hebun-ai-recovered --environment production \
 *     --since 2026-11-02T00:00:00Z --until 2026-11-02T12:00:00Z --json -n 5000 2>/dev/null \
 *   | npx tsx scripts/ops/scan-tick-report.mts --since 2026-11-02T00:00:00Z --until 2026-11-02T12:00:00Z
 *
 * ── WHAT IT DOES AND DOES NOT DO ─────────────────────────────────────────────
 *
 * Reads JSON lines on stdin, writes a report on stdout. No file, no network, no notification, no
 * schedule: it is not a CI step and not a cron job. Exit code: 0 OK or NOTED, 1 ATTENTION,
 * 2 UNAVAILABLE (some hour could not be judged and nothing needs attention).
 *
 * ── MISSING EVIDENCE IS NEVER A HEALTHY TICK ─────────────────────────────────
 *
 * Log retention is not known exactly, and `-n` truncates the OLDEST lines. An hour is judged only when
 * the input provably covers it: all three scans were seen in its tick window, or the input spans the
 * whole window (a line at or before the tick and one after the window). Otherwise it is UNAVAILABLE —
 * a scan absent from a window the input does not cover is never reported as missing.
 *
 * ── WHAT THE OUTPUT MAY CARRY ────────────────────────────────────────────────
 *
 * Hours, scan names, state words and counts, and the closed words of the two structured log lines
 * (`cron-scan-unsuccessful`, `model-request-failed`) — each re-checked against a closed set before it
 * is printed. Never a log message, request id, domain, tenant, payload or secret.
 */
import { pathToFileURL } from "node:url";

export const SCAN_PATHS = Object.freeze({
  observation: "/api/observation/scan",
  "machine-delivery": "/api/machine-delivery/scan",
  "standing-issuance": "/api/standing-issuance/scan",
});
export type ScanName = keyof typeof SCAN_PATHS;
const SCANS = Object.keys(SCAN_PATHS) as ScanName[];

/** Ticks fire at :00 (`vercel.json` `0 * * * *`); measured arrivals are :00:18–:00:47. */
export const TICK_WINDOW_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type HealthState = "OK" | "NOTED" | "ATTENTION" | "UNAVAILABLE";
const SEVERITY: Readonly<Record<HealthState, number>> = { OK: 0, NOTED: 1, UNAVAILABLE: 2, ATTENTION: 3 };

const CAUSES = new Set(["not-configured", "connection", "authentication", "query", "unknown"]);
const DISPATCH = new Set(["not-sent", "receipt-unknown", "provider-responded"]);
const MODEL_CODE = /^[a-z][a-z-]{1,40}$/;
/** The `pg` connection-string notice. Counted as known noise, never as a failure, when the tick answered 200. */
const SSL_NOTICE = "Warning: SECURITY WARNING: The SSL modes";

export interface LogRow {
  readonly timestamp: number;
  readonly level?: string;
  readonly requestPath?: string;
  readonly responseStatusCode?: number;
  readonly message?: string;
  readonly logs?: readonly { readonly level?: string; readonly message?: string }[];
}

export type ScanTick =
  | { readonly state: "ok" }
  /** Answered 200, but some candidates were refused or failed: outcome-level, never escalated. */
  | { readonly state: "outcomes-unsuccessful" }
  /** The tick itself failed: a non-200 answer or an `unavailable` line. */
  | { readonly state: "failed"; readonly status: number | null; readonly cause: string | null }
  | { readonly state: "missing" }
  | { readonly state: "unavailable" };

export interface HourReport {
  readonly hour: string;
  readonly state: HealthState;
  readonly scans: Readonly<Record<ScanName, ScanTick>>;
  readonly sslNotices: number;
  readonly otherServerErrors: number;
  readonly fatal: number;
  readonly modelFailures: Readonly<Record<string, number>>;
}

export interface ScanTickReport {
  readonly state: HealthState;
  readonly hours: readonly HourReport[];
  readonly unparsedLines: number;
}

function lineMessages(row: LogRow): string[] {
  const messages = (row.logs ?? []).map((l) => l.message ?? "");
  if (messages.length === 0 && row.message) messages.push(row.message);
  return messages;
}

function structured(message: string): Record<string, unknown> | null {
  if (!message.startsWith("{")) return null;
  try {
    const value: unknown = JSON.parse(message);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function worst(states: readonly HealthState[]): HealthState {
  return states.reduce<HealthState>((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "OK");
}

function tickOf(scan: ScanName, rows: readonly LogRow[]): ScanTick {
  const hit = rows.filter((r) => r.requestPath === SCAN_PATHS[scan]);
  if (hit.length === 0) return { state: "missing" };
  let outcomes = false;
  for (const row of hit) {
    let unavailableCause: string | null | undefined;
    for (const message of lineMessages(row)) {
      const line = structured(message);
      if (line?.event !== "cron-scan-unsuccessful" || line.scan !== scan) continue;
      if (line.status === "unavailable") {
        unavailableCause = typeof line.cause === "string" && CAUSES.has(line.cause) ? line.cause : null;
      } else outcomes = true;
    }
    const status = typeof row.responseStatusCode === "number" ? row.responseStatusCode : null;
    if (status !== 200 || unavailableCause !== undefined) {
      return { state: "failed", status, cause: unavailableCause ?? null };
    }
  }
  return outcomes ? { state: "outcomes-unsuccessful" } : { state: "ok" };
}

/** Pure. Judges every tick hour whose window lies inside [since, until]. */
export function buildScanTickReport(
  input: readonly LogRow[],
  window: { readonly since: number; readonly until: number },
  unparsedLines = 0,
): ScanTickReport {
  const rows = input.filter((r) => Number.isFinite(r.timestamp));
  const oldest = rows.length ? Math.min(...rows.map((r) => r.timestamp)) : Infinity;
  const newest = rows.length ? Math.max(...rows.map((r) => r.timestamp)) : -Infinity;

  const hours: HourReport[] = [];
  const previous: Partial<Record<ScanName, ScanTick>> = {};
  for (let tick = Math.ceil(window.since / HOUR_MS) * HOUR_MS; tick + TICK_WINDOW_MS <= window.until; tick += HOUR_MS) {
    const inHour = rows.filter((r) => r.timestamp >= tick && r.timestamp < tick + HOUR_MS);
    const inTick = inHour.filter((r) => r.timestamp < tick + TICK_WINDOW_MS);
    const seen = SCANS.map((s) => tickOf(s, inTick));
    /* All three present is evidence enough; otherwise the input must span the whole tick window. */
    const covered = seen.every((t) => t.state !== "missing") || (oldest <= tick && newest >= tick + TICK_WINDOW_MS);

    const scans = {} as Record<ScanName, ScanTick>;
    const states: HealthState[] = [];
    SCANS.forEach((scan, i) => {
      const t: ScanTick = covered ? seen[i]! : { state: "unavailable" };
      scans[scan] = t;
      if (t.state === "unavailable") states.push("UNAVAILABLE");
      else if (t.state === "missing") states.push("ATTENTION");
      else if (t.state === "failed") states.push(previous[scan]?.state === "failed" ? "ATTENTION" : "NOTED");
      else if (t.state === "outcomes-unsuccessful") states.push("NOTED");
      previous[scan] = t;
    });

    let sslNotices = 0;
    let otherServerErrors = 0;
    let fatal = 0;
    const modelFailures: Record<string, number> = {};
    for (const row of inHour) {
      const scanPath = (Object.values(SCAN_PATHS) as string[]).includes(row.requestPath ?? "");
      if (!scanPath && typeof row.responseStatusCode === "number" && row.responseStatusCode >= 500) otherServerErrors += 1;
      if (row.level === "fatal" || (row.logs ?? []).some((l) => l.level === "fatal")) fatal += 1;
      for (const message of lineMessages(row)) {
        if (message.includes(SSL_NOTICE) && row.responseStatusCode === 200) sslNotices += 1;
        const line = structured(message);
        if (line?.event !== "model-request-failed") continue;
        const code = typeof line.code === "string" && MODEL_CODE.test(line.code) ? line.code : "other";
        const dispatch = typeof line.dispatch === "string" && DISPATCH.has(line.dispatch) ? line.dispatch : "other";
        const key = `${code}/${dispatch}`;
        modelFailures[key] = (modelFailures[key] ?? 0) + 1;
        states.push(code === "provider-billing" ? "ATTENTION" : "NOTED");
      }
    }
    if (otherServerErrors > 0 || fatal > 0) states.push("ATTENTION");

    hours.push({
      hour: new Date(tick).toISOString(),
      state: worst(states),
      scans,
      sslNotices,
      otherServerErrors,
      fatal,
      modelFailures,
    });
  }
  const state = hours.length === 0 ? "UNAVAILABLE" : worst(hours.map((h) => h.state));
  return { state, hours, unparsedLines };
}

function describe(t: ScanTick): string {
  if (t.state === "failed") return `failed(status=${t.status ?? "none"},cause=${t.cause ?? "none"})`;
  return t.state;
}

export function formatScanTickReport(report: ScanTickReport): string {
  const lines = [`scan-tick-report ${report.state} hours=${report.hours.length} unparsed=${report.unparsedLines}`];
  for (const h of report.hours) {
    const scans = SCANS.map((s) => `${s}=${describe(h.scans[s])}`).join(" ");
    const model = Object.entries(h.modelFailures).map(([k, n]) => `${k}:${n}`).join(",") || "none";
    lines.push(`${h.hour} ${h.state} ${scans} ssl-notice=${h.sslNotices} other-5xx=${h.otherServerErrors} fatal=${h.fatal} model-failures=${model}`);
  }
  return lines.join("\n");
}

export function exitCodeFor(state: HealthState): number {
  return state === "ATTENTION" ? 1 : state === "UNAVAILABLE" ? 2 : 0;
}

/** JSON lines in; malformed lines are counted, never echoed. */
export function parseLogLines(text: string): { rows: LogRow[]; unparsed: number } {
  const rows: LogRow[] = [];
  let unparsed = 0;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const value = structured(line.trim());
    if (value && typeof value.timestamp === "number") rows.push(value as unknown as LogRow);
    else unparsed += 1;
  }
  return { rows, unparsed };
}

function argument(name: string): number {
  const i = process.argv.indexOf(name);
  const value = i >= 0 ? Date.parse(process.argv[i + 1] ?? "") : Number.NaN;
  if (!Number.isFinite(value)) {
    console.error(`scan-tick-report: ${name} <ISO time> is required`);
    process.exit(64);
  }
  return value;
}

async function main(): Promise<void> {
  const since = argument("--since");
  const until = argument("--until");
  let text = "";
  for await (const chunk of process.stdin) text += String(chunk);
  const { rows, unparsed } = parseLogLines(text);
  const report = buildScanTickReport(rows, { since, until }, unparsed);
  console.log(formatScanTickReport(report));
  process.exit(exitCodeFor(report.state));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
