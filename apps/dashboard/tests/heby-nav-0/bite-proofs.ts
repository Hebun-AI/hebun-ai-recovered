/*
 * HEBY-NAV-0 bite-proofs — twelve mutations of the real source, each re-run in a child process.
 *
 * The contract under test lives in a module whose directory is built once at import time, so an
 * in-process "mutation" would prove nothing about the resolver the product actually loads. Every
 * proof writes to disk, re-runs `exact-route-truth.ts` with `node --import tsx`, and requires that
 * run to fail — applied, failed, failed for the INTENDED reason, restored byte-identically.
 *
 * The harness itself is verified at the end: a comment-only mutation must be REJECTED as non-biting.
 * A proof harness that cannot fail is not a harness.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "tests/heby-nav-0/exact-route-truth.ts";
const TOOL = "src/features/heby-runtime/navigate-tool.ts";
const GATE = "src/features/heby-runtime/tool-gate.ts";
const NAV = "src/config/workspace-nav.ts";
const INBOX = "src/app/(dashboard)/command/inbox/page.tsx";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  /* A spawn failure or timeout is a VOID proof, never a pass. */
  assert.ok(!result.error, `the child run failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

let bitten = 0;

function bites(
  label: string,
  file: string,
  because: string,
  mutate: (original: string) => string | null,
  options: { readonly count?: boolean } = {},
): void {
  const existed = existsSync(abs(file));
  const original = existed ? readFile(file) : null;
  const before = original === null ? "<absent>" : sha(original);
  try {
    const next = mutate(original ?? "");
    if (next === null) rmSync(abs(file));
    else writeFileSync(abs(file), next, "utf8");

    const applied = existsSync(abs(file)) ? readFile(file) : null;
    assert.notEqual(
      applied === null ? "<absent>" : sha(applied),
      before,
      `${label}: the mutation did not apply, so this proof would be vacuous`,
    );

    const { ok, output } = runSuite();
    assert.equal(ok, false, `${label}: the contract still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1200)}`,
    );
    if (options.count !== false) bitten += 1;
  } finally {
    if (original === null) {
      if (existsSync(abs(file))) rmSync(abs(file));
    } else {
      writeFileSync(abs(file), original, "utf8");
      assert.equal(sha(readFile(file)), before, `${label}: restoration was not byte-identical`);
    }
  }
}

function replaceOnce(src: string, from: string, to: string, label: string): string {
  const count = src.split(from).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one occurrence to mutate, found ${count}`);
  return src.replace(from, to);
}

/* Exact source fragments, matched once each so a mutation cannot silently miss its target. */
const GUARD = '  if (isRouteShaped(q)) return { found: false, candidates: [] };';
const SHAPED = '  return query.includes("/");';
const EXACT_FIND =
  '  const exact = DIRECTORY.find((entry) => entry.route === q || entry.route === `/${q}`);\n' +
  '  if (exact) return { found: true, target: { route: exact.route, label: exact.label }, candidates: [] };';
const DECISIONS_LABEL = '{ label: "Decisions", href: "/approvals"';
const GATE_SUCCESS = '`Resolved to ${resolution.target.label}.`';

