import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "features", "enterprise-memory-query");
const files = readdirSync(root).filter((name) => name.endsWith(".ts"));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// The query engine must not depend on SQL, AI, ranking, UI, or admission.
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8")).toLowerCase();
  for (const forbidden of [
    "drizzle", "react", "next/", "embedding", "vector", "similarity", "cosine",
    "openai", "anthropic", "postgres", "\"pg\"", "kafka", "timeline",
    "enterprise-event-bus", "enterprise-memory-admission", "ranking", "reflect",
  ]) {
    assert.equal(code.includes(forbidden), false, `${file} code must not reference ${forbidden}`);
  }
}

// Cross-feature imports restricted to Memory, persistence, retrieval, and UnitOfWork.
const ALLOWED = new Set([
  "@/features/enterprise-memory",
  "@/features/enterprise-memory-persistence",
  "@/features/enterprise-memory-retrieval",
  "@/features/enterprise-persistence",
  "@/features/enterprise-unit-of-work",
]);
const importPattern = /from\s+"(@\/features\/[^"]+)"/g;
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of code.matchAll(importPattern)) {
    const target = match[1];
    const allowed = ALLOWED.has(target) || target.startsWith("@/features/enterprise-memory-query/");
    assert.equal(allowed, true, `${file} imports a forbidden module: ${target}`);
  }
}

// No suppression directives, no unsafe casts, no non-null assertions.
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const banned of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable", "as any", ": any"]) {
    assert.equal(source.includes(banned), false, `${file} must not contain ${banned}`);
  }
}

console.log("Enterprise Memory Query boundary checks passed");
