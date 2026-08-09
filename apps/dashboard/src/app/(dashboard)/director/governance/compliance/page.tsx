import { PageHeader } from "@/components/layout/page-header";
import { ComplianceRiskSurface } from "@/components/governance-compliance-risk/compliance-risk-surface";

export const metadata = { title: "Compliance & Risk — Hebun AI" };

/*
 * Compliance & Risk (Governance L2 · Hebun UI Phase 23C rebuild; folds the standalone Risk concept).
 *
 * Surfaces the real compliance/risk evaluation structure with an explicit DERIVED · SEEDED INPUT
 * state. It no longer presents the fabricated governance mock (compliance %, scores, violation
 * counts, fake timestamps) as truth. Compliance evaluation is not certification; risk evaluation
 * is not an incident. Read-only: no approve/reject/enforce/resolve control.
 */

export default function GovernanceCompliancePage() {
  return (
    <>
      <PageHeader
        title="Compliance & Risk"
        context="What compliance and risk the engine evaluates, and its provenance — derived from seeded input, not live certification or confirmed risk."
      />
      <ComplianceRiskSurface />
    </>
  );
}
