/**
 * Platform Admin read seams (P4, operator principal D4/D5/D6).
 *
 * NEW, PURPOSE-BUILT MODULES — not new modes of the released tenant-scoped readers. Those keep their
 * "no all-tenants mode" pins; nothing here imports them.
 *
 * Every reader, on its own and on every call:
 *   1. re-evaluates admin access (active operator grant AND a valid MFA on this session, 60-minute
 *      window) through `evaluateAdminAccess` — the page guard is not trusted to have run;
 *   2. runs a read that selects only the columns or aggregates it shows — never tenant content,
 *      a conversation, a message text, a credential or a key;
 *   3. writes one `platform.admin.view.<view>` audit row, and returns data ONLY after that write
 *      succeeded. A failed audit write returns `audit-failed` and no data.
 *
 * A tenant id reaching a reader is a selector, not authority: access comes from the operator grant
 * and MFA alone, and the id is validated before any query uses it.
 */
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { agents, companies, memberships } from "@/db/schema";
import type { AuthenticationResult } from "@/features/auth/types/authentication-result";
import { agentInServiceCondition } from "@/features/agent-identity/in-service";
import { REAL_PROVIDER_TRANSPORT } from "@/features/heby-provider-ops/usage-contracts";
import {
  writeAdminViewAudit,
  type AdminViewName,
} from "@/features/governance-audit/operator-authority-audit.server";
import {
  evaluateAdminAccess,
  type AdminAccess,
  type AdminOperator,
} from "@/features/operator-authority/admin-access.server";

type Db = Pick<ControlPlaneDatabase, "select" | "insert" | "execute">;

export type AdminRead<T> =
  | { readonly status: "read"; readonly data: T; readonly operator: AdminOperator }
  | { readonly status: "denied"; readonly access: Exclude<AdminAccess, { status: "granted" }> }
  /** The read failed; audited as rejected; nothing shown. */
  | { readonly status: "unavailable" }
  /** The audit row could not be written; nothing shown (D5). */
  | { readonly status: "audit-failed" };

export interface AdminReadContext {
  readonly db: Db;
  readonly authentication: AuthenticationResult;
  readonly now: Date;
  readonly requestId: string;
}

async function adminRead<T>(
  ctx: AdminReadContext,
  view: AdminViewName,
  target: (data: T | undefined) => { tenantId: string | null; entityId?: string },
  read: (db: Db) => Promise<T>,
): Promise<AdminRead<T>> {
  const access = await evaluateAdminAccess(ctx.db, ctx.authentication, ctx.now);
  if (access.status !== "granted") return { status: "denied", access };
  const operator = access.operator;

  let data: T | undefined;
  let ok = true;
  try {
    data = await read(ctx.db);
  } catch {
    ok = false;
  }
  const { tenantId, entityId } = target(ok ? data : undefined);
  try {
    await writeAdminViewAudit(ctx.db, {
      actorUserId: operator.userId,
      view,
      tenantId,
      entityType: entityId ? "company" : "auth_identity",
      entityId: entityId ?? operator.authIdentityId,
      result: ok ? "committed" : "rejected",
      sessionContextId: operator.sessionContextId,
      requestId: ctx.requestId,
      occurredAt: ctx.now,
    });
  } catch {
    return { status: "audit-failed" };
  }
  return ok ? { status: "read", data: data as T, operator } : { status: "unavailable" };
}

const platformWide = () => ({ tenantId: null });

/* ── shared aggregates ─────────────────────────────────────────────────────────────────────── */

/** Driver bigint/numeric strings → integers. */
const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
};
const iso = (v: unknown): string | null =>
  v == null ? null : new Date(v as string | Date).toISOString();

export interface RecordedAiUsage {
  /** Live provider calls recorded on assistant messages. */
  readonly recordedCalls: number;
  /** Calls whose provider reported both token counts. */
  readonly measuredCalls: number;
  /** Token sums over measured calls only; unmeasured calls are never counted as zero tokens. */
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** UTC instants of the first and last recorded call; null when none was recorded. */
  readonly firstRecordedAt: string | null;
  readonly lastRecordedAt: string | null;
}

const MEASURED = sql`"input_tokens" is not null and "output_tokens" is not null`;
const USAGE_COLUMNS = sql`
  count(*) as "recordedCalls",
  count(*) filter (where ${MEASURED}) as "measuredCalls",
  coalesce(sum("input_tokens") filter (where ${MEASURED}), 0) as "inputTokens",
  coalesce(sum("output_tokens") filter (where ${MEASURED}), 0) as "outputTokens",
  min("created_at") as "firstRecordedAt",
  max("created_at") as "lastRecordedAt"`;

function toUsage(row: Record<string, unknown> | undefined): RecordedAiUsage {
  return {
    recordedCalls: int(row?.recordedCalls),
    measuredCalls: int(row?.measuredCalls),
    inputTokens: int(row?.inputTokens),
    outputTokens: int(row?.outputTokens),
    firstRecordedAt: iso(row?.firstRecordedAt),
    lastRecordedAt: iso(row?.lastRecordedAt),
  };
}

