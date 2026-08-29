import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { hrTickets, employeeSupportStats } from "@/features/hr/mock";
import type { HrTicketStatus, SlaState } from "@/types";

const statusMeta: Record<HrTicketStatus, { label: string; variant: BadgeVariant }> = {
  open: { label: "Open", variant: "info" },
  "in-progress": { label: "In Progress", variant: "primary" },
  resolved: { label: "Resolved", variant: "success" },
};

const slaMeta: Record<SlaState, { label: string; className: string }> = {
  "on-track": { label: "On track", className: "text-success" },
  warning: { label: "Warning", className: "text-warning" },
  breached: { label: "Breached", className: "text-error" },
};

export default function EmployeeSupportPage() {
  const openCount = hrTickets.filter((t) => t.status !== "resolved").length;

  const stats = [
    { label: "Open Tickets", value: `${openCount}` },
    { label: "SLA Met", value: `${employeeSupportStats.slaMet}%` },
    { label: "Knowledge Usage", value: `${employeeSupportStats.knowledgeUsage}%` },
    { label: "CSAT", value: `${employeeSupportStats.csat} / 5` },
  ];

  return (
    <>
      <PageHeader
        title="Employee Support Center"
        context="Employee requests handled by the Employee Support Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="col-span-6 xl:col-span-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Employee Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="ui-table-wrap"><table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-surface-sunken text-left text-xs uppercase tracking-wider text-fg-secondary">
                    <th className="px-6 py-3 font-medium">Ticket</th>
                    <th className="px-6 py-3 font-medium">Employee</th>
                    <th className="px-6 py-3 font-medium">Topic</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">SLA</th>
                    <th className="hidden px-6 py-3 text-right font-medium sm:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {hrTickets.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b last:border-b-0 transition-colors duration-(--dur-fast) hover:bg-surface-raised"
                    >
                      <td className="px-6 py-3 font-mono text-xs text-fg">{t.id}</td>
                      <td className="px-6 py-3 text-fg-secondary">{t.employee}</td>
                      <td className="px-6 py-3 text-fg">{t.topic}</td>
                      <td className="px-6 py-3">
                        <Badge variant={statusMeta[t.status].variant}>
                          {statusMeta[t.status].label}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn("text-xs font-medium", slaMeta[t.sla].className)}>
                          {slaMeta[t.sla].label}
                        </span>
                      </td>
                      <td className="hidden px-6 py-3 text-right text-xs text-fg-muted sm:table-cell">
                        {t.updated}
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
