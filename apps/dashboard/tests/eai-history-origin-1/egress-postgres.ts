/*
 * EAI-HISTORY-ORIGIN-1 — THE PROVIDER-FACING PAYLOAD, against a REAL but DISPOSABLE PostgreSQL database.
 *
 * Drives the REAL answer flow (`answerHebyModelRequest`) over the REAL durable conversation repository,
 * the REAL generator, the REAL three-authority EAI gate and the REAL Anthropic HTTP transport with a
 * capturing fetch. What is asserted is the JSON body the transport hands to fetch — the bytes that
 * would leave Hebun — not a helper's return value.
 *
 *   A. A persisted deterministic answer's canary never reaches the payload; the marker does.
 *   B. A legacy assistant row (origin NULL) is withheld.
 *   C. An unknown origin is withheld.
 *   D. A user turn's canary reaches the payload as typed.
 *   E. A model answer reaches the payload (continuity).
 *   F. A mixed-source deterministic answer is withheld whole.
 *   G. Another tenant's conversation id yields no history from it.
 *   H. An unauthorized tenant is refused before fetch — the gate still decides.
 *   I. The kill-switch off yields zero fetches (and a real deterministic row, withheld next turn).
 *   J. The model answer that travels is identity-minimized.
 *   K. Count bound: at most MAX_HISTORY_MESSAGES prior turns reach the payload.
 *   L. The payload's messages carry only role and content; no `origin` anywhere in the body; the
 *      declaration is unchanged (conversation first, nothing new); the marker is not instruction.
 *
 * No production, no provider, no credential: the fetch is local and returns a canned body.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import {
  CONFIGURED_ANTHROPIC_ACCOUNT_REF,
  authorizeExternalAiDisclosure,
  type ExternalAiDisclosureDeclaration,
} from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { DataClass } from "../../src/features/external-ai-data-use/contracts";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { recordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { MAX_HISTORY_MESSAGES } from "../../src/features/heby-answer/bounded-history";
import { MODEL_WITHHELD_ADDRESS, MODEL_WITHHELD_HISTORY_ANSWER } from "../../src/features/heby-answer/model-facing-projection";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const JUSTIFICATION = "This test organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed assistant processor.";
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-haiku-4-5-20251001",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const OK = { id: "msg_eho1", model: "claude-test-model", content: [{ type: "text", text: "Noted." }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
const ASSISTANCE: readonly DataClass[] = ["conversation", "knowledge", "work-artifact"];
const MARK = MODEL_WITHHELD_HISTORY_ANSWER;
const PERSON = "66666666-6666-4666-8666-666666666666";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}
interface Payload {
  readonly system: unknown;
  readonly messages: readonly { readonly role: string; readonly content: unknown }[];
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
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
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
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

/** The text of one payload message, whatever block shape the transport used. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  const RECORD = parsed.record;
  assert.equal(RECORD.accountRef, CONFIGURED_ANTHROPIC_ACCOUNT_REF);

  const harness = createDisposablePostgresHarness("hebun_eai_history_origin_1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };
  const repo = createDurableConversationRepository(handle.db);

  /* The network seam: every body the live transport would send, in order. */
  const sent: Payload[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    sent.push(JSON.parse(init.body) as Payload);
    return { ok: true, status: 200, json: async () => OK };
  };
  const declarations: ExternalAiDisclosureDeclaration[] = [];

  async function ask(
    tenant: TenantContext,
    prompt: string,
    conversationId: string | undefined,
    options: { directorEnabled?: boolean } = {},
  ) {
    return answerHebyModelRequest(
      { prompt, route: "/heby", ...(conversationId ? { conversationId } : {}) },
      {
        resolveTenant: async () => tenant,
        readOverview: () => undefined,
        env: ENV,
        getConversationRepo: () => repo,
        resolveDirectorEnabled: async () => options.directorEnabled ?? true,
        /* A fresh live transport per request, as production selects one per request. */
        selectTransport: () => ({
          transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(99), fetchImpl }),
          transportProvenance: "live",
        }),
        /* The REAL generator; only its authority reads are pointed at the disposable database. */
        generate: (request, genDeps) => {
          if (genDeps?.disclosure) declarations.push(genDeps.disclosure);
          return generateHebyModelAnswer(request, {
            ...genDeps,
            resolveOperatorEnabled: async () => true,
            authorizeDisclosure: (d, o, m) => authorizeExternalAiDisclosure(d, o, m, deps),
            recordDisclosure: (e) => recordExternalAiDisclosureDecision(e, deps),
          });
        },
      },
    );
  }
  const durableId = (result: Awaited<ReturnType<typeof ask>>): string => {
    const persistence = (result as { persistence?: { durable: boolean; conversationId?: string } }).persistence;
    assert.ok(persistence?.durable && persistence.conversationId, "the exchange was persisted durably");
    return persistence.conversationId!;
  };
  async function setOrigin(conversationId: string, content: string, origin: string | null): Promise<void> {
    const r = await setup.query(`update messages set origin = $3 where conversation_id = $1 and content = $2`, [conversationId, content, origin]);
    assert.equal(r.rowCount, 1);
  }

  try {
    /* ═══ SEED: hebun and alpha authorized for assistance; trh never ════════════════════════════ */
    const seeded: Record<string, Seeded> = {};
    const tenants: Record<string, TenantContext> = {};
    for (const [slug, tag] of [["hebun", "aaaa1"], ["alpha", "dddd4"], ["turkish-rug-house", "bbbb2"]] as const) {
      const s = await seedLocalIdentity(setup, { companyName: slug, companySlug: `${slug}-eho1`, email: `${slug}@eho1.test`, roleType: "owner" });
      const t = contextFor(s, await sessionRowFor(setup, s, tag), `eho1-${slug}`);
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, t.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(t, { justification: `Establishing ${slug} Governance for this fixture.` }, deps)).status, "established");
      seeded[slug] = s;
      tenants[slug] = t;
    }
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: RECORD, reviewedRecordRef: `${REVIEWED_RECORD}@${"1".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    for (const slug of ["hebun", "alpha"]) {
      const written = await authorizeTenantExternalAiDataUse(
        tenants[slug]!,
        { attestationId, scopes: ASSISTANCE.map((dataClass) => ({ purpose: "assistance" as const, dataClass })), justification: JUSTIFICATION, observedRevision: null },
        deps,
      );
      assert.equal(written.status, "written");
    }

    const HEBUN = tenants["hebun"]!;
    const hebunScope = { tenantId: seeded["hebun"]!.tenantId, actorId: seeded["hebun"]!.userId };

    /* ═══ I. Kill-switch off: zero fetches, and a REAL deterministic row is persisted ═══════════ */
    const first = await ask(HEBUN, "What is happening in operations?", undefined, { directorEnabled: false });
    assert.equal(sent.length, 0, "the kill-switch dispatches nothing");
    const conv1 = durableId(first);
    /* Read through the repository's own ordering (a turn's pair shares one timestamp — HCC-1). */
    const rows1 = await repo.listConversationMessages(hebunScope, conv1);
    assert.deepEqual(rows1.map((r) => [r.role, r.origin]), [["user", "user"], ["assistant", "deterministic"]]);
    const realDeterministic = rows1[1]!.content;

    /* Conversation 1, as it would stand after real use: six prior turns. */
    const append = (conversationId: string, role: "user" | "assistant", content: string, origin: "user" | "deterministic" | "model") =>
      repo.appendMessage(hebunScope, { conversationId, role, content, origin });
    await append(conv1, "user", "Tell me about CANARY-USER-D please.", "user");
    await append(conv1, "assistant", `Ayşe (${PERSON}) handles it; reach ops.lead@acme.example. CANARY-MODEL-E`, "model");
    await append(conv1, "user", "And the people side?", "user");
    await append(conv1, "assistant", "Connected sources:\nDraft “Spring” — excerpt CANARY-MIX-DISCLOSABLE-F\nAyşe Yılmaz — people CANARY-MIX-WITHHELD-F", "deterministic");

    /* ═══ A + D + E + F + J + K + L: the next model turn's payload ══════════════════════════════ */
    await ask(HEBUN, "Summarize what we discussed.", conv1);
    assert.equal(sent.length, 1, "hebun is authorized: exactly one dispatch");
    const p1 = sent[0]!;
    const body1 = JSON.stringify(p1);
    for (const canary of ["CANARY-MIX-DISCLOSABLE-F", "CANARY-MIX-WITHHELD-F", "Ayşe Yılmaz — people"]) {
      assert.ok(!body1.includes(canary), `F: ${canary} never leaves`);
    }
    assert.ok(!body1.includes(realDeterministic), "A/I: the real deterministic answer never leaves");
    assert.ok(body1.includes("CANARY-USER-D"), "D: the human's words leave as typed");
    assert.ok(body1.includes("CANARY-MODEL-E"), "E: the model answer leaves (continuity)");
    assert.ok(!body1.includes(PERSON) && !body1.includes("ops.lead@acme.example") && body1.includes(MODEL_WITHHELD_ADDRESS), "J: the model answer is minimized");
    const history1 = p1.messages.slice(0, -1);
    assert.equal(history1.length, MAX_HISTORY_MESSAGES, "K: the count bound holds");
    assert.deepEqual(history1.map((m) => m.role), ["user", "assistant", "user", "assistant", "user", "assistant"]);
    assert.deepEqual(
      history1.filter((m) => m.role === "assistant").map((m) => textOf(m.content)),
      [MARK, `Ayşe handles it; reach ${MODEL_WITHHELD_ADDRESS}. CANARY-MODEL-E`, MARK],
      "A/F: both deterministic answers are the marker; the model answer travels",
    );
    for (const m of p1.messages) assert.deepEqual(Object.keys(m).sort(), ["content", "role"], "L: role and content only");
    assert.ok(!body1.includes('"origin"'), "L: persisted provenance never reaches the provider");
    assert.ok(!JSON.stringify(p1.system).includes(MARK), "L: the marker is history data, never instruction");
    assert.equal(declarations.at(-1)!.purpose, "assistance");
    assert.equal(declarations.at(-1)!.dataClasses[0], "conversation", "L: the declaration is unchanged — conversation first");
    assert.ok(declarations.at(-1)!.dataClasses.every((c) => ASSISTANCE.includes(c)), "L: no class was added");

    /* ═══ B + C: legacy NULL and unknown origins ════════════════════════════════════════════════ */
    const second = await ask(HEBUN, "Status check.", undefined, { directorEnabled: false });
    const conv2 = durableId(second);
    const legacy = (await setup.query<{ content: string }>(`select content from messages where conversation_id = $1 and role = 'assistant'`, [conv2])).rows[0]!.content;
    await setOrigin(conv2, legacy, null);
    await append(conv2, "user", "Next?", "user");
    await append(conv2, "assistant", "CANARY-UNKNOWN-C from somewhere", "model");
    await setOrigin(conv2, "CANARY-UNKNOWN-C from somewhere", "bogus");
    await ask(HEBUN, "Go on.", conv2);
    assert.equal(sent.length, 2);
    const body2 = JSON.stringify(sent[1]);
    assert.ok(!body2.includes(legacy), "B: the legacy NULL-origin answer never leaves");
    assert.ok(!body2.includes("CANARY-UNKNOWN-C"), "C: an unknown origin never leaves");
    assert.deepEqual(
      sent[1]!.messages.filter((m) => m.role === "assistant").map((m) => textOf(m.content)),
      [MARK, MARK],
      "B/C: both are the marker",
    );

    /* ═══ G: another tenant naming hebun's conversation gets none of it ═════════════════════════ */
    await ask(tenants["alpha"]!, "What did we discuss?", conv1);
    assert.equal(sent.length, 3);
    const body3 = JSON.stringify(sent[2]);
    for (const canary of ["CANARY-USER-D", "CANARY-MODEL-E", "CANARY-MIX", "Summarize what we discussed."]) {
      assert.ok(!body3.includes(canary), `G: ${canary} never crosses tenants`);
    }
    assert.equal(sent[2]!.messages.length, 1, "G: no prior turns at all — only the current prompt");

    /* ═══ H: the EAI gate still decides — an unauthorized tenant is refused before fetch ════════ */
    const before = sent.length;
    await ask(tenants["turkish-rug-house"]!, "Anything new?", undefined);
    assert.equal(sent.length, before, "H: trh holds no authorization — nothing reaches fetch");

    console.log("PASS eai-history-origin-1 egress-postgres");
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
