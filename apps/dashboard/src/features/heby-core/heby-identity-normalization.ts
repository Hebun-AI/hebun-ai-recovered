/**
 * Heby Core — identity normalization (Phase 1, Identity Foundation).
 *
 * Deterministically canonicalizes a Heby identity:
 *   - capabilities, non-responsibilities, and non-identities are de-duplicated and
 *     totally ordered by their fixed canonical ordinal,
 *   - each principle group's statements are de-duplicated and totally ordered,
 *   - name, role, mission, philosophies, and relationships are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole identity is emitted immutable and deep-frozen.
 *
 * This is pure canonical normalization — NO interface behaviour, NO presentation, NO
 * runtime consumption, NO mutation of any preserved value. Ordering and de-duplication
 * happen by canonical ordinal or by text key only. Keys use JSON encoding so they are
 * unambiguous, text-safe, UTF-8 stable, and NUL-safe. Normalization is idempotent: the
 * canonical form of a canonical identity is itself.
 */

import {
  type CanonicalHebyIdentity,
  type HebyCapability,
  type HebyIdentity,
  type HebyNonIdentity,
  type HebyNonResponsibility,
  type HebyPrincipleGroup,
  type HebyStatement,
} from "@/features/heby-core/heby-identity-types";
import {
  hebyCapabilityOrder,
  hebyNonIdentityOrder,
  hebyNonResponsibilityOrder,
} from "@/features/heby-core/heby-identity-rules";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders capabilities by their fixed canonical ordinal. */
export function normalizeHebyCapabilities(
  capabilities: readonly HebyCapability[],
): readonly HebyCapability[] {
  const seen = new Set<HebyCapability>();
  for (const capability of capabilities) seen.add(capability);
  return [...seen].sort((left, right) => hebyCapabilityOrder(left) - hebyCapabilityOrder(right));
}

/** De-duplicates and totally orders non-responsibilities by their fixed canonical ordinal. */
export function normalizeHebyNonResponsibilities(
  nonResponsibilities: readonly HebyNonResponsibility[],
): readonly HebyNonResponsibility[] {
  const seen = new Set<HebyNonResponsibility>();
  for (const nonResponsibility of nonResponsibilities) seen.add(nonResponsibility);
  return [...seen].sort(
    (left, right) => hebyNonResponsibilityOrder(left) - hebyNonResponsibilityOrder(right),
  );
}

/** De-duplicates and totally orders non-identities by their fixed canonical ordinal. */
export function normalizeHebyNonIdentities(
  nonIdentities: readonly HebyNonIdentity[],
): readonly HebyNonIdentity[] {
  const seen = new Set<HebyNonIdentity>();
  for (const nonIdentity of nonIdentities) seen.add(nonIdentity);
  return [...seen].sort((left, right) => hebyNonIdentityOrder(left) - hebyNonIdentityOrder(right));
}

/** De-duplicates and totally orders a set of principle statements. */
export function normalizeHebyStatements(
  statements: readonly HebyStatement[],
): readonly HebyStatement[] {
  const seen = new Set<HebyStatement>();
  for (const statement of statements) seen.add(statement);
  return [...seen].sort(compareStrings);
}

/** Canonicalizes a principle group: its kind carried UNCHANGED, its statements ordered. Frozen. */
export function normalizeHebyPrincipleGroup(group: HebyPrincipleGroup): HebyPrincipleGroup {
  return Object.freeze({
    kind: group.kind,
    statements: Object.freeze(normalizeHebyStatements(group.statements)),
  });
}

/** An unambiguous, text-safe key for a principle group. */
export function hebyPrincipleGroupKey(group: HebyPrincipleGroup): string {
  return JSON.stringify([group.kind, normalizeHebyStatements(group.statements)]);
}

/**
 * Canonicalizes a Heby identity into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical identity, and the
 * canonical form of a canonical identity is itself. Capabilities, non-responsibilities,
 * and non-identities are ordered by ordinal; principle statements are ordered; name, role,
 * mission, philosophies, and relationships are carried UNCHANGED.
 */
export function normalizeHebyIdentity(identity: HebyIdentity): CanonicalHebyIdentity {
  return Object.freeze({
    identity: identity.identity,
    name: identity.name,
    role: identity.role,
    mission: identity.mission,
    communicationPrinciples: normalizeHebyPrincipleGroup(identity.communicationPrinciples),
    transparencyPrinciples: normalizeHebyPrincipleGroup(identity.transparencyPrinciples),
    governancePrinciples: normalizeHebyPrincipleGroup(identity.governancePrinciples),
    approvalPhilosophy: identity.approvalPhilosophy,
    runtimeRelationship: identity.runtimeRelationship,
    directorRelationship: identity.directorRelationship,
    capabilities: Object.freeze(normalizeHebyCapabilities(identity.capabilities)),
    nonResponsibilities: Object.freeze(normalizeHebyNonResponsibilities(identity.nonResponsibilities)),
    nonIdentities: Object.freeze(normalizeHebyNonIdentities(identity.nonIdentities)),
  });
}

/**
 * A canonical, text-safe key for a whole identity: every declared field in canonical
 * form. The same identity always produces the same key; two identities with the same
 * canonical form produce equal keys. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyIdentityKey(identity: HebyIdentity): string {
  return JSON.stringify([
    identity.identity,
    identity.name,
    identity.role,
    identity.mission,
    hebyPrincipleGroupKey(identity.communicationPrinciples),
    hebyPrincipleGroupKey(identity.transparencyPrinciples),
    hebyPrincipleGroupKey(identity.governancePrinciples),
    identity.approvalPhilosophy,
    identity.runtimeRelationship,
    identity.directorRelationship,
    normalizeHebyCapabilities(identity.capabilities),
    normalizeHebyNonResponsibilities(identity.nonResponsibilities),
    normalizeHebyNonIdentities(identity.nonIdentities),
  ]);
}
