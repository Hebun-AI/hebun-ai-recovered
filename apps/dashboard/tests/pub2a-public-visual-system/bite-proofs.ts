/*
 * PUB-2A — bite proofs.
 *
 * A guard that has never been watched to fail is a guard nobody has evidence for. Each proof below
 * applies ONE mutation to real source, runs the suite that is supposed to object, and asserts that
 * it objected FOR THE RIGHT REASON — then restores the file byte-identically.
 *
 * A proof whose mutation fails to APPLY looks exactly like a guard that held, so the mutation is
 * checked by digest before the suite is run. A proof whose child run times out is VOID and is
 * reported as such rather than counted either way.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (p: string) => path.join(ROOT, p);
const read = (p: string) => readFileSync(abs(p), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const SUITE = "tests/pub2a-public-visual-system/visual-system.ts";
const GLOBALS = "src/app/globals.css";
const TOKENS = "src/styles/tokens.css";
const HOME = "src/app/(public)/page.tsx";
const PKG = "package.json";

let bitten = 0;

function runSuite(): { ok: boolean; output: string; timedOut: boolean } {
  const result = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM",
  };
}

function bites(label: string, file: string, because: string, from: string, to: string): void {
  const original = read(file);
  const before = sha(original);
  try {
    const mutated = original.replace(from, to);
    writeFileSync(abs(file), mutated, "utf8");
    assert.notEqual(sha(read(file)), before, `${label}: the mutation did not apply — the proof is vacuous`);

    const { ok, output, timedOut } = runSuite();
    assert.equal(timedOut, false, `${label}: the suite run timed out — VOID, not a verdict`);
    assert.equal(ok, false, `${label}: the suite still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1200)}`,
    );
    bitten += 1;
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: restoration was not byte-identical`);
  }
}

function main(): void {
  /* ── PROGRESSIVE ENHANCEMENT ───────────────────────────────────────────── */

  bites(
    "the scroll-driven trace loses its @supports gate, so a browser without scroll-driven animation would receive an unfinished page",
    GLOBALS,
    "drives on scroll without an @supports gate",
    "@supports (animation-timeline: view()) {\n  @media (prefers-reduced-motion: no-preference) {\n    /*\n     * The trace is drawn against ITS OWN extent",
    "@media all {\n  @media (prefers-reduced-motion: no-preference) {\n    /*\n     * The trace is drawn against ITS OWN extent",
  );

  bites(
    "the hero reveal is applied unconditionally, so a reader who asked for less motion gets it anyway",
    GLOBALS,
    "animates without a reduced-motion gate",
    "@media (prefers-reduced-motion: no-preference) {\n  .public-reveal {",
    "@media all {\n  .public-reveal {",
  );

  /* ── REDUCED MOTION KEEPS THE TRACE'S GEOMETRY ─────────────────────────── */

  bites(
    "reduced motion resets the junction's centring along with its animation, moving every mark off the rail",
    GLOBALS,
    "reduced motion must not reset the junction's centring",
    "  .public-trace-node {\n    border-color: var(--trace-live) !important;\n    background: var(--trace-live) !important;\n  }\n}",
    "  .public-trace-node {\n    translate: none !important;\n    border-color: var(--trace-live) !important;\n    background: var(--trace-live) !important;\n  }\n}",
  );

  /* ── THE PALETTE AND THE MOTION BUDGET ─────────────────────────────────── */

  bites(
    "the trace is given a glow, which is the difference between a drawn path and a neon beam",
    GLOBALS,
    "reaches for a shadow",
    ".public-trace-line {\n  background: var(--trace-hairline);\n}",
    ".public-trace-line {\n  background: var(--trace-hairline);\n  box-shadow: 0 0 8px var(--trace-live);\n}",
  );

  bites(
    "the hero reveal is stretched past the approved ceiling",
    TOKENS,
    "the approved ceiling for the main reveal is 600ms",
    "--dur-reveal:       560ms;",
    "--dur-reveal:       1400ms;",
  );

  /* ── THE RHYTHM, AND THE ONE TRACE ─────────────────────────────────────── */

  bites(
    "a section stops choosing its own height and falls back to the default, thinning the rhythm",
    HOME,
    "PUB-1's flaw was five identical boxes",
    '          size="dense"\n          layout="wide"\n',
    '          layout="wide"\n',
  );

  bites(
    "the heading returns to the same position in every section",
    HOME,
    "the heading may not sit in the same place five times",
    '          tone="ink"\n          layout="split"\n',
    '          tone="ink"\n',
  );

  /* ── THE TWO REGISTERS, AND WHAT THE DARK ONE MAY NOT BECOME ───────────── */

  bites(
    "the ink register derives from the very property it redefines, which is a cycle that resolves every colour in the scope to nothing",
    GLOBALS,
    "deriving from the property it redefines is a cycle",
    "  --color-bg:             color-mix(in srgb, var(--public-ink) 88%, black);",
    "  --color-bg:             color-mix(in srgb, var(--color-text-primary) 88%, black);",
  );

  bites(
    "the dark ground stops being the product's own ink and becomes a colour chosen to look like it",
    GLOBALS,
    /* Caught by the palette firewall first, which is the same claim stated one guard earlier. */
    "hardcodes a hex colour",
    "  --color-surface:        var(--public-ink);",
    "  --color-surface:        #101828;",
  );

  bites(
    "the one ink scope is dissolved, so the dark register becomes per-component dark classes again",
    GLOBALS,
    "the ink register must exist as one scope",
    ".public-ink {\n  --color-bg:",
    ".public-ink-legacy {\n  --color-bg:",
  );

  /* ── THE HEADING SCALE, WHICH IS WHY THE PAGE READ AS DOCUMENTATION ────── */

  bites(
    "the section heading is returned to a UI label size",
    TOKENS,
    "it is a label, not a heading",
    "--fs-statement:       clamp(2rem, 1.32rem + 2.2vw, 3.25rem);",
    "--fs-statement:       clamp(1.125rem, 1.32rem + 2.2vw, 3.25rem);",
  );

  bites(
    "a homepage section loses its statement and falls back to the card-label heading",
    HOME,
    "has no statement, so its heading falls back to card-label size",
    /*
     * The statement is REPLACED rather than deleted, so the copy firewall (which would object to
     * the sentence disappearing) is not the guard being tested here. The sentence still ships; it
     * has just stopped being the heading.
     */
    '          statement="Named mechanisms, not adjectives."',
    '          caption="Named mechanisms, not adjectives."',
  );

  bites(
    "a tall section is made shorter than a compact one, so the sizes stop being an ordering",
    GLOBALS,
    "the property is decoration, not rhythm",
    "  .public-section-tall    { --section-pad-y: 7rem; }",
    "  .public-section-tall    { --section-pad-y: 3rem; }",
  );

  bites(
    "a second trace is run down the page, so the one continuous path becomes two",
    HOME,
    "the homepage runs ONE continuous trace",
    "    <>\n      <PublicTrace>",
    "    <>\n      <PublicTrace>\n      <PublicTrace>",
  );

  /* ── NO NEW DEPENDENCY ─────────────────────────────────────────────────── */

  bites(
    "a motion dependency is declared, which is a Director decision rather than an implementation detail",
    PKG,
    "the approved route was zero new motion dependency",
    '"drizzle-orm"',
    '"framer-motion": "^12.0.0",\n    "drizzle-orm"',
  );

  assert.equal(bitten, 15, "every bite proof must have bitten");
  console.log(`PUB-2A bite proofs: ${bitten} guards proved to bite`);
}

main();
