/*
 * Company Understanding (R6B, recomposed in Stage 1) — which declared areas this organization has
 * Knowledge in.
 *
 * The loop this closes: Hebun could already ingest, govern, ratify, retrieve and cite a tenant's
 * Knowledge, and told the tenant nothing back. A customer uploaded a file, watched records appear
 * in a list, and had no way to learn what Hebun now held, what was unconfirmed, or what it had
 * nothing about. This section answers exactly that and stops there.
 *
 * IT DERIVES; IT DOES NOT DECIDE. Every number comes from the canonical Knowledge authority through
 * one read-only aggregate. There is no score, no percentage, no confidence, no health figure and no
 * "understood" verdict, because Hebun computes none of those and a single number over ten areas
 * would be read as a judgement about the organization.
 *
 * IT OFFERS NO CONTROLS. Authoring and ingestion live in their own section; ratification lives in
 * its own section under a different authority. Putting a second ratify button here would be a
 * second call site for one governed act.
 *
 * ── WHAT STAGE 1 CHANGED ─────────────────────────────────────────────────────
 *
 * The aggregate, the counts and every honesty sentence are unchanged. Two things changed:
 *
 *  1. It no longer draws its own card header. `WorkspaceSection` states the title, the question and
 *     the provenance — and states the provenance as DERIVED, which this card could previously only
 *     imply in prose. A recomputed coverage view must never carry a record's visual weight.
 *  2. Ten full-width rows became a responsive grid, and the sub-`text-xs` sizes became the Stage 0
 *     scale. Ten areas of "no Knowledge yet" used to occupy an entire viewport and push the way in
 *     below the fold; the same ten facts now fit above it without a word being removed.
 *
 * Server component, presentational only. Domain keys are tenant-supplied text and are rendered
 * through React's escaping — displayed, never executed.
 */

import { StateBlock } from "@/components/ui/state-block";
import { COMPANY_UNDERSTANDING_SUMMARY } from "@/features/knowledge/company-understanding-taxonomy";
import type { CompanyUnderstandingCategoryView } from "@/features/knowledge/company-understanding";
import type { CompanyUnderstandingResult } from "@/features/knowledge/company-understanding-read.server";

/**
 * The standing line under a covered area.
 *
 * Built from the counts rather than summarised into a word: "3 records · 3 provisional" is a fact,
 * "unverified" would be a judgement. Only non-zero qualifiers appear, so a clean area stays quiet
 * instead of carrying a row of zeroes a reader has to discount.
 */
function Standing({ category }: { category: CompanyUnderstandingCategoryView }) {
  const parts: string[] = [
    `${category.recordCount} record${category.recordCount === 1 ? "" : "s"} in force`,
  ];
  if (category.ratifiedCount > 0) parts.push(`${category.ratifiedCount} ratified`);
  if (category.provisionalCount > 0) parts.push(`${category.provisionalCount} provisional`);
  if (category.staleCount > 0) parts.push(`${category.staleCount} past review date`);
  if (category.expiredCount > 0) parts.push(`${category.expiredCount} expired`);
  if (category.notYetEffectiveCount > 0) {
    parts.push(`${category.notYetEffectiveCount} not yet effective`);
  }
  if (category.withdrawnCount > 0) parts.push(`${category.withdrawnCount} withdrawn`);

  return (
    <p className="text-meta text-fg-muted">
      {parts.join(" · ")}
      {category.matchedDomainKeys.length > 0 ? (
        <>
          {" · "}
          <span className="font-mono">{category.matchedDomainKeys.join(", ")}</span>
        </>
      ) : null}
    </p>
  );
}

export function CompanyUnderstandingCard({ result }: { result: CompanyUnderstandingResult }) {
  if (result.status === "unavailable") {
    return (
      <StateBlock
        tone={result.reason === "no-authorized-tenant-context" ? "restricted" : "unavailable"}
        title={
          result.reason === "no-authorized-tenant-context"
            ? "Coverage is not readable without a signed-in organization"
            : "Coverage could not be derived"
        }
        description={
          result.reason === "no-authorized-tenant-context"
            ? "Sign in to see which areas of your organization Hebun holds Knowledge about. This is not a statement that any area is empty."
            : result.detail
        }
      />
    );
  }

  const { categories, uncategorized } = result.view;
  const covered = categories.filter((category) => category.state === "covered");
  const missing = categories.filter((category) => category.state === "missing");

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="max-w-prose text-body text-fg-secondary text-pretty">
        {covered.length === 0
          ? "Hebun holds no Knowledge in force in any of the areas below. That is your organization's real state — nothing was assumed to fill it."
          : `Hebun holds Knowledge in ${covered.length} of ${categories.length} areas.`}
      </p>

      <ul className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <li
            key={category.key}
            data-coverage={category.state}
            className={
              category.state === "covered"
                ? "flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-surface p-4"
                : /* Dashed, sunken and quiet: an area Hebun holds nothing in must not read like an
                     area it does. The state is also carried in the word beneath the label. */
                  "flex min-w-0 flex-col gap-1.5 rounded-xl border border-dashed border-border bg-surface-sunken p-4"
            }
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-body font-semibold text-fg">{category.label}</h3>
              <p className="text-meta font-medium text-fg-muted">
                {category.state === "covered" ? "covered" : "no Knowledge yet"}
              </p>
            </div>
            <p className="text-meta leading-5 text-fg-secondary">{category.describes}</p>
            {category.state === "covered" ? (
              <Standing category={category} />
            ) : (
              <p className="text-meta text-fg-muted">
                {category.expiredCount + category.notYetEffectiveCount + category.withdrawnCount > 0
                  ? /*
                     * "You had evidence and it lapsed" is a different thing to be told than "you
                     * never supplied any", and collapsing them would hide work the organization
                     * already did.
                     */
                    `Nothing in force. ${category.expiredCount + category.notYetEffectiveCount + category.withdrawnCount} record(s) here are expired, not yet effective, or withdrawn.`
                  : "Hebun holds no Knowledge evidence in this area."}
              </p>
            )}
          </li>
        ))}
      </ul>

      {uncategorized.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
          <h3 className="text-body font-semibold text-fg">Outside these areas</h3>
          <p className="max-w-prose text-meta leading-5 text-fg-secondary">
            Your organization holds Knowledge under domains that none of the areas above claim. It is
            stored, readable and citable by Heby exactly as any other record — Hebun simply cannot
            place it, and says so rather than guessing.
          </p>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-meta text-fg-muted">
            {uncategorized.map((domain) => (
              <li key={domain.domainKey} className="font-mono">
                {domain.domainKey} ({domain.recordCount} in force
                {domain.notInForceCount > 0 ? `, ${domain.notInForceCount} not` : ""})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        The three sentences that block the three misreadings this section invites. They are the
        product's honesty contract, not a disclaimer: without them "8 of 10 covered" reads as a
        claim that Hebun understands the business, which it is not and cannot be.
      */}
      <p className="max-w-prose text-meta leading-5 text-fg-muted">
        {COMPANY_UNDERSTANDING_SUMMARY} Missing means Hebun holds no evidence in that area — never
        that your organization lacks it.
        {missing.length > 0
          ? " Knowledge is added through the authoring and ingestion controls above."
          : ""}
      </p>
    </div>
  );
}
