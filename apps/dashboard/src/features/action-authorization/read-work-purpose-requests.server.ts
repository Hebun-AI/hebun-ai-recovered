/*
 * action-authorization/read-work-purpose-requests.server.ts — THE INVERSE READ (PBGA-1).
 *
 * "Which governed action requests did a human declare serve THIS work item?"
 *
 * ── THIS IS NOT SUBJECT ACT HISTORY, AND THE TWO MUST NEVER MERGE ────────────
 *
 *   RECORDED ACTIVITY               acts performed ON the work record — created, retitled,
 *                                   reference-declared. Owned by the audit sink.
 *   GOVERNED ACTIONS FOR THIS WORK  requests a human declared SERVE this work. Owned here.
 *
 * A work item can have ten recorded acts and no governed action, or a governed action and no
 * recorded act since its creation. Rendering them as one feed would invent a single timeline of
 * "what is happening" that neither authority can support.
 *
 * ── AND IT IS NOT PROGRESS ───────────────────────────────────────────────────
 *
 * A request declared for a work item is a proposal a person filed. It may be pending forever, be
 * rejected, or be approved and never executed. Nothing here says the work moved.
 *
 *     DECLARED PURPOSE != PROGRESS != COMPLETION != VERIFICATION
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The page bound. Small on purpose: this is a section on a work item, not an audit console. */
export const WORK_PURPOSE_REQUEST_PAGE_LIMIT = 20 as const;

/**
 * One governed request declared for a work item, in the only shape this surface shows.
 *
 * FOUR FIELDS AND A TIME. No payload, no evidence internals, no digest, no target ref, no
 * recipient, no draft, no actor identifier. A person looking at a work item needs to know what kind
 * of act was filed for it, what it was aimed at in words, where the decision stands and when it was
 * proposed. Everything else belongs on the approvals surface, which is where deciding happens.
 */
export interface WorkPurposeRequestView {
  readonly requestId: string;
  /** The registry kind verbatim, e.g. `send-external-communication`. Never relabelled. */
  readonly actionKind: string;
  /** The human-readable target the proposal already recorded. Never a raw address or a ref. */
  readonly targetLabel: string | null;
  /** `pending` | `approved` | `rejected`, verbatim from the request. Never reinterpreted. */
  readonly status: string;
  readonly proposedAt: string;
  /** When the purpose itself was declared — which may be later than the proposal. */
  readonly purposeDeclaredAt: string;
}

export type WorkPurposeRequestsRead =
  | {
      readonly status: "read";
      readonly items: readonly WorkPurposeRequestView[];
      /** True when more requests were declared for this work than this page shows. */
      readonly truncated: boolean;
    }
  | { readonly status: "unavailable"; readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed" };

const iso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/**
 * The governed action requests declared for one work item.
 *
 * Tenant, work item and a bound — the same three-part discipline the subject act read uses, for the
 * same reason. Returns `unavailable` when it could not look, never an empty list: a work item with
 * no declared actions and a failed read are different sentences.
 */
export async function readGovernedActionsForWork(
  tenant: TenantContext | null,
  workItemId: string,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<WorkPurposeRequestsRead> {
  if (typeof window !== "undefined") {
    throw new Error("Action authorization reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  if (!UUID_RE.test(workItemId)) return { status: "unavailable", reason: "read-failed" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select({
        id: hebyActionRequests.id,
        actionKind: hebyActionRequests.actionKind,
        targetLabel: hebyActionRequests.targetLabel,
        status: hebyActionRequests.status,
        createdAt: hebyActionRequests.createdAt,
        purposeDeclaredAt: hebyActionRequests.purposeDeclaredAt,
      })
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.purposeWorkItemId, workItemId),
        ),
      )
      .orderBy(desc(hebyActionRequests.createdAt), desc(hebyActionRequests.id))
      .limit(WORK_PURPOSE_REQUEST_PAGE_LIMIT + 1);

    const page = rows.slice(0, WORK_PURPOSE_REQUEST_PAGE_LIMIT);
    return {
      status: "read",
      items: page.flatMap((row) => {
        const declaredAt = iso(row.purposeDeclaredAt);
        /*
         * The CHECK makes a bound request without a declaration instant unrepresentable, so an
         * unusable value here means the driver returned something this code does not understand.
         * Dropping the row is visibly incomplete; inventing a time would not be.
         */
        if (!declaredAt) return [];
        return [
          {
            requestId: row.id,
            actionKind: row.actionKind,
            targetLabel: row.targetLabel,
            status: String(row.status),
            proposedAt: iso(row.createdAt) ?? "",
            purposeDeclaredAt: declaredAt,
          },
        ];
      }),
      truncated: rows.length > WORK_PURPOSE_REQUEST_PAGE_LIMIT,
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
