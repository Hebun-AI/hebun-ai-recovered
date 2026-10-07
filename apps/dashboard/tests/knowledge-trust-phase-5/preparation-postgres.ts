/*
 * KNOWLEDGE TRUST PHASE 5 — the content-preparation gate, end to end, against a DISPOSABLE database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Preparing a content draft grounds only on ratified + public-use-allowed Knowledge. When that
 *    cannot be established, or nothing qualifies, the transport is never reached and no revision is
 *    written — counted, not inferred from a label. When the universe exists but the question matched
 *    nothing, the model is asked with no withheld fact standing in. The purpose comes from the
 *    artifact's own (stored) type: a client cannot downgrade a draft, and a route without the
 *    Knowledge class cannot skip the refusal. Internal preparation is unchanged."
 *
 * Real answer flow, real generator, a counting fake transport (no egress), a fake Knowledge
 * repository behind the real resolver. No provider, no production.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import type { PublicKnowledgeDeps } from "../../src/features/heby-answer/knowledge-evidence.server";
import { generateHebyModelAnswer, type ClaudeTransport, type ClaudeTransportRequest } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;

interface Seeded { readonly tenantId: string; readonly userId: string; readonly authIdentityId: string; readonly membershipId: string; readonly roleId: string }
function contextFor(seeded: Seeded): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId, userId: seeded.userId, authIdentityId: seeded.authIdentityId, membershipId: seeded.membershipId,
    membershipVersion: 1, roleId: seeded.roleId, sessionContextId: "00000000-0000-4000-8000-000000000000", provider: "local",
    assuranceLevel: "aal1", mfaVerified: false, requestId: "kt5-prepare", authenticatedAt: NOW.toISOString(),
  });
}

interface Case { key: string; ratified: boolean; use?: "allowed" | "denied"; lifecycle?: string; until?: string; rejected?: boolean }
const CASES: Case[] = [
  { key: "brand-positioning", ratified: true, use: "allowed" },
  { key: "sales-markets", ratified: true, use: "allowed" },
  { key: "sourcing-sales-model", ratified: true, use: "denied" },
  { key: "current-business-objectives", ratified: true, use: "denied" },
  { key: "product-offering", ratified: true },
  { key: "allowed-unratified", ratified: false, use: "allowed" },
  { key: "allowed-rejected", ratified: true, use: "allowed", rejected: true },
  { key: "allowed-archived", ratified: true, use: "allowed", lifecycle: "archived" },
  { key: "allowed-retired", ratified: true, use: "allowed", lifecycle: "retired" },
  { key: "allowed-expired", ratified: true, use: "allowed", until: "2026-01-01T00:00:00.000Z" },
];
const ELIGIBLE = ["brand-positioning", "sales-markets"];
/* Uuids per case: since KT-5.2 the eligible universe is persisted as evidence (fact_id, knowledge_node_id are uuid). */
const uuidOf = (key: string, prefix: string) => `${prefix}000000-0000-4000-8000-${(CASES.findIndex((c) => c.key === key) + 1).toString().padStart(12, "0")}`;
const factUuid = (key: string) => uuidOf(key, "aa");
const node = (key: string) => uuidOf(key, "bb");
const record = (c: Case): KnowledgeSourceRecord =>
  ({
    factId: factUuid(c.key), factKey: c.key, domainKey: "company", scope: "organization", title: `Title ${c.key}`,
    statement: `STATEMENT-${c.key}`, lifecycleStatus: c.lifecycle ?? (c.ratified ? "ratified" : "draft"), authorityClass: null, health: null,
    ratified: c.ratified, ratifiedAt: null, ratificationDecisionId: c.ratified ? `dec-${c.key}` : null, governanceSessionId: null,
    ratifiedByActorId: null, activeKnowledgeNodeId: node(c.key), effectiveFrom: null, effectiveUntil: c.until ?? null, nextReviewAt: null,
    knowledgeVersion: 1, factVersion: 1, freshness: "unknown",
  }) as unknown as KnowledgeSourceRecord;
const RECORDS = CASES.map(record);
const STATES = new Map(CASES.filter((c) => c.use).map((c) => [node(c.key), c.use!] as [string, "allowed" | "denied"]));
const REJECTED = new Set(CASES.filter((c) => c.rejected).map((c) => node(c.key)));

