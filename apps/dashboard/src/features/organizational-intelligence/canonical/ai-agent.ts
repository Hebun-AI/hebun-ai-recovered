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

export const AI_AGENT_VERSION = "ai-agent/v1";

export const AI_AGENT_CLASSIFICATIONS = ["assistant", "autonomous", "supervisor", "specialist", "custom"] as const;
export type AIAgentClassification = (typeof AI_AGENT_CLASSIFICATIONS)[number];

export const AI_AGENT_ERROR_CODES = [
  "INVALID_AI_AGENT",
  "INVALID_ACTOR",
  "INVALID_CLASSIFICATION",
  "INVALID_RUNTIME_REFERENCE",
  "INVALID_MODEL_REFERENCE",
  "EXECUTION_FIELD_FORBIDDEN",
  "AUTHENTICATION_FIELD_FORBIDDEN",
  "INVALID_METADATA",
  "IMMUTABILITY_VIOLATION",
] as const;
export type AIAgentErrorCode = (typeof AI_AGENT_ERROR_CODES)[number];

/**
 * A non-human worker identity — NOT an executable agent runtime. It executes
 * nothing, calls no model or tool, schedules no work, and makes no network
 * request. runtimeIdentityReference and modelReference are inert strings only;
 * they name a future runtime identity, they do not bind to one.
 */
export interface AIAgent {
  readonly actor: Actor;
  readonly classification: AIAgentClassification;
  readonly runtimeIdentityReference: string | null;
  readonly modelReference: string | null;
  readonly metadata: Readonly<Record<string, MetadataValue>>;
  readonly architectureVersion: typeof AI_AGENT_VERSION;
  readonly executable: false;
  readonly authoritative: false;
}

export interface AIAgentValidationError {
  readonly code: AIAgentErrorCode;
  readonly message: string;
}

export interface AIAgentValidation {
  readonly status: "valid" | "invalid";
  readonly error?: AIAgentValidationError;
  readonly executable: false;
  readonly authoritative: false;
}

const AI_AGENT_KEYS = [
  "actor", "classification", "runtimeIdentityReference", "modelReference", "metadata",
  "architectureVersion", "executable", "authoritative",
] as const;
/** Anything that would turn this declarative worker identity into an executor. */
const FORBIDDEN_EXECUTION_KEYS = [
  "execute", "run", "invoke", "dispatch", "callback", "handler", "prompt", "systemprompt",
  "tools", "toolcalls", "apikey", "endpoint", "url", "schedule", "cron", "webhook",
];

function invalid(code: AIAgentErrorCode, message: string): AIAgentValidation {
  return deepFreeze({ status: "invalid" as const, error: { code, message }, executable: false as const, authoritative: false as const });
}

function containsExecutionField(value: object): boolean {
  const lowerKeys = Object.keys(value).map((key) => key.toLowerCase());
  return FORBIDDEN_EXECUTION_KEYS.some((forbidden) => lowerKeys.includes(forbidden));
}

export function createAIAgent(input: Omit<AIAgent, "architectureVersion" | "actor"> & {
  readonly actor: Omit<Actor, "architectureVersion" | "identity"> & { readonly identity: Omit<OrganizationalIdentity, "architectureVersion"> };
}): AIAgent {
  const { actor: rawActor, ...rawRest } = input;
  const actor = createActor({ ...rawActor, actorType: "AI_AGENT" });
  const rest = copy(rawRest) as unknown as Omit<AIAgent, "architectureVersion" | "actor">;
  if (rest.executable !== false || rest.authoritative !== false) throw new TypeError("Invalid AI Agent.");
  return deepFreeze({ ...rest, actor, architectureVersion: AI_AGENT_VERSION });
}

export function validateAIAgent(value: AIAgent): AIAgentValidation {
  if (!value || typeof value !== "object" || value.architectureVersion !== AI_AGENT_VERSION || !value.actor) {
    return invalid("INVALID_AI_AGENT", "AI Agent structure or schema is invalid.");
  }
  if (![value].every(inert) || !immutableData(value) || !hasOnlyKeys(value, AI_AGENT_KEYS)) {
    return invalid("IMMUTABILITY_VIOLATION", "AI Agent must be immutable inert metadata.");
  }
  if (containsExecutionField(value) || (typeof value.metadata === "object" && value.metadata && containsExecutionField(value.metadata))) {
    return invalid("EXECUTION_FIELD_FORBIDDEN", "AI Agent must remain declarative and carry no execution fields.");
  }
  if (containsAuthenticationField(value) || (typeof value.metadata === "object" && value.metadata && containsAuthenticationField(value.metadata))) {
    return invalid("AUTHENTICATION_FIELD_FORBIDDEN", "AI Agent must not carry authentication fields.");
  }
  const actor = validateActor(value.actor, "AI_AGENT");
  if (actor.status !== "valid") return invalid("INVALID_ACTOR", `AI Agent actor is invalid: ${actor.error?.code ?? "INVALID_ACTOR"}.`);
  if (!(AI_AGENT_CLASSIFICATIONS as readonly string[]).includes(value.classification)) {
    return invalid("INVALID_CLASSIFICATION", "classification is invalid.");
  }
  if (value.runtimeIdentityReference !== null && !validText(value.runtimeIdentityReference)) {
    return invalid("INVALID_RUNTIME_REFERENCE", "runtimeIdentityReference is invalid.");
  }
  if (value.modelReference !== null && !validText(value.modelReference)) {
    return invalid("INVALID_MODEL_REFERENCE", "modelReference is invalid.");
  }
  if (!validMetadata(value.metadata)) return invalid("INVALID_METADATA", "Metadata is invalid.");
  return deepFreeze({ status: "valid" as const, executable: false as const, authoritative: false as const });
}
