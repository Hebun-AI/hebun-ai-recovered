/*
 * R2H — `control_source`, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Every successful transition records the root that produced the state the row NOW holds; a row
 *    that predates the column keeps NULL forever unless a ceremony moves it; no caller can invent a
 *    root; and `external-send` is governed identically to `claude` with no special case."
 *
 * Disposable database, dropped on exit. Canonical is never opened. No provider, no network.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import {
  readProviderControl,
  setProviderConnectivity,
} from "../../scripts/lib/provider-connectivity";
import {
  CEREMONY_SOURCE_LOCAL,
  CEREMONY_SOURCE_PRODUCTION,
} from "../../scripts/lib/production-possession";
import {
  PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR,
  PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR,
} from "../../src/db/schema/provider-connectivity-control";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const FULL = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "A message from Hebun",
});

/** ONE spelling of each root. If these ever diverge the whole column is meaningless. */
function vocabularyIsShared(): void {
  assert.equal(CEREMONY_SOURCE_LOCAL, PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR);
  assert.equal(CEREMONY_SOURCE_PRODUCTION, PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR);
  assert.equal(CEREMONY_SOURCE_LOCAL, "local-operator-ceremony");
  assert.equal(CEREMONY_SOURCE_PRODUCTION, "production-operator-ceremony");
}

/* ── A row written before the column existed keeps NULL. No backfill, ever. ──────────────── */
async function historicalRowsStayNull(client: Client): Promise<void> {
  /* A row inserted WITHOUT a source — exactly the shape migration 35 inherited. */
  await client.query(
    `insert into provider_connectivity_controls (provider_key, director_enabled) values ($1, false)`,
    [CLAUDE_PROVIDER_KEY],
  );
  const before = await readProviderControl(client, CLAUDE_PROVIDER_KEY);
  assert.equal(before?.controlSource, null, "a pre-column row carries NULL, not a fabricated root");

  /* Reading it, and refusing a no-op transition, must not invent one either. */
  const noop = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: false,
    controlSource: CEREMONY_SOURCE_LOCAL,
    env: FULL,
  });
  assert.equal(noop.status, "refused", "already-disabled is refused");
  const after = await readProviderControl(client, CLAUDE_PROVIDER_KEY);
  assert.equal(after?.controlSource, null, "A REFUSAL WRITES NOTHING — the root is still NULL");
  assert.equal(after?.version, before?.version, "and the version did not move");
}

/* ── Every successful transition rewrites the root. ──────────────────────────────────────── */
async function everyTransitionRecordsItsRoot(client: Client): Promise<void> {
  const enabled = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: true,
    controlSource: CEREMONY_SOURCE_LOCAL,
    env: FULL,
  });
  assert.equal(enabled.status, "changed");
  assert.equal(
    enabled.status === "changed" ? enabled.control.controlSource : null,
    CEREMONY_SOURCE_LOCAL,
    "a local enable records the local root",
  );

  /*
   * THE CASE CREATION-ONLY PROVENANCE WOULD HAVE GOT WRONG. The row was created by a local
   * ceremony; production now flips it. If the column were creation-only it would still say
   * "local" while production caused the state the row holds.
   */
  const disabled = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: false,
    controlSource: CEREMONY_SOURCE_PRODUCTION,
    env: FULL,
  });
  assert.equal(disabled.status, "changed");
  assert.equal(
    disabled.status === "changed" ? disabled.control.controlSource : null,
    CEREMONY_SOURCE_PRODUCTION,
    "THE ROOT FOLLOWS THE STATE: a production transition overwrites a local root",
  );
  const persisted = await readProviderControl(client, CLAUDE_PROVIDER_KEY);
  assert.equal(persisted?.controlSource, CEREMONY_SOURCE_PRODUCTION, "and it is durable");

  /* And back again — the column is not one-way. */
  const reEnabled = await setProviderConnectivity(client, {
    providerKey: CLAUDE_PROVIDER_KEY,
    enabled: true,
    controlSource: CEREMONY_SOURCE_LOCAL,
    env: FULL,
  });
  assert.equal(
    reEnabled.status === "changed" ? reEnabled.control.controlSource : null,
    CEREMONY_SOURCE_LOCAL,
    "a later local transition overwrites the production root",
  );
}

