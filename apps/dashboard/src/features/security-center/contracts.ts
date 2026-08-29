/*
 * security-center/contracts.ts — the typed FOUNDATION for Security Intelligence and the Security
 * Center product surface (UI Phase 19).
 *
 * The Security Center is a Governance Level-2 surface (route /director/governance/security) — NOT
 * a new top-level workspace. This is a FOUNDATION phase: discovery proved there is NO live security
 * event feed, NO incident model, NO threat/vulnerability feed, NO identity-anomaly feed, NO real
 * audit persistence, NO policy-evaluation runtime, NO correlation engine, and NO remediation
 * runtime in this repository (the governance/risk/audit surfaces are synthetic Phase-12 vocabulary;
 * device posture is the empty, disconnected Phase 18 registry). So Phase 19 declares the honest
 * security CONTRACT + STRUCTURAL VOCABULARY and NOTHING ELSE: no fabricated incident, finding,
 * signal, attacker, CVE, malware, risk score, timeline, or evidence. Every place populated security
 * data would appear renders an honest empty / not-connected state.
 *
 * Category discipline is mandatory. A degraded runtime is not an attack; authentication being
 * unavailable is not identity compromise; a device being unregistered is not an infected endpoint;
 * a provider being unavailable is not a breach. Signal ≠ incident, finding ≠ confirmed breach, risk
 * ≠ probability, recommendation ≠ action, prepared action ≠ authorized action.
 *
 * Security RESPONSE never bypasses the platform: any action becomes a Phase 17 PreparedAction
 * (capability → governance → authority → human review → eligibility → controlled invocation →
 * result validation), and any device response uses the disconnected Phase 18 Device Runtime — so
 * isolate/collect-evidence are NOT AVAILABLE and consequential responses REQUIRE HUMAN REVIEW.
 * There is no automatic remediation, no direct mutation, no shell/network/device control, no
 * secret, and no model. Builds on @/features/heby-integration, @/features/heby-actions, and
 * @/features/device-runtime WITHOUT modifying them.
 */

import type {
  HebyAuthorityMode,
  HebyEvidenceReference,
  HebyProvenanceFacet,
  HebyUncertaintyState,
} from "@/features/heby-integration";
import type { ToolSideEffectClass } from "@/features/heby-actions";

/* ===========================================================================
 * 1. SECURITY SOURCE CLASS + CONNECTION STATE
 *
 * Where a security signal WOULD come from, and the honest state of that path. Nothing is
 * `connected`: sources are `derived` (a real, non-authoritative technical state Hebun already
 * exposes) or `not-connected` (no live security feed exists).
 * ========================================================================= */

export type SecuritySourceClass =
  | "authentication"
  | "authorization"
  | "device"
  | "runtime"
  | "integration"
  | "provider"
  | "policy"
  | "audit"
  | "network"
  | "incident-feed";

export type SecuritySourceState = "connected" | "derived" | "not-connected";

export interface SecuritySourceStatus {
  readonly sourceClass: SecuritySourceClass;
  readonly state: SecuritySourceState;
  /** Whether this source can currently contribute anything real. Only "connected"/"derived". */
  readonly usable: boolean;
  readonly detail: string;
  /** What this source CAN honestly establish today (structural/derived truth). */
  readonly canProve: string;
  /** What this source CANNOT establish — the boundary against over-reading it as security proof. */
  readonly cannotProve: string;
}

/* ===========================================================================
 * 2. SIGNAL KIND (small, structural — no attack taxonomy theater)
 * ========================================================================= */

export type SecuritySignalKind =
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "DEVICE"
  | "RUNTIME"
  | "INTEGRATION"
  | "PROVIDER"
  | "POLICY"
  | "DATA_ACCESS"
  | "EXECUTION"
  | "CONFIGURATION"
  | "NETWORK"
  | "OTHER";

export const SECURITY_SIGNAL_KINDS: readonly SecuritySignalKind[] = Object.freeze([
  "AUTHENTICATION", "AUTHORIZATION", "DEVICE", "RUNTIME", "INTEGRATION", "PROVIDER",
  "POLICY", "DATA_ACCESS", "EXECUTION", "CONFIGURATION", "NETWORK", "OTHER",
]);

/* ===========================================================================
 * 3. SECURITY SIGNAL (contract-only — no instance is ever fabricated)
 * ========================================================================= */

