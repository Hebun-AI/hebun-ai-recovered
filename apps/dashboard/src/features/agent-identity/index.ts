/*
 * AGENT-ID-0 / AGENT-ID-0.1 — durable, human-owned agent identity and its retirement.
 *
 * TWO authorities, TWO transitions, and no third:
 *
 *     nonexistent   ->  durable human-owned identity   (AGENT-ID-0,   createDurableAgentIdentity)
 *     in service    ->  retired                        (AGENT-ID-0.1, retireDurableAgentIdentity)
 *
 * Plus one read that grants nothing.
 *
 * The barrel exports no update, rename, delete, archive, restore, reinstate, suspend, succeed,
 * activate, authenticate or authorize surface, because no such surface exists in this feature.
 * Retirement is one-way: nothing here returns a retired identity to service. Since AP-1 each
 * registration is its own Governance decision (`agent-registration`), so a tenant may hold more than
 * one identity; a retired name may be registered again as a NEW identity with a new agentId.
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
export {
  isDurableAgentIdentityId,
  RETIRED_AGENT_LIFECYCLE_STATUS,
  type AgentRetirementRefusal,
  type RetireDurableAgentIdentityResult,
  type RetiredAgentIdentity,
} from "./retirement-contracts";
export {
  retireDurableAgentIdentity,
  type AgentRetirementDeps,
} from "./retire-durable-agent-identity.server";
export {
  AGENT_SERVICE_STATUS_LABEL,
  AGENT_SERVICE_STATUSES,
  agentServiceSentence,
  agentServiceStatus,
  type AgentServiceStatus,
} from "./service-status";
export {
  agentInServiceCondition,
  IN_SERVICE_AGENT_LIFECYCLE_STATUS,
  isAgentInService,
  type AgentServiceFacts,
} from "./in-service";
export {
  readDurableAgentIdentityState,
  type AgentIdentityReadDeps,
  type DurableAgentIdentityRecord,
  type DurableAgentIdentityState,
} from "./read-durable-agent-identity.server";
