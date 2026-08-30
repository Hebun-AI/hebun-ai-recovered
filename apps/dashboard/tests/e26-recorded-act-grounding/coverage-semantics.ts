/*
 * E2-6 · PRODUCTION DEFECT — TWO COVERAGE DIMENSIONS, NEVER MERGED.
 *
 * The real failure this pins: asked in authenticated production "How complete is the recorded
 * activity you can see?", Heby answered correctly on the count and then said
 *
 *     "18 of 18 in this case tells me whether I'm seeing everything available in that retrieval
 *      window, but not whether older acts exist beyond it."
 *
 * That is false for this reader. `RecordedActPage.totalRecordedActs` is a `count(*)` over the
 * tenant's ENTIRE ledger, unbounded and taken independently of the page — so carried == total means
 * no further Hebun-recorded act exists beyond the result at that instant. The released contract says
 * so, and said it only in a doc comment no model ever reads: the grounding called this a bounded
 * PAGE and named "the total they were drawn from" without ever naming that total's scope.
 *
 * It also said "the individual act records themselves are authoritative, but the coverage summary
 * is derived". The class declares `authoritative: false` for ALL of it, and each item carried a
 * field called "authority source" — an invitation to split a standing that was never split.
 *
 *     RETRIEVAL COVERAGE  != REAL-WORLD COVERAGE
 *     COMPLETE RETRIEVAL  != COMPLETE HISTORY
 *     DERIVED             != AUTHORITATIVE
 *
 * No database, no network, no model. Every seam is injected.
 */
import assert from "node:assert/strict";

import {
  readRecordedActGroundingSource,
  RECORDED_ACT_GROUNDING_PROVENANCE,
} from "../../src/features/governance-activity/heby-recorded-act-source.server";
import {
  RECORDED_ACT_PAGE_LIMIT,
  type RecordedAct,
  type RecordedActHistoryResult,
} from "../../src/features/governance-activity/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111" } as unknown as TenantContext;

function act(): RecordedAct {
  return {
    occurredAt: "2026-08-29T14:32:38.314Z",
    action: "integration.credential.replaced",
    entityType: "integration_credential",
    actorType: "human",
    result: "committed",
    source: "integration-credentials",
    authoritySource: "membership",
    simulation: false,
  };
}

function page(carried: number, total: number): RecordedActHistoryResult {
  return {
    status: "recorded",
    tenantId: TENANT.tenantId,
    generatedAt: "2026-08-30T09:00:00.000Z",
    page: {
      acts: Array.from({ length: carried }, act),
      totalRecordedActs: total,
      truncated: total > carried,
    },
  };
}

const groundOn = (result: RecordedActHistoryResult) =>
  readRecordedActGroundingSource(TENANT, { readHistory: async () => result });

