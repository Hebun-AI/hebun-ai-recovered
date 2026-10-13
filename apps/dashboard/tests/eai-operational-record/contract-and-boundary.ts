/*
 * EAI-OPERATIONAL-RECORD-1 — the `operational-record` contract and the boundary it sits behind.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Operational records — authoritative or derived — cross to no model today: the RECORDED platform
 *    policy holds no cell for them under any purpose, so even a tenant that 'granted' them is refused
 *    before the network seam. If a platform cell existed, the tenant, attestation and revocation
 *    layers would still refuse on their own. The planning projection is closed-world: a title, a
 *    name, an identifier, a timestamp, a dependency or a secret has no way in. The contract grants
 *    nothing, writes nothing and reaches no execution module."
 *
 * No database, no provider, no credential: the composer is the released pure function over the
 * recorded policy, and the transport is the REAL live Claude transport over a counting fetch.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { admittedDispatch } from "../helpers/authorized-disclosure";
import type { AttestationTreatmentView } from "../../src/features/external-ai-data-use/attestation-change";
import {
  externalAiDisclosureEvidence,
  type ExternalAiDisclosureDeclaration,
  type ExternalAiDisclosureEvidence,
} from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import {
  composeExternalAiDisclosure,
  type DisclosureComposeInput,
  type LatestAttestation,
} from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { PURPOSES, type Purpose } from "../../src/features/external-ai-data-use/contracts";
import {
  OPERATIONAL_DECLARED_STATES,
  OPERATIONAL_PLANNING_FIELDS,
  OPERATIONAL_PLANNING_MAX_ITEMS,
  OPERATIONAL_RECORD_FIELDS,
  validateOperationalPlanningProjection,
} from "../../src/features/external-ai-data-use/operational-record-contract";
import {
  ANTHROPIC_ASSISTANCE_BOUNDS,
  decidePlatformDisclosure,
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
  type PlatformDisclosurePolicy,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { modelDisclosedDataClasses, modelGroundingLines } from "../../src/features/heby-answer/model-facing-projection";
import { HEBY_MODEL_SYSTEM_INSTRUCTIONS } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { WORK_DECLARED_STATES } from "../../src/features/organizational-work/work-contracts";
import type { SourceResolution } from "../../src/features/heby-runtime";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const CONTRACT = "src/features/external-ai-data-use/operational-record-contract.ts";

const MODEL = "claude-haiku-4-5-20251001";
const ACCOUNT = "14ea4a95-7d92-4844-8aca-5de14968a87d";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "33333333-3333-4333-8333-333333333333";
const ACTOR = "22222222-2222-4222-8222-222222222222";

const VIEW: AttestationTreatmentView = {
  id: "ffb0c160-4082-4c7f-be6a-05a4d990c598",
  serviceScope: "anthropic/messages",
  accountRef: ACCOUNT,
  identityStatus: "attested",
  contractSurface: "anthropic-commercial-terms",
  training: "none",
  retentionClass: "bounded-30-days",
  zdr: "not-enabled",
  modelTreatmentClass: "anthropic-standard",
};
const LATEST: LatestAttestation = { ...VIEW, state: "active", modelIds: [MODEL], attestationRevision: 1 };

/** A HYPOTHETICAL policy: the recorded one plus a cell for (purpose × operational-record). Test-only. */
const withOperationalCell = (purpose: Purpose): PlatformDisclosurePolicy => ({
  deniedServiceScopes: RECORDED_PLATFORM_DISCLOSURE_POLICY.deniedServiceScopes,
  allowedCells: [
    ...RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells,
    { serviceScope: "anthropic/messages", purpose, dataClass: "operational-record", decision: "allowed", bounds: ANTHROPIC_ASSISTANCE_BOUNDS, evidence: "TEST ONLY — hypothetical cell; no decision exists" },
  ],
});

