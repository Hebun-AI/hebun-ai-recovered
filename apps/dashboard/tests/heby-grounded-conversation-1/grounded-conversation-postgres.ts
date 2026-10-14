/*
 * HEBY-GROUNDED-CONVERSATION-1 — the general Heby workspace answers from RATIFIED Knowledge, only as
 * far as the tenant's own EAI authorization reaches, inside a conversation only its owner can reach.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES, against a real PostgreSQL database:
 *   A. A conversation belongs to the human who started it. Another member of the same tenant, another
 *      tenant, a caller with no actor, and a legacy row with no owner all reach nothing — by load, by
 *      bounded history, by append — and a shared browser's stale pointer starts a fresh thread.
 *   B. Through `/heby`, only a version Governance ratified reaches the model or the evidence: not an
 *      unratified version, not a rejected one, not a superseded one, not another tenant's.
 *   C. Knowledge is OPTIONAL: authorized for Knowledge → disclosed; conversation-only → the model still
 *      answers and Knowledge is withheld; no authorization or a missing authority → nothing is sent.
 *
 * Released writers (K2 create/supersede, K4 ratify/reject) seed Knowledge; the gate is the released
 * composer under the recorded platform policy, fed the tenant's scopes. The live transport's fetch is
 * injected: no network, no provider, no credential. Disposable database, dropped on exit.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { admittedDispatch } from "../helpers/authorized-disclosure";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { ratifyKnowledgeVersion, rejectKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import {
  ConversationScopeError,
  createDurableConversationRepository,
} from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { loadHebyConversation } from "../../src/features/heby-answer/load-conversation.server";
import { resolveRatifiedKnowledgeEvidence } from "../../src/features/heby-answer/knowledge-evidence.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { composeExternalAiDisclosure } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import type { AttestationTreatmentView } from "../../src/features/external-ai-data-use/attestation-change";
import type { ScopePair } from "../../src/features/external-ai-data-use/contracts";
import type { ExternalAiDisclosureDeclaration } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { recordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { readExternalAiDisclosureDecisions } from "../../src/features/governance-audit/external-ai-disclosure-read.server";

const NOW = new Date("2026-10-14T09:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";
const HAIKU = "claude-haiku-4-5-20251001";
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: HAIKU,
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const OK = { id: "msg_hgc1", model: HAIKU, content: [{ type: "text", text: "Answer." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };

/* Markers: each statement carries one, so the wire body says exactly which version reached it. */
const RATIFIED = "MARK-RATIFIED-ALICE";
const UNRATIFIED = "MARK-UNRATIFIED-DRAFT";
const REJECTED = "MARK-REJECTED-VERSION";
const SUPERSEDED_OLD = "MARK-SUPERSEDED-OLD";
const SUPERSEDED_NEW = "MARK-SUPERSEDED-NEW-UNRATIFIED";
const BOB_RATIFIED = "MARK-GLOBEX-RATIFIED";
const ALICE_PRIVATE = "MARK-ALICE-PRIVATE-QUESTION";
const ALL_ALICE_UNSERVABLE = [UNRATIFIED, REJECTED, SUPERSEDED_OLD, SUPERSEDED_NEW, BOB_RATIFIED];

/* ── the gate, as the released composer decides it ─────────────────────────────────────────── */
const A: AttestationTreatmentView = {
  id: "ffb0c160-4082-4c7f-be6a-05a4d990c598",
  serviceScope: "anthropic/messages",
  accountRef: "org-test-account",
  identityStatus: "attested",
  contractSurface: "anthropic-commercial-terms",
  training: "none",
  retentionClass: "bounded-30-days",
  zdr: "not-enabled",
  modelTreatmentClass: "anthropic-standard",
};
const ASSISTANCE_ALL: ScopePair[] = [
  { purpose: "assistance", dataClass: "conversation" },
  { purpose: "assistance", dataClass: "knowledge" },
  { purpose: "assistance", dataClass: "work-artifact" },
];
const CONVERSATION_ONLY: ScopePair[] = [{ purpose: "assistance", dataClass: "conversation" }];
type Authority = { scopes: ScopePair[] | null } | "attestation-unavailable" | "tenant-unavailable";