export interface SecuritySignal {
  readonly signalId: string;
  readonly sourceClass: SecuritySourceClass;
  readonly sourceRef: string;
  readonly signalKind: SecuritySignalKind;
  /** A short, real, machine-derived state — never an inferred "attack". */
  readonly observedState: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly subjectRef?: string;
  readonly evidenceRefs: readonly HebyEvidenceReference[];
  readonly provenance: readonly string[];
  readonly uncertainty: HebyUncertaintyState;
  readonly sensitivity: SecuritySensitivity;
  readonly lifecycle: "settled" | "superseded" | "retired" | "unknown";
}

export type SecuritySensitivity = "low" | "moderate" | "high" | "restricted";

/* ===========================================================================
 * 4. SECURITY FINDING (derived interpretation over evidence — never a breach claim)
 * ========================================================================= */

export type SecurityFindingCategory =
  | "identity-access"
  | "device"
  | "platform-integration"
  | "runtime"
  | "policy-control"
  | "data-exposure"
  | "configuration";

/**
 * Conservative lifecycle. There is intentionally NO `CONFIRMED` state Heby can produce — confirming
 * a breach needs a real authority/evidence path that does not exist. A finding stays at most
 * SUPPORTED or REQUIRES_REVIEW.
 */
export type SecurityFindingStatus =
  | "UNVALIDATED"
  | "SUPPORTED"
  | "REQUIRES_REVIEW"
  | "DISMISSED"
  | "RESOLVED";

export const SECURITY_FINDING_STATUSES: readonly SecurityFindingStatus[] = Object.freeze([
  "UNVALIDATED", "SUPPORTED", "REQUIRES_REVIEW", "DISMISSED", "RESOLVED",
]);

export interface SecurityFinding {
  readonly findingId: string;
  readonly title: string;
  readonly category: SecurityFindingCategory;
  readonly status: SecurityFindingStatus;
  readonly relatedSignals: readonly string[];
  readonly evidenceRefs: readonly HebyEvidenceReference[];
  readonly provenance: readonly string[];
  readonly provenanceCovered: readonly HebyProvenanceFacet[];
  readonly uncertainty: HebyUncertaintyState;
  readonly affectedSubjects: readonly string[];
  readonly governanceContext: string;
  readonly recommendedReview: boolean;
  readonly lifecycle: "settled" | "superseded" | "retired" | "unknown";
}

/* ===========================================================================
 * 5. SECURITY RISK VOCABULARY (separate dimensions — no fabricated score)
 *
 * Risk class, likelihood, impact, severity, and priority are DISTINCT structural vocabularies. No
 * numeric score, percentage, or heatmap instance is produced — only the vocabulary is rendered.
 * ========================================================================= */

export type SecurityRiskClass = "informational" | "low" | "moderate" | "high" | "critical";
export type SecurityLikelihood = "unknown" | "unlikely" | "possible" | "likely";
export type SecurityImpact = "unknown" | "limited" | "significant" | "severe";
export type SecurityPriority = "deferred" | "standard" | "elevated" | "immediate";

export const SECURITY_RISK_CLASSES: readonly SecurityRiskClass[] = Object.freeze([
  "informational", "low", "moderate", "high", "critical",
]);

/* ===========================================================================
 * 6. RESPONSE OPTION (option ≠ action — every action routes through Phase 17/18)
 *
 * A response OPTION is a named, structural capability the Security Center can present. It is never
 * itself executable: its `disposition` states honestly whether Heby may advise/prepare it, whether
 * it requires human review, or whether it is not available (device-backed responses are Phase 18
 * disconnected). Its `sideEffect` is the Phase 17 class it would carry.
 * ========================================================================= */

export type SecurityResponseKind =
  | "INVESTIGATE_IDENTITY"
  | "REVIEW_DEVICE"
  | "PREPARE_REVIEW"
  | "RESTRICT_SESSION"
  | "REVOKE_CAPABILITY"
  | "BLOCK_CONNECTION"
  | "ISOLATE_DEVICE"
  | "COLLECT_EVIDENCE";

/** advisory — Heby may explain/prepare; requires-human-review — consequential; not-available — no runtime. */
export type SecurityResponseDisposition = "advisory" | "requires-human-review" | "not-available";

