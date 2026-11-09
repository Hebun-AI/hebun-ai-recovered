import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { FAILURE_WINDOW_DAYS, readNotifications, type NotificationKind } from "@/features/notifications/notifications.server";
import { utcInstant } from "@/lib/format";

export const metadata = { title: "Notifications — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * V1-STAGE-3 — the in-app notification center. Read-time projection only (see the feature module):
 * nothing is stored or sent, and every item links to the page that already holds the detail.
 */
const COPY: Readonly<Record<NotificationKind, { title: (n: number) => string; detail: string; when: string }>> = {
  "approvals-pending": {
    title: (n) => `${n} request${n === 1 ? "" : "s"} waiting for your decision`,
    detail: "Proposed actions stay pending until a Governance decision approves or refuses them.",
    when: "Oldest filed",
  },
  "publication-failed": {
    title: (n) => `${n} publication attempt${n === 1 ? "" : "s"} did not go out`,
    detail: `Instagram or YouTube publication attempts that failed or were refused in the last ${FAILURE_WINDOW_DAYS} days.`,
    when: "Latest",
  },
  "publication-outcome-unknown": {
    title: (n) => `${n} publication attempt${n === 1 ? "" : "s"} with an unknown outcome`,
    detail: "The provider may or may not have published these. Check before trying again.",
    when: "Latest",
  },
  "execution-failed": {
    title: (n) => `${n} action${n === 1 ? "" : "s"} failed`,
    detail: `Approved actions whose execution failed or was refused in the last ${FAILURE_WINDOW_DAYS} days.`,
    when: "Latest",
  },
  "execution-outcome-unknown": {
    title: (n) => `${n} action${n === 1 ? "" : "s"} with an unknown outcome`,
    detail: "The provider may hold these. Check before trying again.",
    when: "Latest",
  },
};

export default async function NotificationsPage() {
  const read = await readNotifications(await resolveTenantContext());
  const header = <PageHeader title="Notifications" context="What needs your attention in your organization right now." />;
  if (read.status !== "read") {
    const text =
      read.status === "unauthenticated"
        ? "Sign in to see your notifications."
        : read.status === "not-addressed"
          ? "Approval and execution notifications go to your organization's Governance authority."
          : "Notifications could not be read right now. Nothing was substituted.";
    return (
      <>
        {header}
        <p className="text-sm text-fg-muted">{text}</p>
      </>
    );
  }
  return (
    <>
      {header}
      <p className="mb-4 text-xs text-fg-muted">Read {utcInstant(read.readAt)}. Refresh for the current state.</p>
      {read.items.length === 0 ? (
        <p className="text-sm text-fg-muted">Nothing needs your attention.</p>
      ) : (
        <ul className="max-w-3xl space-y-2">
          {read.items.map((item) => {
            const copy = COPY[item.kind];
            return (
              <li key={item.kind} className="rounded-lg border border-border-subtle p-3">
                <p className="text-sm font-medium text-fg-primary">{copy.title(item.count)}</p>
                <p className="mt-1 text-xs text-fg-secondary">{copy.detail}</p>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-xs text-fg-muted">
                  {item.at ? (
                    <span>
                      {copy.when}: {utcInstant(item.at)}
                    </span>
                  ) : null}
                  <Link href={item.href} className="underline underline-offset-2 text-fg-secondary">
                    Open Approvals
                  </Link>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
