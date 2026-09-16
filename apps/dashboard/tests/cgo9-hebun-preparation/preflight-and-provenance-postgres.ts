/*
 * CGO-9 — HUMAN-REACHABLE HEBUN PREPARATION, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A person on /operations may ask Hebun to prepare a content draft or a new revision of one.
 *    Every prerequisite that does not need the model is checked before the model is invoked, and a
 *    refusal there writes nothing at all. Once a model is really invoked its message provenance
 *    stays, whatever happens next — but prepared work is written only when it is legitimate, it is
 *    authored by the durable agent, and it arrives awaiting Governance review."
 *
 * THREE OUTCOMES, COUNTED RATHER THAN CLAIMED. Every case below measures transport calls, message
 * rows and artifact/revision rows before and after:
 *
 *   preflight refusal        calls +0, messages +0, artifacts +0, revisions +0
 *   post-invocation failure  messages recorded by the answer flow stay; artifacts +0, revisions +0
 *   prepared                 calls +1, messages +2, exactly one creation or one appended revision
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened. No
 * live provider: the transport is a counting fake that goes through the REAL generator and
 * validator. No network, no key, no cost.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import type { HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import {
  createWorkArtifact,
  retireWorkArtifact,
} from "../../src/features/work-artifacts/write-work-artifacts.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { readCurrentRevisionReviewStates } from "../../src/features/work-artifact-review/review-revision.server";
import { artifactRowReviewStatus } from "../../src/features/work-artifact-review/contracts";
import { digestArtifactContent } from "../../src/features/work-artifacts/content-digest";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-16T09:00:00.000Z");
const CAPTION = "Every knot on this loom is tied by hand, one row at a time.";
const REVISED = "Tied by hand, one row at a time — this is how the border begins.";
const MARKER = "HUMAN-WRITTEN-DRAFT-MARKER-cgo9";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "200",
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
    requestId: "cgo9-prepare",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_cgo9_preparation");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-cgo9",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-cgo9",
      email: "other@globex.test",
    })) as Seeded;
    const tenant = contextFor(acme);
    const foreign = contextFor(globex);
    const repo = createDurableConversationRepository(handle.db);

    /* Every system prompt the transport was handed, in order. The call count is its length. */
    const sent: string[] = [];
    const transport = (text: string | Error): ClaudeTransport => ({
      async send(request) {
        sent.push(request.system);
        if (text instanceof Error) throw text;
        return {
          id: "req_cgo9_fake",
          model: request.model,
          content: [{ type: "text", text }],
          stopReason: "end_turn",
          usage: { inputTokens: 50, outputTokens: 12 },
        };
      },
    });

    const depsFor = (
      ctx: TenantContext | null,
      text: string | Error,
      overrides: Partial<HebyModelAnswerDeps> = {},
    ) => ({
      resolveTenant: async () => ctx,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport: transport(text), transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      newCorrelationId: () => "corr-cgo9",
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      ...overrides,
      write: dbDeps,
      agentIdentity: dbDeps,
    });

    const count = async (table: string): Promise<number> =>
      (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;
    const snapshot = async () => ({
      calls: sent.length,
      messages: await count("messages"),
      artifacts: await count("work_artifacts"),
      revisions: await count("work_artifact_revisions"),
    });

    const newDraft = {
      prompt: "Draft an Instagram caption about hand-knotting on the loom.",
      route: "/operations",
      artifactType: "content-draft" as const,
      intendedDestination: "instagram" as const,
      title: "Loom caption",
    };

    /* A PREFLIGHT refusal: nothing moved, and no answer exists to hand back. */
    async function refusedInPreflight(
      label: string,
      run: () => ReturnType<typeof prepareWorkArtifact>,
      reason: string,
    ) {
      const before = await snapshot();
      const result = await run();
      assert.equal(result.status, "refused", `${label}: refused`);
      assert.equal(result.status === "refused" ? result.reason : "", reason, `${label}: ${reason}`);
      assert.equal(
        result.status === "refused" ? result.answer : "unreachable",
        undefined,
        `PREFLIGHT REFUSAL CARRIES NO ANSWER — ${label}`,
      );
      assert.deepEqual(
        await snapshot(),
        before,
        `PREFLIGHT REFUSAL: ZERO MODEL INVOCATION, ZERO MESSAGES, ZERO ARTIFACT OR REVISION WRITES — ${label}`,
      );
      return result;
    }

    /* ═══ 1. PREFLIGHT REFUSALS ═════════════════════════════════════════════ */

    await refusedInPreflight(
      "no tenant",
      () => prepareWorkArtifact(newDraft, depsFor(null, CAPTION)),
      "unauthenticated",
    );

    await refusedInPreflight(
      "no durable agent",
      () => prepareWorkArtifact(newDraft, depsFor(tenant, CAPTION)),
      "no-durable-agent-identity",
    );

    const established = await createDurableAgentIdentity(tenant, { name: "Heby" }, dbDeps);
    assert.equal(established.status, "established");
    const agentId = established.status === "established" ? established.identity.agentId : "";

    await refusedInPreflight(
      "Claude provider control off",
      () =>
        prepareWorkArtifact(
          newDraft,
          depsFor(tenant, CAPTION, { resolveDirectorEnabled: async () => false }),
        ),
      "model-connectivity-disabled",
    );

    {
      const refused = await refusedInPreflight(
        "content draft with no declared destination",
        () =>
          prepareWorkArtifact(
            { ...newDraft, intendedDestination: undefined },
            depsFor(tenant, CAPTION),
          ),
        "invalid-input",
      );
      assert.ok(
        refused.status === "refused" &&
          refused.problems?.some((p) => p.field === "intendedDestination"),
        "the released validator's own problem is handed back",
      );
      assert.ok(
        refused.status === "refused" && !refused.problems?.some((p) => p.field === "content"),
        "the content is the model's to write, so its absence is never a problem before generation",
      );
    }

    await refusedInPreflight(
      "blank title",
      () => prepareWorkArtifact({ ...newDraft, title: "  " }, depsFor(tenant, CAPTION)),
      "invalid-input",
    );

    await refusedInPreflight(
      "revision of an unknown artifact",
      () =>
        prepareWorkArtifact(
          { ...newDraft, artifactId: "7b0e1c52-0d7c-4a8e-9a57-4f3b8a1d2c90" },
          depsFor(tenant, REVISED),
        ),
      "artifact-not-found",
    );

    /* A human-written content draft to revise, written through the released direct path. */
    const human = await createWorkArtifact(
      tenant,
      {
        artifactType: "content-draft",
        intendedDestination: "instagram",
        title: "Border caption",
        content: `${MARKER}\nThe border starts here.`,
      },
      "operations",
      dbDeps,
    );
    assert.equal(human.status, "created");
    const humanId = human.status === "created" ? human.artifactId : "";

    await refusedInPreflight(
      "revision of ANOTHER tenant's artifact",
      () => prepareWorkArtifact({ ...newDraft, artifactId: humanId }, depsFor(
        foreign,
        REVISED,
      )),
      /* Globex has no agent, so the author refusal comes first — the ORDER is the boundary. */
      "no-durable-agent-identity",
    );

    /* ═══ 2. PREPARED: A NEW CONTENT DRAFT ══════════════════════════════════ */
    let preparedId = "";
    {
      const before = await snapshot();
      const prepared = await prepareWorkArtifact(newDraft, depsFor(tenant, CAPTION));
      assert.equal(prepared.status, "prepared", "Hebun prepares the content draft");
      if (prepared.status !== "prepared") throw new Error("unreachable");
      preparedId = prepared.artifactId;

      const after = await snapshot();
      assert.equal(after.calls, before.calls + 1, "exactly one model invocation");
      assert.equal(after.messages, before.messages + 2, "its user and assistant turns are recorded");
      assert.equal(after.artifacts, before.artifacts + 1, "exactly one artifact");
      assert.equal(after.revisions, before.revisions + 1, "exactly one revision");

      const row = await setup.query<{ actor: string; actorId: string; src: string; content: string }>(
        `select authored_by_actor_type as actor, authored_by_actor_id as "actorId",
                source_message_id as src, content
           from work_artifact_revisions where artifact_id = $1`,
        [preparedId],
      );
      assert.equal(row.rows[0]!.content, CAPTION, "the model's bytes, verbatim");
      assert.equal(row.rows[0]!.actor, "agent");
      assert.equal(row.rows[0]!.actorId, agentId, "AUTHORED BY THE DURABLE AGENT");
      assert.notEqual(row.rows[0]!.actorId, acme.userId, "NEVER ATTRIBUTED TO THE HUMAN REQUESTER");

      const artifact = await setup.query<{ createdBy: string; type: string }>(
        `select created_by as "createdBy", created_by_type as type from work_artifacts where id = $1`,
        [preparedId],
      );
      assert.equal(artifact.rows[0]!.createdBy, acme.userId, "the person who asked is the requester");
      assert.equal(artifact.rows[0]!.type, "human");

      const message = await setup.query<{
        role: string;
        origin: string;
        provider: string | null;
        model: string | null;
        inputTokens: number | null;
      }>(
        `select role, origin, provider, model, input_tokens as "inputTokens" from messages where id = $1`,
        [row.rows[0]!.src],
      );
      assert.equal(row.rows[0]!.src, prepared.sourceMessageId, "source_message_id is the assistant turn");
      assert.equal(message.rows[0]!.role, "assistant");
      assert.equal(message.rows[0]!.origin, "model");
      assert.equal(message.rows[0]!.provider, "claude", "invocation provenance lives on the message");
      assert.equal(message.rows[0]!.model, "claude-test");
      assert.equal(message.rows[0]!.inputTokens, 50);

      const review = await readCurrentRevisionReviewStates(
        tenant,
        [{ artifactId: preparedId, revisionNo: prepared.revisionNo }],
        dbDeps,
      );
      assert.equal(
        artifactRowReviewStatus(review, preparedId),
        "awaiting-review",
        "PREPARED WORK ENTERS THE CGO-8/TRH-10 REVIEW FLOW AS AWAITING REVIEW",
      );
      assert.equal(await count("decision_records"), 0, "and preparing recorded no Governance decision");
    }

    /* ═══ 3. PREPARED: A NEW REVISION OF THE HUMAN-WRITTEN DRAFT ════════════ */
    {
      const [original] = await readWorkArtifactHistory(tenant, humanId, dbDeps);
      const before = await snapshot();
      const prepared = await prepareWorkArtifact(
        {
          prompt: "Make it warmer and mention the border.",
          route: "/operations",
          /* The client's restatement is ignored: the TARGET's own type and destination brief the model. */
          artifactType: "message-draft",
          title: "ignored on revise",
          artifactId: humanId,
        },
        depsFor(tenant, REVISED),
      );
      assert.equal(prepared.status, "prepared", "Hebun prepares a revision");
      if (prepared.status !== "prepared") throw new Error("unreachable");
      assert.equal(prepared.revisionNo, 2);

      const after = await snapshot();
      assert.equal(after.calls, before.calls + 1);
      assert.equal(after.messages, before.messages + 2);
      assert.equal(after.artifacts, before.artifacts, "a revision creates no artifact");
      assert.equal(after.revisions, before.revisions + 1, "exactly one appended revision");

      const system = sent[sent.length - 1]!;
      assert.ok(system.includes("You are now preparing a CONTENT DRAFT"), "briefed as a content draft");
      assert.ok(system.includes("prepared for Instagram"), "with the target's own destination");
      assert.ok(
        system.includes(`--- CURRENT REVISION 1 BEGINS ---\n${original!.content}\n--- CURRENT REVISION 1 ENDS ---`),
        "THE MODEL IS SHOWN THE REVISION IT IS REVISING",
      );
      const leaked = await setup.query<{ n: number }>(
        `select count(*)::int as n from messages where content like $1`,
        [`%${MARKER}%`],
      );
      assert.equal(leaked.rows[0]!.n, 0, "the revision basis is instruction, never a stored message");

      const history = await readWorkArtifactHistory(tenant, humanId, dbDeps);
      assert.equal(history.length, 2);
      assert.equal(history[0]!.contentDigest, original!.contentDigest, "APPEND-ONLY: revision 1 is byte-identical");
      assert.equal(history[0]!.authoredByActorType, "human", "and still names its human author");
      assert.equal(history[1]!.content, REVISED);
      assert.equal(history[1]!.contentDigest, digestArtifactContent(REVISED));
      assert.equal(history[1]!.authoredByActorId, agentId, "the new revision names the durable agent");
      assert.equal(history[1]!.sourceMessageId, prepared.sourceMessageId);

      const review = await readCurrentRevisionReviewStates(
        tenant,
        [{ artifactId: humanId, revisionNo: 2 }],
        dbDeps,
      );
      assert.equal(artifactRowReviewStatus(review, humanId), "awaiting-review", "revision 2 awaits review");
    }

    /* A tenant WITH its own agent still cannot reach another tenant's draft: not found, not "not yours". */
    {
      const globexAgent = await createDurableAgentIdentity(foreign, { name: "Heby" }, dbDeps);
      assert.equal(globexAgent.status, "established");
      await refusedInPreflight(
        "revision of ANOTHER tenant's artifact, by a tenant that has an agent",
        () => prepareWorkArtifact({ ...newDraft, artifactId: humanId }, depsFor(foreign, REVISED)),
        "artifact-not-found",
      );
    }

    /* ═══ 4. POST-INVOCATION FAILURE: provenance stays, prepared work does not ══ */
    {
      const before = await snapshot();
      const refused = await prepareWorkArtifact(
        newDraft,
        depsFor(tenant, new Error("transport exploded")),
      );
      assert.equal(refused.status, "refused");
      assert.equal(refused.status === "refused" ? refused.reason : "", "no-model-answer");
      assert.ok(refused.status === "refused" && refused.answer, "the answer flow ran, and says what happened");
      const after = await snapshot();
      assert.equal(after.calls, before.calls + 1, "a model was really invoked");
      assert.equal(
        after.messages,
        before.messages + 2,
        "POST-INVOCATION: THE ANSWER FLOW'S MESSAGE RECORD IS NOT ERASED",
      );
      assert.equal(after.artifacts, before.artifacts, "POST-INVOCATION FAILURE: ZERO ARTIFACT WRITES");
      assert.equal(after.revisions, before.revisions, "POST-INVOCATION FAILURE: ZERO REVISION WRITES");
    }

    /* A switch turned off AFTER the preflight read it: the answer flow degrades, nothing is filed. */
    {
      let reads = 0;
      const before = await snapshot();
      const refused = await prepareWorkArtifact(
        newDraft,
        depsFor(tenant, CAPTION, { resolveDirectorEnabled: async () => (reads++ === 0) }),
      );
      assert.equal(refused.status === "refused" ? refused.reason : "", "no-model-answer");
      const after = await snapshot();
      assert.equal(after.calls, before.calls, "the answer flow honoured the switch it read");
      assert.equal(after.artifacts, before.artifacts);
      assert.equal(after.revisions, before.revisions, "and nothing was filed");
    }

    /* ═══ 5. A RETIRED DRAFT TAKES NO HEBUN REVISION — refused in preflight ════ */
    {
      const retired = await retireWorkArtifact(tenant, { artifactId: preparedId }, dbDeps);
      assert.equal(retired.status, "retired");
      await refusedInPreflight(
        "revision of a retired draft",
        () => prepareWorkArtifact({ ...newDraft, artifactId: preparedId }, depsFor(tenant, REVISED)),
        "artifact-retired",
      );
    }

    console.log("cgo9-hebun-preparation/preflight-and-provenance-postgres: ok");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
