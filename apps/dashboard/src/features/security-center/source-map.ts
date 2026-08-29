/*
 * security-center/source-map.ts — the honest map of security source classes (UI Phase 19; S-A).
 *
 * For each source class it states the truthful path state: `connected` (this surface holds a
 * legitimate tenant-scoped read-only path and consumes it), `derived` (a real, non-authoritative
 * technical state Hebun already exposes — e.g. authentication subsystem health, the disconnected
 * Phase 18 device boundary, runtime health), or `not-connected` (no feed and no read path —
 * incident feed, network telemetry, live policy evaluation). A degraded derived state is never
 * reinterpreted as an attack.
 *
 * ── WHAT E2-2 CONNECTED, AND WHAT IT DID NOT ─────────────────────────────────
 *
 * EXACTLY ONE class moved: `audit`, through the released `governance-activity` seam. Nothing else
 * moved, and the reason is worth stating because "a real seam exists elsewhere" is the argument
 * that would connect all of them: authentication, authorization, runtime, integration and provider
 * all have real seams too, and this surface still reads none of them. A source class is connected
 * when THIS surface consumes it — never when the capability exists somewhere in the repository.
 *
 *   SOURCE EXISTS != SECURITY CENTER CONNECTED
 *   CONNECTED     != LIVE FEED
 *   CONNECTED     != AUTHORITATIVE
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
  /*
   * E2-2 / S-B — THE FIRST CONNECTED SOURCE THIS SURFACE HAS EVER HAD.
   *
   * `connected` means exactly one thing here: a legitimate tenant-scoped read-only path exists and
   * this surface consumes it on the request. It does NOT mean a live feed, a stream, a provider
   * connection, a credential, or that the observation is authoritative. The ledger is authoritative
   * for the acts it recorded; the bounded view of it that reaches this page is derived.
   *
   *   CONNECTED             != AUTHORITATIVE
   *   CONNECTED             != AVAILABLE EVERY REQUEST
   *   REQUEST-TIME READ     != REAL-TIME STREAM
   */
  audit: Object.freeze({
    sourceClass: "audit", state: "connected", usable: true,
    detail:
      "The governed append-only ledger is read through its released tenant-scoped seam: the most " +
      "recent recorded acts, bounded, with the independent total behind them. Read at request " +
      "time — not a stream, and not continuous monitoring.",
    canProve:
      "Which governed acts Hebun recorded for this organization — the act, the kind of entity, " +
      "the kind of actor, the result, the recording subsystem, the authority source and whether " +
      "the act was simulated.",
    cannotProve:
      "A security event, finding, incident, threat or breach. It records what authorized actors " +
      "did, so it evidences no intrusion; it is not forensically complete; and the number of acts " +
      "indicates nothing about whether this organization is secure.",
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

/**
 * Whether any source class is `connected` — i.e. this surface holds a legitimate tenant-scoped
 * read-only path to it and consumes that path.
 *
 * E2-2 REPAIRED THIS SENTENCE, NOT THIS FUNCTION. It used to say "a live security feed", which was
 * true while nothing was connected and would have become the surface's next false claim the moment
 * something was: a bounded request-time read of a governed ledger is not a feed, is not live, and
 * is not continuous monitoring. The computation is unchanged and still reads the map rather than
 * asserting an answer.
 *
 *     CONNECTED != LIVE FEED
 */
export function hasConnectedSecurityFeed(): boolean {
  return listSecuritySources().some((source) => source.state === "connected");
}
