/**
 * Heby Core — identity rules (Phase 1, Identity Foundation).
 *
 * Pure, deterministic lookups and projections over Heby's capability, non-responsibility,
 * and non-identity descriptor tables, and the canonical ordinals used to order them. These
 * answer plain questions — is this a known capability, what is its canonical order, is
 * this string a declared non-responsibility — and expose the complete, canonically ordered
 * descriptor lists. NO interface behaviour, NO presentation, NO runtime consumption, NO
 * decision, NO AI, NO mutation — only table reads and pure, repeatable projections.
 */

import {
  HEBY_CAPABILITY_DESCRIPTORS,
  HEBY_NON_IDENTITY_DESCRIPTORS,
  HEBY_NON_RESPONSIBILITY_DESCRIPTORS,
  type HebyCapability,
  type HebyCapabilityDescriptor,
  type HebyNonIdentity,
  type HebyNonIdentityDescriptor,
  type HebyNonResponsibility,
  type HebyNonResponsibilityDescriptor,
} from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared Heby capability. Read-only table check. */
export function isHebyCapability(value: string): value is HebyCapability {
  return Object.prototype.hasOwnProperty.call(HEBY_CAPABILITY_DESCRIPTORS, value);
}

/** True when a string is a declared Heby non-responsibility. Read-only table check. */
export function isHebyNonResponsibility(value: string): value is HebyNonResponsibility {
  return Object.prototype.hasOwnProperty.call(HEBY_NON_RESPONSIBILITY_DESCRIPTORS, value);
}

/** True when a string is a declared Heby non-identity. Read-only table check. */
export function isHebyNonIdentity(value: string): value is HebyNonIdentity {
  return Object.prototype.hasOwnProperty.call(HEBY_NON_IDENTITY_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a capability. Read-only projection. */
export function hebyCapabilityDescriptorOf(capability: HebyCapability): HebyCapabilityDescriptor {
  return HEBY_CAPABILITY_DESCRIPTORS[capability];
}

/** The canonical descriptor for a non-responsibility. Read-only projection. */
export function hebyNonResponsibilityDescriptorOf(
  nonResponsibility: HebyNonResponsibility,
): HebyNonResponsibilityDescriptor {
  return HEBY_NON_RESPONSIBILITY_DESCRIPTORS[nonResponsibility];
}

/** The canonical descriptor for a non-identity. Read-only projection. */
export function hebyNonIdentityDescriptorOf(nonIdentity: HebyNonIdentity): HebyNonIdentityDescriptor {
  return HEBY_NON_IDENTITY_DESCRIPTORS[nonIdentity];
}

// --- Canonical ordinals ------------------------------------------------------

/** The fixed canonical order of a capability. Ordinal only — not a score. */
export function hebyCapabilityOrder(capability: HebyCapability): number {
  return HEBY_CAPABILITY_DESCRIPTORS[capability].order;
}

/** The fixed canonical order of a non-responsibility. Ordinal only — not a score. */
export function hebyNonResponsibilityOrder(nonResponsibility: HebyNonResponsibility): number {
  return HEBY_NON_RESPONSIBILITY_DESCRIPTORS[nonResponsibility].order;
}

/** The fixed canonical order of a non-identity. Ordinal only — not a score. */
export function hebyNonIdentityOrder(nonIdentity: HebyNonIdentity): number {
  return HEBY_NON_IDENTITY_DESCRIPTORS[nonIdentity].order;
}

// --- Complete canonical lists ------------------------------------------------

/**
 * Every declared capability, in canonical order. Derived deterministically from the
 * descriptor table; the same table always yields the same list.
 */
export function allHebyCapabilities(): readonly HebyCapability[] {
  return (Object.keys(HEBY_CAPABILITY_DESCRIPTORS) as HebyCapability[]).sort(
    (left, right) => hebyCapabilityOrder(left) - hebyCapabilityOrder(right),
  );
}

/** Every declared non-responsibility, in canonical order. Deterministic. */
export function allHebyNonResponsibilities(): readonly HebyNonResponsibility[] {
  return (Object.keys(HEBY_NON_RESPONSIBILITY_DESCRIPTORS) as HebyNonResponsibility[]).sort(
    (left, right) => hebyNonResponsibilityOrder(left) - hebyNonResponsibilityOrder(right),
  );
}

/** Every declared non-identity, in canonical order. Deterministic. */
export function allHebyNonIdentities(): readonly HebyNonIdentity[] {
  return (Object.keys(HEBY_NON_IDENTITY_DESCRIPTORS) as HebyNonIdentity[]).sort(
    (left, right) => hebyNonIdentityOrder(left) - hebyNonIdentityOrder(right),
  );
}
