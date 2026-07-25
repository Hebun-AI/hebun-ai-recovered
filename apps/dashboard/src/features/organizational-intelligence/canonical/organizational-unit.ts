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

export const ORGANIZATIONAL_UNIT_VERSION = "organizational-unit/v1";

export const ORGANIZATIONAL_UNIT_KINDS = [
  "COMPANY", "DIVISION", "BUSINESS_UNIT", "DEPARTMENT", "TEAM", "REGION", "BRANCH", "CUSTOM",
] as const;
export type OrganizationalUnitKind = (typeof ORGANIZATIONAL_UNIT_KINDS)[number];

export const ORGANIZATIONAL_UNIT_ERROR_CODES = [
  "INVALID_UNIT",
  "INVALID_WORKSPACE_SCOPE",
  "INVALID_ORGANIZATION_REFERENCE",
  "INVALID_IDENTITY",
  "INVALID_UNIT_KIND",
  "INVALID_CUSTOM_KIND",
  "INVALID_PARENT_REFERENCE",
  "SELF_PARENT",
  "INVALID_EFFECTIVE_PERIOD",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type OrganizationalUnitErrorCode = (typeof ORGANIZATIONAL_UNIT_ERROR_CODES)[number];

/**
 * One recursive operating-structure node. The unit kind is a fixed vocabulary;
 * CUSTOM carries a label. The parent reference is a declarative id only — no
 * whole-graph cycle detection is performed here.
 */
export interface OrganizationalUnit {
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly identity: OrganizationalIdentity;
  readonly unitKind: OrganizationalUnitKind;
  readonly customKind: string | null;
  readonly parentUnitId: string | null;
  readonly lifecycle: OrganizationalLifecycle;
  readonly effectivePeriod: OrganizationalEffectivePeriod;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof ORGANIZATIONAL_UNIT_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface OrganizationalUnitValidationError {
  readonly code: OrganizationalUnitErrorCode;
  readonly message: string;
}

export interface OrganizationalUnitValidation {
  readonly status: "valid" | "invalid";
  readonly error?: OrganizationalUnitValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const UNIT_KEYS = [
  "workspaceId", "organizationId", "identity", "unitKind", "customKind", "parentUnitId",
  "lifecycle", "effectivePeriod", "provenance", "metadata", "architectureVersion", "executable", "authoritative",
] as const;

function invalid(code: OrganizationalUnitErrorCode, message: string): OrganizationalUnitValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createOrganizationalUnit(input: Omit<OrganizationalUnit, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): OrganizationalUnit {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<OrganizationalUnit, "architectureVersion" | "identity">;
  if ([rest, rest.lifecycle, rest.effectivePeriod, rest.provenance].some((value) => (value as { executable?: unknown }).executable !== false
    || (value as { authoritative?: unknown }).authoritative !== false)) {
    throw new TypeError("Invalid Organizational Unit.");
  }
  return deepFreeze({ ...rest, identity, architectureVersion: ORGANIZATIONAL_UNIT_VERSION });
}

export function validateOrganizationalUnit(value: OrganizationalUnit): OrganizationalUnitValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== ORGANIZATIONAL_UNIT_VERSION
    || !value.identity || !value.lifecycle || !value.effectivePeriod || !value.provenance) {
    return invalid("INVALID_UNIT", "Organizational Unit structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.effectivePeriod, value.provenance].every(inert)
    || !immutableData(value) || !hasOnlyKeys(value, UNIT_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Organizational Unit must be immutable inert metadata.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "workspaceId is invalid.");
  if (!validText(value.organizationId)) return invalid("INVALID_ORGANIZATION_REFERENCE", "organizationId is invalid.");
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Organizational Unit identity is invalid.");
  if (!(ORGANIZATIONAL_UNIT_KINDS as readonly string[]).includes(value.unitKind)) return invalid("INVALID_UNIT_KIND", "unitKind is invalid.");

  // CUSTOM requires a label; every other kind must not carry one.
  if (value.unitKind === "CUSTOM") {
    if (!validText(value.customKind)) return invalid("INVALID_CUSTOM_KIND", "CUSTOM unit requires a valid customKind label.");
  } else if (value.customKind !== null) {
    return invalid("INVALID_CUSTOM_KIND", "Non-CUSTOM unit must not carry a customKind label.");
  }

  if (value.parentUnitId !== null) {
    if (!validText(value.parentUnitId)) return invalid("INVALID_PARENT_REFERENCE", "parentUnitId is invalid.");
    if (value.parentUnitId === value.identity.canonicalId) return invalid("SELF_PARENT", "A unit cannot be its own parent.");
  }
  if (!validEffectivePeriod(value.effectivePeriod)) return invalid("INVALID_EFFECTIVE_PERIOD", "effectivePeriod is invalid.");
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Lifecycle metadata is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Provenance metadata is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
