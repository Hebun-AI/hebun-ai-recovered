/*
 * KR4 — what the reader actually sees, and what KR4 was not allowed to change.
 *
 * The rendering assertions run through `renderToStaticMarkup`, which is the strongest UI proof this
 * repository has: there is no browser and no e2e harness here, so a claim about the rendered page is
 * only as good as the markup a test can read. Anything beyond this markup remains unproven.
 *
 * The firewall assertions exist because the failure mode of an evidence UX is not a crash — it is a
 * card that quietly looks more authoritative than the runtime can justify.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HebyEvidenceNotRetained, HebyEvidencePanel } from "../../src/components/layout/heby/heby-evidence";
import { buildTurns } from "../../src/components/layout/heby/heby-thread";
import { buildRetrievalEvidence, type RetrievalEvidenceSet } from "../../src/features/knowledge-retrieval";
import { findKnowledgeCapability } from "../../src/features/knowledge/capability-map";
import type { HebyRuntimeResponse } from "../../src/features/heby-runtime";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";

const ROOT = join(process.cwd(), "src");
const MIGRATIONS = join(process.cwd(), "src", "db", "migrations");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function record(overrides: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord {
  return {
    factId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    factVersion: 1,
    factKey: "ingest:hr-el-kitabi:abc123abc123:2",
    domainKey: "izin",
    scope: "company-wide",
    title: "Yıllık izin hakkı",
    statement: "Çalışanlar yılda 20 gün ücretli izin kullanır.",
    lifecycleStatus: "draft",
    authorityClass: "provisional",
    health: "unknown",
    ratified: false,
    ratifiedAt: null,
    ratificationDecisionId: null,
    governanceSessionId: null,
    ratifiedByActorId: null,
    activeKnowledgeNodeId: "nnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn",
    effectiveFrom: null,
    effectiveUntil: null,
    nextReviewAt: null,
    knowledgeVersion: 1,
    freshness: "unknown",
    provenance: {
      origin: "human-ingested",
      authoredThrough: "hebun-knowledge-workspace",
      submittedAt: "2026-07-01T00:00:00.000Z",
      textOriginUnverified: true,
      sourceType: "policy",
      chunkIndex: 2,
      chunkCount: 7,
    },
    sourceAttribution: {
      sourceTitle: "İnsan Kaynakları El Kitabı",
      sourceType: "policy",
      ingestedByActorType: "human",
      ingestedByActorId: "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu",
      ingestedAt: "2026-07-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

function matchedSet(overrides: Partial<KnowledgeSourceRecord> = {}): RetrievalEvidenceSet {
  return buildRetrievalEvidence(
    {
      status: "matched",
      candidates: [{ record: record(overrides), score: { lexical: 0.4, trigram: null, combined: 0.24 }, sourceDigest: "abc123abc123" }],
      excluded: [],
      diversityPruned: 0,
      truncated: false,
      capability: { lexical: true, trigram: false, degradedReason: null },
    },
    "izin hakkı",
  );
}

function markupOf(set: RetrievalEvidenceSet = matchedSet()): string {
  return renderToStaticMarkup(createElement(HebyEvidencePanel, { set }));
}

const PANEL = join(ROOT, "components", "layout", "heby", "heby-evidence.tsx");

export function run(): void {
  /* ── 1. THE CARD SHOWS STANDING, PROVENANCE AND A REASON ───────────────── */
  {
    const markup = markupOf();

    for (const expected of [
      "Yıllık izin hakkı",                 // title
      "Çalışanlar yılda 20 gün",           // excerpt
      "izin",                              // domain
      "provisional",                       // authority, verbatim from the canonical vocabulary
      "draft",                             // lifecycle
      "no ratification recorded",          // ratification, stated as recorded-or-not
      "freshness: unknown",
      "Matched terms:",                    // the deterministic reason
      "İnsan Kaynakları El Kitabı",        // source attribution
      "Part 2 of 7",                       // chunk position
      "Text origin not verified",          // the most honest line on the card
    ]) {
      assert.ok(markup.includes(expected), `the evidence card must show "${expected}"`);
    }

    /*
     * Standing is THREE separate claims. A merged badge would let a provisional draft borrow the
     * look of an approved policy, which is the entire reason K1 refuses to default these fields.
     */
    assert.ok(markup.includes("provisional") && markup.includes("draft") && markup.includes("no ratification recorded"));
  }

  /* ── 2. NO SCORE, NO CONFIDENCE, NO RATING REACHES THE MARKUP ──────────── */
  {
    const markup = markupOf().toLowerCase();
    for (const banned of [
      "confidence", "trust", "certainty", "quality score", "accuracy",
      "relevance score", "0.24", "combined", "lexical", "trigram",
      "abc123abc123", // sourceDigest — a fingerprint, not an explanation
    ]) {
      assert.ok(!markup.includes(banned), `"${banned}" must never appear beside organizational evidence`);
    }
    // And the ordering caveat is stated rather than left for the reader to infer.
    assert.ok(markupOf().includes("not a measure of truth"), "ordering must disclaim itself");
  }

  /* ── 3. THE FIVE RETRIEVAL STATES RENDER FIVE DIFFERENT SENTENCES ──────── */
  {
    const capability = { lexical: true, trigram: false, degradedReason: null } as const;
    const states: Record<string, string> = {
      "empty-corpus": markupOf(buildRetrievalEvidence({ status: "empty-corpus", capability }, "x")),
      "no-match": markupOf(buildRetrievalEvidence({ status: "no-match", excluded: [], capability }, "x")),
      "empty-query": markupOf(buildRetrievalEvidence({ status: "empty-query", capability }, "???")),
      unavailable: markupOf(
        buildRetrievalEvidence({ status: "unavailable", reason: "read-failed", detail: "boom" }, "x"),
      ),
      matched: markupOf(),
    };

    assert.equal(new Set(Object.values(states)).size, 5, "five states, five distinguishable renders");
    assert.ok(states["empty-corpus"]!.includes("holds no Knowledge records"));
    assert.ok(states["no-match"]!.includes("nothing in it matched this question"));
    assert.ok(states["empty-query"]!.includes("No searchable term"));
    assert.ok(states.unavailable!.includes("could not be read"));

    /*
     * The one substitution this codebase has had to repair three times: telling a person their
     * organization knows nothing because ONE question missed.
     */
    assert.ok(
      !states["no-match"]!.includes("holds no Knowledge records"),
      "a missed question must never be reported as an empty organization",
    );
    for (const markup of Object.values(states)) {
      assert.ok(!markup.toLowerCase().includes("no data"), "no state collapses into a generic empty");
    }
  }

  /* ── 4. TRUNCATION / DIVERSITY / EXCLUSION / DEGRADATION ARE ALL SHOWN ─── */
  {
    const markup = markupOf(
      buildRetrievalEvidence(
        {
          status: "matched",
          candidates: [{ record: record(), score: { lexical: 0.4, trigram: null, combined: 0.24 }, sourceDigest: "abc123abc123" }],
          excluded: [{ factKey: "eski", domainKey: "izin", reason: "expired" }],
          diversityPruned: 2,
          truncated: true,
          capability: { lexical: true, trigram: false, degradedReason: "pg_trgm is not installed." },
        },
        "izin",
      ),
    );
    assert.ok(markup.includes("More eligible Knowledge exists"), "a partial sweep says so");
    assert.ok(markup.includes("2 further passage(s)"), "the diversity cap reports its count");
    assert.ok(markup.includes("1 record(s) matched"), "withheld records are never silent");
    assert.ok(markup.includes("pg_trgm is not installed."), "a component that could not run says so");
  }

  /* ── 5. MULTIPLE SOURCES IS CAUTIOUS, AND NEVER A CONTRADICTION CLAIM ──── */
  {
    const twoSources = buildRetrievalEvidence(
      {
        status: "matched",
        candidates: [
          { record: record({ factKey: "ingest:a:aaa111aaa111:1" }), score: { lexical: 0.4, trigram: null, combined: 0.24 }, sourceDigest: "aaa111aaa111" },
          { record: record({ factKey: "ingest:b:bbb222bbb222:1" }), score: { lexical: 0.3, trigram: null, combined: 0.18 }, sourceDigest: "bbb222bbb222" },
        ],
        excluded: [],
        diversityPruned: 0,
        truncated: false,
        capability: { lexical: true, trigram: false, degradedReason: null },
      },
      "izin",
    );
    const markup = markupOf(twoSources);
    assert.ok(markup.includes("Multiple relevant organizational sources were found"));
    assert.ok(markup.includes("Hebun does not check whether they agree"), "the limit is stated, not implied");

    for (const banned of ["contradict", "conflict", "disagree with", "is wrong", "correct one", "which is true"]) {
      assert.ok(!markup.toLowerCase().includes(banned), `"${banned}" claims a judgement nothing computes`);
    }
    // No winner is picked: BOTH sources are rendered, neither is demoted or merged away.
    assert.equal(twoSources.items.length, 2, "both sources survive — the set never resolves a winner");
    assert.equal((markup.match(/data-heby-evidence-card/g) ?? []).length, 2, "and both are rendered");

    /* The raw fact key is an internal handle, not something a reader needs under an answer. */
    for (const key of ["ingest:a:aaa111aaa111:1", "ingest:b:bbb222bbb222:1"]) {
      assert.ok(!markup.includes(key), "fact keys stay out of the card body");
    }
  }

  /* ── 6. RELOAD HONESTY: A PAST ANSWER SAYS ITS EVIDENCE IS GONE ────────── */
  {
    const response = {
      kind: "EXPLANATION",
      origin: "model",
      title: "t",
      body: ["answer"],
      evidence: [{ sourceClass: "knowledge", recordRef: "izin/izin-hakki", lifecycle: "unknown" }],
      knowledgeEvidence: matchedSet(),
      provenance: [],
      provenanceCovered: [],
      uncertainty: "supported",
      limitations: [],
      authority: "advisory-only",
      modelUsed: true,
    } as unknown as HebyRuntimeResponse;

    const turns = buildTurns(
      [
        { id: "m1", role: "user", content: "eski soru" },
        { id: "m2", role: "assistant", content: "eski cevap" },
        { id: "m3", role: "user", content: "yeni soru" },
        { id: "m4", role: "assistant", content: "yeni cevap" },
      ],
      { userText: "yeni soru", response, durable: true },
    );

    const older = turns.find((turn) => turn.key === "m2")!;
    const latest = turns.find((turn) => turn.key === "m4")!;

    assert.equal(older.historical, true, "a reloaded answer is historical");
    assert.equal(older.knowledgeEvidence, undefined, "and carries no evidence, because none was stored");
    assert.equal(latest.historical, false);
    assert.ok(latest.knowledgeEvidence, "the live answer carries its evidence");

    /*
     * THE POINT. Retrieval is not re-run for the older turn. Re-running it would return TODAY's
     * records — after supersessions, ratifications and expiries the original answer never saw — and
     * presenting those as "the evidence behind this answer" would be a fabricated history.
     */
    const notRetained = renderToStaticMarkup(createElement(HebyEvidenceNotRetained));
    assert.ok(notRetained.includes("not retained"), "the asymmetry is stated, never hidden");
  }

  /* ── 7. THE MODEL STILL CANNOT INVENT EVIDENCE ─────────────────────────── */
  {
    const assembler = read(join(ROOT, "features", "heby-runtime", "evidence-assembler.ts"));
    assert.ok(
      assembler.includes("export function isSupportedEvidence"),
      "the validator that rejects invented references must still exist",
    );
    assert.ok(
      assembler.includes("candidate.recordRef === reference.recordRef"),
      "and must still compare the reference against the RUNTIME-produced set",
    );
    /* KR4 added a presentation field; it must not have become a second identity source. */
    assert.ok(
      !assembler.includes("knowledgeEvidence"),
      "the evidence identity path must not consult the presentation set",
    );
  }

  /* ── 8. THE MESSAGE ROW ITSELF STILL STORES NO EVIDENCE ────────────────── */
  {
    /*
     * KR5 SUPERSEDED HALF OF THIS ASSERTION, BY DIRECTOR DECISION.
     *
     * KR4 stored nothing, and proved it structurally: the explanation was attached to the response
     * only AFTER `persistExchange` had returned, so no writer could reach it even by accident. KR5
     * stores it on purpose — historical evidence is now written inside the same transaction as the
     * assistant message, because a reloaded answer that cannot say what it was given is a worse
     * failure than one that can.
     *
     * WHAT SURVIVES UNCHANGED is the part that was never about storage: the `messages` row gains no
     * evidence column. Evidence lives in its own tables, keyed by message id, so the transcript
     * table stays a transcript and does not become a place to put things.
     */
    const columns = read(join(ROOT, "db", "schema", "conversation.ts"))
      .slice(read(join(ROOT, "db", "schema", "conversation.ts")).indexOf("export const messages"));
    for (const banned of ["jsonb(", "evidence:", "knowledgeEvidence", "retrieval:"]) {
      assert.ok(
        !columns.includes(banned),
        `the messages table must not gain "${banned}" — evidence has its own tables`,
      );
    }

    /* And the evidence that IS written comes from the runtime, never from the model's text. */
    const answer = read(join(ROOT, "features", "heby-answer", "model-answer.server.ts"));
    assert.ok(
      answer.includes("evidence: args.knowledgeEvidence ? toStoredEvidence(args.knowledgeEvidence)"),
      "the persisted set is the server-produced retrieval evidence for this answer",
    );
    assert.ok(
      !/persistExchange[\s\S]{0,2000}response\.body[\s\S]{0,200}(citation|parse|match\()/i.test(answer),
      "nothing parses the response text to decide what evidence was used",
    );
  }

  /* ── 9. KR4 ADDED NO MIGRATION, AND THE EVIDENCE LAYER STILL WRITES NOTHING ─ */
  {
    /*
     * Phase-scoped, not a global count. KR4 genuinely added no migration; KR5 later added one
     * through Gate B, which cannot be allowed to falsify a claim that was never about it.
     */
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
    const PHASE_BOUNDARY = "20260813090642_membership_role_tenant_integrity.sql";
    assert.ok(files.includes(PHASE_BOUNDARY), "the migration KR4 inherited is intact");
    assert.deepEqual(
      files.filter((name) => name > PHASE_BOUNDARY).sort(),
      ["20260815202736_heby_answer_evidence.sql", "20260816063156_r3a_action_authorization.sql", "20260816085245_r3w_durable_work_artifacts.sql", "20260816105458_r3r_durable_recipient_authority.sql", "20260816194116_r3b_action_execution_attempts.sql", "20260817195446_r4a_tenant_provisioning_source.sql", "20260818172455_production_provenance_vocabulary.sql", "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql",
      /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one CREATE TABLE,
       * two foreign keys and three indexes, zero DROP, `knowledge_nodes` untouched. */
      "20260826064423_kr_ext1_knowledge_external_references.sql"],
      "KR4 adds no migration; what follows is a declared later phase",
    );
    const journal = JSON.parse(read(join(MIGRATIONS, "meta", "_journal.json"))) as { entries: unknown[] };
    assert.equal(
      journal.entries.length,
      files.length,
      "the journal and the directory agree — a mismatch is a half-applied phase",
    );

    /* The evidence layer reads nothing and writes nothing: it is a projection of a result. */
    const evidence = read(join(ROOT, "features", "knowledge-retrieval", "evidence.ts"));
    for (const banned of [".insert(", ".update(", ".delete(", "db.transaction(", "getControlPlaneDb", "drizzle"]) {
      assert.ok(!evidence.includes(banned), `evidence.ts must not contain "${banned}"`);
    }
    for (const banned of ["durable-knowledge-writer", "knowledge-ingest.server", "governance", "decision_records"]) {
      assert.ok(!evidence.includes(banned), `evidence.ts must not reach ${banned}`);
    }
    /* And it must not declare the figures Hebun does not compute. */
    for (const banned of ["confidence", "truthScore", "trustScore", "knowledgeQualityScore", "certainty"]) {
      assert.ok(
        !new RegExp(`readonly ${banned}`).test(evidence),
        `the evidence contract must not declare "${banned}"`,
      );
    }
  }

  /* ── 10. /SEARCH, SEMANTIC RETRIEVAL AND EMBEDDINGS STAY UNAVAILABLE ───── */
  {
    for (const capability of ["search", "semantic-retrieval", "embeddings"] as const) {
      assert.equal(
        findKnowledgeCapability(capability).state,
        "not-connected",
        `${capability} must remain not-connected — KR4 explains evidence, it is not enterprise search`,
      );
    }
    /* No search route was created. */
    assert.ok(!existsSync(join(process.cwd(), "src", "app", "(dashboard)", "search")));

    /* And the evidence UI is not a search surface: no query input, no result navigation. */
    const panel = read(PANEL);
    for (const banned of ["<input", "onSubmit", "useState", "fetch(", "href="]) {
      assert.ok(!panel.includes(banned), `the evidence panel must not contain "${banned}" — it renders, it does not search`);
    }
  }

  /* ── 11. GUIDED LEARNING AND DIRECTOR TWIN REMAIN DEFERRED ─────────────── */
  {
    const panel = read(PANEL);
    for (const banned of ["lesson", "curriculum", "progress", "spotlight", "highlight(", "twin", "prediction"]) {
      assert.ok(
        !panel.toLowerCase().includes(banned),
        `KR4 must not import the deferred "${banned}" model`,
      );
    }
    /*
     * Stable data attributes exist so a FUTURE guided surface has something meaningful to target.
     * This is a rendering convention (the same one `data-heby-role` already uses), NOT the semantic
     * anchor contract — defining that remains Guided Learning's own prerequisite.
     */
    assert.ok(panel.includes("data-heby-evidence-card"), "cards carry a stable, meaningful identity");
  }
}

run();
