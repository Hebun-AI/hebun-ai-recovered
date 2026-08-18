/*
 * R5.1 — THE DEPLOYMENT-POSSESSION CEREMONY, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The ceremony can turn either provider on and off for the whole deployment, refuses everything
 *    outside its closed vocabulary, never creates a control row as a side effect, keeps R3B's
 *    configuration refusal, claims no actor it cannot verify, writes no audit row — and can still do
 *    all of it when every tenant is suspended."
 *
 * The last clause is the load-bearing one. Suspension makes every tenant-scoped authority
 * unreachable, so an in-app control would be unusable in exactly the situation an operator most
 * needs it. That was true of the write R5.1 removed; this proves it is not true of the one it added.
 *
 * Disposable database, dropped on exit. Canonical is never opened. No provider, no network.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import {
  PROVIDER_KEYS,
  isProviderKey,
  readProviderControl,
  setProviderConnectivity,
} from "../../scripts/lib/provider-connectivity";
import { suspendTenant } from "../../scripts/lib/tenant-lifecycle";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";

/** Complete external-send configuration. Never a real credential. */
const FULL = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "A message from Hebun",
});

async function countRows(client: Client, table: string): Promise<number> {
  const r = await client.query<{ n: number }>(`select count(*)::int as n from "${table}"`);
  return r.rows[0]!.n;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE CLOSED VOCABULARY.
 * ═════════════════════════════════════════════════════════════════════════ */
async function closedVocabulary(client: Client): Promise<void> {
  assert.deepEqual(
    [...PROVIDER_KEYS].sort(),
    [CLAUDE_PROVIDER_KEY, EXTERNAL_SEND_PROVIDER_KEY].sort(),
    "exactly the two provider keys the repository defines",
  );

  for (const bogus of ["", "  ", "openai", "resend", "CLAUDE", "Claude", "*", "external_send", "claude;"]) {
    const outcome = await setProviderConnectivity(client, { providerKey: bogus, enabled: true, env: FULL });
    assert.equal(outcome.status, "refused", `"${bogus}" must be refused`);
    assert.equal(
      outcome.status === "refused" ? outcome.reason : null,
      "unknown-provider-key",
      `"${bogus}" must be refused as an unknown key`,
    );
  }
  /* A refused key writes nothing at all. */
  assert.equal(await countRows(client, "provider_connectivity_controls"), 0, "no row was minted");

  /*
   * THE EXACT SHAPE OF THE MATCH, stated because it is a real decision rather than an accident.
   * Surrounding whitespace is trimmed — the argument is typed by a human at a terminal, and the
   * repository already trims operator input everywhere (`normalizeSlug`). Trimming cannot widen a
   * two-value vocabulary: the trimmed string must still equal one of the two constants exactly.
   * CASE is deliberately NOT normalized: a provider key is an identifier, not a slug.
   */
  assert.ok(isProviderKey(" claude "), "surrounding whitespace is tolerated");
  assert.ok(isProviderKey(` ${EXTERNAL_SEND_PROVIDER_KEY}\t`), "…for both keys");
  assert.ok(!isProviderKey("CLAUDE"), "case is not normalized — the key is an identifier");
  assert.ok(!isProviderKey("cla ude"), "interior whitespace is not stripped");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. ENABLE / DISABLE, AND WHAT THE ROW RECORDS.
 * ═════════════════════════════════════════════════════════════════════════ */
async function enableAndDisable(client: Client): Promise<void> {
  /* An absent row is already disabled — refuse rather than mint a row that changes nothing. */
  const absentDisable = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: false,
    env: FULL,
  });
  assert.equal(absentDisable.status, "refused");
  assert.equal(
    absentDisable.status === "refused" ? absentDisable.reason : null,
    "already-in-that-state",
  );
  assert.equal(
    await countRows(client, "provider_connectivity_controls"),
    0,
    "a `disable` on an absent row must NOT create one",
  );

  /* Enable creates the row. */
  const on = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: true,
    env: FULL,
  });
  assert.equal(on.status, "changed");
  const enabled = on.status === "changed" ? on.control : undefined!;
  assert.equal(enabled.providerKey, CLAUDE_PROVIDER_KEY);
  assert.equal(enabled.directorEnabled, true);
  assert.equal(enabled.version, 1);
  assert.equal(
    enabled.updatedBy,
    null,
    "deployment possession has no verified actor, so the row names none",
  );

  /* Asking for the state it already holds is refused, and advances nothing. */
  const again = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: true,
    env: FULL,
  });
  assert.equal(again.status, "refused");
  assert.equal(again.status === "refused" ? again.reason : null, "already-in-that-state");
  assert.equal(
    (await readProviderControl(client, CLAUDE_PROVIDER_KEY))?.version,
    1,
    "a refused duplicate must not bump the optimistic version",
  );

  /* Disable moves it back and advances the version. */
  const off = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: false,
    env: FULL,
  });
  assert.equal(off.status, "changed");
  const disabled = off.status === "changed" ? off.control : undefined!;
  assert.equal(disabled.directorEnabled, false);
  assert.equal(disabled.version, 2);
  assert.equal(disabled.updatedBy, null);

  /* The columns the ceremony must never touch stayed exactly as they were. */
  const raw = await client.query<{
    created_by: string | null;
    created_by_type: string | null;
    updated_by_type: string | null;
    lifecycle_status: string;
    deleted_at: string | null;
  }>(
    `select created_by, created_by_type, updated_by_type, lifecycle_status, deleted_at
       from provider_connectivity_controls where provider_key = $1`,
    [CLAUDE_PROVIDER_KEY],
  );
  const row = raw.rows[0]!;
  /*
   * Actor TYPE stays NULL because the actor ID does. A SOURCE is not an ACTOR, and a type without
   * an id is false attribution under Hebun's both-or-neither invariant — not a gap awaiting a
   * later phase. See the R5.1 closure's R5.2 Gate A correction.
   */
  assert.equal(row.created_by, null, "created_by is never invented");
  assert.equal(row.created_by_type, null, "actor TYPE without an actor ID is false provenance");
  assert.equal(row.updated_by_type, null, "actor TYPE without an actor ID is false provenance");
  assert.equal(row.lifecycle_status, "active");
  assert.equal(row.deleted_at, null);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. R3B'S CONFIGURATION REFUSAL MOVED WITH THE WRITE.
 * ═════════════════════════════════════════════════════════════════════════ */
