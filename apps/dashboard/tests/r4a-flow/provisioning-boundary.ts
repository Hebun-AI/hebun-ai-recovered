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
 * ── AMENDED BY SELF-SERVICE SIGNUP ──────────────────────────────────────────
 *
 * The second half of that sentence is no longer the approved architecture. The Director decided a
 * new customer must be able to create their own organization, so the write moved OUT of `scripts/`
 * and into one authority under `src/` that both the operator ceremony and signup call.
 *
 * THE FIREWALL WAS NARROWED, NOT REMOVED. "Nothing in the product may reach it" became "exactly two
 * named callers may, and the write set is still three tables". That is a weaker rule and it is the
 * true one; the assertions below are what stop it weakening any further:
 *
 *   - exactly ONE module writes tenant bootstrap state, and it writes exactly three tables
 *   - the operator ceremony calls it rather than duplicating it
 *   - self-service signup calls it rather than duplicating it
 *   - NO OTHER product module reaches it — the caller census is exhaustive, so a third one fails here
 *   - no client component imports it
 *   - the provenance vocabulary is closed and matches the database CHECK
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
const AUTHORITY = "src/features/tenant-provisioning/provision-tenant.server.ts";
const AUTHORITY_CONTRACTS = "src/features/tenant-provisioning/contracts.ts";
const SIGNUP = "src/features/self-service-signup/create-account.server.ts";
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

/**
 * The tables the AUTHORITY writes, read from its drizzle calls.
 *
 * The write used to be raw SQL in the ceremony and this file extracted it from `client.query`
 * template literals. It is now drizzle, so the mechanism changed and the property did not: a table
 * named in a comment still cannot reach this list, and a table written in code still cannot escape
 * it. `.insert(x)` and `.update(x)` are mutations; `.select()` is not, and is deliberately not
 * counted — the authority must be free to READ `companies` to check a slug.
 */
