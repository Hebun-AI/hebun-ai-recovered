/*
 * EXECUTION-AUTHORITY-1 — ONLY THE GOVERNANCE AUTHORITY MAY SPEND A PERMIT BY HAND.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES, against a real database:
 *
 *   "An approved permit can be executed by a human only while that human holds the tenant's
 *    Governance authority — the bootstrap human or an active delegate, as `resolveGovernanceAuthority`
 *    answers. Any other member of the same tenant is refused before anything is read or spent: the
 *    permit stays `active`, no work row, no handoff, no audit row, no execution attempt, and no
 *    arming read, adapter or provider seam is touched. The authority's own execution is unchanged,
 *    a foreign tenant still cannot spend, and the machine door is not asked the human question."
 *
 * Every row is produced by the released writer that owns it, except the second member's identity
 * rows, which are seeded exactly as `seedLocalIdentity` seeds the first. No network, no model, no
 * credential. Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { delegateGovernanceAuthority } from "../../src/features/governance-decision/authority-delegation.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { consumeActionPermit } from "../../src/features/action-authorization/consume-action-permit.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executePlaceHuman } from "../../src/features/governed-internal-action/execute-place-human.server";
import { executeSetWorkDeclaredState } from "../../src/features/governed-internal-action/execute-set-work-state.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-21T09:00:00.000Z");
const GENESIS_JUSTIFICATION =
  "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVAL_JUSTIFICATION = "This work is real and I want it on the register under my authority.";
const DELEGATION_JUSTIFICATION = "This colleague decides and executes governed acts while I am away.";

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
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

/** A second, ordinary, verified member of an existing tenant — seeded as `seedLocalIdentity` seeds. */
async function seedMember(client: Client, owner: Seeded, email: string): Promise<Seeded> {
  const user = await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email]);
  const userId = user.rows[0]!.id;
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [userId, `local:${email}`],
  );
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
    [owner.tenantId],
  );
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [owner.tenantId, userId, role.rows[0]!.id],
  );
  return {
    tenantId: owner.tenantId,
    userId,
    authIdentityId: identity.rows[0]!.id,
    membershipId: membership.rows[0]!.id,
    roleId: role.rows[0]!.id,
  };
}

