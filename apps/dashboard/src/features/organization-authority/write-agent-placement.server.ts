/*
 * organization-authority/write-agent-placement.server.ts — AGENT PLACEMENT (AP-2).
 *
 * The Organization Authority's writer for WHICH DEPARTMENT AN AGENT IS PLACED IN. Two acts:
 *
 *     unplaced | placed  ->  placed in an in-service department      setAgentPlacement   (T1, T2)
 *     placed             ->  unplaced                                withdrawAgentPlacement (T3)
 *
 * ── COLUMN-SCOPED ────────────────────────────────────────────────────────────
 *
 * It writes ONE table, `agents`, and only the columns in `AGENT_PLACEMENT_WRITABLE_COLUMNS` —
 * `department_id` plus the provenance every governed write advances. It never inserts an agent,
 * never touches identity, lifecycle, mandate, capability or tool fields, and never writes
 * `departments`, `department_placements`, `memberships` or `decision_records`. A firewall asserts
 * the `.set({...})` below, and a database test diffs a real row.
 *
 * ── THE GATE ─────────────────────────────────────────────────────────────────
 *
 * The tenant's Governance authority holder (bootstrap human or active delegate), through
 * `resolveGovernanceAuthority` — the same gate the department and human-placement writers use, and
 * consumed the same way: permission to write structure, never a decision. Owning the agent is not
 * enough. The only identity parameter is a `TenantContext`, minted by the human session runtime, so
 * an agent has no representation in which it could place itself.
 *
 * ── WHAT THE DATABASE PROVES, AND WHAT THIS FILE MUST ────────────────────────
 *
 * `agents_tenant_department_fk` proves same-tenant and existence. It does NOT refuse a retired
 * department or a retired agent, and the KEY SHARE lock the FK check takes does not block a
 * department retirement (a non-key UPDATE). Measured in the AP-2 gate. So, in one transaction:
 *
 *   1. the agent row FOR UPDATE      — serializes with retirement and with any other placement act
 *   2. retired agent → `agent-retired`
 *   3. compare-and-swap on the placement the caller was shown → `placement-changed`
 *   4. no-op → `already-placed` / `not-placed`, with NO write, NO version and NO audit
 *   5. the target department FOR SHARE — blocks a concurrent retirement until commit; a retirement
 *      that committed first is seen here and refused `department-retired`
 *   6. the UPDATE, re-stating the retired and CAS predicates (re-evaluated after the row lock)
 *   7. the audit row, in the same transaction
 *
 * Department retirement is NOT changed by this file and does not cascade into placements (T7).
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import { departments } from "@/db/schema/department";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import { recordAgentPlacementEventWithin } from "@/features/governance-audit/agent-placement-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { ACTIVE_LIFECYCLE_STATUS } from "./read-structure.server";
import {
  AGENT_PLACEMENT_AUDIT_SET,
  AGENT_PLACEMENT_AUDIT_WITHDRAWN,
  type AgentPlacementRefusal,
  type AgentPlacementWriteResult,
} from "./agent-placement-contracts";

/* Spelled here rather than imported: this writer must not reach the Agent Identity authority. */
const RETIRED_AGENT = "retired";
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_SHAPE.test(value);

export interface AgentPlacementWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
  /** Test seam: awaited after every lock is held and before the write. Never set in product code. */
  readonly afterLock?: () => Promise<void>;
}

const refuse = (reason: AgentPlacementRefusal): AgentPlacementWriteResult => ({
  status: "refused",
  reason,
});

