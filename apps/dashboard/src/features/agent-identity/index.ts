/*
 * AGENT-ID-0 — durable, human-owned agent identity.
 *
 * One authority, one transition. The barrel exports no update, delete, archive, restore, activate,
 * authenticate or authorize surface, because no such surface exists in this feature.
 */
export {
  MAX_AGENT_NAME_LENGTH,
  isWellFormedAgentName,
  type AgentIdentityRefusal,
  type CreateDurableAgentIdentityResult,
  type DurableAgentIdentity,
} from "./contracts";
export {
  createDurableAgentIdentity,
  type AgentIdentityDeps,
} from "./create-durable-agent-identity.server";
