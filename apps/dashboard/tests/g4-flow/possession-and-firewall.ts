/*
 * G4 — PRODUCTION POSSESSION, AND THE FIREWALLS THAT SURVIVE IT (structural, no DB, no network).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Production posture opens on ONE exact literal with a pinned target and nothing else; the
 *    ceremonies that gained it kept every boundary they had; the ones that did not gain it are
 *    untouched; and G4 added no schema, no route, no principal and no reach into src/."
 *
 * Assertions run over comment-stripped source, so prose about a guard can never stand in for the
 * guard — the trap R3B's firewall hit and R5.1 recorded.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  CEREMONY_SOURCE_LOCAL,
  CEREMONY_SOURCE_PRODUCTION,
  PRODUCTION_CEREMONY_ENV,
  PRODUCTION_CEREMONY_SIGNAL,
  PRODUCTION_TARGET_DATABASE_ENV,
  PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
  assertNonLocalDatabaseUrl,
  resolveCeremonyPosture,
} from "../../scripts/lib/production-possession";
import { preflightEnvironment } from "../../scripts/lib/ceremony-preflight";
import { assertLocalDatabaseUrl } from "../../scripts/lib/provision-dev-credential";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory()
      ? e.name === "migrations"
        ? []
        : collect(rel)
      : /\.tsx?$/.test(e.name)
        ? [rel]
        : [];
  });

/** The three ceremonies G4 made production-capable. */
const PRODUCTION_CAPABLE = [
  "scripts/tenant-provision.ts",
  "scripts/genesis-nominate.ts",
  "scripts/tenant-lifecycle.ts",
] as const;

/** The two that deliberately did NOT gain production reach. */
/*
 * ── MOVED AT R2H ─────────────────────────────────────────────────────────────
 *
 * `provider-connectivity.ts` was local-only through G4 and is production-capable from R2H, under
 * an explicit Director decision and R5.1's own recorded forcing function ("when production arrives,
 * the platform-operator decision has to be made explicitly").
 *
 * G4's REASON for excluding it is preserved rather than overridden. G4 wrote: "a production-
 * reachable arming switch is one command away from armed." That worry is about EXTERNAL SEND, which
 * puts real messages in front of real people — not about model connectivity, which permits an
 * inference. So the ceremony reaches production, and the arming key does not: asserted below, and
 * strictly narrower than "this CLI cannot reach production at all".
 */
const LOCAL_ONLY = ["scripts/auth-dev-credential.ts"] as const;

const POSSESSION = codeOf(read("scripts/lib/production-possession.ts"));
const PREFLIGHT = codeOf(read("scripts/lib/ceremony-preflight.ts"));
const REPORT = codeOf(read("scripts/platform-preflight.ts"));
const SRC_FILES = collect("src");

/*
 * A SYNTHETIC pin. This file asserts the SHAPE of the contract, so any well-formed decimal serves —
 * and the real deployment's cluster identifier is deliberately not committed. It is not a
 * credential and grants nothing on its own, but it is a production fingerprint in a public
 * repository, and publishing it buys nothing. The real value lives with the operator, beside the
 * connection string. `production-ceremony-postgres.ts` reads the identifier of the disposable
 * database it created, so it never needs a literal at all.
 */
