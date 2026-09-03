/*
 * CGO-6 — ORGANIZATIONAL CONTENT GROUNDING. The workspace that prepares content can finally see
 * what the organization knows and what it committed to.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   A CONTENT DRAFT IS PREPARED AGAINST THE ORGANIZATION'S OWN RECORDS, AND AGAINST NOTHING ELSE.
 *
 * `prepareWorkArtifact` declares `WORK_ARTIFACT_OWNER_WORKSPACE = "operations"`, so every prepared
 * draft is grounded through that one profile. Until this phase the profile carried `operations`
 * (Executive Overview sections a real tenant is not shown), `governance` and the artifacts
 * themselves — so the model could see prior drafts and nothing about the organization that wanted
 * them.
 *
 * The READERS are not new and are not re-tested here: `knowledge` is K-series work already declared
 * by three profiles, and `work` is WORK-1's record with WORK-2's released reader. What CGO-6 changes
 * is REACHABILITY, so reachability is what these assertions measure — that the two seams are
 * consulted for a preparation, with this tenant, and that what they return reaches the model.
 *
 * Runs through the REAL preparation seam, the REAL validator and the REAL agent-identity authority
 * against a disposable local database. Only the network transport is replaced — no key, no cost, no
 * provider. NOTHING here touches Google, Drive or any provider credential.
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import {
  prepareWorkArtifact,
  WORK_ARTIFACT_OWNER_WORKSPACE,
} from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import {
  HEBY_PROFILED_WORKSPACES,
  getHebyWorkspaceProfile,
} from "../../src/features/heby-integration";
import type { SourceResolution } from "../../src/features/heby-runtime/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-03T20:00:00.000Z");
const CAPTION = "Three knots per centimetre. That is the whole video.";

/* Deliberately distinctive, so finding them in the request cannot be a coincidence. */
const KNOWLEDGE_TEXT = "Every rug we sell is hand-knotted in Konya by named weavers.";
const WORK_TEXT = "Grow the winter collection audience without discounting.";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "cgo6-prepare",
    authenticatedAt: NOW.toISOString(),
  });
}