export interface SecurityResponseOption {
  readonly kind: SecurityResponseKind;
  readonly label: string;
  readonly sideEffect: ToolSideEffectClass;
  /** Whether this response would need the (disconnected) Phase 18 Device Runtime. */
  readonly deviceBacked: boolean;
  readonly disposition: SecurityResponseDisposition;
  readonly authorityRequirement: HebyAuthorityMode;
  readonly describes: string;
}

/* ===========================================================================
 * 7. INVESTIGATION INSPECTOR LENS
 * ========================================================================= */

export interface SecurityInspectorLens {
  readonly facet: string;
  readonly question: string;
}

/* ===========================================================================
 * 8. SECURITY STATE STRIP (honest, real/structural values only)
 * ========================================================================= */

export interface SecurityStateEntry {
  readonly label: string;
  readonly value: string;
  /** A color-independent status token; the UI must render text/icon, never color alone. */
  readonly status: "not-connected" | "not-available" | "derived" | "restricted" | "human-authority" | "none";
}

/* ===========================================================================
 * 8b. SIGNAL PIPELINE (the real Phase 19 flow, each stage's honest availability)
 *
 * A structural, derived-from-contracts view of how Hebun security actually works — never an
 * animated activity stream. Each stage carries a color-independent availability state so an
 * unavailable stage is visibly unavailable, not decorated.
 * ========================================================================= */

export type SecurityPipelineState =
  | "derived"
  | "none"
  | "not-connected"
  | "not-available"
  | "structural"
  | "human-authority"
  | "not-executable";

export interface SecurityPipelineStage {
  readonly stage: string;
  readonly label: string;
  readonly state: SecurityPipelineState;
  readonly detail: string;
}

/* ===========================================================================
 * 8c. SECURITY DOMAIN (domain STATUS surfaces — not fake agents)
 *
 * A domain is a status surface, never an "agent". Its state is honest: connected, derived,
 * not-connected, restricted, or none. Unknown / not-connected is NEVER rendered as healthy.
 *
 * E2-2 added `connected`, and it means exactly what it means for a source class: a legitimate
 * tenant-scoped read-only path exists and the surface consumes it on the request. It does NOT mean
 * the domain is healthy, monitored, or free of problems.
 * ========================================================================= */

export type SecurityDomainState =
  | "connected"
  | "derived"
  | "not-connected"
  | "restricted"
  | "none";

export interface SecurityDomainStatus {
  readonly domain: string;
  readonly label: string;
  readonly sourceClass: SecuritySourceClass;
  readonly state: SecurityDomainState;
  readonly detail: string;
}

/* ===========================================================================
 * 8c-bis. RECORDED-ACT OBSERVATION (E2-2 / S-B)
 *
 * The FIRST connected evidence this surface has ever carried, and the contract the Security Center
 * owns while the `governance-activity` projection fills it. The direction is deliberate and follows
 * E2-1: the consumer declares the shape, the side that owns the facts produces it.
 *
 * WHAT IT IS: governed acts Hebun itself recorded for this tenant, read through a bounded seam.
 * WHAT IT IS NOT: a security event feed, a finding, an incident, an alert, a threat, or a score.
 *
 *     AUDIT RECORD          != SECURITY EVENT
 *     AUTHORITATIVE RECORD  != AUTHORITATIVE OBSERVATION
 *     KNOWN EMPTY           != UNAVAILABLE
 *     ZERO RECORDED ACTS    != SECURE
 * ========================================================================= */

/**
 * The three outcomes, kept apart on purpose — collapsing any two is the failure E2-2 exists to
 * prevent. `unavailable` means Hebun could not look; `known-empty` means Hebun looked and the
 * ledger holds nothing for this tenant. Those are different sentences with different remedies.
 */
export type SecurityObservationState = "recorded" | "known-empty" | "unavailable";

/**
 * One recorded governed act, as this surface may show it.
 *
 * Eight fields, and every one of them is a fact the ledger recorded — none is inferred, graded or
 * reinterpreted. The ten withheld audit columns (`actorId`, `entityId`, `metadata`, the jsonb state
 * payloads, the correlation/causation/request/session ids and the principal hash) are absent by
 * construction: the released reader never selected them, so there is nothing here to redact.
 */
