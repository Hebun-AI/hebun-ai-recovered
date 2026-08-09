import { PageHeader } from "@/components/layout/page-header";
import { PoliciesRulesSurface } from "@/components/governance-policies/policies-rules-surface";

export const metadata = { title: "Policies & Rules — Hebun AI" };

/*
 * Policies & Rules (Governance L2 · Hebun UI Phase 23B rebuild).
 *
 * Surfaces the REAL policy engine — the deterministic evaluation pipeline and policy/rule
 * definitions — with an explicit DERIVED · SEEDED INPUT provenance. It no longer presents the
 * fabricated governance mock (active/version counts, StatCards) as truth, and shows no
 * fabricated compliance/risk/audit score. Read-only: no create/edit/enable/approve/enforce
 * control. Policy evaluation is not authorization, execution, or human approval.
 */

export default function GovernancePoliciesPage() {
  return (
    <>
      <PageHeader
        title="Policies & Rules"
        context="What policy and rule evaluation machinery exists, and its provenance — derived from seeded input, not live organizational policy."
      />
      <PoliciesRulesSurface />
    </>
  );
}
