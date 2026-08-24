/*
 * R5.1 — CEREMONY GUARDS AND PHASE FIREWALLS (structural, no DB, no network).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The ceremony is reachable only from a local terminal on a local database with an explicit
 *    confirmation; it touches no credential; the application cannot import it; and R5.1 changed
 *    nothing it was not authorized to change."
 *
 * Guards are asserted BY EXECUTION where a real mechanism exists (a piped stdin genuinely rejects, a
 * remote URL genuinely throws) and by source shape only where execution would mean spawning a
 * production-flagged process. Assertions run over source with comments stripped, so prose about a
 * guard can never stand in for the guard.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { assertLocalDatabaseUrl } from "../../scripts/lib/provision-dev-credential";
import { isProviderKey, isTransition, PROVIDER_KEYS } from "../../scripts/lib/provider-connectivity";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });

const CEREMONY = codeOf(read("scripts/lib/provider-connectivity.ts"));
const CLI = codeOf(read("scripts/provider-connectivity.ts"));
const SRC_FILES = collect("src");
const SRC_CODE = SRC_FILES.map((f) => codeOf(read(f))).join("\n");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. DEPLOYMENT-POSSESSION GUARDS — the same four every sibling ceremony has.
 * ═════════════════════════════════════════════════════════════════════════ */