function main(): void {
  /* ── M1 · the original defect returns: a legacy path is answered with its workspace ────── */
  bites(
    "M1 — /command/inbox resolves to /command again",
    TOOL,
    "/command/inbox is never answered with /command",
    (s) => replaceOnce(s, SHAPED, "  return false;", "M1"),
  );

  /* ── M2 · an unknown path is allowed to fall back to a canonical neighbour ─────────────────
   *
   * DELIBERATELY NARROWER THAN M1. A blanket fall-through breaks the legacy case too and would fail
   * at the same assertion M1 does, proving one guard twice. This substitution fires only for paths
   * deeper than the legacy ones, so every legacy assertion still passes and the run reaches — and
   * fails at — the UNKNOWN-path property on its own.
   */
  bites(
    "M2 — an unknown deep path falls back to its nearest canonical prefix",
    TOOL,
    "/approvals/nope/deeper resolves to nothing",
    (s) =>
      replaceOnce(
        s,
        GUARD,
        "  if (isRouteShaped(q)) {\n" +
          "    if (q.split(`/`).length > 3) {\n" +
          "      const near = DIRECTORY.find((entry) => q.startsWith(`${entry.route}/`));\n" +
          "      if (near) return { found: true, target: { route: near.route, label: near.label }, candidates: [] };\n" +
          "    }\n" +
          "    return { found: false, candidates: [] };\n" +
          "  }",
        "M2",
      ),
  );

  /* ── M3 · a removed destination is put back into the navigation model ──────────────────── */
  bites(
    "M3 — Inbox returns to WORKSPACES",
    NAV,
    "Command canonical L2 is untouched by HEBY-NAV-0",
    (s) =>
      replaceOnce(
        s,
        `      ${DECISIONS_LABEL}`,
        `      { label: "Inbox", href: "/command/inbox", icon: Gauge, purpose: "back" },\n      ${DECISIONS_LABEL}`,
        "M3",
      ),
  );

  /* ── M4 · a second route authority is smuggled into the resolver ───────────────────────── */
  bites(
    "M4 — the resolver keeps its own legacy-route list",
    TOOL,
    "the resolver hard-codes no route",
    (s) =>
      `const LEGACY_ROUTES = ["/command/inbox", "/command/briefings"];\nvoid LEGACY_ROUTES;\n${s}`,
  );

  /* ── M5 · fuzzy matching is allowed to run first ───────────────────────────────────────── */
  bites(
    "M5 — fuzzy matching runs before the exact lookup",
    TOOL,
    "/command/intent resolves to itself",
    (s) =>
      replaceOnce(
        s,
        EXACT_FIND,
        "  const fuzzyFirst = DIRECTORY.filter((entry) =>\n" +
          "    entry.terms.some((term) => q === term || q.includes(term) || term.includes(q)),\n" +
          "  );\n" +
          "  if (fuzzyFirst.length >= 1)\n" +
          "    return { found: true, target: { route: fuzzyFirst[0].route, label: fuzzyFirst[0].label }, candidates: [] };\n" +
          EXACT_FIND,
        "M5",
      ),
  );

  /* ── M6 · an exact canonical path is answered with a different canonical path ──────────── */
  bites(
    "M6 — /approvals resolves to /command",
    TOOL,
    "/approvals resolves to itself",
    (s) =>
      replaceOnce(
        s,
        "  if (exact) return { found: true, target: { route: exact.route, label: exact.label }, candidates: [] };",
        "  if (exact) return { found: true, target: { route: DIRECTORY[0].route, label: DIRECTORY[0].label }, candidates: [] };",
        "M6",
      ),
  );

  /* ── M7 · a removed label regains natural-language discoverability ─────────────────────────
   *
   * Modelled as an ALIAS on an existing canonical entry rather than as a new route entry. The alias
   * is the realistic regression — someone makes "inbox" work again — and it isolates the discovery
   * property: adding a route entry would have made `/command/inbox` exact-resolvable too, and the
   * run would have failed on the path contract instead, proving a different guard.
   */
  bites(
    "M7 — Inbox becomes discoverable again as an alias",
    TOOL,
    '"inbox" is not discoverable from natural language',
    (s) =>
      replaceOnce(
        s,
        "terms: [workspace.label.toLowerCase(), workspace.id],",
        'terms: [workspace.label.toLowerCase(), workspace.id, "inbox"],',
        "M7",
      ),
  );

  /* ── M8 · navigation acquires a writer ─────────────────────────────────────────────────── */
  bites(
    "M8 — the resolver becomes a server action",
    TOOL,
    "is not a server action",
    (s) => `"use server";\n${s}`,
  );

  /* ── M9 · a legacy route is deleted rather than merely unlisted ────────────────────────── */
  bites("M9 — /command/inbox is deleted", INBOX, "/command/inbox still exists on disk", () => null);

  /* ── M10 · CMD-B2's canonical three is altered from under this gate ────────────────────── */
  bites(
    "M10 — the CMD-B2 canonical three is changed",
    NAV,
    "Command canonical L2 is untouched by HEBY-NAV-0",
    (s) => replaceOnce(s, DECISIONS_LABEL, '{ label: "Approvals", href: "/approvals"', "M10"),
  );

  /* ── M11 · a resolution starts implying authority ──────────────────────────────────────── */
  bites(
    "M11 — resolving a route claims the caller is authorized",
    GATE,
    "the resolution claims no",
    (s) =>
      replaceOnce(
        s,
        GATE_SUCCESS,
        "`Resolved to ${resolution.target.label}. You are authorized to act there.`",
        "M11",
      ),
  );

  /* ── M12 · the resolver takes a filesystem / build-artifact dependency ─────────────────────
   *
   * `node:fs` is the executable form of this mutation and is banned by the same assertion that bans
   * `.next`: a resolver that reads the build output would answer from an artifact that does not
   * exist in every environment it runs in. A direct `.next` JSON import was tried first and failed
   * to RESOLVE, which would have been a fail-for-the-wrong-reason rather than a proof.
   */
  bites(
    "M12 — the resolver reads the filesystem for route truth",
    TOOL,
    "imports no capability or build artifact (node:fs)",
    (s) => `import { readFileSync } from "node:fs";\nvoid readFileSync;\n${s}`,
  );

  assert.equal(bitten, 12, `every mutation must bite; ${bitten} of 12 did`);

  /*
   * THE HARNESS IS VERIFIED, NOT TRUSTED. A comment-only mutation changes the file, so it passes the
   * applied check, and must still be rejected — if this does not throw, every proof above is
   * meaningless.
   */
  let harnessRejectedTheHarmlessOne = false;
  try {
    bites("META — a comment-only mutation", TOOL, "unreachable", (s) => `// harmless\n${s}`, { count: false });
  } catch (error) {
    harnessRejectedTheHarmlessOne = /does not bite/.test(String(error));
  }
  assert.ok(
    harnessRejectedTheHarmlessOne,
    "the harness must reject a harmless mutation as non-biting, or it proves nothing",
  );

  console.log(`HEBY-NAV-0: all ${bitten} bite-proofs bit, each for its intended reason, each restored byte-identically`);
}

main();
