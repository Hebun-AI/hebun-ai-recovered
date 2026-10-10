/*
 * CONTENT-AGENT-2 — every guarantee is mutated in the SHIPPED SOURCE and the defending suite must
 * fail FOR THE INTENDED REASON. Restoration runs in `finally` and is verified byte-identical; only
 * the child suite has a timeout, and a timed-out child is VOID, not a bite.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PG = "tests/content-agent-2/revise-from-review-postgres.ts";
const FW = "tests/content-agent-2/surface-and-firewall.ts";
const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const WRITER = "src/features/work-artifacts/write-work-artifacts.server.ts";
const READER = "src/features/work-artifact-review/change-request.server.ts";
const REVIEW = "src/features/work-artifact-review/review-revision.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const once = (find: string, replace: string) => (text: string) => {
  assert.equal(text.split(find).length - 1, 1, `find-string must occur exactly once: ${find.slice(0, 90)}`);
  return text.replace(find, replace);
};

const MUTATIONS: readonly { label: string; file: string; suite: string; apply: (t: string) => string; expect: RegExp }[] = [
  {
    label: "B1 the writer ignores expectedRevisionNo under its lock",
    file: WRITER,
    suite: PG,
    apply: once("      if (input.expectedRevisionNo !== undefined && artifact.currentRevision !== input.expectedRevisionNo) {", "      if (false) {"),
    expect: /M4 revision key only, human revision mid-call/,
  },
  {
    label: "B2 the writer ignores the review basis under its lock",
    file: WRITER,
    suite: PG,
    apply: once("      if (basisIsStale && (await basisIsStale(", "      if (false && (await basisIsStale!("),
    expect: /M1 a review accepts the revision mid-call/,
  },
  {
    label: "B3 the review writer drops its shared artifact lock",
    file: REVIEW,
    suite: PG,
    apply: once('        .for("share")\n', ""),
    expect: /L: the review waits/,
  },
  {
    label: "B4 the seam skips the review-basis preflight",
    file: SEAM,
    suite: PG,
    apply: once('      if (!stands) return { status: "refused", reason: "review-basis-stale" };', "      void stands;"),
    expect: /P2 basis that is not the standing decision/,
  },
  {
    label: "B5 the seam skips the revision preflight",
    file: SEAM,
    suite: PG,
    apply: once('    if (input.expectedRevisionNo !== undefined && current.revisionNo !== input.expectedRevisionNo) {\n      return { status: "refused", reason: "revision-stale" };\n    }', ""),
    expect: /P1 stale revision/,
  },
  {
    label: "B6 the reader offers an ACCEPTED revision's old reason",
    file: READER,
    suite: PG,
    apply: once('  if (state.decision === "accepted") return { status: "accepted" };\n', ""),
    expect: /R5: a later acceptance wins/,
  },
  {
    label: "B7 the reader offers a reason on a revision that is no longer current",
    file: READER,
    suite: PG,
    apply: once('  if (pointer.currentRevision !== revisionNo) return { status: "superseded" };\n', ""),
    expect: /R6: a reason on a revision that is no longer current/,
  },
  {
    label: "B8 the reader drops its tenant predicate",
    file: READER,
    suite: PG,
    apply: once(".where(and(eq(workArtifacts.tenantId, tenant.tenantId!), eq(workArtifacts.id, artifactId)))", ".where(eq(workArtifacts.id, artifactId))"),
    expect: /R3: another tenant sees nothing/,
  },
  {
    label: "B10 the reader shows the reason to any member",
    file: READER,
    suite: PG,
    apply: once('  if (!authority.authorized) return { status: "not-authorized" };\n', ""),
    expect: /R8: an owner-role member without Governance authority/,
  },
  {
    label: "B11 a member without Governance may revise from a review",
    file: SEAM,
    suite: PG,
    apply: once('      if (!(await mayReviseFromReview(reviewDb, tenant))) return { status: "refused", reason: "review-basis-not-authorized" };\n', ""),
    expect: /P8: a member without Governance cannot revise from a review/,
  },
  {
    label: "B9 the seam starts reading the reason text",
    file: SEAM,
    suite: FW,
    apply: once('import { isReviewBasisCurrent, mayReviseFromReview } from "@/features/work-artifact-review/change-request.server";', 'import { isReviewBasisCurrent, mayReviseFromReview, readCurrentRevisionChangeRequest } from "@/features/work-artifact-review/change-request.server";\nvoid readCurrentRevisionChangeRequest;'),
    expect: /the seam never reads the reason/,
  },
];

function run(suite: string) {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`, timedOut: r.signal === "SIGTERM" && r.status === null };
}
const digest = (f: string) => createHash("sha256").update(readFileSync(path.join(ROOT, f))).digest("hex");

function main(): void {
  const files = [...new Set(MUTATIONS.map((m) => m.file))];
  const before = new Map(files.map((f) => [f, digest(f)]));
  for (const s of [PG, FW]) {
    const base = run(s);
    assert.equal(base.ok, true, `baseline ${s} must pass before any mutation:\n${base.output.slice(-2000)}`);
  }
  for (const m of MUTATIONS) {
    const file = path.join(ROOT, m.file);
    const original = readFileSync(file);
    const text = original.toString("utf8");
    try {
      writeFileSync(file, m.apply(text));
      assert.notEqual(readFileSync(file, "utf8"), text, `${m.label}: mutation reached disk`);
      const r = run(m.suite);
      assert.equal(r.timedOut, false, `${m.label}: TIMED OUT — a VOID result, not a bite`);
      assert.equal(r.ok, false, `${m.label}: the mutation SURVIVED`);
      assert.match(r.output, m.expect, `${m.label}: failed, but not for the intended reason:\n${r.output.slice(-1500)}`);
      console.log(`BITE ${m.label}`);
    } finally {
      writeFileSync(file, original);
      assert.ok(readFileSync(file).equals(original), `${m.label}: restoration is byte-identical`);
    }
  }
  for (const f of files) assert.equal(digest(f), before.get(f), `${f}: byte-identical to its pre-run state`);
  console.log(`content-agent-2/bite-proofs: ${MUTATIONS.length} mutations bit`);
}

main();
