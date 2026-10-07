/*
 * work-domain/write-work-domain.server.ts — THE WORK DOMAIN AUTHORITY's one writer (AP-4A).
 *
 * The ONLY place a `work_domains` row is created or changed. Three transitions — create, rename,
 * retire — and nothing else; see `contracts.ts` for what this authority is and is not.
 *
 *   authenticated tenant context
 *     -> resolveGovernanceAuthority (permission to write vocabulary — never a decision)
 *       -> db.transaction
 *         -> SELECT ... FOR UPDATE (tenant-scoped)        [rename, retire]
 *           -> authoritative mutation
 *             -> audit row, IN THE SAME TRANSACTION
 *               -> typed result, never a throw
 *
 * RELEASE A: no product surface reaches this module. The operator ceremony
 * (`scripts/work-domain-ceremony.ts`) and tests are its only callers; a firewall pins that.
 */
import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { workDomains } from "@/db/schema/work-domain";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import { recordWorkDomainEventWithin } from "@/features/governance-audit/work-domain-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  ACTIVE_WORK_DOMAIN_STATUS,
  RETIRED_WORK_DOMAIN_STATUS,
  WORK_DOMAIN_AUDIT_CREATED,
  WORK_DOMAIN_AUDIT_RENAMED,
  WORK_DOMAIN_AUDIT_RETIRED,
  isWellFormedWorkDomainName,
  isWellFormedWorkDomainSlug,
  type WorkDomainRefusal,
  type WorkDomainWriteResult,
} from "./contracts";

export interface WorkDomainWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
}

type Tx = Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];

const refuse = (reason: WorkDomainRefusal): WorkDomainWriteResult => ({ status: "refused", reason });

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const shaped = error as { code?: unknown; cause?: { code?: unknown } };
  return shaped.code === "23505" || shaped.cause?.code === "23505";
}

function resolveDbOrNull(deps: WorkDomainWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

const RETURNING = {
  id: workDomains.id,
  slug: workDomains.slug,
  name: workDomains.name,
  lifecycleStatus: workDomains.lifecycleStatus,
};

function recorded(row: { id: string; slug: string; name: string; lifecycleStatus: string }): WorkDomainWriteResult {
  return {
    status: "recorded",
    workDomain: {
      workDomainId: row.id,
      slug: row.slug,
      name: row.name,
      inService: row.lifecycleStatus === ACTIVE_WORK_DOMAIN_STATUS,
    },
  };
}

async function gate(
  tenant: TenantContext | null,
  deps: WorkDomainWriteDeps,
): Promise<
  | { readonly ok: true; readonly db: ControlPlaneDatabase; readonly now: Date; readonly tenant: TenantContext }
  | { readonly ok: false; readonly result: WorkDomainWriteResult }
> {
  if (typeof window !== "undefined") throw new Error("Work domain writes are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { ok: false, result: refuse("no-authorized-tenant-context") };
  let authorized: boolean;
  try {
    authorized = (await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant)).authorized;
  } catch {
    return { ok: false, result: refuse("authority-unavailable") };
  }
  if (!authorized) return { ok: false, result: refuse("not-authorized") };
  const db = resolveDbOrNull(deps);
  if (!db) return { ok: false, result: refuse("authority-unavailable") };
  return { ok: true, db, now: (deps.now ?? (() => new Date()))(), tenant };
}

export async function recordWorkDomain(
  tenant: TenantContext | null,
  input: { readonly name: string; readonly slug: string },
  deps: WorkDomainWriteDeps = {},
): Promise<WorkDomainWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  if (!isWellFormedWorkDomainName(input?.name)) return refuse("malformed-work-domain-name");
  if (!isWellFormedWorkDomainSlug(input?.slug)) return refuse("malformed-work-domain-slug");
  const { db, now } = gated;
  const actor = gated.tenant;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(workDomains)
        .values({
          tenantId: actor.tenantId,
          name: input.name,
          slug: input.slug,
          createdAt: now,
          createdBy: actor.userId,
          createdByType: "human",
          updatedAt: now,
          updatedBy: actor.userId,
          updatedByType: "human",
        })
        .returning(RETURNING);
      await recordWorkDomainEventWithin(
        tx,
        auditActorFrom(actor),
        { action: WORK_DOMAIN_AUDIT_CREATED, workDomainId: row!.id, slug: row!.slug, name: row!.name },
        now,
      );
      return recorded(row!);
    });
  } catch (error) {
    /* Lifetime uniqueness: a retired domain's slug is taken too. */
    if (isUniqueViolation(error)) return refuse("work-domain-slug-taken");
    return refuse("authority-unavailable");
  }
}

