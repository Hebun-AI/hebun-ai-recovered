/*
 * organizational-work/read-governed-work-outcomes.server.ts — HEBY-VERIFIED-WORK-OUTCOMES.
 *
 * Its own file, apart from `read-work.server.ts`, because the work WRITER imports that module and a
 * pinned firewall bounds everything the writer can reach. This read needs the audit sink's declared
 * reader and the Work Domain reader; the writer needs neither, and must not reach them.
 *
 * Server-only.
 */
import { and, eq, inArray } from "drizzle-orm";
import { workItems } from "@/db/schema/work-item";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readGovernedWorkLinks,
  type GovernedWorkLinkAction,
} from "@/features/governance-activity/governed-work-link-read.server";
import { WORK_AUDIT_RECORDED } from "./work-contracts";
import { readWorkDomains } from "@/features/work-domain/read-work-domains.server";
import { getControlPlaneDb } from "@/db/client.server";
import type { WorkReadDeps } from "./read-work.server";

/**
 * HEBY-VERIFIED-WORK-OUTCOMES — the work a governed act produced, by the permit spend it discharged.
 *
 * The link is the one THIS authority declared: the `work.recorded` audit row a SYSTEM-performed act
 * wrote, in the permit's own transaction, naming that spend's `handoff_id`. Nothing is matched by
 * title, by time or by session correlation. A spend with no such row, or with more than one, is
 * absent from the map — "unknown", which the caller must show as such, never fill in.
 *
 * Tenant-scoped on both reads. The title and scope are read from the work row itself, so they are
 * what the organization holds now, not a copy taken at the time.
 */
export interface GovernedWorkOutcome {
  readonly workItemId: string;
  readonly title: string;
  readonly scope: { readonly kind: "organization" } | { readonly kind: "domain"; readonly name: string } | null;
}

export type GovernedWorkOutcomesRead =
  | { readonly status: "read"; readonly byHandoff: ReadonlyMap<string, GovernedWorkOutcome> }
  | { readonly status: "unavailable" };

export async function readGovernedWorkOutcomes(
  tenant: TenantContext | null,
  handoffIds: readonly string[],
  deps: WorkReadDeps = {},
  /** OPERATIONAL-RELIABILITY-1 — which declared link: the item a spend recorded, or whose state it changed. */
  action: GovernedWorkLinkAction = WORK_AUDIT_RECORDED,
): Promise<GovernedWorkOutcomesRead> {
  if (typeof window !== "undefined") throw new Error("Organizational work reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  if (handoffIds.length === 0) return { status: "read", byHandoff: new Map() };
  let db;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return { status: "unavailable" };

  /* The declared link, through the sink's own declared reader — this authority never reads the ledger. */
  const links = await readGovernedWorkLinks(tenant.tenantId, handoffIds, { getDb: () => db }, action);
  if (links === null) return { status: "unavailable" };
  const linked = new Map<string, string | null>();
  /* More than one row for one spend is not a link; it is a contradiction, and it reads as unknown. */
  for (const row of links) linked.set(row.handoffId, linked.has(row.handoffId) ? null : row.workItemId);
  const workIds = [...new Set([...linked.values()].filter((id): id is string => id !== null))];
  if (workIds.length === 0) return { status: "read", byHandoff: new Map() };

  try {
    const rows = await db
      .select({
        id: workItems.id,
        title: workItems.title,
        scopeKind: workItems.workScopeKind,
        workDomainId: workItems.workDomainId,
      })
      .from(workItems)
      .where(and(eq(workItems.tenantId, tenant.tenantId), inArray(workItems.id, workIds)));
    const works = new Map(rows.map((row) => [row.id, row]));
    /* A domain's NAME is the Work Domain authority's to state; read it there, only when one is needed. */
    const domainNames = new Map<string, string>();
    if (rows.some((row) => row.scopeKind === "domain")) {
      const domains = await readWorkDomains(tenant, { getDb: () => db });
      if (domains.status === "read") for (const d of domains.workDomains) domainNames.set(d.workDomainId, d.name);
    }

    const byHandoff = new Map<string, GovernedWorkOutcome>();
    for (const [handoffId, workItemId] of linked) {
      const work = workItemId === null ? undefined : works.get(workItemId);
      if (!work) continue;
      const domainName = work.workDomainId === null ? undefined : domainNames.get(work.workDomainId);
      byHandoff.set(handoffId, {
        workItemId: work.id,
        title: work.title,
        scope:
          work.scopeKind === "organization"
            ? { kind: "organization" }
            : work.scopeKind === "domain" && domainName
              ? { kind: "domain", name: domainName }
              : null,
      });
    }
    return { status: "read", byHandoff };
  } catch {
    return { status: "unavailable" };
  }
}
