/*
 * R3B — the external-send arming permission, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Arming external send writes ONE row to the SAME authority Claude uses, under a DIFFERENT key,
 *    survives reconnection, records the actor, fails closed while absent — and never touches the
 *    Claude permission in either direction. Arming creates no permit, no attempt, no recipient and
 *    no request."
 *
 * The R2E sibling proves this for Claude. This proves the second key is genuinely independent,
 * which is the whole reason it is a second key: enabling Hebun to THINK must not enable it to ACT.
 *
 * Uses a disposable database, dropped on exit. Canonical is never opened. No provider, no network.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createProviderConnectivityControlRepository,
  resolveDirectorEnabled,
  CLAUDE_PROVIDER_KEY,
} from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { resolveExternalSendEnabled } from "../../src/features/action-execution/execution-control.server";
import { readExternalSendOpsView } from "../../src/features/action-execution/execution-arming-projection.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const ACTOR = "44444444-4444-4444-4444-444444444444";
const FULL = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "A message from Hebun",
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3b_arming");
  await harness.createDatabase();
  const controlPlane = createControlPlaneDb(harness.dbUrl);
  const setup = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await setup.connect();
    const repo = createProviderConnectivityControlRepository(controlPlane.db);

    /* ── FAIL CLOSED WHILE ABSENT ─────────────────────────────────────────── */
    assert.equal(await resolveExternalSendEnabled({ repo: null }), false, "no repo → disabled");
    assert.equal(await repo.getControl(EXTERNAL_SEND_PROVIDER_KEY), null, "no row yet");
    assert.equal(await resolveExternalSendEnabled({ repo }), false, "missing row → disabled");
    const bare = await readExternalSendOpsView({ env: FULL, repo });
    assert.equal(bare.armingState, "configured-disarmed", "configured, and not armed");

    /* ── ARM: one row, version 1, actor recorded ──────────────────────────── */
    const armed = await repo.setDirectorEnabled(EXTERNAL_SEND_PROVIDER_KEY, true, { actorId: ACTOR });
    assert.equal(armed.providerKey, EXTERNAL_SEND_PROVIDER_KEY);
    assert.equal(armed.directorEnabled, true);
    assert.equal(armed.version, 1);
    assert.equal(armed.updatedBy, ACTOR, "actor attribution is recorded on the arming write");
    assert.equal(await resolveExternalSendEnabled({ repo }), true);
    assert.equal((await readExternalSendOpsView({ env: FULL, repo })).armingState, "armed");

    /* Armed BUT unconfigured is still not armed — the composite refuses to lie. */
    assert.equal((await readExternalSendOpsView({ env: {}, repo })).armingState, "unconfigured");
    assert.equal(
      (await readExternalSendOpsView({ env: {}, repo })).directorEnabled,
      true,
      "the raw permission stays visible even when the composite says unconfigured",
    );

    /* ── THE CLAUDE PERMISSION IS UNTOUCHED IN BOTH DIRECTIONS ────────────── */
    assert.equal(
      await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }),
      false,
      "arming external send must not have enabled Claude",
    );
    await repo.setDirectorEnabled(CLAUDE_PROVIDER_KEY, true, { actorId: ACTOR });
    assert.equal(await resolveExternalSendEnabled({ repo }), true, "external send unaffected");
    await repo.setDirectorEnabled(CLAUDE_PROVIDER_KEY, false, { actorId: ACTOR });
    assert.equal(
      await resolveExternalSendEnabled({ repo }),
      true,
      "disabling Claude must NOT disarm external send — two permissions, two blast radii",
    );

    /* ── DISARM: survives, bumps the version, stays independent ───────────── */
    const disarmed = await repo.setDirectorEnabled(EXTERNAL_SEND_PROVIDER_KEY, false, { actorId: ACTOR });
    assert.equal(disarmed.directorEnabled, false);
    assert.equal(disarmed.version, 2, "the optimistic version advances on every change");
    assert.equal(await resolveExternalSendEnabled({ repo }), false);
    assert.equal(
      await resolveDirectorEnabled(CLAUDE_PROVIDER_KEY, { repo }),
      false,
      "the Claude row kept its own last value",
    );

    /* ── SURVIVES A BRAND-NEW CONNECTION ──────────────────────────────────── */
    await repo.setDirectorEnabled(EXTERNAL_SEND_PROVIDER_KEY, true, { actorId: ACTOR });
    const reconnected = createControlPlaneDb(harness.dbUrl);
    const repo2 = createProviderConnectivityControlRepository(reconnected.db);
    assert.equal(
      await resolveExternalSendEnabled({ repo: repo2 }),
      true,
      "the arming permission is durable across a reconnect",
    );
    await reconnected.dispose?.();

    /* ── EXACTLY TWO ROWS, ONE TABLE ──────────────────────────────────────── */
    const rows = await setup.query<{ provider_key: string; director_enabled: boolean }>(
      "select provider_key, director_enabled from provider_connectivity_controls order by provider_key",
    );
    assert.deepEqual(
      rows.rows.map((r) => r.provider_key),
      ["claude", "external-send"],
      "one table holds both permissions — no second kill-switch authority was created",
    );

    /* ── ARMING CREATED NO OPERATIONAL SUBSTRATE ──────────────────────────── */
    for (const table of [
      "action_execution_attempts",
      "action_permits",
      "heby_action_requests",
      "external_recipients",
      "work_artifacts",
      "work_artifact_revisions",
      "executions",
    ]) {
      const count = await setup.query<{ n: number }>(`select count(*)::int as n from "${table}"`);
      assert.equal(count.rows[0]!.n, 0, `arming must not have created a row in ${table}`);
    }

    /* No connectivity-control row may carry an address, a body, or a credential. */
    const serialized = JSON.stringify(
      (await setup.query("select * from provider_connectivity_controls")).rows,
    );
    for (const secret of Object.values(FULL)) {
      assert.ok(!serialized.includes(secret), "the control row carries no configuration value");
    }

    console.log("R3B arming durability: all assertions passed.");
  } finally {
    await setup.end().catch(() => {});
    await controlPlane.dispose?.();
    await harness.dropDatabase();
  }
}

void main();
