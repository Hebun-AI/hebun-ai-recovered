/*
 * E2-3 — THE ENRICHED MAP STILL HOLDS NO AUTHORITY.
 *
 * L4's gate asked whether Live Map could acquire write, authorization or execution authority
 * through a TRANSITIVE dependency. E2-3 reopens that question by design: it reaches into the
 * subsystem that counts proposals, Governance decisions, permits and execution attempts — four
 * ladders whose every rung has a writer somewhere beside the reader.
 *
 * So the same walk runs again over the widened graph, and the answer must be the same one.
 *
 *     READ PROJECTION != WRITER        OBSERVATION != AUTHORIZATION
 *     LIVE MAP != GOVERNANCE AUTHORITY        LIVE MAP != EXECUTION AUTHORITY
 *
 * Structural assertions run over comment-stripped, string-stripped source: prose must neither
 * satisfy a ban nor trip one.
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const LIVE_MAP_DIR = "src/features/live-map";
const COMPONENT_DIR = "src/components/live-map";
const PROJECTION = `${LIVE_MAP_DIR}/read-live-map.server.ts`;
const CONTRACTS = `${LIVE_MAP_DIR}/contracts.ts`;
const PAGE = "src/app/(dashboard)/live-map/page.tsx";

const OUTCOME_DIR = "src/features/agent-outcome-observation";
const SEAM = `${OUTCOME_DIR}/live-map-agent-outcome.server.ts`;
const OUTCOME_PROJECTION = `${OUTCOME_DIR}/agent-outcome-projection.server.ts`;
const FACT_READER = `${OUTCOME_DIR}/read-agent-outcome-facts.server.ts`;

const JOURNAL = "src/db/migrations/meta/_journal.json";

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/** Source with comments and string literals removed. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/** VALUE edges only, and `export … from` counts — L4's walker, unchanged. */
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
    if (existsSync(path.join(ROOT, candidate)) && !candidate.endsWith("/")) {
      const stat = readdirSync(path.join(ROOT, path.dirname(candidate)), { withFileTypes: true }).find(
        (e) => e.name === path.basename(candidate) && e.isFile(),
      );
      if (stat) return candidate;
    }
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

const graph = (): Set<string> =>
  transitiveGraph([PROJECTION, PAGE, ...walk(COMPONENT_DIR)]);

/* ── 1 · THE WIDENED GRAPH REALLY REACHES THE EVIDENCE ────────────────────── */
function theWalkIsReal(): void {
  const g = graph();
  assert.ok(
    g.has(SEAM),
    "Live Map reaches the outcome authority's own Live Map seam — otherwise this proves nothing",
  );
  assert.ok(g.has(OUTCOME_PROJECTION), "and through it the released indexed read");
  assert.ok(g.has(FACT_READER), "and the released grouped fact readers");
  assert.ok(
    g.has("src/features/organization-authority/read-organization.server.ts"),
    "the L4 authorities are still in the graph",
  );
}

/* ── 2 · NOTHING THAT MUTATES IS REACHABLE, INCLUDING THE NEW LADDERS ─────── */
function noWriterEnteredTheClosure(): void {
  const g = graph();
  const behavioural = [...g].filter((f) => !f.startsWith("src/db/schema/"));

  /*
   * REACHABILITY BANS, extended for E2-3. The first two are L4's; the rest are the writers that sit
   * beside every reader this milestone now consumes. Reaching one is how a picture acquires the
   * ability to file, approve, permit or execute.
   */
  const forbidden: ReadonlyArray<readonly [string, string]> = [
    ["create-durable-agent-identity", "the agent identity writer"],
    ["retire-durable-agent-identity", "the agent retirement writer"],
    ["originate-action", "the agent origination writer"],
    ["decide-action-request", "the action authorization decider"],
    ["establish-governance-authority", "the Governance authority writer"],
    ["record-governance-decision", "a Governance decision writer"],
    ["issue-action-permit", "a permit writer"],
    ["revoke", "a revocation writer"],
    ["action-execution-live", "a live execution transport"],
    ["execute-action", "the execution writer"],
    ["heby-model", "the model boundary"],
    ["integration-credential", "credential storage"],
    ["provider-connectivity-control", "the provider kill switch"],
    ["knowledge-write-authority", "the Knowledge write authority"],
    ["agent-crud", "the agent mutation surface"],
  ];
  for (const [needle, what] of forbidden) {
    assert.deepEqual(
      behavioural.filter((f) => f.includes(needle)),
      [],
      `E2-3 must not put ${what} in Live Map's graph (${needle})`,
    );
  }

  /*
   * AND THE PROPERTY DIRECTLY, over the whole graph rather than over a list somebody remembered to
   * write. Outside the ambient session floor every authenticated page stands on, nothing reachable
   * from Live Map performs a durable write.
   */
  const AMBIENT_FLOOR = /^src\/(features\/auth-runtime\/|features\/auth\/|db\/client\.server\.ts)/;
  const writers = behavioural.filter((f) => !AMBIENT_FLOOR.test(f) && performsDurableWrite(read(f)));
  assert.deepEqual(
    writers,
    [],
    "outside the ambient session floor, nothing reachable from the enriched Live Map writes",
  );
}

