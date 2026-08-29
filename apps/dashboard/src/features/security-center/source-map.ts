/*
 * security-center/source-map.ts — the honest map of security source classes (UI Phase 19; S-A).
 *
 * For each source class it states the truthful path state: `derived` (a real, non-authoritative
 * technical state Hebun already exposes — e.g. authentication subsystem health, the disconnected
 * Phase 18 device boundary, runtime health), or `not-connected` (no live security feed exists —
 * incident feed, network telemetry, live policy evaluation). NOTHING is `connected`: there is no
 * live security intelligence feed wired to this surface. A degraded derived state is never
 * reinterpreted as an attack.
 *
 * ── THE DISTINCTION S-A EXISTS TO REPAIR ─────────────────────────────────────
 *
 * Three of these classes described the REPOSITORY when they should have described THIS SURFACE,
 * and Hebun's delivery overtook them:
 *
 *   integration  said "none connected". Released tenant-scoped provider connections exist
 *                (`provider-google`, `provider-github`).
 *   provider     said "simulation vocabulary". Released live transports exist.
 *   audit        said "No persisted security audit history exists". `audit_log` is an append-only
 *                governed ledger with nine writers and released tenant-scoped readers.
 *
 * Every one of those sentences was written honestly and became false because the repository grew.
 * None was a fabrication, and the repair is not to claim the opposite: the Security Center reads
 * none of those authorities. It holds one cross-feature value import — the Phase 18 device
 * boundary — and nothing else.
 *
 * So each entry now states BOTH facts, because stating only one of them is how this surface
 * misleads in either direction:
 *
 *   AUTHORITY EXISTS != SECURITY CENTER CONNECTED
 *   AUDIT LEDGER EXISTS != SECURITY CENTER AUDIT CONNECTED
 *   PROVIDER RUNTIME EXISTS != SECURITY CENTER PROVIDER CONNECTED
 *   INTEGRATION EXISTS != SECURITY CENTER INTEGRATION CONNECTED
 *
 * ── WHAT S-A DELIBERATELY DID NOT CHANGE ─────────────────────────────────────
 *
 * No `state` and no `usable` value moved. `state` classifies the SOURCE CLASS — whether Hebun
 * exposes a derivable technical state of that kind — and not whether this surface is wired to it.
 * Flipping `integration` or `provider` to `not-connected` on the grounds that the Security Center
 * reads neither would have forced the same flip on `authentication`, `authorization` and `runtime`,
 * which it also does not read: that is a redesign of the source model, not a truth correction, and
 * it is not this slice's to make. The wiring fact is carried by the prose, where it is legible.
 *
 * Correcting these sentences connects nothing. This surface reads exactly what it read before.
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
    detail:
      "Durable Governance and action-authorization decisions exist and are owned by their own " +
      "authorities. This surface holds the structural authority vocabulary only — no decision " +
      "reader and no live authorization anomaly feed is wired to it.",
    canProve: "The structural permission and authority model, as vocabulary.",
    cannotProve:
      "Who currently holds authority, what was decided, privilege escalation, or an " +
      "unauthorized-access event.",
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
    detail:
      "Released tenant-scoped integration connections exist and are owned by the integration " +
      "authority. No integration feed is wired to the Security Center, so this surface reads none " +
      "of them; unavailable is not a breach.",
    canProve: "Nothing on this surface — the Security Center reads no integration state.",
    cannotProve:
      "Which integrations are connected, the security state of any connection, or that an " +
      "unavailable integration is a breach.",
  }),
  provider: Object.freeze({
    sourceClass: "provider", state: "derived", usable: true,
    detail:
      "Real provider transports exist in the runtime and are owned by the provider modules. No " +
      "provider feed is wired to the Security Center, so this surface reads no provider state.",
    canProve: "Nothing on this surface — the Security Center reads no provider state.",
    cannotProve:
      "Live provider security posture, credential health, or whether a provider call succeeded.",
  }),
  policy: Object.freeze({
    sourceClass: "policy", state: "not-connected", usable: false,
    detail: "No live policy/governance evaluator is connected; policy violations cannot be evaluated here.",
    canProve: "Nothing — no live evaluator is connected.",
    cannotProve: "Any policy violation or control-compliance result.",
  }),
  audit: Object.freeze({
    sourceClass: "audit", state: "not-connected", usable: false,
    detail:
      "A governed append-only audit ledger exists and has released tenant-scoped readers, but it " +
      "is not wired to the Security Center. This surface reads no audit history; runtime " +
      "provenance is not a forensic trail.",
    canProve: "Nothing here — no audit source is connected to the Security Center.",
    cannotProve:
      "A forensic history or a chronology of past security events. What the ledger does record " +
      "is governed acts, which is not the same thing and is not read here.",
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
