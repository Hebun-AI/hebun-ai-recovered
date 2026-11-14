/*
 * P5 BYOK slice 2 — tenant key routing (B4), data use (B6) and attribution (B7), against a disposable
 * PostgreSQL database with the slice's migration applied. Anthropic is simulated by a counting fetch
 * that records which key each request carried. No real provider call, no real key.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { revokeByokKey, saveByokKey } from "../../src/features/provider-anthropic/byok-key.server";
import {
  resolveTenantModelCredential,
  selectTenantModelTransport,
  tenantAnthropicAccountRef,
} from "../../src/features/provider-anthropic/model-credential.server";
import { anthropicCredentialOf } from "../../src/features/heby-model-live/claude-http-transport.server";
import { ModelConnectivityError, generateHebyModelAnswer } from "../../src/features/heby-model";
import { attestTenantAnthropicAccount } from "../../src/features/external-ai-data-use/attest-tenant-anthropic-account.server";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { authorizeExternalAiDisclosure } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { recordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { createDurableConversationRepository } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import type { ClaudeTransport } from "../../src/features/heby-model/claude-transport";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import { hebunInstruction } from "../../src/features/heby-runtime/instruction-channel";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const MODEL = "claude-haiku-4-5-20251001";
const PLATFORM_KEY = `sk-ant-api03-platform${randomBytes(16).toString("hex")}`;
const KEY_A = `sk-ant-api03-${randomBytes(24).toString("hex")}`;
const KEY_C = `sk-ant-api03-${randomBytes(24).toString("hex")}`;
const ENC = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};
const LIVE_ENV = {
  ...ENC,
  HEBUN_MODEL_TRANSPORT: "live",
  ANTHROPIC_API_KEY: PLATFORM_KEY,
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: MODEL,
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
  HEBUN_MODEL_CREDENTIAL: "present",
};
const JUSTIFICATION = "This test organization agrees that its conversations may be processed under its own Anthropic account.";
const OK = { id: "msg_byok", model: MODEL, content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 2 } };

interface Seeded { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string }

async function sessionRowFor(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(s: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
    membershipVersion: 1, roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1",
    mfaVerified: false, requestId, authenticatedAt: new Date().toISOString(),
  });
}

/* The shared per-process budget is not under test here; give this process room for its sends. */
process.env.HEBUN_MODEL_LIVE_CALL_BUDGET = "50";

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`reviewed record did not parse: ${parsed.reason}`);

  const harness = createDisposablePostgresHarness("hebun_p5_byok_routing");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;

  /* The simulated provider: records the key every request carried and answers as told. */
  const sent: string[] = [];
  let reply: "ok" | 401 | "network" = "ok";
  /*
   * EVERY fetch in this process is the simulation — installed globally so no path (platform or tenant,
   * default or injected) can reach the network.
   */
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get("x-api-key") ?? "");
    if (reply === "network") throw new Error("offline");
    if (reply === 401) return new Response(JSON.stringify({ error: { type: "authentication_error" } }), { status: 401 });
    return new Response(JSON.stringify(OK), { status: 200 });
  }) as typeof fetch;
  const probeFetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
  const offlineFetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  const deps = { getDb, env: ENC };
  const errors: string[] = [];
  const send = async (t: ClaudeTransport | undefined) => {
    try {
      await t!.send({ model: MODEL, system: "s", maxTokens: 10, messages: [{ role: "user", content: "hi" }] });
      return "sent";
    } catch (e) {
      errors.push(String((e as Error).message));
      return e instanceof ModelConnectivityError ? e.code : "other";
    }
  };
  let passed = 0;
  const ok = (label: string) => { passed++; console.log(`PASS ${label}`); };

  try {
    const tenants: TenantContext[] = [];
    for (const [slug, tag] of [["acme", "aaaa1"], ["globex", "bbbb2"], ["initech", "cccc3"]] as const) {
      const s = await seedLocalIdentity(setup, { companyName: slug, companySlug: `${slug}-byok`, email: `${slug}@byok.test`, roleType: "owner" });
      const t = contextFor(s, await sessionRowFor(setup, s, tag), `byok-${slug}`);
      await setup.query(
        `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
           accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, t.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(t, { justification: `Establishing ${slug} Governance for this fixture.` }, { getDb })).status, "established");
      tenants.push(t);
    }
    const [A, B, C] = tenants as [TenantContext, TenantContext, TenantContext];

    assert.equal(await saveByokKey(A, KEY_A, { getDb, env: ENC, fetchImpl: probeFetch }), "verified");
    assert.equal(await saveByokKey(C, KEY_C, { getDb, env: ENC, fetchImpl: offlineFetch }), "unverified");
    const aIntegration = (await setup.query(`select id from integrations where tenant_id=$1 and provider_key='anthropic'`, [A.tenantId])).rows[0].id as string;

    /* ── 5 · a tenant without BYOK keeps the platform key, exactly as before ── */
    assert.deepEqual(await resolveTenantModelCredential(B, deps), { kind: "platform" });
    const bSel = await selectTenantModelTransport(B, LIVE_ENV, deps);
    assert.equal(bSel.transportProvenance, "live");
    assert.deepEqual(anthropicCredentialOf(bSel.transport), { source: "platform" });
    const fakeSel = await selectTenantModelTransport(A, { HEBUN_MODEL_TRANSPORT: "fake" }, deps);
    assert.equal(fakeSel.transportProvenance, "fake", "fake mode is untouched by BYOK");
    assert.equal(anthropicCredentialOf(fakeSel.transport), null);
    ok("no BYOK: the platform transport, unchanged; fake mode unchanged");

    /* ── 2 · an active, verified BYOK key is selected and carries the call ── */
    const aSel = await selectTenantModelTransport(A, LIVE_ENV, deps);
    assert.deepEqual(anthropicCredentialOf(aSel.transport), { source: "tenant", integrationId: aIntegration, accountRef: tenantAnthropicAccountRef(aIntegration) });
    sent.length = 0;
    assert.equal(await send(aSel.transport), "sent");
    assert.deepEqual(sent, [KEY_A], "the tenant's key, and only it, went out");
    ok("verified BYOK: the tenant's key carries the call");

    /* ── 1 · tenant isolation ── */
    sent.length = 0;
    const bTransport = (await selectTenantModelTransport(B, LIVE_ENV, deps)).transport;
    assert.equal(await send(bTransport), "sent");
    assert.deepEqual(sent, [PLATFORM_KEY], "B never carries A's key");
    const aAttestation = await attestTenantAnthropicAccount(A, { training: "none", retentionClass: "bounded-30-days", zdr: "not-enabled", modelIds: [MODEL] }, { getDb });
    assert.equal(aAttestation.status, "attested");
    const aAttestationId = aAttestation.status === "attested" ? aAttestation.attestationId : "";
    const crossAuthorize = await authorizeTenantExternalAiDataUse(
      B,
      { attestationId: aAttestationId, scopes: [{ purpose: "assistance", dataClass: "conversation" }], justification: JUSTIFICATION, observedRevision: null },
      { getDb },
    );
    assert.deepEqual(crossAuthorize, { status: "refused", reason: "attestation-unknown" }, "B cannot authorize against A's own account");
    assert.deepEqual(await attestTenantAnthropicAccount(B, { training: "none", retentionClass: "bounded-30-days", zdr: "not-enabled", modelIds: [MODEL] }, { getDb }), { status: "refused", reason: "no-byok-connection" });
    ok("tenant isolation: B's calls never carry A's key; B cannot use A's attestation");

    /* ── 4 · no fallback: unverified, provider rejection, network failure ── */
    const cSel = await selectTenantModelTransport(C, LIVE_ENV, deps);
    assert.deepEqual(cSel, { byokRefusal: "byok-not-verified" }, "an unverified key yields no transport at all");
    sent.length = 0;
    reply = 401;
    assert.equal(await send((await selectTenantModelTransport(A, LIVE_ENV, deps)).transport), "authentication-failed");
    reply = "network";
    assert.equal(await send((await selectTenantModelTransport(A, LIVE_ENV, deps)).transport), "provider-unreachable");
    reply = "ok";
    assert.deepEqual(sent, [KEY_A, KEY_A], "each failure was one attempt with the tenant key, never retried with the platform key");
    ok("no fallback: unverified refuses before sending; a rejected or unreachable tenant key never moves to the platform key");

    /* ── 7 · data use: BYOK calls need the tenant's own attestation AND its authorization against it ── */
    assert.equal((await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: `${REVIEWED_RECORD}@${"1".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status, "appended");
    const platformAttestation = (await setup.query(`select id from processor_attestations where owner_tenant_id is null`)).rows[0].id as string;
    assert.equal((await authorizeTenantExternalAiDataUse(A, { attestationId: platformAttestation, scopes: [{ purpose: "assistance", dataClass: "conversation" }], justification: JUSTIFICATION, observedRevision: null }, { getDb })).status, "written");
    const generate = async (transport: ClaudeTransport | undefined, tenant: TenantContext) => {
      const before = sent.length;
      const request: ModelGenerationRequest = {
        correlationId: `byok-${sent.length}`, tenantId: tenant.tenantId, systemInstructions: hebunInstruction("sys"),
        userPrompt: "ping", evidence: [], modelId: "", maxOutputTokens: 0,
      };
      const outcome = await generateHebyModelAnswer(request, {
        env: LIVE_ENV,
        transport,
        disclosure: { tenantId: tenant.tenantId, actorUserId: tenant.userId, purpose: "assistance", dataClasses: ["conversation"] },
        resolveOperatorEnabled: async () => true,
        authorizeDisclosure: (d, o, m, a) => authorizeExternalAiDisclosure(d, o, m, { getDb }, a),
        recordDisclosure: (e) => recordExternalAiDisclosureDecision(e, { getDb }),
      });
      return { fetched: sent.length - before, state: outcome.status === "generated" ? "generated" : outcome.state };
    };
    const freshA = async () => (await selectTenantModelTransport(A, LIVE_ENV, deps)).transport;
    assert.deepEqual(await generate(await freshA(), A), { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" }, "the platform authorization does not cover A's own account");
    assert.equal((await authorizeTenantExternalAiDataUse(A, { attestationId: aAttestationId, scopes: [{ purpose: "assistance", dataClass: "conversation" }], justification: JUSTIFICATION, observedRevision: null }, { getDb })).status, "written");
    sent.length = 0;
    assert.deepEqual(await generate(await freshA(), A), { fetched: 1, state: "generated" });
    assert.deepEqual(sent, [KEY_A]);
    const evidence = (await setup.query(`select metadata from audit_log where action like 'external-ai.disclosure%' order by occurred_at desc limit 1`)).rows[0]?.metadata;
    assert.ok(JSON.stringify(evidence ?? {}).includes(tenantAnthropicAccountRef(aIntegration)), "the disclosure evidence names A's own account");
    assert.deepEqual(await generate((await selectTenantModelTransport(B, LIVE_ENV, deps)).transport, B), { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" }, "B, unauthorized, sends nothing");
    ok("data use: BYOK is refused until the tenant attests its own account and authorizes against it");

    /* ── 6 · attribution on the message row ── */
    const repo = createDurableConversationRepository(handle.db);
    const scopeA = { tenantId: A.tenantId, actorId: A.userId };
    const base = { role: "assistant" as const, content: "ok", origin: "model" as const, provider: "claude", model: MODEL, transport: "live" as const };
    const tenantRow = await repo.persistExchange(scopeA, { subject: "s", userContent: "q", assistant: { ...base, credentialSource: "tenant", credentialIntegrationId: aIntegration } });
    const platformRow = await repo.persistExchange({ tenantId: B.tenantId, actorId: B.userId }, { subject: "s", userContent: "q", assistant: { ...base, credentialSource: "platform" } });
    const rows = (await setup.query(`select id, tenant_id, credential_source, credential_integration_id from messages where id = any($1)`, [[tenantRow.assistantMessageId, platformRow.assistantMessageId]])).rows;
    assert.deepEqual(rows.find((r) => r.id === tenantRow.assistantMessageId), { id: tenantRow.assistantMessageId, tenant_id: A.tenantId, credential_source: "tenant", credential_integration_id: aIntegration });
    assert.deepEqual(rows.find((r) => r.id === platformRow.assistantMessageId), { id: platformRow.assistantMessageId, tenant_id: B.tenantId, credential_source: "platform", credential_integration_id: null });
    const conv = (await setup.query(`select conversation_id from messages where id=$1`, [tenantRow.assistantMessageId])).rows[0].conversation_id;
    const convB = (await setup.query(`select conversation_id from messages where id=$1`, [platformRow.assistantMessageId])).rows[0].conversation_id;
    const refuses = async (label: string, sql: string, params: unknown[]) =>
      assert.rejects(setup.query(sql, params), Error, label);
    const ins = `insert into messages (tenant_id, conversation_id, role, content, transport, credential_source, credential_integration_id) values ($1,$2,'assistant','x',$3,$4,$5)`;
    await refuses("tenant without connection", ins, [A.tenantId, conv, "live", "tenant", null]);
    await refuses("platform naming a connection", ins, [A.tenantId, conv, "live", "platform", aIntegration]);
    await refuses("a source without a live transport", ins, [A.tenantId, conv, "fake", "platform", null]);
    await refuses("B's row naming A's connection", ins, [B.tenantId, convB, "live", "tenant", aIntegration]);
    await refuses("an unknown source", ins, [A.tenantId, conv, "live", "someone", null]);
    ok("attribution: rows record platform vs tenant + connection; the database refuses any other shape");

    /* ── 3 · revocation: effective on the next call, even for a transport already built ── */
    const built = (await selectTenantModelTransport(A, LIVE_ENV, deps)).transport;
    assert.equal(await revokeByokKey(A, { getDb }), "revoked");
    sent.length = 0;
    assert.equal(await send(built), "missing-credential", "a revoked key refuses the call already selected");
    assert.deepEqual(sent, [], "nothing was sent, with any key");
    assert.deepEqual(await selectTenantModelTransport(A, LIVE_ENV, deps), { byokRefusal: "byok-key-revoked" });
    ok("revoked: refused at send and at selection; the platform key is never used");

    /* ── 8 · no key in any row, error or message ── */
    const tables = ["integration_credentials", "integrations", "audit_log", "messages", "processor_attestations", "tenant_ai_data_use_authorizations"];
    let dump = "";
    for (const t of tables) dump += JSON.stringify((await setup.query(`select * from ${t}`)).rows);
    for (const k of [KEY_A, KEY_C, PLATFORM_KEY]) {
      assert.ok(!dump.includes(k), "no key in any stored row");
      assert.ok(!errors.some((e) => e.includes(k)), "no key in any error");
    }
    ok("no key material in any row or error");

    console.log(`\nP5 BYOK routing: ${passed} checks passed`);
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