function gate(authority: Authority) {
  return async (d: ExternalAiDisclosureDeclaration | null, operatorEnabled: boolean | null, modelId: string) =>
    composeExternalAiDisclosure({
      request: {
        serviceScope: "anthropic/messages",
        purpose: d?.purpose ?? "assistance",
        requiredDataClasses: d?.dataClasses ?? [],
        optionalDataClasses: d?.optionalDataClasses ?? [],
        modelId,
      },
      policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
      accountRef: "org-test-account",
      attestation:
        authority === "attestation-unavailable"
          ? { status: "unavailable" }
          : { status: "read", latest: { ...A, state: "active", modelIds: [HAIKU], attestationRevision: 1 } },
      tenant:
        authority === "tenant-unavailable"
          ? { status: "unavailable" }
          : authority === "attestation-unavailable" || authority.scopes === null
            ? { status: "absent" }
            : { status: "read", effective: { authorizationId: randomUUID(), state: "active", boundAttestation: A, scopes: authority.scopes, authorizationRevision: 1 } },
      operatorEnabled,
      providerAvailable: true,
    });
}

function contextFor(tenantId: string, userId: string, seeded: SeededLocalIdentity): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: randomUUID(),
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "hgc1-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_hgc1_grounded");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const realFetch = globalThis.fetch;
  let strayNetwork = 0;
  globalThis.fetch = (async () => {
    strayNetwork += 1;
    throw new Error("no network in this suite");
  }) as typeof fetch;

  try {
    harness.migrateDatabase();
    await setup.connect();
    // Every default reader in the answer flow resolves THIS disposable database.
    process.env.DATABASE_URL = harness.dbUrl;

    const writer = createDurableKnowledgeWriter(handle.db);
    const knowledgeRepo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => knowledgeRepo,
      getRepository: () => knowledgeRepo,
      now: () => NOW,
    } as never;
    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-hgc1", email: "alice@hgc1.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-hgc1", email: "bob@hgc1.test", password: "bob-correct-password-4Lm" });
    const aliceCtx = { ...contextFor(alice.tenantId, alice.userId, alice), sessionContextId: await sessionRowFor(setup, alice, "a") } as TenantContext;
    const bobCtx = { ...contextFor(bob.tenantId, bob.userId, bob), sessionContextId: await sessionRowFor(setup, bob, "b") } as TenantContext;
    /* A second human of Acme. Ownership is the user id; the same tenant, a different person. */
    const carolCtx = contextFor(alice.tenantId, randomUUID(), alice);

    for (const [seeded, ctx] of [[alice, aliceCtx], [bob, bobCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const established = await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority so Knowledge can be reviewed." }, deps);
      assert.equal(established.status, "established");
    }

    const create = async (ctx: TenantContext, factKey: string, marker: string) => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey: "policies", scope: "company-wide", title: `Refund policy ${factKey}`, statement: `Refund policy: ${marker}.` }, knowledgeDeps);
      assert.equal(created.status, "created", JSON.stringify(created));
      if (created.status !== "created") throw new Error("unreachable");
      return { factId: created.identity.factId, nodeId: created.identity.newKnowledgeNodeId! };
    };
    const ratify = async (ctx: TenantContext, fact: { factId: string; nodeId: string }, version = 1) => {
      const r = await ratifyKnowledgeVersion(ctx, { factId: fact.factId, knowledgeNodeId: fact.nodeId, observedKnowledgeVersion: version, justification: REASON }, deps);
      assert.equal(r.status, "ratified", JSON.stringify(r));
    };

    /* ── seed: one servable version, and every shape that must not be served ───────────────── */
    await ratify(aliceCtx, await create(aliceCtx, "refunds.ratified", RATIFIED));
    await create(aliceCtx, "refunds.draft", UNRATIFIED);
    const rejected = await create(aliceCtx, "refunds.rejected", REJECTED);
    const rj = await rejectKnowledgeVersion(aliceCtx, { factId: rejected.factId, knowledgeNodeId: rejected.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
    assert.equal(rj.status, "rejected", JSON.stringify(rj));
    const old = await create(aliceCtx, "refunds.superseded", SUPERSEDED_OLD);
    await ratify(aliceCtx, old);
    const sup = await supersedeKnowledgeFact(aliceCtx, { factId: old.factId, title: "Refund policy refunds.superseded", statement: `Refund policy: ${SUPERSEDED_NEW}.`, observedKnowledgeVersion: 1 }, knowledgeDeps);
    assert.equal(sup.status, "superseded", JSON.stringify(sup));
    await ratify(bobCtx, await create(bobCtx, "refunds.ratified", BOB_RATIFIED));

    /* ── B. the ratified resolver alone ────────────────────────────────────────────────────── */
    {
      const outcome = await resolveRatifiedKnowledgeEvidence(aliceCtx, "refund policy", { now: () => NOW });
      const served = JSON.stringify(outcome);
      assert.ok(served.includes(RATIFIED), "the Governance-ratified version is served");
      for (const m of ALL_ALICE_UNSERVABLE) assert.ok(!served.includes(m), `${m} is not served, not even as a key`);
      assert.ok(!served.includes("refunds.draft") && !served.includes("refunds.rejected"), "dropped versions leave no key behind");

      const bobOutcome = JSON.stringify(await resolveRatifiedKnowledgeEvidence(bobCtx, "refund policy", { now: () => NOW }));
      assert.ok(bobOutcome.includes(BOB_RATIFIED) && !bobOutcome.includes(RATIFIED), "each tenant sees only its own Knowledge");

      /* A row claiming a ratification Governance does not hold is not ratified. */
      const forged = await create(aliceCtx, "refunds.forged", "MARK-FORGED-CLAIM");
      /* WRONG SUBJECT: the forged row claims the genuine ratify decision of ANOTHER version. */
      const genuine = (await setup.query<{ d: string }>("select ratification_decision_id::text d from knowledge_nodes where statement like $1", [`%${RATIFIED}%`])).rows[0]!.d;
      const forge = await setup.query("update knowledge_nodes set ratification_decision_id = $1 where id = $2", [genuine, forged.nodeId]);
      assert.equal(forge.rowCount, 1, "the forged claim is really in the row");
      assert.ok(JSON.stringify(await knowledgeRepo.listFacts({ tenantId: alice.tenantId }, NOW)).includes("MARK-FORGED-CLAIM"), "the forged row is active");
      const afterForge = JSON.stringify(await resolveRatifiedKnowledgeEvidence(aliceCtx, "refund policy", { now: () => NOW }));
      assert.ok(!afterForge.includes("MARK-FORGED-CLAIM"), "a claim Governance does not hold is not ratified");

      /* A RATIFIED version Governance has since rejected is not served: rejection stands on its own. */
      const ratifiedNode = (await setup.query<{ id: string }>("select id from knowledge_nodes where statement like $1", [`%${RATIFIED}%`])).rows[0]!.id;
      const rejectedAfter = JSON.stringify(
        await resolveRatifiedKnowledgeEvidence(aliceCtx, "refund policy", { now: () => NOW, readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: new Set([ratifiedNode]) }) } as never),
      );
      assert.ok(!rejectedAfter.includes(RATIFIED), "a rejected version is not served even when ratified");

      /* Missing authority: a ratification read that cannot be answered serves NOTHING. */
      const blind = JSON.stringify(
        await resolveRatifiedKnowledgeEvidence(aliceCtx, "refund policy", { now: () => NOW, readRatificationDecisions: async () => ({ status: "unavailable" }) }),
      );
      assert.ok(!blind.includes(RATIFIED), "ratification unavailable → no Knowledge at all");
      const noRejectionRead = JSON.stringify(
        await resolveRatifiedKnowledgeEvidence(aliceCtx, "refund policy", { now: () => NOW, readRejectedKnowledgeVersions: async () => ({ status: "unavailable", reason: "read-failed" }) } as never),
      );
      assert.ok(!noRejectionRead.includes(RATIFIED), "rejection unavailable → no Knowledge at all");
    }

    /* ── the real answer flow on /heby ─────────────────────────────────────────────────────── */
    async function ask(ctx: TenantContext, prompt: string, authority: Authority, conversationId?: string, dropProjector = false) {
      const bodies: string[] = [];
      const fetchImpl: FetchLike = async (_url, init) => {
        bodies.push(String(init.body));
        return { ok: true, status: 200, json: async () => OK };
      };
      let declared: ExternalAiDisclosureDeclaration | null = null;
      const result = await answerHebyModelRequest(
        { prompt, route: "/heby", conversationId },
        {
          resolveTenant: async () => ctx,
          readOverview: () => undefined,
          resolveDirectorEnabled: async () => true,
          env: ENV,
          knowledge: { now: () => NOW },
          selectTransport: () => ({
            transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(99), fetchImpl }),
            transportProvenance: "live",
          }),
          generate: (request, generationDeps) =>
            generateHebyModelAnswer(request, {
              ...generationDeps,
              ...(dropProjector ? { projectAuthorizedEvidence: undefined } : {}),
              resolveOperatorEnabled: async () => true,
              authorizeDisclosure: async (d, o, m) => {
                declared = d;
                return gate(authority)(d, o, m);
              },
              /* The REAL APF-5 writer, so the legibility read below reads what the gate actually recorded. */
              recordDisclosure: (e) => recordExternalAiDisclosureDecision(e, { getDb: () => handle.db }),
              admitDispatch: admittedDispatch,
            }),
        },
      );
      return { result, bodies, wire: bodies.join("\n"), declared: declared as ExternalAiDisclosureDeclaration | null };
    }

    /* C1. Authorized for Knowledge: the ratified version reaches the model, nothing else does. */
    const first = await ask(aliceCtx, `What is our refund policy? ${ALICE_PRIVATE}`, { scopes: ASSISTANCE_ALL });
    assert.equal(first.bodies.length, 1, "one request reaches the network seam");
    assert.ok(first.wire.includes(RATIFIED), "the ratified Knowledge reaches the model");
    for (const m of ALL_ALICE_UNSERVABLE) assert.ok(!first.wire.includes(m), `${m} never reaches the provider`);
    assert.deepEqual(first.declared?.optionalDataClasses, ["knowledge"], "Knowledge is declared OPTIONAL");
    assert.ok(!first.declared!.dataClasses.includes("knowledge"), "…and never required");
    assert.equal(first.result.status, "answered");
    if (first.result.status !== "answered") throw new Error("unreachable");
    assert.equal(first.result.outcome.response.origin, "model", "a model answer was served");
    const aliceConversation = first.result.persistence.durable ? first.result.persistence.conversationId : "";
    assert.ok(aliceConversation, "the exchange is durable");

    /* Evidence survives reload, and it is the ratified version only. */
    const reload = await loadHebyConversation({ conversationId: aliceConversation }, { resolveTenant: async () => aliceCtx });
    assert.equal(reload.status, "loaded");
    if (reload.status !== "loaded") throw new Error("unreachable");
    const replayed = JSON.stringify(reload.view.messages.map((m) => m.knowledgeEvidence));
    assert.ok(replayed.includes(RATIFIED), "the evidence replays after reload");
    for (const m of ALL_ALICE_UNSERVABLE) assert.ok(!replayed.includes(m), `reloaded evidence carries no ${m}`);

    /* C2. Conversation-only: the model still answers; Knowledge is withheld from it. */
    const convOnly = await ask(aliceCtx, "What is our refund policy?", { scopes: CONVERSATION_ONLY });
    assert.equal(convOnly.bodies.length, 1, "a conversation-only tenant keeps its model answer");
    assert.ok(!convOnly.wire.includes(RATIFIED), "Knowledge is withheld from the provider");
    assert.match(convOnly.wire, /\[knowledge\] withheld — not disclosed to the external model/);
    if (convOnly.result.status !== "answered") throw new Error("unreachable");
    assert.equal(convOnly.result.outcome.response.origin, "model");

    /* C2'. FAIL-SAFE: a caller that drops the projector sends the base request, Knowledge withheld. */
    const noProjector = await ask(aliceCtx, "What is our refund policy?", { scopes: ASSISTANCE_ALL }, undefined, true);
    assert.equal(noProjector.bodies.length, 1);
    assert.ok(!noProjector.wire.includes(RATIFIED), "without the projector, optional Knowledge never reaches the provider");

    /* C3. No authorization, and every missing authority: nothing is sent. */
    for (const authority of [{ scopes: null }, "attestation-unavailable", "tenant-unavailable"] as const) {
      const refused = await ask(aliceCtx, "What is our refund policy?", authority);
      assert.equal(refused.bodies.length, 0, `${JSON.stringify(authority)}: nothing reaches the provider`);
      if (refused.result.status !== "answered") throw new Error("unreachable");
      assert.notEqual(refused.result.outcome.response.origin, "model", `${JSON.stringify(authority)}: the answer is deterministic`);
    }

    /* B'. Another tenant's /heby never carries Acme's Knowledge. */
    const bobAsk = await ask(bobCtx, "What is our refund policy?", { scopes: ASSISTANCE_ALL });
    assert.ok(bobAsk.wire.includes(BOB_RATIFIED) && !bobAsk.wire.includes(RATIFIED), "cross-tenant Knowledge cannot leak");

    const conversations = createDurableConversationRepository(handle.db);
    const aliceScope = { tenantId: alice.tenantId, actorId: alice.userId };
    /* ── LEGIBILITY: what the model received, read back from the recorded decision ───────────── */
    {
      const lastHeby = (view: { messages: readonly { role: string; modelDisclosure?: unknown }[] }) =>
        [...view.messages].reverse().find((m) => m.role !== "user")!;
      const load = async (ctx: TenantContext, id: string) => {
        const r = await loadHebyConversation({ conversationId: id }, { resolveTenant: async () => ctx });
        if (r.status !== "loaded") throw new Error(`expected loaded, got ${r.status}`);
        return r.view;
      };

      /* Knowledge authorized: the reloaded answer says the model received Knowledge, nothing withheld. */
      const full = lastHeby(await load(aliceCtx, aliceConversation));
      assert.deepEqual(full.modelDisclosure, { status: "recorded", disclosed: ["conversation", "knowledge"], withheld: [] });

      /* Conversation-only: the model received the conversation; Knowledge is named as withheld. */
      if (!convOnly.result.persistence.durable) throw new Error("unreachable");
      const convView = await load(aliceCtx, convOnly.result.persistence.conversationId);
      const conv = lastHeby(convView);
      assert.deepEqual(conv.modelDisclosure, { status: "recorded", disclosed: ["conversation"], withheld: ["knowledge"] });
      assert.ok(JSON.stringify(convView).includes(RATIFIED), "the HUMAN still sees the ratified Knowledge evidence");

      /* Refused: no invocation is stored, and the turn says exactly that. */
      const refusedTurn = await ask(aliceCtx, "What is our refund policy?", { scopes: null });
      if (refusedTurn.result.status !== "answered" || !refusedTurn.result.persistence.durable) throw new Error("unreachable");
      assert.deepEqual(lastHeby(await load(aliceCtx, refusedTurn.result.persistence.conversationId)).modelDisclosure, { status: "no-invocation-recorded" });

      /* Missing metadata: an invocation with no decision record, and an unreadable record → unavailable. */
      await conversations.appendMessage(aliceScope, {
        conversationId: aliceConversation, role: "assistant", content: "orphan", origin: "model",
        transport: "fake", correlationId: "no-such-decision",
      });
      assert.deepEqual(lastHeby(await load(aliceCtx, aliceConversation)).modelDisclosure, { status: "unavailable" });
      const blind = await loadHebyConversation(
        { conversationId: convOnly.result.persistence.conversationId },
        { resolveTenant: async () => aliceCtx, readDisclosureDecisions: async () => ({ status: "unavailable" }) },
      );
      if (blind.status !== "loaded") throw new Error("unreachable");
      assert.deepEqual(lastHeby(blind.view).modelDisclosure, { status: "unavailable" }, "an unreadable record is never guessed");

      /* The decision read is tenant-scoped: Globex cannot read Acme's decision by its correlation. */
      const aliceCorrelations = (await conversations.listConversationMessages(aliceScope, aliceConversation)).flatMap((m) => (m.correlationId ? [m.correlationId] : []));
      const crossTenant = await readExternalAiDisclosureDecisions(bob.tenantId, aliceCorrelations, { getDb: () => handle.db });
      assert.equal(crossTenant.status, "read");
      if (crossTenant.status === "read") assert.equal(crossTenant.byCorrelation.size, 0, "another tenant reads no decision");

      /*
       * No authorization, attestation, account or credential reaches the conversation view, and the
       * disclosure field carries exactly three keys. (The message's own `model` provenance is a
       * released R2D field, not part of this disclosure.)
       */
      assert.deepEqual(Object.keys(conv.modelDisclosure as object).sort(), ["disclosed", "status", "withheld"]);
      const serialized = JSON.stringify(convView);
      for (const leak of ["ffb0c160", "org-test-account", "authorizationId", "attestationId", "sk-fake"]) {
        assert.ok(!serialized.includes(leak), `the view carries no ${leak}`);
      }
    }

    /* ── A. ownership ──────────────────────────────────────────────────────────────────────── */
    const threadLength = async () => (await conversations.listConversationMessages(aliceScope, aliceConversation)).length;
    const before = await threadLength();
    assert.ok(before >= 2);

    for (const [who, ctx] of [["same-tenant member", carolCtx], ["other tenant", bobCtx]] as const) {
      const loaded = await loadHebyConversation({ conversationId: aliceConversation }, { resolveTenant: async () => ctx });
      assert.equal(loaded.status, "not-found", `${who}: cannot load the thread`);
      const scope = { tenantId: ctx.tenantId, actorId: ctx.userId };
      assert.equal(await conversations.getConversation(scope, aliceConversation), undefined, `${who}: getConversation`);
      assert.deepEqual(await conversations.listConversationMessages(scope, aliceConversation), [], `${who}: list`);
      await assert.rejects(
        conversations.appendMessage(scope, { conversationId: aliceConversation, role: "user", content: "x", origin: "user" }),
        /Conversation not found/,
        `${who}: append`,
      );
    }

    /* Shared browser: Carol's tab still holds Alice's pointer. It neither reads nor continues it. */
    const shared = await ask(carolCtx, "And what about returns?", { scopes: ASSISTANCE_ALL }, aliceConversation);
    assert.equal(shared.bodies.length, 1);
    assert.ok(!shared.wire.includes(ALICE_PRIVATE), "Alice's history never enters Carol's request");
    if (shared.result.status !== "answered" || !shared.result.persistence.durable) throw new Error("unreachable");
    assert.notEqual(shared.result.persistence.conversationId, aliceConversation, "a stale pointer starts a fresh thread");
    assert.equal(await threadLength(), before, "Alice's thread is unchanged");
    const carolLoad = await loadHebyConversation({ conversationId: shared.result.persistence.conversationId }, { resolveTenant: async () => carolCtx });
    assert.equal(carolLoad.status, "loaded", "Carol's own thread is hers");

    /* The owner's legitimate flow: continuing her own thread carries her history. */
    const cont = await ask(aliceCtx, "Thanks — anything else?", { scopes: ASSISTANCE_ALL }, aliceConversation);
    assert.ok(cont.wire.includes(ALICE_PRIVATE), "the owner continues her own thread with its history");
    if (cont.result.status !== "answered" || !cont.result.persistence.durable) throw new Error("unreachable");
    assert.equal(cont.result.persistence.conversationId, aliceConversation);

    /* Legacy: a conversation with no recorded owner is reachable by nobody. */
    const legacy = await setup.query<{ id: string }>("insert into conversations (tenant_id, subject) values ($1, 'legacy') returning id", [alice.tenantId]);
    assert.equal(
      (await loadHebyConversation({ conversationId: legacy.rows[0]!.id }, { resolveTenant: async () => aliceCtx })).status,
      "not-found",
      "a legacy ownerless conversation fails closed",
    );

    /* No actor: refused, never "any member". */
    await assert.rejects(conversations.getConversation({ tenantId: alice.tenantId }, aliceConversation), ConversationScopeError);
    await assert.rejects(conversations.listConversationMessages({ tenantId: alice.tenantId }, aliceConversation), ConversationScopeError);

    assert.equal(strayNetwork, 0, "no code reached the real network");
    console.log("PASS heby-grounded-conversation-1 grounded-conversation-postgres");
  } finally {
    globalThis.fetch = realFetch;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
