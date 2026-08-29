/*
 * SEC-4 — THE SECURITY CENTER NON-AUTHORITY GATE (S-C).
 *
 * ── WHAT WAS ALREADY GUARDED, AND WHAT WAS NOT ───────────────────────────────
 *
 * `tests/security-center/security-center.ts` carries a released token firewall. It reads every file
 * in `src/features/security-center` and forbids a list of strings. That is real, and it is narrow
 * in three ways this suite closes:
 *
 *   IT SCANS ONE DIRECTORY.  `src/components/security-center` (11 files) and the route are not
 *                            covered at all. A future author who put a writer in `page.tsx` would
 *                            pass every released check.
 *   IT SCANS FILES, NOT THE GRAPH. A module that imports one innocent helper from a writer's barrel
 *                            has the writer in its runtime graph, and no token in the importing
 *                            file says so. G2 found exactly that edge — Heby -> Governance, taken
 *                            "just for the DB handle".
 *   IT BANS NAMES.           A name list only catches modules somebody thought to name.
 *
 * SEC-3 measured the property and found it TRUE today: the full transitive value-import closure
 * from every Security Center entry point contains zero files with write or database capability.
 * This suite is the difference between true and CHECKED. Nothing here changes what the surface
 * reads; it pins what the surface may never become.
 *
 *   SECURITY CENTER != SECURITY AUTHORITY
 *   UI != AUTHORITY
 *   OBSERVATION != AUTHORIZATION
 *
 * ── WHY THIS DOES NOT BLOCK S-B ──────────────────────────────────────────────
 *
 * The next slice connects this surface, read-only and tenant-scoped, to authoritative evidence. A
 * firewall phrased as "Security Center may import nothing" would have to be weakened to allow that,
 * and a guard that gets weakened on schedule is not a guard.
 *
 * So the property asserted here is not reachability — it is MUTATION reachability. Read seams stay
 * addable; writers, lifecycle owners, deciders and executors do not. Section 5 proves that directly
 * by measuring the seams S-B is expected to use and asserting this suite would admit them.
 *
 * The one shape S-B must respect is the shape L4 already follows: consume an authoritative read
 * seam, do not open a database handle of your own. Section 1 enforces that, and it is architecture
 * rather than inconvenience — a surface holding its own handle is one refactor away from writing.
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
/*
 * THE SECURITY CENTER MODULE IS LOADED LAZILY, AND THAT IS DELIBERATE.
 *
 * Sections 0–3 are a STATIC analysis: they read source text and never need the module to execute.
 * Importing it at the top of this file coupled them to it anyway — and the first version did, which
 * made a mutation that breaks import resolution crash the suite at load, before a single assertion
 * ran. A crash is not a bite: it proves the module loader was watching, not that this gate was.
 *
 * So the one section that genuinely needs runtime values loads them itself. A broken import now
 * fails where it is meaningful and leaves the static sections free to report what they measured.
 */

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE_DIR = "src/features/security-center";
const COMPONENT_DIR = "src/components/security-center";
const ROUTE = "src/app/(dashboard)/director/governance/security/page.tsx";

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/** Every product entry point into the Security Center. Feature files, components AND the route. */
function entryPoints(): string[] {
  return [...walk(FEATURE_DIR), ...walk(COMPONENT_DIR), ROUTE];
}

/**
 * VALUE edges only, and RE-EXPORTS COUNT.
 *
 * Both traps have been paid for in this repository already. `import type` is erased at compile time
 * and reaches nothing at runtime, so counting it manufactures false edges — L1 measured a naive
 * graph reporting 52 mock-reaching routes where 25 were real. And `export … from` IS an edge: L4's
 * first walker followed only `import`, which made it blind to barrel re-exports, the exact case a
 * transitive gate exists to catch.
 */
function valueEdges(file: string): string[] {
  const source = read(file);
  const specifiers: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue; // `import type … from` / `export type … from` — erased
    const clause = m[3] ?? "";
    /* A braced clause whose every binding is `type X` is erased too. */
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}

