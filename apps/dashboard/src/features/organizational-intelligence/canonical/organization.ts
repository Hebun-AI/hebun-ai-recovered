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

export const ORGANIZATION_VERSION = "organization/v1";

export const ORGANIZATION_ERROR_CODES = [
  "INVALID_ORGANIZATION",
  "INVALID_WORKSPACE_SCOPE",
  "INVALID_IDENTITY",
  "INVALID_ORGANIZATION_TYPE",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type OrganizationErrorCode = (typeof ORGANIZATION_ERROR_CODES)[number];

/**
 * A business organization within a workspace. Distinct from LegalEntity (the
 * legal axis) and OrganizationalUnit (the operating-structure node): it carries
 * neither a legal form nor a unit kind.
 */
export interface Organization {
  readonly workspaceId: string;
  readonly identity: OrganizationalIdentity;
  readonly organizationType: string | null;
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof ORGANIZATION_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface OrganizationValidationError {
  readonly code: OrganizationErrorCode;
  readonly message: string;
}

export interface OrganizationValidation {
  readonly status: "valid" | "invalid";
  readonly error?: OrganizationValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const ORGANIZATION_KEYS = [
  "workspaceId", "identity", "organizationType", "lifecycle", "provenance",
  "metadata", "architectureVersion", "executable", "authoritative",
] as const;
/** Fields that would blur Organization into LegalEntity or OrganizationalUnit. */
const FOREIGN_AXIS_KEYS = ["legalForm", "jurisdiction", "registrationIdentifiers", "unitKind", "customKind", "parentUnitId"];

function invalid(code: OrganizationErrorCode, message: string): OrganizationValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createOrganization(input: Omit<Organization, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): Organization {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<Organization, "architectureVersion" | "identity">;
  if (rest.executable !== false || rest.authoritative !== false) throw new TypeError("Invalid Organization.");
  return deepFreeze({ ...rest, identity, architectureVersion: ORGANIZATION_VERSION });
}

export function validateOrganization(value: Organization): OrganizationValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== ORGANIZATION_VERSION
    || !value.identity || !value.lifecycle || !value.provenance) {
    return invalid("INVALID_ORGANIZATION", "Organization structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.provenance].every(inert) || !immutableData(value) || !hasOnlyKeys(value, ORGANIZATION_KEYS)
    || FOREIGN_AXIS_KEYS.some((key) => key in value)) {
    return invalid("IMMUTABILITY_VIOLATION", "Organization must be immutable inert metadata distinct from other axes.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "workspaceId is invalid.");
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Organization identity is invalid.");
  if (value.organizationType !== null && !validText(value.organizationType)) return invalid("INVALID_ORGANIZATION_TYPE", "organizationType is invalid.");
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Lifecycle metadata is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Provenance metadata is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
