/*
 * GOVERNED-EXECUTION-1 — DO THE GUARDS ACTUALLY BITE?
 *
 * A green firewall proves nothing on its own. Each mutation below re-introduces exactly the defect
 * one guard exists to catch, runs the firewall in a CHILD PROCESS, and requires it to fail FOR THE
 * STATED REASON — not merely to fail. A proof that fails for a different reason is a proof that the
 * guard it names was never exercised.
 *
 * ── TWO FAILURE MODES THIS FILE REFUSES TO CONFUSE ───────────────────────────
 *
 *   A mutation that did not APPLY looks exactly like a guard that did not bite. So every mutation
 *   asserts the source actually changed before the child runs.
 *
 *   A child killed by a timeout also exits non-zero. So the run is bounded and the STATUS is
 *   distinguished from the signal, and the expected sentence must appear in the output.
 *
 * ── SAFETY ───────────────────────────────────────────────────────────────────
 *
 * Every mutation is restored in `finally`, and the restore is verified byte-for-byte. Nothing here
 * touches a database, a network, or any file outside the three sources it names.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. A `git diff` taken mid-run
 * shows those mutations live. Never commit while it is running; re-verify against the released SHA.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/ge1-ledger/ledger-read-firewall.ts";
const RENDERING = "tests/ge1-ledger/surface-rendering.ts";

const PROJECTION = "src/features/action-execution/execution-ledger-projection.server.ts";
const READER = "src/features/action-execution/read-execution-attempts.server.ts";
const SURFACE = "src/components/decision-workspace/execution-ledger.tsx";
const CONTRACTS = "src/features/action-execution/contracts.ts";
const OUTSIDE_CLOSURE = "src/features/action-execution/execution-control.server.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

/** Bounded so a hang is reported as VOID rather than counted as a bite. */
const CHILD_TIMEOUT_MS = 120_000;

function runFirewall(suite: string = FIREWALL): { ok: boolean; output: string; detail: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const detail = [
    result.status === null ? null : `exit ${result.status}`,
    result.signal ? `signal ${result.signal}` : null,
    result.error ? `spawn error ${(result.error as NodeJS.ErrnoException).code ?? ""}`.trim() : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    detail,
  };
}

/**
 * Apply one mutation, require the firewall to fail for the STATED reason, restore, verify.
 *
 * `expected` is matched against the child's output, so a failure caused by something else — a
 * syntax error, a different guard, a timeout — is reported as an unproven bite rather than
 * silently counted as a successful one.
 */
