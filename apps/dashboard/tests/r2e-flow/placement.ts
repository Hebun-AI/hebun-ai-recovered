/*
 * R2E.1 — provider control surface placement (structural, no DB, no network).
 *
 * Proves the connectivity control was MOVED to Providers & Models (its authoritative surface) and
 * that Platform Overview no longer hosts the full control — WITHOUT creating a second control,
 * a second authority, a second mutation, or a second projection. Placement changed; authority
 * did not.
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

  // 3. The card still uses the EXISTING single R2E mutation action (no re-implementation).
  assert.ok(card.includes("setClaudeConnectivityAction"), "card uses the existing R2E action");

  // 4. No duplicate authority: exactly one action, one card component, one durable control table.
  const actionDefs = filesContaining(/export\s+async\s+function\s+setClaudeConnectivityAction/);
  assert.equal(actionDefs.length, 1, `exactly one connectivity mutation action (found ${actionDefs.length})`);

  const cardDefs = filesContaining(/export\s+function\s+ProviderConnectivityControlCard/);
  assert.equal(cardDefs.length, 1, `exactly one control card component (found ${cardDefs.length})`);

  const tableDefs = filesContaining(/pgTable\(\s*["']provider_connectivity_controls["']/);
  assert.equal(tableDefs.length, 1, `exactly one durable control table (found ${tableDefs.length})`);

  const repoDefs = filesContaining(/export\s+function\s+createProviderConnectivityControlRepository/);
  assert.equal(repoDefs.length, 1, `exactly one control repository (found ${repoDefs.length})`);

  console.log("r2e.1 placement checks passed");
}

main();
