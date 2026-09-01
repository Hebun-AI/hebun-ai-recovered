/*
 * KR3 — boundaries and firewall.
 *
 * The PostgreSQL suite proves what retrieval DOES. This file proves what it is not allowed to
 * become, by reading the released source rather than trusting a description of it. Every assertion
 * is a promise made in the KR2 architecture gate, locked so that breaking it fails a test rather
 * than quietly shipping.
 *
 * Pure source assertions — no database, no clock, no network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findKnowledgeCapability } from "../../src/features/knowledge/capability-map";
import { HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import {
  RETRIEVAL_MAX_PER_SOURCE,
  RETRIEVAL_WEIGHTS,
  TURKISH_FOLD_FROM,
  TURKISH_FOLD_TO,
} from "../../src/features/knowledge-retrieval";

const RETRIEVAL_DIR = "src/features/knowledge-retrieval";
const REPOSITORY = "src/features/knowledge/durable-knowledge-repository.server.ts";
const READ_SEAM = "src/features/knowledge/knowledge-read.server.ts";
const EVIDENCE = "src/features/heby-answer/knowledge-evidence.server.ts";
const MODEL_ANSWER = "src/features/heby-answer/model-answer.server.ts";

const read = (path: string) => readFileSync(path, "utf8");
/** Strip comments, so prose ABOUT a thing is never mistaken for the thing. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

function collect(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function main(): void {
  /* ── 1. NO SECOND KNOWLEDGE AUTHORITY, AND NO WRITER ───────────────────── */
  {
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) => /\.insert\(knowledgeNodes\)|\.insert\(knowledgeFacts\)/.test(read(file)));
    assert.deepEqual(
      writers.sort(),
      ["src/features/knowledge/durable-knowledge-writer.server.ts"],
      "retrieval added a READER — canonical rows still have exactly one author",
    );

    /* Nothing in the retrieval module or its server seam may write anything, anywhere. */
    for (const file of [...collect(RETRIEVAL_DIR), REPOSITORY, READ_SEAM, EVIDENCE]) {
      const code = codeOf(read(file));
      for (const banned of [".insert(", ".update(", ".delete(", "db.transaction("]) {
        assert.ok(!code.includes(banned), `${file} must not contain "${banned}" — retrieval writes nothing`);
      }
    }
    /* And no relevance figure may be persisted into an authoritative table. */
    assert.ok(
      !/insert[\s\S]{0,200}(lexicalRank|combined|relevance|score)/i.test(codeOf(read(REPOSITORY))),
      "no match score is ever written into a Knowledge table",
    );
  }

  /* ── 2. NO TABLE, NO INDEX, NO MIGRATION, NO EXTENSION ─────────────────── */
  {
    /*
     * KR3 ADDED NO MIGRATION — a claim about KR3, not about the repository forever.
     *
     * This asserted a global count of 24 and that nothing sorted after KR3's boundary. Both were
     * true when written and both are statements about the FUTURE, so the first later phase to pass
     * Gate B legitimately broke them — which is a false failure, not a caught defect. The claim is
     * now scoped to KR3's own window: the boundary it inherited is intact, and KR3 contributed
     * nothing between that boundary and its own end. Later migrations are named, so a phase still
     * cannot add schema silently.
     */
    const migrations = readdirSync("src/db/migrations").filter((name) => name.endsWith(".sql"));
    const PHASE_BOUNDARY = "20260813090642_membership_role_tenant_integrity.sql";
    assert.ok(migrations.includes(PHASE_BOUNDARY), "the migration KR3 inherited is intact");
    assert.deepEqual(
      migrations.filter((name) => name > PHASE_BOUNDARY).sort(),
      [
        /* KR5 historical answer evidence — a later Gate-B phase, declared rather than silent. */
        "20260815202736_heby_answer_evidence.sql",
        "20260816063156_r3a_action_authorization.sql",
        "20260816085245_r3w_durable_work_artifacts.sql", "20260816105458_r3r_durable_recipient_authority.sql", "20260816194116_r3b_action_execution_attempts.sql",
        /* R4A tenant bootstrap ceremony — a later Gate-B phase, declared rather than silent. */
        "20260817195446_r4a_tenant_provisioning_source.sql",
        "20260818172455_production_provenance_vocabulary.sql",
        /* G6D generic answer-source evidence — a declared later phase, not this one's. */
        "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql",
      /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one CREATE TABLE,
       * two foreign keys and three indexes, zero DROP, and `knowledge_nodes` untouched. */
      "20260826064423_kr_ext1_knowledge_external_references.sql",
      "20260828071500_ap4b_origination_invocation_provenance.sql",
      "20260828173456_sia26_origination_agent_attribution.sql",
      "20260828190630_sia3_agent_improvement_hypothesis.sql",
      /* AMA-1 — the Agent Mandate Authority table. A declared later phase, not this one's. */
      "20260831110423_ama1_agent_mandate_authority.sql",
      /* OSA-1 — the departments additive hardening. A declared later phase, not this one's. */
      "20260831212454_osa1_department_structure_authority.sql",
      /* WORK-1 — the Organizational Work Authority table. A declared later phase, not this one's. */
      "20260901122013_work1_organizational_work_authority.sql",
      ],
      "KR3 added no migration; everything after its boundary belongs to a declared later phase",
    );

    /*
     * THE PRODUCTION RUNTIME MAY NOT CREATE ANYTHING. `create extension` and `create index` in
     * application code would turn a read path into a schema change on somebody's first question.
     */
    for (const file of [...collect(RETRIEVAL_DIR), REPOSITORY, READ_SEAM]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of ["create extension", "create index", "create table", "alter table", "drop "]) {
        assert.ok(!code.includes(banned), `${file} must not contain "${banned}"`);
      }
    }
  }

  /* ── 3. NO VECTORS, NO EMBEDDINGS, NO SEMANTIC SEARCH, NO PROVIDER ─────── */
  {
    for (const file of [...collect(RETRIEVAL_DIR), REPOSITORY, READ_SEAM, EVIDENCE]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of [
        "embedding", "pgvector", "cosine", "nearest", "rerank",
        "openai", "anthropic", "@/features/heby-model", "claude-transport",
        "fetch(", "child_process", "readfilesync", "eval(",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not reach ${banned}`);
      }
      /*
       * `vector` needs a word boundary, or it fires on `to_tsvector(` — which is the whole shipped
       * representation. A firewall that bans the thing it is protecting is a firewall that gets
       * deleted, so the pattern has to be exact: a pgvector column type or operator, not a substring.
       */
      for (const banned of [/\bvector\s*\(/, /::\s*vector\b/, /<->/, /<=>/]) {
        assert.ok(!banned.test(code), `${file} must not use ${banned} (pgvector)`);
      }
    }
  }

  /* ── 4. THE EXTENSION IS NOT FAKED, AND ITS ABSENCE IS REPORTED ────────── */
  {
    const repo = codeOf(read(REPOSITORY));
    /*
     * `pg_trgm` is not installed in the canonical database. The runtime must DECLINE to compute the
     * trigram term rather than simulate it in TypeScript — a hand-rolled similarity would be a
     * different measurement wearing the benchmark's number.
     */
    assert.match(repo, /null::real/, "with no pg_trgm the column is a literal NULL");
    assert.match(repo, /pg_extension where extname = 'pg_trgm'/, "and availability is PROBED, not assumed");
    for (const banned of ["trigrams(", "levenshtein", "jaroWinkler", "editDistance", "bigram"]) {
      assert.ok(
        !collect(RETRIEVAL_DIR).some((f) => codeOf(read(f)).includes(banned)),
        `no application-side fuzzy matching (${banned}) — a missing extension stays missing`,
      );
    }
    /* And the product says so, per capability, rather than hiding it behind an identical-looking score. */
    const fuzzy = findKnowledgeCapability("fuzzy-matching");
    assert.equal(fuzzy.state, "not-connected");
    assert.match(fuzzy.authority, /pg_trgm/);
  }

  /* ── 5. /SEARCH STAYS UNAVAILABLE — internal retrieval is not a search product ── */
  {
    const search = HEBY_COMMANDS.find((command) => command.id === "search");
    assert.ok(search, "the /search command is still registered");
    assert.equal(search!.availability, "requires-source", "and is still NOT available");
    /*
     * The reason must name the missing PRODUCT, not a missing ranking — KR3 built the ranking, so
     * a reason claiming otherwise would be false while the verdict it supports stays true.
     */
    assert.match(search!.unavailableReason ?? "", /no search product|no search surface/i);
    assert.ok(
      !/no ranking model|no relevance authority/i.test(search!.unavailableReason ?? ""),
      "the retired premise must not come back",
    );

    for (const capability of ["search", "semantic-retrieval", "embeddings"] as const) {
      assert.equal(
        findKnowledgeCapability(capability).state,
        "not-connected",
        `${capability} must remain not-connected — KR3 authorized evidence retrieval, not enterprise search`,
      );
    }
    /* No search route was created. */
    const routes = collect("src/app").filter((f) => /\/search\//.test(f));
    assert.deepEqual(routes, [], "no /search route implementation exists");
  }

  /* ── 6. ENTERPRISE MEMORY REMAINS A DIFFERENT AUTHORITY ────────────────── */
  {
    /*
     * Enterprise Memory has its OWN retrieval boundary over its OWN records. Importing it here would
     * merge two authorities that model different things — a MemoryRecord is not a knowledge fact —
     * and would do it invisibly, through a type import nobody reviews twice.
     */
    const guarded = [...collect("src/features/knowledge"), ...collect(RETRIEVAL_DIR)];
    assert.ok(guarded.length > 0, "the guarded directories exist");
    for (const file of guarded) {
      const source = read(file);
      assert.ok(
        !source.includes("enterprise-memory-retrieval"),
        `${file} must not import enterprise-memory-retrieval — separate authorities, separate modules`,
      );
      assert.ok(
        !source.includes("enterprise-memory-persistence"),
        `${file} must not reach Enterprise Memory persistence`,
      );
    }
    /* And the reverse: Enterprise Memory must not start reading Knowledge retrieval either. */
    for (const file of collect("src/features/enterprise-memory-retrieval")) {
      assert.ok(
        !read(file).includes("knowledge-retrieval"),
        `${file} must not import knowledge-retrieval`,
      );
    }
  }

  /* ── 7. THE TENANT IS SERVER-DERIVED; THE CLIENT SUPPLIES TEXT AND HINTS ── */
  {
    const contracts = read(join(RETRIEVAL_DIR, "contracts.ts"));
    const requestBlock = contracts.slice(
      contracts.indexOf("export interface RetrievalRequest"),
      contracts.indexOf("/* ── score"),
    );
    for (const banned of [
      "tenantId", "organizationId", "membershipId", "roleId", "userId", "authority",
      "ratified", "lifecycle", "threshold", "trust",
    ]) {
      assert.ok(
        !requestBlock.includes(banned),
        `RetrievalRequest must not carry "${banned}" — that is a server policy, not a caller's input`,
      );
    }
    assert.match(requestBlock, /queryText/);
    assert.match(requestBlock, /domainKey\?/);
    assert.match(requestBlock, /scope\?/);
    assert.match(requestBlock, /limit\?/);

    /* The repository refuses to run without a tenant, and scopes in SQL before ranking. */
    const repo = read(REPOSITORY);
    const searchBlock = repo.slice(repo.indexOf("async searchFacts("));
    assert.match(searchBlock, /UUID_RE\.test\(scope\.tenantId\)/, "a non-uuid tenant never reaches SQL");
    assert.match(
      searchBlock,
      /"knowledge_nodes"\."tenant_id" = \$\{scope\.tenantId\}/,
      "the join is tenant-pinned on the node side",
    );
    assert.match(
      searchBlock,
      /where "knowledge_facts"\."tenant_id" = \$\{scope\.tenantId\}/,
      "and the fact side is filtered in SQL, BEFORE any ranking",
    );
    assert.match(searchBlock, /"knowledge_facts"\."deleted_at" is null/);
    assert.match(searchBlock, /"knowledge_nodes"\."deleted_at" is null/);
  }

  /* ── 8. THERE IS NO TRUTH SCORE, AND NO SCORE IN HEBY'S OWN PROSE ──────── */
  {
    const contracts = read(join(RETRIEVAL_DIR, "contracts.ts"));
    for (const banned of ["confidence", "truthScore", "knowledgeQualityScore", "certainty"]) {
      assert.ok(
        !new RegExp(`readonly ${banned}`).test(contracts),
        `the retrieval contract must not declare "${banned}" — Hebun computes none of them`,
      );
    }
    /*
     * The match score must not enter `detail`, which becomes Heby's OWN prose and is scanned by the
     * response validator. A number printed beside a policy reads as a claim about how true it is.
     */
    const evidence = codeOf(read(EVIDENCE));
    const detailBlock = evidence.slice(evidence.indexOf("detail: ["), evidence.indexOf("].join("));
    for (const banned = "score", banned2 = "combined"; ;) {
      assert.ok(!detailBlock.includes(banned), "no score in the evidence detail line");
      assert.ok(!detailBlock.includes(banned2), "and no combined figure either");
      break;
    }
    /* Standing still travels, unflattened. */
    for (const kept of ["authority:", "lifecycle:", "ratified:", "freshness:", "scope:"]) {
      assert.ok(detailBlock.includes(kept), `${kept} must still travel with every item`);
    }
  }

  /* ── 9. THE MEASURED CONSTANTS ARE THE MEASURED CONSTANTS ──────────────── */
  {
    assert.equal(RETRIEVAL_WEIGHTS.LEXICAL, 0.6, "the KR2-measured blend, frozen");
    assert.equal(RETRIEVAL_WEIGHTS.TRIGRAM, 0.4);
    assert.equal(RETRIEVAL_MAX_PER_SOURCE, 2, "the measured per-source cap");
    assert.equal(TURKISH_FOLD_FROM.length, TURKISH_FOLD_TO.length,
      "translate() maps character-for-character; a length mismatch silently DROPS characters");
    assert.equal(TURKISH_FOLD_FROM.length, 13, "the thirteen Turkish letters, and only those");
  }

  /* ── 10. THE QUESTION REACHES THE EVIDENCE, AND NOTHING ELSE MOVED ─────── */
  {
    const answer = codeOf(read(MODEL_ANSWER));
    assert.match(
      answer,
      /withKnowledge\([\s\S]{0,200}validation\.prompt/,
      "the VALIDATED prompt is what reaches retrieval — never the raw client input",
    );
    /*
     * The prompt is validated before it can travel anywhere. Anchored on `await withKnowledge(` —
     * the CALL — because `withKnowledge(` alone finds the function declaration, which sits above
     * the validation and would make this assertion measure source layout instead of order of
     * operations.
     */
    assert.ok(
      answer.indexOf("validateHebyPrompt(input.prompt)") < answer.indexOf("await withKnowledge("),
      "validation happens BEFORE the question is used as a search term",
    );
    /* Downstream is untouched: the same assembly, grounding, validator and persistence. */
    for (const unchanged of ["assembleEvidence(", "groundingLines(", "validateResponse("]) {
      assert.ok(answer.includes(unchanged), `${unchanged} still runs — retrieval changed WHICH records, not the path`);
    }
    /* Heby cannot write Knowledge: no Heby module imports the writer or the ingestion producer. */
    const hebyModules = collect("src/features").filter((file) => /heby/.test(file));
    for (const file of hebyModules) {
      const source = read(file);
      assert.ok(!source.includes("durable-knowledge-writer"), `${file} must not reach the Knowledge writer`);
      assert.ok(!source.includes("knowledge-ingest.server"), `${file} must not reach the ingestion producer`);
    }
  }

  /* ── 11. THE FOUR EMPTY STATES ARE FOUR, NOT ONE ───────────────────────── */
  {
    const evidence = read(EVIDENCE);
    /*
     * The regression this guards is specific and has happened three times in this codebase: a status
     * line that describes the CORPUS when the truth is about the QUESTION. "Your organization holds
     * no knowledge records" must be reachable ONLY from empty-corpus.
     */
    const emptyCorpusBlock = evidence.slice(
      evidence.indexOf('case "empty-corpus"'),
      evidence.indexOf('case "no-match"'),
    );
    const noMatchBlock = evidence.slice(
      evidence.indexOf('case "no-match"'),
      evidence.indexOf('case "matched"'),
    );
    assert.match(emptyCorpusBlock, /holds no knowledge records/);
    assert.ok(
      !/holds no knowledge records/.test(noMatchBlock),
      "NO-MATCH must never claim the organization holds nothing",
    );
    assert.match(noMatchBlock, /holds knowledge records, but none of them match/);
    assert.ok(
      !/none of them match/.test(emptyCorpusBlock),
      "and an EMPTY CORPUS must never claim the question missed",
    );
    for (const state of ["empty-query", "empty-corpus", "no-match", "matched", "unavailable"]) {
      assert.ok(evidence.includes(`"${state}"`), `${state} is handled explicitly`);
    }
  }

  console.log("PASS kr3 boundaries and firewall");
}

main();
