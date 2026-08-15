/*
 * Membership–Role Tenant Integrity — structural boundaries.
 *
 * These prove claims about what does NOT exist: no second Membership or Role authority, no new
 * writer anywhere, no Session/Governance/Identity/Credential/Invitation/Enrollment change, no audit
 * sink, no permission runtime, no dependency, no destructive SQL, and — the point of the phase — no
 * TypeScript check standing in for a relational invariant.
 *
 * Runtime behaviour lives in `integrity-postgres.ts`, against a real database, because that is the
 * only place a claim about what PostgreSQL refuses can honestly be made.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const MIGRATIONS = "src/db/migrations";
const MIGRATION = "20260813090642_membership_role_tenant_integrity.sql";
const MEMBERSHIP_SCHEMA = "src/db/schema/membership.ts";
const ROLE_SCHEMA = "src/db/schema/role.ts";
const CONSTRAINT = "memberships_tenant_role_fk";

function main(): void {
  const membershipSchema = read(MEMBERSHIP_SCHEMA);
  const roleSchema = read(ROLE_SCHEMA);
  const migration = read(path.join(MIGRATIONS, MIGRATION));

  /* ── 1. THE MIGRATION IS EXACTLY THE AUTHORIZED STATEMENT ────────────────── */
  {
    /*
     * Stated against THIS phase's boundary, not a global count — the same repair this phase made to
     * four sibling tests that had frozen a repository-wide migration total as a proxy for "I added
     * none of my own". Filenames are timestamp-prefixed, so a lexical comparison is chronological.
     */
    const files = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql"));
    assert.ok(files.includes(MIGRATION), "the migration this phase authored exists");
    const throughThisPhase = files.filter((f) => f <= MIGRATION);
    assert.equal(
      throughThisPhase.length, 24,
      "23 migrations existed when switching closed, plus exactly this phase's one",
    );
    assert.equal(
      files.filter((f) => /membership_role|tenant_integrity/i.test(f)).length, 1,
      "and this phase authored exactly one",
    );

    const statements = migration.split(";").map((s) => s.trim()).filter(Boolean);
    assert.equal(statements.length, 1, "ONE statement — the smallest possible additive migration");
    assert.match(
      statements[0]!,
      /^ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_role_fk" FOREIGN KEY \("tenant_id","role_id"\) REFERENCES "public"\."roles"\("tenant_id","id"\) ON DELETE restrict ON UPDATE no action$/,
      "the exact Gate B shape, and nothing else",
    );

    /* No destructive or rewriting SQL, anywhere in it. */
    for (const forbidden of [
      /\bDROP\b/i, /\bTRUNCATE\b/i, /\bCASCADE\b/i, /\bDELETE\s+FROM\b/i,
      /\bUPDATE\s+"?memberships"?\s+SET\b/i, /\bALTER\s+COLUMN\b/i, /\bSET\s+NOT\s+NULL\b/i,
      /\bCREATE\s+TABLE\b/i, /\bCREATE\s+TYPE\b/i, /\bADD\s+COLUMN\b/i,
    ]) {
      assert.ok(!forbidden.test(migration), `the migration must not contain ${forbidden}`);
    }

    /* The journal agrees with the directory, so a half-added migration cannot pass. */
    const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json"))) as {
      entries: { tag: string }[];
    };
    assert.equal(journal.entries.length, files.length, "journal and SQL count agree");
    /*
     * This asserted the migration was the NEWEST journal entry, which stopped being this phase's
     * business the moment a later Gate-B phase added one. What matters here is that the entry
     * exists, is registered exactly once, and still sits where the directory listing puts it —
     * a half-added migration fails all three, while a legitimate successor fails none.
     */
    const tag = MIGRATION.replace(/\.sql$/, "");
    const tags = journal.entries.map((entry) => entry.tag);
    assert.equal(
      tags.filter((entry) => entry === tag).length,
      1,
      "this migration is registered exactly once",
    );
    assert.equal(
      tags.indexOf(tag),
      files.indexOf(MIGRATION),
      "and the journal orders it where the directory does",
    );
  }

  /* ── 2. THE SCHEMA DELTA IS EXACTLY ONE FOREIGN KEY ──────────────────────── */
  {
    const code = codeOf(membershipSchema);
    assert.match(
      code,
      /foreignKey\(\{\s*name: "memberships_tenant_role_fk",\s*columns: \[t\.tenantId, t\.roleId\],\s*foreignColumns: \[roles\.tenantId, roles\.id\],\s*\}\)\.onDelete\("restrict"\)/,
      "the composite FK is declared exactly as generated",
    );
    /* No column, table or enum was touched. */
    assert.equal(
      (code.match(/pgTable\(/g) ?? []).length, 1,
      "membership.ts still defines exactly one table",
    );
    assert.ok(!/pgEnum\(/.test(code), "no enum was defined here");
    /* The weaker single-column FK was NOT removed. */
    assert.match(
      code,
      /roleId: uuid\("role_id"\)\.references\(\(\) => roles\.id\)/,
      "the pre-existing single-column role FK stays — this phase adds, it does not drop",
    );
    /* Everything else memberships already guaranteed is still declared. */
    for (const existing of [
      'uniqueIndex("memberships_tenant_user_uq")',
      'unique("memberships_tenant_id_id_uq")',
      'unique("memberships_accepted_invitation_uq")',
      'check(\n      "memberships_revocation_actor_chk"',
    ]) {
      assert.ok(code.includes(existing), `no existing constraint may be weakened: ${existing}`);
    }
  }

  /* ── 3. THE PARENT SIDE WAS NOT TOUCHED ──────────────────────────────────── */
  {
    const code = codeOf(roleSchema);
    assert.match(
      code,
      /unique\("roles_tenant_id_id_uq"\)\.on\(t\.tenantId, t\.id\)/,
      "the composite target already existed; this phase did not add or duplicate it",
    );
    assert.match(
      code,
      /uniqueIndex\("roles_one_member_per_tenant_uq"\)/,
      "I1.1's one-member-role invariant is untouched",
    );
    /* Role authority owns the parent side and needed no change at all. */
    assert.ok(
      !code.includes(CONSTRAINT),
      "the new constraint belongs to memberships, not to roles",
    );
  }

  /* ── 4. NO SECOND MEMBERSHIP OR ROLE AUTHORITY ───────────────────────────── */
  {
    const src = collect("src").filter((f) => /\.tsx?$/.test(f));
    const membershipWriters: string[] = [];
    const roleWriters: string[] = [];
    for (const file of src) {
      if (file.startsWith("src/db/schema")) continue;
      const code = codeOf(read(file));
      if (/\.insert\(memberships\)|\.update\(memberships\)|\.delete\(memberships\)/.test(code)) {
        membershipWriters.push(file);
      }
      if (/\.insert\(roles\)|\.update\(roles\)|\.delete\(roles\)/.test(code)) {
        roleWriters.push(file);
      }
    }
    assert.deepEqual(
      membershipWriters,
      ["src/features/human-onboarding/accept-invitation.server.ts"],
      "memberships still has exactly ONE product writer",
    );
    assert.deepEqual(
      roleWriters,
      ["src/features/tenant-role-baseline/provision-member-role.server.ts"],
      "roles still has exactly ONE product writer",
    );
  }

  /* ── 5. NO RUNTIME CHECK STANDS IN FOR THE INVARIANT ─────────────────────── */
  {
    /*
     * THE POINT OF THE PHASE. A TypeScript guard would prove one caller checks the pair; only the
     * database proves no caller can avoid it. `findRoleForTenant` has existed in the auth repository
     * since R1 and is called by nothing — the runtime-check approach was written once and never
     * adopted, and this phase did not adopt it either.
     */
    const callers = collect("src")
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /findRoleForTenant\s*\(/.test(codeOf(read(f)).replace(/export async function findRoleForTenant\s*\(/, "")));
    assert.deepEqual(
      callers, [],
      "findRoleForTenant must remain uncalled — the invariant lives in PostgreSQL, not in a caller",
    );

    /* The one membership writer did not gain a role-tenant validation either. */
    const writer = codeOf(read("src/features/human-onboarding/accept-invitation.server.ts"));
    for (const smell of [
      /roles\.tenantId/, /role\.tenantId/, /findRoleForTenant/,
      /roleTenantMismatch/, /role-tenant/,
    ]) {
      assert.ok(
        !smell.test(writer),
        `the membership writer must not re-implement the invariant in code — matched ${smell}`,
      );
    }
  }

  /* ── 6. NO OTHER AUTHORITY WAS TOUCHED ───────────────────────────────────── */
  {
    /*
     * Scanned as a whole-source sweep for writers this phase has no authority over. The phase changed
     * one schema file and one migration; if any of these appeared in a NEW place, the sweep in §4
     * plus this list is what would notice.
     */
    const authoritySurfaces = [
      "src/features/auth-runtime/session-service.server.ts",
      "src/features/auth-runtime/identity-repository.server.ts",
      "src/features/auth-runtime/request-session.server.ts",
      "src/features/governance-decision/decision-authority.server.ts",
      "src/features/identity-enrollment/complete-enrollment.server.ts",
      "src/features/human-onboarding/issue-invitation.server.ts",
      "src/features/membership-authority/authorize-membership.server.ts",
      "src/features/tenant-role-baseline/provision-member-role.server.ts",
    ];
    for (const file of authoritySurfaces) {
      const code = codeOf(read(file));
      assert.ok(
        !code.includes(CONSTRAINT),
        `${file}: no runtime module may name the constraint — it is a database fact, not a branch`,
      );
    }
    /* Session authority still writes no audit row, and gained none here. */
    const authRuntime = collect("src/features/auth-runtime").map((f) => codeOf(read(f))).join("\n");
    for (const sink of ["auditLog", "audit_log"]) {
      assert.ok(!authRuntime.includes(sink), `Session authority must not write ${sink}`);
    }
  }

  /* ── 7. NO CAPABILITY THIS PHASE DOES NOT HAVE ───────────────────────────── */
  {
    const surface = [MEMBERSHIP_SCHEMA, ROLE_SCHEMA].map((f) => codeOf(read(f))).join("\n") + migration;
    for (const forbidden of [
      "nodemailer", "smtp", "resend", "sendgrid", "sendMail",
      "oidc", "saml", "passkey", "webauthn", "totp",
      "computer-use", "childProcess", "execFileSync",
      "rolePermissions", "permissions", "providerConnectivity", "executions",
      "knowledgeNodes", "decisionRecords",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(surface),
        `this phase must not reference ${forbidden}`,
      );
    }
  }

  /* ── 8. DEPENDENCY DELTA IS ZERO ─────────────────────────────────────────── */
  {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    /* The exact published set. A new entry here would fail before anything installs it. */
    assert.deepEqual(
      Object.keys(pkg.dependencies).sort(),
      ["clsx", "drizzle-orm", "lucide-react", "next", "pg", "react", "react-dom", "tailwind-merge"],
      "no runtime dependency was added",
    );
    assert.deepEqual(
      Object.keys(pkg.devDependencies).sort(),
      [
        "@tailwindcss/postcss", "@types/node", "@types/react", "@types/react-dom",
        "drizzle-kit", "eslint", "eslint-config-next", "tailwindcss", "tsx", "typescript",
      ],
      "no dev dependency was added",
    );
  }

  console.log("PASS membership-role tenant integrity boundaries and firewall");
}

main();
