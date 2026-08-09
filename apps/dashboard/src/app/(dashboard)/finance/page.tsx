import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CommandAction } from "@/components/command/command-action";
import { EventTimeline } from "@/components/dashboard/event-timeline";
import { LegacyDomainNotice, LegacyAgentDefinitionCard } from "@/components/workforce-workspace/legacy-domain";
import { WorkflowCard } from "@/features/workflows/workflow-card";
import { agents } from "@/features/agents/mock";
import { financeWorkflows } from "@/features/workflows/mock";
import { financeEvents } from "@/features/finance/events";
import { financeOverview as f } from "@/features/finance/mock";
import { usdCompact } from "@/lib/format";

/*
 * Finance — legacy domain surface (UI Phase 25C). Finance is NOT an authoritative Workforce
 * domain; it is a legacy domain application / future Enterprise Domain candidate. This page is not
 * redesigned — it is made honest: a legacy notice, illustrative mock KPIs, seeded definition cards
 * (no pulsing activity), and NO approval queue. Human decisions belong to Decisions (/approvals);
 * the legacy Approve/Reject ApprovalRow was removed here (Phase 25A found it duplicated Decisions).
 * Route disposition is Phase 25D.
 */

const kpis = [
  { label: "Monthly Revenue", value: usdCompact(f.monthlyRevenue) },
  { label: "Net Profit", value: usdCompact(f.netProfit) },
  { label: "Cash Balance", value: usdCompact(f.cashBalance) },
  { label: "Tax Compliance", value: `${f.taxComplianceScore}%` },
];

export default function FinancePage() {
  const financeAgents = agents.filter((a) => a.department === "Finance");

  return (
    <>
      <PageHeader
        title="Finance Center"
        context="Legacy Finance domain surface — illustrative mock data, not authoritative Workforce truth."
        action={
          <CommandAction
            label="Create Invoice"
            commandType="invoice.create"
            variant="outline"
            summary="Draft a new invoice — customer, line items, and due date. Offline simulation."
          />
        }
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Finance" backing="mock" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* KPI row — illustrative mock figures (see notice), not live enterprise data. */}
        {kpis.map((kpi) => (
          <div key={kpi.label} className="col-span-6 xl:col-span-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {kpi.label} <span className="normal-case text-fg-muted">· mock</span>
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Agents — seeded definitions, honest (no pulsing activity). */}
        <div className="col-span-12">
          <h3 className="mb-3 text-sm font-semibold text-fg-secondary">
            Finance Department Agents — seeded definitions
          </h3>
          <div className="grid grid-cols-12 gap-6">
            {financeAgents.map((agent) => (
              <div key={agent.id} className="col-span-12 sm:col-span-6 xl:col-span-3">
                <LegacyAgentDefinitionCard agent={agent} />
              </div>
            ))}
          </div>
        </div>

        {/* Events (illustrative) */}
        <div className="col-span-12">
          <EventTimeline events={financeEvents} title="Recent Finance Events" />
        </div>

        {/* Workflows */}
        <div className="col-span-12">
          <h3 className="mb-3 text-sm font-semibold text-fg-secondary">
            Finance Workflows
          </h3>
          <div className="grid grid-cols-12 gap-6">
            {financeWorkflows.slice(0, 6).map((wf) => (
              <div key={wf.id} className="col-span-12 sm:col-span-6 xl:col-span-4">
                <WorkflowCard workflow={wf} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
