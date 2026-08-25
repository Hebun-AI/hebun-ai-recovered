/*
 * R2E — durable Director control (INTEGRATION, real local Postgres) + fail-closed default.
 *
 * Proves the ON/OFF permission survives reload/reconnect ("restart"), advances its optimistic
 * version on each change, and — most importantly — FAILS CLOSED: no repository, no row, or an
 * unresolved control all read as disabled. No provider, no network.
 *
 * ── WHAT R5.1 CHANGED HERE ───────────────────────────────────────────────────
 *
 * The WRITE moved. `repo.setDirectorEnabled` no longer exists: the application's repository is
 * read-only, and the durable control is mutated only by the deployment-possession ceremony. So this
 * file now drives the writer that actually exists and keeps proving the same durability properties
 * against it — a durability proof against a deleted seam would prove nothing.
 *
 * The actor assertion changed MEANING, not merely shape. It used to assert `updatedBy === ACTOR`
 * because a session user was the (wrong) authority. The ceremony has no verified actor, so it writes
 * NULL rather than naming a human who did not act; that is asserted below as a positive property.
 *
 * Actor-type provenance and a human-only constraint are absent PERMANENTLY, not pending a later
 * phase. Deployment possession is a SOURCE, not an ACTOR: writing `updated_by_type` without an
 * `updated_by` is false provenance under Hebun's both-or-neither invariant, and a
 * `CHECK(updated_by_type = 'human')` would reject every ceremony write. See the R5.1 closure's
 * R5.2 Gate A correction.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createProviderConnectivityControlRepository,
  resolveDirectorEnabled,
  CLAUDE_PROVIDER_KEY,
} from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { setProviderConnectivity } from "../../scripts/lib/provider-connectivity";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { CEREMONY_SOURCE_LOCAL } from "../../scripts/lib/production-possession";

/** The ceremony's write, unwrapped — a refusal here is a test bug, not an expected branch. */
async function ceremonySet(client: Client, enabled: boolean) {
  const outcome = await setProviderConnectivity(client, { controlSource: CEREMONY_SOURCE_LOCAL, providerKey: CLAUDE_PROVIDER_KEY,
    enabled,
  });
  assert.equal(outcome.status, "changed", `ceremony must change the control to ${enabled}`);
  return outcome.status === "changed" ? outcome.control : undefined!;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r2e_control");
  await harness.createDatabase();
  const controlPlane = createControlPlaneDb(harness.dbUrl);
  const client = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();
    const repo = createProviderConnectivityControlRepository(controlPlane.db);

    // --- Fail-closed defaults ---
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo: null }), false, "no repo → disabled");
    assert.equal(await repo.getControl(CLAUDE_PROVIDER_KEY), null, "no row → null control");
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }), false, "missing row → disabled");

    // --- Enable: durable true, version 1, and NO actor claimed ---
    const enabled = await ceremonySet(client, true);
    assert.equal(enabled.directorEnabled, true);
    assert.equal(enabled.version, 1);
    assert.equal(
      enabled.updatedBy,
      null,
      "deployment possession has no verified actor, so the row names none",
    );
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
    const disabled = await ceremonySet(client, false);
    assert.equal(disabled.directorEnabled, false);
    assert.equal(disabled.version, 2, "version advances on each change");
    assert.equal(await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }), false, "OFF persists");

    // --- Re-enable to prove the toggle round-trips durably ---
    const reEnabled = await ceremonySet(client, true);
    assert.equal(reEnabled.directorEnabled, true);
    assert.equal(reEnabled.version, 3);

    console.log("r2e durability + fail-closed checks passed");
  } finally {
    await client.end().catch(() => undefined);
    await controlPlane.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
