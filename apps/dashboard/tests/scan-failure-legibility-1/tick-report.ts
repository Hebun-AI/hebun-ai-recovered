/*
 * SCAN-FAILURE-LEGIBILITY-1 — `scripts/ops/scan-tick-report.mts` on fixed log fixtures.
 *
 * Rows mirror the shape `vercel logs --json` printed in production on 2026-11-02 (request rows with
 * `logs: [{ level, message }]`). Every rule is exercised: healthy hour, single failure, consecutive
 * failures, missing tick, outcome-level refusals, SSL notice, non-scan 5xx, fatal, model failures,
 * truncated and empty input, and output minimization.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  buildScanTickReport,
  exitCodeFor,
  formatScanTickReport,
  parseLogLines,
  SCAN_PATHS,
  type LogRow,
} from "../../scripts/ops/scan-tick-report.mjs";

const T0 = Date.parse("2026-11-02T00:00:00Z");
const H = 60 * 60 * 1000;
const SSL = "(node:7) Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.";
const TENANT = "tenant-9b1d-secret";

type Scan = keyof typeof SCAN_PATHS;

function scanRow(scan: Scan, hour: number, opts: { status?: number; lines?: string[] } = {}): LogRow {
  const offset = { observation: 18_000, "standing-issuance": 43_000, "machine-delivery": 47_000 }[scan];
  return {
    timestamp: T0 + hour * H + offset,
    level: opts.lines?.length ? "warning" : "info",
    requestPath: SCAN_PATHS[scan],
    responseStatusCode: opts.status ?? 200,
    message: opts.lines?.[0] ?? "",
    logs: (opts.lines ?? []).map((message) => ({ level: "warning", message })),
  };
}

function healthyHour(hour: number): LogRow[] {
  return [
    scanRow("observation", hour, { lines: [SSL] }),
    scanRow("standing-issuance", hour),
    scanRow("machine-delivery", hour),
  ];
}

const unavailable = (scan: Scan, cause: string) =>
  JSON.stringify({ event: "cron-scan-unsuccessful", scan, status: "unavailable", cause });

/** A trailing row after the last tick window, proving the input reaches past it. */
const tail = (hour: number): LogRow => ({ timestamp: T0 + hour * H + 30 * 60 * 1000, requestPath: "/login", responseStatusCode: 200 });

function report(rows: LogRow[], hours: number) {
  return buildScanTickReport(rows, { since: T0, until: T0 + (hours - 1) * H + 11 * 60 * 1000 });
}

function healthy(): void {
  const r = report([...healthyHour(0), ...healthyHour(1), tail(1)], 2);
  assert.equal(r.state, "OK");
  assert.equal(r.hours.length, 2);
  for (const h of r.hours) {
    assert.equal(h.state, "OK");
    assert.equal(h.sslNotices, 1, "the SSL notice on a 200 tick is counted as known noise");
  }
  assert.equal(exitCodeFor(r.state), 0);
}

function singleFailureIsNoted(): void {
  const rows = [
    ...healthyHour(0).filter((x) => x.requestPath !== SCAN_PATHS.observation),
    scanRow("observation", 0, { status: 503, lines: [SSL, unavailable("observation", "connection")] }),
    ...healthyHour(1),
    tail(1),
  ];
  const r = report(rows, 2);
  assert.equal(r.hours[0]!.state, "NOTED");
  assert.deepEqual(r.hours[0]!.scans.observation, { state: "failed", status: 503, cause: "connection" });
  assert.equal(r.hours[0]!.sslNotices, 0, "an SSL notice on a 503 is not counted as noise");
  assert.equal(r.hours[1]!.state, "OK");
  assert.equal(r.state, "NOTED");
  assert.equal(exitCodeFor(r.state), 0);
}

function consecutiveFailuresAttention(): void {
  const failing = (hour: number) => [
    scanRow("observation", hour),
    scanRow("standing-issuance", hour),
    scanRow("machine-delivery", hour, { status: 503, lines: [unavailable("machine-delivery", "query")] }),
  ];
  const r = report([...failing(0), ...failing(1), tail(1)], 2);
  assert.equal(r.hours[0]!.state, "NOTED");
  assert.equal(r.hours[1]!.state, "ATTENTION", "two consecutive failed ticks of one scan");
  assert.equal(r.state, "ATTENTION");
  assert.equal(exitCodeFor(r.state), 1);

  /* Failures of DIFFERENT scans in consecutive hours do not chain. */
  const alternating = [
    scanRow("observation", 0, { status: 503 }), scanRow("standing-issuance", 0), scanRow("machine-delivery", 0),
    scanRow("observation", 1), scanRow("standing-issuance", 1, { status: 503 }), scanRow("machine-delivery", 1),
    tail(1),
  ];
  assert.equal(report(alternating, 2).state, "NOTED");
}

function missingTickAttention(): void {
  const rows = [...healthyHour(0), scanRow("observation", 1), scanRow("machine-delivery", 1), tail(1)];
  const r = report(rows, 2);
  assert.deepEqual(r.hours[1]!.scans["standing-issuance"], { state: "missing" }, "a missing tick is named");
  assert.equal(r.hours[1]!.state, "ATTENTION", "a missing tick is ATTENTION");
}

function outcomeRefusalsAreNoted(): void {
  /* A tick that answered 200 with refused candidates (e.g. delivery disarmed) never escalates. */
  const refused = JSON.stringify({ event: "cron-scan-unsuccessful", scan: "machine-delivery", status: "scanned", considered: 2, unsuccessful: { refused: 2 } });
  const hour = (h: number) => [scanRow("observation", h), scanRow("standing-issuance", h), scanRow("machine-delivery", h, { lines: [refused] })];
  const r = report([...hour(0), ...hour(1), ...hour(2), tail(2)], 3);
  assert.deepEqual(r.hours.map((x) => x.state), ["NOTED", "NOTED", "NOTED"]);
  assert.equal(r.hours[2]!.scans["machine-delivery"].state, "outcomes-unsuccessful");
}

