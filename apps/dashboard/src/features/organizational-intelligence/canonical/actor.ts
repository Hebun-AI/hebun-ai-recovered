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

export const ACTOR_VERSION = "actor/v1";

export const ACTOR_TYPES = ["PERSON", "AI_AGENT", "SERVICE_ACCOUNT", "EXTERNAL_CONTACT"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const ACTOR_ERROR_CODES = [
  "INVALID_ACTOR",
  "INVALID_ACTOR_ID",
  "INVALID_ACTOR_TYPE",
  "INVALID_WORKSPACE_SCOPE",
  "INVALID_IDENTITY",
  "INVALID_ORGANIZATION_REFERENCE",
  "INVALID_CAPABILITY_REFERENCE",
  "AUTHENTICATION_FIELD_FORBIDDEN",
  "INVALID_LIFECYCLE",
  "INVALID_PROVENANCE",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type ActorErrorCode = (typeof ACTOR_ERROR_CODES)[number];

/**
 * The abstract organizational actor. It is NOT an authentication identity: it
 * stores no credentials, tokens, login ids, passwords, MFA state, or secrets.
 * Capabilities are declared as inert string references only.
 */
export interface Actor {
  readonly actorId: string;
  readonly actorType: ActorType;
  readonly workspaceId: string;
  readonly organizationReferences: readonly string[];
  readonly identity: OrganizationalIdentity;
  readonly capabilityReferences: readonly string[];
  readonly lifecycle: OrganizationalLifecycle;
  readonly provenance: OrganizationalProvenance;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof ACTOR_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface ActorValidationError {
  readonly code: ActorErrorCode;
  readonly message: string;
}

export interface ActorValidation {
  readonly status: "valid" | "invalid";
  readonly error?: ActorValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

export const ACTOR_KEYS = [
  "actorId", "actorType", "workspaceId", "organizationReferences", "identity", "capabilityReferences",
  "lifecycle", "provenance", "metadata", "architectureVersion", "executable", "authoritative",
] as const;

/** Any own-key or metadata key matching one of these blocks the actor as an auth identity. */
export const FORBIDDEN_AUTHENTICATION_KEYS = [
  "password", "passwordhash", "token", "accesstoken", "refreshtoken", "apikey", "secret",
  "credential", "credentials", "login", "loginid", "username", "mfa", "otp", "sessiontoken", "privatekey",
];

function invalid(code: ActorErrorCode, message: string): ActorValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

export function containsAuthenticationField(value: object): boolean {
  const lowerKeys = Object.keys(value).map((key) => key.toLowerCase());
  return FORBIDDEN_AUTHENTICATION_KEYS.some((forbidden) => lowerKeys.includes(forbidden));
}

export function createActor(input: Omit<Actor, "architectureVersion" | "identity"> & {
  readonly identity: Omit<OrganizationalIdentity, "architectureVersion">;
}): Actor {
  const { identity: rawIdentity, ...rawRest } = input;
  const identity = createOrganizationalIdentity(rawIdentity);
  const rest = copy(rawRest) as unknown as Omit<Actor, "architectureVersion" | "identity">;
  if (rest.executable !== false || rest.authoritative !== false) throw new TypeError("Invalid Actor.");
  return deepFreeze({ ...rest, identity, architectureVersion: ACTOR_VERSION });
}

/**
 * Validates the shared actor core. Reused by every specialization. `expectedType`
 * pins the actorType when a specialization calls it.
 */
export function validateActor(value: Actor, expectedType?: ActorType): ActorValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== ACTOR_VERSION
    || !value.identity || !value.lifecycle || !value.provenance
    || !Array.isArray(value.organizationReferences) || !Array.isArray(value.capabilityReferences)) {
    return invalid("INVALID_ACTOR", "Actor structure or schema is invalid.");
  }
  if (![value, value.lifecycle, value.provenance].every(inert) || !immutableData(value) || !hasOnlyKeys(value, ACTOR_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Actor must be immutable inert metadata.");
  }
  if (containsAuthenticationField(value) || containsAuthenticationField(value.metadata)) {
    return invalid("AUTHENTICATION_FIELD_FORBIDDEN", "Actor must not carry authentication identity fields.");
  }
  if (!validText(value.actorId)) return invalid("INVALID_ACTOR_ID", "actorId is invalid.");
  if (!(ACTOR_TYPES as readonly string[]).includes(value.actorType) || (expectedType && value.actorType !== expectedType)) {
    return invalid("INVALID_ACTOR_TYPE", "actorType is invalid or mismatched.");
  }
  if (!validText(value.workspaceId)) return invalid("INVALID_WORKSPACE_SCOPE", "workspaceId is invalid.");
  if (validateOrganizationalIdentity(value.identity).status !== "valid") return invalid("INVALID_IDENTITY", "Actor identity is invalid.");
  if (!value.organizationReferences.every(validText) || new Set(value.organizationReferences).size !== value.organizationReferences.length) {
    return invalid("INVALID_ORGANIZATION_REFERENCE", "Organization references are invalid or duplicated.");
  }
  if (!value.capabilityReferences.every(validText) || new Set(value.capabilityReferences).size !== value.capabilityReferences.length) {
    return invalid("INVALID_CAPABILITY_REFERENCE", "Capability references are invalid or duplicated.");
  }
  if (!validLifecycle(value.lifecycle)) return invalid("INVALID_LIFECYCLE", "Lifecycle metadata is invalid.");
  if (!validProvenance(value.provenance)) return invalid("INVALID_PROVENANCE", "Provenance metadata is invalid.");
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
