/*
 * tests/instagram-package-readiness-1/bite-proofs.ts — every guarantee this phase adds is mutated in
 * the SHIPPED SOURCE, and the suite defending it must fail FOR THE INTENDED REASON.
 *
 * Per mutation: the mutation applies (find-string exactly once, or the move's markers exactly once),
 * it reached disk, the defending suite failed and its output names the intended reason. Restoration
 * runs in `finally` and is verified byte-identical; at the end every touched file is re-hashed
 * against its pre-run digest. Only the CHILD suite has a timeout; this process is never killed with
 * a mutation on disk, and a timed-out child is a VOID result, not a bite.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "tests/instagram-package-readiness-1/readiness-postgres.ts";
const VERIFIER = "src/features/instagram-publishing/verify-instagram-package.server.ts";
const PROPOSAL = "src/features/heby-action-inlet/instagram-publish-proposal.server.ts";
const EXEC = "src/features/action-execution/execute-authorized-action.server.ts";
const PACKAGE = "src/features/content-composition/read-content-package.server.ts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

interface Mutation {
  readonly label: string;
  readonly file: string;
  /** Returns the mutated text; throws if the mutation does not apply exactly once. */
  readonly apply: (text: string) => string;
  readonly expect: RegExp;
}

const once = (find: string, replace: string) => (text: string) => {
  assert.equal(text.split(find).length - 1, 1, `find-string must occur exactly once: ${find.slice(0, 80)}`);
  return text.replace(find, replace);
};

/* Move the proposal's readiness block from before derivation to after it. */
const moveAfterDerivation = (text: string) => {
  const start = "  /*\n   * ── 3a. THE CONTENT PACKAGE";
  const end = "  /*\n   * ── 3b. THE PUBLISH DERIVATIVE";
  const anchor = "  const derivative = derived.derivative;\n";
  for (const m of [start, end, anchor]) assert.equal(text.split(m).length - 1, 1, `marker exactly once: ${m.slice(0, 40)}`);
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  const block = text.slice(i, j);
  const without = text.slice(0, i) + text.slice(j);
  return without.replace(anchor, `${anchor}\n${block}`);
};

const MUTATIONS: readonly Mutation[] = [
  {
    label: "V1 READY requirement removed",
    file: VERIFIER,
    apply: once('  if (!pkg.ready) return { ok: false, failure: "package-not-ready", blockers: pkg.blockers };\n', ""),
    expect: /E1 copy unreviewed/,
  },
  {
    label: "V2 selected-media membership removed",
    file: VERIFIER,
    apply: once('  if (!selected || selected.mediaKind !== "image") return { ok: false, failure: "image-not-selected" };\n', ""),
    expect: /\bC: .*image-not-approved/,
  },
  {
    label: "V3 approved-image requirement removed",
    file: VERIFIER,
    apply: once('  if (pkg.mediaReviewStates[assetId] !== "approved") return { ok: false, failure: "image-not-approved" };\n', ""),
    expect: /\bB: .*package-not-ready/,
  },
  {
    label: "P1 proposal verification moved after derivative creation",
    file: PROPOSAL,
    apply: moveAfterDerivation,
    expect: /B: nothing written|B: no derivative/,
  },
  {
    label: "X1 execution pre-flight removed",
    file: EXEC,
    apply: once("  if (!pkg.ok) return refused(instagramPackagePreflightReason(pkg.failure));\n", ""),
    expect: /X1 deselected/,
  },
  {
    label: "X2 post-commit provider pre-flight removed",
    file: EXEC,
    apply: once("  if (!pkgAgain.ok) return refuseAfterSpend(instagramPackageFailureClass(pkgAgain.failure));\n", ""),
    expect: /X4: /,
  },
  {
    label: "M1 INSTAGRAM-MEDIA-COMPATIBILITY-1 aspect check removed from the verifier",
    file: VERIFIER,
    apply: once('  if (!isInstagramFeedAspect(selected.width, selected.height)) return { ok: false, failure: "image-aspect-unsupported" };\n', ""),
    expect: /K1 the first P1 image/,
  },
  {
    label: "M2 INSTAGRAM-MEDIA-COMPATIBILITY-1 derivative byte ceiling removed from the proposal",
    file: PROPOSAL,
    apply: once('  if (!isInstagramPublishImageSize(derivative.byteSize)) return refused("publish-image-too-large", String(derivative.byteSize));\n', ""),
    expect: /K12: /,
  },
  {
    label: "M3 INSTAGRAM-MEDIA-COMPATIBILITY-1 truthful pre-flight class folded into content-package-not-ready",
    file: EXEC,
    apply: once('  if (failure === "image-aspect-unsupported") return "image-aspect-unsupported";\n', ""),
    expect: /X6: truthful pre-flight refusal/,
  },
  {
    label: "T1 tenant predicate removed from the package read",
    file: PACKAGE,
    apply: once("          eq(workArtifactRevisions.tenantId, tenant.tenantId),\n          eq(workArtifactRevisions.artifactId, input.artifactId),", "          eq(workArtifactRevisions.artifactId, input.artifactId),"),
    expect: /H3: Acme's READY package does not exist for Globex/,
  },
];

function run(suite: string): { ok: boolean; output: string; timedOut: boolean } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`, timedOut: r.signal === "SIGTERM" && r.status === null };
}

const digest = (file: string) => createHash("sha256").update(readFileSync(path.join(ROOT, file))).digest("hex");

function main(): void {
  const files = [...new Set(MUTATIONS.map((m) => m.file))];
  const before = new Map(files.map((f) => [f, digest(f)]));
  const base = run(SUITE);
  assert.equal(base.ok, true, `baseline ${SUITE} must pass before any mutation:\n${base.output.slice(-2000)}`);
  for (const m of MUTATIONS) {
    const file = path.join(ROOT, m.file);
    const original = readFileSync(file);
    const text = original.toString("utf8");
    try {
      const mutated = m.apply(text);
      writeFileSync(file, mutated);
      assert.notEqual(readFileSync(file, "utf8"), text, `${m.label}: mutation reached disk`);
      const r = run(SUITE);
      assert.equal(r.timedOut, false, `${m.label}: the defending suite TIMED OUT — a VOID result, not a bite`);
      assert.equal(r.ok, false, `${m.label}: the mutation SURVIVED — ${SUITE} still passed`);
      assert.match(r.output, m.expect, `${m.label}: failed, but not for the intended reason:\n${r.output.slice(-1500)}`);
      console.log(`BITE ${m.label}`);
    } finally {
      writeFileSync(file, original);
      assert.ok(readFileSync(file).equals(original), `${m.label}: restoration is byte-identical`);
    }
  }
  for (const f of files) assert.equal(digest(f), before.get(f), `${f}: byte-identical to its pre-run state`);
  console.log(`BYTE-IDENTICAL ${files.map((f) => `${path.basename(f)}=${before.get(f)!.slice(0, 12)}`).join(" ")}`);
  console.log(`instagram-package-readiness-1/bite-proofs: ${MUTATIONS.length} mutations bit`);
}

main();
