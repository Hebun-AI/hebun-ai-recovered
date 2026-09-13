/*
 * GIA-2 — THE SECOND GOVERNED INTERNAL ACT, END TO END, against a real PostgreSQL.
 *
 * ── WHAT THIS SUITE IS FOR ───────────────────────────────────────────────────
 *
 * GIA-1 proved that Hebun can perform ONE internal act under a human's authorization. That left an
 * open question the architecture could not answer by inspection: was the seam a reusable pattern,
 * or a `record-work` special case wearing a general-sounding name? This suite answers it with a
 * second domain, a second authority and a second refusal vocabulary.
 *
 * The chain, all of it released except the seam:
 *
 *   proposal → Governance decision → permit → HUMAN execute → Organization Authority → audit → read
 *
 * ── THE THREE FACTS THIS FILE REFUSES TO CONFLATE ────────────────────────────
 *
 *   PROPOSED   a request exists. Nobody is placed.
 *   AUTHORIZED a permit exists. NOBODY IS STILL PLACED — asserted, not assumed.
 *   EXECUTED   a human spent the permit and the authority wrote the row.
 *
 * ── AND THE ONE THING GIA-2 DOES DIFFERENTLY FROM GIA-1 ──────────────────────
 *
 * The governed act is a STRICT SUBSET of the human one: it places an unplaced human and refuses
 * `already-placed` otherwise, because `PermitConsumptionTx` exposes only `insert` and `select` and
 * GIA-1's firewall pins that narrowing. Moving somebody between departments stays a human act. That
 * is asserted here rather than described, because a narrowing nobody tests is a narrowing that
 * quietly widens.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import { placeHumanInDepartment } from "../../src/features/organization-authority/write-placement.server";
import { proposePlaceHumanAction } from "../../src/features/heby-action-inlet/place-human-proposal.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executePlaceHuman } from "../../src/features/governed-internal-action/execute-place-human.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/*
 * ANCHORED TO THE REAL CLOCK, NOT A LITERAL INSTANT.
 *
 * `consumeActionPermit` compares a permit's expiry against the DATABASE's `now()`, deliberately not
 * against the caller's clock. A frozen instant therefore issues permits that are already expired
 * once the wall clock passes it — this suite passed in the morning and refused every spend with
 * `permit-not-consumable` the same evening. GIA-1 keeps its permit flow on the real clock for
 * exactly this reason; nothing here asserts a literal timestamp, so anchoring costs nothing.
 */
const NOW = new Date();
const GENESIS_JUSTIFICATION =
  "This organization establishes its founding Governance authority for the placement acceptance.";
const APPROVAL_JUSTIFICATION =
  "The organization has decided this human works in this department, and authorizes the placement.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    authenticatedAt: NOW.toISOString(),
  });
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

