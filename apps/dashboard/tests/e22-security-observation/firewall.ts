/*
 * E2-2 / S-B — THE SECURITY OBSERVATION CONNECTION GATE.
 *
 * What this proves: E2-2 added READ CONSUMPTION and no authority. The Security Center gained one
 * connected source class and gained nothing else — no writer, no database handle, no tenant
 * predicate of its own, no finding, no incident, no policy, no trust state and no score.
 *
 * SEC-4 already guards the Security Center's own closure. This guards the two things SEC-4 cannot
 * see, because they are properties of the NEW seam and of the CONNECTION rather than of that
 * directory:
 *
 *   1. the projection itself — it must read one thing and mutate nothing;
 *   2. the claim `audit is connected` — which is only true while the route actually consumes the
 *      seam. A source map is a frozen record and will happily assert a connection that no code
 *      makes, so the two halves are asserted TOGETHER. Either alone is a lie waiting.
 *
 *     SOURCE EXISTS   != SECURITY CENTER CONNECTED
 *     CONNECTED       != AUTHORITATIVE
 *     READ CONNECTION != WRITE AUTHORITY
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const PROJECTION = "src/features/governance-activity/security-observation-source.server.ts";
const ROUTE = "src/app/(dashboard)/director/governance/security/page.tsx";
const FEATURE_DIR = "src/features/security-center";
const COMPONENT_DIR = "src/components/security-center";

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/**
 * VALUE edges only, and re-exports count.
 *
 * Both traps are paid for in this repository already: `import type` is erased and manufactures
 * false edges when counted, and `export … from` IS an edge that a walker following only `import`
 * is blind to. The edge definition mirrors SEC-4's deliberately — a second, weaker definition
 * would let this gate and that one disagree about the same graph.
 *
 * ── ONE THING IS STRICTER HERE, AND IT WAS FOUND THE HARD WAY ────────────────
 *
 * It scans `codeOf(source)`, not the raw text. The first run of this suite reported that the
 * projection imports `tenant-context` as a VALUE, which is false — the file imports it as a type.
 * The edge came from a SENTENCE in the header: "a Security-owned projection would have had to
 * import this module". `import` + whitespace, no `type` keyword, and the non-greedy scan then ran
 * forward to the next `from "…"` it could find. A comment manufactured an edge and, worse,
 * consumed a real declaration on its way past.
 *
 * That is the same trap G2, R4A, the ceremony phases and E2-1 each recorded, and the fix is always
 * the same: repair the walker, never the prose. A repository that explains itself in English will
 * trip every guard that reads English as code.
 */
function valueEdges(file: string): string[] {
  const source = codeOf(read(file));
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
    if (existsSync(path.join(ROOT, candidate)) && !existsSync(path.join(ROOT, candidate, "."))) {
      return candidate;
    }
  }
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
    if (existsSync(path.join(ROOT, candidate))) return candidate;
  }
  return null;
}

function transitiveGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file) || !existsSync(path.join(ROOT, file))) continue;
    seen.add(file);
    for (const specifier of valueEdges(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/* ── 1 · THE PROJECTION READS ONE THING AND MUTATES NOTHING ───────────────── */
function theProjectionIsAReader(): void {
  assert.ok(existsSync(path.join(ROOT, PROJECTION)), "the E2-2 projection exists");
  const source = read(PROJECTION);

  assert.ok(!performsDurableWrite(source), "the security observation projection performs no durable write");

  const code = codeOf(source);
  for (const banned of [
    "getControlPlaneDb",
    "createControlPlaneDb",
    "db/schema",
    "db/client",
    "drizzle-orm",
    "auditLog",
    "transaction(",
    "insert(",
    "update(",
    "delete(",
    "fetch(",
    "use server",
  ]) {
    assert.ok(!code.includes(banned), `the projection must not contain ${banned}`);
  }

  /*
   * IT READS ONE THING. The whole point of living beside the readers is that it re-shapes their
   * answer rather than re-deriving it, so a second read of anything is a defect — and a query of
   * its own would be a Security-owned tenant predicate under a different roof.
   */
  assert.deepEqual(
    valueEdges(PROJECTION).sort(),
    ["./contracts", "./observe.server"],
    "the projection's only VALUE imports are the ledger boundary and the released seam",
  );
}

/* ── 2 · NOTHING THAT MUTATES IS REACHABLE FROM THE PROJECTION ────────────── */
function noAuthorityIsReachable(): void {
  const graph = transitiveGraph([PROJECTION]);
  assert.ok(graph.size > 3, "the walker resolved the projection's imports");

  /*
   * SCHEMA MODULES ARE EXCLUDED, for the reason SEC-4 states at length: `db/schema` is reachable
   * from every read authority through the barrel that types the drizzle handle, and a table
   * definition holds no behaviour. Matching it here would report a write that does not exist.
   */
  const behavioural = [...graph].filter((f) => !f.startsWith("src/db/schema/"));
  const writers = behavioural.filter((f) => performsDurableWrite(read(f)));
  assert.deepEqual(writers, [], "nothing reachable from the security observation projection writes");

  /*
   * AND NO AUDIT WRITER, BY NAME. The nine writers live in `governance-audit`, one directory away
   * from the readers, and `readKnowledgeMutationHistory` — a third audit reader — is co-located
   * with one of them. Importing that reader would have been the easy way to add a Knowledge slice
   * and would have dragged a writer in with it.
   */
  for (const forbidden of ["governance-audit", "governance-decision", "governance-genesis", "action-execution"]) {
    assert.deepEqual(
      behavioural.filter((f) => f.includes(forbidden)),
      [],
      `the projection must not reach ${forbidden}`,
    );
  }
}

/* ── 3 · (M) CONNECTED IS CLAIMED ONLY WHERE THE ROUTE ACTUALLY READS ─────── */
async function connectedMeansConsumed(): Promise<void> {
  const { listSecuritySources, getSecuritySource, hasConnectedSecurityFeed, listSecurityDomains } =
    await import("../../src/features/security-center");

  /* Half one — the claim. */
  assert.equal(getSecuritySource("audit").state, "connected");
  assert.equal(hasConnectedSecurityFeed(), true, "E2-2 connected one source class");
  assert.deepEqual(
    listSecuritySources().filter((s) => s.state === "connected").map((s) => s.sourceClass),
    ["audit"],
    "exactly one source class is connected",
  );

  /*
   * Half two — the code that makes it true. A frozen record will assert any connection an author
   * types, so the claim is worthless without this: the route must import the projection AND call
   * it, and it must reach the tenant from the server session rather than from a parameter.
   */
  const route = codeOf(read(ROUTE));
  assert.ok(
    route.includes("readSecurityRecordedActObservation"),
    "the route imports the approved projection",
  );
  assert.match(
    route,
    /await\s+readSecurityRecordedActObservation\s*\(/,
    "the route CALLS the projection — an import alone connects nothing",
  );
  assert.match(route, /await\s+resolveTenantContext\s*\(\s*\)/, "the tenant comes from the server session");
  assert.match(
    route,
    /getSecurityCenterModel\s*\([\s\S]{0,80}?recordedActs\s*\)/,
    "the observation reaches the model",
  );
  assert.equal(
    route.includes('getSecurityCenterModel("")'),
    false,
    "the inert empty-string placeholder is retired now that a real context exists",
  );

  /* And the one domain bound to that source moved with it — and only that one. */
  const connectedDomains = listSecurityDomains().filter((d) => d.state === "connected");
  assert.deepEqual(
    connectedDomains.map((d) => d.domain),
    ["data-access"],
    "exactly the domain bound to the audit source class moved",
  );
  assert.equal(connectedDomains[0]!.sourceClass, "audit");
}

/* ── 4 · (J)(K)(L) NO AUTHORITY GREW HERE ─────────────────────────────────── */
async function noNewAuthorityGrewHere(): Promise<void> {
  const entryPoints = [...walk(FEATURE_DIR), ...walk(COMPONENT_DIR), ROUTE, PROJECTION];
  assert.ok(entryPoints.length >= 25, `every surface file is covered (${entryPoints.length})`);

  for (const file of entryPoints) {
    const code = codeOf(read(file));
    for (const banned of [
      "securityFindings",
      "securityIncidents",
      "securityPolicies",
      "securityEvents",
      "securityScores",
      "trustScores",
      "riskScore",
      "securityScore",
      "threatScore",
    ]) {
      assert.ok(!code.includes(banned), `${file}: no security ${banned} store or score may appear`);
    }
  }

  /* And the vocabularies that have no authority still produce no instance. */
  const { getSecurityCenterModel, isBreachConfirmable } = await import("../../src/features/security-center");
  const model = getSecurityCenterModel("11111111-1111-4111-8111-111111111111");
  assert.deepEqual(model.findings, [], "E2-2 created no finding");
  assert.deepEqual(model.incidents, [], "E2-2 created no incident");
  assert.deepEqual(model.signals, [], "E2-2 created no signal");
  assert.deepEqual(model.timeline, []);
  assert.equal(isBreachConfirmable(), false, "no breach is confirmable");
}

/* ── 5 · (Q)(T) EVERY OTHER SOURCE AND DOMAIN STAYS WHERE IT WAS ──────────── */
async function everythingElseIsUnchanged(): Promise<void> {
  const { listSecuritySources, getSecuritySource, listSecurityDomains } = await import(
    "../../src/features/security-center"
  );

  /*
   * The argument that would connect all of them — "a real seam exists elsewhere" — is true for
   * authentication, authorization, runtime, integration and provider, and connects none of them.
   */
  const RELEASED: ReadonlyArray<readonly [string, string]> = [
    ["authentication", "derived"],
    ["authorization", "derived"],
    ["device", "derived"],
    ["runtime", "derived"],
    ["integration", "derived"],
    ["provider", "derived"],
    ["policy", "not-connected"],
    ["network", "not-connected"],
    ["incident-feed", "not-connected"],
  ];
  for (const [sourceClass, state] of RELEASED) {
    assert.equal(
      getSecuritySource(sourceClass as never).state,
      state,
      `${sourceClass} keeps its released state`,
    );
  }
  assert.equal(listSecuritySources().length, 10, "no source class was added or removed");

  /* Every source still states both halves — what it can and cannot prove. */
  for (const source of listSecuritySources()) {
    assert.ok(source.canProve.length > 0 && source.cannotProve.length > 0);
    if (source.state === "not-connected") assert.match(source.canProve, /nothing/i);
  }

  /* The connected source is the one that must be most careful about what it cannot prove. */
  const audit = getSecuritySource("audit");
  for (const denied of ["security event", "finding", "incident", "threat", "breach"]) {
    assert.ok(
      audit.cannotProve.toLowerCase().includes(denied),
      `the audit source states it cannot prove a ${denied}`,
    );
  }

  const domains = listSecurityDomains();
  assert.equal(domains.length, 8, "no domain was added or removed");
  assert.equal(domains.find((d) => d.domain === "policy-governance")!.state, "not-connected");
}

/* ── 6 · (E) THE INHERITED TENANT PREDICATE IS REAL, NOT MERELY PRESENT ───────
 *
 * E2-2 owns no query, so its tenant isolation is entirely inherited from the released reader. That
 * makes the inherited property part of THIS milestone's security claim, and it must be asserted
 * rather than assumed — which is how the following was found.
 *
 * R7.1.1's firewall pins the predicate's SHAPE: one `const tenantScope = `, two
 * `.where(tenantScope)`, and a uuid refusal before any statement. Every one of those still passes
 * when the expression is gutted to `const tenantScope = undefined;` — the counts hold, the two
 * statements still take it, and drizzle would then select every tenant's rows. An E2-2 bite-proof
 * found it by trying exactly that and watching the mutation survive.
 *
 * The shape assertions are correct and stay where they are. This adds the half nobody had written
 * down: the expression must actually name the tenant column. A count proves an expression EXISTS;
 * only reading it proves it SCOPES anything.
 *
 *     PREDICATE PRESENT != PREDICATE SCOPING
 */
function theInheritedTenantPredicateIsReal(): void {
  const reader = codeOf(read("src/features/governance-activity/act-history-read.server.ts"));

  assert.match(
    reader,
    /const\s+tenantScope\s*=\s*and\(\s*eq\(\s*auditLog\.tenantId\s*,\s*tenantId\s*\)\s*\)/,
    "the tenant expression compares the tenant column to the caller's tenant — not merely present",
  );
  /* Both statements take it, so gutting the one expression breaks both at once. */
  assert.equal(
    (reader.match(/\.where\(tenantScope\)/g) ?? []).length,
    2,
    "both statements take the one expression",
  );
  /* And a malformed id can never reach a column, so a caller cannot probe with one. */
  assert.match(reader, /if \(!UUID_RE\.test\(tenantId\)\) return null;/, "a malformed tenant id is refused first");

  /*
   * The entry point E2-2 actually calls takes the authorized CONTEXT, so there is no tenant id
   * parameter for a route, a query string or a component to supply.
   *
   *     TENANT CONTEXT != CLIENT TENANT PARAMETER
   */
  const observe = codeOf(read("src/features/governance-activity/observe.server.ts"));
  assert.match(
    observe,
    /export async function observeRecordedActHistory\(\s*tenant: Pick<TenantContext, "tenantId"> \| null,/,
    "the seam takes the authorized tenant context, never a caller-supplied id",
  );
}

/* ── 7 · THE BOUNDED PREREQUISITE: NO RETIRED DENIAL SURVIVES ANYWHERE ────── */
function noRetiredDenialSurvives(): void {
  /*
   * SEC-4 repaired three sentences and guarded ONE FILE. Two of the same sentences went on being
   * served from `domains.ts`, and a third from `pipeline.ts`, because the guard's scope was the
   * file it happened to be repairing rather than the surface that makes the claims. Scope is the
   * defect this section fixes; the patterns are SEC-4's, unweakened, plus the semantic twins the
   * originals were re-worded into.
   *
   *   AUTHORITY EXISTS != SECURITY CENTER CONNECTED
   */
  const RETIRED: ReadonlyArray<readonly [RegExp, string]> = [
    [/none connected/i, "tenant-scoped integration connections exist in this repository"],
    [/simulation vocabulary/i, "real provider transports exist"],
    [/simulation only/i, "real provider transports exist"],
    [/no persisted audit(?! ledger)/i, "audit_log is a governed append-only ledger with nine writers"],
    [/No persisted security audit history exists/i, "audit_log is a governed append-only ledger"],
    [/no audit source is connected/i, "E2-2 connected the audit source class"],
  ];

  const surface = [...walk(FEATURE_DIR), ...walk(COMPONENT_DIR), ROUTE];
  assert.ok(surface.length >= 24, `the scan covers the whole surface (${surface.length} files)`);

  const violations: string[] = [];
  for (const file of surface) {
    /*
     * COMMENTS STRIPPED, STRING LITERALS KEPT — the claims live in literals, and a module header
     * that quotes a retired sentence in order to explain what it repaired must not be read as
     * making that claim. SEC-4 paid for this exact lesson on its first run.
     */
    const code = codeOf(read(file));
    for (const [pattern, why] of RETIRED) {
      if (pattern.test(code)) violations.push(`${file}: /${pattern.source}/ — ${why}`);
    }
  }
  assert.deepEqual(violations, [], `no retired denial may be served:\n  ${violations.join("\n  ")}`);
}

async function main(): Promise<void> {
  theProjectionIsAReader();
  noAuthorityIsReachable();
  await connectedMeansConsumed();
  await noNewAuthorityGrewHere();
  await everythingElseIsUnchanged();
  theInheritedTenantPredicateIsReal();
  noRetiredDenialSurvives();

  console.log("e22-security-observation/firewall: E2-2 connection gate passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
