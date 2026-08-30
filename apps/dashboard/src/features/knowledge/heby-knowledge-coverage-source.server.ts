/*
 * knowledge/heby-knowledge-coverage-source.server.ts — the Company Understanding coverage view,
 * shaped for Heby grounding (E2-8).
 *
 * ── WHAT HEBY'S EXISTING KNOWLEDGE CLASS CANNOT ANSWER ───────────────────────
 *
 * K1/KR3's `knowledge` class is QUERY-SCOPED RETRIEVAL: it ranks the facts that match the question
 * asked and returns those. It is the right shape for "what do we know about X", and it is
 * structurally unable to answer "what do we know at all" — a retrieval that found nothing looks
 * exactly like an organization that recorded nothing, and a retrieval that found five facts says
 * nothing about whether five or five hundred exist.
 *
 *     A RETRIEVAL RESULT != AN INVENTORY
 *
 * Most importantly, retrieval can never name an area the organization holds NOTHING in. A query
 * returns what matched; it cannot return the absence of a category nobody asked about. That
 * absence — which declared areas are empty — is the most useful thing a new organization can be
 * told, and R6B already computes it.
 *
 * ── WHY IT IS ITS OWN CLASS, THOUGH THE OWNER IS THE SAME ────────────────────
 *
 * Same reason E2-7 separated from E2-6, in the same direction. `knowledge` is a BOUNDED, ranked,
 * question-shaped subset. This is an UNBOUNDED aggregate that is complete by construction
 * (`CompanyUnderstandingView.truncated` is the literal `false`, because the per-domain aggregate
 * has no pagination). Under one provenance line "is this all of it?" would have two answers and one
 * sentence — E2-6's argument, applied again.
 *
 * ── IT IS A SHAPER. IT IS NOT AN AUTHORITY, AND IT RE-DERIVES NOTHING ────────
 *
 * This module calls the released read seam and renders what it returns. It opens no database, holds
 * no tenant of its own, computes no count, applies no taxonomy and stores nothing. It cannot
 * disagree with Knowledge because it never recomputes anything Knowledge computed.
 *
 * ── THE THREE THINGS COVERAGE IS NOT, CARRIED WITH THE NUMBERS ───────────────
 *
 * R6B states these on its own surface and they travel here rather than being left for a reader to
 * remember, exactly as E2-4 and E2-7 carry their own non-claims:
 *
 *     COVERAGE != CORRECTNESS     Hebun holds what it was given and verifies none of it.
 *     COVERAGE != RATIFICATION    An area held up entirely by unapproved drafts is covered.
 *     COVERAGE != UNDERSTANDING   It counts records, and a count is not comprehension.
 *
 * And the one that matters most, because it is the inference a reader will otherwise make for free:
 *
 *     MISSING != THE ORGANIZATION LACKS IT
 *
 * `missing` is a statement about HEBUN's records, never about the organization. There is no score,
 * no percentage, no confidence, no health, no readiness and no priority anywhere in this module,
 * because R6B computes none of them and a field that could hold a judgement is a field a future
 * edit will fill.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readCompanyUnderstanding,
  type CompanyUnderstandingResult,
} from "./company-understanding-read.server";
import type {
  CompanyUnderstandingCategoryView,
  CompanyUnderstandingView,
  UncategorizedDomainView,
} from "./company-understanding";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that a covered area is correct, that a covered area
 * is approved, that a missing area is an organizational deficiency, or that a bigger number is
 * better.
 */
export const KNOWLEDGE_COVERAGE_GROUNDING_PROVENANCE =
  "Company Understanding — which declared knowledge areas this organization holds Knowledge facts " +
  "in force in, read tenant-scoped from the session and DERIVED (authoritative: false). The counts " +
  "come from a per-domain aggregate with NO pagination, so every declared area is reported whether " +
  "or not anything was found in it and this is never a page of itself. COVERAGE IS THE PRESENCE OF " +
  "EVIDENCE AND NOTHING MORE: it is not correctness, because Hebun holds what it was given and " +
  "verifies none of it; it is not ratification, because an area held up entirely by unapproved " +
  "drafts is covered; and it is not understanding, because it counts records and a count is not " +
  "comprehension. An area reported as missing means HEBUN holds no Knowledge in force there — it " +
  "never means the organization lacks it. No score, percentage, confidence, health, readiness, " +
  "priority or ranking is computed over these areas, and none may be inferred from them.";

