/*
 * WEV-1 — ONE DECLARED RELATIONSHIP, AND NOTHING ELSE BECAME POSSIBLE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Organizational Work gained ONE fact — that a work item declares it concerns a referent — and
 *    gained no authority over what it names. The referent vocabulary is CLOSED at two released
 *    referents; there is no reference_kind column, no external-object identity, no relation
 *    vocabulary and no scoring. The executable action set is EXACTLY unchanged, no action kind
 *    became agent-originable, no Governance domain or subject type was added, no Heby source class
 *    was added, and no provider is reachable. Only a human can declare one, and the migration is
 *    additive."
 *
 * The pins:
 *
 *   WORK REFERENCES X   != WORK OWNS X
 *   REFERENCE EXISTS    != REFERENT IS CURRENT != REFERENT IS AUTHORITATIVE
 *   DECLARED BY A HUMAN != INFERRED BY HEBUN
 *   WITHDRAWN           != DELETED != INVALID
 *
 * Structural assertions run over COMMENT-STRIPPED source. Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  WORK_AUDIT_ACTIONS,
  WORK_REFERENCE_KINDS,
  WORK_REFERENCE_NON_CLAIMS,
  WORK_REFERENCE_WITHDRAWAL_MEANING,
  isWorkReferenceKind,
} from "../../src/features/organizational-work/work-contracts";
import { EXECUTABLE_ACTION_KINDS } from "../../src/features/heby-actions/action-registry";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import { GOVERNANCE_SUBJECT_TYPES } from "../../src/features/governance-decision/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { governanceDomainEnum } from "../../src/db/schema/_enums";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const SCHEMA = "src/db/schema/work-evidence-reference.ts";
const MIGRATION = "src/db/migrations/20260902183808_wev1_work_evidence_reference.sql";
const WRITER = "src/features/organizational-work/write-work.server.ts";
const READER = "src/features/organizational-work/read-work-evidence.server.ts";
const GROUNDING = "src/features/organizational-work/heby-work-source.server.ts";
const CONTRACTS = "src/features/organizational-work/work-contracts.ts";
const ACTIONS = "src/app/(dashboard)/director/work/actions.ts";
const PANEL = "src/components/organizational-work/work-register.tsx";

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}
function valueEdges(file: string): string[] {
  const source = withoutComments(read(file));
  const specifiers: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    if (clause.includes("=")) continue;
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
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
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
    for (const spec of valueEdges(file)) {
      const r = resolveSpecifier(file, spec);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE VOCABULARY IS CLOSED, AND THE KIND IS DERIVED — NEVER STORED.
 * ═════════════════════════════════════════════════════════════════════════ */
