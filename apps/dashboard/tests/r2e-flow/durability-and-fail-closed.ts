/*
 * R2E — durable Director control (INTEGRATION, real local Postgres) + fail-closed default.
 *
 * Proves the ON/OFF permission survives reload/reconnect ("restart"), advances its optimistic
 * version on each change, records actor attribution, and — most importantly — FAILS CLOSED:
 * no repository, no row, or an unresolved control all read as disabled. No provider, no network.
 */
import assert from "node:assert/strict";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createProviderConnectivityControlRepository,
  resolveDirectorEnabled,
  CLAUDE_PROVIDER_KEY,
} from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const ACTOR = "33333333-3333-3333-3333-333333333333";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r2e_control");
  await harness.createDatabase();
  const controlPlane = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    const repo = createProviderConnectivityControlRepository(controlPlane.db);

    // --- Fail-closed defaults ---
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo: null }), false, "no repo → disabled");
    assert.equal(await repo.getControl(CLAUDE_PROVIDER_KEY), null, "no row → null control");
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }), false, "missing row → disabled");

    // --- Enable: durable true, version 1, actor recorded ---
    const enabled = await repo.setDirectorEnabled(CLAUDE_PROVIDER_KEY, true, { actorId: ACTOR });
    assert.equal(enabled.directorEnabled, true);
    assert.equal(enabled.version, 1);
    assert.equal(enabled.updatedBy, ACTOR, "actor attribution recorded");
    assert.equal((await repo.getControl(CLAUDE_PROVIDER_KEY))?.directorEnabled, true);
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }), true);

    // --- Survives a NEW repo instance over the same connection (reload) ---
    const repo2 = createProviderConnectivityControlRepository(controlPlane.db);
    assert.equal((await repo2.getControl(CLAUDE_PROVIDER_KEY))?.directorEnabled, true, "survives new repo instance");

    // --- Survives a brand-new control-plane CONNECTION (process restart) ---
    const restart = createControlPlaneDb(harness.dbUrl);
    try {
      const repo3 = createProviderConnectivityControlRepository(restart.db);
      assert.equal((await repo3.getControl(CLAUDE_PROVIDER_KEY))?.directorEnabled, true, "survives reconnect");
    } finally {
      await restart.dispose().catch(() => undefined);
    }

    // --- Disable: durable false, version advances (optimistic concurrency) ---
    const disabled = await repo.setDirectorEnabled(CLAUDE_PROVIDER_KEY, false, { actorId: ACTOR });
    assert.equal(disabled.directorEnabled, false);
    assert.equal(disabled.version, 2, "version advances on each change");
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }), false, "OFF persists");

    // --- Re-enable to prove the toggle round-trips durably ---
    const reEnabled = await repo.setDirectorEnabled(CLAUDE_PROVIDER_KEY, true, { actorId: ACTOR });
    assert.equal(reEnabled.directorEnabled, true);
    assert.equal(reEnabled.version, 3);

    console.log("r2e durability + fail-closed checks passed");
  } finally {
    await controlPlane.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
