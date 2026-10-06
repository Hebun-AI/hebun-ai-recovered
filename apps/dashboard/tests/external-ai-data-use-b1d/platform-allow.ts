/*
 * EXTERNAL-AI-DATA-USE-B1D — the first platform ALLOW, proven pure.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "The recorded platform policy ALLOWS exactly anthropic/messages × assistance × {conversation,
 *    knowledge, work-artifact}, each under the exact Director bounds, bound by its evidence to the
 *    admitted B1C attestation and the reviewed B1B record — whose treatment sits inside those bounds,
 *    while any wider treatment does not. Every other Anthropic cell and every OpenAI cell is UNKNOWN,
 *    Higgsfield is DENIED, the resolver still discloses nothing without a tenant authorization, and
 *    no runtime path consults any of it."
 *
 * No database, no provider, no network, no credential.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DATA_CLASSES, PURPOSES, SERVICE_SCOPES } from "../../src/features/external-ai-data-use/contracts";
import {
  ANTHROPIC_ASSISTANCE_BOUNDS,
  RECORDED_PLATFORM_DISCLOSURE_POLICY,
  attestationSatisfiesBounds,
  decidePlatformDisclosure,
  type AttestationTreatment,
} from "../../src/features/external-ai-data-use/platform-disclosure-policy";
import { composeExternalAiDisclosure, type DisclosureComposeInput } from "../../src/features/external-ai-data-use/compose-external-ai-disclosure";
import { parseAttestationRecord } from "../../scripts/lib/processor-attestation";

const ROOT = path.resolve(__dirname, "../..");
const REPO = path.resolve(ROOT, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx|mjs)$/.test(name) ? [rel] : [];
  });
}

const ADMITTED_ATTESTATION_ID = "ffb0c160-4082-4c7f-be6a-05a4d990c598";
const REVIEWED_RECORD = "docs/product-vision/runtime/hebun-external-ai-data-use-b1b-anthropic-processor-attestation-record.md";
const REVIEWED_RECORD_REF = `${REVIEWED_RECORD}@dbbe8a30bbaa2d6d396cb914a21e28735537fe33`;
const ALLOWED = ["conversation", "knowledge", "work-artifact"] as const;
/* APF-3 (Director, 2026-10-06): origination's narrow projection, appended after B1D's three. */
const ORIGINATION_ALLOWED = ["conversation", "organization"] as const;

/* ── 1. EXACTLY THREE CELLS, EXACTLY THESE BOUNDS. ─────────────────────────────────────────────── */
const policy = RECORDED_PLATFORM_DISCLOSURE_POLICY;
assert.deepEqual(
  policy.allowedCells.map((c) => [c.serviceScope, c.purpose, c.dataClass, c.decision]),
  [
    ...ALLOWED.map((d) => ["anthropic/messages", "assistance", d, "allowed"]),
    ...ORIGINATION_ALLOWED.map((d) => ["anthropic/messages", "agent-origination", d, "allowed"]),
  ],
  "exactly the three B1D cells and APF-3's two, in order",
);
const EXPECTED_BOUNDS = {
  contractSurfaces: ["anthropic-commercial-terms"],
  maxTraining: "none",
  maxRetention: "bounded-30-days",
  minimumIdentity: "attested",
  zdrRequired: false,
};
assert.deepEqual(JSON.parse(JSON.stringify(ANTHROPIC_ASSISTANCE_BOUNDS)), EXPECTED_BOUNDS, "the Director's bounds, exactly");
for (const cell of policy.allowedCells) {
  assert.equal(cell.bounds, ANTHROPIC_ASSISTANCE_BOUNDS, `${cell.dataClass}: the common bounds, not a copy that could drift`);
  assert.ok(Object.isFrozen(cell) && Object.isFrozen(cell.bounds) && Object.isFrozen(cell.bounds.contractSurfaces), "frozen");
  /* The evidence binds the ALLOW to the admitted attestation and its reviewed record, and states what is unverified. */
  assert.ok(cell.evidence.includes(ADMITTED_ATTESTATION_ID), "names the admitted B1C attestation");
  assert.ok(cell.evidence.includes(REVIEWED_RECORD_REF), "names the reviewed B1B record at its commit");
  assert.match(cell.evidence, /attested — not verified/);
  assert.match(cell.evidence, /credential ↔ observed Dashboard key equality/);
  assert.match(cell.evidence, /BAA/);
  assert.match(cell.evidence, /per-request processing geography/);
  assert.match(cell.evidence, /not claimed free of personal data/);
}
assert.ok(Object.isFrozen(policy) && Object.isFrozen(policy.allowedCells) && Object.isFrozen(policy.deniedServiceScopes));

