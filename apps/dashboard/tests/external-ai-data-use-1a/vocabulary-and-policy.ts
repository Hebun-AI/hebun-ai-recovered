/*
 * EXTERNAL-AI-DATA-USE-1A — the closed vocabularies and the platform disclosure policy, proven pure.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "The vocabularies are closed and name only what Hebun's runtime actually reaches. The recorded
 *    platform policy DENIES both Higgsfield scopes for every purpose and data class, says UNKNOWN
 *    for every Anthropic and OpenAI cell, and cannot hold an ALLOWED cell at all in this release —
 *    not because nobody wrote one, but because its type has no room for one."
 *
 * B1D (Director, 2026-10-04) changed that recorded decision on purpose: the policy now ALLOWS exactly
 * anthropic/messages × assistance × {conversation, knowledge, work-artifact}, and its type has room
 * for those three and no other. The pins in §2 and §3 change with it; everything else here is
 * unchanged. The full B1D proof lives in tests/external-ai-data-use-b1d/.
 *
 * No database, no provider, no network.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CONTRACT_SURFACES,
  DATA_CLASSES,
  EXTERNAL_AI_DATA_USE_DOMAIN,
  IDENTITY_STATUSES,
  PURPOSES,
  RETENTION_CLASSES,
  SERVICE_SCOPES,
  TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZED_OUTCOME,
  TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE,
  TENANT_EXTERNAL_AI_DATA_USE_WITHDRAWN_OUTCOME,
  TRAINING_TREATMENTS,
  ZDR_STATES,
  isDataClass,
  isPurpose,
  isServiceScope,
} from "../../src/features/external-ai-data-use/contracts";
import {
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
  attestationSatisfiesBounds,
  decidePlatformDisclosure,
  type AllowedPlatformCell,
  type PlatformDisclosurePolicy,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const ROOT = path.resolve(__dirname, "../..");

/* ── 1. THE VOCABULARIES ARE EXACTLY THE RUNTIME-REACHABLE ONES. ─────────────────────────────── */
assert.deepEqual(
  [...SERVICE_SCOPES],
  [
    "anthropic/messages",
    "openai/images.generations",
    "openai/images.edits",
    "higgsfield/pixverse-v6/text-to-video",
    "higgsfield/pixverse-v6/image-to-video",
  ],
  "service scopes are the five external processing boundaries the runtime reaches today",
);
assert.ok(
  !SERVICE_SCOPES.some((s) => s.includes("hailuo")),
  "hailuo is not a production-reachable profile, so it is not a scope (higgsfield-video-transport :143)",
);
assert.deepEqual([...PURPOSES], ["assistance", "relevance-selection", "agent-origination", "media-generation"]);
assert.deepEqual(
  [...DATA_CLASSES],
  [
    "conversation",
    "knowledge",
    "work-artifact",
    "organization",
    "governance-record",
    "operational-record",
    "provider-observation",
    "external-recipient",
    "media-generated",
    "media-supplied",
  ],
);
for (const forbidden of ["public", "confidential", "secret", "pii", "personal"]) {
  assert.ok(
    !DATA_CLASSES.some((c) => c.includes(forbidden)),
    `no data class claims a sensitivity (${forbidden}) — no authority for that exists`,
  );
}
assert.deepEqual([...TRAINING_TREATMENTS], ["none", "customer-opt-in", "provider-default"]);
assert.deepEqual([...RETENTION_CLASSES], ["zero-data-retention", "bounded-30-days", "extended"]);
assert.deepEqual([...ZDR_STATES], ["enabled", "not-enabled"]);
assert.deepEqual([...IDENTITY_STATUSES], ["verified", "attested"]);
assert.ok(CONTRACT_SURFACES.includes("higgsfield-enterprise-agreement"));
assert.ok(isServiceScope("anthropic/messages") && !isServiceScope("anthropic/*") && !isServiceScope(""));
assert.ok(isPurpose("assistance") && !isPurpose("ai"));
assert.ok(isDataClass("knowledge") && !isDataClass("everything"));

assert.equal(EXTERNAL_AI_DATA_USE_DOMAIN, "external-ai-data-use");
assert.equal(TENANT_EXTERNAL_AI_DATA_USE_SUBJECT_TYPE, "tenant_external_ai_data_use_authorization");
assert.equal(TENANT_EXTERNAL_AI_DATA_USE_AUTHORIZED_OUTCOME, "external-ai-data-use-authorized");
assert.equal(TENANT_EXTERNAL_AI_DATA_USE_WITHDRAWN_OUTCOME, "external-ai-data-use-withdrawn");

/* ── 2. THE RECORDED POLICY: Higgsfield DENIED everywhere, the three B1D cells ALLOWED, everything
 * else UNKNOWN. ──────────────────────────────────────────────────────────────────────────────── */
