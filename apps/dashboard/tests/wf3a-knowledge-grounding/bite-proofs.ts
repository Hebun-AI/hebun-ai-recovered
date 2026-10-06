/*
 * WF-3A — bite-proofs for the pure contract.
 *
 * Each defect is the shipped source with one condition broken, written to a scratch module (its
 * `@/` imports rewritten to absolute paths) and run against contracts.ts's case table. Every defect
 * must fail at least the case that guards that condition.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runCases } from "./contracts";

const SOURCE = readFileSync("src/features/knowledge-grounding/contracts.ts", "utf8").replaceAll(
  '"@/features/',
  `"${path.resolve("src/features")}/`,
);

function mutate(source: string, find: string, replace: string): string {
  assert.equal(source.split(find).length, 2, `find-string present exactly once: ${find}`);
  return source.replace(find, replace);
}

const SHAPE_CHECK = 'if (typeof element !== "string" || !ALIAS_SHAPE.test(element)) {';

const DEFECTS: ReadonlyArray<readonly [name: string, find: string, replace: string, guards: string]> = [
  ["SCI eligibility removed", 'if (verdict.status === "eligible" && facts.status === "read"', 'if (facts.status === "read"', "unratified excluded"],
  ["ratification ignored", "evaluateAdmissibility(trustedTenantId, KNOWLEDGE_GROUNDING_PURPOSE, facts);", 'evaluateAdmissibility(trustedTenantId, KNOWLEDGE_GROUNDING_PURPOSE, facts.status === "read" ? { ...facts, facts: { ...facts.facts, ratified: true } } : facts);', "unratified excluded"],
  ["tenant isolation removed", "evaluateAdmissibility(trustedTenantId,", 'evaluateAdmissibility(facts.status === "read" ? facts.facts.ownerTenantId : trustedTenantId,', "cross-tenant excluded"],
  ["UNAVAILABLE becomes success", 'if (verdict.status === "unavailable") return refused("authoritative-facts-unavailable");', 'if (verdict.status === "unavailable") continue;', "unavailable fails closed"],
  [">20 truncates", 'return refused("knowledge-universe-exceeds-bound", eligible.length);', "eligible.length = KNOWLEDGE_GROUNDING_MAX_CANDIDATES;", "21 refuses, never truncates"],
  ["ordering removed", "[...eligible].sort(compareGroundingRecords)", "[...eligible]", "deterministic order and aliases"],
  ["statement rewritten", "statement: record.statement!,", "statement: record.statement!.trim(),", "exact statement preserved"],
  ["projection leaks version id", "candidates.map((c) => ({ alias: c.alias, statement: c.statement }))", "candidates.map((c) => ({ alias: c.alias, statement: c.statement, knowledgeNodeId: c.knowledgeNodeId }))", "projection carries alias and statement only"],
  ["alias resolves DB ids", 'if (typeof element !== "string" || !ALIAS_SHAPE.test(element)) {', 'if (typeof element !== "string") {', "malformed reference refused"],
  /* Shape alone already stops a uuid, so this defect also drops the shape check (applied below). */
  ["membership by node id", "candidates.find((c) => c.alias === element)", "candidates.find((c) => c.alias === element || c.knowledgeNodeId === element)", "database ids never resolve"],
  ["zero refs become valid", 'if (value.length === 0) return { status: "refused", reason: "no-knowledge-reference" };', "", "zero references refused"],
  ["size check removed", 'if (eligible.some((record) => codePointLength(record.statement!) > KNOWLEDGE_GROUNDING_MAX_STATEMENT_CODE_POINTS)) {', "if (false) {", "2,001 refuses the whole universe"],
  ["size refusal becomes truncation", 'return refused("knowledge-candidate-too-large", eligible.length);', 'for (const r of eligible) (r as { statement: string }).statement = Array.from(r.statement!).slice(0, KNOWLEDGE_GROUNDING_MAX_STATEMENT_CODE_POINTS).join("");', "2,001 refuses the whole universe"],
  ["UTF-16 length instead of code points", "return Array.from(value).length;", "return value.length;", "non-BMP counted as code points"],
  ["duplicates accepted", 'if (seen.has(element)) return { status: "refused", reason: "duplicate-knowledge-reference" };', "", "duplicate alias refused"],
];

async function main(): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), "wf3a-bite-"));
  try {
    let n = 0;
    for (const [name, find, replace, guards] of DEFECTS) {
      const file = path.join(dir, `contracts-${(n += 1)}.ts`);
      const base = name === "membership by node id" ? mutate(SOURCE, SHAPE_CHECK, 'if (typeof element !== "string") {') : SOURCE;
      writeFileSync(file, mutate(base, find, replace));
      const broken = await import(pathToFileURL(file).href);
      const failures = runCases(broken);
      assert.ok(failures.includes(guards), `${name}: caught by "${guards}" (failed: ${failures.join(", ") || "none"})`);
    }
    console.log(`wf3a bite-proofs passed (${DEFECTS.length} defects caught)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
