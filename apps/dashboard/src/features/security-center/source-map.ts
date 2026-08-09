/*
 * security-center/source-map.ts — the honest map of security source classes (UI Phase 19).
 *
 * For each source class it states the truthful path state: `derived` (a real, non-authoritative
 * technical state Hebun already exposes — e.g. authentication subsystem health, the disconnected
 * Phase 18 device boundary, runtime health), or `not-connected` (no live security feed exists —
 * incident feed, network telemetry, persisted audit, live policy evaluation). NOTHING is
 * `connected`: there is no live security intelligence feed in this repository. A degraded derived
 * state is never reinterpreted as an attack.
 */

import type { SecuritySourceClass, SecuritySourceStatus } from "./contracts";

const SOURCES: Readonly<Record<SecuritySourceClass, SecuritySourceStatus>> = Object.freeze({
  authentication: Object.freeze({
    sourceClass: "authentication", state: "derived", usable: true,
    detail: "Authentication subsystem health is a derived technical state — not an intrusion feed.",
    canProve: "Technical authentication subsystem state.",
    cannotProve: "Account compromise, credential theft, or a failed-login pattern.",
  }),
  authorization: Object.freeze({
    sourceClass: "authorization", state: "derived", usable: true,
    detail: "Permission/authority vocabulary is structural — no live authorization anomaly feed.",
    canProve: "The structural permission and authority model.",
    cannotProve: "Privilege escalation or an unauthorized-access event.",
  }),
  device: Object.freeze({
    sourceClass: "device", state: "derived", usable: true,
    detail: "Device posture is the Phase 18 boundary — registry empty, runtime not connected.",
    canProve: "Device Runtime posture (registry empty, runtime not connected).",
    cannotProve: "Endpoint compromise, infection, or a device intrusion.",
  }),
  runtime: Object.freeze({
    sourceClass: "runtime", state: "derived", usable: true,
    detail: "Runtime health is the non-authoritative Executive Overview — not a security event feed.",
    canProve: "Derived runtime/execution health from the Executive Overview.",
    cannotProve: "That a degradation is an attack rather than an operational fault.",
  }),
  integration: Object.freeze({
    sourceClass: "integration", state: "derived", usable: true,
    detail: "Integration state is the Platform boundary — none connected; unavailable is not a breach.",
    canProve: "Which integrations are technically connected (none).",
    cannotProve: "That an unavailable integration is a breach.",
  }),
  provider: Object.freeze({
    sourceClass: "provider", state: "derived", usable: true,
    detail: "Provider state is simulation vocabulary — a simulation provider is not live security status.",
    canProve: "The provider capability vocabulary and simulation state.",
    cannotProve: "Live provider security posture — a simulation is not live status.",
  }),
  policy: Object.freeze({
    sourceClass: "policy", state: "not-connected", usable: false,
    detail: "No live policy/governance evaluator is connected; policy violations cannot be evaluated here.",
    canProve: "Nothing — no live evaluator is connected.",
    cannotProve: "Any policy violation or control-compliance result.",
  }),
  audit: Object.freeze({
    sourceClass: "audit", state: "not-connected", usable: false,
    detail: "No persisted security audit history exists; runtime provenance is not a forensic trail.",
    canProve: "Nothing — no persisted audit exists.",
    cannotProve: "A forensic history or a chronology of past security events.",
  }),
  network: Object.freeze({
    sourceClass: "network", state: "not-connected", usable: false,
    detail: "No network telemetry is connected; there is no scanner, packet capture, or IP feed.",
    canProve: "Nothing — no network telemetry is connected.",
    cannotProve: "Any connection, IP, scan, or network-level event.",
  }),
  "incident-feed": Object.freeze({
    sourceClass: "incident-feed", state: "not-connected", usable: false,
    detail: "No incident feed is connected; no incident, attack, or breach record is available.",
    canProve: "Nothing — no incident feed is connected.",
    cannotProve: "Any incident, attack, or breach record.",
  }),
});

export function listSecuritySources(): readonly SecuritySourceStatus[] {
  return Object.values(SOURCES);
}

export function getSecuritySource(sourceClass: SecuritySourceClass): SecuritySourceStatus {
  return SOURCES[sourceClass];
}

/** Whether any source is truly `connected` (a live security feed). ALWAYS false in Phase 19. */
export function hasConnectedSecurityFeed(): boolean {
  return listSecuritySources().some((source) => source.state === "connected");
}
