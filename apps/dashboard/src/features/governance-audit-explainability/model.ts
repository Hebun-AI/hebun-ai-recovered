/*
 * governance-audit-explainability/model.ts — builds the Audit & Explainability surface from the
 * real governance evaluation pipeline, read-only (Hebun UI Phase 23C).
 *
 * It reads the real audit + explanation pipeline stages (structural) and describes the shape of a
 * runtime audit trace and a governance explanation. There is no durable authoritative audit
 * persistence, so durable records are honestly empty; no synthetic audit event, timestamp, or
 * model chain-of-thought is generated. It imports NO @/features/governance mock directly.
 */

import { governancePipelineSteps } from "@/features/policy/governance-pipeline";
import type { AuditExplainabilityModel, EvaluationStageView } from "./contracts";

function stages(ids: readonly string[]): EvaluationStageView[] {
  return governancePipelineSteps
    .filter((step) => ids.includes(step.id))
    .map((step) => ({ id: step.id, label: step.label, description: step.description }));
}

/** Build the Audit & Explainability model. Pure, synchronous, read-only. */
export function getAuditExplainabilityModel(): AuditExplainabilityModel {
  return {
    state: {
      provenance: "derived-seeded",
      headline: "Audit & explainability — derived, not a durable record",
      detail:
        "The engine builds a deterministic audit trace and a governance explanation for each evaluation, over seeded input. That trace is not the durable record: durable governance audit records are written separately by the governed writers, and this surface does not read them — so no durable audit record is surfaced here, and none is fabricated.",
    },
    auditStages: stages(["audit", "explanation"]),
    auditModel: {
      note: "A governance audit trace is a runtime artifact of a single evaluation pass — it is not a persisted, authoritative audit record. It records no fabricated timestamp or actor.",
      recordFields: ["id", "summary", "trace", "owner"],
    },
    durableRecords: {
      present: false,
      note: "No durable authoritative audit record is surfaced because no audit persistence source is connected. No synthetic audit event is generated.",
    },
    explanationTraces: [
      { name: "Policy trace", describes: "Which policies participated in the evaluation." },
      { name: "Permission trace", describes: "Which permission checks were applied." },
      { name: "Compliance trace", describes: "Which compliance rules were evaluated." },
      { name: "Approval trace", describes: "Which approvals a decision would require (never executed here)." },
    ],
    explainabilityNote:
      "Explainability here means inspectable system provenance — which policy, rule, and stage participated. It is NOT a model chain-of-thought and exposes no hidden reasoning.",
    distinctions: [
      "An explanation is not a model chain-of-thought.",
      "An audit trace is not a runtime event, and not an execution receipt.",
      "Provenance is not evidence; evidence is not a conclusion.",
      "A security finding is not a compliance violation.",
      "A derived evaluation is not an authoritative audit record.",
    ],
  };
}
