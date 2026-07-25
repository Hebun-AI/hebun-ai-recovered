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
  type MetadataValue,
  type OrganizationalLifecycle,
  type OrganizationalProvenance,
} from "./validation";

export const RESPONSIBILITY_VERSION = "organizational-responsibility/v1";
export const RESPONSIBILITY_CATEGORIES = ["GOVERNANCE", "OPERATIONS", "FINANCE", "SECURITY", "COMPLIANCE", "PRODUCT", "CUSTOMER", "CUSTOM"] as const;
export const RESPONSIBILITY_CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const RESPONSIBILITY_ERROR_CODES = [
  "INVALID_RESPONSIBILITY", "INVALID_IDENTITY", "INVALID_CATEGORY", "INVALID_CRITICALITY",
  "INVALID_LIFECYCLE", "INVALID_PROVENANCE", "INVALID_METADATA", "IMMUTABILITY_VIOLATION",
] as const;

export type ResponsibilityCategory = (typeof RESPONSIBILITY_CATEGORIES)[number];
export type ResponsibilityCriticality = (typeof RESPONSIBILITY_CRITICALITIES)[number];
export type ResponsibilityErrorCode = (typeof RESPONSIBILITY_ERROR_CODES)[number];

/** Declarative accountability only. Delegation, escalation, and assignment are not performed here. */
export interface Responsibility {
  readonly identity: OrganizationalIdentity;
  readonly category: ResponsibilityCategory;
  readonly criticality: ResponsibilityCriticality;
  readonly delegable: boolean;
  readonly escalationRequired: boolean;
  readonly assignable: boolean;
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof RESPONSIBILITY_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface ResponsibilityValidation {
  readonly status: "valid" | "invalid";
  readonly error?: { readonly code: ResponsibilityErrorCode; readonly message: string };
  readonly executable: false;
  readonly authoritative: false;
}

const RESPONSIBILITY_KEYS = [
  "identity", "category", "criticality", "delegable", "escalationRequired", "assignable",
  "lifecycle", "provenance", "metadata", "architectureVersion", "executable", "authoritative",
] as const;

function invalid(code: ResponsibilityErrorCode, message: string): ResponsibilityValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createResponsibility(input: Omit<Responsibility, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): Responsibility {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<Responsibility, "architectureVersion" | "identity">;
  if ([rest, rest.lifecycle, rest.provenance].some((value) => (value as { executable?: unknown }).executable !== false
    || (value as { authoritative?: unknown }).authoritative !== false)) throw new TypeError("Invalid Responsibility.");
  return deepFreeze({ ...rest, identity, architectureVersion: RESPONSIBILITY_VERSION });
}

export function validateResponsibility(value: Responsibility): ResponsibilityValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== RESPONSIBILITY_VERSION
    || !value.identity || !value.lifecycle || !value.provenance) {
    return invalid("INVALID_RESPONSIBILITY", "Responsibility structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.provenance].every(inert) || !immutableData(value)
    || !hasOnlyKeys(value, RESPONSIBILITY_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Responsibility must be immutable inert metadata.");
  }
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Responsibility identity is invalid.");
  if (!(RESPONSIBILITY_CATEGORIES as readonly string[]).includes(value.category)) return invalid("INVALID_CATEGORY", "Responsibility category is invalid.");
  if (!(RESPONSIBILITY_CRITICALITIES as readonly string[]).includes(value.criticality)) return invalid("INVALID_CRITICALITY", "Responsibility criticality is invalid.");
  if (![value.delegable, value.escalationRequired, value.assignable].every((entry) => typeof entry === "boolean")) {
    return invalid("INVALID_RESPONSIBILITY", "Responsibility descriptors are invalid.");
  }
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Responsibility lifecycle is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Responsibility provenance is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Responsibility metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
