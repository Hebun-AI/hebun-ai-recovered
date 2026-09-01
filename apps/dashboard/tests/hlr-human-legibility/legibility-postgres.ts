/*
 * HUMAN LEGIBILITY REACH — against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization's Governance authority holder can see the humans of THEIR OWN organization by
 *    a readable label — including themselves — and can resolve an identifier their own records
 *    already name, even after that person has left. Nobody else can see any of it. No other
 *    organization's people are reachable by either read, under any input. The department writer verifies
 *    the identifier itself against the SAME eligibility rule the picker uses, so a label can never
 *    become the key and the control can never offer somebody the authority would refuse. And being
 *    readable, or being named accountable, grants nobody anything."
 *
 * The pins:
 *
 *   A LABEL != AN IDENTITY KEY           RESOLVED  != AUTHORIZED
 *   READABLE != AUTHORIZED               UNRESOLVED != NOBODY
 *   OWNERSHIP CANDIDATE != DELEGATION CANDIDATE
 *
 * Every row is produced by the released writer or seed that owns it. No adapter, no network, no
 * model. Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { readDelegationCandidates } from "../../src/features/governance-decision/authority-delegation.server";
import {
  MAX_RESOLVABLE_LABELS,
  readSelectableMembers,
  resolveHumanLabels,
  resolveHumanNames,
} from "../../src/features/auth-runtime/human-label-read.server";
import {
  recordDepartment,
  setDepartmentOwner,
} from "../../src/features/organization-authority/write-structure.server";
import { readOrganizationStructure } from "../../src/features/organization-authority/read-structure.server";
import { resolveGovernanceAuthority } from "../../src/features/governance-decision/authority-read.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS_JUSTIFICATION =
  "I am establishing this organization's Governance authority and I accept responsibility for it.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

/** Add another human to an existing tenant. Returns their user id. */
async function addMember(
  client: Client,
  tenant: { tenantId: string; roleId: string },
  input: {
    email: string;
    name?: string | null;
    displayName?: string | null;
    membershipStatus?: "active" | "revoked";
    revoked?: boolean;
    userDeleted?: boolean;
    membershipLifecycle?: "active" | "archived";
  },
): Promise<string> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name, display_name, deleted_at)
     values ($1, $2, $3, $4)
     returning id`,
    [
      input.email,
      input.name ?? null,
      input.displayName ?? null,
      input.userDeleted ? new Date() : null,
    ],
  );
  const userId = user.rows[0]!.id;
  await client.query(
    `insert into memberships (tenant_id, user_id, role_id, status, revoked_at, lifecycle_status)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      tenant.tenantId,
      userId,
      tenant.roleId,
      input.membershipStatus ?? "active",
      input.revoked ? new Date() : null,
      input.membershipLifecycle ?? "active",
    ],
  );
  return userId;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_hlr_legibility");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO ORGANIZATIONS. ONE HAS GOVERNANCE AUTHORITY; THE OTHER DOES NOT.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-hlr",
      email: "director@acme-hlr.test",
      userName: "Acme Director",
    });
    const globex = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-hlr",
      email: "director@globex-hlr.test",
      userName: "Globex Director",
    });
    /* A third organization that NEVER establishes authority — the fail-closed case. */
    const initech = await seedLocalIdentity(setup, {
      companyName: "Initech",
      companySlug: "initech-hlr",
      email: "director@initech-hlr.test",
      userName: "Initech Director",
    });

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "hlr-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "hlr-globex");
    const initechCtx = contextFor(initech, await sessionRowFor(setup, initech, "cccc"), "hlr-initech");

    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [globex, globexCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const genesis = await establishGovernanceAuthority(
        ctx,
        { justification: GENESIS_JUSTIFICATION },
        deps,
      );
      assert.equal(genesis.status, "established", "the tenant holds Governance authority");
    }

    /*
     * ACME'S PEOPLE. Each one exists to prove a different predicate, and each carries a label the
     * assertions can recognise without depending on any other row.
     */
    const displayNamed = await addMember(setup, acme, {
      email: "pat@acme-hlr.test",
      name: "Pat Legal Name",
      displayName: "Pat Preferred",
    });
    const nameOnly = await addMember(setup, acme, {
      email: "sam@acme-hlr.test",
      name: "Sam Only Name",
    });
    const emailOnly = await addMember(setup, acme, { email: "nameless@acme-hlr.test" });
    const revokedMember = await addMember(setup, acme, {
      email: "left@acme-hlr.test",
      displayName: "Former Person",
      membershipStatus: "revoked",
      revoked: true,
    });
    /*
     * A MEMBERSHIP WHOSE TWO REVOCATION FACTS DISAGREE: `status` still says active, `revoked_at` is
     * set. It exists because the picker's predicate checks BOTH, and a fixture that only ever
     * disagrees in one field cannot tell whether the second check is load-bearing or decoration —
     * a bite-proof against `isNull(revokedAt)` SURVIVED until this row existed, which is how the
     * gap was found rather than assumed.
     */
    const revokedTimestampOnly = await addMember(setup, acme, {
      email: "half-revoked@acme-hlr.test",
      displayName: "Half Revoked",
      membershipStatus: "active",
      revoked: true,
    });
    const archivedMembership = await addMember(setup, acme, {
      email: "archived@acme-hlr.test",
      displayName: "Archived Membership",
      membershipLifecycle: "archived",
    });
    const deletedUser = await addMember(setup, acme, {
      email: "gone@acme-hlr.test",
      displayName: "Deleted Identity",
      userDeleted: true,
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. THE PICKER OFFERS THIS ORGANIZATION'S ACTIVE HUMANS — AND THE CALLER.
     * ═════════════════════════════════════════════════════════════════════ */
    const offered = await readSelectableMembers(acmeCtx, deps);
    assert.equal(offered.status, "read", "an authorized caller receives a measured answer");
    if (offered.status !== "read") throw new Error("unreachable");
    const offeredIds = offered.members.map((member) => member.userId);
    const offeredLabels = offered.members.map((member) => member.label);

    /*
     * THE DIFFERENCE FROM DELEGATION, PINNED. This is the single predicate that had to change, and
     * getting it wrong would have returned an EMPTY list for the one organization that exists in
     * production — a wrong answer that looks exactly like a broken feature.
     */
    assert.ok(
      offeredIds.includes(acme.userId),
      "OWNERSHIP CANDIDATE != DELEGATION CANDIDATE — the current authority holder may own a department",
    );
    const delegable = await readDelegationCandidates(acmeCtx, deps);
    assert.ok(
      !delegable.some((candidate) => candidate.userId === acme.userId),
      "and the released delegation read still excludes them, because self-delegation is invalid",
    );

    /* Active members are offered. */
    for (const [id, who] of [
      [displayNamed, "a member with a display name"],
      [nameOnly, "a member with only a legal name"],
      [emailOnly, "a member with neither"],
    ] as const) {
      assert.ok(offeredIds.includes(id), `${who} is offered`);
    }

    /* Everything that is not an active member of this tenant is NOT offered. */
    for (const [id, why] of [
      [revokedMember, "a revoked membership"],
      [archivedMembership, "an archived membership"],
      [deletedUser, "a soft-deleted identity"],
      [globex.userId, "another organization's human"],
    ] as const) {
      assert.ok(!offeredIds.includes(id), `${why} is never offered as accountable`);
    }

    /*
     * EACH REVOCATION PREDICATE CARRIES ITS OWN WEIGHT. `status` and `revoked_at` are checked
     * separately, and this row is the one where they disagree — so it is excluded by `revoked_at`
     * alone. Without this assertion the second predicate would be untested decoration.
     */
    assert.ok(
      !offeredIds.includes(revokedTimestampOnly),
      "a membership revoked by timestamp is never offered as accountable, whatever its status says",
    );

    /* THE LABEL PRECEDENCE, MEASURED — display_name → name → email, and nothing invented. */
    const labelOf = (id: string) => offered.members.find((m) => m.userId === id)?.label;
    assert.equal(labelOf(displayNamed), "Pat Preferred", "display_name wins");
    assert.equal(labelOf(nameOnly), "Sam Only Name", "name is the fallback");
    assert.equal(labelOf(emailOnly), "nameless@acme-hlr.test", "email is the floor, never a blank");
    for (const label of offeredLabels) {
      assert.ok(label.length > 0, "no label is ever empty");
    }

    /* NO SECRET, NO INTERNAL. The shape is exactly two fields. */
    for (const member of offered.members) {
      assert.deepEqual(
        Object.keys(member).sort(),
        ["label", "userId"],
        "a candidate carries an identifier and a label, and nothing else",
      );
    }

    /* Ordered by label, so a picker is stable rather than incidental. */
    assert.deepEqual(
      [...offeredLabels],
      [...offeredLabels].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      "candidates are ordered by label",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. TENANT ISOLATION — IN BOTH DIRECTIONS, FOR BOTH READS.
     * ═════════════════════════════════════════════════════════════════════ */
    const globexOffered = await readSelectableMembers(globexCtx, deps);
    assert.equal(globexOffered.status, "read");
    if (globexOffered.status !== "read") throw new Error("unreachable");
    for (const member of globexOffered.members) {
      assert.ok(
        ![displayNamed, nameOnly, emailOnly, revokedMember, acme.userId].includes(member.userId),
        "no Acme human is reachable from Globex's session",
      );
    }

    /*
     * THE LABEL READ CANNOT CROSS A TENANT EITHER, and it is asked in the one way that would find
     * out: by supplying the OTHER tenant's real user id, which the caller would have to already
     * hold. It comes back absent — not refused with a different message, which would itself be an
     * oracle.
     */
    const crossTenant = await resolveHumanLabels(acmeCtx, [globex.userId], deps);
    assert.equal(crossTenant.size, 0, "another organization's identifier resolves to nothing");
    const mixed = await resolveHumanLabels(acmeCtx, [displayNamed, globex.userId], deps);
    assert.equal(mixed.get(displayNamed), "Pat Preferred", "the caller's own human resolves");
    assert.ok(!mixed.has(globex.userId), "and the other organization's does not, in the same call");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. AN UNAUTHORIZED CALLER LEARNS NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    const unauthorized = await readSelectableMembers(initechCtx, deps);
    assert.deepEqual(
      unauthorized,
      { status: "unavailable", reason: "not-authorized" },
      "a caller without Governance authority receives no members, and is told why",
    );
    const initechMember = await addMember(setup, initech, {
      email: "someone@initech-hlr.test",
      displayName: "Initech Person",
    });
    const unauthorizedLabels = await resolveHumanLabels(initechCtx, [initechMember], deps);
    assert.equal(
      unauthorizedLabels.size,
      0,
      "and cannot resolve a label for their OWN organization's human either — the gate is the gate",
    );

    /* No tenant at all fails closed the same way. */
    assert.deepEqual(
      await readSelectableMembers(null, deps),
      { status: "unavailable", reason: "no-authorized-tenant-context" },
      "no session, no answer",
    );
    assert.equal((await resolveHumanLabels(null, [displayNamed], deps)).size, 0);

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. A FORMER MEMBER STAYS LEGIBLE. UNRESOLVED != NOBODY.
     * ═════════════════════════════════════════════════════════════════════ */
    const formerLabel = await resolveHumanLabels(acmeCtx, [revokedMember], deps);
    assert.equal(
      formerLabel.get(revokedMember),
      "Former Person",
      "a human the records still name is still readable after their membership ends",
    );
    assert.ok(
      !offeredIds.includes(revokedMember),
      "and is nevertheless not offered as a NEW owner — two questions, two predicates",
    );

    /* A soft-deleted identity is withheld by BOTH reads. Identity withdrew it; nothing republishes it. */
    assert.equal(
      (await resolveHumanLabels(acmeCtx, [deletedUser], deps)).size,
      0,
      "a soft-deleted identity resolves to nothing",
    );

    /* An identifier nobody holds resolves to nothing, and nothing is invented for it. */
    const unknown = "00000000-0000-4000-8000-000000000000";
    assert.equal((await resolveHumanLabels(acmeCtx, [unknown], deps)).size, 0);

    /* The bound is a ceiling, not a page: over it, the read declines rather than truncating. */
    const overBound = Array.from({ length: MAX_RESOLVABLE_LABELS + 1 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    assert.equal(
      (await resolveHumanLabels(acmeCtx, overBound, deps)).size,
      0,
      "an over-long request is refused whole, never silently trimmed to a page",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE WRITER IS UNCHANGED, AND THE IDENTIFIER IS STILL THE KEY.
     * ═════════════════════════════════════════════════════════════════════ */
    const recorded = await recordDepartment(acmeCtx, { name: "Engineering", slug: "engineering" }, deps);
    assert.equal(recorded.status, "recorded");
    if (recorded.status !== "recorded") throw new Error("unreachable");
    const departmentId = recorded.department.departmentId;

    /*
     * EVERY OFFERED CANDIDATE IS ACCEPTED BY THE WRITER. This is the invariant that makes the picker
     * honest: a control offering somebody the writer would refuse produces a refusal a human cannot
     * explain. Proved by running the released writer against each offered id in turn.
     */
    for (const member of offered.members) {
      const set = await setDepartmentOwner(
        acmeCtx,
        { departmentId, ownerUserId: member.userId },
        deps,
      );
      assert.equal(
        set.status,
        "recorded",
        `the writer accepts every human the picker offers (${member.label})`,
      );
    }

    /* And the writer still refuses, judged on the IDENTIFIER alone and on nothing this milestone added. */
    for (const [id, why] of [
      [globex.userId, "another organization's human"],
      [unknown, "an identifier nobody holds"],
    ] as const) {
      const refused = await setDepartmentOwner(acmeCtx, { departmentId, ownerUserId: id }, deps);
      assert.deepEqual(
        refused,
        { status: "refused", reason: "owner-not-active-member" },
        `the writer refuses ${why}, and its verdict owes nothing to any label`,
      );
    }

    /*
     * ── PICKER AND WRITER NOW AGREE EXACTLY ─────────────────────────────────
     *
     * SUPERSEDED, AND THE HISTORY IS THE POINT. This block used to assert the OPPOSITE: that the
     * released writer ACCEPTED a revoked member and a soft-deleted identity, because its check was
     * `memberships.lifecycle_status` alone. That was measured here, reported rather than repaired,
     * and is the defect the Owner Eligibility Hardening then fixed.
     *
     * Both now call `eligibleTenantMemberConditions`, so the picker cannot offer a human the writer
     * refuses AND the writer cannot accept a human the picker withheld. The subset relation the
     * previous version settled for has become an equality.
     *
     *     THE UI HIDING SOMEBODY IS NOT ENFORCEMENT.
     */
    for (const [id, who] of [
      [revokedMember, "a revoked membership"],
      [revokedTimestampOnly, "a membership revoked by timestamp alone"],
      [deletedUser, "a soft-deleted identity"],
      [archivedMembership, "an archived membership"],
    ] as const) {
      assert.ok(!offeredIds.includes(id), `${who} is not offered by the picker`);
      const refused = await setDepartmentOwner(acmeCtx, { departmentId, ownerUserId: id }, deps);
      assert.deepEqual(
        refused,
        { status: "refused", reason: "owner-not-active-member" },
        `and the hardened writer independently REFUSES ${who}`,
      );
    }

    /*
     * A LABEL IS NOT AN IDENTITY KEY. There is no parameter through which a label could be
     * submitted, so this is proved by what the record HOLDS: the identifier, unchanged.
     */
    const finalOwner = displayNamed;
    assert.equal(
      (await setDepartmentOwner(acmeCtx, { departmentId, ownerUserId: finalOwner }, deps)).status,
      "recorded",
    );
    const structure = await readOrganizationStructure(acmeCtx, deps);
    assert.equal(structure.status, "available");
    if (structure.status !== "available") throw new Error("unreachable");
    const department = structure.departments.find((d) => d.departmentId === departmentId);
    assert.equal(department?.owner?.actorId, finalOwner, "the record holds the identifier");
    assert.equal(department?.owner?.actorType, "human");
    assert.ok(
      !JSON.stringify(department).includes("Pat Preferred"),
      "and holds no label — nothing was persisted onto the department",
    );

    /*
     * THE WHOLE ROW, SCANNED FOR EVERY LABEL THIS TEST INVENTED. Casting the row to text catches a
     * label persisted into ANY column, including one a later milestone might add — which a
     * column-by-column check would not.
     *
     * An earlier version of this probe asked whether `owner_actor_id::text` matched `[A-Za-z ]` and
     * FAILED, because a uuid's hex digits are letters. It was measuring the wrong thing and said so
     * loudly, which is the only reason it is worth recording: the assertion below tests the claim,
     * not a proxy for it.
     */
    const persistedLabels = await setup.query<{ n: number }>(
      `select count(*)::int as n from departments d
        where d::text like '%Pat Preferred%'
           or d::text like '%Former Person%'
           or d::text like '%Sam Only Name%'
           or d::text like '%acme-hlr.test%'`,
    );
    assert.equal(persistedLabels.rows[0]!.n, 0, "no label reached the departments table");

    /* And what the owner column holds IS the identifier — a uuid, byte for byte. */
    const ownerColumn = await setup.query<{ owner: string | null }>(
      `select owner_actor_id::text as owner from departments where id = $1`,
      [departmentId],
    );
    assert.equal(ownerColumn.rows[0]!.owner, finalOwner, "the column holds the identifier itself");

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. READABLE != AUTHORIZED. LEGIBILITY GRANTED NOBODY ANYTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    const ownerCtx = contextFor(
      {
        tenantId: acme.tenantId,
        userId: finalOwner,
        authIdentityId: acme.authIdentityId,
        membershipId: acme.membershipId,
        roleId: acme.roleId,
      },
      await sessionRowFor(setup, acme, "dddd"),
      "hlr-owner",
    );
    const ownerAuthority = await resolveGovernanceAuthority(ownerCtx, deps);
    assert.equal(
      ownerAuthority.authorized,
      false,
      "the accountable human — readable, named, recorded — holds no Governance authority",
    );
    const ownerAttempt = await recordDepartment(
      ownerCtx,
      { name: "Finance", slug: "finance" },
      deps,
    );
    assert.deepEqual(
      ownerAttempt,
      { status: "refused", reason: "not-authorized" },
      "and cannot record structure — ownership is attribution, not authority",
    );

    /* NOTHING GOVERNANCE-SHAPED WAS WRITTEN BY ANY OF THIS. */
    const permits = await setup.query<{ n: number }>(`select count(*)::int as n from action_permits`);
    assert.equal(permits.rows[0]!.n, 0, "no permit");
    const attempts = await setup.query<{ n: number }>(
      `select count(*)::int as n from action_execution_attempts`,
    );
    assert.equal(attempts.rows[0]!.n, 0, "no execution attempt");
    const structuralDecisions = await setup.query<{ n: number }>(
      `select count(*)::int as n from decision_records where subject_type = 'department'`,
    );
    assert.equal(structuralDecisions.rows[0]!.n, 0, "and no Governance decision for structure");

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE PROVIDER-SAFE NAME READ — A NAME, OR NOTHING. NEVER AN ADDRESS.
     *
     * WORK-2 POST-ACCEPTANCE PRIVACY HARDENING. `resolveHumanLabels` answers what THIS
     * ORGANIZATION'S OWN SURFACE should call a person and falls back to their address;
     * `resolveHumanNames` answers what may be SENT OUTSIDE THIS PROCESS and does not. Both are
     * measured here against the same real rows, in the same database, so the difference is a
     * measurement and not a claim.
     *
     *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
     * ═════════════════════════════════════════════════════════════════════ */
    const names = await resolveHumanNames(
      acmeCtx,
      [displayNamed, nameOnly, emailOnly, revokedMember],
      deps,
    );

    /* display_name is allowed out, and still wins over the legal name. */
    assert.equal(names.get(displayNamed), "Pat Preferred", "display_name is disclosable, and wins");
    /* name is allowed out when display_name is absent. */
    assert.equal(names.get(nameOnly), "Sam Only Name", "name is disclosable when display_name is absent");

    /*
     * THE FINDING PRODUCTION SURFACED, PINNED. A human with neither name column is ABSENT — not
     * their address, not a blank, not a derived value. Asserted three ways because "absent" and
     * "present but different" are different failures.
     */
    assert.ok(!names.has(emailOnly), "a human with no name is ABSENT — the address is not a fallback");
    assert.equal(names.get(emailOnly), undefined, "and there is no value for them at all");
    for (const value of names.values()) {
      assert.ok(!value.includes("@"), `no disclosable name is an address: ${value}`);
      assert.ok(
        !value.includes("acme-hlr.test") && !value.includes("nameless"),
        "and no address, or any part of one, leaks through as a name",
      );
    }

    /*
     * NO NAME IS DERIVED FROM AN ADDRESS. The local-part of `nameless@acme-hlr.test` is `nameless`;
     * nothing anywhere in the result resembles it, capitalized or otherwise.
     */
    const allNames = [...names.values()].join(" ").toLowerCase();
    for (const guess of ["nameless", "nameles", "acme-hlr", "n."]) {
      assert.ok(!allNames.includes(guess), `no name is guessed from an address: ${guess}`);
    }

    /* A former member keeps their NAME too — the disclosure rule changed, the history rule did not. */
    assert.equal(
      names.get(revokedMember),
      "Former Person",
      "a human the records still name stays named after their membership ends",
    );

    /*
     * THE RELEASED UI READ IS UNCHANGED — asserted in the same breath, over the same ids. This is
     * the half that proves the hardening did not quietly reach into the product surfaces.
     */
    const uiLabels = await resolveHumanLabels(acmeCtx, [displayNamed, nameOnly, emailOnly], deps);
    assert.equal(uiLabels.get(displayNamed), "Pat Preferred", "the UI read still prefers display_name");
    assert.equal(uiLabels.get(nameOnly), "Sam Only Name", "the UI read still falls back to name");
    assert.equal(
      uiLabels.get(emailOnly),
      "nameless@acme-hlr.test",
      "AND THE UI READ STILL FLOORS AT THE ADDRESS — the product surface was deliberately not changed",
    );

    /* THE SAME GATE, THE SAME PREDICATES. The name read is not a looser door. */
    assert.equal(
      (await resolveHumanNames(acmeCtx, [globex.userId], deps)).size,
      0,
      "another organization's identifier resolves to no name either",
    );
    assert.equal(
      (await resolveHumanNames(initechCtx, [initechMember], deps)).size,
      0,
      "an unauthorized caller resolves no name — the gate is the gate",
    );
    assert.equal((await resolveHumanNames(null, [displayNamed], deps)).size, 0, "no session, no name");
    assert.equal(
      (await resolveHumanNames(acmeCtx, [deletedUser], deps)).size,
      0,
      "a soft-deleted identity yields no name",
    );
    assert.equal((await resolveHumanNames(acmeCtx, [unknown], deps)).size, 0, "and neither does nobody");
    assert.equal(
      (await resolveHumanNames(acmeCtx, overBound, deps)).size,
      0,
      "the bound is the same ceiling, refused whole",
    );

    console.log("HLR legibility (postgres): all assertions passed.");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
