/*
 * R6D — RETRACTION BOUNDARIES AND FIREWALLS (structural, no DB).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Retraction is one governed human act over the authority that already exists. It creates no
 *    second writer, no second gate and no new lifecycle, it deletes nothing, and neither Heby nor an
 *    agent can reach it."
 *
 * ── THE WRITE FIREWALL IS SCOPED, AS R6B'S IS ────────────────────────────────
 *
 * R6D genuinely writes Knowledge, so "no file writes this table" is not the assertion here. What is
 * asserted instead is that exactly ONE new module writes it, that it writes only the lifecycle
 * columns, and that it can never DELETE. The pre-existing dead raw-SQL writer in
 * `supabase-postgres-adapter.ts` is re-pinned for the same reason R6B pinned it: it makes any
 * repo-wide claim false, and R6D must not have reactivated it.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  isSourceDigest,
  RETRACTION_REFUSAL_DETAIL,
  RETRACTION_SUMMARY,
} from "../../src/features/knowledge/retraction-contracts";
import { KNOWLEDGE_MUTATION_ACTIONS } from "../../src/features/governance-audit/contracts";
import { knowledgeLifecycleStatusEnum } from "../../src/db/schema/_enums";

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

const WRITER = "src/features/knowledge/retract-source.server.ts";
const READER = "src/features/knowledge/ingested-sources-read.server.ts";
const CONTRACTS = "src/features/knowledge/retraction-contracts.ts";
const CARD = "src/components/knowledge-workspace/knowledge-sources-card.tsx";
const ACTIONS = "src/app/(dashboard)/knowledge/actions.ts";
const ADAPTER = "src/features/persistence/supabase-postgres-adapter.ts";

const SRC_FILES = collect("src");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. RETRACTION IS A WITHDRAWAL — IT CANNOT DELETE.
 * ═════════════════════════════════════════════════════════════════════════ */