function otherFailures(): void {
  const r = report([
    ...healthyHour(0),
    { timestamp: T0 + 20 * 60 * 1000, requestPath: "/operations", responseStatusCode: 500 },
    tail(0),
  ], 1);
  assert.equal(r.hours[0]!.otherServerErrors, 1);
  assert.equal(r.hours[0]!.state, "ATTENTION", "a non-scan 5xx");

  const f = report([...healthyHour(0), { timestamp: T0 + 25 * 60 * 1000, level: "fatal", requestPath: "/heby" }, tail(0)], 1);
  assert.equal(f.hours[0]!.fatal, 1);
  assert.equal(f.hours[0]!.state, "ATTENTION", "fatal");
}

function modelFailures(): void {
  const line = (code: string, dispatch: string) => JSON.stringify({ event: "model-request-failed", code, dispatch });
  const heby = (lines: string[]): LogRow => ({
    timestamp: T0 + 30 * 60 * 1000,
    requestPath: "/heby",
    responseStatusCode: 200,
    logs: lines.map((message) => ({ level: "warning", message })),
  });
  const noted = report([...healthyHour(0), heby([line("provider-unreachable", "receipt-unknown")]), tail(0)], 1);
  assert.equal(noted.hours[0]!.state, "NOTED");
  assert.deepEqual(noted.hours[0]!.modelFailures, { "provider-unreachable/receipt-unknown": 1 });

  const billing = report([...healthyHour(0), heby([line("provider-billing", "provider-responded")]), tail(0)], 1);
  assert.equal(billing.hours[0]!.state, "ATTENTION", "provider-billing");

  /* A value outside the closed shape is printed as `other`, never as itself. */
  const odd = report([...healthyHour(0), heby([line(`x ${TENANT} Bearer abc`, TENANT)]), tail(0)], 1);
  assert.deepEqual(odd.hours[0]!.modelFailures, { "other/other": 1 });
}

function missingEvidenceIsUnavailable(): void {
  /* Empty input: nothing is healthy. */
  const empty = report([], 2);
  assert.equal(empty.state, "UNAVAILABLE", "empty input is UNAVAILABLE, never healthy");
  assert.ok(empty.hours.every((h) => h.state === "UNAVAILABLE"));
  assert.equal(exitCodeFor(empty.state), 2);

  /* Truncated or retention-cut input: hours before the oldest line are UNAVAILABLE, never missing. */
  const truncated = report([...healthyHour(1), ...healthyHour(2), tail(2)], 3);
  assert.equal(truncated.hours[0]!.state, "UNAVAILABLE");
  assert.deepEqual(truncated.hours[0]!.scans.observation, { state: "unavailable" });
  assert.equal(truncated.hours[1]!.state, "OK", "all three ticks present is evidence, even as the oldest lines");
  assert.equal(truncated.state, "UNAVAILABLE");

  /* The oldest line is inside the tick window and a scan is absent: it may have been cut — UNAVAILABLE. */
  const partial = report([scanRow("standing-issuance", 0), scanRow("machine-delivery", 0), tail(0)], 1);
  assert.equal(partial.hours[0]!.state, "UNAVAILABLE");

  /* Input that stops inside a tick window, with a scan not yet seen: not judged. */
  const cut = report([...healthyHour(0), scanRow("observation", 1)], 2);
  assert.equal(cut.hours[1]!.state, "UNAVAILABLE");

  /* A window shorter than one tick judges nothing. */
  assert.equal(buildScanTickReport(healthyHour(0), { since: T0, until: T0 + 60_000 }).state, "UNAVAILABLE");
}

function outputCarriesNoText(): void {
  const rows: LogRow[] = [
    ...healthyHour(0).map((r) => ({ ...r, message: `${TENANT} ${r.message}` })),
    { timestamp: T0 + 15 * 60 * 1000, requestPath: `/t/${TENANT}`, responseStatusCode: 502, message: `upstream ${TENANT}` },
    tail(0),
  ];
  const text = formatScanTickReport(report(rows, 1));
  assert.ok(!text.includes(TENANT), "no request path, message or tenant text is printed");
  assert.ok(!text.includes("SECURITY WARNING"));
  assert.match(text, /^scan-tick-report ATTENTION hours=1 unparsed=0$/m);
}

function parsing(): void {
  const lines = [JSON.stringify(scanRow("observation", 0)), "Fetching logs...", "{not json", "", JSON.stringify({ no: "timestamp" })].join("\n");
  const parsed = parseLogLines(lines);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.unparsed, 3);
}

function cli(): void {
  const input = [...healthyHour(0), tail(0)].map((r) => JSON.stringify(r)).join("\n");
  const run = (args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", "scripts/ops/scan-tick-report.mts", ...args], { input, encoding: "utf8" });
  const ok = run(["--since", "2026-11-02T00:00:00Z", "--until", "2026-11-02T00:11:00Z"]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^scan-tick-report OK hours=1/);
  const noArgs = run([]);
  assert.equal(noArgs.status, 64, "the window is required");
}

healthy();
singleFailureIsNoted();
consecutiveFailuresAttention();
missingTickAttention();
outcomeRefusalsAreNoted();
otherFailures();
modelFailures();
missingEvidenceIsUnavailable();
outputCarriesNoText();
parsing();
cli();
console.log("scan-failure-legibility-1/tick-report: OK");
