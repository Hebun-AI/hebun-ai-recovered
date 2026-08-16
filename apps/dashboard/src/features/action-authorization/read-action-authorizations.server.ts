/*
 * action-authorization/read-action-authorizations.server.ts — what the Director surface may show
 * (R3A).
 *
 * TENANT-SCOPED BY PREDICATE, NOT BY CALLER DISCIPLINE. Every query here carries
 * `tenant_id = <session tenant>`; there is no unscoped read and no parameter through which a
 * caller could ask about another tenant.
 *
 * EXPIRY IS COMPUTED HERE, NOT STORED. `expires_at <= now()` is the whole mechanism, so a permit
 * that is `active` in the column and past its expiry is reported as expired. The surface must show
 * the derived truth, because that is the truth consumption will apply.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import { asCanonicalPayload } from "./canonical-payload";

/** The derived state a human is shown. `expired` exists here and nowhere in the database. */
export type PermitDisplayState = "active" | "expired" | "consumed" | "revoked" | "none";

export interface PendingActionRequestView {
  readonly requestId: string;
  readonly actionKind: string;
  readonly toolId: string;
  readonly sideEffect: string;
  readonly reversibility: string;
  readonly targetKind: string | null;
  readonly targetRef: string | null;
  readonly targetLabel: string | null;
  readonly expectedEffect: string;
  readonly consequences: readonly string[];
  readonly parameters: readonly { readonly name: string; readonly value: string }[];
  readonly payloadDigest: string;
  readonly proposedAt: string;
}

export interface ActionPermitView {
  readonly permitId: string;
  readonly requestId: string;
  readonly actionKind: string;
  readonly toolId: string;
  readonly targetLabel: string | null;
  readonly state: PermitDisplayState;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
  readonly boundPayloadDigest: string;
  /** Always false in R3A. Carried so the surface can state it rather than imply it. */
  readonly executed: false;
}

export type ActionAuthorizationRead<T> =
  | { readonly status: "read"; readonly items: readonly T[] }
  | { readonly status: "unavailable"; readonly reason: string };

function toParameters(raw: unknown): readonly { name: string; value: string }[] {
  const payload = asCanonicalPayload(raw);
  if (!payload) return [];
  return Object.keys(payload)
    .sort()
    .map((name) => ({ name, value: String(payload[name]) }));
}

function toConsequences(raw: unknown): readonly string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Every action still awaiting a human decision in this tenant. */
export async function readPendingActionRequests(
  tenant: TenantContext | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<ActionAuthorizationRead<PendingActionRequestView>> {
  if (typeof window !== "undefined") throw new Error("Action authorization reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select()
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.status, "pending"),
        ),
      )
      .orderBy(desc(hebyActionRequests.createdAt))
      .limit(deps.limit ?? 50);

    return {
      status: "read",
      items: rows.map((row) => ({
        requestId: row.id,
        actionKind: row.actionKind,
        toolId: row.toolId,
        sideEffect: row.sideEffect,
        reversibility: row.reversibility,
        targetKind: row.targetKind,
        targetRef: row.targetRef,
        targetLabel: row.targetLabel,
        expectedEffect: row.expectedEffect,
        consequences: toConsequences(row.consequences),
        parameters: toParameters(row.canonicalPayload),
        payloadDigest: row.payloadDigest,
        proposedAt: iso(row.createdAt) ?? "",
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/** Every permit this tenant holds, with expiry derived at read time. */
export async function readActionPermits(
  tenant: TenantContext | null,
  deps: {
    readonly getDb?: () => ControlPlaneDatabase | null;
    readonly limit?: number;
    readonly now?: () => Date;
  } = {},
): Promise<ActionAuthorizationRead<ActionPermitView>> {
  if (typeof window !== "undefined") throw new Error("Action authorization reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .select({
        permit: actionPermits,
        actionKind: hebyActionRequests.actionKind,
        toolId: hebyActionRequests.toolId,
        targetLabel: hebyActionRequests.targetLabel,
      })
      .from(actionPermits)
      .innerJoin(
        hebyActionRequests,
        and(
          eq(actionPermits.actionRequestId, hebyActionRequests.id),
          eq(actionPermits.tenantId, hebyActionRequests.tenantId),
        ),
      )
      .where(eq(actionPermits.tenantId, tenant.tenantId))
      .orderBy(desc(actionPermits.issuedAt))
      .limit(deps.limit ?? 50);

    return {
      status: "read",
      items: rows.map(({ permit, actionKind, toolId, targetLabel }) => ({
        permitId: permit.id,
        requestId: permit.actionRequestId,
        actionKind,
        toolId,
        targetLabel,
        state: derivePermitState(permit.status, permit.expiresAt, now),
        issuedAt: iso(permit.issuedAt) ?? "",
        expiresAt: iso(permit.expiresAt) ?? "",
        consumedAt: iso(permit.consumedAt),
        revokedAt: iso(permit.revokedAt),
        revocationReason: permit.revocationReason,
        boundPayloadDigest: permit.boundPayloadDigest,
        executed: false as const,
      })),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * The derived display state.
 *
 * `consumed` and `revoked` are terminal and outrank the clock: a permit that was spent before it
 * expired was spent, and saying "expired" afterwards would misreport what happened.
 */
export function derivePermitState(
  status: string,
  expiresAt: Date | string,
  now: Date,
): PermitDisplayState {
  if (status === "consumed") return "consumed";
  if (status === "revoked") return "revoked";
  if (status !== "active") return "none";
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= now.getTime() ? "expired" : "active";
}
