/*
 * WF-3A — the grounding universe is a READ composition and is INERT.
 *
 *   - its two modules import exactly the released readers/evaluators they compose, and nothing that
 *     could call a model, disclose to a provider, write Knowledge or Governance, or file an action;
 *   - nothing under src/ imports it yet (WF-3C wires it);
 *   - it makes no network call by construction.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DIR = "src/features/knowledge-grounding";

const ALLOWED: Record<string, readonly string[]> = {
  "contracts.ts": [
    "@/features/knowledge/contracts",
    "@/features/knowledge-retrieval/contracts",
    "@/features/secure-content-admissibility/evaluate",
  ],
  "read-grounding-universe.server.ts": [
    "@/features/auth/tenant/tenant-context",
    "@/features/knowledge/knowledge-read.server",
    "@/features/governance-decision/knowledge-rejection-read.server",
    "@/features/knowledge-retrieval/eligibility",
    "@/features/secure-content-admissibility/knowledge-facts.server",
    "./contracts",
  ],
};

const FORBIDDEN = /heby-model|agent-origination|external-ai-data-use|heby-action|action-authorization|action-execution|governance-audit|knowledge-ratification\/ratify|knowledge-create|knowledge-supersede|durable-knowledge-writer|retract-source|organizational-work/;

function importsOf(source: string): string[] {
  return [...source.matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"/gm)].map((m) => m[1]!);
}

assert.deepEqual(readdirSync(DIR).sort(), Object.keys(ALLOWED).sort(), "exactly the two modules");
for (const [file, allowed] of Object.entries(ALLOWED)) {
  const source = readFileSync(path.join(DIR, file), "utf8");
  const imports = importsOf(source);
  assert.deepEqual([...imports].sort(), [...allowed].sort(), `${file} imports exactly its composed authorities`);
  for (const spec of imports) assert.ok(!FORBIDDEN.test(spec), `${file} must not import ${spec}`);
  assert.ok(!/\bfetch\s*\(/.test(source), `${file} makes no network call`);
  assert.ok(!/\.(insert|update|delete)\s*\(|\bexecute\s*\(/.test(source), `${file} issues no statement of its own`);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const importers = walk("src").filter((f) => !f.startsWith(DIR) && readFileSync(f, "utf8").includes("knowledge-grounding/"));
assert.deepEqual(importers, [], "inert: no runtime module consumes the grounding universe yet");

console.log("wf3a firewall checks passed");
