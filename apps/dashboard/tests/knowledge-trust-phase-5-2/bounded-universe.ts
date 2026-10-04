/*
 * KNOWLEDGE TRUST PHASE 5.2 — the bounded-universe evidence status (Decision A), over the REAL resolver.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "For public content, an eligible universe of 1..RETRIEVAL_MAX_LIMIT records is supplied WHOLE and
 *    labelled `bounded-universe` — never `matched`, with no matched terms and its own provenance line —
 *    without searching. Above the bound nothing is truncated and completeness is not pretended: the
 *    lexical path runs as before. Zero and unreadable universes still refuse. Internal retrieval never
 *    produces the status. The status survives the storage round trip and renders as itself, never as
 *    'could not be read' and never with the matched set's ordering sentence."
 *
 * Fake repository behind the real `searchKnowledge`; injected projections. No database, no model.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveKnowledgeEvidenceDetailed,
  resolvePublicKnowledgeEvidence,
  type PublicKnowledgeDeps,
} from "../../src/features/heby-answer/knowledge-evidence.server";
import {
  BOUNDED_UNIVERSE_PROVENANCE,
  RETRIEVAL_MAX_LIMIT,
  RETRIEVAL_PROVENANCE,
  buildBoundedUniverseEvidence,
} from "../../src/features/knowledge-retrieval";
import { fromStoredEvidence, toStoredEvidence } from "../../src/features/heby-conversation/answer-evidence";
import { BOUNDED_UNIVERSE_NOTICE, HebyEvidencePanel } from "../../src/components/layout/heby/heby-evidence";
import { boundedUniverseSelectionSentence } from "../../src/features/heby-answer/revision-generation-evidence";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111" };

const record = (key: string): KnowledgeSourceRecord =>
  ({
    factId: `fact-${key}`, factKey: key, domainKey: "company", scope: "organization", title: `Title ${key}`,
    statement: `STATEMENT-${key} handwoven rugs`, lifecycleStatus: "ratified", authorityClass: null, health: null,
    ratified: true, ratifiedAt: null, ratificationDecisionId: `dec-${key}`, governanceSessionId: null, ratifiedByActorId: null,
    activeKnowledgeNodeId: `node-${key}`, effectiveFrom: null, effectiveUntil: null, nextReviewAt: null,
    knowledgeVersion: 1, factVersion: 1, freshness: "unknown",
  }) as unknown as KnowledgeSourceRecord;

/** `allowed` eligible facts plus one DENIED fact, which must never appear. */
function corpus(allowed: number, match: (key: string) => boolean = () => false) {
  const keys = Array.from({ length: allowed }, (_, i) => `eligible-${String(i).padStart(2, "0")}`);
  const records = [...keys, "denied-fact"].map(record);
  const states = new Map<string, "allowed" | "denied">([
    ...keys.map((k) => [`node-${k}`, "allowed"] as [string, "allowed"]),
    ["node-denied-fact", "denied"],
  ]);
  let searches = 0;
  const repo = {
    listFacts: async () => ({ records, incomplete: [], truncated: false }),
    searchFacts: async () => {
      searches += 1;
      return {
        rows: records.filter((r) => match(r.factKey)).map((r, i) => ({ record: r, lexicalRank: 1 / (i + 1), trigram: null })),
        incomplete: [], truncated: false, trigramAvailable: false,
      };
    },
    hasTrigram: async () => false,
  } as unknown as DurableKnowledgeRepository;
  const deps: PublicKnowledgeDeps = {
    getRepo: () => repo,
    now: () => NOW,
    readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: new Set() }),
    readPublicUse: async () => ({ status: "read", states }),
  };
  return { keys, deps, searches: () => searches };
}

