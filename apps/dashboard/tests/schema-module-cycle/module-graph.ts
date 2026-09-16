/*
 * SCHEMA MODULE CYCLE · the load-order failure that took production machine ingresses down, and the
 * dependency direction that must never return.
 *
 * ── WHAT HAPPENED ───────────────────────────────────────────────────────────
 *
 * `_base.ts` defines `tenantColumns`, whose `tenantId` names `companies.id`, so `_base` imports
 * `company`. `company.ts` imported `_base` back (to spread `rootColumns`) and imported four tenant
 * tables (for `companiesRelations`), each of which spreads `tenantColumns` from `_base`. Six modules
 * formed one import loop. Loading any tenant table cold suspended `_base` on its import of `company`,
 * `company` reached `organization`, and `organization` spread a `tenantColumns` that did not exist
 * yet: `ReferenceError: Cannot access 'tenantColumns' before initialization`.
 *
 * Whether a deployment hit that depended only on which module its bundle evaluated first. Production
 * saw it: the standing issuance route answered 500 on every call, and the machine delivery scan
 * answered 500 on one deployment and 401 on the next from identical source. Seven modules carried a
 * side-effect `import "@/db/schema"` to force a safe order. Those are gone because the loop is gone.
 *
 * ── THE SENTENCES THIS FILE DEFENDS ─────────────────────────────────────────
 *
 *   `_root-columns` IS A PRIMITIVE. It imports nothing local but `_enums`.
 *   `company` NEVER IMPORTS `_base`, AND NEVER IMPORTS A TENANT TABLE.
 *   NO IMPORT LOOP PASSES THROUGH `_base`, by any route, now or after the next table is added.
 *   A SCHEMA TABLE LOADS COLD. No module needs the barrel imported first to survive evaluation.
 *   THE RELOCATED RELATIONS STILL REACH THE ORM through the barrel, unchanged.
 *
 * Source is read with comments STRIPPED, so a sentence that quotes an import can neither satisfy
 * nor trip a rule. Every static rule is also proven to BITE, against synthetic sources, so no real
 * file is ever mutated to prove it.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createTableRelationsHelpers, extractTablesRelationalConfig } from "drizzle-orm";
/*
 * Imported statically for section 4 only. Warming the schema in THIS process cannot weaken section 3:
 * every cold-load there runs in its own fresh process, where nothing has been evaluated yet.
 */
import * as barrel from "../../src/db/schema";

const SCHEMA_DIR = path.join(process.cwd(), "src/db/schema");

/* ── the analysis, as pure functions so the bite-proofs can feed it synthetic sources ── */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Local (`./x`) import and re-export edges, keyed by module name without extension. */
function importGraph(sources: Record<string, string>): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  for (const [name, source] of Object.entries(sources)) {
    graph[name] = [
      ...stripComments(source).matchAll(/(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']\.\/([\w-]+)["']/g),
    ].map((match) => match[1]);
  }
  return graph;
}

/** Every module that can reach `target` AND be reached from it — i.e. `target`'s cycle, if any. */
function cycleThrough(graph: Record<string, string[]>, target: string): string[] {
  const reach = (from: string, edges: (n: string) => string[]): Set<string> => {
    const seen = new Set<string>();
    const stack = [...edges(from)];
    while (stack.length) {
      const next = stack.pop()!;
      if (seen.has(next) || !(next in graph)) continue;
      seen.add(next);
      stack.push(...edges(next));
    }
    return seen;
  };
  const reverse = (n: string) => Object.keys(graph).filter((m) => graph[m].includes(n));
  const downstream = reach(target, (n) => graph[n] ?? []);
  const upstream = reach(target, reverse);
  return [...downstream].filter((m) => upstream.has(m)).sort();
}

function readSchemaSources(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(SCHEMA_DIR)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => [file.replace(/\.ts$/, ""), readFileSync(path.join(SCHEMA_DIR, file), "utf8")]),
  );
}

/** A module is a "tenant table" when it spreads `tenantColumns`. Derived, never listed. */
function tenantTables(sources: Record<string, string>): Set<string> {
  return new Set(
    Object.entries(sources)
      .filter(([, source]) => /\.\.\.tenantColumns\b/.test(stripComments(source)))
      .map(([name]) => name),
  );
}

