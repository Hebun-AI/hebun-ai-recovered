/*
 * R3W — the Heby preparation seam, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human can explicitly ask Heby to prepare work, and the model's reply becomes an immutable
 *    revision attributed to the assistant message that produced it — while an ORDINARY Heby answer
 *    over the very same flow creates no artifact at all."
 *
 * The second half matters more than the first. "Normal answers stay messages" is only a real
 * guarantee if it is exercised against the same code path, with the same transport, in the same
 * database — otherwise it is a claim about a diagram.
 *
 * No live provider: the transport is the repository's fake. No network, no key, no cost.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  answerHebyModelRequest,
  type HebyModelAnswerDeps,
} from "../../src/features/heby-answer/model-answer.server";
import {
  generateHebyModelAnswer,
  type ClaudeTransport,
} from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import {
  prepareWorkArtifact,
  WORK_ARTIFACT_PREPARATION_INTENT,
} from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { digestArtifactContent } from "../../src/features/work-artifacts/content-digest";
import { HEBY_INTENT_DESCRIPTORS } from "../../src/features/heby-integration";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-16T09:00:00.000Z");
const DRAFTED = "Merhaba Ayşe,\nHere is the quarterly summary you asked for.\nBest regards.";
const REVISED = "Merhaba Ayşe,\nSecond pass, shorter.";

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
    requestId: "r3w-prepare",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3w_preparation");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-r3w-prep",
      email: "director@acme.test",
    })) as Seeded;
    const tenant = contextFor(acme);

    const repo = createDurableConversationRepository(handle.db);

    /*
     * A transport that returns exactly the text this test wants to see stored. It goes through the
     * REAL `generateHebyModelAnswer` and the REAL validator — only the network is replaced — so
     * the seam is exercised the way production runs it. No key, no cost, no provider.
     */
    const transportReturning = (text: string): ClaudeTransport => ({
      async send(request) {
        return {
          id: "req_r3w_fake",
          model: request.model,
          content: [{ type: "text", text }],
          stopReason: "end_turn",
          usage: { inputTokens: 42, outputTokens: 7 },
        };
      },
    });

    /*
     * The artifact writer's database is INJECTED, exactly as every other server writer in this
     * repository allows. Without it the writer would resolve the ambient DATABASE_URL — i.e. the
     * canonical database — which no test may ever touch.
     */
    const writeDeps = { getDb: () => handle.db } as never;

    const answerDeps = (text: string): HebyModelAnswerDeps => ({
      resolveTenant: async () => tenant,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-r3w",
      /*
       * The REAL artifact read seam, pointed at the disposable database. Injected rather than
       * faked: a fake resolver would prove that a fake resolver works.
       */
      resolveWorkArtifacts: (t) => resolveWorkArtifactSource(t, { getDb: () => handle.db } as never),
    });

    /* ── 1. THE CONTROL CASE: an ordinary answer creates NO artifact ────────── */
    {
      const answered = await answerHebyModelRequest(
        { prompt: "What is our operational state?", route: "/operations" },
        answerDeps(DRAFTED),
      );
      assert.equal(answered.status, "answered");
      assert.equal(
        answered.status === "answered" ? answered.outcome.intent : "",
        "INVESTIGATE",
        "an ordinary answer is an INVESTIGATE, not a preparation",
      );

      const artifacts = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifacts`,
      );
      assert.equal(
        artifacts.rows[0]!.n,
        0,
        "A NORMAL HEBY ANSWER MUST NOT BECOME PREPARED WORK — same flow, same transport, same db",
      );

      const messages = await setup.query<{ n: number }>(`select count(*)::int as n from messages`);
      assert.equal(messages.rows[0]!.n, 2, "it stays exactly what it was: two message rows");
    }

    /* ── 2. The declared intent is one of the two that PREPARE ─────────────── */
    {
      const descriptor = HEBY_INTENT_DESCRIPTORS[WORK_ARTIFACT_PREPARATION_INTENT];
      assert.equal(descriptor.prepares, true, "the seam must use a prepares:true intent");
      assert.equal(descriptor.capability, "prepare-information");
    }

    /* ── 3. Explicit preparation DOES create an artifact, attributed to its message ── */
    let artifactId = "";
    {
      const prepared = await prepareWorkArtifact(
        {
          prompt: "Draft a quarterly summary email for Ayşe.",
          route: "/operations",
          artifactType: "message-draft",
          title: "Quarterly summary to Ayşe",
        },
        { ...answerDeps(DRAFTED), write: writeDeps },
      );
      assert.equal(prepared.status, "prepared", "explicit preparation must persist work");
      if (prepared.status !== "prepared") throw new Error("unreachable");
      artifactId = prepared.artifactId;

      assert.equal(prepared.revisionNo, 1);
      assert.equal(prepared.contentDigest, digestArtifactContent(DRAFTED));
      assert.match(prepared.ref, /^work-artifact\/[0-9a-f-]{36}@1$/);
      assert.equal(
        prepared.answer.status === "answered" ? prepared.answer.outcome.intent : "",
        WORK_ARTIFACT_PREPARATION_INTENT,
        "the recorded intent says what actually happened",
      );

      /* The revision content is the model's reply VERBATIM — no parser decided what it meant. */
      const row = await setup.query<{ content: string; src: string; actor: string }>(
        `select content, source_message_id as src, authored_by_actor_type as actor
           from work_artifact_revisions where artifact_id = $1`,
        [artifactId],
      );
      assert.equal(row.rows[0]!.content, DRAFTED);
      assert.equal(row.rows[0]!.src, prepared.sourceMessageId);
      assert.equal(row.rows[0]!.actor, "agent", "a model wrote the bytes and the row says so");

      /* And that message really is the assistant turn of this exchange. */
      const message = await setup.query<{ role: string; origin: string; content: string }>(
        `select role, origin, content from messages where id = $1`,
        [prepared.sourceMessageId],
      );
      assert.equal(message.rows[0]!.role, "assistant");
      assert.equal(message.rows[0]!.origin, "model");
      assert.equal(message.rows[0]!.content, DRAFTED);
    }

    /* ── 4. Preparing again against the same artifact APPENDS a revision ───── */
    {
      const prepared = await prepareWorkArtifact(
        {
          prompt: "Make it shorter.",
          route: "/operations",
          artifactType: "message-draft",
          title: "ignored on revise",
          artifactId,
        },
        { ...answerDeps(REVISED), write: writeDeps },
      );
      assert.equal(prepared.status, "prepared");
      assert.equal(prepared.status === "prepared" ? prepared.revisionNo : 0, 2);

      const history = await readWorkArtifactHistory(tenant, artifactId, {
        getDb: () => handle.db,
      } as never);
      assert.equal(history.length, 2);
      assert.equal(history[0]!.content, DRAFTED, "revision 1 is untouched by a Heby revision");
      assert.equal(history[1]!.content, REVISED);
      assert.equal(history[1]!.authoredByActorType, "agent");
    }

    /* ── 5. A DETERMINISTIC fallback is never filed as prepared work ────────── */
    {
      const before = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifacts`,
      );
      /*
       * Director connectivity OFF: the flow degrades to the honest deterministic answer, which for
       * PREPARE_RECOMMENDATION is an explicit UNAVAILABLE. Storing that would file "no model
       * runtime is connected" as though somebody had prepared it.
       */
      const refused = await prepareWorkArtifact(
        {
          prompt: "Draft something else.",
          route: "/operations",
          artifactType: "message-draft",
          title: "Should not exist",
        },
        { ...answerDeps(DRAFTED), write: writeDeps, resolveDirectorEnabled: async () => false },
      );
      assert.equal(refused.status, "refused");
      assert.equal(refused.status === "refused" ? refused.reason : "", "no-model-answer");
      assert.ok(
        refused.status === "refused" && refused.answer,
        "the human still sees what happened",
      );

      const after = await setup.query<{ n: number }>(
        `select count(*)::int as n from work_artifacts`,
      );
      assert.equal(after.rows[0]!.n, before.rows[0]!.n, "no artifact was created");
    }

    /* ── 6. Prepared work becomes retrievable EVIDENCE on the next answer ──── */
    {
      const answered = await answerHebyModelRequest(
        { prompt: "What have we prepared?", route: "/operations" },
        answerDeps(DRAFTED),
      );
      assert.equal(answered.status, "answered");
      if (answered.status !== "answered") throw new Error("unreachable");
      const refs = answered.outcome.response.evidence.map((e) => e.recordRef);
      assert.ok(
        refs.some((r) => r.startsWith("work-artifact/")),
        "the current revision is offered as evidence",
      );
      assert.ok(
        refs.every((r) => !r.endsWith("@1") || !r.includes(artifactId)),
        "the superseded revision 1 is never offered",
      );
      const artifactEvidence = answered.outcome.response.evidence.filter((e) =>
        e.recordRef.startsWith("work-artifact/"),
      );
      for (const item of artifactEvidence) {
        assert.equal(item.sourceClass, "work-artifacts");
        assert.equal(item.lifecycle, "settled");
      }
    }

    /* ── 7. Still nothing approved, permitted, ratified or executed ────────── */
    {
      const counts = await setup.query<{ p: number; d: number; k: number; e: number }>(
        `select (select count(*)::int from action_permits) as p,
                (select count(*)::int from decision_records) as d,
                (select count(*)::int from knowledge_nodes) as k,
                (select count(*)::int from executions) as e`,
      );
      const row = counts.rows[0]!;
      assert.equal(row.p, 0);
      assert.equal(row.d, 0);
      assert.equal(row.k, 0);
      assert.equal(row.e, 0);
    }

    console.log("PASS r3w preparation seam (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
