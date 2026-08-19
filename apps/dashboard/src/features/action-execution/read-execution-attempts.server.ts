/*
 * action-execution/read-execution-attempts.server.ts — what the Director surface may show about
 * attempts (R3B).
 *
 * TENANT-SCOPED BY PREDICATE, NOT BY CALLER DISCIPLINE. Every query carries
 * `tenant_id = <session tenant>`; there is no unscoped read and no parameter through which a
 * caller could ask about another tenant.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module.
 *
 * Server-only.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionExecutionAttempts } from "@/db/schema/action-execution";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { toExecutionAttemptView, type ExecutionAttemptRow } from "./attempt-view";
import type { ExecutionAttemptView } from "./contracts";

export type ExecutionAttemptRead =
  | { readonly status: "read"; readonly items: readonly ExecutionAttemptView[] }
  | { readonly status: "unavailable"; readonly reason: string };

export interface ExecutionAttemptReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly limit?: number;
}

/** Every execution attempt this tenant has made, newest first. */
export async function readExecutionAttempts(
  tenant: TenantContext | null,
  deps: ExecutionAttemptReadDeps = {},
): Promise<ExecutionAttemptRead> {
  if (typeof window !== "undefined") throw new Error("Execution attempt reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select()
      .from(actionExecutionAttempts)
      .where(eq(actionExecutionAttempts.tenantId, tenant.tenantId))
      .orderBy(desc(actionExecutionAttempts.startedAt))
      .limit(deps.limit ?? 50);
    return {
      status: "read",
      items: (rows as ExecutionAttemptRow[]).map(toExecutionAttemptView),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * The attempts a Director must look at by hand.
 *
 * `unknown` because the provider may hold a request nobody can confirm, and `pending` because a
 * row that never reached a terminal state means the process died mid-flight — which is the same
 * ambiguity wearing a different hat. Neither can be resolved by retrying, and no worker exists to
 * resolve them automatically. This read is the reconciliation surface, and it is deliberately a
 * list for a human rather than an input to a machine.
 */
export async function readUnreconciledAttempts(
  tenant: TenantContext | null,
  deps: ExecutionAttemptReadDeps = {},
): Promise<ExecutionAttemptRead> {
  if (typeof window !== "undefined") throw new Error("Execution attempt reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select()
      .from(actionExecutionAttempts)
      .where(
        and(
          eq(actionExecutionAttempts.tenantId, tenant.tenantId),
          inArray(actionExecutionAttempts.status, ["unknown", "pending"]),
        ),
      )
      .orderBy(desc(actionExecutionAttempts.startedAt))
      .limit(deps.limit ?? 50);
    return {
      status: "read",
      items: (rows as ExecutionAttemptRow[]).map(toExecutionAttemptView),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
