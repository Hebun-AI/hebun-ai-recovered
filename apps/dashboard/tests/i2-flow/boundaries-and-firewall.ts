/*
 * I2 — structural boundaries around Human Onboarding Runtime.
 *
 * These prove claims about what does NOT exist: no second Governance resolver, no user/identity/
 * credential/role writes, no session issuance, no mail, no SSO, no dev-credential reach, no schema
 * change, and no surface wording that implies a delivery Hebun cannot perform.
 *
 * Runtime behaviour lives in `onboarding-postgres.ts` and `onboarding-concurrency-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  CONSUMPTION_SEMANTICS,
  DELIVERY_REALITY,
  INVITATION_ISSUED_ACTION,
  INVITATION_LIFETIME_HOURS,
  MEMBERSHIP_CREATED_ACTION,
  ONBOARDING_ENTITY_TYPE,
  ONBOARDING_MEMBERSHIP_ROLE_TYPE,
  ONBOARDING_NON_EFFECTS,
  TENANT_ACCESS_REALITY,
} from "../../src/features/human-onboarding/contracts";
import { ONBOARDING_AUDIT_BOUNDARY } from "../../src/features/governance-audit/human-onboarding-audit.server";
import { ELIGIBLE_ROLE_TYPE_LIST } from "../../src/features/membership-authority/contracts";
import { KNOWLEDGE_AUTHOR_ROLE_TYPES } from "../../src/features/knowledge/knowledge-write-authority.server";
import { PROVIDER_CONTROL_ROLE_TYPES } from "../../src/features/heby-provider-ops/provider-authority.server";

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

const ISSUE = "src/features/human-onboarding/issue-invitation.server.ts";
const ACCEPT = "src/features/human-onboarding/accept-invitation.server.ts";
const CONTRACTS = "src/features/human-onboarding/contracts.ts";
const AUDIT = "src/features/governance-audit/human-onboarding-audit.server.ts";
/**
 * The EXECUTABLE surface. `contracts.ts` is excluded from capability scans on purpose: its
 * `ONBOARDING_NON_EFFECTS` list names Computer Use and terminal in order to state that they do not
 * happen, and a scan that treated an honest denial as a violation would push the phase toward
 * hiding its own limits.
 */
const RUNTIME_FILES = [ISSUE, ACCEPT, AUDIT];

