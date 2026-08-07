/**
 * Heby Core — identity validation (Phase 1, Identity Foundation).
 *
 * Validates the STRUCTURAL and CONSTITUTIONAL integrity of a Heby identity: the fixed
 * name and role are exactly correct, the mission, philosophies, and relationships are
 * present, every principle group is well-formed and non-empty, and the capability,
 * non-responsibility, and non-identity sets are COMPLETE — every declared member present
 * exactly once, nothing unknown, nothing missing — and the capability set and the
 * non-responsibility set are disjoint. This is a plain, deterministic structural check —
 * NOT interface behaviour, NOT presentation, NOT runtime consumption, NOT a decision. It
 * is fail-closed: any missing, malformed, incomplete, or overlapping field blocks a valid
 * identity. Heby never operates against an identity that is not whole.
 */

import {
  HEBY_CAPABILITY_DESCRIPTORS,
  HEBY_NON_IDENTITY_DESCRIPTORS,
  HEBY_NON_RESPONSIBILITY_DESCRIPTORS,
  type HebyIdentity,
  type HebyPrincipleGroup,
  type HebyPrincipleKind,
} from "@/features/heby-core/heby-identity-types";
import {
  isHebyCapability,
  isHebyNonIdentity,
  isHebyNonResponsibility,
} from "@/features/heby-core/heby-identity-rules";

export type HebyIdentityValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

const HEBY_CANONICAL_NAME = "Heby";
const HEBY_CANONICAL_ROLE = "executive-intelligence-interface";

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Checks that a declared list is exactly the complete set of known members: every known
 * member present exactly once, no unknown member, no duplicate. Fail-closed and total.
 */
function collectCompletenessIssues(
  label: string,
  declared: readonly string[],
  known: readonly string[],
  isKnown: (value: string) => boolean,
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const value of declared) {
    if (!isKnown(value)) issues.push(`${label} declares unknown member '${value}'`);
    if (seen.has(value)) issues.push(`${label} declares '${value}' more than once`);
    seen.add(value);
  }
  for (const member of known) {
    if (!seen.has(member)) issues.push(`${label} is missing required member '${member}'`);
  }
}

/** Structural checks over one principle group. Appends any issues found. */
function collectPrincipleGroupIssues(
  expectedKind: HebyPrincipleKind,
  group: HebyPrincipleGroup,
  issues: string[],
): void {
  if (group.kind !== expectedKind) {
    issues.push(`${expectedKind} principles declare mismatched kind '${group.kind}'`);
  }
  if (group.statements.length === 0) {
    issues.push(`${expectedKind} principles declare no statements`);
  }
  for (const statement of group.statements) {
    if (!isNonEmpty(statement)) issues.push(`${expectedKind} principles declare an empty statement`);
  }
}

/**
 * Validates a Heby identity: exact name and role; present mission, approval philosophy,
 * Runtime relationship, and Director relationship; well-formed, non-empty communication,
 * transparency, and governance principle groups; complete and duplicate-free capability,
 * non-responsibility, and non-identity sets; and a capability/non-responsibility set that
 * are disjoint. Fail-closed: any issue blocks a valid identity.
 */
export function validateHebyIdentity(identity: HebyIdentity): HebyIdentityValidation {
  const issues: string[] = [];

  if (!isNonEmpty(identity.identity)) issues.push("identity declares no identity handle");
  if (identity.name !== HEBY_CANONICAL_NAME) {
    issues.push(`identity declares non-canonical name '${identity.name}'`);
  }
  if (identity.role !== HEBY_CANONICAL_ROLE) {
    issues.push(`identity declares non-canonical role '${identity.role}'`);
  }
  if (!isNonEmpty(identity.mission)) issues.push("identity declares no mission");
  if (!isNonEmpty(identity.approvalPhilosophy)) issues.push("identity declares no approval philosophy");
  if (!isNonEmpty(identity.runtimeRelationship)) issues.push("identity declares no Runtime relationship");
  if (!isNonEmpty(identity.directorRelationship)) {
    issues.push("identity declares no Director relationship");
  }

  collectPrincipleGroupIssues("communication", identity.communicationPrinciples, issues);
  collectPrincipleGroupIssues("transparency", identity.transparencyPrinciples, issues);
  collectPrincipleGroupIssues("governance", identity.governancePrinciples, issues);

  collectCompletenessIssues(
    "capabilities",
    identity.capabilities,
    Object.keys(HEBY_CAPABILITY_DESCRIPTORS),
    isHebyCapability,
    issues,
  );
  collectCompletenessIssues(
    "non-responsibilities",
    identity.nonResponsibilities,
    Object.keys(HEBY_NON_RESPONSIBILITY_DESCRIPTORS),
    isHebyNonResponsibility,
    issues,
  );
  collectCompletenessIssues(
    "non-identities",
    identity.nonIdentities,
    Object.keys(HEBY_NON_IDENTITY_DESCRIPTORS),
    isHebyNonIdentity,
    issues,
  );

  // The MAY set and the MUST-NEVER set must never collide: no capability name may also
  // be declared as a non-responsibility. Presentational and prohibited stay disjoint.
  const nonResponsibilityNames = new Set<string>(identity.nonResponsibilities);
  for (const capability of identity.capabilities) {
    if (nonResponsibilityNames.has(capability)) {
      issues.push(`capability '${capability}' also appears as a non-responsibility`);
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical identity is deep-frozen: the identity object, its principle
 * groups and their statement lists, and its capability, non-responsibility, and
 * non-identity lists are all immutable. Defensive, post-normalization, and fail-closed.
 */
export function verifyHebyIdentityFrozen(identity: HebyIdentity): HebyIdentityValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(identity)) issues.push("identity is not frozen");
  for (const group of [
    identity.communicationPrinciples,
    identity.transparencyPrinciples,
    identity.governancePrinciples,
  ]) {
    if (!Object.isFrozen(group)) issues.push(`${group.kind} principles are not frozen`);
    if (!Object.isFrozen(group.statements)) issues.push(`${group.kind} principle statements are not frozen`);
  }
  if (!Object.isFrozen(identity.capabilities)) issues.push("capabilities are not frozen");
  if (!Object.isFrozen(identity.nonResponsibilities)) issues.push("non-responsibilities are not frozen");
  if (!Object.isFrozen(identity.nonIdentities)) issues.push("non-identities are not frozen");

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
