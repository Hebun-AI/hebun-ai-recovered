/*
 * external-ai-data-use/platform-disclosure-policy.ts — MAY HEBUN OFFER THIS EXTERNAL PROCESSING AT
 * ALL? (EXTERNAL-AI-DATA-USE-1A)
 *
 * PURE. No I/O, no clock.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ────────────────────────────────────────
 *
 * Platform acceptability, decided by the Director through a reviewed code change — the same kind of
 * authority as the media data-use guard (DATA-USE-MEDIA-GUARD-1). It is NOT tenant authorization (that
 * is Governance's, per organization) and NOT a processor attestation (that is a root row describing
 * one reviewed account). An ALLOWED cell says only that Hebun may OFFER a processing combination to
 * an organization whose own Governance then decides.
 *
 * The decision is closed: a cell is `denied`, `allowed`, or — when nothing is recorded — `unknown`,
 * and `unknown` refuses exactly as `denied` does. No wildcard, no default-allow.
 *
 * ── B1D: THE FIRST ALLOWED CELLS, AND NO ROOM FOR A FOURTH ─────────────────
 *
 * Release A declared `allowedCells: readonly never[]`. EXTERNAL-AI-DATA-USE-B1D (Director, 2026-10-04)
 * widens that declaration by exactly three cells — `anthropic/messages` × `assistance` ×
 * {`conversation`, `knowledge`, `work-artifact`} — under one set of bounds. The recorded policy's TYPE
 * still names those three and nothing else (`RecordedAllowedCell`): a fourth cell, another purpose or
 * another scope is a reviewed type change, not a list edit. Tests may inject a policy of the wider
 * type to exercise the logic; no runtime caller passes one.
 *
 * An ALLOWED cell is platform acceptability only. It authorizes no tenant (Governance does that, per
 * organization) and nothing at runtime consults this policy yet (B2). It is NOT a claim that the
 * conversation, Knowledge or work-artifact text that would cross is free of personal data.
 *
 * ── WHERE MEDIA STANDS ──────────────────────────────────────────────────────
 *
 * Media generation is still enforced ONLY by the media data-use guard (DATA-USE-MEDIA-GUARD-1). This module is not
 * wired to any media path. The two do not overlap in enforcement; folding the media guard into this
 * policy belongs to the media gate, where its one OpenAI row must be re-decided under attestation.
 */
import {
  CONTRACT_SURFACES,
  IDENTITY_STATUSES,
  RETENTION_CLASSES,
  TRAINING_TREATMENTS,
  rankOf,
  type ContractSurface,
  type DataClass,
  type IdentityStatus,
  type Purpose,
  type RetentionClass,
  type ServiceScope,
  type TrainingTreatment,
  type ZdrState,
} from "./contracts";

/** The treatment an ALLOWED cell requires of the attestation in force. Every bound must hold. */
export interface PlatformTreatmentBounds {
  readonly maxTraining: TrainingTreatment;
  readonly maxRetention: RetentionClass;
  readonly contractSurfaces: readonly ContractSurface[];
  readonly minimumIdentity: IdentityStatus;
  readonly zdrRequired: boolean;
}

export interface DeniedServiceScope {
  readonly serviceScope: ServiceScope;
  readonly decision: "denied";
  /** Where the Director decided it. A row without evidence does not belong here. */
  readonly evidence: string;
}

export interface AllowedPlatformCell {
  readonly serviceScope: ServiceScope;
  readonly purpose: Purpose;
  readonly dataClass: DataClass;
  readonly decision: "allowed";
  readonly bounds: PlatformTreatmentBounds;
  readonly evidence: string;
}

export interface PlatformDisclosurePolicy {
  readonly deniedServiceScopes: readonly DeniedServiceScope[];
  readonly allowedCells: readonly AllowedPlatformCell[];
}

