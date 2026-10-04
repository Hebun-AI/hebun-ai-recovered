/*
 * EXTERNAL-AI-DATA-USE-B2 — THE NETWORK BITE-PROOF, against a REAL but DISPOSABLE PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Driving the REAL generator over the REAL Anthropic HTTP transport (with a counting fetch) and the
 *    REAL three-authority gate (released readers, released composer, recorded policy), a request
 *    reaches fetch only for the authorized tenant, purpose and classes. Every other tenant, purpose,
 *    class, attestation state, operator state or read failure is refused BEFORE fetch is called."
 *
 * Attestations are admitted and changed by the real ceremony library from the reviewed B1B record;
 * the tenant is authorized by the released writer. No production, no provider, no credential.
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
import {
  authorizeTenantExternalAiDataUse,
  withdrawTenantExternalAiDataUse,
} from "../../src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server";
import {
  CONFIGURED_ANTHROPIC_ACCOUNT_REF,
  authorizeExternalAiDisclosure,
  type ExternalAiDisclosureDeclaration,
} from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { DataClass, Purpose } from "../../src/features/external-ai-data-use/contracts";
import { appendProcessorAttestation, parseAttestationRecord, readLineageHead } from "../../scripts/lib/processor-attestation";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime/contracts";

const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REF = (n: string) => `${REVIEWED_RECORD}@${n.repeat(40)}`;
const JUSTIFICATION = "This test organization agrees that its conversations, Knowledge and work artifacts may be processed by the reviewed assistant processor.";
const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test-model",
  HEBUN_MODEL_CREDENTIAL: "sk-fake",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
};
const OK = { id: "msg_b2", model: "claude-test-model", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
const ASSISTANCE: readonly DataClass[] = ["conversation", "knowledge", "work-artifact"];

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

async function main(): Promise<void> {
  const parsed = parseAttestationRecord(readFileSync(path.resolve(__dirname, "../../../..", REVIEWED_RECORD), "utf8"));
  if (parsed.status !== "parsed") throw new Error(`the reviewed record did not parse: ${parsed.reason}`);
  const RECORD = parsed.record;
  assert.equal(RECORD.accountRef, CONFIGURED_ANTHROPIC_ACCOUNT_REF, "the configured account is the reviewed record's account");

  const harness = createDisposablePostgresHarness("hebun_external_ai_b2");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  /*
   * ONE PROBE: the real generator, the real live transport, the real gate. Returns how many times the
   * network seam was reached and the generator's own answer. `operator` is the R2E reading the
   * generator hands the gate; `getDb` lets a case make every authority read fail.
   */
  let fetches = 0;
  const fetchImpl: FetchLike = async () => {
    fetches += 1;
    return { ok: true, status: 200, json: async () => OK };
  };
  async function probe(
    declaration: ExternalAiDisclosureDeclaration | undefined,
    options: { operator?: boolean; unreadable?: boolean; requestTenant?: string } = {},
  ): Promise<{ fetched: number; state: string }> {
    const before = fetches;
    const request: ModelGenerationRequest = {
      correlationId: "b2",
      tenantId: options.requestTenant ?? declaration?.tenantId,
      systemInstructions: "sys",
      userPrompt: "ping",
      evidence: [],
      modelId: "",
      maxOutputTokens: 0,
    };
    const outcome = await generateHebyModelAnswer(request, {
      env: ENV,
      transport: createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: createLiveSpendBudget(99), fetchImpl }),
      disclosure: declaration,
      resolveOperatorEnabled: async () => options.operator ?? true,
      authorizeDisclosure: (d, o) => authorizeExternalAiDisclosure(d, o, options.unreadable ? { getDb: () => null } : deps),
    });
    return { fetched: fetches - before, state: outcome.status === "generated" ? "generated" : outcome.state };
  }
  const declare = (tenantId: string, purpose: Purpose, dataClasses: readonly DataClass[]) => ({ tenantId, purpose, dataClasses });
  const blocked = async (label: string, declaration: ExternalAiDisclosureDeclaration | undefined, options = {}) => {
    const r = await probe(declaration, options);
    assert.deepEqual(r, { fetched: 0, state: "DATA_USE_NOT_AUTHORIZED" }, `${label}: refused BEFORE the network seam`);
  };
  const passes = async (label: string, declaration: ExternalAiDisclosureDeclaration, options = {}) => {
    const r = await probe(declaration, options);
    assert.deepEqual(r, { fetched: 1, state: "generated" }, `${label}: reaches the network seam exactly once`);
  };

  try {
    /* ═══ SEED: hebun (authorized), trh and mulify (never) — each a Governance organization ════════ */
    const seeded: Record<string, Seeded> = {};
    const tenants: Record<string, TenantContext> = {};
    for (const [slug, tag] of [["hebun", "aaaa1"], ["turkish-rug-house", "bbbb2"], ["mulify", "cccc3"]] as const) {
      const s = await seedLocalIdentity(setup, { companyName: slug, companySlug: `${slug}-b2`, email: `${slug}@b2.test`, roleType: "owner" });
      const t = contextFor(s, await sessionRowFor(setup, s, tag), `b2-${slug}`);
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
    const HEBUN = seeded["hebun"]!.tenantId;
    const TRH = seeded["turkish-rug-house"]!.tenantId;
    const MULIFY = seeded["mulify"]!.tenantId;

    /* ═══ 0. NOTHING ADMITTED: even a well-formed assistance request is refused ════════════════════ */
    await blocked("no attestation in force", declare(HEBUN, "assistance", ["conversation"]));

    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "admit", record: RECORD, reviewedRecordRef: REF("1"), controlSource: "local-operator-ceremony", expectedHead: null })).status,
      "appended",
    );
    await blocked("admitted, but the tenant never authorized", declare(HEBUN, "assistance", ["conversation"]));
    const attestationId = (await setup.query(`select id from processor_attestations`)).rows[0].id as string;
    const written = await authorizeTenantExternalAiDataUse(
      tenants["hebun"]!,
      { attestationId, scopes: ASSISTANCE.map((dataClass) => ({ purpose: "assistance" as const, dataClass })), justification: JUSTIFICATION, observedRevision: null },
      deps,
    );
    assert.equal(written.status, "written");

    /* ═══ 1. THE ONE THING THAT PASSES ═════════════════════════════════════════════════════════════ */
    await passes("hebun · assistance · conversation", declare(HEBUN, "assistance", ["conversation"]));
    await passes("hebun · assistance · all three", declare(HEBUN, "assistance", ASSISTANCE));

    /* ═══ 2. TENANTS ═══════════════════════════════════════════════════════════════════════════════ */
    await blocked("TRH", declare(TRH, "assistance", ["conversation"]));
    await blocked("Mulify", declare(MULIFY, "assistance", ["conversation"]));
    await blocked("an unknown tenant", declare("99999999-9999-4999-8999-999999999999", "assistance", ["conversation"]));
    await blocked("no declaration at all", undefined);
    await blocked("an empty tenant", declare("", "assistance", ["conversation"]));
    await blocked("a request whose tenant is not the declared one", declare(HEBUN, "assistance", ["conversation"]), { requestTenant: TRH });

    /* ═══ 3. PURPOSES — none inherits assistance ═══════════════════════════════════════════════════ */
    for (const purpose of ["agent-origination", "relevance-selection", "media-generation"] as const) {
      await blocked(`hebun · ${purpose}`, declare(HEBUN, purpose, ["conversation"]));
    }
    await blocked("an invented purpose", declare(HEBUN, "ai" as Purpose, ["conversation"]));

    /* ═══ 4. CLASSES — one unauthorized class refuses the whole request ═══════════════════════════ */
    for (const extra of ["organization", "governance-record", "operational-record", "provider-observation", "external-recipient", "media-generated", "media-supplied"] as const) {
      await blocked(`hebun · assistance · conversation + ${extra}`, declare(HEBUN, "assistance", ["conversation", extra]));
    }
    await blocked("no class declared", declare(HEBUN, "assistance", []));
    await blocked("an unclassifiable class", declare(HEBUN, "assistance", ["conversation", "everything" as DataClass]));
    /* What origination actually declares (originate-action.server.ts). */
    await blocked("origination's own declaration", declare(HEBUN, "agent-origination", ["conversation", "external-recipient", "work-artifact", "organization"]));
    /* What a preparation carrying a platform observation declares (prepare-work-artifact.server.ts). */
    await blocked("preparation with an observation supplement", declare(HEBUN, "assistance", ["conversation", "knowledge", "work-artifact", "provider-observation"]));

    /* ═══ 5. OPERATOR AND READ FAILURES ═══════════════════════════════════════════════════════════ */
    await blocked("the R2E control is off", declare(HEBUN, "assistance", ["conversation"]), { operator: false });
    await blocked("every authority read fails", declare(HEBUN, "assistance", ["conversation"]), { unreadable: true });

    /* ═══ 6. THE ATTESTATION CHANGES UNDER THE AUTHORIZATION ═════════════════════════════════════ */
    const head1 = await readLineageHead(setup, RECORD.serviceScope, RECORD.accountRef);
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "supersede", record: { ...RECORD, retentionClass: "extended" }, reviewedRecordRef: REF("2"), controlSource: "local-operator-ceremony", expectedHead: head1 })).status,
      "appended",
    );
    await blocked("the attestation widened past the platform bounds", declare(HEBUN, "assistance", ["conversation"]));
    const head2 = await readLineageHead(setup, RECORD.serviceScope, RECORD.accountRef);
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "supersede", record: { ...RECORD, training: "customer-opt-in" }, reviewedRecordRef: REF("3"), controlSource: "local-operator-ceremony", expectedHead: head2 })).status,
      "appended",
    );
    await blocked("training widened past the platform bounds", declare(HEBUN, "assistance", ["conversation"]));
    const head3 = await readLineageHead(setup, RECORD.serviceScope, RECORD.accountRef);
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "supersede", record: { ...RECORD, zdr: "enabled" }, reviewedRecordRef: REF("4"), controlSource: "local-operator-ceremony", expectedHead: head3 })).status,
      "appended",
    );
    await passes("a NARROWER attestation (ZDR enabled) keeps the authorization", declare(HEBUN, "assistance", ["conversation"]));

    /* ═══ 7. THE TENANT WITHDRAWS ════════════════════════════════════════════════════════════════ */
    const withdrawn = await withdrawTenantExternalAiDataUse(
      tenants["hebun"]!,
      { serviceScope: "anthropic/messages", accountRef: RECORD.accountRef, justification: "We withdraw external processing for this fixture.", observedRevision: 1 },
      deps,
    );
    assert.equal(withdrawn.status, "written");
    await blocked("the tenant withdrew", declare(HEBUN, "assistance", ["conversation"]));

    /* ═══ 8. THE ATTESTATION IS WITHDRAWN ════════════════════════════════════════════════════════ */
    const head4 = await readLineageHead(setup, RECORD.serviceScope, RECORD.accountRef);
    assert.equal(
      (await appendProcessorAttestation(setup, { verb: "withdraw", record: RECORD, reviewedRecordRef: REF("5"), controlSource: "local-operator-ceremony", expectedHead: head4 })).status,
      "appended",
    );
    await blocked("the attestation was withdrawn", declare(HEBUN, "assistance", ["conversation"]));

    assert.ok(fetches === 3, `exactly the three authorized probes reached the network seam (got ${fetches})`);
    console.log("PASS external-ai-data-use-b2 egress-postgres");
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
