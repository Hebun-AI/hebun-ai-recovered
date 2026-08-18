/*
 * I1.2 — structural boundaries around Identity & Credential Enrollment.
 *
 * These prove claims about what does NOT exist: no second Governance resolver, no role-band
 * shortcut, no membership, no session, no mail, no SSO, no dev-credential import, no B-4 column
 * under any name, and a migration that touches exactly the four authorized things and nothing else.
 *
 * Runtime behaviour lives in `enrollment-postgres.ts` and `enrollment-concurrency-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  IDENTITY_ENROLLMENT_APPROVED_ACTION,
  IDENTITY_ENROLLMENT_APPROVE_TYPE,
  IDENTITY_ENROLLMENT_DOMAIN,
  IDENTITY_ENROLLMENT_NON_EFFECTS,
  IDENTITY_ENROLLMENT_REJECTED_ACTION,
  IDENTITY_ENROLLMENT_REJECT_TYPE,
  IDENTITY_ENROLLMENT_SUBJECT_TYPE,
  LOCAL_IDENTITY_ISSUER,
  LOCAL_IDENTITY_PROVIDER,
  MIN_ENROLLMENT_PASSWORD_LENGTH,
  TWO_KEY_INVARIANT,
  localIdentitySubject,
} from "../../src/features/identity-enrollment/contracts";
import { GOVERNANCE_AUDIT_ACTIONS } from "../../src/features/governance-decision/contracts";
import { KNOWLEDGE_AUTHOR_ROLE_TYPES } from "../../src/features/knowledge/knowledge-write-authority.server";

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

const START = "src/features/identity-enrollment/start-enrollment.server.ts";
const DECIDE = "src/features/identity-enrollment/decide-enrollment.server.ts";
const COMPLETE = "src/features/identity-enrollment/complete-enrollment.server.ts";
const DIGEST = "src/features/identity-enrollment/enrollment-digest.server.ts";
const CONTRACTS = "src/features/identity-enrollment/contracts.ts";
const SCHEMA = "src/db/schema/identity-enrollment.ts";
const MIGRATION = "src/db/migrations/20260812130555_i1_2_identity_enrollment.sql";
const IDENTITY_REPO = "src/features/auth-runtime/identity-repository.server.ts";
const FEATURE_FILES = [START, DECIDE, COMPLETE, DIGEST, CONTRACTS];
/**
 * The EXECUTABLE surface only. `contracts.ts` is excluded from capability scans on purpose: its
 * `IDENTITY_ENROLLMENT_NON_EFFECTS` list names Computer Use, terminal and execution precisely in
 * order to state that they do not happen, and a scan that treated an honest denial as a violation
 * would push the phase toward hiding its own limits.
 */
const RUNTIME_FILES = [START, DECIDE, COMPLETE, DIGEST];

