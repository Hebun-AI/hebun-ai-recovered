/*
 * AOR-1a — a preparation in which a model answered can be diagnosed: which validator check withheld it,
 * and how the provider stopped. Real disposable PostgreSQL, the released stack from Heby's assignment
 * seam down, a fake model transport captured at the provider boundary. No network.
 *
 *   D1  a withheld reply: not-prepared, nothing filed; the client result names the closed codes and the
 *       classified stop reason; one log line with the same codes, the stop reason and the message id,
 *       and none of the prompt, the reply, a tenant, a user or an agent; the message row keeps its provenance
 *   D2  a valid reply whose provider stop reason is `refusal`: still prepared exactly as before — the
 *       stop reason is recorded, never treated as Hebun's judgement and never blocking the filing
 *   D3  the provider reports no stop reason: prepared, the line says `unreported`
 *   D4  an unexpected provider stop reason is carried as `other`, never as the raw string
 *   D5  the provider fails: no model answered, no line; the refusal is unchanged
 *   D6  another tenant's assignment logs only its own message id, and the two tenants' lines share nothing
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { assignWorkDraft, type AssignWorkDraftDeps } from "../../src/features/agent-work/assign-work-draft.server";
import { PREPARATION_MODEL_OUTCOME_EVENT } from "../../src/features/work-artifacts/preparation-diagnosis";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { publicKnowledgeNoMatch } from "../helpers/public-knowledge";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
} as const;
const APPROVE = "I have read this proposal and authorize it for the output diagnosis proof.";
const MANDATE = "Bounding what this agent may do for the output diagnosis proof.";
const PURPOSE = "Assist authorized people with organizational work inside the agent's assigned responsibility.";
const PROMPT_SENTINEL = "PROMPT-SENTINEL-7Q";
const REPLY_SENTINEL = "REPLY-SENTINEL-4K";
const WITHHELD_REPLY = `${REPLY_SENTINEL} I approved the release and it is done.`;
const GOOD_REPLY = `${REPLY_SENTINEL} Plan: count stock on Monday, reconcile with the ledger on Tuesday.`;

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
    mfaVerified: false, requestId: "aor1a-request", authenticatedAt: new Date().toISOString(),
  });

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("aor-1a/diagnosis-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_aor1a_diagnosis");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const n = async (sql: string, params: unknown[] = []) => Number((await q<{ n: number }>(sql, params))[0]!.n);

  try {
    const acmeSeed = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-aor1a", email: "director@acme.test" })) as Seeded;
    const globexSeed = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-aor1a", email: "director@globex.test" })) as Seeded;
    const acme = contextFor(acmeSeed, await sessionRow(setup, acmeSeed, "aor1a-acme"));
    const globex = contextFor(globexSeed, await sessionRow(setup, globexSeed, "aor1a-globex"));
    await seedGovernanceAuthority(setup, acmeSeed, dbDeps, { ctx: acme, sessionContextId: acme.sessionContextId });
    await seedGovernanceAuthority(setup, globexSeed, dbDeps, { ctx: globex, sessionContextId: globex.sessionContextId });

    const coordinator = async (ctx: TenantContext, name: string) => {
      const r = await createDurableAgentIdentity(ctx, { name, justification: `Register ${name} for the output diagnosis proof.` }, dbDeps);
      assert.equal(r.status, "established", JSON.stringify(r));
      const agentId = r.status === "established" ? r.identity.agentId : "";
      const m = await establishAgentMandateWithResponsibility(
        ctx,
        { agentId, purpose: PURPOSE, proposalScope: ["record-work"], justification: MANDATE, observedMandateRevision: null, responsibility: [{ kind: "organization" }] },
        dbDeps,
      );
      assert.equal(m.status, "established", JSON.stringify(m));
      return agentId;
    };
    let titles = 0;
    const work = async (ctx: TenantContext): Promise<string> => {
      const p = await proposeRecordWorkAction(ctx, { title: `Stock count ${++titles}`, department: { kind: "organization-level" }, workScope: { kind: "organization" } } as never, dbDeps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, dbDeps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, dbDeps);
      assert.equal(e.status, "executed", JSON.stringify(e));
      return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
    };

    /* The model, faked at the transport: each call takes the next scripted reply. */
    const script: ({ text: string; stopReason?: string } | "fail")[] = [];
    let calls = 0;
    const transport: ClaudeTransport = {
      async send(request) {
        calls++;
        const next = script.shift();
        if (!next || next === "fail") throw new Error("provider down");
        return {
          id: `req_aor1a_${calls}`,
          model: request.model,
          content: [{ type: "text", text: next.text }],
          ...(next.stopReason === undefined ? {} : { stopReason: next.stopReason }),
          usage: { inputTokens: 30, outputTokens: 12 },
        };
      },
    };
    const lines: string[] = [];
    const repo = createDurableConversationRepository(handle.db);
    const preparation = {
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      resolvePublicKnowledge: publicKnowledgeNoMatch,
      newCorrelationId: () => `corr-aor1a-${calls}`,
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      write: dbDeps,
      read: dbDeps,
      agentIdentity: dbDeps,
      log: (line: string) => lines.push(line),
    } as unknown as AssignWorkDraftDeps["preparation"];
    const ask = (ctx: TenantContext, workItemId: string, agentId: string) =>
      assignWorkDraft(
        { workItemId, agentId, prompt: `Prepare a two-step stock plan. ${PROMPT_SENTINEL}`, title: `Draft ${++titles}`, artifactType: "operational-plan" },
        { resolveTenant: async () => ctx, getDb: () => handle.db, preparation },
      );
    const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;
    const artifacts = () => n("select count(*)::int n from work_artifacts");

    const acmeAgent = await coordinator(acme, "Coordinator");
    const acmeWork = await work(acme);

    /* ── D1 · withheld: codes and stop reason, nothing filed, nothing sensitive in the line ── */
    script.push({ text: WITHHELD_REPLY, stopReason: "end_turn" });
    const before1 = await artifacts();
    const d1 = await ask(acme, acmeWork, acmeAgent);
    assert.equal(d1.status, "not-prepared", JSON.stringify(d1));
    if (d1.status !== "not-prepared") throw new Error("unreachable");
    assert.deepEqual(d1.modelFallback, { kind: "withheld", issueCodes: ["action-claim:approved"], stopReason: "end_turn" }, "D1: the closed codes and the classified stop reason reach the client result");
    assert.equal(await artifacts(), before1, "D1: nothing filed");
    assert.equal(lines.length, 1, "D1: one line");
    const l1 = parse(lines[0]!);
    assert.deepEqual(Object.keys(l1).sort(), ["event", "issueCodes", "messageId", "served", "stopReason"], "D1: only the declared keys");
    assert.equal(l1.event, PREPARATION_MODEL_OUTCOME_EVENT);
    assert.equal(l1.served, "withheld");
    assert.deepEqual(l1.issueCodes, ["action-claim:approved"]);
    assert.equal(l1.stopReason, "end_turn");
    const row = (await q<{ id: string; origin: string; provider: string | null; output_tokens: number | null; content: string }>(
      "select id, origin, provider, output_tokens, content from messages where id = $1", [l1.messageId],
    ))[0];
    assert.ok(row, "D1: the message id joins the line to the recorded invocation");
    assert.deepEqual([row!.origin, row!.provider, row!.output_tokens], ["deterministic", "claude", 12], "D1: the row keeps the invocation's provenance, as before");
    assert.ok(!row!.content.includes(REPLY_SENTINEL), "D1: the withheld reply is still never persisted");
    for (const secret of [PROMPT_SENTINEL, REPLY_SENTINEL, "approved the release", acmeSeed.tenantId, acmeSeed.userId, acmeAgent, acmeWork, "Coordinator"]) {
      assert.ok(!lines[0]!.includes(secret), `D1: the line carries no ${secret}`);
    }

    /* ── D2 · a provider refusal stop reason is recorded, not acted on ── */
    script.push({ text: GOOD_REPLY, stopReason: "refusal" });
    const d2 = await ask(acme, acmeWork, acmeAgent);
    assert.equal(d2.status, "prepared", `D2: the filing is unchanged — ${JSON.stringify(d2)}`);
    assert.equal(await artifacts(), before1 + 1);
    const l2 = parse(lines[1]!);
    assert.deepEqual([l2.served, l2.stopReason, l2.issueCodes], ["model", "refusal", []], "D2: served, with the provider's stop reason");
    assert.ok(!lines[1]!.includes(REPLY_SENTINEL), "D2: no reply text");

    /* ── D3 · no stop reason reported ── */
    script.push({ text: GOOD_REPLY });
    const d3 = await ask(acme, acmeWork, acmeAgent);
    assert.equal(d3.status, "prepared", JSON.stringify(d3));
    assert.equal(parse(lines[2]!).stopReason, "unreported", "D3");

    /* ── D4 · an unexpected stop reason is classified, never carried raw ── */
    script.push({ text: WITHHELD_REPLY, stopReason: "weird_new_reason <b>" });
    const d4 = await ask(acme, acmeWork, acmeAgent);
    assert.equal(d4.status === "not-prepared" && d4.modelFallback?.kind === "withheld" && d4.modelFallback.stopReason, "other", "D4: the client sees `other`");
    assert.equal(parse(lines[3]!).stopReason, "other", "D4: the line too");
    assert.ok(!lines[3]!.includes("weird_new_reason"), "D4: the raw provider string goes nowhere");

    /* ── D5 · the provider fails: no model answered, no line ── */
    script.push("fail");
    const d5 = await ask(acme, acmeWork, acmeAgent);
    assert.equal(d5.status, "not-prepared", JSON.stringify(d5));
    assert.equal(d5.status === "not-prepared" && d5.modelFallback?.kind, "provider-failed", "D5: the refusal is unchanged");
    assert.equal(lines.length, 4, "D5: nothing to diagnose, nothing logged");

    /* ── D6 · tenants share nothing in the lines ── */
    const globexAgent = await coordinator(globex, "Globex Coordinator");
    const globexWork = await work(globex);
    script.push({ text: WITHHELD_REPLY, stopReason: "end_turn" });
    const d6 = await ask(globex, globexWork, globexAgent);
    assert.equal(d6.status, "not-prepared");
    const l6 = parse(lines[4]!);
    assert.notEqual(l6.messageId, l1.messageId);
    assert.equal(await n("select count(*)::int n from messages m join conversations c on c.id = m.conversation_id where m.id = $1 and c.tenant_id = $2", [l6.messageId, globexSeed.tenantId]), 1, "D6: Globex's line names Globex's own row");
    for (const line of lines) {
      for (const id of [acmeSeed.tenantId, globexSeed.tenantId, acmeSeed.userId, globexSeed.userId, acmeAgent, globexAgent]) {
        assert.ok(!line.includes(id), "D6: no tenant, user or agent id in any line");
      }
    }

    assert.equal(calls, 6, "six model calls, one per scripted reply");
    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("aor-1a diagnosis-postgres: D1–D6 ok");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
