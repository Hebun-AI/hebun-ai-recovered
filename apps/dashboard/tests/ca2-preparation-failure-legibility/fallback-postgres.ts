/*
 * CA-2 PREPARATION FAILURE LEGIBILITY — against a disposable PostgreSQL, through the released seam.
 *
 * The production failure: a revision request ended as `no-model-answer` and the surface said only
 * "Hebun did not return a model-written draft". This proves, for each way a model answer can fail to
 * be served, that:
 *   - no revision is written and nothing is published, permitted or sent;
 *   - the browser-bound result names the closed reason, and carries no answer, body or limitations;
 *   - a provider failure is never reported as an authorization refusal;
 *   - a grounded request declares `provider-observation`, and an ungrounded one declares only classes
 *     the released platform policy allows — the gate itself is unchanged and still decides;
 *   - a successful model answer still writes exactly one new revision, awaiting Governance review.
 * No real provider is reached: the transport is a fake, and fetch throws.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { createFakeClaudeTransport, type FakeClaudeScenario } from "../helpers/fake-claude-transport";
import type { HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import {
  prepareWorkArtifact,
  toPreparationClientResult,
} from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { readArtifactRevisionReviewStates } from "../../src/features/work-artifact-review/review-revision.server";
import { decidePlatformDisclosure } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import type { DataClass } from "../../src/features/external-ai-data-use/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { publicKnowledgeNoMatch } from "../helpers/public-knowledge";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
} as const;
const INSTRUCTION = "Remove the age claim and keep the knotting detail only.";

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
    [seeded.authIdentityId, createHash("sha256").update(tag).digest("hex"), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
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
    requestId: "ca2-legibility-request",
    authenticatedAt: new Date().toISOString(),
  });
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("ca2-preparation-failure-legibility/fallback-postgres: exited before completing");
    process.exitCode = 1;
  }
});

/* The browser-bound result must carry no answer, body, evidence or limitation of any kind. */
function assertClientSafe(label: string, value: unknown): void {
  const json = JSON.stringify(value);
  for (const forbidden of ['"answer"', '"body"', '"limitations"', '"evidence"', '"outcome"', "deterministic", INSTRUCTION]) {
    assert.ok(!json.includes(forbidden), `${label}: the client result carries no ${forbidden}`);
  }
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ca2_failure_legibility");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ca2l", email: "director@acme.test" })) as Seeded;
    const tenant = contextFor(acme, await sessionRowFor(setup, acme, "ca2l-acme"));
    await seedGovernanceAuthority(setup, acme, dbDeps, { ctx: tenant, sessionContextId: tenant.sessionContextId });
    const agent = await createDurableAgentIdentity(tenant, { name: "Heby", justification: "Register this agent for the test organization." }, dbDeps);
    assert.equal(agent.status, "established");
    const repo = createDurableConversationRepository(handle.db);

    /* Every disclosure each request declared, captured as the generator received it. */
    const declared: (readonly DataClass[] | undefined)[] = [];
    const depsFor = (scenario: FakeClaudeScenario, overrides: Partial<HebyModelAnswerDeps> = {}) => {
      const transport = createFakeClaudeTransport(scenario);
      return {
        deps: {
          resolveTenant: async () => tenant,
          readOverview: () => undefined,
          env: MODEL_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
          generate: (async (request, options) => {
            declared.push(options?.disclosure?.dataClasses);
            return generateHebyModelAnswer(request, options);
          }) as typeof generateHebyModelAnswer,
          getConversationRepo: () => repo,
          resolvePublicKnowledge: publicKnowledgeNoMatch,
          newCorrelationId: () => `corr-${randomUUID()}`,
          resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
          ...overrides,
          write: dbDeps,
          read: dbDeps,
          agentIdentity: dbDeps,
        },
        transport,
      };
    };

    /* A generator that refuses at the data-use gate, as B2 does, and records what was declared. */
    const refuseDataUse = (async (
      _request: Parameters<typeof generateHebyModelAnswer>[0],
      options?: Parameters<typeof generateHebyModelAnswer>[1],
    ) => {
      declared.push(options?.disclosure?.dataClasses);
      return { status: "unavailable", state: "DATA_USE_NOT_AUTHORIZED", modelStatus: "unavailable" };
    }) as unknown as typeof generateHebyModelAnswer;

    const n = async (q: string) => (await setup.query<{ n: number }>(q)).rows[0]!.n;
    const world = async () => ({
      revisions: await n("select count(*)::int n from work_artifact_revisions"),
      decisions: await n("select count(*)::int n from decision_records"),
      permits: await n("select count(*)::int n from action_permits"),
      requests: await n("select count(*)::int n from heby_action_requests"),
      attempts: await n("select count(*)::int n from action_execution_attempts"),
    });

    const created = await createWorkArtifact(
      tenant,
      { artifactType: "content-draft", intendedDestination: "instagram", title: "Loom", content: "Every knot on this loom is tied by hand, for a hundred years." },
      "operations",
      dbDeps,
    );
    assert.equal(created.status, "created");
    const artifactId = created.status === "created" ? created.artifactId : "";
    const revise = (deps: object, extra: Record<string, unknown> = {}) =>
      prepareWorkArtifact({ prompt: INSTRUCTION, route: "/operations", artifactType: "content-draft", title: "Loom", artifactId, ...extra }, deps as never);

    /* F1 — the provider raises: provider-failed with its closed code, never an authorization refusal. */
    let before = await world();
    let { deps } = depsFor("timeout");
    let result = await revise(deps);
    assert.equal(result.status === "refused" && result.reason, "no-model-answer", "F1 a provider failure serves no model answer");
    let client = toPreparationClientResult(result);
    assert.deepEqual(client.status === "refused" && client.modelFallback, { kind: "provider-failed", code: "timeout" }, "F1 named as a provider failure");
    assert.notEqual(client.status === "refused" && client.modelFallback?.kind, "unavailable", "F1 never reported as a data-use refusal");
    assertClientSafe("F1", client);
    assert.deepEqual(await world(), before, "F1 nothing was written, permitted, requested or attempted");

    /* F2 — the provider answers, validation withholds it: withheld, and still nothing written. */
    before = await world();
    ({ deps } = depsFor("success-invalid-answer"));
    result = await revise(deps);
    client = toPreparationClientResult(result);
    assert.deepEqual(client.status === "refused" && [client.reason, client.modelFallback], ["no-model-answer", { kind: "withheld" }], "F2 an invalid model answer is withheld");
    assertClientSafe("F2", client);
    assert.deepEqual(await world(), before, "F2 an invalid model answer creates no revision");

    /* F3 — a gate refuses before the transport (data use): unavailable with that exact state. */
    before = await world();
    const refusing = depsFor("success");
    result = await revise({
      ...refusing.deps,
      generate: refuseDataUse,
    });
    client = toPreparationClientResult(result);
    assert.deepEqual(
      client.status === "refused" && client.modelFallback,
      { kind: "unavailable", state: "DATA_USE_NOT_AUTHORIZED" },
      "F3 a data-use refusal is named as such",
    );
    assert.equal(refusing.transport.calls, 0, "F3 the transport was never reached");
    assertClientSafe("F3", client);
    assert.deepEqual(await world(), before, "F3 a refused request writes nothing");

    /* F4 — the Director's control is off: director-disabled, the model never asked. */
    before = await world();
    const off = depsFor("success", { resolveDirectorEnabled: async () => false });
    result = await revise(off.deps);
    client = toPreparationClientResult(result);
    assert.equal(client.status, "refused", "F4 refused");
    assert.equal(off.transport.calls, 0, "F4 the transport was never reached");
    assertClientSafe("F4", client);
    assert.deepEqual(await world(), before, "F4 nothing written");

    /* G1 — a GROUNDED request declares provider-observation, which the released policy does not allow. */
    declared.length = 0;
    const grounded = depsFor("success");
    await revise({
      ...grounded.deps,
      generate: refuseDataUse,
    }, { observationSupplement: "a caption" });
    assert.ok(declared[0]?.includes("provider-observation"), "G1 a grounded preparation declares provider-observation");
    assert.equal(
      decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass: "provider-observation" }).decision,
      "unknown",
      "G1 the released platform policy does not allow it for assistance — the gate refuses",
    );

    /* S1 — success, ungrounded: only allowed classes declared; exactly one new revision, awaiting review. */
    declared.length = 0;
    before = await world();
    const ok = depsFor("success");
    result = await revise(ok.deps);
    assert.equal(result.status, "prepared", `S1 a valid model answer is prepared: ${JSON.stringify(result.status === "refused" ? result.reason : "")}`);
    for (const dataClass of declared[0] ?? []) {
      assert.equal(
        decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass }).decision,
        "allowed",
        `S1 an ungrounded preparation declares only platform-allowed classes (${dataClass})`,
      );
    }
    assert.ok(!(declared[0] ?? []).includes("provider-observation"), "S1 no observation is declared without grounding");
    client = toPreparationClientResult(result);
    assertClientSafe("S1", client);
    const after = await world();
    assert.equal(after.revisions, before.revisions + 1, "S1 exactly one new revision");
    assert.deepEqual(
      { ...after, revisions: before.revisions },
      before,
      "S1 no decision, permit, request or execution attempt — nothing published or sent",
    );
    const history = await readWorkArtifactHistory(tenant, artifactId, dbDeps);
    const newest = history.reduce((a, b) => (b.revisionNo > a.revisionNo ? b : a));
    assert.equal(newest.authoredByActorType, "agent", "S1 the new revision is agent-authored");
    const states = await readArtifactRevisionReviewStates(tenant, artifactId, dbDeps);
    assert.equal(states.find((s) => s.revisionNo === newest.revisionNo)?.decision, null, "S1 the new revision awaits Governance review");

    assert.equal(networkCalls, 0, "no real network was reached");
    finished = true;
    console.log("ca2-preparation-failure-legibility/fallback-postgres: all assertions passed");
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
