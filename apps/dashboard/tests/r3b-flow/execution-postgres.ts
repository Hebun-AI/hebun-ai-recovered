/*
 * R3B — First Executed Action, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "One approved authorization can be spent EXACTLY ONCE into EXACTLY ONE external attempt, that
 *    the spend and the attempt are atomic, that a changed world refuses instead of substituting,
 *    that an ambiguous transport answer becomes UNKNOWN rather than a failure, that the provider
 *    idempotency key is the permit's own handoff — AND that no recipient address, no credential
 *    and no message content is written anywhere, no Knowledge or Governance row is created beyond
 *    the permit consumption and its audit, and NO LIVE PROVIDER IS EVER CONTACTED."
 *
 * EVERY ADAPTER HERE IS A FAKE, injected through the `adapter` dep. The real transport is never
 * constructed, no credential is configured, and no network call is possible. Uses a disposable
 * local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createExternalRecipient, retireExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact, retireWorkArtifact, reviseWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import { readExecutionAttempts, readUnreconciledAttempts } from "../../src/features/action-execution/read-execution-attempts.server";
import { readActionPermits } from "../../src/features/action-authorization/read-action-authorizations.server";
import type { ExternalSendAdapter, ProviderOutcome, SendExternalMessageInput } from "../../src/features/action-execution/adapter-contract";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "This external message is a deliberate organizational act and I accept responsibility for it.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

/** Records what it was asked to send, and answers however the test needs. Never touches a socket. */
function fakeAdapter(outcome: ProviderOutcome | (() => Promise<never>)): ExternalSendAdapter & {
  readonly calls: SendExternalMessageInput[];
} {
  const calls: SendExternalMessageInput[] = [];
  return {
    adapterId: "email-https-v1",
    endpointKind: "email",
    calls,
    async send(input) {
      calls.push(input);
      if (typeof outcome === "function") return outcome();
      return outcome;
    },
  };
}