/** Resolve a `@/`-aliased or relative specifier to a repository file, or null for a package. */
function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const full = path.join(ROOT, candidate);
    if (!existsSync(full)) continue;
    const parent = path.join(ROOT, path.dirname(candidate));
    if (!existsSync(parent)) continue;
    const stat = readdirSync(parent, { withFileTypes: true }).find(
      (e) => e.name === path.basename(candidate) && e.isFile(),
    );
    if (stat) return candidate;
  }
  return null;
}

/** Every repository file the Security Center can actually reach at runtime. */
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

/* ── 0 · THE WALKER IS ALIVE ───────────────────────────────────────────────────
 *
 * A graph test that passes because resolution silently broke is worse than no test: it reports a
 * clean graph for a surface it never inspected. Every capability the walk depends on is proved
 * here, against known-present facts, BEFORE any conclusion is drawn from it.
 */
function walkerIsNonVacuous(): void {
  /* Entry points exist. A renamed directory must fail here, not vanish into an empty walk. */
  const features = walk(FEATURE_DIR);
  const components = walk(COMPONENT_DIR);
  assert.ok(features.length >= 10, `the feature directory resolved (${features.length} files)`);
  assert.ok(components.length >= 10, `the component directory resolved (${components.length} files)`);
  assert.ok(existsSync(path.join(ROOT, ROUTE)), "the Security Center route exists at the pinned path");

  /* Alias resolution works. */
  assert.equal(
    resolveSpecifier(`${FEATURE_DIR}/security-state.ts`, "@/features/device-runtime"),
    "src/features/device-runtime/index.ts",
    "@/ alias resolves through a directory index",
  );
  /* Relative resolution works. */
  assert.equal(
    resolveSpecifier(`${FEATURE_DIR}/source-map.ts`, "./contracts"),
    `${FEATURE_DIR}/contracts.ts`,
    "a relative specifier resolves",
  );
  /* A package specifier is correctly NOT a repository file. */
  assert.equal(resolveSpecifier(ROUTE, "react"), null, "a package specifier resolves to nothing");

  /* Value edges are found, and type-only edges are not counted. */
  const contractsEdges = valueEdges(`${FEATURE_DIR}/contracts.ts`);
  assert.equal(
    contractsEdges.includes("@/features/heby-integration"),
    false,
    "contracts.ts imports heby-integration as `import type` — an erased edge is not a value edge",
  );
  const stateEdges = valueEdges(`${FEATURE_DIR}/security-state.ts`);
  assert.ok(
    stateEdges.includes("@/features/device-runtime"),
    "security-state.ts's value import of the device boundary IS a value edge",
  );

  /*
   * RE-EXPORTS ARE FOLLOWED. Asserted against a real barrel rather than a fixture: the feature
   * index re-exports its siblings with `export … from`, so a walker blind to that form would report
   * a graph of one file here.
   */
  const indexEdges = valueEdges(`${FEATURE_DIR}/index.ts`);
  assert.ok(indexEdges.length >= 5, `the feature barrel's re-export edges are followed (${indexEdges.length})`);
  const fromIndexOnly = transitiveGraph([`${FEATURE_DIR}/index.ts`]);
  assert.ok(
    fromIndexOnly.has(`${FEATURE_DIR}/source-map.ts`),
    "walking the barrel alone reaches its re-exported siblings — `export … from` is an edge",
  );

  /* And the whole walk reaches past the surface into the module it really consumes. */
  const graph = transitiveGraph(entryPoints());
  assert.ok(graph.size > 30, `the closure is a real graph, not a stub (${graph.size} files)`);
  assert.ok(
    graph.has("src/features/device-runtime/boundary.ts"),
    "the walk crosses the feature boundary into the device runtime it actually reads",
  );
  assert.ok(graph.has(ROUTE), "the route is in its own closure");
}

/* ── 1 · THE SURFACE ITSELF HOLDS NO HANDLE AND WRITES NOTHING ─────────────────
 *
 * Feature files, components AND the route — the released guard covered only the first.
 */
