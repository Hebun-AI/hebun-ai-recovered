/*
 * action-authorization/declare-action-purpose.server.ts — WHICH WORK THIS ACT SERVES (PBGA-1).
 *
 * ── THE ONE FACT THIS MODULE WRITES ──────────────────────────────────────────
 *
 *   "A HUMAN DECLARED THAT THIS ACTION REQUEST SERVES THAT WORK ITEM."
 *
 * A person filed an act — a send, a record-work — and says what organizational purpose it is for,
 * so the human who decides about it knows what they are authorizing it toward. Nothing here is
 * derived, matched, scored or inferred, and no model can reach it.
 *
 * ── WHAT IT IS NOT, AND MAY NEVER BECOME ─────────────────────────────────────
 *
 *   PURPOSE != EVIDENCE          it does not satisfy, fail or refresh evidence sufficiency
 *   PURPOSE != PROGRESS          declaring an act serves work moves that work not at all
 *   PURPOSE != COMPLETION        nor toward it
 *   PURPOSE != AUTHORIZATION     a purpose authorizes nothing; a human still decides
 *   PURPOSE != NECESSITY         "serves" is what a person said, not that the work needs it
 *
 * It creates NO Governance decision, NO permit, NO execution and NO Work mutation. It imports no
 * decision writer, no permit writer, no executor and no Work writer, and a firewall walks the real
 * import graph to prove it.
 *
 * ── PRE-DECISION ONLY, AND `pending` IS THAT PREDICATE ───────────────────────
 *
 * The released table settles this rather than this module choosing: `heby_action_requests_approved_chk`
 * and `_rejected_chk` both key off `status`, and `heby_action_requests_one_pending_per_digest_uq`
 * treats `status = 'pending'` as the live state. So `pending` IS the authoritative pre-decision
 * predicate, and it is used verbatim.
 *
 * A human must never approve "action X for work A" and later find the record says work B. Once the
 * request crosses the decision boundary the declaration is frozen — enforced by the same predicate
 * in the UPDATE's own WHERE clause, so a concurrent approval cannot be raced past it.
 *
 * ── REBINDING IS REFUSED, NOT OVERWRITTEN ────────────────────────────────────
 *
 *   unbound  → work A     allowed
 *   work A   → work A     idempotent, writes nothing
 *   work A   → work B     REFUSED
 *
 * Silently replacing one purpose with another would destroy the only record that the first was ever
 * declared, and this table has no withdrawal shape to hold that history. Refusing keeps the
 * declaration a statement someone made rather than a field someone edits.
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { recordActionAuthorizationEventWithin } from "@/features/governance-audit/action-authorization-audit.server";
import { ACTION_AUDIT_PURPOSE_DECLARED } from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DeclareActionPurposeDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

export interface DeclareActionPurposeInput {
  readonly requestId: string;
  /** The work item this request is declared to serve. */
  readonly workItemId: string;
}

/**
 * Every way this can honestly fail.
 *
 * `request-not-found` covers absent, foreign-tenant and malformed with ONE answer, so a probe
 * cannot use the difference between refusals to discover that a request exists in a tenant the
 * caller cannot see — the arrangement R3A.1's inlet already uses. The states that ARE kept apart
 * are the ones a person can act on: a decided request and an already-bound one are real, visible
 * facts the operator can respond to.
 */
export type DeclareActionPurposeRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "persistence-unavailable"
  | "request-not-found"
  | "request-not-pending"
  | "already-declared-for-other-work"
  | "purpose-work-not-found";

export type DeclareActionPurposeResult =
  | {
      readonly status: "declared";
      readonly requestId: string;
      readonly workItemId: string;
      readonly declaredAt: string;
      /** True when the declaration already stood and nothing was written. */
      readonly idempotent: boolean;
    }
  | { readonly status: "refused"; readonly reason: DeclareActionPurposeRefusal };

const refused = (reason: DeclareActionPurposeRefusal): DeclareActionPurposeResult => ({
  status: "refused",
  reason,
});

/**
 * PostgreSQL `foreign_key_violation`. Read from the driver's CODE, never from the message text.
 *
 * IT WALKS `cause`. Inside `db.transaction`, drizzle wraps the driver error, so the code this
 * function needs is one level down — a check that only looked at the top object would classify a
 * genuine cross-tenant refusal as a persistence failure, which is the difference between telling an
 * operator "that work is not yours" and telling them the database is broken. A test proves it.
 */
function isForeignKeyViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current !== null && depth < 4; depth += 1) {
    if (typeof current !== "object") return false;
    if ((current as { code?: unknown }).code === "23503") return true;
    current = (current as { cause?: unknown }).cause ?? null;
  }
  return false;
}

/**
 * Declare which work an existing PENDING request serves.
 *
 * ── THE ACTOR IS THE SESSION'S HUMAN, AND IS NOT A PARAMETER ─────────────────
 *
 * `tenant.userId` is the declarer, and `human` is a constant in this file. There is no actor
 * argument, so no caller can attribute a declaration to someone else, and no agent path exists to
 * call — the storage CHECK refuses a non-human declarer even if one were somehow reached.
 *
 * ── THE PREDICATE DOES THE WORK, NOT A PRIOR READ ────────────────────────────
 *
 * The UPDATE carries tenant, id, `status = 'pending'` and `purpose_work_item_id is null` in its own
 * WHERE clause. A row read first and updated second could be approved in between; this cannot. The
 * read below runs only to turn "zero rows updated" into the RIGHT refusal, exactly as
 * `insertActionRequest`'s duplicate pre-check turns a constraint violation into a named answer.
 */
