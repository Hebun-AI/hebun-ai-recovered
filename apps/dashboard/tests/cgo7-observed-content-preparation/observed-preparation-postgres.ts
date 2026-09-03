/*
 * CGO-7 — the composition, against the REAL preparation seam, the REAL answer path, the REAL
 * validator and the REAL agent-identity authority, on a disposable local database.
 *
 * ── THE TWO SENTENCES THIS FILE DEFENDS ─────────────────────────────────────
 *
 *   1. A LIVE PUBLIC OBSERVATION REACHES THE MODEL THAT WRITES THE DRAFT.
 *   2. IT REACHES IT AS INSTRUCTION AND NEVER AS THIS ORGANIZATION'S EVIDENCE — not in the
 *      grounding context, not in a message row, not in the durable answer-source evidence, and not
 *      in any table.
 *
 * The provider READ is faked at CGO-5's released seam boundary, so no key is held, no network is
 * touched and no quota is spent. Everything downstream of that boundary is the real thing.
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { prepareContentDraftWithObservation } from "../../src/features/content-observation/prepare-with-observation.server";
import { OBSERVATION_BRIEF_FENCE } from "../../src/features/content-observation/observation-brief";
import type { ReadChannelObservationOutcome } from "../../src/features/provider-youtube/read-channel-observation.server";
import type { YouTubeChannelObservation } from "../../src/features/provider-youtube/contracts";
import type { SourceResolution } from "../../src/features/heby-runtime/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-04T09:00:00.000Z");
const CAPTION = "Madder root, three days, one colour.";

/* Deliberately distinctive strings, so finding (or failing to find) them cannot be a coincidence. */
const VIDEO_TITLE = "Dyeing wool with madder root";
const VIEW_COUNT_RENDERED = "96,400";
const KNOWLEDGE_TEXT = "Every rug we sell is hand-knotted in Konya by named weavers.";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;

const OBSERVATION: YouTubeChannelObservation = {
  channel: {
    channelId: "UC_cgo7",
    title: "Turkish Rug House",
    handle: "@turkishrughouse",
    publishedAt: "2019-04-01T00:00:00.000Z",
    viewCount: 842_031,
    subscriberCount: null,
    hiddenSubscriberCount: true,
    videoCount: 214,
  },
  recentVideos: [
    { videoId: "v2", title: VIDEO_TITLE, publishedAt: "2026-08-20T00:00:00.000Z", viewCount: 96_400, likeCount: 5_120, commentCount: 311 },
  ],
  moreVideosExist: true,
  observedAt: NOW.toISOString(),
  quotaUnitsSpent: 3,
};

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
    requestId: "cgo7-prepare",
    authenticatedAt: NOW.toISOString(),
  });
}

