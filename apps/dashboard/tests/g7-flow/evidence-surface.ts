/*
 * G7 — THE EVIDENCE SURFACE, AND THE TWO DEFECTS IT REPAIRS.
 *
 * Both defects were in the SAME sentence being told two different ways:
 *
 *   1. A reloaded answer that cited its tenant's own Governance record displayed "Evidence details
 *      were not retained for this earlier response." G6D had made those citations durable and the
 *      conversation loader had returned them since; the thread composer's message shape did not
 *      declare the field, so they were dropped one step before the reader.
 *
 *   2. The LIVE answer could not show them either. `HebyEvidenceReference` carries identity only —
 *      `{ sourceClass, recordRef, lifecycle }` — so the label, the detail and the STANDING existed
 *      server-side, were written to the durable row, and were never handed to the reader. The same
 *      answer therefore described itself less fully before a refresh than after one.
 *
 * These proofs are written against the SHIPPED modules, not against a copy of their logic.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  fromStoredSourceEvidence,
  toResponseSourceEvidence,
  toStoredSourceEvidence,
} from "../../src/features/heby-conversation/answer-evidence";
import type { ReplayedSourceEvidence } from "../../src/features/heby-conversation/answer-evidence";
import type { HebySourceEvidenceGroup } from "../../src/features/heby-runtime/contracts";
import { buildTurns, type ThreadMessage } from "../../src/components/layout/heby/heby-thread";
import { HebyTurnList, type HebyTurnView } from "../../src/components/layout/heby/heby-turns";
import type { HebyRuntimeResponse } from "../../src/features/heby-runtime/contracts";
import type { RetrievalEvidenceSet } from "../../src/features/knowledge-retrieval";

/* ── THE TYPES ARE ONE SHAPE, ASSERTED AT COMPILE TIME ─────────────────────────
 *
 * `HebySourceEvidenceGroup` (the runtime contract, client-safe) and `ReplayedSourceEvidence` (the
 * persistence projection) are declared separately so the runtime contract does not have to import
 * the conversation-persistence module for a type. These two assignments are what stops that
 * separation becoming a divergence: if either gains, loses or renames a field, this file stops
 * compiling and the suite fails before a single assertion runs.
 */
const _contractAcceptsReplayed: HebySourceEvidenceGroup = {
  sourceClass: "governance",
  authoritative: true,
  items: [{ recordRef: "r", label: "l", detail: "d" }],
} satisfies ReplayedSourceEvidence;
const _replayedAcceptsContract: ReplayedSourceEvidence = _contractAcceptsReplayed;
void _replayedAcceptsContract;

/** A resolution set shaped exactly like the answer flow's, and deliberately MIXED. */
const RESOLUTIONS = [
  {
    sourceClass: "governance",
    state: "resolved",
    authoritative: true,
    items: [
      { recordRef: "decision-1", label: "Genesis decision", detail: "bootstrap · accepted" },
      { recordRef: "role-1", label: "Member role baseline", detail: "present" },
    ],
  },
  {
    sourceClass: "operations",
    state: "resolved",
    authoritative: false,
    items: [{ recordRef: "op-7", label: "Execution queue", detail: "0 running" }],
  },
  /* Unavailable sources cite nothing — their own reason is already printed into the body. */
  { sourceClass: "work-artifacts", state: "unavailable", authoritative: false, items: [] },
  /* Knowledge has its own evidence authority and a CHECK constraint refusing it in the table. */
  {
    sourceClass: "knowledge",
    state: "resolved",
    authoritative: false,
    items: [{ recordRef: "fact-1", label: "A policy", detail: "settled" }],
  },
];

const NOOP_RESPONSE: Omit<HebyRuntimeResponse, "sourceEvidence"> = {
  kind: "SUMMARY",
  origin: "deterministic",
  title: "t",
  body: ["b"],
  evidence: [],
  provenance: [],
  provenanceCovered: [],
  uncertainty: "known",
  limitations: [],
  authority: "advisory-only",
  modelUsed: false,
};

const MATCHED_KNOWLEDGE: RetrievalEvidenceSet = {
  status: "matched",
  items: [
    {
      recordRef: "fact-1",
      factId: "f1",
      knowledgeNodeId: "n1",
      domainKey: "policy",
      factKey: "k",
      scope: "company-wide",
      title: "A policy",
      excerpt: "text",
      excerptTruncated: false,
      authorityClass: "authoritative",
      lifecycleStatus: "ratified",
      ratified: true,
      ratifiedAt: null,
      freshness: "within-cadence",
      knowledgeVersion: 1,
      factVersion: 1,
      effectiveFrom: null,
      effectiveUntil: null,
      nextReviewAt: null,
      origin: "human-authored",
      authoredThrough: null,
      textOriginUnverified: null,
      sourceTitle: null,
      sourceType: null,
      ingestedByActorType: null,
      ingestedAt: null,
      chunkIndex: null,
      chunkCount: null,
      explanation: {
        matchedTerms: [],
        domainMatched: false,
        scopeMatched: false,
        activeVersion: true,
        diversityAffected: false,
      },
    },
  ],
  multipleRelevantSources: false,
  truncated: false,
  diversityPruned: 0,
  excludedCount: 0,
  degradedReason: null,
  unavailableReason: null,
};

