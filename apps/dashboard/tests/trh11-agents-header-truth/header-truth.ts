/*
 * TRH-11 — the `/agents` page header states DURABLE organizational truth.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
 *
 * The page header read `${seededDefinitionCount} seeded agent definitions · in-memory registry ·
 * runtime ${runtimeMode}`, which renders "36 seeded agent definitions · in-memory registry ·
 * runtime simulation" for EVERY organization — none of those three values is tenant-scoped, and
 * the 36 come from `features/agents/mock.ts`, a file with no `tenant` in it at all.
 *
 * The simulation's own labels were never the problem and were never touched: `AgentsTruthSurface`
 * has said "memory · not durable", "Live execution: not connected", "Provider (ref)", "Model (ref)"
 * and "Definition is not execution" since UI Phase 25B. THE DEFECT WAS LOCATION. A `PageHeader`
 * context is the page's own subtitle — above the durable identity card, outside the labelled
 * section — so the first number a reader met, framed as a fact about their organization, was a
 * count of compiled-in fiction. Production holds ONE durable agent per tenant. The header said 36.
 *
 * ── WHAT THIS SUITE PINS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────
 *
 * It pins that the header is composed from the DURABLE identity authority and from nothing else,
 * and that the durable card still precedes the simulation section.
 *
 * It does NOT pin the simulation's presence, position, labels, model or dependencies — TRH-11
 * changed none of them, and `agent-id-0-1/boundaries-and-firewall.ts` already owns the ordering
 * claim. Re-asserting a neighbour's invariant here would create two places to update when it
 * legitimately moves. This suite asserts ordering only as the thing the header must not invert.
 *
 * Source-level. No database, no LLM, no render harness.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGE = "src/app/(dashboard)/agents/page.tsx";
const SURFACE = "src/components/agents/agents-truth-surface.tsx";
const MODEL = "src/features/workforce/agents-truth-model.ts";

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/* Comment-stripped source: every prohibition below names the thing it forbids, and this file's own
 * headers — and the page's — would trip several of them when matched over raw text. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function main(): void {
  const page = read(PAGE);
  const pageCode = codeOf(page);

  /* ── 1. THE HEADER IS NOT COMPOSED FROM THE SIMULATION ─────────────────────
   *
   * The exact regression: a seeded count, a persistence label or a runtime mode reaching the page
   * subtitle. Asserted over the header expression itself rather than the whole file, because the
   * page still legitimately holds the model — it passes it to the simulation surface untouched.
   */
  const headerMatch = pageCode.match(/const headerContext =([\s\S]*?);\n\n/);
  assert.ok(headerMatch, "the header context is derived in a named binding this suite can read");
  const headerExpression = headerMatch![1];

  for (const forbidden of [
    "seededDefinitionCount",
    "userDefinedCount",
    "runtimeMode",
    "persistenceProvider",
    "groupingCount",
    "model.",
  ]) {
    assert.ok(
      !headerExpression.includes(forbidden),
      `the page header must not be composed from \`${forbidden}\` — the simulation does not describe this organization`,
    );
  }

  /* ── 2. IT IS COMPOSED FROM THE DURABLE IDENTITY AUTHORITY ─────────────────
   *
   * The positive half. A header that merely stopped naming the simulation could still be a
   * hardcoded sentence; this requires it to read the authority that actually knows.
   */
  assert.ok(
    headerExpression.includes("identityState") && headerExpression.includes("identities"),
    "the header is composed from the durable agent identity authority",
  );

  /* ── 3. THE THREE FACTS STAY APART ────────────────────────────────────────
   *
   * `unauthenticated` is about the reader, `unavailable` is about the control plane, and zero rows
   * is a measured absence. The page keeps these apart in `block` and `mandateBlock` for a reason
   * the header must not undo: telling a Director "no durable agent identity" during a database
   * outage would be a fabricated absence.
   */
  assert.ok(
    /!tenant/.test(headerExpression),
    "an unauthenticated reader is answered as a fact about the READER",
  );
  assert.ok(
    /identityState\.status !== "known"/.test(headerExpression),
    "an unreachable identity authority is answered as a fact about the CONTROL PLANE",
  );
  assert.ok(
    /identities\.length === 0/.test(headerExpression),
    "zero durable rows is answered as its own, measured, third fact",
  );

  /* The unavailable branch must not be phrased as an absence. */
  const unavailableSentence = headerExpression
    .split('identityState.status !== "known"')[1]
    ?.split("identities.length === 0")[0] ?? "";
  assert.ok(
    /not a claim that none exists/i.test(unavailableSentence),
    "an unavailable authority explicitly denies that it means `none exists`",
  );

  /* ── 4. NO RUNTIME IS CLAIMED ─────────────────────────────────────────────
   *
   * `inService` is the identity authority's derivation — the absence of retirement — and nothing
   * on this page observes a running agent. The header may report it; it may not rename it into a
   * runtime word.
   *
   *     IN SERVICE != RUNNING
   */
  for (const runtimeWord of ["running", "online", "live", "active now", "executing"]) {
    assert.ok(
      !new RegExp(`"[^"]*\\b${runtimeWord}\\b[^"]*"`, "i").test(headerExpression),
      `the header must not say "${runtimeWord}" — no runtime is observed anywhere on this page`,
    );
  }

  /* ── 5. THE DURABLE CARD STILL PRECEDES THE SIMULATION ────────────────────
   *
   * The one ordering claim this suite makes, and only because a header change is exactly the kind
   * of edit that could reorder the page while nobody was looking. `agent-id-0-1` owns the full
   * version of this invariant; this is the narrow guard against THIS phase inverting it.
   */
  assert.ok(
    pageCode.includes("<DurableAgentIdentityCard") && pageCode.includes("<AgentsTruthSurface"),
    "both the durable card and the simulation surface are still rendered",
  );
  assert.ok(
    pageCode.indexOf("<DurableAgentIdentityCard") < pageCode.indexOf("<AgentsTruthSurface"),
    "the durable identity is still rendered BEFORE the simulation section",
  );

  /* ── 6. THE SIMULATION WAS NOT TOUCHED ────────────────────────────────────
   *
   * TRH-11 is presentation-only and scoped to one binding. The simulation keeps its capability,
   * its model and its self-describing labels — the fix was never that a simulation existed.
   */
  const surface = read(SURFACE);
  for (const label of [
    "not durable",
    "not connected",
    "Provider (ref)",
    "Model (ref)",
    "Seeded status",
  ]) {
    assert.ok(
      surface.includes(label),
      `the simulation surface still labels itself: "${label}" is intact`,
    );
  }
  assert.ok(
    codeOf(page).includes("<AgentsTruthSurface model={model} />"),
    "the simulation still receives the same model, unnarrowed and unfiltered",
  );
  assert.ok(
    read(MODEL).includes("seededDefinitionCount"),
    "the truth model still exposes its seeded count — it was never wrong, only wrongly placed",
  );

  console.log("trh11-agents-header-truth/header-truth: OK");
}

main();