const PINS = {
  [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL,
  [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: "1000000000000000001",
  [PRODUCTION_TARGET_DATABASE_ENV]: "hebun_example",
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE SIGNAL — one literal opens production; everything else REFUSES.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSignal(): void {
  assert.equal(
    resolveCeremonyPosture({}).mode,
    "local",
    "an absent signal is the released behaviour: local",
  );
  const absent = resolveCeremonyPosture({});
  assert.equal(absent.mode === "local" && absent.source, CEREMONY_SOURCE_LOCAL);

  /*
   * Every one of these must REFUSE, and — this is the load-bearing half — must not silently
   * become local. An operator who meant production and mistyped it getting a local ceremony
   * instead is the failure mode a boolean-ish guard would produce.
   */
  for (const variant of [
    "true",
    "TRUE",
    "1",
    "yes",
    "",
    " ",
    " production-operator-ceremony",
    "production-operator-ceremony ",
    "Production-Operator-Ceremony",
    "PRODUCTION-OPERATOR-CEREMONY",
    "production_operator_ceremony",
    "local-operator-ceremony",
  ]) {
    /* Pins present and correct — only the signal is wrong, so the refusal is about the signal. */
    const posture = resolveCeremonyPosture({ ...PINS, [PRODUCTION_CEREMONY_ENV]: variant });
    assert.equal(
      posture.mode,
      "refused",
      `${JSON.stringify(variant)} must refuse, never open production`,
    );
    assert.notEqual(posture.mode, "local", `${JSON.stringify(variant)} must never downgrade to local`);
  }

  /* The exact literal, with both pins, is the ONLY way through. */
  const ok = resolveCeremonyPosture(PINS);
  assert.equal(ok.mode, "production");
  assert.equal(ok.mode === "production" && ok.source, CEREMONY_SOURCE_PRODUCTION);

  /* The signal IS the provenance value — the operator types the root they claim. */
  assert.equal(PRODUCTION_CEREMONY_SIGNAL, CEREMONY_SOURCE_PRODUCTION);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. TARGET PINNING — production without a pinned target is refused.
 * ═════════════════════════════════════════════════════════════════════════ */
function targetPinning(): void {
  const base = { [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL };
  for (const [label, env] of [
    ["neither pin", base],
    ["identifier only", { ...base, [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: "1" }],
    ["database only", { ...base, [PRODUCTION_TARGET_DATABASE_ENV]: "neondb" }],
  ] as const) {
    const posture = resolveCeremonyPosture(env);
    assert.equal(posture.mode, "refused", `${label} must refuse`);
    assert.equal(
      posture.mode === "refused" && posture.reason,
      "target-not-pinned",
      `${label} must name the missing pin`,
    );
  }

  for (const [label, sid, db] of [
    ["non-numeric identifier", "abc", "neondb"],
    ["negative identifier", "-1", "neondb"],
    ["identifier with space", "76754448 75863894887", "neondb"],
    ["empty identifier", "", "neondb"],
    ["empty database", "1", ""],
    ["database with a quote", "1", 'neondb"; drop table companies--'],
    ["database with a space", "1", "neon db"],
  ] as const) {
    const posture = resolveCeremonyPosture({
      ...base,
      [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: sid,
      [PRODUCTION_TARGET_DATABASE_ENV]: db,
    });
    assert.equal(posture.mode, "refused", `${label} must refuse`);
    assert.equal(posture.mode === "refused" && posture.reason, "malformed-target", label);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. LOCALITY — the two directions are exclusive, and neither is optional.
 * ═════════════════════════════════════════════════════════════════════════ */
function locality(): void {
  /*
   * `[::1]` is listed on purpose. `new URL()` reports it WITH brackets, and the released
   * `assertLocalDatabaseUrl` therefore refuses it — erring safe. This test pins that a bracketed
   * loopback is refused in BOTH postures rather than accepted by one of them, which is what the
   * first run of this file caught.
   */
  const LOCALS = [
    "postgresql://postgres@127.0.0.1:55432/hebun_r1",
    "postgresql://postgres@localhost:5432/hebun",
  ];
  const BRACKETED_LOOPBACK = "postgresql://postgres@[::1]:5432/hebun";
  const REMOTE = "postgresql://u:p@ep-example.eu-central-1.aws.neon.tech/neondb";

  /* Production posture refuses a loopback target — proved by EXECUTION, not by source shape. */
  for (const local of LOCALS) {
    assert.throws(
      () => assertNonLocalDatabaseUrl(local),
      /refusing a production ceremony against a local database/,
      `${local} must be refused in production posture`,
    );
  }
  assert.doesNotThrow(() => assertNonLocalDatabaseUrl(REMOTE));

  /* Bracketed IPv6 loopback: refused in BOTH directions, never accepted by either. */
  assert.throws(
    () => assertNonLocalDatabaseUrl(BRACKETED_LOOPBACK),
    /refusing a production ceremony against a local database/,
    "a bracketed loopback must not pass as remote",
  );
  assert.throws(() => assertLocalDatabaseUrl(BRACKETED_LOOPBACK), /non-local database/);

  /* And the released local guard still refuses a remote target, unchanged by G4. */
  assert.throws(() => assertLocalDatabaseUrl(REMOTE), /non-local database/);
  for (const local of LOCALS) assert.doesNotThrow(() => assertLocalDatabaseUrl(local));

  /* Through the ONE path the CLIs use, both directions hold. */
  const localPosture = resolveCeremonyPosture({});
  const prodPosture = resolveCeremonyPosture(PINS);

  assert.equal(preflightEnvironment(localPosture, LOCALS[0]).status, "ok");
  {
    const r = preflightEnvironment(localPosture, REMOTE);
    assert.equal(r.status, "refused");
    assert.equal(r.status === "refused" && r.reason, "locality");
  }
  assert.equal(preflightEnvironment(prodPosture, REMOTE).status, "ok");
  {
    const r = preflightEnvironment(prodPosture, LOCALS[0]);
    assert.equal(r.status, "refused");
    assert.equal(r.status === "refused" && r.reason, "locality");
  }
  /* An absent DATABASE_URL refuses in BOTH postures. */
  for (const posture of [localPosture, prodPosture]) {
    for (const url of [undefined, "", "   "]) {
      const r = preflightEnvironment(posture, url);
      assert.equal(r.status, "refused");
      assert.equal(r.status === "refused" && r.reason, "database-url");
    }
  }
  /* A refused posture never reaches a locality question at all. */
  {
    const r = preflightEnvironment(resolveCeremonyPosture({ [PRODUCTION_CEREMONY_ENV]: "true" }), REMOTE);
    assert.equal(r.status, "refused");
    assert.equal(r.status === "refused" && r.reason, "posture-refused");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. PROVENANCE IS DERIVED, NEVER CHOSEN.
 * ═════════════════════════════════════════════════════════════════════════ */
function provenanceIsDerived(): void {
  const provision = codeOf(read("scripts/lib/provision-tenant.ts"));
  const genesis = codeOf(read("scripts/lib/nominate-genesis-human.ts"));
  const provisionCli = codeOf(read("scripts/tenant-provision.ts"));
  const genesisCli = codeOf(read("scripts/genesis-nominate.ts"));

  /*
   * Neither writer contains the production literal. It arrives as a value derived from the posture,
   * so there is no string in either module that a reader could mistake for a decision.
   */
  for (const [label, source] of [
    ["provision-tenant", provision],
    ["nominate-genesis-human", genesis],
  ] as const) {
    assert.ok(
      !source.includes(`"${CEREMONY_SOURCE_PRODUCTION}"`),
      `${label} must not hard-code the production root — it is derived from posture`,
    );
    assert.ok(
      source.includes(`"${CEREMONY_SOURCE_LOCAL}"`),
      `${label} still defaults to the local root`,
    );
  }

  /*
   * And no CLI lets the operator NAME a root. The source is read from the resolved posture and from
   * nowhere else — not argv, not a flag, not a separate variable.
   */
  for (const [label, source] of [
    ["tenant-provision", provisionCli],
    ["genesis-nominate", genesisCli],
  ] as const) {
    /*
     * Asserted as the EXACT binding, not as "the posture is mentioned somewhere".
     *
     * The first version of this assertion only required the string `environment.posture.source` to
     * appear, and a bite-proof that changed the line to
     * `(process.argv[5] as never) ?? environment.posture.source` SURVIVED it: the posture was still
     * mentioned, and argv now won. The binding is therefore pinned whole, and any other assignment
     * to the same name is refused.
     */
    const bindings = source.match(/const ceremonySource\s*=[^;]*;/g) ?? [];
    assert.deepEqual(
      bindings,
      ["const ceremonySource = environment.posture.source;"],
      `${label} must bind the root to the resolved posture and to nothing else`,
    );
    /* And argv reaches neither writer's source argument by any other spelling. */
    assert.ok(
      !/(provisioningSource|nominationSource)\s*[:=][^,;\n]*(process\.argv|process\.env)/.test(
        source,
      ),
      `${label} must not let argv or a bare env value name the root`,
    );
  }

  /* The posture module owns the vocabulary and mirrors the released schema values exactly. */
  const schemaCompany = read("src/db/schema/company.ts");
  const schemaGenesis = read("src/db/schema/genesis-nomination.ts");
  for (const schema of [schemaCompany, schemaGenesis]) {
    assert.ok(schema.includes(`= "${CEREMONY_SOURCE_PRODUCTION}"`));
    assert.ok(schema.includes(`= "${CEREMONY_SOURCE_LOCAL}"`));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE FENCES THAT DID NOT MOVE.
 * ═════════════════════════════════════════════════════════════════════════ */
function fencesThatHeld(): void {
  /*
   * NODE_ENV=production is refused by ALL FIVE ceremonies AND by the preflight report, in both
   * postures. G4 did not relax it and had no reason to: it asks whether this PROCESS is a
   * production runtime, which is a different question from which DATABASE is targeted. A ceremony
   * belongs on an operator terminal in either posture.
   */
  for (const cli of [...PRODUCTION_CAPABLE, ...LOCAL_ONLY, "scripts/platform-preflight.ts"]) {
    assert.match(
      codeOf(read(cli)),
      /NODE_ENV === "production"/,
      `${cli} must still refuse NODE_ENV=production`,
    );
  }

  /*
   * The two local-only ceremonies are BYTE-UNCHANGED in the way that matters: they still call the
   * released local guard directly and know nothing about posture. Provider connectivity in
   * particular must not become production-capable — G4 leaves the provider disarmed, and a
   * production-reachable arming switch is one command away from armed.
   */
  /*
   * THE ARMING SWITCH IS STILL UNREACHABLE IN PRODUCTION — G4's actual safety property, asserted
   * on the key rather than on the file. A production posture holding the external-send key must
   * refuse before it reads or writes anything.
   */
  {
    const connectivity = codeOf(read("scripts/provider-connectivity.ts"));
    /*
     * ANCHORED TO THE `if (`, NOT TO THE CONDITION TEXT. A substring match on the condition
     * survives `if (false && <condition>)` — the guard reads as present while being permanently
     * dead. Found by a bite-proof that failed to bite, not by reading.
     */
    assert.match(
      connectivity,
      /if \(environment\.posture\.mode === "production" && providerKey === EXTERNAL_SEND_PROVIDER_KEY\) \{/,
      "external send may not be armed through a production ceremony",
    );
    assert.match(
      connectivity.slice(connectivity.indexOf('if (environment.posture.mode === "production" && providerKey')).slice(0, 400),
      /fail\(/,
      "and the guarded branch refuses rather than falling through",
    );
    const guard = connectivity.indexOf('environment.posture.mode === "production" && providerKey');
    const write = connectivity.indexOf("setProviderConnectivity(client");
    assert.ok(guard > -1 && write > -1 && guard < write, "and it refuses BEFORE the write");
  }

  for (const cli of LOCAL_ONLY) {
    const source = codeOf(read(cli));
    assert.match(source, /assertLocalDatabaseUrl/, `${cli} still calls the local guard directly`);
    assert.ok(
      !source.includes("resolveCeremonyPosture") && !source.includes(PRODUCTION_CEREMONY_ENV),
      `${cli} must not gain production posture`,
    );
    assert.ok(
      !source.includes(CEREMONY_SOURCE_PRODUCTION),
      `${cli} must not name the production root`,
    );
  }

  /*
   * The three production-capable ceremonies still apply the local guard — through the one shared
   * path rather than by a direct call. Asserted where the guard now LIVES, because asserting the
   * old call site would have been satisfied by an unused import.
   */
  assert.match(PREFLIGHT, /assertLocalDatabaseUrl\(trimmed\)/, "local posture still runs the local guard");
  assert.match(PREFLIGHT, /assertNonLocalDatabaseUrl\(trimmed\)/, "production posture refuses loopback");
  for (const cli of PRODUCTION_CAPABLE) {
    const source = codeOf(read(cli));
    assert.match(source, /preflightEnvironment\(posture, databaseUrl\)/, `${cli} routes through preflight`);
    assert.ok(
      !source.includes("assertLocalDatabaseUrl"),
      `${cli} must not keep a dead direct call beside the shared path`,
    );
  }

  /* Interactive confirmation survives in every ceremony that had it. */
  for (const cli of PRODUCTION_CAPABLE) {
    assert.match(codeOf(read(cli)), /isTTY/, `${cli} still refuses a piped confirmation`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. PREFLIGHT MUTATES NOTHING — asserted over its own source.
 * ═════════════════════════════════════════════════════════════════════════ */
function preflightIsReadOnly(): void {
  for (const [label, source] of [
    ["ceremony-preflight", PREFLIGHT],
    ["production-possession", POSSESSION],
    ["platform-preflight", REPORT],
  ] as const) {
    for (const forbidden of [
      "insert ",
      "update ",
      "delete ",
      "truncate",
      "drop ",
      "create table",
      "alter table",
      "begin",
      "commit",
      "rollback",
      "set session",
      "set local",
    ]) {
      assert.ok(
        !source.toLowerCase().includes(forbidden),
        `${label} must issue no ${forbidden.trim()} — preflight is read-only`,
      );
    }
    /* And it writes no file, so it cannot leave a credential or a report on disk either. */
    for (const forbidden of ["writeFileSync", "appendFileSync", "createWriteStream"]) {
      assert.ok(!source.includes(forbidden), `${label} must not use ${forbidden}`);
    }
  }

  /*
   * The report's table list is a closed literal. There is no expressible way for an operator to
   * name a table for it to read — which is what keeps "counts only" from becoming "any query".
   */
  assert.ok(
    !/from\s+"?\$\{(?!table)/.test(REPORT),
    "the report interpolates nothing but its own closed table list",
  );
  assert.match(REPORT, /const SURFACES = \[/, "the surfaces are a literal list");
  assert.ok(
    !REPORT.includes("process.argv"),
    "the preflight report takes no arguments at all",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. PLATFORM / TENANT FIREWALL — possession never becomes organizational authority.
 * ═════════════════════════════════════════════════════════════════════════ */
function platformTenantFirewall(): void {
  const all = [POSSESSION, PREFLIGHT, REPORT].join("\n");

  /*
   * ── WRITE FIREWALL: absolute, everywhere ──────────────────────────────────
   *
   * No governance table, no Knowledge, no session, no action surface, no provider control is
   * WRITTEN by anything G4 added. Asked as the write verbs against the table names, because the
   * first draft of this assertion — "the name must not appear at all" — failed on the preflight
   * REPORT, which legitimately counts `audit_log` and `provider_connectivity_controls` rows to
   * prove they stayed at zero. Forbidding the name would have forbidden the evidence.
   */
  const GOVERNED_TABLES = [
    "decision_records",
    "governance_sessions",
    "membership_authorizations",
    "invitations",
    "knowledge_nodes",
    "knowledge_facts",
    "user_session_contexts",
    "heby_action_requests",
    "action_permits",
    "audit_log",
    "providers",
    "provider_connectivity_controls",
    "companies",
    "roles",
    "memberships",
    "genesis_nominations",
  ];
  for (const table of GOVERNED_TABLES) {
    for (const verb of ["insert into", "update", "delete from", "truncate"]) {
      assert.ok(
        !new RegExp(`${verb}\\s+"?${table}"?`, "i").test(all),
        `G4 must never ${verb} ${table}`,
      );
    }
  }
  /* `director_enabled` is the provider kill-switch column. G4 does not name it in any position. */
  assert.ok(!all.includes("director_enabled"), "G4 must not name the provider kill-switch column");

  /*
   * ── READ FIREWALL: the two library modules touch NO application table at all ──
   *
   * Target binding and posture resolution are answered entirely by environment values, PostgreSQL's
   * own catalogue, and the migration ledger. Only the operator-facing report reads application
   * tables, and only as counts (asserted below).
   */
  for (const [label, source] of [
    ["production-possession", POSSESSION],
    ["ceremony-preflight", PREFLIGHT],
  ] as const) {
    for (const table of GOVERNED_TABLES) {
      assert.ok(
        !new RegExp(`from\\s+"?${table}"?`, "i").test(source),
        `${label} must not read ${table}`,
      );
    }
  }

  /*
   * ── The report reads counts, and only from its closed list ────────────────
   *
   * Every governed table the report names must appear inside SURFACES — the literal array — and
   * nowhere else. That is what makes "counts only" structural rather than a promise.
   */
  const surfaces = REPORT.slice(REPORT.indexOf("const SURFACES"), REPORT.indexOf("] as const"));
  const reportBody = REPORT.replace(surfaces, "");
  for (const table of GOVERNED_TABLES) {
    assert.ok(
      !reportBody.includes(table),
      `the report may name ${table} only inside its closed SURFACES list`,
    );
  }
  assert.match(
    REPORT,
    /select count\(\*\)::text as n from "\$\{table\}"/,
    "the report's only application query is a count",
  );

  /* No actor is fabricated anywhere. Possession is a SOURCE, never an ACTOR. */
  for (const forbidden of ["actor_id", "actor_type", "actorId", "actorType", "impersonat"]) {
    assert.ok(!all.includes(forbidden), `G4 must not name ${forbidden} — possession has no actor`);
  }

  /*
   * The report reads COUNTS and never content. `count(*)` is the only aggregate, and no column of
   * any application table is named.
   */
  for (const column of ["name", "slug", "email", "content", "display_name", "reason"]) {
    assert.ok(
      !new RegExp(`select[^;]*\\b${column}\\b`, "i").test(REPORT),
      `the report must not select ${column}`,
    );
  }

  /* No new principal, role, tenant or platform identity is invented. */
  for (const forbidden of [
    "platform_operator",
    "platformOperator",
    "sentinel",
    "admin_tenant",
    "adminTenant",
    "platform_principal",
  ]) {
    assert.ok(!all.includes(forbidden), `G4 must not invent ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. SCRIPT CONTAINMENT — src/ cannot reach any of it.
 * ═════════════════════════════════════════════════════════════════════════ */
function scriptContainment(): void {
  const SRC_CODE = SRC_FILES.map((f) => codeOf(read(f))).join("\n");

  const importers = SRC_FILES.filter((f) =>
    /(?:from|require\()\s*["'][^"'\n]*scripts\//.test(codeOf(read(f))),
  );
  assert.deepEqual(importers, [], "no file under src may import anything under scripts/");

  assert.ok(
    !/import\s*\(\s*["'][^"'\n]*scripts\//.test(SRC_CODE),
    "src holds no dynamic import into scripts/",
  );

  /* Nothing under src/ names the production possession contract either. */
  for (const name of [
    PRODUCTION_CEREMONY_ENV,
    PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
    PRODUCTION_TARGET_DATABASE_ENV,
    "resolveCeremonyPosture",
    "verifyProductionTarget",
  ]) {
    const namers = SRC_FILES.filter((f) => codeOf(read(f)).includes(name));
    assert.deepEqual(namers, [], `no file under src may name ${name}`);
  }

  /* No route, no server action, no Heby command reaches it. */
  const routes = collect("src/app").filter((f) => /(^|\/)route\.tsx?$/.test(f));
  for (const route of routes) {
    assert.ok(!codeOf(read(route)).includes("scripts/"), `${route} must not reach scripts/`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. G4 ADDED NO SCHEMA.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSchema(): void {
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  /*
   * PHASE-RELATIVE, not a global total. `tests/authentication-schema/migration.ts` is the one place
   * a running count belongs — it is that file's subject. A global pin here failed the moment a later
   * authorized phase added schema, which conflates G4's authorship with everyone else's. The claim
   * G4 actually makes is that it authored nothing of its own.
   */
  const G4_BOUNDARY = "20260817195446_r4a_tenant_provisioning_source.sql";
  assert.ok(migrations.includes(G4_BOUNDARY), "the migration G4 inherited is intact");
  assert.deepEqual(
    migrations.filter((f) => f > G4_BOUNDARY).sort(),
    [
      "20260818172455_production_provenance_vocabulary.sql",
      "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source, the column R5.1 designed and deferred until production gained a
       * provider-control write path. */
      "20260825080110_provider_control_source.sql",
      /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one CREATE TABLE,
       * two foreign keys and three indexes, zero DROP, `knowledge_nodes` untouched. */
      "20260826064423_kr_ext1_knowledge_external_references.sql",
      "20260828071500_ap4b_origination_invocation_provenance.sql",
      /* SIA-2.6 — the nullable durable-agent attribution column on origination invocations, plus
       * the composite-key anchor it needs on `agents`. Additive: one column, one FK, two indexes,
       * zero DROP and zero backfill. */
      "20260828173456_sia26_origination_agent_attribution.sql",
      "20260828190630_sia3_agent_improvement_hypothesis.sql",
      /* AMA-1 — the Agent Mandate Authority table. A declared later phase, not this one's. */
      "20260831110423_ama1_agent_mandate_authority.sql",
      /* OSA-1 — the departments additive hardening. A declared later phase, not this one's. */
      "20260831212454_osa1_department_structure_authority.sql",
      /* WORK-1 — the Organizational Work Authority table. A declared later phase, not this one's. */
      "20260901122013_work1_organizational_work_authority.sql",
      "20260901170404_osa3_departmental_placement.sql",
      /* GIA-1 — the `record-work` mandate-scope CHECK. A declared later phase, not this one's. */
      "20260902115846_gia1_record_work_mandate_scope.sql",
      /* WEV-1 — the `work_evidence_references` table. A declared later phase, not this one's. */
      "20260902183808_wev1_work_evidence_reference.sql",
      /* PBGA-1 — the action-request purpose columns. Also a declared later phase. */
      "20260902212106_pbga1_action_request_work_purpose.sql",
    ],
    "G4 authored no migration; what follows is a declared later phase",
  );

  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: unknown[];
  };
  assert.equal(journal.entries.length, migrations.length, "journal and directory agree");

  /*
   * And the possession module reads only environment values and facts PostgreSQL reports about
   * itself — never an application table — so target binding needed no primitive to be added.
   */
  assert.match(POSSESSION, /pg_control_system\(\)/, "the binding is the cluster identifier");
  assert.match(POSSESSION, /current_database\(\)/, "…pinned beside the database name");
  assert.ok(
    !/from\s+"?(companies|users|roles|memberships)"?/i.test(POSSESSION),
    "target binding reads no application table",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. THE LEDGER IS NOT A TARGET IDENTITY — the measurement that shaped the design.
 * ═════════════════════════════════════════════════════════════════════════ */
function ledgerIsNotIdentity(): void {
  /*
   * Recorded as an assertion because it is the reason the binding is the cluster identifier and not
   * the schema fingerprint: two Hebun deployments at the same release carry the SAME 31 migration
   * hashes. The module must therefore treat a current ledger as a co-factor and refuse on the
   * identifier first.
   */
  assert.match(
    POSSESSION,
    /system-identifier-mismatch/,
    "the identifier is checked, and named in its own refusal",
  );
  const order = [
    POSSESSION.indexOf("system-identifier-mismatch"),
    POSSESSION.indexOf("database-mismatch"),
    POSSESSION.indexOf("ledger-incomplete"),
  ];
  assert.ok(
    order[0]! > 0 && order[0]! < order[1]! && order[1]! < order[2]!,
    "identity is decided before the ledger, because the ledger cannot distinguish deployments",
  );
}

theSignal();
targetPinning();
locality();
provenanceIsDerived();
fencesThatHeld();
preflightIsReadOnly();
platformTenantFirewall();
scriptContainment();
noSchema();
ledgerIsNotIdentity();

console.log("G4 possession + firewall: all assertions passed.");