export async function declareActionRequestPurpose(
  tenant: TenantContext | null,
  input: DeclareActionPurposeInput,
  deps: DeclareActionPurposeDeps = {},
): Promise<DeclareActionPurposeResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action purpose declaration is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!UUID_RE.test(input.requestId) || !UUID_RE.test(input.workItemId)) {
    return refused("invalid-input");
  }

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    return await db.transaction(async (tx) => {
      const updated = await tx
        .update(hebyActionRequests)
        .set({
          purposeWorkItemId: input.workItemId,
          purposeDeclaredByActorType: "human",
          purposeDeclaredByActorId: tenant.userId!,
          purposeDeclaredAt: now,
          updatedAt: now,
          updatedBy: tenant.userId!,
          updatedByType: "human",
          version: sql`${hebyActionRequests.version} + 1`,
        })
        .where(
          and(
            eq(hebyActionRequests.tenantId, tenant.tenantId),
            eq(hebyActionRequests.id, input.requestId),
            eq(hebyActionRequests.status, "pending"),
            isNull(hebyActionRequests.purposeWorkItemId),
          ),
        )
        .returning({
          id: hebyActionRequests.id,
          actionKind: hebyActionRequests.actionKind,
          toolId: hebyActionRequests.toolId,
          sideEffect: hebyActionRequests.sideEffect,
          reversibility: hebyActionRequests.reversibility,
          targetKind: hebyActionRequests.targetKind,
          targetRef: hebyActionRequests.targetRef,
          payloadDigest: hebyActionRequests.payloadDigest,
        });

      if (updated.length === 1) {
        const row = updated[0]!;
        /*
         * ONE AUDIT ROW, IN THE SAME TRANSACTION as the declaration, through the released G1 sink.
         * "Declared but no act recorded" and "act recorded but declaration rolled back" are
         * therefore not states this code can produce.
         *
         * The work item id rides in `metadata` and the REQUEST is the subject, because the request
         * is what changed. Subject Act History will then answer for the request; the inverse read
         * answers for the work.
         */
        await recordActionAuthorizationEventWithin(
          tx,
          { tenantId: tenant.tenantId, userId: tenant.userId! },
          {
            action: ACTION_AUDIT_PURPOSE_DECLARED,
            outcome: "committed",
            entityId: input.requestId,
            metadata: {
              actionRequestId: input.requestId,
              actionKind: row.actionKind,
              toolId: row.toolId,
              sideEffect: row.sideEffect,
              reversibility: row.reversibility,
              targetKind: row.targetKind,
              targetRef: row.targetRef,
              payloadDigest: row.payloadDigest,
              purposeWorkItemId: input.workItemId,
              /* A declaration is not an execution, and this authority says so on every event. */
              executed: false,
            },
          },
          now,
        );

        return {
          status: "declared" as const,
          requestId: input.requestId,
          workItemId: input.workItemId,
          declaredAt: now.toISOString(),
          idempotent: false,
        };
      }

      /* Zero rows changed. Find out WHICH of the four reasons applies, and say that one. */
      const [existing] = await tx
        .select({
          status: hebyActionRequests.status,
          purposeWorkItemId: hebyActionRequests.purposeWorkItemId,
          purposeDeclaredAt: hebyActionRequests.purposeDeclaredAt,
        })
        .from(hebyActionRequests)
        .where(
          and(
            eq(hebyActionRequests.tenantId, tenant.tenantId),
            eq(hebyActionRequests.id, input.requestId),
          ),
        )
        .limit(1);

      if (!existing) return refused("request-not-found");
      if (existing.purposeWorkItemId === input.workItemId) {
        /* THE SAME DECLARATION ALREADY STANDS. Nothing was written, and that is the answer. */
        return {
          status: "declared" as const,
          requestId: input.requestId,
          workItemId: input.workItemId,
          declaredAt: existing.purposeDeclaredAt?.toISOString() ?? now.toISOString(),
          idempotent: true,
        };
      }
      if (existing.purposeWorkItemId !== null) return refused("already-declared-for-other-work");
      return refused("request-not-pending");
    });
  } catch (error) {
    /*
     * THE COMPOSITE FOREIGN KEY IS THE AUTHORITY ON WHETHER THE WORK EXISTS — not a read of the
     * Work authority from inside this module. Asking Work first would put a second, weaker copy of
     * "does this work item exist in this tenant" in a module that owns neither question, and the
     * two could disagree. `(tenant_id, purpose_work_item_id)` against `work_items_tenant_id_uq`
     * answers both existence and ownership in one constraint, and a foreign work item is refused
     * with the same words as a missing one.
     */
    if (isForeignKeyViolation(error)) return refused("purpose-work-not-found");
    return refused("persistence-unavailable");
  }
}
