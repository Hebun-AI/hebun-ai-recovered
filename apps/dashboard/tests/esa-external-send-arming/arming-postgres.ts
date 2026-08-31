/*
 * ESA — PRODUCTION ARMING AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Arming writes exactly one boolean on one root-scoped row, under the production ceremony root,
 *    and creates no request, permit, attempt, decision or audit row anywhere."
 *
 * The gate's DECISION is proved purely in the sibling file. What needs a real database is the
 * WRITE: that it goes through the released writer, that it records the production root, and above
 * all that nothing else in the deployment moved.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import {
  readProviderControl,
  setProviderConnectivity,
} from "../../scripts/lib/provider-connectivity";
import { CEREMONY_SOURCE_PRODUCTION } from "../../scripts/lib/production-possession";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import {
  EXTERNAL_SEND_API_KEY_ENV,
  EXTERNAL_SEND_FROM_ENV,
  EXTERNAL_SEND_SUBJECT_ENV,
} from "../../src/features/action-execution-live/resend-email-transport.server";
import { evaluateExternalSendArming } from "../../scripts/lib/external-send-arming";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

/** Complete configuration. NEVER a real credential. */
const CONFIGURED = {
  [EXTERNAL_SEND_API_KEY_ENV]: "not-a-real-key",
  [EXTERNAL_SEND_FROM_ENV]: "sender@example.test",
  [EXTERNAL_SEND_SUBJECT_ENV]: "Fixed subject",
} as const;

const TENANT = "10000000-0000-4000-8000-00000000ea01";

async function countRows(client: Client, table: string): Promise<number> {
  const result = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`);
  return Number(result.rows[0]!.n);
}

const WATCHED = [
  "heby_action_requests",
  "action_permits",
  "action_execution_attempts",
  "decision_records",
  "governance_sessions",
  "audit_log",
  "knowledge_nodes",
  "external_recipients",
] as const;

async function snapshot(client: Client): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of WATCHED) out[table] = await countRows(client, table);
  return out;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_esa_arming");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();

    await client.query(
      `insert into companies (id, name, slug) values ($1, 'Arming Tenant', 'arming-tenant')`,
      [TENANT],
    );
    await client.query(
      `insert into external_recipients
         (tenant_id, display_name, endpoint_kind, endpoint_value, endpoint_digest, status)
       values ($1, 'Test Recipient', 'email', 'someone@example.test', repeat('a', 64), 'active')`,
      [TENANT],
    );

    const before = await snapshot(client);
    assert.equal(
      await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY),
      undefined,
      "a fresh deployment holds NO external-send row, which every reader treats as disarmed",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. THE GATE SAYS READY, AND THE WRITE RECORDS THE PRODUCTION ROOT.
     * ═════════════════════════════════════════════════════════════════════ */
    const verdict = evaluateExternalSendArming({
      transition: "arm",
      postureMode: "production",
      currentlyArmed: undefined,
      reach: { readable: true, activeRecipients: 1, tenantsWithRecipients: 1 },
      env: CONFIGURED,
    });
    assert.equal(verdict.status, "ready");

    const armed = await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: true,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
      env: CONFIGURED,
    });
    assert.equal(armed.status, "changed");
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
     * 2. NOTHING ELSE MOVED. This is the assertion the whole gate rests on.
     * ═════════════════════════════════════════════════════════════════════ */
    const after = await snapshot(client);
    for (const table of WATCHED) {
      assert.equal(
        after[table],
        before[table],
        `${table} must be untouched — arming makes sending REACHABLE, it authorizes nothing`,
      );
    }
    assert.equal(
      await countRows(client, "provider_connectivity_controls"),
      1,
      "exactly one control row exists; no second arming state was created",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE WRITER'S OWN CONFIGURATION REFUSAL IS STILL THERE, UNDERNEATH.
     * ═════════════════════════════════════════════════════════════════════ */
    await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: false,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
      env: CONFIGURED,
    });
    const unconfigured = await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: true,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
      env: {},
    });
    assert.equal(
      unconfigured.status === "refused" && unconfigured.reason,
      "configuration-incomplete",
      "the released writer refuses an unconfigured arming regardless of which ceremony called it",
    );
    assert.equal(
      (await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY))?.directorEnabled,
      false,
      "and the refusal left the row disarmed",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. DISARMING WORKS UNDER A DEGRADED DEPLOYMENT.
     * ═════════════════════════════════════════════════════════════════════ */
    await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: true,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
      env: CONFIGURED,
    });
    const closed = await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: false,
      controlSource: CEREMONY_SOURCE_PRODUCTION,
      env: {},
    });
    assert.equal(
      closed.status,
      "changed",
      "the kill switch closes with NO configuration present — the failure direction that matters",
    );
    assert.equal(closed.status === "changed" && closed.control.directorEnabled, false);

    /* And the deployment is still otherwise untouched after four transitions. */
    const finalCounts = await snapshot(client);
    for (const table of WATCHED) assert.equal(finalCounts[table], before[table], `${table} untouched`);

    console.log("ESA arming (postgres): PASS");
  } finally {
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