function main(): void {
  const issue = read(ISSUE);
  const accept = read(ACCEPT);
  const runtimeCode = RUNTIME_FILES.map((f) => codeOf(read(f))).join("\n");
  const featureCode = [...RUNTIME_FILES, CONTRACTS].map((f) => codeOf(read(f))).join("\n");

  /* ── 1. ONE authority resolver, and it is G2/G3's ───────────────────────── */
  {
    const issueCode = codeOf(issue);
    assert.match(issueCode, /resolveGovernanceAuthority\(tenant, deps\)/, "issuance uses the resolver");
    for (const forbidden of ["activeDelegationsSql", "bootstrap = true", "decisionRecords"]) {
      assert.ok(
        !issueCode.includes(forbidden),
        `I2 must not re-derive Governance authority itself — found ${forbidden}`,
      );
    }
    const authorityAt = issueCode.indexOf("resolveGovernanceAuthority");
    const writeAt = issueCode.indexOf(".insert(invitations)");
    assert.ok(authorityAt > 0 && writeAt > authorityAt, "authority is resolved before writing");
    /* Acceptance is authenticated by CREDENTIAL, and must not consult Governance at all. */
    assert.ok(
      !codeOf(accept).includes("resolveGovernanceAuthority"),
      "acceptance is not a Governance act and must not resolve Governance authority",
    );
  }

  /* ── 2. No role-band shortcut ───────────────────────────────────────────── */
  {
    assert.ok(
      !/KNOWLEDGE_AUTHOR_ROLE_TYPES|PROVIDER_CONTROL_ROLE_TYPES/.test(featureCode),
      "I2 must not borrow another domain's role band as authority",
    );
    assert.ok(KNOWLEDGE_AUTHOR_ROLE_TYPES.size > 0 && PROVIDER_CONTROL_ROLE_TYPES.size > 0);
    for (const band of ["owner", "director", "operator", "auditor"]) {
      assert.ok(
        !new RegExp(`["']${band}["']`).test(runtimeCode),
        `I2 must never name the ${band} band`,
      );
    }
    /* The only band it may produce is I1's, not a second list. */
    assert.equal(ONBOARDING_MEMBERSHIP_ROLE_TYPE, "member");
    assert.deepEqual([...ELIGIBLE_ROLE_TYPE_LIST], [ONBOARDING_MEMBERSHIP_ROLE_TYPE]);
  }

  /* ── 3. I2 creates NOTHING that belongs to Identity, Credential or Session ─ */
  {
    for (const token of [
      "insert(users)",
      "insert(authIdentities)",
      "insert(authCredentials)",
      "insert(roles)",
      "insertLocalIdentity",
      "insertPasswordCredential",
      "establishFirstPasswordCredential",
      "hashPassword",
      "insertSessionContext",
      "userSessionContexts",
      "issueLocalSession",
      "setSessionCookie",
      "SESSION_COOKIE_NAME",
      "identityEnrollmentRequests",
    ]) {
      assert.ok(
        !featureCode.includes(token),
        `I2 must not reference ${token} — that is another authority's`,
      );
    }
    assert.ok(
      !/from "@\/db\/schema\/(user|auth-identity|auth-credential|identity-enrollment|user-session-context)"/.test(
        featureCode,
      ),
      "I2 must not import the tables it must never write",
    );
    assert.ok(
      !/session-service\.server|request-session\.server|session-cookie/.test(featureCode),
      "I2 must not reach Session authority at all",
    );
    /* It may READ the identity resolver — that is how it authenticates — but write nothing there. */
    assert.match(
      codeOf(accept),
      /findActiveLocalIdentityByEmail\(db, email\)/,
      "acceptance resolves the identity through Identity authority's own reader",
    );
  }

  /* ── 4. The two tables I2 writes, and only those ─────────────────────────── */
  {
    const writes = [
      ...codeOf(issue).matchAll(/\.(insert|update)\(([A-Za-z]+)\)/g),
      ...codeOf(accept).matchAll(/\.(insert|update)\(([A-Za-z]+)\)/g),
    ].map((m) => m[2]!);
    assert.deepEqual(
      [...new Set(writes)].sort(),
      ["invitations", "memberships", "membershipAuthorizations"].sort(),
      "I2 writes exactly: the invitation, the membership, and the authorization's consumption",
    );
  }

  /* ── 5. The development credential path stays quarantined ───────────────── */
  {
    assert.ok(
      !/scripts\//.test(featureCode),
      "I2 must never reference the development tooling tree",
    );
    assert.ok(
      !/insert into auth_credentials|insert into users/i.test(featureCode),
      "I2 must not duplicate any raw identity or credential SQL",
    );
  }

  /* ── 6. No mail, no SSO, no MFA, no recovery, no execution reach ─────────── */
  {
    for (const forbidden of [
      "nodemailer", "smtp", "resend", "sendgrid", "postmark", "mailgun", "aws-sdk",
      "sendMail", "sendInvitation", "sendEmail", "notify",
      "oidc", "saml", "passkey", "webauthn", "totp", "mfaVerified",
      "resetPassword", "recoverAccount",
      "computer-use", "terminal", "browserExecution", "childProcess", "execFileSync", "spawnSync",
      "knowledgeNodes", "knowledge_nodes",
      "providerConnectivityControls", "executions",
      "permissions", "rolePermissions",
    ]) {
      assert.ok(
        !new RegExp(forbidden, "i").test(runtimeCode),
        `I2 must not reference ${forbidden}`,
      );
    }
  }

  /* ── 7. The capability is minted, digested and never stored in plaintext ─── */
  {
    const issueCode = codeOf(issue);
    assert.match(issueCode, /randomBytes\(32\)/, "real entropy, from the trusted source");
    assert.match(issueCode, /digestInvitationToken\(capability, deps\.digestKey\)/, "reuses the existing primitive");
    /* Asserted against the EXACT `.values({…})` argument, captured non-greedily. */
    const valuesArg = issueCode.match(
      /\.insert\(invitations\)\s*\.values\(([\s\S]*?)\)\s*\.returning/,
    );
    assert.ok(valuesArg, "issuance inserts the invitation");
    assert.match(valuesArg![1]!, /tokenHash,/, "the digest is stored");
    assert.ok(
      !/\bcapability\b/.test(valuesArg![1]!),
      "the plaintext capability must never be stored",
    );
    /* `last_sent_at` and `send_count` describe a delivery Hebun cannot perform. */
    for (const claim of ["lastSentAt", "sendCount"]) {
      assert.ok(
        !valuesArg![1]!.includes(claim),
        `${claim} must stay untouched — writing it would claim a delivery that did not happen`,
      );
    }
    /* No new token system was invented. */
    assert.ok(
      !/createHmac|randomBytes\(64\)|jwt|jsonwebtoken/.test(codeOf(accept)),
      "acceptance must reuse the established digest primitive, not invent another",
    );
  }

  /* ── 8. Expiry is a PREDICATE, never a status read ───────────────────────── */
  {
    assert.match(
      codeOf(accept),
      /expiresAt\.getTime\(\) <= now\.getTime\(\)/,
      "acceptance compares expiry against the clock",
    );
    assert.match(
      codeOf(accept),
      /expiresAt\} > \$\{now\.toISOString\(\)\}/,
      "and the conditional update repeats it inside the transaction",
    );
    assert.ok(
      !/=== "expired"|'expired'/.test(featureCode),
      "nothing writes invitation_status='expired', so nothing may rely on reading it",
    );
  }

  /* ── 9. THE IDENTITY BINDING EXISTS AND IS NOT OPTIONAL ──────────────────── */
  {
    const acceptCode = codeOf(accept);
    assert.match(
      acceptCode,
      /identity\.email\.trim\(\)\.toLowerCase\(\) !== invitation\.normalizedEmail/,
      "the invited human and the authenticated human must be compared",
    );
    /* The comparison happens AFTER credential verification, so a mismatch costs the same. */
    const verifyAt = acceptCode.indexOf("verifyPasswordCredential");
    const bindAt = acceptCode.indexOf("!== invitation.normalizedEmail");
    assert.ok(verifyAt > 0 && bindAt > verifyAt, "binding is checked after the password, never before");
    /* Every authentication-shaped failure returns the same reason. */
    const notAcceptable = (acceptCode.match(/refused\("not-acceptable"\)/g) ?? []).length;
    assert.ok(notAcceptable >= 4, "unknown human, no credential, wrong password and wrong human agree");
    /* And every branch spends the same work. */
    assert.ok(
      (acceptCode.match(/spendEquivalentCredentialWork/g) ?? []).length >= 3,
      "timing must not distinguish the refusal causes",
    );
    /* No second normalization implementation. */
    assert.ok(
      !/normalizeTargetEmail|function normalize/.test(acceptCode),
      "I2 must not implement a second email normalization",
    );
  }

  /* ── 10. Client input is closed ──────────────────────────────────────────── */
  {
    const inputShapes = [issue, accept]
      .map((s) => codeOf(s))
      .join("\n")
      .match(/input:\s*\{[\s\S]*?\},/g)!
      .join("\n");
    for (const forged of [
      "tenantId", "roleId", "membershipId", "userId", "authIdentityId",
      "actorId", "actorType", "status", "acceptedAt", "consumedAt", "expiresAt",
    ]) {
      assert.ok(
        !new RegExp(`readonly ${forged}\\b`).test(inputShapes),
        `the client must not be able to supply ${forged}`,
      );
    }
    /* Exactly what a client may send. */
    assert.match(inputShapes, /readonly membershipAuthorizationId: string/);
    assert.match(inputShapes, /readonly capability: string/);
    assert.match(inputShapes, /readonly email: string/);
    assert.match(inputShapes, /readonly password: string/);
    /* The lifetime is a constant, not an input. */
    assert.equal(typeof INVITATION_LIFETIME_HOURS, "number");
    assert.ok(INVITATION_LIFETIME_HOURS > 0 && INVITATION_LIFETIME_HOURS <= 168);
  }

  /* ── 11. Every authority-bearing value is copied, never accepted ─────────── */
  {
    const issueCode = codeOf(issue);
    for (const copied of [
      "tenantId: authorization.tenantId",
      "normalizedEmail: authorization.normalizedEmail",
      "intendedRoleId: authorization.intendedRoleId",
      "inviterId: tenant.userId",
    ]) {
      assert.ok(issueCode.includes(copied), `issuance must copy ${copied}`);
    }
    const acceptCode = codeOf(accept);
    for (const copied of [
      "tenantId: invitation.tenantId",
      "userId: identity.userId",
      "roleId: invitation.intendedRoleId",
      "acceptedInvitationId: invitation.id",
    ]) {
      assert.ok(acceptCode.includes(copied), `acceptance must copy ${copied}`);
    }
  }

  /* ── 12. Conditional writes, not read-then-insert ────────────────────────── */
  {
    assert.match(
      codeOf(issue),
      /eq\(membershipAuthorizations\.status, "authorized"\)/,
      "consumption is predicated on the authorization still being live",
    );
    assert.match(
      codeOf(accept),
      /eq\(invitations\.status, "pending"\)/,
      "acceptance is predicated on the invitation still being pending",
    );
    for (const [label, code] of [["issuance", codeOf(issue)], ["acceptance", codeOf(accept)]] as const) {
      assert.match(code, /length === 0\) throw new/, `${label} aborts when its conditional write matched nothing`);
    }
  }

  /* ── 13. NO SCHEMA CHANGE. I2's migration delta is zero. ─────────────────── */
  {
    /*
     * Stated against I2's own boundary, not a global count. Filenames are timestamp-prefixed, so a
     * lexical comparison is chronological: the 23 migrations that existed when I2 closed must all
     * still be there, and none of them may be I2's. A later authorized phase adding its own
     * migration must not falsify a claim that was never about it.
     */
    const files = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
    const throughI2 = files.filter((f) => f <= "20260812130555_i1_2_identity_enrollment.sql");
    assert.equal(throughI2.length, 23, "the 23 migrations that existed when I2 closed are intact");
    assert.equal(
      files.filter((f) => /_i2_|onboard/i.test(f)).length, 0,
      "I2 adds no migration — no I2-named migration exists, then or since",
    );
    /* And no I2 file defines a table. */
    for (const file of [...RUNTIME_FILES, CONTRACTS]) {
      assert.ok(!codeOf(read(file)).includes("pgTable("), `${file} must not define a table`);
    }
  }

  /* ── 14. Audit uses the declared sibling, and claims no delivery ─────────── */
  {
    assert.equal(ONBOARDING_AUDIT_BOUNDARY.entityType, ONBOARDING_ENTITY_TYPE);
    assert.equal(ONBOARDING_AUDIT_BOUNDARY.recordsFailedAcceptance, false);
    assert.equal(ONBOARDING_AUDIT_BOUNDARY.recordsGovernanceDecisions, false);
    assert.equal(INVITATION_ISSUED_ACTION, "onboarding.invitation.issued");
    assert.equal(MEMBERSHIP_CREATED_ACTION, "onboarding.membership.created");
    /* The audit writer states the delivery truth in the row itself. */
    assert.match(codeOf(read(AUDIT)), /delivered: false/, "history must not read as 'we emailed them'");
    /* Neither runtime module reaches the sink directly. */
    for (const file of [ISSUE, ACCEPT]) {
      assert.ok(
        !read(file).includes('from "@/db/schema/audit-log"'),
        `${file} must go through the declared audit owner`,
      );
    }
    /* No new decision vocabulary: I2 records no Governance decision at all. */
    assert.ok(
      !/writeGovernanceDecisionWithin|decisionRecords|governanceSessions/.test(featureCode),
      "I2 makes no Governance decision — I1 already made it",
    );
  }

  /* ── 15. Issuance is not delivery, and the contract says so ──────────────── */
  {
    assert.equal(DELIVERY_REALITY.delivered, false);
    assert.match(DELIVERY_REALITY.deliveryOwner, /no mail runtime/);
    assert.match(DELIVERY_REALITY.operatorObligation, /hand this capability to the intended human/);
    assert.ok(
      ONBOARDING_NON_EFFECTS.includes("does not send the invitation anywhere"),
      "the contract must state that nothing is sent",
    );
    /* No wording anywhere in the feature claims an email was sent. */
    assert.ok(
      !/email(ed)? (sent|delivered)|invited by email|we sent/i.test(featureCode),
      "no I2 text may imply a delivery that did not happen",
    );
  }

  /* ── 16. Consumption meaning is preserved, not redefined ─────────────────── */
  {
    assert.equal(CONSUMPTION_SEMANTICS.consumedAt, "invitation issuance");
    assert.match(CONSUMPTION_SEMANTICS.reInviteRequires, /new Governance decision/);
    /*
     * Acceptance READS the authorization's provenance and must never WRITE it. Asserted as two
     * plain claims rather than one clever regex: it performs no update on the table, and it never
     * assigns the consumption columns.
     */
    const acceptCode = codeOf(accept);
    assert.ok(
      !/\.update\(membershipAuthorizations\)/.test(acceptCode),
      "acceptance must not write the authorization at all",
    );
    assert.ok(
      !/consumedAt:|consumedByInvitationId:/.test(acceptCode),
      "acceptance must never assign the consumption columns — issuance already spent it",
    );
    assert.match(
      acceptCode,
      /eq\(membershipAuthorizations\.consumedByInvitationId, invitation\.id\)/,
      "it reads provenance through the invitation the authorization already names",
    );
    /* And issuance is where consumption actually happens. */
    assert.match(codeOf(issue), /consumedByInvitationId: invitationId/);
  }

  /* ── 17. The tenant-access limitation is stated, not hidden ──────────────── */
  {
    /*
     * These assertions were inverted when Tenant Selection Authority closed. They asserted the I2
     * limitation ("NOT reachable"); sign-in now asks instead of guessing, so the constant states the
     * new truth and this test states it too. The invariant was not relaxed — the world changed.
     */
    assert.match(TENANT_ACCESS_REALITY.firstMembership, /reachable/);
    assert.match(TENANT_ACCESS_REALITY.additionalMembership, /reachable — a human with several/);
    assert.match(TENANT_ACCESS_REALITY.chosenBy, /Tenant Selection Authority/);
    assert.match(TENANT_ACCESS_REALITY.stillNotImplemented, /already-authorized session/);
    assert.ok(
      ONBOARDING_NON_EFFECTS.includes("does not choose which workspace you enter — sign-in asks you that"),
      "onboarding must still disclaim the choice; it belongs to Session authority",
    );
    /* And no tenant switcher was smuggled in. */
    assert.ok(
      !/tenantSwitch|switchTenant|selectTenant|activeTenantId:/.test(featureCode),
      "I2 must not implement tenant selection",
    );
  }

  /* ── 18. Server-only, and unreachable from a client bundle ───────────────── */
  {
    for (const file of [ISSUE, ACCEPT, AUDIT]) {
      assert.ok(file.endsWith(".server.ts"), `${file} must be a server module by name`);
    }
    for (const file of [ISSUE, ACCEPT]) {
      assert.match(read(file), /typeof window !== "undefined"/, `${file} must refuse a browser runtime`);
    }
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter((file) =>
      /^\s*["']use client["']/m.test(read(file)),
    );
    assert.ok(clientFiles.length > 0, "there really are client components to check");
    /*
     * The rule that matters is that no SERVER module reaches a client bundle. `contracts.ts` is
     * pure types and frozen values — the surface imports it precisely so its wording cannot drift
     * from the code — and it is asserted below to contain no I/O, no database and no authority.
     */
    for (const file of clientFiles) {
      const src = read(file);
      for (const serverModule of [
        "human-onboarding/issue-invitation.server",
        "human-onboarding/accept-invitation.server",
        "governance-audit/human-onboarding-audit.server",
      ]) {
        assert.ok(
          !src.includes(serverModule),
          `${file}: a client component must not import ${serverModule}`,
        );
      }
    }
    {
      const contracts = codeOf(read(CONTRACTS));
      for (const forbidden of ["drizzle-orm", "@/db/", "node:crypto", "process.env", "async function"]) {
        assert.ok(
          !contracts.includes(forbidden),
          `contracts.ts must stay pure — found ${forbidden}`,
        );
      }
    }
  }

  /* ── 19. THE SURFACE CLAIMS NOTHING HEBUN CANNOT DO ─────────────────────── */
  {
    const CARD = "src/components/governance-authority/membership-authorization-card.tsx";
    const card = read(CARD);

    /* It extends the Governance workspace rather than inventing a second onboarding surface. */
    const surfaces = collect("src/app")
      .filter((f) => /page\.tsx$/.test(f))
      .filter((f) => read(f).includes("human-onboarding") || /issueInvitationAction/.test(read(f)));
    assert.deepEqual(surfaces, [], "no page imports onboarding directly; the card does, via the action");
    assert.match(card, /issueInvitationAction/, "issuance is offered on the existing authority card");

    /* NEVER a delivery claim. */
    for (const forbidden of [
      /email(ed)? sent/i,
      /invitation sent/i,
      /we(&rsquo;| )?ve emailed/i,
      /invited by email/i,
      /check your (inbox|email)/i,
      /sending/i,
    ]) {
      assert.ok(!forbidden.test(card), `the surface must not claim a delivery — matched ${forbidden}`);
    }
    /* Issued and delivered are rendered as different sentences, from frozen values. */
    assert.match(card, /DELIVERY_REALITY\.issued/);
    assert.match(card, /DELIVERY_REALITY\.deliveryOwner/);
    assert.match(card, /DELIVERY_REALITY\.operatorObligation/);
    assert.match(card, /Hebun sends nothing/, "the button's help text states it plainly");
    assert.match(card, /Issue onboarding capability/, "the verb describes what actually happens");

    /* Membership is not tenant selection — the card never promises access. */
    for (const forbidden of [/signed in as/i, /switch(ed)? to/i, /now (a member of|inside)/i]) {
      assert.ok(!forbidden.test(card), `the surface must not imply tenant access — matched ${forbidden}`);
    }

    /* ACCESSIBILITY: real label, no colour-only state, alert on refusal, status on success. */
    assert.match(card, /<label className="block text-xs font-medium" htmlFor=\{capabilityId\}>/);
    assert.match(card, /aria-describedby=\{noticeId\}/, "the one-shot warning is programmatically tied");
    assert.match(card, /role="alert"/, "refusals are announced");
    assert.match(card, /role="status"/, "the successful transition is announced");
    assert.ok(
      !/className="[^"]*text-(green|red)-/.test(card),
      "state must be carried by words, not by raw colour utilities",
    );
    /* Every refusal the runtime can produce has operator wording. */
    const refusalKeys = [
      "unauthenticated", "no-governance-authority", "not-the-governance-authority",
      "authorization-unresolvable", "authorization-not-live", "role-not-eligible",
      "invitation-already-pending", "authorization-already-consumed", "persistence-unavailable",
    ];
    for (const key of refusalKeys) {
      assert.ok(
        new RegExp(`"${key}":|\\b${key}:`).test(card),
        `the surface must have wording for the ${key} refusal`,
      );
    }
    /* The capability is rendered into a readonly field, never into a link or a form post. */
    assert.match(card, /readOnly\s*\n?\s*value=\{capability\}/);
    assert.ok(!/href=\{capability|`\/accept\?/.test(card), "the capability never becomes a URL");
  }

  console.log("PASS i2 boundaries and firewall");
}

main();
