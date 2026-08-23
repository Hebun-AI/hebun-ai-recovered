import type { Metadata } from "next";
import Link from "next/link";
import { PublicProse, PublicSection } from "@/components/public/public-section";

/*
 * `/contact` — where "Request access" leads.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────────
 *
 * No form, no field, no submit button, no lead table, no CRM, no scheduler, no API route and no
 * server action. None of those exists behind this page, and a form whose only implementation is an
 * email would be a pipeline nobody built wearing the costume of one somebody did. It would also
 * start collecting personal data into a store that has no retention rule, no owner and no entry in
 * the privacy notice.
 *
 * What exists is an address. So the page publishes the address, says plainly how access actually
 * works, and says what a message should carry so the first exchange is useful.
 *
 * Static. No session, no tenant, no database.
 */
export const metadata: Metadata = {
  title: "Request access",
  description:
    "Access to Hebun AI is by invitation. How to reach us, and what a first message should carry.",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: "/contact",
    siteName: "Hebun AI",
    title: "Request access — Hebun AI",
    description: "Access to Hebun AI is by invitation.",
  },
};

const CONTACT_EMAIL = "hebuntech@gmail.com";

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-border">
        <div className="public-inset mx-auto grid w-full max-w-[var(--container-max)] grid-cols-1 gap-y-10 py-20 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-16 lg:py-24">
          <p className="text-label font-bold tracking-[0.12em] uppercase text-fg-muted lg:pt-3">
            Access
          </p>
          <div className="flex flex-col gap-7">
            <h1 className="max-w-[18ch] text-display-lg font-extrabold tracking-[var(--tracking-hero)] text-balance text-fg">
              Access is by invitation.
            </h1>
            <p className="max-w-[var(--measure-prose)] text-body leading-relaxed text-pretty text-fg">
              There is no self-serve sign-up. An organization is set up deliberately, and the people
              inside it join by invitation from that organization. To start that conversation, write
              to us.
            </p>
            <div>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex h-13 min-h-[3.25rem] items-center rounded-md bg-primary px-7 text-body font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicSection index="01" title="What to include">
        <PublicProse>
          A first message is more useful when it says who the organization is, what it needs to keep
          a record of, and who inside it would hold the authority to decide. None of that is a form
          field and none of it is required — it simply shortens the first exchange.
        </PublicProse>
        <PublicProse>
          We do not run a mailing list, and nothing written to this address is added to one.
        </PublicProse>
      </PublicSection>

      <PublicSection index="02" title="Already have an account" tone="sunken">
        <PublicProse>
          If your organization already uses Hebun, sign in instead — this page is only for
          organizations that do not have a workspace yet.
        </PublicProse>
        <div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-md border border-border-strong px-5 text-meta font-semibold text-fg hover:border-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign in
          </Link>
        </div>
      </PublicSection>
    </>
  );
}
