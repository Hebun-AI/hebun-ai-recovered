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

export const PARTY_ROLE_VERSION = "party-role/v1";

export const PARTY_ROLE_TYPES = [
  "CUSTOMER", "SUPPLIER", "PARTNER", "INVESTOR", "REGULATOR", "CONTRACTOR",
  "COMPETITOR", "DISTRIBUTOR", "RESELLER", "ADVISOR", "CUSTOM",
] as const;
export type PartyRoleType = (typeof PARTY_ROLE_TYPES)[number];

export const PARTY_ROLE_ERROR_CODES = [
  "INVALID_PARTY_ROLE",
  "INVALID_PARTY_ROLE_ID",
  "INVALID_ROLE_TYPE",
  "INVALID_CUSTOM_ROLE",
  "INVALID_WORKSPACE_SCOPE",
  "INVALID_ORGANIZATION_REFERENCE",
  "INVALID_PARTY_REFERENCE",
  "INVALID_EFFECTIVE_PERIOD",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type PartyRoleErrorCode = (typeof PARTY_ROLE_ERROR_CODES)[number];

export const PARTY_ROLE_SET_ERROR_CODES = [
  "INVALID_MEMBER",
  "WORKSPACE_MISMATCH",
  "ORGANIZATION_MISMATCH",
  "PARTY_MISMATCH",
  "DUPLICATE_ACTIVE_ROLE",
] as const;
export type PartyRoleSetErrorCode = (typeof PARTY_ROLE_SET_ERROR_CODES)[number];

/**
 * The relationship a Party holds with the Organization over a period of time.
 * A PartyRole is a temporal edge, not an entity specialization: the same Party
 * may carry several roles at once (a supplier who is also an investor), each
 * with its own effective period and lifecycle. CUSTOM roles name themselves
 * through customRoleLabel; canonical roles must leave it null. Purely inert.
 */
export interface PartyRole {
  readonly partyRoleId: string;
  readonly roleType: PartyRoleType;
  readonly customRoleLabel: string | null;
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly partyId: string;
  readonly effectivePeriod: OrganizationalEffectivePeriod;
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof PARTY_ROLE_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface PartyRoleValidation {
  readonly status: "valid" | "invalid";
  readonly error?: { readonly code: PartyRoleErrorCode; readonly message: string };
  readonly executable: false;
  readonly authoritative: false;
}

export interface PartyRoleSetValidation {
  readonly status: "valid" | "invalid";
  readonly error?: { readonly code: PartyRoleSetErrorCode; readonly message: string };
  readonly executable: false;
  readonly authoritative: false;
}

const PARTY_ROLE_KEYS = [
  "partyRoleId", "roleType", "customRoleLabel", "workspaceId", "organizationId",
  "partyId", "effectivePeriod", "lifecycle", "provenance", "metadata",
  "architectureVersion", "executable", "authoritative",
] as const;

function invalid(code: PartyRoleErrorCode, message: string): PartyRoleValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

function invalidSet(code: PartyRoleSetErrorCode, message: string): PartyRoleSetValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

/** A role is active when its lifecycle status is active; period bounds are advisory descriptors. */
function isActive(value: PartyRole): boolean {
  return value.lifecycle.status === "active";
}

/** The identity of a role for duplicate detection: its type, plus the custom label when CUSTOM. */
function roleDiscriminator(value: PartyRole): string {
  return value.roleType === "CUSTOM" ? `CUSTOM:${value.customRoleLabel ?? ""}` : value.roleType;
}

export function createPartyRole(input: Omit<PartyRole, "architectureVersion">): PartyRole {
  const copied = copy(input) as unknown as Omit<PartyRole, "architectureVersion">;
  if ([copied, copied.effectivePeriod, copied.lifecycle, copied.provenance]
    .some((value) => (value as { executable?: unknown }).executable !== false
      || (value as { authoritative?: unknown }).authoritative !== false)) throw new TypeError("Invalid Party Role.");
  return deepFreeze({ ...copied, architectureVersion: PARTY_ROLE_VERSION });
}

export function validatePartyRole(value: PartyRole): PartyRoleValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== PARTY_ROLE_VERSION
    || !value.effectivePeriod || !value.lifecycle || !value.provenance) {
    return invalid("INVALID_PARTY_ROLE", "Party Role structure or schema is invalid.");
  }
  if (![value, value.effectivePeriod, value.lifecycle, value.provenance].every(inert)
    || !immutableData(value) || !hasOnlyKeys(value, PARTY_ROLE_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Party Role must be immutable inert metadata.");
  }
  if (!validText(value.partyRoleId)) return invalid("INVALID_PARTY_ROLE_ID", "partyRoleId is invalid.");
  if (!(PARTY_ROLE_TYPES as readonly string[]).includes(value.roleType)) return invalid("INVALID_ROLE_TYPE", "roleType is invalid.");
  // CUSTOM must name itself; every canonical role must leave the label null.
  if (value.roleType === "CUSTOM") {
    if (!validText(value.customRoleLabel)) return invalid("INVALID_CUSTOM_ROLE", "CUSTOM roleType requires a customRoleLabel.");
  } else if (value.customRoleLabel !== null) {
    return invalid("INVALID_CUSTOM_ROLE", "customRoleLabel is only permitted for CUSTOM roleType.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "Party Role workspaceId is invalid.");
  if (!validText(value.organizationId)) return invalid("INVALID_ORGANIZATION_REFERENCE", "Party Role organizationId is invalid.");
  if (!validText(value.partyId)) return invalid("INVALID_PARTY_REFERENCE", "Party Role partyId is invalid.");
  if (!validEffectivePeriod(value.effectivePeriod)) return invalid("INVALID_EFFECTIVE_PERIOD", "Party Role effectivePeriod is invalid.");
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Party Role lifecycle is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Party Role provenance is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Party Role metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}

/**
 * Validates a collection of roles held by a single Party against one
 * Organization. Multiple concurrent roles are permitted, but two active roles
 * of the same discriminator collide, and every member must share the same
 * workspace, organization, and party scope.
 */
export function validatePartyRoleSet(values: readonly PartyRole[]): PartyRoleSetValidation {
  if (!Array.isArray(values) || values.some((value) => validatePartyRole(value).status !== "valid")) {
    return invalidSet("INVALID_MEMBER", "Every Party Role in the set must be individually valid.");
  }
  if (values.length === 0) return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
  const [first] = values;
  if (values.some((value) => value.workspaceId !== first.workspaceId)) {
    return invalidSet("WORKSPACE_MISMATCH", "All Party Roles in a set must share one workspace.");
  }
  if (values.some((value) => value.organizationId !== first.organizationId)) {
    return invalidSet("ORGANIZATION_MISMATCH", "All Party Roles in a set must share one organization.");
  }
  if (values.some((value) => value.partyId !== first.partyId)) {
    return invalidSet("PARTY_MISMATCH", "All Party Roles in a set must belong to one party.");
  }
  const activeDiscriminators = new Set<string>();
  for (const value of values) {
    if (!isActive(value)) continue;
    const discriminator = roleDiscriminator(value);
    if (activeDiscriminators.has(discriminator)) {
      return invalidSet("DUPLICATE_ACTIVE_ROLE", "A party may hold each active role only once.");
    }
    activeDiscriminators.add(discriminator);
  }
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
