/*
 * K1 — the Knowledge AUTHORITY proofs.
 *
 * The central claim K1 has to survive is architectural, not behavioural: Hebun gained a Knowledge
 * READ, and it did NOT gain a second Knowledge system. These proofs are made against the shipped
 * source, so a later phase cannot quietly grow a duplicate store, a parallel persistence model, a
 * vector index, or a fabricated confidence figure without failing here.
 *
 * Pure. No database, no network, no key, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  deriveKnowledgeFreshness,
  KNOWLEDGE_PROVENANCE,
  type KnowledgeSourceRecord,
} from "../../src/features/knowledge/contracts";
import {
  findKnowledgeCapability,
  hasConnectedKnowledgeCapability,
  listKnowledgeCapabilities,
} from "../../src/features/knowledge/capability-map";
import { toKnowledgeResolution } from "../../src/features/heby-answer/knowledge-evidence.server";

const read = (path: string) => readFileSync(path, "utf8");

const CONTRACTS = "src/features/knowledge/contracts.ts";
const CAPABILITY_MAP = "src/features/knowledge/capability-map.ts";
const REPOSITORY = "src/features/knowledge/durable-knowledge-repository.server.ts";
const READ_SERVICE = "src/features/knowledge/knowledge-read.server.ts";
const EVIDENCE = "src/features/heby-answer/knowledge-evidence.server.ts";

const K1_MODULES = [CONTRACTS, CAPABILITY_MAP, REPOSITORY, READ_SERVICE, EVIDENCE];

/** Code with comments stripped — the docs legitimately name things the code must not do. */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function record(overrides: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord {
  return {
    factId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    factVersion: 1,
    factKey: "security-policy",
    domainKey: "security",
    scope: "company-wide",
    title: "Security policy",
    statement: "Access is granted per role.",
    lifecycleStatus: "ratified",
    authorityClass: "authoritative",
    health: "current",
    ratified: true,
    ratifiedAt: "2026-01-01T00:00:00.000Z",
    ratificationDecisionId: null,
    governanceSessionId: null,
    ratifiedByActorId: null,
    activeKnowledgeNodeId: null,
    effectiveFrom: null,
    effectiveUntil: null,
    nextReviewAt: null,
    knowledgeVersion: 1,
    freshness: "unknown",
    ...overrides,
  };
}

function main(): void {
  /* ── 1. THE EXISTING AUTHORITY IS REUSED — no new table, no new persistence ── */
  {
    const repository = read(REPOSITORY);
    // It reads the canonical Knowledge model that already exists, through the R1 control-plane DB.
    assert.ok(
      repository.includes('from "@/db/schema/knowledge-fact"') &&
        repository.includes('from "@/db/schema/knowledge"'),
      "the repository reads the EXISTING canonical knowledge_facts / knowledge_nodes schema",
    );
    assert.ok(
      repository.includes('from "@/db/client.server"'),
      "and reuses the R1 control-plane client, not a second persistence framework",
    );

    const code = codeOf(repository);
    /*
     * A read repository that can write is not a read repository.
     *
     * `execute(` USED TO BE ON THIS LIST and no longer is, and the reason matters. It was standing
     * in for "no writes" back when every statement here went through the Drizzle query builder, so
     * any raw execution at all was suspicious. KR3's retrieval statement is raw SQL — ts_rank_cd and
     * websearch_to_tsquery have no builder equivalent — and it is a SELECT. Banning the word would
     * ban a read, which is the opposite of this check's intent.
     *
     * So the guard now tests the intent directly: no mutating verb, in the builder OR in raw SQL.
     * A proxy that has started catching the wrong thing is worse than no proxy, because it gets
     * deleted wholesale by whoever it blocks.
     */
    for (const banned of ["insert(", "update(", "delete(", "drop ", "create table", "transaction("]) {
      assert.ok(
        !code.toLowerCase().includes(banned),
        `${REPOSITORY} must not contain "${banned}" — K1 is read-only`,
      );
    }
    /* And no raw statement may mutate, however it is executed. */
    for (const mutating of [/\binsert\s+into\b/i, /\bupdate\s+\w+\s+set\b/i, /\bdelete\s+from\b/i, /\bcreate\s+/i, /\balter\s+/i]) {
      assert.ok(
        !mutating.test(code),
        `${REPOSITORY} must not contain raw SQL matching ${mutating} — K1 is read-only`,
      );
    }
  }

  /* ── 2. NO SECOND KNOWLEDGE SYSTEM ────────────────────────────────────────
   * No K1 module may define a table, an index, a store, an embedding, or a vector. The capability
   * map is exempt from the *vocabulary* ban and only from that, because its whole job is to NAME
   * these capabilities as absent — and check 7 proves it only ever declares them not-connected.
   */
  {
    const VENDORS = [
      "pgvector", "vectorstore", "pinecone", "weaviate", "qdrant", "chromadb", "milvus",
      "elasticsearch", "opensearch",
    ];
    for (const file of K1_MODULES) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of ["pgtable(", "pgenum(", "createindex", ...VENDORS]) {
        assert.ok(!code.includes(banned), `${file} must not introduce "${banned}"`);
      }
      if (file === CAPABILITY_MAP) continue;
      for (const banned of ["embedding", "chunk("]) {
        assert.ok(!code.includes(banned), `${file} must not introduce "${banned}"`);
      }
      /*
       * `vector` needs a word boundary. As a bare substring it fires on `to_tsvector(` — the
       * PostgreSQL built-in that IS the shipped lexical representation — so the plain ban would
       * forbid the very thing it exists to protect. What must stay out is pgvector: its column
       * type and its distance operators.
       */
      for (const banned of [/\bvector\s*\(/, /::\s*vector\b/, /pgvector/, /<->/, /<=>/]) {
        assert.ok(!banned.test(code), `${file} must not introduce ${banned} (pgvector)`);
      }
    }
  }

  /* ── 3. NO NEW MIGRATION, NO NEW DEPENDENCY ──────────────────────────────── */
  {
    const migrations = readdirSync("src/db/migrations").filter((name) => name.endsWith(".sql"));
    // Phase-scoped, not a global count: K1 must add no migration of its OWN, and
    // the tables it reads must come from the pre-existing foundation migrations.
    assert.ok(
      migrations.includes("20260711203301_knowledge_reconciliation_foundation.sql"),
      "knowledge_facts came from the pre-existing reconciliation migration",
    );
    assert.ok(
      migrations.includes("20260711173046_foundation_baseline.sql"),
      "knowledge_nodes came from the pre-existing baseline migration",
    );
    for (const name of migrations) {
      assert.ok(
        !/k1|knowledge[-_]?read|knowledge[-_]?source/i.test(name),
        `K1 adds no migration — the canonical Knowledge tables already exist (found ${name})`,
      );
    }
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
    for (const banned of [
      "pgvector", "@pinecone-database/pinecone", "weaviate-ts-client", "@qdrant/js-client-rest",
      "chromadb", "@elastic/elasticsearch", "openai", "@anthropic-ai/sdk",
    ]) {
      assert.ok(!names.includes(banned), `K1 adds no "${banned}" dependency`);
    }
  }

  /* ── 4. THE SEEDED KNOWLEDGE STORE IS NEVER THE SOURCE ────────────────────
   * knowledge-crud / knowledge-graph are in-memory stores seeded from a mock registry, and one of
   * them even derives a `confidence` figure from mock health. K1 must never read them.
   */
  {
    for (const file of K1_MODULES) {
      const src = read(file);
      for (const banned of [
        "@/features/knowledge-crud",
        "@/features/knowledge-graph",
        "@/features/knowledge-domain",
        "@/features/knowledge-read-facade",
        "@/features/knowledge-canonical-repository",
        "@/features/registries",
      ]) {
        assert.ok(!src.includes(banned), `${file} must not read the seeded store "${banned}"`);
      }
    }
  }

  /* ── 5. NO FABRICATED CONFIDENCE, RELEVANCE, OR SCORE ─────────────────────
   * The contract must not even have a field for one — this is structural, not a discipline.
   */
  {
    const code = codeOf(read(CONTRACTS)).toLowerCase();
    for (const banned of ["confidence", "relevance", "score", "trustlevel", "matchstrength", "rank"]) {
      assert.ok(!code.includes(banned), `the Knowledge contract must not carry "${banned}"`);
    }
    const sample = record();
    assert.ok(!("confidence" in sample), "a knowledge record carries no confidence");
    assert.ok(!("relevance" in sample), "a knowledge record carries no relevance");
  }

  /* ── 6. FRESHNESS IS DERIVED, NEVER INVENTED ─────────────────────────────── */
  {
    const now = new Date("2026-06-01T00:00:00.000Z");
    assert.equal(
      deriveKnowledgeFreshness({ effectiveFrom: null, effectiveUntil: null, nextReviewAt: null }, now),
      "unknown",
      "no timestamps means unknown freshness — never a flattering default",
    );
    assert.equal(
      deriveKnowledgeFreshness(
        { effectiveFrom: null, effectiveUntil: null, nextReviewAt: "2026-01-01T00:00:00.000Z" },
        now,
      ),
      "review-overdue",
    );
    assert.equal(
      deriveKnowledgeFreshness(
        { effectiveFrom: null, effectiveUntil: null, nextReviewAt: "2026-12-01T00:00:00.000Z" },
        now,
      ),
      "within-cadence",
    );
    assert.equal(
      deriveKnowledgeFreshness(
        { effectiveFrom: null, effectiveUntil: "2026-02-01T00:00:00.000Z", nextReviewAt: null },
        now,
      ),
      "expired",
    );
    assert.equal(
      deriveKnowledgeFreshness(
        { effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveUntil: null, nextReviewAt: null },
        now,
      ),
      "not-yet-effective",
    );
    // A malformed timestamp is not silently treated as fresh.
    assert.equal(
      deriveKnowledgeFreshness({ effectiveFrom: null, effectiveUntil: null, nextReviewAt: "soon" }, now),
      "unknown",
    );
  }

  /* ── 7. CAPABILITIES ARE REPORTED SEPARATELY, NEVER COLLAPSED ────────────── */
  {
    const capabilities = listKnowledgeCapabilities();
    assert.equal(capabilities.length, 8, "eight Knowledge capabilities are reported separately");

    assert.equal(findKnowledgeCapability("source-listing").state, "connected");
    assert.equal(findKnowledgeCapability("source-read").state, "connected");
    /*
     * KR3 added TWO, and it added them as a pair on purpose. `retrieval` is connected because the
     * question now selects the evidence. `fuzzy-matching` is NOT, because `pg_trgm` is absent from
     * the database and no trigram similarity is computed at all. Reporting only the first would be
     * the collapse this file exists to prevent — a capability that works for correctly spelled
     * questions is not "matching works".
     */
    assert.equal(findKnowledgeCapability("retrieval").state, "connected");
    assert.equal(findKnowledgeCapability("fuzzy-matching").state, "not-connected");
    /* And retrieval must not quietly become a search claim. */
    const retrieval = findKnowledgeCapability("retrieval");
    assert.match(retrieval.cannotProve, /TEXT-MATCH|text-match/i, "rank is a match, never truth");
    assert.match(
      retrieval.cannotProve,
      /never that your organization holds no knowledge/i,
      "and a miss is about the question, never about the corpus",
    );
    /*
     * Ingestion is connected because a governed plain-text path now writes canonical Knowledge
     * through the K2 writer. It is the ONLY capability that has moved, and the block below holds
     * its copy to the slice that actually exists — a connected state must not become a licence to
     * imply upload, connectors or retrieval.
     */
    assert.equal(findKnowledgeCapability("ingestion").state, "connected");
    // These are the claims K1 must STILL NOT make.
    assert.equal(findKnowledgeCapability("search").state, "not-connected");
    assert.equal(findKnowledgeCapability("semantic-retrieval").state, "not-connected");
    assert.equal(findKnowledgeCapability("embeddings").state, "not-connected");

    /* Connected does not mean wide: what ingestion claims stays inside the implemented slice. */
    const ingestion = findKnowledgeCapability("ingestion");
    /*
     * ── REPAIRED BY R4C.1 ────────────────────────────────────────────────────
     *
     * `upload` and `file` were on this list because neither existed, and that was true when it was
     * written. R4C.1 built one — a manual, bounded, strictly-decoded UTF-8 `.txt`/`.md` upload — so
     * continuing to forbid those words in `canProve` would force the capability map to UNDER-report
     * a real capability. That is the same failure as overclaiming, pointed the other way, and this
     * check exists to catch either.
     *
     * The list keeps every term that is still a fiction and gains the formats and behaviours the
     * phase deliberately did NOT build — which is exactly where the next overclaim would come from.
     *
     * R4C.2 removed `/pdf/i` for the same reason `/file/i` went before it: a text-bearing PDF is
     * genuinely readable now, so forbidding the word would force the map to UNDER-report. `ocr`,
     * `scanned`, `docx` and the storage and automation terms all stay, because all of them are
     * still fiction.
     */
    for (const overclaim of [
      /\burl\b/i,
      /connector/i,
      /embedding/i,
      /semantic/i,
      /search/i,
      /docx/i,
      /\bocr\b/i,
      /storage|stored/i,
      /scanned/i,
      /automatic|scheduled|sync\b/i,
    ]) {
      assert.ok(
        !overclaim.test(ingestion.canProve),
        `ingestion must not claim ${overclaim} in what it CAN prove — none of it exists`,
      );
    }
    assert.match(ingestion.canProve, /provisional/i, "and it states the standing it writes");
    assert.match(
      ingestion.canProve,
      /\.txt|\.md/,
      "and where it does claim a file, it names the only formats that can actually be read",
    );
    for (const denial of [/ratif/i, /upload/i, /url/i, /connector/i, /documents/i, /embedding/i, /semantic/i]) {
      assert.match(
        ingestion.cannotProve,
        denial,
        `ingestion must state ${denial} among the things it cannot prove`,
      );
    }

    assert.ok(hasConnectedKnowledgeCapability(), "at least one capability is genuinely connected");
    // Every capability must be able to state what it cannot prove.
    for (const capability of capabilities) {
      assert.ok(capability.canProve.length > 0, `${capability.capability} states what it can prove`);
      assert.ok(capability.cannotProve.length > 0, `${capability.capability} states what it cannot`);
      assert.ok(capability.authority.length > 0, `${capability.capability} names its authority`);
    }
    // The phrase K1 forbids must not appear anywhere in the map.
    assert.ok(
      !read(CAPABILITY_MAP).toLowerCase().includes("knowledge connected."),
      'the capability map never says "Knowledge connected"',
    );
  }

  /* ── 8. PROVENANCE CARRIES THE PRECEDENCE RULE ───────────────────────────── */
  {
    assert.match(KNOWLEDGE_PROVENANCE, /knowledge_facts/, "provenance names the real authority");
    assert.match(KNOWLEDGE_PROVENANCE, /tenant-scoped/, "and that it is tenant-scoped");
    assert.match(
      KNOWLEDGE_PROVENANCE,
      /NOT a statement of current/i,
      "and states that knowledge never speaks for the current runtime",
    );
  }

  /* ── 9. AUTHORITATIVE vs DERIVED vs PROVISIONAL SURVIVES INTO EVIDENCE ───── */
  {
    const authoritative = toKnowledgeResolution({
      status: "read",
      records: [record()],
      incomplete: [],
      truncated: false,
    });
    assert.equal(authoritative.state, "resolved");
    assert.equal(authoritative.authoritative, true);
    assert.equal(authoritative.items[0]?.lifecycle, "settled");
    assert.match(authoritative.items[0]!.detail, /authority: authoritative/);
    assert.equal(authoritative.provenance, KNOWLEDGE_PROVENANCE);

    // A provisional record NEVER makes the source authoritative, and says so per item.
    const provisional = toKnowledgeResolution({
      status: "read",
      records: [record({ authorityClass: "provisional", lifecycleStatus: "draft", ratified: false })],
      incomplete: [],
      truncated: false,
    });
    assert.equal(provisional.authoritative, false, "provisional knowledge is not authoritative");
    assert.equal(provisional.items[0]?.lifecycle, "unknown", "a draft is not settled");
    assert.match(provisional.items[0]!.detail, /authority: provisional/);
    assert.match(provisional.items[0]!.detail, /ratified: no/);

    // A mixed set is conservative at the resolution level.
    const mixed = toKnowledgeResolution({
      status: "read",
      records: [record(), record({ factKey: "b", authorityClass: "provisional" })],
      incomplete: [],
      truncated: false,
    });
    assert.equal(mixed.authoritative, false, "one provisional record demotes the whole source");

    // Superseded and retired keep their own standing rather than reading as settled.
    for (const [status, expected] of [
      ["superseded", "superseded"],
      ["retired", "retired"],
      ["archived", "retired"],
      ["deprecated", "retired"],
      ["proposed", "unknown"],
      [null, "unknown"],
    ] as const) {
      const mapped = toKnowledgeResolution({
        status: "read",
        records: [record({ lifecycleStatus: status })],
        incomplete: [],
        truncated: false,
      });
      assert.equal(mapped.items[0]?.lifecycle, expected, `lifecycle ${status} → ${expected}`);
    }
  }

  /* ── 10. AN EMPTY OR FAILED READ NEVER BECOMES EVIDENCE ──────────────────── */
  {
    const empty = toKnowledgeResolution({
      status: "read",
      records: [],
      incomplete: [],
      truncated: false,
    });
    assert.equal(empty.state, "unavailable", "an empty organization yields no evidence");
    assert.equal(empty.items.length, 0);
    assert.match(empty.unavailableReason!, /no knowledge records/i);
    assert.match(
      empty.unavailableReason!,
      /read and is genuinely empty/i,
      "and says the authority was READ, so an empty corpus is not a read failure",
    );
    /*
     * AN EMPTY CORPUS IS NOT A MISSING CAPABILITY. This sentence used to claim no ingestion path
     * existed; one does, and the negative lock is what stops that claim coming back.
     */
    assert.ok(
      !/no ingestion path|nothing can add knowledge|nothing to ingest/i.test(empty.unavailableReason!),
      "and never says ingestion is absent — it exists, and this is the person who could use it",
    );

    const failed = toKnowledgeResolution({
      status: "unavailable",
      reason: "persistence-not-configured",
      detail: "Durable persistence is not configured.",
    });
    assert.equal(failed.state, "unavailable");
    assert.equal(failed.items.length, 0, "a failed read fabricates nothing");
    assert.match(failed.unavailableReason!, /persistence-not-configured/);

    // A fact whose content is unreadable is NEVER promoted into a readable record.
    const partial = toKnowledgeResolution({
      status: "read",
      records: [],
      incomplete: [{ factId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", factKey: "x", domainKey: "d", scope: "domain", reason: "active-node-missing" }],
      truncated: false,
    });
    assert.equal(partial.state, "unavailable", "an unreadable fact contributes no evidence");
    assert.equal(partial.items.length, 0);
  }

  console.log("k1 knowledge-authority checks passed");
}

main();
