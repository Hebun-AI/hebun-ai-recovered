/*
 * CMD-B2 bite-proofs — fourteen mutations of the REAL source, each re-run in a child process.
 *
 * ── WHY A CHILD PROCESS ──────────────────────────────────────────────────────
 *
 * The navigation authority is a module-level constant. Rewriting the file inside this process would
 * change nothing that any already-imported module can see, so an in-process "mutation" would prove
 * only that the harness can lie to itself. Every proof here therefore writes the mutation to disk,
 * re-runs `navigation.ts` with `node --import tsx`, and requires that run to fail.
 *
 * ── WHAT COUNTS AS A PROOF ───────────────────────────────────────────────────
 *
 * Four conditions, all of them checked, because three of them have caught a false pass in this
 * repository before:
 *
 *   1. THE MUTATION APPLIED. The file on disk differs from the original — a mutation that silently
 *      failed to apply is indistinguishable from a guard that did not bite.
 *   2. THE RUN FAILED. Non-zero exit.
 *   3. IT FAILED FOR THE INTENDED REASON. The expected assertion message appears in the output. A
 *      mutation that trips an unrelated check has proved nothing about the guard it targets.
 *   4. THE FILE CAME BACK BYTE-IDENTICAL. Verified by sha256, not by "we wrote it back".
 *
 * Restoration runs in `finally`, so an assertion failure never leaves mutated source on disk.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "tests/cmdb2-canonical-command-l2/navigation.ts";
const NAV = "src/config/workspace-nav.ts";
const MOBILE = "src/components/layout/mobile-nav.tsx";
const OVERVIEW = "src/components/command-overview/command-overview.tsx";
const MODEL = "src/features/command-overview/workspace-model.ts";
const INBOX = "src/app/(dashboard)/command/inbox/page.tsx";
const BRIEFINGS = "src/app/(dashboard)/command/briefings/page.tsx";
/** A file this phase does not otherwise touch, used only to plant a second navigation list. */
const INTRUDER = "src/config/__cmdb2_second_nav.ts";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Run the CMD-B2 contract in a child process against whatever is currently on disk. */
function runSuite(): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  /* A timeout or spawn failure is a VOID proof, never a pass — say so instead of counting it. */
  assert.ok(!result.error, `the child run failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

let bitten = 0;

/**
 * Apply one mutation, require the contract to fail for `because`, and restore byte-identically.
 *
 * `mutate` returns the new content for `file`, or `null` to delete it.
 */
function bites(label: string, file: string, because: string, mutate: (original: string) => string | null): void {
  const existed = existsSync(abs(file));
  const original = existed ? readFile(file) : null;
  const before = original === null ? "<absent>" : sha(original);
  try {
    const next = mutate(original ?? "");
    if (next === null) rmSync(abs(file));
    else writeFileSync(abs(file), next, "utf8");

    /* 1 — the mutation applied. */
    const applied = existsSync(abs(file)) ? readFile(file) : null;
    assert.notEqual(
      applied === null ? "<absent>" : sha(applied),
      before,
      `${label}: the mutation did not apply, so this proof would be vacuous`,
    );

    /* 2 + 3 — the contract failed, and for the intended reason. */
    const { ok, output } = runSuite();
    assert.equal(ok, false, `${label}: the contract still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1200)}`,
    );
    bitten += 1;
  } finally {
    /* 4 — restored, byte-identical. */
    if (original === null) {
      if (existsSync(abs(file))) rmSync(abs(file));
    } else {
      writeFileSync(abs(file), original, "utf8");
      assert.equal(sha(readFile(file)), before, `${label}: restoration was not byte-identical`);
    }
  }
}

/** The canonical destinations block, matched exactly so a mutation cannot silently miss. */
const DECISIONS =
  '      { label: "Decisions", href: "/approvals", icon: ShieldCheck, purpose: "Pending human authority — navigates to the Decisions surface.", roles: ["director"], elevated: true },\n';
const INTENT =
  '      { label: "Director Intent", href: "/command/intent", icon: Compass, purpose: "Express intent — Heby prepares under authority.", roles: ["director"], elevated: true },\n';

function replaceOnce(src: string, from: string, to: string, label: string): string {
  const count = src.split(from).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one occurrence to mutate, found ${count}`);
  return src.replace(from, to);
}

