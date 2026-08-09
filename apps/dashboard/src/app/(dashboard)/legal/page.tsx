import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CommandAction } from "@/components/command/command-action";
import { EventTimeline } from "@/components/dashboard/event-timeline";
import { LegacyDomainNotice, LegacyAgentDefinitionCard } from "@/components/workforce-workspace/legacy-domain";
import { agents } from "@/features/agents/mock";
import { legalEvents } from "@/features/legal/events";
import { legalOverview as l } from "@/features/legal/mock";

/*
 * Legal — legacy domain surface (UI Phase 25C). Not an authoritative Workforce domain, and NOT a
 * governance authority: policies, rules, compliance/risk governance, and audit/explainability are
 * owned by Governance. The legal compliance/risk figures here are illustrative mock domain content,
 * never authoritative governance truth. Made honest, not redesigned. Disposition: 25D.
 */

const kpis = [
  { label: "Open Legal Reviews", value: `${l.openReviews}` },
  { label: "High Risk Contracts", value: `${l.highRiskContracts}` },
  { label: "Compliance Score", value: `${l.complianceScore}%` },
  { label: "Approval Queue", value: `${l.approvalQueue}` },
];

export default function LegalPage() {
  const legalAgents = agents.filter((a) => a.department === "Legal");

  return (
    <>
      <PageHeader
        title="Legal Center"
        context="Legacy Legal domain surface — illustrative mock data; governance authority belongs to Governance."
        action={
          <CommandAction
            label="New Contract"
            commandType="contract.create"
            variant="outline"
            summary="Start a new contract — parties, terms, and review workflow. Offline simulation."
          />
        }
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="Legal" backing="mock" />
      </div>

      <div className="grid grid-cols-12 gap-6">
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

        <div className="col-span-12">
          <h3 className="mb-3 text-sm font-semibold text-fg-secondary">
            Legal Department Agents — seeded definitions
          </h3>
          <div className="grid grid-cols-12 gap-6">
            {legalAgents.map((agent) => (
              <div key={agent.id} className="col-span-12 sm:col-span-6 xl:col-span-4">
                <LegacyAgentDefinitionCard agent={agent} />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12">
          <EventTimeline events={legalEvents} title="Recent Legal Events" />
        </div>
      </div>
    </>
  );
}
