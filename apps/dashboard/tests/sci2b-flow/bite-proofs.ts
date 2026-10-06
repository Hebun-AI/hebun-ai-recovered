/*
 * SCI-2B — bite-proofs for the pure evaluator and the ratification match.
 *
 * Each defect is the shipped source with one condition removed, written to a scratch module and
 * run against the same case tables as evaluator.ts. Every defect must make at least one case fail,
 * and the case that fails must be the one guarding that condition.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runCases, runRatificationCases } from "./evaluator";

const EVALUATE = readFileSync("src/features/secure-content-admissibility/evaluate.ts", "utf8");
const FACTS = readFileSync("src/features/secure-content-admissibility/knowledge-facts.server.ts", "utf8");
const VERIFY_FN = FACTS.slice(FACTS.indexOf("export function ratificationVerified"), FACTS.indexOf("\n}\n", FACTS.indexOf("export function ratificationVerified")) + 3);

function mutate(source: string, find: string, replace: string): string {
  assert.equal(source.split(find).length, 2, `find-string present exactly once: ${find}`);
  return source.replace(find, replace);
}

const EVALUATOR_DEFECTS: ReadonlyArray<readonly [name: string, find: string, replace: string, guards: string]> = [
  ["ratification condition removed", 'if (facts.ratified !== true) return ineligible("ratification-required");', "", "unratified"],
  ["tenant condition removed", 'if (!trustedTenantId || facts.ownerTenantId !== trustedTenantId) return ineligible("tenant-mismatch");', "", "tenant mismatch"],
  ["active/in-force condition removed", 'if (facts.activeAndInForce !== true) return ineligible("inactive-version");', "", "inactive / superseded / retracted"],
  ["integrity condition removed", 'if (facts.integrityFromCreation !== true) return ineligible("integrity-unestablished");', "", "integrity NULL (legacy)"],
  ["unsupported content class opened", 'if (facts.contentClass !== "knowledge") return ineligible("unsupported-content-class");', "", "provider observation"],
  ["unsupported purpose opened", 'if (!(ADMISSIBILITY_PURPOSES as readonly string[]).includes(purpose)) return ineligible("policy-not-permitted");', "", "wrong purpose"],
  ["UNAVAILABLE mapped to ELIGIBLE", 'if (read.status !== "read") return { status: "unavailable", reason: "authoritative-facts-unavailable" };', 'if (read.status !== "read") return { status: "eligible" };', "reader unavailable → UNAVAILABLE"],
];

async function main(): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), "sci2b-bite-"));
  try {
    let n = 0;
    for (const [name, find, replace, guards] of EVALUATOR_DEFECTS) {
      const file = path.join(dir, `evaluate-${(n += 1)}.ts`);
      writeFileSync(file, mutate(EVALUATE, find, replace));
      const broken = (await import(pathToFileURL(file).href)) as typeof import("../../src/features/secure-content-admissibility/evaluate");
      const failures = runCases(broken.evaluateAdmissibility);
      assert.ok(failures.includes(guards), `${name}: caught by "${guards}" (failed: ${failures.join(", ") || "none"})`);
    }

    const verifyFile = path.join(dir, "verify.ts");
    writeFileSync(verifyFile, mutate(VERIFY_FN, "governanceRatifyDecisionIds.has(claimedDecisionId)", "true"));
    const brokenVerify = (await import(pathToFileURL(verifyFile).href)) as { ratificationVerified: (c: string | null, s: ReadonlySet<string>) => boolean };
    assert.ok(runRatificationCases(brokenVerify.ratificationVerified).length > 0, "ratification matching removed: caught");

    console.log(`sci2b bite-proofs passed (${EVALUATOR_DEFECTS.length + 1} defects caught)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
