import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DecisionOverview } from "@/components/decision-domain/decision-overview";
import { DecisionWorkspace } from "@/components/decision-domain/decision-workspace";
import { DecisionIntelligence, DecisionRelationships, HebyDecisionContext } from "@/components/decision-domain/decision-context";
import { decisionDomainConnections, decisionIntelligence, decisionOverview, decisions, hebyDecisionSuggestions } from "@/features/decision-domain/mock";

export default function ApprovalsPage() {
  return (
    <>
      <PageHeader
        title="Enterprise Decision Center"
        context="The Director’s primary decision surface — evidence, impact, risk, alternatives, relationships, and follow-up understood before intent is recorded."
        action={<><Badge variant="primary">Decision foundation</Badge><Badge variant="success">Mock projection</Badge></>}
      />
      <div className="space-y-6">
        <DecisionOverview items={decisionOverview} />
        <DecisionWorkspace items={decisions} />
        <DecisionIntelligence items={decisionIntelligence} />
        <DecisionRelationships items={decisionDomainConnections} />
        <HebyDecisionContext prompts={hebyDecisionSuggestions} />
        <p className="text-xs leading-5 text-fg-muted">The Decision Center prepares and records local simulated Director intent only. It does not make decisions, persist approvals, start workflows, or execute enterprise actions.</p>
      </div>
    </>
  );
}
