/*
 * TRH-12 — `/agents` obeys the released mock-surface gate, and obeys no other policy.
 *
 * ── THE OMISSION THIS CLOSES ─────────────────────────────────────────────────
 *
 * `resolveMockSurfaceGate` has answered "may compiled-in organizational fiction be presented in
 * this environment?" since 2026-08-18. It already withholds the Director dashboard projection and,
 * through the same adapter, Heby's grounding. `/agents` never asked it — so in production, on the
 * authoritative organizational route, 36 seeded definitions from `features/agents/mock.ts` (a file
 * with no `tenant` in it) rendered for organizations that hold ONE durable agent each.
 *
 * That is the identical omission CMD-0 found on `/director/goals` two days after the gate shipped,
 * and it was repaired the same way: by consulting the gate that already existed. CMD-0's closure
 * also pre-answers the objection that the labels are honest —
 *
 *     "WITHHELD, NOT RELABELLED. Marking the four rows 'Seeded' and showing them anyway would
 *      still tell the Director their organization has a SOC2 readiness goal."
 *
 * ── WHAT THIS SUITE PINS ─────────────────────────────────────────────────────
 *
 * Two claims, and they are different:
 *
 *   1. EXPOSURE  — when the gate refuses, no simulated registry renders on `/agents`.
 *   2. AUTHORITY — that decision comes from the released gate and from nothing else. A route-local
 *                  environment check would satisfy (1) while recreating the defect: two policies
 *                  for one question, free to disagree.
 *
 * ── WHAT IT DELIBERATELY DOES NOT PIN ────────────────────────────────────────
 *
 * The ordering invariant. `agent-id-0-1/boundaries-and-firewall.ts` owns "the durable authority is
 * presented BEFORE the simulation", its bite-proof M11 owns the proof that the claim bites, and
 * TRH-12 preserved both. Restating a neighbour's invariant here would create two places to update
 * when it legitimately moves.
 *
 * Nor the gate's own semantics — `mock-surface-gating/gating-and-firewall.ts` owns those, including
 * that it fails closed. This suite asserts only that `/agents` DEFERS to it.
 *
 * Source-level. No database, no LLM, no render harness.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGE = "src/app/(dashboard)/agents/page.tsx";
const GATE = "src/features/mock-surface-gating/gate.server.ts";
const MOCK = "src/features/agents/mock.ts";
const ADAPTER = "src/features/agent-crud/agent-adapter.ts";
const SURFACE = "src/components/agents/agents-truth-surface.tsx";
const REGISTRY_ROUTE = "src/app/(dashboard)/director/registries/agents/page.tsx";

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/* Comment-stripped source: every prohibition below names the thing it forbids, and this file's own
 * headers — and the page's — would trip several of them when matched over raw text. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function main(): void {
  const page = codeOf(read(PAGE));

  /* ── 1. THE SIMULATION RENDERS ONLY UNDER THE GATE'S DECISION ──────────────
   *
   * The exact regression: an unguarded `<AgentsTruthSurface …>`, which is what shipped for the
   * eighteen days between the gate and this repair.
   */
  assert.ok(
    page.includes("<AgentsTruthSurface"),
    "the simulation surface is still referenced — TRH-12 gates it, it does not delete it",
  );
  assert.ok(
    /\{\s*mockExposurePermitted\s*\?\s*<AgentsTruthSurface[\s\S]*?:\s*null\s*\}/.test(page),
    "the simulated registry renders ONLY when mock exposure is permitted, and renders nothing otherwise",
  );
  assert.ok(
    !/^\s*<AgentsTruthSurface/m.test(page),
    "no unguarded `<AgentsTruthSurface>` render survives on this route",
  );

  /* ── 2. THE DECISION COMES FROM THE RELEASED GATE ─────────────────────────
   *
   * The positive half, and the one that keeps this from becoming a second policy.
   */
  assert.ok(
    page.includes("@/features/mock-surface-gating/gate.server"),
    "the route imports the released mock-surface gate",
  );
  assert.ok(
    /const mockExposurePermitted = organizationalDemoDataPermitted\(\);/.test(page),
    "the exposure decision is the gate's released predicate, called directly and unmodified",
  );

  /* ── 3. NO ROUTE-LOCAL EXPOSURE POLICY ────────────────────────────────────
   *
   * A route that re-derived the answer from its own environment reading would satisfy every
   * assertion above and still be the defect: two authorities for one question. `NODE_ENV` and a
   * hand-rolled host or flag check are the shapes that would do it.
   */
  for (const forbidden of [
    "NODE_ENV",
    "VERCEL_ENV",
    "process.env",
    "isControlPlaneConfigured",
    "getAuthEnvironment",
    "resolveMockSurfaceGate",
  ]) {
    assert.ok(
      !page.includes(forbidden),
      `the route must not reach \`${forbidden}\` — exposure is the gate's decision, not a second one taken here`,
    );
  }

  /* ── 4. THE GATE ITSELF IS UNTOUCHED ──────────────────────────────────────
   *
   * TRH-12 consulted an authority; it did not edit one. If the predicate below ever stops meaning
   * what `/agents` now relies on, that is a change to the gate's own firewall, not to this route.
   */
  const gate = read(GATE);
  assert.ok(
    gate.includes("export function organizationalDemoDataPermitted()"),
    "the released predicate still exists with the released name",
  );
  assert.ok(
    gate.includes("export function resolveMockSurfaceGate()"),
    "and the decision it delegates to is still the released one",
  );

  /* ── 5. THE SIMULATION SUBSYSTEM SURVIVED, WHOLE ──────────────────────────
   *
   *     HIDING A MOCK SURFACE != DELETING THE MOCK SUBSYSTEM
   *
   * The 36 definitions still compile, the adapter still seeds from them, the surface component is
   * unchanged, and the DEDICATED simulation route still renders in every posture because it does
   * not consult this gate — so a developer loses no capability, only a misplaced presentation.
   */
  const mock = read(MOCK);
  assert.ok(mock.length > 0, "the seeded definition module still exists");
  assert.ok(
    read(ADAPTER).includes('from "@/features/agents/mock"'),
    "the CRUD adapter still seeds from the definitions — its consumers are untouched",
  );
  for (const label of ["not durable", "not connected", "Provider (ref)", "Model (ref)"]) {
    assert.ok(
      read(SURFACE).includes(label),
      `the simulation surface is unmodified: "${label}" is intact`,
    );
  }
  assert.ok(
    !codeOf(read(REGISTRY_ROUTE)).includes("mock-surface-gating"),
    "the dedicated simulation route does not consult this gate — the simulation stays reachable in every posture",
  );

  /* ── 6. NO MOCK DEFINITION BECAME A DURABLE AGENT ─────────────────────────
   *
   * The boundary AGENT-ID-0.1 established, re-measured here because a phase that touches both
   * surfaces at once is exactly when it could be crossed by accident.
   */
  assert.ok(
    !codeOf(mock).includes("agent-identity") &&
      !codeOf(mock).includes("createDurableAgentIdentityAction"),
    "the simulation still cannot reach the durable authority",
  );

  /* ── 7. THE TRH-11 HEADER DID NOT REGRESS ─────────────────────────────────
   *
   * Gating the surface must not tempt the header back into describing it. `trh11` owns the full
   * claim; this is the narrow guard against THIS phase undoing it.
   */
  assert.ok(
    !/const headerContext =[\s\S]*?;\n/.exec(page)?.[0]?.includes("seededDefinitionCount"),
    "the page header still states durable truth and never a seeded count",
  );

  console.log("trh12-mock-gate-reconciliation/exposure-firewall: OK");
}

main();