/** The environment an ARMED deployment would have. No real key, no real host, no real vendor. */
const ARMED_ENV = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_ENDPOINT: "https://provider.invalid/send",
});

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

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return {
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
    requestId: "r3b-request",
    authenticatedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3b_execution");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  /** The kill switch, as the durable control would answer. Fail-closed by default. */
  let switchOn = true;
  const control = {
    async getControl() {
      return {
        providerKey: "external-send",
        directorEnabled: switchOn,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      };
    },
    async setDirectorEnabled() {
      throw new Error("not used");
    },
  };
  const execDeps = { ...baseDeps, repo: control, env: ARMED_ENV };

  try {
    const applied = await setup.query<{ n: number }>(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    assert.equal(applied.rows[0]!.n, 29, "the R3B migration is the 29th");

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-r3b",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-r3b",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"));

    const establish = async (seeded: Seeded, ctx: TenantContext) => {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status,
        "established",
      );
    };
    await establish(acme, acmeCtx);
    await establish(globex, globexCtx);

    /**
     * Build a complete, REAL chain: recipient → draft → `/send` proposal → approval → live permit.
     * Nothing is hand-inserted; every row is produced by the production writer that owns it.
     */
    let seq = 0;
    const armPermit = async (
      ctx: TenantContext,
      opts: { recipientEmail?: string; content?: string } = {},
    ): Promise<{ permitId: string; recipientId: string; recipientRef: string; artifactId: string; draftRef: string }> => {
      seq += 1;
      const recipient = await createExternalRecipient(
        ctx,
        {
          displayName: `Recipient ${seq}`,
          endpointKind: "email",
          endpointValue: opts.recipientEmail ?? `person${seq}@example.com`,
        },
        baseDeps,
      );
      assert.equal(recipient.status, "created");
      if (recipient.status !== "created") throw new Error("unreachable");

      const artifact = await createWorkArtifact(
        ctx,
        {
          artifactType: "message-draft",
          title: `Draft ${seq}`,
          content: opts.content ?? `Body of message ${seq}.`,
        },
        "operations",
        baseDeps,
      );
      assert.equal(artifact.status, "created");
      if (artifact.status !== "created") throw new Error("unreachable");

      const proposed = await proposeSendAction(
        ctx,
        { recipientRef: recipient.recipient.recordRef, draftRef: artifact.ref },
        baseDeps,
      );
      assert.equal(proposed.status, "proposed", "the /send inlet must file a real pending request");
      if (proposed.status !== "proposed") throw new Error("unreachable");

      const approved = await approveActionRequest(
        ctx,
        { requestId: proposed.receipt.requestId, justification: JUSTIFICATION },
        baseDeps,
      );
      assert.equal(approved.status, "authorized", "a Governance authority must be able to approve");
      if (approved.status !== "authorized") throw new Error("unreachable");

      return {
        permitId: approved.permitId,
        recipientId: recipient.recipient.id,
        recipientRef: recipient.recipient.recordRef,
        artifactId: artifact.artifactId,
        draftRef: artifact.ref,
      };
    };

    const attemptCount = async (): Promise<number> =>
      (await setup.query<{ n: number }>("select count(*)::int as n from action_execution_attempts"))
        .rows[0]!.n;

    const permitStatus = async (permitId: string): Promise<string> =>
      (await setup.query<{ status: string }>("select status from action_permits where id = $1", [permitId]))
        .rows[0]!.status;

    /* ══════════════════════════════════════════════════════════════════════
     * 1. THE HAPPY PATH — one spend, one attempt, one provider receipt.
     * ════════════════════════════════════════════════════════════════════ */
    const happy = await armPermit(acmeCtx);
    const accepting = fakeAdapter({ class: "accepted", providerMessageId: "prov-msg-001" });
    const result = await executeAuthorizedAction(
      acmeCtx,
      { permitId: happy.permitId },
      { ...execDeps, adapter: accepting },
    );

    assert.equal(
      result.status,
      "attempted",
      `an armed, valid execution reaches the adapter (got ${result.status === "refused" ? result.reason : result.status})`,
    );
    if (result.status !== "attempted") throw new Error("unreachable");
    assert.equal(result.attempt.status, "accepted");
    assert.equal(result.attempt.providerMessageId, "prov-msg-001", "the receipt is persisted");
    assert.equal(result.attempt.providerResponseClass, "accepted");
    assert.equal(result.attempt.failureClass, null);
    assert.equal(await permitStatus(happy.permitId), "consumed", "executing spends the permit");

    /* THE IDEMPOTENCY KEY IS THE PERMIT'S OWN HANDOFF — not a freshly minted token. */
    assert.equal(accepting.calls.length, 1, "exactly one provider call, never a retry loop");
    const handoff = (
      await setup.query<{ handoff_id: string }>("select handoff_id from action_permits where id = $1", [happy.permitId])
    ).rows[0]!.handoff_id;
    assert.equal(
      accepting.calls[0]!.idempotencyKey,
      handoff,
      "the provider idempotency key must be the permit handoff",
    );
    assert.equal(result.attempt.handoffId, handoff, "the attempt is keyed by the same handoff");
    assert.equal(accepting.calls[0]!.endpoint, "person1@example.com", "the adapter gets the real address");
    assert.equal(accepting.calls[0]!.content, "Body of message 1.", "the adapter gets the approved bytes");

    /* THE ADAPTER RECEIVED NOTHING ELSE. */
    assert.deepEqual(
      Object.keys(accepting.calls[0]!).sort(),
      ["content", "endpointKind", "endpoint", "idempotencyKey"].sort(),
      "the adapter receives exactly four scalars — no tenant, session, permit or authority",
    );

    /* ══════════════════════════════════════════════════════════════════════
     * 2. REPLAY. A consumed permit cannot be spent a second time.
     * ════════════════════════════════════════════════════════════════════ */
    const replayAdapter = fakeAdapter({ class: "accepted", providerMessageId: "prov-msg-DUP" });
    const replay = await executeAuthorizedAction(
      acmeCtx,
      { permitId: happy.permitId },
      { ...execDeps, adapter: replayAdapter },
    );
    assert.equal(replay.status, "refused");
    assert.equal(replay.status === "refused" ? replay.reason : "", "permit-not-executable");
    assert.equal(replayAdapter.calls.length, 0, "a replay must never reach the provider");
    assert.equal(await attemptCount(), 1, "a replay creates no second attempt");

    /* ══════════════════════════════════════════════════════════════════════
     * 3. FOREIGN TENANT. Globex cannot execute Acme's permit.
     * ════════════════════════════════════════════════════════════════════ */
    const foreignTarget = await armPermit(acmeCtx);
    const foreignAdapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
    const foreign = await executeAuthorizedAction(
      globexCtx,
      { permitId: foreignTarget.permitId },
      { ...execDeps, adapter: foreignAdapter },
    );
    assert.equal(foreign.status, "refused");
    assert.equal(foreign.status === "refused" ? foreign.reason : "", "permit-not-executable");
    assert.equal(foreignAdapter.calls.length, 0, "a foreign permit must never reach the provider");
    assert.equal(await permitStatus(foreignTarget.permitId), "active", "and it stays spendable");

    /* ══════════════════════════════════════════════════════════════════════
     * 4. REVOKED and 5. EXPIRED. Both refuse, neither creates an attempt.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const revokedTarget = await armPermit(acmeCtx);
      await setup.query(
        `update action_permits set status='revoked', revoked_at=now(),
           revocation_decision_id=governance_decision_id, revocation_reason='withdrawn'
         where id=$1`,
        [revokedTarget.permitId],
      );
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const revoked = await executeAuthorizedAction(
        acmeCtx,
        { permitId: revokedTarget.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(revoked.status === "refused" ? revoked.reason : "", "permit-not-executable");
      assert.equal(adapter.calls.length, 0, "a revoked permit must never reach the provider");
    }
    {
      const expiredTarget = await armPermit(acmeCtx);
      /*
       * Aged in SQL so the DATABASE clock adjudicates, exactly as the spend statement does.
       * `issued_at` moves with it: `action_permits_expiry_after_issue_chk` refuses a permit that
       * expired before it was issued, which is the schema correctly rejecting an impossible row.
       */
      await setup.query(
        `update action_permits
            set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 second'
          where id=$1`,
        [expiredTarget.permitId],
      );
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const expired = await executeAuthorizedAction(
        acmeCtx,
        { permitId: expiredTarget.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(expired.status === "refused" ? expired.reason : "", "permit-not-executable");
      assert.equal(adapter.calls.length, 0, "an expired permit must never reach the provider");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 6. THE KILL SWITCH, BEFORE THE SPEND. The permit stays ACTIVE.
     * ════════════════════════════════════════════════════════════════════ */
    const switchTarget = await armPermit(acmeCtx);
    {
      switchOn = false;
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const off = await executeAuthorizedAction(
        acmeCtx,
        { permitId: switchTarget.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(off.status === "refused" ? off.reason : "", "execution-disabled");
      assert.equal(adapter.calls.length, 0);
      assert.equal(
        await permitStatus(switchTarget.permitId),
        "active",
        "a disabled switch must NOT burn an authorization",
      );
      switchOn = true;
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 7. THE KILL SWITCH, AFTER THE SPEND. The permit IS burned, nothing sent.
     *
     * The switch answers true for the pre-spend read and false for the pre-call read — the exact
     * window a Director reaching for the switch mid-execution lands in.
     * ════════════════════════════════════════════════════════════════════ */
    {
      let reads = 0;
      const flipping = {
        async getControl() {
          reads += 1;
          return {
            providerKey: "external-send",
            directorEnabled: reads === 1,
            version: 1,
            updatedAt: new Date().toISOString(),
            updatedBy: null,
          };
        },
        async setDirectorEnabled() {
          throw new Error("not used");
        },
      };
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const mid = await executeAuthorizedAction(
        acmeCtx,
        { permitId: switchTarget.permitId },
        { ...baseDeps, env: ARMED_ENV, repo: flipping, adapter },
      );
      assert.equal(reads, 2, "the switch is read twice — before the spend and before the call");
      assert.equal(mid.status, "refused-after-spend");
      if (mid.status !== "refused-after-spend") throw new Error("unreachable");
      assert.equal(mid.attempt.status, "refused");
      assert.equal(mid.attempt.failureClass, "execution-disabled");
      assert.equal(mid.attempt.providerResponseClass, null, "no adapter was invoked");
      assert.equal(adapter.calls.length, 0, "nothing was sent");
      assert.equal(await permitStatus(switchTarget.permitId), "consumed");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 8. RETIRED RECIPIENT. Pre-flight catches it; the permit survives.
     *
     * RELEASE-CRITICAL: the R3R row is immutable, so retiring it does NOT change the endpoint
     * digest. The frozen digest still matches. Only `status` can catch this.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await armPermit(acmeCtx);
      const digestBefore = (
        await setup.query<{ endpoint_digest: string }>(
          "select endpoint_digest from external_recipients where id=$1",
          [target.recipientId],
        )
      ).rows[0]!.endpoint_digest;
      assert.equal(
        (await retireExternalRecipient(acmeCtx, { recipientRef: target.recipientRef }, baseDeps)).status,
        "retired",
      );
      const digestAfter = (
        await setup.query<{ endpoint_digest: string }>(
          "select endpoint_digest from external_recipients where id=$1",
          [target.recipientId],
        )
      ).rows[0]!.endpoint_digest;
      assert.equal(digestBefore, digestAfter, "retiring does not change the address bytes");

      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const retired = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(retired.status === "refused" ? retired.reason : "", "recipient-retired");
      assert.equal(adapter.calls.length, 0, "a retired recipient must never reach the provider");
      assert.equal(await permitStatus(target.permitId), "active");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 9. RETIRED ARTIFACT blocks. 10. SUPERSEDED revision still executes.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await armPermit(acmeCtx);
      assert.equal(
        (await retireWorkArtifact(acmeCtx, { artifactId: target.artifactId }, baseDeps)).status,
        "retired",
      );
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const retired = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(retired.status === "refused" ? retired.reason : "", "artifact-retired");
      assert.equal(adapter.calls.length, 0);
    }
    {
      /*
       * THE POLICY, PROVEN. A human approved revision 1's exact bytes. Someone then wrote revision
       * 2. The approval still names revision 1, those bytes are immutable and still readable, and
       * executing must send THEM — not the newer ones, and not nothing.
       */
      const target = await armPermit(acmeCtx, { content: "Original approved body." });
      const revised = await reviseWorkArtifact(
        acmeCtx,
        { artifactId: target.artifactId, content: "A later, unapproved body." },
        baseDeps,
      );
      assert.equal(revised.status, "revised", "a second revision exists");

      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "prov-msg-super" });
      const superseded = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(superseded.status, "attempted", "a superseded exact revision still executes");
      assert.equal(
        adapter.calls[0]!.content,
        "Original approved body.",
        "the APPROVED bytes are sent — never silently upgraded to the newer revision",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 11. DIGEST MISMATCH. Drifted bytes refuse, even though the row resolves.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await armPermit(acmeCtx);
      await setup.query(
        "update work_artifact_revisions set content_digest = repeat('a', 64) where artifact_id=$1 and revision_no=1",
        [target.artifactId],
      );
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const drifted = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(drifted.status === "refused" ? drifted.reason : "", "digest-mismatch");
      assert.equal(adapter.calls.length, 0);
      assert.equal(await permitStatus(target.permitId), "active");
    }
    {
      const target = await armPermit(acmeCtx);
      await setup.query(
        "update external_recipients set endpoint_digest = repeat('b', 64) where id=$1",
        [target.recipientId],
      );
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const drifted = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(drifted.status === "refused" ? drifted.reason : "", "digest-mismatch");
      assert.equal(adapter.calls.length, 0);
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 12. NO CREDENTIAL and 13. NO ENDPOINT. Refuse before the spend.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await armPermit(acmeCtx);
      const noCred = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...baseDeps, repo: control, env: { HEBUN_EXTERNAL_SEND_ENDPOINT: ARMED_ENV.HEBUN_EXTERNAL_SEND_ENDPOINT } },
      );
      assert.equal(noCred.status === "refused" ? noCred.reason : "", "credential-unavailable");
      assert.equal(await permitStatus(target.permitId), "active");

      const noAdapter = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...baseDeps, repo: control, env: {} },
      );
      assert.equal(noAdapter.status === "refused" ? noAdapter.reason : "", "adapter-unavailable");
      assert.equal(await permitStatus(target.permitId), "active");

      /* A non-HTTPS endpoint is treated as absent, never downgraded to plaintext. */
      const insecure = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...baseDeps, repo: control, env: { ...ARMED_ENV, HEBUN_EXTERNAL_SEND_ENDPOINT: "http://provider.invalid/send" } },
      );
      assert.equal(insecure.status === "refused" ? insecure.reason : "", "adapter-unavailable");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 14. PROVIDER REJECTION → failed. 15. PRE-WRITE → failed. 16. AMBIGUOUS → UNKNOWN.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await armPermit(acmeCtx);
      const rejected = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter: fakeAdapter({ class: "rejected" }) },
      );
      assert.equal(rejected.status, "attempted");
      if (rejected.status !== "attempted") throw new Error("unreachable");
      assert.equal(rejected.attempt.status, "failed");
      assert.equal(rejected.attempt.failureClass, "provider-rejected");
      assert.equal(rejected.attempt.providerMessageId, null);
    }
    {
      const target = await armPermit(acmeCtx);
      const unreachable = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter: fakeAdapter({ class: "unreachable" }) },
      );
      assert.equal(unreachable.status, "attempted");
      if (unreachable.status !== "attempted") throw new Error("unreachable");
      assert.equal(unreachable.attempt.status, "failed", "provably pre-write is a clean failure");
      assert.equal(unreachable.attempt.failureClass, "provider-unreachable");
    }
    let unknownAttemptId = "";
    {
      /* THE ONE THAT MATTERS MOST. An ambiguous answer must never become `failed`. */
      const target = await armPermit(acmeCtx);
      const unknown = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter: fakeAdapter({ class: "ambiguous" }) },
      );
      assert.equal(unknown.status, "attempted");
      if (unknown.status !== "attempted") throw new Error("unreachable");
      assert.equal(unknown.attempt.status, "unknown", "post-write ambiguity is UNKNOWN, not failed");
      assert.equal(unknown.attempt.providerResponseClass, "ambiguous");
      assert.equal(unknown.attempt.failureClass, null, "ambiguity is a status, not a failure class");
      assert.equal(unknown.attempt.providerMessageId, null);
      assert.equal(await permitStatus(target.permitId), "consumed", "an unknown outcome still spends");
      unknownAttemptId = unknown.attempt.attemptId;
    }
    {
      /* An adapter that THROWS cannot prove the request never left. Ambiguous, so unknown. */
      const target = await armPermit(acmeCtx);
      const thrown = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        {
          ...execDeps,
          adapter: fakeAdapter(async () => {
            throw new Error("adapter defect");
          }),
        },
      );
      assert.equal(thrown.status, "attempted");
      if (thrown.status !== "attempted") throw new Error("unreachable");
      assert.equal(thrown.attempt.status, "unknown", "a throw after dispatch cannot be called failed");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 17. THE DATABASE REFUSES A SECOND ATTEMPT PER HANDOFF.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const row = await setup.query<{ id: string; tenant_id: string; permit_id: string; handoff_id: string }>(
        "select id, tenant_id, permit_id, handoff_id from action_execution_attempts limit 1",
      );
      const a = row.rows[0]!;
      await assert.rejects(
        setup.query(
          `insert into action_execution_attempts
             (tenant_id, permit_id, handoff_id, action_request_id, action_kind, adapter_id,
              bound_payload_digest, recipient_endpoint_digest, draft_revision_digest, recipient_id, status)
           select tenant_id, permit_id, handoff_id, action_request_id, action_kind, adapter_id,
              bound_payload_digest, recipient_endpoint_digest, draft_revision_digest, recipient_id, 'pending'
           from action_execution_attempts where id = $1`,
          [a.id],
        ),
        /action_execution_attempts_(handoff|permit)_uq/,
        "one handoff yields one attempt — enforced by the database, not by a check-then-insert",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 18. THE CHECK CONSTRAINTS ARE REAL.
     * ════════════════════════════════════════════════════════════════════ */
    {
      /* `accepted` without a message id is unrepresentable. */
      await assert.rejects(
        setup.query(
          "update action_execution_attempts set status='accepted', provider_message_id=null where id=$1",
          [unknownAttemptId],
        ),
        /action_execution_attempts_accepted_chk/,
        "acceptance requires a provider message id",
      );
      /* An ambiguous transport answer can never be downgraded to a clean failure. */
      await assert.rejects(
        setup.query(
          "update action_execution_attempts set status='failed', failure_class='provider-rejected' where id=$1",
          [unknownAttemptId],
        ),
        /action_execution_attempts_unknown_chk/,
        "an ambiguous answer cannot be relabelled as failed",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 19. PRIVACY. No address, no content, no credential — anywhere.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const attempts = await setup.query<Record<string, unknown>>("select * from action_execution_attempts");
      const serialized = JSON.stringify(attempts.rows);
      for (const secret of [
        "person1@example.com",
        "example.com",
        "Body of message",
        "Original approved body",
        ARMED_ENV.HEBUN_EXTERNAL_SEND_API_KEY,
        ARMED_ENV.HEBUN_EXTERNAL_SEND_ENDPOINT,
      ]) {
        assert.ok(
          !serialized.includes(secret),
          `an attempt row must never carry ${secret}`,
        );
      }

      const audits = await setup.query<Record<string, unknown>>(
        "select * from audit_log where entity_type = 'action_execution_attempt'",
      );
      const auditText = JSON.stringify(audits.rows);
      for (const secret of [
        "person1@example.com",
        "example.com",
        "Body of message",
        ARMED_ENV.HEBUN_EXTERNAL_SEND_API_KEY,
        ARMED_ENV.HEBUN_EXTERNAL_SEND_ENDPOINT,
      ]) {
        assert.ok(!auditText.includes(secret), `the audit ledger must never carry ${secret}`);
      }
      assert.ok(
        auditText.includes("externalEffectConfirmed"),
        "the ledger records that attempting is not succeeding",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 20. THE AUDIT EVENT IS WRITTEN EXACTLY ONCE PER ATTEMPT.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const totals = await setup.query<{ attempts: number; events: number }>(
        `select (select count(*)::int from action_execution_attempts) as attempts,
                (select count(*)::int from audit_log
                  where action = 'governance.action.execution.attempted') as events`,
      );
      assert.equal(
        totals.rows[0]!.events,
        totals.rows[0]!.attempts,
        "exactly one execution audit event per attempt — no duplicates, no omissions",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 21. NO KNOWLEDGE, NO WORKFLOW, NO POLICY, NO PERMISSION MUTATION.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const counts = await setup.query<Record<string, number>>(
        `select (select count(*)::int from knowledge_nodes) as k_nodes,
                (select count(*)::int from knowledge_facts) as k_facts,
                (select count(*)::int from knowledge_edges) as k_edges,
                (select count(*)::int from memories) as memories,
                (select count(*)::int from workflows) as workflows,
                (select count(*)::int from policies) as policies,
                (select count(*)::int from permissions) as permissions,
                (select count(*)::int from role_permissions) as role_permissions,
                (select count(*)::int from executions) as legacy_executions,
                (select count(*)::int from commands) as commands,
                (select count(*)::int from agents) as agents,
                (select count(*)::int from notifications) as notifications`,
      );
      for (const [table, n] of Object.entries(counts.rows[0]!)) {
        assert.equal(n, 0, `R3B must create no ${table} row`);
      }
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 22. THE GOVERNANCE LEDGER GAINED NOTHING BEYOND PERMIT CONSUMPTION.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const decisions = await setup.query<{ decision_type: string; n: number }>(
        "select decision_type, count(*)::int as n from decision_records group by 1 order by 1",
      );
      /* Only bootstrap + one approval per armed permit. Executing writes NO decision record. */
      for (const row of decisions.rows) {
        assert.ok(
          ["approve", "promote", "certify", "reject", "revoke"].includes(row.decision_type),
          `unexpected decision type ${row.decision_type}`,
        );
      }
      const revocations = await setup.query<{ n: number }>(
        "select count(*)::int as n from decision_records where outcome = 'action-authorization-revoked'",
      );
      assert.equal(revocations.rows[0]!.n, 0, "executing never revokes anything");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 23. THE READ SURFACES. Tenant-scoped, and reconciliation is a human list.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const acmeAttempts = await readExecutionAttempts(acmeCtx, baseDeps);
      assert.equal(acmeAttempts.status, "read");
      if (acmeAttempts.status !== "read") throw new Error("unreachable");
      assert.ok(acmeAttempts.items.length > 0);

      const globexAttempts = await readExecutionAttempts(globexCtx, baseDeps);
      assert.equal(globexAttempts.status, "read");
      if (globexAttempts.status !== "read") throw new Error("unreachable");
      assert.equal(globexAttempts.items.length, 0, "another tenant sees none of these attempts");

      const unreconciled = await readUnreconciledAttempts(acmeCtx, baseDeps);
      assert.equal(unreconciled.status, "read");
      if (unreconciled.status !== "read") throw new Error("unreachable");
      assert.ok(
        unreconciled.items.every((i) => i.status === "unknown" || i.status === "pending"),
        "reconciliation lists only what a human must resolve",
      );
      assert.ok(
        unreconciled.items.some((i) => i.attemptId === unknownAttemptId),
        "the unknown attempt is surfaced for reconciliation",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 24. THE PERMIT SURFACE DERIVES EXECUTION, IT NO LONGER ASSERTS IT.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const permits = await readActionPermits(acmeCtx, baseDeps);
      assert.equal(permits.status, "read");
      if (permits.status !== "read") throw new Error("unreachable");

      const executed = permits.items.find((p) => p.permitId === happy.permitId);
      assert.equal(executed?.executionStatus, "accepted");
      assert.equal(executed?.providerAccepted, true);
      assert.equal(executed?.providerMessageId, "prov-msg-001");

      const neverRun = permits.items.find((p) => p.permitId === foreignTarget.permitId);
      assert.equal(neverRun?.executionStatus, null, "an unspent permit has no attempt");
      assert.equal(neverRun?.providerAccepted, false);

      /* UNKNOWN is never reported as provider acceptance. */
      assert.ok(
        permits.items.every((p) => p.executionStatus !== "unknown" || p.providerAccepted === false),
        "an unknown outcome must never claim provider acceptance",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 25. A NON-EXECUTABLE ACTION KIND REFUSES BY NAME.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await armPermit(acmeCtx);
      await setup.query("update heby_action_requests set action_kind='restart-workflow' where id = (select action_request_id from action_permits where id=$1)", [target.permitId]);
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const wrongKind = await executeAuthorizedAction(
        acmeCtx,
        { permitId: target.permitId },
        { ...execDeps, adapter },
      );
      assert.equal(wrongKind.status === "refused" ? wrongKind.reason : "", "action-not-executable");
      assert.equal(adapter.calls.length, 0, "an unexecutable kind never reaches an adapter");
      assert.equal(await permitStatus(target.permitId), "active");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 26. UNAUTHENTICATED. No session, no execution.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "nope" });
      const anon = await executeAuthorizedAction(null, { permitId: happy.permitId }, { ...execDeps, adapter });
      assert.equal(anon.status === "refused" ? anon.reason : "", "unauthenticated");
      assert.equal(adapter.calls.length, 0);
    }

    console.log("R3B execution (postgres): all assertions passed.");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
