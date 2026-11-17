import type { Metadata } from "next";
import Link from "next/link";
import { COMMERCIAL_PLAN_LIMITS, PRO_PRICE } from "@/features/tenant-entitlements/plans";

/*
 * /pricing — COMMERCIAL-ACTIVATION-1. The public Free / Pro comparison.
 *
 * Every number on this page is read from `tenant-entitlements/plans.ts`, the same constants the AP-3
 * cap and the member limit enforce, so the published limits cannot drift from the enforced ones.
 * Static: no session, no tenant, no database. Only features that exist in the product are listed.
 */

export const metadata: Metadata = {
  title: "Pricing",
  description: "Hebun AI plans: Free and Pro, with their published daily limits.",
};

const free = COMMERCIAL_PLAN_LIMITS.free;
const pro = COMMERCIAL_PLAN_LIMITS.pro;

const ROWS: readonly (readonly [string, string, string])[] = [
  ["Price", "$0", `${PRO_PRICE.display} per month`],
  ["Heby and agent requests", `${free.model} per day`, `${pro.model} per day`],
  ["Image and video generations", `${free.media} per day (images only)`, `${pro.media} per day, shared between images and video`],
  ["Video generation", "Not included", "Included"],
  ["Members", `${free.memberLimit}`, `Up to ${pro.memberLimit}`],
  ["Heby, Knowledge, approvals and governance", "Included", "Included"],
  ["Google Drive, Instagram and YouTube connections", "Included", "Included"],
];

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-[80ch] flex-col gap-8 px-6 py-16 text-body leading-relaxed text-fg-secondary sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-lg font-extrabold tracking-[-0.02em] text-fg">Pricing</h1>
        <p>Two plans. The limits below are the ones Hebun enforces, counted per organization per UTC day.</p>
      </div>

      <table className="w-full min-w-0 text-left text-sm">
        <thead className="text-xs text-fg-muted">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">
              <span className="sr-only">Feature</span>
            </th>
            <th scope="col" className="py-2 pr-4 font-semibold text-fg">
              Free
            </th>
            <th scope="col" className="py-2 font-semibold text-fg">
              Pro
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, f, p]) => (
            <tr key={label} className="border-t border-border">
              <th scope="row" className="py-2 pr-4 font-normal text-fg-secondary">
                {label}
              </th>
              <td className="py-2 pr-4 text-fg">{f}</td>
              <td className="py-2 text-fg">{p}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col gap-2">
        <p>
          Every organization starts on Free.{" "}
          <Link className="underline underline-offset-2" href="/register">
            Create an account
          </Link>
          , then upgrade from Plan &amp; Usage when you need Pro. Pro renews monthly until you cancel; cancelling returns your
          organization to Free and deletes nothing.
        </p>
        <p className="text-meta text-fg-muted">
          Prices are in US dollars. Taxes, where they apply, are shown at checkout. Payments are processed by Stripe. See the{" "}
          <Link className="underline underline-offset-2" href="/terms">
            terms
          </Link>{" "}
          and{" "}
          <Link className="underline underline-offset-2" href="/refund">
            refund policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
