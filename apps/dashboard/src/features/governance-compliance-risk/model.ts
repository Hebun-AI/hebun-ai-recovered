/*
 * governance-compliance-risk/model.ts — builds the Compliance & Risk surface from the real
 * governance evaluation pipeline, read-only (Hebun UI Phase 23C).
 *
 * It reads the real deterministic pipeline stages (structural machinery) and references the
 * frameworks the compliance engine evaluates against. Both the compliance scores and the risk
 * assessment derive from seeded governance data, so nothing is surfaced as a live compliance
 * certification or a confirmed risk — no compliance %, score, violation, or incident count is
 * rendered. It imports NO @/features/governance mock directly.
 */

import { governancePipelineSteps } from "@/features/policy/governance-pipeline";
import type { ComplianceRiskModel, EvaluationStageView } from "./contracts";

function stages(ids: readonly string[]): EvaluationStageView[] {
  return governancePipelineSteps
    .filter((step) => ids.includes(step.id))
    .map((step) => ({ id: step.id, label: step.label, description: step.description }));
}

/** Build the Compliance & Risk model. Pure, synchronous, read-only. */
export function getComplianceRiskModel(): ComplianceRiskModel {
  return {
    state: {
      provenance: "derived-seeded",
      headline: "Compliance & risk — derived from seeded input",
      detail:
        "Compliance and risk are evaluated by a real deterministic engine, but its inputs are seeded governance data. No result here is a live compliance certification or a confirmed organizational risk, and no live compliance/risk source is connected. Scores are not surfaced as truth.",
    },
    complianceStages: stages(["validate-constraints", "evaluate-compliance"]),
    riskStages: stages(["evaluate-risk"]),
    frameworks: [
      { name: "GDPR", note: "Data protection (EU)." },
      { name: "KVKK", note: "Data protection (TR)." },
      { name: "ISO 27001", note: "Information security management." },
      { name: "SOC 2", note: "Service trust criteria." },
      { name: "Internal Company Policies", note: "Organization-defined rules." },
    ],
    riskModel: {
      levels: ["low", "medium", "high", "critical"],
      note: "Risk is assessed as a level with named drivers, derived from seeded risk data — a posture, not a confirmed incident.",
    },
    distinctions: [
      "Compliance evaluation is not compliance certification.",
      "Risk evaluation is not an incident; a risk signal is not a proven risk.",
      "A policy result is not authorization; a constraint is not a human decision.",
      "Absence of violation is not compliant; absence of risk is not safe.",
      "Seeded input is not live organizational state; a derived result is not authoritative.",
    ],
  };
}
