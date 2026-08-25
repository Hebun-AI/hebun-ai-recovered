/*
 * R2H — the production-capable provider-connectivity ceremony, structurally.
 *
 * No database, no network, no provider. These are proofs over the shipped source and over the
 * released posture resolver — the same two things the ceremony itself depends on.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  PRODUCTION_CEREMONY_ENV,
  PRODUCTION_CEREMONY_SIGNAL,
  PRODUCTION_TARGET_DATABASE_ENV,
  PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
  CEREMONY_SOURCE_LOCAL,
  CEREMONY_SOURCE_PRODUCTION,
  resolveCeremonyPosture,
} from "../../scripts/lib/production-possession";
import { preflightEnvironment } from "../../scripts/lib/ceremony-preflight";
import { PROVIDER_KEYS } from "../../scripts/lib/provider-connectivity";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";

const read = (p: string) => readFileSync(p, "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const CLI = "scripts/provider-connectivity.ts";
const WRITER = "scripts/lib/provider-connectivity.ts";
const SCHEMA = "src/db/schema/provider-connectivity-control.ts";

const PINS = {
  [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL,
  [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: "1234567890123456789",
  [PRODUCTION_TARGET_DATABASE_ENV]: "neondb",
} as const;

const REMOTE = "postgresql://u:p@db.example.neon.tech/neondb";
const LOCAL = "postgresql://u:p@127.0.0.1:55432/hebun_r1";

function productionIsNeverImplicit(): void {
  /* Absent signal → local, even with a REMOTE url. Production is never inferred from the URL. */
  const posture = resolveCeremonyPosture({});
  assert.equal(posture.mode, "local", "absent signal is local");
  const env = preflightEnvironment(posture, REMOTE);
  assert.equal(env.status, "refused", "a remote URL under local posture is REFUSED");
  assert.equal(env.status === "refused" ? env.reason : null, "locality");

  /* And the local guard still runs on the local branch — it was not weakened. */
  const ok = preflightEnvironment(resolveCeremonyPosture({}), LOCAL);
  assert.equal(ok.status, "ok", "a loopback URL under local posture proceeds");
  assert.equal(
    ok.status === "ok" ? ok.posture.source : null,
    CEREMONY_SOURCE_LOCAL,
    "and it will be recorded as the LOCAL root",
  );
}

