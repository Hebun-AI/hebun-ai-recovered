/*
 * SELF-IMPROVING-AGENTS-2 — evidence-based agent evaluation, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Every derived figure this evaluation offers is arithmetic over rows that really exist, taken
 *    through the released SIA-1 read — and every figure it declines to offer is declined because
 *    Hebun genuinely holds no record for it. A confirmed failure counts as a confirmed OUTCOME and
 *    never as a success. An agent with no evidence gets UNAVAILABLE, not zero. Another tenant's
 *    activity is invisible. And nothing is written."
 *
 * ── WHY THIS RUNS AGAINST POSTGRESQL ────────────────────────────────────────
 *
 * SIA-2's arithmetic is pure and could be unit-tested against a fake. What cannot be faked is that
 * the numbers it divides came from real rows produced by the real authorities: a fixture that
 * hand-built an observation would agree with a wrong SIA-1 just as happily as with a right one.
 * Every proposal, permit, attempt and invocation below is produced by the released writer that
 * owns it, so the evaluation is measured end-to-end from the database up.
 *
 * Every adapter is a fake injected through the `adapter` dep; no network call is possible and no
 * credential is configured. Uses a disposable local database, dropped on exit.
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
import {
  approveActionRequest,
  rejectActionRequest,
} from "../../src/features/action-authorization/decide-action-request.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import {
  registerInvocation,
  finalizeInvocation,
} from "../../src/features/agent-origination/invocation-provenance.server";
import { readAgentEvaluation } from "../../src/features/agent-evaluation/agent-evaluation-projection.server";
import type {
  AgentEvaluation,
  AgentEvaluationRead,
} from "../../src/features/agent-evaluation/agent-evaluation-projection.server";
import type { DerivedMetric, ObservedMetric } from "../../src/features/agent-evaluation/contracts";
import type { ProviderOutcome, ExternalSendAdapter, SendExternalMessageInput } from "../../src/features/action-execution/adapter-contract";
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

function only(read: AgentEvaluationRead, label: string): AgentEvaluation {
  assert.equal(read.status, "read", `${label}: the evaluation must be readable`);
  if (read.status !== "read") throw new Error("unreachable");
  assert.equal(read.agents.length, 1, `${label}: exactly one durable agent`);
  return read.agents[0]!;
}

const observedOf = (e: AgentEvaluation, key: string): ObservedMetric => {
  const m = e.observed.find((x) => x.key === key);
  assert.ok(m, `observed metric "${key}" exists`);
  return m!;
};
const derivedOf = (e: AgentEvaluation, key: string): DerivedMetric => {
  const m = e.derived.find((x) => x.key === key);
  assert.ok(m, `derived metric "${key}" exists`);
  return m!;
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sia2_evaluation");
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
      companySlug: "acme-sia2",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-sia2",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "sia2-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "sia2-globex");

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

    assert.equal(
      (await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, baseDeps)).status,
      "established",
    );
    assert.equal(
      (await createDurableAgentIdentity(globexCtx, { name: "Globex Agent" }, baseDeps)).status,
      "established",
    );

    const proposerResult = await resolveAgentProposer(acmeCtx, baseDeps);
    assert.equal(proposerResult.status, "resolved");
    if (proposerResult.status !== "resolved") throw new Error("unreachable");
    const proposer = proposerResult.proposer;

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. THE ZERO-EVIDENCE AGENT — UNAVAILABLE, never "0 of 0".
     *
     * Asserted FIRST, before any activity exists. The dangerous failure is a surface that renders
     * a brand-new agent as a perfect or a failing one because a denominator was zero.
     * ═════════════════════════════════════════════════════════════════════ */
    const empty = only(await readAgentEvaluation(acmeCtx, baseDeps), "acme-empty");
    assert.equal(empty.hasNoEvidence, true);
    assert.equal(observedOf(empty, "proposals-filed").value, 0, "zero IS a fact for an observed count");
    for (const m of empty.derived) {
      assert.equal(
        m.availability.state,
        "unavailable",
        `${m.key} must be unavailable for an agent with no evidence`,
      );
    }
    assert.ok(empty.unavailable.length >= 8, "and the unanswerable dimensions are still named");

    /* ═══════════════════════════════════════════════════════════════════════
     * THE FIXTURE. Every row through the released writer that owns it.
     * ═════════════════════════════════════════════════════════════════════ */
    let seq = 0;
    const buildReferences = async (ctx: TenantContext) => {
      seq += 1;
      const recipient = await createExternalRecipient(
        ctx,
        { displayName: `Recipient ${seq}`, endpointKind: "email", endpointValue: `p${seq}@example.com` },
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

    const recordInvocation = async (
      usage: { inputTokens?: number; outputTokens?: number },
      model: { provider: string; model: string } = { provider: "claude", model: "claude-test" },
    ): Promise<string> => {
      const id = await registerInvocation(acmeCtx, { transport: "fake", proposer: proposer }, baseDeps);
      assert.ok(id);
      await finalizeInvocation(
        acmeCtx,
        {
          invocationId: id!,
          state: "selection-valid",
          result: { ...model, ...usage },
          filingOutcome: "proposed",
        },
        baseDeps,
      );
      return id!;
    };

    const agentProposal = async (invocationId?: string): Promise<string> => {
      const refs = await buildReferences(acmeCtx);
      const filed = await proposeAgentOriginatedSendAction(acmeCtx, refs, proposer, baseDeps, invocationId);
      assert.equal(filed.status, "proposed");
      if (filed.status !== "proposed") throw new Error("unreachable");
      return filed.receipt.requestId;
    };

    const approve = async (requestId: string): Promise<string> => {
      const approved = await approveActionRequest(
        acmeCtx,
        { requestId, justification: JUSTIFICATION },
        baseDeps,
      );
      assert.equal(approved.status, "authorized");
      if (approved.status !== "authorized") throw new Error("unreachable");
      return approved.permitId;
    };

    /* (2) PENDING, historical — no invocation provenance at all. */
    await agentProposal();

    /* (11) PENDING, modern — a durable causal link to the model call. */
    await agentProposal(await recordInvocation({ inputTokens: 91, outputTokens: 12 }));

    /* (12) PENDING, partially reported usage — counted, never half-summed. */
    await agentProposal(await recordInvocation({ inputTokens: 7 }));

    /*
     * (4) REJECTED — a governance disposition, not a failure.
     *
     * Through the RELEASED authority, not a raw update. The first attempt here wrote the status
     * directly and PostgreSQL refused it: `heby_action_requests_rejected_chk` requires the decision
     * id and the reason alongside the status. The database enforcing that is exactly why a fixture
     * must go through the writer that owns the row — a hand-built rejection is not a rejection.
     */
    const toReject = await agentProposal(await recordInvocation({ inputTokens: 5, outputTokens: 2 }));
    assert.equal(
      (
        await rejectActionRequest(
          acmeCtx,
          {
            requestId: toReject,
            justification: JUSTIFICATION,
            rejectionReason: "Not the right moment for this outreach.",
          },
          baseDeps,
        )
      ).status,
      "rejected",
    );

    /* (5) APPROVED BUT NEVER EXECUTED — the permit is issued and simply not spent. */
    await approve(await agentProposal(await recordInvocation({ inputTokens: 40, outputTokens: 5 })));

    /* (6,7,8) THREE EXECUTED ACTS, one per terminal provider outcome. */
    const executeWith = async (outcome: ProviderOutcome, inputTokens: number) => {
      const requestId = await agentProposal(await recordInvocation({ inputTokens, outputTokens: 3 }));
      const permitId = await approve(requestId);
      const adapter = fakeAdapter(outcome);
      const result = await executeAuthorizedAction(acmeCtx, { permitId }, { ...execDeps, adapter });
      assert.equal(result.status, "attempted", "an armed, valid execution reaches the adapter");
      if (result.status !== "attempted") throw new Error("unreachable");
      return result.attempt.status;
    };
    assert.equal(await executeWith({ class: "accepted", providerMessageId: "m1" }, 10), "accepted");
    assert.equal(await executeWith({ class: "rejected" }, 20), "failed");
    assert.equal(await executeWith({ class: "ambiguous" }, 30), "unknown");

    /* (9) A REFUSED ATTEMPT — the kill switch flips between the spend and the call.
     *     The permit IS burned and NOTHING is sent, which is a confirmed outcome. */
    {
      const requestId = await agentProposal(
        /* (13) A SECOND PROVIDER/MODEL PAIR, so the distribution is genuinely plural. */
        await recordInvocation({ inputTokens: 15, outputTokens: 4 }, {
          provider: "claude",
          model: "claude-other",
        }),
      );
      const permitId = await approve(requestId);
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
      };
      const adapter = fakeAdapter({ class: "accepted", providerMessageId: "never" });
      const mid = await executeAuthorizedAction(
        acmeCtx,
        { permitId },
        { ...baseDeps, env: ARMED_ENV, repo: flipping, adapter },
      );
      assert.equal(mid.status, "refused-after-spend");
      if (mid.status !== "refused-after-spend") throw new Error("unreachable");
      assert.equal(mid.attempt.status, "refused");
      assert.equal(adapter.calls.length, 0, "nothing was sent");
    }

    /* A HUMAN proposal — must never enter an agent's evaluation. */
    const humanRefs = await buildReferences(acmeCtx);
    assert.equal((await proposeSendAction(acmeCtx, humanRefs, baseDeps)).status, "proposed");

    /* ═══════════════════════════════════════════════════════════════════════
     * THE EVALUATION
     * ═════════════════════════════════════════════════════════════════════ */
    const heby = only(await readAgentEvaluation(acmeCtx, baseDeps), "acme");
    assert.equal(heby.hasNoEvidence, false);

    /* ── OBSERVED FACTS ────────────────────────────────────────────────── */
    assert.equal(observedOf(heby, "proposals-filed").value, 9, "nine agent proposals, human excluded");
    assert.equal(observedOf(heby, "proposals-pending").value, 3);
    assert.equal(observedOf(heby, "governance-approved").value, 5);
    assert.equal(observedOf(heby, "governance-rejected").value, 1);
    assert.equal(observedOf(heby, "execution-attempts").value, 4);
    assert.equal(observedOf(heby, "execution-accepted").value, 1);
    assert.equal(observedOf(heby, "execution-failed").value, 1);
    assert.equal(observedOf(heby, "execution-unknown").value, 1);
    assert.equal(observedOf(heby, "execution-refused").value, 1);
    assert.equal(observedOf(heby, "model-invocations").value, 8);
    assert.equal(observedOf(heby, "model-variants").value, 2, "two provider/model pairs are recorded");

    /* (12) The partially-reported invocation is NOT summed into either total. */
    assert.equal(observedOf(heby, "model-input-tokens").value, 91 + 5 + 40 + 10 + 20 + 30 + 15);
    assert.equal(observedOf(heby, "model-output-tokens").value, 12 + 2 + 5 + 3 + 3 + 3 + 4);

    /* ── DERIVED COVERAGE ──────────────────────────────────────────────── */
    const decision = derivedOf(heby, "decision-coverage");
    assert.equal(decision.availability.state, "available");
    assert.equal(decision.numerator, 6, "five approved plus one rejected — BOTH outcomes count");
    assert.equal(decision.denominator, 9);

    const followThrough = derivedOf(heby, "authorization-follow-through");
    assert.equal(followThrough.numerator, 4, "four of the five authorized acts reached an attempt");
    assert.equal(followThrough.denominator, 5);

    const resolution = derivedOf(heby, "execution-resolution");
    assert.equal(
      resolution.numerator,
      3,
      "accepted + failed + refused — a CONFIRMED FAILURE is a confirmed outcome",
    );
    assert.equal(resolution.denominator, 4, "the unknown attempt is the one without a confirmed outcome");
    assert.notEqual(
      resolution.numerator,
      observedOf(heby, "execution-accepted").value,
      "execution resolution is NOT a success rate — that is the whole point of its numerator",
    );

    const provenance = derivedOf(heby, "provenance-coverage");
    assert.equal(provenance.numerator, 8, "eight proposals name the invocation that caused them");
    assert.equal(provenance.denominator, 9, "and the historical one does not");

    const usage = derivedOf(heby, "usage-reporting-coverage");
    assert.equal(usage.numerator, 7, "seven invocations reported complete usage");
    assert.equal(usage.denominator, 8, "the partially-reported one is counted, never summed");

    /* ── NO SUCCESS SCORE EXISTS, ANYWHERE IN THE ANSWER ───────────────── */
    const serialized = JSON.stringify(heby);
    for (const forbidden of ["successRate", "score", "grade", "percent", "rating"]) {
      assert.ok(!serialized.includes(forbidden), `the evaluation carries no "${forbidden}"`);
    }
    for (const m of heby.derived) {
      assert.ok(
        !Object.keys(m).some((k) => /rate|ratio|percent|score/i.test(k)),
        `${m.key} carries no quotient-shaped field`,
      );
    }

    /* ── NO BUSINESS SUCCESS, NO DELIVERY — DECLARED, NOT OMITTED ──────── */
    const unavailableKeys = heby.unavailable.map((d) => d.key);
    for (const key of ["delivery", "business-outcome", "decision-quality", "correctness"]) {
      assert.ok(unavailableKeys.includes(key), `"${key}" is declared unavailable`);
    }
    const delivery = heby.unavailable.find((d) => d.key === "delivery")!;
    assert.equal(delivery.reason, "no-authoritative-record");
    assert.ok(
      /not the same claim/i.test(delivery.explanation),
      "and it says acceptance is not delivery",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * (14) TENANT ISOLATION — Globex sees its own agent and none of Acme's evidence.
     * ═════════════════════════════════════════════════════════════════════ */
    const globexAgent = only(await readAgentEvaluation(globexCtx, baseDeps), "globex");
    assert.equal(globexAgent.agentName, "Globex Agent");
    assert.equal(globexAgent.hasNoEvidence, true, "Globex's agent has done nothing");
    assert.equal(observedOf(globexAgent, "proposals-filed").value, 0);
    assert.equal(observedOf(globexAgent, "execution-attempts").value, 0);
    assert.equal(observedOf(globexAgent, "model-invocations").value, 0);
    for (const m of globexAgent.derived) {
      assert.equal(m.availability.state, "unavailable", `${m.key} unavailable for Globex`);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * (15) AN UNREADABLE STORE IS UNAVAILABLE, NEVER AN EMPTY EVALUATION.
     * ═════════════════════════════════════════════════════════════════════ */
    const noTenant = await readAgentEvaluation(null, baseDeps);
    assert.equal(noTenant.status, "unavailable");
    assert.equal(
      noTenant.status === "unavailable" ? noTenant.reason : "",
      "no-authorized-tenant-context",
    );
    const noStore = await readAgentEvaluation(acmeCtx, { getDb: () => null });
    assert.equal(noStore.status, "unavailable");

    /* ═══════════════════════════════════════════════════════════════════════
     * THE EVALUATION WROTE NOTHING. Measured, not asserted.
     * ═════════════════════════════════════════════════════════════════════ */
    const census = async () =>
      (
        await setup.query<{ t: string; n: number }>(
          `select 'requests' as t, count(*)::int as n from heby_action_requests
           union all select 'permits', count(*)::int from action_permits
           union all select 'attempts', count(*)::int from action_execution_attempts
           union all select 'invocations', count(*)::int from heby_origination_invocations
           union all select 'agents', count(*)::int from agents
           union all select 'audit', count(*)::int from audit_log
           union all select 'decisions', count(*)::int from decision_records
           union all select 'telemetry', count(*)::int from telemetry_events
           union all select 'learning', count(*)::int from learning_sessions
           union all select 'improvement', count(*)::int from improvement_proposals
           union all select 'memories', count(*)::int from memories
           order by 1`,
        )
      ).rows;

    const before = await census();
    for (let i = 0; i < 5; i += 1) await readAgentEvaluation(acmeCtx, baseDeps);
    assert.deepEqual(await census(), before, "five evaluations changed no row in any table");

    for (const row of before.filter((r) =>
      ["telemetry", "learning", "improvement", "memories"].includes(r.t),
    )) {
      assert.equal(row.n, 0, `${row.t} holds zero rows — the evaluation persists nothing`);
    }

    console.log("sia2-agent-evaluation/evaluation-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
