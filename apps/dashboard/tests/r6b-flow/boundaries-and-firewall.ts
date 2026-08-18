/*
 * R6B — TAXONOMY CLOSURE, THE WRITE FIREWALL, AND THE PHASE BOUNDARIES (structural, no DB).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Company Understanding derives. It holds no authority, writes nothing, reaches no model, and
 *    classifies only what the frozen product vocabulary declares — while never erasing a domain
 *    that vocabulary does not claim."
 *
 * ── WHY THE WRITE FIREWALL IS SCOPED, AND NOT REPO-WIDE ──────────────────────
 *
 * The obvious assertion is R5.1's shape: "no file under `src/` writes this table". It cannot be
 * written here, and the reason is worth stating rather than working around.
 *
 * `src/features/persistence/supabase-postgres-adapter.ts` contains raw-SQL `insert into
 * knowledge_nodes`, `update knowledge_nodes` and `delete from knowledge_nodes`, pointed at
 * `HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL`. It is UNREACHABLE — `storage-manager.ts` has its
 * postgres branch commented out and always returns the memory adapter, and the only
 * `knowledge-nodes` adapter ever constructed is built in `provider-registry.ts` purely to call
 * `.health()` and then disposed. But it exists, so a repo-wide claim would be FALSE, and a firewall
 * that states something false is worse than none: the next reader trusts the claim, not the code.
 *
 * This file therefore asserts the true, narrower thing — the R6B modules write nothing — and pins
 * the dead adapter's existence so the scoping stays deliberate rather than becoming an accident
 * nobody remembers. Auditing or removing that adapter is its own phase and is not R6B's to take.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  listCompanyUnderstandingCategories,
  categoryForDomainKey,
  foldDomainKey,
  COMPANY_UNDERSTANDING_SUMMARY,
} from "../../src/features/knowledge/company-understanding-taxonomy";
import { projectCompanyUnderstanding } from "../../src/features/knowledge/company-understanding";
import type { KnowledgeDomainCounts } from "../../src/features/knowledge/durable-knowledge-repository.server";

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");
/** Structural questions are about what the code can REACH, never about what its prose promises. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The modules R6B added or extended with projection behaviour. */
const R6B_MODULES = [
  "src/features/knowledge/company-understanding-taxonomy.ts",
  "src/features/knowledge/company-understanding.ts",
  "src/features/knowledge/company-understanding-read.server.ts",
  "src/components/knowledge-workspace/company-understanding-card.tsx",
];

const ADAPTER = "src/features/persistence/supabase-postgres-adapter.ts";

