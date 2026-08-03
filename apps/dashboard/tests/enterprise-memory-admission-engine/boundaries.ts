import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src", "features", "enterprise-memory-admission-engine");
const files = readdirSync(root).filter((name) => name.endsWith(".ts"));

/** Remove comments so documentation prose is never scanned as code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// Forbidden technology must not appear in actual code.
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

// Architecture: the engine consumes published contracts only. Every cross-feature
// import must target enterprise-memory, enterprise-memory-admission, or the engine.
const importPattern = /from\s+"(@\/features\/[^"]+)"/g;
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const match of code.matchAll(importPattern)) {
    const target = match[1];
    const allowed =
      target === "@/features/enterprise-memory" ||
      target === "@/features/enterprise-memory-admission" ||
      target.startsWith("@/features/enterprise-memory-admission-engine/");
    assert.equal(allowed, true, `${file} may only import published Memory contracts, imported ${target}`);
  }
}

// The engine must not read a clock — determinism requires an injected timestamp.
for (const file of files) {
  const code = stripComments(readFileSync(join(root, file), "utf8"));
  for (const clock of ["Date.now", "new Date", "Math.random", "performance.now"]) {
    assert.equal(code.includes(clock), false, `${file} must not use ${clock} (non-deterministic)`);
  }
}

// No suppression directives anywhere in the feature.
for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const directive of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable"]) {
    assert.equal(source.includes(directive), false, `${file} must not contain ${directive}`);
  }
}

console.log("Enterprise Memory Admission Engine boundary checks passed");
