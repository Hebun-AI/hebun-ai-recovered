/*
 * AGENT-PROPOSAL-1 — bounded action origination by a durable agent.
 *
 * The barrel exports ONE capability and no second one: an agent may originate a proposal. There is
 * no approve, authorize, permit, execute, send, dispatch, schedule, retry or loop surface here,
 * because no such function exists in this feature.
 *
 * The server-only modules are imported by path, not re-exported, so a client component that
 * imported this barrel could not pull a database handle or a provider transport into a bundle.
 */
export {
  AGENT_ORIGINABLE_ACTION_KINDS,
  MAX_CANDIDATES_PER_KIND,
  MAX_ORIGINATION_REASON_LENGTH,
  NO_ACTION_KIND,
  SEND_ORIGINATION_ALIAS,
  type AgentActionSelection,
  type AgentOriginableActionKind,
  type OriginationCandidate,
  type OriginationCandidateSet,
  type OriginationRefusal,
  type ParseAgentSelectionResult,
  type StructuredOutputRefusal,
} from "./contracts";
export { parseAgentActionSelection } from "./structured-output";
