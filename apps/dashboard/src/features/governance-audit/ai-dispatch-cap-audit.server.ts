/*
 * governance-audit/ai-dispatch-cap-audit.server.ts — the AP-3 dispatch safety cap's audit sibling.
 *
 * It does two things on the SHARED sink and nothing else:
 *   - COUNTS the charge the model cap is measured in: `external-ai.disclosure.authorized` rows for one
 *     tenant inside one window (it reads; the evidence itself is written by its own sibling);
 *   - APPENDS the cap's refusal, `ai-dispatch-cap.refused`. A different action, so it is never counted.
 *
 * It decides nothing: whether the cap is reached is the cap's judgement, made before this is called.
 * No prompt, provider content or credential exists in the refusal shape, so none can be written.
 */
import { randomUUID } from "node:crypto";
import { and, count, eq, gte, lt, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { auditLog } from "@/db/schema/audit-log";
import { processorAttestations } from "@/db/schema/external-ai-data-use";
import { EXTERNAL_AI_DISCLOSURE_AUTHORIZED } from "./external-ai-disclosure-audit.server";

export const AI_DISPATCH_CAP_REFUSED = "ai-dispatch-cap.refused";
export const AI_DISPATCH_CAP_ENTITY_TYPE = "ai-dispatch-safety-cap";
export const AI_DISPATCH_CAP_AUDIT_SOURCE = "ai-dispatch-safety-cap";

/** Authorized model disclosures for this tenant in [start, end). The tenant is in the WHERE. */
export async function countAuthorizedDisclosuresInWindow(
  db: ControlPlaneDatabase,
  tenantId: string,
  window: { readonly start: Date; readonly end: Date },
  /**
   * P5-4 (D3) — `platform` counts only disclosures sent on the platform account: a disclosure whose
   * recorded `accountRef` is one of THIS tenant's own attested accounts (its BYOK key) is left out.
   */
  scope: "all" | "platform" = "all",
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.tenantId, tenantId),
        eq(auditLog.action, EXTERNAL_AI_DISCLOSURE_AUTHORIZED),
        gte(auditLog.occurredAt, window.start),
        lt(auditLog.occurredAt, window.end),
        scope === "platform"
          ? sql`coalesce(${auditLog.metadata}->>'accountRef', '') not in (select ${processorAttestations.accountRef} from ${processorAttestations} where ${processorAttestations.ownerTenantId} = ${tenantId})`
          : undefined,
      ),
    );
  return Number(row?.n ?? 0);
}

export interface AiDispatchCapRefusal {
  readonly tenantId: string;
  readonly actorUserId: string;
  readonly correlationId: string | null;
  readonly occurredAt: Date;
  readonly dispatchClass: "model" | "media";
  readonly capPerTenantUtcDay: number;
  readonly admittedInWindow: number;
  readonly windowStart: Date;
}

/** One row per refusal. Returns whether it is durable; never throws. */
export async function recordAiDispatchCapRefusal(db: ControlPlaneDatabase, refusal: AiDispatchCapRefusal): Promise<boolean> {
  if (typeof window !== "undefined") throw new Error("AI dispatch cap audit is server-only.");
  try {
    await db.insert(auditLog).values({
      tenantId: refusal.tenantId,
      actorType: "human",
      actorId: refusal.actorUserId,
      action: AI_DISPATCH_CAP_REFUSED,
      entityType: AI_DISPATCH_CAP_ENTITY_TYPE,
      entityId: randomUUID(),
      correlationId: refusal.correlationId,
      occurredAt: refusal.occurredAt,
      metadata: {
        dispatchClass: refusal.dispatchClass,
        capPerTenantUtcDay: refusal.capPerTenantUtcDay,
        admittedInWindow: refusal.admittedInWindow,
        windowStart: refusal.windowStart.toISOString(),
      },
      result: "rejected",
      simulation: false,
      source: AI_DISPATCH_CAP_AUDIT_SOURCE,
      authoritySource: "system",
    });
    return true;
  } catch {
    return false;
  }
}
