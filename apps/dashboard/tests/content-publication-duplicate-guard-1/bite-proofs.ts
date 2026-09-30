/*
 * tests/content-publication-duplicate-guard-1/bite-proofs.ts — every guarantee this phase adds is
 * mutated in the SHIPPED SOURCE, and the suite defending it must fail FOR THE INTENDED REASON.
 *
 * Per mutation: the find-string is present exactly once (so it applies), it reached disk, the
 * defending suite failed and its output names the intended reason. Restoration runs in `finally` and
 * is verified byte-identical. Only the CHILD suite has a timeout; this process is never killed with
 * a mutation on disk, and a timed-out child is a VOID result, not a bite.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "tests/content-publication-duplicate-guard-1/guard-postgres.ts";
const POLICY = "tests/content-publication-duplicate-guard-1/policy-contract-firewall.ts";
const PURE = "src/features/action-authorization/content-publication-state.ts";
const HISTORY = "src/features/action-authorization/content-publication-state.server.ts";
const EXEC = "src/features/action-execution/execute-authorized-action.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly suite: string;
  readonly expect: RegExp;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 acknowledgement validation removed (any acknowledgement clears)",
    file: PURE,
    find: "  if (acknowledgesPriorAttemptId !== null) {\n",
    replace: "  if (acknowledgesPriorAttemptId !== null) {\n    return { status: \"clear\", latestConsequentialAttemptId: latest };\n",
    suite: GUARD,
    expect: /acknowledgement-mismatch|acknowledgement-stale|an unknown UUID is not trusted/,
  },
  {
    label: "B2 a stale acknowledgement accepted",
    file: PURE,
    find: "    if (acknowledgesPriorAttemptId === latest) return",
    replace: "    if (acknowledgesPriorAttemptId === latest || consequential.some((a) => a.attemptId === acknowledgesPriorAttemptId)) return",
    suite: GUARD,
    expect: /acknowledgement-stale/,
  },
  {
    label: "B3 tenant predicate removed from the publication history",
    file: HISTORY,
    find: "        eq(hebyActionRequests.tenantId, tenantId),\n        eq(hebyActionRequests.targetRef, artifactRef),",
    replace: "        eq(hebyActionRequests.targetRef, artifactRef),",
    suite: GUARD,
    expect: /prior-publication-unacknowledged|proposed/,
  },
  {
    label: "B4 execution guard disabled (always clear)",
    file: EXEC,
    find: "  return verdict.status === \"clear\" ? null : verdict.reason;",
    replace: "  return null;",
    suite: GUARD,
    expect: /acknowledgement-stale|prior-publication-unacknowledged|attempted/,
  },
  {
    label: "B5 revision row lock removed",
    file: EXEC,
    find: "    )\n    .for(\"update\");\n  if (locked.length !== 1) return \"artifact-unresolvable\";",
    replace: "    );\n  if (locked.length !== 1) return \"artifact-unresolvable\";",
    suite: GUARD,
    expect: /exactly one crosses the boundary/,
  },
  {
    label: "B6 identity loses the destination account",
    file: PURE,
    find: "(e) => e.actionKind === identity.actionKind && e.destinationAccountId === identity.destinationAccountId,",
    replace: "(e) => e.actionKind === identity.actionKind,",
    suite: GUARD,
    expect: /prior-publication-unacknowledged|another channel/,
  },
  {
    label: "B6b identity loses the destination account (pure)",
    file: PURE,
    find: "(e) => e.actionKind === identity.actionKind && e.destinationAccountId === identity.destinationAccountId,",
    replace: "(e) => e.actionKind === identity.actionKind,",
    suite: POLICY,
    expect: /another channel, another destination, or no bound account is another identity|Instagram account B/,
  },
];

function run(suite: string): { ok: boolean; output: string; timedOut: boolean } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`, timedOut: r.signal === "SIGTERM" && r.status === null };
}

function main(): void {
  for (const s of [GUARD, POLICY]) {
    const base = run(s);
    assert.equal(base.ok, true, `baseline ${s} must pass before any mutation:\n${base.output.slice(-2000)}`);
  }
  for (const m of MUTATIONS) {
    const file = path.join(ROOT, m.file);
    const original = readFileSync(file);
    const text = original.toString("utf8");
    assert.equal(text.split(m.find).length - 1, 1, `${m.label}: find-string must occur exactly once`);
    try {
      writeFileSync(file, text.replace(m.find, m.replace));
      assert.notEqual(readFileSync(file, "utf8"), text, `${m.label}: mutation reached disk`);
      const r = run(m.suite);
      assert.equal(r.timedOut, false, `${m.label}: the defending suite TIMED OUT — a VOID result, not a bite`);
      assert.equal(r.ok, false, `${m.label}: the mutation SURVIVED — ${m.suite} still passed`);
      assert.match(r.output, m.expect, `${m.label}: failed, but not for the intended reason:\n${r.output.slice(-1500)}`);
      console.log(`BITE ${m.label}`);
    } finally {
      writeFileSync(file, original);
      assert.ok(readFileSync(file).equals(original), `${m.label}: restoration is byte-identical`);
    }
  }
  console.log(`content-publication-duplicate-guard-1/bite-proofs: ${MUTATIONS.length} mutations bit`);
}

main();