/** Every property is a function that records it was called. Nothing a refused execution may touch. */
function spy(touched: string[], name: string): never {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "then") return undefined;
        return () => {
          touched.push(`${name}.${String(prop)}`);
          throw new Error(`${name}.${String(prop)} must not be reached`);
        };
      },
    },
  ) as never;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_execution_authority_1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  /* Everything a refused execution must leave exactly as it was. */
  const footprint = async () =>
    (
      await setup.query<Record<string, number>>(
        `select (select count(*) from work_items)::int as work,
                (select count(*) from action_execution_attempts)::int as attempts,
                (select count(*) from action_permits where status <> 'active' or consumed_at is not null or handoff_id is not null)::int as spent,
                (select count(*) from audit_log)::int as audit,
                (select count(*) from decision_records)::int as decisions`,
      )
    ).rows[0]!;
  const permitStatus = async (permitId: string) =>
    (
      await setup.query<{ status: string; consumedAt: string | null; handoffId: string | null }>(
        `select status, consumed_at as "consumedAt", handoff_id as "handoffId" from action_permits where id = $1`,
        [permitId],
      )
    ).rows[0]!;
  const reasonOf = (r: { status: string; reason?: string }) => (r.status === "refused" ? r.reason : `status:${r.status}`);

  try {
    /* ═══ 0. TWO GOVERNED ORGANIZATIONS, ONE UNGOVERNED, AND AN ORDINARY MEMBER OF ACME. ═══ */
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ea1", email: "director@acme-ea1.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ea1", email: "director@globex-ea1.test" })) as Seeded;
    const initech = (await seedLocalIdentity(setup, { companyName: "Initech", companySlug: "initech-ea1", email: "owner@initech-ea1.test" })) as Seeded;
    const member = await seedMember(setup, acme, "member@acme-ea1.test");

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "ea1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "ea1-globex");
    const initechCtx = contextFor(initech, await sessionRowFor(setup, initech, "cccc"), "ea1-initech");
    const memberCtx = contextFor(member, await sessionRowFor(setup, member, "dddd"), "ea1-member");

    for (const [seeded, ctx] of [[acme, acmeCtx], [globex, globexCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const genesis = await establishGovernanceAuthority(ctx, { justification: GENESIS_JUSTIFICATION }, deps);
      assert.equal(genesis.status, "established");
    }

    /* Two approved permits in Acme: one internal (record-work), one external (send). */
    const proposal = await proposeRecordWorkAction(acmeCtx, { workScope: { kind: "organization" as const }, title: "Supplier audit", department: { kind: "organization-level" } }, deps);
    assert.equal(proposal.status, "proposed", `record-work proposed (${JSON.stringify(proposal)})`);
    const approval = await approveActionRequest(
      acmeCtx,
      { requestId: proposal.status === "proposed" ? proposal.receipt.requestId : "", justification: APPROVAL_JUSTIFICATION },
      deps,
    );
    assert.equal(approval.status, "authorized");
    const permitId = approval.status === "authorized" ? approval.permitId : "";

    const recipient = await createExternalRecipient(acmeCtx, { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" }, writeDeps);
    const draft = await createWorkArtifact(acmeCtx, { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe," }, "operations", writeDeps);
    const sendProposal = await proposeSendAction(
      acmeCtx,
      {
        recipientRef: recipient.status === "created" ? recipient.recipient.recordRef : "",
        draftRef: draft.status === "created" ? draft.ref : "",
      },
      deps,
    );
    assert.equal(sendProposal.status, "proposed");
    const sendApproval = await approveActionRequest(
      acmeCtx,
      { requestId: sendProposal.status === "proposed" ? sendProposal.receipt.requestId : "", justification: APPROVAL_JUSTIFICATION },
      deps,
    );
    assert.equal(sendApproval.status, "authorized");
    const sendPermitId = sendApproval.status === "authorized" ? sendApproval.permitId : "";

    const before = await footprint();

    /* ═══ E1. AN ORDINARY MEMBER CANNOT EXECUTE — EVERY HUMAN EXECUTOR, EVERY DOOR. ═══ */
    const consumed = await consumeActionPermit(memberCtx, { permitId }, deps);
    assert.equal(reasonOf(consumed), "not-the-governance-authority", "E1 door one refuses a non-authority member");
    const recorded = await executeRecordWork(memberCtx, { permitId }, deps);
    assert.equal(reasonOf(recorded), "not-the-governance-authority", "E1 record-work executor carries the refusal");
    const placed = await executePlaceHuman(memberCtx, { permitId }, deps);
    assert.equal(reasonOf(placed), "not-the-governance-authority", "E1 placement executor carries the refusal");
    const declared = await executeSetWorkDeclaredState(memberCtx, { permitId }, deps);
    assert.equal(reasonOf(declared), "not-the-governance-authority", "E1 work-state executor carries the refusal");

    /* E3. The external executor refuses BEFORE arming, recipient, adapter or provider seams. */
    const touched: string[] = [];
    const sent = await executeAuthorizedAction(memberCtx, { permitId: sendPermitId }, {
      getDb: () => handle.db,
      now: () => NOW,
      env: {},
      rootEnabled: async () => {
        touched.push("rootEnabled");
        return true;
      },
      readTenant: (async () => {
        touched.push("readTenant");
        throw new Error("readTenant must not be reached");
      }) as never,
      repo: spy(touched, "controlRepo"),
      adapter: spy(touched, "adapter"),
      instagramPublish: spy(touched, "instagramPublish"),
      youtubePublish: spy(touched, "youtubePublish"),
    });
    assert.equal(reasonOf(sent), "not-the-governance-authority", "E3 external executor refuses a non-authority member");
    assert.deepEqual(touched, [], "E3 no arming read, control read, adapter or provider seam was reached");

    /* E2 / E3. Nothing moved. */
    assert.deepEqual(await footprint(), before, "E2/E3 no work, attempt, spend, audit or decision row was written");
    for (const id of [permitId, sendPermitId]) {
      const row = await permitStatus(id);
      assert.equal(row.status, "active", "E2 the permit stays active");
      assert.equal(row.consumedAt, null);
      assert.equal(row.handoffId, null);
    }

    /* E6. A tenant with no Governance at all — never treated as permission. */
    const ungoverned = await consumeActionPermit(initechCtx, { permitId }, deps);
    assert.equal(reasonOf(ungoverned), "no-governance-authority", "E6 an ungoverned tenant's human cannot spend");

    /* E7. Authority unreadable fails closed. */
    const unreadable = await consumeActionPermit(acmeCtx, { permitId }, { getDb: () => null } as never);
    assert.equal(reasonOf(unreadable), "no-governance-authority", "E7 an unreadable authority refuses");

    /* E5. Cross tenant: Globex's own authority still cannot spend Acme's permit. */
    const foreign = await executeRecordWork(globexCtx, { permitId }, deps);
    assert.equal(reasonOf(foreign), "permit-not-consumable", "E5 a foreign tenant's authority cannot spend");
    assert.deepEqual(await footprint(), before, "E5/E6/E7 still nothing written");

    /* ═══ E8. A DELEGATE HOLDS THE AUTHORITY, AS THE RESOLVER ANSWERS — AND MAY EXECUTE. ═══ */
    const delegated = await delegateGovernanceAuthority(acmeCtx, { toUserId: member.userId, justification: DELEGATION_JUSTIFICATION }, writeDeps);
    assert.equal(delegated.status, "delegated", `E8 delegation recorded (${JSON.stringify(delegated)})`);
    const byDelegate = await executeRecordWork(memberCtx, { permitId }, deps);
    assert.equal(byDelegate.status, "executed", `E8 the delegate executed (${JSON.stringify(byDelegate)})`);
    assert.equal((await permitStatus(permitId)).status, "consumed", "E8 the permit was spent once");

    /* ═══ E4. THE BOOTSTRAP AUTHORITY'S OWN EXECUTION IS UNCHANGED. ═══ */
    const second = await proposeRecordWorkAction(acmeCtx, { workScope: { kind: "organization" as const }, title: "Vendor review", department: { kind: "organization-level" } }, deps);
    const secondApproval = await approveActionRequest(
      acmeCtx,
      { requestId: second.status === "proposed" ? second.receipt.requestId : "", justification: APPROVAL_JUSTIFICATION },
      deps,
    );
    const secondPermitId = secondApproval.status === "authorized" ? secondApproval.permitId : "";
    const byAuthority = await executeRecordWork(acmeCtx, { permitId: secondPermitId }, deps);
    assert.equal(byAuthority.status, "executed", "E4 the bootstrap authority executes as before");
    const replay = await executeRecordWork(acmeCtx, { permitId: secondPermitId }, deps);
    assert.equal(reasonOf(replay), "permit-not-consumable", "E4 and a replay is still refused");

    /* ═══ E9. THE MACHINE DOOR AND THE STANDING ISSUER ARE NOT ASKED THE HUMAN QUESTION. ═══ */
    const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
    const consumeSrc = src("src/features/action-authorization/consume-action-permit.server.ts");
    const machineDoor = consumeSrc.slice(consumeSrc.indexOf("export async function consumeActionPermitAsMachine"));
    assert.ok(machineDoor.length > 0 && !machineDoor.includes("resolveGovernanceAuthority"), "E9 door two does not ask for Governance authority");
    const humanDoor = consumeSrc.slice(consumeSrc.indexOf("export async function consumeActionPermit("), consumeSrc.indexOf("export async function consumeActionPermitAsMachine"));
    assert.ok(humanDoor.indexOf("resolveGovernanceAuthority") > 0, "E9 door one asks the Governance resolver");
    assert.ok(humanDoor.indexOf("resolveGovernanceAuthority") < humanDoor.indexOf("spendPermit("), "E9 and asks before it spends");
    for (const p of [
      "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts",
      "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts",
    ]) {
      assert.ok(!src(p).includes("resolveGovernanceAuthority"), `E9 ${p} is unchanged in this respect`);
    }
    const execSrc = src("src/features/action-execution/execute-authorized-action.server.ts");
    const entry = execSrc.slice(execSrc.indexOf("export async function executeAuthorizedAction("));
    assert.ok(
      entry.indexOf("resolveGovernanceAuthority(") > 0 && entry.indexOf("resolveGovernanceAuthority(") < entry.indexOf("resolveExternalSendReachability("),
      "E9 the external executor asks before the arming read",
    );

    console.log("PASS execution-authority-1: E1–E9");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
