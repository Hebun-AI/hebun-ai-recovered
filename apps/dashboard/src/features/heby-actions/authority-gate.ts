/*
 * heby-actions/authority-gate.ts — the authority boundary (Phase 17).
 *
 * This gate keeps four things SEPARATE that are easy to collapse:
 *   capability  — the tool can technically do it.
 *   permission  — the workspace owns the capability (capability-gate).
 *   authority   — a human is entitled to authorize it.
 *   approval    — a human actually authorized it.
 *
 * A tool being capable does NOT mean Heby may use it. An action being valid does NOT mean it is
 * authorized. An authority requirement being KNOWN does NOT mean approval occurred. So this gate
 * reports the REQUIREMENT and the plain fact that no human approval has occurred — it NEVER
 * manufactures an "authorized" state. `hebyMayAct` is the literal `false`: Heby never decides,
 * approves, or executes a consequential action.
 *
 * Confused-deputy note: the authority requirement is read from the tool declaration and fixed at
 * preparation. Heby accepts NO caller-supplied "granted authority" input anywhere, so a prepared
 * action can never be replayed into a stronger authority context — there is no seam to inject one.
 */

import { HEBY_AUTHORITY_DESCRIPTORS } from "@/features/heby-integration";
import type { HebyAuthorityMode } from "@/features/heby-integration";
import type {
  HebyActionTool,
  HebyAuthorityGateResult,
  HebyRequirementStatus,
} from "./contracts";

/** Authority modes an advisory, non-mutating action satisfies without any human decision. */
function isAdvisorySatisfiable(mode: HebyAuthorityMode): boolean {
  return mode === "advisory-only";
}

export function evaluateAuthority(tool: HebyActionTool | undefined): HebyAuthorityGateResult {
  if (!tool) {
    return {
      status: "unmet",
      requirement: "unavailable",
      hebyMayAct: false,
      humanReviewRequired: false,
      reasons: ["No tool to evaluate authority for."],
    };
  }

  const requirement = tool.authorityRequirement;
  const descriptor = HEBY_AUTHORITY_DESCRIPTORS[requirement];

  // Advisory-only (READ_ONLY / PREPARATION_ONLY): satisfiable without a human decision, because
  // Heby is only advising or preparing — it is not changing state.
  if (isAdvisorySatisfiable(requirement)) {
    return {
      status: "satisfied",
      requirement,
      hebyMayAct: false,
      humanReviewRequired: false,
      reasons: [`${descriptor.label}: Heby may advise/prepare without a human decision.`],
    };
  }

  // Everything else needs a human authority that has NOT been given. Never "authorized".
  const status: HebyRequirementStatus = "unmet";
  const humanReviewRequired = requirement === "human-review-required" || requirement === "future-authorized-preparation" || requirement === "restricted";
  return {
    status,
    requirement,
    hebyMayAct: false,
    humanReviewRequired,
    reasons: [
      `${descriptor.label}: a human authority is required and no approval has occurred. Heby prepares; it never authorizes.`,
    ],
  };
}
