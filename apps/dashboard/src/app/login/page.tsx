import { redirect } from "next/navigation";
import {
  getAuthEnvironment,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";
import { loginAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  unavailable: "Sign-in is not available in this configuration.",
  invalid: "That identity was not recognized.",
  forbidden: "That identity is not permitted to enter a workspace.",
  unauthenticated: "That identity was not recognized.",
};

export default async function LoginPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const env = getAuthEnvironment();

  // Auth subsystem is off: preserve the pre-auth landing (honest — nothing is
  // being enforced, so nothing is claimed).
  if (env.status === "disabled") {
    redirect("/command");
  }

  if (env.status === "invalid") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
        <h1 className="text-xl font-semibold">Authentication misconfigured</h1>
        <p className="text-sm text-neutral-500">
          Authentication is enabled but its configuration is incomplete. Access is
          closed until it is corrected. No session can be established.
        </p>
      </main>
    );
  }

  if (env.provider !== "local") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
        <h1 className="text-xl font-semibold">Sign-in unavailable</h1>
        <p className="text-sm text-neutral-500">
          This build is configured for an external identity provider whose sign-in
          flow is not part of R1. Local pilot sign-in is disabled.
        </p>
      </main>
    );
  }

  // Already authorized -> go straight to the durable proof surface.
  const existing = await resolveRequestAuthentication(env);
  if (existing.status === "authorized") {
    redirect("/foundation");
  }

  const searchParams = (await props.searchParams) ?? {};
  const errorKey =
    typeof searchParams.error === "string" ? searchParams.error : undefined;
  const errorMessage = errorKey ? ERROR_MESSAGES[errorKey] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Sign in to Hebun</h1>
        <p className="text-sm text-neutral-500">
          Local pilot identity. Enter a seeded identity email to establish a
          durable, server-side session.
        </p>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      ) : null}
      <form action={loginAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Identity email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="you@tenant.test"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
