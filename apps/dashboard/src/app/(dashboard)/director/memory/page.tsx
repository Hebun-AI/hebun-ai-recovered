import { PageHeader } from "@/components/layout/page-header";
import { CompanyMemorySurface } from "@/components/company-memory/company-memory-surface";
import { readCompanyMemory } from "@/features/company-memory/active-read.server";
import { resolveDashboardTenantContext } from "@/features/company-memory/tenant.server";

export const metadata = { title: "Company Memory — Hebun AI" };

/*
 * Company Memory (Knowledge L2 · Hebun UI Phase 21B rebuild).
 *
 * Reads admitted durable memory from the REAL Enterprise Memory authority
 * (enterprise-runtime-composition → enterprise-memory-query), read-only. It no
 * longer imports the seeded memory-runtime projection registry, memory-engine, or
 * any legacy registry seed as truth. Tenant isolation is enforced by the authority
 * via the authorized namespace; without an authorized organization context the
 * read fails closed and the surface says so. Nothing is fabricated; with zero
 * admitted records the surface shows an honest empty state.
 */

export const dynamic = "force-dynamic";

export default async function CompanyMemoryPage() {
  const tenantContext = await resolveDashboardTenantContext();
  const model = await readCompanyMemory(tenantContext);

  return (
    <>
      <PageHeader
        title="Company Memory"
        context="Governed durable organizational memory — read-only inspection of what has been admitted into Enterprise Memory."
      />
      <CompanyMemorySurface model={model} />
    </>
  );
}
