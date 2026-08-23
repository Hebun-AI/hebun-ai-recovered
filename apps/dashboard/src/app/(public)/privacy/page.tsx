import type { Metadata } from "next";
import Link from "next/link";

/*
 * The public Privacy Policy.
 *
 * IT LIVES OUTSIDE THE `(dashboard)` GROUP ON PURPOSE. That group's layout is the authoritative
 * auth gate and renders the Hebun shell; a legal notice that a signed-out reader — or Google's
 * OAuth reviewer — must be able to open cannot sit behind it. `/login` is the existing precedent
 * for a public route, and this page follows it: no shell, no session, no tenant, no database.
 *
 * `/privacy` used to 404 because it fell through to `(dashboard)/[...slug]`, whose
 * `resolveModulePath` did not know the path and called `notFound()`. A concrete route file always
 * wins over that catch-all, so this file is the whole fix.
 *
 * EVERY CLAIM BELOW IS BOUNDED BY WHAT THE REPOSITORY CAN PROVE:
 *   - scopes            `GOOGLE_REQUESTED_SCOPES` + `GOOGLE_DRIVE_METADATA_SCOPE`
 *   - Drive fields      `GoogleDriveFileView`
 *   - stored credential `integration-credentials` (sealed) + the callback's account id/label
 *   - encryption        `SECRET_ALGORITHM_AES_256_GCM`
 * There is no in-product disconnect control and no scheduled deletion job, so neither is promised.
 */

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Hebun AI handles information, including Google account data.",
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
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-8 px-6 py-16 text-body leading-relaxed text-fg-secondary sm:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-lg font-extrabold tracking-[-0.02em] text-fg">
          Hebun AI — Privacy Policy
        </h1>
        <p className="text-label font-bold tracking-[0.12em] uppercase text-fg-muted">Last updated: {LAST_UPDATED}</p>
        <p>
          This policy describes how Hebun AI (&ldquo;Hebun&rdquo;) handles information when a
          workspace connects a Google account to it. It describes only what the product
          currently does.
        </p>
      </div>

      <Section heading="Information Hebun may access">
        <p>Hebun may access and hold:</p>
        <ul className="list-disc pl-5">
          <li>
            <span className="font-medium">Google account identity.</span> Your Google account
            identifier, your email address, whether Google reports that address as verified, and —
            for Google Workspace accounts — the domain Google reports for the account.
          </li>
          <li>
            <span className="font-medium">Authorization credentials.</span> The OAuth access and
            refresh tokens Google issues when you grant access, together with the list of scopes
            Google states it granted.
          </li>
          <li>
            <span className="font-medium">Google Drive file metadata,</span> only if you grant the
            Drive scope described below.
          </li>
          <li>
            <span className="font-medium">Account and sign-in information</span> you provide
            directly to Hebun, such as the email address and password credential used to sign in.
          </li>
        </ul>
      </Section>

      <Section heading="How Hebun uses information">
        <p>
          Information is used to authenticate you, to identify which Google account a workspace has
          connected, to keep that connection working, and to perform the specific read you ask for.
          Hebun does not use this information for advertising, and does not sell it.
        </p>
      </Section>

      <Section heading="Google API data">
        <p>
          Hebun requests the Google scopes <code>openid</code>, <code>email</code> and{" "}
          <code>profile</code> in order to identify the connected account.
        </p>
        <p>
          For Google Drive, Hebun requests one scope only:{" "}
          <code>https://www.googleapis.com/auth/drive.metadata.readonly</code>. This is a read-only
          metadata scope. Under it Hebun can list file metadata — file identifier, file name, MIME
          type, last-modified time, size where Drive reports one, and whether the file is in the
          trash.
        </p>
        <p>
          <span className="font-medium">Hebun does not read the contents of your Drive files.</span>{" "}
          Google&rsquo;s own scope definition does not permit file content download under this
          scope. Hebun also requests no scope that would let it create, modify, share or delete
          anything in your Drive, and it holds no such capability.
        </p>
        <p>
          Hebun&rsquo;s use of information received from Google APIs adheres to the{" "}
          <a
            className="underline underline-offset-2"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            rel="noreferrer noopener"
            target="_blank"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Data obtained from Google APIs is not used to
          train generalized artificial intelligence or machine learning models, is not sold, and is
          not transferred to others except as described below.
        </p>
      </Section>

      <Section heading="Data sharing">
        <p>
          Hebun does not sell personal information and does not share it with third parties for
          advertising or marketing.
        </p>
        <p>
          Information is transmitted to Google when Hebun makes an authorized request on your
          behalf, and it is processed by the hosting and database infrastructure Hebun runs on for
          the sole purpose of operating the service. Hebun may disclose information where it is
          legally required to do so.
        </p>
      </Section>

      <Section heading="Data security">
        <p>
          Traffic between your browser and Hebun, and between Hebun and Google, is carried over
          HTTPS. Stored provider credentials are encrypted at rest using AES-256-GCM authenticated
          encryption, and each sealed credential is cryptographically bound to the workspace and
          credential record it belongs to, so a credential moved to another record cannot be
          decrypted. Passwords are verified on the server and are not stored in a recoverable form.
        </p>
        <p>
          No system can be guaranteed secure. This section describes the controls Hebun implements;
          it is not a warranty, and Hebun does not claim any security certification.
        </p>
      </Section>

      <Section heading="Data retention and deletion">
        <p>
          Hebun retains your Google account identifier, email address, granted scopes and encrypted
          tokens for as long as the connection exists, so that the connection can continue to be
          used. Tokens are replaced when Google issues new ones.
        </p>
        <p>
          Hebun does not currently operate an automated retention schedule that deletes this
          information after a fixed period. To have your connection data deleted, contact Hebun at
          the address below and it will be removed from Hebun&rsquo;s records.
        </p>
      </Section>

      <Section heading="Your choices and revocation">
        <p>
          You can withdraw Hebun&rsquo;s access to your Google account at any time from your Google
          Account permissions page at{" "}
          <a
            className="underline underline-offset-2"
            href="https://myaccount.google.com/permissions"
            rel="noreferrer noopener"
            target="_blank"
          >
            myaccount.google.com/permissions
          </a>
          . Revoking there takes effect at Google and Hebun can no longer make requests with the
          revoked grant.
        </p>
        <p>
          Granting the Drive metadata scope is optional and separate from signing in. You may also
          ask Hebun to delete your data by contacting the address below.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy, or requests concerning your data, can be sent to{" "}
          <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section heading="Changes to this policy">
        <p>
          If this policy changes, the updated version will be published at this address with a new
          last-updated date. The{" "}
          <Link className="underline underline-offset-2" href="/terms">
            Terms of Service
          </Link>{" "}
          apply alongside this policy.
        </p>
      </Section>
    </div>
  );
}
