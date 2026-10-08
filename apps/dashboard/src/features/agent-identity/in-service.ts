/*
 * agent-identity/in-service.ts — THE one definition of "this durable agent is in service" (L-1a).
 *
 * Before L-1a the rule was written out by hand in six places, and every copy said the same thing:
 * not retired. That made every lifecycle value with no writer — `suspended`, `paused`, `replaced`,
 * `archived`, … — silently count as IN service, and it left `suspended_at` unread anywhere. Nothing
 * writes those values today, so nothing was wrong in production; but the first suspension writer
 * would have suspended nothing.
 *
 * The rule is now an ALLOWLIST. An agent is in service only when ALL of these hold:
 *   · `retired_at` IS NULL
 *   · `suspended_at` IS NULL
 *   · `agent_lifecycle_status` IS NULL (every identity registered so far) OR is 'active'
 * Any other value — including a lifecycle state added to the enum later — is out of service until a
 * phase deliberately says otherwise. Unknown is never in service.
 *
 * Pure and write-free: no database handle, no insert/update/delete, no transaction. It only states
 * the rule, as a value predicate and as the equivalent SQL condition, so the identity reader, the
 * runtime liveness seam, the mandate writer, the placement authority and the approval boundary ask
 * the same question in the same words. Lifecycle WRITERS stay where they are (register, retire);
 * this module cannot change any agent's state.
 *
 * NOT aligned on purpose: the `agents_tenant_name_in_service_uq` index predicate. It frees a name only
 * on retirement, so a suspended agent keeps its name. That is a uniqueness rule, not a liveness rule.
 */
import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import { agents } from "@/db/schema/agent";

/** The only explicit lifecycle value that is in service. NULL (never set) is the other. */
export const IN_SERVICE_AGENT_LIFECYCLE_STATUS = "active" as const;

/** The three facts the rule reads. Every caller selects all three; none may be left out. */
export interface AgentServiceFacts {
  readonly retiredAt: Date | string | null;
  readonly suspendedAt: Date | string | null;
  readonly lifecycle: string | null;
}

/** Strict `=== null`: a fact that was not read (undefined) is not "absent", so it is not in service. */
export function isAgentInService(facts: AgentServiceFacts): boolean {
  return (
    facts.retiredAt === null &&
    facts.suspendedAt === null &&
    (facts.lifecycle === null || facts.lifecycle === IN_SERVICE_AGENT_LIFECYCLE_STATUS)
  );
}

/** The same rule as a SQL condition over `agents`, for a guarded UPDATE's WHERE clause. */
export function agentInServiceCondition(): SQL {
  return and(
    isNull(agents.retiredAt),
    isNull(agents.suspendedAt),
    or(isNull(agents.agentLifecycleStatus), eq(agents.agentLifecycleStatus, IN_SERVICE_AGENT_LIFECYCLE_STATUS)),
  ) as SQL;
}
