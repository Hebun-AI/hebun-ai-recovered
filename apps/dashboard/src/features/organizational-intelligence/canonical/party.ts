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

export const PARTY_VERSION = "party/v1";

export const PARTY_ERROR_CODES = [
  "INVALID_PARTY",
  "INVALID_WORKSPACE_SCOPE",
  "INVALID_IDENTITY",
  "INVALID_PARTY_TYPE",
  "INVALID_WEBSITE",
  "INVALID_COUNTRY",
  "INVALID_INDUSTRY",
  "INVALID_TAX_IDENTIFIER",
  "INVALID_REGISTRATION_IDENTIFIER",
  "DUPLICATE_REGISTRATION_IDENTIFIER",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type PartyErrorCode = (typeof PARTY_ERROR_CODES)[number];

/**
 * An external entity that interacts with an Organization: a company, customer,
 * supplier, investor, regulator, contractor, agency, university, nonprofit, or
 * individual. A Party is the entity itself — never a role. The nature of its
 * dealings with the Organization is carried only by PartyRole, so a Party holds
 * no role, relationship, or legal-form field. External-system references live
 * inside its OrganizationalIdentity; the remaining fields are optional,
 * declarative descriptors. Nothing here integrates, persists, or networks.
 */
export interface Party {
  readonly workspaceId: string;
  readonly identity: OrganizationalIdentity;
  readonly partyType: string | null;
  readonly website: string | null;
  readonly country: string | null;
  readonly industry: string | null;
  readonly taxIdentifierReference: string | null;
  readonly registrationIdentifiers: readonly string[];
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof PARTY_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface PartyValidationError {
  readonly code: PartyErrorCode;
  readonly message: string;
}

export interface PartyValidation {
  readonly status: "valid" | "invalid";
  readonly error?: PartyValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const PARTY_KEYS = [
  "workspaceId", "identity", "partyType", "website", "country", "industry",
  "taxIdentifierReference", "registrationIdentifiers", "lifecycle", "provenance",
  "metadata", "architectureVersion", "executable", "authoritative",
] as const;
/** Fields that would collapse the entity/role distinction or smuggle in another axis. */
const FOREIGN_AXIS_KEYS = ["role", "roles", "partyRole", "partyRoles", "roleType", "relationshipType", "legalForm", "unitKind"];

function invalid(code: PartyErrorCode, message: string): PartyValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function createParty(input: Omit<Party, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): Party {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<Party, "architectureVersion" | "identity">;
  if (rest.executable !== false || rest.authoritative !== false) throw new TypeError("Invalid Party.");
  return deepFreeze({ ...rest, identity, architectureVersion: PARTY_VERSION });
}

export function validateParty(value: Party): PartyValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== PARTY_VERSION
    || !value.identity || !value.lifecycle || !value.provenance || !Array.isArray(value.registrationIdentifiers)) {
    return invalid("INVALID_PARTY", "Party structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.provenance].every(inert) || !immutableData(value) || !hasOnlyKeys(value, PARTY_KEYS)
    || FOREIGN_AXIS_KEYS.some((key) => key in value)) {
    return invalid("IMMUTABILITY_VIOLATION", "Party must be immutable inert metadata distinct from PartyRole.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "Party workspaceId is invalid.");
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Party identity is invalid.");
  if (value.partyType !== null && !validText(value.partyType)) return invalid("INVALID_PARTY_TYPE", "partyType is invalid.");
  if (value.website !== null && !validText(value.website)) return invalid("INVALID_WEBSITE", "website is invalid.");
  if (value.country !== null && !validText(value.country)) return invalid("INVALID_COUNTRY", "country is invalid.");
  if (value.industry !== null && !validText(value.industry)) return invalid("INVALID_INDUSTRY", "industry is invalid.");
  if (value.taxIdentifierReference !== null && !validText(value.taxIdentifierReference)) {
    return invalid("INVALID_TAX_IDENTIFIER", "taxIdentifierReference is invalid.");
  }
  if (!value.registrationIdentifiers.every(validText)) return invalid("INVALID_REGISTRATION_IDENTIFIER", "A registration identifier is invalid.");
  if (new Set(value.registrationIdentifiers).size !== value.registrationIdentifiers.length) {
    return invalid("DUPLICATE_REGISTRATION_IDENTIFIER", "Registration identifiers must be unique.");
  }
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Lifecycle metadata is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Provenance metadata is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
