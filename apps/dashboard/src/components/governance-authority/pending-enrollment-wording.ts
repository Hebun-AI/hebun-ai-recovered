/*
 * Pending-enrollment wording — every refusal the approver's card can render.
 *
 * A separate module for the same reason the public surface has one: the card is a client component
 * and must not carry the enrollment authority's vocabulary into a browser bundle, so the union
 * becomes sentences here, once, type-checked. `Record<Union, string>` means a new refusal reason
 * breaks the build rather than rendering as a blank line to the person holding the second key.
 *
 * Pure frozen values. No React, no I/O, no database, no authority.
 */

import type { EnrollmentDecisionRefusal } from "@/features/identity-enrollment/contracts";
import { JUSTIFICATION_LIMITS } from "@/features/governance-decision/contracts";

/** I1.2 decision refusals, in the approver's words. Every member of the union has an entry. */
const DECISION_REFUSALS: Record<EnrollmentDecisionRefusal, string> = {
  unauthenticated: "Your session ended. Sign in again.",
  "no-governance-authority": "This tenant has no Governance authority yet.",
  "not-the-governance-authority":
    "Only a current Governance authority may decide an enrollment. An organizational role does not grant it.",
  "enrollment-unresolvable": "That submission does not exist in this organization.",
  "justification-required": `A reason of at least ${JUSTIFICATION_LIMITS.minimumLength} characters is required.`,
  "rejection-reason-required": `A rejection must say why, in at least ${JUSTIFICATION_LIMITS.minimumLength} characters.`,
  "already-decided": "That submission was already decided. Reload to see the current state.",
  "persistence-unavailable": "The durable store is unavailable. Nothing was changed.",
};

export const PENDING_ENROLLMENT_WORDING = Object.freeze({
  refusals: Object.freeze({ ...DECISION_REFUSALS }) as Readonly<Record<string, string>>,
  minimumJustificationLength: JUSTIFICATION_LIMITS.minimumLength,
  /*
   * WHAT THE APPROVER IS ACTUALLY BEING ASKED, stated plainly. Hebun verified nothing about the
   * bearer, so the only honest question is whether the approver recognises their own handover.
   */
  whatApprovalMeans:
    "Approving permits the bearer of that capability to create ONE Hebun identity and a first " +
    "password. It creates no account by itself, grants no membership, and grants no authority.",
  whatItDoesNotProve:
    "Hebun did not deliver the capability and did not verify anyone's email address. Approve only " +
    "if the timing matches a handover you performed yourself.",
});
