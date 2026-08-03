import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "features", "enterprise-memory-context");
const files = readdirSync(root).filter((name) => name.endsWith(".ts"));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Context assembly must not touch SQL, PostgreSQL, retrieval, repository, admission,
// AI, ranking, embeddings, Event Bus, Timeline, or UI in its code.
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8")).toLowerCase();
  for (const forbidden of [
    "drizzle", "react", "next/", "embedding", "vector", "similarity", "cosine",
    "openai", "anthropic", "postgres", "\"pg\"", "kafka", "timeline",
    "enterprise-event-bus", "enterprise-memory-admission", "enterprise-memory-retrieval",
    "enterprise-persistence/postgresql", "reflect", "probabil", "random", "summar", "synthes",
  ]) {
    assert.equal(code.includes(forbidden), false, `${file} code must not reference ${forbidden}`);
  }
}

// Context assembly consumes the Selection Engine — never the repository, retrieval,
// or query directly. Allowed cross-feature imports are bounded accordingly.
const ALLOWED = new Set([
  "@/features/enterprise-memory",
  "@/features/enterprise-memory-persistence",
  "@/features/enterprise-memory-query",
  "@/features/enterprise-memory-selection",
  "@/features/enterprise-persistence",
  "@/features/enterprise-unit-of-work",
]);
const importPattern = /from\s+"(@\/features\/[^"]+)"/g;
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of code.matchAll(importPattern)) {
    const target = match[1];
    const allowed = ALLOWED.has(target) || target.startsWith("@/features/enterprise-memory-context/");
    assert.equal(allowed, true, `${file} imports a forbidden module: ${target}`);
  }
}

// No suppression directives, no unsafe casts, no non-null assertions, no Math.random.
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const banned of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable", "as any", ": any", "Math.random"]) {
    assert.equal(source.includes(banned), false, `${file} must not contain ${banned}`);
  }
}

console.log("Enterprise Memory Context boundary checks passed");