/* ── 2. EVERY CELL: three ALLOWED, Higgsfield DENIED, all else UNKNOWN. ───────────────────────── */
let allowedCount = 0;
for (const serviceScope of SERVICE_SCOPES) {
  for (const purpose of PURPOSES) {
    for (const dataClass of DATA_CLASSES) {
      const verdict = decidePlatformDisclosure({ serviceScope, purpose, dataClass });
      const label = `${serviceScope} × ${purpose} × ${dataClass}`;
      if (serviceScope.startsWith("higgsfield/")) {
        assert.equal(verdict.decision, "denied", `${label} stays DENIED`);
      } else if (
        serviceScope === "anthropic/messages" &&
        ((purpose === "assistance" && (ALLOWED as readonly string[]).includes(dataClass)) ||
          (purpose === "agent-origination" && (ORIGINATION_ALLOWED as readonly string[]).includes(dataClass)))
      ) {
        assert.equal(verdict.decision, "allowed", `${label} is ALLOWED`);
        if (verdict.decision === "allowed") assert.equal(verdict.bounds, ANTHROPIC_ASSISTANCE_BOUNDS);
        allowedCount += 1;
      } else {
        assert.equal(verdict.decision, "unknown", `${label} stays UNKNOWN`);
      }
    }
  }
}
assert.equal(allowedCount, 5, "five ALLOWED cells across the whole vocabulary");
/* The classes and purposes the Director named as NOT authorized, spelled out. */
for (const purpose of ["relevance-selection", "media-generation"] as const) {
  for (const dataClass of ALLOWED) {
    assert.equal(decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose, dataClass }).decision, "unknown", `${purpose} × ${dataClass}`);
  }
}
for (const dataClass of ["provider-observation", "organization", "governance-record", "operational-record", "external-recipient", "media-generated", "media-supplied"] as const) {
  assert.equal(decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "assistance", dataClass }).decision, "unknown", `assistance × ${dataClass}`);
}
/* APF-3 — what origination may NOT disclose, spelled out. */
for (const dataClass of ["knowledge", "work-artifact", "external-recipient", "provider-observation", "governance-record", "operational-record", "media-generated", "media-supplied"] as const) {
  assert.equal(decidePlatformDisclosure({ serviceScope: "anthropic/messages", purpose: "agent-origination", dataClass }).decision, "unknown", `agent-origination × ${dataClass}`);
}

