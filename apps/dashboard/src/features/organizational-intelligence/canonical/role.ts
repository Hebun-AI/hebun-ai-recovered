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

export const ROLE_VERSION = "organizational-role/v1";
export const ROLE_ERROR_CODES = [
  "INVALID_ROLE", "INVALID_WORKSPACE_SCOPE", "INVALID_ORGANIZATION_REFERENCE",
  "INVALID_UNIT_REFERENCE", "INVALID_IDENTITY", "INVALID_RESPONSIBILITY_REFERENCE",
  "DUPLICATE_RESPONSIBILITY_REFERENCE", "INVALID_CAPABILITY_REFERENCE",
  "DUPLICATE_CAPABILITY_REFERENCE", "INVALID_EFFECTIVE_PERIOD", "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE", "INVALID_METADATA", "IMMUTABILITY_VIOLATION",
] as const;
export type RoleErrorCode = (typeof ROLE_ERROR_CODES)[number];

/** An unoccupied organizational function. Actors may later reference it through relationships. */
export interface Role {
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly organizationalUnitId: string;
  readonly identity: OrganizationalIdentity;
  readonly responsibilityReferences: readonly string[];
  readonly capabilityReferences: readonly string[];
  readonly lifecycle: OrganizationalLifecycle;
  readonly effectivePeriod: OrganizationalEffectivePeriod;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof ROLE_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface RoleValidation {
  readonly status: "valid" | "invalid";
  readonly error?: { readonly code: RoleErrorCode; readonly message: string };
  readonly executable: false;
  readonly authoritative: false;
}

const ROLE_KEYS = [
  "workspaceId", "organizationId", "organizationalUnitId", "identity",
  "responsibilityReferences", "capabilityReferences", "lifecycle", "effectivePeriod",
  "provenance", "metadata", "architectureVersion", "executable", "authoritative",
] as const;

function invalid(code: RoleErrorCode, message: string): RoleValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createRole(input: Omit<Role, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): Role {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<Role, "architectureVersion" | "identity">;
  if ([rest, rest.lifecycle, rest.effectivePeriod, rest.provenance].some((value) => (value as { executable?: unknown }).executable !== false
    || (value as { authoritative?: unknown }).authoritative !== false)) throw new TypeError("Invalid Role.");
  return deepFreeze({ ...rest, identity, architectureVersion: ROLE_VERSION });
}

export function validateRole(value: Role): RoleValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== ROLE_VERSION || !value.identity
    || !value.lifecycle || !value.effectivePeriod || !value.provenance
    || !Array.isArray(value.responsibilityReferences) || !Array.isArray(value.capabilityReferences)) {
    return invalid("INVALID_ROLE", "Role structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.effectivePeriod, value.provenance].every(inert) || !immutableData(value)
    || !hasOnlyKeys(value, ROLE_KEYS)) return invalid("IMMUTABILITY_VIOLATION", "Role must be immutable inert metadata.");
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "Role workspaceId is invalid.");
  if (!validText(value.organizationId)) return invalid("INVALID_ORGANIZATION_REFERENCE", "Role organizationId is invalid.");
  if (!validText(value.organizationalUnitId)) return invalid("INVALID_UNIT_REFERENCE", "Role organizationalUnitId is invalid.");
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Role identity is invalid.");
  if (!value.responsibilityReferences.every(validText)) return invalid("INVALID_RESPONSIBILITY_REFERENCE", "Role responsibility reference is invalid.");
  if (new Set(value.responsibilityReferences).size !== value.responsibilityReferences.length) {
    return invalid("DUPLICATE_RESPONSIBILITY_REFERENCE", "Role responsibility references must be unique.");
  }
  if (!value.capabilityReferences.every(validText)) return invalid("INVALID_CAPABILITY_REFERENCE", "Role capability reference is invalid.");
  if (new Set(value.capabilityReferences).size !== value.capabilityReferences.length) {
    return invalid("DUPLICATE_CAPABILITY_REFERENCE", "Role capability references must be unique.");
  }
  if (!validEffectivePeriod(value.effectivePeriod)) return invalid("INVALID_EFFECTIVE_PERIOD", "Role effective period is invalid.");
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Role lifecycle is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Role provenance is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Role metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
