/*
 * APF-3 — the narrow Agent #1 origination path, end to end, against the REAL gate.
 *
 * One organization holds everything the wide path used to show the model: a recorded recipient, a
 * draft, a department and a stored provider observation. Each carries a marker. The released
 * origination seam runs with the real generator, the real live transport (injected fetch) and the
 * real three-authority gate, and the request the model WOULD receive is captured at the generator.
 *
 * Proven here:
 *   - the model-facing request carries the goal and the organization's structure, nothing else —
 *     no recipient, no draft, no observation, no supplement, no uuid;
 *   - the declaration is exactly what was rendered: agent-origination × {conversation, organization};
 *   - with that declaration not yet allowed, the call is refused BEFORE the network seam (0 fetches),
 *     and the invocation records `not-dispatched`, so nothing was spent and nothing was filed;
 *   - a supplied observation is refused outright, before any invocation exists.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { originateAgentAction } from "../../src/features/agent-origination/originate-action.server";
import { authorizeTenantExternalAiDataUse } from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import {
  CONFIGURED_ANTHROPIC_ACCOUNT_REF,
  authorizeExternalAiDisclosure,
  type ExternalAiDisclosureDeclaration,
} from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { appendProcessorAttestation, parseAttestationRecord } from "../../scripts/lib/processor-attestation";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test-model",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const GOAL = "Propose recording the floor reorganisation as organizational work.";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MARKERS_NEVER_SHOWN = ["MARKRECIPIENT", "MARKDRAFT", "MARKBODY", "recipientRef", "draftRef", "observationSlug", "youtube", "external-recipient/", "work-artifact/", "provider-observation/", "MARKSUPPLEMENT", "@apf3.test"];

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
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), seeded.userId, seeded.tenantId, seeded.membershipId],
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
    requestId: "apf3",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  assert.equal(parsed.record.accountRef, CONFIGURED_ANTHROPIC_ACCOUNT_REF);

  const harness = createDisposablePostgresHarness("hebun_apf3_narrow_origination");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const countOf = async (table: string): Promise<number> =>
    Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);

  let fetches = 0;
  const fetchImpl: FetchLike = async () => {
    fetches += 1;
    throw new Error("APF-3 stage 1: the network seam must not be reached");
  };
  const captured: { request: ModelGenerationRequest; disclosure: ExternalAiDisclosureDeclaration | undefined }[] = [];

  try {
    /* ═══ ONE ORGANIZATION WITH EVERYTHING THE WIDE PATH USED TO SHOW ═══════════════════════════ */
    const org = (await seedLocalIdentity(setup, { companyName: "Apf3", companySlug: "apf3-narrow", email: "director@apf3.test", roleType: "owner" })) as Seeded;
    const ctx = contextFor(org, await sessionRowFor(setup, org, "apf3a"));
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, ctx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: "Establishing Governance for the APF-3 fixture." }, deps)).status, "established");
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby" }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, org, agentId, deps, { tag: "apf3" });

    const recipient = await createExternalRecipient(ctx, { displayName: "MARKRECIPIENT Ayşe", endpointKind: "email", endpointValue: "ayse@apf3.test" }, deps);
    assert.equal(recipient.status, "created");
    const recipientRef = recipient.status === "created" ? recipient.recipient.recordRef : "";
    const draft = await createWorkArtifact(ctx, { artifactType: "message-draft", title: "MARKDRAFT summary", content: "MARKBODY" }, "operations", deps);
    assert.equal(draft.status, "created");
    const draftRef = draft.status === "created" ? draft.ref : "";
    const dept = await recordDepartment(ctx, { name: "MARKDEPT Floor", slug: "mark-floor" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentId = dept.status === "recorded" ? dept.department.departmentId : "";
    const integration = (
      await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health, scopes, created_by, created_by_type)
         values ($1,'youtube','YouTube','connected','connected','healthy','[]'::jsonb,$2,'human') returning id`,
        [org.tenantId, org.userId],
      )
    ).rows[0]!.id;
    await setup.query(
      `insert into provider_observations (tenant_id, integration_id, provider_key, capability_key, subject_kind, subject_ref,
           observed_at, observed_by_actor_type, observed_by_actor_id, facts, facts_digest)
       values ($1,$2,'youtube','youtube.channel.public.read','youtube-channel','youtube/channel/UC_X', now(),'human',$3,'{}'::jsonb,$4)`,
      [org.tenantId, integration, org.userId, "a".repeat(64)],
    );

    /* The released attestation is admitted and the tenant authorized for ASSISTANCE only — prod's shape. */
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: parsed.record, reviewedRecordRef: `${REVIEWED_RECORD}@${"1".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    assert.equal(
      (
        await authorizeTenantExternalAiDataUse(
          ctx,
          {
            attestationId,
            scopes: (["conversation", "knowledge", "work-artifact"] as const).map((dataClass) => ({ purpose: "assistance" as const, dataClass })),
            justification: "This test organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed assistant processor.",
            observedRevision: null,
          },
          deps,
        )
      ).status,
      "written",
    );

    const originationDeps = (extra: Record<string, unknown> = {}) =>
      ({
        resolveTenant: async () => ctx,
        env: ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: () => ({
          transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(9), fetchImpl }),
          transportProvenance: "live",
        }),
        generate: async (request: ModelGenerationRequest, generationDeps: Parameters<typeof generateHebyModelAnswer>[1] = {}) => {
          captured.push({ request, disclosure: generationDeps.disclosure });
          return generateHebyModelAnswer(request, {
            ...generationDeps,
            resolveOperatorEnabled: async () => true,
            authorizeDisclosure: (d, o) => authorizeExternalAiDisclosure(d, o, deps),
          });
        },
        agentIdentity: deps,
        candidates: { recipients: deps, artifacts: deps, organization: deps, observations: deps },
        proposal: deps,
        recordWork: deps,
        provenance: deps,
        ...extra,
      }) as never;

    const requestsBefore = await countOf("heby_action_requests");
    const permitsBefore = await countOf("action_permits");

    /* ═══ 1. THE NARROW PROJECTION, AND ITS DECLARATION ═══════════════════════════════════════════ */
    const refused = await originateAgentAction({ goal: GOAL }, originationDeps());
    assert.deepEqual(refused, { status: "refused", reason: "model-unavailable" }, "not yet allowed: refused");
    assert.equal(captured.length, 1, "the generator was asked exactly once");
    const { request, disclosure } = captured[0]!;
    assert.deepEqual(
      disclosure,
      { tenantId: org.tenantId, purpose: "agent-origination", dataClasses: ["conversation", "organization"] },
      "the declaration is exactly what was rendered: conversation + organization",
    );
    assert.equal(request.userPrompt, GOAL, "the goal is the only conversation content");
    assert.equal(request.history, undefined, "no prior conversation");
    assert.equal(request.tenantId, undefined, "no tenant id in the request");
    const shown = [request.systemInstructions, ...request.evidence, request.userPrompt].join("\n");
    assert.equal(UUID.test(request.evidence.join("\n")), false, "no uuid in the rendered evidence");
    assert.equal(UUID.test(shown), false, "no uuid anywhere the model reads");
    assert.equal(shown.includes(departmentId), false, "the department's id never reaches the model");
    for (const marker of MARKERS_NEVER_SHOWN) {
      assert.equal(request.evidence.join("\n").includes(marker), false, `the evidence carries no ${marker}`);
    }
    assert.ok(request.evidence.some((line) => line.includes("departmentSlug=mark-floor name=MARKDEPT Floor")), "the department IS offered");
    assert.ok(request.evidence.some((line) => line.includes("organization-level is available")), "organization-level IS offered");

    /*
     * Which authority refused, read from the gate itself: before the APF-3 ALLOW the platform cell is
     * unknown; after it, the platform allows and the TENANT (authorized for assistance only) refuses.
     */
    const gate = await authorizeExternalAiDisclosure(disclosure!, true, deps);
    assert.ok(
      (gate.disposition === "platform-unknown" && gate.components.platform === "unknown") ||
        (gate.disposition === "tenant-not-authorized" && gate.components.platform === "allowed" && gate.components.tenant === "active"),
      `refused by the platform cell or by the tenant, never authorized (${JSON.stringify(gate)})`,
    );
    console.log(`  gate: ${gate.disposition} (platform ${gate.components.platform}, tenant ${gate.components.tenant})`);

    /* ═══ 2. REFUSED BEFORE THE NETWORK, AND NOTHING FILED ═══════════════════════════════════════ */
    assert.equal(fetches, 0, "fetch count = 0");
    const invocation = (await setup.query(`select state, failure_code, filing_outcome from heby_origination_invocations`)).rows;
    assert.deepEqual(invocation, [{ state: "not-dispatched", failure_code: "DATA_USE_NOT_AUTHORIZED", filing_outcome: "not-attempted" }]);
    assert.equal(await countOf("heby_action_requests"), requestsBefore, "no request filed");
    assert.equal(await countOf("action_permits"), permitsBefore, "no permit");

    /* ═══ 3. A SUPPLIED OBSERVATION IS REFUSED, NOT DROPPED, AND NOTHING IS REGISTERED ═══════════ */
    const withSupplement = await originateAgentAction({ goal: GOAL }, originationDeps({ observationSupplement: "MARKSUPPLEMENT outside text" }));
    assert.deepEqual(withSupplement, { status: "refused", reason: "observation-not-admitted" });
    assert.equal(captured.length, 1, "the generator was never asked");
    assert.equal(await countOf("heby_origination_invocations"), 1, "no invocation registered");
    assert.equal(fetches, 0, "still no fetch");

    /*
     * ═══ 4. THE MODEL CANNOT CHOOSE WHAT IT WAS NOT SHOWN ════════════════════════════════════════
     * A fake transport (no egress, so no gate) answers with a send naming a REAL recipient and a
     * REAL draft of this organization. The parser judges against the projection, so it is refused.
     */
    const fake = (text: string) => ({
      async send(r: { model: string }) {
        return { id: "req_apf3", model: r.model, content: [{ type: "text" as const, text }], stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    });
    const sendAttempt = await originateAgentAction(
      { goal: GOAL },
      originationDeps({
        generate: generateHebyModelAnswer,
        selectTransport: () => ({
          transport: fake(JSON.stringify({ kind: "send", args: { recipientRef, draftRef }, reason: "Send it." })),
          transportProvenance: "fake",
        }),
      }),
    );
    assert.deepEqual(sendAttempt, { status: "refused", reason: "reference-not-offered" }, "a send the model was not offered is refused by the parser");
    assert.equal(await countOf("heby_action_requests"), requestsBefore, "nothing filed for an unoffered send");
    assert.equal(await countOf("action_permits"), permitsBefore, "still no permit");
    assert.equal(fetches, 0, "still no fetch");

    console.log("PASS apf3-narrow-origination narrow-origination-postgres");
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
