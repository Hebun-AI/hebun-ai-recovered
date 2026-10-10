/*
 * CONTENT-AGENT-2 — revise from the review. On a disposable PostgreSQL, through the released writers
 * only (agent identity, Governance, the review writer, the artifact writers) and a fake model
 * transport; nothing touches a network.
 *
 *   R   the reader offers a reason ONLY for a standing change request on the CURRENT revision:
 *       none · requested (with the reason) · accepted · superseded · cross-tenant · malformed
 *   P   preflight: a stale revision, a stale/foreign/accepted basis, a basis with no revision and a
 *       key on a new draft are refused BEFORE the model — zero calls, zero writes
 *   H   the happy path: one call, revision N+1, agent-authored, unreviewed; no decision, permit,
 *       request or attempt is written
 *   M   while the model is writing, a review or a human revision lands → the writer refuses under
 *       its lock (`changed-while-preparing`); nothing is filed on top
 *   L   the review writer waits for the revision writer's artifact lock (one lock protocol)
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import type { HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ClaudeTransport } from "../../src/features/heby-model";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { prepareWorkArtifact } from "../../src/features/work-artifacts/prepare-work-artifact.server";
import { createWorkArtifact, reviseWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { readWorkArtifactHistory } from "../../src/features/work-artifacts/read-work-artifacts.server";
import { resolveWorkArtifactSource } from "../../src/features/work-artifacts/work-artifact-evidence.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import {
  acceptArtifactRevision,
  readArtifactRevisionReviewStates,
  requestArtifactRevisionChanges,
} from "../../src/features/work-artifact-review/review-revision.server";
import { readCurrentRevisionChangeRequest } from "../../src/features/work-artifact-review/change-request.server";
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
const REASON = "The second paragraph overclaims provenance. Remove the age claim and keep the knotting detail only.";
const REASON_2 = "Shorter, please: one sentence about the loom, nothing about prices or shipping at all.";
const REVISED = "Tied by hand on the loom, one row at a time.";
/* The Director writes in whatever language they write in; the record must keep it exactly. */
const REASON_TR = "İkinci paragraf menşe iddiasını abartıyor.\nYaş iddiasını çıkar; “el dokuması” vurgusu kalsın — fiyat, kargo yok. Işıl ğüşöç İĞÜŞÖÇ.";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
  const user = (await client.query<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email])).rows[0]!.id;
  const identity = (await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [user, `local:${email}`],
  )).rows[0]!.id;
  const role = (await client.query<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`, [tenantId, `Role ${email}`])).rows[0]!.id;
  const membership = (await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`,
    [tenantId, user, role],
  )).rows[0]!.id;
  return { tenantId, userId: user, authIdentityId: identity, membershipId: membership, roleId: role };
}

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
    requestId: "ca2-request",
    authenticatedAt: new Date().toISOString(),
  });
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("content-agent-2/revise-from-review-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ca2_revise_from_review");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const dbDeps = { getDb: () => handle.db } as never;

  try {
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ca2", email: "director@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ca2", email: "director@globex.test" })) as Seeded;
    const tenant = contextFor(acme, await sessionRowFor(setup, acme, "ca2-acme"));
    const foreign = contextFor(globex, await sessionRowFor(setup, globex, "ca2-globex"));
    await seedGovernanceAuthority(setup, acme, dbDeps, { ctx: tenant, sessionContextId: tenant.sessionContextId });
    await seedGovernanceAuthority(setup, globex, dbDeps, { ctx: foreign, sessionContextId: foreign.sessionContextId });
    const agent = await createDurableAgentIdentity(tenant, { name: "Heby", justification: "Register this agent for the test organization." }, dbDeps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    const repo = createDurableConversationRepository(handle.db);

    /* The model. `during` runs INSIDE the call — the window a concurrent change lands in. */
    let calls = 0;
    let during: (() => Promise<void>) | null = null;
    const transport: ClaudeTransport = {
      async send(request) {
        calls++;
        if (during) {
          const run = during;
          during = null;
          await run();
        }
        return {
          id: `req_ca2_${calls}`,
          model: request.model,
          content: [{ type: "text", text: REVISED }],
          stopReason: "end_turn",
          usage: { inputTokens: 40, outputTokens: 10 },
        };
      },
    };
    const depsFor = (ctx: TenantContext, overrides: Partial<HebyModelAnswerDeps> = {}) => ({
      resolveTenant: async () => ctx,
      readOverview: () => undefined,
      env: MODEL_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: () => ({ transport, transportProvenance: "fake" as const }),
      generate: generateHebyModelAnswer,
      getConversationRepo: () => repo,
      resolvePublicKnowledge: publicKnowledgeNoMatch,
      newCorrelationId: () => "corr-ca2",
      resolveWorkArtifacts: (t: TenantContext | null) => resolveWorkArtifactSource(t, dbDeps),
      ...overrides,
      write: dbDeps,
      read: dbDeps,
      agentIdentity: dbDeps,
    });

    const n = async (q: string, p: unknown[] = []) => (await setup.query<{ n: number }>(q, p)).rows[0]!.n;
    const world = async () => ({
      calls,
      revisions: await n("select count(*)::int n from work_artifact_revisions"),
      decisions: await n("select count(*)::int n from decision_records"),
      permits: await n("select count(*)::int n from action_permits"),
      requests: await n("select count(*)::int n from heby_action_requests"),
      attempts: await n("select count(*)::int n from action_execution_attempts"),
    });

    const draft = async (ctx: TenantContext = tenant) => {
      const created = await createWorkArtifact(
        ctx,
        { artifactType: "content-draft", intendedDestination: "instagram", title: `Loom ${randomUUID().slice(0, 6)}`, content: "Every knot on this loom is tied by hand, for a hundred years." },
        "operations",
        dbDeps,
      );
      assert.equal(created.status, "created");
      return created.status === "created" ? created.artifactId : "";
    };
    const revisionId = async (artifactId: string, revisionNo: number, ctx: TenantContext = tenant) =>
      (await readWorkArtifactHistory(ctx, artifactId, dbDeps)).find((r) => r.revisionNo === revisionNo)!.id;
    const requestChanges = async (artifactId: string, revisionNo: number, reason = REASON, ctx: TenantContext = tenant) => {
      const r = await requestArtifactRevisionChanges(ctx, { artifactId, revisionId: await revisionId(artifactId, revisionNo, ctx), justification: reason }, dbDeps);
      assert.equal(r.status, "reviewed", JSON.stringify(r));
      return r.status === "reviewed" ? r.decisionId : "";
    };
    const revise = (artifactId: string, extra: Record<string, unknown>, ctx: TenantContext = tenant) =>
      prepareWorkArtifact(
        { prompt: REASON, route: "/operations", artifactType: "content-draft", title: "Loom", artifactId, ...extra },
        depsFor(ctx),
      );

    /* ══ R · THE READER ══════════════════════════════════════════════════════ */
    const a = await draft();
    assert.deepEqual(await readCurrentRevisionChangeRequest(tenant, { artifactId: a, revisionNo: 1 }, dbDeps), { status: "none" }, "R1: no decision → none");
    const aDecision = await requestChanges(a, 1);
    const r2 = await readCurrentRevisionChangeRequest(tenant, { artifactId: a, revisionNo: 1 }, dbDeps);
    assert.equal(r2.status, "requested", "R2: a standing change request is offered");
    assert.equal(r2.status === "requested" && r2.justification, REASON, "R2: with the recorded reason, verbatim");
    assert.equal(r2.status === "requested" && r2.decisionId, aDecision, "R2: and its exact decision");
    assert.deepEqual(await readCurrentRevisionChangeRequest(foreign, { artifactId: a, revisionNo: 1 }, dbDeps), { status: "none" }, "R3: another tenant sees nothing — indistinguishable from none");
    {
      /*
       * R8 · VISIBILITY IS GOVERNANCE, NOT MEMBERSHIP. Dana is an ACTIVE member of Acme with an
       * `owner` role and a real session — and holds no Governance authority. She is told only that.
       */
      const dana = await addMember(setup, acme.tenantId, "dana@acme.test");
      const danaCtx = contextFor(dana, await sessionRowFor(setup, dana, "ca2-dana"));
      const seen = await readCurrentRevisionChangeRequest(danaCtx, { artifactId: a, revisionNo: 1 }, dbDeps);
      assert.deepEqual(seen, { status: "not-authorized" }, "R8: an owner-role member without Governance authority does not see the reason");
      assert.deepEqual(
        await readCurrentRevisionChangeRequest(danaCtx, { artifactId: randomUUID(), revisionNo: 1 }, dbDeps),
        { status: "not-authorized" },
        "R8: and learns nothing about which drafts exist — authority is asked before the draft",
      );
      /* P8 · and she may not revise FROM the review either — even holding its decision id. Nothing is asked or written. */
      {
        const before = { calls, revisions: await n("select count(*)::int n from work_artifact_revisions") };
        const r = await prepareWorkArtifact(
          { prompt: "Make it one sentence.", route: "/operations", artifactType: "content-draft", title: "Loom", artifactId: a, expectedRevisionNo: 1, reviewBasisDecisionId: aDecision },
          depsFor(danaCtx),
        );
        assert.equal(r.status === "refused" && r.reason, "review-basis-not-authorized", `P8: a member without Governance cannot revise from a review (${JSON.stringify(r.status === "refused" ? r.reason : r.status)})`);
        assert.deepEqual({ calls, revisions: await n("select count(*)::int n from work_artifact_revisions") }, before, "P8: zero model calls, zero writes");
      }
      /* R9 · a context with no human session user is not an authority either. */
      assert.deepEqual(
        await readCurrentRevisionChangeRequest({ ...tenant, userId: undefined } as unknown as TenantContext, { artifactId: a, revisionNo: 1 }, dbDeps),
        { status: "not-authorized" },
        "R9: no session user, no reason",
      );
      assert.deepEqual(await readCurrentRevisionChangeRequest(null, { artifactId: a, revisionNo: 1 }, dbDeps), { status: "none" }, "R9: no tenant at all → nothing");
    }
    {
      /* R10 · THE REASON IS KEPT IN ITS OWN LANGUAGE, BYTE FOR BYTE — nothing translates or normalizes it. */
      const t = await draft();
      const tDecision = await requestChanges(t, 1, REASON_TR);
      const seen = await readCurrentRevisionChangeRequest(tenant, { artifactId: t, revisionNo: 1 }, dbDeps);
      assert.equal(seen.status === "requested" && seen.justification, REASON_TR, "R10: a Turkish reason comes back verbatim");
      assert.equal(
        seen.status === "requested" && Buffer.from(seen.justification, "utf8").equals(Buffer.from(REASON_TR, "utf8")),
        true,
        "R10: identical UTF-8 bytes (no case-folding, no Unicode normalization, no trimming of the inner newline)",
      );
      /* And it can be handed to Heby as the human's own instruction, unchanged. */
      const before = calls;
      const r = await revise(t, { prompt: REASON_TR, expectedRevisionNo: 1, reviewBasisDecisionId: tDecision });
      assert.equal(r.status, "prepared", `R10: Heby revises from a Turkish reason (${JSON.stringify(r.status === "refused" ? r.reason : r.status)})`);
      assert.equal(calls, before + 1, "R10: one model call");
      const prompt = (await setup.query<{ content: string }>(
        `select content from messages where conversation_id = (select conversation_id from messages where id = $1) and role = 'user' order by created_at desc limit 1`,
        [r.status === "prepared" ? r.sourceMessageId : null],
      )).rows[0]?.content;
      assert.equal(prompt, REASON_TR, "R10: the recorded human turn is the reason exactly as the human sent it");
    }
    for (const bad of [{ artifactId: "not-a-uuid", revisionNo: 1 }, { artifactId: a, revisionNo: 0 }, { artifactId: a, revisionNo: 1.5 }])
      assert.deepEqual(await readCurrentRevisionChangeRequest(tenant, bad, dbDeps), { status: "none" }, `R4: malformed input ${JSON.stringify(bad)} → none`);

    const b = await draft();
    await requestChanges(b, 1);
    const bAccept = await acceptArtifactRevision(tenant, { artifactId: b, revisionId: await revisionId(b, 1), justification: "Accepted after all: the claim was checked against the records." }, dbDeps);
    assert.equal(bAccept.status, "reviewed");
    assert.deepEqual(await readCurrentRevisionChangeRequest(tenant, { artifactId: b, revisionNo: 1 }, dbDeps), { status: "accepted" }, "R5: a later acceptance wins — the old reason is not offered");

    const c = await draft();
    await requestChanges(c, 1);
    assert.equal((await reviseWorkArtifact(tenant, { artifactId: c, content: "A human rewrote it." }, dbDeps)).status, "revised");
    assert.deepEqual(await readCurrentRevisionChangeRequest(tenant, { artifactId: c, revisionNo: 1 }, dbDeps), { status: "superseded" }, "R6: a reason on a revision that is no longer current is superseded");
    assert.deepEqual(await readCurrentRevisionChangeRequest(tenant, { artifactId: c, revisionNo: 2 }, dbDeps), { status: "none" }, "R7: and is never carried to the new revision");

    /* ══ P · PREFLIGHT REFUSALS — before the model, nothing written ════════════ */
    const preflight = async (label: string, run: () => ReturnType<typeof prepareWorkArtifact>, reason: string) => {
      const before = await world();
      const result = await run();
      assert.equal(result.status === "refused" && result.reason, reason, `${label}: ${JSON.stringify(result.status === "refused" ? result.reason : result.status)}`);
      assert.equal(result.status === "refused" ? result.answer : "x", undefined, `${label}: no model answer`);
      assert.deepEqual(await world(), before, `${label}: ZERO model calls and ZERO writes`);
    };
    await preflight("P1 stale revision", () => revise(a, { expectedRevisionNo: 2 }), "revision-stale");
    await preflight("P2 basis that is not the standing decision", () => revise(a, { expectedRevisionNo: 1, reviewBasisDecisionId: randomUUID() }), "review-basis-stale");
    await preflight("P3 basis on an ACCEPTED revision", () => revise(b, { expectedRevisionNo: 1, reviewBasisDecisionId: aDecision }), "review-basis-stale");
    await preflight("P4 basis with no revision", () => revise(a, { reviewBasisDecisionId: aDecision }), "invalid-input");
    await preflight("P5 malformed revision", () => revise(a, { expectedRevisionNo: -1 }), "invalid-input");
    await preflight(
      "P6 staleness key on a NEW draft",
      () => prepareWorkArtifact({ prompt: REASON, route: "/operations", artifactType: "content-draft", intendedDestination: "instagram", title: "New", expectedRevisionNo: 1 }, depsFor(tenant)),
      "invalid-input",
    );
    {
      /* Another tenant's decision as the basis: refused, and nothing about it is revealed. */
      const g = await draft(foreign);
      const gDecision = await requestChanges(g, 1, REASON, foreign);
      await preflight("P7 a FOREIGN decision as the basis", () => revise(a, { expectedRevisionNo: 1, reviewBasisDecisionId: gDecision }), "review-basis-stale");
    }

    /* ══ H · THE HAPPY PATH ════════════════════════════════════════════════════ */
    {
      const before = await world();
      const result = await revise(a, { prompt: REASON, expectedRevisionNo: 1, reviewBasisDecisionId: aDecision });
      assert.equal(result.status, "prepared", `H: ${JSON.stringify(result.status === "refused" ? result.reason : result.status)}`);
      if (result.status !== "prepared") throw new Error("unreachable");
      assert.equal(result.revisionNo, 2, "H: revision N+1");
      const after = await world();
      assert.equal(after.calls, before.calls + 1, "H: exactly one model call");
      assert.equal(after.revisions, before.revisions + 1, "H: exactly one revision");
      assert.deepEqual(
        { decisions: after.decisions, permits: after.permits, requests: after.requests, attempts: after.attempts },
        { decisions: before.decisions, permits: before.permits, requests: before.requests, attempts: before.attempts },
        "H: no decision, permit, request or attempt — a reason authorizes nothing",
      );
      const row = (await setup.query<{ actor: string; actorId: string; src: string | null; content: string }>(
        `select authored_by_actor_type actor, authored_by_actor_id "actorId", source_message_id src, content from work_artifact_revisions where artifact_id = $1 and revision_no = 2`,
        [a],
      )).rows[0]!;
      assert.equal(row.actor, "agent", "H: agent-authored");
      assert.equal(row.actorId, agentId, "H: by the durable agent, never the human who asked");
      assert.equal(row.src, result.sourceMessageId, "H: tied to its model message");
      assert.equal(row.content, REVISED, "H: the model's bytes");
      const states = await readArtifactRevisionReviewStates(tenant, a, dbDeps);
      assert.equal(states.find((s) => s.revisionNo === 2)?.decision, null, "H: the new revision awaits review");
      assert.equal(states.find((s) => s.revisionNo === 1)?.decision, "changes-requested", "H: the reviewed revision's decision is untouched");
      assert.deepEqual(await readCurrentRevisionChangeRequest(tenant, { artifactId: a, revisionNo: 2 }, dbDeps), { status: "none" }, "H: the old reason is not offered for the new revision");
      await preflight("H2 the same basis again", () => revise(a, { expectedRevisionNo: 1, reviewBasisDecisionId: aDecision }), "revision-stale");
    }

    /* ══ M · CHANGES WHILE THE MODEL IS WRITING — refused under the writer's lock ═══ */
    const whileWriting = async (label: string, change: (artifactId: string) => Promise<void>) => {
      const d = await draft();
      const basis = await requestChanges(d, 1, REASON_2);
      const callsBefore = calls;
      during = () => change(d);
      const revisionsBefore = await n("select count(*)::int n from work_artifact_revisions where artifact_id = $1", [d]);
      const result = await revise(d, { prompt: REASON_2, expectedRevisionNo: 1, reviewBasisDecisionId: basis });
      assert.equal(result.status === "refused" && result.reason, "changed-while-preparing", `${label}: ${JSON.stringify(result.status === "refused" ? result.reason : result.status)}`);
      assert.equal(calls, callsBefore + 1, `${label}: the model WAS asked (the change came after the preflight)`);
      assert.ok(result.status === "refused" && result.answer, `${label}: the answer is handed back`);
      const revisionsAfter = await n("select count(*)::int n from work_artifact_revisions where artifact_id = $1", [d]);
      return { d, revisionsBefore, revisionsAfter };
    };
    {
      const m1 = await whileWriting("M1 a review accepts the revision mid-call", async (d) => {
        const r = await acceptArtifactRevision(tenant, { artifactId: d, revisionId: await revisionId(d, 1), justification: "Accepted as is while Heby was still writing the revision." }, dbDeps);
        assert.equal(r.status, "reviewed");
      });
      assert.equal(m1.revisionsAfter, m1.revisionsBefore, "M1: nothing filed on top of an accepted revision");
      const m2 = await whileWriting("M2 a human revision lands mid-call", async (d) => {
        assert.equal((await reviseWorkArtifact(tenant, { artifactId: d, content: "A human got there first." }, dbDeps)).status, "revised");
      });
      assert.equal(m2.revisionsAfter, m2.revisionsBefore + 1, "M2: only the human's revision exists — Heby's was not stacked on it");
      const m3 = await whileWriting("M3 a second change request supersedes the basis mid-call", async (d) => {
        await requestChanges(d, 1, REASON);
      });
      assert.equal(m3.revisionsAfter, m3.revisionsBefore, "M3: a superseded basis files nothing");
    }
    {
      /* M4 · revision key ONLY (no review basis): the writer's own revision check is the sole guard. */
      const d = await draft();
      during = async () => {
        assert.equal((await reviseWorkArtifact(tenant, { artifactId: d, content: "A human got there first, again." }, dbDeps)).status, "revised");
      };
      const result = await revise(d, { prompt: "Make it shorter.", expectedRevisionNo: 1 });
      assert.equal(result.status === "refused" && result.reason, "changed-while-preparing", `M4 revision key only, human revision mid-call: ${JSON.stringify(result.status === "refused" ? result.reason : result.status)}`);
      assert.equal(await n("select count(*)::int n from work_artifact_revisions where artifact_id = $1", [d]), 2, "M4: only the human's revision was added");
    }

    /* ══ L · ONE LOCK PROTOCOL: a review waits for the revision writer's artifact lock ═══ */
    {
      const d = await draft();
      const rid = await revisionId(d, 1);
      const holder = new Client({ connectionString: harness.dbUrl });
      await holder.connect();
      try {
        await holder.query("begin");
        await holder.query("select id from work_artifacts where id = $1 for update", [d]);
        let settled = false;
        const pendingReview = requestArtifactRevisionChanges(tenant, { artifactId: d, revisionId: rid, justification: REASON }, dbDeps).then((r) => {
          settled = true;
          return r;
        });
        await new Promise((resolve) => setTimeout(resolve, 600));
        assert.equal(settled, false, "L: the review waits while the revision writer holds the artifact lock");
        await holder.query("commit");
        assert.equal((await pendingReview).status, "reviewed", "L: and completes once the lock is released");
      } finally {
        await holder.end().catch(() => {});
      }
    }

    /* L2 · a review in progress (FOR SHARE held) makes a revision append WAIT; L3 · two reviews do not block each other. */
    {
      const d = await draft();
      const holder = new Client({ connectionString: harness.dbUrl });
      await holder.connect();
      try {
        await holder.query("begin");
        await holder.query("select id from work_artifacts where id = $1 for share", [d]);
        let appended = false;
        const pendingAppend = reviseWorkArtifact(tenant, { artifactId: d, content: "Appended after the review." }, dbDeps).then((r) => {
          appended = true;
          return r;
        });
        let reviewed = false;
        const parallelReview = requestArtifactRevisionChanges(tenant, { artifactId: d, revisionId: await revisionId(d, 1), justification: REASON }, dbDeps).then((r) => {
          reviewed = true;
          return r;
        });
        await new Promise((resolve) => setTimeout(resolve, 600));
        assert.equal(appended, false, "L2: a revision append waits while a review holds the shared lock");
        assert.equal(reviewed, true, "L3: a second review is NOT blocked by another review's shared lock");
        assert.equal((await parallelReview).status, "reviewed");
        await holder.query("commit");
        assert.equal((await pendingAppend).status, "revised", "L2: and appends once the review commits");
      } finally {
        await holder.end().catch(() => {});
      }
    }

    assert.equal(networkCalls, 0, "no real network anywhere");
    finished = true;
    console.log("PASS content-agent-2 revise-from-review (postgres, released writers, fake model)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
