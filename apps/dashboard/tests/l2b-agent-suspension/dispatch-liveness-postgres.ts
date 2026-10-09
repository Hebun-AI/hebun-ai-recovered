/*
 * L-2b — external dispatch re-asks whether the PROPOSING AGENT is in service, immediately before the
 * provider call. Real PostgreSQL, the released email executor, a fake adapter (no live provider).
 *
 * Proven here:
 *   1  suspended BETWEEN the spend commit and the call → the attempt closes `refused` /
 *      `authorization-invalid`, the adapter is never called, the permit stays spent
 *   2  suspended BEFORE execution → the spend refuses, the permit stays active, nothing is called
 *   3  that unspent permit blocks reactivation; revoked through its own authority, reactivation passes
 *   4  an in-service agent's act still reaches the adapter (the check refuses nothing it should not)
 *   5  a HUMAN-proposed act is not gated on any agent's service
 *
 * What it does NOT claim: that a check before the call can recall a call already started.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import {
  proposeAgentOriginatedSendAction,
  proposeSendAction,
} from "../../src/features/heby-action-inlet/send-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import {
  reactivateDurableAgentIdentity,
  suspendDurableAgentIdentity,
} from "../../src/features/agent-identity/suspend-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import type { ExternalSendAdapter, ProviderOutcome, SendExternalMessageInput } from "../../src/features/action-execution/adapter-contract";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION = "This external message is a deliberate organizational act and I accept responsibility for it.";
const SUSPEND = "Suspend this agent while its outbound messages are reviewed (L-2b proof).";
const REACTIVATE = "Review complete; return this agent to service (L-2b proof).";
const ARMED_ENV = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "Test subject, never configured for real",
});

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function fakeAdapter(outcome: ProviderOutcome): ExternalSendAdapter & { readonly calls: SendExternalMessageInput[] } {
  const calls: SendExternalMessageInput[] = [];
  return {
    adapterId: "resend-email-v1",
    endpointKind: "email",
    calls,
    async send(input) {
      calls.push(input);
      return outcome;
    },
  };
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
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), seeded.userId, seeded.tenantId, seeded.membershipId],
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_l2b_dispatch");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };
  const control = {
    async getControl() {
      return { providerKey: "external-send", directorEnabled: true, version: 1, updatedAt: new Date().toISOString(), updatedBy: null };
    },
  };
  /* The organization's arming and the deployment control, both on (as content-publication-state-1). */
  const execDeps = {
    ...baseDeps,
    repo: control,
    env: ARMED_ENV,
    readTenant: (async () => ({ status: "read", effective: { state: "active" } })) as never,
    rootEnabled: async () => true,
  };

  try {
    await setup.connect();
    const permitStatus = async (id: string): Promise<string> =>
      (await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [id])).rows[0]!.status;

    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-l2bd", email: "director@acme-l2bd.test" })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "d1"), "l2b-dispatch");
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, ctx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status, "established");
    const created = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the L-2b dispatch proof." }, baseDeps);
    assert.equal(created.status, "established");
    const agentId = created.status === "established" ? created.identity.agentId : "";
    const proposerResult = await resolveAgentProposer(ctx, baseDeps);
    assert.equal(proposerResult.status, "resolved");
    const proposer = proposerResult.status === "resolved" ? proposerResult.proposer : null;
    await seedAgentMandate(setup, acme, agentId, baseDeps, { tag: "l2bd" });

    let seq = 0;
    const refs = async () => {
      seq += 1;
      const recipient = await createExternalRecipient(
        ctx,
        { displayName: `Recipient ${seq}`, endpointKind: "email", endpointValue: `person${seq}@example.com` },
        baseDeps,
      );
      const artifact = await createWorkArtifact(ctx, { artifactType: "message-draft", title: `Draft ${seq}`, content: `Body ${seq}.` }, "operations", baseDeps);
      if (recipient.status !== "created" || artifact.status !== "created") throw new Error("fixture");
      return { recipientRef: recipient.recipient.recordRef, draftRef: artifact.ref };
    };
    const agentPermit = async (): Promise<string> => {
      const filed = await proposeAgentOriginatedSendAction(ctx, await refs(), proposer!, baseDeps);
      assert.equal(filed.status, "proposed");
      const requestId = filed.status === "proposed" ? filed.receipt.requestId : "";
      const approved = await approveActionRequest(ctx, { requestId, justification: JUSTIFICATION }, baseDeps);
      assert.equal(approved.status, "authorized", "an in-service agent's proposal can be approved");
      return approved.status === "authorized" ? approved.permitId : "";
    };

    /* ── (1) SUSPENDED BETWEEN THE SPEND AND THE CALL ── */
    const p1 = await agentPermit();
    const a1 = fakeAdapter({ class: "accepted", providerMessageId: "never" });
    const r1 = await executeAuthorizedAction(ctx, { permitId: p1 }, {
      ...execDeps,
      adapter: a1,
      beforeDispatchLivenessCheck: async () => {
        const s = await suspendDurableAgentIdentity(ctx, { agentId, justification: SUSPEND }, baseDeps);
        assert.equal(s.status, "suspended", "the suspension commits after the spend, before the call");
      },
    });
    assert.equal(r1.status, "refused-after-spend", "a suspended agent's act is not dispatched");
    if (r1.status !== "refused-after-spend") throw new Error("unreachable");
    assert.equal(r1.attempt.status, "refused");
    assert.equal(r1.attempt.failureClass, "authorization-invalid");
    assert.equal(a1.calls.length, 0, "the adapter is never called once the agent is suspended");
    assert.equal(await permitStatus(p1), "consumed", "the permit was spent before the suspension; it stays spent");

    /* ── (5) A HUMAN-PROPOSED ACT IS NOT GATED ON AN AGENT ── */
    const human = await proposeSendAction(ctx, await refs(), baseDeps);
    assert.equal(human.status, "proposed");
    const hReq = human.status === "proposed" ? human.receipt.requestId : "";
    const hApproved = await approveActionRequest(ctx, { requestId: hReq, justification: JUSTIFICATION }, baseDeps);
    assert.equal(hApproved.status, "authorized");
    const aH = fakeAdapter({ class: "accepted", providerMessageId: "prov-human" });
    const rH = await executeAuthorizedAction(ctx, { permitId: hApproved.status === "authorized" ? hApproved.permitId : "" }, { ...execDeps, adapter: aH });
    assert.equal(rH.status, "attempted", "a human's own act is dispatched while the agent is suspended");
    assert.equal(aH.calls.length, 1);

    /* Reactivate (no usable permit: p1 is spent), so (2) can issue a permit while in service. */
    assert.equal((await reactivateDurableAgentIdentity(ctx, { agentId, justification: REACTIVATE }, baseDeps)).status, "reactivated");

    /* ── (2) SUSPENDED BEFORE EXECUTION ── */
    const p2 = await agentPermit();
    assert.equal((await suspendDurableAgentIdentity(ctx, { agentId, justification: SUSPEND }, baseDeps)).status, "suspended");
    const a2 = fakeAdapter({ class: "accepted", providerMessageId: "never" });
    const r2 = await executeAuthorizedAction(ctx, { permitId: p2 }, { ...execDeps, adapter: a2 });
    assert.equal(r2.status === "refused" ? r2.reason : r2.status, "permit-not-executable", "the spend refuses a suspended agent");
    assert.equal(a2.calls.length, 0);
    assert.equal(await permitStatus(p2), "active", "a refused spend leaves the permit unspent");

    /* ── (3) THAT UNSPENT PERMIT BLOCKS REACTIVATION, UNTIL ITS OWN AUTHORITY ENDS IT ── */
    assert.deepEqual(
      await reactivateDurableAgentIdentity(ctx, { agentId, justification: REACTIVATE }, baseDeps),
      { status: "refused", reason: "agent-has-usable-permits" },
      "an outstanding permit blocks reactivation",
    );
    assert.equal(await permitStatus(p2), "active", "the refusal revokes nothing");
    const revoked = await revokeActionPermit(ctx, { permitId: p2, justification: JUSTIFICATION, revocationReason: "withdrawn while suspended" }, baseDeps);
    assert.equal(revoked.status, "revoked", "a suspended agent's permit can be revoked through its own authority");
    assert.equal((await reactivateDurableAgentIdentity(ctx, { agentId, justification: REACTIVATE }, baseDeps)).status, "reactivated");
    assert.equal(
      (await executeAuthorizedAction(ctx, { permitId: p2 }, { ...execDeps, adapter: a2 })).status,
      "refused",
      "the revoked permit stays dead after reactivation",
    );

    /* ── (4) IN SERVICE: the act still reaches the adapter ── */
    const p4 = await agentPermit();
    const a4 = fakeAdapter({ class: "accepted", providerMessageId: "prov-l2b" });
    const r4 = await executeAuthorizedAction(ctx, { permitId: p4 }, { ...execDeps, adapter: a4 });
    assert.equal(r4.status, "attempted", "an in-service agent's act is dispatched");
    assert.equal(a4.calls.length, 1);

    console.log("l2b dispatch liveness postgres: ok");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