function possessionGuards(): void {
  /* Production is refused by an explicit exit, not by a comment. */
  assert.ok(
    /if\s*\(\s*process\.env\.NODE_ENV === "production"\s*\)\s*\{\s*fail\(/.test(CLI),
    "the CLI refuses NODE_ENV=production before anything else runs",
  );
  /* The production check must come BEFORE the database is opened. */
  const prodAt = CLI.indexOf("NODE_ENV");
  const connectAt = CLI.indexOf("new Client(");
  assert.ok(prodAt > -1 && connectAt > -1 && prodAt < connectAt, "production is refused before connecting");

  /* A non-local database is refused by the shared assertion — proved by running it. */
  assert.ok(CLI.includes("assertLocalDatabaseUrl"), "the CLI uses the shared local-database gate");
  for (const remote of [
    "postgresql://user@db.example.com:5432/hebun",
    "postgresql://user@10.0.0.5:5432/hebun",
    "postgres://user@hebun.internal/hebun",
  ]) {
    assert.throws(
      () => assertLocalDatabaseUrl(remote),
      /non-local database/,
      `${remote} must be refused`,
    );
  }
  for (const local of [
    "postgresql://postgres@127.0.0.1:55432/hebun_r1",
    "postgresql://postgres@localhost:55432/hebun_r1",
  ]) {
    assert.doesNotThrow(() => assertLocalDatabaseUrl(local), `${local} must be accepted`);
  }

  /* Interactive confirmation: a non-TTY stdin is rejected, and the token is the provider key. */
  assert.ok(/if\s*\(\s*!input\.isTTY\s*\)/.test(CLI), "a piped stdin is rejected");
  assert.ok(
    CLI.includes("Retype the provider key to"),
    "the operator must retype the provider key, not press y",
  );
  assert.ok(
    /confirmation !== providerKey/.test(CLI),
    "a mismatched confirmation changes nothing",
  );
  /* The confirmation must be demanded BEFORE the write. */
  const confirmAt = CLI.indexOf("Retype the provider key");
  const writeAt = CLI.indexOf("setProviderConnectivity(");
  assert.ok(confirmAt > -1 && writeAt > -1 && confirmAt < writeAt, "confirmation precedes the write");

  /*
   * NO ENVIRONMENT VARIABLE MAY AUTHORIZE THE ACT. The only env the CLI reads is NODE_ENV and
   * DATABASE_URL — the same two every sibling ceremony reads. A variable that could name the
   * provider or the direction would make the ceremony reachable by deployment mistake.
   */
  const envReads = [...CLI.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!);
  assert.deepEqual(
    [...new Set(envReads)].sort(),
    ["DATABASE_URL", "NODE_ENV"],
    "the CLI reads no environment variable that could name the provider or the direction",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE CLOSED ARGUMENT SURFACE.
 * ═════════════════════════════════════════════════════════════════════════ */
function closedArguments(): void {
  assert.equal(PROVIDER_KEYS.length, 2, "two provider keys, and no third");
  for (const bad of ["", "openai", "CLAUDE", undefined]) {
    assert.ok(!isProviderKey(bad as string), `${String(bad)} is not a provider key`);
  }
  for (const bad of ["", "toggle", "ENABLE", "on", "off", undefined]) {
    assert.ok(!isTransition(bad as string), `${String(bad)} is not a transition`);
  }
  assert.ok(isTransition("enable") && isTransition("disable"), "exactly two verbs");

  /* The CLI takes exactly two positional arguments and reads no others. */
  const argvReads = [...CLI.matchAll(/process\.argv\[(\d+)\]/g)].map((m) => Number(m[1]));
  assert.deepEqual([...new Set(argvReads)].sort(), [2, 3], "exactly two positional arguments");
  assert.ok(!CLI.includes("process.argv.slice"), "no variadic tail is consumed");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. CREDENTIAL FIREWALL — connectivity is a boolean.
 * ═════════════════════════════════════════════════════════════════════════ */
function credentialFirewall(): void {
  const both = CEREMONY + "\n" + CLI;

  /* No credential variable is named, read, printed or accepted. */
  for (const forbidden of [
    "ANTHROPIC_API_KEY",
    "HEBUN_EXTERNAL_SEND_API_KEY",
    "HEBUN_MODEL_CREDENTIAL",
    "apiKey",
    "Bearer",
    "secret",
    "token",
    "password",
  ]) {
    assert.ok(!both.includes(forbidden), `the ceremony must not reference ${forbidden}`);
  }

  /*
   * Configuration is consulted through this feature's own PRESENCE predicate, never by reading a
   * value. `isExternalSendConfigured` returns a boolean and cannot leak one.
   */
  assert.ok(CEREMONY.includes("isExternalSendConfigured"), "presence is asked, not read");
  assert.ok(
    !/env\[[^\]]+\]/.test(both),
    "no environment value is indexed directly in the ceremony",
  );

  /* It writes exactly four columns, and none of them can hold a payload. */
  const setClauses = CEREMONY.slice(CEREMONY.indexOf("do update"), CEREMONY.indexOf("returning"));
  for (const column of ["director_enabled", "updated_at", "updated_by", "version"]) {
    assert.ok(setClauses.includes(column), `the write sets ${column}`);
  }
  for (const forbidden of ["credential", "sender", "subject", "recipient", "body", "content", "api_key"]) {
    assert.ok(!setClauses.includes(forbidden), `the write must never set ${forbidden}`);
  }

  /*
   * And the ceremony never touches an env FILE.
   *
   * Asked by MECHANISM, not by the substring ".env" — that would match `process.env`, which is how
   * the CLI legitimately reads NODE_ENV and DATABASE_URL. A sweep that flags the correct code is not
   * a firewall, it is a false positive with a stack trace.
   */
  for (const forbidden of ["writeFileSync", "appendFileSync", "createWriteStream", "dotenv"]) {
    assert.ok(!both.includes(forbidden), `the ceremony must not use ${forbidden}`);
  }
  assert.ok(
    /* Single-line by construction: `[^"'\n]` — without the newline exclusion the class spans
     * lines and matches from one distant quote to another, swallowing `process.env` in between. */
    !/["'][^"'\n]*\.env[^"'\n]*["']/.test(both),
    "no env file path appears as a literal in the ceremony",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. SCRIPT CONTAINMENT — the application cannot reach the writer.
 * ═════════════════════════════════════════════════════════════════════════ */
function scriptContainment(): void {
  /*
   * Asked over COMMENT-STRIPPED source, and as an IMPORT rather than a substring.
   *
   * Both provider modules legitimately name `scripts/lib/provider-connectivity.ts` in their headers,
   * to say where the write went. A raw-source sweep flags exactly that documentation — the same trap
   * R3B's firewall hit. An import cannot hide in a comment, so stripping them loses nothing.
   */
  const importers = SRC_FILES.filter((f) =>
    /(?:from|require\()\s*["'][^"'\n]*scripts\/(?:lib\/)?provider-connectivity["']/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    importers,
    [],
    "no file under src may import the deployment-possession ceremony",
  );
  /* And no dynamic import reaches it either. */
  assert.ok(
    !/import\s*\(\s*["'][^"'\n]*scripts\//.test(SRC_CODE),
    "src holds no dynamic import into scripts/",
  );
  /* The ceremony reads from src (a predicate and two constants) — the allowed direction. */
  assert.ok(
    CEREMONY.includes('from "../../src/features/'),
    "the ceremony reuses src predicates rather than reimplementing them",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. AGENT / HEBY FIREWALL — no model may operate global connectivity.
 * ═════════════════════════════════════════════════════════════════════════ */
function agentFirewall(): void {
  const agentDirs = [
    "src/features/heby-actions",
    "src/features/heby-answer",
    "src/features/heby-commands",
    "src/features/heby-model",
    "src/features/heby-model-live",
    "src/features/action-execution",
    "src/features/governance-decision",
    "src/features/device-runtime",
  ].filter((d) => existsSync(path.join(ROOT, d)));

  for (const dir of agentDirs) {
    const code = collect(dir).map((f) => codeOf(read(f))).join("\n");
    for (const seam of [
      "setProviderConnectivity",
      "setDirectorEnabled",
      "setClaudeDirectorEnabled",
      "setExternalSendDirectorEnabled",
      "provider-connectivity\"",
    ]) {
      assert.ok(!code.includes(seam), `${dir} must not reach ${seam}`);
    }
  }

  /* The model's action vocabulary names nothing that could operate a provider control. */
  const registry = codeOf(read("src/features/heby-actions/action-registry.ts"));
  const kinds = [...registry.matchAll(/actionKind:\s*"([a-z-]+)"/g)].map((m) => m[1]!);
  assert.ok(kinds.length > 0, "the registry declares action kinds");
  for (const kind of kinds) {
    assert.ok(
      !/provider|connectivity|credential|platform|tenant/.test(kind),
      `no action kind may name a platform capability (found "${kind}")`,
    );
  }
  /* The ceremony is a script; no runtime can spawn a process to reach it either. */
  for (const dir of agentDirs) {
    const code = collect(dir).map((f) => codeOf(read(f))).join("\n");
    for (const spawn of ["child_process", "execFileSync", "execSync", "spawnSync"]) {
      assert.ok(!code.includes(spawn), `${dir} must not be able to spawn a process`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. PHASE FIREWALLS — what R5.1 was NOT authorized to change.
 * ═════════════════════════════════════════════════════════════════════════ */
function phaseFirewalls(): void {
  /*
   * NO SCHEMA CHANGE — pinned by the timestamp-prefix boundary, which is what the previous version
   * of this comment CLAIMED while the assertions underneath it were a repo-wide total and a
   * "newest migration" identity. Both were falsified the moment a later phase added one, so the
   * claim is now actually phase-scoped: nothing changed at or before R5.1's boundary, and no
   * migration after it bears this phase's name.
   */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const PHASE_BOUNDARY = "20260817195446_r4a_tenant_provisioning_source.sql";
  const upToBoundary = migrations.filter((f) => f <= PHASE_BOUNDARY);
  assert.equal(upToBoundary.at(-1), PHASE_BOUNDARY, "the migration R5.1 inherited is intact");
  assert.equal(upToBoundary.length, 30, "no migration was inserted at or before R5.1's boundary");
  for (const file of migrations.filter((f) => f > PHASE_BOUNDARY)) {
    assert.ok(
      !/r5[-_.]?1|provider[-_]?(connectivity|control)/i.test(file),
      `no migration bears this phase's name — found ${file}`,
    );
  }

  /* The control schema itself is byte-for-byte the same shape: a key and a boolean. */
  const schema = codeOf(read("src/db/schema/provider-connectivity-control.ts"));
  const declared = [...schema.matchAll(/(\w+):\s*(?:text|boolean|uuid|timestamp|integer)\(/g)].map((m) => m[1]!);
  assert.deepEqual(declared.sort(), ["directorEnabled", "providerKey"], "the table is unchanged");
  assert.ok(!schema.includes("tenantId"), "the control did NOT become tenant-scoped");
  assert.ok(schema.includes("...rootColumns"), "it is still root-scoped");

  /* R2F.1 UNCHANGED — still tenant-scoped by SQL predicate, still read-only, still `live` only. */
  const usage = codeOf(read("src/features/heby-provider-ops/provider-usage-aggregation.server.ts"));
  assert.ok(usage.includes('"messages"."tenant_id" = '), "the usage query keeps its tenant predicate");
  for (const forbidden of ["insert", "update ", "delete "]) {
    assert.ok(!usage.toLowerCase().includes(forbidden), `usage aggregation must stay read-only (${forbidden})`);
  }
  assert.ok(usage.includes("REAL_PROVIDER_TRANSPORT"), "the live-transport filter is intact");

  /* R3B UNCHANGED — the double read before dispatch, and no send. */
  const control = codeOf(read("src/features/action-execution/execution-control.server.ts"));
  assert.ok(control.includes("resolveExternalSendEnabled"), "the kill-switch read survives");
  assert.ok(!control.includes("setDirectorEnabled"), "and holds no writer");

  /* SECURITY REMAINS OBSERVATION-ONLY. */
  const securityActions = collect("src/app").filter(
    (f) => /security/i.test(f) && /actions\.tsx?$/.test(f),
  );
  assert.deepEqual(securityActions, [], "no server action was added to the Security workspace");

  /* NO ROUTE HANDLER was added anywhere — a global control must not gain an HTTP surface. */
  /*
   * AMENDED BY INT-3. The claim was "this phase introduces no route handler", and it was proved
   * by the repository having NONE — which stayed true for eleven phases and stopped being true
   * when OAuth arrived: a provider redirects the browser back on a plain GET, which a server
   * action cannot receive. The claim this phase is entitled to make is the narrower one that was
   * always the point: THIS phase added none, and the only handlers that exist are INT-3's
   * Google OAuth pair.
   */
  /*
   * ── AMENDED BY GITHUB-2 ────────────────────────────────────────────────
   *
   * The claim this pin makes is about THIS PHASE — it introduced no route handler of its own —
   * and that claim is unchanged and still true. What it uses to say so is a census of every
   * route handler in the repository, and GITHUB-2 legitimately added the GitHub installation
   * pair, so the census names four.
   *
   * Still an exhaustive `deepEqual` on purpose: a fifth route appearing is a decision somebody
   * has to record here, which is the property that made this pin worth having.
   */
  const INT3_ROUTES = [
    "src/app/api/integrations/github/setup/route.ts",
    "src/app/api/integrations/github/start/route.ts",
    "src/app/api/integrations/google/callback/route.ts",
    "src/app/api/integrations/google/start/route.ts",
  ].sort();
  const routes = collect("src/app")
    .filter((f) => /(^|\/)route\.tsx?$/.test(f))
    .map((f) => f.replace(/\\/g, "/"))
    .sort();
  assert.deepEqual(routes, INT3_ROUTES, "R5.1 adds no route handler of its own");

  /* NO IMPERSONATION was introduced. */
  for (const forbidden of ["impersonat", "assumeIdentity", "onBehalfOf", "switchUser"]) {
    assert.ok(!SRC_CODE.includes(forbidden), `R5.1 must not introduce ${forbidden}`);
  }

  /*
   * NO PLATFORM AUTHORITY was fabricated: `platform-admin` stays a schema allowance with no writer.
   *
   * Over comment-stripped CODE. R5.1's own headers say in prose that it creates no platform-admin,
   * and a raw sweep would flag that sentence — turning a truthful denial into a failure. The
   * question is which code can WRITE the value, so ask the code.
   */
  const platformAdminSites = SRC_FILES.filter((f) => codeOf(read(f)).includes("platform-admin"));
  assert.deepEqual(
    platformAdminSites.sort(),
    ["src/db/schema/audit-log.ts", "src/features/observability/types.ts"],
    "platform-admin remains vocabulary only — a CHECK and a type, with no writer",
  );
}

function main(): void {
  possessionGuards();
  closedArguments();
  credentialFirewall();
  scriptContainment();
  agentFirewall();
  phaseFirewalls();
  console.log("R5.1 ceremony guards + firewalls: all assertions passed.");
}

main();
