/*
 * company-memory/active-read.server.ts — server-only binding of the Company Memory
 * read to the ACTIVE Enterprise Memory runtime (Hebun UI Phase 21B).
 *
 * Selection of the backing store stays centralized in the Enterprise Runtime
 * Composition Root; this wrapper reads the active Memory UnitOfWork from it and
 * delegates to the pure, read-only orchestration. No writes, no admission.
 *
 * Server-only by convention: the `.server.ts` suffix and its `pg`-backed
 * composition import mean only server components import it.
 */

import { getActiveEnterpriseMemoryPersistence } from "@/features/enterprise-runtime-composition";
import { readCompanyMemoryFrom, type CompanyMemoryTenant } from "./read-service";
import type { CompanyMemoryReadModel } from "./contracts";

/** Read admitted Company Memory from the active Enterprise Memory authority. */
export async function readCompanyMemory(
  tenantContext: CompanyMemoryTenant | null,
): Promise<CompanyMemoryReadModel> {
  const { unitOfWork } = getActiveEnterpriseMemoryPersistence();
  return readCompanyMemoryFrom(unitOfWork, tenantContext);
}
