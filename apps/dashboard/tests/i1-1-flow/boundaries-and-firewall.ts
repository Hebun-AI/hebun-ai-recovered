/*
 * I1.1 — structural boundaries around tenant role baseline provisioning.
 *
 * These prove claims about what does NOT exist: no second authority resolver, no generic role
 * writer, no role type/name/scope parameter, no role update or delete, no permission runtime, no
 * Heby/Voice/Knowledge/provider/execution reach, and no Governance provenance bolted onto `roles`.
 *
 * Runtime behaviour lives in `role-baseline-postgres.ts` and `provisioning-concurrency-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  BASELINE_ROLE_NAME,
  BASELINE_ROLE_SEMANTICS,
  BASELINE_ROLE_TYPE,
  BASELINE_UNIQUENESS,
  ORGANIZATIONAL_ROLE_AUDIT_ACTION,
  ORGANIZATIONAL_ROLE_DECISION_TYPE,
  ORGANIZATIONAL_ROLE_DOMAIN,
  ORGANIZATIONAL_ROLE_SUBJECT_TYPE,
  ROLE_BASELINE_NON_EFFECTS,
} from "../../src/features/tenant-role-baseline/contracts";
import { GOVERNANCE_AUDIT_ACTIONS } from "../../src/features/governance-decision/contracts";
import { KNOWLEDGE_AUTHOR_ROLE_TYPES } from "../../src/features/knowledge/knowledge-write-authority.server";
import { PROVIDER_CONTROL_ROLE_TYPES } from "../../src/features/heby-provider-ops/provider-authority.server";
import { ONBOARDING_ELIGIBLE_ROLE_TYPES } from "../../src/features/membership-authority/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
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

const SERVER = "src/features/tenant-role-baseline/provision-member-role.server.ts";
const CONTRACTS = "src/features/tenant-role-baseline/contracts.ts";
const MIGRATION = "src/db/migrations/20260812105312_i1_1_tenant_role_baseline.sql";

function main(): void {
  const server = read(SERVER);
  const serverCode = codeOf(server);
  const migration = read(MIGRATION);

  /* ── 1. ONE authority resolver, and it is G2/G3's ───────────────────────── */
  {
    assert.match(serverCode, /resolveGovernanceAuthority/);
    for (const file of collect("src/features/tenant-role-baseline")) {
      const code = codeOf(read(file));
      assert.ok(
        !/function\s+resolve\w*Authority|const\s+resolve\w*Authority\s*=/.test(code),
        `${file} must not define a second authority resolver`,
      );
    }
    /* Exactly one resolver definition exists in the whole repository. */
    const definitions = collect("src/features").filter((file) =>
      /export async function resolveGovernanceAuthority/.test(read(file)),
    );
    assert.deepEqual(definitions, [
      "src/features/governance-decision/decision-authority.server.ts",
    ]);
  }

  /* ── 2. The caller's authority never comes from a role band ─────────────── */
  {
    assert.ok(
      !/permissions|role_permissions|rolePermissions|authorityScope|authority_scope|authorityRank|policyRefs/.test(
        serverCode,
      ),
      "role provisioning must not consult or populate any unused authority system",
    );
    assert.ok(
      !/KNOWLEDGE_AUTHOR_ROLE_TYPES|PROVIDER_CONTROL_ROLE_TYPES/.test(serverCode),
      "role provisioning must not borrow another domain's role band as authority",
    );
    const authorityAt = serverCode.indexOf("resolveGovernanceAuthority");
    const insertAt = serverCode.indexOf("insert(roles)");
    assert.ok(authorityAt > 0 && insertAt > authorityAt, "authority must be resolved before writing");
  }

  /* ── 3. This is NOT role administration ─────────────────────────────────── */
  {
    /* The type and the name are constants, so a privileged band has no representation to arrive in. */
    assert.equal(BASELINE_ROLE_TYPE, "member");
    assert.equal(BASELINE_ROLE_NAME, "Member");
    assert.match(serverCode, /type: BASELINE_ROLE_TYPE/);
    assert.match(serverCode, /name: BASELINE_ROLE_NAME/);
    for (const forbidden of ["owner", "director", "operator", "auditor"]) {
      assert.ok(
        !new RegExp(`["']${forbidden}["']`).test(serverCode),
        `${forbidden} must not appear in the provisioning runtime`,
      );
    }
    /* The public input carries ONE field. A role type/name/scope parameter does not exist. */
    assert.match(
      server,
      /input:\s*\{\s*readonly justification: string;?\s*\}/,
      "provisioning must accept only a justification",
    );
    /* No update, no delete, no rename anywhere in the feature. */
    for (const file of collect("src/features/tenant-role-baseline")) {
      const code = codeOf(read(file));
      assert.ok(
        !/\.update\(roles\)|\.delete\(roles\)|drop\s+role|update\s+roles\s+set/i.test(code),
        `${file} must not modify or delete a role`,
      );
    }
  }

  /* ── 4. No provider, execution, Computer Use, terminal or network reach ──── */
  {
    for (const token of [
      "ANTHROPIC_API_KEY",
      "providerConnectivityControls",
      "directorEnabled",
      "computer-use",
      "child_process",
      "spawn(",
      "fetch(",
      "heby",
      "voice",
      "knowledge",
    ]) {
      assert.ok(
        !serverCode.toLowerCase().includes(token.toLowerCase()),
        `role provisioning must not reference ${token}`,
      );
    }
  }

  /* ── 5. Heby / Voice / Knowledge / I1 cannot provision a role ───────────── */
  {
    const reachable = [
      ...collect("src/features/heby-answer"),
      ...collect("src/features/heby-commands"),
      ...collect("src/features/heby-runtime"),
      ...collect("src/features/heby-voice"),
      ...collect("src/features/knowledge"),
      ...collect("src/features/membership-authority"),
    ];
    for (const file of reachable) {
      const code = codeOf(read(file));
      assert.ok(
        !/provisionMemberRole|tenant-role-baseline/.test(code),
        `${file} must not be able to provision a role`,
      );
    }
  }

  /* ── 6. Vocabulary: one new domain, no new decision type ────────────────── */
  {
    assert.equal(ORGANIZATIONAL_ROLE_DOMAIN, "organizational-role");
    assert.equal(ORGANIZATIONAL_ROLE_DECISION_TYPE, "approve");
    assert.equal(ORGANIZATIONAL_ROLE_SUBJECT_TYPE, "role");
    assert.ok(
      !migration.includes("governance_decision_type"),
      "I1.1 must not alter the decision-type enum",
    );
    const added =
      migration.match(/ALTER TYPE "public"\."governance_domain" ADD VALUE '([^']+)'/g) ?? [];
    assert.equal(added.length, 1, "exactly one governance_domain value may be added");
    assert.ok(added[0]!.includes("organizational-role"));
    assert.ok(GOVERNANCE_AUDIT_ACTIONS.includes(ORGANIZATIONAL_ROLE_AUDIT_ACTION));
    /* The domain is its own — never borrowed from the phases the Director named. */
    for (const forbidden of [
      "authority-delegation",
      "membership-authorization",
      "agent-registration",
      "provider-tool",
      "knowledge-ratification",
    ]) {
      assert.notEqual(ORGANIZATIONAL_ROLE_DOMAIN, forbidden);
    }
  }

  /* ── 7. The provisioned band grants nothing, and that is audited ─────────── */
  {
    assert.ok(!KNOWLEDGE_AUTHOR_ROLE_TYPES.has(BASELINE_ROLE_TYPE));
    assert.ok(!PROVIDER_CONTROL_ROLE_TYPES.has(BASELINE_ROLE_TYPE));
    /* Those two sets are the ONLY role-band grants in the repository. If a later phase grants
     * something to `member`, one of these assertions fails instead of the claim silently rotting. */
    assert.deepEqual([...KNOWLEDGE_AUTHOR_ROLE_TYPES].sort(), ["director", "owner"]);
    assert.deepEqual([...PROVIDER_CONTROL_ROLE_TYPES].sort(), ["director", "owner"]);
    for (const [key, value] of Object.entries(BASELINE_ROLE_SEMANTICS)) {
      if (typeof value === "boolean") assert.equal(value, false, `${key} must remain false`);
    }
    /* And the band I1.1 creates is exactly the band I1 will accept. */
    assert.ok(ONBOARDING_ELIGIBLE_ROLE_TYPES.has(BASELINE_ROLE_TYPE));
  }

  /* ── 8. The surface may not claim what I1.1 does not do ─────────────────── */
  {
    for (const claim of [
      "does not add a human",
      "does not create a membership",
      "does not create an invitation",
      "does not grant Governance authority",
      "does not change the owner role, or any existing role",
    ]) {
      assert.ok(ROLE_BASELINE_NON_EFFECTS.includes(claim), `non-effects must state: ${claim}`);
    }
    const contracts = read(CONTRACTS);
    for (const inflated of ["guaranteed", "fully secure", "enterprise-grade", "seamless"]) {
      assert.ok(!contracts.toLowerCase().includes(inflated));
    }
  }

  /* ── 9. Uniqueness is the DATABASE's, and it is partial ─────────────────── */
  {
    assert.equal(BASELINE_UNIQUENESS.constraint, "roles_one_member_per_tenant_uq");
    assert.equal(BASELINE_UNIQUENESS.scope, "tenant");
    const schema = read("src/db/schema/role.ts");
    assert.ok(schema.includes("roles_one_member_per_tenant_uq"));
    assert.match(migration, /CREATE UNIQUE INDEX "roles_one_member_per_tenant_uq"/);
    /* PARTIAL — privileged bands stay unconstrained, and tenant-scoped, not global. */
    assert.match(migration, /WHERE "roles"\."type" = 'member'/);
    assert.match(migration, /ON "roles" USING btree \("tenant_id"\)/);
  }

  /* ── 10. Provenance is decision-side; `roles` gained no columns ──────────── */
  {
    const schema = read("src/db/schema/role.ts");
    for (const forbidden of [
      "governanceDecisionId",
      "governance_decision_id",
      "baselineRole",
      "baseline_role",
      "onboardingRole",
      "isDefault",
      "is_default",
      "canonicalRole",
      "rolePurpose",
    ]) {
      assert.ok(!schema.includes(forbidden), `roles must not gain a ${forbidden} column`);
    }
    assert.ok(
      !/ALTER TABLE "roles" ADD COLUMN/i.test(migration),
      "I1.1 must add no column to roles",
    );
  }

  /* ── 11. The migration is exactly the authorized Gate B scope ────────────── */
  {
    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    assert.equal(statements.length, 2, "exactly two statements were authorized");
    assert.match(statements[0]!, /^ALTER TYPE "public"\."governance_domain" ADD VALUE/);
    assert.match(statements[1]!, /^CREATE UNIQUE INDEX "roles_one_member_per_tenant_uq"/);

    for (const destructive of [
      /\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT|SCHEMA|DATABASE)\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
      /\bCASCADE\b/i,
      /\bRENAME\s+(TO|COLUMN|CONSTRAINT)\b/i,
      /\bALTER\s+COLUMN\b/i,
      /\bCREATE TABLE\b/i,
    ]) {
      assert.ok(!destructive.test(migration), `migration must not match ${destructive}`);
    }
    for (const protectedTable of [
      "users",
      "memberships",
      "invitations",
      "auth_identities",
      "auth_credentials",
      "permissions",
      "role_permissions",
    ]) {
      assert.ok(
        !new RegExp(`ALTER TABLE "${protectedTable}"`).test(migration),
        `migration must not modify ${protectedTable}`,
      );
    }
  }

  /* ── 12. No generic role writer is exposed anywhere ──────────────────────── */
  {
    const writers = collect("src/features").filter((file) =>
      /\.insert\(roles\)/.test(codeOf(read(file))),
    );
    assert.deepEqual(writers, [SERVER], "exactly one module may create a role, and only this one");
  }

  console.log("PASS i1.1 boundaries and firewall");
}

main();