function theSurfaceCannotWrite(): void {
  const own = entryPoints();
  assert.ok(own.length >= 20, `every entry point is covered (${own.length} files)`);

  for (const file of own) {
    const source = read(file);
    assert.ok(!performsDurableWrite(source), `${file}: the Security Center performs no durable write`);

    const code = codeOf(source);
    /*
     * NO DATABASE HANDLE OF ITS OWN — and this is the rule S-B must build within.
     *
     * L4 follows it already: Live Map reads organization truth through L3's seam and never opens a
     * connection. A surface that holds a handle has the whole schema in reach and is one refactor
     * from writing with it; a surface that calls `readGovernanceActivityTallies(tenantId)` can only
     * ever get back what that authority chose to return. The second is the shape of an observer.
     */
    for (const banned of [
      "getControlPlaneDb",
      "createControlPlaneDb",
      "db/client",
      "db/schema",
      "drizzle-orm",
      ".transaction(",
    ]) {
      assert.ok(!code.includes(banned), `${file}: an observation surface must not reference ${banned}`);
    }

    /* A server action is a mutation entry point by definition. */
    assert.ok(!/"use server"/.test(source), `${file}: the Security Center declares no server action`);

    /* No shell, filesystem, device or outbound network capability was acquired to render a page. */
    for (const banned of [
      "child_process",
      "node:fs",
      "node:net",
      "execSync",
      "fetch(",
      "navigator.",
      "WebSocket",
      "EventSource",
      "getUserMedia",
      "puppeteer",
      "playwright",
    ]) {
      assert.ok(!code.includes(banned), `${file}: an observation surface needs no ${banned}`);
    }
  }
}

/*
 * The authority classes SEC-4 forbids, named as MODULES rather than words.
 *
 * A name-only needle matched against the whole graph is how L4's first attempt falsely reported
 * that Live Map reached the provider kill switch: `db/client.server.ts` imports the schema barrel to
 * type the handle, so every table definition is reachable from every read authority, and
 * `db/schema/provider-connectivity-control.ts` matched. A table definition declares columns and
 * holds no behaviour. Schema modules are therefore excluded from needle matching, and the
 * behavioural sweep below covers what a name never could.
 */
const FORBIDDEN_AUTHORITY: ReadonlyArray<readonly [string, string]> = [
  ["features/organization-runtime", "an organization lifecycle writer"],
  ["human-onboarding", "the membership lifecycle writer"],
  ["identity-enrollment", "the identity enrollment authority"],
  ["membership-authority", "the membership authorization writer"],
  ["tenant-role-baseline", "the role provisioning writer"],
  ["governance-decision", "the Governance decision authority"],
  ["governance-genesis", "the Governance genesis writer"],
  ["governance-audit", "an audit ledger writer"],
  ["action-authorization", "the action authorization authority"],
  ["action-execution", "the execution authority"],
  ["create-durable-agent-identity", "the agent identity writer"],
  ["retire-durable-agent-identity", "the agent retirement writer"],
  ["agent-origination", "the agent origination writer"],
  ["provider-connectivity-control", "the provider kill switch"],
  ["integration-credentials", "credential storage and decryption"],
  ["secret-encryption", "the encryption key registry"],
  ["knowledge-write-authority", "the Knowledge write authority"],
  ["knowledge-create", "a Knowledge writer"],
  ["knowledge-supersede", "a Knowledge writer"],
  ["knowledge-ratification", "the Knowledge ratification writer"],
  ["heby-model-live", "a live provider transport"],
  ["action-execution-live", "a live outbound transport"],
];

