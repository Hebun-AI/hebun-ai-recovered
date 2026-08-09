import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { cn } from "@/lib/utils";
import { tickets, ticketStatuses, ticketCount } from "@/features/tickets/mock";
import type { SlaState, TicketStatus } from "@/types";

/*
 * Customer Ops / Tickets — legacy domain surface (UI Phase 25C). Customer support is business-
 * domain work; it is NOT Hebun Operations (runtime/execution observation). This page is not moved
 * into Operations and claims no Operations authority — it is a legacy domain / future Enterprise
 * Domain candidate, made honest with a mock ticket table. Disposition: 25D.
 */

const statusMeta: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
  open: { label: "Open", variant: "info" },
  assigned: { label: "Assigned", variant: "primary" },
  waiting: { label: "Waiting Customer", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "neutral" },
};

const slaMeta: Record<SlaState, { label: string; className: string }> = {
  "on-track": { label: "On track", className: "text-success" },
  warning: { label: "Warning", className: "text-warning" },
  breached: { label: "Breached", className: "text-error" },
};

export default function TicketsPage() {
  return (
    <>
      <PageHeader
        title="Ticket Center"
        context="Legacy Customer Ops domain surface — illustrative mock tickets, not authoritative Workforce truth."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Customer Ops" backing="mock" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Status summary */}
        {ticketStatuses.map((status) => (
          <div key={status} className="col-span-6 sm:col-span-4 xl:col-span-2">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {statusMeta[status].label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {ticketCount(status)}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Ticket table */}
        <div className="col-span-12">
          <Card>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Ticket</th>
                    <th className="px-6 py-3 font-medium">Customer</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="hidden px-6 py-3 font-medium md:table-cell">Assignee</th>
                    <th className="px-6 py-3 font-medium">SLA</th>
                    <th className="hidden px-6 py-3 text-right font-medium sm:table-cell">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3">
                        <span className="font-mono text-xs text-fg-muted">
                          {ticket.id}
                        </span>
                        <p className="font-medium text-fg">{ticket.subject}</p>
                      </td>
                      <td className="px-6 py-3 text-fg-secondary">{ticket.customer}</td>
                      <td className="px-6 py-3">
                        <Badge variant={statusMeta[ticket.status].variant}>
                          {statusMeta[ticket.status].label}
                        </Badge>
                      </td>
                      <td className="hidden px-6 py-3 text-fg-secondary md:table-cell">
                        {ticket.assignee}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            slaMeta[ticket.sla].className
                          )}
                        >
                          {slaMeta[ticket.sla].label}
                        </span>
                      </td>
                      <td className="hidden px-6 py-3 text-right text-xs text-fg-muted sm:table-cell">
                        {ticket.updated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
