import {
  containsAuthenticationField,
  createActor,
  validateActor,
  type Actor,
} from "./actor";
import { type OrganizationalIdentity } from "./organizational-identity";
import {
  copy,
  deepFreeze,
  hasOnlyKeys,
  immutableData,
  inert,
  validMetadata,
  validText,
  type MetadataValue,
} from "./validation";

export const PERSON_VERSION = "person/v1";

export const PERSON_ERROR_CODES = [
  "INVALID_PERSON",
  "INVALID_ACTOR",
  "INVALID_LEGAL_EMPLOYER_REFERENCE",
  "INVALID_ORGANIZATIONAL_UNIT_REFERENCE",
  "AUTHENTICATION_FIELD_FORBIDDEN",
  "PERSONAL_DATA_FORBIDDEN",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type PersonErrorCode = (typeof PERSON_ERROR_CODES)[number];

/**
 * A human actor. Only organizational identity concepts belong here — no HR
 * records, payroll, health data, or private personal data, and no employment
 * workflow. Employer and working units are inert string references.
 */
export interface Person {
  readonly actor: Actor;
  readonly legalEmployerReference: string | null;
  readonly organizationalUnitReferences: readonly string[];
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof PERSON_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface PersonValidationError {
  readonly code: PersonErrorCode;
  readonly message: string;
}

export interface PersonValidation {
  readonly status: "valid" | "invalid";
  readonly error?: PersonValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const PERSON_KEYS = [
  "actor", "legalEmployerReference", "organizationalUnitReferences", "metadata",
  "architectureVersion", "executable", "authoritative",
] as const;
/** Sensitive personal/HR data must never enter this organizational layer. */
const FORBIDDEN_PERSONAL_KEYS = [
  "ssn", "socialsecurity", "nationalid", "passport", "dateofbirth", "dob", "salary", "compensation",
  "payroll", "bankaccount", "health", "medical", "homeaddress", "personalemail", "personalphone",
];

function invalid(code: PersonErrorCode, message: string): PersonValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

function containsPersonalData(value: object): boolean {
  const lowerKeys = Object.keys(value).map((key) => key.toLowerCase());
  return FORBIDDEN_PERSONAL_KEYS.some((forbidden) => lowerKeys.includes(forbidden));
}

export function createPerson(input: Omit<Person, "architectureVersion" | "actor"> & {
  readonly actor: Omit<Actor, "architectureVersion" | "identity"> & { readonly identity: Omit<OrganizationalIdentity, "architectureVersion"> };
}): Person {
  const { actor: rawActor, ...rawRest } = input;
  const actor = createActor({ ...rawActor, actorType: "PERSON" });
  const rest = copy(rawRest) as unknown as Omit<Person, "architectureVersion" | "actor">;
  if (rest.executable !== false || rest.authoritative !== false) throw new TypeError("Invalid Person.");
  return deepFreeze({ ...rest, actor, architectureVersion: PERSON_VERSION });
}

export function validatePerson(value: Person): PersonValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== PERSON_VERSION || !value.actor
    || !Array.isArray(value.organizationalUnitReferences)) {
    return invalid("INVALID_PERSON", "Person structure or schema is invalid.");
  }
  if (![value].every(inert) || !immutableData(value) || !hasOnlyKeys(value, PERSON_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "Person must be immutable inert metadata.");
  }
  // The wrapping Person may not smuggle auth or personal data either.
  if (containsAuthenticationField(value) || (typeof value.metadata === "object" && value.metadata && containsAuthenticationField(value.metadata))) {
    return invalid("AUTHENTICATION_FIELD_FORBIDDEN", "Person must not carry authentication fields.");
  }
  if (containsPersonalData(value) || (typeof value.metadata === "object" && value.metadata && containsPersonalData(value.metadata))) {
    return invalid("PERSONAL_DATA_FORBIDDEN", "Person must not carry private personal data.");
  }
  const actor = validateActor(value.actor, "PERSON");
  if (actor.status !== "valid") return invalid("INVALID_ACTOR", `Person actor is invalid: ${actor.error?.code ?? "INVALID_ACTOR"}.`);
  if (value.legalEmployerReference !== null && !validText(value.legalEmployerReference)) {
    return invalid("INVALID_LEGAL_EMPLOYER_REFERENCE", "legalEmployerReference is invalid.");
  }
  if (!value.organizationalUnitReferences.every(validText)
    || new Set(value.organizationalUnitReferences).size !== value.organizationalUnitReferences.length) {
    return invalid("INVALID_ORGANIZATIONAL_UNIT_REFERENCE", "Organizational unit references are invalid or duplicated.");
  }
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
