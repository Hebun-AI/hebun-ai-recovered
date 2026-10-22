/*
 * ORGANIZATION-READINESS-1 — read each part of this organization's readiness from the released reader
 * that owns it, for the session's tenant only, and hand the facts to the pure describer.
 *
 * Read-only. No query of its own, no write, no provider call, no credential opened. Every reader is
 * asked independently and a failure of one is that row's `unknown`, never another row's answer.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readExternalSendOpsView } from "@/features/action-execution/execution-arming-projection.server";
import {
  ANTHROPIC_MESSAGES_SCOPE,
  CONFIGURED_ANTHROPIC_ACCOUNT_REF,
} from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { readEffectiveTenantExternalAiDataUse } from "@/features/external-ai-data-use/read-tenant-external-ai-data-use.server";
import { readGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { readProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { readWorkDomains } from "@/features/work-domain/read-work-domains.server";
import {
  describeOrganizationReadiness,
  type OrganizationReadinessFacts,
  type ReadinessRow,
} from "./organization-readiness";

export interface OrganizationReadinessDeps {
  readonly readGovernance?: typeof readGovernanceAuthority;
  readonly readExternalAi?: typeof readEffectiveTenantExternalAiDataUse;
  readonly readModelOps?: typeof readProviderOpsView;
  readonly readCapabilities?: typeof getCapabilityAvailability;
  readonly readSendOps?: typeof readExternalSendOpsView;
  readonly readDomains?: typeof readWorkDomains;
}

export type OrganizationReadinessResult =
  | { readonly status: "read"; readonly rows: readonly ReadinessRow[] }
  | { readonly status: "unauthenticated" };

async function settle<T, R>(read: () => Promise<T>, map: (value: T) => R, fallback: R): Promise<R> {
  try {
    return map(await read());
  } catch {
    return fallback;
  }
}

export async function readOrganizationReadiness(
  tenant: TenantContext | null,
  deps: OrganizationReadinessDeps = {},
): Promise<OrganizationReadinessResult> {
  if (typeof window !== "undefined") throw new Error("Organization readiness reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  const unavailable = { status: "unavailable" } as const;

  const [governance, externalAi, modelDispatch, capabilities, publishing, workDomains] = await Promise.all([
    settle(
      () => (deps.readGovernance ?? readGovernanceAuthority)(tenant),
      (r): OrganizationReadinessFacts["governance"] =>
        r.status === "read"
          ? { status: "read", established: r.authority.bootstrap !== null, viewerIsAuthority: r.authority.viewerIsGovernanceAuthority }
          : unavailable,
      unavailable,
    ),
    settle(
      () => (deps.readExternalAi ?? readEffectiveTenantExternalAiDataUse)(tenant.tenantId, ANTHROPIC_MESSAGES_SCOPE, CONFIGURED_ANTHROPIC_ACCOUNT_REF),
      (r): OrganizationReadinessFacts["externalAi"] =>
        r.status === "absent"
          ? { status: "absent" }
          : r.status === "unavailable"
            ? unavailable
            : r.effective.state === "active"
              ? { status: "active", purposes: [...new Set(r.effective.scopes.map((s) => s.purpose))].sort() }
              : { status: "withdrawn" },
      unavailable,
    ),
    settle(
      () => (deps.readModelOps ?? readProviderOpsView)(),
      (v): OrganizationReadinessFacts["modelDispatch"] => v.dispatch,
      "unknown" as const,
    ),
    settle(
      () => (deps.readCapabilities ?? getCapabilityAvailability)(tenant),
      (v): OrganizationReadinessFacts["capabilities"] => ({
        status: "read",
        available: v.capabilities.filter((c) => c.state === "available").map((c) => c.capability).sort(),
        unavailableCount: v.capabilities.filter((c) => c.state !== "available").length,
      }),
      unavailable,
    ),
    settle(
      () => (deps.readSendOps ?? readExternalSendOpsView)({ tenantId: tenant.tenantId }),
      (v): OrganizationReadinessFacts["publishing"] => ({ status: "read", tenantArming: v.tenantArming, effectiveSend: v.effectiveSend }),
      unavailable,
    ),
    settle(
      () => (deps.readDomains ?? readWorkDomains)(tenant),
      (r): OrganizationReadinessFacts["workDomains"] => (r.status === "read" ? { status: "read", count: r.workDomains.length } : unavailable),
      unavailable,
    ),
  ]);

  return {
    status: "read",
    rows: describeOrganizationReadiness({ governance, externalAi, modelDispatch, capabilities, publishing, workDomains }),
  };
}