async function externalSendConfigurationGate(client: Client): Promise<void> {
  /* Each missing value alone is enough to refuse arming. */
  for (const missing of Object.keys(FULL) as (keyof typeof FULL)[]) {
    const partial: Record<string, string> = { ...FULL };
    delete partial[missing];
    const outcome = await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: true,
      env: partial,
    });
    assert.equal(outcome.status, "refused", `${missing} alone must block arming`);
    assert.equal(
      outcome.status === "refused" ? outcome.reason : null,
      "configuration-incomplete",
      `${missing} alone must refuse with configuration-incomplete`,
    );
  }
  /* And a refused arming creates NO external-send row — Step 15's silent-side-effect guard. */
  assert.equal(
    await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY),
    undefined,
    "a refused arming must not have minted an external-send control row",
  );

  /* With everything configured, arming succeeds. */
  const armed = await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: true,
    env: FULL,
  });
  assert.equal(armed.status, "changed");
  assert.equal(armed.status === "changed" ? armed.control.version : null, 1);

  /* DISARMING IS NEVER REFUSED FOR CONFIGURATION — even when it has since disappeared. */
  const disarmed = await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: false,
    env: {},
  });
  assert.equal(
    disarmed.status,
    "changed",
    "a kill switch must be reachable under a degraded configuration",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE TWO KEYS STAY INDEPENDENT, AND NOTHING ELSE IS TOUCHED.
 * ═════════════════════════════════════════════════════════════════════════ */
async function independenceAndContainment(client: Client): Promise<void> {
  await setProviderConnectivity(client, { providerKey: CLAUDE_PROVIDER_KEY, enabled: true, env: FULL });
  assert.equal(
    (await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY))?.directorEnabled,
    false,
    "enabling Claude must not arm external send — permitting Hebun to think is not permitting it to act",
  );

  await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: true,
    env: FULL,
  });
  await setProviderConnectivity(client, { providerKey: CLAUDE_PROVIDER_KEY, enabled: false, env: FULL });
  assert.equal(
    (await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY))?.directorEnabled,
    true,
    "disabling Claude must not disarm external send — two permissions, two blast radii",
  );

  /* One table, two rows, and nothing operational was created by any of it. */
  const rows = await client.query<{ provider_key: string }>(
    "select provider_key from provider_connectivity_controls order by provider_key",
  );
  assert.deepEqual(rows.rows.map((r) => r.provider_key), ["claude", "external-send"]);

  for (const table of [
    "action_execution_attempts",
    "action_permits",
    "heby_action_requests",
    "external_recipients",
    "work_artifacts",
    "executions",
    "messages",
  ]) {
    assert.equal(await countRows(client, table), 0, `the ceremony must not create a row in ${table}`);
  }

  /* No configuration value can reach the row. */
  const serialized = JSON.stringify((await client.query("select * from provider_connectivity_controls")).rows);
  for (const secret of Object.values(FULL)) {
    assert.ok(!serialized.includes(secret), "the control row carries no configuration value");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. RECOVERY — the ceremony works when every tenant is suspended.
 *
 * This is why the write is where it is. R4B's suspension makes every tenant-scoped authority
 * unreachable; the ceremony never depended on one.
 * ═════════════════════════════════════════════════════════════════════════ */
async function recoveryUnderTotalSuspension(client: Client): Promise<void> {
  await seedLocalIdentity(client, {
    companyName: "Acme",
    companySlug: "acme",
    email: "o@acme.test",
    roleType: "owner",
  });
  await seedLocalIdentity(client, {
    companyName: "Globex",
    companySlug: "globex",
    email: "d@globex.test",
    roleType: "director",
  });

  /* Suspend EVERY tenant — the state in which no in-app authority can resolve at all. */
  for (const slug of ["acme", "globex"]) {
    const outcome = await suspendTenant(client, { slug, reason: "r5.1 recovery proof" });
    assert.equal(outcome.status, "changed", `${slug} must suspend`);
  }
  const active = await client.query<{ n: number }>(
    "select count(*)::int as n from companies where tenant_status = 'active'",
  );
  assert.equal(active.rows[0]!.n, 0, "no tenant is active — every in-app authority is unreachable");

  /* The global kill switch is still operable in BOTH directions. */
  const before = await readProviderControl(client, CLAUDE_PROVIDER_KEY);
  const flipped = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: !before!.directorEnabled,
    env: FULL,
  });
  assert.equal(flipped.status, "changed", "the ceremony works with every tenant suspended");

  const back = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: before!.directorEnabled,
    env: FULL,
  });
  assert.equal(back.status, "changed", "and it is reversible in that state too");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. NO AUDIT DELTA — asserted across ONE transition, not against zero.
 *
 * `= 0` would be the wrong assertion: seeding legitimately audits nothing here today, but a fixture
 * that starts auditing tomorrow would turn a true claim into a false failure. The honest question is
 * whether the CEREMONY adds a row.
 * ═════════════════════════════════════════════════════════════════════════ */
async function noAuditDelta(client: Client): Promise<void> {
  const before = await countRows(client, "audit_log");
  const outcome = await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: false,
    env: FULL,
  });
  assert.equal(outcome.status, "changed", "the transition must actually happen");
  const after = await countRows(client, "audit_log");
  assert.equal(after, before, "the ceremony writes no audit row — a terminal has no actor to name");

  /* And nothing anywhere claims a platform authority that does not exist. */
  const fabricated = await client.query<{ n: number }>(
    "select count(*)::int as n from audit_log where authority_source is distinct from 'membership'",
  );
  assert.equal(fabricated.rows[0]!.n, 0, "no platform-admin, system or service authority was fabricated");
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r51_ceremony");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();

    await closedVocabulary(client);
    await enableAndDisable(client);
    await externalSendConfigurationGate(client);
    await independenceAndContainment(client);
    await recoveryUnderTotalSuspension(client);
    await noAuditDelta(client);

    console.log("R5.1 ceremony (postgres): all assertions passed.");
  } finally {
    await client.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
