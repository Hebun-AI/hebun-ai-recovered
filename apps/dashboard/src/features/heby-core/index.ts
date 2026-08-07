/**
 * Heby Core — public barrel (Phase 1, Identity Foundation).
 *
 * The single public surface of Heby Core. It re-exports the identity contracts, rules,
 * normalization, validation, and boundary of Phase 1 — Heby's immutable identity — and
 * nothing else. There is no interface behaviour, no presentation, no runtime consumption,
 * no AI, and no execution here. Later Heby phases consume this identity; none may redefine it.
 */

export {
  HEBY_CAPABILITY_DESCRIPTORS,
  HEBY_NON_IDENTITY_DESCRIPTORS,
  HEBY_NON_RESPONSIBILITY_DESCRIPTORS,
} from "@/features/heby-core/heby-identity-types";
export type {
  CanonicalHebyIdentity,
  HebyCapability,
  HebyCapabilityDescriptor,
  HebyId,
  HebyIdentity,
  HebyName,
  HebyNonIdentity,
  HebyNonIdentityDescriptor,
  HebyNonResponsibility,
  HebyNonResponsibilityDescriptor,
  HebyPrincipleGroup,
  HebyPrincipleKind,
  HebyRole,
  HebyStatement,
} from "@/features/heby-core/heby-identity-types";

export {
  allHebyCapabilities,
  allHebyNonIdentities,
  allHebyNonResponsibilities,
  hebyCapabilityDescriptorOf,
  hebyCapabilityOrder,
  hebyNonIdentityDescriptorOf,
  hebyNonIdentityOrder,
  hebyNonResponsibilityDescriptorOf,
  hebyNonResponsibilityOrder,
  isHebyCapability,
  isHebyNonIdentity,
  isHebyNonResponsibility,
} from "@/features/heby-core/heby-identity-rules";

export {
  canonicalHebyIdentityKey,
  hebyPrincipleGroupKey,
  normalizeHebyCapabilities,
  normalizeHebyIdentity,
  normalizeHebyNonIdentities,
  normalizeHebyNonResponsibilities,
  normalizeHebyPrincipleGroup,
  normalizeHebyStatements,
} from "@/features/heby-core/heby-identity-normalization";

export {
  validateHebyIdentity,
  verifyHebyIdentityFrozen,
} from "@/features/heby-core/heby-identity-validation";
export type { HebyIdentityValidation } from "@/features/heby-core/heby-identity-validation";

export {
  CANONICAL_HEBY_IDENTITY,
  HEBY_CAPABILITIES,
  HEBY_NON_RESPONSIBILITIES,
  resolveCanonicalHebyIdentity,
  resolveHebyIdentity,
} from "@/features/heby-core/heby-identity-boundary";
export type { HebyIdentityResult } from "@/features/heby-core/heby-identity-boundary";
