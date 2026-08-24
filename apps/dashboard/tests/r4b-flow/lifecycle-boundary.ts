/*
 * R4B — tenant suspension is two transitions and one shared read, and both halves need policing.
 *
 * THE INVARIANT. R4B manages exactly `active ↔ suspended`. `provisioning` belongs to R4A and exists
 * only inside its transaction; `deleting` and `deleted` belong to R5 along with retention, erasure
 * and audit redaction. An enum value is not authorization, so this file proves those three states
 * have no representation in the lifecycle module rather than merely no implementation.
 *
 * THE SECOND INVARIANT. The three pre-tenant flows must ask ONE seam whether a tenant may accept
 * onboarding. Three independent `companies` queries would be three places to drift apart, and the
 * drift would be silent: each flow would keep working while disagreeing with the session gate.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/* Strip comments before asserting on content (repo convention). Both R4B modules DOCUMENT at length
 * the states and tables they must never touch, so a prose mention of `deleting_at` is the ceremony
 * promising not to write it — the opposite of a violation. Only real code is policed. */
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

/** Every SQL statement a module issues, extracted from the template literals passed to client.query. */
function sqlStatementsOf(src: string): string[] {
  const code = codeOf(src);
  const out: string[] = [];
  const pattern = /client\.query(?:<[^>]*>)?\s*\(\s*(`[\s\S]*?`|"[^"]*"|'[^']*')/g;
  for (const m of code.matchAll(pattern)) out.push(m[1]!.slice(1, -1));
  return out;
}

/** The tables a statement WRITES. Reads are not writes. */
function writtenTablesOf(statement: string): string[] {
  const s = statement.replace(/\s+/g, " ").toLowerCase();
  const t: string[] = [];
  for (const m of s.matchAll(/insert\s+into\s+"?([a-z_]+)"?/g)) t.push(m[1]!);
  for (const m of s.matchAll(/update\s+"?([a-z_]+)"?\s+set/g)) t.push(m[1]!);
  for (const m of s.matchAll(/delete\s+from\s+"?([a-z_]+)"?/g)) t.push(m[1]!);
  return t;
}

/** The columns an UPDATE ... SET assigns. */
function assignedColumnsOf(statement: string): string[] {
  const s = statement.replace(/\s+/g, " ");
  const set = s.match(/set\s+(.*?)\s+where\s/i)?.[1] ?? "";
  return [...set.matchAll(/([a-z_]+)\s*=/g)].map((m) => m[1]!);
}

const CORE = "scripts/lib/tenant-lifecycle.ts";
const CLI = "scripts/tenant-lifecycle.ts";
const REPO_SEAM = "src/features/auth-runtime/identity-repository.server.ts";
const PRE_TENANT = [
  "src/features/human-onboarding/accept-invitation.server.ts",
  "src/features/identity-enrollment/start-enrollment.server.ts",
  "src/features/identity-enrollment/complete-enrollment.server.ts",
];

function main(): void {
  const coreSrc = read(CORE);
  const cliSrc = read(CLI);
  const coreCode = codeOf(coreSrc);
  const cliCode = codeOf(cliSrc);

  /* ── The lifecycle write set is `companies`, and nothing else ────────────── */
  {
    const statements = [...sqlStatementsOf(coreSrc), ...sqlStatementsOf(cliSrc)];
    assert.ok(statements.length > 0, "no SQL extracted — the matcher is broken");
    const written = new Set(statements.flatMap(writtenTablesOf));
    assert.deepEqual([...written], ["companies"], "R4B writes exactly one table");

    for (const forbidden of [
      "users", "auth_identities", "auth_credentials", "user_session_contexts", "memberships",
      "roles", "role_permissions", "permissions", "genesis_nominations", "decision_records",
      "governance_sessions", "membership_authorizations", "invitations",
      "identity_enrollment_requests", "audit_log", "provider_connectivity_controls",
      "action_execution_attempts", "action_permits", "external_recipients", "work_artifacts",
      "knowledge_facts", "knowledge_nodes", "organizations", "departments", "documents",
    ]) {
      assert.ok(!written.has(forbidden), `R4B must never write ${forbidden}`);
    }
  }

  /* ── Exactly two UPDATEs, and each assigns exactly the contracted columns ── */
  {
    const updates = sqlStatementsOf(coreSrc).filter((s) => /update companies/i.test(s));
    assert.equal(updates.length, 2, "one suspend, one reactivate, and no third transition");

    for (const stmt of updates) {
      const cols = assignedColumnsOf(stmt).sort();
      assert.deepEqual(
        cols,
        ["suspended_at", "suspension_reason", "tenant_status", "tenant_status_changed_at", "updated_at", "version"],
        "the contracted column set, and nothing else",
      );
      /* The fields R4B must never move, asserted against the ASSIGNMENT list rather than the file. */
      for (const untouched of [
        "authentication_disabled_at", "deleting_at", "lifecycle_status",
        "provisioning_source", "plan", "created_by", "created_by_type", "slug", "name",
      ]) {
        assert.ok(!cols.includes(untouched), `${untouched} must stay untouched by R4B`);
      }
      assert.match(stmt.replace(/\s+/g, " "), /version = version \+ 1/, "version advances");
      assert.match(stmt.replace(/\s+/g, " "), /where id = \$\d\s+and tenant_status = \$\d/i,
        "predicate-guarded: the transition is decided by the database, not by a prior read");
    }
    assert.doesNotMatch(coreCode, /on\s+conflict/i, "no ON CONFLICT anywhere");
  }

  /* ── Only active ↔ suspended is representable ────────────────────────────── */
  {
    assert.match(coreSrc, /LifecycleTransition = "suspend" \| "reactivate"/,
      "the transition union is closed at two values");
    assert.match(coreSrc, /TENANT_STATUS_ACTIVE = "active"/);
    assert.match(coreSrc, /TENANT_STATUS_SUSPENDED = "suspended"/);

    /* The three states R4B does not manage must not appear as CODE in either module — a comment
     * naming them is the ceremony declaring what it excludes. */
    for (const state of ["provisioning", "deleting", "deleted"]) {
      for (const [label, code] of [["core", coreCode], ["cli", cliCode]] as const) {
        assert.doesNotMatch(
          code,
          new RegExp(`["'\`]${state}["'\`]`),
          `${label}: '${state}' must have no representation in R4B`,
        );
      }
    }
    /* And no statement may name a status literal other than the two. */
    for (const stmt of sqlStatementsOf(coreSrc)) {
      assert.doesNotMatch(stmt, /provisioning|deleting|deleted/i, "no excluded state in any SQL");
    }
  }

  /* ── ONE shared read seam, consumed by all three pre-tenant flows ────────── */
  {
    assert.match(read(REPO_SEAM), /export async function isTenantOnboardingEligible/,
      "the seam lives in the module that already owns every companies read");

    for (const flow of PRE_TENANT) {
      const src = read(flow);
      assert.match(src, /isTenantOnboardingEligible/, `${flow}: must consult the shared seam`);
      assert.match(
        src,
        /from "@\/features\/auth-runtime\/identity-repository\.server"/,
        `${flow}: must import it, not reimplement it`,
      );
      /* No flow may run its own companies query — that is the drift this seam exists to prevent. */
      assert.doesNotMatch(
        codeOf(src),
        /from\(companies\)|db\/schema\/company/,
        `${flow}: must not query companies directly`,
      );
    }
  }

  /* ── The eligibility vocabulary has ONE definition ───────────────────────── */
  {
    const seam = read(REPO_SEAM);
    assert.match(seam, /export const ACTIVE_TENANT_STATUSES/, "defined in the repository");
    const service = read("src/features/auth-runtime/session-service.server.ts");
    assert.doesNotMatch(
      codeOf(service),
      /const ACTIVE_TENANT_STATUSES\s*[:=]/,
      "the session service must import the set, not keep a second copy",
    );
    assert.match(codeOf(service), /ACTIVE_TENANT_STATUSES,/, "…and it imports it");
    /* The set is unchanged: only `active`. */
    assert.match(seam, /ACTIVE_TENANT_STATUSES: ReadonlySet<string> = new Set\(\["active"\]\)/);
    /* All four session gates survive untouched. */
    assert.equal(
      [...service.matchAll(/ACTIVE_TENANT_STATUSES\.has/g)].length,
      4,
      "the four session gates are unchanged in number",
    );
  }

  /* ── The seam is a read, not an authority ────────────────────────────────── */
  {
    const seam = read(REPO_SEAM);
    const fn = seam.slice(seam.indexOf("export async function isTenantOnboardingEligible"));
    const body = fn.slice(0, fn.indexOf("\n}\n") + 3);
    assert.doesNotMatch(body, /\.insert\(|\.update\(|\.delete\(/, "the seam performs no write");
    assert.doesNotMatch(body, /authentication_disabled_at|authenticationDisabled/,
      "authentication policy is a separate concern and must not be collapsed into lifecycle");
    assert.match(body, /companies\.lifecycleStatus/, "the generic soft-delete flag IS consulted");
    assert.match(body, /if \(!row\) return false/, "a missing tenant fails closed");
  }

  /* ── No audit fabrication ────────────────────────────────────────────────── */
  {
    for (const [label, code] of [["core", coreCode], ["cli", cliCode]] as const) {
      assert.doesNotMatch(code, /audit_log|auditLog|recordGovernance|authoritySource/,
        `${label}: R4B writes no audit row and names no authority source`);
      assert.doesNotMatch(code, /platform-admin|actor_id|actorId|actorType/,
        `${label}: no actor may be fabricated`);
    }
  }

  /* ── No session revocation ───────────────────────────────────────────────── */
  {
    for (const [label, code] of [["core", coreCode], ["cli", cliCode]] as const) {
      assert.doesNotMatch(code, /revokeSession|user_session_contexts|revoked_at/,
        `${label}: suspension is live-state enforcement, never session destruction`);
    }
  }

  /* ── Guards, reused rather than re-implemented ───────────────────────────── */
  {
    assert.match(cliCode, /process\.env\.NODE_ENV === "production"/, "production refused");
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
        "the local guard is REUSED",
      );
      assert.match(
        sharedPath,
        /assertNonLocalDatabaseUrl\(trimmed\)/,
        "…and production posture refuses a local database",
      );
    }
    assert.doesNotMatch(cliCode, /127\.0\.0\.1|localhost|::1/, "no second copy of the host list");
    assert.match(cliCode, /input\.isTTY/, "non-interactive stdin refused");
    assert.match(cliCode, /confirmation !== tenant\.slug/, "the slug must be retyped");
    assert.match(cliCode, /Nothing was changed/, "a refusal says so plainly");

    const envReads = [...cliCode.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!);
    assert.deepEqual([...new Set(envReads)].sort(), ["DATABASE_URL", "NODE_ENV"],
      "a tenant that config can name is a tenant a deployment mistake can suspend");
    assert.doesNotMatch(coreCode, /process\.env/, "the core reads no environment at all");
  }

  /* ── The reason is bounded, required for suspend, absent for reactivate ──── */
  {
    assert.match(coreSrc, /MAX_SUSPENSION_REASON_CHARACTERS = 128/);
    assert.match(coreCode, /CONTROL_CHARACTERS\.test\(trimmed\)/, "control characters refused");
    /* Reactivate takes no reason: its input type has exactly one field. */
    const reactivate = coreSrc.slice(coreSrc.indexOf("export async function reactivateTenant"));
    const signature = reactivate.slice(0, reactivate.indexOf("): Promise<LifecycleOutcome>"));
    assert.doesNotMatch(signature, /reason/, "reactivation needs no reason");
    assert.match(signature, /readonly slug: string/);
  }

  /* ── Not an application runtime writer ───────────────────────────────────── */
  {
    const offenders = collect("src").filter((f) =>
      /tenant-lifecycle|suspendTenant|reactivateTenant/.test(readFileSync(path.join(ROOT, f), "utf8")),
    );
    assert.deepEqual(offenders, [], "no product module may import the lifecycle ceremony");

    for (const [label, code] of [["core", coreCode], ["cli", cliCode]] as const) {
      assert.doesNotMatch(code, /from\s+["']@\//, `${label}: must not import the application tree`);
      assert.doesNotMatch(code, /"use server"/, `${label}: is not a server action`);
      assert.doesNotMatch(code, /next\/(cache|navigation|headers)/, `${label}: is not a route`);
    }
    /*
     * AMENDED BY INT-3 — see `r4a-flow/provisioning-boundary.ts` for the reasoning. The repository
     * now has route handlers because OAuth needs one; the claim narrows to "not this phase's".
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
      .filter((f) => /\/route\.tsx?$/.test(f))
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(routes, INT3_ROUTES, "R4B introduces no HTTP route handler of its own");
  }

  /* ── Heby / agent / execution firewall ───────────────────────────────────── */
  {
    for (const dir of ["src/features/heby-actions", "src/features/heby-runtime",
      "src/features/action-execution", "src/features/heby-action-inlet", "src/features/agent-runtime"]) {
      for (const file of collect(dir)) {
        assert.doesNotMatch(
          readFileSync(path.join(ROOT, file), "utf8"),
          /tenant-lifecycle|suspendTenant|reactivateTenant/,
          `${file}: no agent or execution path may reach tenant lifecycle`,
        );
      }
    }
  }

  /* ── R4A is untouched, and `provisioning` stays its own ──────────────────── */
  {
    const provision = read("scripts/lib/provision-tenant.ts");
    assert.match(provision, /tenant_status = 'active'/, "R4A still activates at birth");
    assert.match(provision, /'provisioning'/, "…via its own transient state");
    for (const [label, code] of [["core", coreCode], ["cli", cliCode]] as const) {
      assert.doesNotMatch(code, /provisionTenant|provisioning_source|insert into companies/i,
        `${label}: R4B never creates a tenant`);
    }
  }

  /* ── No migration, no schema change ──────────────────────────────────────── */
  {
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
      f.endsWith(".sql"),
    );
    assert.equal(
      migrations.filter((f) => /r4b|suspend|lifecycle/i.test(f)).length,
      0,
      "R4B adds no migration — every field it writes already existed",
    );
  }

  /* ── No secret-shaped identifier ─────────────────────────────────────────── */
  {
    const identifiersOf = (code: string) =>
      code.replace(/`[^`]*`/g, "``").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
    for (const [label, code] of [["core", coreCode], ["cli", cliCode]] as const) {
      assert.doesNotMatch(identifiersOf(code), /password|secret|token|api[_-]?key|credential/i,
        `${label}: the ceremony handles no credential material`);
    }
  }

  console.log("r4b-flow/lifecycle-boundary: ok");
}

main();