/** A second eligible human in a tenant — somebody the governed act can legitimately place. */
async function addMember(client: Client, tenantId: string, roleId: string, email: string): Promise<string> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1,$1) returning id`,
    [email],
  );
  const userId = user.rows[0]!.id;
  await client.query(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1,'local','hebun-local',$2,'active',true, now())`,
    [userId, `local:${email}`],
  );
  await client.query(
    `insert into memberships (tenant_id, user_id, role_id, status, status_changed_at)
     values ($1,$2,$3,'active',now())`,
    [tenantId, userId, roleId],
  );
  return userId;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_gia2_placement");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    await setup.connect();

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-gia2",
      email: "director@acme-gia2.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-gia2",
      email: "director@globex-gia2.test",
    })) as Seeded;

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "gia2-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "gia2-globex");

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
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: GENESIS_JUSTIFICATION }, deps)).status,
        "established",
      );
    }

    const acmeDept = await recordDepartment(acmeCtx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(acmeDept.status, "recorded");
    const acmeDepartmentId = acmeDept.status === "recorded" ? acmeDept.department.departmentId : "";
    const acmeDepartmentRef = formatDepartmentRef(acmeDepartmentId);

    const globexDept = await recordDepartment(globexCtx, { name: "Legal", slug: "legal" }, deps);
    assert.equal(globexDept.status, "recorded");
    const globexDepartmentRef = formatDepartmentRef(
      globexDept.status === "recorded" ? globexDept.department.departmentId : "",
    );

    /* Two more Acme humans: one to place through the governed act, one already placed by hand. */
    const placeable = await addMember(setup, acme.tenantId, acme.roleId, "placeable@acme-gia2.test");
    const alreadyPlaced = await addMember(setup, acme.tenantId, acme.roleId, "placed@acme-gia2.test");
    const placeableRef = `user/${placeable}`;

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::text n from ${table}`)).rows[0]!.n);
    const placementsFor = async (userId: string) =>
      (
        await setup.query<{ id: string; department_id: string; lifecycle_status: string }>(
          `select id, department_id, lifecycle_status from department_placements where user_id=$1`,
          [userId],
        )
      ).rows;

    /* ═══ 1. A PROPOSAL PLACES NOBODY ══════════════════════════════════ */
    const proposal = await proposePlaceHumanAction(
      acmeCtx,
      { humanRef: placeableRef, departmentRef: acmeDepartmentRef },
      deps,
    );
    assert.equal(proposal.status, "proposed", `proposal refused: ${JSON.stringify(proposal)}`);
    const requestId = proposal.status === "proposed" ? proposal.receipt.requestId : "";
    assert.equal((await placementsFor(placeable)).length, 0, "PROPOSED != PLACED");

    /* ═══ 6. CROSS-TENANT REFERENCES DO NOT RESOLVE ════════════════════ */
    {
      const foreignDept = await proposePlaceHumanAction(
        acmeCtx,
        { humanRef: placeableRef, departmentRef: globexDepartmentRef },
        deps,
      );
      assert.equal(
        foreignDept.status === "refused" && foreignDept.reason,
        "department-unresolved",
        "another tenant's department is indistinguishable from one that never existed",
      );

      const foreignHuman = await proposePlaceHumanAction(
        acmeCtx,
        { humanRef: `user/${globex.userId}`, departmentRef: acmeDepartmentRef },
        deps,
      );
      assert.equal(
        foreignHuman.status === "refused" && foreignHuman.reason,
        "human-unresolved",
        "another tenant's human does not resolve here",
      );
      assert.equal(await countOf("heby_action_requests"), 1, "no refused proposal was filed");
    }

    /* ═══ 2. AUTHORIZED IS STILL NOT EXECUTED ══════════════════════════ */
    const approval = await approveActionRequest(
      acmeCtx,
      { requestId, justification: APPROVAL_JUSTIFICATION },
      deps,
    );
    assert.equal(approval.status, "authorized", `approval refused: ${JSON.stringify(approval)}`);
    const permitId = approval.status === "authorized" ? approval.permitId : "";
    assert.equal(
      (await placementsFor(placeable)).length,
      0,
      "AUTHORIZED != EXECUTED — the permit exists and nobody is placed",
    );

    /* ═══ 8-10. A FOREIGN TENANT CANNOT SPEND THIS PERMIT ══════════════ */
    {
      const stolen = await executePlaceHuman(globexCtx, { permitId }, deps);
      assert.equal(stolen.status, "refused", "another tenant cannot spend this permit");
      assert.equal((await placementsFor(placeable)).length, 0, "and nothing was written");
    }

    /* ═══ 10. A PERMIT FOR ANOTHER KIND CANNOT BE SUBSTITUTED ══════════ */
    {
      const workProposal = await proposeRecordWorkAction(
        acmeCtx,
        { title: "Quarterly close", department: { kind: "organization-level" } },
        deps,
      );
      assert.equal(workProposal.status, "proposed", JSON.stringify(workProposal));
      const workApproval = await approveActionRequest(
        acmeCtx,
        {
          requestId: workProposal.status === "proposed" ? workProposal.receipt.requestId : "",
          justification: APPROVAL_JUSTIFICATION,
        },
        deps,
      );
      assert.equal(workApproval.status, "authorized");
      const workPermitId = workApproval.status === "authorized" ? workApproval.permitId : "";

      const substituted = await executePlaceHuman(acmeCtx, { permitId: workPermitId }, deps);
      assert.equal(
        substituted.status === "refused" && substituted.reason,
        "action-kind-mismatch",
        "a record-work permit cannot perform a placement",
      );
      assert.equal((await placementsFor(placeable)).length, 0, "and nobody was placed");

      /*
       * THE MISMATCH ABORTED THE TRANSACTION, so the permit was NOT spent and the act it really
       * authorizes still works. This is the refusal economics GIA-1 established, re-proved here.
       */
      const properly = await executeRecordWork(acmeCtx, { permitId: workPermitId }, deps);
      assert.equal(properly.status, "executed", "the record-work permit survived the mismatch");
      assert.equal(await countOf("work_items"), 1);
    }

    /* ═══ 9 + 12. THE HUMAN EXECUTES, AND THE AUTHORITY WRITES ═════════ */
    const executed = await executePlaceHuman(acmeCtx, { permitId }, deps);
    assert.equal(executed.status, "executed", `execution refused: ${JSON.stringify(executed)}`);

    const placed = await placementsFor(placeable);
    assert.equal(placed.length, 1, "exactly one placement row exists");
    assert.equal(placed[0]!.department_id, acmeDepartmentId, "in the authorized department");
    assert.equal(placed[0]!.lifecycle_status, "active");

    /* ═══ 13. THE PLACEMENT AUDIT IS THE AUTHORITY'S, UNDER THE HUMAN ══ */
    {
      const audit = await setup.query<{ action: string; actor_type: string; actor_id: string }>(
        `select action, actor_type, actor_id from audit_log
          where tenant_id=$1 and entity_type='department_placement'`,
        [acme.tenantId],
      );
      assert.equal(audit.rows.length, 1, "exactly one placement audit event");
      assert.equal(audit.rows[0]!.actor_type, "human", "attributed to a human, never to Hebun");
      assert.equal(
        audit.rows[0]!.actor_id,
        acme.userId,
        "and to the human who authorized it",
      );
    }

    /* ═══ 14. NO EXTERNAL EXECUTION SEMANTICS WERE FABRICATED ══════════ */
    assert.equal(
      await countOf("action_execution_attempts"),
      0,
      "an internal act writes no external-send attempt row — it has no ambiguous phase",
    );

    /* ═══ 4 + 9. THE PERMIT CANNOT BE REPLAYED ═════════════════════════ */
    {
      const replay = await executePlaceHuman(acmeCtx, { permitId }, deps);
      assert.equal(replay.status, "refused", "a spent permit cannot be spent again");
      assert.equal(
        (await placementsFor(placeable)).length,
        1,
        "…and no second placement appeared",
      );
    }

    /* ═══ 4 (domain) + THE NARROWING. ALREADY-PLACED REFUSES TRUTHFULLY ═ */
    {
      /* Place the second human by the HUMAN path, which may move people. */
      const byHand = await placeHumanInDepartment(
        acmeCtx,
        { userId: alreadyPlaced, departmentId: acmeDepartmentId },
        deps,
      );
      assert.equal(byHand.status, "recorded", "the human path places them");

      const second = await proposePlaceHumanAction(
        acmeCtx,
        { humanRef: `user/${alreadyPlaced}`, departmentRef: acmeDepartmentRef },
        deps,
      );
      assert.equal(second.status, "proposed", "proposing is allowed — the world may change");
      const secondApproval = await approveActionRequest(
        acmeCtx,
        {
          requestId: second.status === "proposed" ? second.receipt.requestId : "",
          justification: APPROVAL_JUSTIFICATION,
        },
        deps,
      );
      assert.equal(secondApproval.status, "authorized");

      const refusedAct = await executePlaceHuman(
        acmeCtx,
        { permitId: secondApproval.status === "authorized" ? secondApproval.permitId : "" },
        deps,
      );
      assert.equal(
        refusedAct.status === "refused" && refusedAct.reason,
        "placement-authority-refused",
        "the AUTHORITY refused, and the seam carried its reason rather than deciding itself",
      );
      assert.equal(
        refusedAct.status === "refused" && refusedAct.authorityReason,
        "already-placed",
        "…and the reason is the authority's own word",
      );
      assert.equal(
        (await placementsFor(alreadyPlaced)).length,
        1,
        "REFUSAL CHANGED NOTHING — still exactly the placement the human made",
      );
    }

    /* ═══ 7. A RETIRED DEPARTMENT FAILS CLOSED AT EXECUTION ════════════ */
    {
      const third = await addMember(setup, acme.tenantId, acme.roleId, "late@acme-gia2.test");
      const proposalForThird = await proposePlaceHumanAction(
        acmeCtx,
        { humanRef: `user/${third}`, departmentRef: acmeDepartmentRef },
        deps,
      );
      assert.equal(proposalForThird.status, "proposed");
      const thirdApproval = await approveActionRequest(
        acmeCtx,
        {
          requestId: proposalForThird.status === "proposed" ? proposalForThird.receipt.requestId : "",
          justification: APPROVAL_JUSTIFICATION,
        },
        deps,
      );
      assert.equal(thirdApproval.status, "authorized");

      /*
       * The world moves between authorization and execution: the department is retired. The seam
       * does not re-check this — the AUTHORITY does, inside the transaction, which is the whole
       * reason the seam does not keep its own copy of the placement rules.
       */
      /* `archived` is the column's word for it; "retired" is the domain's. The enum is
       * `active | archived | deleted`, and the authority reads anything non-active as out of
       * service. */
      await setup.query(`update departments set lifecycle_status='archived' where id=$1`, [
        acmeDepartmentId,
      ]);

      const stale = await executePlaceHuman(
        acmeCtx,
        { permitId: thirdApproval.status === "authorized" ? thirdApproval.permitId : "" },
        deps,
      );
      assert.equal(
        stale.status === "refused" && stale.reason,
        "placement-authority-refused",
        "a retired department fails closed",
      );
      assert.equal(
        stale.status === "refused" && stale.authorityReason,
        "department-retired",
        "…in the authority's own words",
      );
      assert.equal((await placementsFor(third)).length, 0, "and nobody was placed");
    }

    console.log("GIA-2 governed placement (PostgreSQL): all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