/** Everything agrees except what each case changes. The tenant has "granted" the operational pair. */
function input(purpose: Purpose, patch: Partial<DisclosureComposeInput> = {}): DisclosureComposeInput {
  return {
    request: { serviceScope: "anthropic/messages", purpose, requiredDataClasses: ["operational-record"], modelId: MODEL },
    policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
    accountRef: ACCOUNT,
    attestation: { status: "read", latest: LATEST },
    tenant: {
      status: "read",
      effective: { authorizationId: "auth-a", state: "active", boundAttestation: VIEW, scopes: [{ purpose, dataClass: "operational-record" }], authorizationRevision: 4 },
    },
    operatorEnabled: true,
    providerAvailable: true,
    ...patch,
  };
}
const disposition = (i: DisclosureComposeInput) => composeExternalAiDisclosure(i).disposition;

const VALID = {
  items: [
    { alias: "W1", state: "blocked", accountable: false, stale: true, evidenceDeclared: false },
    { alias: "W2", state: "active", accountable: true, stale: false, evidenceDeclared: true },
  ],
};
const withItem = (patch: Record<string, unknown>, drop?: string) => {
  const item: Record<string, unknown> = { ...VALID.items[0], ...patch };
  if (drop) delete item[drop];
  return { items: [item, VALID.items[1]] };
};

/* ── 0. THE CONTRACT TABLE IS COHERENT. ───────────────────────────────────────────────────────── */
assert.deepEqual([...OPERATIONAL_DECLARED_STATES], [...WORK_DECLARED_STATES], "the contract's states are Work's states");
assert.deepEqual([...OPERATIONAL_PLANNING_FIELDS], ["alias", "state", "accountable", "stale", "evidenceDeclared"]);
for (const r of OPERATIONAL_RECORD_FIELDS) {
  if (r.modelVisibility === "candidate") {
    assert.equal(r.disclosureClass, "operational-record", `${r.field}: every visible field travels as operational-record`);
    assert.ok(!["personal", "organizational-free-text", "internal-identifier", "secret"].includes(r.sensitivity), `${r.field}: no personal, free-text, identifier or secret field is visible`);
  }
}
assert.equal(new Set(OPERATIONAL_RECORD_FIELDS.map((r) => r.field)).size, OPERATIONAL_RECORD_FIELDS.length, "one rule per field");

/* ── 1. DERIVED DATA IS OPERATIONAL-RECORD, AND ONLY work-planning MAY CARRY IT (D4). ─────────── */
for (const r of OPERATIONAL_RECORD_FIELDS.filter((x) => x.provenance === "derived" && x.modelVisibility === "candidate")) {
  assert.equal(r.disclosureClass, "operational-record", `${r.field}: derived, still protected`);
}
const onlyDerived = validateOperationalPlanningProjection({ items: [{ alias: "W1", state: "planned", accountable: false, stale: true, evidenceDeclared: false }] });
assert.ok(onlyDerived.ok && onlyDerived.dataClasses.length === 1 && onlyDerived.dataClasses[0] === "operational-record", "a projection of flags still declares the class");
for (const purpose of PURPOSES.filter((p) => p !== "work-planning")) {
  assert.notEqual(
    decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose, dataClass: "operational-record" }).decision,
    "allowed",
    `${purpose}: the recorded policy holds no operational-record cell`,
  );
  assert.equal(disposition(input(purpose)), "platform-unknown", `${purpose}: a tenant 'grant' cannot open what the platform does not allow`);
}
/* D4: the one recorded cell. It is platform acceptability only — without the tenant's own scope it refuses. */
assert.equal(decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "work-planning", dataClass: "operational-record" }).decision, "allowed");
assert.equal(disposition(input("work-planning", { tenant: { status: "absent" } })), "tenant-not-authorized", "the platform cell authorizes no tenant");
assert.equal(
  disposition(input("work-planning", { tenant: { status: "read", effective: { authorizationId: "auth-a", state: "active", boundAttestation: VIEW, scopes: [{ purpose: "assistance", dataClass: "conversation" }, { purpose: "assistance", dataClass: "knowledge" }, { purpose: "assistance", dataClass: "work-artifact" }] } } })),
  "tenant-not-authorized",
  "an assistance grant is not a work-planning grant",
);
assert.equal(disposition(input("work-planning")), "authorized", "control: the recorded cell, the tenant's own scope and the attested model together");
/* Assistance is not widened, and Heby's grounding still withholds Work. */
assert.equal(decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass: "operational-record" }).decision, "unknown");
const work = { sourceClass: "work", state: "resolved", provenance: "work authority", items: [{ recordRef: "work/x", label: "Supplier contract", detail: "blocked", lifecycle: "settled" }] } as unknown as SourceResolution;
assert.deepEqual([...modelDisclosedDataClasses([work])], [], "the work source declares no class to the model");
assert.ok(!modelGroundingLines([work]).join("\n").includes("Supplier contract"), "the work title never reaches the grounding");

