/*
 * company-memory — read-only Knowledge view onto the real Enterprise Memory
 * authority (Hebun UI Phase 21B). Only pure, client-safe modules are re-exported
 * here; the server-only runtime bindings (active-read.server, tenant.server) are
 * imported directly by server components.
 */

export * from "./contracts";
export { readCompanyMemoryFrom, type CompanyMemoryTenant } from "./read-service";
export { toCompanyMemoryView } from "./view-mapper";
