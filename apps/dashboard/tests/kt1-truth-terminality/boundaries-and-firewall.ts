/*
 * KT-1 — truth terminality and rejection retrieval exclusion: the pure rules and the boundaries.
 *
 * THE CLAIMS UNDER TEST, none of which need a database:
 *   - eligibility stays PURE: the rejected set is an INPUT, exactly as `now` is;
 *   - a Governance-rejected version is disqualified, with its own reason, and an EMPTY rejected set
 *     changes nothing about what was eligible before;
 *   - the rejection projection is Governance's, read-only, tenant-scoped, and a sibling of the
 *     decided-versions read rather than a second meaning inside it;
 *   - the Knowledge repository still reads no Governance ledger, the Knowledge writers still import
 *     no Governance writer, and a rejection still mutates nothing in Knowledge.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  exclusionReasonFor,
  isEligible,
  partitionByEligibility,
} from "../../src/features/knowledge-retrieval/eligibility";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import { RATIFICATION_SUBJECT_TYPE } from "../../src/features/knowledge-ratification/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const ELIGIBILITY = "src/features/knowledge-retrieval/eligibility.ts";
const RETRIEVAL_CONTRACTS = "src/features/knowledge-retrieval/contracts.ts";
const REJECTION_READ = "src/features/governance-decision/knowledge-rejection-read.server.ts";
const DECIDED_READ = "src/features/governance-decision/knowledge-decision-read.server.ts";
const REPOSITORY = "src/features/knowledge/durable-knowledge-repository.server.ts";
const KNOWLEDGE_READ = "src/features/knowledge/knowledge-read.server.ts";
const RATIFY = "src/features/knowledge-ratification/ratify-version.server.ts";
const RATIFICATION_CONTRACTS = "src/features/knowledge-ratification/contracts.ts";
const KNOWLEDGE_EVIDENCE = "src/features/heby-answer/knowledge-evidence.server.ts";
const KNOWLEDGE_WRITERS = [
  "src/features/knowledge/durable-knowledge-writer.server.ts",
  "src/features/knowledge/knowledge-create.server.ts",
  "src/features/knowledge/knowledge-supersede.server.ts",
];

const NOW = new Date("2026-10-02T12:00:00.000Z");
const NONE: ReadonlySet<string> = new Set();

function record(overrides: Partial<KnowledgeSourceRecord>): KnowledgeSourceRecord {
  return {
    factKey: "kt1.fact",
    domainKey: "commerce",
    lifecycleStatus: "draft",
    effectiveFrom: null,
    effectiveUntil: null,
    activeKnowledgeNodeId: "11111111-1111-4111-8111-111111111111",
    ...overrides,
  } as KnowledgeSourceRecord;
}

function main(): void {
  /* ── T1: A REJECTED VERSION IS DISQUALIFIED, WITH ITS OWN REASON ──────────── */
  {
    const rejected = new Set(["11111111-1111-4111-8111-111111111111"]);
    assert.equal(exclusionReasonFor(record({}), NOW, rejected), "governance-rejected");
    assert.equal(isEligible(record({}), NOW, rejected), false);

    // The rejection is about ONE version row. A different row of the same fact is untouched.
    const successor = record({ activeKnowledgeNodeId: "22222222-2222-4222-8222-222222222222" });
    assert.equal(exclusionReasonFor(successor, NOW, rejected), null);

    // A record with no active node cannot be named by a decision, so it cannot be rejected.
    assert.equal(exclusionReasonFor(record({ activeKnowledgeNodeId: null }), NOW, rejected), null);
  }

  /* ── T2: AN EMPTY REJECTED SET CHANGES NOTHING THAT WAS TRUE BEFORE ───────── */
  {
    assert.equal(exclusionReasonFor(record({}), NOW, NONE), null);
    assert.equal(exclusionReasonFor(record({ lifecycleStatus: "retired" }), NOW, NONE), "lifecycle-retired");
    assert.equal(exclusionReasonFor(record({ lifecycleStatus: "archived" }), NOW, NONE), "lifecycle-archived");
    assert.equal(
      exclusionReasonFor(record({ effectiveFrom: "2027-01-01T00:00:00.000Z" }), NOW, NONE),
      "not-yet-effective",
    );
    assert.equal(
      exclusionReasonFor(record({ effectiveUntil: "2025-01-01T00:00:00.000Z" }), NOW, NONE),
      "expired",
    );
    // Standing is still reported, never used to hide a record.
    assert.equal(exclusionReasonFor(record({ lifecycleStatus: "deprecated" }), NOW, NONE), null);
  }

  /* ── T3: LIFECYCLE STILL SPEAKS FIRST; REJECTION BEFORE THE WINDOW ────────── */
  {
    const rejected = new Set(["11111111-1111-4111-8111-111111111111"]);
    assert.equal(
      exclusionReasonFor(record({ lifecycleStatus: "retired" }), NOW, rejected),
      "lifecycle-retired",
      "a withdrawn record is reported as withdrawn — Knowledge's own standing is not overwritten",
    );
    assert.equal(
      exclusionReasonFor(record({ effectiveUntil: "2025-01-01T00:00:00.000Z" }), NOW, rejected),
      "governance-rejected",
    );
  }

  /* ── T4: THE PARTITION REPORTS THE REJECTED RECORD RATHER THAN DROPPING IT ── */
  {
    const kept = record({ factKey: "kt1.kept", activeKnowledgeNodeId: "22222222-2222-4222-8222-222222222222" });
    const gone = record({ factKey: "kt1.gone" });
    const partition = partitionByEligibility([kept, gone], NOW, new Set([gone.activeKnowledgeNodeId!]));
    assert.deepEqual(partition.eligible.map((r) => r.factKey), ["kt1.kept"]);
    assert.deepEqual(partition.excluded, [
      { factKey: "kt1.gone", domainKey: "commerce", reason: "governance-rejected" },
    ]);

    const baseline = partitionByEligibility([kept, gone], NOW, NONE);
    assert.deepEqual(baseline.eligible.map((r) => r.factKey), ["kt1.kept", "kt1.gone"]);
    assert.deepEqual(baseline.excluded, []);
  }

  /* ── T5: ELIGIBILITY STAYS PURE ───────────────────────────────────────────── */
  {
    const code = codeOf(read(ELIGIBILITY));
    const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      imports.sort(),
      ["./contracts", "@/features/knowledge/contracts"].sort(),
      "the gate imports its own contracts and the record type — no database, no Governance",
    );
    assert.ok(!/\bawait\b|\basync\b/.test(code), "the gate does no I/O");
    assert.ok(/"governance-rejected"/.test(codeOf(read(RETRIEVAL_CONTRACTS))), "the reason is in the closed vocabulary");
  }

  /* ── T6: THE REJECTION PROJECTION IS GOVERNANCE'S, READ-ONLY, TENANT-SCOPED ─ */
  {
    const code = codeOf(read(REJECTION_READ));
    assert.ok(/export async function readRejectedKnowledgeVersions/.test(code));
    assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.transaction\(/.test(code), "it writes nothing and opens no transaction");
    assert.ok(!/\binsert into\b|\bupdate\s+"|\bdelete from\b/i.test(code), "no raw mutation either");
    assert.ok(/"decision_records"\."tenant_id" = \$\{tenant\.tenantId\}/.test(code), "tenant-scoped by predicate");
    assert.ok(
      /KNOWLEDGE_VERSION_SUBJECT_TYPE: GovernanceSubjectType = "knowledge_node"/.test(code),
      "the subject type comes from Governance's own closed vocabulary",
    );
    assert.equal(RATIFICATION_SUBJECT_TYPE, "knowledge_node", "and it is the same word K4 writes its decisions under");
    assert.ok(
      !/knowledge-ratification/.test(code),
      "every Knowledge reader reaches this projection, so it must not pull the ratification seam into their graph",
    );
    assert.ok(!/knowledge_nodes|knowledge_facts|@\/db\/schema\/knowledge/.test(code), "it reads Governance's table and no Knowledge table");
    assert.ok(!/decision-authority\.server/.test(code), "a projection holds no decision writer");

    // The decided-versions read keeps its one meaning: identities, never outcomes.
    const decided = codeOf(read(DECIDED_READ));
    assert.ok(!/decision_type/.test(decided), "the decided read still does not tell ratify from reject");
    assert.ok(!/readRejectedKnowledgeVersions/.test(decided), "the rejection read is a sibling, not an overload");
  }

  /* ── T7: KNOWLEDGE STILL READS NO LEDGER AND IMPORTS NO GOVERNANCE WRITER ─── */
  {
    assert.ok(!/decision_records|decisionRecords/.test(codeOf(read(REPOSITORY))), "the repository reads no Governance ledger");
    assert.ok(
      !/decision_records|decisionRecords/.test(codeOf(read(KNOWLEDGE_READ))),
      "the read facade composes the projection; it holds no ledger statement of its own",
    );
    assert.ok(
      /knowledge-rejection-read\.server/.test(codeOf(read(KNOWLEDGE_READ))),
      "the facade consumes Governance's projection",
    );
    for (const file of KNOWLEDGE_WRITERS) {
      const code = codeOf(read(file));
      assert.ok(!/governance-decision\/decision-authority/.test(code), `${file} imports no Governance decision writer`);
      assert.ok(!/knowledge-rejection-read/.test(code), `${file} does not consult rejection`);
    }
    const evidence = codeOf(read(KNOWLEDGE_EVIDENCE));
    assert.ok(!/decision-authority|writeGovernanceDecision|recordGovernanceDecision/.test(evidence), "Heby gains no Governance write authority");
  }

  /* ── T8: BOTH TRUTH DECISIONS REFUSE A VERSION GOVERNANCE ALREADY REJECTED ── */
  {
    assert.ok(/\|\s*"already-rejected"/.test(codeOf(read(RATIFICATION_CONTRACTS))), "the refusal is in the closed vocabulary");
    const ratify = codeOf(read(RATIFY));
    const ratifyBody = ratify.slice(
      ratify.indexOf("export async function ratifyKnowledgeVersion"),
      ratify.indexOf("export async function rejectKnowledgeVersion"),
    );
    const rejectBody = ratify.slice(ratify.indexOf("export async function rejectKnowledgeVersion"));
    for (const [name, body] of [["ratify", ratifyBody], ["reject", rejectBody]] as const) {
      assert.ok(/RatificationAbort\("already-rejected"\)/.test(body), `${name} refuses an already-rejected version`);
      assert.ok(/RatificationAbort\("already-ratified"\)/.test(body), `${name} still refuses an already-ratified version`);
    }
    // And the rejection path still mutates nothing in Knowledge (k4-flow T5, restated here).
    assert.ok(!/\.update\(knowledgeNodes\)|\.insert\(knowledgeNodes\)/.test(rejectBody));
    assert.ok(!/recordKnowledgeMutationWithin/.test(rejectBody));
  }

  console.log("PASS kt1 boundaries and firewall");
}

main();