/* ── 2. EVERY OTHER LAYER STILL REFUSES ON ITS OWN, EVEN UNDER A HYPOTHETICAL CELL. ────────────── */
for (const purpose of PURPOSES) {
  const policy = withOperationalCell(purpose);
  assert.equal(disposition(input(purpose, { policy })), "authorized", `${purpose}: control — all five authorities agreeing is the only yes`);
  /* No authorization. */
  assert.equal(disposition(input(purpose, { policy, tenant: { status: "absent" } })), "tenant-not-authorized", `${purpose}: no authorization`);
  /* Authorization for something else (another purpose, or the classes another tenant agreed to). */
  const other = PURPOSES.find((p) => p !== purpose)!;
  assert.equal(
    disposition(input(purpose, { policy, tenant: { status: "read", effective: { authorizationId: "auth-x", state: "active", boundAttestation: VIEW, scopes: [{ purpose: other, dataClass: "operational-record" }, { purpose, dataClass: "conversation" }] } } })),
    "tenant-not-authorized",
    `${purpose}: an authorization that does not name the pair is no authorization`,
  );
  /* Revoked. */
  assert.equal(disposition(input(purpose, { policy, tenant: { status: "read", effective: { authorizationId: "auth-a", state: "withdrawn", boundAttestation: null, scopes: [] } } })), "tenant-withdrawn", `${purpose}: revoked`);
  /* Missing attestation, or one for another account. */
  assert.equal(disposition(input(purpose, { policy, attestation: { status: "absent" } })), "platform-unknown", `${purpose}: no attestation`);
  assert.equal(disposition(input(purpose, { policy, accountRef: "another-account" })), "platform-unknown", `${purpose}: attestation of another account`);
  assert.equal(disposition(input(purpose, { policy, attestation: { status: "read", latest: { ...LATEST, state: "withdrawn" } } })), "platform-unknown", `${purpose}: withdrawn attestation`);
  assert.equal(disposition(input(purpose, { policy, request: { serviceScope: "anthropic/messages", purpose, requiredDataClasses: ["operational-record"], modelId: "claude-unattested" } })), "model-not-attested", `${purpose}: unattested model`);
  /* Unreadable anything ⇒ unavailable. */
  assert.equal(disposition(input(purpose, { policy, tenant: { status: "unavailable" } })), "unavailable");
  assert.equal(disposition(input(purpose, { policy, attestation: { status: "unavailable" } })), "unavailable");
  assert.equal(disposition(input(purpose, { policy, operatorEnabled: null })), "unavailable");
  assert.equal(disposition(input(purpose, { policy, operatorEnabled: false })), "operator-paused");
  /* An undeclared class rides along with nothing: one unauthorized required class refuses all. */
  assert.equal(
    disposition(input(purpose, { policy, request: { serviceScope: "anthropic/messages", purpose, requiredDataClasses: ["operational-record", "organization"], modelId: MODEL } })),
    purpose === "agent-origination" ? "tenant-not-authorized" : "platform-unknown",
    `${purpose}: the department as a class is not smuggled in beside the records`,
  );
}

