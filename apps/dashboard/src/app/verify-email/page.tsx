import type { Metadata } from "next";

import { VerifyEmailConfirm } from "@/components/auth/verify-email-confirm";

/*
 * /verify-email — where an emailed confirmation link lands.
 *
 * PUBLIC BY EXACT PATH, ON PURPOSE. If this route required a session, the middleware would redirect
 * a signed-out visitor to /login, and whatever the browser still held would travel with that
 * redirect. The page itself holds nothing secret and does nothing on load; the server action it
 * calls requires an authorized session of the identity the link was mailed for.
 *
 * `no-referrer` keeps even this page's own URL out of any outbound Referer, and the page is never
 * indexed. The token is never in the URL the server sees — it travels in the fragment.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your email — Hebun AI",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Confirm your email address</h1>
      <VerifyEmailConfirm />
    </main>
  );
}