function proof(
  label: string,
  file: string,
  from: string,
  to: string,
  expected: string,
  suite: string = FIREWALL,
): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(
    mutated,
    original,
    `${label}: the mutation did not APPLY to ${file} — it would prove nothing`,
  );

  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runFirewall(suite);
    assert.ok(
      !ok,
      `${label}: the firewall PASSED with the defect present — the guard does not bite (${detail})`,
    );
    assert.ok(
      output.includes(expected),
      `${label}: the firewall failed, but not for the stated reason. Expected output to contain ` +
        `"${expected}". Ran as: ${detail}. Output was:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
}

function main(): void {
  /* Baseline: the firewall passes on the released tree, or every proof below is meaningless. */
  {
    const { ok, detail } = runFirewall();
    assert.ok(ok, `the firewall must pass BEFORE any mutation — it did not (${detail})`);
  }

  /* ── 1 · A DURABLE WRITE ANYWHERE IN THE READ CLOSURE ─────────────────────
   * A dead helper is enough: the guarantee is that the read path CANNOT write, not that today's
   * call graph happens not to.
   */
  proof(
    "a durable write in the read closure",
    PROJECTION,
    "export async function readExecutionLedger(",
    `export async function recordSomething(db: { insert: (t: unknown) => { values: (v: unknown) => Promise<void> } }) {
  await db
    .insert(someTable)
    .values({ note: "this is a write inside a read surface" });
}

export async function readExecutionLedger(`,
    "performs a durable write",
  );

  /* ── 2a · THE AUDIT WRITER'S MODULE — CAUGHT BY THE WRITE GUARD FIRST ─────
   * MEASURED, NOT ASSUMED: this mutation does NOT reach the module ban. Importing
   * `governance-audit/action-execution-audit.server.ts` pulls a file that APPENDS to `audit_log`
   * into the closure, so the durable-write guard fires before the module ban is ever consulted.
   *
   * That is defence in depth working, and it is recorded as what it is rather than dressed up as a
   * proof of the ban. The ban is the second line and is proved on its own in 2c, against a module
   * that writes nothing — otherwise the ban would be a guard no test had ever exercised.
   */
  proof(
    "the ledger reaching the audit writer's module (caught by the write guard)",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\n' +
      'import { recordActionExecutionEventWithin } from "@/features/governance-audit/action-execution-audit.server";\n' +
      "void recordActionExecutionEventWithin;",
    "action-execution-audit.server.ts performs a durable write",
  );

  /* ── 2b · A CONSEQUENTIAL SYMBOL THE WRITE GUARD CANNOT SEE ───────────────
   * The adapter registry writes nothing, so only the SYMBOL ban stands between a reporting surface
   * and the ability to construct the thing that sends. This is the guard 2a could not reach.
   */
  proof(
    "the ledger reaching the external-send adapter",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\n' +
      'import { resolveExternalSendAdapter } from "./adapter-registry.server";\n' +
      "void resolveExternalSendAdapter;",
    'must not reach "resolveExternalSendAdapter"',
  );

  /* ── 2c · A SECOND READER OF THE ACT LEDGER ───────────────────────────────
   * `/audit` owns recorded acts. Its read modules write nothing, so this mutation slips past the
   * write guard and the symbol ban — and is stopped only by the no-second-act-history rule.
   */
  proof(
    "the ledger becoming a second reader of recorded acts",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\n' +
      'import { readRecordedActPage } from "@/features/governance-activity/act-history-read.server";\n' +
      "void readRecordedActPage;",
    "/audit owns recorded acts",
  );

  /* ── 3 · A SECOND WRITER OF THE ATTEMPT TABLE, OUTSIDE THE CLOSURE ────────
   * Placed in a module the read path does NOT import, so it can only be caught by the census —
   * which is the guard being proved. A closure-only check would miss it entirely.
   */
  proof(
    "a second writer of the attempt table appearing elsewhere in src",
    OUTSIDE_CLOSURE,
    "export function resolveExternalSendEnabled(",
    `export async function quietlyMarkAttempt(db: {
  update: (t: unknown) => { set: (v: unknown) => Promise<void> };
}) {
  await db.update(actionExecutionAttempts).set({ status: "accepted" });
}

export function resolveExternalSendEnabled(`,
    "exactly one module writes the attempt table",
  );

  /* ── 4 · THE REPORTING SURFACE ACQUIRING A CONTROL ────────────────────────
   * The whole point of the phase: it reports, and offers nothing to act with.
   */
  proof(
    "a retry control appearing on the reporting surface",
    SURFACE,
    'import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";',
    '"use client";\n' +
      'import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";',
    "the ledger is a server component",
  );

  /* ── 5 · TWO SPELLINGS OF "NEEDS A HUMAN" ─────────────────────────────────
   * The SQL drifting back to a literal copy is exactly how the pure predicate and the query would
   * begin to disagree, silently.
   */
  proof(
    "the SQL predicate drifting back to its own literal copy",
    READER,
    "inArray(actionExecutionAttempts.status, [...UNRECONCILED_ATTEMPT_STATUSES])",
    'inArray(actionExecutionAttempts.status, ["unknown", "pending"])',
    "the SQL predicate reads the shared constant",
  );

  /* ── 6 · THE IDEMPOTENCY KEY CROSSING TO A SURFACE ────────────────────────── */
  proof(
    "the handoff key crossing into the projection",
    PROJECTION,
    "    attemptId: view.attemptId,",
    "    attemptId: view.attemptId,\n    handoffId: view.handoffId,",
    "the handoff key does not cross to a surface",
  );

  /* ── 7 · THE WORDING SOFTENING AN AMBIGUOUS OUTCOME ────────────────────────
   * `unknown != safe-to-retry` is the sentence that stops a Director sending twice.
   */
  proof(
    "the ledger telling a human an ambiguous send is safe to retry",
    CONTRACTS,
    '    "Hebun performs no automatic retry, no replay and no reconciliation, and this surface offers " +',
    '    "It is safe to retry it. Hebun performs no automatic retry, no replay and no reconciliation, and this surface offers " +',
    "the ledger may never say",
  );

  /* ── 8 · THE SURFACE RESOLVING ITS OWN AUTHORITY ──────────────────────────
   * Presentation that resolves a tenant is presentation that holds authority.
   */
  proof(
    "the surface resolving its own tenant",
    SURFACE,
    "function toneFor(status: ExecutionAttemptStatus): string {",
    "async function ownTenant() {\n  return resolveTenantContext();\n}\n\n" +
      "function toneFor(status: ExecutionAttemptStatus): string {",
    "the surface must not contain",
  );

  /* ── 8b · ATTENTION FILTERED OUT OF THE BOUNDED PAGE ──────────────────────
   * The exact defect this phase built and then repaired: derive the attention list from the 50
   * most recent attempts and an older ambiguous act silently disappears from the one list that
   * must never lose one. Pinned so it cannot come back as a simplification.
   */
  proof(
    "the attention list filtered out of the bounded history page",
    PROJECTION,
    "  const needsAttention = attention.items.map(toExecutionLedgerEntry);",
    "  const needsAttention = entries.filter((entry) => entry.requiresAttention);",
    "the attention list takes its value from that read",
  );

  /* ── 8c · A BOUND THAT STOPS DISCLOSING ITSELF ───────────────────────────── */
  proof(
    "a truncated history that no longer says it was truncated",
    PROJECTION,
    "    historyTruncated: entries.length >= limit,",
    "    historyTruncated: false,",
    "both lists report whether they filled their bound",
  );

  /* ── 9 · AN ACCEPTANCE RENDERED WITHOUT ITS NON-CLAIMS ────────────────────
   * The rendering suite is proved to bite too. "Accepted" alone is the single most misreadable
   * word on this surface, and the non-claims are what stop it being read as delivery.
   */
  proof(
    "an acceptance rendered without what it does not mean",
    SURFACE,
    "      {entry.status === \"accepted\" ? (",
    "      {false ? (",
    "the surface must render",
    RENDERING,
  );

  /* ── 10 · AN AMBIGUOUS ROW RENDERED WITHOUT THE DO-NOT-RETRY PREAMBLE ────── */
  proof(
    "an ambiguous outcome rendered without its warning",
    SURFACE,
    "                  <p className=\"mt-1 text-xs leading-5 text-fg-secondary\">\n                    {EXECUTION_LEDGER_WORDING.attentionPreamble}\n                  </p>",
    "",
    "the surface states the effect may already have occurred",
    RENDERING,
  );

  /* Final: the tree is back where it started and both suites pass again. */
  {
    const { ok, detail } = runFirewall();
    assert.ok(ok, `the firewall must pass AFTER every restore — it did not (${detail})`);
    const rendering = runFirewall(RENDERING);
    assert.ok(
      rendering.ok,
      `the rendering suite must pass AFTER every restore — it did not (${rendering.detail})`,
    );
  }

  console.log(
    "ge1-ledger/bite-proofs: OK — fourteen mutations, each caught for its stated reason " +
      "(2a measured as defence in depth), and every source restored byte-for-byte.",
  );
}

main();