const HIGGSFIELD_DENIAL_EVIDENCE =
  "EXTERNAL-AI-DATA-USE-PROVIDER-FACTS (Director, 2026-10-04): Higgsfield Terms of Use §4.4 let Higgsfield train on inputs and outputs unless a qualifying Enterprise Agreement exists; none is proven for Hebun.";

/** The only cells the recorded policy can hold. Widening any member is a reviewed type change. */
export type RecordedAllowedCell = AllowedPlatformCell & { readonly serviceScope: "anthropic/messages" } & (
  | { readonly purpose: "assistance"; readonly dataClass: "conversation" | "knowledge" | "work-artifact" }
  /* APF-3 — origination's narrow projection: the human goal and the organization's structure. */
  | { readonly purpose: "agent-origination"; readonly dataClass: "conversation" | "organization" }
);

/**
 * The bounds every B1D cell requires of the Anthropic attestation in force. The admitted B1C
 * attestation (revision 1: anthropic-commercial-terms, training none, bounded-30-days, attested,
 * ZDR not enabled) sits inside them; an attestation that widens past any bound stops satisfying the
 * cell, and the resolver and the tenant writer refuse.
 */
export const ANTHROPIC_ASSISTANCE_BOUNDS: PlatformTreatmentBounds = Object.freeze({
  contractSurfaces: Object.freeze(["anthropic-commercial-terms"] as const),
  maxTraining: "none",
  maxRetention: "bounded-30-days",
  minimumIdentity: "attested",
  zdrRequired: false,
} as const);

const ANTHROPIC_ASSISTANCE_ALLOW_EVIDENCE =
  "EXTERNAL-AI-DATA-USE-B1D (Director, 2026-10-04): platform ALLOW for anthropic/messages × assistance × {conversation, knowledge, work-artifact} only, bound to processor attestation ffb0c160-4082-4c7f-be6a-05a4d990c598 (revision 1, admitted B1C, identity_status attested — not verified) and its reviewed record docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md@dbbe8a30bbaa2d6d396cb914a21e28735537fe33. Unverified at decision: production credential ↔ observed Dashboard key equality; custom agreement / BAA status; per-request processing geography. Free text is not claimed free of personal data.";

const ANTHROPIC_ORIGINATION_ALLOW_EVIDENCE =
  "APF-3 (Director, 2026-10-06): platform ALLOW for anthropic/messages × agent-origination × {conversation, organization} only — the authenticated human goal and the organization's structure (organization-level availability, department slugs and names), as rendered by the narrow origination projection released in 7c2ed6d3. Same bounds and the same processor attestation as the assistance cells: ffb0c160-4082-4c7f-be6a-05a4d990c598 (revision 1, identity_status attested — not verified), reviewed record docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md@dbbe8a30bbaa2d6d396cb914a21e28735537fe33. Not allowed for origination: external-recipient, work-artifact, provider-observation and every other class. Unverified at decision: production credential ↔ observed Dashboard key equality; custom agreement / BAA status; per-request processing geography; the runtime does not check the configured model against the attestation's model_ids. Free text (the goal, department names) is not claimed free of personal data.";

function anthropicOriginationCell(dataClass: "conversation" | "organization"): RecordedAllowedCell {
  return Object.freeze({
    serviceScope: "anthropic/messages",
    purpose: "agent-origination",
    dataClass,
    decision: "allowed",
    bounds: ANTHROPIC_ASSISTANCE_BOUNDS,
    evidence: ANTHROPIC_ORIGINATION_ALLOW_EVIDENCE,
  } as const);
}

function anthropicAssistanceCell(dataClass: "conversation" | "knowledge" | "work-artifact"): RecordedAllowedCell {
  return Object.freeze({
    serviceScope: "anthropic/messages",
    purpose: "assistance",
    dataClass,
    decision: "allowed",
    bounds: ANTHROPIC_ASSISTANCE_BOUNDS,
    evidence: ANTHROPIC_ASSISTANCE_ALLOW_EVIDENCE,
  } as const);
}