function possessionIsRequiredAndExact(): void {
  /* A near-miss signal REFUSES; it never downgrades to local. */
  for (const variant of ["true", "1", "yes", "Production-Operator-Ceremony", " production-operator-ceremony", ""]) {
    const posture = resolveCeremonyPosture({ ...PINS, [PRODUCTION_CEREMONY_ENV]: variant });
    assert.equal(posture.mode, "refused", `"${variant}" refuses`);
    assert.equal(
      posture.mode === "refused" ? posture.reason : null,
      "malformed-ceremony-signal",
      `"${variant}" is a malformed signal, NOT a silent local ceremony`,
    );
  }

  /* The exact signal without pins refuses — possession alone does not name a target. */
  const unpinned = resolveCeremonyPosture({ [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL });
  assert.equal(unpinned.mode === "refused" ? unpinned.reason : null, "target-not-pinned");

  /* Malformed pins refuse. */
  for (const [sid, db] of [["not-a-number", "neondb"], ["123", "bad name!"]] as const) {
    const p = resolveCeremonyPosture({
      ...PINS,
      [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: sid,
      [PRODUCTION_TARGET_DATABASE_ENV]: db,
    });
    assert.equal(p.mode === "refused" ? p.reason : null, "malformed-target");
  }

  /* Full possession opens production, and a LOOPBACK url is then refused. */
  const prod = resolveCeremonyPosture(PINS);
  assert.equal(prod.mode, "production");
  assert.equal(prod.mode === "production" ? prod.source : null, CEREMONY_SOURCE_PRODUCTION);
  const localUnderProd = preflightEnvironment(prod, LOCAL);
  assert.equal(localUnderProd.status, "refused", "a loopback URL under production posture refuses");
  assert.equal(localUnderProd.status === "refused" ? localUnderProd.reason : null, "locality");
}

function ceremonyUsesTheReleasedPattern(): void {
  const cli = codeOf(read(CLI));

  /* Exactly the three calls tenant-lifecycle makes, in the released shapes. */
  assert.match(cli, /resolveCeremonyPosture\(process\.env\)/, "posture resolved from the environment");
  assert.match(cli, /preflightEnvironment\(posture, databaseUrl\)/, "the released environment preflight");
  assert.match(cli, /preflight\(client, environment\.posture, \{ provenance: "none" \}\)/, "the released target binding");

  /* The guard moved into preflight; assert it at its NEW home, exactly as r4b does for tenant-lifecycle. */
  const shared = codeOf(read("scripts/lib/ceremony-preflight.ts"));
  assert.match(shared, /assertLocalDatabaseUrl\(trimmed\)/, "the local guard still runs, in the shared preflight");
  assert.match(shared, /assertNonLocalDatabaseUrl\(trimmed\)/, "and production requires a NON-local target");

  /* The CLI keeps its other released guards. */
  for (const guard of ["NODE_ENV", "isTTY", "Retype the provider key"]) {
    assert.ok(cli.includes(guard), `the ceremony must still enforce ${guard}`);
  }

  /*
   * A REFUSAL MUST HALT, NOT WARN.
   *
   * Every gate above is worthless if a refusal is logged and execution continues, and that is a
   * one-word edit away — `fail(x)` to `console.warn(x)` — with no other visible change. So both
   * refusal branches are asserted to reach `fail`, and the module is asserted to route no refusal
   * to a non-fatal reporter.
   */
  assert.match(
    cli,
    /if \(environment\.status === "refused"\) fail\(environment\.detail\);/,
    "a refused posture/locality HALTS the ceremony",
  );
  assert.match(
    cli,
    /if \(ready\.status === "refused"\) \{[\s\S]{0,160}?fail\(ready\.detail\);/,
    "a refused target binding HALTS the ceremony, after closing the client",
  );
  for (const softener of ["console.warn", "console.info", "console.debug"]) {
    assert.ok(!cli.includes(softener), `a refusal must not be softened with ${softener}`);
  }
  /* And `fail` is genuinely terminal, not a logger with a reassuring name. */
  assert.match(cli, /function fail\([\s\S]{0,200}?process\.exit\(1\)/, "fail() exits non-zero");

  /* The root is the POSTURE's — never a literal, never inferred. */
  assert.match(
    cli,
    /controlSource: environment\.posture\.source/,
    "the recorded root comes from the proven posture",
  );
  assert.ok(
    !/controlSource:\s*["']/.test(cli),
    "no literal root is written at the call site",
  );
  for (const inferred of ["NODE_ENV ===", "hostname", "includes(\"neon\")"]) {
    const region = cli.slice(cli.indexOf("controlSource:") - 400, cli.indexOf("controlSource:") + 200);
    assert.ok(!region.includes(inferred), `the root is not inferred from ${inferred}`);
  }
}

function noSecondAuthorityAndNoNewWriter(): void {
  /* Still exactly one writer, and it is not under src/. */
  const writers: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== "migrations") walk(full);
      } else if (/\.tsx?$/.test(e.name)) {
        const c = codeOf(read(full));
        if (
          /insert\s+into\s+provider_connectivity_controls/i.test(c) ||
          /update\s+provider_connectivity_controls/i.test(c) ||
          /\.(insert|update|delete)\(\s*providerConnectivityControls/.test(c)
        ) {
          writers.push(full);
        }
      }
    }
  };
  walk("src");
  assert.deepEqual(writers, [], "R5.1 HOLDS: no module under src/ writes the control table");

  const scriptWriters: string[] = [];
  walk2("scripts");
  function walk2(dir: string): void {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk2(full);
      else if (/\.tsx?$/.test(e.name)) {
        const c = codeOf(read(full));
        if (/insert\s+into\s+provider_connectivity_controls/i.test(c)) scriptWriters.push(full);
      }
    }
  }
  assert.deepEqual(scriptWriters, [WRITER], "exactly ONE writer, and it is the released one");

  /* No product mutation path was restored. */
  const cli = codeOf(read(CLI));
  const writer = codeOf(read(WRITER));
  for (const banned of ["use server", "NextResponse", "route.ts", "createServerAction"]) {
    assert.ok(!cli.includes(banned) && !writer.includes(banned), `no ${banned} mutation path`);
  }
  /* No tenant, no Governance, no actor fabricated. */
  for (const banned of ["tenantId", "tenant_id", "decision_records", "audit_log", "updated_by_type"]) {
    assert.ok(!writer.includes(banned), `the writer must not reference ${banned}`);
  }
  assert.match(writer, /updated_by = null/, "possession still writes NO actor");

  /* No provider is contacted and no model runs. */
  for (const banned of ["anthropic", "api.anthropic.com", "generateHebyModelAnswer", "createLiveClaudeTransport", "fetch("]) {
    assert.ok(!cli.toLowerCase().includes(banned.toLowerCase()), `the ceremony must not reach ${banned}`);
    assert.ok(!writer.toLowerCase().includes(banned.toLowerCase()), `the writer must not reach ${banned}`);
  }
}

function schemaContractIsIntact(): void {
  const schema = read(SCHEMA);
  assert.match(schema, /varchar\("control_source", \{ length: 64 \}\)/, "varchar(64), the released shape");
  assert.ok(!/control_source[^)]*notNull\(\)/.test(schema), "nullable — historical rows keep NULL");
  assert.ok(!/control_source[^)]*\.default\(/.test(schema), "no default — a default would fabricate a root");
  assert.match(schema, /provider_connectivity_controls_control_source_chk/, "the CHECK is named by convention");

  /* Inline literals, and both roots named — the R4A rule. */
  const migrations = readdirSync("src/db/migrations").filter((f) => /control_source/.test(f));
  assert.equal(migrations.length, 1, "exactly one migration introduces the column");
  const sql = read(`src/db/migrations/${migrations[0]!}`);
  assert.ok(!/\$\d/.test(sql), "NO BIND PLACEHOLDER may appear inside a CHECK");
  for (const value of [CEREMONY_SOURCE_LOCAL, CEREMONY_SOURCE_PRODUCTION]) {
    assert.ok(sql.includes(`'${value}'`), `the migration names ${value} inline`);
  }
  assert.match(sql, /is null or/, "NULL is admitted — the companies form, not the genesis form");
  /* Additive only. */
  for (const forbidden of [/DROP/i, /CREATE TABLE/i, /CREATE TYPE/i, /CREATE (UNIQUE )?INDEX/i, /REFERENCES/i, /UPDATE\s+"?provider/i, /INSERT\s+INTO/i]) {
    assert.doesNotMatch(sql, forbidden, `migration 35 must not emit ${forbidden}`);
  }
}

/*
 * ── EXTERNAL SEND IS PRODUCTION-UNREACHABLE, AND CLAUDE IS NOT ───────────────
 *
 * R2H made this ceremony production-capable for MODEL connectivity and narrowed the posture for
 * `external-send` alone. That is TWO facts, and they rot separately:
 *
 *   external-send  must refuse in production BEFORE it reads or writes the control table
 *   claude         must still REACH the write in production
 *
 * The released r3b and g4 firewalls already pin the first fact against deletion, `false &&`,
 * a key swap, a fall-through, and a refusal placed after the write. Two mutations survived all of
 * them, and both are asserted here:
 *
 *   - MOVING THE REFUSAL AFTER `readProviderControl`. The ceremony then reads the very table its
 *     own refusal promises it did not touch — "Nothing was read from the control table and nothing
 *     was written." The refusal stays before the write, so every ordering assertion that exists
 *     today still passes while the sentence the operator is shown has become false.
 *
 *   - ADDING A SECOND PRODUCTION REFUSAL FOR `claude`, leaving the external-send guard untouched.
 *     Every existing assertion is about the presence and position of the external-send guard, so
 *     all of them keep passing while model connectivity silently stops being production-reachable.
 *
 * So the property asserted is the SET of production narrowings — exactly one, keyed to the arming
 * key — rather than the presence of one. A future phase that legitimately narrows production for a
 * second key will fail this assertion, which is the intended forcing function: reachability is a
 * decision to be taken deliberately, never inherited.
 */
function externalSendIsProductionUnreachableAndClaudeIsNot(): void {
  /* Comment-stripped AND whitespace-normalised: the property belongs to the CODE, not the layout. */
  const cli = codeOf(read(CLI)).replace(/\s+/g, " ");

  /* THE SET, NOT THE PRESENCE. A second production branch — for any key — fails here. */
  const postureTests = [...cli.matchAll(/environment\.posture\.mode\s*===\s*"production"/g)];
  assert.equal(
    postureTests.length,
    1,
    "the ceremony narrows the PRODUCTION posture for exactly ONE provider key",
  );

  /*
   * ANCHORED TO `if (` IMMEDIATELY FOLLOWED BY THE POSTURE TEST, and the guarded key is CAPTURED
   * rather than matched as a substring. A substring check survives `if (false && <condition>)`,
   * which reads as present while being permanently dead.
   */
  const guard = cli.match(
    /if\s*\(\s*environment\.posture\.mode\s*===\s*"production"\s*&&\s*providerKey\s*===\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/,
  );
  assert.ok(guard, "the narrowing is a LIVE `if`, not a dead, reshaped or commented condition");
  assert.equal(
    guard[1],
    "EXTERNAL_SEND_PROVIDER_KEY",
    "and the key it refuses is the ARMING key, named by its released constant",
  );

  const guardAt = guard.index!;
  const reads = [...cli.matchAll(/readProviderControl\s*\(/g)].map((m) => m.index!);
  const writes = [...cli.matchAll(/setProviderConnectivity\s*\(/g)].map((m) => m.index!);
  assert.ok(reads.length > 0, "the ceremony does read the control table somewhere");
  assert.ok(writes.length > 0, "and does write it somewhere");

  /*
   * THE REFUSAL'S OWN SENTENCE, MADE TRUE. "Nothing was read from the control table and nothing
   * was written" is only honest if the refusal precedes the FIRST read and EVERY write.
   */
  assert.ok(
    reads.every((at) => guardAt < at),
    "external send refuses BEFORE the control table is read",
  );
  assert.ok(
    writes.every((at) => guardAt < at),
    "external send refuses BEFORE every control table write",
  );

  /* The branch releases the connection and HALTS — it neither falls through nor leaks a client. */
  const branch = cli.slice(guardAt, reads[0]);
  assert.match(
    branch,
    /await client\.end\(\)\s*;\s*fail\(/,
    "the guarded branch closes the client and then refuses fatally",
  );

  /* CLAUDE IS NOT WHAT IS BEING REFUSED — not by constant, and not by literal. */
  assert.doesNotMatch(
    branch,
    /CLAUDE_PROVIDER_KEY|"claude"/,
    "the production refusal does not reach the model key",
  );

  /* And both keys remain in the closed vocabulary: claude is reachable, external-send is not. */
  assert.notEqual(CLAUDE_PROVIDER_KEY, EXTERNAL_SEND_PROVIDER_KEY, "two keys, two blast radii");
  for (const key of [CLAUDE_PROVIDER_KEY, EXTERNAL_SEND_PROVIDER_KEY]) {
    assert.ok(PROVIDER_KEYS.includes(key), `${key} is still an expressible provider key`);
  }
}

function main(): void {
  productionIsNeverImplicit();
  possessionIsRequiredAndExact();
  ceremonyUsesTheReleasedPattern();
  noSecondAuthorityAndNoNewWriter();
  externalSendIsProductionUnreachableAndClaudeIsNot();
  schemaContractIsIntact();
  console.log("r2h ceremony and firewall checks passed");
}

main();
