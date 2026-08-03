import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Enterprise Memory is a technology-neutral contract foundation. Its source must
// not leak persistence, runtime, transport, or AI concerns.
const memoryRoot = join(process.cwd(), "src", "features", "enterprise-memory");
for (const file of readdirSync(memoryRoot).filter((name) => name.endsWith(".ts"))) {
  const source = readFileSync(join(memoryRoot, file), "utf8").toLowerCase();
  for (const forbidden of [
    "react", "next/", "\"pg\"", "postgres", "drizzle", " sql", "vector", "embedding",
    "openai", "anthropic", "enterprise-persistence", "enterprise-event-bus",
    "enterprise-unit-of-work", "enterprise-runtime", "repository", "kafka", "outbox",
  ]) {
    assert.equal(source.includes(forbidden), false, `${file} must not reference ${forbidden.trim()}`);
  }
}

// Phase 1 introduces contracts only — every export is a type. Guard against
// accidental value/implementation leakage by asserting the barrel exposes no
// runtime bindings (all re-exports are `export type`).
const barrel = readFileSync(join(memoryRoot, "index.ts"), "utf8");
assert.equal(/^export\s+(?!type\b)/m.test(barrel), false, "index.ts must export types only");

console.log("Enterprise Memory boundary checks passed");