export interface SecurityRecordedAct {
  /** Logical time of the act, ISO-8601. The ordering key. */
  readonly occurredAt: string;
  /** The writer's own verb, e.g. `knowledge.ratify`. Never reinterpreted as an attack. */
  readonly action: string;
  /** What KIND of thing the act was about — never the id of one. */
  readonly entityType: string;
  /** A KIND of actor — never which person, and never an attacker. */
  readonly actorType: string;
  /** The ledger's own result. A `rejected` row is recorded history, not a security failure. */
  readonly result: string;
  /** Which subsystem recorded it. Null when unrecorded, and reported as null. */
  readonly source: string | null;
  /** One of four constrained values, nullable. `null` is reported, never hidden or guessed. */
  readonly authoritySource: string | null;
  /** True when recorded under a non-live posture, so no real effect occurred. */
  readonly simulation: boolean;
}

export interface SecurityRecordedActObservation {
  readonly sourceClass: "audit";
  readonly state: SecurityObservationState;
  /**
   * THE LITERAL `false`, not a boolean.
   *
   * `audit_log` is authoritative for recorded governed acts. This VIEW of it is recomputed per
   * request, persists nothing, owns no row and selects a shape — twenty of N rows, eight of
   * twenty-two columns. Typing it as the literal makes "mark the observation authoritative" a
   * compile error as well as a test failure.
   */
  readonly authoritative: false;
  /** The ledger boundary's own sentence, carried verbatim. This surface owns no provenance. */
  readonly provenance: string;
  /** What may NOT be concluded from this evidence, displayed beside it rather than assumed. */
  readonly limits: string;
  /** When the read ran. `null` when it could not run — never a substituted timestamp. */
  readonly generatedAt: string | null;
  /** The bounded page. Empty for `known-empty` AND for `unavailable`; the state tells them apart. */
  readonly acts: readonly SecurityRecordedAct[];
  /**
   * The INDEPENDENT total the page was measured against — `null` when the read could not run.
   * Never `acts.length`, and never `0` for a failed read.
   */
  readonly totalRecordedActs: number | null;
  /** Derived by the reader from the independent total. Never guessed here. */
  readonly truncated: boolean;
  /** The one honest sentence for why the read could not run, or `null` when it did. */
  readonly unavailableReason: string | null;
}

/* ===========================================================================
 * 8d. SECURITY ARCHITECTURE (Hebun ownership flow — real system names)
 * ========================================================================= */

export interface SecurityArchitectureLayer {
  readonly layer: string;
  readonly owner: string;
  /** The flow arrow label into the next layer (e.g. "evidence", "prepared action"). */
  readonly flowLabel: string;
  readonly describes: string;
}

/* ===========================================================================
 * 9. SECURITY CENTER PAGE MODEL
 *
 * Composes the whole surface from real/structural vocabulary + honest empties. `findings`,
 * `signals`, `incidents`, and `timeline` are ALWAYS empty — none is surfaced or fabricated.
 * ========================================================================= */

export interface SecurityCenterModel {
  readonly stateStrip: readonly SecurityStateEntry[];
  readonly sources: readonly SecuritySourceStatus[];
  readonly signalKinds: readonly SecuritySignalKind[];
  readonly findingStatuses: readonly SecurityFindingStatus[];
  readonly riskClasses: readonly SecurityRiskClass[];
  readonly responseOptions: readonly SecurityResponseOption[];
  readonly inspectorLenses: readonly SecurityInspectorLens[];
  readonly pipeline: readonly SecurityPipelineStage[];
  readonly domains: readonly SecurityDomainStatus[];
  readonly architecture: readonly SecurityArchitectureLayer[];
  /** Populated instances — ALWAYS empty: no finding, signal or incident authority exists. */
  readonly findings: readonly SecurityFinding[];
  readonly signals: readonly SecuritySignal[];
  readonly incidents: readonly never[];
  readonly timeline: readonly never[];
  /**
   * E2-2 — the tenant's recorded governed acts, read through the `governance-activity` projection.
   *
   * `null` means the composing surface supplied no observation on this request, which the region
   * renders as unavailable. It NEVER renders as empty: "nothing was read" and "nothing is recorded"
   * are different claims, and only the second is a statement about the organization.
   */
  readonly recordedActObservation: SecurityRecordedActObservation | null;
  /** Device security is read from the real, disconnected Phase 18 boundary. */
  readonly deviceSecurity: DeviceSecuritySummary;
}

/** A minimal, honest device-security summary derived from the Phase 18 boundary. */
export interface DeviceSecuritySummary {
  readonly runtimeConnected: boolean;
  readonly registeredDevices: number;
  readonly trustedDevices: number;
  readonly sensitiveCapabilitiesRestricted: boolean;
  readonly detail: string;
}