function resolveDbOrNull(deps: AgentPlacementWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * PLACE an in-service agent in an in-service department, or MOVE it there (T1, T2, and T3's move
 * out of a retired department). `expectedDepartmentId` is the placement the human was shown —
 * `null` for "unplaced" — and anything else on record is refused, never overwritten.
 */
export function setAgentPlacement(
  tenant: TenantContext | null,
  input: {
    readonly agentId: string;
    readonly departmentId: string;
    readonly expectedDepartmentId: string | null;
  },
  deps: AgentPlacementWriteDeps = {},
): Promise<AgentPlacementWriteResult> {
  return mutatePlacement(tenant, input, input?.departmentId ?? "", deps);
}

/** WITHDRAW an in-service agent's placement (T3), including out of a retired department. */
export function withdrawAgentPlacement(
  tenant: TenantContext | null,
  input: { readonly agentId: string; readonly expectedDepartmentId: string | null },
  deps: AgentPlacementWriteDeps = {},
): Promise<AgentPlacementWriteResult> {
  return mutatePlacement(tenant, input, null, deps);
}

async function mutatePlacement(
  tenant: TenantContext | null,
  input: { readonly agentId: string; readonly expectedDepartmentId: string | null },
  target: string | null,
  deps: AgentPlacementWriteDeps,
): Promise<AgentPlacementWriteResult> {
  if (typeof window !== "undefined") throw new Error("Agent placement writes are server-only.");

  /* ORDER IS THE GUARANTEE — authorization before any subject is looked at. */
  if (!tenant?.tenantId || !tenant.userId) return refuse("no-authorized-tenant-context");
  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return refuse("not-authorized");
  const db = resolveDbOrNull(deps);
  if (!db) return refuse("authority-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const agentId = input?.agentId;
  const expected = input?.expectedDepartmentId ?? null;
  if (!isUuid(agentId)) return refuse("agent-unresolved");
  if (target !== null && !isUuid(target)) return refuse("department-unresolved");
  /* A malformed expectation can equal no recorded placement. */
  if (expected !== null && !isUuid(expected)) return refuse("placement-changed");

  try {
    let outcome: AgentPlacementWriteResult | null = null;

    await db.transaction(async (tx) => {
      const agentRows = await tx
        .select({
          departmentId: agents.departmentId,
          retiredAt: agents.retiredAt,
          lifecycle: agents.agentLifecycleStatus,
        })
        .from(agents)
        .where(and(eq(agents.tenantId, tenant.tenantId), eq(agents.id, agentId)))
        .for("update")
        .limit(1);

      const agent = agentRows[0];
      if (!agent) {
        outcome = refuse("agent-unresolved");
        return;
      }
      if (agent.retiredAt !== null || agent.lifecycle === RETIRED_AGENT) {
        outcome = refuse("agent-retired");
        return;
      }
      const current = agent.departmentId;
      if (current !== expected) {
        outcome = refuse("placement-changed");
        return;
      }
      if (current === target) {
        outcome = refuse(target === null ? "not-placed" : "already-placed");
        return;
      }

      if (target !== null) {
        const departmentRows = await tx
          .select({ lifecycleStatus: departments.lifecycleStatus })
          .from(departments)
          .where(and(eq(departments.tenantId, tenant.tenantId), eq(departments.id, target)))
          .for("share")
          .limit(1);
        const department = departmentRows[0];
        if (!department) {
          outcome = refuse("department-unresolved");
          return;
        }
        if (department.lifecycleStatus !== ACTIVE_LIFECYCLE_STATUS) {
          outcome = refuse("department-retired");
          return;
        }
      }

      await deps.afterLock?.();

      const updated = await tx
        .update(agents)
        .set({
          departmentId: target,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
          version: sql`${agents.version} + 1`,
        })
        .where(
          and(
            eq(agents.tenantId, tenant.tenantId),
            eq(agents.id, agentId),
            isNull(agents.retiredAt),
            sql`${agents.agentLifecycleStatus} is distinct from ${RETIRED_AGENT}`,
            sql`${agents.departmentId} is not distinct from ${expected}::uuid`,
          ),
        )
        .returning({ id: agents.id });

      if (updated.length !== 1) {
        outcome = refuse("placement-changed");
        return;
      }

      await recordAgentPlacementEventWithin(
        tx,
        auditActorFrom(tenant),
        {
          action: target === null ? AGENT_PLACEMENT_AUDIT_WITHDRAWN : AGENT_PLACEMENT_AUDIT_SET,
          agentId,
          previousDepartmentId: current,
          departmentId: target,
        },
        now,
      );

      outcome = {
        status: target === null ? "withdrawn" : "recorded",
        placement: { agentId, previousDepartmentId: current, departmentId: target },
      };
    });

    return outcome ?? refuse("authority-unavailable");
  } catch {
    return refuse("authority-unavailable");
  }
}