function renderTurns(turns: readonly HebyTurnView[]): string {
  return renderToStaticMarkup(
    createElement(HebyTurnList, { turns, pending: null, asking: false }),
  );
}

function main(): void {
  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. LIVE AND RELOADED ARE ONE PROJECTION, NOT TWO VIEWS KEPT IN STEP.
   *
   * The round trip is walked for real: resolutions → the rows `persistExchange` is given → the
   * replay a reload performs. That result must equal what the LIVE response carries. It is not a
   * tautology — the values pass through the storage row shape in between, where the ordinal
   * ordering, the per-class grouping and the Knowledge exclusion are applied.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const rows = toStoredSourceEvidence(RESOLUTIONS);
    /* The reload reads these rows back with a message id attached; nothing else is added. */
    const replayed = fromStoredSourceEvidence(rows.map((row) => ({ ...row, messageId: "m1" })));
    const live = toResponseSourceEvidence(RESOLUTIONS);

    assert.deepEqual(live, replayed, "the live view and the reloaded view are the same value");

    /* And the value itself is right, not merely consistent. */
    assert.equal(live.length, 2, "two classes cited; the unavailable one contributed nothing");
    const governance = live.find((group) => group.sourceClass === "governance");
    const operations = live.find((group) => group.sourceClass === "operations");
    assert.ok(governance && operations);
    assert.equal(governance.authoritative, true, "Governance cited as an authority");
    assert.equal(operations.authoritative, false, "the derived read model says so");
    assert.deepEqual(
      governance.items.map((item) => item.recordRef),
      ["decision-1", "role-1"],
      "order the reader met the records in is preserved",
    );
    assert.equal(governance.items[0]!.label, "Genesis decision");
    assert.equal(governance.items[0]!.detail, "bootstrap · accepted");

    /* KNOWLEDGE IS EXCLUDED HERE — it has its own evidence authority, and its own panel. */
    assert.ok(
      !live.some((group) => group.sourceClass === "knowledge"),
      "Knowledge never appears in the source-evidence view",
    );
    assert.ok(
      !live.some((group) => group.sourceClass === "work-artifacts"),
      "an unavailable source cites nothing",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. A MIXED ANSWER STAYS MIXED.
   *
   * Flattening two standings into one — or dropping the second because the first rendered — is the
   * specific failure the per-group standing exists to prevent.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const live = toResponseSourceEvidence(RESOLUTIONS);
    const html = renderTurns([
      {
        key: "h",
        role: "heby",
        content: "an answer",
        durable: true,
        historical: false,
        sourceEvidence: live,
        knowledgeEvidence: MATCHED_KNOWLEDGE,
      },
    ]);

    assert.ok(html.includes("data-heby-source-evidence"), "the source panel rendered");
    assert.ok(html.includes("data-heby-evidence="), "the Knowledge panel rendered too");
    assert.ok(
      html.includes('data-heby-source-standing="authoritative"') &&
        html.includes('data-heby-source-standing="derived"'),
      "both standings are present in one answer",
    );
    assert.ok(html.includes("Genesis decision") && html.includes("Execution queue"), "both classes shown");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. THE STANDING IS CARRIED BY WORDS, NOT BY COLOUR.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const html = renderTurns([
      {
        key: "h",
        role: "heby",
        content: "a",
        durable: true,
        sourceEvidence: toResponseSourceEvidence(RESOLUTIONS),
      },
    ]);
    const text = html.replace(/<[^>]*>/g, " ");
    assert.ok(text.includes("authoritative organizational record"), "the authority standing is stated");
    assert.ok(text.includes("derived read model"), "the derived standing is stated");
    /* And it is never overstated: owning a record is not being right about it. */
    assert.ok(
      text.includes("It is not a statement that the record is correct"),
      "the panel refuses the reading that authoritative means true",
    );
    /* No score, confidence or verdict may appear beside a Governance record. */
    for (const banned of [/\bconfidence\b/i, /\bscore\b/i, /\btrust\b/i, /\b\d{1,3}\s?%/, /\brating\b/i]) {
      assert.ok(!banned.test(text), `a verdict-shaped value leaked into the source panel: ${banned}`);
    }
    /* The record reference is TEXT. G6D gave it no foreign key; a link could dangle or move on. */
    assert.ok(!/<a[^>]*decision-1/.test(html), "a record reference is never a link");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. THE FIELD SURVIVES ThreadMessage → buildTurns → HebyTurnView.
   *
   * This is the exact step where G6D's durable rows were being dropped.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const stored = toResponseSourceEvidence(RESOLUTIONS);
    const messages: ThreadMessage[] = [
      { id: "u1", role: "user", content: "q" },
      { id: "a1", role: "assistant", content: "older answer", sourceEvidence: stored },
      { id: "u2", role: "user", content: "q2" },
      { id: "a2", role: "assistant", content: "newest answer", sourceEvidence: stored },
    ];

    const reloadedOnly = buildTurns(messages, null);
    const older = reloadedOnly.find((turn) => turn.key === "a1")!;
    assert.deepEqual(older.sourceEvidence, stored, "a reloaded turn keeps its recorded citations");
    assert.equal(older.historical, true, "and is framed as a record, not as a reading of today");

    /* A user turn never acquires citations, whatever it was handed. */
    const userTurn = reloadedOnly.find((turn) => turn.key === "u1")!;
    assert.equal(userTurn.sourceEvidence, undefined, "the operator's own turn cites nothing");

    /* The newest turn, once it is this session's live answer, carries the RESPONSE's value. */
    const withLatest = buildTurns(messages, {
      userText: "q2",
      durable: true,
      response: { ...NOOP_RESPONSE, sourceEvidence: stored } as HebyRuntimeResponse,
    });
    const newest = withLatest.find((turn) => turn.key === "a2")!;
    assert.equal(newest.historical, false, "the live answer is not a historical record");
    assert.deepEqual(newest.sourceEvidence, stored, "and shows the same citations it will replay");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. THE STALE STATE IS GONE WHERE EVIDENCE EXISTS — AND STILL TRUE WHERE IT DOES NOT.
   *
   * The repair is not "delete the notice". It is what a reader must be told when a turn genuinely
   * stored nothing: an answer produced before these records existed, or one where no retrieval and
   * no source resolution ran at all.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const withSources = renderTurns([
      {
        key: "h",
        role: "heby",
        content: "reloaded",
        durable: true,
        historical: true,
        sourceEvidence: toResponseSourceEvidence(RESOLUTIONS),
      },
    ]);
    assert.ok(
      !withSources.includes("data-heby-evidence-not-retained"),
      "a reloaded answer with recorded citations never claims they were not retained",
    );
    assert.ok(
      !withSources.includes("Evidence details were not retained"),
      "and never prints that sentence",
    );
    assert.ok(
      withSources.includes("data-heby-source-evidence-historical"),
      "it is framed as a record of what this answer was shown",
    );
    assert.ok(
      withSources.replace(/<[^>]*>/g, " ").includes("Recorded sources"),
      "the disclosure says so before it is ever opened",
    );

    const withKnowledgeOnly = renderTurns([
      { key: "h", role: "heby", content: "r", durable: true, historical: true, knowledgeEvidence: MATCHED_KNOWLEDGE },
    ]);
    assert.ok(
      !withKnowledgeOnly.includes("data-heby-evidence-not-retained"),
      "KR5's own recorded evidence is not called unretained either",
    );

    /* The one case where the notice is still the truth. */
    const withNothing = renderTurns([
      { key: "h", role: "heby", content: "an old answer", durable: true, historical: true },
    ]);
    assert.ok(
      withNothing.includes("data-heby-evidence-not-retained"),
      "a turn that genuinely recorded nothing still says so plainly",
    );

    /* An EMPTY list is not a set of citations, and must not suppress the honest notice. */
    const withEmptyList = renderTurns([
      { key: "h", role: "heby", content: "r", durable: true, historical: true, sourceEvidence: [] },
    ]);
    assert.ok(
      withEmptyList.includes("data-heby-evidence-not-retained"),
      "an empty citation list is not evidence",
    );
    assert.ok(!withEmptyList.includes("data-heby-source-evidence"), "and renders no empty panel");
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. THE BARE REFERENCE LIST IS STILL THE FALLBACK, AND ONLY THE FALLBACK.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const fallback = renderTurns([
      {
        key: "h",
        role: "heby",
        content: "a",
        durable: true,
        evidence: [{ sourceClass: "platform", recordRef: "p-1" }],
      },
    ]);
    assert.ok(fallback.includes("platform · p-1"), "a class with no panel behind it still shows its reference");

    const superseded = renderTurns([
      {
        key: "h",
        role: "heby",
        content: "a",
        durable: true,
        evidence: [{ sourceClass: "governance", recordRef: "decision-1" }],
        sourceEvidence: toResponseSourceEvidence(RESOLUTIONS),
      },
    ]);
    assert.ok(
      !superseded.includes("governance · decision-1"),
      "the richer panel replaces the bare reference rather than doubling it",
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. A NON-DURABLE TURN SHOWS ITS CITATIONS AND STILL SAYS IT WAS NOT SAVED.
   * ═════════════════════════════════════════════════════════════════════════ */
  {
    const turns = buildTurns([], {
      userText: "q",
      durable: false,
      response: {
        ...NOOP_RESPONSE,
        body: ["an answer"],
        sourceEvidence: toResponseSourceEvidence(RESOLUTIONS),
      } as HebyRuntimeResponse,
    });
    const html = renderTurns(turns);
    assert.ok(html.includes("data-heby-source-evidence"), "the answer really did cite these records");
    assert.ok(html.includes("Not saved"), "and the turn does not pretend it was recorded");
  }

  console.log("g7 evidence surface checks passed");
}

main();