function theVocabularyIsClosed(): void {
  assert.deepEqual(
    [...WORK_REFERENCE_KINDS],
    ["knowledge-fact", "work-artifact"],
    "EXACTLY the two released referents this capability was authorized for",
  );
  for (const rejected of [
    "external-record", "knowledge-node", "work-artifact-revision", "department", "person",
    "work-item", "decision-record", "agent", "provider-record", "repository", "drive-file",
  ]) {
    assert.equal(isWorkReferenceKind(rejected), false, `"${rejected}" is not an admitted kind`);
  }

  /*
   * THE KIND IS NOT A COLUMN. It is DERIVED from which typed column is populated, so a stored kind
   * has nowhere to disagree with the referent it claims to describe — and a foreign key, not
   * application code, is what says the referent exists and belongs to this tenant.
   */
  const schema = codeOf(read(SCHEMA));
  for (const forbidden of [
    "reference_kind", "referenceKind", "reference_key", "referenceKey", "jsonb(", "json(",
    "provider_key", "providerKey", "capability", "record_id", "recordId", "relation",
    "rank", "score", "confidence",
  ]) {
    assert.ok(!schema.includes(forbidden), `the table declares no ${forbidden}`);
  }
  /* Both referents are REAL foreign keys, each composite on the tenant. */
  for (const fk of [
    "work_evidence_references_tenant_work_fk",
    "work_evidence_references_tenant_fact_fk",
    "work_evidence_references_tenant_artifact_fk",
  ]) {
    assert.ok(read(SCHEMA).includes(fk), `${fk} exists — integrity is the database's, not code's`);
  }
  for (const check of [
    "work_evidence_references_one_referent_chk",
    "work_evidence_references_human_declarer_chk",
    "work_evidence_references_withdrawal_pair_chk",
  ]) {
    assert.ok(read(SCHEMA).includes(check), `${check} exists`);
  }

  /* THE DISCLOSURE IS A DENIAL LIST, and the withdrawal meaning says what it is NOT. */
  for (const line of WORK_REFERENCE_NON_CLAIMS) {
    assert.match(line, /\b(not|no|nothing|inferred nothing)\b/i, `a non-claim must deny: "${line}"`);
  }
  assert.match(WORK_REFERENCE_WITHDRAWAL_MEANING.join(" "), /neither deleted nor invalid/i);
  assert.match(WORK_REFERENCE_WITHDRAWAL_MEANING.join(" "), /stays in the record/i);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. NOTHING ELSE BECAME POSSIBLE.
 * ═════════════════════════════════════════════════════════════════════════ */
function nothingElseBecamePossible(): void {
  /* THE EXECUTABLE SET IS EXACTLY UNCHANGED. Declaring a reference is not an executable act. */
  assert.deepEqual(
    [...EXECUTABLE_ACTION_KINDS],
    ["send-external-communication", "record-work"],
    "the closed executable set is exactly what GIA-1 left — WEV-1 added no executable action",
  );
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "and no action kind became agent-originable",
  );
  assert.deepEqual(
    [...GOVERNANCE_SUBJECT_TYPES],
    ["knowledge_node"],
    "no Governance subject type was added — a declaration is not a decision",
  );
  for (const forbidden of ["work-evidence", "evidence", "work-reference", "reference"]) {
    assert.ok(
      !(governanceDomainEnum.enumValues as readonly string[]).includes(forbidden),
      `no governance_domain value may be ${forbidden}`,
    );
  }
  assert.equal(
    HEBY_SOURCE_CLASSES.length,
    20,
    "no Heby source class was added — the released `work` source carries this",
  );
  assert.ok(HEBY_SOURCE_CLASSES.includes("work"));

  /* TWO new audit verbs, and they are the only ones. */
  assert.deepEqual(
    [...WORK_AUDIT_ACTIONS],
    [
      "work.recorded",
      "work.retitled",
      "work.state-declared",
      "work.accountable-set",
      "work.retired",
      "work.reference-declared",
      "work.reference-withdrawn",
    ],
    "declaring and withdrawing are separate verbs, and nothing else was added",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. ONE WRITER, AND NOTHING MACHINE-SHAPED CAN REACH IT.
 * ═════════════════════════════════════════════════════════════════════════ */
function oneWriterAndNoMachineReach(): void {
  const owners = walk("src").filter(
    (f) => f !== SCHEMA && /insert\(workEvidenceReferences\)/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    owners,
    [WRITER],
    "only the Organizational Work writer declares a reference — one authority, one table",
  );

  /*
   * NOTHING MACHINE-SHAPED REACHES THE DECLARATION. The database CHECK is the guarantee; this is
   * the reachability half, so a future caller cannot arrive without somebody editing this list.
   */
  const callers = walk("src").filter(
    (f) => f !== WRITER && /declareWorkEvidenceReference|withdrawWorkEvidenceReference/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    callers,
    [ACTIONS],
    "the ONLY caller is the human server action on /director/work",
  );
  for (const machine of [
    "src/features/heby-answer",
    "src/features/heby-action-inlet",
    "src/features/agent-origination",
    "src/features/agent-runtime",
    "src/features/governed-internal-action",
    "src/features/action-execution",
    "src/features/knowledge/knowledge-ingest.server.ts",
  ]) {
    const files = machine.endsWith(".ts") ? [machine] : walk(machine);
    for (const file of files) {
      if (!existsSync(path.join(ROOT, file))) continue;
      assert.ok(
        !codeOf(read(file)).includes("WorkEvidenceReference"),
        `${file} cannot declare or withdraw a reference`,
      );
    }
  }

  /* THE READ SEAM IS READ-ONLY IN A WAY THAT CAN BE PROVED. */
  const reader = codeOf(read(READER));
  for (const banned of [".insert(", ".update(", ".delete(", ".transaction("]) {
    assert.ok(!reader.includes(banned), `${READER} must remain read-only (${banned})`);
  }

  /* NO PROVIDER IS REACHABLE from the relationship's own graph. */
  const graph = transitiveGraph([SCHEMA, READER]);
  for (const file of graph) {
    assert.ok(!file.startsWith("src/features/provider-"), `${file}: no provider is reachable`);
    assert.ok(!file.startsWith("src/features/action-execution"), `${file}: no executor is reachable`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. WORK STORES NO REFERENT TRUTH, AND SAYS THE RELATIONSHIP WAS DECLARED.
 * ═════════════════════════════════════════════════════════════════════════ */
function workStoresNoReferentTruth(): void {
  const writer = codeOf(read(WRITER));
  /*
   * THE WRITER CHECKS EXISTENCE, NEVER LIFECYCLE. Copying a referent's standing into a durable
   * decision would freeze one moment's answer and make Work a reader of a lifecycle it does not
   * own — the exact thing the read seam re-resolves every time instead.
   */
  const referentCheck = writer.slice(writer.indexOf("async function referentExists"));
  const body = referentCheck.slice(0, referentCheck.indexOf("\n}"));
  for (const forbidden of ["lifecycleStatus", "ratified", "authorityClass", "retired", "superseded"]) {
    assert.ok(!body.includes(forbidden), `existence is checked, never ${forbidden}`);
  }

  /* HEBY SAYS IT WAS DECLARED, and separates the relationship from the referent's standing. */
  const grounding = read(GROUNDING);
  assert.match(grounding, /A person declared that this work concerns/);
  assert.match(grounding, /Hebun inferred none of these relationships/);
  assert.match(grounding, /current, ratified or authoritative/);

  /* THE SURFACE QUOTES THE CONTRACT rather than restating it. */
  const panel = read(PANEL);
  assert.ok(panel.includes("WORK_REFERENCE_NON_CLAIMS"));
  assert.ok(panel.includes("WORK_REFERENCE_WITHDRAWAL_MEANING"));

  /* AND THE CONTRACT SAYS WHY `external-record` IS ABSENT, so the omission is a decision. */
  const contracts = read(CONTRACTS);
  assert.match(
    contracts,
    /`external-record` is deliberately absent/,
    "the omission is a stated decision, not a gap somebody may later read as an oversight",
  );
  assert.match(contracts, /knowledge_external_references` already owns external/);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE MIGRATION IS ADDITIVE, AND IT IS THE ONLY ONE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theMigrationIsAdditive(): void {
  const migration = read(MIGRATION);
  assert.match(migration, /CREATE TABLE "work_evidence_references"/);
  /*
   * `ON UPDATE no action` is part of every generated FK clause, so a bare "UPDATE " ban would fail
   * on the constraint definitions themselves. The bans are anchored to STATEMENTS instead.
   */
  for (const forbidden of [
    "DROP ",
    'ALTER TABLE "work_items"',
    'ALTER TABLE "knowledge_facts"',
    'ALTER TABLE "work_artifacts"',
    "INSERT INTO",
    "UPDATE \"",
  ]) {
    assert.ok(!migration.includes(forbidden), `the migration performs no ${forbidden.trim()}`);
  }
  assert.ok(
    !/^\s*UPDATE\s/im.test(migration),
    "and it migrates no data — this table starts empty and stays that way until a human declares",
  );

  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly { tag: string }[];
  };
  assert.equal(journal.entries.length, 46, "the ledger grew by exactly one");
  assert.equal(
    journal.entries.filter((e) => /wev1|work_evidence/i.test(e.tag)).length,
    1,
    "and WEV-1 authored exactly one migration",
  );
  const sql = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sql.length, journal.entries.length, "the ledger and the files agree");
}

theVocabularyIsClosed();
nothingElseBecamePossible();
oneWriterAndNoMachineReach();
workStoresNoReferentTruth();
theMigrationIsAdditive();

console.log("wev1-work-evidence/evidence-firewall: OK");