/* ── 2 · NO MUTATION AUTHORITY IS TRANSITIVELY REACHABLE ──────────────────── */
function noAuthorityIsReachable(): void {
  const graph = transitiveGraph(entryPoints());
  const behavioural = [...graph].filter((f) => !f.startsWith("src/db/schema/"));

  /*
   * EVERY violation is collected and reported together, rather than failing at the first needle.
   *
   * These classes are not independent — reaching one usually means reaching several, because the
   * authorities themselves compose. `integration-credentials` writes audit rows, so importing it
   * reaches BOTH credential storage and an audit ledger writer. Failing at whichever needle happens
   * to be listed first reports one true violation and hides the rest, which makes the diagnosis
   * depend on the order of an array. Reporting all of them names the whole blast radius.
   */
  const violations = FORBIDDEN_AUTHORITY.flatMap(([needle, what]) =>
    behavioural.filter((f) => f.includes(needle)).map((f) => `${f} — ${what} (${needle})`),
  );
  assert.deepEqual(
    violations,
    [],
    `the Security Center must not reach these authorities:\n  ${violations.join("\n  ")}`,
  );

  /*
   * ── THE BEHAVIOURAL SWEEP ───────────────────────────────────────────────────
   *
   * The property directly, over the whole reachable graph, with no needle required: nothing the
   * Security Center can reach performs a durable write.
   *
   * AMBIENT_FLOOR is the session/handle floor every AUTHENTICATED surface stands on — L4 has to
   * exclude it because its page resolves a tenant. This surface reaches none of it today, and the
   * next assertion pins that fact rather than leaving it to look like an oversight. When S-B adds a
   * tenant-scoped reader the floor becomes non-empty, and the correct response is to EXTEND that
   * enumeration — never to delete this sweep.
   */
  const AMBIENT_FLOOR = /^src\/(features\/auth-runtime\/|features\/auth\/|db\/client\.server\.ts)/;
  const writers = behavioural.filter((f) => !AMBIENT_FLOOR.test(f) && performsDurableWrite(read(f)));
  assert.deepEqual(
    writers,
    [],
    "nothing reachable from the Security Center performs a durable write",
  );

  /*
   * WHAT IS REACHABLE, STATED RATHER THAN IMPLIED. A firewall that lists only prohibitions lets a
   * reader assume the graph is otherwise empty.
   *
   * ── E2-2 EXTENDED THIS ENUMERATION, EXACTLY AS SEC-4 SAID IT SHOULD ─────────
   *
   * It used to be `[]`, pinned while true. E2-2 connected the `audit` source class, so the route
   * now resolves a tenant from the session and reads a bounded page of recorded acts — and the
   * ambient floor became non-empty. The sweep above is unchanged and still runs; only this
   * enumeration moved, and it moved to an EXACT list rather than to "contains" or "subset".
   *
   * The question this list exists to answer is WHAT NEW CAPABILITY BECAME REACHABLE, so the honest
   * answer is written down rather than left in the diff:
   *
   *   `db/client.server.ts`  the control-plane handle, reached through the released
   *                          `governance-activity` reader. The Security Center does not hold it —
   *                          section 1 still forbids the string in every Security file — the reader
   *                          resolves it internally, which is exactly why a consumer needs none.
   *
   *   `auth-runtime/` + `auth/`  the session floor every AUTHENTICATED surface stands on, reached
   *                          through `resolveTenantContext()`. L4 excludes the same floor for the
   *                          same reason: a page that scopes anything to a tenant must first learn
   *                          which tenant is asking.
   *
   * TWO OF THESE WRITE, AND SAYING SO IS THE POINT. `identity-repository.server.ts` and
   * `credential-repository.server.ts` are durable writers reached because `request-session.server`
   * is one module. They are excluded from the sweep by AMBIENT_FLOOR, not by accident, and the next
   * assertion pins that the READ PATH contributes none of them — every writer here arrives through
   * the session floor, and E2-2's evidence path adds zero.
   *
   *     READ CONNECTION != WRITE AUTHORITY
   */
  const floor = [...graph].filter((f) => AMBIENT_FLOOR.test(f));
  assert.deepEqual(
    floor.slice().sort(),
    [
      "src/db/client.server.ts",
      "src/features/auth-runtime/credential-repository.server.ts",
      "src/features/auth-runtime/identity-repository.server.ts",
      "src/features/auth-runtime/password-hash.server.ts",
      "src/features/auth-runtime/request-session.server.ts",
      "src/features/auth-runtime/session-cookie.ts",
      "src/features/auth-runtime/session-digest.server.ts",
      "src/features/auth-runtime/session-service.server.ts",
      "src/features/auth/environment/auth-environment.server.ts",
      "src/features/auth/errors/authentication-error.ts",
      "src/features/auth/errors/index.ts",
      "src/features/auth/services/authorized-authentication-result.server.ts",
      "src/features/auth/tenant/tenant-context.ts",
    ],
    "the exact session/handle floor E2-2 made reachable — extend this list deliberately, never " +
      "relax it to a subset check and never remove the sweep above",
  );

  /*
   * AND THE EVIDENCE PATH ITSELF CARRIES NO WRITER.
   *
   * The floor above is the price of being an authenticated surface. This asserts that E2-2's actual
   * contribution — the projection, the seam and the readers under it — added none of it: walked on
   * its own, the read path reaches zero durable writers, including through the ambient floor that
   * the assertion above has to forgive.
   */
  const readPath = transitiveGraph([
    "src/features/governance-activity/security-observation-source.server.ts",
  ]);
  const readPathWriters = [...readPath]
    .filter((f) => !f.startsWith("src/db/schema/"))
    .filter((f) => performsDurableWrite(read(f)));
  assert.deepEqual(
    readPathWriters,
    [],
    "the E2-2 read path contributes no durable writer — every writer above is the session floor",
  );
}

