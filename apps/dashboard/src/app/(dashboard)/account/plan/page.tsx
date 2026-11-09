import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { RecordedUsageCard } from "@/components/platform-providers/recorded-usage-card";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readPlanAndUsage } from "@/features/plan-usage/plan-usage.server";
import { utcInstant } from "@/lib/format";

export const metadata = { title: "Plan & Usage — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * V1-STAGE-6 — Plan & Usage. Read only: the organization's plan as recorded, today's AI dispatch
 * safety limits with the admissions measured against them, and recorded provider token usage.
 * No price, bill, payment, subscription or plan change exists here, because none exists in Hebun.
 */
const CLASS_LABEL = { model: "AI model requests (Heby, agents)", media: "Image and video generations" } as const;

export default async function PlanUsagePage() {
  const read = await readPlanAndUsage(await resolveTenantContext());
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
  return (
    <>
      {header}
      <p className="mb-6 text-xs text-fg-muted">
        Read {utcInstant(read.readAt)}. Refresh the page for current figures.{" "}
        <Link href="/account" className="underline underline-offset-2">
          Back to Profile &amp; Team
        </Link>
      </p>

      <section aria-labelledby="plan-heading" className="max-w-3xl space-y-3">
        <h2 id="plan-heading" className="text-sm font-semibold text-fg-primary">
          Plan
        </h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-fg-muted">Organization</dt>
          <dd className="text-fg-primary">{organization.name}</dd>
          <dt className="text-fg-muted">Plan</dt>
          <dd className="text-fg-primary">{organization.plan}</dd>
        </dl>
        <p className="text-xs text-fg-muted">
          This is the plan recorded for your organization. Hebun does not show prices, invoices or amounts due, and plans
          are not changed here.
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
