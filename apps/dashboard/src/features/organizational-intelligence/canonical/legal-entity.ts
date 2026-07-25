import {
  createOrganizationalIdentity,
  validateOrganizationalIdentity,
  type OrganizationalIdentity,
} from "./organizational-identity";
import {
  copy,
  deepFreeze,
  hasOnlyKeys,
  immutableData,
  inert,
  validLifecycle,
  validMetadata,
  validProvenance,
  validText,
  type MetadataValue,
  type OrganizationalLifecycle,
  type OrganizationalProvenance,
} from "./validation";

export const LEGAL_ENTITY_VERSION = "legal-entity/v1";

export const LEGAL_ENTITY_ERROR_CODES = [
  "INVALID_LEGAL_ENTITY",
  "INVALID_WORKSPACE_SCOPE",
  "INVALID_IDENTITY",
  "INVALID_LEGAL_NAME",
  "INVALID_LEGAL_FORM",
  "INVALID_JURISDICTION",
  "INVALID_REGISTRATION_IDENTIFIER",
  "DUPLICATE_REGISTRATION_IDENTIFIER",
  "INVALID_ORGANIZATION_REFERENCE",
  "NOT_AN_ORGANIZATIONAL_UNIT",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type LegalEntityErrorCode = (typeof LEGAL_ENTITY_ERROR_CODES)[number];

/** A declarative registration reference with a legal registry. No integration. */
export interface RegistrationIdentifier {
  readonly authority: string;
  readonly jurisdiction: string;
  readonly registrationNumber: string;
  readonly verified: boolean;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly executable: false;
  readonly authoritative: false;
}

/**
 * A jural/legal person on the legal axis. It is not an OrganizationalUnit and
 * carries no operating-structure fields (unit kind, parent unit).
 */
export interface LegalEntity {
  readonly workspaceId: string;
  readonly identity: OrganizationalIdentity;
  readonly legalName: string;
  readonly legalForm: string;
  readonly jurisdiction: string;
  readonly registrationIdentifiers: readonly RegistrationIdentifier[];
  readonly organizationReferences: readonly string[];
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof LEGAL_ENTITY_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface LegalEntityValidationError {
  readonly code: LegalEntityErrorCode;
  readonly message: string;
}

export interface LegalEntityValidation {
  readonly status: "valid" | "invalid";
  readonly error?: LegalEntityValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const LEGAL_ENTITY_KEYS = [
  "workspaceId", "identity", "legalName", "legalForm", "jurisdiction", "registrationIdentifiers",
  "organizationReferences", "lifecycle", "provenance", "metadata", "architectureVersion", "executable", "authoritative",
] as const;
const REGISTRATION_KEYS = ["authority", "jurisdiction", "registrationNumber", "verified", "metadata", "executable", "authoritative"] as const;
/** Operating-structure fields must never appear on a LegalEntity. */
const OPERATING_AXIS_KEYS = ["unitKind", "customKind", "parentUnitId"];

function invalid(code: LegalEntityErrorCode, message: string): LegalEntityValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createLegalEntity(input: Omit<LegalEntity, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): LegalEntity {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<LegalEntity, "architectureVersion" | "identity">;
  const structures: readonly unknown[] = [rest, ...rest.registrationIdentifiers];
  if (structures.some((value) => (value as { executable?: unknown }).executable !== false
    || (value as { authoritative?: unknown }).authoritative !== false)) {
    throw new TypeError("Invalid Legal Entity.");
  }
  return deepFreeze({ ...rest, identity, architectureVersion: LEGAL_ENTITY_VERSION });
}

export function validateLegalEntity(value: LegalEntity): LegalEntityValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== LEGAL_ENTITY_VERSION
    || !value.identity || !value.lifecycle || !value.provenance
    || !Array.isArray(value.registrationIdentifiers) || !Array.isArray(value.organizationReferences)) {
    return invalid("INVALID_LEGAL_ENTITY", "Legal Entity structure or schema is invalid.");
  }
  // Distinctness from the operating axis is checked first so the smuggled field
  // yields an intentful code rather than the generic whitelist rejection.
  if (OPERATING_AXIS_KEYS.some((key) => key in value)) {
    return invalid("NOT_AN_ORGANIZATIONAL_UNIT", "Legal Entity must not carry operating-structure fields.");
  }
  if (![value, value.lifecycle, value.provenance, ...value.registrationIdentifiers].every(inert)
    || !immutableData(value) || !hasOnlyKeys(value, LEGAL_ENTITY_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Legal Entity must be immutable inert metadata.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "workspaceId is invalid.");
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Legal Entity identity is invalid.");
  if (!validText(value.legalName)) return invalid("INVALID_LEGAL_NAME", "legalName is invalid.");
  if (!validText(value.legalForm)) return invalid("INVALID_LEGAL_FORM", "legalForm is invalid.");
  if (!validText(value.jurisdiction)) return invalid("INVALID_JURISDICTION", "jurisdiction is invalid.");

  const registrationKeys = new Set<string>();
  for (const registration of value.registrationIdentifiers) {
    if (!inert(registration) || !hasOnlyKeys(registration, REGISTRATION_KEYS)
      || ![registration.authority, registration.jurisdiction, registration.registrationNumber].every(validText)
      || typeof registration.verified !== "boolean" || !validMetadata(registration.metadata)) {
      return invalid("INVALID_REGISTRATION_IDENTIFIER", "A registration identifier is invalid.");
    }
    const key = `${registration.authority} ${registration.jurisdiction} ${registration.registrationNumber}`;
    if (registrationKeys.has(key)) return invalid("DUPLICATE_REGISTRATION_IDENTIFIER", "Registration identifier is duplicated.");
    registrationKeys.add(key);
  }
  if (!value.organizationReferences.every(validText)) return invalid("INVALID_ORGANIZATION_REFERENCE", "An organization reference is invalid.");
  if (new Set(value.organizationReferences).size !== value.organizationReferences.length) {
    return invalid("INVALID_ORGANIZATION_REFERENCE", "Organization references must be unique.");
  }
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Lifecycle metadata is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Provenance metadata is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
