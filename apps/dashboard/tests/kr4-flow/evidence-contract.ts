/*
 * KR4 — the derived evidence explanation, proven without a database.
 *
 * The explanation is a pure projection of a retrieval result, so everything it decides can be
 * proven here: what survives the boundary, what deliberately does not, and which of the five
 * retrieval outcomes produce which distinguishable state.
 *
 * The point of most of these assertions is NEGATIVE. KR4's whole risk is that making evidence
 * legible quietly makes it look authoritative — a score becomes a rating, "several sources" becomes
 * "they disagree", a missing field becomes a confident blank. Each of those is pinned below.
 *
 * No database, no network, no model, no clock of its own.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EVIDENCE_EXCERPT_LIMIT,
  EVIDENCE_MAX_MATCHED_TERMS,
  buildRetrievalEvidence,
  distinctSourceCount,
  matchedTermsFor,
  toCandidate,
  type RetrievalCandidate,
  type RetrievalResult,
} from "../../src/features/knowledge-retrieval";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";

const CAPABILITY = { lexical: true, trigram: false, degradedReason: null } as const;
const DEGRADED = {
  lexical: true,
  trigram: false,
  degradedReason: "Typo tolerance is not connected: pg_trgm is not installed.",
} as const;

function record(overrides: Partial<KnowledgeSourceRecord> = {}): KnowledgeSourceRecord {
  return {
    factId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    factVersion: 3,
    factKey: "izin-hakki",
    domainKey: "izin",
    scope: "company-wide",
    title: "Yıllık izin hakkı",
    statement: "Çalışanlar yılda 20 gün ücretli izin kullanır. İzin talebi yöneticiye iletilir.",
    lifecycleStatus: "ratified",
    authorityClass: "authoritative",
    health: "current",
    ratified: true,
    ratifiedAt: "2026-08-01T00:00:00.000Z",
    ratificationDecisionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    governanceSessionId: "ssssssss-ssss-4sss-8sss-ssssssssssss",
    ratifiedByActorId: "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu",
    activeKnowledgeNodeId: "nnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: null,
    nextReviewAt: null,
    knowledgeVersion: 2,
    freshness: "within-cadence",
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

function candidate(overrides: Partial<KnowledgeSourceRecord> = {}): RetrievalCandidate {
  return toCandidate({ record: record(overrides), lexicalRank: 0.42, trigram: null });
}

function matched(
  candidates: readonly RetrievalCandidate[],
  extra: Partial<Extract<RetrievalResult, { status: "matched" }>> = {},
): RetrievalResult {
  return {
    status: "matched",
    candidates,
    excluded: [],
    diversityPruned: 0,
    truncated: false,
    capability: CAPABILITY,
    ...extra,
  };
}

export function run(): void {
  /* ── 1. STRUCTURED PROVENANCE AND ATTRIBUTION SURVIVE ──────────────────── */
  {
    const set = buildRetrievalEvidence(matched([candidate()]), "izin hakkı");
    assert.equal(set.status, "matched");
    const item = set.items[0]!;

    assert.equal(item.origin, "human-ingested", "provenance origin survives to the reader");
    assert.equal(item.authoredThrough, "hebun-knowledge-workspace");
    assert.equal(item.chunkIndex, 2);
    assert.equal(item.chunkCount, 7);
    assert.equal(item.textOriginUnverified, true, "the most honest field must survive");

    assert.equal(item.sourceTitle, "İnsan Kaynakları El Kitabı", "source attribution survives");
    assert.equal(item.sourceType, "policy");
    assert.equal(item.ingestedByActorType, "human");
    assert.equal(item.ingestedAt, "2026-07-01T00:00:00.000Z");
  }

  /* ── 2. STANDING SURVIVES, STRUCTURED AND UNFLATTENED ──────────────────── */
  {
    const item = buildRetrievalEvidence(matched([candidate()]), "izin").items[0]!;
    assert.equal(item.authorityClass, "authoritative");
    assert.equal(item.lifecycleStatus, "ratified");
    assert.equal(item.ratified, true);
    assert.equal(item.freshness, "within-cadence");
    assert.equal(item.knowledgeVersion, 2);
    assert.equal(item.factVersion, 3);
    /*
     * The KR3 seam joined these five into one display string. A UI cannot render a badge from a
     * sentence without parsing prose back into fields, so each must arrive as its own value.
     */
    assert.equal(typeof item.authorityClass, "string");
    assert.notEqual(typeof (item as unknown as { detail?: string }).detail, "string");
  }

  /* ── 3. NULL STANDING IS NEVER DEFAULTED ───────────────────────────────── */
  {
    const item = buildRetrievalEvidence(
      matched([candidate({ authorityClass: null, lifecycleStatus: null, ratified: false })]),
      "izin",
    ).items[0]!;
    assert.equal(item.authorityClass, null, "an unstated authority stays unstated");
    assert.equal(item.lifecycleStatus, null);
    assert.equal(item.ratified, false);
  }

  /* ── 4. A RECORD WITH NO PROVENANCE SAYS SO, IT DOES NOT SAY "VERIFIED" ── */
  {
    const item = buildRetrievalEvidence(
      matched([candidate({ provenance: null, sourceAttribution: null })]),
      "izin",
    ).items[0]!;
    assert.equal(item.origin, null);
    assert.equal(item.sourceTitle, null);
    /*
     * `null`, NOT `false`. `false` would assert that the text origin WAS verified — something
     * Hebun never does for any record. "Not told" and "verified" must stay distinguishable.
     */
    assert.equal(item.textOriginUnverified, null, "absent provenance must not imply verification");
  }

  /* ── 5. MATCHED TERMS ARE DETERMINISTIC AND TURKISH-FOLDED ─────────────── */
  {
    const terms = matchedTermsFor(
      { title: "Yıllık izin hakkı", statement: "İzin talebi yöneticiye iletilir." },
      ["İZİN", "yönetici", "kargo"],
    );
    /*
     * Reported as the RECORD spells them, not as the query was folded. `normalizeQuery` yields
     * folded tokens, so echoing the token would print "Yillik" under a record that reads "Yıllık" —
     * a word the reader cannot find on screen, in a panel whose whole job is to be checkable.
     */
    assert.deepEqual(terms, ["izin", "yönetici"], "the record's own spelling; a non-occurring term is absent");

    // Same input, same output — no clock, no randomness, no model anywhere on this path.
    assert.deepEqual(
      terms,
      matchedTermsFor(
        { title: "Yıllık izin hakkı", statement: "İzin talebi yöneticiye iletilir." },
        ["İZİN", "yönetici", "kargo"],
      ),
    );

    // A term the check cannot literally see is NOT claimed as matched.
    assert.deepEqual(matchedTermsFor({ title: "Kargo", statement: null }, ["izin"]), []);

    const many = matchedTermsFor(
      { title: "a b c d e f g h", statement: null },
      ["a", "b", "c", "d", "e", "f", "g", "h"],
    );
    assert.equal(many.length, EVIDENCE_MAX_MATCHED_TERMS, "the list is bounded");
  }

  /* ── 6. NO SCORE, NO CONFIDENCE, NO TRUST CROSSES THE BOUNDARY ─────────── */
  {
    const set = buildRetrievalEvidence(matched([candidate()]), "izin hakkı");
    const serialized = JSON.stringify(set);
    for (const banned of [
      "lexical", "trigram", "combined", "score",
      "confidence", "truthScore", "trustScore", "qualityScore", "certainty",
      "rank", "weight", "sourceDigest",
    ]) {
      assert.ok(
        !serialized.includes(banned),
        `"${banned}" must not appear in user-visible evidence — a number beside a policy reads as a verdict on it`,
      );
    }
    // And the score genuinely still exists upstream — it was withheld, not deleted.
    assert.equal(typeof candidate().score.combined, "number");
  }

  /* ── 7. MULTIPLE RELEVANT SOURCES — CAUTIOUS, AND ONLY WHEN REAL ───────── */
  {
    const twoSources = matched([
      candidate({ factKey: "ingest:hr-el-kitabi:abc123abc123:1" }),
      candidate({ factKey: "ingest:izin-yonergesi:def456def456:1" }),
    ]);
    const set = buildRetrievalEvidence(twoSources, "izin");
    assert.equal(set.multipleRelevantSources, true, "two distinct sources in one domain is a real signal");
    /*
     * And it is NOT a contradiction verdict. Nothing in this repository compares two statements for
     * agreement, so no field may claim they conflict.
     */
    assert.ok(!("conflict" in set), "there is no conflict verdict — nothing computes one");
    assert.ok(!JSON.stringify(set).includes("contradict"));
  }

  /* ── 8. ONE SOURCE — AND TWO CHUNKS OF ONE SOURCE — DO NOT TRIGGER IT ──── */
  {
    assert.equal(
      buildRetrievalEvidence(matched([candidate()]), "izin").multipleRelevantSources,
      false,
      "a single record cannot disagree with itself",
    );

    const sameDocument = matched([
      candidate({ factKey: "ingest:hr-el-kitabi:abc123abc123:1" }),
      candidate({ factKey: "ingest:hr-el-kitabi:abc123abc123:2" }),
    ]);
    assert.equal(
      buildRetrievalEvidence(sameDocument, "izin").multipleRelevantSources,
      false,
      "two chunks of ONE document are one source, not two disagreeing ones",
    );

    // Different domains are not competing statements about the same rule.
    const differentDomains = matched([
      candidate({ factKey: "ingest:a:aaa111aaa111:1", domainKey: "izin" }),
      candidate({ factKey: "ingest:b:bbb222bbb222:1", domainKey: "seyahat" }),
    ]);
    assert.equal(buildRetrievalEvidence(differentDomains, "izin").multipleRelevantSources, false);

    assert.ok(sameDocument.status === "matched");
    assert.equal(distinctSourceCount(sameDocument.candidates), 1);
    assert.equal(distinctSourceCount(twoDistinct()), 2);
  }

  /* ── 9-11. THE EMPTY STATES STAY FOUR DIFFERENT FACTS ──────────────────── */
  {
    const noMatch = buildRetrievalEvidence(
      { status: "no-match", excluded: [
        { factKey: "eski-politika", domainKey: "izin", reason: "lifecycle-retired" },
      ], capability: CAPABILITY },
      "izin",
    );
    const emptyCorpus = buildRetrievalEvidence({ status: "empty-corpus", capability: CAPABILITY }, "izin");
    const emptyQuery = buildRetrievalEvidence({ status: "empty-query", capability: CAPABILITY }, "???");
    const unavailable = buildRetrievalEvidence(
      { status: "unavailable", reason: "read-failed", detail: "connection refused" },
      "izin",
    );

    const statuses = [noMatch.status, emptyCorpus.status, emptyQuery.status, unavailable.status];
    assert.equal(new Set(statuses).size, 4, "four outcomes, four distinguishable states");
    assert.equal(noMatch.status, "no-match");
    assert.equal(emptyCorpus.status, "empty-corpus");
    assert.equal(emptyQuery.status, "empty-query");
    assert.equal(unavailable.status, "unavailable");

    // The withheld records are COUNTED, so a gap is never mysterious.
    assert.equal(noMatch.excludedCount, 1);
    assert.equal(emptyCorpus.excludedCount, 0);
    assert.equal(unavailable.unavailableReason, "connection refused");

    for (const set of [noMatch, emptyCorpus, emptyQuery, unavailable]) {
      assert.deepEqual(set.items, [], "no empty state invents an item");
      assert.equal(set.multipleRelevantSources, false);
    }
  }

  /* ── 12. TRUNCATION, DIVERSITY AND DEGRADATION ARE SEPARATE FACTS ──────── */
  {
    const set = buildRetrievalEvidence(
      matched([candidate()], { truncated: true, diversityPruned: 3, capability: DEGRADED }),
      "izin",
    );
    assert.equal(set.truncated, true, "the sweep was partial and the reader is told");
    assert.equal(set.diversityPruned, 3, "the cap removed three, and says three");
    assert.equal(set.degradedReason, DEGRADED.degradedReason, "a component that could not run says so");

    /*
     * KR3 computed all three and then dropped them at the resolution boundary, so a `matched`
     * answer could be silently partial. They are separate fields because they have separate
     * remedies — collapsing them into "some results omitted" would tell the reader that something
     * is missing without telling them which kind.
     */
    assert.equal(set.items[0]!.explanation.diversityAffected, true, "and each card knows the set was pruned");

    const clean = buildRetrievalEvidence(matched([candidate()]), "izin");
    assert.equal(clean.truncated, false);
    assert.equal(clean.diversityPruned, 0);
    assert.equal(clean.degradedReason, null);
    assert.equal(clean.items[0]!.explanation.diversityAffected, false);
  }

  /* ── 13. NARROWING IS ONLY CLAIMED WHEN THE CALLER ACTUALLY NARROWED ───── */
  {
    const without = buildRetrievalEvidence(matched([candidate()]), "izin").items[0]!;
    assert.equal(without.explanation.domainMatched, false, "no narrowing hint → no narrowing claim");
    assert.equal(without.explanation.scopeMatched, false);

    const with_ = buildRetrievalEvidence(matched([candidate()]), "izin", {
      domainKey: "izin",
      scope: "company-wide",
    }).items[0]!;
    assert.equal(with_.explanation.domainMatched, true);
    assert.equal(with_.explanation.scopeMatched, true);
    assert.equal(with_.explanation.activeVersion, true, "eligibility already removed every other version");
  }

  /* ── 14. THE EXCERPT IS BOUNDED AND HONEST ABOUT IT ────────────────────── */
  {
    const long = "x".repeat(EVIDENCE_EXCERPT_LIMIT + 50);
    const item = buildRetrievalEvidence(matched([candidate({ statement: long })]), "izin").items[0]!;
    assert.equal(item.excerpt!.length, EVIDENCE_EXCERPT_LIMIT);
    assert.equal(item.excerptTruncated, true, "a shortened statement says it was shortened");

    const none = buildRetrievalEvidence(matched([candidate({ statement: null })]), "izin").items[0]!;
    assert.equal(none.excerpt, null, "no statement is null, never an empty-looking quote");
    assert.equal(none.excerptTruncated, false);
  }

  /* ── 15. IDENTITY MATCHES THE VALIDATOR'S REFERENCE EXACTLY ────────────── */
  {
    const item = buildRetrievalEvidence(matched([candidate()]), "izin").items[0]!;
    /*
     * The evidence validator checks `domainKey/factKey`. If the card built its own identity the two
     * could drift, and a card would point at something the validator never approved.
     */
    assert.equal(item.recordRef, "izin/izin-hakki");
    assert.equal(item.factKey, "izin-hakki");
    assert.equal(item.domainKey, "izin");
  }

  /* ── 16. NO GOVERNANCE ID IS EXPOSED, AND IDENTITY IS CARRIED BUT NOT SHOWN ─ */
  {
    const set = buildRetrievalEvidence(matched([candidate()]), "izin");
    const serialized = JSON.stringify(set);

    /*
     * These two never travel. A decision id or a session id in an evidence card would invite a
     * reader to treat the card as a Governance record, which it is not and must never become.
     */
    for (const governance of [
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd", // ratificationDecisionId
      "ssssssss-ssss-4sss-8sss-ssssssssssss", // governanceSessionId
    ]) {
      assert.ok(!serialized.includes(governance), "no Governance row id is evidence a reader needs");
    }

    /*
     * KR5 CHANGED THIS, and the change is the point.
     *
     * KR4 banned `factId` and `activeKnowledgeNodeId` from the set on the grounds that a reader
     * does not need internal ids. True — but the historical record does: `recordRef` is
     * `domainKey/factKey` and is NOT version-pinned, so after a supersession it resolves to
     * different text. Without these two, an answer's stored evidence could only say WHICH FACT it
     * used, never which version, and a reload would have no way to prove it was not quietly
     * showing today's reading.
     *
     * So they are carried — and the original concern still holds, unchanged: they are for history,
     * not for display. Test 17 below pins that they never reach the screen.
     */
    const item = set.items[0]!;
    assert.equal(item.factId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "the fact's durable identity");
    assert.equal(
      item.knowledgeNodeId,
      "nnnnnnnn-nnnn-4nnn-8nnn-nnnnnnnnnnnn",
      "and the exact version that answered",
    );
  }

  /* ── 17. THE DURABLE IDENTITY IS NEVER RENDERED ────────────────────────── */
  {
    /*
     * The ids exist to make a historical row exact, and for nothing else. If the evidence panel
     * ever printed one, KR4's original objection would be live again: a reader would be shown an
     * internal row id they cannot verify, act on, or meaningfully read.
     */
    const panel = readFileSync(
      join(process.cwd(), "src", "components", "layout", "heby", "heby-evidence.tsx"),
      "utf8",
    );
    for (const identity of ["factId", "knowledgeNodeId"]) {
      assert.ok(!panel.includes(identity), `the evidence panel must never render ${identity}`);
    }
  }
}

function twoDistinct(): readonly RetrievalCandidate[] {
  return [
    candidate({ factKey: "ingest:one:aaa111aaa111:1" }),
    candidate({ factKey: "ingest:two:bbb222bbb222:1" }),
  ];
}

run();
