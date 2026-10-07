/*
 * AP-1 — PLURALITY FOUNDATION, proved against a REAL PostgreSQL (PG 18, builtin C.UTF-8, like
 * production).
 *
 *   1. AGENT #1 IS UNCHANGED WITHOUT A SELECTION. One in-service agent: the proposer and the
 *      authorship resolve exactly as before AP-1, and asking with no selection is byte-identical to
 *      asking with an empty one.
 *   2. A SECOND GOVERNED IDENTITY. With two in service and no selection: `ambiguous-…` (unchanged).
 *      With a selection: that agent, verified against the tenant's own read — a foreign, unknown or
 *      malformed id refuses `selected-agent-unresolvable`, a retired one `selected-agent-retired`.
 *   3. ORIGINATION REFUSES A BAD SELECTION BEFORE ANY MODEL CALL, and writes no invocation.
 *   4. B1 — media generation tells the truth about ambiguity (`ambiguous-durable-agent`), never a
 *      false "no durable agent".
 *   5. B2 — hypothesis lineage is agent-scoped: a hypothesis about B cannot supersede one about A.
 *
 * A disposable local database, dropped on exit. No production data, no provider contacted.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { seedGovernanceBootstrapRows } from "../helpers/agent-mandate-seed";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore, pngBytes } from "../helpers/media-fakes";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { resolveAgentAuthorship } from "../../src/features/work-artifacts/agent-authorship.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { registerInvocation, finalizeInvocation } from "../../src/features/agent-origination/invocation-provenance.server";
import { fileImprovementHypothesis } from "../../src/features/agent-improvement-hypothesis/write-improvement-hypothesis.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000a9001";
const TENANT_B = "10000000-0000-4000-8000-0000000a9002";
const HUMAN_A = "20000000-0000-4000-8000-0000000a9001";
const HUMAN_B = "20000000-0000-4000-8000-0000000a9002";
const NOW = new Date("2026-10-07T09:00:00.000Z");
const WHY = "Register this agent for the AP-1 plurality test organization.";

const CANDIDATE =
  "Narrow the action vocabulary offered to this agent so the closed contract is easier to satisfy.";
const EFFECT = "Fewer selections rejected by the contract, measured on the same recorded column.";
const LIMITS = "It does not know why the output failed to parse, and it may change nothing at all.";

function tenantContext(tenantId: string, userId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: "auth-identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "ap1-plurality",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap1_plurality");
  await harness.createDatabase();
  try {
    harness.migrateDatabase();
    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug) values ($1, 'Tenant A', 'ap1-a'), ($2, 'Tenant B', 'ap1-b')`,
        [TENANT_A, TENANT_B],
      );
      await seed.query(
        `insert into users (id, email, name) values ($1, 'a@ap1.test', 'Human A'), ($2, 'b@ap1.test', 'Human B')`,
        [HUMAN_A, HUMAN_B],
      );
      await seedGovernanceBootstrapRows(seed, TENANT_A, HUMAN_A);
      await seedGovernanceBootstrapRows(seed, TENANT_B, HUMAN_B);
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    const probe = new Client({ connectionString: harness.dbUrl });
    await probe.connect();
    const deps = { getDb: () => handle.db };
    const A = tenantContext(TENANT_A, HUMAN_A);
    const B = tenantContext(TENANT_B, HUMAN_B);
    const count = async (table: string): Promise<number> =>
      (await probe.query(`select count(*)::int as n from ${table}`)).rows[0].n as number;

    try {
      const register = async (ctx: TenantContext, name: string): Promise<string> => {
        const made = await createDurableAgentIdentity(ctx, { name, justification: WHY }, { ...deps, now: () => NOW });
        assert.equal(made.status, "established", `${name} is registered`);
        if (made.status !== "established") throw new Error("unreachable");
        return made.identity.agentId;
      };

      /* ── 1. AGENT #1, ALONE, NO SELECTION: EXACTLY AS BEFORE ─────────────── */
      const heby = await register(A, "Heby");
      const foreign = await register(B, "Heby");

      const plain = await resolveAgentProposer(A, deps);
      const empty = await resolveAgentProposer(A, deps, {});
      assert.equal(plain.status, "resolved", "a single in-service agent resolves with no selection");
      assert.deepEqual(empty, plain, "an empty selection is the pre-AP-1 call, byte for byte");
      assert.equal(plain.status === "resolved" && plain.proposer.agentId, heby);
      const plainAuthor = await resolveAgentAuthorship(A, deps);
      assert.equal(plainAuthor.status === "resolved" && plainAuthor.authorship.agentId, heby);
      assert.deepEqual(
        await resolveAgentProposer(A, deps, { agentId: heby }),
        plain,
        "selecting the only agent names the same proposer as not selecting",
      );

      /* ── 2. A SECOND GOVERNED IDENTITY, AND EXPLICIT SELECTION ──────────── */
      const atlas = await register(A, "Atlas");
      assert.deepEqual(
        await resolveAgentProposer(A, deps),
        { status: "refused", reason: "ambiguous-durable-agent-identity" },
        "two in service and no selection: still a refusal, never a pick",
      );
      assert.deepEqual(
        await resolveAgentAuthorship(A, deps),
        { status: "refused", reason: "ambiguous-durable-agent-identity" },
        "authorship refuses the same way",
      );
      const chosen = await resolveAgentProposer(A, deps, { agentId: atlas });
      assert.equal(chosen.status === "resolved" && chosen.proposer.agentId, atlas, "the selection names Atlas");
      const chosenAuthor = await resolveAgentAuthorship(A, deps, { agentId: atlas });
      assert.equal(
        chosenAuthor.status === "resolved" && chosenAuthor.authorship.agentId,
        atlas,
        "the authorship selection names Atlas too",
      );

      for (const [label, agentId] of [
        ["another organization's agent", foreign],
        ["an id nobody holds", "00000000-0000-4000-8000-0000000000ff"],
        ["a malformed id", "not-an-id"],
      ] as const) {
        assert.deepEqual(
          await resolveAgentProposer(A, deps, { agentId }),
          { status: "refused", reason: "selected-agent-unresolvable" },
          `${label} selects nothing — foreign and unknown are indistinguishable`,
        );
        assert.deepEqual(
          await resolveAgentAuthorship(A, deps, { agentId }),
          { status: "refused", reason: "selected-agent-unresolvable" },
        );
      }

      /* ── 3. ORIGINATION REFUSES A BAD SELECTION BEFORE ANY MODEL CALL ────── */
      const invocationsBefore = await count("heby_origination_invocations");
      const refusedOrigination = await originateAgentAction(
        { goal: "Record that the quarterly supplier review is due next week.", agentId: foreign },
        {
          resolveTenant: async () => A,
          agentIdentity: deps,
          generate: (async () => {
            throw new Error("the model must not be called for an unresolvable selection");
          }) as never,
        },
      );
      assert.deepEqual(refusedOrigination, { status: "refused", reason: "selected-agent-unresolvable" });
      assert.equal(await count("heby_origination_invocations"), invocationsBefore, "no invocation was registered");

      /* ── 4. B1: MEDIA GENERATION TELLS THE TRUTH ABOUT AMBIGUITY ────────── */
      const store = createMemoryMediaObjectStore();
      const mediaDeps = {
        getDb: () => handle.db,
        now: () => NOW,
        resolveStorage: (): MediaStorageResolution => ({ status: "available", store }),
        resolveTransport: () => ({
          status: "available" as const,
          transport: createFakeMediaGenerationTransport({ kind: "bytes", bytes: pngBytes(1080, 1080) }),
        }),
      };
      const ask = {
        artifactId: "00000000-0000-4000-8000-00000000a001",
        revisionNo: 1,
        promptText: "A rug on a wooden floor.",
        requestKey: "00000000-0000-4000-8000-00000000b001",
      };
      const ambiguousMedia = await requestMediaGeneration(A, ask, mediaDeps);
      assert.equal(ambiguousMedia.status, "refused");
      assert.equal(
        ambiguousMedia.status === "refused" && ambiguousMedia.reason,
        "ambiguous-durable-agent",
        "B1: two agents in service is NOT 'no durable agent'",
      );

      /* ── 5. B2: HYPOTHESIS LINEAGE IS AGENT-SCOPED ──────────────────────── */
      for (const agentId of [heby, atlas]) {
        const proposer = await resolveAgentProposer(A, deps, { agentId });
        if (proposer.status !== "resolved") throw new Error("unreachable");
        const id = await registerInvocation(A, { transport: "fake", proposer: proposer.proposer }, deps);
        assert.ok(id, "an invocation registers for the evidence");
        await finalizeInvocation(A, { invocationId: id!, state: "selection-invalid", filingOutcome: "not-attempted" }, deps);
      }
      const payload = (agentId: string, supersedesHypothesisId?: string) => ({
        agentId,
        improvementTarget: "selection-behaviour",
        evidenceFindingKey: "selection-invalid",
        candidateChange: CANDIDATE,
        expectedEffect: EFFECT,
        limitations: LIMITS,
        ...(supersedesHypothesisId ? { supersedesHypothesisId } : {}),
      });
      const aboutHeby = await fileImprovementHypothesis(A, payload(heby), deps);
      assert.equal(aboutHeby.status, "filed", JSON.stringify(aboutHeby));
      if (aboutHeby.status !== "filed") throw new Error("unreachable");
      const hebyHypothesisId = aboutHeby.hypothesisId;

      const hypothesesBefore = await count("agent_improvement_hypotheses");
      assert.deepEqual(
        await fileImprovementHypothesis(A, payload(atlas, hebyHypothesisId), deps),
        { status: "refused", reason: "supersedes-other-agent" },
        "B2: a hypothesis about Atlas cannot supersede one about Heby",
      );
      assert.equal(await count("agent_improvement_hypotheses"), hypothesesBefore, "and nothing was written");
      const sameAgent = await fileImprovementHypothesis(A, payload(heby, hebyHypothesisId), deps);
      assert.equal(sameAgent.status, "filed", "the same agent's lineage still works");

      /* ── 2b. A RETIRED SELECTION ─────────────────────────────────────────── */
      assert.equal((await retireDurableAgentIdentity(A, { agentId: atlas }, deps)).status, "retired");
      assert.deepEqual(
        await resolveAgentProposer(A, deps, { agentId: atlas }),
        { status: "refused", reason: "selected-agent-retired" },
        "a retired agent cannot be chosen",
      );
      assert.deepEqual(
        await resolveAgentAuthorship(A, deps, { agentId: atlas }),
        { status: "refused", reason: "selected-agent-retired" },
      );
      const back = await resolveAgentProposer(A, deps);
      assert.equal(
        back.status === "resolved" && back.proposer.agentId,
        heby,
        "with Atlas retired, the unselected path resolves Heby again — Agent #1's path is intact",
      );

      console.log("ap1-plurality-foundation/plurality-postgres: governed plurality, explicit selection, B1/B2 hold");
    } finally {
      await probe.end();
      await handle.dispose();
    }
  } finally {
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
