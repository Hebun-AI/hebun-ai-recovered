/*
 * E2-1 — THE GROUNDING FIREWALL.
 *
 * What this proves: E2-1 added READ CONSUMPTION and no authority. The projection Heby now imports
 * cannot write, cannot authorize, cannot execute, cannot reach a provider, and cannot become a
 * second answer to "what organization exists?".
 *
 * And two claims that are specific to THIS milestone, because they are the ones a future phase is
 * most likely to erode without noticing:
 *
 *   HEBY -/-> LIVE MAP. Live Map is a presentation projection over the same authority. Depending on
 *   it would make Heby's evidence a function of a rendering, and would let a future Live Map
 *   Intelligence domain (E2-3) enter model context through an edit made somewhere else entirely.
 *
 *   E2-1 ADMITS NO AGENT. Live Map projects a durable agent beside the organization. This class
 *   does not, and must not start to merely because the map already does.
 *
 * ── WHY THE MOCK RULE IS NARROW, AND DELIBERATELY SO ────────────────────────
 *
 * Heby's whole transitive closure ALREADY reaches `agents/mock`, `hr/mock` and the seeded
 * organization projection builder, through the Executive Overview adapter. That is L1's
 * architecture, not a defect: the compiled-in fiction is contained by the mock-surface GATE at
 * runtime, and the graph edge is expected. A repository-wide "Heby reaches no mock" rule would
 * therefore be false today and would fail for reasons that have nothing to do with E2-1.
 *
 * So the rule here is scoped to what E2-1 actually built: the NEW projection's own closure carries
 * no mock, no seeded organization source and no structural inference.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const AUTHORITY_DIR = "src/features/organization-authority";
const PROJECTION = `${AUTHORITY_DIR}/heby-organization-source.server.ts`;
const HEBY_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const HEBY_FEATURE_ROOT = "src/features";

/** Source with comments and string literals removed — prose must neither satisfy nor trip a ban. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/**
 * VALUE edges only, and RE-EXPORTS COUNT.
 *
 * Both traps are already paid for in this repository. `import type` is erased and reaches nothing
 * at runtime, so counting it over-reports. `export … from` IS an edge, and a walker that misses it
 * is blind to a barrel — which is precisely the shape a firewall exists to catch, since
 * `@/features/agent-identity` re-exports two lifecycle writers.
 */
function valueEdges(file: string): string[] {
  const source = read(file);
  const specifiers: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}

function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

function transitiveGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of valueEdges(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/* ── 0 · THE WALKER IS NON-VACUOUS ────────────────────────────────────────── */
function walkerIsNonVacuous(): void {
  /*
   * A graph that resolved nothing would make every ban below pass for free. This proves the walker
   * followed real edges AND followed a `export … from` re-export, which is the edge kind that has
   * silently defeated a firewall in this repository before.
   */
  const graph = transitiveGraph([PROJECTION]);
  assert.ok(graph.size > 5, "the walker resolved the projection's imports");
  assert.ok(
    graph.has(`${AUTHORITY_DIR}/read-organization.server.ts`),
    "the walk reaches the Organization Authority's read seam, so it is a real graph",
  );

  const barrel = transitiveGraph(["src/features/agent-identity/index.ts"]);
  assert.ok(
    barrel.has("src/features/agent-identity/create-durable-agent-identity.server.ts"),
    "the walker follows `export … from`, or every barrel-shaped ban below would be vacuous",
  );
}

/* ── 1 · (H) THE PROJECTION CANNOT WRITE AND HOLDS NO HANDLE ──────────────── */
function theProjectionCannotWrite(): void {
  const source = read(PROJECTION);
  assert.ok(!performsDurableWrite(source), "the organization projection performs no durable write");

  const code = codeOf(source);
  for (const banned of [
    "getControlPlaneDb",
    "createControlPlaneDb",
    "db/schema",
    "db/client",
    "transaction(",
    "insert(",
    "update(",
    "delete(",
    "fetch(",
    "use server",
  ]) {
    assert.ok(!code.includes(banned), `the organization projection must not contain ${banned}`);
  }

  /*
   * IT READS ONE THING. The whole point of living inside the authority is that it re-shapes the
   * authority's answer rather than re-deriving it, so a second read of anything is a defect.
   */
  const specifiers = valueEdges(PROJECTION);
  assert.deepEqual(
    specifiers.sort(),
    ["./read-organization.server"],
    "the projection's only VALUE import is the authority's read seam — everything else is a type",
  );
}

/* ── 2 · NOTHING THAT MUTATES IS REACHABLE ───────────────────────────────── */
function noAuthorityIsReachable(): void {
  const graph = transitiveGraph([PROJECTION]);

  /*
   * SCHEMA MODULES ARE EXCLUDED, AND THAT IS NOT A LOOPHOLE.
   *
   * `db/client.server.ts` imports the schema BARREL to type the drizzle handle, so every table
   * definition in the repository is reachable from every read authority — `db/schema/department.ts`
   * and `db/schema/permission.ts` included. A needle matching those would report that E2-1 reaches
   * the department table, which is false: a table definition declares columns and holds no
   * behaviour, and L3 already measured that both have zero writers and zero readers.
   *
   *     DEAD TABLE != AVAILABLE DATA        SCHEMA != AUTHORITY
   *
   * The needles below name AUTHORITY modules under `src/features/`, and the behavioural sweep after
   * them covers what a name never could.
   */
  const behavioural = [...graph].filter((f) => !f.startsWith("src/db/schema/"));

  const forbidden: ReadonlyArray<readonly [string, string]> = [
    ["create-durable-agent-identity", "the agent identity writer"],
    ["retire-durable-agent-identity", "the agent retirement writer"],
    ["membership-authority", "a membership writer"],
    ["establish-governance-authority", "the Governance authority writer"],
    ["record-governance-decision", "a Governance decision writer"],
    ["decide-action-request", "the action authorization decider"],
    ["action-permit", "a permit writer"],
    ["action-execution", "an execution writer"],
    ["originate-action", "the agent origination writer"],
    ["integration-credential", "credential storage"],
    ["integration-repository", "the integration lifecycle writer"],
    ["provider-connectivity-control", "the provider kill switch"],
    ["knowledge-write-authority", "the Knowledge write authority"],
    ["knowledge-crud", "a Knowledge mutation"],
    ["heby-model", "the model boundary"],
    ["provider-google", "a live provider transport"],
    ["provider-github", "a live provider transport"],
    /* E2-1's own two: a presentation projection, and a product line this class does not admit. */
    ["features/live-map", "the Live Map presentation projection"],
    ["features/agent-identity", "durable agent identity"],
    /* And the seeded organization world L1 contained. */
    ["/mock", "a compiled-in fixture"],
    ["runtime-projection", "the seeded organization projection builder"],
    ["director-dashboard", "the mock-gated Executive Overview adapter"],
  ];

  for (const [needle, what] of forbidden) {
    assert.deepEqual(
      behavioural.filter((f) => f.includes(needle)),
      [],
      `the organization projection must not reach ${what} (${needle})`,
    );
  }

  /*
   * ── THE BEHAVIOURAL SWEEP: NO NEEDLE REQUIRED ───────────────────────────────
   *
   * A name list only catches modules somebody thought to name. This asserts the property directly
   * over the whole reachable graph: outside the schema definitions and the ambient floor every
   * server read stands on, nothing E2-1 can reach performs a durable write.
   *
   * The floor is enumerated rather than waved away, so a NEW sensitive edge fails here instead of
   * arriving silently under a blanket exemption.
   */
  const AMBIENT_FLOOR = /^src\/(features\/auth-runtime\/|features\/auth\/|db\/client\.server\.ts)/;
  const writers = behavioural.filter((f) => !AMBIENT_FLOOR.test(f) && performsDurableWrite(read(f)));
  assert.deepEqual(
    writers,
    [],
    "outside the ambient floor, nothing reachable from the organization projection performs a durable write",
  );
}

/* ── 3 · (F)(L) HEBY DOES NOT DEPEND ON LIVE MAP ──────────────────────────── */
function hebyHasNoLiveMapDependency(): void {
  const hebyFiles = walk(HEBY_FEATURE_ROOT).filter((f) =>
    f.startsWith("src/features/heby-"),
  );
  assert.ok(hebyFiles.length > 50, "Heby exists, so this claim is about a real subsystem");

  /* Direct: no Heby module names the Live Map feature or its contracts. */
  for (const file of hebyFiles) {
    for (const banned of ["features/live-map", "LiveMapProjection", "LiveMapDomain", "LiveMapNode"]) {
      assert.ok(
        !codeOf(read(file)).includes(banned),
        `${file}: Heby must not depend on Live Map (${banned})`,
      );
    }
  }

  /*
   * TRANSITIVE, which is the half that matters for E2-3.
   *
   * When Live Map Intelligence adds a domain, `LiveMapProjection.domains` grows by one line. If
   * Heby were downstream of that array — directly or through any intermediary — the new domain
   * would enter model context with no edit to Heby, no review of its trust class, and no admission
   * decision. This asserts the property that makes such an entry impossible rather than unlikely.
   *
   *     FUTURE LIVE MAP LAYER != AUTOMATIC HEBY EVIDENCE
   */
  const graph = transitiveGraph([HEBY_ANSWER]);
  assert.ok(graph.size > 100, "the Heby answer flow's graph resolved");
  assert.deepEqual(
    [...graph].filter((f) => /^src\/(features|components|app)\/.*live-?map/i.test(f)),
    [],
    "no Live Map module is reachable from the Heby answer flow, at any depth",
  );

  /*
   * AND THE ADMISSION ROUTE IS THE ONLY ROUTE. A new Heby source class requires three deliberate
   * edits — the closed vocabulary, the pure resolver's exhaustive switch, and a workspace
   * declaration. Asserted here so the previous claim is understood as a boundary rather than a
   * coincidence of today's imports.
   */
  const resolver = read("src/features/heby-runtime/source-resolver.ts");
  assert.match(resolver, /const never:\s*never = sourceClass/, "the resolver is exhaustive by type");
  assert.ok(
    resolver.includes('case "organization":'),
    "the organization class was admitted through the exhaustive switch, not around it",
  );
}

/* ── 4 · (C) E2-1 ADMITS NO AGENT ─────────────────────────────────────────── */
function e21AdmitsNoAgent(): void {
  /*
   * SCHEMA EXCLUDED, for the reason section 2 states at length: `db/schema/agent.ts` is reachable
   * from EVERY read authority through the barrel that types the drizzle handle. Matching it here
   * would report that E2-1 reaches durable agent identity, which is false — a table definition
   * holds no behaviour. The first run of this suite made exactly that mistake, which is the same
   * false positive SEC-4 and L4 each paid for.
   */
  const graph = [...transitiveGraph([PROJECTION])].filter((f) => !f.startsWith("src/db/schema/"));
  assert.deepEqual(
    graph.filter((f) => f.includes("agent")),
    [],
    "no agent module is reachable from the organization projection",
  );

  /*
   * AND THE CLASS CANNOT CARRY ONE EITHER. `AuthoritativeOrganization` has no agent field, so an
   * agent fact has nothing to travel in — the guarantee is the shape of the authority's answer, not
   * a filter in this projection that somebody could relax.
   */
  /*
   * MEASURED AGAINST THE DECLARED FIELDS, NOT THE FILE.
   *
   * `codeOf` strips comments first, and it has to: the contract's own doc comment for
   * `humanMemberCount` says "A COUNT, never a roster", so a raw scan fails on the sentence that
   * makes the guarantee. That is the third time in this milestone that a ban tripped on the
   * product's own honest denial — the same failure mode INT-3 recorded, and worth stating here
   * because the pattern is what a future author will hit, not this specific word.
   */
  const contracts = codeOf(read(`${AUTHORITY_DIR}/contracts.ts`));
  const start = contracts.indexOf("export interface AuthoritativeOrganization");
  assert.ok(start > 0, "the organization contract is exported");
  const shape = contracts.slice(start, contracts.indexOf("}", start));
  assert.match(shape, /humanMemberCount/, "the shape slice actually contains the contract's fields");
  for (const field of ["agent", "department", "team", "member:", "roster", "role", "permission"]) {
    assert.ok(
      !shape.toLowerCase().includes(field),
      `AuthoritativeOrganization carries no ${field} field, so E2-1 cannot report one`,
    );
  }
}

/* ── 5 · (H) HEBY GAINED NO ORGANIZATION WRITER, AND NO SECOND READER ─────── */
function hebyGainedNoAuthority(): void {
  const hebyFiles = walk(HEBY_FEATURE_ROOT).filter((f) => f.startsWith("src/features/heby-"));
  for (const file of hebyFiles) {
    const code = codeOf(read(file));
    for (const table of ["companies", "organizations", "departments", "memberships"]) {
      assert.ok(
        !new RegExp(`(insert|update|delete)\\(${table}\\)`).test(code),
        `${file}: Heby must never write ${table}`,
      );
      assert.ok(
        !new RegExp(`from\\(${table}\\)`).test(code),
        `${file}: Heby must never read ${table} directly — organization truth comes through L3`,
      );
    }
  }

  /*
   * AND THE ANSWER FLOW REACHES THE AUTHORITY THROUGH EXACTLY ONE DOOR. If a second module in the
   * authority directory ever becomes importable by Heby, the boundary this milestone drew stops
   * being one door and nobody would notice from here.
   */
  const imports = [
    ...read(HEBY_ANSWER).matchAll(/from\s+["']@\/features\/organization-authority\/([^"']+)["']/g),
  ].map((match) => match[1]);
  /*
   * TWO PROJECTIONS NOW, AND STILL NO SEAM. E2-1's guarantee was never "exactly one import" — it is
   * that Heby reaches PROJECTIONS and never a writer, a read seam or a table. Departmental Placement
   * adds the second projection, so the list grows by exactly one and stays exact.
   */
  assert.deepEqual(
    imports.sort(),
    ["heby-organization-source.server", "heby-placement-source.server"].sort(),
    "the Heby answer flow imports the authority's PROJECTIONS and nothing else from it",
  );
  for (const forbidden of ["write-structure", "write-placement", "read-structure", "read-placement"]) {
    assert.ok(
      !imports.some((imported) => imported!.includes(forbidden)),
      `and never the authority's ${forbidden} seam`,
    );
  }
}

function main(): void {
  walkerIsNonVacuous();
  theProjectionCannotWrite();
  noAuthorityIsReachable();
  hebyHasNoLiveMapDependency();
  e21AdmitsNoAgent();
  hebyGainedNoAuthority();

  console.log("e21-organization-grounding/grounding-firewall: E2-1 authority gate passed");
}

main();
