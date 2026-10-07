/*
 * WF-3C — Agent #1's explicit Knowledge mode, end to end, against a real PostgreSQL.
 *
 * Released writers build the organization: Governance, a durable agent with a record-work mandate,
 * and Knowledge created + ratified through K2/K4 (so SCI-2A stamps integrity). The released
 * origination seam runs with knowledgeMode on, the real generator and a scripted transport.
 *
 * Proven here:
 *   - the model sees each eligible version only as alias + statement, and the declaration is
 *     agent-origination × {conversation, organization, knowledge};
 *   - a proposal citing K2 of two candidates files exactly one PENDING record-work request whose
 *     evidence is the organization plus knowledge-version/<K2> — not the supplied set;
 *   - zero eligible Knowledge refuses before any invocation or model call;
 *   - zero cited Knowledge files nothing;
 *   - a cited version superseded during the call refuses `knowledge-reference-stale`, and an
 *     unreadable Governance at revalidation refuses `knowledge-unavailable` — nothing filed;
 *   - no permit, decision, work item, Knowledge or Governance row is written by origination;
 *   - plain origination is unchanged: no Knowledge lines, no knowledge class.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { ratifyKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { readRejectedKnowledgeVersions } from "../../src/features/governance-decision/knowledge-rejection-read.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import type { KnowledgeGroundingReadDeps } from "../../src/features/knowledge-grounding/read-grounding-universe.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-06T18:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
} as const;
/* Tables origination may touch: the request it files and the invocation it records. */
const ORIGINATION_TABLES = new Set(["heby_action_requests", "heby_origination_invocations"]);

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string): TenantContext {
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
    requestId: "wf3c-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function census(client: Client): Promise<Map<string, number>> {
  const tables = await client.query<{ t: string }>("select table_name as t from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
  const out = new Map<string, number>();
  for (const { t } of tables.rows) out.set(t, Number((await client.query(`select count(*)::int as n from "${t}"`)).rows[0]!.n));
  return out;
}

function changedTables(before: Map<string, number>, after: Map<string, number>): string[] {
  return [...after].filter(([t, n]) => before.get(t) !== n).map(([t]) => t).sort();
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_wf3c_knowledge_origination");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const realFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error("WF-3C test makes no network call");
  }) as typeof fetch;

  try {
    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    const knowledgeWriteDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => repo,
      getRepository: () => repo,
      now: () => NOW,
    } as never;

    const seedOrg = async (slug: string, tag: string) => {
      const seeded = await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test`, password: `${slug}-correct-password-7Qx` });
      const ctx = contextFor(seeded, await sessionRowFor(setup, seeded, tag));
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: "Establishing Governance for the WF-3C fixture." }, writeDeps)).status, "established");
      const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, writeDeps);
      assert.equal(agent.status, "established");
      await seedAgentMandate(setup, seeded, agent.status === "established" ? agent.identity.agentId : "", writeDeps, { tag, now: NOW, proposalScope: ["record-work"] });
      return ctx;
    };
    const createRatified = async (ctx: TenantContext, factKey: string, statement: string) => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey: "policies", scope: "company-wide", title: factKey, statement }, knowledgeWriteDeps);
      assert.equal(created.status, "created", JSON.stringify(created));
      if (created.status !== "created") throw new Error("unreachable");
      const fact = { factId: created.identity.factId, nodeId: created.identity.newKnowledgeNodeId! };
      const r = await ratifyKnowledgeVersion(ctx, { factId: fact.factId, knowledgeNodeId: fact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, writeDeps);
      assert.equal(r.status, "ratified", JSON.stringify(r));
      return fact;
    };

    const hebun = await seedOrg("hebun-wf3c", "a");
    const empty = await seedOrg("empty-wf3c", "b");
    const leave = await createRatified(hebun, "a.leave", "Leave is 14 days per year.");
    const travel = await createRatified(hebun, "b.travel", "Travel needs prior written approval.");

    let governanceDown = false;
    const knowledgeDeps: KnowledgeGroundingReadDeps = {
      getRepo: () => repo,
      now: () => NOW,
      readRejectedKnowledgeVersions: (t) => readRejectedKnowledgeVersions(t, { getDb: () => handle.db }),
      admissibility: { knowledge: { getDb: () => handle.db }, governance: { getDb: () => (governanceDown ? null : handle.db) } },
    };
    type Captured = { request: ModelGenerationRequest; dataClasses: readonly string[] | undefined };
    const run = async (ctx: TenantContext, reply: string, options: { knowledgeMode?: boolean; during?: () => Promise<void> } = {}) => {
      const captured: Captured[] = [];
      const transport: ClaudeTransport = {
        async send(request) {
          await options.during?.();
          return { id: "req_wf3c", model: request.model, content: [{ type: "text", text: reply }], stopReason: "end_turn", usage: { inputTokens: 90, outputTokens: 30 } };
        },
      };
      const result = await originateAgentAction({ goal: "Propose recording the leave policy review as work." }, {
        resolveTenant: async () => ctx,
        env: MODEL_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({ transport, transportProvenance: "fake" }),
        generate: async (request: ModelGenerationRequest, generationDeps: Parameters<typeof generateHebyModelAnswer>[1] = {}) => {
          captured.push({ request, dataClasses: generationDeps.disclosure?.dataClasses });
          return generateHebyModelAnswer(request, generationDeps);
        },
        agentIdentity: dbDeps,
        candidates: { recipients: dbDeps, artifacts: dbDeps, organization: dbDeps },
        proposal: writeDeps,
        recordWork: writeDeps,
        provenance: dbDeps,
        knowledge: knowledgeDeps,
        knowledgeMode: options.knowledgeMode ?? true,
      } as never);
      return { result, captured };
    };
    const reply = (knowledgeRefs: unknown, title = "Record the leave policy review") =>
      JSON.stringify({ kind: "record-work", args: { title, scope: { kind: "organization-level" }, knowledgeRefs }, reason: "The leave policy is ratified Knowledge." });

    /* ── 1. ZERO ELIGIBLE: refused before any invocation or model call ───────────────────────── */
    {
      const before = await census(setup);
      const { result, captured } = await run(empty, reply(["K1"]));
      assert.deepEqual(result, { status: "refused", reason: "no-eligible-knowledge" });
      assert.equal(captured.length, 0, "no model request was built");
      assert.deepEqual(changedTables(before, await census(setup)), [], "nothing written, not even an invocation");
    }

    /* ── 2. CITES K2 OF TWO: one PENDING request, evidence = organization + exactly K2 ────────── */
    {
      const before = await census(setup);
      const { result, captured } = await run(hebun, reply(["K2"]));
      assert.equal(result.status, "proposed", JSON.stringify(result));
      assert.equal(captured.length, 1);
      const { request, dataClasses } = captured[0]!;
      assert.deepEqual([...(dataClasses ?? [])].sort(), ["conversation", "knowledge", "organization"], "the declaration names what was shown");
      const lines = request.evidence.filter((l) => l.startsWith("- knowledgeRef="));
      assert.deepEqual(lines, [
        `- knowledgeRef=K1 statement=${JSON.stringify("Leave is 14 days per year.")}`,
        `- knowledgeRef=K2 statement=${JSON.stringify("Travel needs prior written approval.")}`,
      ]);
      assert.ok(!UUID.test(request.evidence.join("\n")), "no Knowledge, fact, tenant or decision id reaches the model");
      assert.match(request.systemInstructions, /"knowledgeRefs":\["<knowledgeRef>"\]/, "Knowledge-mode instructions");

      const rows = await setup.query<{ status: string; action_kind: string; evidence: { sourceClass: string; recordRef: string; lifecycle: string }[]; proposed_by_actor_type: string }>(
        "select status, action_kind, evidence, proposed_by_actor_type from heby_action_requests where tenant_id = $1",
        [hebun.tenantId],
      );
      assert.equal(rows.rows.length, 1);
      const row = rows.rows[0]!;
      assert.equal(row.proposed_by_actor_type, "agent");
      assert.match(row.status, /pending|requested|proposed/i, `PENDING-shaped status (got ${row.status})`);
      assert.deepEqual(row.evidence.filter((e) => e.sourceClass === "knowledge"), [{ sourceClass: "knowledge", recordRef: `knowledge-version/${travel.nodeId}`, lifecycle: "settled" }], "only the cited version");
      assert.ok(!JSON.stringify(row.evidence).includes(leave.nodeId), "the supplied-but-uncited version is not persisted");
      assert.deepEqual(changedTables(before, await census(setup)).filter((t) => !ORIGINATION_TABLES.has(t)), [], "no permit, decision, work, Knowledge or Governance write");
    }

    /* ── 3. ZERO CITED: nothing filed ─────────────────────────────────────────────────────────── */
    {
      const before = await census(setup);
      const { result } = await run(hebun, reply([], "Record the travel approval review"));
      assert.deepEqual(result, { status: "refused", reason: "no-knowledge-reference" });
      assert.deepEqual(changedTables(before, await census(setup)), ["heby_origination_invocations"], "an invocation is recorded; no request");
    }

    /* ── 4. UNREADABLE GOVERNANCE AT REVALIDATION: knowledge-unavailable ──────────────────────── */
    {
      const before = await census(setup);
      const { result } = await run(hebun, reply(["K1"], "Record the leave carry-over review"), { during: async () => { governanceDown = true; } });
      governanceDown = false;
      assert.deepEqual(result, { status: "refused", reason: "knowledge-unavailable" });
      assert.deepEqual(changedTables(before, await census(setup)), ["heby_origination_invocations"]);
      const inv = (await setup.query("select state, filing_outcome, filing_refusal from heby_origination_invocations order by created_at desc limit 1")).rows[0];
      assert.deepEqual(inv, { state: "selection-valid", filing_outcome: "refused", filing_refusal: "knowledge-unavailable" });
    }

    /* ── 5. CITED VERSION SUPERSEDED DURING THE CALL: knowledge-reference-stale ───────────────── */
    {
      const { result } = await run(hebun, reply(["K1"], "Record the leave entitlement review"), {
        during: async () => {
          const s = await supersedeKnowledgeFact(hebun, { factId: leave.factId, title: "a.leave", statement: "Leave is 15 days per year.", observedKnowledgeVersion: 1 }, knowledgeWriteDeps);
          assert.equal(s.status, "superseded", JSON.stringify(s));
        },
      });
      assert.deepEqual(result, { status: "refused", reason: "knowledge-reference-stale" });
      const n = (await setup.query("select count(*)::int n from heby_action_requests where tenant_id = $1", [hebun.tenantId])).rows[0].n;
      assert.equal(n, 1, "still only the request from case 2");
    }

    /* ── 6. PLAIN MODE UNCHANGED ─────────────────────────────────────────────────────────────── */
    {
      const { captured } = await run(hebun, JSON.stringify({ kind: "none", reason: "Nothing to propose." }), { knowledgeMode: false });
      assert.equal(captured.length, 1);
      assert.deepEqual([...(captured[0]!.dataClasses ?? [])].sort(), ["conversation", "organization"]);
      assert.ok(!captured[0]!.request.evidence.some((l) => l.includes("knowledgeRef")));
      assert.ok(!captured[0]!.request.systemInstructions.includes("knowledgeRefs"));
    }

    assert.equal(networkCalls, 0, "no provider or network call occurred");
    console.log("wf3c knowledge-origination-postgres checks passed");
  } finally {
    globalThis.fetch = realFetch;
    await handle.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
