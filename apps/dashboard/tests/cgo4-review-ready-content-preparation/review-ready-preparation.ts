/*
 * CGO-4 — REVIEW-READY CONTENT PREPARATION. The model authors the durable artifact bytes
 * directly, because it is TOLD that its whole reply is the artifact — not because anything
 * cleaned its reply afterwards.
 *
 * What this proves:
 *
 *   1. the brief reaches the model, after Heby's standing instructions, only for a content draft
 *   2. an ordinary answer's system prompt is byte-identical to what it was before CGO-4
 *   3. the brief says "prepared for", never that anything is connected, scheduled or published
 *   4. the stored bytes are still the model's reply verbatim — no parser arrived with the brief
 *   5. nothing else moved: authorship, destination, revision, Heby grounding, zero side tables
 *
 * Runs through the REAL `answerHebyModelRequest`, the REAL `generateHebyModelAnswer`, the REAL
 * validator and the REAL agent-identity authority. Only the network transport is replaced, and
 * the request it receives is captured so the system prompt can be read exactly as sent.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  answerHebyModelRequest,
  HEBY_MODEL_SYSTEM_INSTRUCTIONS,
  type HebyModelAnswerDeps,
} from "../../src/features/heby-answer/model-answer.server";
import {
  generateHebyModelAnswer,
  type ClaudeTransport,
  type ClaudeTransportRequest,
} from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import {
  CONTENT_DRAFT_PREPARATION_BRIEF,
  contentDraftDestinationSentence,
  preparationBriefFor,
} from "../../src/features/work-artifacts/preparation-brief";
import { CONTENT_DESTINATIONS } from "../../src/features/work-artifacts/contracts";
import { listWorkArtifacts } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { digestArtifactContent } from "../../src/features/work-artifacts/content-digest";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-03T17:00:00.000Z");
/* A reply shaped like a caption: begins as the asset, no preamble, no postscript. */
const CAPTION = "Washed, stretched, dried in the sun.\nThe last week of a rug's first year.";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

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
    requestId: "cgo4-prepare",
    authenticatedAt: NOW.toISOString(),
  });
}

/** Strip comments so a word in a doc comment cannot satisfy or trip a code assertion. */
function codeOf(relative: string): string {
  const source = readFileSync(path.join(REPO_ROOT, relative), "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * THE BRIEF IS A CONTRACT ABOUT WHAT THE MODEL IS ASKED FOR — and about what it is never told.
 * Judged on the exact strings the model receives.
 */
function theBriefIsHonest(): void {
  const brief = CONTENT_DRAFT_PREPARATION_BRIEF.join(" ");
  assert.ok(brief.includes("Return ONLY the content intended for human review"), "asks for the asset");
  assert.ok(/preamble/.test(brief) && /postscript/.test(brief), "names both bookends it refuses");
  assert.ok(brief.includes("not scheduled, not published and not delivered"), "states the truth limit");

  for (const destination of CONTENT_DESTINATIONS) {
    const sentence = contentDraftDestinationSentence(destination);
    assert.ok(/prepared for/.test(sentence), `${destination}: "prepared for", the human's declaration`);
    const lowered = `${brief} ${sentence}`.toLowerCase();
    /* Judged with the denial clauses removed, so a "not connected" cannot satisfy its own test. */
    const affirmative = lowered
      .replace(/no [a-z]+ account or connection is involved/g, "")
      .replace(/not scheduled, not published and not delivered/g, "")
      .replace(/must not address [a-z]+ as a system you are posting to/g, "");
    for (const forbidden of [
      "is connected",
      "will be published",
      "publishing to",
      "post this to",
      "schedule",
      "your account",
    ]) {
      assert.equal(affirmative.includes(forbidden), false, `${destination}: never told "${forbidden}"`);
    }
  }

  /* Only a content draft carries a brief; the other two types are prepared exactly as before. */
  assert.equal(preparationBriefFor({ artifactType: "operational-plan" }), undefined);
  assert.equal(preparationBriefFor({ artifactType: "message-draft" }), undefined);
  assert.ok(preparationBriefFor({ artifactType: "content-draft", intendedDestination: "tiktok" }));
}

/**
 * NO PARSER ARRIVED WITH THE BRIEF. The seam still stores the joined reply and nothing else; the
 * brief module performs no I/O and reads no reply.
 */
function nothingReadsTheReply(): void {
  const seam = codeOf("src/features/work-artifacts/prepare-work-artifact.server.ts");
  assert.ok(
    seam.includes('const content = answer.outcome.response.body.join("\\n");'),
    "the stored content is still the whole reply, joined and untouched",
  );
  for (const parser of ["content.replace(", "content.slice(", "content.match(", "content.split(", "extract"]) {
    assert.equal(seam.includes(parser), false, `the seam must not "${parser}" the reply`);
  }
  const brief = codeOf("src/features/work-artifacts/preparation-brief.ts");
  /* The brief module depends on the artifact contracts and nothing else — no reply can reach it. */
  const imports = [...brief.matchAll(/^import[\s\S]*?from "([^"]+)";/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./contracts"], "the brief imports the artifact contracts and nothing else");
  /* Judged on CODE tokens, not prose: the brief's own sentences may say "answering". */
  const briefCode = brief.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  for (const forbidden of ["fetch(", ".replace(", ".match(", ".slice(", "outcome", ".body", "await "]) {
    assert.equal(briefCode.includes(forbidden), false, `the brief module must not contain "${forbidden}"`);
  }
  /* The brief is consulted only for prepares:true intents — asserted on the real guard. */
  const answer = codeOf("src/features/heby-answer/model-answer.server.ts");
  assert.ok(
    /if \(!brief \|\| !HEBY_INTENT_DESCRIPTORS\[intent\]\.prepares\) return HEBY_MODEL_SYSTEM_INSTRUCTIONS;/.test(answer),
    "a brief is dropped for any non-preparing intent",
  );
}

