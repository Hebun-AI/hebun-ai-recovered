import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RecordedUsageCard } from "@/components/platform-providers/recorded-usage-card";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readBillingState } from "@/features/billing/billing.server";
import { asPlanCode, PLAN_LABEL, planFeatures, PRO_PRICE } from "@/features/tenant-entitlements/plans";
import { readPlanAndUsage } from "@/features/plan-usage/plan-usage.server";
import { utcInstant } from "@/lib/format";
import { openBillingPortalAction, startProCheckoutAction } from "./actions";

export const metadata = { title: "Plan & Usage — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * V1-STAGE-6 — Plan & Usage: the organization's plan as recorded, today's limits with the admissions
 * measured against them, and recorded provider token usage.
 *
 * COMMERCIAL-ACTIVATION-1 — the plan now has rights and a way to change it. The limits shown are the
 * ones the cap enforces (same constants). Upgrading and managing the subscription leave for Stripe
 * through Owner-only server actions; the plan itself changes only when Stripe's signed webhook
 * confirms it, so this page never claims a plan the records do not hold.
 */
const CLASS_LABEL = { model: "AI model requests (Heby, agents)", media: "Image and video generations" } as const;

/** Closed set: anything else in `?billing=` is ignored, never echoed. */
const BILLING_NOTICE: Readonly<Record<string, string>> = {
  success:
    "Stripe accepted the checkout. Your plan becomes Pro as soon as Stripe confirms the payment to Hebun — usually within a minute. Refresh to see it.",
  cancelled: "Checkout was cancelled. Nothing was charged and your plan is unchanged.",
  "not-the-owner": "Only your organization's Owner can change the plan or manage the subscription.",
  "already-pro": "Your organization already has an active Pro subscription. Use “Manage subscription” to change it.",
  "billing-unavailable": "Paid plans are not available right now. Nothing was charged.",
  "price-mismatch": "The Pro price is not configured correctly, so no checkout was opened. Nothing was charged.",
  "no-billing-account": "There is no subscription to manage yet.",
  "stripe-unavailable": "Stripe could not be reached. Nothing was charged; try again shortly.",
  "persistence-unavailable": "Hebun is unavailable right now. Nothing was charged or changed.",
  unauthenticated: "Your session ended. Sign in again.",
};

export default async function PlanUsagePage({ searchParams }: { searchParams?: Promise<{ billing?: string }> }) {
  const tenant = await resolveTenantContext();
  const [read, billing, params] = await Promise.all([readPlanAndUsage(tenant), readBillingState(tenant), searchParams ?? Promise.resolve({} as { billing?: string })]);
  const notice = typeof params.billing === "string" ? BILLING_NOTICE[params.billing] : undefined;
  const header = <PageHeader title="Plan & Usage" context="Your organization's plan, today's AI limits, and recorded AI usage." />;

  if (read.status !== "read") {
    return (
      <>
        {header}
        <p className="text-sm text-fg-muted">
          {read.status === "unauthenticated" ? "Sign in to see your plan and usage." : "Plan and usage could not be read right now. Nothing was substituted."}
        </p>
      </>
    );
  }
  const { organization, dispatch, recorded } = read;
  const plan = asPlanCode(organization.plan);
  const features = planFeatures(plan);
  return (
    <>
      {header}
      <p className="mb-6 text-xs text-fg-muted">
        Read {utcInstant(read.readAt)}. Refresh the page for current figures.{" "}
        <Link href="/account" className="underline underline-offset-2">
          Back to Profile &amp; Team
        </Link>
      </p>

      {notice ? (
        <p role="status" className="mb-6 max-w-3xl rounded-md border border-border-subtle px-3 py-2 text-sm text-fg-primary">
          {notice}
        </p>
      ) : null}

      <section aria-labelledby="plan-heading" className="max-w-3xl space-y-3">
        <h2 id="plan-heading" className="text-sm font-semibold text-fg-primary">
          Plan
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-fg-muted">Organization</dt>
          <dd className="text-fg-primary">{organization.name}</dd>
          <dt className="text-fg-muted">Plan</dt>
          <dd className="text-fg-primary">{PLAN_LABEL[plan]}</dd>
          <dt className="text-fg-muted">Video generation</dt>
          <dd className="text-fg-primary">
            {features.videoGeneration ? "Included (counts toward the daily media limit)" : "Not included in Free — available on Pro"}
          </dd>
          <dt className="text-fg-muted">Members</dt>
          <dd className="text-fg-primary">
            {features.memberLimit === null ? "No plan limit" : `Up to ${features.memberLimit} (members plus pending invitations)`}
          </dd>
          {billing?.subscriptionStatus ? (
            <>
              <dt className="text-fg-muted">Subscription</dt>
              <dd className="text-fg-primary">{billing.subscriptionStatus.replace(/_/g, " ")}</dd>
            </>
          ) : null}
        </dl>
        {plan === "founding" ? (
          <p className="text-xs text-fg-muted">
            Founding: your organization existed before paid plans, so it keeps its original limits. Upgrading to Pro is
            optional, and cancelling Pro returns it to Founding — never to Free.
          </p>
        ) : null}
        {billing?.billingConfigured ? (
          billing.isOwner ? (
            <div className="flex flex-wrap gap-3 pt-1">
              {plan !== "pro" ? (
                <form action={startProCheckoutAction}>
                  <Button type="submit">Upgrade to Pro — {PRO_PRICE.display}/month</Button>
                </form>
              ) : null}
              {billing.hasBillingAccount ? (
                <form action={openBillingPortalAction}>
                  <Button type="submit" variant="outline">
                    Manage subscription
                  </Button>
                </form>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-fg-muted">Only your organization&apos;s Owner can change the plan.</p>
          )
        ) : (
          <p className="text-xs text-fg-muted">Paid plans are not available in this environment yet.</p>
        )}
        <p className="text-xs text-fg-muted">
          Prices and limits for every plan are on the{" "}
          <Link href="/pricing" className="underline underline-offset-2">
            pricing page
          </Link>
          . Payments are processed by Stripe; Hebun never sees or stores card details.
        </p>
      </section>

      <section aria-labelledby="limits-heading" className="mt-8 max-w-3xl space-y-3">
        <h2 id="limits-heading" className="text-sm font-semibold text-fg-primary">
          Today&apos;s AI limits
        </h2>
        {dispatch.status !== "read" ? (
          <p className="text-sm text-fg-muted">Today&apos;s limits could not be read right now. Nothing was substituted.</p>
        ) : (
          <>
            <table className="w-full min-w-0 text-left text-sm">
              <thead className="text-xs text-fg-muted">
                <tr>
                  <th scope="col" className="py-1 pr-4 font-medium">Kind</th>
                  <th scope="col" className="py-1 pr-4 font-medium">Used today (measured)</th>
                  <th scope="col" className="py-1 font-medium">Daily limit</th>
                </tr>
              </thead>
              <tbody>
                {dispatch.classes.map((c) => (
                  <tr key={c.dispatchClass} className="border-t border-border-subtle">
                    <td className="py-1.5 pr-4 text-fg-primary">{CLASS_LABEL[c.dispatchClass]}</td>
                    <td className="py-1.5 pr-4 tabular-nums text-fg-primary">{c.admittedInWindow}</td>
                    <td className="py-1.5 tabular-nums text-fg-secondary">
                      {c.capPerTenantUtcDay === 0 ? "0 — this kind is currently turned off" : c.capPerTenantUtcDay}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-fg-muted">
              Period: {utcInstant(dispatch.windowStart.toISOString())} to {utcInstant(dispatch.windowEnd.toISOString())} (one UTC
              day). &ldquo;Used today&rdquo; is counted from Hebun&apos;s own records of every request it let through — measured,
              not estimated. A request is counted when it is allowed out, even if the provider later fails. When the limit is
              reached, further requests of that kind are refused until the next UTC day.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="usage-heading" className="mt-8 max-w-4xl space-y-3">
        <h2 id="usage-heading" className="text-sm font-semibold text-fg-primary">
          Recorded AI usage
        </h2>
        <p className="text-xs text-fg-muted">
          Period: all recorded history for your organization, with recent UTC days below. Token counts are what the
          provider reported and Hebun recorded — a lower bound, never an estimate and never a bill.
        </p>
        <RecordedUsageCard read={recorded} />
      </section>
    </>
  );
}