async function usageWhere(db: Db, tenantId: string | null): Promise<RecordedAiUsage> {
  const tenant = tenantId ? sql`and "tenant_id" = ${tenantId}` : sql``;
  const result = await db.execute(
    sql`select ${USAGE_COLUMNS} from "messages" where "transport" = ${REAL_PROVIDER_TRANSPORT} ${tenant}`,
  );
  return toUsage(result.rows[0] as Record<string, unknown> | undefined);
}

const activeMembership = and(
  eq(memberships.status, "active"),
  eq(memberships.lifecycleStatus, "active"),
  isNull(memberships.revokedAt),
);

async function countsByTenant(
  db: Db,
  tenantIds: readonly string[],
): Promise<{ members: Map<string, number>; agents: Map<string, number> }> {
  if (tenantIds.length === 0) return { members: new Map(), agents: new Map() };
  const ids = [...tenantIds];
  const [memberRows, agentRows] = await Promise.all([
    db
      .select({ tenantId: memberships.tenantId, n: count() })
      .from(memberships)
      .where(and(inArray(memberships.tenantId, ids), activeMembership))
      .groupBy(memberships.tenantId),
    db
      .select({ tenantId: agents.tenantId, n: count() })
      .from(agents)
      .where(and(inArray(agents.tenantId, ids), agentInServiceCondition()))
      .groupBy(agents.tenantId),
  ]);
  return {
    members: new Map(memberRows.map((r) => [r.tenantId, r.n])),
    agents: new Map(agentRows.map((r) => [r.tenantId, r.n])),
  };
}

/* ── 1 · Platform Overview ─────────────────────────────────────────────────────────────────── */

export interface PlatformOverview {
  readonly totalOrganizations: number;
  /** Organizations whose recorded tenant status is `active`. */
  readonly activeOrganizations: number;
  readonly aiUsage: RecordedAiUsage;
}

