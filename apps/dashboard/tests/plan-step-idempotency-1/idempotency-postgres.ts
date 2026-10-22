/*
 * PLAN-STEP-IDEMPOTENCY-1 — ONE OPEN PROPOSAL PER AI PLAN STEP, against a REAL disposable database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A verified plan binding's step (`<planRef>#<step>`) is stored on the request by the one writer.
 *    While a proposal for that step is pending or approved, the same step is refused — before any
 *    model call when the origination can see it, and by `heby_action_requests_open_plan_step_uq`
 *    when two submissions race. Another step, another plan, another tenant and an unlinked proposal
 *    are unaffected; a rejected or withdrawn proposal frees the step. A database without the column
 *    refuses: no model call, nothing written."
 *
 * The model is a fake transport whose calls are counted. A test-only binding secret is passed through
 * `env`; no production credential is read. The database is dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest, rejectActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import { allFollowUpSourcesInService } from "../../src/features/organizational-work/follow-up-source-work.server";
import { readOpenPlanStepRequest } from "../../src/features/action-authorization/record-action-request.server";
import {
  PLAN_FOLLOW_UP_BINDING_SECRET_ENV,
  mintPlanFollowUpBinding,
} from "../../src/features/plan-follow-up-provenance/binding.server";
import type { ClaudeTransport } from "../../src/features/heby-model";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the plan step proof.";
const DECIDE = "Decided for the plan step idempotency proof, recorded by the Director.";
const SECRET = "test-only-plan-follow-up-binding-secret-0123456789";
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
  [PLAN_FOLLOW_UP_BINDING_SECRET_ENV]: SECRET,
} as const;
const GOAL = "Create a follow-up task: review the work items declared blocked and find out what would unblock them.";
const ref = (n: number) => `P-${n.toString(16).padStart(12, "0")}`;

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_plan_step_idempotency");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  const n = async (sql: string, args: unknown[] = []) => Number((await setup.query(sql, args)).rows[0]!.n);
  const requests = () => n(`select count(*)::int n from heby_action_requests`);
  const stepRefOf = async (id: string) =>
    (await setup.query<{ r: string | null }>(`select plan_step_ref r from heby_action_requests where id = $1`, [id])).rows[0]!.r;

  const organization = async (slug: string, hashChar: string) => {
    const org = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day', now() + interval '1 day') returning id`,
        [org.authIdentityId, hashChar.repeat(64), org.userId, org.tenantId, org.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: org.tenantId, userId: org.userId, authIdentityId: org.authIdentityId, membershipId: org.membershipId,
      membershipVersion: 1, roleId: org.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: slug, authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, org, agentId, deps, { tag: `${slug}1`, proposalScope: ["record-work"] });
    const work = async (title: string) => {
      const r = await recordWork(ctx, { title }, deps);
      assert.equal(r.status, "recorded", JSON.stringify(r));
      return r.status === "recorded" ? r.workItem.workItemId : "";
    };
    return { org, ctx, work };
  };

  /* The fake model: one record-work selection per call; calls are counted. */
  let calls = 0;
  let titleSeq = 0;
  const transport = (): ClaudeTransport => ({
    async send(request) {
      calls += 1;
      return {
        id: "req_psi1_fake",
        model: request.model,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              kind: "record-work",
              args: { title: `Follow-up ${++titleSeq}`, scope: { kind: "organization-level" } },
              reason: "The plan step asked for a follow-up and nothing records one yet.",
            }),
          },
        ],
        stopReason: "end_turn",
        usage: { inputTokens: 50, outputTokens: 20 },
      };
    },
  });

  try {
    const acme = await organization("psi1-acme", "a");
    const globex = await organization("psi1-globex", "b");
    const [S1, S2] = [await acme.work("Blocked loom repair"), await acme.work("Blocked dye order")];
    const G1 = await globex.work("Globex blocked work");

    const originate = (who: { ctx: TenantContext }, planBinding: unknown) =>
      originateAgentAction(
        { workScope: { kind: "organization" as const }, goal: GOAL, ...(planBinding === undefined ? {} : { planBinding }) },
        {
          resolveTenant: async () => who.ctx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({ transport: transport(), transportProvenance: "fake" }),
          newCorrelationId: () => "corr-psi1",
          agentIdentity: deps,
          candidates: { recipients: deps, artifacts: deps, organization: deps },
          proposal: deps,
          recordWork: deps,
          followUpSourcesInService: (t: TenantContext, ids: readonly string[]) => allFollowUpSourcesInService(handle.db, t.tenantId, ids),
          openPlanStepRequest: (t: TenantContext, r: string) => readOpenPlanStepRequest(t, r, deps),
        } as never,
      );
    const bind = (ctx: TenantContext, planRef: string, step: number, ids: readonly string[]) =>
      mintPlanFollowUpBinding(ctx, { planRef, step, move: "review-blocked", workItemIds: ids }, { env: MODEL_ENV })!;
    const requestIdOf = (r: Awaited<ReturnType<typeof originate>>) => (r.status === "proposed" ? r.proposal.receipt.requestId : "");

    /* ═══ I1. A plan step is proposed once, and the request carries the verified step identity. ═══ */
    const step1 = bind(acme.ctx, ref(1), 1, [S1, S2]);
    const first = await originate(acme, step1);
    assert.equal(first.status, "proposed", `I1 ${JSON.stringify(first)}`);
    const firstId = requestIdOf(first);
    assert.equal(await stepRefOf(firstId), `${ref(1)}#1`, "I1 plan_step_ref is the binding's planRef#step");

    /* ═══ I2. The same step again: refused before any model call; nothing written. ═══ */
    const [c2, r2] = [calls, await requests()];
    const again = await originate(acme, step1);
    assert.equal(again.status === "refused" ? again.reason : again.status, "plan-step-already-proposed", `I2 same step refused ${JSON.stringify(again)}`);
    assert.equal(calls, c2, "I2 no model call for a pre-detected repeat");
    assert.equal(await requests(), r2, "I2 nothing written");
    /* A fresh binding minted for the SAME step (a reload) is the same step. */
    const reminted = await originate(acme, bind(acme.ctx, ref(1), 1, [S1, S2]));
    assert.equal(reminted.status === "refused" ? reminted.reason : reminted.status, "plan-step-already-proposed", "I2 re-minted binding, same step");

    /* ═══ I3. Two concurrent submissions of one step: exactly one is written (the index decides). ═══ */
    const proposer = await resolveAgentProposer(acme.ctx, deps);
    assert.equal(proposer.status, "resolved");
    const agent = proposer.status === "resolved" ? proposer.proposer : null;
    const fileDirect = (title: string, planStepRef: string, sources: readonly string[] = [S1]) =>
      proposeAgentOriginatedRecordWorkAction(
        acme.ctx,
        { workScope: { kind: "organization" as const }, title, department: { kind: "organization-level" } } as never,
        agent!, deps, undefined, undefined, undefined, sources, planStepRef,
      );
    const r3 = await requests();
    const race = await Promise.all([fileDirect("Race A", `${ref(2)}#1`), fileDirect("Race B", `${ref(2)}#1`)]);
    assert.equal(race.filter((r) => r.status === "proposed").length, 1, `I3 exactly one written ${JSON.stringify(race)}`);
    const loser = race.find((r) => r.status !== "proposed");
    assert.equal(loser && "authorityRefusal" in loser ? loser.authorityRefusal : "", "plan-step-already-proposed", "I3 the loser names the step");
    assert.equal(await requests(), r3 + 1, "I3 one row");
    const [c3] = [calls];
    const raceOrig = await Promise.all([originate(acme, bind(acme.ctx, ref(9), 1, [S1])), originate(acme, bind(acme.ctx, ref(9), 1, [S1]))]);
    assert.equal(raceOrig.filter((r) => r.status === "proposed").length, 1, `I3 origination race: one proposal ${JSON.stringify(raceOrig)}`);
    assert.ok(raceOrig.some((r) => r.status === "refused" && r.reason === "plan-step-already-proposed"), `I3 origination race loser named ${JSON.stringify(raceOrig)}`);
    assert.ok(calls - c3 <= 2, "I3 at most one call per submission");

    /* ═══ I4 / I5. Another step of the same plan, and another plan naming the same work, are eligible. ═══ */
    const otherStep = await originate(acme, bind(acme.ctx, ref(1), 2, [S1, S2]));
    assert.equal(otherStep.status, "proposed", "I4 a different step of the same plan, same sources");
    const otherPlan = await originate(acme, bind(acme.ctx, ref(3), 1, [S1, S2]));
    assert.equal(otherPlan.status, "proposed", "I5 a different plan, same sources");

    /* ═══ I6. Tenant isolation: Globex's own plan with the same planRef#step is its own step. ═══ */
    const foreign = await originate(globex, bind(globex.ctx, ref(1), 1, [G1]));
    assert.equal(foreign.status, "proposed", `I6 another tenant is unaffected ${JSON.stringify(foreign)}`);
    assert.equal(await readOpenPlanStepRequest(acme.ctx, `${ref(4)}#1`, deps), "none", "I6 an unused step reads none");

    /* ═══ I7. A rejected proposal frees its step. ═══ */
    const rejected = await rejectActionRequest(acme.ctx, { requestId: firstId, justification: DECIDE, rejectionReason: "Not this one." }, deps);
    assert.equal(rejected.status, "rejected", JSON.stringify(rejected));
    const retried = await originate(acme, step1);
    assert.equal(retried.status, "proposed", "I7 after rejection the same step may be proposed again");

    /* ═══ I8. An approved proposal holds its step (request status, not permit truth). ═══ */
    const approved = await approveActionRequest(acme.ctx, { requestId: requestIdOf(otherStep), justification: DECIDE }, deps);
    assert.equal(approved.status, "authorized");
    const afterApproval = await originate(acme, bind(acme.ctx, ref(1), 2, [S1, S2]));
    assert.equal(afterApproval.status === "refused" ? afterApproval.reason : afterApproval.status, "plan-step-already-proposed", "I8 approved holds the step");

    /* ═══ I9. A withdrawn proposal frees its step (index predicate; no product writer withdraws today). ═══ */
    await setup.query(`update heby_action_requests set status = 'withdrawn' where id = $1`, [requestIdOf(otherPlan)]);
    const afterWithdrawal = await originate(acme, bind(acme.ctx, ref(3), 1, [S1, S2]));
    assert.equal(afterWithdrawal.status, "proposed", "I9 after withdrawal the step is free");

    /* ═══ I10. Unlinked origination is unchanged and carries no step. ═══ */
    const unlinked = await originate(acme, undefined);
    assert.equal(unlinked.status, "proposed", `I10 ${JSON.stringify(unlinked)}`);
    assert.equal(await stepRefOf(requestIdOf(unlinked)), null, "I10 no plan_step_ref");

    /* ═══ I11. The writer and the storage refuse a step that did not come from a plan. ═══ */
    const malformed = await fileDirect("Malformed step", "plan-1#1");
    assert.equal(malformed.status === "refused" && "authorityRefusal" in malformed ? malformed.authorityRefusal : "", "arguments-invalid", "I11 malformed ref");
    const noSources = await proposeAgentOriginatedRecordWorkAction(
      acme.ctx, { workScope: { kind: "organization" as const }, title: "Step without sources", department: { kind: "organization-level" } } as never,
      agent!, deps, undefined, undefined, undefined, undefined, `${ref(5)}#1`,
    );
    assert.equal(noSources.status === "refused" && "authorityRefusal" in noSources ? noSources.authorityRefusal : "", "arguments-invalid", "I11 step without sources");
    await assert.rejects(setup.query(`update heby_action_requests set plan_step_ref = 'x' where id = $1`, [requestIdOf(unlinked)]), /plan_step_ref_chk/, "I11 storage CHECK on shape");
    await assert.rejects(
      setup.query(
        `insert into heby_action_requests select (r).* from (select jsonb_populate_record(null::heby_action_requests,
           to_jsonb(q) || jsonb_build_object('id', gen_random_uuid(), 'payload_digest', repeat('e', 64))) r
           from heby_action_requests q where q.id = $1) s`,
        [requestIdOf(retried)],
      ),
      /open_plan_step_uq/,
      "I11 the index itself refuses a second open row for one step",
    );

    /* ═══ I13. The digest invariant's lost race now reads as `already-pending`, not a persistence failure. ═══ */
    const plainFile = () =>
      proposeAgentOriginatedRecordWorkAction(
        acme.ctx, { workScope: { kind: "organization" as const }, title: "Same exact unlinked work", department: { kind: "organization-level" } } as never,
        agent!, deps,
      );
    const digestRace = await Promise.all([plainFile(), plainFile()]);
    assert.equal(digestRace.filter((r) => r.status === "proposed").length, 1, `I13 one row ${JSON.stringify(digestRace)}`);
    const digestLoser = digestRace.find((r) => r.status !== "proposed");
    assert.equal(digestLoser?.status === "refused" ? digestLoser.reason : "", "already-pending", `I13 ${JSON.stringify(digestLoser)}`);

    /* ═══ I12. Without the column (code ahead of migration 80): refused, no model call, nothing written. ═══ */
    await setup.query(`alter table heby_action_requests drop column plan_step_ref`);
    const [c12, r12] = [calls, await requests()];
    const noSchema = await originate(acme, bind(acme.ctx, ref(7), 1, [S1]));
    assert.equal(noSchema.status === "refused" ? noSchema.reason : noSchema.status, "plan-step-unverifiable", "I12 a plan step on an old schema");
    assert.equal(calls, c12, "I12 no model call");
    assert.equal(await requests(), r12, "I12 nothing written");
    const unlinkedOld = await fileDirect("Linked, no plan step, old schema", undefined as never);
    assert.notEqual(unlinkedOld.status, "proposed", "I12 any proposal fails closed on an old schema");
    assert.equal(await requests(), r12, "I12 still nothing written");

    console.log("PASS plan-step-idempotency-1: I1–I13");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