/* ── 3 · THE E2-3 FILES THEMSELVES HOLD NOTHING THAT COULD WRITE ──────────── */
function theNewCodeHoldsNoHandle(): void {
  for (const file of [...walk(LIVE_MAP_DIR), ...walk(COMPONENT_DIR), PAGE, SEAM]) {
    const source = read(file);
    assert.ok(!performsDurableWrite(source), `${file}: performs no durable write`);
    const code = codeOf(source);
    for (const banned of [
      "getControlPlaneDb",
      "createControlPlaneDb",
      "db/schema",
      "db/client",
      "transaction(",
      "pgTable",
      "db.execute(",
    ]) {
      assert.ok(!code.includes(banned), `${file}: must not contain ${banned}`);
    }
    assert.ok(!/"use server"/.test(source), `${file}: declares no server action`);
  }
}

/* ── 4 · THE DEPENDENCY DIRECTION, AND ONLY THAT DIRECTION ────────────────── */
function theDirectionIsOneWay(): void {
  const projection = read(PROJECTION);

  /* Live Map consumes the seam by FILE. There is no barrel here, and there must not become one. */
  assert.match(
    projection,
    /from "@\/features\/agent-outcome-observation\/live-map-agent-outcome\.server"/,
    "the evidence is taken from the outcome authority's own Live Map seam, named explicitly",
  );
  assert.ok(
    !/from\s+["']@\/features\/agent-outcome-observation["']/.test(projection),
    "never through a barrel — a barrel is how a writer arrives unasked",
  );

  /* Live Map restates no join and reaches no domain table of its own. */
  const code = codeOf(projection);
  for (const banned of [
    "heby_action_requests",
    "action_permits",
    "action_execution_attempts",
    "heby_origination_invocations",
    "readAgentProposalFacts",
    "readAgentPermitFacts",
    "readAgentExecutionFacts",
    "composeAgentOutcomes",
  ]) {
    assert.ok(!code.includes(banned), `Live Map must not reimplement the outcome read: ${banned}`);
  }

  /* And it does not consume the /agents page or its presentation model. */
  assert.ok(!code.includes("components/agents"), "no presentation model is consumed");
  assert.ok(!code.includes("(dashboard)/agents"), "and no page is consumed");

  /*
   * NO BACK-IMPORT. The outcome authority must not depend on Live Map: a domain authority that
   * imports a surface's contracts has taken a presentation concern into its own ownership.
   */
  for (const file of walk(OUTCOME_DIR)) {
    assert.ok(
      !read(file).includes("features/live-map"),
      `${file}: the outcome authority never imports Live Map's contracts`,
    );
  }

  /* The seam itself issues no statement — it reshapes one released answer. */
  const seam = codeOf(read(SEAM));
  assert.ok(!seam.includes("sql`"), "the seam writes no SQL of its own");
  assert.ok(
    seam.includes("readAgentOutcomeObservationIndexed"),
    "it composes the released indexed read",
  );
}

/* ── 5 · THE TENANT, AND THE PREDICATE THAT ENFORCES IT ───────────────────── */
function tenantIsolationSurvives(): void {
  /* No caller can name another organization, at either seam. */
  for (const [file, fn] of [
    [PROJECTION, "export async function readLiveMapProjection"],
    [SEAM, "export async function readLiveMapAgentOutcome"],
  ] as const) {
    const source = read(file);
    const start = source.indexOf(fn);
    assert.ok(start > 0, `${fn} is exported`);
    const signature = source.slice(start, source.indexOf("{", source.indexOf(")", start)));
    assert.match(signature, /tenant:\s*TenantContext\s*\|\s*null/, `${fn} takes the trusted context`);
    for (const name of ["organizationId", "tenantId", "slug", "filter", "scope", "agentId"]) {
      assert.ok(!new RegExp(`${name}\\s*[?:]`).test(signature), `${fn}: no ${name} parameter`);
    }
  }

  /* Live Map owns no second tenant filter: the subsystem beneath it already owns one. */
  const projection = codeOf(read(PROJECTION));
  for (const banned of ["tenantId", "eq(", "where("]) {
    assert.ok(!projection.includes(banned), `Live Map holds no filter of its own: ${banned}`);
  }

  /*
   * ── THE PREDICATE CONTENT, NOT THE VARIABLE SHAPE (the E2-2 lesson) ────────
   *
   * "A variable called `tenantScope` exists" proves nothing: it could hold anything, or nothing.
   * These assert the actual SQL text — the tenant-scoped COLUMN, bound to the value the guard
   * resolved — on each table the enriched map now depends on.
   */
  const reader = read(FACT_READER);
  for (const table of [
    "heby_action_requests",
    "action_permits",
    "action_execution_attempts",
    "heby_origination_invocations",
  ]) {
    assert.ok(
      reader.includes(`"${table}"."tenant_id" = \${resolved.tenantId}`),
      `${table} is filtered on its own tenant_id column, bound to the resolved tenant`,
    );
  }

  /* The bound value comes from the guard, never re-read from the caller's argument. */
  assert.ok(
    !/\$\{[^}]*tenant\.tenantId[^}]*\}/.test(reader),
    "the tenant is bound from the guard's resolved value",
  );
  /*
   * PINNED EXACTLY, not "at least". A floor cannot tell a removed predicate from a statement that
   * never had one: thirteen bindings is what the released reader carries, and a twelfth or a
   * fourteenth is a change to how this data is scoped, which is exactly what must fail here.
   */
  const bindings = reader.match(/\$\{resolved\.tenantId\}/g) ?? [];
  assert.equal(
    bindings.length,
    13,
    `every statement binds the resolved tenant on every table it touches (found ${bindings.length})`,
  );

  /* The page still resolves its tenant server-side and passes no identifier. */
  const page = read(PAGE);
  assert.match(page, /readLiveMapProjection\(await resolveTenantContext\(\)\)/);
  assert.ok(!/searchParams/.test(page), "no query parameter reaches the projection");
}

