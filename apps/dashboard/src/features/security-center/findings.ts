/*
 * security-center/findings.ts — the security finding registry + status/category vocabulary (P19).
 *
 * The registry is EMPTY. No finding is fabricated, no severity score is produced, and there is NO
 * `CONFIRMED` status: confirming a breach needs a real authority/evidence path that does not exist,
 * so a finding is at most SUPPORTED or REQUIRES_REVIEW. A finding is a derived interpretation over
 * evidence — it is NOT a confirmed breach.
 */

import type {
  SecurityFinding,
  SecurityFindingCategory,
  SecurityFindingStatus,
} from "./contracts";

/** No findings are surfaced. The contract exists; no instance is fabricated. */
const FINDINGS: readonly SecurityFinding[] = Object.freeze([]);

/** Findings for a tenant. Always empty in Phase 19 — never a fabricated finding. */
export function listSecurityFindings(tenantId: string): readonly SecurityFinding[] {
  return FINDINGS.filter((finding) => finding.affectedSubjects.includes(tenantId));
}

export interface FindingStatusDescriptor {
  readonly status: SecurityFindingStatus;
  readonly label: string;
  /** Whether Heby may ever produce a finding in this status. It never produces a breach claim. */
  readonly producibleByHeby: boolean;
  readonly describes: string;
}

export const FINDING_STATUS_DESCRIPTORS: Readonly<
  Record<SecurityFindingStatus, FindingStatusDescriptor>
> = Object.freeze({
  UNVALIDATED: Object.freeze({ status: "UNVALIDATED", label: "Unvalidated", producibleByHeby: true, describes: "Observed but not yet supported by sufficient evidence." }),
  SUPPORTED: Object.freeze({ status: "SUPPORTED", label: "Supported by evidence", producibleByHeby: true, describes: "Evidence supports the interpretation; not a confirmed breach." }),
  REQUIRES_REVIEW: Object.freeze({ status: "REQUIRES_REVIEW", label: "Requires human review", producibleByHeby: true, describes: "A human must review before any response." }),
  DISMISSED: Object.freeze({ status: "DISMISSED", label: "Dismissed", producibleByHeby: false, describes: "A human dismissed it. Heby never dismisses on its own." }),
  RESOLVED: Object.freeze({ status: "RESOLVED", label: "Resolved", producibleByHeby: false, describes: "A human recorded resolution. Heby never resolves on its own." }),
});

const CATEGORY_LABELS: Record<SecurityFindingCategory, string> = {
  "identity-access": "Identity & access",
  device: "Device",
  "platform-integration": "Platform & integration",
  runtime: "Runtime",
  "policy-control": "Policy & control",
  "data-exposure": "Data exposure",
  configuration: "Configuration",
};

export function securityFindingCategoryLabel(category: SecurityFindingCategory): string {
  return CATEGORY_LABELS[category];
}

/** There is no confirmable "breach" status. Structural guard against ever inventing one. */
export function isBreachConfirmable(): boolean {
  return false;
}
