/*
 * notifications/notifications.server.ts — V1-STAGE-3 in-app notifications, a READ-TIME PROJECTION.
 *
 * Nothing is stored, sent or scheduled. Every notification is recomputed on request from records
 * that already own the fact:
 *
 *   pending approvals        → `heby_action_requests` awaiting a decision (the released E2-4 aggregate)
 *   publication attempts     → `action_execution_attempts` for the two publish kinds
 *   other execution attempts → `action_execution_attempts` for every other kind
 *
 * An attempt counts when it ended `failed` or `refused` within the last {@link FAILURE_WINDOW_DAYS}
 * days, or when its outcome is still unknown — `unknown`, or `pending` past the declared execution
 * window — whatever its age, because an unreconciled act does not stop needing a human.
 *
 * AUDIENCE. The organization's Governance authority (the released resolver): it decides approvals
 * and owns the acts. Everyone else gets an empty list and is told why. No new permission exists.
 *
 * DISCLOSURE. A notification carries a kind, a count, the latest instant and a link to the page that
 * already shows the detail. Never a title, content, recipient, provider id, failure body or
 * attempt id. The tenant is the session's, in every WHERE. No email, no Resend, no worker.
 */
import { sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readAwaitingDecisionAggregate } from "@/features/action-authorization/awaiting-decision-aggregate.server";
import { EXECUTION_IN_FLIGHT_WINDOW_MS } from "@/features/action-execution/contracts";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND } from "@/features/instagram-publishing/contracts";
import { PUBLISH_YOUTUBE_VIDEO_ACTION_KIND } from "@/features/youtube-publishing/contracts";

export const FAILURE_WINDOW_DAYS = 7;

export type NotificationKind =
  | "approvals-pending"
  | "publication-failed"
  | "publication-outcome-unknown"
  | "execution-failed"
  | "execution-outcome-unknown";

export interface InAppNotification {
  readonly kind: NotificationKind;
  readonly count: number;
  /** Oldest filed instant for approvals; latest attempt start for attempts. ISO-8601, or null. */
  readonly at: string | null;
  readonly href: "/approvals";
}

export type NotificationsRead =
  | { readonly status: "unauthenticated" | "unavailable" }
  | { readonly status: "not-addressed" }
  | { readonly status: "read"; readonly items: readonly InAppNotification[]; readonly readAt: string };

export interface NotificationsDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
  readonly readAwaiting?: typeof readAwaitingDecisionAggregate;
}

function dbOf(deps: NotificationsDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function toCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function readNotifications(tenant: TenantContext | null, deps: NotificationsDeps = {}): Promise<NotificationsRead> {
  if (typeof window !== "undefined") throw new Error("Notifications are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  const db = dbOf(deps);
  if (!db) return { status: "unavailable" };
  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant, { getDb: () => db }).catch(() => null);
  if (!authority) return { status: "unavailable" };
  if (authority.authorized !== true) return { status: "not-addressed" };

  const now = (deps.now ?? (() => new Date()))();
  const failureSince = new Date(now.getTime() - FAILURE_WINDOW_DAYS * 86_400_000);
  const pendingBefore = new Date(now.getTime() - EXECUTION_IN_FLIGHT_WINDOW_MS);
  const publishKinds = sql`(${PUBLISH_INSTAGRAM_MEDIA_ACTION_KIND}, ${PUBLISH_YOUTUBE_VIDEO_ACTION_KIND})`;
  const statement = sql`
    select
      ("action_kind" in ${publishKinds})                                   as "publication",
      ("status" in ('failed', 'refused'))                                  as "failed",
      count(*)                                                             as "n",
      max("started_at")                                                    as "latest"
    from "action_execution_attempts"
    where "tenant_id" = ${tenant.tenantId}
      and (
        ("status" in ('failed', 'refused') and "started_at" >= ${failureSince.toISOString()})
        or "status" = 'unknown'
        or ("status" = 'pending' and "started_at" < ${pendingBefore.toISOString()})
      )
    group by 1, 2`;

  try {
    const [awaiting, executed] = await Promise.all([
      (deps.readAwaiting ?? readAwaitingDecisionAggregate)(tenant, { getDb: () => db }),
      db.execute(statement),
    ]);
    if (awaiting.status !== "read") return { status: "unavailable" };
    const items: InAppNotification[] = [];
    if (awaiting.value.awaiting > 0) {
      items.push({ kind: "approvals-pending", count: awaiting.value.awaiting, at: awaiting.value.oldestFiledAt, href: "/approvals" });
    }
    const order: readonly NotificationKind[] = ["publication-failed", "publication-outcome-unknown", "execution-failed", "execution-outcome-unknown"];
    const byKind = new Map<NotificationKind, InAppNotification>();
    for (const row of executed.rows as unknown as readonly Record<string, unknown>[]) {
      const publication = row.publication === true || row.publication === "t";
      const failed = row.failed === true || row.failed === "t";
      const kind: NotificationKind = `${publication ? "publication" : "execution"}-${failed ? "failed" : "outcome-unknown"}`;
      const count = toCount(row.n);
      if (count > 0) byKind.set(kind, { kind, count, at: toIso(row.latest), href: "/approvals" });
    }
    for (const kind of order) {
      const item = byKind.get(kind);
      if (item) items.push(item);
    }
    return { status: "read", items, readAt: now.toISOString() };
  } catch {
    return { status: "unavailable" };
  }
}