/* ── 6 · TWO TRUTH CLASSES, EACH CLOSED AT ONE VALUE ──────────────────────── */
function theTruthClassesStayDisjoint(): void {
  const contracts = read(CONTRACTS);

  const unionOf = (name: string): string => {
    const at = contracts.indexOf(`export type ${name}`);
    assert.ok(at > 0, `${name} is declared`);
    return contracts.slice(at, contracts.indexOf(";", at));
  };

  const truth = unionOf("LiveMapTruth");
  assert.match(truth, /=\s*"authoritative"\s*$/, "LiveMapTruth admits exactly one value");
  for (const banned of ["derived", "seeded", "mock", "inferred", "simulated", "observed"]) {
    assert.ok(!truth.includes(banned), `LiveMapTruth must not admit "${banned}"`);
  }

  const derived = unionOf("LiveMapDerivedClass");
  assert.match(derived, /=\s*"derived"\s*$/, "a derived attachment admits exactly one value too");
  assert.ok(
    !derived.includes("authoritative"),
    "and it can never call itself authoritative — that is the whole separation",
  );

  /* The attachment lives in its own field, never merged into the node's own provenance lines. */
  assert.match(
    contracts,
    /readonly intelligence\?: LiveMapNodeIntelligence;/,
    "derived evidence is a separate, optional, typed field on the node",
  );
  assert.ok(
    !/readonly detail: readonly string\[\] \| LiveMapNodeIntelligence/.test(contracts),
    "it is never folded into `detail`",
  );
}

/* ── 7 · NO FICTION, NO MOCK, NO SEEDED ORGANIZATION ──────────────────────── */
function fictionStillCannotEnter(): void {
  const g = graph();
  const mocks = [...g].filter((f) => /\/mock(\.|\/)|\/mock$|fixtures?\//.test(f));
  assert.deepEqual(mocks, [], "no compiled-in fixture is reachable from the enriched Live Map");

  for (const file of [...walk(LIVE_MAP_DIR), ...walk(COMPONENT_DIR), SEAM]) {
    const code = codeOf(read(file));
    for (const banned of ["agents/mock", "mockOrganization", "seedDepartments", "inferDepartment"]) {
      assert.ok(!code.includes(banned), `${file}: no seeded organizational fiction (${banned})`);
    }
  }
}

/* ── 8 · THE SURFACE DISCLOSES. IT STILL CANNOT ACT ───────────────────────── */
function theSurfaceStillCannotAct(): void {
  for (const file of walk(COMPONENT_DIR)) {
    const code = codeOf(read(file));
    for (const banned of [
      "onClick",
      "onSubmit",
      "onChange",
      "<form",
      "<button",
      "useState",
      "action=",
      "fetch(",
    ]) {
      assert.ok(!code.includes(banned), `${file}: the map discloses, it does not act — "${banned}"`);
    }
    /* A disclosure element is not a control: it reveals text that was already in the projection. */
    assert.ok(!code.includes("formAction"), `${file}: no form action`);
  }
}

/* ── 9 · NO SCHEMA, NO MIGRATION, NO PERSISTENCE ──────────────────────────── */
function nothingWasPersisted(): void {
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly unknown[] };
  assert.equal(journal.entries.length, 39, "the migration ledger is unchanged at 39");

  const sqlFiles = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sqlFiles.length, 39, "and no migration file was added");

  for (const file of [...walk(LIVE_MAP_DIR), ...walk(COMPONENT_DIR), SEAM]) {
    const code = codeOf(read(file));
    for (const banned of ["pgTable", "pgEnum", "drizzle-orm/pg-core", "localStorage", "cache("]) {
      assert.ok(!code.includes(banned), `${file}: E2-3 persists nothing (${banned})`);
    }
  }
}

function main(): void {
  theWalkIsReal();
  noWriterEnteredTheClosure();
  theNewCodeHoldsNoHandle();
  theDirectionIsOneWay();
  tenantIsolationSurvives();
  theTruthClassesStayDisjoint();
  fictionStillCannotEnter();
  theSurfaceStillCannotAct();
  nothingWasPersisted();
  console.log("e23 live map intelligence — firewall checks passed");
}

main();
