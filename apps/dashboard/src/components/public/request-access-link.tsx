import Link from "next/link";

/*
 * The one call to action on the public site.
 *
 * ACTIVATION-1: it goes to `/register`, where an organization creates its own account (self-service).
 * It does NOT go to a form: no lead table, no CRM, no scheduler and no API exists behind it, and
 * a form that emails a mailbox is a pipeline nobody built pretending to be one somebody did.
 *
 * `tone="inverse"` is for the single dark section on the page.
 */
export function RequestAccessLink({
  tone = "primary",
  children = "Create account",
}: {
  readonly tone?: "primary" | "inverse";
  readonly children?: React.ReactNode;
}) {
  const base =
    "inline-flex h-13 min-h-[3.25rem] items-center rounded-md px-7 text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";
  const skin =
    tone === "inverse"
      ? "bg-surface text-fg hover:bg-surface/90 focus-visible:outline-surface"
      : "bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-primary";
  return (
    <Link href="/register" className={`${base} ${skin}`}>
      {children}
    </Link>
  );
}
