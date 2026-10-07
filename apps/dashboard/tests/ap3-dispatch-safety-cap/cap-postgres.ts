/*
 * AP-3 — the persistent tenant AI dispatch safety cap, at the real seams, against a disposable database.
 *
 * MODEL (real generator, real live Claude transport with an injected fetch, real admission, real
 * evidence writer; the three-authority EAI gate is the shared stand-in — it is proven elsewhere):
 *   M1 under the cap: evidence → one fetch → generated; the evidence row is the charge.
 *   M2 at the cap: DISPATCH_SAFETY_CAP_REACHED; no fetch; process budget NOT consumed; no evidence;
 *      one `ai-dispatch-cap.refused` row, which is never counted.
 *   M3 tenant isolation: another tenant is admitted while the first is capped.
 *   M4 process budget exhausted: the released `rate-limited` error; no fetch; no evidence; no refusal
 *      row; the cap is not charged (the tenant still has its unit afterwards).
 *   M5 window: evidence from the previous UTC day is not counted.
 *   M6 fail-closed: an invalid cap setting is 0 — refused before the budget.
 * CONCURRENCY:
 *   C1 twelve concurrent admissions for one tenant, cap 3: exactly 3 admitted, 3 prepaid, 3 rows.
 *   C2 concurrent admissions for two tenants are independent.
 * FAIL-CLOSED: no database ⇒ `persistence-unavailable`, prepay never called; a throwing commit rolls
 *   back (nothing written) after the budget unit was taken (never refunded — the conservative side).
 * MEDIA (real requestMediaGeneration; a fake provider wearing the `live` label, so nothing leaves):
 *   D1 five live registrations admitted, the sixth refused `dispatch-safety-cap-reached` with no row,
 *      no provider call, one refusal row; D2 `budget-exhausted` rows are not counted; D3 a fake
 *      transport is not gated.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { authorizedDisclosure } from "../helpers/authorized-disclosure";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget, type LiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { hebunInstruction } from "../../src/features/heby-runtime/instruction-channel";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import { ModelConnectivityError } from "../../src/features/heby-model/model-error";
import { AI_DISPATCH_CAP_REFUSED, admitAiDispatch } from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import {
  EXTERNAL_AI_DISCLOSURE_AUTHORIZED,
  recordExternalAiDisclosureDecision,
} from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { externalAiDisclosureEvidence } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import type { MediaGenerationTransport, MediaGenerationOutcome } from "../../src/features/media-assets/media-generation-transport";
import { createMemoryMediaObjectStore, pngBytes } from "../helpers/media-fakes";

const MODEL_KEY = "HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY";
const MEDIA_KEY = "HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY";
const MODEL = "claude-haiku-4-5-20251001";
const env = (cap?: string) => ({
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: MODEL,
  HEBUN_MODEL_CREDENTIAL: "sk-fake-ap3",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
  ...(cap === undefined ? {} : { [MODEL_KEY]: cap }),
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap3_dispatch_cap");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;

  let fetches = 0;
  const fetchImpl: FetchLike = async () => {
    fetches += 1;
    return { ok: true, status: 200, json: async () => ({ id: "msg_ap3", model: MODEL, content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  const n = async (sql: string, params: unknown[]) => Number((await setup.query<{ n: string }>(sql, params)).rows[0]!.n);
  const evidenceCount = (tenantId: string) =>
    n(`select count(*)::text n from audit_log where tenant_id = $1 and action = $2`, [tenantId, EXTERNAL_AI_DISCLOSURE_AUTHORIZED]);
  const refusalCount = (tenantId: string, cls: string) =>
    n(`select count(*)::text n from audit_log where tenant_id = $1 and action = $2 and metadata->>'dispatchClass' = $3`, [tenantId, AI_DISPATCH_CAP_REFUSED, cls]);

  try {
    const a = await seedLocalIdentity(setup, { companyName: "Ap3 A", companySlug: "ap3-a", email: "a@ap3.test", roleType: "owner" });
    const b = await seedLocalIdentity(setup, { companyName: "Ap3 B", companySlug: "ap3-b", email: "b@ap3.test", roleType: "owner" });

    async function ask(
      tenant: { tenantId: string; userId: string },
      opts: { cap?: string; budget?: LiveSpendBudget } = {},
    ): Promise<{ state: string; fetched: number; spent: number }> {
      const budget = opts.budget ?? createLiveSpendBudget(99);
      const before = fetches;
      const spentBefore = budget.spent();
      const request: ModelGenerationRequest = {
        correlationId: randomUUID(), tenantId: tenant.tenantId, systemInstructions: hebunInstruction("sys"), userPrompt: "q", evidence: [], modelId: "", maxOutputTokens: 0,
      };
      let state: string;
      try {
        const outcome = await generateHebyModelAnswer(request, {
          env: env(opts.cap),
          transport: createLiveClaudeTransport({ apiKey: "sk-fake-ap3", spendBudget: budget, fetchImpl }),
          disclosure: { tenantId: tenant.tenantId, actorUserId: tenant.userId, purpose: "assistance", dataClasses: ["conversation"] },
          resolveOperatorEnabled: async () => true,
          authorizeDisclosure: authorizedDisclosure,
        });
        state = outcome.status === "generated" ? "generated" : outcome.state;
      } catch (error) {
        state = error instanceof ModelConnectivityError ? `threw:${error.code}` : `threw:${String(error)}`;
      }
      return { state, fetched: fetches - before, spent: budget.spent() - spentBefore };
    }

    /* ═══ M1 · under the cap ═══════════════════════════════════════════════ */
    for (let i = 0; i < 2; i += 1) {
      assert.deepEqual(await ask(a, { cap: "2" }), { state: "generated", fetched: 1, spent: 1 }, `M1: call ${i + 1} of 2 is admitted and sent once`);
    }
    assert.equal(await evidenceCount(a.tenantId), 2, "M1: one authorized evidence row per admitted dispatch");

    /* ═══ M2 · at the cap ══════════════════════════════════════════════════ */
    assert.deepEqual(
      await ask(a, { cap: "2" }),
      { state: "DISPATCH_SAFETY_CAP_REACHED", fetched: 0, spent: 0 },
      "M2: at the cap — nothing sent and the process budget is not consumed",
    );
    assert.equal(await evidenceCount(a.tenantId), 2, "M2: a cap refusal writes no authorized evidence");
    assert.equal(await refusalCount(a.tenantId, "model"), 1, "M2: exactly one cap refusal row");
    const refusal = (await setup.query<{ result: string; actor_id: string; source: string; metadata: Record<string, unknown> }>(`select * from audit_log where tenant_id = $1 and action = $2`, [a.tenantId, AI_DISPATCH_CAP_REFUSED])).rows[0]!;
    assert.equal(refusal.result, "rejected");
    assert.equal(refusal.actor_id, a.userId);
    assert.equal(refusal.source, "ai-dispatch-safety-cap");
    assert.deepEqual(
      Object.keys(refusal.metadata).sort(),
      ["admittedInWindow", "capPerTenantUtcDay", "dispatchClass", "windowStart"],
      "M2: the refusal carries the cap facts and nothing else",
    );
    assert.equal(refusal.metadata.capPerTenantUtcDay, 2);
    assert.equal(refusal.metadata.admittedInWindow, 2);
    assert.deepEqual(await ask(a, { cap: "3" }), { state: "generated", fetched: 1, spent: 1 }, "M2: refusal rows are not counted — raising the cap to 3 admits exactly one more");
    assert.deepEqual(await ask(a, { cap: "3" }), { state: "DISPATCH_SAFETY_CAP_REACHED", fetched: 0, spent: 0 });

    /* ═══ M3 · tenant isolation ════════════════════════════════════════════ */
    assert.deepEqual(await ask(b, { cap: "3" }), { state: "generated", fetched: 1, spent: 1 }, "M3: another tenant is admitted while A is capped");
    assert.equal(await refusalCount(b.tenantId, "model"), 0, "M3: B has no refusal");

    /* ═══ M4 · process budget exhausted ════════════════════════════════════ */
    {
      const evidenceBefore = await evidenceCount(b.tenantId);
      const refusalsBefore = await refusalCount(b.tenantId, "model");
      assert.deepEqual(
        await ask(b, { cap: "2", budget: createLiveSpendBudget(0) }),
        { state: "threw:rate-limited", fetched: 0, spent: 0 },
        "M4: the released process-budget refusal, before the network",
      );
      assert.equal(await evidenceCount(b.tenantId), evidenceBefore, "M4: no authorized evidence");
      assert.equal(await refusalCount(b.tenantId, "model"), refusalsBefore, "M4: no cap refusal row — it was not the cap");
      assert.deepEqual(await ask(b, { cap: "2" }), { state: "generated", fetched: 1, spent: 1 }, "M4: the cap was not charged — B's second unit is still there");
      assert.deepEqual(await ask(b, { cap: "2" }), { state: "DISPATCH_SAFETY_CAP_REACHED", fetched: 0, spent: 0 });
    }

    /* ═══ M5 · the UTC day ═════════════════════════════════════════════════ */
    {
      const c = await seedLocalIdentity(setup, { companyName: "Ap3 C", companySlug: "ap3-c", email: "c@ap3.test", roleType: "owner" });
      await setup.query(
        `insert into audit_log (tenant_id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, result, source)
         values ($1, 'human', $2, $3, 'external-ai-disclosure-decision', gen_random_uuid(), date_trunc('day', now() at time zone 'utc') at time zone 'utc' - interval '1 second', 'committed', 'external-ai-data-use')`,
        [c.tenantId, c.userId, EXTERNAL_AI_DISCLOSURE_AUTHORIZED],
      );
      assert.deepEqual(await ask(c, { cap: "1" }), { state: "generated", fetched: 1, spent: 1 }, "M5: yesterday's evidence is not today's");
      assert.deepEqual(await ask(c, { cap: "1" }), { state: "DISPATCH_SAFETY_CAP_REACHED", fetched: 0, spent: 0 });

      /* ═══ M6 · invalid configuration fails closed ═══════════════════════════ */
      const d = await seedLocalIdentity(setup, { companyName: "Ap3 D", companySlug: "ap3-d", email: "d@ap3.test", roleType: "owner" });
      for (const bad of ["abc", "0", "-5", "100000"]) {
        assert.deepEqual(await ask(d, { cap: bad }), { state: "DISPATCH_SAFETY_CAP_REACHED", fetched: 0, spent: 0 }, `M6: cap "${bad}" is 0`);
      }
      assert.equal(await evidenceCount(d.tenantId), 0);
    }

    /* ═══ C1/C2 · concurrency ══════════════════════════════════════════════ */
    {
      const e = await seedLocalIdentity(setup, { companyName: "Ap3 E", companySlug: "ap3-e", email: "e@ap3.test", roleType: "owner" });
      const f = await seedLocalIdentity(setup, { companyName: "Ap3 F", companySlug: "ap3-f", email: "f@ap3.test", roleType: "owner" });
      const decision = await authorizedDisclosure(null as never, true, MODEL);
      if (decision.disposition !== "authorized") throw new Error("unreachable");
      const pools = Array.from({ length: 12 }, () => createControlPlaneDb(harness.dbUrl));
      let prepaid = 0;
      const admit = (tenant: { tenantId: string; userId: string }, i: number, gate: Promise<void>) => {
        const evidence = externalAiDisclosureEvidence(
          { tenantId: tenant.tenantId, actorUserId: tenant.userId, purpose: "assistance", dataClasses: ["conversation"] },
          decision,
          MODEL,
          `ap3-c-${i}`,
        );
        return admitAiDispatch(
          {
            tenantId: tenant.tenantId,
            dispatchClass: "model",
            actorUserId: tenant.userId,
            prepay: () => {
              prepaid += 1;
              return true;
            },
            commit: async (db: ControlPlaneDatabase) => {
              await gate; /* hold every transaction open until all are in flight */
              if (!(await recordExternalAiDisclosureDecision(evidence, { getDb: () => db }))) throw new Error("evidence");
            },
          },
          { getDb: () => pools[i % pools.length]!.db, env: { [MODEL_KEY]: "3" } },
        );
      };
      try {
      let open!: () => void;
      const gate = new Promise<void>((r) => (open = r));
      const runs = [...Array.from({ length: 12 }, (_, i) => admit(e, i, gate)), ...Array.from({ length: 4 }, (_, i) => admit(f, i + 100, gate))];
      setTimeout(open, 300);
      const results = await Promise.all(runs);
      const eResults = results.slice(0, 12);
      const fResults = results.slice(12);
      assert.equal(eResults.filter((r) => r.status === "admitted").length, 3, "C1: exactly the cap is admitted under concurrency");
      assert.ok(eResults.filter((r) => r.status === "refused").every((r) => r.status === "refused" && r.reason === "dispatch-safety-cap-reached"));
      assert.equal(await evidenceCount(e.tenantId), 3, "C1: exactly three charging rows");
      assert.equal(fResults.filter((r) => r.status === "admitted").length, 3, "C2: the other tenant's admissions are independent");
      assert.equal(await evidenceCount(f.tenantId), 3);
      assert.equal(prepaid, 6, "C1/C2: the process budget is consumed only by admitted dispatches");
      assert.equal(await refusalCount(e.tenantId, "model"), 9);
      } finally {
        await Promise.all(pools.map((p) => p.dispose()));
      }
    }

    /* ═══ FAIL-CLOSED ══════════════════════════════════════════════════════ */
    {
      let prepays = 0;
      const prepay = () => {
        prepays += 1;
        return true;
      };
      const noDb = await admitAiDispatch({ tenantId: a.tenantId, dispatchClass: "model", actorUserId: a.userId, prepay, commit: async () => "x" }, { getDb: () => null });
      assert.deepEqual(noDb, { status: "refused", reason: "persistence-unavailable" }, "no database ⇒ refused");
      assert.equal(prepays, 0, "and the process budget is not touched");
      const g = await seedLocalIdentity(setup, { companyName: "Ap3 G", companySlug: "ap3-g", email: "g@ap3.test", roleType: "owner" });
      const thrown = await admitAiDispatch(
        {
          tenantId: g.tenantId,
          dispatchClass: "model",
          actorUserId: g.userId,
          prepay,
          commit: async (db) => {
            await db.execute(
              `insert into audit_log (tenant_id, actor_type, actor_id, action, entity_type, entity_id, occurred_at, result) values ('${g.tenantId}', 'human', '${g.userId}', '${EXTERNAL_AI_DISCLOSURE_AUTHORIZED}', 'x', gen_random_uuid(), now(), 'committed')` as never,
            );
            throw new Error("boom after the write");
          },
        },
        { getDb },
      );
      assert.deepEqual(thrown, { status: "refused", reason: "persistence-unavailable" });
      assert.equal(await evidenceCount(g.tenantId), 0, "a throwing commit rolls its write back");
      assert.equal(prepays, 1, "the unit taken before the failed commit is not refunded (conservative)");
    }

    /* ═══ MEDIA ════════════════════════════════════════════════════════════ */
    {
      const ctxFor = async (s: Awaited<ReturnType<typeof seedLocalIdentity>>): Promise<TenantContext> => {
        const session = (
          await setup.query<{ id: string }>(
            `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
               user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
               issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
             values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour') returning id`,
            [s.authIdentityId, createHash("sha256").update(s.tenantId).digest("hex"), s.userId, s.tenantId, s.membershipId],
          )
        ).rows[0]!.id;
        return asHumanTenantContext({
          tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId, membershipVersion: 1,
          roleId: s.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "ap3",
          authenticatedAt: new Date().toISOString(),
        });
      };
      const seedDraft = async (tenantId: string, authorId: string): Promise<string> => {
        const content = `Draft ${randomUUID()}`;
        const artifact = await setup.query<{ id: string }>(
          `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace, current_revision, intended_destination, created_by, created_by_type)
           values ($1,'content-draft','Draft','draft','operations',1,'instagram',$2,'human') returning id`,
          [tenantId, authorId],
        );
        await setup.query(
          `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
           values ($1,$2,1,$3,$4,'human',$5)`,
          [tenantId, artifact.rows[0]!.id, content, createHash("sha256").update(content).digest("hex"), authorId],
        );
        return artifact.rows[0]!.id;
      };
      let failure: "budget-exhausted" | "provider-unavailable" = "provider-unavailable";
      const providerCalls: string[] = [];
      const labelled = (label: "live" | "fake"): MediaGenerationTransport => ({
        transport: label,
        provider: "ap3-fake-provider",
        model: "ap3-fake-model",
        allowedDownloadHosts: [],
        modes: ["text-to-image"],
        async generate(input: { invocationId: string }): Promise<MediaGenerationOutcome> {
          providerCalls.push(input.invocationId);
          return { status: "failed", providerJobId: null, failure, usage: null } as MediaGenerationOutcome;
        },
      });
      const store = createMemoryMediaObjectStore();
      void pngBytes;
      const h = await seedLocalIdentity(setup, { companyName: "Ap3 H", companySlug: "ap3-h", email: "h@ap3.test", roleType: "owner" });
      const hCtx = await ctxFor(h);
      await setup.query(
        `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [h.tenantId, h.authIdentityId, h.userId, hCtx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(hCtx, { justification: "Establishing Governance for the AP-3 media fixture." }, { getDb } as never)).status, "established");
      assert.equal((await createDurableAgentIdentity(hCtx, { name: "Heby", justification: "Register this agent for the AP-3 fixture." }, { getDb } as never)).status, "established");
      const draft = await seedDraft(h.tenantId, h.userId);
      const media = (label: "live" | "fake") =>
        requestMediaGeneration(
          hCtx,
          { artifactId: draft, revisionNo: 1, promptText: "A kilim on the loom.", requestKey: randomUUID() },
          { getDb, resolveStorage: () => ({ status: "available", store }), resolveTransport: () => ({ status: "available", transport: labelled(label) }) },
        );
      const liveRows = () => n(`select count(*)::text n from media_generation_invocations where tenant_id = $1 and transport = 'live'`, [h.tenantId]);

      /* D2 — budget-exhausted rows first: they are recorded but never counted. */
      failure = "budget-exhausted";
      for (let i = 0; i < 3; i += 1) assert.equal((await media("live")).status, "not-admitted", "D2: a budget-exhausted attempt is still recorded");
      assert.equal(await liveRows(), 3);
      failure = "provider-unavailable";
      process.env[MEDIA_KEY] = "5";
      for (let i = 0; i < 5; i += 1) {
        const r = await media("live");
        assert.equal(r.status, "not-admitted", `D1: live registration ${i + 1} of 5 is admitted (and the fake provider fails it)`);
      }
      assert.equal(await liveRows(), 8, "D1/D2: five counted + three budget-exhausted");
      const callsBefore = providerCalls.length;
      assert.deepEqual(await media("live"), { status: "refused", reason: "dispatch-safety-cap-reached" }, "D1: the sixth is refused");
      assert.equal(providerCalls.length, callsBefore, "D1: the provider is not called");
      assert.equal(await liveRows(), 8, "D1: no invocation row is written");
      assert.equal(await refusalCount(h.tenantId, "media"), 1, "D1: one media cap refusal row");
      assert.equal(await refusalCount(h.tenantId, "model"), 0, "D1: classes are separate");
      assert.equal((await media("fake")).status, "not-admitted", "D3: a fake transport sends nothing and is not gated");
      delete process.env[MEDIA_KEY];
    }

    console.log("ap3-dispatch-safety-cap/cap-postgres: passed");
  } finally {
    await setup.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
