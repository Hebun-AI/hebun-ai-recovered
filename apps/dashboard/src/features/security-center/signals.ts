/*
 * security-center/signals.ts — the security signal registry + kind vocabulary (UI Phase 19).
 *
 * The registry is EMPTY. No security signal is fabricated — there is no live security feed, so
 * there is nothing to list. A signal is a raw, source-attributed technical observation; it is NOT
 * an incident. Lookups are tenant-scoped and fail closed to an empty list.
 */

import type { SecuritySignal, SecuritySignalKind } from "./contracts";

/** No signals are surfaced. The contract exists; no instance is fabricated. */
const SIGNALS: readonly SecuritySignal[] = Object.freeze([]);

/** Signals for a tenant. Always empty in Phase 19 — never a fabricated signal. */
export function listSecuritySignals(tenantId: string): readonly SecuritySignal[] {
  return SIGNALS.filter((signal) => signal.tenantId === tenantId);
}

const SIGNAL_KIND_LABELS: Record<SecuritySignalKind, string> = {
  AUTHENTICATION: "Authentication",
  AUTHORIZATION: "Authorization",
  DEVICE: "Device",
  RUNTIME: "Runtime",
  INTEGRATION: "Integration",
  PROVIDER: "Provider",
  POLICY: "Policy",
  DATA_ACCESS: "Data access",
  EXECUTION: "Execution",
  CONFIGURATION: "Configuration",
  NETWORK: "Network",
  OTHER: "Other",
};

export function securitySignalKindLabel(kind: SecuritySignalKind): string {
  return SIGNAL_KIND_LABELS[kind];
}