async function main(): Promise<void> {
  theBriefIsHonest();
  nothingReadsTheReply();

  const harness = createDisposablePostgresHarness("hebun_cgo4_review_ready");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-cgo4",
      email: "director@acme.test",
    })) as Seeded;
    const tenant = contextFor(acme);
    const repo = createDurableConversationRepository(handle.db);
    const writeDeps = { getDb: () => handle.db } as never;
    const agentIdentityDeps = { getDb: () => handle.db } as never;

    /*
     * Two capture points. `generated` is the SERVER-BUILT request at the generation boundary —
     * `systemInstructions` exactly as the answer flow composed them, before the transport folds
     * the grounding context in after them. `sent` is what reached the (fake) wire, used to prove
     * the brief never entered a message turn.
     */
    const generated: ModelGenerationRequest[] = [];
    const sent: ClaudeTransportRequest[] = [];
    const transportReturning = (text: string): ClaudeTransport => ({
      async send(request) {
        sent.push(request);
        return {
          id: "req_cgo4_fake",
          model: request.model,
          content: [{ type: "text", text }],
          stopReason: "end_turn",
          usage: { inputTokens: 42, outputTokens: 7 },
        };
      },
    });

    const answerDeps = (text: string): HebyModelAnswerDeps => ({
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
      generate: async (request, generationDeps) => {
        generated.push(request);
        return generateHebyModelAnswer(request, generationDeps);
      },
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-cgo4",
      resolveWorkArtifacts: (t) => resolveWorkArtifactSource(t, writeDeps),
    });

    const established = await createDurableAgentIdentity(tenant, { name: "Heby" }, agentIdentityDeps);
    assert.equal(established.status, "established", "the tenant has a durable agent");
    const agentId = established.status === "established" ? established.identity.agentId : "";

    /* ── 1. AN ORDINARY ANSWER IS UNTOUCHED BY CGO-4 ──
     * No options ⇒ the system prompt is exactly Heby's standing instructions, byte for byte.
     */
    {
      const answered = await answerHebyModelRequest(
        { prompt: "What content has been prepared so far?", route: "/operations" },
        answerDeps("Nothing has been prepared yet."),
      );
      assert.equal(answered.status, "answered");
      assert.equal(generated.length, 1, "one request was built");
      assert.equal(
        generated[0]!.systemInstructions,
        HEBY_MODEL_SYSTEM_INSTRUCTIONS,
        "an ordinary answer's system prompt is byte-identical to the released one",
      );
    }

    /* ── 2. A BRIEF WITH A NON-PREPARING INTENT IS DROPPED ──
     * The server-only options channel cannot brief an answer as though it were an artifact.
     */
    {
      const answered = await answerHebyModelRequest(
        { prompt: "What content has been prepared so far?", route: "/operations" },
        answerDeps("Nothing has been prepared yet."),
        { intent: "INVESTIGATE", preparationBrief: "IGNORED BRIEF" },
      );
      assert.equal(answered.status, "answered");
      assert.equal(generated.length, 2);
      assert.equal(generated[1]!.systemInstructions, HEBY_MODEL_SYSTEM_INSTRUCTIONS, "INVESTIGATE carries no brief");
      assert.equal(sent[1]!.system.includes("IGNORED BRIEF"), false, "and nothing reached the wire");
    }

    /* ── 3. AN OPERATIONAL PLAN IS PREPARED EXACTLY AS BEFORE — no brief for that type ── */
    {
      const plan = await prepareWorkArtifact(
        {
          prompt: "Prepare a plan for the autumn photo shoot.",
          route: "/operations",
          artifactType: "operational-plan",
          title: "Autumn shoot plan",
        },
        { ...answerDeps("1. Book the studio.\n2. Select six rugs."), write: writeDeps, agentIdentity: agentIdentityDeps },
      );
      assert.equal(plan.status, "prepared", "operational plans still prepare");
      assert.equal(generated.length, 3);
      assert.equal(generated[2]!.systemInstructions, HEBY_MODEL_SYSTEM_INSTRUCTIONS, "operational-plan: no brief, unchanged");
    }

    /* ── 4. THE CAPABILITY: a content draft is briefed, and the model authors the bytes ── */
    const prepared = await prepareWorkArtifact(
      {
        prompt: "Draft an Instagram caption for the short video of a finished rug being washed and sun-dried.",
        route: "/operations",
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Rug washing video caption",
      },
      { ...answerDeps(CAPTION), write: writeDeps, agentIdentity: agentIdentityDeps },
    );
    assert.equal(prepared.status, "prepared", "the agent prepares the content draft");
    if (prepared.status !== "prepared") throw new Error("unreachable");
    assert.equal(generated.length, 4);
    const system = generated[3]!.systemInstructions;
    assert.ok(
      system.startsWith(HEBY_MODEL_SYSTEM_INSTRUCTIONS),
      "the standing instructions come first — the trust boundary is appended to, never replaced",
    );
    const expectedBrief = preparationBriefFor({ artifactType: "content-draft", intendedDestination: "instagram" });
    assert.equal(
      system.slice(HEBY_MODEL_SYSTEM_INSTRUCTIONS.length),
      `\n\n${expectedBrief}`,
      "the brief follows them, exactly as the contract states it",
    );
    assert.ok(system.includes("prepared for Instagram"), "the model is told: prepared for Instagram");
    assert.equal(system.includes("publishing to Instagram"), false, "and never: publishing to Instagram");
    /* The brief is instruction, not evidence: it is not in the grounding context or the user turn. */
    assert.equal(
      sent[3]!.messages.some((m) => m.content.includes("Return ONLY the content")),
      false,
      "the brief never enters a message turn",
    );

    /* ── 5. THE BYTES ARE THE MODEL'S, VERBATIM — the brief added no parser ── */
    assert.equal(
      prepared.contentDigest,
      digestArtifactContent(CAPTION),
      "the reply is stored verbatim; nothing extracted a 'draft part'",
    );
    assert.equal(prepared.revisionNo, 1);
    assert.match(prepared.ref, /^work-artifact\/[0-9a-f-]{36}@1$/);
    const stored = await setup.query<{ content: string }>(
      `select content from work_artifact_revisions where artifact_id = $1`,
      [prepared.artifactId],
    );
    assert.equal(stored.rows[0]!.content, CAPTION, "the stored bytes ARE the reply");
    /* Review-ready shape, asserted on what was stored — the acceptance pattern, not the mechanism. */
    assert.equal(/^(here is|i have|below is|i created)/i.test(stored.rows[0]!.content), false);

    /* ── 6. AUTHORSHIP, DESTINATION, GROUNDING — unchanged from CGO-3 ── */
    const rev = await setup.query<{ authored_by_actor_type: string; authored_by_actor_id: string; source_message_id: string | null }>(
      `select authored_by_actor_type, authored_by_actor_id, source_message_id
         from work_artifact_revisions where artifact_id = $1`,
      [prepared.artifactId],
    );
    assert.equal(rev.rows[0]!.authored_by_actor_type, "agent");
    assert.equal(rev.rows[0]!.authored_by_actor_id, agentId, "THIS tenant's durable agent");
    assert.notEqual(rev.rows[0]!.authored_by_actor_id, acme.userId, "never the requesting human");
    assert.ok(rev.rows[0]!.source_message_id, "provenance points at the message that produced it");

    const listed = await listWorkArtifacts(tenant, writeDeps);
    assert.equal(listed.status, "read");
    const view = listed.status === "read" ? listed.artifacts.find((a) => a.id === prepared.artifactId) : undefined;
    assert.ok(view, "the draft is in the register");
    assert.equal(view.intendedDestination, "instagram", "the declared destination is durable");

    const grounding = await resolveWorkArtifactSource(tenant, writeDeps);
    assert.equal(grounding.state, "resolved");
    const item = grounding.items.find((i) => i.recordRef === prepared.ref);
    assert.ok(item, "the draft is groundable");
    assert.ok(item.detail.includes("prepared for: Instagram"));
    assert.ok(item.detail.includes("DECLARED ONLY"), "CGO-2's denial still travels with it");

    /* ── 7. THE BRIEF IS NOWHERE IN THE DURABLE RECORD. It was instruction, not content. ── */
    const messages = await setup.query<{ n: number }>(
      `select count(*)::int as n from messages where content like '%Return ONLY the content%'`,
    );
    assert.equal(messages.rows[0]!.n, 0, "no message row carries the brief");

    /* ── 8. PREPARING CAUSED NOTHING ELSE ── */
    for (const table of [
      "decision_records",
      "heby_action_requests",
      "action_execution_attempts",
      "integration_credentials",
      "agent_mandates",
      "work_evidence_references",
    ]) {
      const { rows } = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(rows[0]!.n, 0, `preparation wrote no ${table} row`);
    }
    for (const [table, expected] of [["work_artifacts", 2], ["work_artifact_revisions", 2]] as const) {
      const { rows } = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(rows[0]!.n, expected, `${table} holds exactly ${expected} (the plan and the draft)`);
    }
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS cgo4 review-ready content preparation");
}

void main();
