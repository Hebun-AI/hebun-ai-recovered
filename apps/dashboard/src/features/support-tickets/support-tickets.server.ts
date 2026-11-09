/*
 * support-tickets/support-tickets.server.ts — V1-STAGE-5 Customer Ops reads and writes.
 *
 *   read    → any member of the session's tenant sees that tenant's tickets, newest first.
 *   create  → any member files a ticket for their own tenant; the row and its audit commit together.
 *   status  → only the organization's Governance authority (the released resolver, not a new role
 *             system) changes status, under a row lock and the version the human saw; audited.
 *
 * Tenant and actor come from the session only, and `tenant_id = <session tenant>` is in every
 * WHERE and every INSERT. No email, DM or external system is read or written.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { supportTickets } from "@/db/schema/support-ticket";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { recordSupportTicketEventWithin } from "@/features/governance-audit/support-ticket-audit.server";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import {
  SUPPORT_TICKET_CREATED,
  SUPPORT_TICKET_STATUS_CHANGED,
  isSupportTicketStatus,
  normalizeDescription,
  normalizeTitle,
  type SupportTicketRefusal,
  type SupportTicketStatus,
  type SupportTicketWrite,
  type SupportTicketsRead,
} from "./contracts";

export interface SupportTicketDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
}

/** ponytail: a fixed newest-first window; add paging when an organization outgrows it. */
export const SUPPORT_TICKET_READ_LIMIT = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Tx = Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];
const refuse = (reason: SupportTicketRefusal): SupportTicketWrite => ({ status: "refused", reason });

function dbOf(deps: SupportTicketDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function serverOnly(): void {
  if (typeof window !== "undefined") throw new Error("Support tickets are server-only.");
}

async function mayChangeStatus(tenant: TenantContext, db: ControlPlaneDatabase, deps: SupportTicketDeps): Promise<boolean> {
  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant, { getDb: () => db }).catch(() => ({ authorized: false }));
  return authority.authorized === true;
}

export async function readSupportTickets(tenant: TenantContext | null, deps: SupportTicketDeps = {}): Promise<SupportTicketsRead> {
  serverOnly();
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  const db = dbOf(deps);
  if (!db) return { status: "unavailable" };
  try {
    const [rows, viewerMayChangeStatus] = await Promise.all([
      db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.tenantId, tenant.tenantId))
        .orderBy(desc(supportTickets.createdAt), desc(supportTickets.id))
        .limit(SUPPORT_TICKET_READ_LIMIT + 1),
      mayChangeStatus(tenant, db, deps),
    ]);
    return {
      status: "read",
      truncated: rows.length > SUPPORT_TICKET_READ_LIMIT,
      viewerMayChangeStatus,
      tickets: rows.slice(0, SUPPORT_TICKET_READ_LIMIT).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: isSupportTicketStatus(r.status) ? r.status : "open",
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        filedByViewer: r.createdBy === tenant.userId,
      })),
    };
  } catch {
    return { status: "unavailable" };
  }
}

export async function createSupportTicket(
  tenant: TenantContext | null,
  input: { readonly title: unknown; readonly description: unknown },
  deps: SupportTicketDeps = {},
): Promise<SupportTicketWrite> {
  serverOnly();
  if (!tenant?.tenantId || !tenant.userId) return refuse("unauthenticated");
  const title = normalizeTitle(input?.title);
  const description = normalizeDescription(input?.description);
  if (!title.ok || !description.ok) return refuse("invalid-input");
  const db = dbOf(deps);
  if (!db) return refuse("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();
  try {
    return await db.transaction(async (tx: Tx) => {
      const [row] = await tx
        .insert(supportTickets)
        .values({ tenantId: tenant.tenantId, title: title.value, description: description.value, createdBy: tenant.userId, updatedBy: tenant.userId, createdAt: now, updatedAt: now })
        .returning({ id: supportTickets.id, version: supportTickets.version });
      await recordSupportTicketEventWithin(tx, auditActorFrom(tenant), { action: SUPPORT_TICKET_CREATED, ticketId: row!.id, next: { status: "open", version: row!.version } }, now);
      return { status: "created" as const, ticketId: row!.id, version: row!.version };
    });
  } catch {
    return refuse("persistence-unavailable");
  }
}

export async function changeSupportTicketStatus(
  tenant: TenantContext | null,
  input: { readonly ticketId: unknown; readonly status: unknown; readonly expectedVersion: unknown },
  deps: SupportTicketDeps = {},
): Promise<SupportTicketWrite> {
  serverOnly();
  if (!tenant?.tenantId || !tenant.userId) return refuse("unauthenticated");
  const { ticketId, status, expectedVersion } = input ?? {};
  if (typeof ticketId !== "string" || !UUID_RE.test(ticketId) || !isSupportTicketStatus(status) || !Number.isSafeInteger(expectedVersion)) {
    return refuse("invalid-input");
  }
  const db = dbOf(deps);
  if (!db) return refuse("persistence-unavailable");
  if (!(await mayChangeStatus(tenant, db, deps))) return refuse("not-authorized");
  const now = (deps.now ?? (() => new Date()))();
  try {
    return await db.transaction(async (tx: Tx) => {
      const [current] = await tx
        .select({ status: supportTickets.status, version: supportTickets.version })
        .from(supportTickets)
        .where(and(eq(supportTickets.tenantId, tenant.tenantId), eq(supportTickets.id, ticketId)))
        .for("update");
      if (!current) return refuse("not-found");
      if (current.version !== expectedVersion) return refuse("stale-version");
      if (current.status === status) return refuse("unchanged");
      const [row] = await tx
        .update(supportTickets)
        .set({ status, version: sql`${supportTickets.version} + 1`, updatedBy: tenant.userId, updatedAt: now })
        .where(and(eq(supportTickets.tenantId, tenant.tenantId), eq(supportTickets.id, ticketId)))
        .returning({ version: supportTickets.version });
      await recordSupportTicketEventWithin(
        tx,
        auditActorFrom(tenant),
        {
          action: SUPPORT_TICKET_STATUS_CHANGED,
          ticketId,
          previous: { status: current.status as SupportTicketStatus, version: current.version },
          next: { status, version: row!.version },
        },
        now,
      );
      return { status: "updated" as const, ticketId, version: row!.version };
    });
  } catch {
    return refuse("persistence-unavailable");
  }
}