export function readPlatformOverview(ctx: AdminReadContext): Promise<AdminRead<PlatformOverview>> {
  return adminRead(ctx, "overview", platformWide, async (db) => {
    const [orgRows, aiUsage] = await Promise.all([
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${companies.tenantStatus} = 'active')`.mapWith(Number),
        })
        .from(companies),
      usageWhere(db, null),
    ]);
    return {
      totalOrganizations: orgRows[0]?.total ?? 0,
      activeOrganizations: orgRows[0]?.active ?? 0,
      aiUsage,
    };
  });
}

/* ── 2 · Organizations (server-side pagination) ────────────────────────────────────────────── */

export const ORGANIZATIONS_PAGE_SIZE = 25;
const MAX_PAGE = 10_000;

/** A page number from an untrusted query value. Anything unusable is page 1. */
export function parsePage(value: unknown): number {
  const n = typeof value === "string" && /^\d{1,5}$/.test(value) ? Number(value) : 1;
  return Math.min(Math.max(n, 1), MAX_PAGE);
}

export interface PlatformOrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  /** Recorded tenant status; null when none was ever recorded. */
  readonly status: string | null;
  readonly createdAt: string;
  readonly memberCount: number;
  readonly agentCount: number;
}

export interface PlatformOrganizationsPage {
  readonly rows: readonly PlatformOrganizationRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export function listPlatformOrganizations(
  ctx: AdminReadContext,
  page: number,
): Promise<AdminRead<PlatformOrganizationsPage>> {
  const current = parsePage(String(page));
  return adminRead(ctx, "organizations", platformWide, async (db) => {
    const [totalRows, orgs] = await Promise.all([
      db.select({ n: count() }).from(companies),
      db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
          status: companies.tenantStatus,
          createdAt: companies.createdAt,
        })
        .from(companies)
        .orderBy(desc(companies.createdAt), asc(companies.id))
        .limit(ORGANIZATIONS_PAGE_SIZE)
        .offset((current - 1) * ORGANIZATIONS_PAGE_SIZE),
    ]);
    const counts = await countsByTenant(db, orgs.map((o) => o.id));
    return {
      rows: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        memberCount: counts.members.get(o.id) ?? 0,
        agentCount: counts.agents.get(o.id) ?? 0,
      })),
      page: current,
      pageSize: ORGANIZATIONS_PAGE_SIZE,
      total: totalRows[0]?.n ?? 0,
    };
  });
}

/* ── 3 · Organization Metrics ──────────────────────────────────────────────────────────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOrganizationId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

export interface PlatformOrganizationMetrics {
  readonly organization: PlatformOrganizationRow & { readonly statusChangedAt: string | null };
  readonly aiUsage: RecordedAiUsage;
}

/** `data: null` — no organization has this id. An invalid id never reaches a query. */
export async function readPlatformOrganizationMetrics(
  ctx: AdminReadContext,
  organizationId: string,
): Promise<AdminRead<PlatformOrganizationMetrics | null>> {
  if (!isOrganizationId(organizationId)) {
    const access = await evaluateAdminAccess(ctx.db, ctx.authentication, ctx.now);
    if (access.status !== "granted") return { status: "denied", access };
    return { status: "read", data: null, operator: access.operator };
  }
  return adminRead(
    ctx,
    "organization",
    (data) => ({ tenantId: data ? organizationId : null, entityId: organizationId }),
    async (db) => {
      const rows = await db
        .select({
          id: companies.id,
          name: companies.name,
          slug: companies.slug,
          status: companies.tenantStatus,
          statusChangedAt: companies.tenantStatusChangedAt,
          createdAt: companies.createdAt,
        })
        .from(companies)
        .where(eq(companies.id, organizationId))
        .limit(1);
      const org = rows[0];
      if (!org) return null;
      const [counts, aiUsage] = await Promise.all([
        countsByTenant(db, [org.id]),
        usageWhere(db, org.id),
      ]);
      return {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          statusChangedAt: org.statusChangedAt?.toISOString() ?? null,
          createdAt: org.createdAt.toISOString(),
          memberCount: counts.members.get(org.id) ?? 0,
          agentCount: counts.agents.get(org.id) ?? 0,
        },
        aiUsage,
      };
    },
  );
}

/* ── 4 · AI Usage ──────────────────────────────────────────────────────────────────────────── */

export const USAGE_TOP_ORGANIZATIONS = 50;

export interface UsageGroup extends RecordedAiUsage {
  readonly key: string;
  readonly label: string;
}

export interface PlatformAiUsage {
  readonly totals: RecordedAiUsage;
  readonly byProvider: readonly UsageGroup[];
  /** The organizations with the most recorded calls, at most USAGE_TOP_ORGANIZATIONS. */
  readonly byOrganization: readonly UsageGroup[];
}

export function readPlatformAiUsage(ctx: AdminReadContext): Promise<AdminRead<PlatformAiUsage>> {
  return adminRead(ctx, "usage", platformWide, async (db) => {
    const [totals, providers, orgs] = await Promise.all([
      usageWhere(db, null),
      db.execute(sql`
        select "provider" as "key", ${USAGE_COLUMNS}
        from "messages" where "transport" = ${REAL_PROVIDER_TRANSPORT}
        group by "provider" order by "recordedCalls" desc, "provider" asc nulls last`),
      /* Aggregate first, then attach the name only: `companies` also has a `created_at`. */
      db.execute(sql`
        select u.*, c."name" as "label"
        from (
          select "tenant_id" as "key", ${USAGE_COLUMNS}
          from "messages" where "transport" = ${REAL_PROVIDER_TRANSPORT}
          group by "tenant_id"
          order by "recordedCalls" desc, "tenant_id" asc
          limit ${USAGE_TOP_ORGANIZATIONS}
        ) u join "companies" c on c."id" = u."key"
        order by u."recordedCalls" desc, u."key" asc`),
    ]);
    const group = (row: Record<string, unknown>, label: unknown): UsageGroup => ({
      key: String(row.key ?? "unlabelled"),
      label: label == null ? "Unlabelled" : String(label),
      ...toUsage(row),
    });
    return {
      totals,
      byProvider: (providers.rows as Record<string, unknown>[]).map((r) => group(r, r.key)),
      byOrganization: (orgs.rows as Record<string, unknown>[]).map((r) => group(r, r.label)),
    };
  });
}

/* ── 5 · Platform Service Status ───────────────────────────────────────────────────────────── */

export type ServiceSignal =
  /** Checked on this request, and it answered. */
  | { readonly state: "responding"; readonly checkedAt: string; readonly detail: string }
  /** No health check exists for this service; nothing is claimed. */
  | { readonly state: "not-monitored"; readonly detail: string };

export interface PlatformServiceStatus {
  readonly database: ServiceSignal;
  readonly authentication: ServiceSignal;
  readonly aiProviders: ServiceSignal;
  readonly backgroundJobs: ServiceSignal;
}

export function readPlatformServiceStatus(
  ctx: AdminReadContext,
): Promise<AdminRead<PlatformServiceStatus>> {
  return adminRead(ctx, "status", platformWide, async (db) => {
    const started = Date.now();
    await db.execute(sql`select 1`);
    const ms = Date.now() - started;
    const checkedAt = ctx.now.toISOString();
    return {
      database: { state: "responding", checkedAt, detail: `Answered a check query in ${ms} ms.` },
      authentication: {
        state: "responding",
        checkedAt,
        detail: "This request's session, operator grant and MFA were verified.",
      },
      aiProviders: {
        state: "not-monitored",
        detail: "No provider health check exists. Recorded calls are history, not current health.",
      },
      backgroundJobs: {
        state: "not-monitored",
        detail: "Scheduled scans record no run health. A past run is not shown as current health.",
      },
    };
  });
}
