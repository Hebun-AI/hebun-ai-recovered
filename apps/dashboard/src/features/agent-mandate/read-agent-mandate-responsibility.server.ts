/*
 * agent-mandate/read-agent-mandate-responsibility.server.ts — the responsibility of ONE agent's
 * EFFECTIVE mandate revision (AP-4A).
 *
 * Read-only. Tenant from the authenticated context. Returns the effective revision's scope and its
 * responsibility rows with each domain's CURRENT name and lifecycle — a retired domain is reported as
 * such, never dropped, because the row is history and hiding it would misstate what was granted.
 *
 * RELEASE A: inert. Only the operator ceremony and tests read it; the effective-mandate reader every
 * live path uses is unchanged (a firewall pins both facts). Release B joins responsibility into the
 * live read.
 */
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agentMandates } from "@/db/schema/agent-mandate";
import { agentMandateResponsibilities } from "@/db/schema/agent-mandate-responsibility";
import { workDomains } from "@/db/schema/work-domain";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { ACTIVE_WORK_DOMAIN_STATUS } from "@/features/work-domain/contracts";

export interface ReadResponsibilityGrant {
  readonly kind: "organization" | "domain";
  readonly workDomainId: string | null;
  readonly slug: string | null;
  readonly name: string | null;
  readonly inService: boolean | null;
}

export type EffectiveMandateResponsibilityRead =
  | {
      readonly status: "read";
      readonly mandate: {
        readonly mandateId: string;
        readonly mandateRevision: number;
        readonly purpose: string;
        readonly proposalScope: readonly string[];
      } | null;
      /** Empty for a revision written through the released 5-value contract: undeclared. */
      readonly responsibility: readonly ReadResponsibilityGrant[];
    }
  | { readonly status: "refused"; readonly reason: "no-authorized-tenant-context" | "authority-unavailable" };

export async function readEffectiveMandateResponsibility(
  tenant: TenantContext | null,
  agentId: string,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<EffectiveMandateResponsibilityRead> {
  if (typeof window !== "undefined") throw new Error("Agent mandate reads are server-only.");
  if (!tenant?.tenantId) return { status: "refused", reason: "no-authorized-tenant-context" };
  let db: ControlPlaneDatabase | null;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return { status: "refused", reason: "authority-unavailable" };
  try {
    const [effective] = await db
      .select({
        id: agentMandates.id,
        revision: agentMandates.mandateRevision,
        purpose: agentMandates.purpose,
        scope: agentMandates.proposalScope,
      })
      .from(agentMandates)
      .where(and(eq(agentMandates.tenantId, tenant.tenantId), eq(agentMandates.agentId, agentId)))
      .orderBy(desc(agentMandates.mandateRevision))
      .limit(1);
    if (!effective) return { status: "read", mandate: null, responsibility: [] };
    const rows = await db
      .select({
        kind: agentMandateResponsibilities.responsibilityKind,
        workDomainId: agentMandateResponsibilities.workDomainId,
        slug: workDomains.slug,
        name: workDomains.name,
        lifecycleStatus: workDomains.lifecycleStatus,
      })
      .from(agentMandateResponsibilities)
      .leftJoin(
        workDomains,
        and(
          eq(workDomains.tenantId, agentMandateResponsibilities.tenantId),
          eq(workDomains.id, agentMandateResponsibilities.workDomainId),
        ),
      )
      .where(
        and(
          eq(agentMandateResponsibilities.tenantId, tenant.tenantId),
          eq(agentMandateResponsibilities.mandateId, effective.id),
        ),
      );
    return {
      status: "read",
      mandate: { mandateId: effective.id, mandateRevision: effective.revision, purpose: effective.purpose, proposalScope: effective.scope },
      responsibility: rows
        .map((r) => ({
          kind: r.kind as "organization" | "domain",
          workDomainId: r.workDomainId,
          slug: r.slug,
          name: r.name,
          inService: r.lifecycleStatus === null ? null : r.lifecycleStatus === ACTIVE_WORK_DOMAIN_STATUS,
        }))
        .sort((x, y) => (x.kind === y.kind ? (x.slug ?? "").localeCompare(y.slug ?? "") : x.kind === "organization" ? -1 : 1)),
    };
  } catch {
    return { status: "refused", reason: "authority-unavailable" };
  }
}