/** Lock ONE in-service domain of THIS tenant, then let `apply` change it. */
async function mutateWorkDomain(
  tenant: TenantContext | null,
  workDomainId: string,
  deps: WorkDomainWriteDeps,
  apply: (tx: Tx, current: { id: string; slug: string; name: string }, actor: TenantContext, now: Date) => Promise<WorkDomainWriteResult>,
): Promise<WorkDomainWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  if (typeof workDomainId !== "string" || workDomainId.length === 0) return refuse("work-domain-unresolved");
  const { db, now } = gated;
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select(RETURNING)
        .from(workDomains)
        .where(and(eq(workDomains.tenantId, gated.tenant.tenantId), eq(workDomains.id, workDomainId)))
        .for("update")
        .limit(1);
      if (!current) return refuse("work-domain-unresolved");
      if (current.lifecycleStatus !== ACTIVE_WORK_DOMAIN_STATUS) return refuse("work-domain-retired");
      return apply(tx, current, gated.tenant, now);
    });
  } catch {
    /* A malformed id (not a uuid) lands here too: unresolved, never a leak of another tenant's row. */
    return refuse("authority-unavailable");
  }
}

/** Changes the NAME. The slug is the domain's permanent identity and is never an input here. */
export async function renameWorkDomain(
  tenant: TenantContext | null,
  input: { readonly workDomainId: string; readonly name: string },
  deps: WorkDomainWriteDeps = {},
): Promise<WorkDomainWriteResult> {
  if (!isWellFormedWorkDomainName(input?.name)) return refuse("malformed-work-domain-name");
  return mutateWorkDomain(tenant, input?.workDomainId, deps, async (tx, current, actor, now) => {
    if (current.name === input.name) return refuse("work-domain-name-unchanged");
    const [row] = await tx
      .update(workDomains)
      .set({
        name: input.name,
        updatedAt: now,
        updatedBy: actor.userId,
        updatedByType: "human",
        version: sql`${workDomains.version} + 1`,
      })
      .where(and(eq(workDomains.tenantId, actor.tenantId), eq(workDomains.id, current.id)))
      .returning(RETURNING);
    await recordWorkDomainEventWithin(
      tx,
      auditActorFrom(actor),
      { action: WORK_DOMAIN_AUDIT_RENAMED, workDomainId: row!.id, slug: row!.slug, name: row!.name, previousName: current.name },
      now,
    );
    return recorded(row!);
  });
}

/** Retires the domain. Touches no work item and no mandate responsibility — eligibility reads lifecycle. */
export async function retireWorkDomain(
  tenant: TenantContext | null,
  input: { readonly workDomainId: string },
  deps: WorkDomainWriteDeps = {},
): Promise<WorkDomainWriteResult> {
  return mutateWorkDomain(tenant, input?.workDomainId, deps, async (tx, current, actor, now) => {
    const [row] = await tx
      .update(workDomains)
      .set({
        lifecycleStatus: RETIRED_WORK_DOMAIN_STATUS,
        deletedAt: now,
        deletedBy: actor.userId,
        deletedByType: "human",
        updatedAt: now,
        updatedBy: actor.userId,
        updatedByType: "human",
        version: sql`${workDomains.version} + 1`,
      })
      .where(and(eq(workDomains.tenantId, actor.tenantId), eq(workDomains.id, current.id)))
      .returning(RETURNING);
    await recordWorkDomainEventWithin(
      tx,
      auditActorFrom(actor),
      { action: WORK_DOMAIN_AUDIT_RETIRED, workDomainId: row!.id, slug: row!.slug, name: row!.name },
      now,
    );
    return recorded(row!);
  });
}
