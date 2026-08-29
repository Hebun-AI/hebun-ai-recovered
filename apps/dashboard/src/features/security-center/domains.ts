/*
 * security-center/domains.ts — security domain STATUS surfaces (UI refinement).
 *
 * A domain is a status surface, NEVER a fabricated "agent". Its state is honest — connected (this
 * surface holds and consumes a real tenant-scoped read path), derived (a real technical state
 * exists), not-connected (no feed and no read path), restricted, or none. Unknown / not-connected
 * is NEVER rendered as healthy; no health percentage is invented; no green means "nothing
 * reported".
 *
 * ── THE STALE DENIALS E2-2 REPAIRED, AND WHY THEY SURVIVED ───────────────────
 *
 * SEC-4 (S-A) found three sentences on this surface that described the REPOSITORY as it was, and
 * became false as Hebun grew. It repaired them in `source-map.ts` and added a guard — but the guard
 * scanned only that one file, so two of the same sentences went on being served here:
 *
 *   integration  said "None connected". Released tenant-scoped provider connections exist.
 *   provider     said "Simulation only". Released live transports exist.
 *
 * Neither was ever a fabrication and neither is repaired by claiming the opposite. This surface
 * reads neither authority, and each row now states BOTH facts — what the repository has, and what
 * this surface actually consumes — because stating only one of them misleads in one direction or
 * the other. The E2-2 truth scan now covers every module on this surface, so the same contradiction
 * cannot return here unnoticed.
 *
 *   AUTHORITY EXISTS != SECURITY CENTER CONNECTED
 */

import type { SecurityDomainStatus } from "./contracts";

const DOMAINS: readonly SecurityDomainStatus[] = [
  { domain: "identity-access", label: "Identity & Access", sourceClass: "authentication", state: "derived", detail: "Derived auth/permission state. No identity-anomaly feed." },
  { domain: "device", label: "Device Security", sourceClass: "device", state: "derived", detail: "Phase 18 posture: runtime not connected, 0 devices." },
  { domain: "runtime", label: "Runtime Security", sourceClass: "runtime", state: "derived", detail: "Derived runtime health. Not a security-event feed." },
  { domain: "integration", label: "Integration Security", sourceClass: "integration", state: "derived", detail: "Tenant-scoped integration connections exist and belong to the integration authority. This surface reads none of them." },
  { domain: "provider", label: "Provider Security", sourceClass: "provider", state: "derived", detail: "Real provider transports exist and belong to the provider modules. This surface reads no provider state." },
  { domain: "policy-governance", label: "Policy & Governance", sourceClass: "policy", state: "not-connected", detail: "No live policy/governance evaluator connected." },
  /*
   * E2-2 — the one domain that legitimately moved, because it is the row bound to the `audit`
   * source class this release connected.
   *
   * The label is kept and the detail carries the exact truth, because what is connected is the
   * GOVERNED-ACT ledger, not data-access monitoring. This connection does not make Knowledge
   * security, data classification, DLP or exfiltration detection available, and the row must not be
   * read as saying so.
   */
  { domain: "data-access", label: "Data Access", sourceClass: "audit", state: "connected", detail: "Connected to the recorded governed-act ledger, tenant-scoped and bounded. No data classification, DLP or exfiltration detection exists." },
  { domain: "execution", label: "Execution Security", sourceClass: "runtime", state: "not-connected", detail: "No execution-security event feed. Runtime health is under Runtime Security." },
];

export function listSecurityDomains(): readonly SecurityDomainStatus[] {
  return DOMAINS;
}
