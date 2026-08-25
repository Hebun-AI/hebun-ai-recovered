/*
 * KR5 — what historical answer evidence is NOT allowed to become.
 *
 * The PostgreSQL suites prove the record is correct. This one proves it stayed in its lane: a
 * historical relationship, owned by the assistant message, that never turns into a second Knowledge
 * authority, a Governance record, a memory, a search index, or a claim about what the model
 * actually used.
 *
 * Source-level, no database, no LLM.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src");
const MIGRATIONS = join(ROOT, "db", "migrations");

const read = (...parts: string[]): string => readFileSync(join(...parts), "utf8");
/** Source with comments removed — these files DISCUSS what they refuse to do, at length. */
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SCHEMA = read(ROOT, "db", "schema", "heby-answer-evidence.ts");
const PROJECTION = read(ROOT, "features", "heby-conversation", "answer-evidence.ts");
const REPOSITORY = read(
  ROOT,
  "features",
  "heby-conversation",
  "durable-conversation-repository.server.ts",
);
const ANSWER = read(ROOT, "features", "heby-answer", "model-answer.server.ts");
const LOADER = read(ROOT, "features", "heby-answer", "load-conversation.server.ts");
const PANEL = read(ROOT, "components", "layout", "heby", "heby-evidence.tsx");
const THREAD = read(ROOT, "components", "layout", "heby", "heby-thread.ts");
const MIGRATION = read(MIGRATIONS, "20260815202736_heby_answer_evidence.sql");

