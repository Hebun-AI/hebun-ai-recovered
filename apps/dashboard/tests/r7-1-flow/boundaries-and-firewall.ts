/*
 * R7.1 — GOVERNANCE ACTIVITY BOUNDARIES AND FIREWALLS (structural, no DB).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "R7.1 is a reader. It counts rows in the one authoritative act ledger, scoped to one tenant by
 *    one SQL predicate, and it cannot write anything, cannot reach Knowledge, cannot reach a model
 *    or a provider, cannot persist, and cannot produce a judgement."
 *
 * ── THE WRITE FIREWALL IS TOTAL HERE, NOT SCOPED ─────────────────────────────
 *
 * R6B's and R6D's firewalls had to be scoped, because those phases genuinely write Knowledge. R7.1
 * writes NOTHING, so the strongest form is available: no file in the R7.1 module may contain a
 * write of any kind. That is asserted below over the module's real source with comments stripped —
 * prose about writing must not be able to trip it, and a real write must not be able to hide
 * behind prose.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  FORBIDDEN_OBSERVATION_VOCABULARY,
  GOVERNANCE_ACTIVITY_BOUNDARY,
  type GovernanceActivityTallies,
} from "../../src/features/governance-activity/contracts";
import {
  EMPTY_GOVERNANCE_ACTIVITY_TALLIES,
  projectGovernanceActivity,
  sumActionCounts,
} from "../../src/features/governance-activity/observation";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");
/** Structural questions are about what the code can REACH, never about what its prose promises. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(rel) : /\.tsx?$/.test(entry.name) ? [rel] : [];
  });

const MODULE_DIR = "src/features/governance-activity";
const CONTRACTS = `${MODULE_DIR}/contracts.ts`;
const OBSERVATION = `${MODULE_DIR}/observation.ts`;
const READ = `${MODULE_DIR}/read.server.ts`;
const OBSERVE = `${MODULE_DIR}/observe.server.ts`;
const SECTION = "src/components/intelligence-workspace/governance-activity.tsx";
const WORKSPACE = "src/components/intelligence-workspace/intelligence-workspace.tsx";
const PAGE = "src/app/(dashboard)/intelligence/page.tsx";

/** Every file R7.1 introduced or touched that could carry a capability. */
const R71_FILES = [CONTRACTS, OBSERVATION, READ, OBSERVE, SECTION];
/**
 * The subset that can reach a database at all.
 *
 * Raw-SQL keyword checks are asked only of these. Applied to the `.tsx` section they produce false
 * positives against CSS utility class names — `truncate` is a Tailwind class — and a firewall that
 * fires on a class name teaches the next author to loosen the pattern, which is how a real check
 * gets weakened. The section is held to the ORM-verb and read-only-surface checks instead.
 */
const R71_SERVER_FILES = [CONTRACTS, OBSERVATION, READ, OBSERVE];

/**
 * The migration boundary R7.1 must not cross.
 *
 * Pinned by TIMESTAMP PREFIX, never by repo-wide count: "my phase added no migration" stated as a
 * total is false the moment any other phase lands one, and a count that drifts stops proving the
 * thing it was written for.
 */
const LATEST_PRE_R71_MIGRATION = "20260817195446_r4a_tenant_provisioning_source";

/* ═══════════════════════════════════════════════════════════════════════════
 * 0. THE SOURCE IS TEXT.
 *
 * A stray NUL byte reached a React key in this phase's own component. It survived typecheck, lint,
 * the full suite and a production build — a NUL inside a string literal is legal UTF-8 and nothing
 * asserted on that key — and it was caught only because `git add` classified the file as BINARY.
 * A source file git cannot diff is unreviewable forever after, so this is asserted rather than left
 * to the next person's `git status` to notice.
 * ═════════════════════════════════════════════════════════════════════════ */
