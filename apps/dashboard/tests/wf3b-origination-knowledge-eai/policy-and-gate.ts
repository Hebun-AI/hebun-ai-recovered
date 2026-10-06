/*
 * WF-3B — the platform ALLOW for anthropic/messages × agent-origination × knowledge, and what it does
 * and does not change.
 *
 *   - exactly one cell is added; conversation and organization stay; every other origination class
 *     stays UNKNOWN; the bounds and the attestation are the shared ones;
 *   - the gate still refuses a Knowledge declaration for an organization whose authorization in force
 *     does not name agent-origination × knowledge (Hebun's revision 2 today, TRH and Mulify with none),
 *     and authorizes it only once the tenant's own revision names it;
 *   - a model outside the attestation's model_ids is still refused;
 *   - the tenant ceremony asks for the union and its consent names Knowledge;
 *   - no runtime path declares knowledge for origination yet (WF-3C).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ANTHROPIC_ASSISTANCE_BOUNDS,
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
  decidePlatformDisclosure,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import {
  composeExternalAiDisclosure,
  type DisclosureComposeInput,
} from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import type { AttestationTreatmentView } from "../../src/features/external-ai-data-use/attestation-change";
import { DATA_CLASSES, type ScopePair } from "../../src/features/external-ai-data-use/contracts";
import { nextRevisionScopes } from "../../scripts/lib/tenant-data-use-scopes";
import { projectOriginationForModel } from "../../src/features/agent-origination/originate-action.server";

const ATTESTATION_ID = "ffb0c160-4082-4c7f-be6a-05a4d990c598";
const HAIKU = "claude-haiku-4-5-20251001";

/* ── 1. THE POLICY: one cell added, nothing else moved. ──────────────────────────────────────── */
const origination = RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.filter((c) => c.purpose === "agent-origination");
assert.deepEqual(origination.map((c) => c.dataClass), ["conversation", "organization", "knowledge"]);
const knowledgeCell = origination[2]!;
assert.equal(knowledgeCell.serviceScope, "anthropic/messages");
assert.equal(knowledgeCell.bounds, ANTHROPIC_ASSISTANCE_BOUNDS, "the shared bounds, not a copy");
for (const needle of ["WF-3B", ATTESTATION_ID, HAIKU, "46adfce6", "at most 20 versions", "at most 2,000 code points", "K1..Kn", "until WF-3C"]) {
  assert.ok(knowledgeCell.evidence.includes(needle), `knowledge cell evidence names ${needle}`);
}
assert.ok(!origination[0]!.evidence.includes("WF-3B") && !origination[1]!.evidence.includes("WF-3B"), "APF-3's recorded evidence is untouched");
for (const dataClass of DATA_CLASSES) {
  const verdict = decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "agent-origination", dataClass });
  const expected = ["conversation", "organization", "knowledge"].includes(dataClass) ? "allowed" : "unknown";
  assert.equal(verdict.decision, expected, `agent-origination × ${dataClass}`);
}

/* ── 2. THE GATE: the platform cell alone authorizes nothing. ───────────────────────────────── */
const A: AttestationTreatmentView = {
  id: ATTESTATION_ID,
  serviceScope: "anthropic/messages",
  accountRef: "org-test-account",
  identityStatus: "attested",
  contractSurface: "anthropic-commercial-terms",
  training: "none",
  retentionClass: "bounded-30-days",
  zdr: "not-enabled",
  modelTreatmentClass: "anthropic-standard",
};
const ASSISTANCE: ScopePair[] = [
  { purpose: "assistance", dataClass: "conversation" },
  { purpose: "assistance", dataClass: "knowledge" },
  { purpose: "assistance", dataClass: "work-artifact" },
];
/* Hebun's authorization in force today (revision 2, measured read-only before this change). */
const HEBUN_REVISION_2: ScopePair[] = [
  ...ASSISTANCE,
  { purpose: "agent-origination", dataClass: "conversation" },
  { purpose: "agent-origination", dataClass: "organization" },
];
const input = (scopes: ScopePair[] | null, classes: DisclosureComposeInput["request"]["requiredDataClasses"], modelId = HAIKU): DisclosureComposeInput => ({
  request: { serviceScope: "anthropic/messages", purpose: "agent-origination", requiredDataClasses: classes, modelId },
  policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
  accountRef: "org-test-account",
  attestation: { status: "read", latest: { ...A, state: "active", modelIds: [HAIKU], attestationRevision: 1 } },
  tenant:
    scopes === null
      ? { status: "absent" }
      : { status: "read", effective: { authorizationId: "33333333-3333-4333-8333-333333333333", state: "active", boundAttestation: A, scopes, authorizationRevision: 2 } },
  operatorEnabled: true,
  providerAvailable: true,
});
const KNOWLEDGE_MODE = ["conversation", "organization", "knowledge"] as const;
const PLAIN = ["conversation", "organization"] as const;