function main(): void {
  const start = read(START);
  const decide = read(DECIDE);
  const complete = read(COMPLETE);
  const schema = read(SCHEMA);
  const migration = read(MIGRATION);
  const featureCode = FEATURE_FILES.map((f) => codeOf(read(f))).join("\n");
  const runtimeCode = RUNTIME_FILES.map((f) => codeOf(read(f))).join("\n");

  /* ── 1. ONE authority resolver, and it is G2/G3's ───────────────────────── */
  {
    const decideCode = codeOf(decide);
    assert.match(decideCode, /resolveGovernanceAuthority\(tenant, deps\)/, "the second key uses the resolver");
    assert.equal(
      TWO_KEY_INVARIANT.key2ResolvedBy,
      "resolveGovernanceAuthority",
      "the contract names the one resolver",
    );
    for (const forbidden of [
      "activeDelegationsSql",
      "decision_records",
      "bootstrap = true",
      "roleId ===",
      "roles.type",
    ]) {
      assert.ok(
        !decideCode.includes(forbidden),
        `I1.2 must not re-derive authority itself — found ${forbidden}`,
      );
    }
    /* Authority must be resolved BEFORE any success path. */
    const authorityAt = decideCode.indexOf("resolveGovernanceAuthority");
    const writeAt = decideCode.indexOf("writeGovernanceDecisionWithin");
    assert.ok(authorityAt > 0 && writeAt > authorityAt, "authority is resolved before writing");
  }

  /* ── 2. No role-band shortcut anywhere in the feature ────────────────────── */
  {
    assert.ok(
      !/KNOWLEDGE_AUTHOR_ROLE_TYPES|PROVIDER_CONTROL_ROLE_TYPES/.test(featureCode),
      "I1.2 must not borrow another domain's role band as authority",
    );
    /* Those bands exist and are real; I1.2 simply never reads them. */
    assert.ok(KNOWLEDGE_AUTHOR_ROLE_TYPES.size > 0);
    for (const band of ["owner", "director", "operator", "auditor"]) {
      assert.ok(
        !new RegExp(`["']${band}["']`).test(codeOf(decide)),
        `the second key must not consult the ${band} band`,
      );
    }
  }

  /* ── 3. I1.2 creates NOTHING that belongs to I2 or to Session authority ──── */
  {
    for (const token of [
      "memberships",
      "insert(memberships)",
      "insertSessionContext",
      "userSessionContexts",
      "user_session_contexts",
      "issueLocalSession",
      "setSessionCookie",
      "SESSION_COOKIE_NAME",
      "insert(roles)",
      "membershipAuthorizations",
    ]) {
      assert.ok(
        !featureCode.includes(token),
        `I1.2 must not reference ${token} — that is another authority's`,
      );
    }
    /* Structural, not merely absent: the modules are not imported at all. */
    assert.ok(
      !/from "@\/db\/schema\/(membership|membership-authorization|user-session-context|role)"/.test(
        featureCode,
      ),
      "I1.2 must not import the tables it must never write",
    );
    assert.ok(
      !/session-service\.server|request-session\.server|session-cookie/.test(featureCode),
      "I1.2 must not reach Session authority at all",
    );
  }

  /* ── 4. Identity and Credential writes go THROUGH their owning authorities ── */
  {
    const completeCode = codeOf(complete);
    assert.match(completeCode, /insertLocalIdentity\(/, "Identity authority creates the human");
    assert.match(
      completeCode,
      /establishFirstPasswordCredential\(tx, identity\.authIdentityId, password, now\)/,
      "Credential authority BOTH hashes and persists — the plaintext goes in, an id comes back",
    );
    /*
     * And the derived material never crosses this boundary. If this module ever named the stored
     * secret it would become a fourth file in D1's confinement set, which is the exact leak that
     * rule exists to prevent.
     */
    assert.ok(
      !/hashPassword|\.salt\b|derivedKey/.test(featureCode),
      "I1.2 must never hold derived credential material",
    );
    /* I1.2 never inserts into those tables itself. */
    for (const forbidden of ["insert(users)", "insert(authIdentities)", "insert(authCredentials)"]) {
      assert.ok(!featureCode.includes(forbidden), `I1.2 must not ${forbidden} directly`);
    }
    assert.ok(
      !/from "@\/db\/schema\/(user|auth-identity|auth-credential)"/.test(featureCode),
      "I1.2 must not import the identity or credential tables",
    );

    /* The identity writer is the ONLY place in src/ that inserts users / auth_identities. */
    const inserters = collect("src").filter((file) => {
      if (file === IDENTITY_REPO) return false;
      const src = codeOf(read(file));
      return /\.insert\(\s*users\s*\)|\.insert\(\s*authIdentities\s*\)/.test(src);
    });
    assert.deepEqual(
      inserters, [],
      "only the identity repository may create a user or an auth identity",
    );
  }

  /* ── 5. The development credential path stays quarantined ───────────────── */
  {
    assert.ok(
      !/provision-dev-credential|scripts\//.test(featureCode),
      "I1.2 must never import or reference the development credential tooling",
    );
    assert.ok(
      !/insert into auth_credentials/i.test(featureCode),
      "I1.2 must not duplicate the dev script's raw SQL",
    );
    /* The dev tool still refuses a non-local database, unchanged by this phase. */
    const dev = read("scripts/lib/provision-dev-credential.ts");
    assert.match(dev, /assertLocalDatabaseUrl/, "the dev tool still refuses remote databases");
  }

  /* ── 6. No mail, no SSO, no MFA, no recovery, no execution reach ─────────── */
  {
    /*
     * Module and API names, not English words. An earlier version of this list matched `deliver`
     * and fired on `deliveryLimitation` — a contract constant whose whole job is to state that
     * delivery does NOT exist. Asserting against prose would have made the honest note a violation.
     */
    for (const forbidden of [
      "nodemailer", "smtp", "resend", "sendgrid", "postmark", "mailgun", "aws-sdk",
      "sendMail", "sendInvitation", "sendEmail",
      "oidc", "saml", "passkey", "webauthn", "totp", "mfaVerified",
      "resetPassword", "recoverAccount",
      "computer-use", "terminal", "browserExecution",
      "knowledgeNodes", "knowledge_nodes",
      "providerConnectivityControls", "executions",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(runtimeCode),
        `I1.2 must not reference ${forbidden}`,
      );
    }
    /* The absence of delivery is STATED, which is the opposite of implementing it. */
    assert.match(TWO_KEY_INVARIANT.deliveryLimitation, /Hebun has no mail runtime/);
  }

  /* ── 7. NO SECOND SECRET, and no credential material in the artifact ─────── */
  {
    /* The credential-secret confinement test owns `secret_hash`; this asserts the artifact side. */
    assert.ok(
      !/secretHash|secret_hash|\bsalt\b/.test(codeOf(schema)),
      "the enrollment artifact must carry no credential material",
    );
    assert.ok(
      !/password/i.test(codeOf(schema)),
      "the enrollment artifact must not mention a password at all",
    );
    /*
     * The raw continuation reference is returned to the bearer, never persisted. Asserted against
     * the EXACT `.values({...})` argument, captured non-greedily — an earlier greedy version ran
     * past the insert and matched the return statement, which was a false positive.
     */
    const valuesArg = codeOf(start).match(
      /\.insert\(identityEnrollmentRequests\)\s*\.values\(([\s\S]*?)\)\s*\.returning/,
    );
    assert.ok(valuesArg, "Act 1 inserts the ceremony row");
    assert.match(valuesArg![1]!, /continuationHash,/, "Act 1 stores the digest");
    assert.ok(
      !/continuationReference/.test(valuesArg![1]!),
      "Act 1 must never store the raw continuation reference",
    );
    /* Domain separation is a constant, not a caller-supplied label. */
    const digest = codeOf(read(DIGEST));
    assert.match(digest, /const ENROLLMENT_CONTINUATION_LABEL = "/, "the label is a constant");
    assert.match(digest, /createHmac\("sha256"/, "the same primitive the session digest uses");
    assert.ok(
      !/process\.env/.test(digest),
      "the digest module reads no environment secret of its own",
    );
  }

  /* ── 8. Act 1 creates nothing global; Act 2 creates nothing at all ───────── */
  {
    const startCode = codeOf(start);
    assert.match(startCode, /\.insert\(identityEnrollmentRequests\)/, "Act 1 writes the ceremony row");
    assert.ok(
      !/\.insert\((users|authIdentities|authCredentials|memberships)\)/.test(startCode),
      "Act 1 must create nothing global",
    );
    const decideCode = codeOf(decide);
    assert.ok(
      !/\.insert\((users|authIdentities|authCredentials|memberships)\)/.test(decideCode),
      "Act 2 grants permission; it establishes nothing",
    );
    assert.match(
      decideCode,
      /eq\(identityEnrollmentRequests\.status, "pending"\)/,
      "Act 2's transition is conditional on the ceremony still being pending",
    );
    assert.match(
      codeOf(complete),
      /eq\(identityEnrollmentRequests\.status, "approved"\)/,
      "Act 3's completion is conditional on the ceremony being approved",
    );
  }

  /* ── 9. Expiry is a PREDICATE, never a status read ───────────────────────── */
  {
    for (const [label, source] of [["Act 1", start], ["Act 3", complete]] as const) {
      assert.match(
        codeOf(source),
        /[Ee]xpiresAt\.getTime\(\) <= now\.getTime\(\)/,
        `${label} must compare expiry against the clock, not trust invitation status`,
      );
    }
    assert.ok(
      !/status === "expired"|'expired'/.test(featureCode),
      "nothing writes invitation_status='expired', so nothing may rely on reading it",
    );
  }

  /* ── 10. Governance vocabulary: one new domain, NO new decision type ─────── */
  {
    assert.equal(IDENTITY_ENROLLMENT_DOMAIN, "identity-enrollment");
    assert.equal(IDENTITY_ENROLLMENT_SUBJECT_TYPE, "identity_enrollment_request");
    assert.equal(IDENTITY_ENROLLMENT_APPROVE_TYPE, "approve");
    assert.equal(IDENTITY_ENROLLMENT_REJECT_TYPE, "reject");
    assert.ok(GOVERNANCE_AUDIT_ACTIONS.includes(IDENTITY_ENROLLMENT_APPROVED_ACTION));
    assert.ok(GOVERNANCE_AUDIT_ACTIONS.includes(IDENTITY_ENROLLMENT_REJECTED_ACTION));
    /* Exactly one governance_domain value was added, and no decision type. */
    const enums = read("src/db/schema/_enums.ts");
    assert.match(enums, /"identity-enrollment",/);
    const decisionTypes = enums.match(/governanceDecisionTypeEnum = pgEnum\([\s\S]*?\]\);/)![0];
    assert.ok(
      !/identity/i.test(decisionTypes),
      "no identity-specific decision type was added — approve and reject sufficed",
    );
  }

  /* ── 11. Local identity coordinates match the seed exactly ───────────────── */
  {
    assert.equal(LOCAL_IDENTITY_PROVIDER, "local");
    assert.equal(LOCAL_IDENTITY_ISSUER, "hebun-local");
    assert.equal(localIdentitySubject("ada@example.com"), "local:ada@example.com");
    const seed = read("scripts/r1-seed.mjs");
    assert.match(seed, /'local', 'hebun-local'/, "the seed writes the same coordinates");
    assert.match(seed, /local:\$\{tenant\.email\}|`local:/, "and derives subject from the email");
  }

  /* ── 12. Schema invariants exist as DATABASE constraints, not hopes ──────── */
  {
    for (const constraint of [
      "identity_enrollment_requests_one_live_per_invitation_uq",
      "identity_enrollment_requests_continuation_uq",
      "identity_enrollment_requests_decision_uq",
      "identity_enrollment_requests_identity_uq",
      "identity_enrollment_requests_tenant_invitation_fk",
      "identity_enrollment_requests_approved_chk",
      "identity_enrollment_requests_rejected_chk",
      "identity_enrollment_requests_completed_chk",
      "identity_enrollment_requests_human_approver_chk",
      "invitations_tenant_id_id_uq",
    ]) {
      assert.ok(
        schema.includes(constraint) || read("src/db/schema/invitation.ts").includes(constraint),
        `schema must declare ${constraint}`,
      );
      assert.ok(migration.includes(constraint), `migration must create ${constraint}`);
    }
    /* The companion uniqueness must be created BEFORE the composite FK that references it. */
    assert.ok(
      migration.indexOf("invitations_tenant_id_id_uq") <
        migration.indexOf("identity_enrollment_requests_tenant_invitation_fk"),
      "the referenced unique constraint must exist before the foreign key that needs it",
    );
  }

  /* ── 13. MIGRATION SCOPE: exactly the four authorized changes ────────────── */
  {
    for (const destructive of [
      /\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT|SCHEMA|DATABASE)\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bTRUNCATE\b/i,
      /\bCASCADE\b/i,
      /\bRENAME\s+(TO|COLUMN|CONSTRAINT)\b/i,
      /\bALTER\s+COLUMN\b/i,
    ]) {
      assert.ok(
        !destructive.test(migration),
        `the I1.2 migration must be purely additive — matched ${destructive}`,
      );
    }

    /* B-4 IS ABSENT, UNDER EVERY NAME IT COULD HAVE WORN. */
    assert.ok(
      !/ALTER TABLE "auth_identities"/.test(migration),
      "the I1.2 migration must not modify auth_identities in any way",
    );
    for (const rejected of [
      "verification_source",
      "verification_method",
      "verification_reason",
      "verification_provenance",
      "enrollment_source",
      "verified_by",
    ]) {
      assert.ok(!migration.includes(rejected), `B-4 was rejected — ${rejected} must not exist`);
      assert.ok(
        !read("src/db/schema/auth-identity.ts").includes(rejected),
        `B-4 was rejected — ${rejected} must not appear on auth_identities`,
      );
    }

    /* Only these tables may be altered, and only these types created. */
    const alteredTables = [...migration.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(
      [...new Set(alteredTables)].sort(),
      ["identity_enrollment_requests", "invitations"],
      "the migration alters only the new table and the invitation companion uniqueness",
    );
    const createdTypes = [...migration.matchAll(/CREATE TYPE "public"\."([a-z_]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(createdTypes, ["identity_enrollment_status"]);
    const createdTables = [...migration.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map((m) => m[1]!);
    assert.deepEqual(createdTables, ["identity_enrollment_requests"]);
    const addedEnumValues = [...migration.matchAll(/ADD VALUE '([a-z-]+)'/g)].map((m) => m[1]!);
    assert.deepEqual(addedEnumValues, ["identity-enrollment"]);

    /*
     * Exactly one migration file was added by this phase.
     *
     * Stated against THIS phase's boundary rather than against a global count. Filenames are
     * timestamp-prefixed, so a lexical comparison is chronological: everything at or before I1.2's
     * own migration is the world as it stood when I1.2 closed. A later authorized phase adding its
     * own migration must not falsify a claim that was never about it.
     */
    const files = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
    assert.equal(files.filter((f) => f.includes("i1_2")).length, 1);
    const throughI12 = files.filter((f) => f <= "20260812130555_i1_2_identity_enrollment.sql");
    assert.equal(throughI12.length, 23, "22 existing migrations plus exactly this phase's one");
  }

  /* ── 14. The stated non-effects are the real ones ────────────────────────── */
  {
    for (const claim of [
      "does not create a membership",
      "does not issue any session",
      "does not grant Governance authority",
      "does not send anything to anyone",
      "does not verify that the human controls the invited email address",
    ]) {
      assert.ok(
        IDENTITY_ENROLLMENT_NON_EFFECTS.includes(claim),
        `the contract must state: ${claim}`,
      );
    }
    /* The delivery limitation is stated, not hidden. */
    assert.match(TWO_KEY_INVARIANT.deliveryLimitation, /no mail runtime/);
    assert.match(TWO_KEY_INVARIANT.deliveryLimitation, /does not eliminate it/);
    assert.ok(TWO_KEY_INVARIANT.key1ProvesNot.includes("email ownership"));
    assert.ok(TWO_KEY_INVARIANT.key1ProvesNot.includes("Governance authority"));
    assert.equal(TWO_KEY_INVARIANT.neitherAloneEstablishes, "an active Hebun identity or a credential");
    assert.ok(MIN_ENROLLMENT_PASSWORD_LENGTH >= 12, "a first password has a real minimum");
  }

  /* ── 15. The client supplies no authority-bearing value ──────────────────── */
  {
    /* Every input shape is closed, and none of these names appears in one. */
    const contracts = codeOf(read(CONTRACTS));
    const inputShapes = [start, decide, complete]
      .map((s) => codeOf(s))
      .join("\n")
      .match(/input:\s*\{[\s\S]*?\},/g)!
      .join("\n");
    for (const forged of [
      "tenantId",
      "actorId",
      "actorType",
      "decisionId",
      "userId",
      "authIdentityId",
      "roleId",
      "membershipId",
      "status",
    ]) {
      assert.ok(
        !new RegExp(`readonly ${forged}\\b`).test(inputShapes),
        `the client must not be able to supply ${forged}`,
      );
    }
    assert.ok(
      !/readonly (identityStatus|credentialStatus|verifiedAt|verificationStatus)/.test(contracts),
      "the client must not be able to supply any status or verification field",
    );
  }

  /* ── 16. Server-only, and unreachable from a client bundle ───────────────── */
  {
    for (const file of [START, DECIDE, COMPLETE, DIGEST]) {
      assert.ok(file.endsWith(".server.ts"), `${file} must be a server module by name`);
      assert.match(
        read(file),
        /typeof window !== "undefined"|Server-only/,
        `${file} must refuse a browser runtime`,
      );
    }
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter((file) =>
      /^\s*["']use client["']/m.test(read(file)),
    );
    assert.ok(clientFiles.length > 0, "there really are client components to check");
    for (const file of clientFiles) {
      assert.ok(
        !/identity-enrollment/.test(read(file)),
        `${file}: a client component must not import the enrollment authority`,
      );
    }
  }

  console.log("PASS i1.2 boundaries and firewall");
}

main();