const CANONICAL_ORDER = "Command canonical L2 is exactly Overview, Decisions, Director Intent";
const CANONICAL_ROUTES = "and their routes are exactly /command, /approvals, /command/intent";

function main(): void {
  /* ── M1–M3 · a removed destination comes back ───────────────────────────── */
  bites("M1 — Inbox returns to the canonical menu", NAV, CANONICAL_ORDER, (s) =>
    replaceOnce(s, DECISIONS, `      { label: "Inbox", href: "/command/inbox", icon: Gauge, purpose: "back" },\n${DECISIONS}`, "M1"),
  );
  bites("M2 — Briefings returns to the canonical menu", NAV, CANONICAL_ORDER, (s) =>
    replaceOnce(s, DECISIONS, `      { label: "Briefings", href: "/command/briefings", icon: Gauge, purpose: "back" },\n${DECISIONS}`, "M2"),
  );
  bites("M3 — Strategic Goals returns to the canonical menu", NAV, CANONICAL_ORDER, (s) =>
    replaceOnce(s, INTENT, `${INTENT}      { label: "Strategic Goals", href: "/director/goals", icon: Gauge, purpose: "back" },\n`, "M3"),
  );

  /* ── M4–M6 · the three that remain are altered ──────────────────────────── */
  bites("M4 — Decisions is removed", NAV, CANONICAL_ORDER, (s) => replaceOnce(s, DECISIONS, "", "M4"));
  bites("M5 — Director Intent is ordered before Decisions", NAV, CANONICAL_ORDER, (s) =>
    replaceOnce(replaceOnce(s, INTENT, "", "M5a"), DECISIONS, `${INTENT}${DECISIONS}`, "M5b"),
  );
  bites("M6 — Decisions points somewhere other than /approvals", NAV, CANONICAL_ROUTES, (s) =>
    replaceOnce(s, 'href: "/approvals"', 'href: "/command/decisions"', "M6"),
  );

  /* ── M7–M8 · a legacy route is retired instead of merely unlisted ───────── */
  bites("M7 — a legacy route file is deleted", INBOX, "/command/inbox still exists", () => null);
  bites(
    "M8 — a legacy route is redirected to /command",
    BRIEFINGS,
    "/command/briefings was not turned into a redirect",
    (s) => `import { redirect } from "next/navigation";\nredirect("/command");\n${s}`,
  );

  /* ── M9–M10 · a second navigation authority appears ─────────────────────── */
  bites(
    "M9 — a second Command navigation list is declared elsewhere",
    INTRUDER,
    "only workspace-nav declares navigation destinations",
    () =>
      'export const SECOND = {\n  destinations: [\n    { label: "Overview", href: "/command" },\n  ],\n};\n',
  );
  bites(
    "M10 — the mobile drawer hard-codes its own Command list",
    MOBILE,
    "hard-codes no Command destination",
    (s) =>
      `const OWN_LIST = [\n  { label: "Overview", href: "/command" },\n  { label: "Decisions", href: "/approvals" },\n];\nvoid OWN_LIST;\n${s}`,
  );

  /* ── M11–M12 · treatment and membership ─────────────────────────────────── */
  bites("M11 — Decisions loses its elevated treatment", NAV, "Decisions keeps its elevated treatment", (s) =>
    replaceOnce(s, DECISIONS, DECISIONS.replace(", elevated: true", ""), "M11"),
  );
  bites("M12 — Heby is added as a Command destination", NAV, CANONICAL_ORDER, (s) =>
    replaceOnce(s, INTENT, `${INTENT}      { label: "Heby", href: "/heby", icon: Gauge, purpose: "ambient" },\n`, "M12"),
  );

  /* ── M13–M14 · CMD-B1 and the capability floor ──────────────────────────── */
  bites(
    "M13 — the CMD-B1 Overview presentation is changed",
    OVERVIEW,
    'CMD-B1 section "Waiting on you" is unchanged',
    (s) => replaceOnce(s, 'title="Waiting on you"', 'title="Your queue"', "M13"),
  );
  bites("M14 — a server action is introduced", MODEL, "no server action was added", (s) => `"use server";\n${s}`);

  assert.equal(bitten, 14, `every mutation must bite; ${bitten} of 14 did`);
  console.log(`CMD-B2: all ${bitten} bite-proofs bit, each for its intended reason, each restored byte-identically`);
}

main();