/* ── No caller may invent a root, and no default exists. ─────────────────────────────────── */
async function noInventedRoot(client: Client): Promise<void> {
  for (const bogus of [
    "platform-admin",
    "LOCAL-OPERATOR-CEREMONY",
    " local-operator-ceremony",
    "local-operator-ceremony ",
    "production",
    "",
    "  ",
  ]) {
    const outcome = await setProviderConnectivity(client, {
      providerKey: EXTERNAL_SEND_PROVIDER_KEY,
      enabled: true,
      controlSource: bogus as never,
      env: FULL,
    });
    assert.equal(outcome.status, "refused", `"${bogus}" is refused`);
    assert.equal(
      outcome.status === "refused" ? outcome.reason : null,
      "unknown-control-source",
      `"${bogus}" is refused for the RIGHT reason — not silently substituted`,
    );
    assert.equal(
      await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY),
      undefined,
      "and no row was minted by the refusal",
    );
  }

  /* Undefined is a refusal too — there is no default root. */
  const missing = await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: true,
    controlSource: undefined as never,
    env: FULL,
  });
  assert.equal(
    missing.status === "refused" ? missing.reason : null,
    "unknown-control-source",
    "an absent root REFUSES rather than defaulting to either deployment",
  );
}

/* ── The database is the final defence: the CHECK, not just the guard. ───────────────────── */
async function checkConstraintIsTheFloor(client: Client): Promise<void> {
  for (const value of [
    PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR,
    PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR,
    null,
  ]) {
    await client.query(`update provider_connectivity_controls set control_source = $1 where provider_key = $2`, [
      value,
      CLAUDE_PROVIDER_KEY,
    ]);
  }
  for (const bogus of ["platform-admin", "LOCAL-OPERATOR-CEREMONY", "", "membership"]) {
    await assert.rejects(
      () =>
        client.query(
          `update provider_connectivity_controls set control_source = $1 where provider_key = $2`,
          [bogus, CLAUDE_PROVIDER_KEY],
        ),
      /provider_connectivity_controls_control_source_chk/,
      `the DATABASE refuses "${bogus}" even with the application guard bypassed`,
    );
  }
}

/* ── external-send is governed identically. No special case anywhere. ────────────────────── */
async function externalSendIsNotSpecialCased(client: Client): Promise<void> {
  const armed = await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: true,
    controlSource: CEREMONY_SOURCE_LOCAL,
    env: FULL,
  });
  assert.equal(armed.status, "changed", "external-send arms under a complete configuration");
  assert.equal(
    armed.status === "changed" ? armed.control.controlSource : null,
    CEREMONY_SOURCE_LOCAL,
    "external-send records its root exactly as claude does",
  );

  /* R3B's configuration gate is untouched: an incomplete configuration still refuses. */
  await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: false,
    controlSource: CEREMONY_SOURCE_LOCAL,
    env: FULL,
  });
  const refused = await setProviderConnectivity(client, {
    providerKey: EXTERNAL_SEND_PROVIDER_KEY,
    enabled: true,
    controlSource: CEREMONY_SOURCE_PRODUCTION,
    env: {},
  });
  assert.equal(
    refused.status === "refused" ? refused.reason : null,
    "configuration-incomplete",
    "R3B's arming gate still refuses first — the new root did not weaken it",
  );
  const after = await readProviderControl(client, EXTERNAL_SEND_PROVIDER_KEY);
  assert.equal(after?.directorEnabled, false, "and the refusal changed nothing");
  assert.equal(after?.controlSource, CEREMONY_SOURCE_LOCAL, "including the root");

  /* The writer names no provider key when deciding the source. */
  const src = await import("node:fs").then((fs) =>
    fs.readFileSync("scripts/lib/provider-connectivity.ts", "utf8"),
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  const sourceRegion = code.slice(code.indexOf("controlSource !== CEREMONY_SOURCE_LOCAL"));
  assert.ok(
    !/CLAUDE_PROVIDER_KEY/.test(sourceRegion.slice(0, 400)),
    "the source decision is provider-agnostic — claude is not special-cased",
  );
}

async function main(): Promise<void> {
  vocabularyIsShared();

  const harness = createDisposablePostgresHarness("hebun_r2h_control_source");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  try {
    harness.migrateDatabase();
    await client.connect();

    await historicalRowsStayNull(client);
    await everyTransitionRecordsItsRoot(client);
    await noInventedRoot(client);
    await checkConstraintIsTheFloor(client);
    await externalSendIsNotSpecialCased(client);

    console.log("r2h control source postgres checks passed");
  } finally {
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
