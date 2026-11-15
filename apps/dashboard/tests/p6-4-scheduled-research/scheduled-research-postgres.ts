/*
 * P6-4 — the 08:00 scheduled research run against a REAL but DISPOSABLE PostgreSQL database, through the
 * released stack (standing research authorization, Governance, Agent Identity and Mandate, External-AI
 * Data Use with the reviewed attestation, the generator with the REAL live Anthropic transport over a
 * COUNTING, SIMULATED fetch, the dispatch cap, the disclosure audit). No production, no provider, no network.
 *
 *   S1  kill switch off: `disabled`, nothing read, zero dispatch, zero rows
 *   S2  switch on, no authorization in force: nothing considered
 *   S3  authorized: one dispatch, one report created by `system` (the run) and authored by the agent;
 *       ledger `filed`; scheduled filing audit row (system, granter named, never the actor); the
 *       disclosure evidence names the granter as accountable authorizer; the report lists on the work
 *   S4  the same day again: `already-run`, zero dispatch (D6); the next Istanbul day runs again
 *   S5  re-checks before the model, each zero dispatch and a `failed` ledger row: granter suspended,
 *       organization suspended, research data-use refused or withdrawn, Claude control off,
 *       a live deployment without the tenant's own key
 *   S6  a failed run is not retried the same day
 *   S7  the authorization withdrawn while the model writes: nothing filed, ledger `failed`
 *   S8  tenant isolation: another organization's authorization runs in its own tenant only
 *   S9  the cron route: 401 without its secret; `disabled` with it while the switch is off
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
import { authorizeTenantExternalAiDataUse, withdrawTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { listWorkArtifacts } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { authorizeStandingResearch, withdrawStandingResearch } from "../../src/features/standing-research-authority/standing-research.server";
import { istanbulLocalDate, scanScheduledResearch, type ScheduledResearchDeps } from "../../src/features/standing-research-authority/scheduled-research.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-haiku-4-5-20251001",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
} as const;
const REPORT = "Executive summary: demand for handwoven rugs is seasonal. This is uncertain and needs checking. [owner]";
const BRIEF = "Summarize seasonal demand for handwoven rugs in northern Europe for the coming quarter.";
const APPROVE = "I have read this proposal and authorize it for the scheduled research proof.";
const MANDATE = "Bounding what this agent may do for the scheduled research proof.";
const PURPOSE = "Assist authorized people with organizational work inside the agent's assigned responsibility.";
const GRANT = "This test organization agrees that its research questions may be processed by the reviewed assistant processor.";
const WITHDRAW = "This test organization withdraws its agreement for its questions to be processed.";
const REASON = "Authorizing a standing research brief for the P6-4 proof.";

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
    mfaVerified: false, requestId: "p6-4-request", authenticatedAt: new Date().toISOString(),
  });

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("p6-4-scheduled-research/scheduled-research-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  const RECORD = parsed.record;

  const harness = createDisposablePostgresHarness("hebun_p6_4_schedule");
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
      (await appendProcessorAttestation(setup, { verb: "admit", record: RECORD, reviewedRecordRef: REVIEWED_RECORD_REF, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await q<{ id: string }>(`select id from processor_attestations`))[0]!.id;
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-p64", email: "director@acme-p64.test" })) as Seeded;
    const globexSeed = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-p64", email: "director@globex-p64.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "p64-acme"));
    const globex = contextFor(globexSeed, await sessionRow(setup, globexSeed, "p64-globex"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });
    await seedGovernanceAuthority(setup, globexSeed, dbDeps, { ctx: globex, sessionContextId: globex.sessionContextId });

    const revisions = new Map<string, number>();
    const setupOrg = async (ctx: TenantContext, name: string) => {
      const domain = (await recordWorkDomain(ctx, { slug: "research", name: "research" }, dbDeps)) as { workDomain: { workDomainId: string } };
      const scope: WorkScope = { kind: "domain", workDomainId: domain.workDomain.workDomainId };
      const created = await createDurableAgentIdentity(ctx, { name, justification: `Register ${name} for the scheduled research proof.` }, dbDeps);
      assert.equal(created.status, "established", JSON.stringify(created));
      const agentId = created.status === "established" ? created.identity.agentId : "";
      const m = await establishAgentMandateWithResponsibility(
        ctx,
        { agentId, purpose: PURPOSE, proposalScope: ["prepare-research"], justification: MANDATE, observedMandateRevision: null, responsibility: [{ kind: "domain", workDomainId: scope.workDomainId }] },
        dbDeps,
      );
      assert.equal(m.status, "established", JSON.stringify(m));
      revisions.set(agentId, 1);
      const p = await proposeRecordWorkAction(ctx, { title: `${name} market scan`, department: { kind: "organization-level" }, workScope: scope } as never, dbDeps);
      const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
      const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
      const workItemId = e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
      assert.ok(workItemId, "work recorded");
      const g = await authorizeTenantExternalAiDataUse(ctx, { attestationId, scopes: [{ purpose: "research", dataClass: "conversation" }], justification: GRANT, observedRevision: null }, dbDeps);
      assert.equal(g.status, "written", JSON.stringify(g));
      const s = await authorizeStandingResearch(ctx, { workItemId, agentId, title: `${name} demand`, brief: BRIEF, justification: REASON, observedAuthorizationRevision: null } as never, { getDb: () => handle.db });
      assert.equal(s.status, "authorized", JSON.stringify(s));
      return { agentId, workItemId, authorizationId: s.status === "authorized" ? s.authorization.authorizationId : "" };
    };
    const acmeOrg = await setupOrg(acme, "Researcher");

    /* ── the model: the REAL live transport over a counting, simulated fetch ── */
    let fetches = 0;
    const wire: string[] = [];
    let duringSend: (() => Promise<void>) | null = null;
    const fetchImpl: FetchLike = async (_url, init) => {
      fetches++;
      wire.push(String(init.body));
      if (duringSend) {
        const run = duringSend;
        duringSend = null;
        await run();
      }
      return { ok: true, status: 200, json: async () => ({ id: `msg_p64_${fetches}`, model: ENV.HEBUN_MODEL_ID, content: [{ type: "text", text: REPORT }], stop_reason: "end_turn", usage: { input_tokens: 30, output_tokens: 12 } }) };
    };
    const gate = (d: Parameters<typeof authorizeExternalAiDisclosure>[0], o: boolean | null, m: string) => authorizeExternalAiDisclosure(d, o, m, dbDeps);
    let switchState = false;
    let now = new Date("2026-11-16T05:00:00Z");
    const deps = (over: Partial<ScheduledResearchDeps> = {}): ScheduledResearchDeps => ({
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
        recordDisclosure: (e) => recordExternalAiDisclosureDecision(e, dbDeps),
        admitDispatch: (input, d) => admitAiDispatch(input, { ...d, getDb: () => handle.db }),
      },
      ...over,
    });
    const world = async () => ({
      fetches,
      reports: await n(`select count(*)::int n from work_artifacts where artifact_type = 'research-report'`),
      runs: await n(`select count(*)::int n from scheduled_research_runs`),
      filedAudits: await n(`select count(*)::int n from audit_log where action = 'work-artifact.research-report.scheduled-filed'`),
      decisions: await n(`select count(*)::int n from decision_records`),
    });
    const lastRun = async () => (await q<{ status: string; failure_reason: string | null; artifact_id: string | null; local_date: string }>(
      `select status, failure_reason, artifact_id, local_date::text from scheduled_research_runs order by claimed_at desc, id desc limit 1`,
    ))[0]!;
    const failsBeforeModel = async (label: string, expected: string, over: Partial<ScheduledResearchDeps> = {}) => {
      const before = await world();
      const r = await scanScheduledResearch(deps(over));
      assert.equal(r.status, "scanned", `${label}: ${JSON.stringify(r)}`);
      const mine = r.status === "scanned" ? r.outcomes.find((o) => o.tenantId === acmeSeed.tenantId) : undefined;
      assert.deepEqual(mine?.status === "failed" ? mine.reason : JSON.stringify(mine), expected, `${label}: ${JSON.stringify(mine)}`);
      const after = await world();
      assert.equal(after.fetches, before.fetches, `${label}: zero dispatch`);
      assert.equal(after.reports, before.reports, `${label}: nothing filed`);
      assert.deepEqual([(await lastRun()).status, (await lastRun()).failure_reason], ["failed", expected], `${label}: the ledger records why`);
      now = new Date(now.getTime() + 24 * 3600 * 1000); /* the next run needs the next day */
    };

    /* ── S1 · kill switch off ── */
    {
      const before = await world();
      assert.deepEqual(await scanScheduledResearch(deps()), { status: "disabled" }, "S1: off");
      assert.deepEqual(await world(), before, "S1: nothing written, nothing asked");
    }
    switchState = true;

    /* ── S3 · authorized: one report, filed by the run ── */
    {
      const before = await world();
      const r = await scanScheduledResearch(deps());
      assert.equal(r.status, "scanned");
      if (r.status !== "scanned") throw new Error("unreachable");
      assert.equal(r.localDate, "2026-11-16", "S3: the Istanbul date");
      assert.equal(r.considered, 1, "S3: only Acme holds an authorization");
      const filed = r.outcomes[0]!;
      assert.equal(filed.status, "filed", JSON.stringify(filed));
      if (filed.status !== "filed") throw new Error("unreachable");
      assert.equal(filed.sourcing, "unsourced", "S3: no web-search decision, so unsourced");
      const after = await world();
      assert.deepEqual(
        { fetches: after.fetches - before.fetches, reports: after.reports - before.reports, runs: after.runs - before.runs, audits: after.filedAudits - before.filedAudits, decisions: after.decisions - before.decisions },
        { fetches: 1, reports: 1, runs: 1, audits: 1, decisions: 0 },
        "S3: one dispatch, one report, one ledger row, one filing row, no Governance decision",
      );
      assert.ok(wire.at(-1)!.includes(BRIEF), "S3: the authorized brief is the prompt");
      assert.ok(!wire.at(-1)!.includes("web_search"), "S3: no search tool");
      const artifact = (await q<{ created_by_type: string; created_by: string; authored_by_actor_type: string; authored_by_actor_id: string; source_message_id: string | null; content: string }>(
        `select a.created_by_type, a.created_by, r.authored_by_actor_type, r.authored_by_actor_id, r.source_message_id, r.content
           from work_artifacts a join work_artifact_revisions r on r.artifact_id = a.id where a.id = $1`, [filed.artifactId],
      ))[0]!;
      assert.deepEqual(
        [artifact.created_by_type, artifact.created_by, artifact.authored_by_actor_type, artifact.authored_by_actor_id, artifact.source_message_id, artifact.content],
        ["system", filed.runId, "agent", acmeOrg.agentId, null, REPORT],
        "S3: created by the run (system), authored by the agent, the model's text verbatim, no message",
      );
      const run = await lastRun();
      assert.deepEqual([run.status, run.artifact_id, run.local_date], ["filed", filed.artifactId, "2026-11-16"], "S3: ledger filed");
      const audit = (await q<{ actor_type: string; actor_id: string; metadata: Record<string, unknown>; correlation_id: string }>(
        `select actor_type, actor_id, metadata, correlation_id from audit_log where action = 'work-artifact.research-report.scheduled-filed'`,
      ))[0]!;
      assert.deepEqual([audit.actor_type, audit.actor_id], ["system", filed.runId], "S3: the run is the actor");
      assert.equal(audit.metadata.grantedByUserId, acmeSeed.userId, "S3: the granter is named — as granter");
      assert.equal(audit.metadata.standingAuthorizationId, acmeOrg.authorizationId);
      assert.equal(audit.metadata.trigger, "schedule");
      const disclosure = (await q<{ actor_type: string; actor_id: string }>(
        `select actor_type, actor_id from audit_log where action = 'external-ai.disclosure.authorized' and correlation_id = $1`, [audit.correlation_id],
      ))[0]!;
      assert.deepEqual([disclosure.actor_type, disclosure.actor_id], ["human", acmeSeed.userId], "S3: the disclosure names the accountable authorizer");
      const listed = await listWorkArtifacts(acme, dbDeps);
      assert.ok(JSON.stringify(listed).includes(filed.artifactId), "S3: the report lists for the organization");
    }

    /* ── S4 · the same Istanbul day again: nothing; the next day runs ── */
    {
      const before = await world();
      const again = await scanScheduledResearch(deps());
      assert.deepEqual(again.status === "scanned" ? again.outcomes.map((o) => o.status) : again, ["already-run"], "S4: already run today");
      assert.deepEqual(await world(), before, "S4: zero dispatch, zero rows");
      now = new Date("2026-11-16T20:59:00Z"); /* 23:59 in Istanbul: still the 16th */
      const late = await scanScheduledResearch(deps());
      assert.deepEqual(late.status === "scanned" ? late.outcomes.map((o) => o.status) : late, ["already-run"], "S4: still the same local day");
      now = new Date("2026-11-16T21:00:00Z"); /* 00:00 on the 17th in Istanbul */
      assert.equal(istanbulLocalDate(now), "2026-11-17");
      const next = await scanScheduledResearch(deps());
      assert.deepEqual(next.status === "scanned" ? next.outcomes.map((o) => o.status) : next, ["filed"], "S4: the next day files again");
      now = new Date("2026-11-18T05:00:00Z");
    }

    /* ── S5 · every re-check before the model ── */
    await setup.query(`update memberships set status = 'suspended' where id = $1`, [acmeSeed.membershipId]);
    await failsBeforeModel("granter suspended", "granter-not-active-member");
    await setup.query(`update memberships set status = 'active' where id = $1`, [acmeSeed.membershipId]);
    await setup.query(`update companies set tenant_status = 'suspended' where id = $1`, [acmeSeed.tenantId]);
    await failsBeforeModel("organization suspended", "organization-not-active");
    await setup.query(`update companies set tenant_status = 'active' where id = $1`, [acmeSeed.tenantId]);
    await failsBeforeModel("Claude control off", "model-connectivity-disabled", { resolveClaudeEnabled: async () => false });
    await failsBeforeModel("live, no own key", "research-requires-own-key", { env: { ...ENV, HEBUN_MODEL_TRANSPORT: "live" } });
    await failsBeforeModel("data-use refused", "research-data-use-not-authorized", { authorizeDisclosure: async () => ({ disposition: "refused" }) as never });

    /* ── S6 · a failed run is not retried the same day ── */
    {
      now = new Date(now.getTime() - 24 * 3600 * 1000); /* back to the day that just failed */
      const before = await world();
      const r = await scanScheduledResearch(deps());
      assert.deepEqual(r.status === "scanned" ? r.outcomes.map((o) => o.status) : r, ["already-run"], "S6: the failed day is not retried");
      assert.equal((await world()).fetches, before.fetches, "S6: zero dispatch");
      now = new Date(now.getTime() + 24 * 3600 * 1000);
    }

    /* ── S7 · withdrawn while the model writes ── */
    {
      duringSend = async () => {
        const w = await withdrawStandingResearch(acme, { justification: REASON, observedAuthorizationRevision: 1 }, { getDb: () => handle.db });
        assert.equal(w.status, "authorized", JSON.stringify(w));
      };
      const before = await world();
      const r = await scanScheduledResearch(deps());
      const mine = r.status === "scanned" ? r.outcomes[0] : undefined;
      assert.deepEqual(mine?.status === "failed" ? mine.reason : JSON.stringify(mine), "authorization-changed-while-preparing", "S7: not filed");
      const after = await world();
      assert.deepEqual({ fetches: after.fetches - before.fetches, reports: after.reports - before.reports }, { fetches: 1, reports: 0 }, "S7: the call happened, nothing was filed");
      assert.equal((await lastRun()).status, "failed", "S7: ledger failed");
      now = new Date(now.getTime() + 24 * 3600 * 1000);
      const s2 = await scanScheduledResearch(deps());
      assert.deepEqual(s2.status === "scanned" ? s2.considered : s2, 0, "S2: withdrawn, nothing is considered");
    }

    /* ── S8 · tenant isolation ── */
    {
      const globexOrg = await setupOrg(globex, "Globex Researcher");
      const before = await world();
      const r = await scanScheduledResearch(deps());
      assert.equal(r.status === "scanned" ? r.considered : -1, 1, "S8: only Globex holds one now");
      const filed = r.status === "scanned" ? r.outcomes[0] : undefined;
      assert.equal(filed?.status, "filed", JSON.stringify(filed));
      assert.equal(filed?.tenantId, globexSeed.tenantId, "S8: in Globex");
      if (filed?.status !== "filed") throw new Error("unreachable");
      const row = (await q<{ tenant_id: string }>(`select tenant_id from work_artifacts where id = $1`, [filed.artifactId]))[0]!;
      assert.equal(row.tenant_id, globexSeed.tenantId, "S8: the report lives in Globex");
      assert.ok(!JSON.stringify(await listWorkArtifacts(acme, dbDeps)).includes(filed.artifactId), "S8: Acme cannot see it");
      assert.equal((await world()).fetches - before.fetches, 1);
      assert.ok(globexOrg.authorizationId);
      /* Data-use withdrawn for Globex: the next day refuses before the model. */
      const w = await withdrawTenantExternalAiDataUse(globex, { serviceScope: "anthropic/messages", accountRef: RECORD.accountRef, justification: WITHDRAW, observedRevision: 1 }, dbDeps);
      assert.equal(w.status, "written", JSON.stringify(w));
      now = new Date(now.getTime() + 24 * 3600 * 1000);
      const f0 = (await world()).fetches;
      const refused = await scanScheduledResearch(deps());
      assert.deepEqual(refused.status === "scanned" ? refused.outcomes.map((o) => (o.status === "failed" ? o.reason : o.status)) : refused, ["research-data-use-not-authorized"], "S5: the real gate refuses a withdrawn grant");
      assert.equal((await world()).fetches, f0, "S5: zero dispatch");
    }

    /* ── S9 · the cron route ── */
    {
      const { GET } = await import("../../src/app/api/standing-research/scan/route");
      delete process.env.HEBUN_STANDING_RESEARCH_TRIGGER_SECRET;
      assert.equal((await GET(new Request("http://x/api/standing-research/scan", { headers: { authorization: "Bearer anything" } }))).status, 401, "S9: unset secret refuses");
      process.env.HEBUN_STANDING_RESEARCH_TRIGGER_SECRET = "s9-secret";
      assert.equal((await GET(new Request("http://x/api/standing-research/scan", { headers: { authorization: "Bearer wrong-sec" } }))).status, 401, "S9: wrong secret refuses");
      const ok = await GET(new Request("http://x/api/standing-research/scan", { headers: { authorization: "Bearer s9-secret" } }));
      assert.deepEqual([ok.status, await ok.json()], [200, { status: "disabled" }], "S9: the real switch has no row, so it is off");
      delete process.env.HEBUN_STANDING_RESEARCH_TRIGGER_SECRET;
    }

    assert.equal(networkCalls, 0, "the real network was never reached");
    finished = true;
    console.log("p6-4-scheduled-research/scheduled-research-postgres: S1–S9 PASS");
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
