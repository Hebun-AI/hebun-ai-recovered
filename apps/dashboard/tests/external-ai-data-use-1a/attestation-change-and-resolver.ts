/*
 * EXTERNAL-AI-DATA-USE-1A — attestation supersession classification and the disclosure resolver,
 * proven pure.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "A change between the attestation a tenant authorized and the one now in force is classified
 *    from closed ORDERED vocabularies only — never from a string somebody chose — and anything
 *    that is not provably equal or narrower makes the authorization STALE. The resolver never
 *    collapses its inputs into a boolean, reports a tenant's own withdrawal before any global
 *    state, and has no input value that yields `authorized` unless every authority agrees."
 *
 * No database, no provider, no network.
 */
import assert from "node:assert/strict";
import {
  classifyAttestationChange,
  type AttestationTreatmentView,
} from "../../src/features/external-ai-data-use/attestation-change";
import {
  composeExternalAiDisclosure,
  type DisclosureComposeInput,
} from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import type {
  AllowedPlatformCell,
  PlatformDisclosurePolicy,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const A: AttestationTreatmentView = {
  id: "11111111-1111-4111-8111-111111111111",
  serviceScope: "anthropic/messages",
  accountRef: "org-test-account",
  identityStatus: "attested",
  contractSurface: "anthropic-commercial-terms",
  training: "none",
  retentionClass: "bounded-30-days",
  zdr: "not-enabled",
  modelTreatmentClass: "anthropic-standard",
};
const next = (patch: Partial<AttestationTreatmentView>): AttestationTreatmentView => ({
  ...A,
  id: "22222222-2222-4222-8222-222222222222",
  ...patch,
});

/* ── 1. CLASSIFICATION ─────────────────────────────────────────────────────────────────────── */
assert.equal(classifyAttestationChange(A, A), "equivalent", "the same revision is equivalent to itself");
assert.equal(classifyAttestationChange(A, next({})), "equivalent", "a new revision with equal treatment (evidence refresh)");
assert.equal(classifyAttestationChange(A, next({ zdr: "enabled" })), "narrowing");
assert.equal(classifyAttestationChange(A, next({ retentionClass: "zero-data-retention" })), "narrowing");
assert.equal(classifyAttestationChange(A, next({ identityStatus: "verified" })), "narrowing", "more identity assurance");
assert.equal(classifyAttestationChange(A, next({ training: "customer-opt-in" })), "widening");
assert.equal(classifyAttestationChange(A, next({ training: "provider-default" })), "widening");
assert.equal(classifyAttestationChange(A, next({ retentionClass: "extended" })), "widening");
assert.equal(
  classifyAttestationChange({ ...A, zdr: "enabled" }, next({ zdr: "not-enabled" })),
  "widening",
  "losing ZDR is widening",
);
assert.equal(
  classifyAttestationChange({ ...A, identityStatus: "verified" }, next({ identityStatus: "attested" })),
  "widening",
  "losing verification is widening",
);
assert.equal(
  classifyAttestationChange(A, next({ zdr: "enabled", training: "customer-opt-in" })),
  "widening",
  "any widening axis outweighs every narrowing one",
);
assert.equal(
  classifyAttestationChange(A, next({ contractSurface: "openai-services-agreement" })),
  "unknown",
  "a different contract surface is not orderable — UNKNOWN, never equivalent",
);
assert.equal(
  classifyAttestationChange(A, next({ modelTreatmentClass: "anthropic-covered-30d" })),
  "unknown",
  "a different model treatment class is not orderable",
);
assert.equal(classifyAttestationChange(A, next({ accountRef: "another-org" })), "identity-change");
assert.equal(classifyAttestationChange(A, next({ serviceScope: "openai/images.edits" })), "identity-change");

/* ── 2. THE RESOLVER ───────────────────────────────────────────────────────────────────────── */
const bounds = {
  maxTraining: "none",
  maxRetention: "bounded-30-days",
  contractSurfaces: ["anthropic-commercial-terms"],
  minimumIdentity: "attested",
  zdrRequired: false,
} as const;
const cellFor = (dataClass: AllowedPlatformCell["dataClass"]): AllowedPlatformCell => ({
  serviceScope: "anthropic/messages",
  purpose: "assistance",
  dataClass,
  decision: "allowed",
  bounds,
  evidence: "test fixture",
});
const allowingPolicy: PlatformDisclosurePolicy = {
  deniedServiceScopes: [],
  allowedCells: [cellFor("conversation"), cellFor("knowledge"), cellFor("organization")],
};

const base: DisclosureComposeInput = {
  request: {
    serviceScope: "anthropic/messages",
    purpose: "assistance",
    requiredDataClasses: ["conversation"],
    optionalDataClasses: ["knowledge", "organization", "work-artifact"],
  },
  policy: allowingPolicy,
  accountRef: "org-test-account",
  attestation: { status: "read", latest: { ...A, state: "active" } },
  tenant: {
    status: "read",
    effective: {
      authorizationId: "33333333-3333-4333-8333-333333333333",
      state: "active",
      boundAttestation: A,
      scopes: [
        { purpose: "assistance", dataClass: "conversation" },
        { purpose: "assistance", dataClass: "knowledge" },
        { purpose: "assistance", dataClass: "work-artifact" },
      ],
    },
  },
  operatorEnabled: true,
  providerAvailable: true,
};

const ok = composeExternalAiDisclosure(base);
assert.equal(ok.disposition, "authorized");
assert.deepEqual(
  [...ok.authorizedDataClasses].sort(),
  ["conversation", "knowledge"],
  "optional classes appear only when BOTH the tenant scope and the platform allow them",
);
assert.equal(ok.authorizationId, "33333333-3333-4333-8333-333333333333");
assert.equal(ok.attestationId, A.id);

/* Every component is reported, never collapsed. */
assert.ok(ok.components.platform && ok.components.tenant && ok.components.operator && ok.components.provider);

const withTenant = (t: DisclosureComposeInput["tenant"]): DisclosureComposeInput => ({ ...base, tenant: t });
const withdrawn = withTenant({
  status: "read",
  effective: { authorizationId: "x", state: "withdrawn", boundAttestation: null, scopes: [] },
});

/* ORDER: unavailable first, then the tenant's OWN withdrawal before any platform or operator state. */
assert.equal(composeExternalAiDisclosure({ ...base, tenant: { status: "unavailable" } }).disposition, "unavailable");
assert.equal(composeExternalAiDisclosure({ ...base, attestation: { status: "unavailable" } }).disposition, "unavailable");
assert.equal(composeExternalAiDisclosure({ ...base, operatorEnabled: null }).disposition, "unavailable");
assert.equal(
  composeExternalAiDisclosure({
    ...withdrawn,
    operatorEnabled: false,
    policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
  }).disposition,
  "tenant-withdrawn",
  "a withdrawal is never disguised by a global pause or an unknown platform",
);
assert.equal(
  composeExternalAiDisclosure({
    ...base,
    request: { ...base.request, serviceScope: "higgsfield/pixverse-v6/image-to-video" },
    policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
  }).disposition,
  "platform-denied",
);
assert.equal(
  composeExternalAiDisclosure({ ...base, policy: RECORDED_PLATFORM_DISCLOSURE_POLICY }).disposition,
  "platform-unknown",
  "the RECORDED policy (Release A) yields platform-unknown for Anthropic even with everything else in place",
);
assert.equal(composeExternalAiDisclosure({ ...base, accountRef: null }).disposition, "platform-unknown");
assert.equal(composeExternalAiDisclosure({ ...base, attestation: { status: "absent" } }).disposition, "platform-unknown");
assert.equal(
  composeExternalAiDisclosure({ ...base, attestation: { status: "read", latest: { ...A, state: "withdrawn" } } })
    .disposition,
  "platform-unknown",
);
assert.equal(
  composeExternalAiDisclosure({
    ...base,
    attestation: { status: "read", latest: { ...next({ training: "provider-default" }), state: "active" } },
  }).disposition,
  "platform-denied",
  "an attestation outside the cell's bounds is a platform denial, whatever the tenant said",
);
assert.equal(composeExternalAiDisclosure(withTenant({ status: "absent" })).disposition, "tenant-not-authorized");
assert.equal(
  composeExternalAiDisclosure({
    ...base,
    request: { ...base.request, requiredDataClasses: ["conversation", "organization"] },
  }).disposition,
  "tenant-not-authorized",
  "a required class the tenant never authorized refuses the whole request",
);
assert.equal(
  composeExternalAiDisclosure({
    ...base,
    attestation: {
      status: "read",
      latest: { ...next({ contractSurface: "anthropic-commercial-terms", modelTreatmentClass: "anthropic-covered-30d" }), state: "active" },
    },
  }).disposition,
  "authorization-stale",
);
assert.equal(
  composeExternalAiDisclosure({
    ...base,
    policy: {
      deniedServiceScopes: [],
      allowedCells: allowingPolicy.allowedCells.map((c) => ({ ...c, bounds: { ...bounds, maxRetention: "extended" } })),
    },
    attestation: { status: "read", latest: { ...next({ retentionClass: "extended" }), state: "active" } },
  }).disposition,
  "authorization-stale",
  "a widening the platform would accept is still not something this tenant agreed to",
);
assert.equal(
  composeExternalAiDisclosure({
    ...base,
    attestation: { status: "read", latest: { ...next({ zdr: "enabled" }), state: "active" } },
  }).disposition,
  "authorized",
  "a narrowing preserves the tenant's authorization",
);
assert.equal(composeExternalAiDisclosure({ ...base, operatorEnabled: false }).disposition, "operator-paused");
assert.equal(composeExternalAiDisclosure({ ...base, providerAvailable: false }).disposition, "provider-unavailable");

/* FAIL CLOSED: a non-authorized disposition never carries an authorization or a data class. */
for (const refused of [
  composeExternalAiDisclosure(withdrawn),
  composeExternalAiDisclosure({ ...base, policy: RECORDED_PLATFORM_DISCLOSURE_POLICY }),
  composeExternalAiDisclosure({ ...base, operatorEnabled: false }),
]) {
  assert.notEqual(refused.disposition, "authorized");
  assert.equal(refused.authorizedDataClasses.length, 0);
  assert.equal(refused.authorizationId, null);
}

console.log("PASS external-ai-data-use-1a attestation-change-and-resolver");