async function main(): Promise<void> {
  assert.equal(RETRIEVAL_MAX_LIMIT, 20, "the authoritative bound this phase was approved against");

  /* 1 and 20 eligible: supplied whole, unsearched, unmatched. */
  for (const size of [1, RETRIEVAL_MAX_LIMIT]) {
    const c = corpus(size);
    const out = await resolvePublicKnowledgeEvidence(TENANT, "nothing here matches", c.deps);
    assert.equal(out.status, "resolved", `${size}: resolved`);
    if (out.status !== "resolved") throw new Error("unreachable");
    assert.equal(out.evidence.status, "bounded-universe", `${size}: bounded-universe, never matched`);
    assert.equal(c.searches(), 0, `${size}: nothing was searched, so nothing can be called matched`);
    assert.deepEqual(out.evidence.items.map((i) => i.factKey), c.keys, `${size}: the COMPLETE universe, in listing order`);
    assert.ok(out.evidence.items.every((i) => i.explanation.matchedTerms.length === 0), `${size}: no matched terms`);
    assert.equal(out.evidence.truncated, false);
    assert.equal(out.resolution.provenance, BOUNDED_UNIVERSE_PROVENANCE, `${size}: the model is told how the set was chosen`);
    assert.equal(out.resolution.items.length, size);
    assert.ok(!JSON.stringify([out.resolution, out.evidence]).includes("denied-fact"), `${size}: a denied fact never rides along`);
  }
  assert.ok(!BOUNDED_UNIVERSE_PROVENANCE.includes("TEXT-MATCH"), "the lexical ordering sentence is not borrowed");

  /* 21 eligible: NOT truncated to 20, NOT called complete — the lexical path runs as before. */
  {
    const c = corpus(RETRIEVAL_MAX_LIMIT + 1);
    const none = await resolvePublicKnowledgeEvidence(TENANT, "nothing here matches", c.deps);
    assert.equal(none.status, "resolved");
    if (none.status !== "resolved") throw new Error("unreachable");
    assert.equal(c.searches(), 1, "21: the question was searched");
    assert.equal(none.evidence.status, "no-match", "21: an honest no-match, not a pretend universe");
    assert.equal(none.evidence.items.length, 0);
    assert.equal(none.universeCount, RETRIEVAL_MAX_LIMIT + 1);

    const some = corpus(RETRIEVAL_MAX_LIMIT + 1, (k) => k === "eligible-03" || k === "denied-fact");
    const hit = await resolvePublicKnowledgeEvidence(TENANT, "rugs", some.deps);
    if (hit.status !== "resolved") throw new Error("unreachable");
    assert.equal(hit.evidence.status, "matched", "21: matched means lexically matched");
    assert.deepEqual(hit.evidence.items.map((i) => i.factKey), ["eligible-03"], "21: only the eligible match, the denied one dropped");
    assert.equal(hit.resolution.provenance, RETRIEVAL_PROVENANCE);
  }

  /* 0 eligible and unreadable eligibility still refuse. */
  assert.deepEqual(await resolvePublicKnowledgeEvidence(TENANT, "q", corpus(0).deps), { status: "blocked", reason: "no-public-eligible-knowledge" });
  assert.deepEqual(
    await resolvePublicKnowledgeEvidence(TENANT, "q", { ...corpus(3).deps, readPublicUse: async () => ({ status: "unavailable", reason: "read-failed" }) }),
    { status: "blocked", reason: "public-eligibility-unavailable" },
  );

  /* Internal retrieval never produces the status: a 1-record corpus that matches nothing is a no-match. */
  {
    const internal = await resolveKnowledgeEvidenceDetailed(TENANT, "nothing here matches", corpus(1).deps);
    assert.equal(internal.evidence.status, "no-match");
  }

  /* The builder refuses to call an empty or over-bound set a bounded universe. */
  assert.throws(() => buildBoundedUniverseEvidence([]));
  assert.throws(() => buildBoundedUniverseEvidence(Array.from({ length: RETRIEVAL_MAX_LIMIT + 1 }, (_, i) => record(`r${i}`))));

  /* Storage round trip: status and items come back as they went in. */
  const set = buildBoundedUniverseEvidence(["a", "b"].map(record));
  const stored = toStoredEvidence(set);
  assert.equal(stored.status, "bounded-universe");
  assert.ok(stored.items.every((i) => i.matchedTerms.length === 0));
  const replayed = fromStoredEvidence({
    ...stored,
    id: "set-1", messageId: "msg-1", recordedAt: NOW,
    items: stored.items.map((i) => ({ ...i, id: `item-${i.ordinal}` })),
  } as never);
  assert.equal(replayed.status, "bounded-universe");
  assert.deepEqual(replayed.items.map((i) => i.factKey), ["a", "b"]);

  /* Reader-facing UI: its own sentence; never "could not be read", never the ordering claim. */
  for (const historical of [false, true]) {
    const html = renderToStaticMarkup(createElement(HebyEvidencePanel, { set: historical ? replayed : set, historical }));
    assert.ok(html.includes(BOUNDED_UNIVERSE_NOTICE.replace(/'/g, "&#x27;")), "the bounded-universe notice renders");
    assert.ok(html.includes("Title a") && html.includes("Title b"), "every supplied record is shown");
    assert.ok(!/could not be read/.test(html), "never mistaken for a failed read");
    assert.ok(!/ordered by how closely/.test(html), "never the matched set's ordering sentence");
    assert.ok(!/Matched terms/.test(html), "no matched terms are shown");
  }
  const sentence = boundedUniverseSelectionSentence(2, 3);
  assert.match(sentence, /supplied whole/);
  assert.match(sentence, /not matched/);
  assert.doesNotMatch(sentence, /Retrieval supplied|support (it|them|the revision)\b/);

  console.log("PASS knowledge-trust-phase-5-2 bounded-universe");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
