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

export const CAPABILITY_VERSION = "organizational-capability/v1";
export const CAPABILITY_CATEGORIES = ["BUSINESS", "TECHNICAL", "OPERATIONAL", "GOVERNANCE", "ANALYTICAL", "COMMUNICATION", "CUSTOM"] as const;
export const CAPABILITY_ERROR_CODES = [
  "INVALID_CAPABILITY", "INVALID_IDENTITY", "INVALID_CATEGORY", "INVALID_DESCRIPTION",
  "INVALID_LIFECYCLE", "INVALID_PROVENANCE", "INVALID_METADATA", "IMMUTABILITY_VIOLATION",
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];
export type CapabilityErrorCode = (typeof CAPABILITY_ERROR_CODES)[number];

/** An organizational ability descriptor, never a permission or implementation. */
export interface Capability {
  readonly identity: OrganizationalIdentity;
  readonly category: CapabilityCategory;
  readonly description: string;
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof CAPABILITY_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface CapabilityValidation {
  readonly status: "valid" | "invalid";
  readonly error?: { readonly code: CapabilityErrorCode; readonly message: string };
  readonly executable: false;
  readonly authoritative: false;
}

const CAPABILITY_KEYS = [
  "identity", "category", "description", "lifecycle", "provenance", "metadata",
  "architectureVersion", "executable", "authoritative",
] as const;

function invalid(code: CapabilityErrorCode, message: string): CapabilityValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createCapability(input: Omit<Capability, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): Capability {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<Capability, "architectureVersion" | "identity">;
  if ([rest, rest.lifecycle, rest.provenance].some((value) => (value as { executable?: unknown }).executable !== false
    || (value as { authoritative?: unknown }).authoritative !== false)) throw new TypeError("Invalid Capability.");
  return deepFreeze({ ...rest, identity, architectureVersion: CAPABILITY_VERSION });
}

export function validateCapability(value: Capability): CapabilityValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== CAPABILITY_VERSION
    || !value.identity || !value.lifecycle || !value.provenance) {
    return invalid("INVALID_CAPABILITY", "Capability structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.provenance].every(inert) || !immutableData(value)
    || !hasOnlyKeys(value, CAPABILITY_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Capability must be immutable inert metadata.");
  }
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Capability identity is invalid.");
  if (!(CAPABILITY_CATEGORIES as readonly string[]).includes(value.category)) return invalid("INVALID_CATEGORY", "Capability category is invalid.");
  if (!validText(value.description)) return invalid("INVALID_DESCRIPTION", "Capability description is invalid.");
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Capability lifecycle is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Capability provenance is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Capability metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
