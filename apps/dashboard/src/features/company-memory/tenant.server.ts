/*
 * company-memory/tenant.server.ts — the single seam that resolves an authorized
 * organization context for Enterprise Memory reads (Hebun UI Phase 21B).
 *
 * Dashboard server components currently have no established authenticated request
 * container (no middleware or session provider is wired into this surface), so no
 * authorized TenantContext can be resolved here. The resolver therefore FAILS
 * CLOSED and returns null; Company Memory reads nothing and surfaces an honest
 * "authority unavailable" state rather than inventing a tenant/namespace.
 *
 * When authenticated requests are wired, this is the one place that maps the
 * request's TenantContext into the memory namespace. It must never return a
 * fabricated or default tenant.
 *
 * Server-only by convention (the `.server.ts` suffix).
 */

import type { CompanyMemoryTenant } from "./read-service";

/** Resolve the authorized tenant for this request, or null to fail closed. */
export async function resolveDashboardTenantContext(): Promise<CompanyMemoryTenant | null> {
  return null;
}
