/*
 * security-center/domains.ts — security domain STATUS surfaces (UI refinement).
 *
 * A domain is a status surface, NEVER a fabricated "agent". Its state is honest — derived (a real
 * technical state exists), not-connected (no feed), restricted, or none. Unknown / not-connected is
 * NEVER rendered as healthy; no health percentage is invented; no green means "nothing reported".
 */

import type { SecurityDomainStatus } from "./contracts";

const DOMAINS: readonly SecurityDomainStatus[] = [
  { domain: "identity-access", label: "Identity & Access", sourceClass: "authentication", state: "derived", detail: "Derived auth/permission state. No identity-anomaly feed." },
  { domain: "device", label: "Device Security", sourceClass: "device", state: "derived", detail: "Phase 18 posture: runtime not connected, 0 devices." },
  { domain: "runtime", label: "Runtime Security", sourceClass: "runtime", state: "derived", detail: "Derived runtime health. Not a security-event feed." },
  { domain: "integration", label: "Integration Security", sourceClass: "integration", state: "derived", detail: "Platform integration state. None connected." },
  { domain: "provider", label: "Provider Security", sourceClass: "provider", state: "derived", detail: "Provider vocabulary. Simulation only." },
  { domain: "policy-governance", label: "Policy & Governance", sourceClass: "policy", state: "not-connected", detail: "No live policy/governance evaluator connected." },
  { domain: "data-access", label: "Data Access", sourceClass: "audit", state: "not-connected", detail: "No data-access audit feed connected." },
  { domain: "execution", label: "Execution Security", sourceClass: "runtime", state: "not-connected", detail: "No execution-security event feed. Runtime health is under Runtime Security." },
];

export function listSecurityDomains(): readonly SecurityDomainStatus[] {
  return DOMAINS;
}