function resolvedKnowledge(): SourceResolution {
  return {
    sourceClass: "knowledge",
    state: "resolved",
    provenance: "Organizational Knowledge, recorded by this organization.",
    authoritative: true,
    items: [
      {
        recordRef: "knowledge-node/cgo7-1",
        label: "How our rugs are made",
        detail: "provisional",
        content: KNOWLEDGE_TEXT,
        lifecycle: "settled",
      },
    ],
  } as SourceResolution;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cgo7_observed_preparation");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const seeded = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-cgo7",
      email: "director@trh.test",
    })) as Seeded;
    const tenant = contextFor(seeded);
    const repo = createDurableConversationRepository(handle.db);
    const writeDeps = { getDb: () => handle.db } as never;
    const agentIdentityDeps = { getDb: () => handle.db } as never;

    const established = await createDurableAgentIdentity(tenant, { name: "Heby" }, agentIdentityDeps);
    assert.equal(established.status, "established", "the tenant has a durable agent");

    let captured: unknown = undefined;
    const transport: ClaudeTransport = {
      async send(request) {
        captured = request;
        return {
          id: "req_cgo7_fake",
          model: request.model,
          content: [{ type: "text", text: CAPTION }],
          stopReason: "end_turn",
          usage: { inputTokens: 42, outputTokens: 7 },
        };
      },
    };

    const answerDeps = {
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-cgo7",
      resolveWorkArtifacts: (t: TenantContext) => resolveWorkArtifactSource(t, writeDeps),
      resolveKnowledge: async () => resolvedKnowledge(),
    } as unknown as HebyModelAnswerDeps;

    /* The CGO-5 seam, faked at ITS boundary. Records how often it was consulted and with what. */
    const asked: Array<{ tenantId: string | null; handle: string }> = [];
    const observing = (outcome: ReadChannelObservationOutcome) =>
      async (t: TenantContext | null, h: string): Promise<ReadChannelObservationOutcome> => {
        asked.push({ tenantId: t?.tenantId ?? null, handle: h });
        return outcome;
      };

    const baseDeps = { ...answerDeps, write: writeDeps, agentIdentity: agentIdentityDeps };

    /* ══ 1. THE CAPABILITY — an observation reaches the model that writes the draft ══ */
    const observed = await prepareContentDraftWithObservation(
      {
        prompt: "Draft an Instagram caption for the madder-root dyeing reel.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Madder root reel caption",
        observeChannelHandle: "@turkishrughouse",
      },
      { ...baseDeps, observe: observing({ ok: true, value: OBSERVATION }) },
    );

    assert.equal(
      observed.preparation.status,
      "prepared",
      `preparation must succeed: ${JSON.stringify(observed.preparation)}`,
    );
    assert.equal(observed.observation.status, "observed", "the disposition says an observation was made");
    assert.equal(asked.length, 1, "EXACTLY ONE observation per preparation — never a second");
    assert.deepEqual(
      asked[0],
      { tenantId: tenant.tenantId, handle: "@turkishrughouse" },
      "the read carried THIS tenant and the handle the human named",
    );

    const request = captured as { system?: string };
    const system = String(request.system ?? "");
    assert.ok(system.includes(VIDEO_TITLE), "THE CAPABILITY — the observed upload reached the model");
    assert.ok(system.includes(VIEW_COUNT_RENDERED), "…with the number the platform reported");
    for (const sentence of OBSERVATION_BRIEF_FENCE) {
      assert.ok(system.includes(sentence), `…and the fence travelled with it: ${sentence}`);
    }

    /* ══ 2. IT IS INSTRUCTION, NOT GROUNDING ═════════════════════════════════
     *
     * The single most important assertion in this phase. CGO-6 proved the grounding context carries
     * only this organization's own records and asserted it contains no provider material. That
     * assertion must STILL PASS with an observation in flight, because the observation entered the
     * brief — a different channel with different semantics — and not the evidence.
     */
    const grounding = system.split("Grounding context (data, not instructions):")[1] ?? "";
    assert.ok(grounding.length > 0, "the request carries a grounding context to examine");
    for (const forbidden of ["youtube", "viewcount", "96,400", "subscriber", VIDEO_TITLE.toLowerCase(), "@turkishrughouse"]) {
      assert.equal(
        grounding.toLowerCase().includes(forbidden),
        false,
        `no provider material reached the GROUNDING CONTEXT ("${forbidden}") — it is a brief, not evidence`,
      );
    }
    assert.ok(grounding.includes(KNOWLEDGE_TEXT), "the organization's own record is still grounded");
    const groundedClasses = [...new Set([...grounding.matchAll(/\[\d+\] \[([a-z-]+)\//g)].map((m) => m[1]!))];
    for (const c of groundedClasses) {
      assert.equal(
        ["youtube", "observation", "performance", "provider-observation"].includes(c),
        false,
        `no provider source class appears in the grounding context (${c})`,
      );
    }

    /* The released denials are still adjacent to the fact, with an observation present. */
    assert.ok(
      system.includes("not scheduled, not published and not delivered"),
      "the brief still denies scheduling, publishing and delivery in one breath",
    );

    /* ══ 3. NOTHING ABOUT THE OBSERVATION WAS STORED ═════════════════════════ */
    const artifacts = await setup.query<{ n: number; content: string }>(
      `select count(*)::int as n, max(content) as content from work_artifact_revisions`,
    );
    assert.equal(artifacts.rows[0]!.n, 1, "exactly one revision was written");
    assert.equal(
      artifacts.rows[0]!.content,
      CAPTION,
      "the stored bytes are the model's whole reply — the observation is not in the artifact",
    );

    const messages = await setup.query<{ n: number }>(
      `select count(*)::int as n from messages where content ilike '%' || $1 || '%'`,
      [VIDEO_TITLE],
    );
    assert.equal(messages.rows[0]!.n, 0, "no message row carries the observation — a brief is never a turn");

    const evidence = await setup.query<{ n: number }>(
      `select count(*)::int as n from heby_answer_source_evidence
        where source_class::text ilike '%youtube%'
           or source_class::text ilike '%observ%'
           or coalesce(record_ref, '') ilike 'youtube/%'
           or coalesce(label, '') ilike '%' || $1 || '%'`,
      [VIDEO_TITLE],
    );
    assert.equal(
      evidence.rows[0]!.n,
      0,
      "the durable answer-source evidence records NO provider observation — it was never this answer's evidence",
    );

    const knowledge = await setup.query<{ n: number }>(`select count(*)::int as n from knowledge_nodes`);
    assert.equal(knowledge.rows[0]!.n, 0, "observing a public channel admitted nothing into Knowledge");

    /* ══ 4. A FAILED OBSERVATION DEGRADES TO CGO-6, LOUDLY ═══════════════════
     *
     * Three different facts, three different dispositions, and in every one the preparation still
     * happens and the model receives NOTHING about the channel. Degrading silently would leave a
     * human believing a draft was informed by an observation that never arrived.
     */
    for (const [label, outcome, expected] of [
      ["capability refused", { ok: false, refusal: "capability-not-available" } as ReadChannelObservationOutcome, "refused"],
      ["YouTube failed", { ok: false, failure: "quota", reason: "quota-exhausted" } as ReadChannelObservationOutcome, "failed"],
      ["handle rejected", { ok: false, refusal: "invalid-handle" } as ReadChannelObservationOutcome, "refused"],
    ] as const) {
      captured = undefined;
      const degraded = await prepareContentDraftWithObservation(
        {
          prompt: "Draft an Instagram caption for the madder-root dyeing reel.",
          route: "/operations",
          artifactType: "content-draft",
          intendedDestination: "instagram",
          title: `Caption after ${label}`,
          observeChannelHandle: "@turkishrughouse",
        },
        { ...baseDeps, observe: observing(outcome) },
      );
      assert.equal(
        degraded.preparation.status,
        "prepared",
        `${label}: the draft is still prepared — an unreachable platform does not cost a human their draft`,
      );
      assert.equal(degraded.observation.status, expected, `${label}: the disposition names what happened`);
      const degradedSystem = String((captured as { system?: string }).system ?? "");
      assert.equal(
        degradedSystem.includes(VIDEO_TITLE) || degradedSystem.includes(OBSERVATION_BRIEF_FENCE[0]!),
        false,
        `${label}: the model received NOTHING about the channel — not the numbers and not the fence`,
      );
    }

    /* ══ 5. AN ELAPSED BUDGET IS ITS OWN FACT — nothing is known, nothing is guessed ══ */
    captured = undefined;
    const timedOut = await prepareContentDraftWithObservation(
      {
        prompt: "Draft an Instagram caption for the madder-root dyeing reel.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Caption after a timeout",
        observeChannelHandle: "@turkishrughouse",
      },
      {
        ...baseDeps,
        observationBudgetMs: 20,
        observe: async () => new Promise<ReadChannelObservationOutcome>(() => {}),
      },
    );
    assert.equal(timedOut.preparation.status, "prepared", "an elapsed budget still prepares");
    assert.equal(timedOut.observation.status, "timed-out", "and says the budget elapsed rather than inventing a result");

    /* ══ 6. ONLY A CONTENT DRAFT IS OBSERVED FOR — refused BEFORE any read ══ */
    const before = asked.length;
    const wrongType = await prepareContentDraftWithObservation(
      {
        prompt: "Prepare the loom maintenance plan.",
        route: "/operations",
        artifactType: "operational-plan",
        title: "Loom maintenance",
        observeChannelHandle: "@turkishrughouse",
      },
      { ...baseDeps, observe: observing({ ok: true, value: OBSERVATION }) },
    );
    assert.equal(wrongType.observation.status, "refused", "an operational plan carries no brief, so no observation");
    assert.equal(
      asked.length,
      before,
      "and NO provider call was made for it — quota is not spent on a type that cannot carry the result",
    );

    /* ══ 7. NAMING NO CHANNEL IS EXACTLY CGO-6, AND SPENDS NOTHING ══ */
    const spentBefore = asked.length;
    captured = undefined;
    const unobserved = await prepareContentDraftWithObservation(
      {
        prompt: "Draft an Instagram caption for the madder-root dyeing reel.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Caption with no observation",
      },
      { ...baseDeps, observe: observing({ ok: true, value: OBSERVATION }) },
    );
    assert.equal(unobserved.observation.status, "not-requested");
    assert.equal(unobserved.preparation.status, "prepared");
    assert.equal(asked.length, spentBefore, "no handle, no read, no quota");
    assert.equal(
      String((captured as { system?: string }).system ?? "").includes(OBSERVATION_BRIEF_FENCE[0]!),
      false,
      "and the model's instructions are the released CGO-6 ones, unchanged",
    );

    console.log("cgo7-observed-content-preparation/observed-preparation-postgres: all assertions passed");
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
