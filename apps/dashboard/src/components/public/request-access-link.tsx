import Link from "next/link";

/*
 * The one call to action on the public site.
 *
 * It goes to `/contact`, which explains that access is invitation-based and exposes the address.
 * It does NOT go to a form: no lead table, no CRM, no scheduler and no API exists behind it, and
 * a form that emails a mailbox is a pipeline nobody built pretending to be one somebody did.
 *
 * `tone="inverse"` is for the single dark section on the page.
 */
export function RequestAccessLink({
  tone = "primary",
  children = "Request access",
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
    <Link href="/contact" className={`${base} ${skin}`}>
      {children}
    </Link>
  );
}
