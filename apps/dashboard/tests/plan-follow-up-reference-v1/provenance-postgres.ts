/*
 * PLAN-FOLLOW-UP-REFERENCE-V1 — provenance from a signed plan step to the request and the resulting
 * work, against a REAL disposable PostgreSQL database.
 *
 * The model is a fake transport whose every request is captured, so the test proves the origination
 * model never receives a source id, a source title or the binding. A test-only binding secret is
 * passed through `env`; no production credential is read. The database is dropped on exit.
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
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import {
  allFollowUpSourcesInService,
  readWorkFollowUpLinks,
} from "../../src/features/organizational-work/follow-up-source-work.server";
import { readRequestSourceWork } from "../../src/features/action-authorization/request-source-work.server";
import {
  PLAN_FOLLOW_UP_BINDING_SECRET_ENV,
  mintPlanFollowUpBinding,
} from "../../src/features/plan-follow-up-provenance/binding.server";
import type { ClaudeTransport } from "../../src/features/heby-model";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the follow-up proof.";
const APPROVE = "Approved for the plan follow-up provenance proof, recorded by the Director.";
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

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_pfr_provenance");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  const n = async (sql: string, args: unknown[] = []) => Number((await setup.query(sql, args)).rows[0]!.n);
  const requests = () => n(`select count(*)::int n from heby_action_requests`);
  const sourceRows = () => n(`select count(*)::int n from heby_action_request_source_work_items`);
  const followRows = () => n(`select count(*)::int n from work_item_follow_up_sources`);
  const works = () => n(`select count(*)::int n from work_items`);

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

  /* The fake model: returns one record-work selection; every request it receives is kept. */
  const sent: string[] = [];
  const transport = (title: string): ClaudeTransport => ({
    async send(request) {
      sent.push(JSON.stringify(request));
      return {
        id: "req_pfr_fake",
        model: request.model,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              kind: "record-work",
              args: { title, scope: { kind: "organization-level" } },
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
    const acme = await organization("pfr-acme", "a");
    const globex = await organization("pfr-globex", "b");
    const [S1, S2, S3] = [await acme.work("Blocked loom repair"), await acme.work("Blocked dye order"), await acme.work("Retired supplier review")];
    await setup.query(`update work_items set lifecycle_status = 'archived' where id = $1`, [S3]);
    const G1 = await globex.work("Globex private work");

    const originate = (planBinding: unknown, title: string) =>
      originateAgentAction(
        { workScope: { kind: "organization" as const }, goal: GOAL, planBinding },
        {
          resolveTenant: async () => acme.ctx,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({ transport: transport(title), transportProvenance: "fake" }),
          newCorrelationId: () => "corr-pfr",
          agentIdentity: deps,
          candidates: { recipients: deps, artifacts: deps, organization: deps },
          proposal: deps,
          recordWork: deps,
          followUpSourcesInService: (t: TenantContext, ids: readonly string[]) => allFollowUpSourcesInService(handle.db, t.tenantId, ids),
        } as never,
      );
    const bind = (ids: readonly string[], ctx: TenantContext = acme.ctx) =>
      mintPlanFollowUpBinding(ctx, { planRef: "plan-1", step: 1, move: "review-blocked", workItemIds: ids }, { env: MODEL_ENV })!;

    /* ═══ 1. A VALID BINDING: one request, two ordered source rows, atomically, and the model saw neither. ═══ */
    const binding = bind([S1, S2]);
    const linked = await originate(binding, "Unblock the loom and dye work");
    assert.equal(linked.status, "proposed", JSON.stringify(linked));
    const requestId = linked.status === "proposed" ? linked.proposal.receipt.requestId : "";
    const rows = (await setup.query<{ work_item_id: string; ordinal: number; tenant_id: string }>(
      `select work_item_id, ordinal, tenant_id from heby_action_request_source_work_items where action_request_id = $1 order by ordinal`, [requestId],
    )).rows;
    assert.deepEqual(rows.map((r) => [r.work_item_id, r.ordinal]), [[S1, 0], [S2, 1]], "multi-source, in plan order");
    assert.ok(rows.every((r) => r.tenant_id === acme.org.tenantId));

    const model = sent.join("\n");
    for (const leaked of [S1, S2, "Blocked loom repair", "Blocked dye order", binding, binding.split(".")[0]!]) {
      assert.ok(!model.includes(leaked), `the origination model never receives ${leaked.slice(0, 24)}…`);
    }

    /* The payload and digest are the released shape: no source in either. */
    const req = (await setup.query<{ canonical_payload: unknown; payload_digest: string }>(
      `select canonical_payload, payload_digest from heby_action_requests where id = $1`, [requestId],
    )).rows[0]!;
    const payloadText = JSON.stringify(req.canonical_payload);
    assert.ok(!payloadText.includes(S1) && !payloadText.includes(S2), "the authorized payload carries no source");

    /* The same act, unlinked, has the SAME digest: the writer's pending-digest rule refuses it. */
    const resolved = await resolveAgentProposer(acme.ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;
    const [rq0, sr0] = [await requests(), await sourceRows()];
    const twin = await proposeAgentOriginatedRecordWorkAction(
      acme.ctx,
      { workScope: { kind: "organization" as const }, title: "Unblock the loom and dye work", department: { kind: "organization-level" } } as never,
      proposer!,
      deps,
    );
    assert.equal(twin.status, "refused", "an identical unlinked payload is the same digest");
    assert.equal(twin.status === "refused" ? twin.reason : "", "already-pending");
    assert.deepEqual([await requests(), await sourceRows()], [rq0, sr0]);

    /* ═══ 2. INVALID PROVENANCE IS REFUSED BEFORE ANY MODEL CALL AND WRITES NOTHING — NEVER UNLINKED. ═══ */
    const before = { calls: sent.length, rq: await requests(), sr: await sourceRows() };
    const expectRefused = async (planBinding: unknown, reason: string, label: string) => {
      const r = await originate(planBinding, `Must not be filed ${label}`);
      assert.equal(r.status, "refused", label);
      assert.equal(r.status === "refused" ? r.reason : "", reason, label);
      assert.equal(sent.length, before.calls, `${label}: no model call`);
      assert.equal(await requests(), before.rq, `${label}: no request`);
      assert.equal(await sourceRows(), before.sr, `${label}: no source row`);
    };
    const [body, sig] = binding.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), w: [S1, S3] })).toString("base64url");
    await expectRefused(`${forged}.${sig}`, "binding-signature-invalid", "tampered sources");
    await expectRefused("garbage", "binding-malformed", "malformed");
    await expectRefused(bind([S1], globex.ctx), "binding-context-mismatch", "another tenant's binding");
    await expectRefused(bind([G1]), "follow-up-source-ineligible", "a foreign tenant's work, signed for this session");
    await expectRefused(bind([S1, S3]), "follow-up-source-ineligible", "a source no longer in service");
    await expectRefused(
      mintPlanFollowUpBinding(acme.ctx, { planRef: "p", step: 1, move: "review-blocked", workItemIds: [S1] }, { env: MODEL_ENV, now: () => Date.now() - 31 * 60_000 })!,
      "binding-expired",
      "expired",
    );

    /* The request writer re-checks inside its own transaction, so a caller that skips origination is refused too. */
    for (const [label, ids] of [["foreign", [G1]], ["retired", [S1, S3]], ["empty", []]] as const) {
      const r = await proposeAgentOriginatedRecordWorkAction(
        acme.ctx,
        { workScope: { kind: "organization" as const }, title: `Writer guard ${label}`, department: { kind: "organization-level" } } as never,
        proposer!, deps, undefined, undefined, undefined, ids,
      );
      assert.equal(r.status, "refused", label);
      assert.equal(r.status === "refused" ? r.authorityRefusal : "", "follow-up-source-ineligible", `${label}: the writer's own reason`);
      assert.equal(await requests(), before.rq, `${label}: the request row rolled back too`);
      assert.equal(await sourceRows(), before.sr, `${label}: no source row`);
    }

    /* ═══ 3. IMMUTABLE AND TENANT-BOUND IN THE DATABASE ITSELF. ═══ */
    for (const [label, sql] of [
      ["update", `update heby_action_request_source_work_items set work_item_id = '${S3}' where action_request_id = '${requestId}'`],
      ["delete", `delete from heby_action_request_source_work_items where action_request_id = '${requestId}'`],
      ["truncate", `truncate heby_action_request_source_work_items cascade`],
    ] as const) {
      await assert.rejects(setup.query(sql), (e: { code?: string }) => e.code === "23001", `${label} of provenance is refused`);
    }
    await assert.rejects(
      setup.query(
        `insert into heby_action_request_source_work_items (tenant_id, action_request_id, work_item_id, ordinal) values ($1,$2,$3,5)`,
        [acme.org.tenantId, requestId, G1],
      ),
      (e: { code?: string }) => e.code === "23503",
      "a source row naming another tenant's work is a foreign-key violation",
    );
    assert.equal(await sourceRows(), 2);

    /* ═══ 4. READS ARE TENANT-SCOPED. ═══ */
    const acmeRead = await readRequestSourceWork(acme.ctx, [requestId], deps);
    assert.equal(acmeRead.status, "read");
    assert.deepEqual(
      acmeRead.status === "read" ? acmeRead.byRequest.get(requestId)?.map((s) => s.title) : null,
      ["Blocked loom repair", "Blocked dye order"],
    );
    const globexRead = await readRequestSourceWork(globex.ctx, [requestId], deps);
    assert.equal(globexRead.status === "read" ? globexRead.byRequest.size : -1, 0, "another tenant reads nothing of it");

    /* ═══ 5. APPROVE → EXECUTE: the Work authority records the relationship with the work, atomically. ═══ */
    const approval = await approveActionRequest(acme.ctx, { requestId, justification: APPROVE }, deps);
    assert.equal(approval.status, "authorized", JSON.stringify(approval));
    const permitId = approval.status === "authorized" ? approval.permitId : "";
    const executed = await executeRecordWork(acme.ctx, { permitId }, deps);
    assert.equal(executed.status, "executed", JSON.stringify(executed));
    const followUpId = executed.status === "executed" && executed.outcome.status === "recorded" ? executed.outcome.workItem.workItemId : "";
    const links = (await setup.query<{ source_work_item_id: string; action_request_id: string; ordinal: number }>(
      `select source_work_item_id, action_request_id, ordinal from work_item_follow_up_sources where work_item_id = $1 order by ordinal`, [followUpId],
    )).rows;
    assert.deepEqual(links.map((l) => [l.source_work_item_id, l.action_request_id, l.ordinal]), [[S1, requestId, 0], [S2, requestId, 1]]);
    const acmeLinks = await readWorkFollowUpLinks(acme.ctx, deps);
    assert.equal(acmeLinks.status === "read" ? acmeLinks.links.length : -1, 2);
    const globexLinks = await readWorkFollowUpLinks(globex.ctx, deps);
    assert.equal(globexLinks.status === "read" ? globexLinks.links.length : -1, 0, "another tenant reads no relationship");
    await assert.rejects(setup.query(`delete from work_item_follow_up_sources`), (e: { code?: string }) => e.code === "23001");

    /* ═══ 6. REVALIDATION AT SPEND: a source retired after approval refuses execution; the permit survives. ═══ */
    const second = await originate(bind([S2]), "Re-check the dye order");
    assert.equal(second.status, "proposed", JSON.stringify(second));
    const requestId2 = second.status === "proposed" ? second.proposal.receipt.requestId : "";
    const approval2 = await approveActionRequest(acme.ctx, { requestId: requestId2, justification: APPROVE }, deps);
    const permit2 = approval2.status === "authorized" ? approval2.permitId : "";
    await setup.query(`update work_items set lifecycle_status = 'archived' where id = $1`, [S2]);
    const [w0, f0] = [await works(), await followRows()];
    const refused = await executeRecordWork(acme.ctx, { permitId: permit2 }, deps);
    assert.equal(refused.status, "refused");
    assert.equal(refused.status === "refused" ? refused.reason : "", "work-authority-refused");
    assert.equal(refused.status === "refused" ? refused.authorityReason : "", "follow-up-source-ineligible");
    assert.equal((await setup.query(`select status from action_permits where id = $1`, [permit2])).rows[0]!.status, "active", "the permit is not spent");
    assert.deepEqual([await works(), await followRows()], [w0, f0], "no work row and no relationship row");

    /* ═══ 7. HISTORICAL / UNLINKED: an ordinary proposal executes exactly as before, with no relationship. ═══ */
    const plain = await proposeAgentOriginatedRecordWorkAction(
      acme.ctx,
      { workScope: { kind: "organization" as const }, title: "Ordinary unlinked work", department: { kind: "organization-level" } } as never,
      proposer!, deps,
    );
    assert.equal(plain.status, "proposed", JSON.stringify(plain));
    const plainApproval = await approveActionRequest(acme.ctx, { requestId: plain.status === "proposed" ? plain.receipt.requestId : "", justification: APPROVE }, deps);
    const plainExec = await executeRecordWork(acme.ctx, { permitId: plainApproval.status === "authorized" ? plainApproval.permitId : "" }, deps);
    assert.equal(plainExec.status, "executed");
    assert.equal(await followRows(), f0, "an unlinked act records no relationship");

    console.log("plan-follow-up-reference-v1/provenance-postgres: OK");
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
