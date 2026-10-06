/*
 * APF-5 — model ↔ attestation continuity and decision evidence, at the real egress seam.
 *
 * The real generator, the real live transport (injected fetch), the real three-authority gate and
 * the real audit writer, against a disposable database holding the reviewed B1B attestation and an
 * assistance authorization.
 *
 *   - the attested model passes, reaches the network once, and the model sent is the model checked;
 *   - any other model is refused `model-not-attested` before the network;
 *   - an unreadable attestation is refused before the network;
 *   - exactly one structured decision record per decision; no prompt, goal, evidence or credential;
 *   - an authorized decision whose record cannot be written is NOT sent;
 *   - a refusal stays a refusal when its record cannot be written.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import { authorizeExternalAiDisclosure } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import {
  EXTERNAL_AI_DISCLOSURE_AUTHORIZED,
  EXTERNAL_AI_DISCLOSURE_REFUSED,
  recordExternalAiDisclosureDecision,
  type RecordExternalAiDisclosureDecision,
} from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const ATTESTED = "claude-haiku-4-5-20251001";
const SECRET_PROMPT = "APF5-GOAL-Ayşe-refund-question";
const env = (model: string) => ({
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: model,
  HEBUN_MODEL_CREDENTIAL: "sk-fake-apf5",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
});
const METADATA_KEYS = [
  "accountRef",
  "authorizedDataClasses",
  "components",
  "declaredDataClasses",
  "disposition",
  "modelId",
  "processorAttestationId",
  "processorAttestationRevision",
  "purpose",
  "serviceScope",
  "tenantAuthorizationId",
  "tenantAuthorizationRevision",
];

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  assert.deepEqual(parsed.record.modelIds, [ATTESTED], "the reviewed record attests exactly the production model");

  const harness = createDisposablePostgresHarness("hebun_apf5_egress");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  let fetches = 0;
  let sentModel = "";
  const fetchImpl: FetchLike = async (_url, init) => {
    fetches += 1;
    sentModel = JSON.parse(String(init.body)).model;
    return { ok: true, status: 200, json: async () => ({ id: "msg_apf5", model: sentModel, content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  const auditRows = async () =>
    (
      await setup.query<{ action: string; result: string; correlation_id: string; actor_id: string; tenant_id: string; metadata: Record<string, unknown> }>(
        `select action, result, correlation_id, actor_id, tenant_id, metadata from audit_log where source = 'external-ai-data-use' order by recorded_at, id`,
      )
    ).rows;

  try {
    const s = await seedLocalIdentity(setup, { companyName: "Apf5", companySlug: "apf5-egress", email: "director@apf5.test", roleType: "owner" });
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour') returning id`,
        [s.authIdentityId, "a".repeat(64), s.userId, s.tenantId, s.membershipId],
      )
    ).rows[0]!.id;
    const ctx = asHumanTenantContext({
      tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId, membershipVersion: 1,
      roleId: s.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId: "apf5",
      authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [s.tenantId, s.authIdentityId, s.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: "Establishing Governance for the APF-5 fixture." }, deps)).status, "established");
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: `${REVIEWED_RECORD}@${"5".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    const written = await authorizeTenantExternalAiDataUse(
      ctx,
      {
        attestationId,
        scopes: (["conversation", "knowledge", "work-artifact"] as const).map((dataClass) => ({ purpose: "assistance" as const, dataClass })),
        justification: "This test organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed assistant processor.",
        observedRevision: null,
      },
      deps,
    );
    assert.equal(written.status, "written");
    const authorizationId = written.status === "written" ? written.authorizationId : "";

    const declaration = { tenantId: s.tenantId, actorUserId: s.userId, purpose: "assistance" as const, dataClasses: ["conversation" as const] };
    async function probe(
      model: string,
      correlationId: string,
      options: { unreadable?: boolean; record?: RecordExternalAiDisclosureDecision } = {},
    ): Promise<{ fetched: number; state: string }> {
      const before = fetches;
      const request: ModelGenerationRequest = {
        correlationId, tenantId: s.tenantId, systemInstructions: "sys", userPrompt: SECRET_PROMPT, evidence: ["Ayşe Yılmaz asked about a refund"], modelId: "", maxOutputTokens: 0,
      };
      const outcome = await generateHebyModelAnswer(request, {
        env: env(model),
        transport: createLiveClaudeTransport({ apiKey: "sk-fake-apf5", spendBudget: createLiveSpendBudget(99), fetchImpl }),
        disclosure: declaration,
        resolveOperatorEnabled: async () => true,
        authorizeDisclosure: (d, o, m) => authorizeExternalAiDisclosure(d, o, m, options.unreadable ? { getDb: () => null } : deps),
        recordDisclosure: options.record ?? ((e) => recordExternalAiDisclosureDecision(e, deps)),
      });
      return { fetched: fetches - before, state: outcome.status === "generated" ? "generated" : outcome.state };
    }

    /* ═══ 1. THE ATTESTED MODEL: one decision record, one network call, the same model sent ═══ */
    assert.deepEqual(await probe(ATTESTED, "apf5-attested"), { fetched: 1, state: "generated" }, "the attested model reaches the network exactly once");
    assert.equal(sentModel, ATTESTED, "the model sent is the model the attestation was checked against");
    let rows = await auditRows();
    assert.equal(rows.length, 1, "exactly one decision record");
    const authorized = rows[0]!;
    assert.equal(authorized.action, EXTERNAL_AI_DISCLOSURE_AUTHORIZED);
    assert.equal(authorized.result, "committed");
    assert.equal(authorized.correlation_id, "apf5-attested");
    assert.equal(authorized.actor_id, s.userId);
    assert.equal(authorized.tenant_id, s.tenantId);
    assert.deepEqual(Object.keys(authorized.metadata).sort(), METADATA_KEYS, "exactly the closed evidence shape");
    assert.equal(authorized.metadata.modelId, ATTESTED);
    assert.equal(authorized.metadata.purpose, "assistance");
    assert.deepEqual(authorized.metadata.declaredDataClasses, ["conversation"]);
    assert.equal(authorized.metadata.disposition, "authorized");
    assert.equal(authorized.metadata.processorAttestationId, attestationId);
    assert.equal(authorized.metadata.processorAttestationRevision, 1);
    assert.equal(authorized.metadata.tenantAuthorizationId, authorizationId);
    assert.equal(authorized.metadata.tenantAuthorizationRevision, 1);
    const serialized = JSON.stringify(authorized);
    for (const leak of [SECRET_PROMPT, "Ayşe", "refund", "sk-fake", "sys", "msg_apf5", "sent", "accepted"]) {
      assert.ok(!serialized.includes(leak), `the decision record carries no ${leak}`);
    }

    /* ═══ 2. ANY OTHER MODEL: refused before the network, and recorded as refused ═══════════════ */
    assert.deepEqual(await probe("claude-sonnet-unattested", "apf5-other"), { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" }, "a non-attested model is refused before the network");
    rows = await auditRows();
    assert.equal(rows.length, 2);
    assert.equal(rows[1]!.action, EXTERNAL_AI_DISCLOSURE_REFUSED);
    assert.equal(rows[1]!.result, "rejected");
    assert.equal(rows[1]!.metadata.disposition, "model-not-attested");
    assert.equal(rows[1]!.metadata.modelId, "claude-sonnet-unattested");
    assert.equal(rows[1]!.metadata.processorAttestationId, null, "a refusal names no authorization it did not grant");

    /* ═══ 3. THE ATTESTATION CANNOT BE READ: refused before the network ═════════════════════════ */
    assert.deepEqual(await probe(ATTESTED, "apf5-unreadable", { unreadable: true }), { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" }, "an unreadable attestation is refused before the network");
    assert.equal((await auditRows()).at(-1)!.metadata.disposition, "unavailable");

    /* ═══ 4. AUTHORIZED, BUT ITS RECORD CANNOT BE WRITTEN: not sent ═════════════════════════════ */
    assert.deepEqual(
      await probe(ATTESTED, "apf5-unrecorded", { record: async () => false }),
      { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" },
      "an authorized decision that cannot be recorded is not sent",
    );
    assert.deepEqual(
      await probe(ATTESTED, "apf5-throwing", { record: async () => { throw new Error("audit down"); } }),
      { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" },
      "an authorized decision whose record throws is not sent",
    );

    /* ═══ 5. A REFUSAL STAYS A REFUSAL WHEN ITS RECORD FAILS ════════════════════════════════════ */
    assert.deepEqual(
      await probe("claude-sonnet-unattested", "apf5-refusal-unrecorded", { record: async () => { throw new Error("audit down"); } }),
      { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" },
      "refusal stays refusal when its record fails",
    );

    assert.equal(fetches, 1, "only the one attested, recorded decision ever reached the network");
    console.log("PASS apf5-egress-continuity egress-continuity-postgres");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