function counts(overrides: Partial<KnowledgeDomainCounts> & { domainKey: string }): KnowledgeDomainCounts {
  return {
    inForce: 0,
    ratified: 0,
    provisional: 0,
    reviewOverdue: 0,
    notYetEffective: 0,
    expired: 0,
    withdrawn: 0,
    unreadable: 0,
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE TAXONOMY IS CLOSED, FROZEN AND DETERMINISTIC.
 * ═════════════════════════════════════════════════════════════════════════ */
function taxonomyIsClosed(): void {
  const categories = listCompanyUnderstandingCategories();

  assert.equal(categories.length, 10, "generation one declares exactly ten areas");
  assert.ok(Object.isFrozen(categories), "the taxonomy array is frozen");
  for (const category of categories) {
    assert.ok(Object.isFrozen(category), `${category.key} is frozen`);
    assert.ok(Object.isFrozen(category.acceptedDomainKeys), `${category.key} keys are frozen`);
    assert.ok(category.label.length > 0 && category.describes.length > 0);
    /* Accepted keys are stored ALREADY FOLDED, so the comparison is membership, not a second fold. */
    for (const key of category.acceptedDomainKeys) {
      assert.equal(foldDomainKey(key), key, `${category.key}: "${key}" must be stored folded`);
    }
  }

  assert.deepEqual(
    categories.map((category) => category.key),
    [
      "identity", "offerings", "customers", "markets", "organization",
      "operations", "policies", "goals", "systems", "partners",
    ],
    "the order is stable — the view reports in taxonomy order",
  );

  const keys = categories.map((category) => category.key);
  assert.equal(new Set(keys).size, keys.length, "no duplicate category key");

  /* No accepted domain key may be claimed by two categories, or a fact's home would be arbitrary. */
  const claimed = new Map<string, string>();
  for (const category of categories) {
    for (const key of category.acceptedDomainKeys) {
      assert.ok(!claimed.has(key), `"${key}" is claimed by both ${claimed.get(key)} and ${category.key}`);
      claimed.set(key, category.key);
    }
  }

  /* The taxonomy is product vocabulary: it may not read a database, a tenant, or a clock. */
  const source = codeOf(read("src/features/knowledge/company-understanding-taxonomy.ts"));
  for (const forbidden of ["db/schema", "client.server", "TenantContext", "Date.now", "new Date"]) {
    assert.ok(!source.includes(forbidden), `the taxonomy must not reach ${forbidden}`);
  }

  /* The three distinctions the surface must never lose. */
  for (const phrase of ["not correctness", "not ratification", "not understanding"]) {
    assert.ok(
      COMPANY_UNDERSTANDING_SUMMARY.includes(phrase),
      `the operator summary must still say coverage is ${phrase}`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. MAPPING CLASSIFIES, AND NEVER ERASES.
 * ═════════════════════════════════════════════════════════════════════════ */
function mappingNeverErases(): void {
  /* Case-insensitive: canonical holds `Security` capitalised. */
  assert.equal(categoryForDomainKey("Security")?.key, "policies");
  assert.equal(categoryForDomainKey("security")?.key, "policies");
  assert.equal(categoryForDomainKey("  SECURITY  ")?.key, "policies");
  assert.equal(categoryForDomainKey("goals")?.key, "goals");
  assert.equal(categoryForDomainKey("ops")?.key, "operations");

  /*
   * The Turkish fold, PINNED. `İ` must not go through `toLowerCase()` first: in JavaScript that
   * yields `i` plus a COMBINING DOT ABOVE, which never equals a plain `i`. Folding first turns it
   * into `I`, and only then does lowercasing produce `i`.
   */
  assert.equal(foldDomainKey("İZİN"), "izin", "the Turkish dotted capital folds to a plain i");
  assert.equal(foldDomainKey("izin"), "izin");
  assert.equal(foldDomainKey("IŞIK"), "isik");
  assert.notEqual("İZİN".toLowerCase(), "izin", "which is exactly why the fold runs first");

  /* An unclaimed key returns null — a real answer the caller must surface, not a failure. */
  assert.equal(categoryForDomainKey("izin"), null);
  assert.equal(categoryForDomainKey("satinalma"), null);
  assert.equal(categoryForDomainKey(""), null);

  /* And the projection reports it rather than dropping it. */
  const view = projectCompanyUnderstanding(
    [counts({ domainKey: "izin", inForce: 3, expired: 1 })],
    new Date("2026-08-18T12:00:00.000Z"),
  );
  assert.equal(view.uncategorized.length, 1);
  assert.equal(view.uncategorized[0]!.domainKey, "izin");
  assert.equal(view.uncategorized[0]!.recordCount, 3);
  assert.equal(view.uncategorized[0]!.notInForceCount, 1);
  assert.ok(
    view.categories.every((category) => category.state === "missing"),
    "an unclaimed domain covers nothing — but its records are still reported",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE PROJECTION AGGREGATES CONSERVATIVELY AND CLAIMS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function projectionClaimsNothing(): void {
  const now = new Date("2026-08-18T12:00:00.000Z");
  const view = projectCompanyUnderstanding(
    [
      counts({ domainKey: "policies", inForce: 2, ratified: 1, provisional: 2, reviewOverdue: 1 }),
      counts({ domainKey: "security", inForce: 1, provisional: 1 }),
      counts({ domainKey: "goals", expired: 4 }),
    ],
    now,
  );

  /* Two domains folding into one category ADD, and both are named so the mapping is auditable. */
  const policies = view.categories.find((category) => category.key === "policies")!;
  assert.equal(policies.recordCount, 3);
  assert.deepEqual(policies.matchedDomainKeys, ["policies", "security"]);

  /*
   * A category with only expired records is MISSING but not silent — "you had evidence and it
   * lapsed" is a different thing to be told than "you never supplied any".
   */
  const goals = view.categories.find((category) => category.key === "goals")!;
  assert.equal(goals.state, "missing");
  assert.equal(goals.recordCount, 0);
  assert.equal(goals.expiredCount, 4);

  assert.equal(view.generatedAt, now.toISOString(), "the clock is injected, never read");
  assert.equal(view.truncated, false);

  /* No category-level standing claim may exist, under any name. */
  const serialized = JSON.stringify(view).toLowerCase();
  for (const forbidden of [
    "authoritative", "confirmed", "verified", "confidence", "percent",
    "score", "understood", "health", "truth", "recommend",
  ]) {
    assert.ok(!serialized.includes(forbidden), `the view must carry no "${forbidden}" claim`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE WRITE FIREWALL — SCOPED, AND SAYING WHY.
 * ═════════════════════════════════════════════════════════════════════════ */
function r6bWritesNothing(): void {
  for (const modulePath of R6B_MODULES) {
    const code = codeOf(read(modulePath));
    for (const pattern of [
      /\.insert\(/, /\.update\(/, /\.delete\(/,
      /insert\s+into/i, /update\s+knowledge_/i, /delete\s+from/i,
      /createDurableKnowledgeWriter/, /ingestKnowledgeSource/,
      /ratifyKnowledgeVersion/, /supersedeKnowledge/, /createKnowledge\b/,
    ]) {
      assert.ok(!pattern.test(code), `${modulePath} must not match ${pattern}`);
    }
    /* Nor may it open a transaction, which is the only other way a write could hide. */
    assert.ok(!/\.transaction\(/.test(code), `${modulePath} opens no transaction`);
  }

  /*
   * THE SCOPING IS DELIBERATE, AND THIS PROVES IT IS. The dead adapter genuinely writes the table,
   * so a repo-wide assertion would be false. Pinning it here means the scope is a recorded decision
   * rather than an oversight — and if the adapter is ever removed, this fails and the firewall can
   * legitimately widen.
   */
  assert.ok(existsSync(path.join(ROOT, ADAPTER)), `${ADAPTER} still exists`);
  const adapter = codeOf(read(ADAPTER));
  assert.ok(
    /insert\s+into\s+knowledge_nodes/i.test(adapter),
    "the pre-existing dead Knowledge write path is still present — which is why this firewall is scoped",
  );
  assert.ok(
    !R6B_MODULES.includes(ADAPTER),
    "and it is deliberately outside R6B's scope: R6B neither uses nor repairs it",
  );
  /* It stays unreachable: the storage manager's postgres branch is still not selected. */
  const storage = read("src/features/persistence/storage-manager.ts");
  assert.ok(
    /\/\/\s*case\s+"postgres":/.test(storage),
    "the postgres storage branch remains commented out, so the adapter stays unreachable",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. NO MODEL, NO PROVIDER, NO AGENT, NO EXECUTION.
 * ═════════════════════════════════════════════════════════════════════════ */
function noModelOrAgentReach(): void {
  for (const modulePath of R6B_MODULES) {
    const code = codeOf(read(modulePath));
    for (const forbidden of [
      "heby-model", "heby-model-live", "heby-runtime", "heby-answer", "heby-actions",
      "anthropic", "Anthropic", "resend", "Resend",
      "embedding", "vector", "action-execution", "action-authorization",
      "action_permits", "child_process", "execSync", "fetch(",
    ]) {
      assert.ok(!code.includes(forbidden), `${modulePath} must not reach ${forbidden}`);
    }
  }

  /* The pure projection is pure: no I/O of any kind, and no clock of its own. */
  const pure = codeOf(read("src/features/knowledge/company-understanding.ts"));
  for (const forbidden of ["client.server", "db/schema", "process.env", "new Date(", "Date.now"]) {
    assert.ok(!pure.includes(forbidden), `the projection must not use ${forbidden}`);
  }

  /*
   * The read seam resolves NO second authority. Knowledge authoring needs the owner/director band;
   * reading counts of records the viewer can already list needs a tenant and nothing more, and a
   * stricter gate here than on the listing would be a second authority over one question.
   */
  const reader = codeOf(read("src/features/knowledge/company-understanding-read.server.ts"));
  for (const forbidden of [
    "resolveKnowledgeWriteAuthority", "resolveGovernanceAuthority",
    "roles", "permissions", "authority_scope", "recordKnowledgeMutation",
  ]) {
    assert.ok(!reader.includes(forbidden), `the read seam must not reach ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE PHASE BOUNDARIES — R6B ABSORBS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function phaseBoundaries(): void {
  /* No new route: `/knowledge` still has no child page. */
  const knowledgeDir = path.join(ROOT, "src/app/(dashboard)/knowledge");
  const children = readdirSync(knowledgeDir, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  assert.deepEqual(children, [], "the projection is a section of /knowledge, not a route beneath it");

  /* No new migration: R6B is a read, and a read needs no schema. Phase-scoped rather than a
   * repo-wide total — a later phase's migration cannot falsify a claim that was never about it. */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const PHASE_BOUNDARY = "20260817195446_r4a_tenant_provisioning_source.sql";
  const upToBoundary = migrations.filter((file) => file <= PHASE_BOUNDARY);
  assert.equal(upToBoundary.at(-1), PHASE_BOUNDARY, "the migration R6B inherited is intact");
  assert.equal(upToBoundary.length, 30, "no migration was inserted at or before R6B's boundary");
  for (const file of migrations.filter((file) => file > PHASE_BOUNDARY)) {
    assert.ok(
      !/r6[-_.]?b|company[-_]?understanding|coverage/i.test(file),
      `no migration bears this phase's name — found ${file}`,
    );
  }

  /* No new table, and specifically not the one R6A rejected. */
  const schemaFiles = readdirSync(path.join(ROOT, "src/db/schema"));
  assert.ok(
    !schemaFiles.some((file) => /company.?profile|understanding|taxonomy/i.test(file)),
    "Company Understanding owns no table — Knowledge remains the sole authority",
  );

  /* The page renders the section ABOVE the records, and adds no control. */
  const page = read("src/app/(dashboard)/knowledge/page.tsx");
  assert.ok(page.includes("<CompanyUnderstandingCard"), "the section is mounted");
  assert.ok(
    page.indexOf("<CompanyUnderstandingCard") < page.indexOf("<KnowledgeRecords"),
    "coverage orients the reader before the records detail it",
  );

  /* Ratification stays where it already is — one act, one call site. */
  const card = codeOf(read("src/components/knowledge-workspace/company-understanding-card.tsx"));
  for (const forbidden of ["ratifyKnowledgeVersionAction", "createKnowledgeAction", "ingestKnowledge"]) {
    assert.ok(!card.includes(forbidden), `the card must not offer ${forbidden}`);
  }
  assert.ok(!card.includes("<form"), "the card is presentational — it submits nothing");
}

function main(): void {
  taxonomyIsClosed();
  mappingNeverErases();
  projectionClaimsNothing();
  r6bWritesNothing();
  noModelOrAgentReach();
  phaseBoundaries();
  console.log("R6B boundaries and firewall: all assertions passed.");
}

main();
