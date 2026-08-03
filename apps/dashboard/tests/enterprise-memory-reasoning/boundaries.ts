import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "features", "enterprise-memory-reasoning");
const files = readdirSync(root).filter((name) => name.endsWith(".ts"));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Reasoning contracts must not touch SQL, persistence, retrieval, query, selection,
// engines, AI, agents, or workflows in their code.
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8")).toLowerCase();
  for (const forbidden of [
    "drizzle", "react", "next/", "embedding", "vector", "similarity", "cosine",
    "openai", "anthropic", "postgres", "\"pg\"", "kafka", "timeline", "reflect",
    "enterprise-event-bus", "enterprise-memory-admission", "enterprise-memory-retrieval",
    "enterprise-memory-query", "enterprise-memory-selection", "enterprise-persistence/postgresql",
    ".query(", "random", "workflow", "agent", "llm",
  ]) {
    assert.equal(code.includes(forbidden), false, `${file} code must not reference ${forbidden}`);
  }
}

// Reasoning Phase 1 depends only on published Memory and Context Assembly contracts.
const ALLOWED = new Set([
  "@/features/enterprise-memory",
  "@/features/enterprise-memory-persistence",
  "@/features/enterprise-memory-context",
]);
const importPattern = /from\s+"(@\/features\/[^"]+)"/g;
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of code.matchAll(importPattern)) {
    const target = match[1];
    const allowed = ALLOWED.has(target) || target.startsWith("@/features/enterprise-memory-reasoning/");
    assert.equal(allowed, true, `${file} imports a forbidden module: ${target}`);
  }
}

// No suppression directives, no unsafe casts, no non-null assertions, no randomness.
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const banned of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable", "as any", ": any", "Math.random"]) {
    assert.equal(source.includes(banned), false, `${file} must not contain ${banned}`);
  }
}

console.log("Enterprise Memory Reasoning boundary checks passed");
