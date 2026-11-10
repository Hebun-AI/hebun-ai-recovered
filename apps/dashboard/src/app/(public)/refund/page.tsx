import type { Metadata } from "next";
import Link from "next/link";

/*
 * /refund — COMMERCIAL-ACTIVATION-1. The public refund and cancellation policy.
 *
 * DRAFT — Director approval required before it is published (it ships only with the merge, which is
 * a Director gate). It states what the code does — cancellation through the Stripe Customer Portal,
 * Pro until the end of the paid period, no data deleted — and one refund commitment the Director
 * must accept. It names the CURRENT legal operator; a planned rename is not claimed.
 */

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How cancellation and refunds work for Hebun AI subscriptions.",
};

const LAST_UPDATED = "10 November 2026";
const CONTACT_EMAIL = "hebuntech@gmail.com";

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-bold text-fg">{heading}</h2>
      {children}
    </section>
  );
}

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-6 py-16 text-body leading-relaxed text-fg-secondary sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-lg font-extrabold tracking-[-0.02em] text-fg">Hebun AI — Refund Policy</h1>
        <p className="text-label font-bold tracking-[0.12em] uppercase text-fg-muted">Last updated: {LAST_UPDATED}</p>
        <p>
          This policy applies to Pro subscriptions to Hebun AI, a service operated by Turkish Rug House LLC. Payments are
          processed by Stripe.
        </p>
      </div>

      <Section heading="Cancelling">
        <p>
          Your organization&apos;s Owner can cancel Pro at any time from Plan &amp; Usage, through Stripe&apos;s customer
          portal. Cancelling stops the next renewal. Pro stays active until the end of the period you have already paid for;
          after that your organization returns to the plan it had before subscribing. Cancelling deletes no data.
        </p>
      </Section>

      <Section heading="Refunds">
        <p>
          Subscription fees are charged monthly in advance and are not refunded for partially used periods, except where the
          law requires otherwise.
        </p>
        <p>
          If you were charged in error, or charged after you cancelled, write to us within 14 days of the charge and we will
          refund it to the original payment method through Stripe.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Refund requests and questions:{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . See also the{" "}
          <Link className="underline underline-offset-2" href="/terms">
            terms of service
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}
