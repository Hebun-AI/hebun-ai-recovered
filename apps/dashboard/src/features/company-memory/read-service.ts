/*
 * company-memory/read-service.ts — the read-only Company Memory orchestration
 * (Hebun UI Phase 21B).
 *
 * It reads admitted organizational memory from the REAL Enterprise Memory query
 * boundary (features/enterprise-memory-query · queryMemory) over an injected
 * Memory UnitOfWork. It performs NO writes, NO admission, and NO reasoning.
 *
 * Tenant isolation is preserved by the authority itself: the namespace comes from
 * the authorized TenantContext and is applied as a query predicate inside the
 * engine — there is no global list and no client-side filtering. When no
 * authorized context is supplied, the read fails closed and returns an honest
 * "authority-unavailable" state without touching memory.
 *
 * This module is deliberately free of server-only / persistence-composition
 * imports so it stays pure and deterministically testable. The active runtime is
 * supplied by the server wrapper (active-read.server.ts).
 */

import { queryMemory } from "@/features/enterprise-memory-query";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence";
import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type { TenantContext } from "@/features/auth";
import { toCompanyMemoryView } from "./view-mapper";
import type { CompanyMemoryReadModel } from "./contracts";

/** The narrow slice of a TenantContext this read depends on. */
export type CompanyMemoryTenant = Pick<TenantContext, "tenantId">;

/**
 * Read the current admitted memory for an authorized tenant from the real
 * Enterprise Memory authority. Read-only; fails closed without a tenant context.
 */
export async function readCompanyMemoryFrom(
  unitOfWork: UnitOfWork<MemoryRepository>,
  tenantContext: CompanyMemoryTenant | null,
): Promise<CompanyMemoryReadModel> {
  if (!tenantContext || !tenantContext.tenantId) {
    return {
      connection: "authority-unavailable",
      reason: "no-authorized-tenant-context",
      records: [],
    };
  }

  try {
    const result = await queryMemory(unitOfWork, {
      namespace: tenantContext.tenantId,
      approvedOnly: true,
      currentOnly: true,
    });

    if (result.status !== "Success") {
      return { connection: "read-failed", reason: result.status, records: [] };
    }

    const records = result.value.map(toCompanyMemoryView);
    return {
      connection: records.length > 0 ? "connected-populated" : "connected-empty",
      records,
    };
  } catch (error) {
    return {
      connection: "read-failed",
      reason: error instanceof Error ? error.message : "read-failed",
      records: [],
    };
  }
}
