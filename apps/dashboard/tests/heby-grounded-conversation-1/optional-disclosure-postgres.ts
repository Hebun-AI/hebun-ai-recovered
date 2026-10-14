/*
 * HEBY-GROUNDED-CONVERSATION-1 — OPTIONAL classes through the REAL three-authority gate.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES, against a real PostgreSQL database with a real admitted
 * attestation and real tenant authorizations written by the released ceremony writer:
 *   "A declaration's optional classes reach the composer through the released reader. A tenant whose
 *    authorization names Knowledge gets it; a conversation-only tenant is still answered and the
 *    generator hands the projection ONLY `conversation`; an unauthorized tenant, an unreadable
 *    authority, or an unclassifiable optional class sends nothing; an optional class the platform does
 *    not allow is silently omitted; the decision record names declared and authorized classes apart."
 *
 * The projection here is a marker function: what the wire carries is exactly what it returned for the
 * authorized classes. Real generator, real live transport with an injected fetch — no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
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
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";
import { hebunInstruction } from "../../src/features/heby-runtime/instruction-channel";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const JUSTIFICATION = "This test organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed assistant processor.";
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-haiku-4-5-20251001",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const OK = { id: "msg_hgc1", model: "claude-haiku-4-5-20251001", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
const BASE = "MARK-BASE-KNOWLEDGE-WITHHELD";
const KNOWLEDGE_LINE = "MARK-KNOWLEDGE-DISCLOSED";

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  const RECORD = parsed.record;
  assert.equal(RECORD.accountRef, CONFIGURED_ANTHROPIC_ACCOUNT_REF);

  const harness = createDisposablePostgresHarness("hebun_hgc1_optional");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  const bodies: string[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    bodies.push(String(init.body));
    return { ok: true, status: 200, json: async () => OK };
  };
  const projected: (readonly DataClass[])[] = [];
  async function probe(declaration: ExternalAiDisclosureDeclaration, options: { unreadable?: boolean } = {}) {
    const before = bodies.length;
    const request: ModelGenerationRequest = {
      correlationId: "hgc1",
      tenantId: declaration.tenantId,
      systemInstructions: hebunInstruction("sys"),
      userPrompt: "ping",
      evidence: [BASE],
      modelId: "",
      maxOutputTokens: 0,
    };
    const outcome = await generateHebyModelAnswer(request, {
      env: ENV,
      transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(99), fetchImpl }),
      disclosure: declaration,
      resolveOperatorEnabled: async () => true,
      authorizeDisclosure: (d, o, m) => authorizeExternalAiDisclosure(d, o, m, options.unreadable ? { getDb: () => null } : deps),
      recordDisclosure: (e) => recordExternalAiDisclosureDecision(e, deps),
      projectAuthorizedEvidence: (authorized) => {
        projected.push(authorized);
        return authorized.includes("knowledge") ? [KNOWLEDGE_LINE] : [BASE];
      },
    });
    return {
      fetched: bodies.length - before,
      state: outcome.status === "generated" ? "generated" : outcome.state,
      wire: bodies.slice(before).join("\n"),
    };
  }

  try {
    const tenants: Record<string, TenantContext> = {};
    for (const [slug, tag] of [["full", "aaaa1"], ["convonly", "bbbb2"], ["none", "cccc3"]] as const) {
      const s = await seedLocalIdentity(setup, { companyName: slug, companySlug: `${slug}-hgc1`, email: `${slug}@hgc1.test`, roleType: "owner" });
      const session = await setup.query<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
            inactivity_expires_at)
         values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour')
         returning id`,
        [s.authIdentityId, tag.padEnd(64, "0").slice(0, 64), s.userId, s.tenantId, s.membershipId],
      );
      const t = asHumanTenantContext({
        tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
        membershipVersion: 1, roleId: s.roleId, sessionContextId: session.rows[0]!.id, provider: "local",
        assuranceLevel: "aal1", mfaVerified: false, requestId: `hgc1-${slug}`, authenticatedAt: new Date().toISOString(),
      });
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, t.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(t, { justification: `Establishing ${slug} Governance for this fixture.` }, deps)).status, "established");
      tenants[slug] = t;
    }
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: RECORD, reviewedRecordRef: `${REVIEWED_RECORD}@${"1".repeat(40)}`, controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    const grant = async (slug: string, classes: readonly DataClass[]) =>
      assert.equal(
        (await authorizeTenantExternalAiDataUse(tenants[slug]!, { attestationId, scopes: classes.map((dataClass) => ({ purpose: "assistance" as const, dataClass })), justification: JUSTIFICATION, observedRevision: null }, deps)).status,
        "written",
      );
    await grant("full", ["conversation", "knowledge", "work-artifact"]);
    await grant("convonly", ["conversation"]);

    const declare = (slug: string, optional: readonly DataClass[]): ExternalAiDisclosureDeclaration => ({
      tenantId: tenants[slug]!.tenantId,
      actorUserId: tenants[slug]!.userId,
      purpose: "assistance",
      dataClasses: ["conversation"],
      optionalDataClasses: optional,
    });

    /* Authorized for Knowledge: the projection is handed it, and only its output is sent. */
    const full = await probe(declare("full", ["knowledge"]));
    assert.deepEqual([full.fetched, full.state], [1, "generated"]);
    assert.deepEqual(projected.at(-1), ["conversation", "knowledge"], "the decision's authorized classes reach the projection");
    assert.ok(full.wire.includes(KNOWLEDGE_LINE) && !full.wire.includes(BASE));

    /* Conversation-only: still answered, and the projection is handed conversation alone. */
    const convOnly = await probe(declare("convonly", ["knowledge"]));
    assert.deepEqual([convOnly.fetched, convOnly.state], [1, "generated"], "a conversation-only tenant keeps its model answer");
    assert.deepEqual(projected.at(-1), ["conversation"], "Knowledge is not authorized for it");
    assert.ok(!convOnly.wire.includes(KNOWLEDGE_LINE), "unauthorized Knowledge never reaches the provider");

    /* A platform-unknown optional class is silently omitted, never a refusal and never sent. */
    const unknownOptional = await probe(declare("full", ["knowledge", "organization"]));
    assert.deepEqual([unknownOptional.fetched, unknownOptional.state], [1, "generated"]);
    assert.deepEqual(projected.at(-1), ["conversation", "knowledge"], "organization stays out");

    /* Refusals: nothing reaches the network seam. */
    const before = projected.length;
    for (const [label, declaration, options] of [
      ["unauthorized tenant", declare("none", ["knowledge"]), {}],
      ["every authority unreadable", declare("full", ["knowledge"]), { unreadable: true }],
      ["an unclassifiable optional class", declare("full", ["everything" as DataClass]), {}],
    ] as const) {
      const r = await probe(declaration, options);
      assert.deepEqual([r.fetched, r.state], [0, "DATA_USE_NOT_AUTHORIZED"], `${label}: refused before the network seam`);
    }
    assert.equal(projected.length, before, "a refused decision never runs the projection");

    /* The record names what was declared and what was authorized, apart. */
    const recorded = await setup.query<{ metadata: { declaredDataClasses: string[]; authorizedDataClasses: string[] } }>(
      `select metadata from audit_log where tenant_id = $1 and result = 'committed' order by occurred_at, id`,
      [tenants["convonly"]!.tenantId],
    );
    const decisionRows = recorded.rows.filter((r) => Array.isArray(r.metadata?.declaredDataClasses));
    assert.equal(decisionRows.length, 1, "one authorized decision for the conversation-only tenant");
    assert.deepEqual(decisionRows[0]!.metadata.declaredDataClasses, ["conversation", "knowledge"]);
    assert.deepEqual(decisionRows[0]!.metadata.authorizedDataClasses, ["conversation"]);

    console.log("PASS heby-grounded-conversation-1 optional-disclosure-postgres");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