/** The non-claims, carried with the numbers rather than left to a surface to remember. */
export const KNOWLEDGE_COVERAGE_NON_CLAIMS: readonly string[] = Object.freeze([
  "coverage is the presence of evidence, not the correctness of it",
  "coverage is not approval — an area can be covered entirely by unapproved drafts",
  "a record count is not comprehension, and more records is not better",
  "these are the facts Hebun holds, not everything this organization knows",
]);

/**
 * The refusal carried on the summary item, held as its own constant.
 *
 * IT NAMES THE JUDGEMENTS IT FORBIDS, which is what makes it useful to a model and what makes a
 * vocabulary ban fail on it. E2-4, E2-5, E2-6 and E2-7 each recorded that collision; the settled
 * remedy is to pin the denial BY EQUALITY and run any word ban over only what the source CLAIMS.
 * Keeping it separately named is what lets a test do both.
 */
export const KNOWLEDGE_COVERAGE_SUMMARY_REFUSAL =
  "Hebun states which declared areas it holds evidence in and interprets none of it: it holds no " +
  "target for how many areas should be covered, no expected number of records for any area, and no " +
  "authority to say that this organization is well documented, poorly documented, ready or at risk.";

/** An area that was read and held nothing. An established fact about Hebun's records. */
export const KNOWLEDGE_COVERAGE_MISSING_STATEMENT =
  "Hebun holds no Knowledge in force in this declared area — a measured absence in Hebun's records, " +
  "not a claim that the organization lacks it";

