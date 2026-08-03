import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "features", "enterprise-memory-persistence");
const files = readdirSync(root).filter((name) => name.endsWith(".ts"));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// The persistence feature must not depend on retrieval, AI, UI, Event Bus
// publication surfaces, or ORM types in its code (comments excluded).
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8")).toLowerCase();
  for (const forbidden of [
    "drizzle", "react", "next/", "embedding", "vector", "similarity", "retrieval",
    "openai", "anthropic", "kafka",
  ]) {
    assert.equal(code.includes(forbidden), false, `${file} code must not reference ${forbidden}`);
  }
}

// Cross-feature imports are restricted to the published Memory contracts, the
// admission engine (approved result), persistence primitives, and the UnitOfWork.
const ALLOWED_EXACT = new Set([
  "@/features/enterprise-memory",
  "@/features/enterprise-memory-admission",
  "@/features/enterprise-memory-admission-engine",
  "@/features/enterprise-persistence",
  "@/features/enterprise-persistence/postgresql",
  "@/features/enterprise-domain-events",
  "@/features/enterprise-event-bus",
  "@/features/enterprise-unit-of-work",
]);
const importPattern = /from\s+"(@\/features\/[^"]+)"/g;
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of code.matchAll(importPattern)) {
    const target = match[1];
    const allowed = ALLOWED_EXACT.has(target) || target.startsWith("@/features/enterprise-memory-persistence/");
    assert.equal(allowed, true, `${file} imports a forbidden module: ${target}`);
  }
}

// The port must not leak storage concepts (comments excluded — they document
// exactly what is forbidden, and naming it in prose is not exposure).
const port = stripComments(readFileSync(join(root, "port.ts"), "utf8")).toLowerCase();
for (const leak of ["sql", "postgres", "drizzle", "queryresult", "jsonb"]) {
  assert.equal(port.includes(leak), false, `port.ts must not expose ${leak}`);
}

// No suppression directives, no unsafe casts to any.
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const banned of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable", "as any", ": any"]) {
    assert.equal(source.includes(banned), false, `${file} must not contain ${banned}`);
  }
}

console.log("Enterprise Memory Persistence boundary checks passed");
