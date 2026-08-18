/*
 * knowledge/company-understanding.ts — the derived Company Understanding view (R6B).
 *
 * ── A READ MODEL, NOT AN AUTHORITY ───────────────────────────────────────────
 *
 * This file owns no table, no row, no cache and no state. It takes per-domain counts the canonical
 * Knowledge authority produced and the frozen product taxonomy, and returns a view. Given the same
 * counts and the same clock it returns the same view — which is what makes it testable without a
 * database, and what makes it impossible for it to disagree with Knowledge.
 *
 * ── WHAT "COVERED" MEANS, AND THE THREE THINGS IT DOES NOT ───────────────────
 *
 * A category is COVERED when the organization holds at least one Knowledge fact IN FORCE that maps
 * to it. In force is the retrieval eligibility Hebun already enforces: readable, not archived or
 * retired, not expired, not yet to take effect.
 *
 *   Coverage is not CORRECTNESS.    Hebun holds what it was given and verifies none of it.
 *   Coverage is not RATIFICATION.   A category covered entirely by unapproved drafts is covered.
 *   Coverage is not UNDERSTANDING.  It counts records, and a count is not comprehension.
 *
 * These are not softening; each blocks a specific misreading, and the surface repeats them.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * No score, no percentage, no confidence, no health, no truth value, no "understood" flag, and no
 * category-level authoritative or confirmed claim. Hebun computes none of those, and K4 already
 * settled why: RATIFIED IS NOT TRUE. A single number over ten categories would be read as a
 * judgement about the organization, which is a claim this projection cannot support and R7's
 * question anyway. Counts are reported per category and the reader draws their own conclusion.
 *
 * `MISSING` likewise means one thing only: Hebun holds no Knowledge evidence in force in that
 * declared area. It never means the organization lacks it.
 *
 * Pure. No database, no tenant context, no provider, no model, no writer, no I/O.
 */

import type { KnowledgeDomainCounts } from "./durable-knowledge-repository.server";
import {
  categoryForDomainKey,
  listCompanyUnderstandingCategories,
  type CompanyUnderstandingCategoryKey,
} from "./company-understanding-taxonomy";

/** One declared area, with what this organization holds in it. */
export interface CompanyUnderstandingCategoryView {
  readonly key: CompanyUnderstandingCategoryKey;
  readonly label: string;
  readonly describes: string;
  /** `covered` when at least one fact is in force here. Nothing weaker qualifies. */
  readonly state: "covered" | "missing";
  /** The real `domain_key` values that landed here — so a reader can audit the mapping. */
  readonly matchedDomainKeys: readonly string[];
  /** Facts in force. The coverage basis, and the only total the subsets below belong to. */
  readonly recordCount: number;
  /** Subset of `recordCount`: carries a bound Governance decision. */
  readonly ratifiedCount: number;
  /** Subset of `recordCount`: not marked authoritative. */
  readonly provisionalCount: number;
  /** Subset of `recordCount`: past its declared review date. */
  readonly staleCount: number;
  /** NOT in `recordCount`: past its effective window, so not current coverage. */
  readonly expiredCount: number;
  /** NOT in `recordCount`: its effective window has not opened yet. */
  readonly notYetEffectiveCount: number;
  /** NOT in `recordCount`: archived or retired, or its active node did not resolve. */
  readonly withdrawnCount: number;
}

/** A real `domain_key` no declared category claims. Surfaced, never dropped. */
export interface UncategorizedDomainView {
  readonly domainKey: string;
  /** Facts in force under this key. */
  readonly recordCount: number;
  /** Facts under this key that are not in force, for the same reasons a category reports. */
  readonly notInForceCount: number;
}