/* ── 3 · NO AUTHORITY EXISTS THAT HEBUN DOES NOT HAVE ─────────────────────────
 *
 * Findings, incidents, policy and trust have no authority anywhere in Hebun. The Security Center
 * holds their VOCABULARY, and vocabulary is where an authority would quietly grow first.
 *
 *   TYPE != AUTHORITY
 *   VOCABULARY != AUTHORITY
 */
function noNewAuthorityGrewHere(): void {
  for (const file of entryPoints()) {
    const code = codeOf(read(file));
    for (const banned of ["securityFindings", "securityIncidents", "securityPolicies", "trustScores"]) {
      assert.ok(!code.includes(banned), `${file}: no security ${banned} table or store may appear here`);
    }
  }
}

/* ── 4 · S-A: THE SOURCE MAP TELLS BOTH TRUTHS ────────────────────────────────
 *
 * Two falsehoods are possible about every one of these sources, and a guard against only the first
 * invites the second. The surface must not deny a capability the repository has, and it must not
 * claim a feed it does not read.
 */
async function sourceMapTellsBothTruths(): Promise<void> {
  /*
   * COMMENTS STRIPPED, STRING LITERALS KEPT.
   *
   * The claims live IN string literals, so they cannot be stripped — but the module header quotes
   * every retired sentence in order to explain what it repaired, and a raw scan reads that
   * explanation as the claim itself. This guard failed on exactly that when first run, which is the
   * same trap G2 hit (a comment naming a writer tripped an import firewall) and the same one the
   * ceremony phases hit (a refusal message containing the word it forbids). A guard that a file's
   * own honest prose can trip is a guard that gets deleted.
   */
  const src = codeOf(read(`${FEATURE_DIR}/source-map.ts`));

  /* Direction 1 — it must not deny what Hebun demonstrably has. */
  const RETIRED_DENIALS: ReadonlyArray<readonly [RegExp, string]> = [
    [/none connected/i, "integrations are connected in this repository"],
    [/simulation vocabulary/i, "real provider transports exist"],
    [/no persisted audit exists/i, "audit_log is a governed append-only ledger"],
    [/No persisted security audit history exists/i, "audit_log is a governed append-only ledger"],
  ];
  for (const [pattern, why] of RETIRED_DENIALS) {
    assert.equal(pattern.test(src), false, `source-map must not claim "${pattern.source}" — ${why}`);
  }

  /*
   * Direction 2 — and it must not claim a feed it does not read.
   *
   * E2-2 REPAIRED THIS, STRICTER. It asserted `hasConnectedSecurityFeed() === false` and that no
   * source was connected, which was true until the `audit` class was wired to its released reader.
   * The weak repair is `=== true`; that would let any future slice connect anything unnoticed. So
   * the truth is enumerated: exactly one class, named, and every other class still refused.
   */
  const { listSecuritySources, hasConnectedSecurityFeed } = await import(
    "../../src/features/security-center"
  );
  assert.equal(hasConnectedSecurityFeed(), true, "E2-2 connected exactly one source class");
  assert.deepEqual(
    listSecuritySources().filter((s) => s.state === "connected").map((s) => s.sourceClass),
    ["audit"],
    "the audit class and nothing else — a real seam existing elsewhere connects nothing",
  );
  /*
   * Connected is a claim about the read PATH, never about the evidence's standing or its liveness —
   * and that is asserted against the RENDERED sentences, not against a comment. The first version
   * of this check matched a pin in the module header, which `codeOf` strips: it was asking whether
   * the file documents the rule rather than whether the surface obeys it.
   */
  const audit = listSecuritySources().find((s) => s.state === "connected")!;
  assert.match(audit.cannotProve, /security event/i, "the connected source denies being a security event feed");
  assert.match(audit.cannotProve, /incident|breach/i, "and denies incidents and breaches");
  assert.match(audit.detail, /not a stream/i, "and denies being live");
}

