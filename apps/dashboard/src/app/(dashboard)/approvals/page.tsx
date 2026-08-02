import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DecisionOverview } from "@/components/decision-domain/decision-overview";
import { DecisionWorkspace } from "@/components/decision-domain/decision-workspace";
import { DecisionIntelligence, DecisionRelationships, HebyDecisionContext } from "@/components/decision-domain/decision-context";
import { getDecisionProjection } from "@/features/enterprise-projection-providers";

export default function ApprovalsPage() {
  const decision = getDecisionProjection();

  return (
    <>
      <PageHeader
        title="Enterprise Decision Center"
        context="The Director’s primary decision surface — evidence, impact, risk, alternatives, relationships, and follow-up understood before intent is recorded."
        action={<><Badge variant="primary">Decision foundation</Badge><Badge variant="success">Mock projection</Badge></>}
      />
      <div className="space-y-6">
        <DecisionOverview items={decision.overview} />
        <DecisionWorkspace items={decision.decisions} />
        <DecisionIntelligence items={decision.attentionSignals} />
        <DecisionRelationships items={decision.relationships} />
        <HebyDecisionContext prompts={decision.suggestions} />
        <p className="text-xs leading-5 text-fg-muted">The Decision Center prepares and records local simulated Director intent only. It does not make decisions, persist approvals, start workflows, or execute enterprise actions.</p>
      </div>
    </>
  );
}