export interface KnowledgeCoverageGroundingDeps {
  readonly readCoverage?: (
    tenant: Pick<TenantContext, "tenantId"> | null,
  ) => Promise<CompanyUnderstandingResult>;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "knowledge-coverage",
    state,
    provenance: KNOWLEDGE_COVERAGE_GROUNDING_PROVENANCE,
    authoritative: false,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

/**
 * One declared area's detail line.
 *
 * A missing area states its absence as a measured one rather than rendering as a zero with nothing
 * beside it, for the same reason E2-7 spells out a measured zero: an empty line invites reading the
 * area as unread.
 *
 * A covered area reports the qualities R6B keeps BESIDE coverage rather than folded into it —
 * approved, unapproved, past its declared review date — because folding any of them into the word
 * "covered" is exactly the judgement this class must not make. `staleCount` is rendered as "past
 * its declared review date", which is what the column measures; calling it out of date would be a
 * verdict on the content.
 */
function detailForCategory(category: CompanyUnderstandingCategoryView): string {
  if (category.state === "missing") {
    return `${category.describes} · ${KNOWLEDGE_COVERAGE_MISSING_STATEMENT}`;
  }

  const parts = [
    `${category.recordCount} ${plural(category.recordCount, "fact")} in force`,
    `${category.ratifiedCount} carrying a bound Governance decision`,
    `${category.provisionalCount} not marked authoritative`,
    `${category.staleCount} past its declared review date`,
  ];
  /* Counts that are NOT part of coverage are named as such, so their exclusion is visible. */
  const excluded = [
    category.expiredCount > 0 ? `${category.expiredCount} past its effective window` : "",
    category.notYetEffectiveCount > 0
      ? `${category.notYetEffectiveCount} not yet in effect`
      : "",
    category.withdrawnCount > 0 ? `${category.withdrawnCount} withdrawn or unreadable` : "",
  ].filter(Boolean);

  return (
    `${category.describes} · ${parts.join(", ")}` +
    (excluded.length === 0
      ? ""
      : ` · not counted as coverage: ${excluded.join(", ")}`)
  );
}

function detailForUncategorized(domain: UncategorizedDomainView): string {
  return (
    `${domain.recordCount} ${plural(domain.recordCount, "fact")} in force and ` +
    `${domain.notInForceCount} not in force, under an area key no declared category claims · ` +
    "reported rather than dropped, so a taxonomy classifies what Hebun holds and never erases it"
  );
}

/** The leading item: how much of the declared taxonomy is covered, and how complete this is. */
function summaryItem(view: CompanyUnderstandingView): ResolvedSourceItem {
  const covered = view.categories.filter((c) => c.state === "covered");
  const missing = view.categories.filter((c) => c.state === "missing");
  const inForce = view.categories.reduce((total, c) => total + c.recordCount, 0);
  const uncategorizedInForce = view.uncategorized.reduce((t, d) => t + d.recordCount, 0);

  return {
    recordRef: "coverage:summary",
    label: "Declared knowledge areas Hebun holds evidence in",
    detail:
      `${covered.length} of ${view.categories.length} declared ${plural(view.categories.length, "area")} ` +
      `covered and ${missing.length} ${plural(missing.length, "area")} with nothing in force, over ` +
      `${inForce} ${plural(inForce, "fact")} in force inside the taxonomy` +
      (view.uncategorized.length === 0
        ? ""
        : ` plus ${uncategorizedInForce} ${plural(uncategorizedInForce, "fact")} in force under ` +
          `${view.uncategorized.length} area ${plural(view.uncategorized.length, "key")} the taxonomy does not claim`) +
      `, read at ${view.generatedAt}. Every declared area is listed whether or not anything was ` +
      "found in it, and the aggregate behind these counts has no bound, so this is the complete " +
      "set of areas rather than a page of them. " +
      KNOWLEDGE_COVERAGE_SUMMARY_REFUSAL,
    lifecycle: "settled",
  };
}

/**
 * Read this tenant's Company Understanding coverage for Heby grounding.
 *
 * Tenant-scoped through the Knowledge authority's own read seam — this module passes the
 * server-resolved context straight through and constructs no query. There is no parameter by which
 * a caller could name another tenant, another taxonomy or another area, so those are not refused
 * here; they are UNREPRESENTABLE.
 *
 * THE SUMMARY COMES FIRST, THEN EVERY DECLARED AREA IN TAXONOMY ORDER, THEN ANY AREA KEY THE
 * TAXONOMY DOES NOT CLAIM. Missing areas are NOT omitted and NOT sorted to the end — an ordering
 * that pushed empty areas out of sight would be the same defect as dropping them, arrived at more
 * politely.
 */
export async function readKnowledgeCoverageGroundingSource(
  tenant: TenantContext | null,
  deps: KnowledgeCoverageGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge coverage grounding reads are server-only.");
  }

  const read = await (deps.readCoverage ??
    ((t: Pick<TenantContext, "tenantId"> | null) => readCompanyUnderstanding(t)))(tenant);

  if (read.status === "unavailable") return base("unavailable", [], read.reason);

  const view = read.view;

  const items: ResolvedSourceItem[] = [summaryItem(view)];

  for (const category of view.categories) {
    items.push({
      recordRef: `area:${category.key}`,
      label: category.label,
      detail: detailForCategory(category),
      lifecycle: "settled",
      /*
       * The real `domain_key` values are OPERATOR-AUTHORED strings. E2-6 settled where such text
       * belongs: `content` reaches the model's grounding context and never Heby's own validated
       * prose, so an area key that happens to read like an instruction or a claim cannot turn into
       * a sentence Heby appears to be making.
       */
      ...(category.matchedDomainKeys.length === 0
        ? {}
        : { content: `area keys folded into ${category.key}: ${category.matchedDomainKeys.join(", ")}` }),
    });
  }

  for (const domain of view.uncategorized) {
    items.push({
      recordRef: `domain:${domain.domainKey}`,
      label: "Area key outside the declared taxonomy",
      detail: detailForUncategorized(domain),
      lifecycle: "settled",
      content: `area key: ${domain.domainKey}`,
    });
  }

  return base("resolved", items);
}
