import { notFound, redirect } from "next/navigation";
import { ThemeScope } from "@/components/theme/theme-scope";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveAdminAccessForRequest } from "@/features/operator-authority/admin-request.server";
import { verifyAdminMfaAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify — Platform Admin — Hebun AI" };

/* Fixed messages keyed by a closed set; the query value itself is never rendered. */
const ERRORS: Record<string, string> = {
  invalid: "That code was not accepted. Enter the current code from your authenticator app.",
  locked: "Too many attempts. Try again in 15 minutes.",
};

export default async function AdminVerifyPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await resolveAdminAccessForRequest();
  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") notFound();
  if (access.status === "granted") redirect("/admin");

  const params = (await props.searchParams) ?? {};
  const errorKey = typeof params.error === "string" ? params.error : "";
  const message = ERRORS[errorKey];

  return (
    <ThemeScope experience="admin">
      <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-fg">
        <form
          action={verifyAdminMfaAction}
          className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <h1 className="text-title font-semibold">Verify it&apos;s you</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            Platform Admin requires a code from your authenticator app.
          </p>
          <label htmlFor="admin-mfa-code" className="mt-5 block text-sm font-medium">
            6-digit code
          </label>
          <Input
            id="admin-mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "admin-mfa-error" : undefined}
            className="mt-1.5 tracking-[0.3em]"
          />
          {message ? (
            <p id="admin-mfa-error" role="alert" className="mt-2 text-sm text-error">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="mt-5 w-full">
            Verify
          </Button>
        </form>
      </main>
    </ThemeScope>
  );
}
