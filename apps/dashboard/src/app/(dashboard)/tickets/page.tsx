import { PageHeader } from "@/components/layout/page-header";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { NewTicketForm, TicketStatusControl } from "@/components/support-tickets/ticket-forms";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readSupportTickets } from "@/features/support-tickets/support-tickets.server";
import { SUPPORT_TICKET_STATUSES, SUPPORT_TICKET_STATUS_LABEL, type SupportTicketStatus } from "@/features/support-tickets/contracts";
import { utcInstant } from "@/lib/format";

export const metadata = { title: "Support Tickets — Hebun AI" };
export const dynamic = "force-dynamic";

/*
 * Customer Ops / Tickets — V1-STAGE-5. Replaces the legacy mock (UI Phase 25C) with real, tenant-
 * scoped support tickets. Any member files and reads their own organization's tickets; status is
 * changed by the Governance authority only, and every change is audited. Tickets are filed by hand
 * here: no email, Instagram DM or other channel creates one, and nothing is sent to anyone. Customer
 * support is business-domain work, not Hebun Operations, and claims no Operations authority.
 */
const STATUS_VARIANT: Readonly<Record<SupportTicketStatus, BadgeVariant>> = {
  open: "info",
  in_progress: "primary",
  waiting_on_customer: "warning",
  resolved: "success",
  closed: "neutral",
};

export default async function TicketsPage() {
  const read = await readSupportTickets(await resolveTenantContext());
  const header = <PageHeader title="Support Tickets" context="Your organization's support requests, filed by hand inside Hebun." />;
  if (read.status !== "read") {
    return (
      <>
        {header}
        <p className="text-sm text-fg-muted">
          {read.status === "unauthenticated" ? "Sign in to see your organization's tickets." : "Tickets could not be read right now. Nothing was substituted."}
        </p>
      </>
    );
  }
  const counts = SUPPORT_TICKET_STATUSES.map((s) => [s, read.tickets.filter((t) => t.status === s).length] as const);
  return (
    <>
      {header}
      <section aria-labelledby="new-ticket-heading" className="mb-8 space-y-3">
        <h2 id="new-ticket-heading" className="text-sm font-semibold text-fg-primary">
          File a ticket
        </h2>
        <NewTicketForm />
      </section>

      <section aria-labelledby="tickets-heading" className="space-y-3">
        <h2 id="tickets-heading" className="text-sm font-semibold text-fg-primary">
          Tickets ({read.tickets.length}
          {read.truncated ? ", newest shown" : ""})
        </h2>
        <p className="text-xs text-fg-muted">
          {counts.map(([s, n]) => `${SUPPORT_TICKET_STATUS_LABEL[s]} ${n}`).join(" · ")}
          {read.viewerMayChangeStatus ? "" : " — status is changed by your organization's Governance authority."}
        </p>
        {read.tickets.length === 0 ? (
          <p className="text-sm text-fg-muted">No tickets have been filed in your organization.</p>
        ) : (
          <ul className="space-y-2">
            {read.tickets.map((t) => (
              <li key={t.id} className="rounded-lg border border-border-subtle p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-fg-primary">{t.title}</p>
                  <Badge variant={STATUS_VARIANT[t.status]}>{SUPPORT_TICKET_STATUS_LABEL[t.status]}</Badge>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg-secondary">{t.description}</p>
                <p className="mt-2 text-xs text-fg-muted">
                  Filed {utcInstant(t.createdAt)}
                  {t.filedByViewer ? " by you" : ""} · updated {utcInstant(t.updatedAt)}
                </p>
                {read.viewerMayChangeStatus ? (
                  <div className="mt-2">
                    <TicketStatusControl ticketId={t.id} status={t.status} version={t.version} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
