/*
 * P5-5 — the weekly agent task, end to end. Real disposable PostgreSQL, the released writers, the REAL live
 * Claude transport over a counting fetch. No network.
 *
 *   W1  the kill switch off: nothing runs, nothing is read or written
 *   W2  authorized: one internal draft, authored by the agent, filed for review; the request carries the
 *       brief, the template lead and the agent's role (fenced), and declares conversation, work-artifact
 *       and agent-mandate; no external act
 *   W3  one run per tenant per template per ISO week: a second tick the same week asks nothing
 *   W4  the next week runs again
 *   W5  refused before the model, the ledger records why: authorization withdrawn, plan downgraded to Free,
 *       Claude control off, live without an own key, data use not authorized for the role
 *   W6  a Free plan cannot be granted a weekly task; nothing is written
 *   W7  the two templates are independent lineages and independent weeks
 *   W8  the ISO week in Istanbul
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { admitAiDispatch } from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { recordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { authorizeExternalAiDisclosure } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { authorizeStandingAgentTask, withdrawStandingAgentTask } from "../../src/features/standing-agent-task/standing-agent-task.server";
import { scanScheduledAgentTasks, type ScheduledAgentTaskDeps } from "../../src/features/standing-agent-task/scheduled-agent-task.server";
import { istanbulIsoWeek } from "../../src/features/standing-agent-task/templates";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-haiku-4-5-20251001",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
} as const;
const DRAFT = "Monday: post the kilim restoration story on Instagram. Wednesday: [product] care tips. Friday: [owner] to review.";
const BRIEF = "Plan three posts that show how our handwoven rugs are restored and cared for.";
const ROLE = "Prepare content drafts for this organization's channels — captions, posts and short copy — for a person to review.";
const APPROVE = "I have read this proposal and authorize it for the weekly agent task proof.";
const MANDATE = "Bounding what this agent may do for the weekly agent task proof.";
const GRANT = "This test organization agrees that its requests and agent roles may be processed by the reviewed assistant processor.";
const REASON = "Authorizing a weekly content plan for the P5-5 proof.";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRow(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, createHash("sha256").update(tag).digest("hex"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

const contextFor = (s: Seeded, sessionContextId: string): TenantContext =>
  asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId: "p5-5-request", authenticatedAt: new Date().toISOString(),
  });

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("p5-5-scheduled-agent-task/scheduled-agent-task-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  /* ── W8 · the ISO week in Istanbul ── */
  assert.equal(istanbulIsoWeek(new Date("2026-11-23T05:00:00Z")), "2026-W48", "W8: Monday 23 Nov 2026");
  assert.equal(istanbulIsoWeek(new Date("2026-11-29T20:59:00Z")), "2026-W48", "W8: Sunday 23:59 Istanbul is still W48");
  assert.equal(istanbulIsoWeek(new Date("2026-11-29T21:00:00Z")), "2026-W49", "W8: Monday 00:00 Istanbul is W49");
  assert.equal(istanbulIsoWeek(new Date("2027-01-01T12:00:00Z")), "2026-W53", "W8: 1 Jan 2027 belongs to 2026's last week");

  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  const harness = createDisposablePostgresHarness("hebun_p5_5_agent_task");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const n = async (sql: string, params: unknown[] = []) => Number((await q<{ n: number }>(sql, params))[0]!.n);

  try {
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: REVIEWED_RECORD_REF, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await q<{ id: string }>(`select id from processor_attestations`))[0]!.id;
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-p55", email: "director@acme-p55.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "p55-acme"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });

    /* ── an agent with a draft mandate (the P5-3 Content template's scope), organization work, data use ── */
    const created = await createDurableAgentIdentity(acme, { name: "Content Agent", justification: "Register the content agent for the P5-5 proof." }, dbDeps);
    const agentId = created.status === "established" ? created.identity.agentId : "";
    const m = await establishAgentMandateWithResponsibility(
      acme,
      { agentId, purpose: ROLE, proposalScope: ["set-work-declared-state"], justification: MANDATE, observedMandateRevision: null, responsibility: [{ kind: "organization" }] },
      dbDeps,
    );
    assert.equal(m.status, "established", JSON.stringify(m));
    const p = await proposeRecordWorkAction(acme, { title: "Weekly content", department: { kind: "organization-level" }, workScope: { kind: "organization" } } as never, dbDeps);
    const a = await approveActionRequest(acme, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
    const e = await executeRecordWork(acme, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
    const workItemId = e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
    assert.ok(workItemId, "work recorded");
    const assistance = (classes: string[]) =>
      authorizeTenantExternalAiDataUse(acme, { attestationId, scopes: classes.map((dataClass) => ({ purpose: "assistance", dataClass })), justification: GRANT, observedRevision: null } as never, dbDeps);
    const grant = await assistance(["conversation", "knowledge", "work-artifact", "agent-mandate"]);
    assert.equal(grant.status, "written", JSON.stringify(grant));

    /* ── W6 · Free cannot be granted one ── */
    const authorize = (template: string, observed: number | null) =>
      authorizeStandingAgentTask(acme, { template, workItemId, agentId, title: "Weekly content plan", brief: BRIEF, justification: REASON, observedAuthorizationRevision: observed }, { getDb: () => handle.db });
    await setup.query(`update companies set plan = 'free' where id = $1`, [acmeSeed.tenantId]);
    assert.deepEqual(await authorize("weekly-content-plan", null), { status: "refused", reason: "plan-schedule-not-included" }, "W6: Free refused");
    assert.equal(await n(`select count(*)::int n from standing_agent_task_authorizations`), 0, "W6: nothing written");
    await setup.query(`update companies set plan = 'founding' where id = $1`, [acmeSeed.tenantId]);
    const granted = await authorize("weekly-content-plan", null);
    assert.equal(granted.status, "authorized", JSON.stringify(granted));

    /* ── the model: the REAL live transport over a counting, simulated fetch ── */
    let fetches = 0;
    const wire: string[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      fetches++;
      wire.push(String(init.body));
      return new Response(
        JSON.stringify({ id: `msg_p55_${fetches}`, type: "message", role: "assistant", model: ENV.HEBUN_MODEL_ID, content: [{ type: "text", text: DRAFT }], stop_reason: "end_turn", usage: { input_tokens: 40, output_tokens: 30 } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const gate = (d: Parameters<typeof authorizeExternalAiDisclosure>[0], o: boolean | null, m2: string) => authorizeExternalAiDisclosure(d, o, m2, dbDeps);
    let switchState = false;
    let now = new Date("2026-11-23T05:00:00Z");
    const deps = (over: Partial<ScheduledAgentTaskDeps> = {}): ScheduledAgentTaskDeps => ({
      getDb: () => handle.db,
      env: ENV,
      now: () => now,
      readSwitch: async () => switchState,
      resolveClaudeEnabled: async () => true,
      authorizeDisclosure: gate,
      selectTransport: async () => ({ transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(99), fetchImpl }), transportProvenance: "live" as const }),
      generationDeps: {
        resolveOperatorEnabled: async () => true,
        authorizeDisclosure: gate,
        recordDisclosure: (ev) => recordExternalAiDisclosureDecision(ev, dbDeps),
        admitDispatch: (input, d) => admitAiDispatch(input, { ...d, getDb: () => handle.db }),
      },
      ...over,
    });
    const world = async () => ({
      fetches,
      drafts: await n(`select count(*)::int n from work_artifacts where artifact_type = 'operational-plan'`),
      runs: await n(`select count(*)::int n from scheduled_agent_task_runs`),
    });
    const lastRun = async () => (await q<{ status: string; failure_reason: string | null; period_key: string; template: string }>(
      `select status, failure_reason, period_key, template from scheduled_agent_task_runs order by claimed_at desc, id desc limit 1`,
    ))[0]!;
    const week = () => { now = new Date(now.getTime() + 7 * 24 * 3600 * 1000); };
    const failsBeforeModel = async (label: string, expected: string, over: Partial<ScheduledAgentTaskDeps> = {}) => {
      const before = await world();
      const r = await scanScheduledAgentTasks(deps(over));
      assert.equal(r.status, "scanned", `${label}: ${JSON.stringify(r)}`);
      const mine = r.status === "scanned" ? r.outcomes.find((o) => o.template === "weekly-content-plan") : undefined;
      assert.equal(mine?.status === "failed" ? mine.reason : JSON.stringify(mine), expected, label);
      const after = await world();
      assert.equal(after.fetches, before.fetches, `${label}: zero dispatch`);
      assert.equal(after.drafts, before.drafts, `${label}: nothing filed`);
      assert.deepEqual([(await lastRun()).status, (await lastRun()).failure_reason], ["failed", expected], `${label}: the ledger records why`);
      week();
    };

    /* ── W1 · switch off ── */
    {
      const before = await world();
      assert.deepEqual(await scanScheduledAgentTasks(deps()), { status: "disabled" }, "W1: off");
      assert.deepEqual(await world(), before, "W1: nothing written, nothing asked");
    }
    switchState = true;

    /* ── W2 · one draft, filed for review ── */
    {
      const before = await world();
      const r = await scanScheduledAgentTasks(deps());
      assert.equal(r.status, "scanned", JSON.stringify(r));
      if (r.status !== "scanned") throw new Error("unreachable");
      assert.equal(r.periodKey, "2026-W48");
      assert.equal(r.considered, 1);
      const filed = r.outcomes[0]!;
      assert.equal(filed.status, "filed", JSON.stringify(filed));
      if (filed.status !== "filed") throw new Error("unreachable");
      const after = await world();
      assert.equal(after.fetches - before.fetches, 1, "W2: one model call");
      assert.equal(after.drafts - before.drafts, 1, "W2: one internal draft");
      assert.deepEqual(
        (await q<{ status: string; artifact_id: string }>(`select status, artifact_id from scheduled_agent_task_runs where id = $1`, [filed.runId]))[0],
        { status: "filed", artifact_id: filed.artifactId },
        "W2: the run ledger records the filed draft",
      );
      const row = (await q<{ content: string; authored_by_actor_type: string; authored_by_actor_id: string }>(
        `select r.content, r.authored_by_actor_type, r.authored_by_actor_id from work_artifact_revisions r where r.artifact_id = $1`,
        [filed.artifactId],
      ))[0]!;
      assert.equal(row.content, DRAFT, "W2: the model's text stored verbatim");
      assert.deepEqual([row.authored_by_actor_type, row.authored_by_actor_id], ["agent", agentId], "W2: authored by the agent");
      const review = await q<{ n: number }>(`select count(*)::int n from artifact_review_decisions where artifact_id = $1`, [filed.artifactId]).catch(() => [{ n: 0 }]);
      assert.equal(review[0]!.n, 0, "W2: waiting for review — no decision");
      const sent = JSON.parse(wire.at(-1)!) as { system: string; messages: { role: string; content: string }[] };
      assert.match(sent.messages.at(-1)!.content, /content plan for the week 2026-W48/, "W2: the template lead");
      assert.ok(sent.messages.at(-1)!.content.includes(BRIEF), "W2: the organization's brief");
      assert.ok(sent.system.includes(`--- AGENT ROLE BEGINS ---\n${ROLE}\n--- AGENT ROLE ENDS ---`), "W2: the agent's role, fenced");
      const declared = (await q<{ m: { declaredDataClasses: string[] } }>(
        `select metadata as m from audit_log where action = 'external-ai.disclosure.authorized' and tenant_id = $1 order by occurred_at desc limit 1`,
        [acmeSeed.tenantId],
      ))[0]?.m.declaredDataClasses;
      assert.deepEqual([...(declared ?? [])].sort(), ["agent-mandate", "conversation", "work-artifact"], "W2: the declared classes");
      assert.equal(await n(`select count(*)::int n from heby_action_requests where tenant_id = $1`, [acmeSeed.tenantId]), 1, "W2: no action proposed by the run (the one request is the test's own work recording)");
    }

    /* ── W3 · the same week runs once ── */
    {
      const before = await world();
      const r = await scanScheduledAgentTasks(deps());
      assert.equal(r.status === "scanned" ? r.outcomes[0]!.status : r.status, "already-run", "W3: already run this week");
      assert.deepEqual(await world(), before, "W3: nothing asked, nothing written");
    }

    /* ── W4 · next week runs again ── */
    week();
    {
      const r = await scanScheduledAgentTasks(deps());
      assert.equal(r.status === "scanned" ? r.outcomes[0]!.status : r.status, "filed", "W4: next week files again");
      assert.equal(r.status === "scanned" ? r.periodKey : "", "2026-W49");
    }
    week();

    /* ── W5 · refused before the model ── */
    await setup.query(`update companies set plan = 'free' where id = $1`, [acmeSeed.tenantId]);
    await failsBeforeModel("plan downgraded to Free", "plan-schedule-not-included");
    await setup.query(`update companies set plan = 'founding' where id = $1`, [acmeSeed.tenantId]);
    await failsBeforeModel("Claude control off", "model-connectivity-disabled", { resolveClaudeEnabled: async () => false });
    await failsBeforeModel("live, no own key", "agent-task-requires-own-key", { env: { ...ENV, HEBUN_MODEL_TRANSPORT: "live" } });
    /* The tenant renews assistance WITHOUT the role class: the role is refused, and the whole request with it. */
    const narrowed = await authorizeTenantExternalAiDataUse(acme, { attestationId, scopes: ["conversation", "knowledge", "work-artifact"].map((dataClass) => ({ purpose: "assistance", dataClass })), justification: GRANT, observedRevision: 1 } as never, dbDeps);
    assert.equal(narrowed.status, "written", JSON.stringify(narrowed));
    await failsBeforeModel("role not authorized for data use", "agent-task-data-use-not-authorized");
    const restored = await authorizeTenantExternalAiDataUse(acme, { attestationId, scopes: ["conversation", "knowledge", "work-artifact", "agent-mandate"].map((dataClass) => ({ purpose: "assistance", dataClass })), justification: GRANT, observedRevision: 2 } as never, dbDeps);
    assert.equal(restored.status, "written", JSON.stringify(restored));
    const withdrawn = await withdrawStandingAgentTask(acme, { template: "weekly-content-plan", justification: "Withdrawing the weekly content plan for the P5-5 proof.", observedAuthorizationRevision: 1 }, { getDb: () => handle.db });
    assert.equal(withdrawn.status, "authorized", JSON.stringify(withdrawn));
    {
      const before = await world();
      const r = await scanScheduledAgentTasks(deps());
      assert.equal(r.status === "scanned" ? r.considered : -1, 0, "W5: a withdrawn authorization is not considered");
      assert.deepEqual(await world(), before, "W5: nothing asked");
    }

    /* ── W7 · two templates, two lineages ── */
    {
      const ops = await authorizeStandingAgentTask(acme, { template: "weekly-operations-summary", workItemId, agentId, title: "Weekly operations", brief: "List what to check in the warehouse this week.", justification: REASON, observedAuthorizationRevision: null }, { getDb: () => handle.db });
      assert.equal(ops.status, "authorized", JSON.stringify(ops));
      assert.equal(ops.status === "authorized" ? ops.authorization.authorizationRevision : 0, 1, "W7: the operations lineage starts at 1");
      const r = await scanScheduledAgentTasks(deps());
      const mine = r.status === "scanned" ? r.outcomes.find((o) => o.template === "weekly-operations-summary") : undefined;
      assert.equal(mine?.status, "filed", JSON.stringify(mine));
      const sent = JSON.parse(wire.at(-1)!) as { messages: { content: string }[] };
      assert.match(sent.messages.at(-1)!.content, /operations summary and plan for the week/, "W7: the operations lead");
    }

    assert.equal(networkCalls, 0, "no real network");
    finished = true;
    console.log("p5-5-scheduled-agent-task/scheduled-agent-task-postgres: W1–W8 PASS");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

void main();
