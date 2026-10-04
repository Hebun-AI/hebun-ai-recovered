/*
 * KNOWLEDGE TRUST PHASE 5.2 — bounded-universe evidence through preparation, persistence and reload,
 * against a DISPOSABLE database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "A content draft prepared over a small eligible universe records its evidence as
 *    `bounded-universe`, with every eligible record, no matched terms and nothing withheld; the
 *    reviewer's revision-evidence read replays exactly that. Message drafts and operational plans
 *    over the same corpus never produce the status."
 *
 * Real answer flow, real generator, a counting fake transport (no egress), a fake Knowledge
 * repository behind the real resolver. No provider, no production.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import type { PublicKnowledgeDeps } from "../../src/features/heby-answer/knowledge-evidence.server";
import { readRevisionGenerationEvidence } from "../../src/features/heby-answer/revision-generation-evidence.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;

const KEYS = ["brand-positioning", "sales-markets", "sourcing-sales-model"] as const;
const ELIGIBLE = ["brand-positioning", "sales-markets"];
const uuid = (prefix: string, i: number) => `${prefix}000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
const RECORDS = KEYS.map(
  (key, i) =>
    ({
      factId: uuid("aa", i), factKey: key, domainKey: "company", scope: "organization", title: `Title ${key}`,
      statement: `STATEMENT-${key}`, lifecycleStatus: "ratified", authorityClass: null, health: null, ratified: true,
      ratifiedAt: null, ratificationDecisionId: `dec-${key}`, governanceSessionId: null, ratifiedByActorId: null,
      activeKnowledgeNodeId: uuid("bb", i), effectiveFrom: null, effectiveUntil: null, nextReviewAt: null,
      knowledgeVersion: 1, factVersion: 1, freshness: "unknown",
    }) as unknown as KnowledgeSourceRecord,
);
const STATES = new Map<string, "allowed" | "denied">([
  [uuid("bb", 0), "allowed"],
  [uuid("bb", 1), "allowed"],
  [uuid("bb", 2), "denied"],
]);

const knowledge: PublicKnowledgeDeps = {
  getRepo: () =>
    ({
      listFacts: async () => ({ records: RECORDS, incomplete: [], truncated: false }),
      searchFacts: async () => ({ rows: [], incomplete: [], truncated: false, trigramAvailable: false }),
      hasTrigram: async () => false,
    }) as unknown as DurableKnowledgeRepository,
  now: () => NOW,
  readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: new Set() }),
  readPublicUse: async () => ({ status: "read", states: STATES }),
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kt52_persist");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    const seeded = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-kt52", email: "director@kt52.test" });
    const tenant = asHumanTenantContext({
      tenantId: seeded.tenantId, userId: seeded.userId, authIdentityId: seeded.authIdentityId, membershipId: seeded.membershipId,
      membershipVersion: 1, roleId: seeded.roleId, sessionContextId: "00000000-0000-4000-8000-000000000000", provider: "local",
      assuranceLevel: "aal1", mfaVerified: false, requestId: "kt52-persist", authenticatedAt: NOW.toISOString(),
    });
    const repo = createDurableConversationRepository(handle.db);
    const dbDeps = { getDb: () => handle.db } as never;
    assert.equal((await createDurableAgentIdentity(tenant, { name: "Heby" }, dbDeps)).status, "established");

    const sent: string[] = [];
    const transport: ClaudeTransport = {
      async send(request) {
        sent.push(JSON.stringify(request));
        return { id: "req_kt52", model: request.model, content: [{ type: "text", text: "Handwoven, honestly." }], stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    const deps = {
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-kt52",
      knowledge,
      write: dbDeps,
      agentIdentity: dbDeps,
    } as HebyModelAnswerDeps & { write: never; agentIdentity: never };
    const statuses = async () =>
      (await setup.query("select status from heby_answer_evidence_set order by recorded_at, id")).rows.map((r) => r.status as string);

    /* A content draft over a 2-fact eligible universe: recorded as bounded-universe. */
    const prepared = await prepareWorkArtifact(
      { prompt: "Write an Instagram caption.", route: "/operations", artifactType: "content-draft", intendedDestination: "instagram", title: "Who we are" },
      deps,
    );
    assert.equal(prepared.status, "prepared");
    if (prepared.status !== "prepared") throw new Error("unreachable");
    assert.deepEqual(await statuses(), ["bounded-universe"], "the persisted set says how it was produced");
    const items = (await setup.query<{ fact_key: string; matched_terms: string[] }>("select fact_key, matched_terms from heby_answer_evidence_item order by ordinal")).rows;
    assert.deepEqual(items.map((r) => r.fact_key), ELIGIBLE, "every eligible record, the denied one absent");
    assert.ok(items.every((r) => r.matched_terms.length === 0), "no matched terms were stored");
    assert.ok(!sent[0].includes("STATEMENT-sourcing-sales-model"), "the denied fact never reached the wire");

    /* The reviewer's read replays the record. */
    const revisionId: string = (await setup.query<{ id: string }>("select id from work_artifact_revisions where artifact_id = $1", [prepared.artifactId])).rows[0].id;
    const replay = await readRevisionGenerationEvidence(tenant, { artifactId: prepared.artifactId, revisionId }, { getDb: () => handle.db, getConversationRepo: () => repo });
    assert.equal(replay.status, "recorded");
    if (replay.status !== "recorded") throw new Error("unreachable");
    assert.equal(replay.selection.status, "bounded-universe");
    assert.deepEqual(replay.items.map((i) => i.factKey), ELIGIBLE);
    assert.ok(replay.items.every((i) => i.matchedTerms.length === 0));

    /* Message drafts and operational plans over the same corpus: unchanged, never bounded-universe. */
    for (const artifactType of ["message-draft", "operational-plan"] as const) {
      const r = await prepareWorkArtifact({ prompt: "Draft it.", route: "/operations", artifactType, title: artifactType }, deps);
      assert.equal(r.status, "prepared", `${artifactType}: prepared`);
    }
    const all = await statuses();
    assert.equal(all.filter((s) => s === "bounded-universe").length, 1, "only the content draft produced the status");

    console.log("PASS knowledge-trust-phase-5-2 persistence-postgres");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
