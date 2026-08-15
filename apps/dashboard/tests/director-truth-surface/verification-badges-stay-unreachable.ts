/*
 * Verification-looking badges must not become reachable without an authority behind them.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────
 *
 * This is NOT a repair. `/approvals` was audited and found truthful: it consumes
 * `features/decisions/workspace-model.ts`, which explicitly REFUSES the legacy mock projection,
 * renders honest empty states ("None connected", "No evidence is attached to a decision"), and
 * offers no Approve/Reject affordance because no server-authorized mutation path exists. Nothing
 * on that surface claims verification.
 *
 * What this guards is a LATENT defect. Three components in the tree render a `trust: "Verified"`
 * badge — or an equivalent status label — from mock fixtures, with no Governance decision behind
 * the word. They are currently unreachable from every route, so they mislead nobody. Mounting any
 * of them would ship a fabricated Governance claim on the day it happened.
 *
 * ── WHY REACHABILITY AND NOT A STRING BAN ───────────────────────────────────
 *
 * The word "Verified" is legitimate wherever an authority actually proves it. Banning the literal
 * would be the brittle kind of guard this repository has already been bitten by twice. What is
 * actually forbidden is a *route* reaching a badge that no authority backs — so reachability is the
 * thing to assert.
 *
 * A file that is DELETED passes. This guard says "not reachable", never "must exist".
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

/**
 * Components that render a verification/trust badge from a fixture rather than from an authority.
 * Each was read and confirmed to print the word as a status claim, not as neutral prose.
 */
const UNBACKED_BADGE_COMPONENTS = [
  "src/components/decision-domain/decision-workspace.tsx",
  "src/components/knowledge-domain/knowledge-intelligence.tsx",
  "src/components/director-dashboard/item-list.tsx",
] as const;

/** Every `.ts`/`.tsx` under src, with the `@/…` specifiers it imports. */
function importGraph(): Map<string, readonly string[]> {
  const graph = new Map<string, readonly string[]>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.endsWith(".ts") && !entry.endsWith(".tsx")) continue;
      const source = readFileSync(path, "utf8");
      const specifiers = [...source.matchAll(/from\s+"@\/([^"]+)"/g)].map((match) => match[1]!);
      graph.set(path.slice(process.cwd().length + 1), specifiers);
    }
  };
  walk(SRC);
  return graph;
}

function resolve(specifier: string, graph: Map<string, readonly string[]>): string | undefined {
  for (const suffix of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const candidate = `src/${specifier}${suffix}`;
    if (graph.has(candidate)) return candidate;
  }
  return undefined;
}

/** Everything transitively reachable from the Next.js route tree. */
function reachableFromRoutes(): Set<string> {
  const graph = importGraph();
  const seen = new Set<string>();
  const stack = [...graph.keys()].filter((file) => file.startsWith("src/app"));
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const specifier of graph.get(current) ?? []) {
      const resolved = resolve(specifier, graph);
      if (resolved && !seen.has(resolved)) stack.push(resolved);
    }
  }
  return seen;
}

export function run(): void {
  const reachable = reachableFromRoutes();

  /* Sanity: the graph must actually work, or every assertion below would pass vacuously. */
  assert.ok(reachable.size > 200, "the import graph resolved (a broken walk would pass vacuously)");
  assert.ok(
    reachable.has("src/components/decision-workspace/decision-workspace.tsx"),
    "the REAL /approvals workspace is reachable — proving the graph finds live components",
  );

  /* ── 1. NO UNBACKED VERIFICATION BADGE IS REACHABLE FROM A ROUTE ───────── */
  for (const component of UNBACKED_BADGE_COMPONENTS) {
    if (!existsSync(join(process.cwd(), component))) continue; // deleted is fine — better, even
    assert.ok(
      !reachable.has(component),
      `${component} renders a verification badge no authority proves. Mounting it would ship a ` +
        `fabricated Governance claim. Give the badge a real authority, or change the wording, ` +
        `before making it reachable.`,
    );
  }

  /* ── 2. /approvals STILL REFUSES THE MOCK PROJECTION ───────────────────── */
  {
    const model = readFileSync(join(SRC, "features", "decisions", "workspace-model.ts"), "utf8");
    /*
     * The model's own words. If a future change starts consuming the mock decision projection,
     * this surface would begin showing fabricated approvals and evidence — the exact defect the
     * Director truth-surface gate repaired one route over.
     */
    assert.ok(
      model.includes("getDecisionProjection) is a mock"),
      "the model must keep RECORDING why it refuses the legacy projection",
    );
    assert.ok(
      !/from "@\/features\/decision-domain\/mock"/.test(model),
      "and must not start importing the mock fixtures",
    );

    const page = readFileSync(join(SRC, "app", "(dashboard)", "approvals", "page.tsx"), "utf8");
    assert.ok(
      page.includes("@/features/decisions/workspace-model"),
      "/approvals builds from the contract-derived model",
    );
    assert.ok(
      !page.includes("decision-domain"),
      "/approvals must not mount the decision-domain components",
    );
  }

  /* ── 3. THE MOUNTED SURFACE CLAIMS NO VERIFICATION ─────────────────────── */
  {
    const dir = join(SRC, "components", "decision-workspace");
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".tsx"))) {
      const source = readFileSync(join(dir, file), "utf8");
      /*
       * Strip comments first. These files DISCUSS confidence and verification at length — to
       * explain what they deliberately do not render — and a guard that tripped on that prose
       * would be a guard that punishes documentation.
       */
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const claim of ['"Verified"', ">Verified<", "Trust level", "% confidence"]) {
        assert.ok(!code.includes(claim), `${file} must not render "${claim}"`);
      }
    }
  }
}

run();