function main(): void {
  /* ── 1. THE MIGRATION IS PURELY ADDITIVE ──────────────────────────────── */
  {
    for (const forbidden of [
      /\bDROP\s+TABLE\b/i,
      /\bDROP\s+COLUMN\b/i,
      /\bTRUNCATE\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bUPDATE\s+"/i,
      /\bALTER\s+COLUMN\b/i,
      /\bCREATE\s+EXTENSION\b/i,
      /\bCREATE\s+TYPE\b/i,
    ]) {
      assert.ok(!forbidden.test(MIGRATION), `the migration must not contain ${forbidden}`);
    }

    /* It touches exactly three tables, and only one of those already existed. */
    const created = [...MIGRATION.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(created, ["heby_answer_evidence_item", "heby_answer_evidence_set"]);
    const altered = new Set([...MIGRATION.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    assert.deepEqual(
      [...altered].sort(),
      ["heby_answer_evidence_item", "heby_answer_evidence_set"],
      "no pre-existing table is altered — `messages` only gains an index",
    );

    /* No Knowledge, Governance or Memory object is created or modified anywhere in it. */
    for (const table of [
      "knowledge_nodes",
      "knowledge_facts",
      "knowledge_edges",
      "decision_records",
      "governance_sessions",
      "audit_log",
      "memories",
      "working_memories",
      "learning_sessions",
    ]) {
      assert.ok(!MIGRATION.includes(table), `the migration must not touch ${table}`);
    }

    /*
     * STATEMENT ORDER. The composite foreign key can only be created against an EXISTING unique
     * constraint, so the index on messages(id, tenant_id) must come first. drizzle-kit generated
     * them the other way round and the migration failed to apply; this pins the repair.
     */
    assert.ok(
      MIGRATION.indexOf('CREATE UNIQUE INDEX "messages_id_tenant_uidx"') <
        MIGRATION.indexOf("heby_answer_evidence_set_tenant_message_fk"),
      "the messages unique index must be created before the FK that references it",
    );
  }

  /* ── 2. THE MIGRATION IS THE ONLY ONE THIS PHASE ADDED ─────────────────── */
  {
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
    const PHASE_BOUNDARY = "20260813090642_membership_role_tenant_integrity.sql";
    assert.deepEqual(
      files.filter((name) => name > PHASE_BOUNDARY).sort(),
      ["20260815202736_heby_answer_evidence.sql", "20260816063156_r3a_action_authorization.sql", "20260816085245_r3w_durable_work_artifacts.sql", "20260816105458_r3r_durable_recipient_authority.sql", "20260816194116_r3b_action_execution_attempts.sql", "20260817195446_r4a_tenant_provisioning_source.sql", "20260818172455_production_provenance_vocabulary.sql", "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql"],
      "KR5 adds exactly one migration",
    );
    const journal = JSON.parse(read(MIGRATIONS, "meta", "_journal.json")) as {
      entries: { tag: string }[];
    };
    assert.equal(journal.entries.length, files.length, "journal and directory agree");
    assert.equal(
      journal.entries.filter((e) => e.tag === "20260815202736_heby_answer_evidence").length,
      1,
      "registered exactly once",
    );
  }

  /* ── 3. NO SCORE, CONFIDENCE, TRUST OR TRUTH FIGURE IS DECLARED ────────── */
  {
    for (const [label, source] of [
      ["the schema", SCHEMA],
      ["the projection", PROJECTION],
    ] as const) {
      const code = codeOf(source);
      for (const banned of [
        "lexical",
        "trigram",
        "combined",
        "sourceDigest",
        "confidence",
        "trustScore",
        "truthScore",
        "certainty",
        "reasoning",
      ]) {
        assert.ok(!code.includes(banned), `${label} must not carry "${banned}"`);
      }
      /* `rank` and `score` only as whole words — `ordinal` is order, not a rating. */
      assert.ok(!/\brank\b/i.test(code), `${label} must not carry a rank`);
      assert.ok(!/\bscore\b/i.test(code), `${label} must not carry a score`);
    }
  }

  /* ── 4. THE FULL KNOWLEDGE STATEMENT IS NEVER COPIED ───────────────────── */
  {
    /*
     * The bounded excerpt travels; `statement` does not. Storing the statement would make these
     * tables a second Knowledge content store, which is the one thing this design refuses.
     */
    assert.ok(!/statement/i.test(codeOf(SCHEMA)), "no statement column exists");
    assert.ok(
      !/\bstatement\b/.test(codeOf(PROJECTION)),
      "and the projection never reads one — only `excerpt`, already bounded by the KR4 contract",
    );
    assert.ok(codeOf(PROJECTION).includes("excerpt"), "the excerpt is what travels");
  }

  /* ── 5. HISTORY NEVER WRITES KNOWLEDGE, GOVERNANCE, MEMORY OR AUDIT ────── */
  {
    const writers = codeOf(REPOSITORY);
    for (const table of [
      "knowledgeNodes",
      "knowledgeFacts",
      "knowledgeEdges",
      "decisionRecords",
      "governanceSessions",
      "auditLog",
      "memories",
      "workingMemories",
      "learningSessions",
    ]) {
      assert.ok(!writers.includes(table), `the conversation repository must not reach ${table}`);
    }

    /* The projection is pure: it holds no database handle at all. */
    for (const banned of [
      ".insert(",
      ".update(",
      ".delete(",
      "db.transaction(",
      "getControlPlaneDb",
      "drizzle",
    ]) {
      assert.ok(!codeOf(PROJECTION).includes(banned), `the projection must not contain "${banned}"`);
    }
  }

  /* ── 6. ONE WRITER, ONE TRANSACTION ───────────────────────────────────── */
  {
    const code = codeOf(REPOSITORY);
    assert.equal(
      (code.match(/db\.transaction\(/g) ?? []).length,
      1,
      "exactly one transaction — a second writer following the first is the defect this closes",
    );
    /* And every write in the exchange happens on the transaction handle, never the pool. */
    const body = code.slice(code.indexOf("db.transaction("), code.indexOf("async listAnswerEvidence"));
    assert.ok(!/\bdb\s*\.?\s*insert\(/.test(body), "no insert escapes onto the pooled handle");
    for (const table of [
      "conversations",
      "messages",
      "hebyAnswerEvidenceSets",
      "hebyAnswerEvidenceItems",
    ]) {
      assert.match(
        body,
        new RegExp(`\\btx\\s*\\.?\\s*insert\\(${table}\\)`),
        `${table} is written on the transaction handle`,
      );
    }

    /* The answer layer delegates rather than orchestrating a second sequence of writes. */
    const answer = codeOf(ANSWER);
    assert.ok(answer.includes("repo.persistExchange("), "the answer layer calls the one writer");
    assert.ok(
      !answer.includes("repo.appendMessage("),
      "and no longer appends messages itself — that was the non-atomic path",
    );
  }

  /* ── 7. EVIDENCE COMES FROM THE RUNTIME, NEVER FROM THE MODEL ──────────── */
  {
    const answer = codeOf(ANSWER);
    assert.ok(
      answer.includes("toStoredEvidence(args.knowledgeEvidence)"),
      "what is stored is the server-produced retrieval evidence for this answer",
    );
    /*
     * Nothing anywhere parses the assistant's text to decide what it cited. A model-invented
     * citation therefore has no code path to a row — not a check that could be forgotten, an
     * absence of the mechanism entirely.
     */
    for (const banned of ["citation", "extractRefs", "parseEvidence", "recordRefFrom"]) {
      assert.ok(!answer.includes(banned), `nothing may derive evidence identity from text (${banned})`);
    }
    /* And the client cannot supply evidence: the only client input is a conversation id. */
    assert.ok(
      !/input\.(knowledgeEvidence|evidence|recordRef)/.test(answer),
      "the client cannot hand in evidence",
    );
  }

  /* ── 8. NO STANDALONE EVIDENCE ENDPOINT ───────────────────────────────── */
  {
    /* The conversation boundary is the only gate; a raw evidence id has nowhere to be spent. */
    const actions = readdirSync(join(ROOT, "app", "(dashboard)", "heby"));
    for (const file of actions) {
      const source = read(ROOT, "app", "(dashboard)", "heby", file);
      assert.ok(
        !/evidenceSetId|loadEvidence|getEvidence/i.test(source),
        `${file} must not expose an evidence read of its own`,
      );
    }
    assert.ok(
      codeOf(LOADER).includes("repo.listAnswerEvidence("),
      "evidence is read inside the authorized conversation load",
    );
    const loader = codeOf(LOADER);
    assert.ok(
      loader.indexOf("getConversation") < loader.indexOf("listAnswerEvidence"),
      "and only AFTER conversation ownership has been proven",
    );
  }

  /* ── 9. RELOAD DOES NOT RE-RUN RETRIEVAL OR RE-READ KNOWLEDGE ──────────── */
  {
    const loader = codeOf(LOADER);
    for (const banned of [
      "searchKnowledge",
      "resolveKnowledgeEvidence",
      "buildRetrievalEvidence",
      "knowledge-read.server",
      "durable-knowledge-repository",
    ]) {
      assert.ok(
        !loader.includes(banned),
        `the reload path must not ${banned} — that would substitute today's Knowledge`,
      );
    }
    assert.ok(
      codeOf(PROJECTION).split("\n").every((line) => !line.includes("knowledge-read")),
      "and neither does the projection",
    );
  }

  /* ── 10. IMMUTABLE: NO UPDATE, REGENERATE OR REPAIR PATH ───────────────── */
  {
    const code = codeOf(REPOSITORY);
    for (const banned of [
      "updateAnswerEvidence",
      "regenerateEvidence",
      "refreshEvidence",
      "repairEvidence",
    ]) {
      assert.ok(!code.includes(banned), `historical evidence must have no ${banned}`);
    }
    /* No UPDATE or DELETE is ever issued against either evidence table. */
    assert.ok(
      !/\.update\(hebyAnswerEvidence/.test(code),
      "no update path against the evidence tables",
    );
    assert.ok(
      !/\.delete\(hebyAnswerEvidence/.test(code),
      "and no independent delete — removal follows the parent message by cascade",
    );

    /* The schema declines the mutable-row columns on purpose. */
    for (const mutable of ["updatedAt", "updatedBy", "deletedAt", "version:", "tenantColumns"]) {
      assert.ok(!codeOf(SCHEMA).includes(mutable), `the evidence schema must not carry ${mutable}`);
    }
  }

  /* ── 11. NO SEARCH, VECTOR OR EMBEDDING EXPANSION ──────────────────────── */
  {
    for (const [label, source] of [
      ["the migration", MIGRATION],
      ["the schema", SCHEMA],
      ["the projection", PROJECTION],
      ["the repository", REPOSITORY],
    ] as const) {
      for (const banned of ["pg_trgm", "unaccent", "vector", "embedding", "tsvector", "USING gin", "USING gist"]) {
        assert.ok(
          !source.toLowerCase().includes(banned.toLowerCase()),
          `${label} must not introduce ${banned}`,
        );
      }
    }
  }

  /* ── 12. NO GUIDED LEARNING OR DIRECTOR TWIN INTEGRATION ───────────────── */
  {
    for (const [label, source] of [
      ["the repository", REPOSITORY],
      ["the projection", PROJECTION],
      ["the loader", LOADER],
    ] as const) {
      for (const banned of [
        "guided-learning",
        "director-twin",
        "digital-twin",
        "lessonState",
        "progressState",
        "preference",
      ]) {
        assert.ok(!codeOf(source).includes(banned), `${label} must not reach ${banned}`);
      }
    }
  }

  /* ── 13. THE HISTORICAL FRAME IS PRESENT AND SAYS THE RIGHT THING ──────── */
  {
    /*
     * A preserved snapshot without a frame is a current-state claim. The notice must say both
     * halves: this is what was recorded THEN, and Knowledge may have moved since.
     */
    assert.ok(PANEL.includes("data-heby-evidence-historical-notice"), "the notice is renderable");
    assert.match(
      PANEL,
      /Evidence recorded with this answer, as it stood at the time/,
      "it states that the evidence is the answer's own record",
    );
    assert.match(
      PANEL,
      /current\s*\n?\s*knowledge may have changed since/i,
      "and warns that current Knowledge may differ",
    );

    /* Comparison and deep links stay out — both would re-introduce current state. */
    for (const banned of ["compareCurrent", "currentKnowledge", "href=", "<Link", "viewCurrent"]) {
      assert.ok(!PANEL.includes(banned), `the evidence panel must not add ${banned}`);
    }

    /* A restored turn is historical, and only this session's latest answer is not. */
    const thread = codeOf(THREAD);
    assert.ok(thread.includes("historical: isHeby ? true : undefined"), "restored turns start historical");
    assert.ok(thread.includes("historical: false"), "and only the live latest answer is cleared");
  }

  /* ── 14. NO CAUSAL-USE CLAIM ANYWHERE IN THE COPY ──────────────────────── */
  {
    /*
     * The record says this evidence was admitted and shown. It cannot say the model used any
     * particular item, because that is unobservable — and a record asserting it would be inventing
     * proof of something Hebun never measured.
     */
    for (const banned of [
      "used by the model",
      "the model used",
      "based on this evidence",
      "derived from this record",
    ]) {
      assert.ok(
        !PANEL.toLowerCase().includes(banned.toLowerCase()),
        `the panel must not claim causal model use ("${banned}")`,
      );
    }
  }

  console.log("PASS kr5 boundaries and firewall");
}

main();
