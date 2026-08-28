/*
 * SELF-IMPROVING-AGENTS-2.6 — origination attribution, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Every model call made on a durable agent's behalf is now durably attributed to it — including
 *    the calls that produce NO proposal, which are the only evidence Hebun holds about the part of
 *    the work the agent itself controls. Historical rows stay NULL for ever. Attribution and
 *    causation agree because they come from one resolved proposer. Another tenant's agent cannot
 *    be named. And attribution grants nothing."
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no credential.
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { proposeAgentOriginatedSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import {
  resolveAgentProposer,
  type AgentProposer,
} from "../../src/features/action-authorization/agent-proposer.server";
import {
  registerInvocation,
  finalizeInvocation,
} from "../../src/features/agent-origination/invocation-provenance.server";
import { readAgentOutcomeObservation } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { readAgentEvaluation } from "../../src/features/agent-evaluation/agent-evaluation-projection.server";
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sia26_attribution");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE MIGRATION IS APPLIED AND ADDITIVE.
     * ═════════════════════════════════════════════════════════════════════ */
    const column = await setup.query<{ is_nullable: string; data_type: string }>(
      `select is_nullable, data_type from information_schema.columns
        where table_name = 'heby_origination_invocations' and column_name = 'agent_id'`,
    );
    assert.equal(column.rows.length, 1, "the attribution column exists");
    assert.equal(column.rows[0]!.is_nullable, "YES", "and it is NULLABLE — history must stay honest");
    assert.equal(column.rows[0]!.data_type, "uuid");

    const fk = await setup.query<{ n: number }>(
      `select count(*)::int as n from information_schema.table_constraints
        where constraint_name = 'heby_origination_invocations_tenant_agent_fk'
          and constraint_type = 'FOREIGN KEY'`,
    );
    assert.equal(fk.rows[0]!.n, 1, "the composite tenant-safe foreign key exists");

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-sia26",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-sia26",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "sia26-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "sia26-globex");

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
        (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status,
        "established",
      );
    }

    assert.equal(
      (await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, baseDeps)).status,
      "established",
    );
    assert.equal(
      (await createDurableAgentIdentity(globexCtx, { name: "Globex Agent" }, baseDeps)).status,
      "established",
    );

    const resolve = async (ctx: TenantContext): Promise<AgentProposer> => {
      const r = await resolveAgentProposer(ctx, baseDeps);
      assert.equal(r.status, "resolved");
      if (r.status !== "resolved") throw new Error("unreachable");
      return r.proposer;
    };
    const acmeProposer = await resolve(acmeCtx);
    const globexProposer = await resolve(globexCtx);

    const acmeAgentId = (
      await setup.query<{ id: string }>("select id from agents where tenant_id = $1", [acme.tenantId])
    ).rows[0]!.id;
    assert.equal(acmeProposer.agentId, acmeAgentId, "the proposer names the tenant's own agent");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. A HISTORICAL ROW — written the way rows were written before this phase.
     *
     * Inserted directly BECAUSE no released writer can produce one any more: the writer now
     * requires a proposer. That is the point of the fixture — it manufactures the past so the
     * present can be proved to leave it alone.
     * ═════════════════════════════════════════════════════════════════════ */
    const historical = (
      await setup.query<{ id: string }>(
        `insert into heby_origination_invocations
           (tenant_id, transport, state, filing_outcome, created_by, created_by_type)
         values ($1, 'fake', 'selection-invalid', 'not-attempted', $2, 'human')
         returning id`,
        [acme.tenantId, acme.userId],
      )
    ).rows[0]!.id;

    const agentIdOf = async (id: string): Promise<string | null> =>
      (
        await setup.query<{ agent_id: string | null }>(
          "select agent_id from heby_origination_invocations where id = $1",
          [id],
        )
      ).rows[0]!.agent_id;

    assert.equal(await agentIdOf(historical), null, "a historical row has no attribution");

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. EVERY MODERN REGISTRATION IS ATTRIBUTED — whatever becomes of it.
     * ═════════════════════════════════════════════════════════════════════ */
    const register = async (ctx: TenantContext, proposer: AgentProposer): Promise<string> => {
      const id = await registerInvocation(ctx, { transport: "fake", proposer }, baseDeps);
      assert.ok(id, "registration returns an id");
      return id!;
    };

    /* 2a. selection-invalid — no proposal is ever filed, and it is STILL attributed. */
    const invalid = await register(acmeCtx, acmeProposer);
    await finalizeInvocation(
      acmeCtx,
      { invocationId: invalid, state: "selection-invalid", filingOutcome: "not-attempted" },
      baseDeps,
    );
    assert.equal(await agentIdOf(invalid), acmeAgentId, "an invalid selection is attributed");

    /* 2b. no-action */
    const noAction = await register(acmeCtx, acmeProposer);
    await finalizeInvocation(
      acmeCtx,
      { invocationId: noAction, state: "no-action", filingOutcome: "not-attempted" },
      baseDeps,
    );
    assert.equal(await agentIdOf(noAction), acmeAgentId, "a no-action call is attributed");

    /* 2c. dispatch-failed */
    const dispatchFailed = await register(acmeCtx, acmeProposer);
    await finalizeInvocation(
      acmeCtx,
      {
        invocationId: dispatchFailed,
        state: "dispatch-failed",
        failureCode: "unknown-provider-error",
        filingOutcome: "not-attempted",
      },
      baseDeps,
    );
    assert.equal(await agentIdOf(dispatchFailed), acmeAgentId, "a failed dispatch is attributed");

    /* 2d. not-dispatched */
    const notDispatched = await register(acmeCtx, acmeProposer);
    await finalizeInvocation(
      acmeCtx,
      { invocationId: notDispatched, state: "not-dispatched", filingOutcome: "not-attempted" },
      baseDeps,
    );
    assert.equal(await agentIdOf(notDispatched), acmeAgentId, "an undispatched call is attributed");

    /* 2e. registered and never finalized — the UNKNOWN outcome. Still attributed. */
    const stranded = await register(acmeCtx, acmeProposer);
    assert.equal(await agentIdOf(stranded), acmeAgentId, "a stranded call is attributed");

    /* 2f. a filing REFUSAL — a selection was made and the inlet declined it. */
    const refused = await register(acmeCtx, acmeProposer);
    await finalizeInvocation(
      acmeCtx,
      {
        invocationId: refused,
        state: "selection-valid",
        filingOutcome: "refused",
        filingRefusal: "already-pending",
      },
      baseDeps,
    );
    assert.equal(await agentIdOf(refused), acmeAgentId, "a refused filing is attributed");

    /* 2g. THE SUCCESSFUL PATH — a real proposal, through the released inlet. */
    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe", endpointKind: "email", endpointValue: "ayse@example.test" },
      baseDeps,
    );
    assert.equal(recipient.status, "created");
    if (recipient.status !== "created") throw new Error("unreachable");
    const artifact = await createWorkArtifact(
      acmeCtx,
      { artifactType: "message-draft", title: "Summary", content: "Merhaba." },
      "operations",
      baseDeps,
    );
    assert.equal(artifact.status, "created");
    if (artifact.status !== "created") throw new Error("unreachable");

    const proposedInvocation = await register(acmeCtx, acmeProposer);
    const filed = await proposeAgentOriginatedSendAction(
      acmeCtx,
      { recipientRef: recipient.recipient.recordRef, draftRef: artifact.ref },
      acmeProposer,
      baseDeps,
      proposedInvocation,
    );
    assert.equal(filed.status, "proposed");
    if (filed.status !== "proposed") throw new Error("unreachable");
    await finalizeInvocation(
      acmeCtx,
      { invocationId: proposedInvocation, state: "selection-valid", filingOutcome: "proposed" },
      baseDeps,
    );
    assert.equal(await agentIdOf(proposedInvocation), acmeAgentId);

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. ATTRIBUTION AND CAUSATION AGREE — because they are one resolution used twice.
     * ═════════════════════════════════════════════════════════════════════ */
    const pair = await setup.query<{ invocation_agent: string; proposal_agent: string }>(
      `select i.agent_id as invocation_agent, r.proposed_by_actor_id as proposal_agent
         from heby_origination_invocations i
         join heby_action_requests r on r.origination_invocation_id = i.id
        where i.id = $1`,
      [proposedInvocation],
    );
    assert.equal(pair.rows.length, 1);
    assert.equal(
      pair.rows[0]!.invocation_agent,
      pair.rows[0]!.proposal_agent,
      "the invocation's attribution and the proposal's proposer are the same agent",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. NO HISTORICAL BACKFILL — reading never repairs the past.
     * ═════════════════════════════════════════════════════════════════════ */
    for (let i = 0; i < 3; i += 1) {
      await readAgentOutcomeObservation(acmeCtx, baseDeps);
      await readAgentEvaluation(acmeCtx, baseDeps);
    }
    assert.equal(
      await agentIdOf(historical),
      null,
      "six reads did not backfill the historical row — the past stays as it was",
    );
    const nullCount = await setup.query<{ n: number }>(
      `select count(*)::int as n from heby_origination_invocations
        where tenant_id = $1 and agent_id is null`,
      [acme.tenantId],
    );
    assert.equal(nullCount.rows[0]!.n, 1, "exactly the one historical row remains unattributed");

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. CROSS-TENANT ATTRIBUTION IS A DATABASE ERROR, NOT A BUG TO NOTICE.
     *
     * Registering Acme's invocation with GLOBEX's proposer is the deliberate misuse. The composite
     * foreign key makes the row unwritable, so the writer returns null and no row appears.
     * ═════════════════════════════════════════════════════════════════════ */
    const before = await setup.query<{ n: number }>(
      "select count(*)::int as n from heby_origination_invocations",
    );
    const crossTenant = await registerInvocation(
      acmeCtx,
      { transport: "fake", proposer: globexProposer },
      baseDeps,
    );
    assert.equal(crossTenant, null, "a cross-tenant attribution cannot be registered");
    const after = await setup.query<{ n: number }>(
      "select count(*)::int as n from heby_origination_invocations",
    );
    assert.equal(after.rows[0]!.n, before.rows[0]!.n, "and no row was written");

    /* A FORGED BRAND IS REFUSED BEFORE THE DATABASE IS EVEN REACHED. */
    const forged = await registerInvocation(
      acmeCtx,
      { transport: "fake", proposer: { agentId: acmeAgentId } as unknown as AgentProposer },
      baseDeps,
    );
    assert.equal(forged, null, "a proposer manufactured with a cast is refused by the runtime brand");
    const afterForged = await setup.query<{ n: number }>(
      "select count(*)::int as n from heby_origination_invocations",
    );
    assert.equal(afterForged.rows[0]!.n, before.rows[0]!.n, "and it wrote nothing either");

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. SIA-1 NOW OBSERVES THE SELECTION OUTCOMES.
     * ═════════════════════════════════════════════════════════════════════ */
    const observation = await readAgentOutcomeObservation(acmeCtx, baseDeps);
    assert.equal(observation.status, "read");
    if (observation.status !== "read") throw new Error("unreachable");
    const heby = observation.agents[0]!;

    assert.equal(heby.selection.attributed, 7, "seven attributed calls — the historical one is not");
    assert.equal(heby.selection.selectionInvalid, 1);
    assert.equal(heby.selection.noAction, 1);
    assert.equal(heby.selection.dispatchFailed, 1);
    assert.equal(heby.selection.notDispatched, 1);
    assert.equal(heby.selection.registered, 1, "the stranded call is UNKNOWN, not a failure");
    assert.equal(heby.selection.selectionValid, 2, "the refused filing and the proposed one");
    assert.equal(heby.selection.filingRefused, 1);
    assert.equal(heby.selection.filingProposed, 1);
    assert.equal(heby.selection.filingNotAttempted, 5);

    /* NO CLASS IS COLLAPSED — the six states partition the attributed calls exactly. */
    assert.equal(
      heby.selection.registered +
        heby.selection.notDispatched +
        heby.selection.dispatchFailed +
        heby.selection.selectionInvalid +
        heby.selection.noAction +
        heby.selection.selectionValid,
      heby.selection.attributed,
      "the state counts partition the attributed calls",
    );

    /* THE RELEASED PROPOSAL-LINKED METRIC IS UNCHANGED — it answers a different question. */
    assert.equal(
      heby.modelUsage.linkedInvocations,
      1,
      "exactly one invocation is NAMED by a proposal, which is what that metric has always meant",
    );

    /* HISTORICAL TRUTH AND INTEGRITY ARE REPORTED, NOT HIDDEN. */
    assert.equal(observation.historicallyUnattributedInvocations, 1);
    assert.equal(observation.attributionConflicts, 0, "attribution and causation never disagree");

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. A CONFLICT WOULD BE SURFACED, NOT SILENTLY RESOLVED.
     *
     * Forced by hand, because the released seam cannot produce one. The point is what the READ
     * does when the database nonetheless holds a disagreement.
     * ═════════════════════════════════════════════════════════════════════ */
    const secondAgent = (
      await setup.query<{ id: string }>(
        `insert into agents (tenant_id, name, created_by, created_by_type)
         values ($1, 'Second', $2, 'human') returning id`,
        [acme.tenantId, acme.userId],
      )
    ).rows[0]!.id;
    await setup.query(
      "update heby_origination_invocations set agent_id = $1 where id = $2",
      [secondAgent, proposedInvocation],
    );
    const conflicted = await readAgentOutcomeObservation(acmeCtx, baseDeps);
    assert.equal(conflicted.status, "read");
    if (conflicted.status !== "read") throw new Error("unreachable");
    assert.equal(
      conflicted.attributionConflicts,
      1,
      "a disagreement between attribution and causation is COUNTED, never arbitrated away",
    );
    /* Restore, so the remaining assertions read the honest fixture. */
    await setup.query("update heby_origination_invocations set agent_id = $1 where id = $2", [
      acmeAgentId,
      proposedInvocation,
    ]);
    await setup.query("delete from agents where id = $1", [secondAgent]);

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. TENANT ISOLATION — Globex sees none of it.
     * ═════════════════════════════════════════════════════════════════════ */
    const globexRead = await readAgentOutcomeObservation(globexCtx, baseDeps);
    assert.equal(globexRead.status, "read");
    if (globexRead.status !== "read") throw new Error("unreachable");
    assert.equal(globexRead.agents.length, 1);
    assert.equal(globexRead.agents[0]!.selection.attributed, 0, "Globex sees none of Acme's calls");
    assert.equal(globexRead.historicallyUnattributedInvocations, 0);

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. SIA-2 CONSUMES IT — as observed counts and ONE coverage measure.
     * ═════════════════════════════════════════════════════════════════════ */
    const evaluation = await readAgentEvaluation(acmeCtx, baseDeps);
    assert.equal(evaluation.status, "read");
    if (evaluation.status !== "read") throw new Error("unreachable");
    const evaluated = evaluation.agents[0]!;

    const observedOf = (key: string) => {
      const m = evaluated.observed.find((x) => x.key === key);
      assert.ok(m, `observed metric "${key}" exists`);
      return m!;
    };
    assert.equal(observedOf("selection-attributed").value, 7);
    assert.equal(observedOf("selection-invalid").value, 1);
    assert.equal(observedOf("selection-no-action").value, 1);
    assert.equal(observedOf("selection-outcome-unrecorded").value, 1);
    assert.equal(observedOf("filing-refused").value, 1);

    const coverage = evaluated.derived.find((d) => d.key === "selection-outcome-coverage")!;
    assert.ok(coverage, "the derived coverage measure exists");
    assert.equal(coverage.availability.state, "available");
    assert.equal(
      coverage.numerator,
      6,
      "six of seven calls have a KNOWN outcome — invalid and failed included",
    );
    assert.equal(coverage.denominator, 7);
    assert.notEqual(
      coverage.numerator,
      observedOf("selection-valid").value,
      "it is NOT a validity rate — a known failure is a known outcome",
    );

    /* NO SCORE APPEARED. */
    const serialized = JSON.stringify(evaluated);
    for (const forbidden of ["successRate", "score", "grade", "percent"]) {
      assert.ok(!serialized.includes(forbidden), `the evaluation still carries no "${forbidden}"`);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. THE READS WROTE NOTHING, AND NO DEAD TABLE WOKE UP.
     * ═════════════════════════════════════════════════════════════════════ */
    const census = async () =>
      (
        await setup.query<{ t: string; n: number }>(
          `select 'invocations' as t, count(*)::int as n from heby_origination_invocations
           union all select 'requests', count(*)::int from heby_action_requests
           union all select 'agents', count(*)::int from agents
           union all select 'permits', count(*)::int from action_permits
           union all select 'attempts', count(*)::int from action_execution_attempts
           union all select 'audit', count(*)::int from audit_log
           union all select 'telemetry', count(*)::int from telemetry_events
           union all select 'learning', count(*)::int from learning_sessions
           union all select 'improvement', count(*)::int from improvement_proposals
           union all select 'memories', count(*)::int from memories
           order by 1`,
        )
      ).rows;
    const beforeReads = await census();
    for (let i = 0; i < 4; i += 1) {
      await readAgentOutcomeObservation(acmeCtx, baseDeps);
      await readAgentEvaluation(acmeCtx, baseDeps);
    }
    assert.deepEqual(await census(), beforeReads, "eight reads changed no row anywhere");
    for (const row of beforeReads.filter((r) =>
      ["telemetry", "learning", "improvement", "memories"].includes(r.t),
    )) {
      assert.equal(row.n, 0, `${row.t} is still empty`);
    }
    assert.equal(
      beforeReads.find((r) => r.t === "permits")!.n,
      0,
      "attribution minted no permit — attribution is not authority",
    );
    assert.equal(
      beforeReads.find((r) => r.t === "attempts")!.n,
      0,
      "and executed nothing",
    );

    console.log("sia26-origination-attribution/attribution-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
