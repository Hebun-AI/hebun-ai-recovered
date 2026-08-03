import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "features", "enterprise-memory-admission");
const files = readdirSync(root).filter((name) => name.endsWith(".ts"));

/** Remove block and line comments so documentation prose is not scanned as code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Forbidden technology must not appear in actual code (comments excluded).
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8")).toLowerCase();
  for (const forbidden of [
    "postgres", "drizzle", "\"pg\"", "vector", "embedding", "kafka", "outbox",
    "react", "next/", "enterprise-persistence", "enterprise-event-bus",
    "enterprise-unit-of-work", "enterprise-runtime", "runtime-composition",
  ]) {
    assert.equal(code.includes(forbidden), false, `${file} code must not reference ${forbidden}`);
  }
}

// Architecture goal: Admission → Memory Contracts only. Every cross-feature
// import must target enterprise-memory or the admission feature itself.
const importPattern = /from\s+"(@\/features\/[^"]+)"/g;
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of code.matchAll(importPattern)) {
    const target = match[1];
    const allowed =
      target === "@/features/enterprise-memory" ||
      target.startsWith("@/features/enterprise-memory-admission/");
    assert.equal(allowed, true, `${file} may only import Memory Contracts, imported ${target}`);
  }
}

// Barrel exposes types only — no runtime bindings leak out of the feature.
const barrel = readFileSync(join(root, "index.ts"), "utf8");
assert.equal(/^export\s+(?!type\b)/m.test(barrel), false, "index.ts must export types only");

// No suppression directives anywhere in the feature.
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const directive of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable"]) {
    assert.equal(source.includes(directive), false, `${file} must not contain ${directive}`);
  }
}

console.log("Enterprise Memory Admission boundary checks passed");
