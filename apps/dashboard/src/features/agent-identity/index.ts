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
 * activate, authenticate or authorize surface, because no such surface exists in this feature. The
 * two transitions are one-way: nothing here returns a retired identity to service, and nothing here
 * reopens the genesis one-shot a retirement leaves spent.
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
  readDurableAgentIdentityState,
  type AgentIdentityReadDeps,
  type DurableAgentIdentityRecord,
  type DurableAgentIdentityState,
} from "./read-durable-agent-identity.server";
