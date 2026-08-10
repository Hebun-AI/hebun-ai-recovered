import assert from "node:assert/strict";
import { Client } from "pg";
import type { RegistryCrudRecord } from "../../src/features/registry-crud/types";
import { createPostgresAdapter } from "../../src/features/persistence/supabase-postgres-adapter";
import {
  createDurableRegistryRepository,
  DurablePersistenceUnavailableError,
} from "../../src/features/tenant-registry/durable-registry-repository.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";

function hasCode(code: string) {
  return (error: unknown): boolean =>
    (error as { code?: string }).code === code;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r1_durable");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const env: NodeJS.ProcessEnv = {
    HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL: harness.dbUrl,
    NODE_ENV: "test",
  };
  const repoA = createDurableRegistryRepository(env);
  const repoRestart = createDurableRegistryRepository(env);
  const adapterB = createPostgresAdapter<RegistryCrudRecord>({
    collection: "registries",
    seed: () => [],
    env,
  });

  try {
    harness.migrateDatabase();
    await setup.connect();

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
    });
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "bob@globex.test",
    });
    const scopeA = { tenantId: alice.tenantId, actorId: alice.userId };
    const scopeB = { tenantId: bob.tenantId, actorId: bob.userId };

    // --- Durable write under tenant A ---
    const created = await repoA.create(scopeA, {
      slug: "finance",
      title: "Finance",
      description: "Finance registry",
      owner: "Director",
    });
    assert.equal(created.id, "finance");

    // Physical row exists with A's tenant and a DB-generated UUID (not the slug).
    const physical = await setup.query<{ id: string; tenant_id: string }>(
      "select id, tenant_id from registries where slug = 'finance'",
    );
    assert.equal(physical.rows.length, 1);
    assert.equal(physical.rows[0]!.tenant_id, alice.tenantId);
    assert.notEqual(physical.rows[0]!.id, "finance");

    // --- Durability across re-instantiation: a brand-new repository (new pool)
    // reads the record back. If it were memory-backed, this instance would be
    // empty. ---
    const restartList = await repoRestart.list(scopeA);
    assert.equal(
      restartList.some((record) => record.id === "finance"),
      true,
    );

    // --- Tenant isolation: B cannot read A's record ---
    assert.equal((await repoA.list(scopeB)).length, 0);
    assert.equal(await repoRestart.get(scopeB, "finance"), undefined);

    // --- Tenant isolation: B cannot mutate A's record ---
    await assert.rejects(
      () => adapterB.update("finance", { health: 1 }, { tenantId: bob.tenantId }),
      hasCode("PERSISTENCE_RECORD_NOT_FOUND"),
    );
    // A's record is untouched.
    assert.equal((await repoRestart.get(scopeA, "finance"))?.health, 100);

    // --- Fail closed: an operation with no tenant is rejected ---
    await assert.rejects(
      () => adapterB.list({}),
      hasCode("PERSISTENCE_TENANT_REQUIRED"),
    );

    // --- Same slug is independent per tenant (isolation of identity) ---
    const bFinance = await repoA.create(scopeB, {
      slug: "finance",
      title: "B Finance",
      description: "B finance registry",
      owner: "Director",
    });
    assert.equal(bFinance.id, "finance");
    const listB = await repoRestart.list(scopeB);
    assert.equal(listB.length, 1);
    assert.equal(listB[0]!.title, "B Finance");
    // A still owns its own 'finance' with its own title.
    assert.equal((await repoRestart.get(scopeA, "finance"))?.title, "Finance");

    // --- Fail closed: durable persistence not configured ---
    assert.throws(
      () => createDurableRegistryRepository({ NODE_ENV: "test" }),
      (error: unknown) => error instanceof DurablePersistenceUnavailableError,
    );

    console.log("r1 durable slice + isolation checks passed");
  } finally {
    await repoA.dispose().catch(() => undefined);
    await repoRestart.dispose().catch(() => undefined);
    await adapterB.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
