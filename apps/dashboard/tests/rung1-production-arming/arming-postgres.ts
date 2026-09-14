/*
 * RUNG 1 PRODUCTION ARMING — AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The dedicated ceremony reaches the ONE released control-mutation seam, writes exactly one
 *    boolean on one root-scoped row under the production root, creates no second arming state, and
 *    authorizes, permits, triggers and executes nothing."
 *
 * The gate's DECISION is proved purely in the sibling file. What needs a real database is the
 * WRITE: that it goes through the released writer, that it records the production root, that the
 * released default really is an ABSENT row, and above all that nothing else in the deployment moved.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import {
  readProviderControl,
  resolveGenericProductionReach,
  setProviderConnectivity,
} from "../../scripts/lib/provider-connectivity";
import { CEREMONY_SOURCE_PRODUCTION } from "../../scripts/lib/production-possession";
import { MACHINE_INTERNAL_EXECUTION_CONTROL_KEY } from "../../src/features/governed-machine-execution/machine-execution-control.server";
import { evaluateMachineExecutionArming } from "../../scripts/lib/machine-execution-arming";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

async function countRows(client: Client, table: string): Promise<number> {
  const result = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`);
  return Number(result.rows[0]!.n);
}

/**
 * EVERY TABLE AN ARMING MUST NOT TOUCH. The authorization chain, the execution chain, the work the
 * capability would eventually write, and the audit trail that would record it.
 */
const WATCHED = [
  "heby_action_requests",
  "action_permits",
  "action_execution_attempts",
  "decision_records",
  "governance_sessions",
  "work_items",
  "audit_log",
] as const;

async function snapshot(client: Client): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of WATCHED) out[table] = await countRows(client, table);
  return out;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_rung1_arming");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();

    const before = await snapshot(client);

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. THE RELEASED DEFAULT IS AN ABSENT ROW, NOT AN EXPLICIT FALSE.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(
      await readProviderControl(client, MACHINE_INTERNAL_EXECUTION_CONTROL_KEY),
      undefined,
      "a fresh deployment holds NO machine-internal-execution row — disarmed by absence",
    );
    assert.equal(
      await countRows(client, "provider_connectivity_controls"),
      0,
      "and no control row of any kind was minted by merely reading",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. THE GATE SAYS READY, AND THE WRITE RECORDS THE PRODUCTION ROOT.
     * ═════════════════════════════════════════════════════════════════════ */
    const verdict = evaluateMachineExecutionArming({
      transition: "arm",
      postureMode: "production",
      currentlyArmed: undefined,
    });
    assert.equal(verdict.status, "ready");

    const armed = await setProviderConnectivity(client, {
      providerKey: MACHINE_INTERNAL_EXECUTION_CONTROL_KEY,
      enabled: true,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
    });
    assert.equal(armed.status, "changed", "the dedicated gate reaches the released write seam");
    assert.equal(armed.status === "changed" && armed.control.directorEnabled, true);
    assert.equal(
      armed.status === "changed" && armed.control.controlSource,
      CEREMONY_SOURCE_PRODUCTION,
      "the row records WHICH root caused it — a local run cannot produce this value",
    );
    assert.equal(
      armed.status === "changed" && armed.control.updatedBy,
      null,
      "possession has no verified actor, so updated_by stays NULL rather than naming one",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. NOTHING ELSE MOVED. This is the assertion the whole gate rests on.
     * ═════════════════════════════════════════════════════════════════════ */
    const after = await snapshot(client);
    for (const table of WATCHED) {
      assert.equal(
        after[table],
        before[table],
        `${table} must be untouched — arming makes triggering REACHABLE, it authorizes nothing`,
      );
    }
    assert.equal(
      await countRows(client, "provider_connectivity_controls"),
      1,
      "exactly one control row exists; no second arming state was created",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. ONE KEY, ONE BLAST RADIUS — ARMING THIS ARMS NOTHING ELSE.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const neighbour of ["claude", "external-send", "provider-observation-read"]) {
      assert.equal(
        await readProviderControl(client, neighbour),
        undefined,
        `${neighbour} was not armed as a side effect — one control, one capability`,
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. IDEMPOTENCE, THEN DISARM — AND DISARM NEEDS NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    const again = await setProviderConnectivity(client, {
      providerKey: MACHINE_INTERNAL_EXECUTION_CONTROL_KEY,
      enabled: true,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
    });
    assert.equal(
      again.status === "refused" && again.reason,
      "already-in-that-state",
      "the released optimistic predicate refuses a no-op rather than bumping a version",
    );

    const disarmVerdict = evaluateMachineExecutionArming({
      transition: "disarm",
      postureMode: "production",
      currentlyArmed: true,
      scope: [],
    });
    assert.equal(
      disarmVerdict.status,
      "ready",
      "the kill switch closes with an EMPTY released scope — the failure direction that matters",
    );

    const disarmed = await setProviderConnectivity(client, {
      providerKey: MACHINE_INTERNAL_EXECUTION_CONTROL_KEY,
      enabled: false,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
    });
    assert.equal(disarmed.status, "changed");
    assert.equal(disarmed.status === "changed" && disarmed.control.directorEnabled, false);
    assert.equal(
      disarmed.status === "changed" && disarmed.control.version,
      2,
      "one row, versioned forward — not a second row and not a new state owner",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE GENERIC PRODUCTION PATH NEVER BECAME A WAY IN.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(
      resolveGenericProductionReach(MACHINE_INTERNAL_EXECUTION_CONTROL_KEY).status,
      "refused",
      "the key stays generically unreachable in production even now that a row exists for it",
    );

    /* And the deployment is still otherwise untouched after three transitions. */
    const finalCounts = await snapshot(client);
    for (const table of WATCHED) assert.equal(finalCounts[table], before[table], `${table} untouched`);

    console.log("RUNG 1 production arming (postgres): PASS");
  } finally {
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