const B1D_ALLOWED = new Set(["anthropic/messages|assistance|conversation", "anthropic/messages|assistance|knowledge", "anthropic/messages|assistance|work-artifact"]);
for (const serviceScope of SERVICE_SCOPES) {
  for (const purpose of PURPOSES) {
    for (const dataClass of DATA_CLASSES) {
      const verdict = decidePlatformDisclosure({ serviceScope, purpose, dataClass });
      if (serviceScope.startsWith("higgsfield/")) {
        assert.equal(verdict.decision, "denied", `${serviceScope} × ${purpose} × ${dataClass} is DENIED`);
        assert.match(verdict.basis, /Higgsfield/);
      } else if (B1D_ALLOWED.has(`${serviceScope}|${purpose}|${dataClass}`)) {
        assert.equal(verdict.decision, "allowed", `${serviceScope} × ${purpose} × ${dataClass} is ALLOWED (B1D)`);
      } else {
        assert.equal(verdict.decision, "unknown", `${serviceScope} × ${purpose} × ${dataClass} is UNKNOWN`);
      }
    }
  }
}
assert.equal(RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells.length, 3, "B1D records exactly three ALLOWED cells");

/* ── 3. NOT AN ACCIDENT: the recorded policy's TYPE has room for those three cells only. ────── */
const policySource = readFileSync(
  path.join(ROOT, "src/features/external-ai-data-use/platform-disclosure-policy.ts"),
  "utf8",
);
assert.match(
  policySource,
  /allowedCells:\s*readonly RecordedAllowedCell\[\]/,
  "the recorded policy declares `allowedCells: readonly RecordedAllowedCell[]` — another ALLOW is a reviewed type change",
);
assert.match(
  policySource,
  /readonly serviceScope: "anthropic\/messages";\s*readonly purpose: "assistance";\s*readonly dataClass: "conversation" \| "knowledge" \| "work-artifact";/,
  "the recorded cell type names one scope, one purpose and three data classes",
);
assert.ok(!/\bwildcard\b|"\*"/.test(policySource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "no wildcard");

/* ── 4. AN INJECTED (test-only) ALLOWED cell is honoured exactly, and only, for its own cell. ── */
const bounds = {
  maxTraining: "none",
  maxRetention: "bounded-30-days",
  contractSurfaces: ["anthropic-commercial-terms"],
  minimumIdentity: "attested",
  zdrRequired: false,
} as const;
const cell: AllowedPlatformCell = {
  serviceScope: "anthropic/messages",
  purpose: "assistance",
  dataClass: "knowledge",
  decision: "allowed",
  bounds,
  evidence: "test fixture",
};
const injected: PlatformDisclosurePolicy = { deniedServiceScopes: [], allowedCells: [cell] };
assert.equal(
  decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass: "knowledge" }, injected)
    .decision,
  "allowed",
);
assert.equal(
  decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass: "organization" }, injected)
    .decision,
  "unknown",
  "an ALLOW for one class is never an ALLOW for another",
);
assert.equal(
  decidePlatformDisclosure(
    { serviceScope: "anthropic/messages", purpose: "agent-origination", dataClass: "knowledge" },
    injected,
  ).decision,
  "unknown",
  "an ALLOW for one purpose is never an ALLOW for another",
);
/* A denied scope wins over any cell naming it. */
const conflicting: PlatformDisclosurePolicy = {
  deniedServiceScopes: [{ serviceScope: "anthropic/messages", decision: "denied", evidence: "test" }],
  allowedCells: [cell],
};
assert.equal(
  decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass: "knowledge" }, conflicting)
    .decision,
  "denied",
);

/* ── 5. BOUNDS: an attestation must sit inside every bound, or the cell does not apply. ──────── */
const within = {
  identityStatus: "attested",
  contractSurface: "anthropic-commercial-terms",
  training: "none",
  retentionClass: "bounded-30-days",
  zdr: "not-enabled",
} as const;
assert.equal(attestationSatisfiesBounds(within, bounds), true);
assert.equal(attestationSatisfiesBounds({ ...within, training: "customer-opt-in" }, bounds), false, "training opt-in is wider");
assert.equal(attestationSatisfiesBounds({ ...within, retentionClass: "extended" }, bounds), false, "longer retention is wider");
assert.equal(attestationSatisfiesBounds({ ...within, retentionClass: "zero-data-retention" }, bounds), true, "ZDR is narrower");
assert.equal(attestationSatisfiesBounds({ ...within, contractSurface: "openai-services-agreement" }, bounds), false);
assert.equal(attestationSatisfiesBounds({ ...within, identityStatus: "verified" }, bounds), true, "verified exceeds attested");
assert.equal(
  attestationSatisfiesBounds(within, { ...bounds, minimumIdentity: "verified" }),
  false,
  "attested does not meet a verified minimum",
);
assert.equal(attestationSatisfiesBounds(within, { ...bounds, zdrRequired: true }), false);

console.log("PASS external-ai-data-use-1a vocabulary-and-policy");