async function main(): Promise<void> {
  /* ── CASE A · 18 CARRIED OF 18 TOTAL — RETRIEVAL COVERAGE IS COMPLETE ────── */
  {
    const resolution = await groundOn(page(18, 18));
    const coverage = resolution.items[0]!.detail;

    assert.match(coverage, /18 of 18 recorded acts carried/);
    assert.match(coverage, /Retrieval coverage is COMPLETE/i);
    /* The exact claim production Heby could not make. */
    assert.match(
      coverage,
      /no further Hebun-recorded act exists beyond this result/i,
      "complete retrieval coverage must be stated, not left to inference",
    );
    /* And WHY it can be made: the total is not a count of a window. */
    assert.match(coverage, /counted over the whole ledger, not over this page/i);
    /* The instant qualifier — the ledger may grow after the read. */
    assert.match(coverage, /at the instant it was read/i);

    /* REAL-WORLD COVERAGE IS STILL NOT CLAIMED, in the very same item. */
    assert.match(
      coverage,
      /Hebun does not record every act this organization performs/i,
      "complete retrieval coverage must never read as a complete history",
    );
    assert.match(coverage, /not a\s+complete history of its activity/i);

    /* It must not describe itself as a window or as partial. */
    assert.ok(!/window/i.test(coverage), "the coverage item must not describe a retrieval window");
    assert.ok(!/PARTIAL/i.test(coverage));
  }

  /* ── CASE B · 20 CARRIED OF 25 TOTAL — PARTIAL, AND THE REMAINDER IS NAMED ─ */
  {
    const resolution = await groundOn(page(20, 25));
    const coverage = resolution.items[0]!.detail;

    assert.match(coverage, /20 of 25 recorded acts carried/);
    assert.match(coverage, /Retrieval coverage is PARTIAL/i);
    assert.match(
      coverage,
      /5 further acts Hebun recorded for this organization exist outside this result/i,
      "the remainder is stated as a number, never left as 'more'",
    );
    assert.match(coverage, new RegExp(`page bound ${RECORDED_ACT_PAGE_LIMIT}`, "i"));

    /* The completeness claim of Case A must NOT appear here. */
    assert.ok(
      !/no further Hebun-recorded act exists beyond this result/i.test(coverage),
      "a truncated page must never claim complete retrieval coverage",
    );
    /* And real-world coverage is still disclaimed, in the same item. */
    assert.match(coverage, /Hebun does not record every act this organization performs/i);

    /* Singular/plural is not left broken when exactly one act remains. */
    const one = await groundOn(page(20, 21));
    assert.match(one.items[0]!.detail, /1 further act Hebun recorded/);
    assert.ok(!/1 further acts /.test(one.items[0]!.detail));
  }

  /* ── CASE C · THE WHOLE SOURCE STAYS DERIVED ─────────────────────────────── */
  {
    const resolution = await groundOn(page(18, 18));
    assert.equal(resolution.authoritative, false, "the class is derived");
    assert.equal(resolution.provenance, RECORDED_ACT_GROUNDING_PROVENANCE);

    /*
     * THE SPLIT-STANDING CLAIM MUST BE REFUSED IN WORDS. Production Heby said the act records were
     * authoritative and only the summary derived. Nothing in the class supports that, so the
     * provenance now denies it explicitly rather than leaving one `authoritative: false` flag to
     * carry the whole argument.
     */
    assert.match(
      resolution.provenance,
      /EVERY ITEM IN THIS SOURCE IS DERIVED \(authoritative: false\), including the individual act items/i,
    );
    assert.match(resolution.provenance, /none of them is authoritative evidence/i);

    /* `authority source` is a FIELD on the record, and the grounding says so both places. */
    assert.match(
      resolution.provenance,
      /names a field recorded on that act, never the standing of this evidence/i,
    );
    assert.match(resolution.items[1]!.detail, /recorded authority-source field membership/);
  }

  /* ── CASE D · THE PROVENANCE NAMES BOTH DIMENSIONS AND THE TOTAL'S SCOPE ─── */
  {
    const provenance = RECORDED_ACT_GROUNDING_PROVENANCE;
    assert.match(provenance, /TWO SEPARATE COVERAGE QUESTIONS, WHICH MUST NOT BE MERGED/i);
    assert.match(provenance, /RETRIEVAL COVERAGE/);
    assert.match(provenance, /REAL-WORLD COVERAGE/);
    /* The sentence whose absence caused the defect. */
    assert.match(
      provenance,
      /count over this tenant's ENTIRE recorded ledger — unbounded, taken independently of the carried page, not a count of some window/i,
      "the total's scope must be stated in the grounding, not only in a doc comment",
    );
    assert.match(
      provenance,
      /complete retrieval coverage is still not a complete history of organizational activity/i,
    );
  }

  /* ── CASE E · AN EMPTY LEDGER IS STILL NOT A COMPLETE-HISTORY CLAIM ──────── */
  {
    const empty = await groundOn({
      status: "empty",
      tenantId: TENANT.tenantId,
      generatedAt: "2026-08-30T09:00:00.000Z",
    });
    assert.equal(empty.state, "resolved");
    assert.match(empty.items[0]!.detail, /measured zero, not a failed read/i);
    /* The real-world disclaimer lives in the provenance, which travels with every item. */
    assert.match(empty.provenance, /Hebun does not record every act this organization performs/i);
  }

  console.log("e26-recorded-act-grounding/coverage-semantics: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
