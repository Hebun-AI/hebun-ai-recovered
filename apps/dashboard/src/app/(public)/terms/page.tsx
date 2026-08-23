import type { Metadata } from "next";
import Link from "next/link";

/*
 * The public Terms of Service.
 *
 * SAME BOUNDARY AS `/privacy`, DELIBERATELY. It sits outside the `(dashboard)` group, so the
 * authoritative auth gate and the Hebun shell never wrap it, and `/terms` is listed in the edge
 * gate's `PUBLIC_PREFIXES` beside `/login` and `/privacy`. A concrete route file wins over
 * `(dashboard)/[...slug]`, which is what used to answer this path with `notFound()`.
 *
 * This is the SECOND page of ONE public legal surface, not a second legal architecture: no new
 * layout, no route group, no config registry, no shared content module invented for two short
 * documents. It reads no session, no tenant, and no database.
 *
 * WHAT IT MAY STATE IS BOUNDED BY THE REPOSITORY:
 *   - sign-in is single-factor, with no reset flow  (`src/app/login/page.tsx`)
 *   - workspace access can be suspended             (tenant lifecycle)
 *   - a provider connection carries only the scopes Google actually granted
 *     (`coversRequiredScopes`, `getCapabilityAvailability`)
 *   - Drive is metadata-only                        (`GOOGLE_DRIVE_METADATA_SCOPE`)
 * No uptime, support, billing, certification, ownership or jurisdiction claim appears, because
 * nothing in the repository establishes one.
 */

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply to use of Hebun AI.",
};

const LAST_UPDATED = "23 August 2026";
const CONTACT_EMAIL = "hebuntech@gmail.com";

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-title font-bold text-fg">{heading}</h2>
      {children}
    </section>
  );
}

/*
 * PUB-1 — THIS DOCUMENT ADOPTED THE PUBLIC SHELL. ITS LEGAL MEANING DID NOT CHANGE.
 *
 * The file moved into the `(public)` route group, so the public header and footer now surround it
 * and the URL is unchanged. Three structural things changed and nothing else:
 *
 *   1. The page no longer renders its own <main>. `(public)/layout.tsx` owns that landmark, and two
 *      <main> elements in one document is an accessibility defect, not a duplication.
 *   2. The in-page <header> became a plain heading group, so it can never be announced as a second
 *      banner alongside the site header.
 *   3. Colours moved from raw greyscale utilities to the product's own text tokens, so the legal
 *      pages read in the same ink as the rest of the public site.
 *
 * NOT ONE SENTENCE OF THE LEGAL TEXT WAS EDITED — no clause added, removed, softened or reordered,
 * and the last-updated date is untouched because nothing was updated.
 */
export default function TermsOfServicePage() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-6 py-16 text-body leading-relaxed text-fg-secondary sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-lg font-extrabold tracking-[-0.02em] text-fg">
          Hebun AI — Terms of Service
        </h1>
        <p className="text-label font-bold tracking-[0.12em] uppercase text-fg-muted">Last updated: {LAST_UPDATED}</p>
        <p>
          These terms apply to your use of Hebun AI (&ldquo;Hebun&rdquo;). By using Hebun you agree
          to them. If you do not agree, do not use the service.
        </p>
      </div>

      <Section heading="The service">
        <p>
          Hebun is a software service that gives an organization a workspace for viewing and
          operating its own information, and — where the organization chooses to connect one — for
          reading data from an external provider it has authorized.
        </p>
        <p>
          Hebun is under active development. Features may be added, changed or removed, and some
          parts of the product describe capabilities that are not yet available. What the product
          states about its own capabilities at the time you use it is what applies.
        </p>
      </Section>

      <Section heading="Accounts and access">
        <p>
          Access requires an account within a workspace. You are responsible for the credentials
          used to sign in and for activity carried out through your account. Sign-in is
          single-factor; there is no multi-factor or single sign-on option, and no self-service
          password reset. Contact Hebun if you lose access.
        </p>
        <p>
          A workspace&rsquo;s access to Hebun may be suspended, and access may be ended at any time.
          You may stop using Hebun at any time.
        </p>
      </Section>

      <Section heading="Connected external providers">
        <p>
          Connecting an external provider — such as a Google account — is your choice, and you make
          that authorization at the provider, not at Hebun.
        </p>
        <p>
          <span className="font-medium">
            A connection grants Hebun only the permissions you authorize, and nothing beyond them.
          </span>{" "}
          Hebun cannot exercise a capability the provider has not granted, and a grant that does not
          cover a capability results in a refusal rather than an attempt.
        </p>
        <p>
          For Google Drive, Hebun&rsquo;s integration is limited to read-only file{" "}
          <em>metadata</em> — file identifier, name, MIME type, last-modified time, size where Drive
          reports one, and whether the file is in the trash. Under this integration{" "}
          <span className="font-medium">
            Hebun does not read the contents of your Drive files, and cannot create, modify, share
            or delete anything in your Drive.
          </span>
        </p>
        <p>
          Your use of any connected provider remains governed by that provider&rsquo;s own terms and
          policies, and by the permissions you grant there. You can withdraw Hebun&rsquo;s access at
          the provider at any time. Hebun is not responsible for a provider&rsquo;s availability,
          behaviour or decisions.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc pl-5">
          <li>use Hebun in violation of applicable law, or of a connected provider&rsquo;s terms;</li>
          <li>
            attempt to bypass authentication, access controls, workspace separation, or any other
            security boundary of the service;
          </li>
          <li>
            use Hebun to access data you are not authorized to access, or to interfere with the
            service or with other users;
          </li>
          <li>share your credentials, or grant a provider connection you are not permitted to grant.</li>
        </ul>
      </Section>

      <Section heading="Your content and information">
        <p>
          You are responsible for the information you provide to Hebun or make reachable through a
          connected provider, and for having the right to do so. How Hebun handles that information
          is described in the{" "}
          <Link className="underline underline-offset-2" href="/privacy">
            Privacy Policy
          </Link>
          , which forms part of these terms.
        </p>
      </Section>

      <Section heading="No warranty">
        <p>
          Hebun is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis, without
          warranties of any kind, whether express or implied, to the fullest extent permitted by
          law. Hebun does not warrant that the service will be uninterrupted, error-free, or that
          any particular result will be produced. Nothing in the product should be treated as legal,
          financial, tax or professional advice.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the fullest extent permitted by law, Hebun is not liable for indirect, incidental,
          special or consequential damages, or for loss of data, revenue or profit, arising from
          your use of or inability to use the service.
        </p>
      </Section>

      <Section heading="Changes to these terms">
        <p>
          These terms may change. The updated version will be published at this address with a new
          last-updated date, and continuing to use Hebun after that means you accept it.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms can be sent to{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}
