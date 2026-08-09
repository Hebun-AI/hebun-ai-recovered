/*
 * security-center/response-options.ts — structural security response options (UI Phase 19).
 *
 * A response OPTION is a named capability the Security Center can present — it is NEVER itself
 * executable. Every action routes through the Phase 17 action pipeline, and every device-backed
 * response uses the disconnected Phase 18 Device Runtime. So: read-only/preparation options are
 * `advisory` (Heby may explain/prepare), consequential options `require-human-review`, and
 * device-backed responses (isolate, collect evidence) are `not-available` because the Device
 * Runtime is not connected. There is no auto-remediation and no direct mutation — option ≠ action.
 */

import type {
  SecurityResponseDisposition,
  SecurityResponseKind,
  SecurityResponseOption,
} from "./contracts";

const OPTIONS: readonly SecurityResponseOption[] = [
  {
    kind: "INVESTIGATE_IDENTITY", label: "Investigate identity",
    sideEffect: "READ_ONLY", deviceBacked: false, disposition: "advisory",
    authorityRequirement: "advisory-only",
    describes: "Read and explain identity/access technical state. No change.",
  },
  {
    kind: "REVIEW_DEVICE", label: "Review device posture",
    sideEffect: "READ_ONLY", deviceBacked: false, disposition: "advisory",
    authorityRequirement: "advisory-only",
    describes: "Read the Phase 18 device boundary. No device is connected; no change.",
  },
  {
    kind: "PREPARE_REVIEW", label: "Prepare a human review",
    sideEffect: "PREPARATION_ONLY", deviceBacked: false, disposition: "advisory",
    authorityRequirement: "advisory-only",
    describes: "Prepare a review package for a human. Nothing is executed.",
  },
  {
    kind: "RESTRICT_SESSION", label: "Restrict session",
    sideEffect: "CONSEQUENTIAL_MUTATION", deviceBacked: false, disposition: "requires-human-review",
    authorityRequirement: "human-review-required",
    describes: "Would restrict an authenticated session. Consequential; requires human review.",
  },
  {
    kind: "REVOKE_CAPABILITY", label: "Revoke capability",
    sideEffect: "CONSEQUENTIAL_MUTATION", deviceBacked: true, disposition: "requires-human-review",
    authorityRequirement: "human-review-required",
    describes: "Would revoke a granted capability. Consequential; requires human review.",
  },
  {
    kind: "BLOCK_CONNECTION", label: "Block connection",
    sideEffect: "CONSEQUENTIAL_MUTATION", deviceBacked: false, disposition: "requires-human-review",
    authorityRequirement: "human-review-required",
    describes: "Would block an integration/connection. Consequential; requires human review.",
  },
  {
    kind: "ISOLATE_DEVICE", label: "Isolate device",
    sideEffect: "DEVICE_ACTION", deviceBacked: true, disposition: "not-available",
    authorityRequirement: "future-authorized-preparation",
    describes: "Would isolate a device. Device Runtime is not connected — not available.",
  },
  {
    kind: "COLLECT_EVIDENCE", label: "Collect bounded evidence",
    sideEffect: "DEVICE_ACTION", deviceBacked: true, disposition: "not-available",
    authorityRequirement: "future-authorized-preparation",
    describes: "Would capture bounded device evidence. Device Runtime is not connected — not available.",
  },
];

export function listResponseOptions(): readonly SecurityResponseOption[] {
  return OPTIONS;
}

export function getResponseOption(kind: SecurityResponseKind): SecurityResponseOption | undefined {
  return OPTIONS.find((option) => option.kind === kind);
}

/** Whether any response option is directly executable from the Security Center. ALWAYS false. */
export function anyOptionDirectlyExecutable(): boolean {
  return false;
}

export interface ResponseConsistencyIssue {
  readonly kind: SecurityResponseKind;
  readonly issue: string;
}

/**
 * Validate the response model's honesty invariants:
 *  - a device-backed DEVICE_ACTION is `not-available` (Phase 18 disconnected);
 *  - a consequential mutation requires human review;
 *  - a read-only/preparation option is advisory and never requires a stronger authority than advisory;
 *  - no option claims direct execution.
 */
export function validateResponseModel(): readonly ResponseConsistencyIssue[] {
  const issues: ResponseConsistencyIssue[] = [];
  for (const o of OPTIONS) {
    if (o.sideEffect === "DEVICE_ACTION" && o.disposition !== "not-available") {
      issues.push({ kind: o.kind, issue: "device action must be not-available (runtime disconnected)" });
    }
    if (o.sideEffect === "CONSEQUENTIAL_MUTATION" && o.disposition !== "requires-human-review") {
      issues.push({ kind: o.kind, issue: "consequential mutation must require human review" });
    }
    if ((o.sideEffect === "READ_ONLY" || o.sideEffect === "PREPARATION_ONLY")) {
      if (o.disposition !== "advisory") issues.push({ kind: o.kind, issue: "read-only/preparation must be advisory" });
      if (o.authorityRequirement !== "advisory-only") issues.push({ kind: o.kind, issue: "advisory option must be advisory-only authority" });
    }
    const dispositions: readonly SecurityResponseDisposition[] = ["advisory", "requires-human-review", "not-available"];
    if (!dispositions.includes(o.disposition)) {
      issues.push({ kind: o.kind, issue: "unknown disposition" });
    }
  }
  return issues;
}
