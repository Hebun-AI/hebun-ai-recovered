/*
 * SELF-IMPROVING-AGENTS-1 — agent outcome observation, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "For each durable agent this tenant owns, Hebun can say exactly what became of what that agent
 *    proposed — proposed, authorized, permitted, executed, accepted, failed and unknown counted as
 *    SEVEN separate facts and never folded into one — while a proposal filed before invocation
 *    provenance existed stays honestly unproven, another tenant's activity is invisible, an agent
 *    that has done nothing reports zeros rather than vanishing, and nothing is written."
 *
 * ── WHY THIS IS PROVEN AGAINST POSTGRESQL AND NOT A FAKE ────────────────────
 *
 * Three of the things that can go wrong here are properties of the database, not of the
 * TypeScript, and a fake would have agreed with a wrong implementation on all three:
 *
 *   1. `count()` and `sum()` come back as STRINGS from the node-postgres driver, so a projection
 *      that forgot to parse them would render "0" or concatenate.
 *   2. `count(*) filter (where ...)` restricts the count, and getting the filter wrong produces a
 *      plausible number rather than an error.
 *   3. The tenant predicates on both sides of every join are what make a cross-tenant read
 *      impossible; a fake has no other tenant to leak from.
 *
 * EVERY ROW IS PRODUCED BY THE RELEASED WRITER THAT OWNS IT. No proposal, permit or attempt is
 * hand-inserted, so the fixture cannot manufacture a combination the real authorities cannot
 * produce. Every adapter is a fake injected through the `adapter` dep; no network call is possible
 * and no credential is configured. Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import {
  proposeSendAction,
  proposeAgentOriginatedSendAction,
} from "../../src/features/heby-action-inlet/send-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import {
  registerInvocation,
  finalizeInvocation,
} from "../../src/features/agent-origination/invocation-provenance.server";
import { readAgentOutcomeObservation } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import type {
  AgentOutcomeObservation,
  AgentOutcomeObservationRead,
} from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { isExpiredPermit } from "../../src/features/agent-outcome-observation/contracts";
import { derivePermitState } from "../../src/features/action-authorization/read-action-authorizations.server";
import type {
  ExternalSendAdapter,
  ProviderOutcome,
  SendExternalMessageInput,
} from "../../src/features/action-execution/adapter-contract";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "This external message is a deliberate organizational act and I accept responsibility for it.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function fakeAdapter(outcome: ProviderOutcome): ExternalSendAdapter & {
  readonly calls: SendExternalMessageInput[];
} {
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

const ARMED_ENV = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "Test subject, never configured for real",
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

/** The one agent in a read, asserted to exist so a missing agent fails loudly rather than as NaN. */
function only(read: AgentOutcomeObservationRead, label: string): AgentOutcomeObservation {
  assert.equal(read.status, "read", `${label}: the observation must be readable`);
  if (read.status !== "read") throw new Error("unreachable");
  assert.equal(read.agents.length, 1, `${label}: exactly one durable agent`);
  return read.agents[0]!;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sia1_outcomes");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  const control = {
    async getControl() {
      return {
        providerKey: "external-send",
        directorEnabled: true,
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      };
    },
  };
  const execDeps = { ...baseDeps, repo: control, env: ARMED_ENV };

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-sia1",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-sia1",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "sia1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "sia1-globex");

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

    /* Both organizations own exactly one durable agent. Globex's will never do anything. */
    assert.equal(
      (await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, baseDeps)).status,
      "established",
    );
    assert.equal(
      (await createDurableAgentIdentity(globexCtx, { name: "Globex Agent" }, baseDeps)).status,
      "established",
    );

    const acmeProposerResult = await resolveAgentProposer(acmeCtx, baseDeps);
    assert.equal(acmeProposerResult.status, "resolved", "Acme's agent may be recorded as proposer");
    if (acmeProposerResult.status !== "resolved") throw new Error("unreachable");
    const acmeProposer = acmeProposerResult.proposer;

    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE ZERO-ROW AGENT — a real identity that has done nothing.
     *
     * Asserted FIRST, before any activity exists, because the interesting failure is the one where
     * an agent with no facts falls out of the join and the surface silently shows fewer agents than
     * the organization owns.
     * ═════════════════════════════════════════════════════════════════════ */
    const emptyAcme = only(await readAgentOutcomeObservation(acmeCtx, baseDeps), "acme-empty");
    assert.equal(emptyAcme.agentName, "Heby");
    assert.equal(emptyAcme.inService, true);
    assert.equal(emptyAcme.activity.proposalsFiled, 0, "a new agent has proposed nothing");
    assert.equal(emptyAcme.governance.approved, 0);
    assert.equal(emptyAcme.governance.permitsIssued, 0);
    assert.equal(emptyAcme.execution.attempts, 0);
    assert.equal(emptyAcme.modelUsage.linkedInvocations, 0);
    assert.equal(emptyAcme.modelUsage.inputTokens, 0, "no invocation is not a token total of NaN");
    assert.equal(emptyAcme.provenance.proposalsWithInvocation, 0);
    assert.equal(emptyAcme.provenance.proposalsWithoutInvocation, 0);
    assert.deepEqual(emptyAcme.modelUsage.distribution, []);

    /* ═══════════════════════════════════════════════════════════════════════
     * THE FIXTURE. Every row through the released writer that owns it.
     * ═════════════════════════════════════════════════════════════════════ */
    let seq = 0;
    const buildReferences = async (ctx: TenantContext) => {
      seq += 1;
      const recipient = await createExternalRecipient(
        ctx,
        {
          displayName: `Recipient ${seq}`,
          endpointKind: "email",
          endpointValue: `person${seq}@example.com`,
        },
        baseDeps,
      );
      assert.equal(recipient.status, "created");
      if (recipient.status !== "created") throw new Error("unreachable");
      const artifact = await createWorkArtifact(
        ctx,
        { artifactType: "message-draft", title: `Draft ${seq}`, content: `Body ${seq}.` },
        "operations",
        baseDeps,
      );
      assert.equal(artifact.status, "created");
      if (artifact.status !== "created") throw new Error("unreachable");
      return { recipientRef: recipient.recipient.recordRef, draftRef: artifact.ref };
    };

    /** A model invocation as AGENT-PROPOSAL-4B records one, with real provider-reported usage. */
    const recordInvocation = async (
      ctx: TenantContext,
      usage: { inputTokens?: number; outputTokens?: number },
    ): Promise<string> => {
      const id = await registerInvocation(ctx, { transport: "fake" }, baseDeps);
      assert.ok(id, "an invocation must register");
      await finalizeInvocation(
        ctx,
        {
          invocationId: id!,
          state: "selection-valid",
          result: { provider: "claude", model: "claude-test", ...usage },
          filingOutcome: "proposed",
        },
        baseDeps,
      );
      return id!;
    };

    /** An agent proposal, optionally carrying the invocation that caused it. */
    const agentProposal = async (invocationId?: string): Promise<string> => {
      const refs = await buildReferences(acmeCtx);
      const filed = await proposeAgentOriginatedSendAction(
        acmeCtx,
        refs,
        acmeProposer,
        baseDeps,
        invocationId,
      );
      assert.equal(filed.status, "proposed", "the inlet must file a real agent proposal");
      if (filed.status !== "proposed") throw new Error("unreachable");
      return filed.receipt.requestId;
    };

    const approve = async (requestId: string): Promise<string> => {
      const approved = await approveActionRequest(
        acmeCtx,
        { requestId, justification: JUSTIFICATION },
        baseDeps,
      );
      assert.equal(approved.status, "authorized", "a Governance authority must be able to approve");
      if (approved.status !== "authorized") throw new Error("unreachable");
      return approved.permitId;
    };

    /* 1. A HISTORICAL proposal — filed with no invocation record, exactly as every proposal
     *    filed before AGENT-PROPOSAL-4B was. Left PENDING. */
    const historical = await agentProposal();

    /* 2. A MODERN proposal, causally linked to the invocation that produced it. Left PENDING. */
    const modernInvocation = await recordInvocation(acmeCtx, {
      inputTokens: 91,
      outputTokens: 12,
    });
    const modern = await agentProposal(modernInvocation);

    /* 2b. A PARTIALLY REPORTED INVOCATION. The provider returned an input count and no output
     *     count, which is a real shape: both token columns are independently nullable. It is
     *     COUNTED as unreported and excluded from BOTH sums — never half-summed. Left PENDING. */
    const partialInvocation = await recordInvocation(acmeCtx, { inputTokens: 7 });
    await agentProposal(partialInvocation);

    /* 3. APPROVED BUT NEVER EXECUTED — the permit is issued and simply not spent. */
    const unexecutedInvocation = await recordInvocation(acmeCtx, {
      inputTokens: 40,
      outputTokens: 5,
    });
    const unexecuted = await agentProposal(unexecutedInvocation);
    const unexecutedPermit = await approve(unexecuted);

    /* 4-6. THREE EXECUTED ACTS, one per terminal outcome the transport can produce. */
    const executeWith = async (outcome: ProviderOutcome, usage: { inputTokens: number }) => {
      const invocation = await recordInvocation(acmeCtx, {
        inputTokens: usage.inputTokens,
        outputTokens: 3,
      });
      const requestId = await agentProposal(invocation);
      const permitId = await approve(requestId);
      const adapter = fakeAdapter(outcome);
      const result = await executeAuthorizedAction(
        acmeCtx,
        { permitId },
        { ...execDeps, adapter },
      );
      assert.equal(
        result.status,
        "attempted",
        `an armed, valid execution reaches the adapter (got ${
          result.status === "refused" ? result.reason : result.status
        })`,
      );
      if (result.status !== "attempted") throw new Error("unreachable");
      return result.attempt.status;
    };

    assert.equal(
      await executeWith({ class: "accepted", providerMessageId: "prov-msg-sia1" }, { inputTokens: 10 }),
      "accepted",
    );
    assert.equal(
      await executeWith({ class: "rejected" }, { inputTokens: 20 }),
      "failed",
    );
    assert.equal(
      await executeWith({ class: "ambiguous" }, { inputTokens: 30 }),
      "unknown",
    );

    /* 7. A HUMAN proposal. It must never appear in an agent's counts. */
    const humanRefs = await buildReferences(acmeCtx);
    const humanFiled = await proposeSendAction(acmeCtx, humanRefs, baseDeps);
    assert.equal(humanFiled.status, "proposed");

    /* 8. AN INVOCATION THAT PRODUCED NO PROPOSAL. Nobody owns it, and it is not lost. */
    const orphan = await registerInvocation(acmeCtx, { transport: "fake" }, baseDeps);
    assert.ok(orphan);
    await finalizeInvocation(
      acmeCtx,
      { invocationId: orphan!, state: "no-action", filingOutcome: "not-attempted" },
      baseDeps,
    );

    /* 9. Another organization's activity, so isolation is tested against real rows and not silence. */
    const globexProposerResult = await resolveAgentProposer(globexCtx, baseDeps);
    assert.equal(globexProposerResult.status, "resolved");
    if (globexProposerResult.status !== "resolved") throw new Error("unreachable");
    const globexRefs = await buildReferences(globexCtx);
    const globexFiled = await proposeAgentOriginatedSendAction(
      globexCtx,
      globexRefs,
      globexProposerResult.proposer,
      baseDeps,
    );
    assert.equal(globexFiled.status, "proposed");

    /* ═══════════════════════════════════════════════════════════════════════
     * THE OBSERVATION
     * ═════════════════════════════════════════════════════════════════════ */
    const acmeRead = await readAgentOutcomeObservation(acmeCtx, baseDeps);
    const heby = only(acmeRead, "acme");
    assert.equal(acmeRead.status, "read");
    if (acmeRead.status !== "read") throw new Error("unreachable");

    /* ── ACTIVITY: six agent proposals, and the human one is NOT among them ── */
    assert.equal(heby.activity.proposalsFiled, 7, "seven agent-originated proposals, human excluded");
    assert.equal(
      heby.activity.pending,
      3,
      "the historical, the modern and the partially-reported one are still pending",
    );
    assert.equal(heby.activity.withdrawn, 0);

    /* ── GOVERNANCE: approved is FOUR, executed is THREE, and the gap is stated ── */
    assert.equal(heby.governance.approved, 4);
    assert.equal(heby.governance.rejected, 0);
    assert.equal(heby.governance.permitsIssued, 4, "one permit per approval");
    assert.equal(heby.governance.permitsConsumed, 3, "three permits were spent");
    assert.equal(heby.governance.permitsActive, 1, "the unspent permit is still live");
    assert.equal(heby.governance.permitsExpired, 0);
    assert.equal(heby.governance.permitsRevoked, 0);
    assert.equal(
      heby.governance.approvedWithoutExecution,
      1,
      "APPROVED IS NOT EXECUTED — one authorized act never happened",
    );

    /* ── EXECUTION: three attempts, three different outcomes, never folded ── */
    assert.equal(heby.execution.attempts, 3);
    assert.equal(heby.execution.accepted, 1);
    assert.equal(heby.execution.failed, 1);
    assert.equal(heby.execution.unknown, 1, "UNKNOWN is counted as itself, never as a failure");
    assert.equal(heby.execution.refused, 0);
    assert.equal(heby.execution.pending, 0);
    assert.notEqual(
      heby.execution.failed,
      heby.execution.failed + heby.execution.unknown,
      "a failure count that included unknown would be the most dangerous number here",
    );

    /* ── MODEL USAGE: linked invocations only, tokens a lower bound ── */
    assert.equal(heby.modelUsage.linkedInvocations, 6, "six proposals name an invocation");
    assert.equal(
      heby.modelUsage.inputTokens,
      91 + 40 + 10 + 20 + 30,
      "input tokens are summed from FULLY reported invocations only",
    );
    assert.equal(heby.modelUsage.outputTokens, 12 + 5 + 3 + 3 + 3);
    /*
     * THE PARTIAL INVOCATION IS COUNTED, NEVER HALF-SUMMED.
     *
     * Its 7 input tokens are deliberately absent from the total above. Including them while its
     * output half stayed missing would produce a total that is short in one dimension and complete
     * in the other, with nothing on the surface saying which. The row is excluded from both sums
     * and declared here instead, which is what makes the totals a strict LOWER BOUND.
     */
    assert.equal(
      heby.modelUsage.invocationsWithoutReportedUsage,
      1,
      "the partially-reported invocation is counted as not fully reported",
    );
    assert.notEqual(
      heby.modelUsage.inputTokens,
      91 + 40 + 10 + 20 + 30 + 7,
      "a partially-reported invocation must not contribute its reported half to a total",
    );
    assert.deepEqual(
      heby.modelUsage.distribution.map((b) => ({ ...b })),
      [{ provider: "claude", model: "claude-test", invocations: 6 }],
      "the provider/model breakdown counts every linked invocation, reported usage or not",
    );

    /* THE ORPHAN INVOCATION IS COUNTED, AND BELONGS TO NOBODY. */
    assert.equal(
      acmeRead.unattributedInvocations,
      1,
      "an invocation no proposal names is reported, not silently dropped",
    );
    assert.equal(acmeRead.unresolvedAgentProposals, 0, "every agent proposal resolved to an identity");

    /* ── PROVENANCE COVERAGE: the historical proposal stays unproven ── */
    assert.equal(heby.provenance.proposalsWithInvocation, 6);
    assert.equal(
      heby.provenance.proposalsWithoutInvocation,
      1,
      "the pre-provenance proposal is reported as unproven, never repaired",
    );
    assert.equal(
      heby.provenance.proposalsWithInvocation + heby.provenance.proposalsWithoutInvocation,
      heby.activity.proposalsFiled,
      "coverage partitions the proposals — every one is either proven or not",
    );

    /* NOTHING WAS BACKFILLED: the historical row still carries a null link in the database. */
    const stillNull = await setup.query<{ n: number }>(
      `select count(*)::int as n from heby_action_requests
        where id = $1 and origination_invocation_id is null`,
      [historical],
    );
    assert.equal(stillNull.rows[0]!.n, 1, "reading never wrote a link the record did not have");
    const stillLinked = await setup.query<{ id: string | null }>(
      "select origination_invocation_id as id from heby_action_requests where id = $1",
      [modern],
    );
    assert.equal(stillLinked.rows[0]!.id, modernInvocation, "and never moved one that existed");

    /* ═══════════════════════════════════════════════════════════════════════
     * TENANT ISOLATION — Globex sees its own agent, and none of Acme's numbers.
     * ═════════════════════════════════════════════════════════════════════ */
    const globexRead = await readAgentOutcomeObservation(globexCtx, baseDeps);
    const globexAgent = only(globexRead, "globex");
    assert.equal(globexAgent.agentName, "Globex Agent");
    assert.equal(globexAgent.activity.proposalsFiled, 1, "Globex sees exactly its own proposal");
    assert.equal(globexAgent.execution.attempts, 0, "and none of Acme's three attempts");
    assert.equal(globexAgent.modelUsage.linkedInvocations, 0, "and none of Acme's invocations");
    assert.equal(globexAgent.modelUsage.inputTokens, 0);
    assert.equal(
      globexRead.status === "read" ? globexRead.unattributedInvocations : -1,
      0,
      "and not Acme's orphan invocation either",
    );

    /* And Acme still cannot see Globex: its agent count is one, not two. */
    assert.equal(acmeRead.agents.length, 1, "Acme sees one agent — its own");

    /* ═══════════════════════════════════════════════════════════════════════
     * THE EXPIRY RULE IS THE RELEASED ONE — proved against a real permit row.
     *
     * The aggregate restates `derivePermitState` in SQL because a TypeScript function is not
     * reachable from inside PostgreSQL. R6B's rule then applies: the two spellings need an
     * equivalence proof, not a comment. This drives the SQL past the real boundary with the same
     * row, and the pure-mirror equivalence is proven exhaustively in the firewall suite.
     * ═════════════════════════════════════════════════════════════════════ */
    const expiry = await setup.query<{ expires_at: Date }>(
      "select expires_at from action_permits where id = $1",
      [unexecutedPermit],
    );
    const expiresAt = expiry.rows[0]!.expires_at;
    const afterExpiry = new Date(expiresAt.getTime() + 1_000);

    const expiredRead = await readAgentOutcomeObservation(acmeCtx, {
      ...baseDeps,
      now: () => afterExpiry,
    });
    const expiredHeby = only(expiredRead, "acme-after-expiry");
    assert.equal(
      expiredHeby.governance.permitsActive,
      0,
      "past its expiry the unspent permit is no longer active",
    );
    assert.equal(expiredHeby.governance.permitsExpired, 1, "it is expired, derived from the clock");
    assert.equal(
      expiredHeby.governance.permitsConsumed,
      3,
      "and the spent permits stay consumed — terminal states outrank the clock",
    );
    assert.equal(
      derivePermitState("active", expiresAt, afterExpiry),
      "expired",
      "the released display rule agrees with the aggregate on this exact row",
    );
    assert.equal(isExpiredPermit("active", expiresAt, afterExpiry), true);
    assert.equal(isExpiredPermit("consumed", expiresAt, afterExpiry), false);

    /* ═══════════════════════════════════════════════════════════════════════
     * THE BOUND ON THE ONLY BOUNDED READ IS DISCLOSED.
     * ═════════════════════════════════════════════════════════════════════ */
    const bounded = await readAgentOutcomeObservation(acmeCtx, {
      ...baseDeps,
      distributionLimit: 1,
    });
    assert.equal(bounded.status, "read");
    if (bounded.status !== "read") throw new Error("unreachable");
    assert.equal(bounded.distributionLimit, 1, "the surface states the bound it applied");
    assert.equal(
      bounded.distributionTruncated,
      true,
      "a breakdown that filled its bound says so rather than reading as the whole record",
    );
    /* AND THE BOUND CANNOT SHORTEN A TOTAL. Every count above it is unbounded. */
    assert.equal(bounded.agents[0]!.modelUsage.linkedInvocations, 6);
    assert.equal(bounded.agents[0]!.activity.proposalsFiled, 7);

    /* ═══════════════════════════════════════════════════════════════════════
     * UNREADABLE IS NOT EMPTY, AND NO TENANT IS NO ANSWER.
     * ═════════════════════════════════════════════════════════════════════ */
    const noTenant = await readAgentOutcomeObservation(null, baseDeps);
    assert.equal(noTenant.status, "unavailable");
    assert.equal(
      noTenant.status === "unavailable" ? noTenant.reason : "",
      "no-authorized-tenant-context",
    );
    const noStore = await readAgentOutcomeObservation(acmeCtx, { getDb: () => null });
    assert.equal(noStore.status, "unavailable", "an unreadable store never renders as no agents");

    /* ═══════════════════════════════════════════════════════════════════════
     * THE READ WROTE NOTHING. Measured, not asserted.
     * ═════════════════════════════════════════════════════════════════════ */
    const censusBefore = await setup.query<{ t: string; n: number }>(
      `select 'requests' as t, count(*)::int as n from heby_action_requests
       union all select 'permits', count(*)::int from action_permits
       union all select 'attempts', count(*)::int from action_execution_attempts
       union all select 'invocations', count(*)::int from heby_origination_invocations
       union all select 'agents', count(*)::int from agents
       union all select 'audit', count(*)::int from audit_log
       union all select 'decisions', count(*)::int from decision_records
       order by 1`,
    );
    for (let i = 0; i < 5; i += 1) await readAgentOutcomeObservation(acmeCtx, baseDeps);
    const censusAfter = await setup.query<{ t: string; n: number }>(
      `select 'requests' as t, count(*)::int as n from heby_action_requests
       union all select 'permits', count(*)::int from action_permits
       union all select 'attempts', count(*)::int from action_execution_attempts
       union all select 'invocations', count(*)::int from heby_origination_invocations
       union all select 'agents', count(*)::int from agents
       union all select 'audit', count(*)::int from audit_log
       union all select 'decisions', count(*)::int from decision_records
       order by 1`,
    );
    assert.deepEqual(
      censusAfter.rows,
      censusBefore.rows,
      "five observations changed no row in any authoritative table",
    );

    /* The dead tables stay dead: the read revived none of them. */
    const dead = await setup.query<{ t: string; n: number }>(
      `select 'memories' as t, count(*)::int as n from memories
       union all select 'telemetry', count(*)::int from telemetry_events
       union all select 'improvement', count(*)::int from improvement_proposals
       union all select 'learning', count(*)::int from learning_sessions
       union all select 'workflows', count(*)::int from workflows
       order by 1`,
    );
    for (const row of dead.rows) {
      assert.equal(row.n, 0, `${row.t} must still hold zero rows after the observation`);
    }

    console.log("sia1-agent-outcomes/observation-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
