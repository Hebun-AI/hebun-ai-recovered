/*
 * R4A — the tenant bootstrap ceremony is operator tooling with a three-table exception, and both
 * halves of that sentence need policing.
 *
 * THE INVARIANT. A tool that writes `companies`, `roles` and `memberships` directly is bypassing the
 * invitation, authorization and Governance authorities that own those rows everywhere else. That is
 * legitimate exactly once — at bootstrap, where those authorities structurally cannot run — and it
 * stops being legitimate the moment anything in the application tree can reach it. If `src/` could
 * import this, "create a membership" would be one route handler away from being an invitation
 * bypass.
 *
 * So this file asserts two things the prose cannot: that the write set is exactly three tables, and
 * that nothing in the product can call the thing that writes them.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/*
 * Strip comments before asserting on content (repo convention, see d1-1-flow and g1-flow).
 *
 * This matters more here than almost anywhere else: both R4A modules DOCUMENT the tables they must
 * never touch, at length. A prose mention of `audit_log` is the ceremony promising not to write it —
 * the opposite of a violation. Only real code is policed.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function collect(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel);
    return e.isFile() && /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const CLI = "scripts/tenant-provision.ts";
const CORE = "scripts/lib/provision-tenant.ts";
const SCHEMA = "src/db/schema/company.ts";
const MIGRATION = "src/db/migrations/20260817195446_r4a_tenant_provisioning_source.sql";

/**
 * Every SQL statement the ceremony issues, as written.
 *
 * Extracted from the template literals passed to `client.query`, so this is the module's REAL write
 * set rather than a vocabulary scan of the file. A table named in a comment cannot reach this list,
 * and a table written in code cannot escape it — which is the whole difference between asserting a
 * prohibition by word and asserting it by mechanism.
 */