/* ── the rules ── */

function violations(sources: Record<string, string>): string[] {
  const graph = importGraph(sources);
  const tenants = tenantTables(sources);
  const found: string[] = [];

  const primitiveImports = (graph["_root-columns"] ?? []).filter((m) => m !== "_enums");
  if (primitiveImports.length) found.push(`_root-columns imports ${primitiveImports.join(", ")}`);

  const companyImports = graph.company ?? [];
  if (companyImports.includes("_base")) found.push("company imports _base");
  const companyTenantImports = companyImports.filter((m) => tenants.has(m));
  if (companyTenantImports.length) found.push(`company imports tenant tables ${companyTenantImports.join(", ")}`);

  const loop = cycleThrough(graph, "_base");
  if (loop.length) found.push(`import loop through _base: ${loop.join(", ")}`);

  return found;
}

/* ── 1 · the released schema satisfies every rule ── */

const released = readSchemaSources();
assert.deepEqual(violations(released), [], "the released schema must satisfy every dependency rule");
assert.ok("_root-columns" in released, "the root column primitive exists");
assert.ok("company-relations" in released, "the companies relations module exists");
assert.ok(tenantTables(released).size >= 40, "the tenant-table census is derived from real sources, not vacuous");

/* ── 2 · every rule BITES — proven on synthetic sources, never by editing a real file ── */

function bites(label: string, mutate: (s: Record<string, string>) => void, expect: RegExp): void {
  const copy = { ...released };
  mutate(copy);
  const found = violations(copy);
  assert.ok(found.some((v) => expect.test(v)), `bite-proof "${label}" must be caught, got: ${JSON.stringify(found)}`);
}

bites("company imports _base again",
  (s) => { s.company = `import { rootColumns } from "./_base";\n${s.company}`; },
  /company imports _base/);
bites("company imports a tenant table again",
  (s) => { s.company = `import { organizations } from "./organization";\n${s.company}`; },
  /company imports tenant tables organization/);
bites("the primitive grows a table import",
  (s) => { s["_root-columns"] = `import { companies } from "./company";\n${s["_root-columns"]}`; },
  /_root-columns imports company/);
bites("a NEW, indirect route back into _base (company -> fresh module -> _base)",
  (s) => {
    s.company = `import { thing } from "./zz-new-module";\n${s.company}`;
    s["zz-new-module"] = `import { tenantColumns } from "./_base";\nexport const thing = { ...tenantColumns };`;
  },
  /import loop through _base: .*company/);

/* The opposite direction: a QUOTED import must produce NO violation, or the guard trips on prose. */
{
  const copy = { ...released };
  copy.company = `/* import { rootColumns } from "./_base"; */\n// import { agents } from "./agent";\n${copy.company}`;
  assert.deepEqual(violations(copy), [], "an import quoted inside a comment must not count as an import");
}

/* ── 3 · a schema table LOADS COLD, in a fresh process, with no barrel imported first ── */

/*
 * These are the modules on the production failure path: `organization` is where the error was
 * thrown, and the other two are the tables the machine ingresses read. Each gets its own process,
 * because module evaluation happens once per process and a warm import proves nothing.
 */
for (const table of ["organization", "action-authorization", "standing-mutation-authorization", "company"]) {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", `await import(${JSON.stringify(`./src/db/schema/${table}.ts`)});`],
    { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" } },
  );
  assert.equal(
    result.status,
    0,
    `schema/${table}.ts must load cold on its own; stderr:\n${(result.stderr ?? "").split("\n").slice(0, 4).join("\n")}`,
  );
}

/* ── 4 · the relocated relations still reach the ORM, unchanged ── */

assert.ok("companiesRelations" in barrel, "the barrel still exports companiesRelations");
const { tables } = extractTablesRelationalConfig(barrel as Record<string, unknown>, createTableRelationsHelpers);
const companyRelations = Object.keys(tables.companies?.relations ?? {}).sort();
assert.deepEqual(
  companyRelations,
  ["agents", "departments", "organizations", "registries"],
  "drizzle resolves exactly the four companies relations it resolved before the move",
);

console.log("schema module cycle guard: dependency rules hold, all bite, tables load cold, relations resolve");