/**
 * THE RECORDED POLICY.
 *
 * Both Higgsfield scopes are DENIED for every purpose and data class; the runtime integration and
 * its own disabled root controls are left exactly as they are. Anthropic is ALLOWED for the three
 * B1D cells and UNKNOWN for every other purpose and data class. OpenAI has no cell: UNKNOWN.
 */
export const RECORDED_PLATFORM_DISCLOSURE_POLICY: {
  readonly deniedServiceScopes: readonly DeniedServiceScope[];
  readonly allowedCells: readonly RecordedAllowedCell[];
} = Object.freeze({
  deniedServiceScopes: Object.freeze([
    Object.freeze({
      serviceScope: "higgsfield/pixverse-v6/text-to-video",
      decision: "denied",
      evidence: HIGGSFIELD_DENIAL_EVIDENCE,
    } as const),
    Object.freeze({
      serviceScope: "higgsfield/pixverse-v6/image-to-video",
      decision: "denied",
      evidence: HIGGSFIELD_DENIAL_EVIDENCE,
    } as const),
  ]),
  allowedCells: Object.freeze([
    anthropicAssistanceCell("conversation"),
    anthropicAssistanceCell("knowledge"),
    anthropicAssistanceCell("work-artifact"),
    anthropicOriginationCell("conversation"),
    anthropicOriginationCell("organization"),
  ]),
});

export type PlatformDisclosureVerdict =
  | { readonly decision: "denied"; readonly basis: string }
  | { readonly decision: "unknown"; readonly basis: string }
  | { readonly decision: "allowed"; readonly basis: string; readonly bounds: PlatformTreatmentBounds };

export function decidePlatformDisclosure(
  cell: { readonly serviceScope: ServiceScope; readonly purpose: Purpose; readonly dataClass: DataClass },
  policy: PlatformDisclosurePolicy = RECORDED_PLATFORM_DISCLOSURE_POLICY,
): PlatformDisclosureVerdict {
  /* A denied scope wins over any cell naming it. */
  const denied = policy.deniedServiceScopes.find((d) => d.serviceScope === cell.serviceScope);
  if (denied) return { decision: "denied", basis: denied.evidence };

  const allowed = policy.allowedCells.find(
    (c) => c.serviceScope === cell.serviceScope && c.purpose === cell.purpose && c.dataClass === cell.dataClass,
  );
  if (!allowed) {
    return { decision: "unknown", basis: "no recorded platform decision for this service scope, purpose and data class" };
  }
  return { decision: "allowed", basis: allowed.evidence, bounds: allowed.bounds };
}

/** The treatment fields an attestation must carry for a bound to be checked. */
export interface AttestationTreatment {
  readonly identityStatus: IdentityStatus;
  readonly contractSurface: ContractSurface;
  readonly training: TrainingTreatment;
  readonly retentionClass: RetentionClass;
  readonly zdr: ZdrState;
}

/** Does the attestation sit inside EVERY bound? Lower rank is narrower. */
export function attestationSatisfiesBounds(
  attestation: AttestationTreatment,
  bounds: PlatformTreatmentBounds,
): boolean {
  if (!CONTRACT_SURFACES.includes(attestation.contractSurface)) return false;
  if (!bounds.contractSurfaces.includes(attestation.contractSurface)) return false;
  if (rankOf(TRAINING_TREATMENTS, attestation.training) > rankOf(TRAINING_TREATMENTS, bounds.maxTraining)) return false;
  if (rankOf(RETENTION_CLASSES, attestation.retentionClass) > rankOf(RETENTION_CLASSES, bounds.maxRetention)) {
    return false;
  }
  if (rankOf(IDENTITY_STATUSES, attestation.identityStatus) > rankOf(IDENTITY_STATUSES, bounds.minimumIdentity)) {
    return false;
  }
  if (bounds.zdrRequired && attestation.zdr !== "enabled") return false;
  return true;
}
