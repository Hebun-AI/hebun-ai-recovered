/*
 * TRH-20 — A LIVE PUBLIC CHANNEL OBSERVATION BECOMES ONE PENDING WORK PROPOSAL, against a REAL
 * database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Turkish Rug House's exact shape — zero recipients, zero drafts, zero departments, a mandate
 *    scoped to `record-work` alone — observes a public channel, and its durable agent either
 *    ABSTAINS or files ONE pending `record-work` request carrying its own reason. No permit, no
 *    execution, no Governance decision, no Knowledge row, no work item, and no stored observation
 *    exist afterwards, in either outcome."
 *
 * ── WHAT IS FAKED AND WHAT IS REAL ───────────────────────────────────────────
 *
 * The PROVIDER is faked at the observation seam: CGO-5's transport, key handling and capability
 * gate are released and accepted, and re-proving them here would need a live key. Everything
 * downstream of the observation is REAL — the real growth brief, the real generator, the real
 * parser, the real candidate builder, the real mandate ceiling, the real inlet, the real writer,
 * and a real Postgres. The model transport is a fake returning exactly the text each case needs,
 * which is how every released origination suite drives this path.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { originateAgentActionWithObservation } from "../../src/features/content-observation/originate-with-observation.server";
import { growthObservationSupplementFor } from "../../src/features/content-observation/growth-origination-brief";
import { GROWTH_OBSERVATION_FENCE } from "../../src/features/content-observation/growth-origination-brief";
import type { YouTubeChannelObservation } from "../../src/features/provider-youtube/contracts";
import type { ClaudeTransport } from "../../src/features/heby-model";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-07T09:00:00.000Z");
const HANDLE = "@TurkishRugHouse";
const GOAL =
  "Look at our public YouTube channel and tell me whether there is any work worth putting on the record.";

const MODEL_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
} as const;

const OBSERVATION: YouTubeChannelObservation = Object.freeze({
  channel: Object.freeze({
    channelId: "UC_trh_fixture",
    title: "Turkish Rug House",
    handle: HANDLE,
    publishedAt: "2021-04-02T00:00:00.000Z",
    viewCount: 842031,
    subscriberCount: null,
    hiddenSubscriberCount: true,
    videoCount: 118,
  }),
  recentVideos: Object.freeze([
    Object.freeze({
      videoId: "v1",
      title: "Knotting the border",
      publishedAt: "2026-08-30T00:00:00.000Z",
      viewCount: 412,
      likeCount: null,
      commentCount: 7,
    }),
  ]),
  moreVideosExist: true,
  observedAt: NOW.toISOString(),
  quotaUnitsSpent: 3,
}) as YouTubeChannelObservation;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, requestId: string): TenantContext {
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
    requestId,
    authenticatedAt: NOW.toISOString(),
  });
}

const TITLE = "Review the public YouTube channel's content direction";
const REASON =
  "The public channel lists 118 uploads and I have no record of any organizational work about it; I am asking for that review to be recorded.";

function recordWorkEnvelope(): string {
  return JSON.stringify({
    kind: "record-work",
    args: { title: TITLE, scope: { kind: "organization-level" } },
    reason: REASON,
  });
}

function abstentionEnvelope(): string {
  return JSON.stringify({
    kind: "none",
    reason: "The observation shows public counts and nothing about what this organization has done.",
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh20_growth");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const dbDeps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const countOf = async (table: string): Promise<number> =>
    (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;

  /*
   * Captures the SYSTEM message the model was actually shown, so the fence is proved at the seam
   * rather than in a unit. Evidence lives in `system` by released design and never in a turn.
   */
  let lastSystem = "";
  const transportReturning = (text: string): ClaudeTransport => ({
    async send(request) {
      lastSystem = request.system ?? "";
      return {
        id: "req_trh20_fake",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        usage: { inputTokens: 120, outputTokens: 40 },
      };
    },
  });

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TURKISH RUG HOUSE'S EXACT SHAPE.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = (await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "trh-trh20",
      email: "director@trh.test",
    })) as Seeded;
    const trhCtx = contextFor(trh, "trh20-trh");

    const agent = await createDurableAgentIdentity(trhCtx, { name: "Heby" }, writeDeps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";

    const mandate = await seedAgentMandate(setup, trh, agentId, writeDeps, {
      tag: "trh20",
      now: NOW,
      proposalScope: ["record-work"],
    });
    assert.equal(mandate.mandateRevision, 1);

    assert.equal(await countOf("external_recipients"), 0, "TRH has no recipient");
    assert.equal(await countOf("work_artifacts"), 0, "TRH has no draft");
    assert.equal(await countOf("departments"), 0, "TRH has no department, and that is legitimate");
    assert.equal(await countOf("integrations"), 0, "and it holds no provider connection in this fixture");

    const deps = (text: string, observe: unknown) =>
      ({
        resolveTenant: async () => trhCtx,
        env: MODEL_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({ transport: transportReturning(text), transportProvenance: "fake" }),
        newCorrelationId: () => "corr-trh20",
        agentIdentity: dbDeps,
        candidates: { recipients: dbDeps, artifacts: dbDeps, organization: dbDeps },
        proposal: writeDeps,
        recordWork: writeDeps,
        observe,
      }) as never;

    const observed = async () => ({ ok: true, value: OBSERVATION }) as never;

    /*
     * The mandate ceremony legitimately wrote a Governance decision before this suite's own acts.
     * The claim is that ORIGINATION adds none, so the baseline is measured rather than assumed —
     * a bare `0` would be false for a reason that has nothing to do with this phase.
     */
    const decisionsBeforeOrigination = await countOf("decision_records");
    assert.ok(decisionsBeforeOrigination >= 1, "the mandate ceremony's decision exists");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. THE MODEL SEES THE FENCE, AND SEES IT BEFORE ANY NUMBER.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const result = await originateAgentActionWithObservation(
        { goal: GOAL, observeChannelHandle: HANDLE },
        deps(abstentionEnvelope(), observed),
      );
      assert.equal(result.observation.status, "observed", "the observation reached the composition");

      const prompt = lastSystem;
      assert.ok(prompt.includes(growthObservationSupplementFor(OBSERVATION)), "the whole fenced block was sent");
      const firstNumber = prompt.indexOf("842,031");
      assert.ok(firstNumber > 0, "and it carried the number");
      for (const sentence of GROWTH_OBSERVATION_FENCE) {
        assert.ok(prompt.indexOf(sentence) < firstNumber, `denial before number, at the real seam: ${sentence}`);
      }
      assert.ok(
        prompt.indexOf("CANDIDATE RECIPIENTS") < prompt.indexOf(GROWTH_OBSERVATION_FENCE[0]!),
        "the candidates come first and the observation after — grounding is never a candidate",
      );

      /* ── ABSTENTION IS A CORRECT ANSWER, AND IT COSTS NOTHING. ──────────── */
      assert.equal(result.origination.status, "refused");
      assert.equal(
        result.origination.status === "refused" ? result.origination.reason : "",
        "no-action-proposed",
        "the agent looked at the channel and asked for nothing",
      );
      assert.equal(await countOf("heby_action_requests"), 0, "and NOTHING was filed");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. THE AGENT SELECTS record-work, AND ONE PENDING REQUEST LANDS.
     * ═════════════════════════════════════════════════════════════════════ */
    const proposed = await originateAgentActionWithObservation(
      { goal: GOAL, observeChannelHandle: HANDLE },
      deps(recordWorkEnvelope(), observed),
    );
    assert.equal(
      proposed.origination.status,
      "proposed",
      `TRH's Heby originated a record-work proposal from a public observation (got ${JSON.stringify(proposed.origination)})`,
    );
    if (proposed.origination.status !== "proposed") throw new Error("unreachable");
    assert.equal(proposed.origination.kind, "record-work", "and the result names WHICH action it chose");
    assert.equal(proposed.observation.status, "observed");

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. PROPOSED != AUTHORIZED != PERMITTED != EXECUTED != RECORDED != KNOWN.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.equal(await countOf("heby_action_requests"), 1, "EXACTLY ONE request was filed");
      assert.equal(await countOf("action_permits"), 0, "PROPOSED != PERMITTED");
      assert.equal(await countOf("action_execution_attempts"), 0, "and nothing was executed");
      assert.equal(await countOf("work_items"), 0, "PROPOSED != RECORDED — the work register is empty");
      assert.equal(await countOf("knowledge_nodes"), 0, "an observation admitted NOTHING into Knowledge");
      assert.equal(await countOf("knowledge_facts"), 0, "and established no fact");
      assert.equal(
        await countOf("knowledge_external_references"),
        0,
        "and declared no external reference to the channel",
      );
      assert.equal(await countOf("integrations"), 0, "no connection was created by observing");
      assert.equal(await countOf("integration_credentials"), 0, "and no credential was written");

      /*
       * NO GOVERNANCE DECISION WAS CREATED BY ORIGINATING. The mandate ceremony wrote one before
       * this section ran, so the assertion is that the count did not MOVE — a bare `0` would be
       * false for a reason that has nothing to do with this phase.
       */
      assert.equal(
        await countOf("decision_records"),
        decisionsBeforeOrigination,
        "origination created no Governance decision of its own",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE ROW SAYS WHO PROPOSED, WHAT, AND WHY — AND THE WHY IS THE AGENT'S.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const row = (
        await setup.query<{
          status: string;
          actionKind: string;
          proposedByActorType: string | null;
          proposedByActorId: string | null;
          createdBy: string | null;
          proposalRationale: string | null;
          canonicalPayload: Record<string, unknown>;
        }>(
          `select status, action_kind as "actionKind",
                  proposed_by_actor_type as "proposedByActorType",
                  proposed_by_actor_id as "proposedByActorId",
                  created_by as "createdBy",
                  proposal_rationale as "proposalRationale",
                  canonical_payload as "canonicalPayload"
             from heby_action_requests limit 1`,
        )
      ).rows[0]!;

      assert.equal(row.status, "pending", "it waits for a human");
      assert.equal(row.actionKind, "record-work");
      assert.equal(row.proposedByActorType, "agent", "the AGENT proposed");
      assert.equal(row.proposedByActorId, agentId, "and it is TRH's own agent");
      assert.equal(row.createdBy, trh.userId, "while the human's session caused the write");

      /* TRH-19's column is the one and only home of the reason, and it is the model's own words. */
      assert.equal(row.proposalRationale, REASON, "the agent's reason is durable and verbatim");
      assert.equal(
        JSON.stringify(row.canonicalPayload).includes(REASON),
        false,
        "and it is NOT part of the act's identity",
      );

      /*
       * THE PROVIDER'S OWN IDENTIFIERS REACH NO ROW. Not the channel id, not the handle, not a
       * rendered count. A proposal is what was ASKED FOR; the outside number that prompted it is
       * not a fact this organization now holds, and nothing durable may be able to imply it is.
       */
      const whole = JSON.stringify(row);
      for (const trace of [OBSERVATION.channel.channelId, HANDLE, "842,031", "842031"]) {
        assert.equal(
          whole.includes(trace),
          false,
          `the filed row must not carry the observation trace "${trace}"`,
        );
      }

      /*
       * THE TITLE CARRIES NO FIGURE AT ALL, and the RATIONALE may cite one. That asymmetry is the
       * fence's, not this test's: a title becomes the name of organizational work and would make an
       * outside number read like something this organization measured, while a rationale is openly
       * the agent's own sentence about why it is asking. Both are read by a human before anything
       * is decided.
       */
      const title = String((row.canonicalPayload as { title?: unknown }).title ?? "");
      assert.ok(title.length > 0, "the filed act names the work");
      assert.equal(/\d/.test(title), false, `the work title carries no figure (got "${title}")`);
      assert.ok(
        (row.proposalRationale ?? "").includes("118"),
        "while the rationale may say what the agent saw, in its own words",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. THE CEILING STILL DECIDES. An observation grants nothing.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const recipient = await setup.query<{ n: number }>("select count(*)::int as n from external_recipients");
      assert.equal(recipient.rows[0]!.n, 0, "there is still nothing to send to");

      const sendAttempt = await originateAgentActionWithObservation(
        { goal: GOAL, observeChannelHandle: HANDLE },
        deps(
          JSON.stringify({
            kind: "send",
            args: {
              recipientRef: "external-recipient/00000000-0000-4000-8000-000000000001",
              draftRef: "work-artifact/00000000-0000-4000-8000-000000000002@1",
            },
            reason: "The channel observation suggests we should tell someone.",
          }),
          observed,
        ),
      );
      assert.equal(sendAttempt.origination.status, "refused", "a send is refused");
      assert.equal(await countOf("heby_action_requests"), 1, "and nothing new was filed");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE PROVIDER FAILING DOES NOT COST THE HUMAN THEIR ANSWER — OR LIE TO THEM.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const failed = await originateAgentActionWithObservation(
        { goal: GOAL, observeChannelHandle: HANDLE },
        deps(abstentionEnvelope(), async () => ({ ok: false, failure: "quota", reason: "quota-exhausted" }) as never),
      );
      assert.deepEqual(
        failed.observation,
        { status: "failed", failure: "quota", reason: "quota-exhausted" },
        "the human is told exactly what became of the observation",
      );
      assert.equal(failed.origination.status, "refused", "and the origination still ran to a real answer");
      const prompt = lastSystem;
      assert.equal(
        prompt.includes(GROWTH_OBSERVATION_FENCE[0]!),
        false,
        "with NO observation block at all — an absence is never described to the model",
      );
      assert.equal(await countOf("heby_action_requests"), 1, "and nothing new was filed");
    }

    console.log("trh20-governed-growth-proposal/growth-origination-postgres: all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