/* ── 4b · THE RETIRED DENIALS CANNOT RETURN ANYWHERE ON THIS SURFACE ──────────
 *
 * Section 4 scanned ONE FILE, and that scope was the defect. Two of the three sentences it retired
 * went on being served from `security-center/domains.ts`, and a third from `pipeline.ts`, for three
 * releases — the guard was watching the file that had been repaired rather than the surface that
 * makes the claims. E2-2 repaired the sentences and widened the scan to every entry point, so the
 * same contradiction cannot come back through a module nobody thought to name.
 *
 * The patterns are section 4's, unweakened, plus the twins the originals were re-worded into. The
 * detailed per-file version lives in `tests/e22-security-observation/firewall.ts`; this is the
 * scope repair, kept here so SEC-4 is not left describing a narrower guarantee than it has.
 */
async function noRetiredDenialSurvivesAnywhere(): Promise<void> {
  const RETIRED: readonly RegExp[] = [
    /none connected/i,
    /simulation vocabulary/i,
    /simulation only/i,
    /no persisted audit(?! ledger)/i,
    /No persisted security audit history exists/i,
  ];
  const violations: string[] = [];
  for (const file of entryPoints()) {
    /* Comments stripped, string literals kept — for the reason section 4 states at length. */
    const code = codeOf(read(file));
    for (const pattern of RETIRED) {
      if (pattern.test(code)) violations.push(`${file}: /${pattern.source}/`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `a retired denial is being served again:\n  ${violations.join("\n  ")}`,
  );
}

/* ── 5 · THIS GATE ADMITS S-B ─────────────────────────────────────────────────
 *
 * The requirement SEC-4 was given is that S-C make S-B SAFER, not blocked. That is easy to claim in
 * a comment and easy to get wrong in a predicate, so it is measured.
 *
 * S-B connects this surface, read-only and tenant-scoped, to the governed audit ledger through its
 * released readers. Those readers are checked here against the very rules above: if a future edit
 * tightened this firewall in a way that would refuse them, this section fails NOW — in SEC-4, where
 * the author can see why — instead of in S-B, where the temptation would be to weaken the guard.
 */
function thisGateAdmitsTheNextSlice(): void {
  const S_B_READ_SEAMS = [
    "src/features/governance-activity/read.server.ts",
    "src/features/governance-activity/act-history-read.server.ts",
  ];

  for (const seam of S_B_READ_SEAMS) {
    assert.ok(existsSync(path.join(ROOT, seam)), `${seam} exists — S-B has a real seam to consume`);

    /* It is a reader. If this ever fails, the seam changed and S-B's premise changed with it. */
    assert.ok(
      !performsDurableWrite(read(seam)),
      `${seam} performs no durable write, so the behavioural sweep would admit it`,
    );

    /* And no prohibition above names it. A needle that caught a read seam would block S-B. */
    const caught = FORBIDDEN_AUTHORITY.filter(([needle]) => seam.includes(needle));
    assert.deepEqual(
      caught.map(([needle]) => needle),
      [],
      `no forbidden-authority needle matches ${seam} — this gate would admit it`,
    );
  }

  /*
   * The one rule S-B genuinely must build within, restated as an assertion rather than advice: the
   * seams are consumed as FUNCTIONS. They resolve their own handle internally, so a caller needs no
   * database import — which is exactly why section 1's handle ban costs S-B nothing.
   */
  for (const seam of S_B_READ_SEAMS) {
    assert.match(
      read(seam),
      /export async function read[A-Za-z]+\s*\(/,
      `${seam} exposes a callable read seam, so a consumer needs no handle of its own`,
    );
  }
}

async function main(): Promise<void> {
  walkerIsNonVacuous();
  theSurfaceCannotWrite();
  noAuthorityIsReachable();
  noNewAuthorityGrewHere();
  await sourceMapTellsBothTruths();
  await noRetiredDenialSurvivesAnywhere();
  thisGateAdmitsTheNextSlice();

  console.log("sec4-security-boundary/firewall: Security Center non-authority gate passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
