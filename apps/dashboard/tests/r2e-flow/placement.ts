/*
 * R2E.1 — provider control surface placement (structural, no DB, no network).
 *
 * Proves the connectivity card lives on Providers & Models (its authoritative surface) and that
 * Platform Overview does not host a second one — WITHOUT creating a second control, a second
 * authority, or a second projection.
 *
 * ── WHAT R5.1 CHANGED ────────────────────────────────────────────────────────
 *
 * The card is now READ-ONLY, and the claim it anchors got stronger. R2E.1 asserted "exactly one
 * mutation action exists"; the count is now ZERO, and asserted as zero over the whole of `src`. The
 * global control row is root-scoped while every in-app authority is tenant-scoped, so the write
 * moved to the deployment-possession ceremony rather than being re-gated. Placement is unchanged.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join("src");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

/** Count how many source files under src contain a pattern. */
function filesContaining(pattern: RegExp): string[] {
  const hits: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry.name) && pattern.test(readFileSync(p, "utf8"))) hits.push(p);
    }
  }
  walk(SRC);
  return hits;
}

function main(): void {
  const overview = read("app/(dashboard)/platform/page.tsx");
  const providersModels = read("app/(dashboard)/director/provider-matrix/page.tsx");
  const card = read("components/platform-providers/provider-connectivity-control-card.tsx");

  // 1. The full control renders under Providers & Models, over the existing projection.
  assert.ok(providersModels.includes("ProviderConnectivityControlCard"), "control card on Providers & Models");
  assert.ok(providersModels.includes("readProviderOpsView"), "Providers & Models reads the R2E projection");

  // 2. Platform Overview no longer hosts the FULL control card (status-only summary is allowed).
  assert.ok(!overview.includes("ProviderConnectivityControlCard"), "no full control card on Overview");
  assert.ok(!overview.includes("setClaudeConnectivityAction"), "no mutation/toggle on Overview");
  // If Overview keeps a summary, it must read the SAME projection (no second state source).
  // (Not required to keep one — but if present it may only be readProviderOpsView.)

  // 3. The card is READ-ONLY: it names no mutation and imports no server action.
  assert.ok(!card.includes("setClaudeConnectivityAction"), "the card invokes no mutation");
  assert.ok(
    !/from\s+"@\/app\/\(dashboard\)\/platform\/actions"/.test(card),
    "the card imports no platform server action",
  );
  // It must EXPLAIN the absence rather than silently hiding a control the viewer cannot use.
  assert.ok(
    card.includes("provider:connectivity"),
    "the card names the ceremony that does own the change, instead of hiding the control",
  );

  // 4. No mutation action exists anywhere in src — the count is zero, not one.
  const actionDefs = filesContaining(/export\s+async\s+function\s+setClaudeConnectivityAction/);
  assert.equal(actionDefs.length, 0, `no connectivity mutation action may exist (found ${actionDefs.length})`);

  const cardDefs = filesContaining(/export\s+function\s+ProviderConnectivityControlCard/);
  assert.equal(cardDefs.length, 1, `exactly one control card component (found ${cardDefs.length})`);

  const tableDefs = filesContaining(/pgTable\(\s*["']provider_connectivity_controls["']/);
  assert.equal(tableDefs.length, 1, `exactly one durable control table (found ${tableDefs.length})`);

  const repoDefs = filesContaining(/export\s+function\s+createProviderConnectivityControlRepository/);
  assert.equal(repoDefs.length, 1, `exactly one control repository (found ${repoDefs.length})`);

  console.log("r2e.1 placement checks passed");
}

main();
