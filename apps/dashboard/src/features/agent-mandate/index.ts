/*
 * AMA-1 — the Agent Mandate Authority.
 *
 * ONE authority, ONE transition, and no second:
 *
 *     no effective mandate / revision N  ->  revision N+1   (establishAgentMandate)
 *
 * Plus two reads that grant nothing.
 *
 * The barrel exports no update, no delete, no withdraw, no enforce, no apply, no allow and no
 * check surface, because no such surface exists in this feature. Withdrawal is a revision whose
 * scope is empty — the same one transition. Enforcement is AMA-2 and lives nowhere yet.
 *
 *   AGENT IDENTITY  != AGENT MANDATE
 *   AGENT MANDATE   != CAPABILITY
 *   AGENT MANDATE   != GOVERNANCE AUTHORIZATION
 *   AGENT MANDATE   != PERMIT
 *   AGENT MANDATE   != EXECUTION
 */
export {
  AGENT_MANDATE_AUDIT_ACTIONS,
  AGENT_MANDATE_AUDIT_ESTABLISHED,
  AGENT_MANDATE_AUDIT_REVISED,
  AGENT_MANDATE_AUTHORITY_BOUNDARY,
  AGENT_MANDATE_BOUNDED_OUTCOME,
  AGENT_MANDATE_DECISION_TYPE,
  AGENT_MANDATE_DOMAIN,
  AGENT_MANDATE_ENTITY_TYPE,
  AGENT_MANDATE_SUBJECT_TYPE,
  FIRST_MANDATE_REVISION,
  MANDATE_CAPABILITY_LADDER,
  MANDATE_DOES_NOT_MEAN,
  MANDATE_SCOPE_VOCABULARY,
  MAX_MANDATE_PURPOSE_CHARACTERS,
  MIN_MANDATE_PURPOSE_CHARACTERS,
  canonicaliseMandateScope,
  isMandateScopeKind,
  type AgentMandateAuditAction,
  type AgentMandateRefusal,
  type EstablishAgentMandateResult,
  type EstablishedAgentMandate,
  type MandateScopeKind,
} from "./contracts";
export {
  establishAgentMandate,
  type EstablishAgentMandateDeps,
} from "./establish-agent-mandate.server";
export {
  DEFAULT_MANDATE_HISTORY_LIMIT,
  readAgentMandateHistory,
  readEffectiveAgentMandate,
  type AgentMandateHistoryRead,
  type AgentMandateReadDeps,
  type AgentMandateRevision,
  type EffectiveAgentMandateRead,
} from "./read-agent-mandate.server";
