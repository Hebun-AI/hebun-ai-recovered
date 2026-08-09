import { PageHeader } from "@/components/layout/page-header";
import { GovernanceOverview } from "@/components/governance-overview/governance-overview";

export const metadata = { title: "Governance — Hebun AI" };

/*
 * Governance Overview (Hebun UI Phase 23B rebuild).
 *
 * The governance truth surface: what governance capabilities and boundaries actually exist —
 * an honest availability map with authority owner and mutation boundary per area. It no longer
 * imports the governance mock and presents no fabricated compliance %, governance/audit health,
 * risk %, explainability score, or policy/violation/approval count. Read-only.
 */

export default function GovernancePage() {
  return (
    <>
      <PageHeader
        title="Governance"
        context="What governance capabilities and boundaries actually exist right now — honest availability, not fabricated scores."
      />
      <GovernanceOverview />
    </>
  );
}
