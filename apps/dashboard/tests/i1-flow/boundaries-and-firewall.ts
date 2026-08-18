/*
 * I1 — structural boundaries around Membership Authority.
 *
 * These prove claims about what does NOT exist: no second authority resolver, no role-band
 * shortcut for the CALLER, no invitation, no token, no user/identity/credential/membership/role
 * creation, no Heby or Voice reach, no provider or execution side effect, and no capability
 * inflation on the surface.
 *
 * Runtime behaviour lives in `membership-authorization-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  ELIGIBLE_ROLE_TYPE_LIST,
  MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION,
  MEMBERSHIP_AUTHORIZATION_DECISION_TYPE,
  MEMBERSHIP_AUTHORIZATION_DOMAIN,
  MEMBERSHIP_AUTHORIZATION_NON_EFFECTS,
  MEMBERSHIP_AUTHORIZATION_OUTCOME,
  MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE,
  ONBOARDING_ELIGIBLE_ROLE_TYPES,
  ONBOARDING_EXCLUDED_ROLE_TYPES,
  TENANT_ROLE_BASELINE_GAP,
} from "../../src/features/membership-authority/contracts";
import { GOVERNANCE_AUDIT_ACTIONS } from "../../src/features/governance-decision/contracts";
import { KNOWLEDGE_AUTHOR_ROLE_TYPES } from "../../src/features/knowledge/knowledge-write-authority.server";
import { normalizeTargetEmail } from "../../src/features/membership-authority/authorize-membership.server";

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

const SERVER = "src/features/membership-authority/authorize-membership.server.ts";
const CONTRACTS = "src/features/membership-authority/contracts.ts";
const SCHEMA = "src/db/schema/membership-authorization.ts";
const MIGRATION = "src/db/migrations/20260812090301_i1_membership_authorization.sql";

function main(): void {
  const server = read(SERVER);
  const serverCode = codeOf(server);
  const schema = read(SCHEMA);
  const migration = read(MIGRATION);

  /* ── 1. ONE authority resolver, and it is G2/G3's ───────────────────────── */
  {
    assert.match(
      serverCode,
      /resolveGovernanceAuthority/,
      "membership authority must resolve from the existing Governance resolver",
    );
    /* No second resolver was defined anywhere in this feature. */
    for (const file of collect("src/features/membership-authority")) {
      const code = codeOf(read(file));
      assert.ok(
        !/function\s+resolve\w*Authority|const\s+resolve\w*Authority\s*=/.test(code),
        `${file} must not define a second authority resolver`,
      );
    }
  }

  /* ── 2. The CALLER's authority never comes from a role band or permissions ─ */
  {
    /*
     * `roles` IS read here — for the TARGET band. The distinguishing assertion is that no role,
     * permission, or membership value is consulted between resolving authority and refusing.
     */
    assert.ok(
      !/permissions|role_permissions|rolePermissions|authorityScope|authority_scope/.test(
        serverCode,
      ),
      "membership authority must not consult permissions or membership authority scope",
    );
    assert.ok(
      !/KNOWLEDGE_AUTHOR_ROLE_TYPES|PROVIDER_CONTROL_ROLE_TYPES/.test(serverCode),
      "membership authority must not borrow another domain's role band as authority",
    );
    /* The authority check must precede any success path. */
    const authorityAt = serverCode.indexOf("resolveGovernanceAuthority");
    const insertAt = serverCode.indexOf("insert(membershipAuthorizations)");
    assert.ok(authorityAt > 0 && insertAt > authorityAt, "authority must be resolved before writing");
  }

  /* ── 3. I1 creates NOTHING that belongs to I2 ────────────────────────────── */
  {
    const forbidden = [
      "invitations",
      "tokenHash",
      "token_hash",
      "randomBytes",
      "createHmac",
      "users)",
      "authIdentities",
      "authCredentials",
      "memberships)",
      "insert(roles)",
      "sendMail",
      "sendInvitation",
    ];
    for (const token of forbidden) {
      assert.ok(
        !serverCode.includes(token),
        `I1 must not reference ${token} — that is I2's onboarding lifecycle`,
      );
    }
    /* Structural, not merely absent: the modules are not imported at all. */
    assert.ok(
      !/from "@\/db\/schema\/(invitation|user|auth-identity|auth-credential|membership)"/.test(
        serverCode,
      ),
      "I1 must not import the identity/onboarding tables it must never write",
    );
  }

  /* ── 4. No provider, execution, Computer Use or terminal reach ───────────── */
  {
    const forbidden = [
      "ANTHROPIC_API_KEY",
      "providerConnectivityControls",
      "directorEnabled",
      "computer-use",
      "child_process",
      "spawn(",
      "exec(",
      "fetch(",
      "heby",
      "voice",
    ];
    for (const token of forbidden) {
      assert.ok(
        !serverCode.toLowerCase().includes(token.toLowerCase()),
        `I1 must not reference ${token}`,
      );
    }
  }

  /* ── 5. Heby / Voice / Knowledge cannot authorize a membership ───────────── */
  {
    const reachable = [
      ...collect("src/features/heby-answer"),
      ...collect("src/features/heby-commands"),
      ...collect("src/features/heby-runtime"),
      ...collect("src/features/heby-voice"),
      ...collect("src/features/knowledge"),
    ];
    for (const file of reachable) {
      const code = codeOf(read(file));
      assert.ok(
        !/authorizeMembership|membershipAuthorizations|membership-authority/.test(code),
        `${file} must not be able to authorize a membership`,
      );
    }
  }

  /* ── 6. Vocabulary: one new domain, no new decision type ────────────────── */
  {
    assert.equal(MEMBERSHIP_AUTHORIZATION_DOMAIN, "membership-authorization");
    assert.equal(MEMBERSHIP_AUTHORIZATION_DECISION_TYPE, "approve");
    assert.equal(MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE, "membership_authorization");
    assert.equal(MEMBERSHIP_AUTHORIZATION_OUTCOME, "membership-authorized");

    const enums = read("src/db/schema/_enums.ts");
    /* `approve` was ALREADY in the decision-type enum — I1 added no decision type. */
    const decisionTypeBlock = enums.slice(
      enums.indexOf('pgEnum("governance_decision_type"'),
      enums.indexOf('pgEnum("risk_class"'),
    );
    assert.ok(decisionTypeBlock.includes('"approve"'), "approve must be a pre-existing enum value");
    assert.ok(
      !migration.includes("governance_decision_type"),
      "I1 must not alter the decision-type enum",
    );

    /* Exactly one governance_domain value was added. */
    const added = migration.match(/ALTER TYPE "public"\."governance_domain" ADD VALUE '([^']+)'/g) ?? [];
    assert.equal(added.length, 1, "exactly one governance_domain value may be added");
    assert.ok(added[0]!.includes("membership-authorization"));

    /* The audit action is registered in the shared governance vocabulary. */
    assert.ok(
      GOVERNANCE_AUDIT_ACTIONS.includes(MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION),
      "the membership audit action must be part of the shared governance action list",
    );
  }

  /* ── 7. Eligible role bands: `member` only, and derived from real reality ── */
  {
    assert.deepEqual([...ELIGIBLE_ROLE_TYPE_LIST], ["member"]);
    assert.ok(ONBOARDING_ELIGIBLE_ROLE_TYPES.has("member"));
    for (const excluded of ONBOARDING_EXCLUDED_ROLE_TYPES) {
      assert.ok(
        !ONBOARDING_ELIGIBLE_ROLE_TYPES.has(excluded),
        `${excluded} must not be an onboarding-eligible band`,
      );
    }
    /*
     * The two privileged bands are excluded BECAUSE other connected authorities already treat them
     * as privileged. If either of those lists ever changes, this assertion makes I1 re-examined
     * rather than silently stale.
     */
    for (const band of ["owner", "director"]) {
      assert.ok(
        KNOWLEDGE_AUTHOR_ROLE_TYPES.has(band),
        `${band} is excluded from onboarding because a connected authority privileges it`,
      );
      assert.ok(!ONBOARDING_ELIGIBLE_ROLE_TYPES.has(band));
    }
    /* `member` carries no connected privilege anywhere — that is why it is the safe band. */
    assert.ok(!KNOWLEDGE_AUTHOR_ROLE_TYPES.has("member"));
  }

  /* ── 8. The surface may not claim what I1 does not do ────────────────────── */
  {
    for (const claim of [
      "does not create the account now",
      "does not send an invitation",
      "does not create a credential",
      "does not grant Governance authority",
      "does not create or change any role",
    ]) {
      assert.ok(
        MEMBERSHIP_AUTHORIZATION_NON_EFFECTS.includes(claim),
        `the declared non-effects must state: ${claim}`,
      );
    }
    const contracts = read(CONTRACTS);
    for (const inflated of [
      "guaranteed",
      "fully secure",
      "enterprise-grade",
      "production-ready",
      "seamless",
    ]) {
      assert.ok(!contracts.toLowerCase().includes(inflated), `contracts must not claim ${inflated}`);
    }
  }

  /* ── 9. The role-baseline gap: closed by I1.1, and said so honestly ──────── */
  {
    /*
     * I1 STILL REFUSES RATHER THAN SOLVING IT. This is the invariant the phase was built on and it
     * did not change when I1.1 arrived — I1 discovers a role, it never creates one.
     */
    assert.ok(
      !/insert\(roles\)|insert into roles/i.test(serverCode),
      "I1 must never create a role to satisfy its own precondition",
    );

    /* THE CAPABILITY EXISTS NOW, and it is I1.1's. */
    assert.equal(TENANT_ROLE_BASELINE_GAP.capabilityPresent, true);
    assert.ok(
      TENANT_ROLE_BASELINE_GAP.owner.includes("I1.1 Tenant Role Baseline Authority"),
      "the gap's owner must name the authority that actually provisions the role",
    );
    assert.ok(
      !TENANT_ROLE_BASELINE_GAP.owner.startsWith("none"),
      "the superseded `owner: none` claim must not be presented as current truth",
    );

    /* DEPLOYMENT REALITY IS A SEPARATE FACT, and must stay separate. */
    assert.equal(TENANT_ROLE_BASELINE_GAP.provisionedInDurableTenants, false);

    /*
     * THE SUPERSEDED CLAIM MAY NOT BE PRESENTED AS CURRENT. Both halves of the I1-era statement are
     * banned from the live fields, and required in the historical record — deleting the history is
     * as wrong as leaving it standing as today's truth.
     */
    for (const live of [
      TENANT_ROLE_BASELINE_GAP.owner,
      TENANT_ROLE_BASELINE_GAP.observation,
      TENANT_ROLE_BASELINE_GAP.remedy,
      TENANT_ROLE_BASELINE_GAP.consequence,
    ]) {
      assert.ok(
        !live.includes("NOT reachable end to end"),
        "no live field may still claim onboarding is unreachable end to end",
      );
      assert.ok(
        !live.includes("no runtime provisions a tenant's roles"),
        "no live field may still claim the role baseline has no owner",
      );
    }
    assert.ok(
      TENANT_ROLE_BASELINE_GAP.historicalLimitation.consequence.includes(
        "NOT reachable end to end",
      ),
      "the I1-era limitation must be preserved verbatim, not erased",
    );
    assert.ok(
      TENANT_ROLE_BASELINE_GAP.historicalLimitation.owner.startsWith("none"),
      "the I1-era ownership claim must be preserved verbatim, not erased",
    );
    assert.ok(
      TENANT_ROLE_BASELINE_GAP.historicalLimitation.supersededBy.includes("I1.1"),
      "the record must name the phase that superseded the limitation",
    );

    /* THE SURFACE MUST NOT RESURRECT THE STALE CLAIM. */
    const card = read("src/components/governance-authority/membership-authorization-card.tsx");
    for (const stale of ["no runtime provisions", "NOT reachable end to end"]) {
      assert.ok(!card.includes(stale), `the Governance surface must not render "${stale}"`);
    }
    assert.ok(
      card.includes("TENANT_ROLE_BASELINE_GAP.remedy"),
      "the refusal surface must point at the authority that closes the gap",
    );
  }

  /* ── 10. Schema invariants exist as DATABASE constraints, not hopes ──────── */
  {
    for (const constraint of [
      "membership_authorizations_one_active_per_email_uq",
      "membership_authorizations_decision_uq",
      "membership_authorizations_consumed_invitation_uq",
      "membership_authorizations_human_authorizer_chk",
      "membership_authorizations_consumed_chk",
      "membership_authorizations_tenant_role_fk",
    ]) {
      assert.ok(schema.includes(constraint), `schema must declare ${constraint}`);
      assert.ok(migration.includes(constraint), `migration must create ${constraint}`);
    }
    /* Governance provenance is NOT NULL — an authorization with no decision is unrepresentable. */
    assert.match(migration, /"governance_decision_id" uuid NOT NULL/);
    assert.match(migration, /"governance_session_id" uuid NOT NULL/);
  }

  /* ── 11. The migration is additive and touches no protected table ────────── */
  {
    /*
     * Destructive STATEMENTS, not the word. `ON DELETE restrict` is a referential action on a
     * column being created and is the opposite of destructive — an earlier version of this
     * assertion matched it and was wrong.
     */
    for (const destructive of [
      /\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT|SCHEMA|DATABASE)\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
      /\bRENAME\s+(TO|COLUMN|CONSTRAINT)\b/i,
      /\bALTER\s+COLUMN\b/i,
    ]) {
      assert.ok(
        !destructive.test(migration),
        `the I1 migration must be purely additive — matched ${destructive}`,
      );
    }
    for (const protectedTable of [
      "users",
      "auth_identities",
      "auth_credentials",
      "memberships",
      "invitations",
    ]) {
      assert.ok(
        !new RegExp(`ALTER TABLE "${protectedTable}"`).test(migration),
        `the I1 migration must not alter ${protectedTable}`,
      );
    }
    /* `roles` is referenced only as a foreign-key TARGET, never altered. */
    assert.ok(!/ALTER TABLE "roles"/.test(migration));
  }

  /* ── 12. Email normalization is conservative, never clever ───────────────── */
  {
    assert.equal(normalizeTargetEmail("  Ada@Example.COM "), "ada@example.com");
    /* Plus-addressing and dots are NOT stripped: two different people stay two people. */
    assert.equal(normalizeTargetEmail("ada+team@example.com"), "ada+team@example.com");
    assert.equal(normalizeTargetEmail("a.da@example.com"), "a.da@example.com");
    for (const bad of ["", "   ", "ada", "ada@", "@example.com", "ada@example", "a b@c.com", 42, null]) {
      assert.equal(normalizeTargetEmail(bad as unknown), null, `must reject ${String(bad)}`);
    }
    assert.equal(normalizeTargetEmail(`${"a".repeat(320)}@example.com`), null, "must reject over-long");
  }

  console.log("PASS i1 boundaries and firewall");
}

main();
