/*
 * Invitation revocation — structural boundaries.
 *
 * Every assertion here is a claim about what does NOT exist:
 *
 *   - no second invitation authority, and no second Governance resolver
 *   - no token rotation, no digest exposure, no invitation DELETE
 *   - no authorization resurrection — a consumed authorization stays consumed
 *   - no Governance decision, no new audit sink
 *   - no schema change and no dependency change
 *   - no mail, provider, execution or Computer Use reach
 *   - no surface wording that claims deletion, recovery, reset or resend
 *
 * Runtime behaviour lives in `revocation-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  INVITATION_REVOCATION_EFFECT,
  INVITATION_REVOCATION_NON_EFFECTS,
  INVITATION_REVOKED_ACTION,
  REVOCATION_REASON_COLUMN_LENGTH,
  REVOCATION_SEMANTICS,
} from "../../src/features/human-onboarding/contracts";
import { ONBOARDING_AUDIT_BOUNDARY } from "../../src/features/governance-audit/human-onboarding-audit.server";
import { JUSTIFICATION_LIMITS } from "../../src/features/governance-decision/contracts";

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

const REVOKE = "src/features/human-onboarding/revoke-invitation.server.ts";
const READ_SEAM = "src/features/human-onboarding/read-revocable-invitations.server.ts";
const CONTRACTS = "src/features/human-onboarding/contracts.ts";
const AUDIT = "src/features/governance-audit/human-onboarding-audit.server.ts";
const CARD = "src/components/governance-authority/membership-authorization-card.tsx";
const ACTIONS = "src/app/(dashboard)/governance/authority/actions.ts";

function main(): void {
  const revoke = read(REVOKE);
  const revokeCode = codeOf(revoke);
  const readSeam = read(READ_SEAM);
  const card = read(CARD);
  const actions = read(ACTIONS);

  /* ── 1. ONE INVITATION AUTHORITY, AND THIS IS INSIDE IT ─────────────────── */
  {
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((f) => /\.(insert|update|delete)\(invitations\)/.test(read(f)));
    assert.deepEqual(
      writers.sort(),
      [
        "src/features/human-onboarding/accept-invitation.server.ts",
        "src/features/human-onboarding/issue-invitation.server.ts",
        "src/features/human-onboarding/revoke-invitation.server.ts",
      ],
      "invitations are written by Human Onboarding and nowhere else",
    );
    /* Membership never became a second writer, and revocation did not become one either. */
    const membershipWriters = collect("src/features")
      .concat(collect("src/app"))
      .filter((f) => /\.insert\(memberships\)/.test(read(f)));
    assert.deepEqual(membershipWriters, [
      "src/features/human-onboarding/accept-invitation.server.ts",
    ]);
  }

  /* ── 2. NO INVITATION IS EVER DELETED ───────────────────────────────────── */
  {
    const deleters = collect("src/features")
      .concat(collect("src/app"))
      .filter((f) => /\.delete\(invitations\)/.test(codeOf(read(f))));
    assert.deepEqual(deleters, [], "a revoked invitation is not a deleted one");
    assert.match(REVOCATION_SEMANTICS.revokedIsNotDeleted, /remain/);
  }

  /* ── 3. NO TOKEN ROTATION, NO DIGEST EXPOSURE ───────────────────────────── */
  {
    for (const forbidden of ["tokenHash", "token_hash", "digestInvitationToken", "randomBytes"]) {
      assert.ok(
        !revokeCode.includes(forbidden),
        `revocation must not touch ${forbidden} — the digest is left exactly as issued`,
      );
    }
    assert.ok(
      !codeOf(readSeam).includes("tokenHash"),
      "the read seam must not surface the digest",
    );
    assert.match(REVOCATION_SEMANTICS.capabilityBecomes, /permanently unusable/);
  }

  /* ── 4. THE AUTHORIZATION IS NEVER RESURRECTED ──────────────────────────── */
  {
    /*
     * The single most important structural claim of this phase. Revocation READS the authorization
     * for provenance and must never write it: un-consuming it would erase the fact that a capability
     * really was issued, and would let one Governance decision produce two.
     */
    assert.ok(
      !/\.(update|insert|delete)\(membershipAuthorizations\)/.test(revokeCode),
      "revocation must not write membership_authorizations",
    );
    assert.match(
      revokeCode,
      /\.select\([\s\S]*?\)\s*\.from\(membershipAuthorizations\)/,
      "it reads the authorization for provenance only",
    );
    assert.match(REVOCATION_SEMANTICS.authorizationRemains, /consumed/);
    assert.match(REVOCATION_SEMANTICS.replacementRequires, /NEW Governance membership authorization/);
  }

  /* ── 5. ONE GOVERNANCE RESOLVER, AND NO GOVERNANCE DECISION ─────────────── */
  {
    assert.match(
      revoke,
      /resolveGovernanceAuthority/,
      "authority comes from the same G2/G3 resolver issuance uses",
    );
    for (const forbidden of [
      "writeGovernanceDecisionWithin",
      "recordGovernanceEventWithin",
      "decisionRecords",
      "governanceSessions",
      "roles.type",
      "authorityRank",
      "authorityScope",
      "permissions",
    ]) {
      assert.ok(
        !revokeCode.includes(forbidden),
        `revocation is not a Governance decision — found ${forbidden}`,
      );
    }
  }

  /* ── 6. THE SHARED AUDIT SINK IS REUSED, NOT DUPLICATED ─────────────────── */
  {
    assert.equal(ONBOARDING_AUDIT_BOUNDARY.recordsInvitationRevocation, true);
    assert.equal(ONBOARDING_AUDIT_BOUNDARY.entityType, "invitation");
    assert.equal(INVITATION_REVOKED_ACTION, "onboarding.invitation.revoked");
    assert.match(revoke, /recordInvitationRevokedWithin/);
    assert.ok(
      !revokeCode.includes("auditLog"),
      "an ordinary feature module may not reach the audit table directly",
    );
    /* The reason is NOT copied into history — the row owns it. */
    const audit = read(AUDIT);
    const revokedWriter = audit.slice(audit.indexOf("recordInvitationRevokedWithin"));
    assert.ok(
      !/reason/.test(codeOf(revokedWriter).split("export async function")[0] ?? ""),
      "the audit writer does not duplicate the human-authored reason",
    );
  }

  /* ── 7. TRANSACTION AND CONCURRENCY SHAPE ───────────────────────────────── */
  {
    assert.match(revokeCode, /db\.transaction\(/, "the transition and its audit commit together");
    assert.match(
      revokeCode,
      /eq\(invitations\.status, "pending"\)/,
      "the update is predicated on the row still being pending",
    );
    assert.match(revokeCode, /RevocationRaceLost/, "and a zero-row update aborts the transaction");
  }

  /* ── 8. A LAPSED INVITATION IS REVOCABLE, BY DESIGN ─────────────────────── */
  {
    /*
     * Eligibility must NOT consult `expires_at`. A lapsed invitation is exactly the case that
     * stranded the tenant/address slot in the incident, so gating on expiry would leave the original
     * defect open.
     */
    const eligibility = revokeCode.slice(0, revokeCode.indexOf("db.transaction"));
    assert.ok(
      !/expiresAt[\s\S]{0,40}return refused/.test(eligibility),
      "expiry must never be an eligibility gate",
    );
    assert.match(revokeCode, /wasAlreadyExpiredByClock/, "it is reported, not enforced");
    assert.match(REVOCATION_SEMANTICS.expiryStillNotMaterialized, /reads pending until revoked/);
  }

  /* ── 9. INPUT SURFACE: TWO THINGS, AND NOTHING AUTHORITATIVE ────────────── */
  {
    assert.match(
      revoke,
      /input: \{ readonly invitationId: string; readonly reason: string \}/,
      "the client supplies which invitation, and why",
    );
    for (const forbidden of ["input.tenantId", "input.email", "input.roleId", "input.actorId", "input.status"]) {
      assert.ok(!revokeCode.includes(forbidden), `a forged ${forbidden} has nowhere to arrive`);
    }
    assert.match(revokeCode, /tenant\.userId/, "the actor is resolved from the session");
    assert.match(revokeCode, /validateJustification/, "the reason uses the shared primitive");
    assert.equal(REVOCATION_REASON_COLUMN_LENGTH, 128);
    assert.ok(
      JUSTIFICATION_LIMITS.minimumLength <= REVOCATION_REASON_COLUMN_LENGTH,
      "a valid reason always has something to store",
    );
  }

  /* ── 10. SERVER-ONLY, AND OUT OF THE CLIENT BUNDLE ──────────────────────── */
  {
    for (const file of [REVOKE, READ_SEAM]) {
      assert.ok(file.endsWith(".server.ts"), `${file} must be a server module by name`);
      assert.match(read(file), /typeof window !== "undefined"/, `${file} must refuse a browser runtime`);
    }
    const clientFiles = [...collect("src/components"), ...collect("src/app")].filter((f) =>
      /^\s*["']use client["']/m.test(read(f)),
    );
    for (const file of clientFiles) {
      assert.ok(
        !read(file).includes("human-onboarding/revoke-invitation.server"),
        `${file}: a client component must not import the revocation authority`,
      );
    }
    /* The card reaches it only through the action. */
    assert.match(card, /revokeInvitationAction/);
    assert.match(actions, /revokeInvitation\(/);
  }

  /* ── 11. NO CAPABILITY, NO MAIL, NO PROVIDER, NO EXECUTION ──────────────── */
  {
    for (const file of [revokeCode, codeOf(readSeam)]) {
      for (const forbidden of [
        "nodemailer",
        "sendMail",
        "fetch(",
        "anthropic",
        "computer-use",
        "execution",
        "provider",
      ]) {
        assert.ok(!file.includes(forbidden), `revocation must not reach ${forbidden}`);
      }
    }
  }

  /* ── 12. THE SURFACE CLAIMS ONLY WHAT IS TRUE ───────────────────────────── */
  {
    assert.match(card, /Revoke onboarding capability/, "the verb describes what actually happens");
    /*
     * RENDERED WORDING, not prose. The card's own header NAMES "Delete", "Reset", "Recover token"
     * and "Resend" in order to say none of them is true, and a scan that treated an honest denial as
     * a violation would push the surface toward hiding what it deliberately is not.
     */
    const rendered = codeOf(card);
    for (const forbidden of [
      /delete (the )?invitation/i,
      /reset (the )?capability/i,
      /recover (the )?(token|capability)/i,
      /resend/i,
      /re-?issue automatically/i,
      /email(ed)? sent/i,
    ]) {
      assert.ok(!forbidden.test(rendered), `the surface must not claim ${forbidden}`);
    }
    /* The four things an operator must understand, rendered from frozen values. */
    assert.match(card, /REVOCATION_SEMANTICS\.revokedIsNotDeleted/);
    assert.match(card, /REVOCATION_SEMANTICS\.authorizationRemains/);
    assert.match(card, /REVOCATION_SEMANTICS\.replacementRequires/);
    assert.match(card, /stops working immediately/i);
  }

  /* ── 13. CONTRACTS STAY PURE ────────────────────────────────────────────── */
  {
    const contracts = codeOf(read(CONTRACTS));
    for (const forbidden of ["drizzle-orm", "@/db/", "node:crypto", "process.env", "async function"]) {
      assert.ok(!contracts.includes(forbidden), `contracts.ts must stay pure — found ${forbidden}`);
    }
    assert.ok(INVITATION_REVOCATION_EFFECT.length > 0);
    for (const claim of ["does not delete", "does not un-consume", "does not create a Governance decision"]) {
      assert.ok(
        INVITATION_REVOCATION_NON_EFFECTS.some((entry) => entry.includes(claim)),
        `the non-effects must state: ${claim}`,
      );
    }
  }

  /* ── 14. NO SCHEMA CHANGE — PHASE-SCOPED, NEVER A GLOBAL COUNT ──────────── */
  {
    /*
     * Stated as this phase's own claim rather than a repository-wide total, so a later authorized
     * migration cannot falsify it. Filenames are timestamp-prefixed, so a lexical comparison is
     * chronological.
     */
    const PHASE_BOUNDARY = "20260813090642_membership_role_tenant_integrity.sql";
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    assert.ok(
      migrations.includes(PHASE_BOUNDARY),
      "the migration that existed when this phase opened is intact",
    );
    const after = migrations.filter((f) => f > PHASE_BOUNDARY);
    assert.deepEqual(after, [], "invitation revocation added no migration");
    for (const file of migrations) {
      assert.ok(
        !/revocation|revoke/i.test(file),
        `no migration bears this phase's name — found ${file}`,
      );
    }
    /* And the revocation columns it uses were already there. */
    const invitationSchema = read("src/db/schema/invitation.ts");
    for (const column of ["revokedAt", "revokedByType", "revokedById", "revocationReason"]) {
      assert.match(invitationSchema, new RegExp(column), `${column} pre-existed this phase`);
    }
  }

  console.log("PASS invitation revocation boundaries and firewall");
}

main();