assert.equal(composeExternalAiDisclosure(input(HEBUN_REVISION_2, [...PLAIN])).disposition, "authorized", "plain origination unchanged");
assert.equal(composeExternalAiDisclosure(input(HEBUN_REVISION_2, [...KNOWLEDGE_MODE])).disposition, "tenant-not-authorized", "Hebun today: Knowledge refused whole");
assert.equal(composeExternalAiDisclosure(input(null, [...KNOWLEDGE_MODE])).disposition, "tenant-not-authorized", "TRH / Mulify: no authorization");
assert.equal(composeExternalAiDisclosure(input(ASSISTANCE, [...KNOWLEDGE_MODE])).disposition, "tenant-not-authorized", "assistance × knowledge is not origination × knowledge");

const AFTER_CEREMONY = nextRevisionScopes(
  HEBUN_REVISION_2,
  RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells
    .filter((c) => c.serviceScope === "anthropic/messages" && c.purpose === "agent-origination")
    .map((c) => ({ purpose: c.purpose, dataClass: c.dataClass })),
);
assert.deepEqual(AFTER_CEREMONY, [...HEBUN_REVISION_2, { purpose: "agent-origination", dataClass: "knowledge" }], "the union keeps every scope in force and adds exactly one");
const authorized = composeExternalAiDisclosure(input(AFTER_CEREMONY, [...KNOWLEDGE_MODE]));
assert.equal(authorized.disposition, "authorized");
assert.deepEqual(authorized.authorizedDataClasses, [...KNOWLEDGE_MODE], "all three, declared and required");
assert.equal(composeExternalAiDisclosure(input(AFTER_CEREMONY, [...KNOWLEDGE_MODE], "claude-sonnet-4-6")).disposition, "model-not-attested");
assert.equal(composeExternalAiDisclosure(input(AFTER_CEREMONY, ["conversation", "organization", "work-artifact"])).disposition, "platform-unknown", "work-artifact stays outside");

/* ── 3. THE CEREMONY: asks for the policy's cells, consents to Knowledge by name. ────────────── */
const ceremony = readFileSync("scripts/eai-authorize-tenant-external-ai-data-use.ts", "utf8");
assert.match(ceremony, /"agent-origination": \["conversation", "organization", "knowledge"\]/);
assert.match(ceremony, /this organization's structure and the statements of its ratified Knowledge eligible for grounding may be processed/);

/* ── 4. INERT: nothing declares agent-origination × knowledge yet. ──────────────────────────── */
const projection = projectOriginationForModel({
  recipients: [],
  drafts: [],
  work: { organizationLevel: true, departments: [{ slug: "engineering", label: "Engineering", departmentRef: "department/x" }], observations: [] },
});
assert.deepEqual([...projection.dataClasses].sort(), ["conversation", "organization"], "the released origination projection declares no knowledge");
assert.match(
  readFileSync("src/features/origination-availability/read-origination-availability.server.ts", "utf8"),
  /ORIGINATION_DECLARED_DATA_CLASSES: readonly DataClass\[\] = Object\.freeze\(\["conversation", "organization"\]\)/,
  "WF-1 availability still declares the narrow pair",
);

console.log("wf3b policy-and-gate checks passed");
