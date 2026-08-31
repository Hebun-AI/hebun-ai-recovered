/*
 * KGA — THE STRUCTURAL FIREWALL (no database).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The Knowledge review observation reads two authorities and gains none. It writes nothing,
 *    decides nothing, bounds nothing, and each side answers only about its own tables."
 *
 * ── WHY THE TOKEN BANS STRIP STRING LITERALS ─────────────────────────────────
 *
 * The eighth prose-guard collision in this repository would otherwise happen here: the new
 * `doesNotMean` sentence must SAY the words it forbids, because denying them is its entire job. A
 * prose-reading guard fails on the denial; a prose-blind one catches a real identifier. Rendered
 * prose is banned separately, on word boundaries, in `review-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  TIMESTAMP_BASES,
  TIMESTAMP_BASIS_MEANING,
  FORBIDDEN_ATTENTION_VOCABULARY,
} from "../../src/features/attention-observation/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
/** Comments removed, string literals KEPT — for asserting what the code actually does. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Comments AND string literals removed — for token bans that honest prose would trip. */
const tokensOf = (s: string): string =>
  codeOf(s)
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

const GOVERNANCE_READ = "src/features/governance-decision/knowledge-decision-read.server.ts";
const KNOWLEDGE_READ = "src/features/knowledge/current-versions-read.server.ts";
const COMPOSITION = "src/features/attention-observation/read-attention-observation.server.ts";
const HEBY_SOURCE = "src/features/attention-observation/heby-attention-source.server.ts";
const KGA_FILES = [GOVERNANCE_READ, KNOWLEDGE_READ, COMPOSITION, HEBY_SOURCE];

/* ── 1. NO WRITER, ANYWHERE IN WHAT KGA ADDED ─────────────────────────────── */
{
  for (const file of KGA_FILES) {
    const code = codeOf(read(file)).toLowerCase();
    for (const write of [
      "insert into",
      "update ",
      "delete from",
      ".insert(",
      ".update(",
      ".delete(",
      "begin",
      "transaction(",
    ]) {
      assert.ok(
        !code.includes(write),
        `${file} must contain no durable write (${write.trim()}) — this observation only reads`,
      );
    }
  }
}

/* ── 2. NEITHER SIDE ASKS THE OTHER'S QUESTION ────────────────────────────── */
{
  /*
   * The whole design rests on this split. Knowledge must not consult ratification linkage — the
   * naive predicate this milestone exists to replace — and Governance must not join Knowledge.
   */
  const knowledge = codeOf(read(KNOWLEDGE_READ));
  assert.ok(
    !/ratification|ratified|decision_records|decisionRecords/i.test(knowledge),
    "the Knowledge seam must hold no Governance concept — a rejected version carries no mark it could read",
  );

  const governance = codeOf(read(GOVERNANCE_READ));
  assert.ok(
    !/knowledge_nodes|knowledge_facts|knowledgeNodes|knowledgeFacts/.test(governance),
    "the Governance seam must not reach into Knowledge's tables — it answers about decision_records only",
  );
  assert.ok(
    /decision_records/.test(governance),
    "the Governance seam does read its own table",
  );

  /* The composition holds no table handle of its own: it calls two readers and subtracts. */
  const composition = codeOf(read(COMPOSITION));
  assert.ok(
    !/decision_records|knowledge_nodes|knowledge_facts|sql`/.test(composition),
    "the composition must construct no statement over either owner's tables",
  );
}

/* ── 3. THE GOVERNANCE READ DOES NOT FILTER BY DECISION TYPE OR OUTCOME ───── */
{
  /*
   * `ratify` and `reject` must BOTH suppress. A filter on either column would silently restore the
   * defect this milestone removes — a rejected version reappearing as still awaiting an answer.
   */
  const code = codeOf(read(GOVERNANCE_READ));
  assert.ok(
    !/decision_type|outcome/.test(code),
    "decided is decided — filtering by type or outcome would make a rejection wait forever",
  );
  assert.match(code, /subject_type/, "it filters by SUBJECT type, which is what bounds it to Knowledge");
  assert.match(code, /tenant_id/, "and by tenant, bound from the resolved server context");
}

/* ── 4. UNBOUNDED ON BOTH SIDES, FOR R6B'S REASON ─────────────────────────── */
{
  for (const file of [GOVERNANCE_READ, KNOWLEDGE_READ]) {
    const code = codeOf(read(file)).toLowerCase();
    for (const bound of [".limit(", ".offset(", "fetch first", " limit ", " offset "]) {
      assert.ok(
        !code.includes(bound),
        `${file} must carry no bound (${bound.trim()}) — a dropped row becomes a version reported as decided`,
      );
    }
  }
}

/* ── 5. NO TENANT PARAMETER A CALLER COULD AIM ────────────────────────────── */
{
  /*
   * Both public functions take a TenantContext and injectable deps, and nothing else. A
   * `tenantId: string` parameter would make a cross-organization read expressible; there is none.
   */
  for (const file of [GOVERNANCE_READ, KNOWLEDGE_READ]) {
    const code = codeOf(read(file));
    assert.ok(
      !/tenantId\s*:\s*string\s*[,)]/.test(code.replace(/tenant\.tenantId/g, "")),
      `${file} must expose no tenant identifier parameter`,
    );
  }
}

/* ── 6. NO AUTHORITY, NO DECISION, NO EXECUTION BECAME REACHABLE ──────────── */
{
  for (const file of KGA_FILES) {
    const code = codeOf(read(file)).toLowerCase();
    for (const forbidden of [
      "ratifyknowledgeversion",
      "rejectknowledgeversion",
      "writegovernancedecision",
      "recordactionrequest",
      "issuepermit",
      "consumepermit",
      "prepareaction",
      "fetch(",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} must not reach a decision, authorization or execution path (${forbidden})`,
      );
    }
  }
}