/* ── 3. THE ADMITTED B1C ATTESTATION SATISFIES THE BOUNDS — read from the reviewed record itself. ── */
const parsed = parseAttestationRecord(readFileSync(path.join(REPO, REVIEWED_RECORD), "utf8"));
assert.equal(parsed.status, "parsed", "the reviewed B1B record parses with the committed ceremony parser");
if (parsed.status !== "parsed") throw new Error("unreachable");
const admitted: AttestationTreatment = parsed.record;
assert.equal(parsed.record.serviceScope, "anthropic/messages");
assert.deepEqual(
  [admitted.identityStatus, admitted.contractSurface, admitted.training, admitted.retentionClass, admitted.zdr],
  ["attested", "anthropic-commercial-terms", "none", "bounded-30-days", "not-enabled"],
  "the treatment B1C admitted (identity attested, not verified)",
);
assert.ok(attestationSatisfiesBounds(admitted, ANTHROPIC_ASSISTANCE_BOUNDS), "the admitted attestation is inside every bound");
assert.ok(attestationSatisfiesBounds({ ...admitted, identityStatus: "verified" }, ANTHROPIC_ASSISTANCE_BOUNDS), "a narrower identity also fits");
assert.ok(attestationSatisfiesBounds({ ...admitted, zdr: "enabled" }, ANTHROPIC_ASSISTANCE_BOUNDS), "ZDR is not required, and does not hurt");
for (const [label, wider] of [
  ["retention extended", { ...admitted, retentionClass: "extended" }],
  ["training on customer opt-in", { ...admitted, training: "customer-opt-in" }],
  ["training by provider default", { ...admitted, training: "provider-default" }],
  ["another contract surface", { ...admitted, contractSurface: "openai-services-agreement" }],
] as const) {
  assert.equal(attestationSatisfiesBounds(wider as AttestationTreatment, ANTHROPIC_ASSISTANCE_BOUNDS), false, `${label} falls outside the bounds`);
}

/* ── 4. THE RESOLVER STILL FAILS CLOSED WITHOUT A TENANT AUTHORIZATION. ─────────────────────────── */
const inForce = {
  id: ADMITTED_ATTESTATION_ID,
  serviceScope: "anthropic/messages" as const,
  accountRef: parsed.record.accountRef,
  attestationRevision: 1,
  ...admitted,
  state: "active" as const,
};
for (const dataClass of ALLOWED) {
  const base: DisclosureComposeInput = {
    request: { serviceScope: "anthropic/messages", purpose: "assistance", requiredDataClasses: [dataClass], modelId: "claude-haiku-4-5-20251001" },
    policy,
    accountRef: parsed.record.accountRef,
    attestation: { status: "read", latest: inForce as never },
    tenant: { status: "absent" },
    operatorEnabled: true,
    providerAvailable: true,
  };
  for (const [input, expected] of [
    [base, "tenant-not-authorized"],
    [{ ...base, tenant: { status: "unavailable" } }, "unavailable"],
    [{ ...base, attestation: { status: "absent" } }, "platform-unknown"],
    [{ ...base, accountRef: null }, "platform-unknown"],
    [{ ...base, attestation: { status: "read", latest: { ...inForce, retentionClass: "extended" } as never } }, "platform-denied"],
  ] as const) {
    const decision = composeExternalAiDisclosure(input as DisclosureComposeInput);
    assert.equal(decision.disposition, expected, `${dataClass}: ${expected}`);
    assert.equal(decision.authorizationId, null);
    assert.deepEqual(decision.authorizedDataClasses, []);
  }
}

/* ── 5. NOTHING AT RUNTIME CONSULTS IT, AND THE POLICY CALLS NOTHING. ──────────────────────────── */
const SRC = walk("src");
const importers = SRC.filter(
  (f) => !f.startsWith("src/features/external-ai-data-use") && /from\s+["']@\/features\/external-ai-data-use\//.test(read(f)),
).sort();
/* B2 connected the runtime through the generator's gate; the importer set is pinned in the 1A firewall. */
assert.ok(importers.includes("src/features/heby-model/heby-model-generation.server.ts"), "the runtime reaches the data-use authority (B2)");
for (const file of SRC.filter((f) => /^src\/features\/(media|agent-origination|heby-model-live)/.test(f))) {
  assert.ok(!/from\s+["']@\/features\/external-ai-data-use\//.test(read(file)), `${file} does not import the data-use authority`);
}
const policyCode = stripComments(read("src/features/external-ai-data-use/platform-disclosure-policy.ts"));
assert.ok(!/\bimport\b[^;]*from\s+["'](?!\.\/contracts["'])/.test(policyCode), "the policy imports only its vocabulary");
assert.ok(!/\bfetch\(|process\.env|anthropic\.com/.test(policyCode), "the policy calls no provider and reads no credential");

console.log("PASS external-ai-data-use-b1d platform-allow");
