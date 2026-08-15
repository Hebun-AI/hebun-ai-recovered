/*
 * KR3 — the PURE retrieval layer, proven without a database.
 *
 * Everything retrieval DECIDES is pure: which records are eligible, how components blend, how one
 * source is bounded, how a Turkish question becomes a search query. That is the point of keeping the
 * module pure — the decisions can be proven exhaustively here, and the PostgreSQL suite is then free
 * to prove only what PostgreSQL actually contributes.
 *
 * No database, no clock of its own, no network, no model.
 */
import assert from "node:assert/strict";
import {
  RETRIEVAL_DEFAULT_LIMIT,
  RETRIEVAL_MAX_LIMIT,
  RETRIEVAL_MAX_PER_SOURCE,
  RETRIEVAL_WEIGHTS,
  applySourceDiversity,
  combineScore,
  exclusionReasonFor,
  foldTurkish,
  normalizeQuery,
  partitionByEligibility,
  rankCandidates,
  resolveRetrievalLimit,
  sourceDigestOf,
  squash,
  toCandidate,
} from "../../src/features/knowledge-retrieval";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";

const NOW = new Date("2026-08-15T12:00:00.000Z");

function record(overrides: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord {
  return {
    factId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    factVersion: 1,
    factKey: "izin-hakki",
    domainKey: "izin",
    scope: "company-wide",
    title: "Yıllık izin hakkı",
    statement: "1-5 yıl kıdemde 14 gün yıllık ücretli izin hakkı doğar.",
    lifecycleStatus: "ratified",
    authorityClass: "authoritative",
    health: "current",
    ratified: true,
    ratifiedAt: null,
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
  /* ── 1. THE TURKISH FOLD, INCLUDING THE DEFECT IT EXISTS FOR ───────────── */
  {
    assert.equal(foldTurkish("ÇĞİIÖŞÜ"), "CGIIOSU");
    assert.equal(foldTurkish("çğıöşü"), "cgiosu");
    /*
     * The whole reason this exists: PostgreSQL's `turkish` configuration leaves the dotted capital
     * İ unlowercased and unstemmed, so an uppercase question matches nothing. After folding, the
     * dotted capital, the dotless capital and the dotless lowercase all converge on one letter.
     */
    assert.equal(foldTurkish("İZİN").toLowerCase(), "izin");
    assert.equal(foldTurkish("IZIN").toLowerCase(), "izin");
    assert.equal(foldTurkish("ızın").toLowerCase(), "izin");
    assert.equal(foldTurkish("izin"), "izin");
    /* Characters outside the table are carried through untouched, not dropped. */
    assert.equal(foldTurkish("café 42 —"), "café 42 —");
  }

  /* ── 2. QUERY NORMALIZATION IS OR-JOINED, NOT CONJUNCTIVE ─────────────── */
  {
    const q = normalizeQuery("Yıllık izin talebi kime gönderilir");
    /*
     * `kime` is a question word: it lives in questions and essentially never in policies, so OR-ing
     * it in only adds rank noise. Everything else is a content word and survives untouched.
     */
    assert.deepEqual(q.tokens, ["Yillik", "izin", "talebi", "gonderilir"]);
    assert.equal(q.orForm, "Yillik or izin or talebi or gonderilir");
    assert.equal(q.raw, "Yıllık izin talebi kime gönderilir", "the human's words are preserved");
    assert.equal(q.isEmpty, false);

    /* Operator characters cannot leak into websearch_to_tsquery and negate half the question. */
    assert.deepEqual(normalizeQuery('-izin "hakkı"').tokens, ["izin", "hakki"]);
    /* Reserved booleans are dropped rather than becoming operators. */
    assert.deepEqual(normalizeQuery("izin and hakkı").tokens, ["izin", "hakki"]);

    /* A question of nothing but question words is EMPTY, never a match-all. */
    const nothing = normalizeQuery("ne nasıl kim ???");
    assert.equal(nothing.isEmpty, true);
    assert.equal(nothing.orForm, "");
    assert.equal(normalizeQuery("   ").isEmpty, true);
  }

  /* ── 3. ELIGIBILITY EXCLUDES ONLY WHAT IS OUT OF FORCE ────────────────── */
  {
    const day = 24 * 60 * 60 * 1000;
    const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * day).toISOString();

    assert.equal(exclusionReasonFor(record(), NOW), null, "a plain current record is eligible");
    assert.equal(exclusionReasonFor(record({ lifecycleStatus: "archived" }), NOW), "lifecycle-archived");
    assert.equal(exclusionReasonFor(record({ lifecycleStatus: "retired" }), NOW), "lifecycle-retired");
    assert.equal(exclusionReasonFor(record({ effectiveUntil: iso(-1) }), NOW), "expired");
    assert.equal(exclusionReasonFor(record({ effectiveFrom: iso(+1) }), NOW), "not-yet-effective");

    /* A record still inside its window is eligible on both bounds. */
    assert.equal(
      exclusionReasonFor(record({ effectiveFrom: iso(-10), effectiveUntil: iso(+10) }), NOW),
      null,
    );

    /*
     * THE FILTERS THAT MUST NOT EXIST. Filtering on ratification would return nothing (the canonical
     * database holds zero ratified rows) and filtering on unverified origin would empty the corpus
     * (every authored and ingested record carries it). Standing is reported, never used to hide.
     */
    for (const standing of [
      { lifecycleStatus: "draft" as const, authorityClass: "provisional" as const, ratified: false },
      { lifecycleStatus: "proposed" as const, authorityClass: "provisional" as const, ratified: false },
      { lifecycleStatus: "under-review" as const, health: "contested" as const },
      { health: "stale" as const },
      { lifecycleStatus: "deprecated" as const },
      { ratified: false, ratificationDecisionId: null },
    ]) {
      assert.equal(
        exclusionReasonFor(record(standing), NOW),
        null,
        `${JSON.stringify(standing)} must remain a CANDIDATE — standing is a signal, not a gate`,
      );
    }

    /* Partitioning reports what it removed, so a shortened answer is never mysterious. */
    const split = partitionByEligibility(
      [
        record({ factKey: "current" }),
        record({ factKey: "gone", lifecycleStatus: "retired" }),
        record({ factKey: "old", effectiveUntil: iso(-5) }),
      ],
      NOW,
    );
    assert.deepEqual(split.eligible.map((r) => r.factKey), ["current"]);
    assert.deepEqual(
      split.excluded.map((e) => `${e.factKey}:${e.reason}`),
      ["gone:lifecycle-retired", "old:expired"],
    );
  }

  /* ── 4. THE SCORE IS A BLEND, AND A MISSING COMPONENT IS MISSING ──────── */
  {
    assert.equal(squash(0), 0);
    assert.ok(squash(1) === 0.5 && squash(3) === 0.75, "r/(r+1) squashes into 0..1");
    assert.ok(squash(10) > squash(2), "and stays monotonic, so it never reorders");

    /*
     * With no trigram the lexical term IS the score — not 0.6 of it. Scaling every score down by a
     * constant would change no ordering and make the number incomparable between databases.
     */
    const lexicalOnly = combineScore(1, null);
    assert.equal(lexicalOnly.trigram, null, "not computed is null, NEVER a substituted zero");
    assert.equal(lexicalOnly.combined, lexicalOnly.lexical);

    const hybrid = combineScore(1, 0.5);
    assert.equal(
      hybrid.combined,
      RETRIEVAL_WEIGHTS.LEXICAL * 0.5 + RETRIEVAL_WEIGHTS.TRIGRAM * 0.5,
      "the measured 0.6/0.4 blend, frozen",
    );
    assert.equal(RETRIEVAL_WEIGHTS.LEXICAL, 0.6);
    assert.equal(RETRIEVAL_WEIGHTS.TRIGRAM, 0.4);

    /* Components stay separate on the way out so no consumer can read the blend as truth. */
    assert.ok("lexical" in hybrid && "trigram" in hybrid && "combined" in hybrid);
    assert.ok(
      !("confidence" in hybrid) && !("truthScore" in hybrid),
      "there is no confidence or truth figure, because Hebun computes neither",
    );
  }

  /* ── 5. RANKING IS DETERMINISTIC ──────────────────────────────────────── */
  {
    const ranked = rankCandidates([
      toCandidate({ record: record({ factKey: "b", domainKey: "z" }), lexicalRank: 1, trigram: null }),
      toCandidate({ record: record({ factKey: "a", domainKey: "z" }), lexicalRank: 1, trigram: null }),
      toCandidate({ record: record({ factKey: "c", domainKey: "a" }), lexicalRank: 1, trigram: null }),
      toCandidate({ record: record({ factKey: "d", domainKey: "z" }), lexicalRank: 9, trigram: null }),
    ]);
    assert.deepEqual(
      ranked.map((c) => c.record.factKey),
      ["d", "c", "a", "b"],
      "score first, then domain, then fact key — the SAME tie-break the K1 listing uses",
    );
    /* Reproducibility is what makes a bad result reportable. */
    assert.deepEqual(rankCandidates(ranked).map((c) => c.record.factKey), ranked.map((c) => c.record.factKey));
  }

  /* ── 6. SOURCE IDENTITY COMES OUT OF THE FACT KEY, WITH NO SCHEMA ─────── */
  {
    assert.equal(sourceDigestOf("ingest:el-kitabi:7c1f4b9ad3e2:0"), "7c1f4b9ad3e2");
    assert.equal(sourceDigestOf("ingest:el-kitabi:7c1f4b9ad3e2:39"), "7c1f4b9ad3e2");
    assert.equal(sourceDigestOf("izin-hakki"), null, "a hand-authored fact has no source document");
    assert.equal(sourceDigestOf("ingest:broken"), null, "a malformed key yields null, never a guess");
  }

  /* ── 7. DIVERSITY CAPS A SOURCE; IT NEVER MERGES OR RESOLVES ──────────── */
  {
    const chunk = (i: number, digest: string, rank: number) =>
      toCandidate({
        record: record({ factKey: `ingest:doc:${digest}:${i}`, domainKey: "satinalma" }),
        lexicalRank: rank,
        trigram: null,
      });

    const outcome = applySourceDiversity(
      rankCandidates([
        chunk(0, "aaaaaaaaaaaa", 9),
        chunk(1, "aaaaaaaaaaaa", 8),
        chunk(2, "aaaaaaaaaaaa", 7),
        chunk(3, "aaaaaaaaaaaa", 6),
        chunk(0, "bbbbbbbbbbbb", 5),
      ]),
    );
    assert.equal(outcome.pruned, 2, "the cap fired and SAID SO");
    assert.equal(outcome.kept.length, 3);
    assert.equal(
      outcome.kept.filter((c) => c.sourceDigest === "aaaaaaaaaaaa").length,
      RETRIEVAL_MAX_PER_SOURCE,
    );
    /*
     * THE CONTRADICTION RULE. A second, disagreeing source is NOT deduplicated away — different
     * digests are different sources, and retrieval exposes disagreement rather than resolving it.
     */
    assert.ok(
      outcome.kept.some((c) => c.sourceDigest === "bbbbbbbbbbbb"),
      "a competing source survives the cap and reaches the reader",
    );
    /* The kept chunks are the source's BEST ones, because the cap runs after ranking. */
    assert.deepEqual(
      outcome.kept.filter((c) => c.sourceDigest === "aaaaaaaaaaaa").map((c) => c.record.factKey),
      ["ingest:doc:aaaaaaaaaaaa:0", "ingest:doc:aaaaaaaaaaaa:1"],
    );

    /* Hand-authored facts are never capped — they are not fragments of a document. */
    const authored = applySourceDiversity(
      [1, 2, 3, 4].map((i) => toCandidate({ record: record({ factKey: `f-${i}` }), lexicalRank: i, trigram: null })),
    );
    assert.equal(authored.pruned, 0);
    assert.equal(authored.kept.length, 4);
  }

  /* ── 8. THE LIMIT IS THE SERVER'S, NOT THE CALLER'S ───────────────────── */
  {
    assert.equal(resolveRetrievalLimit(undefined), RETRIEVAL_DEFAULT_LIMIT);
    assert.equal(resolveRetrievalLimit(3), 3);
    assert.equal(resolveRetrievalLimit(9_999), RETRIEVAL_MAX_LIMIT, "a caller cannot ask for the world");
    assert.equal(resolveRetrievalLimit(0), 1);
    assert.equal(resolveRetrievalLimit(-5), 1);
    assert.equal(resolveRetrievalLimit(Number.NaN), RETRIEVAL_DEFAULT_LIMIT);
  }

  console.log("PASS kr3 retrieval contracts (pure)");
}

main();