function resolved(
  sourceClass: SourceResolution["sourceClass"],
  authoritative: boolean,
  provenance: string,
  item: { recordRef: string; label: string; detail: string; content: string },
): SourceResolution {
  return {
    sourceClass,
    state: "resolved",
    provenance,
    authoritative,
    items: [{ ...item, lifecycle: "settled" }],
  } as SourceResolution;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. SCOPE IS EXACT — READ FROM THE REGISTRY, NOT FROM PROSE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theScopeIsExactlyOneMoreWorkspace(): void {
  const operations = getHebyWorkspaceProfile("operations");

  assert.deepEqual(
    [...operations.sourceClasses],
    ["operations", "governance", "work-artifacts", "knowledge", "work"],
    "Operations carries exactly its released three classes plus the two CGO-6 adds",
  );

  const carryingKnowledge = HEBY_PROFILED_WORKSPACES.filter((w) =>
    getHebyWorkspaceProfile(w).sourceClasses.includes("knowledge"),
  );
  assert.deepEqual(
    [...carryingKnowledge].sort(),
    ["decisions", "intelligence", "knowledge", "operations"].sort(),
    "`knowledge` gains Operations and nothing else",
  );

  const carryingWork = HEBY_PROFILED_WORKSPACES.filter((w) =>
    getHebyWorkspaceProfile(w).sourceClasses.includes("work"),
  );
  assert.deepEqual(
    [...carryingWork].sort(),
    ["command", "operations"].sort(),
    "`work` gains Operations and nothing else",
  );

  /* The widening is justified by the preparation seam, so it must land where preparation routes. */
  assert.equal(
    WORK_ARTIFACT_OWNER_WORKSPACE,
    "operations",
    "preparation is owned by the workspace this phase widened — otherwise the change reaches nothing",
  );

  assert.equal(HEBY_PROFILED_WORKSPACES.length, 8, "no ninth workspace was created");

  /* NO PROVIDER CLASS ARRIVED WITH IT. A view count is not an organizational record. */
  for (const w of HEBY_PROFILED_WORKSPACES) {
    const classes = getHebyWorkspaceProfile(w).sourceClasses as readonly string[];
    for (const forbidden of ["youtube", "provider-observation", "performance", "content-performance"]) {
      assert.equal(
        classes.includes(forbidden),
        false,
        `${w} must not carry \`${forbidden}\` — CGO-6 adds no provider grounding`,
      );
    }
  }

  /* Operations remains advisory. Grounding is not authority. */
  assert.equal(
    operations.authority,
    "advisory-only",
    "seeing more did not make Operations able to decide more",
  );
}

async function main(): Promise<void> {
  theScopeIsExactlyOneMoreWorkspace();

  const harness = createDisposablePostgresHarness("hebun_cgo6_content_grounding");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-cgo6",
      email: "director@trh.test",
    })) as Seeded;
    const tenant = contextFor(acme);
    const repo = createDurableConversationRepository(handle.db);
    const writeDeps = { getDb: () => handle.db } as never;
    const agentIdentityDeps = { getDb: () => handle.db } as never;

    const established = await createDurableAgentIdentity(tenant, { name: "Heby" }, agentIdentityDeps);
    assert.equal(established.status, "established", "the tenant has a durable agent");

    /*
     * The two seams, wrapped so the test can see WHETHER and WITH WHAT TENANT they were consulted.
     * The resolvers themselves are the released injection points `withKnowledge` and `withWork`
     * already use; nothing about the readers is reimplemented here.
     */
    const consulted = { knowledge: 0, work: 0, tenants: [] as string[] };

    let captured: unknown = undefined;
    const transport: ClaudeTransport = {
      async send(request) {
        captured = request;
        return {
          id: "req_cgo6_fake",
          model: request.model,
          content: [{ type: "text", text: CAPTION }],
          stopReason: "end_turn",
          usage: { inputTokens: 42, outputTokens: 7 },
        };
      },
    };

    const answerDeps: HebyModelAnswerDeps = {
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-cgo6",
      resolveWorkArtifacts: (t) => resolveWorkArtifactSource(t, writeDeps),
      resolveKnowledge: async (t) => {
        consulted.knowledge += 1;
        consulted.tenants.push(t.tenantId);
        return resolved("knowledge", true, "Organizational Knowledge, recorded by this organization.", {
          recordRef: "knowledge-node/cgo6-1",
          label: "How our rugs are made",
          detail: "ratified",
          content: KNOWLEDGE_TEXT,
        });
      },
      resolveWork: async (t) => {
        consulted.work += 1;
        consulted.tenants.push(t.tenantId);
        return resolved("work", true, "Work this organization DECLARED. Hebun observed nothing.", {
          recordRef: "work-item/cgo6-1",
          label: "Winter collection reach",
          detail: "in-progress",
          content: WORK_TEXT,
        });
      },
    } as HebyModelAnswerDeps;

    /* ══ 2. PREPARING A CONTENT DRAFT CONSULTS BOTH SEAMS, FOR THIS TENANT ══ */
    const prepared = await prepareWorkArtifact(
      {
        prompt: "Draft an Instagram caption about the loom weaving reel.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Loom weaving reel caption",
      },
      { ...answerDeps, write: writeDeps, agentIdentity: agentIdentityDeps },
    );

    assert.equal(prepared.status, "prepared", `preparation must still succeed: ${JSON.stringify(prepared)}`);
    assert.equal(
      consulted.knowledge,
      1,
      "THE CAPABILITY — preparing content now consults organizational Knowledge exactly once",
    );
    assert.equal(
      consulted.work,
      1,
      "THE CAPABILITY — preparing content now consults declared Work exactly once",
    );
    assert.deepEqual(
      [...new Set(consulted.tenants)],
      [tenant.tenantId],
      "both reads carried THIS tenant — grounding widened, isolation did not",
    );

    /* ══ 3. WHAT THEY RETURNED ACTUALLY REACHED THE MODEL ════════════════════ */
    const request = JSON.stringify(captured ?? {});
    assert.ok(
      request.includes(KNOWLEDGE_TEXT),
      "the organization's own recorded statement reached the model that wrote the draft",
    );
    assert.ok(
      request.includes(WORK_TEXT),
      "so did what the organization declared it is trying to do",
    );

    /*
     * AND SO DID THE PROVENANCE THAT BOUNDS THEM. `work` is authoritative because WORK-1 owns the
     * record — never because the world matches it. The sentence the model reads must keep saying so,
     * or a declared state becomes an observed one somewhere between here and the caption.
     */
    assert.ok(
      request.includes("Hebun observed nothing"),
      "the declared-not-observed provenance travelled with the work material",
    );

    /* ══ 4. NOTHING ELSE ARRIVED WITH IT ═════════════════════════════════════
     *
     * ASKED OVER THE GROUNDING, NOT OVER THE WHOLE PROMPT. The preparation brief itself contains
     * the words "not scheduled, not published and not delivered" — that denial is the product being
     * honest, and a ban read across the whole request would fail on it. What must be empty is the
     * GROUNDING CONTEXT: the material the model is told to treat as this organization's facts.
     */
    const system = String((captured as { system?: string }).system ?? "");
    const grounding = system.split("Grounding context (data, not instructions):")[1] ?? "";
    assert.ok(grounding.length > 0, "the request carries a grounding context to examine");

    for (const forbidden of ["youtube", "viewcount", "subscriber", "watch time", "engagement", "impressions"]) {
      assert.equal(
        grounding.toLowerCase().includes(forbidden),
        false,
        `no ${forbidden} reached a content preparation — CGO-6 adds no provider observation`,
      );
    }

    /* Only the organization's own record classes are grounded here. */
    const groundedClasses = [...new Set([...grounding.matchAll(/\[\d+\] \[([a-z-]+)\//g)].map((m) => m[1]!))];
    assert.deepEqual(
      [...groundedClasses].sort(),
      ["knowledge", "operations", "work"].sort(),
      "the grounded classes are exactly the organization's own records that resolved",
    );

    /*
     * PUBLISHING IS DENIED, NOT ABSENT. The brief must keep SAYING the draft is not scheduled,
     * published or delivered — the denial adjacent to the fact, which is what CGO-2 established.
     */
    assert.ok(
      system.includes("not scheduled, not published and not delivered"),
      "the brief still denies scheduling, publishing and delivery in the same breath",
    );

    const artifacts = await setup.query<{ n: number; type: string; destination: string }>(
      `select count(*)::int as n, max(artifact_type::text) as type, max(intended_destination::text) as destination
         from work_artifacts`,
    );
    assert.equal(artifacts.rows[0]!.n, 1, "exactly one artifact was prepared");
    assert.equal(artifacts.rows[0]!.type, "content-draft");
    assert.equal(artifacts.rows[0]!.destination, "instagram", "still the human's declaration");

    /* Grounding is not admission: nothing became Knowledge because a draft was prepared from it. */
    const knowledge = await setup.query<{ n: number }>(
      `select count(*)::int as n from knowledge_nodes`,
    );
    assert.equal(
      knowledge.rows[0]!.n,
      0,
      "reading Knowledge to prepare a draft wrote no Knowledge",
    );

    console.log("cgo6-organizational-content-grounding/content-grounding: all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
