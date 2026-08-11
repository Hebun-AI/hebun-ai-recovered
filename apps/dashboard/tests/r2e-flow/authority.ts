/*
 * R2E — provider-control authority (INTEGRATION, real local Postgres).
 *
 * Proves that only the owner/director authority bands may change provider connectivity, that the
 * role is resolved SERVER-SIDE (tenant-scoped) from the durable role — never client-claimable —
 * and that anything unresolved fails closed to forbidden.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import { resolveProviderControlAuthority } from "../../src/features/heby-provider-ops/provider-authority.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

function tenantCtx(roleId: string, tenantId: string): TenantContext {
  return { roleId, tenantId } as unknown as TenantContext;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r2e_authority");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await setup.connect();
    const db = controlPlane.db;

    const owner = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme", email: "o@acme.test", roleType: "owner" });
    const director = await seedLocalIdentity(setup, { companyName: "Beta", companySlug: "beta", email: "d@beta.test", roleType: "director" });
    const operator = await seedLocalIdentity(setup, { companyName: "Gamma", companySlug: "gamma", email: "op@gamma.test", roleType: "operator" });
    const auditor = await seedLocalIdentity(setup, { companyName: "Delta", companySlug: "delta", email: "au@delta.test", roleType: "auditor" });
    const member = await seedLocalIdentity(setup, { companyName: "Eps", companySlug: "eps", email: "m@eps.test", roleType: "member" });

    // --- Authorized bands ---
    assert.equal((await resolveProviderControlAuthority(tenantCtx(owner.roleId, owner.tenantId), db)).authorized, true, "owner authorized");
    assert.equal((await resolveProviderControlAuthority(tenantCtx(director.roleId, director.tenantId), db)).authorized, true, "director authorized");

    // --- Forbidden bands ---
    for (const s of [operator, auditor, member]) {
      const authority = await resolveProviderControlAuthority(tenantCtx(s.roleId, s.tenantId), db);
      assert.equal(authority.authorized, false, `${s.email} (${authority.roleType}) forbidden`);
    }

    // --- Fail-closed: unknown role, cross-tenant role id, and missing ids all forbidden ---
    assert.equal((await resolveProviderControlAuthority(tenantCtx(randomUUID(), owner.tenantId), db)).authorized, false, "unknown role id forbidden");
    // owner.roleId is real but belongs to owner.tenantId — presenting it under another tenant must not resolve.
    assert.equal((await resolveProviderControlAuthority(tenantCtx(owner.roleId, director.tenantId), db)).authorized, false, "cross-tenant role id forbidden");
    assert.equal((await resolveProviderControlAuthority(tenantCtx("", ""), db)).authorized, false, "missing ids forbidden");

    console.log("r2e authority checks passed");
  } finally {
    await controlPlane.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
