import {
  copy,
  deepFreeze,
  hasOnlyKeys,
  immutableData,
  inert,
  validEffectivePeriod,
  validLifecycle,
  validMetadata,
  validProvenance,
  validText,
  type MetadataValue,
  type OrganizationalEffectivePeriod,
  type OrganizationalLifecycle,
  type OrganizationalProvenance,
} from "./validation";

export const ORGANIZATIONAL_RELATIONSHIP_VERSION = "organizational-relationship/v1";
export const ORGANIZATIONAL_RELATIONSHIP_TYPES = [
  "MEMBER_OF", "FILLS_ROLE", "RESPONSIBLE_FOR", "ASSIGNED_TO", "REPORTS_TO",
  "HAS_CAPABILITY", "DELEGATES_TO", "REPRESENTS", "PARENT_OF", "OWNS",
] as const;
export const ORGANIZATIONAL_REFERENCE_TYPES = [
  "WORKSPACE", "ORGANIZATION", "ORGANIZATIONAL_UNIT", "ACTOR", "ROLE", "RESPONSIBILITY", "CAPABILITY", "LEGAL_ENTITY",
] as const;
export const ORGANIZATIONAL_RELATIONSHIP_ERROR_CODES = [
  "INVALID_RELATIONSHIP", "INVALID_RELATIONSHIP_ID", "INVALID_RELATIONSHIP_TYPE",
  "INVALID_SOURCE_REFERENCE", "INVALID_TARGET_REFERENCE", "SELF_RELATIONSHIP",
  "WORKSPACE_MISMATCH", "ORGANIZATION_MISMATCH", "INVALID_EFFECTIVE_PERIOD",
  "INVALID_LIFECYCLE", "INVALID_PROVENANCE", "INVALID_METADATA", "IMMUTABILITY_VIOLATION",
] as const;

export type OrganizationalRelationshipType = (typeof ORGANIZATIONAL_RELATIONSHIP_TYPES)[number];
export type OrganizationalReferenceType = (typeof ORGANIZATIONAL_REFERENCE_TYPES)[number];
export type OrganizationalRelationshipErrorCode = (typeof ORGANIZATIONAL_RELATIONSHIP_ERROR_CODES)[number];

export interface OrganizationalReference {
  readonly referenceType: OrganizationalReferenceType;
  readonly referenceId: string;
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly executable: false;
  readonly authoritative: false;
}

/** A canonical graph edge descriptor. It provides no traversal or graph behavior. */
export interface OrganizationalRelationship {
  readonly relationshipId: string;
  readonly relationshipType: OrganizationalRelationshipType;
  readonly sourceReference: OrganizationalReference;
  readonly targetReference: OrganizationalReference;
  readonly workspaceScope: string;
  readonly organizationScope: string;
  readonly effectivePeriod: OrganizationalEffectivePeriod;
  readonly provenance: OrganizationalProvenance;
  readonly lifecycle: OrganizationalLifecycle;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof ORGANIZATIONAL_RELATIONSHIP_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface OrganizationalRelationshipValidation {
  readonly status: "valid" | "invalid";
  readonly error?: { readonly code: OrganizationalRelationshipErrorCode; readonly message: string };
  readonly executable: false;
  readonly authoritative: false;
}

const RELATIONSHIP_KEYS = [
  "relationshipId", "relationshipType", "sourceReference", "targetReference", "workspaceScope",
  "organizationScope", "effectivePeriod", "provenance", "lifecycle", "metadata",
  "architectureVersion", "executable", "authoritative",
] as const;
const REFERENCE_KEYS = ["referenceType", "referenceId", "workspaceId", "organizationId", "executable", "authoritative"] as const;

function invalid(code: OrganizationalRelationshipErrorCode, message: string): OrganizationalRelationshipValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

function validReference(value: OrganizationalReference): boolean {
  return inert(value) && hasOnlyKeys(value, REFERENCE_KEYS)
    && (ORGANIZATIONAL_REFERENCE_TYPES as readonly string[]).includes(value.referenceType)
    && [value.referenceId, value.workspaceId, value.organizationId].every(validText);
}

export function createOrganizationalRelationship(input: Omit<OrganizationalRelationship, "architectureVersion">): OrganizationalRelationship {
  const copied = copy(input) as unknown as Omit<OrganizationalRelationship, "architectureVersion">;
  if ([copied, copied.sourceReference, copied.targetReference, copied.effectivePeriod, copied.provenance, copied.lifecycle]
    .some((value) => (value as { executable?: unknown }).executable !== false
      || (value as { authoritative?: unknown }).authoritative !== false)) throw new TypeError("Invalid Organizational Relationship.");
  return deepFreeze({ ...copied, architectureVersion: ORGANIZATIONAL_RELATIONSHIP_VERSION });
}

export function validateOrganizationalRelationship(value: OrganizationalRelationship): OrganizationalRelationshipValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== ORGANIZATIONAL_RELATIONSHIP_VERSION
    || !value.sourceReference || !value.targetReference || !value.effectivePeriod || !value.provenance || !value.lifecycle) {
    return invalid("INVALID_RELATIONSHIP", "Organizational Relationship structure or schema is invalid.");
  }
  if (![value, value.sourceReference, value.targetReference, value.effectivePeriod, value.provenance, value.lifecycle].every(inert)
    || !immutableData(value) || !hasOnlyKeys(value, RELATIONSHIP_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Organizational Relationship must be immutable inert metadata.");
  }
  if (!validText(value.relationshipId)) return invalid("INVALID_RELATIONSHIP_ID", "relationshipId is invalid.");
  if (!(ORGANIZATIONAL_RELATIONSHIP_TYPES as readonly string[]).includes(value.relationshipType)) {
    return invalid("INVALID_RELATIONSHIP_TYPE", "relationshipType is invalid.");
  }
  if (!validReference(value.sourceReference)) return invalid("INVALID_SOURCE_REFERENCE", "sourceReference is invalid.");
  if (!validReference(value.targetReference)) return invalid("INVALID_TARGET_REFERENCE", "targetReference is invalid.");
  if (value.sourceReference.referenceType === value.targetReference.referenceType
    && value.sourceReference.referenceId === value.targetReference.referenceId) {
    return invalid("SELF_RELATIONSHIP", "Relationship source and target must differ.");
  }
  if (!validText(value.workspaceScope)
    || value.sourceReference.workspaceId !== value.workspaceScope || value.targetReference.workspaceId !== value.workspaceScope) {
    return invalid("WORKSPACE_MISMATCH", "Relationship workspace references must match workspaceScope.");
  }
  if (!validText(value.organizationScope)
    || value.sourceReference.organizationId !== value.organizationScope || value.targetReference.organizationId !== value.organizationScope) {
    return invalid("ORGANIZATION_MISMATCH", "Relationship organization references must match organizationScope.");
  }
  if (!validEffectivePeriod(value.effectivePeriod)) return invalid("INVALID_EFFECTIVE_PERIOD", "Relationship effectivePeriod is invalid.");
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Relationship lifecycle is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Relationship provenance is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Relationship metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