/* ── 3. THE PROJECTION IS CLOSED-WORLD. ───────────────────────────────────────────────────────── */
const refusedFor = (projection: unknown) => {
  const v = validateOperationalPlanningProjection(projection);
  assert.equal(v.ok, false, `accepted: ${JSON.stringify(projection)}`);
  return v.ok ? null : v.refusal;
};
assert.deepEqual(validateOperationalPlanningProjection(VALID), { ok: true, dataClasses: ["operational-record"], itemCount: 2 });
/* Work title excluded by default — and every other denied field, by name. */
for (const r of OPERATIONAL_RECORD_FIELDS.filter((x) => x.modelVisibility === "denied")) {
  assert.deepEqual(refusedFor(withItem({ [r.field]: "x" })), { reason: "field-not-disclosable", field: r.field }, `${r.field} is refused`);
}
assert.equal(OPERATIONAL_RECORD_FIELDS.find((r) => r.field === "title")!.modelVisibility, "denied", "titles are DENY by default");
/* Unlisted fields are refused exactly like denied ones; so is anything beside the items. */
assert.deepEqual(refusedFor(withItem({ ownerEmail: "a@b.co" })), { reason: "field-not-disclosable", field: "ownerEmail" });
for (const key of ["tenantId", "department", "organization", "instructions"]) {
  assert.deepEqual(refusedFor({ ...VALID, [key]: "x" }), { reason: "field-not-disclosable", field: key }, `top-level ${key}`);
}
/* No secret, identifier or free text rides in a value: every value is closed. */
for (const leak of ["sk-ant-api03-SECRET", "Bearer abc", "ayse@example.com", TENANT_A, "Supplier contract with Ayşe"]) {
  assert.deepEqual(refusedFor(withItem({ state: leak })), { reason: "invalid-value", field: "state", index: 0 });
  assert.deepEqual(refusedFor(withItem({ accountable: leak })), { reason: "invalid-value", field: "accountable", index: 0 });
  assert.deepEqual(refusedFor(withItem({ alias: leak })), { reason: "alias-sequence", index: 0 });
}
assert.deepEqual(refusedFor(withItem({}, "stale")), { reason: "invalid-value", field: "stale", index: 0 }, "every field is required");
assert.deepEqual(refusedFor(withItem({ alias: "W2" })), { reason: "alias-sequence", index: 0 }, "aliases are contiguous from W1");
assert.deepEqual(refusedFor({ items: [] }), { reason: "empty" });
assert.deepEqual(refusedFor({ items: Array.from({ length: OPERATIONAL_PLANNING_MAX_ITEMS + 1 }, (_, i) => ({ ...VALID.items[0], alias: `W${i + 1}` })) }), { reason: "too-many-items", count: OPERATIONAL_PLANNING_MAX_ITEMS + 1 }, "refused, never truncated");
for (const shape of [null, [], "items", { items: "x" }, { items: [null] }, { items: [["W1"]] }, Object.create({ items: VALID.items })]) refusedFor(shape);

/* ── 4. THE CONTRACT GRANTS, WRITES AND EXECUTES NOTHING. ─────────────────────────────────────── */
const contractCode = read(CONTRACT).replace(/\/\*[\s\S]*?\*\//g, "");
assert.deepEqual([...contractCode.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]), ["./contracts"], "the contract imports the vocabulary and nothing else");
assert.match(contractCode, /^import type \{ DataClass \} from "\.\/contracts";$/m, "…and only as a type");
for (const forbidden of ["getDb", "insert(", "update(", "delete(", "fetch(", "process.env", "action-", "permit", "governance", "machine-execution"]) {
  assert.ok(!contractCode.includes(forbidden), `the contract does not reach ${forbidden}`);
}
for (const file of ["src/features/heby-answer/model-answer.server.ts", "src/features/heby-model/heby-model-generation.server.ts", "src/features/heby-commands/read-commands.server.ts"]) {
  assert.ok(!read(file).includes("operational-record-contract"), `${file}: nothing at runtime reads the contract`);
}

