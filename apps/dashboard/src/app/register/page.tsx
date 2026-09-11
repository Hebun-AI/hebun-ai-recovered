import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getAuthEnvironment,
  resolveTenantContext,
} from "@/features/auth-runtime/request-session.server";
import {
  SIGNUP_REFUSAL_SENTENCES,
  type SignupRefusal,
} from "@/features/self-service-signup/contracts";
import { registerAction } from "./actions";

/*
 * Create an account, and the organization it will own.
 *
 * ── ONE STEP, NOT A WIZARD ───────────────────────────────────────────────────
 *
 * Identity and organization are asked together because they are provisioned together: a single
 * transaction creates the human, their credential, the tenant, its owner role and their membership,
 * and splitting the form across two pages would mean holding a half-finished signup somewhere
 * between them — a resumable-onboarding state this build has no authority for and no table to keep.
 * Four fields is the whole of it.
 *
 * ── WHAT IT DELIBERATELY DOES NOT ASK ────────────────────────────────────────
 *
 * No Instagram, YouTube or Google. No provider credentials, no analytics, no business goals, no
 * team size, no billing. Provider connections are an explicit, separately-authorized act that
 * happens later through Integrations, and asking here would imply this form can grant something it
 * cannot.
 *
 * Server component. The form posts to a server action; there is no client state and no fetch.
 */

const ERROR_MESSAGES: Record<string, string> = {
  ...SIGNUP_REFUSAL_SENTENCES,
  unavailable: "Account creation is not available in this configuration.",
};

export const dynamic = "force-dynamic";

export const metadata = { title: "Create account — Hebun AI" };

export default async function RegisterPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = getAuthEnvironment();

  /*
   * The same two environment gates the sign-in page applies, for the same reasons. A disabled auth
   * subsystem enforces nothing, so there is no account to create; a misconfigured one must not write
   * a credential.
   */
  if (env.status === "disabled") redirect("/command");
  if (env.status !== "configured" || env.provider !== "local") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
        <h1 className="text-xl font-semibold">Account creation unavailable</h1>
        <p className="text-sm text-neutral-500">
          Authentication is not configured for local accounts, so no account can be created here. No
          account was created and nothing failed.
        </p>
      </main>
    );
  }

  /*
   * ALREADY SIGNED IN? Then this page is behind them. Rendering a signup form to a human who holds a
   * tenant-bound session would invite them to create a second organization by accident.
   */
  const tenant = await resolveTenantContext();
  if (tenant) redirect("/foundation");

  const searchParams = (await props.searchParams) ?? {};
  const rawError = searchParams.error;
  const errorKey = Array.isArray(rawError) ? rawError[0] : rawError;
  const message = errorKey ? ERROR_MESSAGES[errorKey as SignupRefusal] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Create your Hebun account</h1>
        <p className="text-sm text-neutral-500">
          This creates your account and your organization. You can connect Instagram, YouTube or
          Google later, from Integrations.
        </p>
      </div>

      {message ? (
        <p
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {message}
        </p>
      ) : null}

      <form action={registerAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm" htmlFor="fullName">
          <span className="font-medium">Your name</span>
          <input
            id="fullName"
            type="text"
            name="fullName"
            required
            autoComplete="name"
            maxLength={120}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="email">
          <span className="font-medium">Work email</span>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="username"
            maxLength={320}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="password">
          <span className="font-medium">Password</span>
          <input
            id="password"
            type="password"
            name="password"
            required
            /*
             * The SAME minimum the credential authority's other caller requires. It is stated to the
             * human here and enforced on the server; this attribute is a courtesy, never the check.
             */
            minLength={12}
            autoComplete="new-password"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-neutral-500">At least 12 characters.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="organizationName">
          <span className="font-medium">Organization name</span>
          <input
            id="organizationName"
            type="text"
            name="organizationName"
            required
            autoComplete="organization"
            maxLength={200}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Create account
        </button>
      </form>

      <p className="text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-neutral-900 underline underline-offset-4">
          Sign in
        </Link>
      </p>

      <p className="text-xs text-neutral-500">
        Password recovery is not available yet — there is no reset flow in this build. Email
        addresses are not verified, and single sign-on is not implemented.
      </p>
    </main>
  );
}