export interface CompanyUnderstandingView {
  readonly generatedAt: string;
  /**
   * Always `false`, and present on purpose. The counts come from a per-domain aggregate with no
   * pagination, so this view is never a page of itself — the field says so where a reader would
   * otherwise have to trust that it is. `listFacts` cannot produce this shape; see the repository.
   */
  readonly truncated: false;
  /** Every declared category, always all of them, in taxonomy order. */
  readonly categories: readonly CompanyUnderstandingCategoryView[];
  /** Domain keys outside the taxonomy, in the order the aggregate returned them. */
  readonly uncategorized: readonly UncategorizedDomainView[];
}

/** The counts a category accumulates while domains are folded into it. */
interface Tally {
  inForce: number;
  ratified: number;
  provisional: number;
  reviewOverdue: number;
  expired: number;
  notYetEffective: number;
  withdrawn: number;
  matched: string[];
}

function emptyTally(): Tally {
  return {
    inForce: 0,
    ratified: 0,
    provisional: 0,
    reviewOverdue: 0,
    expired: 0,
    notYetEffective: 0,
    withdrawn: 0,
    matched: [],
  };
}

/**
 * Build the view.
 *
 * Every declared category appears whether or not the organization holds anything in it — a missing
 * area is the most useful thing this view reports, and omitting empty categories would hide exactly
 * the information a new organization needs.
 */
export function projectCompanyUnderstanding(
  counts: readonly KnowledgeDomainCounts[],
  now: Date,
): CompanyUnderstandingView {
  const categories = listCompanyUnderstandingCategories();
  const tallies = new Map<CompanyUnderstandingCategoryKey, Tally>(
    categories.map((category) => [category.key, emptyTally()]),
  );
  const uncategorized: UncategorizedDomainView[] = [];

  for (const row of counts) {
    /*
     * `withdrawn` and `unreadable` are separate exclusion reasons in the repository and are merged
     * here into one operator-facing bucket: both mean "this fact is not servable and its content is
     * not the reason". Merging two reasons is safe; dropping either would not be.
     */
    const withdrawn = row.withdrawn + row.unreadable;
    const category = categoryForDomainKey(row.domainKey);

    if (!category) {
      /*
       * THE LOAD-BEARING BRANCH. A domain key no category claims is reported, not discarded. A
       * taxonomy may classify what Hebun knows; it may never erase it. Dropping this row would let
       * the view report an area as missing while the organization's records for it sit unreachable
       * in the database.
       */
      uncategorized.push({
        domainKey: row.domainKey,
        recordCount: row.inForce,
        notInForceCount: row.expired + row.notYetEffective + withdrawn,
      });
      continue;
    }

    const tally = tallies.get(category.key);
    // Total over the taxonomy: every category key was seeded above, so this cannot be reached.
    if (!tally) continue;

    tally.inForce += row.inForce;
    tally.ratified += row.ratified;
    tally.provisional += row.provisional;
    tally.reviewOverdue += row.reviewOverdue;
    tally.expired += row.expired;
    tally.notYetEffective += row.notYetEffective;
    tally.withdrawn += withdrawn;
    tally.matched.push(row.domainKey);
  }

  return {
    generatedAt: now.toISOString(),
    truncated: false,
    categories: categories.map((category) => {
      const tally = tallies.get(category.key) ?? emptyTally();
      return {
        key: category.key,
        label: category.label,
        describes: category.describes,
        /*
         * COVERAGE IS EVIDENCE-PRESENCE. Not ratification, not authority, not freshness — a
         * category held up entirely by unapproved, review-overdue drafts is covered, and each of
         * those qualities is reported beside it rather than folded into this one word.
         */
        state: tally.inForce > 0 ? "covered" : "missing",
        matchedDomainKeys: tally.matched,
        recordCount: tally.inForce,
        ratifiedCount: tally.ratified,
        provisionalCount: tally.provisional,
        staleCount: tally.reviewOverdue,
        expiredCount: tally.expired,
        notYetEffectiveCount: tally.notYetEffective,
        withdrawnCount: tally.withdrawn,
      };
    }),
    uncategorized,
  };
}
