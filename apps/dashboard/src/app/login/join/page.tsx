/*
 * Onboarding entry page — reachable by a human who has no account and cannot sign in.
 *
 * ── WHY IT LIVES UNDER `/login` ──────────────────────────────────────────────
 *
 * `middleware.ts` treats `/login` and everything beneath it as public, so this page needs NO change
 * to route protection: the edge gate lets it through exactly as it lets the sign-in form and the
 * workspace picker through, and the dashboard stays as protected as it was. `PUBLIC_PREFIXES` is
 * unchanged — putting an onboarding route anywhere else would have meant widening a global rule for
 * one page, which is the mistake the picker's own header warned about.
 *
 * ── IT IS NOT PUBLIC IN THE SENSE THAT MATTERS ───────────────────────────────
 *
 * Being past the edge gate grants nothing here. Nothing is read from the request except whether this
 * browser carries a continuation receipt, and that only chooses which step to offer. There is no
 * parameter for a tenant, an invitation, an enrollment, a role or an email — the page takes NO
 * `searchParams` at all, so nothing on it can be aimed at somebody else's onboarding, and no bearer
 * secret can arrive in a URL where a browser history or an access log would keep it.
 *
 * ── IT DISCLOSES NOTHING BEFORE A PROOF ──────────────────────────────────────
 *
 * The organization's name, the invited address and the intended role are never rendered — not before
 * the capability is presented, and not after. A page that named the tenant would turn a stolen
 * capability into a disclosure about that tenant.
 *
 * Server component: the receipt check happens on the server, and the client receives only wording.
 */
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OnboardingEntryCard } from "@/components/auth/onboarding-entry-card";
import { ONBOARDING_ENTRY_WORDING } from "@/components/auth/onboarding-entry-wording";
import { getAuthEnvironment } from "@/features/auth-runtime/request-session.server";
import { ENROLLMENT_CONTINUATION_COOKIE_NAME } from "@/features/identity-enrollment/continuation-cookie";

export const dynamic = "force-dynamic";

export const metadata = { title: "Join — Hebun AI" };

export default async function OnboardingEntryPage() {
  const env = getAuthEnvironment();
  /*
   * Fail closed, and fail the same way sign-in does. A misconfigured environment has no digest key,
   * so no capability could be recognised even if one were presented — offering the form would be a
   * claim that it works.
   */
  if (env.status !== "configured" || env.provider !== "local") redirect("/login");

  const store = await cookies();
  const hasReceipt = Boolean(store.get(ENROLLMENT_CONTINUATION_COOKIE_NAME)?.value);

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center gap-4 p-6">
      <OnboardingEntryCard hasReceipt={hasReceipt} wording={ONBOARDING_ENTRY_WORDING} />
      <p className="text-center text-xs text-fg-muted">
        <Link className="underline" href="/login">
          Already have an account? Sign in
        </Link>
      </p>
    </main>
  );
}