function sqlStatementsOf(src: string): string[] {
  const code = codeOf(src);
  const statements: string[] = [];
  const pattern = /client\.query(?:<[^>]*>)?\s*\(\s*(`[\s\S]*?`|"[^"]*"|'[^']*')/g;
  for (const match of code.matchAll(pattern)) {
    statements.push(match[1]!.slice(1, -1));
  }
  return statements;
}

/** The tables a statement writes. Reads are not writes; this looks only at mutation verbs. */
function writtenTablesOf(statement: string): string[] {
  const tables: string[] = [];
  const normalized = statement.replace(/\s+/g, " ").toLowerCase();
  for (const m of normalized.matchAll(/insert\s+into\s+"?([a-z_]+)"?/g)) tables.push(m[1]!);
  for (const m of normalized.matchAll(/update\s+"?([a-z_]+)"?\s+set/g)) tables.push(m[1]!);
  for (const m of normalized.matchAll(/delete\s+from\s+"?([a-z_]+)"?/g)) tables.push(m[1]!);
  return tables;
}

/** Everything R4A must never write. Not a sample — the full list from the approved contract. */
const FORBIDDEN_WRITES: readonly string[] = [
  "users",
  "auth_identities",
  "auth_credentials",
  "user_session_contexts",
  "role_permissions",
  "permissions",
  "genesis_nominations",
  "decision_records",
  "governance_sessions",
  "membership_authorizations",
  "invitations",
  "identity_enrollment_requests",
  "audit_log",
  "provider_connectivity_controls",
  "external_recipients",
  "work_artifacts",
  "work_artifact_revisions",
  "action_execution_attempts",
  "action_permits",
  "knowledge_facts",
  "knowledge_nodes",
  "knowledge_edges",
  "companies_organizations",
  "organizations",
  "departments",
  "documents",
];

function main(): void {
  const coreSrc = read(CORE);
  const cliSrc = read(CLI);
  const coreCode = codeOf(coreSrc);
  const cliCode = codeOf(cliSrc);

  /* ── The exact write set is three tables ─────────────────────────────────── */
  {
    const statements = [...sqlStatementsOf(coreSrc), ...sqlStatementsOf(cliSrc)];
    assert.ok(statements.length > 0, "no SQL statements were extracted — the matcher is broken");

    const written = new Set(statements.flatMap(writtenTablesOf));
    assert.deepEqual(
      [...written].sort(),
      ["companies", "memberships", "roles"],
      "the bootstrap exception is exactly three tables",
    );
  }

  /* ── Every forbidden table is absent from the write set ──────────────────── */
  {
    const statements = [...sqlStatementsOf(coreSrc), ...sqlStatementsOf(cliSrc)];
    const written = new Set(statements.flatMap(writtenTablesOf));
    for (const table of FORBIDDEN_WRITES) {
      assert.ok(!written.has(table), `R4A must never write ${table}`);
    }
    /*
     * And the identity tables are not even READ for mutation elsewhere: the resolver selects from
     * `users` and `auth_identities`, which is correct and necessary — Decision 1 requires resolving
     * a human that already exists — so this asserts the mutation verbs specifically, not the names.
     */
    assert.match(coreCode, /from users u/, "the resolver must read users");
    assert.match(coreCode, /join auth_identities i/, "the resolver must read auth_identities");
  }

  /* ── No ON CONFLICT anywhere: a re-run refuses, it does not update ───────── */
  {
    for (const [label, code] of [
      ["core", coreCode],
      ["cli", cliCode],
    ] as const) {
      assert.doesNotMatch(
        code,
        /on\s+conflict/i,
        `${label}: a duplicate slug must refuse, never update an existing tenant`,
      );
    }
  }

  /* ── Nothing in the application tree may reach the ceremony ──────────────── */
  {
    const offenders = collect("src").filter((file) =>
      /scripts\/(lib\/)?(tenant-provision|provision-tenant)|provision-tenant/.test(
        readFileSync(path.join(ROOT, file), "utf8"),
      ),
    );
    assert.deepEqual(offenders, [], "no product module may import the tenant bootstrap ceremony");
  }

  /* ── And the ceremony may not reach INTO the application runtime ─────────── */
  {
    /*
     * `@/` resolves to `src/` only, so an `@/features/...` import would drag the ceremony into the
     * application graph and undo the structural guarantee that placing it under `scripts/` provides.
     * D1.1's tool imports one pure hashing helper by relative path, which is reuse; a feature import
     * would be something else entirely.
     */
    for (const [label, code] of [
      ["core", coreCode],
      ["cli", cliCode],
    ] as const) {
      assert.doesNotMatch(code, /from\s+["']@\//, `${label}: must not import the application tree`);
      assert.doesNotMatch(
        code,
        /features\/(heby|action-|governance-decision|knowledge|agent)/,
        `${label}: must not reach Heby, actions, Governance or Knowledge`,
      );
      assert.doesNotMatch(code, /next\/(cache|navigation|headers)/, `${label}: is not a route`);
      assert.doesNotMatch(code, /"use server"/, `${label}: is not a server action`);
    }
  }

  /* ── The ceremony has no route, no action and no API surface ─────────────── */
  {
    const routes = collect("src/app").filter((f) => /\/route\.tsx?$/.test(f));
    assert.deepEqual(routes, [], "R4A introduces no HTTP route handler");

    const actions = collect("src/app").filter((f) =>
      /tenant[-_]?provision|provisionTenant/i.test(readFileSync(path.join(ROOT, f), "utf8")),
    );
    assert.deepEqual(actions, [], "no page or action references tenant provisioning");
  }

  /* ── Guards: production, remote database, non-TTY, slug confirmation ─────── */
  {
    assert.match(
      cliCode,
      /process\.env\.NODE_ENV === "production"/,
      "the ceremony must refuse to run in production",
    );
    /*
     * ── REPAIRED BY G4 ───────────────────────────────────────────────────────
     *
     * The property this pinned — "the local-database guard is REUSED, not re-implemented" — is
     * unchanged and is asserted below. What changed is WHERE the reuse happens: G4 routes this
     * ceremony's locality decision through the shared posture path, which applies this exact guard
     * in local posture and its exact complement in production posture. Keeping the old call-site
     * regex would now be satisfied by an unused import — a grep passing while the property rotted.
     */
    assert.match(
      cliCode,
      /preflightEnvironment\(posture, databaseUrl\)/,
      "the locality decision is made by the shared posture path",
    );
    {
      const sharedPath = codeOf(read("scripts/lib/ceremony-preflight.ts"));
      assert.match(
        sharedPath,
        /assertLocalDatabaseUrl\(trimmed\)/,
        "the local-database guard must be REUSED, not re-implemented",
      );
      assert.match(
        sharedPath,
        /assertNonLocalDatabaseUrl\(trimmed\)/,
        "…and production posture refuses a local database",
      );
    }
    assert.doesNotMatch(
      cliCode,
      /127\.0\.0\.1|localhost|::1/,
      "the CLI must not carry its own copy of the local-host list",
    );
    assert.match(cliCode, /input\.isTTY/, "the ceremony must refuse a non-interactive stdin");
    assert.match(
      cliCode,
      /confirmation !== slug/,
      "the operator must retype the slug, and a mismatch must refuse",
    );
    assert.match(
      cliCode,
      /Nothing was changed/,
      "a refusal must say plainly that nothing was written",
    );
  }

  /* ── No environment variable may name the tenant or the human ────────────── */
  {
    const envReads = [...cliCode.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!);
    assert.deepEqual(
      [...new Set(envReads)].sort(),
      ["DATABASE_URL", "NODE_ENV"],
      "a tenant that config can name is a tenant a deployment mistake can create",
    );
    assert.doesNotMatch(coreCode, /process\.env/, "the ceremony core reads no environment at all");
  }

  /* ── The input cannot express identity, lifecycle or plan ───────────────── */
  {
    const input = coreSrc.match(/export interface ProvisionTenantInput \{[\s\S]*?\}/)?.[0] ?? "";
    assert.ok(input.length > 0, "ProvisionTenantInput must exist");
    for (const forbidden of [
      "id",
      "tenantId",
      "plan",
      "tenantStatus",
      "status",
      "actor",
      "createdBy",
      "roleId",
      "userId",
      "lifecycleStatus",
      "version",
    ]) {
      assert.doesNotMatch(
        input,
        new RegExp(`\\b${forbidden}\\b`, "i"),
        `the client-facing input must not be able to supply ${forbidden}`,
      );
    }

    /*
     * ── REPAIRED BY G4: `provisioningSource` LEFT THIS LIST ON PURPOSE ───────
     *
     * R4A forbade the field because the root was a hard-coded literal and no caller had any
     * business overriding it. G4 is the gate G1's schema header said would build the production
     * ceremony, and a ceremony that may run against either deployment must be able to record WHICH
     * one — so the root became a parameter.
     *
     * The property R4A was protecting is UNCHANGED: no caller may fabricate a root. It is now
     * enforced by four things instead of by the field's absence, and each is asserted rather than
     * asserted-about:
     *
     *   1. the type is the two-member released union, so no third value is expressible;
     *   2. omitting it yields the LOCAL root (proved against a real database in g4-flow);
     *   3. the only production caller binds it to the resolved posture and to nothing else
     *      (pinned exactly in g4-flow — a bite-proof that spliced `process.argv` in front of it
     *      survived the first, weaker version of that assertion);
     *   4. nothing under `src/` can import this module at all.
     *
     * Everything else on the list above is still forbidden, including `createdBy` — possession is
     * still a SOURCE and never an ACTOR.
     */
    assert.match(
      input,
      /readonly provisioningSource\?: CeremonySource;/,
      "the root is optional and typed to the closed released union",
    );
    const union = codeOf(read("scripts/lib/production-possession.ts")).match(
      /export type CeremonySource =[^;]*;/,
    )?.[0];
    assert.equal(
      union,
      "export type CeremonySource = typeof CEREMONY_SOURCE_LOCAL | typeof CEREMONY_SOURCE_PRODUCTION;",
      "…and that union admits exactly the two released roots",
    );
    assert.match(
      coreCode,
      /input\.provisioningSource \?\? TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR/,
      "omitting the root must yield the LOCAL one, never the production one",
    );

    assert.deepEqual(
      [...input.matchAll(/readonly (\w+):/g)].map((m) => m[1]!).sort(),
      ["displayName", "identityEmail", "slug"],
      "three required fields, and no fourth",
    );
    assert.deepEqual(
      [...input.matchAll(/readonly (\w+)\?:/g)].map((m) => m[1]!).sort(),
      ["provisioningSource"],
      "exactly one optional field, and it is the root",
    );
  }

  /* ── `plan` is not written, and is given no meaning ──────────────────────── */
  {
    const inserts = sqlStatementsOf(coreSrc).filter((s) => /insert into companies/i.test(s));
    assert.equal(inserts.length, 1, "exactly one companies insert");
    assert.doesNotMatch(inserts[0]!, /\bplan\b/, "R4A assigns `plan` no meaning and does not write it");
  }

  /* ── The company UPDATE can only ever reach the row just created ─────────── */
  {
    const updates = sqlStatementsOf(coreSrc).filter((s) => /update companies/i.test(s));
    assert.equal(updates.length, 1, "exactly one companies update");
    assert.match(
      updates[0]!.replace(/\s+/g, " "),
      /where id = \$1/,
      "the activation must be keyed by the id created in this transaction",
    );
  }

  /* ── The transaction is one transaction ──────────────────────────────────── */
  {
    assert.match(coreCode, /client\.query\("begin"\)/, "one explicit transaction");
    assert.match(coreCode, /client\.query\("commit"\)/, "…that commits");
    const rollbacks = [...coreCode.matchAll(/client\.query\("rollback"\)/g)].length;
    assert.ok(rollbacks >= 2, "…and rolls back on every refusal path inside it");
  }

  /* ── The band is one frozen literal, and it is existing vocabulary ───────── */
  {
    assert.match(coreSrc, /BOOTSTRAP_ROLE_TYPE = "owner"/, "the band is `owner`");
    assert.match(coreSrc, /BOOTSTRAP_ROLE_NAME = "Owner"/, "the name matches the seeded owner role");
    const roleInserts = sqlStatementsOf(coreSrc).filter((s) => /insert into roles/i.test(s));
    assert.equal(roleInserts.length, 1, "exactly one roles insert");
    assert.doesNotMatch(
      roleInserts[0]!,
      /authority_rank|policy_refs/,
      "unused authority columns stay untouched — populating them would invent an authority",
    );
    /* The enum vocabulary is not extended: `owner` must already exist in the schema. */
    assert.match(
      read("src/db/schema/_enums.ts"),
      /roleTypeEnum = pgEnum\("role_type", \[\s*"owner"/,
      "`owner` is existing canonical vocabulary, not a new band",
    );
  }

  /* ── The membership fabricates no provenance ─────────────────────────────── */
  {
    const inserts = sqlStatementsOf(coreSrc).filter((s) => /insert into memberships/i.test(s));
    assert.equal(inserts.length, 1, "exactly one memberships insert");
    const columns = inserts[0]!.match(/insert into memberships \(([^)]*)\)/i)?.[1] ?? "";
    assert.deepEqual(
      columns.split(",").map((c) => c.trim()).sort(),
      ["role_id", "status", "status_changed_at", "tenant_id", "user_id"],
      "no invitation id, no authorization id, no delegating actor, no created_by",
    );
    for (const fabricated of [
      "accepted_invitation_id",
      "delegated_by_id",
      "delegated_by_type",
      "created_by",
      "authority_scope",
    ]) {
      assert.ok(
        !columns.includes(fabricated),
        `${fabricated} must stay unwritten — the truthful value is absence`,
      );
    }
  }

  /* ── The company insert names no actor ───────────────────────────────────── */
  {
    const inserts = sqlStatementsOf(coreSrc).filter((s) => /insert into companies/i.test(s));
    const columns = inserts[0]!.match(/insert into companies \(([^)]*)\)/i)?.[1] ?? "";
    for (const fabricated of ["created_by", "created_by_type", "updated_by"]) {
      assert.ok(!columns.includes(fabricated), `${fabricated} must stay NULL — there is no actor`);
    }
    assert.match(columns, /provisioning_source/, "the row must record which root produced it");
  }

  /* ── The migration CHECK literal and the TypeScript constant agree ───────── */
  {
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /ADD CONSTRAINT "companies_provisioning_source_chk" CHECK \("companies"\."provisioning_source" is null or "companies"\."provisioning_source" = 'local-operator-ceremony'\)/,
      "the CHECK literal is inline, not a bind parameter",
    );
    assert.doesNotMatch(migration, /\$\d/, "a bind parameter inside a CHECK would not be valid SQL");
    assert.match(
      read(SCHEMA),
      /COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony"/,
      "the schema constant must match the migration literal",
    );
    assert.match(
      coreSrc,
      /TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony"/,
      "the ceremony constant must match too",
    );
    /* It shares wording with the genesis root on purpose — the same root, the same limitation. */
    assert.match(
      read("src/db/schema/genesis-nomination.ts"),
      /GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony"/,
      "the two ceremony sources name the same root",
    );
  }

  /* ── The migration is additive and touches nothing else ──────────────────── */
  {
    const migration = read(MIGRATION);
    assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i, "additive only");
    assert.doesNotMatch(migration, /UPDATE\s+/i, "no backfill");
    assert.doesNotMatch(migration, /action_execution_attempts|external_recipients|knowledge_/i, "no unrelated table");
    assert.doesNotMatch(migration, /\bplan\b/, "`plan` is untouched");
    assert.doesNotMatch(migration, /CREATE\s+(UNIQUE\s+)?INDEX/i, "no index change");
    const statements = migration.split("-->").filter((s) => s.trim().length > 0);
    assert.equal(statements.length, 2, "one column, one constraint, nothing else");
  }

  /* ── The column is nullable, so seeded rows need no invented history ─────── */
  {
    assert.match(
      read(MIGRATION),
      /ADD COLUMN "provisioning_source" varchar\(64\);/,
      "nullable — no NOT NULL, no DEFAULT, no backfill",
    );
    assert.doesNotMatch(read(MIGRATION), /NOT NULL|DEFAULT/i, "…and nothing that would force a value");
  }

  /* ── No secret-shaped output, and no secret-shaped input ─────────────────── */
  {
    /*
     * ASSERTED BY MECHANISM, NOT BY WORD. A scan for /credential/ over the whole file flags the CLI
     * for telling a refused operator to run `npm run auth:dev-credential` — which is the ceremony
     * declining to mint an identity and pointing at the tool that owns it, the exact opposite of a
     * violation. The same trap caught R3B twice (`includes("replay")` flagging `automaticReplay:
     * false`). So the prohibition is asked at the granularity that can actually be violated:
     * credential-bearing columns, the hasher, and an argument slot that could carry a secret.
     */
    const identifiersOf = (code: string) =>
      code.replace(/`[^`]*`/g, "``").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

    for (const [label, src, code] of [
      ["core", coreSrc, coreCode],
      ["cli", cliSrc, cliCode],
    ] as const) {
      assert.doesNotMatch(
        identifiersOf(code),
        /password|secret|token|api[_-]?key|passphrase/i,
        `${label}: no credential-shaped identifier exists in the ceremony`,
      );
      assert.doesNotMatch(
        code,
        /password-hash|hashPassword|provisionDevCredential/,
        `${label}: the ceremony must not reach the hasher or the credential writer`,
      );
      for (const statement of sqlStatementsOf(src)) {
        assert.doesNotMatch(
          statement,
          /auth_credentials|password|secret_hash/i,
          `${label}: no statement may touch credential storage`,
        );
      }
    }

    /* Three positional arguments, and no fourth that could carry a secret. */
    const argvSlots = [...cliCode.matchAll(/process\.argv\[(\d+)\]/g)].map((m) => Number(m[1]));
    assert.deepEqual(
      [...new Set(argvSlots)].sort(),
      [2, 3, 4],
      "slug, display name, email — and no fourth argument",
    );
  }

  /* ── Genesis is not performed, and is named as the next separate step ────── */
  {
    for (const [label, code] of [
      ["core", coreCode],
      ["cli", cliCode],
    ] as const) {
      assert.doesNotMatch(
        code,
        /nominateGenesisHuman|resolveNominationTarget|establishGovernanceAuthority|provisionMemberRole|issueInvitation/,
        `${label}: R4A performs no part of the next ceremony`,
      );
    }
    assert.match(
      cliCode,
      /governance:nominate-genesis/,
      "the operator must be told what the next, separate ceremony is",
    );
  }

  console.log("r4a-flow/provisioning-boundary: ok");
}

main();