function sourceIsText(): void {
  for (const file of [...R71_FILES, "tests/r7-1-flow/boundaries-and-firewall.ts", "tests/r7-1-flow/observation-postgres.ts"]) {
    const bytes = readFileSync(path.join(ROOT, file));
    assert.equal(bytes.indexOf(0), -1, `${file} must contain no NUL byte — git would treat it as binary`);
    /* Round-trips through UTF-8 unchanged: no lone surrogate, no invalid sequence. */
    const text = bytes.toString("utf8");
    assert.ok(Buffer.from(text, "utf8").equals(bytes), `${file} must be valid UTF-8`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. R7.1 HAS ZERO WRITERS.
 * ═════════════════════════════════════════════════════════════════════════ */
function noWriterExists(): void {
  /* ORM write verbs: asked of every R7.1 file, including the section. */
  for (const file of R71_FILES) {
    const code = codeOf(read(file));
    for (const forbidden of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.transaction\(/]) {
      assert.ok(!forbidden.test(code), `${file} must not match ${forbidden} — R7.1 is a reader`);
    }
  }

  /* Raw SQL write statements: asked of the modules that can reach a database. */
  for (const file of R71_SERVER_FILES) {
    const code = codeOf(read(file));
    for (const forbidden of [
      /insert\s+into/i,
      /update\s+[a-z_"]+\s+set/i,
      /delete\s+from/i,
      /truncate\s+table/i,
      /drop\s+table/i,
      /\balter\s+table/i,
    ]) {
      assert.ok(!forbidden.test(code), `${file} must not match ${forbidden} — R7.1 is a reader`);
    }
  }

  /* The only database verb the read seam uses is `select`. */
  const readCode = codeOf(read(READ));
  assert.ok(readCode.includes(".select({"), "the read seam selects");
  assert.equal(
    (readCode.match(/\.select\(/g) ?? []).length,
    4,
    "exactly four select statements: scalars, action, result, authority-source",
  );

  /* It never appends to the ledger it observes, and never reaches an audit writer. */
  for (const forbidden of [
    "insert(auditLog)",
    "recordKnowledgeMutation",
    "recordGovernanceDecision",
    "governance-audit",
  ]) {
    for (const file of R71_FILES) {
      assert.ok(
        !codeOf(read(file)).includes(forbidden),
        `${file} must not reach ${forbidden} — observing a ledger never appends to it`,
      );
    }
  }

  /* Stated as a value too, so the boundary is readable without re-deriving it. */
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.writesAnything, false);
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.isPersisted, false);
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.isAuthoritative, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. R7.1 CANNOT REACH KNOWLEDGE. R6 holds STATEMENTS; R7 observes ACTS.
 * ═════════════════════════════════════════════════════════════════════════ */
function knowledgeIsUnreachable(): void {
  for (const file of R71_FILES) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "knowledgeFacts",
      "knowledgeNodes",
      "knowledge_facts",
      "knowledge_nodes",
      "features/knowledge",
      "db/schema/knowledge",
      "durable-knowledge-repository",
      "company-understanding",
      "knowledge-retrieval",
      "retractKnowledgeSource",
      "KNOWLEDGE_MUTATION_ACTIONS",
      "KnowledgeMutation",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach ${forbidden} — R7.1 observes acts, never Knowledge`,
      );
    }
  }
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.readsKnowledge, false);

  /*
   * The read seam resolves its own database handle rather than importing the one
   * `knowledge-mutation-audit.server.ts` exports, which would pull the Knowledge vocabulary in
   * through a helper. Asked over the FUNCTION BODY: a whole-module `includes` would match an
   * import line and stay true even if the call were replaced.
   */
  const readCode = codeOf(read(READ));
  const resolver = readCode.slice(readCode.indexOf("export function resolveGovernanceActivityDbOrNull"));
  assert.ok(resolver.includes("getControlPlaneDb()"), "it resolves the control-plane db directly");
  assert.ok(
    !readCode.includes("resolveAuditDbOrNull"),
    "and never borrows the Knowledge audit module's resolver",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. NO MODEL, NO PROVIDER, NO AGENT, NO ACTION EXECUTION.
 * ═════════════════════════════════════════════════════════════════════════ */
function noModelOrAgentReach(): void {
  for (const file of R71_FILES) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "anthropic",
      "Anthropic",
      "claude",
      "features/heby",
      "provider-connectivity",
      "providerConnectivityControls",
      "director_enabled",
      "directorEnabled",
      "embedding",
      "pgvector",
      "child_process",
      "execSync",
      "computer-use",
      "actionPermits",
      "actionExecutionAttempts",
      "hebyActionRequests",
      "consumeActionPermit",
      "recordActionRequest",
      "externalRecipients",
      "fetch(",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach ${forbidden} — R7.1 is deterministic and offline`,
      );
    }
  }
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.usesModel, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. NO PERSISTENCE. R7.1 connects no placeholder table and creates none.
 * ═════════════════════════════════════════════════════════════════════════ */
function noPersistence(): void {
  for (const file of R71_FILES) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "enterprise_projection_snapshots",
      "enterpriseProjectionSnapshots",
      "enterprise_memory_records",
      "enterprise-memory-persistence",
      "enterprise-persistence",
      "learningSessions",
      "learning_sessions",
      "improvementProposals",
      "improvement_proposals",
      "reasoningTraces",
      "reasoning_traces",
      "telemetryEvents",
      "telemetry_events",
      "eventLog",
      "event_log",
      "commandAudit",
      "command_audit",
    ]) {
      assert.ok(!code.includes(forbidden), `${file} must not reach ${forbidden}`);
    }
  }

  /* No migration belongs to R7.1. Pinned by timestamp boundary, not by a repo-wide total. */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort();
  /*
   * "Nothing newer exists" was only ever true until the next phase shipped one, which conflates
   * R7.1's authorship with everyone else's. The claim is now what it always meant: nothing was
   * inserted at or before R7.1's boundary, and no later migration is R7.1's.
   */
  assert.equal(
    migrations.filter((name) => name <= LATEST_PRE_R71_MIGRATION).at(-1),
    LATEST_PRE_R71_MIGRATION,
    "the migration R7.1 inherited is intact",
  );
  const newer = migrations.filter((name) => name > LATEST_PRE_R71_MIGRATION);
  assert.deepEqual(
    newer,
    ["20260818172455_production_provenance_vocabulary", "20260819133901_g6d_answer_source_evidence", "20260822140116_i1_integration_connection_authority", "20260822195716_int2_integration_credential_authority",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source"],
    "R7.1 authored no migration; what follows is a declared later phase",
  );
  for (const name of newer) {
    assert.ok(
      !/r7[-_.]?1|governance[-_]?activity|activity[-_]?observation/i.test(name),
      `no migration bears this phase's name — found ${name}`,
    );
  }

  /* And no schema file was added for it. */
  assert.ok(
    !existsSync(path.join(ROOT, "src/db/schema/governance-activity.ts")),
    "R7.1 declares no table",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. TENANT ISOLATION IS ONE SHARED SQL EXPRESSION, AND THERE IS NO CAP.
 * ═════════════════════════════════════════════════════════════════════════ */
function tenantScopedAndUnbounded(): void {
  const readCode = codeOf(read(READ));

  /* The predicate is declared once and reused; four `.where(tenantScope)` call sites, no copies. */
  assert.ok(
    /const tenantScope = and\(eq\(auditLog\.tenantId, tenantId\)\)/.test(readCode),
    "the tenant boundary is one named expression",
  );
  assert.equal(
    (readCode.match(/\.where\(tenantScope\)/g) ?? []).length,
    4,
    "every statement takes that same expression",
  );
  assert.equal(
    (readCode.match(/\.where\(/g) ?? []).length,
    4,
    "and no statement carries a different where clause",
  );

  /*
   * NO BOUND ANYWHERE. R6B's defect was a read seam whose limit was correct for a list and silently
   * wrong for a count; this asserts the aggregate cannot acquire one.
   */
  for (const forbidden of [/\.limit\(/, /\blimit\s+\d/i, /\.offset\(/, /fetch\s+first/i]) {
    assert.ok(!forbidden.test(readCode), `the aggregate must not match ${forbidden}`);
  }

  /* A non-uuid can never name a tenant, and is refused before any statement runs. */
  assert.ok(
    /if \(!UUID_RE\.test\(tenantId\)\) return null;/.test(readCode),
    "a malformed tenant id is refused before querying",
  );

  /*
   * The exported entry point takes the AUTHORIZED tenant context, never a caller-supplied id, and
   * offers no cross-tenant form.
   */
  const observeCode = codeOf(read(OBSERVE));
  assert.ok(
    /export async function observeGovernanceActivity\(\s*tenant: Pick<TenantContext, "tenantId"> \| null,/.test(
      observeCode,
    ),
    "the entry point is scoped to an authorized tenant context",
  );
  for (const forbidden of ["allTenants", "crossTenant", "everyTenant", "wholeLedger"]) {
    assert.ok(!observeCode.includes(forbidden), `no ${forbidden} form exists`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE PROJECTION IS PURE AND DETERMINISTIC.
 * ═════════════════════════════════════════════════════════════════════════ */
function projectionIsPure(): void {
  const code = codeOf(read(OBSERVATION));
  for (const forbidden of [
    "new Date()",
    "Date.now",
    "process.env",
    "db.",
    "drizzle",
    "auditLog",
    "fetch",
    "require(",
    "localeCompare",
  ]) {
    assert.ok(!code.includes(forbidden), `the projection must not use ${forbidden}`);
  }

  /* Same tallies + same clock ⇒ byte-identical output. */
  const tallies: GovernanceActivityTallies = {
    totalRecordedActs: 5,
    latestOccurredAt: new Date("2026-08-15T10:25:43.977Z"),
    simulatedCount: 1,
    nonSimulatedCount: 4,
    actions: [
      { action: "b.act", count: 2, latestOccurredAt: new Date("2026-08-14T00:00:00.000Z") },
      { action: "a.act", count: 2, latestOccurredAt: new Date("2026-08-13T00:00:00.000Z") },
      { action: "c.act", count: 1, latestOccurredAt: new Date("2026-08-15T10:25:43.977Z") },
    ],
    results: [
      { result: "committed", count: 4 },
      { result: "rejected", count: 1 },
    ],
    authoritySources: [
      { authoritySource: null, count: 1 },
      { authoritySource: "membership", count: 4 },
    ],
  };
  const now = new Date("2026-08-18T12:00:00.000Z");
  const first = projectGovernanceActivity("t-1", tallies, now);
  const second = projectGovernanceActivity("t-1", tallies, now);
  assert.deepEqual(first, second, "identical inputs produce identical output");
  assert.equal(first.generatedAt, "2026-08-18T12:00:00.000Z", "generatedAt comes from the clock");

  /* Ties break on the key, so equal counts never reorder between runs. */
  assert.deepEqual(
    first.actions.map((a) => a.action),
    ["a.act", "b.act", "c.act"],
    "count descending, then key ascending",
  );

  /* The null authority-source bucket is kept, never dropped, and sorts last among equals. */
  assert.deepEqual(
    first.authoritySources.map((a) => a.authoritySource),
    ["membership", null],
  );
  assert.equal(
    first.authoritySources.reduce((total, a) => total + a.count, 0),
    first.totalRecordedActs,
    "authority-source buckets sum to the independent total — nothing is dropped",
  );

  /* Completeness: the grouped rows account for every row the independent count found. */
  assert.equal(sumActionCounts(first), first.totalRecordedActs);

  /* An empty tenant is an honest zero, not an absence. */
  const empty = projectGovernanceActivity("t-2", EMPTY_GOVERNANCE_ACTIVITY_TALLIES, now);
  assert.equal(empty.totalRecordedActs, 0);
  assert.equal(empty.latestOccurredAt, null);
  assert.deepEqual(empty.actions, []);
  assert.deepEqual(empty.results, []);
  assert.deepEqual(empty.authoritySources, []);
  assert.deepEqual(empty.simulation, { simulatedCount: 0, nonSimulatedCount: 0 });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. NO JUDGEMENT VOCABULARY REACHES THE SERIALIZED VIEW.
 * ═════════════════════════════════════════════════════════════════════════ */
function noFalseIntelligence(): void {
  const view = projectGovernanceActivity(
    "t-1",
    {
      totalRecordedActs: 1,
      latestOccurredAt: new Date("2026-08-15T00:00:00.000Z"),
      simulatedCount: 0,
      nonSimulatedCount: 1,
      actions: [{ action: "x.act", count: 1, latestOccurredAt: new Date("2026-08-15T00:00:00.000Z") }],
      results: [{ result: "committed", count: 1 }],
      authoritySources: [{ authoritySource: "membership", count: 1 }],
    },
    new Date("2026-08-18T12:00:00.000Z"),
  );

  /** Every key at every depth of what a caller actually receives. */
  const keysOf = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(keysOf);
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
    }
    return [];
  };

  const keys = keysOf(JSON.parse(JSON.stringify(view)));
  assert.ok(keys.length > 0, "the walk actually visited the view");
  for (const key of keys) {
    for (const banned of FORBIDDEN_OBSERVATION_VOCABULARY) {
      assert.ok(
        !key.toLowerCase().includes(banned),
        `the observation must not expose a "${banned}" field (found on "${key}") — a count is not a verdict`,
      );
    }
  }

  /* The contract type itself must not declare one either. */
  const contracts = codeOf(read(CONTRACTS));
  const interfaces = contracts.slice(contracts.indexOf("export interface GovernanceActionTally"));
  for (const banned of FORBIDDEN_OBSERVATION_VOCABULARY) {
    assert.ok(
      !new RegExp(`readonly\\s+\\w*${banned}\\w*\\s*[?:]`, "i").test(interfaces),
      `no contract field is named after "${banned}"`,
    );
  }

  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.producesJudgement, false);
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.producesRecommendation, false);
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.producesScore, false);
  assert.equal(GOVERNANCE_ACTIVITY_BOUNDARY.observesOrganizationalOperations, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. NO SEMANTIC REGROUPING, AND NO NEW ROUTE OR SECOND SURFACE.
 * ═════════════════════════════════════════════════════════════════════════ */
function surfaceOwnership(): void {
  /*
   * The ledger's own keys are rendered verbatim. A mapping table from `action` to a friendly label
   * or a category would be a taxonomy no authority published.
   */
  const section = codeOf(read(SECTION));
  for (const forbidden of ["knowledge.create", "governance.", "onboarding.", "identity."]) {
    assert.ok(
      !section.includes(forbidden),
      `the section must not hard-code the action value ${forbidden} — it renders what the ledger holds`,
    );
  }
  for (const forbidden of ["<button", "<form", "onClick", "useState", "action={", "revalidatePath"]) {
    assert.ok(!section.includes(forbidden), `the section is read-only: no ${forbidden}`);
  }

  /* R7.1 added no route. The whole app tree is asked, not just the intelligence subtree. */
  const routes = collect("src/app").filter((file) => /\/page\.tsx$/.test(file));
  const added = routes.filter((file) => /governance-activity|governance_activity/.test(file));
  assert.deepEqual(added, [], "R7.1 created no route of its own");

  /* It lives inside the already-designated surface, mounted exactly once. */
  const workspace = codeOf(read(WORKSPACE));
  assert.equal(
    (workspace.match(/<GovernanceActivity /g) ?? []).length,
    1,
    "the section is mounted once, inside the existing Intelligence workspace",
  );
  const page = codeOf(read(PAGE));
  assert.ok(page.includes("observeGovernanceActivity"), "the page loads the observation");
  assert.ok(page.includes("resolveTenantContext"), "and resolves the tenant on the server");

  /* `/director/intelligence` stays retired — R7.1 did not revive a second Intelligence authority. */
  const legacy = codeOf(read("src/app/(dashboard)/director/intelligence/page.tsx"));
  assert.ok(legacy.includes('redirect("/intelligence")'), "the legacy landing still redirects");

  /* Exactly one module reads the ledger for R7.1 — asked of the codebase, not of a caller list. */
  const observers = collect("src").filter((file) => {
    const code = codeOf(read(file));
    return code.includes("readGovernanceActivityTallies");
  });
  assert.deepEqual(
    observers.sort(),
    [OBSERVE, READ].sort(),
    "only the R7.1 read seam and its composition seam touch the aggregate",
  );
}

sourceIsText();
noWriterExists();
knowledgeIsUnreachable();
noModelOrAgentReach();
noPersistence();
tenantScopedAndUnbounded();
projectionIsPure();
noFalseIntelligence();
surfaceOwnership();

console.log("R7.1 boundaries and firewalls: all assertions passed.");