function neverDeletes(): void {
  const writer = codeOf(read(WRITER));

  for (const forbidden of [/\.delete\(/, /delete\s+from/i, /truncate/i, /drop\s+table/i]) {
    assert.ok(!forbidden.test(writer), `the retraction writer must not match ${forbidden}`);
  }

  /*
   * The write set is the whole contract. Only the lifecycle columns and the actor stamp move; the
   * statement, the version counters, the provenance and every ratification column stay as they were,
   * which is what makes this history-preserving rather than destructive.
   */
  const setClause = writer.slice(writer.indexOf(".set({"), writer.indexOf(".where("));
  for (const column of ["knowledgeLifecycleStatus", "retiredAt", "updatedAt", "updatedBy", "updatedByType"]) {
    assert.ok(setClause.includes(column), `the write sets ${column}`);
  }
  for (const forbidden of [
    "statement", "label", "provenance", "knowledgeVersion", "ratificationDecisionId",
    "governanceSessionId", "ratifiedAt", "deletedAt", "createdBy", "domainKey",
  ]) {
    assert.ok(!setClause.includes(forbidden), `the write must never set ${forbidden}`);
  }

  /* `retired` is an EXISTING enum value, not a new one invented for this phase. */
  assert.ok(
    knowledgeLifecycleStatusEnum.enumValues.includes("retired"),
    "`retired` already belongs to the lifecycle vocabulary",
  );

  /* The audit vocabulary gained `knowledge.retract` and still refuses to claim a deletion. */
  assert.ok(KNOWLEDGE_MUTATION_ACTIONS.includes("knowledge.retract"));
  assert.ok(
    !KNOWLEDGE_MUTATION_ACTIONS.includes("knowledge.delete" as never),
    "`knowledge.delete` stays absent — a vocabulary entry is a claim, and nothing deletes",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. ONE WRITER, ONE GATE — no second authority was created.
 * ═════════════════════════════════════════════════════════════════════════ */
function oneWriterOneGate(): void {
  /*
   * Asked as "which files retire a knowledge node", not "who calls the writer". A caller census is
   * only true until the next file is added; this is true of the codebase.
   */
  const retirers = SRC_FILES.filter((file) => {
    const code = codeOf(read(file));
    return /knowledgeLifecycleStatus:\s*"retired"/.test(code) || /set\s+knowledge_lifecycle_status/i.test(code);
  });
  assert.deepEqual(retirers, [WRITER], "exactly one module under src withdraws Knowledge");

  const writer = codeOf(read(WRITER));

  /*
   * It reuses the K2 authority resolver rather than declaring a band of its own.
   *
   * Asked over the FUNCTION BODY. `includes` across the module would match the import statement and
   * stay true even if the call were deleted — the same trap as the ordering assertion below, and the
   * bite-proof that removed the call is what exposed it.
   */
  const exported = writer.slice(writer.indexOf("export async function retractKnowledgeSource"));
  assert.ok(
    /\(deps\.resolveAuthority \?\? resolveKnowledgeWriteAuthority\)\(tenant\)/.test(exported),
    "retraction RESOLVES the same authority authoring and ingestion resolve — not merely imports it",
  );
  assert.ok(
    exported.includes('return refuse("forbidden")'),
    "and refuses when that authority says no",
  );
  for (const forbidden of [
    "KNOWLEDGE_AUTHOR_ROLE_TYPES", "roleTypeEnum", "permissions", "role_permissions",
    "authority_scope", "resolveGovernanceAuthority", "writeGovernanceDecisionWithin",
  ]) {
    assert.ok(!writer.includes(forbidden), `retraction must not reach ${forbidden}`);
  }

  /* It writes the EXISTING Knowledge audit sink, and creates no second one. */
  assert.ok(writer.includes("recordKnowledgeMutationWithin"), "history goes to the G1 sink");
  assert.ok(!writer.includes("insert(auditLog)"), "and never bypasses that writer");

  /*
   * The act is atomic by construction: one transaction, and the audit joins it.
   *
   * Asked over the TRANSACTION BODY, not the whole module. `indexOf` across the file would find
   * `recordKnowledgeMutationWithin` in the import statement at the top and compare positions that
   * mean nothing — the same ordering trap R4C.1 recorded, which there made an assertion impossible
   * to fail and here made it impossible to pass.
   */
  assert.ok(writer.includes("db.transaction("), "the whole retraction is one transaction");
  const body = writer.slice(writer.indexOf("db.transaction("));
  assert.ok(
    body.includes("recordKnowledgeMutationWithin("),
    "the audit append is INSIDE the transaction, so neither half can survive alone",
  );
  assert.ok(
    !writer.slice(0, writer.indexOf("db.transaction(")).includes("recordKnowledgeMutationWithin("),
    "and nothing appends audit before the transaction opens",
  );

  /* The server action holds no gate of its own — it delegates to the writer's. */
  const actions = codeOf(read(ACTIONS));
  const action = actions.slice(actions.indexOf("export async function retractKnowledgeSourceAction"));
  assert.ok(action.includes("retractKnowledgeSource("), "the action calls the governed act");
  assert.ok(
    !action.includes("resolveKnowledgeWriteAuthority"),
    "and does not re-resolve authority, which would be a second gate that could drift",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE READ SEAM AND THE CONTRACTS STAY READ-ONLY / PURE.
 * ═════════════════════════════════════════════════════════════════════════ */
function readSideIsInert(): void {
  const reader = codeOf(read(READER));
  for (const pattern of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.transaction\(/, /insert\s+into/i]) {
    assert.ok(!pattern.test(reader), `the source listing must not match ${pattern}`);
  }

  const contracts = codeOf(read(CONTRACTS));
  for (const forbidden of ["client.server", "db/schema", "TenantContext", "process.env", "new Date"]) {
    assert.ok(!contracts.includes(forbidden), `the contracts module must stay pure (${forbidden})`);
  }

  /* A malformed identity is refused by shape, before any lookup. */
  assert.ok(isSourceDigest("a".repeat(64)));
  assert.ok(!isSourceDigest("A".repeat(64)), "uppercase is not the shape ingestion writes");
  assert.ok(!isSourceDigest("a".repeat(63)));
  assert.ok(!isSourceDigest("a".repeat(65)));
  assert.ok(!isSourceDigest(""));
  assert.ok(!isSourceDigest(undefined));
  assert.ok(!isSourceDigest("../../etc/passwd"));

  /* Every refusal has operator-facing text, so the UI cannot invent its own wording. */
  for (const [reason, detail] of Object.entries(RETRACTION_REFUSAL_DETAIL)) {
    assert.ok(detail.length > 0, `${reason} states a real reason`);
  }
  assert.ok(Object.isFrozen(RETRACTION_REFUSAL_DETAIL));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE SURFACE DOES NOT CLAIM A DELETION.
 *
 * Hebun never stored the file. A control saying "delete" would promise a cleanup Hebun cannot
 * perform, and the operator would reasonably believe their document had been removed.
 * ═════════════════════════════════════════════════════════════════════════ */
function surfaceDoesNotClaimDeletion(): void {
  for (const phrase of ["Nothing is deleted", "never stored the file"]) {
    assert.ok(RETRACTION_SUMMARY.includes(phrase), `the summary must still say: ${phrase}`);
  }

  const card = read(CARD);
  assert.ok(card.includes("RETRACTION_SUMMARY"), "the card renders the frozen summary verbatim");
  /* Rendered copy — the words a human sees — must not offer a deletion. */
  const copy = card.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/>\s*Delete|Delete file|Remove file|"delete"/i.test(copy), "no delete affordance");
  assert.ok(copy.includes("Retract source"), "the control says what it does");
  /* A typed confirmation, not a bare click: forty facts is not a one-click decision. */
  assert.ok(copy.includes("Retype the source name"), "the act requires explicit confirmation");

  /*
   * The control belongs to the SOURCE, never to a Company Understanding category — a category
   * aggregates several sources and is not the mutation's target.
   */
  const understanding = codeOf(read("src/components/knowledge-workspace/company-understanding-card.tsx"));
  assert.ok(
    !understanding.includes("retract") && !understanding.includes("Retract"),
    "the coverage card offers no retraction: a category is not a source",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. HEBY AND AGENTS GAIN NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function agentFirewall(): void {
  /* No Heby module may import the writer, the action, or the contracts. */
  const hebyFiles = SRC_FILES.filter(
    (file) => /(^|\/)heby-[^/]+\//.test(file) || file.startsWith("src/components/layout/heby"),
  );
  assert.ok(hebyFiles.length > 0, "the Heby surface exists to be checked");
  for (const file of hebyFiles) {
    const code = codeOf(read(file));
    for (const forbidden of ["retract-source", "retractKnowledgeSource", "retraction-contracts", "ingested-sources-read"]) {
      assert.ok(!code.includes(forbidden), `${file} must not reach ${forbidden}`);
    }
  }

  /* No action registry names it, so no model output can be parsed into it. */
  const registry = codeOf(read("src/features/heby-actions/action-registry.ts"));
  for (const forbidden of ["retract", "Retract"]) {
    assert.ok(!registry.includes(forbidden), `the action registry must not name ${forbidden}`);
  }

  /* And the writer itself reaches no model, provider, execution or shell path. */
  const writer = codeOf(read(WRITER));
  for (const forbidden of [
    "heby-model", "heby-runtime", "heby-answer", "anthropic", "Anthropic", "resend", "Resend",
    "action-execution", "action-authorization", "action_permits", "child_process", "execSync",
    "fetch(", "embedding", "vector",
  ]) {
    assert.ok(!writer.includes(forbidden), `the retraction writer must not reach ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. R6B INHERITS — it was not taught about retraction.
 *
 * If Company Understanding needed a special case for a withdrawn source, the design would be wrong:
 * `retired` is terminal to every reader already.
 * ═════════════════════════════════════════════════════════════════════════ */
function r6bInheritsRatherThanKnows(): void {
  for (const modulePath of [
    "src/features/knowledge/company-understanding.ts",
    "src/features/knowledge/company-understanding-read.server.ts",
    "src/features/knowledge/company-understanding-taxonomy.ts",
  ]) {
    const code = codeOf(read(modulePath));
    for (const forbidden of ["retract", "Retract", "sourceDigest"]) {
      assert.ok(
        !code.includes(forbidden),
        `${modulePath} must not know retraction exists — it reads standing, not history`,
      );
    }
  }

  /* Retrieval likewise: `lifecycle-retired` predates R6D and was not touched. */
  const eligibility = codeOf(read("src/features/knowledge-retrieval/eligibility.ts"));
  assert.ok(eligibility.includes('"lifecycle-retired"'), "retrieval already excluded retired records");
  assert.ok(!eligibility.includes("retract"), "and needed no change for R6D");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. PHASE BOUNDARIES — no schema, no route, no dead-adapter revival.
 * ═════════════════════════════════════════════════════════════════════════ */
function phaseBoundaries(): void {
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((file) =>
    file.endsWith(".sql"),
  );
  assert.equal(migrations.length, 30, "R6D adds no migration");
  assert.equal(
    migrations.sort().at(-1),
    "20260817195446_r4a_tenant_provisioning_source.sql",
    "the newest migration is still R4A's",
  );

  /* No new table, and specifically nothing shaped like an ingestion ledger. */
  const schemaFiles = readdirSync(path.join(ROOT, "src/db/schema"));
  assert.ok(
    !schemaFiles.some((file) => /retract|ingestion|source-record/i.test(file)),
    "retraction owns no table — an ingestion ledger was not invented to make this easier",
  );

  /* No new route: `/knowledge` still has no child page. */
  const children = readdirSync(path.join(ROOT, "src/app/(dashboard)/knowledge"), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory());
  assert.deepEqual(children, [], "retraction is a section of /knowledge, not a route beneath it");

  const page = read("src/app/(dashboard)/knowledge/page.tsx");
  assert.ok(page.includes("<KnowledgeSourcesCard"), "the section is mounted");

  /*
   * THE DEAD ADAPTER, RE-PINNED. R6D adds a real Knowledge mutation, so it matters that the
   * unreachable raw-SQL path is still unreachable and still not the writer.
   */
  assert.ok(existsSync(path.join(ROOT, ADAPTER)));
  assert.ok(
    /insert\s+into\s+knowledge_nodes/i.test(codeOf(read(ADAPTER))),
    "the pre-existing dead Knowledge write path is unchanged",
  );
  assert.ok(
    /\/\/\s*case\s+"postgres":/.test(read("src/features/persistence/storage-manager.ts")),
    "the postgres storage branch remains commented out, so it stays unreachable",
  );
  assert.ok(
    !codeOf(read(WRITER)).includes("supabase-postgres-adapter"),
    "and R6D neither uses nor revives it",
  );
}

function main(): void {
  neverDeletes();
  oneWriterOneGate();
  readSideIsInert();
  surfaceDoesNotClaimDeletion();
  agentFirewall();
  r6bInheritsRatherThanKnows();
  phaseBoundaries();
  console.log("R6D boundaries and firewall: all assertions passed.");
}

main();