function knowledge(match: (key: string) => boolean, states: ReadonlyMap<string, "allowed" | "denied"> | "unavailable" = STATES): PublicKnowledgeDeps {
  const repo = {
    listFacts: async () => ({ records: RECORDS, incomplete: [], truncated: false }),
    searchFacts: async () => ({
      rows: RECORDS.filter((r) => match(r.factKey)).map((r, i) => ({ record: r, lexicalRank: 1 / (i + 1), trigram: null })),
      incomplete: [], truncated: false, trigramAvailable: false,
    }),
    hasTrigram: async () => false,
  } as unknown as DurableKnowledgeRepository;
  return {
    getRepo: () => repo,
    now: () => NOW,
    readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: REJECTED }),
    readPublicUse: async () => (states === "unavailable" ? { status: "unavailable", reason: "read-failed" } : { status: "read", states }),
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kt5_prepare");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-kt5", email: "director@kt5.test" })) as Seeded;
    const tenant = contextFor(acme);
    const repo = createDurableConversationRepository(handle.db);
    const writeDeps = { getDb: () => handle.db } as never;
    const agentIdentityDeps = { getDb: () => handle.db } as never;
    await seedGovernanceAuthority(setup, acme, agentIdentityDeps, { tag: "kt5" });
    assert.equal((await createDurableAgentIdentity(tenant, { name: "Heby", justification: "Register this agent for the test organization." }, agentIdentityDeps)).status, "established");

    const sent: ClaudeTransportRequest[] = [];
    const transport: ClaudeTransport = {
      async send(request) {
        sent.push(request);
        return { id: "req_kt5", model: request.model, content: [{ type: "text", text: "Handwoven, honestly." }], stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    const deps = (k: PublicKnowledgeDeps) => ({
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-kt5",
      knowledge: k,
      write: writeDeps,
      agentIdentity: agentIdentityDeps,
    }) as HebyModelAnswerDeps & { write: never; agentIdentity: never };
    const revisions = async () => Number((await setup.query("select count(*)::int n from work_artifact_revisions")).rows[0].n);
    const wire = () => JSON.stringify(sent[sent.length - 1]);
    const draft = (extra: Record<string, unknown> = {}) => ({
      prompt: "Write an Instagram caption about who we are and where we sell.",
      route: "/operations",
      artifactType: "content-draft" as const,
      intendedDestination: "instagram" as const,
      title: "Who we are",
      ...extra,
    });

    /*
     * P0 · a stored content draft to revise later. The question matches nothing; since KT-5.2 the
     * two-fact universe is supplied whole as `bounded-universe` and persisted with the turn.
     */
    const p0 = await prepareWorkArtifact(draft(), deps(knowledge(() => false)));
    assert.equal(p0.status, "prepared", "a draft is prepared when the universe exists and nothing matched");
    for (const key of ELIGIBLE) assert.ok(wire().includes(`STATEMENT-${key}`), `${key} is supplied whole, unmatched`);
    const artifactId = p0.status === "prepared" ? p0.artifactId : "";
    assert.equal(sent.length, 1);

    /* P1 · eligible Knowledge grounds the draft; nothing else reaches the wire. */
    await prepareWorkArtifact(draft(), deps(knowledge(() => true)));
    assert.equal(sent.length, 2, "the model was asked once");
    for (const key of ELIGIBLE) assert.ok(wire().includes(`STATEMENT-${key}`), `${key} reaches the wire`);
    for (const c of CASES) if (!ELIGIBLE.includes(c.key)) assert.ok(!wire().includes(c.key), `${c.key} never reaches the wire`);
    assert.ok(!/fact.? in force/.test(wire()), "coverage counts are not disclosed for public content");
    const afterP1 = await revisions();

    /* P2 · nothing ratified + allowed: no send, no revision. */
    for (const [label, k] of [
      ["every version UNKNOWN", knowledge(() => true, new Map())],
      ["public-use projection unavailable", knowledge(() => true, "unavailable")],
    ] as const) {
      const before: number = sent.length;
      const r = await prepareWorkArtifact(draft(), deps(k));
      assert.deepEqual([r.status, r.status === "refused" ? r.reason : ""], ["refused", "no-model-answer"], `${label}: refused`);
      assert.equal(sent.length, before, `${label}: the transport was never reached`);
      assert.equal(await revisions(), afterP1, `${label}: no revision was written`);
      assert.match(JSON.stringify(r), /was not asked/, `${label}: the human is told why`);
    }

    /* P3 · a route without the Knowledge class cannot skip the refusal. */
    {
      const before: number = sent.length;
      const r = await prepareWorkArtifact(draft({ route: "/people" }), deps(knowledge(() => true, new Map())));
      assert.equal(r.status, "refused");
      assert.equal(sent.length, before, "no send through a Knowledge-less route either");
    }

    /* P4 · revising the stored content draft while claiming another type: still public. */
    {
      const before: number = sent.length;
      const r = await prepareWorkArtifact(draft({ artifactId, artifactType: "operational-plan" }), deps(knowledge(() => true, new Map())));
      assert.equal(r.status, "refused", "the stored type decides; a client cannot downgrade the draft");
      assert.equal(sent.length, before);
      assert.equal(await revisions(), afterP1, "no new revision");
    }

    /*
     * P5 · universe exists, the question matched only withheld facts: asked, and (KT-5.2) the small
     * eligible universe is supplied whole — the withheld facts still never reach the wire.
     */
    {
      const r = await prepareWorkArtifact(draft(), deps(knowledge((k) => k === "sourcing-sales-model" || k === "product-offering")));
      assert.equal(r.status, "prepared", "a relevance gap is not a refusal");
      for (const c of CASES) {
        assert.equal(wire().includes(`STATEMENT-${c.key}`), ELIGIBLE.includes(c.key), `${c.key}: only the eligible universe reaches the wire`);
      }
    }

    /* P6 · INTERNAL preparation is unchanged: an operational plan still grounds on a denied fact. */
    {
      const before: number = sent.length;
      await prepareWorkArtifact(
        { prompt: "Plan the sourcing review.", route: "/operations", artifactType: "operational-plan", title: "Sourcing review" },
        deps(knowledge(() => true, new Map())),
      );
      assert.equal(sent.length, before + 1, "an internal plan needs no public clearance: the model was asked");
      assert.ok(wire().includes("STATEMENT-sourcing-sales-model"), "internal semantics: a denied-for-public fact still grounds internal work");
    }

    console.log("PASS knowledge-trust-phase-5 preparation-postgres");
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
