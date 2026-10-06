/*
 * SCI-2B — the admissibility evaluator, pure, and what it is not allowed to reach.
 *
 * CASES is exported: bite-proofs.ts runs the same table against deliberately broken copies.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  evaluateAdmissibility,
  type AdmissibilityFacts,
  type AdmissibilityFactsRead,
  type Admissibility,
} from "../../src/features/secure-content-admissibility/evaluate";
import { ratificationVerified } from "../../src/features/secure-content-admissibility/knowledge-facts.server";

const TENANT = "10000000-0000-4000-8000-0000000000a1";
const OTHER = "10000000-0000-4000-8000-0000000000b1";
const PURPOSE = "agent-record-work-grounding";
const GOOD: AdmissibilityFacts = {
  contentClass: "knowledge",
  versionId: "90000000-0000-4000-8000-000000000001",
  ownerTenantId: TENANT,
  activeAndInForce: true,
  ratified: true,
  integrityFromCreation: true,
};
const read = (patch: Partial<AdmissibilityFacts> = {}): AdmissibilityFactsRead => ({
  status: "read",
  facts: { ...GOOD, ...patch },
});
const no = (reason: string) => ({ status: "ineligible", reason });

export const CASES: ReadonlyArray<readonly [name: string, tenant: string, purpose: string, read: AdmissibilityFactsRead, expected: Admissibility]> = [
  ["active + verified-ratified + integrity → ELIGIBLE", TENANT, PURPOSE, read(), { status: "eligible" }],
  ["unratified", TENANT, PURPOSE, read({ ratified: false }), no("ratification-required") as Admissibility],
  ["inactive / superseded / retracted", TENANT, PURPOSE, read({ activeAndInForce: false }), no("inactive-version") as Admissibility],
  ["integrity NULL (legacy)", TENANT, PURPOSE, read({ integrityFromCreation: false }), no("integrity-unestablished") as Admissibility],
  ["tenant mismatch", OTHER, PURPOSE, read(), no("tenant-mismatch") as Admissibility],
  ["empty trusted tenant", "", PURPOSE, read({ ownerTenantId: "" }), no("tenant-mismatch") as Admissibility],
  ["provider observation", TENANT, PURPOSE, read({ contentClass: "provider-observation" }), no("unsupported-content-class") as Admissibility],
  ["wrong purpose", TENANT, "assistance", read(), no("policy-not-permitted") as Admissibility],
  ["wrong purpose wins over unavailable", TENANT, "send", { status: "unavailable" }, no("policy-not-permitted") as Admissibility],
  ["reader unavailable → UNAVAILABLE", TENANT, PURPOSE, { status: "unavailable" }, { status: "unavailable", reason: "authoritative-facts-unavailable" }],
];

export function runCases(evaluate: typeof evaluateAdmissibility): string[] {
  const failures: string[] = [];
  for (const [name, tenant, purpose, input, expected] of CASES) {
    try {
      assert.deepEqual(evaluate(tenant, purpose, input), expected, name);
    } catch {
      failures.push(name);
    }
  }
  return failures;
}

export const RATIFICATION_CASES: ReadonlyArray<readonly [name: string, claimed: string | null, ids: string[], expected: boolean]> = [
  ["claim matches a Governance ratify decision", "d1", ["d1"], true],
  ["no claim", null, ["d1"], false],
  ["claim names another decision", "d2", ["d1"], false],
  ["Governance holds no ratify decision (reject / wrong subject / other tenant)", "d1", [], false],
];

export function runRatificationCases(verify: typeof ratificationVerified): string[] {
  return RATIFICATION_CASES.filter(([, claimed, ids, expected]) => verify(claimed, new Set(ids)) !== expected).map(([n]) => n);
}

function main(): void {
  assert.deepEqual(runCases(evaluateAdmissibility), []);
  assert.deepEqual(runRatificationCases(ratificationVerified), []);

  /* The descriptor is exactly these six facts: no text origin, ingestion path, source type or Drive. */
  const keys = Object.keys(GOOD).sort();
  assert.deepEqual(keys, ["activeAndInForce", "contentClass", "integrityFromCreation", "ownerTenantId", "ratified", "versionId"]);
  // Extra provenance riding along changes nothing: it is not an input.
  const withProvenance = { status: "read", facts: { ...GOOD, textOrigin: "unknown", driveRef: null } } as unknown as AdmissibilityFactsRead;
  assert.deepEqual(evaluateAdmissibility(TENANT, PURPOSE, withProvenance), { status: "eligible" });
  const driveButUnratified = { status: "read", facts: { ...GOOD, ratified: false, driveRef: "doc" } } as unknown as AdmissibilityFactsRead;
  assert.deepEqual(evaluateAdmissibility(TENANT, PURPOSE, driveButUnratified), no("ratification-required"));

  /* No trust vocabulary in the contract. */
  const core = readFileSync("src/features/secure-content-admissibility/evaluate.ts", "utf8");
  const code = core.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const literals = [...code.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
  assert.deepEqual(literals.filter((l) => /\b(safe|trusted|clean|malicious)\b/i.test(l)), []);

  /* FIREWALL. The core imports nothing; the composition imports only the two authoritative readers. */
  const imports = (file: string) =>
    [...readFileSync(file, "utf8").matchAll(/^import[\s\S]*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
  assert.deepEqual(imports("src/features/secure-content-admissibility/evaluate.ts"), []);
  assert.deepEqual(imports("src/features/secure-content-admissibility/knowledge-facts.server.ts").sort(), [
    "./evaluate",
    "@/features/auth/tenant/tenant-context",
    "@/features/governance-decision/knowledge-ratification-read.server",
    "@/features/knowledge/version-standing.server",
  ]);
  const readers = [
    "src/features/knowledge/version-standing.server.ts",
    "src/features/governance-decision/knowledge-ratification-read.server.ts",
  ];
  for (const file of readers) {
    const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/\b(insert|update|delete)\s+(into\s+)?\w+|\.insert\(|\.update\(|\.delete\(|transaction\(/i.test(text), `${file} writes nothing`);
    assert.ok(!/heby-model|provider-|anthropic|fetch\(|agent-origination|action-authorization|execution/i.test(
      imports(file).join(" ")), `${file} reaches no model, provider, agent, authorization or execution`);
  }
  // Inert: nothing in src consumes the primitive yet (WF-3 is not wired).
  const consumers = execSync("grep -rl 'secure-content-admissibility' src || true", { encoding: "utf8" })
    .trim().split("\n").filter(Boolean).filter((f) => !f.startsWith("src/features/secure-content-admissibility/"));
  assert.deepEqual(consumers, [], "SCI-2B is not wired into any runtime path");

  console.log("sci2b evaluator checks passed");
}

if (process.argv[1]?.endsWith("evaluator.ts")) main();
