import { PageHeader } from "@/components/layout/page-header";
import { AuditExplainabilitySurface } from "@/components/governance-audit-explainability/audit-explainability-surface";

export const metadata = { title: "Audit & Explainability — Hebun AI" };

/*
 * Audit & Explainability (Governance L2 · Hebun UI Phase 23C rebuild; folds Explainability).
 *
 * Surfaces the structure of the real engine's audit trace and governance explanation with an
 * honest state. It no longer presents fabricated audit events, counts, or timestamps; durable
 * audit records are honestly empty. Explainability is inspectable provenance, not model
 * chain-of-thought. It does not duplicate Security Center. Read-only.
 */

export default function GovernanceAuditPage() {
  return (
    <>
      <PageHeader
        title="Audit & Explainability"
        context="What audit trace and explanation the engine produces, and why it is not a durable authoritative record — derived from seeded input."
      />
      <AuditExplainabilitySurface />
    </>
  );
}