/* ── 7. NO URGENCY IDENTIFIER IN THE CODE KGA PRODUCES ────────────────────── */
{
  for (const file of KGA_FILES) {
    const tokens = tokensOf(read(file)).toLowerCase();
    for (const word of ["urgent", "urgency", "priority", "overdue", "severity", "escalate", "sla", "threshold"]) {
      assert.ok(
        !new RegExp(`\\b${word}\\b`).test(tokens),
        `${file} must define no ${word} identifier`,
      );
    }
  }
}

/* ── 8. THE NEW BASIS IS DECLARED, MEANT, AND DENIED — BY EQUALITY ────────── */
{
  assert.ok(
    TIMESTAMP_BASES.includes("knowledge-node.created_at"),
    "the basis is in the frozen set, so it cannot be measured from without appearing here",
  );
  assert.equal(TIMESTAMP_BASES.length, 6, "five released bases plus this one; none was removed");
  assert.ok(Object.isFrozen(TIMESTAMP_BASES), "the set stays frozen");

  const entry = TIMESTAMP_BASIS_MEANING["knowledge-node.created_at"];
  assert.equal(
    entry.means,
    "this Knowledge version has had no Governance decision naming it for this elapsed duration",
    "the meaning is the exact sentence, asserted by equality rather than by keyword",
  );
  /*
   * THE DENIAL, BY EQUALITY. It is the reason these words appear in the source at all, and the
   * reason the token ban above strips string literals.
   */
  for (const denied of [
    "urgent",
    "important",
    "priority",
    "overdue",
    "late",
    "stalled",
    "critical",
    "risky",
    "SLA",
    "should be approved",
    "should be rejected",
    "unread",
    "unreviewed",
  ]) {
    assert.ok(
      entry.doesNotMean.includes(denied),
      `the denial must explicitly reject "${denied}"`,
    );
  }
  /* It must not say "unratified", because the predicate is UNDECIDED and the two differ. */
  assert.ok(
    !/unratified/i.test(entry.means),
    "the meaning must not say unratified — a rejected version is unratified and is NOT waiting",
  );
  assert.ok(FORBIDDEN_ATTENTION_VOCABULARY.length >= 20, "the released ban list is unweakened");
}

/* ── 9. THE HEBY ITEM CARRIES NO KNOWLEDGE FIELD IT COULD RENDER ──────────── */
{
  /*
   * Structural, not lexical: the observation type this source reads from has two fields, a count
   * and a duration. There is no statement, label, domain or identifier for a surface to leak.
   */
  const composition = codeOf(read(COMPOSITION));
  const shape = /interface KnowledgeAwaitingReviewObservation \{([\s\S]*?)\n\}/.exec(composition);
  assert.ok(shape, "the observation shape is declared");
  for (const banned of ["statement", "label", "title", "domainKey", "nodeId", "provenance", "scope"]) {
    assert.ok(
      !shape![1].includes(banned),
      `the review observation must carry no ${banned} — a field that could hold content is a field somebody renders`,
    );
  }
}

console.log("KGA firewall: PASS");
