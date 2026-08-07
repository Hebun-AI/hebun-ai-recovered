/**
 * Heby Core — intent rules (Phase 5, Intent and Natural-Language Interaction).
 *
 * Pure, deterministic lookups and projections over the interpretation-disposition table,
 * the grounded element identities an intent may route to, and the capability boundary an
 * interpretation must stay within. These answer plain questions — is this a known
 * disposition, does this capability belong to Heby's identity, which elements are grounded —
 * and never call a model, trust model output, reason, decide, or mutate anything. Only table
 * reads and pure, repeatable projections. Ordinals order dispositions for stable arrangement
 * only; they are never a rank, score, priority, or recommendation.
 */

import {
  HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS,
  type HebyInterpretationDisposition,
  type HebyInterpretationDispositionDescriptor,
} from "@/features/heby-core/heby-intent-types";
import type { CanonicalHebyIdentity, HebyCapability, HebyId } from "@/features/heby-core/heby-identity-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared interpretation disposition. Read-only table check. */
export function isHebyInterpretationDisposition(value: string): value is HebyInterpretationDisposition {
  return Object.prototype.hasOwnProperty.call(HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for an interpretation disposition. Read-only projection. */
export function hebyInterpretationDispositionDescriptorOf(
  disposition: HebyInterpretationDisposition,
): HebyInterpretationDispositionDescriptor {
  return HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS[disposition];
}

/** The fixed canonical order of an interpretation disposition. Ordinal only — not a rank. */
export function hebyInterpretationDispositionOrder(disposition: HebyInterpretationDisposition): number {
  return HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS[disposition].order;
}

// --- Capability boundary -----------------------------------------------------

/**
 * True when a requested capability belongs to Heby's declared identity capabilities (the MAY
 * set). An interpretation may never expand Heby's authority: a capability outside the
 * identity — or a non-responsibility masquerading as one — is not within the identity.
 */
export function isHebyCapabilityWithinIdentity(
  capability: HebyCapability,
  identity: CanonicalHebyIdentity,
): boolean {
  return identity.capabilities.includes(capability);
}

// --- Grounded routing targets ------------------------------------------------

/**
 * The set of grounded element identities an interpretation may route to. Only grounded
 * elements are routable — never withheld ones. Read-only projection.
 */
export function hebyGroundedElementIdSet(
  grounded: HebyGroundedPresentation,
): ReadonlySet<HebyId> {
  const ids = new Set<HebyId>();
  for (const element of grounded.groundedElements) ids.add(element.elementId);
  return ids;
}

/**
 * True when every routed reference is a grounded element identity — the interpretation is
 * routed only to grounded, bounded presentation. Fail-closed: an empty routing, or any
 * reference that is not a grounded element, is not routable.
 */
export function hebyRoutesToGrounded(
  routedElementRefs: readonly HebyId[],
  groundedIds: ReadonlySet<HebyId>,
): boolean {
  if (routedElementRefs.length === 0) return false;
  for (const ref of routedElementRefs) {
    if (!groundedIds.has(ref)) return false;
  }
  return true;
}

// --- Complete canonical list -------------------------------------------------

/** Every declared interpretation disposition, in canonical order. Deterministic. */
export function allHebyInterpretationDispositions(): readonly HebyInterpretationDisposition[] {
  return (Object.keys(HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS) as HebyInterpretationDisposition[]).sort(
    (left, right) => hebyInterpretationDispositionOrder(left) - hebyInterpretationDispositionOrder(right),
  );
}
