/*
 * governance-policies/model.ts — builds the Policies & Rules surface from the REAL policy
 * engine, read-only (Hebun UI Phase 23B).
 *
 * It reads the narrowest real seams: the governance evaluation pipeline steps (structural
 * machinery) and the policy registry (rule definitions). Both derive from seeded governance
 * definitions and registry data, so the model labels everything DERIVED · SEEDED INPUT. It
 * imports NO @/features/governance mock directly, surfaces NO fabricated compliance/risk/audit
 * score and NO governance-result outcomes as truth, and exposes NO mutation.
 */

import { governancePipelineSteps } from "@/features/policy/governance-pipeline";
import { policyRegistry } from "@/features/policy/policy-registry";
import type { PoliciesRulesModel } from "./contracts";

/** Build the Policies & Rules model. Pure, synchronous, read-only. */
export function getPoliciesRulesModel(): PoliciesRulesModel {
  return {
    engine: {
      provenance: "derived-seeded",
      headline: "Policy engine — derived from seeded input",
      detail:
        "A real, deterministic governance evaluation engine exists. Its policy definitions and reasoning inputs are seeded (built from seeded governance definitions and registry data), so no policy, rule, or result here is live organizational policy truth. No live policy store and no connected policy evaluator is available.",
    },
    pipeline: governancePipelineSteps.map((step) => ({
      id: step.id,
      label: step.label,
      description: step.description,
    })),
    rules: policyRegistry.map((rule) => ({
      id: rule.id,
      name: rule.name,
      category: rule.category,
      owner: rule.owner,
      description: rule.description,
      appliesTo: [...rule.appliesTo],
      approvalMode: rule.approvalMode,
      reviewRequired: rule.reviewRequired,
    })),
    provenance: [
      "Policy and rule definitions are built from seeded governance definitions and registry data.",
      "Evaluation runs over deterministic reasoning that is itself seeded — not live organizational input.",
      "No live policy store and no connected policy evaluator exists; results are not surfaced as truth.",
      "Every record here is therefore DERIVED · SEEDED INPUT, never live organizational policy.",
    ],
    boundaries: [
      "A policy definition is not policy enforcement.",
      "Policy evaluation is not authorization.",
      "Policy evaluation is not execution — the execution governance gate is not connected (Operations).",
      "A governance constraint is not a human decision — approvals belong to Decisions.",
      "Seeded input is not organizational truth; a derived result is not authoritative governance.",
    ],
  };
}