function drizzleWrittenTablesOf(src: string): string[] {
  const code = codeOf(src);
  const tables: string[] = [];
  for (const m of code.matchAll(/\.insert\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) tables.push(m[1]!);
  for (const m of code.matchAll(/\.update\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) tables.push(m[1]!);
  for (const m of code.matchAll(/\.delete\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/g)) tables.push(m[1]!);
  return tables;
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

  const authoritySrc = read(AUTHORITY);
  const authorityCode = codeOf(authoritySrc);

  /* ── The exact write set is three tables, and it is the AUTHORITY's ──────── */
  {
    const written = new Set(drizzleWrittenTablesOf(authoritySrc));
    assert.deepEqual(
      [...written].sort(),
      ["companies", "memberships", "roles"],
      "the bootstrap exception is exactly three tables",
    );

    /*
     * AND THE CEREMONY NO LONGER WRITES AT ALL. It resolves a human and opens a transaction; every
     * mutation is the authority's. If raw SQL writes ever reappear here, there are two bootstrap
     * writers again — which is the exact thing this phase was allowed to refactor away, not to
     * duplicate.
     */
    const ceremonyWrites = new Set(
      [...sqlStatementsOf(coreSrc), ...sqlStatementsOf(cliSrc)].flatMap(writtenTablesOf),
    );
    assert.deepEqual(
      [...ceremonyWrites].sort(),
      [],
      "the operator ceremony writes nothing of its own — it calls the one authority",
    );
  }

  /* ── Every forbidden table is absent from the write set ──────────────────── */
  {
    const written = new Set([
      ...drizzleWrittenTablesOf(authoritySrc),
      ...[...sqlStatementsOf(coreSrc), ...sqlStatementsOf(cliSrc)].flatMap(writtenTablesOf),
    ]);
    for (const table of FORBIDDEN_WRITES) {
      assert.ok(!written.has(table), `tenant bootstrap must never write ${table}`);
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

  /* ── Nothing in the application tree may reach the SCRIPTS ceremony ──────── */
  {
    /*
     * Still absolute, and still the original rule. The ceremony under `scripts/` holds the operator
     * posture, the TTY confirmation and the production guards; a product module that imported IT
     * would inherit an operator's authority. What moved to `src/` is the three-table write, and
     * nothing else.
     */
    const offenders = collect("src").filter((file) =>
      /scripts\/(lib\/)?(tenant-provision|provision-tenant)/.test(
        /* CODE, NOT PROSE. The authority's header names the path it replaced, in order to say the
         * write moved out of it — a mention that is the documentation, not the violation. */
        codeOf(readFileSync(path.join(ROOT, file), "utf8")),
      ),
    );
    assert.deepEqual(offenders, [], "no product module may import the operator ceremony");
  }

  /* ── EXACTLY TWO CALLERS REACH THE AUTHORITY, AND THEY ARE NAMED ─────────── */
  {
    /*
     * THE REPLACEMENT FIREWALL.
     *
     * The old rule — nothing in `src/` may mention tenant provisioning — was enforceable because the
     * answer was zero. The answer is no longer zero, so the rule becomes a CENSUS: an exhaustive
     * list, so a third module appearing is a decision somebody has to record here rather than a
     * quiet second bootstrap path.
     *
     * `create-account.server.ts` is signup. The two files under `tenant-provisioning/` are the
     * authority itself and its own vocabulary. That is the whole list.
     */
    const referencing = collect("src")
      .filter((file) =>
        /provision-tenant|provisionTenant|tenant-provisioning/.test(
          readFileSync(path.join(ROOT, file), "utf8"),
        ),
      )
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      referencing,
      [SIGNUP, AUTHORITY_CONTRACTS, AUTHORITY].sort(),
      "exactly one authority, one vocabulary and one product caller reference tenant provisioning",
    );
  }

  /* ── The authority is server-only and cannot be reached by a client ──────── */
  {
    assert.doesNotMatch(authorityCode, /"use client"/, "the authority is never a client module");
    assert.doesNotMatch(
      authorityCode,
      /"use server"/,
      "the authority is not itself a server action — a caller must own the act",
    );
    /*
     * A client component importing it would ship tenant-writing code to a browser. Neither the
     * authority nor signup may appear in one.
     */
    const clientOffenders = collect("src").filter((file) => {
      const code = readFileSync(path.join(ROOT, file), "utf8");
      return (
        /^\s*["']use client["']/m.test(code) &&
        /tenant-provisioning|self-service-signup/.test(code)
      );
    });
    assert.deepEqual(clientOffenders, [], "no client component imports tenant provisioning or signup");
  }

  /* ── The provenance vocabulary is closed, and matches the database ───────── */
  {
    const contracts = codeOf(read(AUTHORITY_CONTRACTS));
    const schema = codeOf(read(SCHEMA));
    for (const value of [
      "local-operator-ceremony",
      "production-operator-ceremony",
      "self-service-signup",
    ]) {
      assert.ok(contracts.includes(value), `the vocabulary admits ${value}`);
      assert.ok(schema.includes(value), `the database CHECK admits ${value}`);
    }
    /*
     * SIGNUP MAY ONLY EVER CLAIM ONE OF THEM. If `create-account.server.ts` ever names an operator
     * root, a self-service tenant would be indistinguishable from a ceremony-born one — which is
     * precisely the distinction Director Decision 1 required be preserved.
     */
    const signupCode = codeOf(read(SIGNUP));
    assert.ok(
      signupCode.includes("TENANT_PROVISIONING_SOURCE_SELF_SERVICE"),
      "signup states its own provenance",
    );
    for (const operatorRoot of ["local-operator-ceremony", "production-operator-ceremony"]) {
      assert.ok(
        !signupCode.includes(operatorRoot),
        `signup may never claim the ${operatorRoot} root`,
      );
    }
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
      /* The Instagram OAuth ceremony — the third provider pair, added by this phase. */
      "src/app/api/integrations/instagram/callback/route.ts",
      "src/app/api/integrations/instagram/start/route.ts",
      /* TRH-25 added the machine ingress the automatic due-scan is triggered through. It is
       * NAMED here rather than pattern-matched, so a SECOND machine route cannot appear
       * without this census failing. */
      "src/app/api/observation/scan/route.ts",
    ].sort();
    const routes = collect("src/app")
      .filter((f) => /\/route\.tsx?$/.test(f))
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(routes, INT3_ROUTES, "R4A introduces no HTTP route handler of its own");

    /*
     * ── WHICH APP-LAYER MODULES MAY CAUSE A TENANT ───────────────────────────
     *
     * This asserted an empty list, which was right while nothing in the product could provision. It
     * would still pass today by ACCIDENT — signup reaches the authority through
     * `createSelfServiceAccount`, whose name matches neither pattern — and a rule that passes by
     * accident is not a rule. So it becomes an exhaustive census of the app-layer modules that may
     * cause tenant creation by ANY route, direct or indirect.
     */
    const actions = collect("src/app")
      .filter((f) =>
        /tenant[-_]?provision|provisionTenant|createSelfServiceAccount|self-service-signup/i.test(
          codeOf(readFileSync(path.join(ROOT, f), "utf8")),
        ),
      )
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      actions,
      ["src/app/register/actions.ts", "src/app/register/page.tsx"],
      "exactly one signup action and its page may cause tenant creation",
    );
    /*
     * AND THE PAGE ONLY READS THE VOCABULARY. A page is rendered on GET; if it could provision, a
     * crawler could create tenants.
     */
    assert.doesNotMatch(
      codeOf(read("src/app/register/page.tsx")),
      /createSelfServiceAccount|provisionTenant/,
      "the signup PAGE renders a form and provisions nothing",
    );
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

  /*
   * ── THE WRITE SHAPES, RESTATED IN THE AUTHORITY'S OWN LANGUAGE ────────────
   *
   * These assertions used to read raw SQL out of the ceremony. The write is drizzle now, so each one
   * is re-expressed against the `.values({...})` object it actually writes. Every property they
   * asserted is asserted still: one insert per table, no `plan`, no fabricated provenance, no actor,
   * and an activation that cannot reach another tenant's row.
   */

  /** The object literal passed to the `.values(...)` that follows an `.insert(<table>)`. */
  const valuesFor = (table: string): string => {
    const at = authorityCode.indexOf(`.insert(${table})`);
    assert.ok(at >= 0, `the authority inserts ${table}`);
    const open = authorityCode.indexOf("{", authorityCode.indexOf(".values(", at));
    let depth = 0;
    for (let i = open; i < authorityCode.length; i += 1) {
      if (authorityCode[i] === "{") depth += 1;
      if (authorityCode[i] === "}") {
        depth -= 1;
        if (depth === 0) return authorityCode.slice(open + 1, i);
      }
    }
    throw new Error(`unterminated values object for ${table}`);
  };

  const keysOf = (block: string): string[] =>
    [...block.matchAll(/(^|[,{\s])([A-Za-z_][A-Za-z0-9_]*)\s*[:,]/g)].map((m) => m[2]!).sort();

  /* ── `plan` is not written, and is given no meaning ──────────────────────── */
  {
    assert.equal(
      [...authorityCode.matchAll(/\.insert\(companies\)/g)].length,
      1,
      "exactly one companies insert",
    );
    assert.ok(
      !keysOf(valuesFor("companies")).includes("plan"),
      "tenant birth assigns `plan` no meaning and does not write it",
    );
  }

  /* ── The company insert names no actor, and records its root ─────────────── */
  {
    const keys = keysOf(valuesFor("companies"));
    for (const fabricated of ["createdBy", "createdByType", "updatedBy", "updatedByType"]) {
      assert.ok(!keys.includes(fabricated), `${fabricated} must stay NULL — there is no actor`);
    }
    assert.ok(keys.includes("provisioningSource"), "the row must record which root produced it");
  }

  /* ── The company UPDATE can only ever reach the row just created ─────────── */
  {
    assert.equal(
      [...authorityCode.matchAll(/\.update\(companies\)/g)].length,
      1,
      "exactly one companies update",
    );
    /*
     * KEYED BY THE ID CREATED IN THIS TRANSACTION, and additionally by the transient status — so the
     * activation is structurally incapable of touching another tenant's row OR of re-activating a
     * suspended one.
     */
    assert.match(
      authorityCode.slice(authorityCode.indexOf(".update(companies)")).replace(/\s+/g, " "),
      /eq\(companies\.id, tenantId\)/,
      "the activation must be keyed by the id created in this transaction",
    );
  }

  /* ── The band is one frozen literal, and it is existing vocabulary ───────── */
  {
    const contractsSrc = read(AUTHORITY_CONTRACTS);
    assert.match(contractsSrc, /BOOTSTRAP_ROLE_TYPE = "owner"/, "the band is `owner`");
    assert.match(
      contractsSrc,
      /BOOTSTRAP_ROLE_NAME = "Owner"/,
      "the name matches the seeded owner role",
    );
    assert.equal(
      [...authorityCode.matchAll(/\.insert\(roles\)/g)].length,
      1,
      "exactly one roles insert",
    );
    const keys = keysOf(valuesFor("roles"));
    for (const unused of ["authorityRank", "policyRefs"]) {
      assert.ok(
        !keys.includes(unused),
        "unused authority columns stay untouched — populating them would invent an authority",
      );
    }
    /* The enum vocabulary is not extended: `owner` must already exist in the schema. */
    assert.match(
      read("src/db/schema/_enums.ts"),
      /roleTypeEnum = pgEnum\("role_type", \[\s*"owner"/,
      "`owner` is existing canonical vocabulary, not a new band",
    );
  }

  /* ── The membership fabricates no provenance ─────────────────────────────── */
  {
    assert.equal(
      [...authorityCode.matchAll(/\.insert\(memberships\)/g)].length,
      1,
      "exactly one memberships insert",
    );
    assert.deepEqual(
      keysOf(valuesFor("memberships")),
      ["roleId", "status", "statusChangedAt", "tenantId", "userId"],
      "no invitation id, no authorization id, no delegating actor, no created_by",
    );
    for (const fabricated of [
      "acceptedInvitationId",
      "delegatedById",
      "delegatedByType",
      "createdBy",
      "authorityScope",
    ]) {
      assert.ok(
        !keysOf(valuesFor("memberships")).includes(fabricated),
        `${fabricated} must stay unwritten — the truthful value is absence`,
      );
    }
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
    /*
     * ── ONE DEFINITION, NOT TWO THAT AGREE ────────────────────────────────────
     *
     * The ceremony used to carry its own `= "local-operator-ceremony"` literal, and this asserted
     * that it matched the migration. Two copies of a database-constrained value is how a vocabulary
     * drifts, so the authority now owns the constant and the ceremony RE-EXPORTS it. That is the
     * stronger property and it is what is asserted: the literal exists in exactly one place, and the
     * ceremony reaches it rather than restating it.
     */
    assert.match(
      read(AUTHORITY_CONTRACTS),
      /TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony"/,
      "the authority owns the constant",
    );
    assert.doesNotMatch(
      codeOf(coreSrc).replace(/CORE_LOCAL_OPERATOR/g, ""),
      /"local-operator-ceremony"/,
      "the ceremony must not restate the literal — it imports the one definition",
    );
    assert.match(
      codeOf(coreSrc),
      /TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR = CORE_LOCAL_OPERATOR/,
      "…and re-exports it under its released name",
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
