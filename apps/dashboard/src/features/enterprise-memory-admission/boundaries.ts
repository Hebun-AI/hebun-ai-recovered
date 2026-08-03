/**
 * Enterprise Memory Admission — architectural boundary contracts.
 *
 * These types describe the boundary that a candidate crosses when it enters the
 * admission foundation from the Application layer. The boundary carries claims
 * only — proposed content, a claimed authority, and offered evidence. Crossing
 * the boundary proves nothing: authority is not permission, and a claim is not a
 * decision. No evaluation or enforcement happens here.
 */

import type {
  MemoryClassification,
  MemoryContent,
  MemoryId,
  MemoryTimestamp,
} from "@/features/enterprise-memory";
import type { AdmissionAuthority } from "@/features/enterprise-memory-admission/authority";
import type { EvidenceReference } from "@/features/enterprise-memory-admission/evaluation";

export type AdmissionRequestId = string;

/**
 * A candidate proposed for admission. It is an inbound claim, not an admitted
 * record: it has no lifecycle, no provenance, and no confirmed authority.
 */
export interface MemoryAdmissionRequest {
  readonly requestId: AdmissionRequestId;
  readonly proposedFor: MemoryId;
  readonly content: MemoryContent;
  readonly proposedClassification: MemoryClassification;
  readonly claimedAuthority: AdmissionAuthority;
  readonly offeredEvidence: readonly EvidenceReference[];
  readonly submittedAt: MemoryTimestamp;
}

/**
 * Marker contract documenting the non-implication rule at the type level:
 * possessing authority never entails possessing permission. Both are recorded;
 * neither is derived from the other.
 */
export interface AuthorityPermissionSeparation {
  readonly authorityIsNotPermission: true;
}
