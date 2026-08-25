/*
 * Stranded approved enrollment recovery — structural boundaries.
 *
 * Every assertion is a claim about what does NOT exist:
 *
 *   - no second decision writer, no second Governance resolver, no recovery-only authority
 *   - approval is still reachable only from `pending`
 *   - a COMPLETED ceremony is never rejectable
 *   - the invitation is neither revoked nor reissued by a recovery
 *   - no capability is minted, rotated or exposed
 *   - no schema change, and no migration belongs to this phase
 *   - no surface calls an approved row "waiting for approval"
 *
 * Runtime behaviour lives in `recovery-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ONBOARDING_ENTRY_WORDING } from "../../src/components/auth/onboarding-entry-wording";

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

const DECIDE = "src/features/identity-enrollment/decide-enrollment.server.ts";
const READ_SEAM = "src/features/identity-enrollment/read-pending-enrollments.server.ts";
const CARD = "src/components/governance-authority/pending-enrollment-card.tsx";

function main(): void {
  const decide = read(DECIDE);
  const decideCode = codeOf(decide);
  const readSeam = read(READ_SEAM);
  const card = read(CARD);

  /* ── 1. ONE DECISION WRITER, ONE RESOLVER, NO NEW AUTHORITY ─────────────── */
  {
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((f) => /\.update\(identityEnrollmentRequests\)/.test(read(f)));
    assert.deepEqual(
      writers.sort(),
      [
        "src/features/identity-enrollment/complete-enrollment.server.ts",
        "src/features/identity-enrollment/decide-enrollment.server.ts",
      ],
      "only the decision runtime and the completion runtime transition an enrollment",
    );
    assert.match(decide, /resolveGovernanceAuthority/, "authority comes from the one resolver");
    const resolvers = collect("src/features").filter((f) =>
      /export async function resolveGovernanceAuthority\b/.test(read(f)),
    );
    assert.equal(resolvers.length, 1, "there is exactly one Governance resolver");
    /* No recovery-only side door. */
    for (const forbidden of ["recoverEnrollment", "forceReject", "adminReject", "unstrand"]) {
      assert.ok(
        !decideCode.includes(forbidden),
        `recovery reuses the reject path — found a separate ${forbidden}`,
      );
    }
  }

  /* ── 2. APPROVAL IS STILL ONLY REACHABLE FROM `pending` ─────────────────── */
  {
    assert.match(
      decideCode,
      /const decidable =\s*enrollment\.status === "pending" \|\| \(!approving && strandedApproved\)/,
      "the widened eligibility applies to REJECTION only",
    );
    assert.match(
      decideCode,
      /approving\s*\?\s*eq\(identityEnrollmentRequests\.status, "pending"\)/,
      "and the conditional update keeps approval predicated on pending",
    );
  }

  /* ── 3. A COMPLETED CEREMONY IS NEVER REJECTABLE ────────────────────────── */
  {
    assert.match(
      decideCode,
      /const strandedApproved =\s*enrollment\.status === "approved" && enrollment\.completedAt === null/,
      "stranded means approved AND uncompleted — completion excludes it",
    );
    assert.match(
      decideCode,
      /isNull\(identityEnrollmentRequests\.completedAt\)/,
      "and the conditional update repeats that inside the transaction",
    );
  }

  /* ── 4. RECOVERY TOUCHES NOTHING BUT THE ENROLLMENT ROW ─────────────────── */
  {
    for (const forbidden of [
      "invitations",
      "membershipAuthorizations",
      "insert(users)",
      "insert(authIdentities)",
      "insert(authCredentials)",
      "insert(memberships)",
      "randomBytes",
      "digestInvitationToken",
      "tokenHash",
    ]) {
      assert.ok(
        !decideCode.includes(forbidden),
        `a recovery must not reach ${forbidden} — it frees a slot, it does not reissue anything`,
      );
    }
  }

  /* ── 5. THE APPROVAL COLUMNS ARE CLEARED, AND THE LEDGER KEEPS THE TRUTH ── */
  {
    /*
     * `identity_enrollment_requests_approved_chk` welds the four approval columns to the
     * approved/completed statuses in both directions, so a `rejected` row may not carry them.
     */
    for (const column of [
      "approvedAt: null",
      "approvalDecisionId: null",
      "approvedByActorType: null",
      "approvedByActorId: null",
    ]) {
      assert.ok(decideCode.includes(column), `the rejection branch must clear ${column}`);
    }
    assert.match(
      decide,
      /decision_records/,
      "and the header explains where the approval still lives",
    );
    assert.match(
      decideCode,
      /writeGovernanceDecisionWithin/,
      "every decision, including a recovery, is written through the existing writer",
    );
    assert.match(
      decideCode,
      /recordGovernanceEventWithin/,
      "and audited through the existing sink",
    );
  }

  /* ── 6. THE READ SEAM SHOWS BOTH ACTIONABLE STATES, AND STAYS READ-ONLY ── */
  {
    const seamCode = codeOf(readSeam);
    assert.match(seamCode, /eq\(identityEnrollmentRequests\.status, "pending"\)/);
    assert.match(
      seamCode,
      /eq\(identityEnrollmentRequests\.status, "approved"\)[\s\S]{0,120}isNull\(identityEnrollmentRequests\.completedAt\)/,
      "stranded approved ceremonies are listed too",
    );
    /*
     * NARROWED FROM `strandedAfterApproval: row.status === "approved"`, AND THAT WAS THE BUG.
     *
     * Labelling every approved-and-uncompleted row stranded described a healthy ceremony as a broken
     * one seconds after its approval, and invited an approver to reject work still in progress. The
     * state now turns on the continuation receipt's own lifetime, which is the only part of "can the
     * bearer still finish?" the server can honestly know.
     */
    assert.match(
      seamCode,
      /now\.getTime\(\) >= receiptExpiresAt\.getTime\(\)[\s\S]{0,90}approved-stranded/,
      "stranded is decided by the receipt lifetime, not by approval alone",
    );
    assert.match(
      seamCode,
      /ENROLLMENT_CONTINUATION_TTL_SECONDS/,
      "and it reads the one TTL authority rather than restating twelve hours",
    );
    assert.ok(
      !/\b12\s*\*\s*60\s*\*\s*60\b/.test(seamCode),
      "the TTL is never duplicated in the seam",
    );
    assert.ok(
      !/\.insert\(|\.update\(|\.delete\(/.test(seamCode),
      "a read seam reads",
    );
    /* Still no address, still no secret. */
    for (const forbidden of ["normalizedEmail", "continuationHash", "tokenHash"]) {
      assert.ok(!seamCode.includes(forbidden), `the seam must not expose ${forbidden}`);
    }
  }

  /* ── 7. NO SURFACE CALLS AN APPROVED ROW "WAITING FOR APPROVAL" ─────────── */
  {
    /*
     * The exact copy defect a real bearer hit: the runtime refuses whenever a non-rejected ceremony
     * exists — pending OR approved — and the message claimed it was waiting for approval.
     */
    const alreadyStarted = ONBOARDING_ENTRY_WORDING.startRefusals["enrollment-already-started"]!;
    assert.ok(
      !/waiting for approval/i.test(alreadyStarted),
      "the public refusal must not claim a state it cannot know",
    );
    assert.match(
      alreadyStarted,
      /already exists/i,
      "it states the true, state-neutral fact instead",
    );
    assert.ok(
      !/approved/i.test(alreadyStarted),
      "and it does not leak whether Governance already approved, at an unauthenticated boundary",
    );
    /* The approver's card names each approved state plainly, and differently. */
    const prose = card.replace(/\s+/g, " ");
    assert.match(prose, /Approved, but the account was never created/);
    assert.match(prose, /Reject so they can try again/);
    assert.match(prose, /blocks any new attempt/i);
    assert.match(card, /STRANDED_RECOVERY_FACTS/, "and lists what rejecting does, from frozen values");
    /*
     * AND AN IN-FLIGHT CEREMONY IS NOT DEFAMED. This is the copy that was wrong: an approved row
     * whose bearer can still finish must read as waiting, never as failed.
     */
    assert.match(prose, /Approved — waiting for them to finish/);
    assert.match(prose, /Nothing is wrong/);
    assert.match(
      prose,
      /Leave this alone unless they tell you they cannot finish/,
      "the in-flight state tells the approver not to act",
    );
    /* Approve is offered on a pending row only. */
    assert.match(
      codeOf(card),
      /submission\.lifecycle === "pending" \? \(/,
      "the Approve control belongs to a pending row alone",
    );
    /* Recovery stays reachable from both approved states, quietly while in flight. */
    assert.match(
      codeOf(card),
      /variant=\{submission\.lifecycle === "approved-in-flight" \? "ghost" : "outline"\}/,
      "rejection is de-emphasised while the bearer can still finish",
    );
  }

  /* ── 8. NO SCHEMA CHANGE — PHASE-SCOPED, NEVER A GLOBAL COUNT ───────────── */
  {
    const PHASE_BOUNDARY = "20260813090642_membership_role_tenant_integrity.sql";
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    assert.ok(migrations.includes(PHASE_BOUNDARY), "the last migration is intact");
    /*
     * Phase-scoped was the right instinct, but an empty list beyond the boundary still asserted
     * something about every phase that would ever follow. Naming the later Gate-B migration keeps
     * this phase's claim exact and still fails on an undeclared one.
     */
    assert.deepEqual(
      migrations.filter((f) => f > PHASE_BOUNDARY),
      ["20260815202736_heby_answer_evidence.sql", "20260816063156_r3a_action_authorization.sql", "20260816085245_r3w_durable_work_artifacts.sql", "20260816105458_r3r_durable_recipient_authority.sql", "20260816194116_r3b_action_execution_attempts.sql", "20260817195446_r4a_tenant_provisioning_source.sql", "20260818172455_production_provenance_vocabulary.sql", "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql"],
      "stranded-enrollment recovery added no migration; what follows is a declared later phase",
    );
    for (const file of migrations) {
      assert.ok(
        !/strand|recovery/i.test(file),
        `no migration bears this phase's name — found ${file}`,
      );
    }
    /* The columns it relies on pre-existed. */
    const schema = read("src/db/schema/identity-enrollment.ts");
    for (const column of ["completedAt", "rejectedAt", "rejectionReason", "approvedAt"]) {
      assert.match(schema, new RegExp(column), `${column} pre-existed this phase`);
    }
  }

  console.log("PASS stranded enrollment boundaries and firewall");
}

main();