/* ── 5. NO MODEL CALL BEFORE AUTHORIZATION — the real transport, the recorded policy. ─────────── */
async function dispatch(options: { policy?: PlatformDisclosurePolicy; declaredTenant?: string }): Promise<{ fetched: number; body: string; state: string; evidence: ExternalAiDisclosureEvidence[]; asked: number }> {
  let fetched = 0;
  let body = "";
  let asked = 0;
  const evidence: ExternalAiDisclosureEvidence[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    fetched += 1;
    body = String(init.body);
    return { ok: true, status: 200, json: async () => ({ id: "msg", model: MODEL, content: [{ type: "text", text: "{}" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  const declaration: ExternalAiDisclosureDeclaration = { tenantId: options.declaredTenant ?? TENANT_A, purpose: "assistance", dataClasses: ["operational-record"], actorUserId: ACTOR };
  const outcome = await generateHebyModelAnswer(
    { correlationId: "c-op", tenantId: TENANT_A, systemInstructions: HEBY_MODEL_SYSTEM_INSTRUCTIONS, userPrompt: JSON.stringify(VALID), evidence: [], modelId: "", maxOutputTokens: 0 },
    {
      env: { HEBUN_MODEL_CONNECTIVITY_ENABLED: "true", HEBUN_MODEL_PROVIDER: "claude", HEBUN_MODEL_ID: MODEL, HEBUN_MODEL_CREDENTIAL: "sk-fake-credential", HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100" },
      transport: createLiveClaudeTransport({ apiKey: "sk-fake-credential", spendBudget: createLiveSpendBudget(9), fetchImpl }),
      disclosure: declaration,
      resolveOperatorEnabled: async () => true,
      /* The released composer over everything a fully consenting tenant could hold. Only the policy varies. */
      authorizeDisclosure: async (d, operatorEnabled, modelId) => {
        asked += 1;
        return composeExternalAiDisclosure({
          ...input("assistance", { policy: options.policy ?? RECORDED_PLATFORM_DISCLOSURE_POLICY, operatorEnabled }),
          request: { serviceScope: "anthropic/messages", purpose: d!.purpose, requiredDataClasses: d!.dataClasses, modelId },
        });
      },
      recordDisclosure: async (e) => {
        evidence.push(e);
        return true;
      },
      admitDispatch: admittedDispatch,
    },
  );
  return { fetched, body, state: outcome.status === "unavailable" ? outcome.state : outcome.status, evidence, asked };
}

async function main(): Promise<void> {
  /* The recorded policy: refused before the network seam, and the refusal is recorded. */
  {
    const r = await dispatch({});
    assert.equal(r.fetched, 0, "no model call: the recorded policy has no operational-record cell");
    assert.equal(r.state, "DATA_USE_NOT_AUTHORIZED");
    assert.equal(r.evidence.length, 1, "the refusal is evidenced");
    assert.equal(r.evidence[0]!.disposition, "platform-unknown");
  }
  /* Wrong tenant: a declaration for another tenant is never even put to the authority. */
  {
    const r = await dispatch({ policy: withOperationalCell("assistance"), declaredTenant: TENANT_B });
    assert.equal(r.asked, 0, "a tenant mismatch is refused before the authority is asked");
    assert.equal(r.fetched, 0, "and nothing reaches the network seam");
    assert.equal(r.state, "DATA_USE_NOT_AUTHORIZED");
  }
  /* Control: the test can see a call — only a hypothetical policy cell lets one through. */
  {
    const r = await dispatch({ policy: withOperationalCell("assistance") });
    assert.equal(r.fetched, 1, "control: with every authority agreeing, the seam is reached once");
    assert.ok(!r.body.includes("sk-fake-credential"), "the credential is not in the request body");
    /* Retention and logging: the decision's evidence names classes and revisions, never content. */
    const recorded = JSON.stringify(r.evidence);
    for (const content of ["W1", "blocked", "evidenceDeclared", "sk-fake"]) assert.ok(!recorded.includes(content), `the evidence carries no ${content}`);
  }
  /* The evidence shape itself has no field for content. */
  const shape = externalAiDisclosureEvidence(
    { tenantId: TENANT_A, purpose: "assistance", dataClasses: ["operational-record"], actorUserId: ACTOR },
    composeExternalAiDisclosure(input("assistance")),
    MODEL,
    "c",
  );
  assert.deepEqual(Object.keys(shape).sort(), [
    "accountRef", "actorUserId", "authorizedDataClasses", "components", "correlationId", "declaredDataClasses", "disposition", "modelId",
    "processorAttestationId", "processorAttestationRevision", "purpose", "serviceScope", "tenantAuthorizationId", "tenantAuthorizationRevision", "tenantId",
  ].sort());

  console.log("PASS eai-operational-record contract and boundary");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
