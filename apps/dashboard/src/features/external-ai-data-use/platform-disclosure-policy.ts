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
 * ── RELEASE A: NO ALLOWED CELL CAN BE RECORDED ──────────────────────────────
 *
 * The recorded policy declares `allowedCells: readonly never[]`. That is a statement about the TYPE,
 * not an observation that the list happens to be empty: adding an ALLOW requires changing this
 * declaration, which is the reviewed B1 admission step. Tests may inject a policy of the wider type
 * to exercise the logic; no runtime caller passes one.
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

/**
 * THE RECORDED POLICY.
 *
 * Both Higgsfield scopes are DENIED for every purpose and data class; the runtime integration and
 * its own disabled root controls are left exactly as they are. Anthropic and OpenAI have no cell:
 * they are UNKNOWN until account-specific evidence is admitted (B1).
 */
export const RECORDED_PLATFORM_DISCLOSURE_POLICY: {
  readonly deniedServiceScopes: readonly DeniedServiceScope[];
  readonly allowedCells: readonly never[];
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
  allowedCells: Object.freeze([]) as readonly never[],
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
