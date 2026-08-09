import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
 * Company Memory boundary contract (Hebun UI Phase 21B).
 *
 * The Company Memory surface reads the REAL Enterprise Memory authority and nothing
 * else. It must never import the seeded memory-runtime projection, memory-engine, the
 * legacy memory registry, mocks, or seeds; it must never write, admit, or mutate
 * memory; and the authoritative page must no longer render seeded memory as truth.
 */

const featureDir = join(process.cwd(), "src", "features", "company-memory");
const featureFiles = readdirSync(featureDir).filter((name) => name.endsWith(".ts"));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}

/* company-memory feature may only depend on the real Enterprise Memory read stack + auth. */
const ALLOWED_FEATURES = new Set([
  "@/features/enterprise-memory",
  "@/features/enterprise-memory-persistence",
  "@/features/enterprise-memory-query",
  "@/features/enterprise-unit-of-work",
  "@/features/enterprise-runtime-composition",
  "@/features/auth",
]);

const FORBIDDEN_IMPORT_FRAGMENTS = [
  "memory-runtime",
  "runtime-projection",
  "memory-engine",
  "memory-crud",
  "registries",
  "knowledge-graph",
  "/mock",
  "director/mock",
];

/* No write / admission / mutation may appear anywhere in the read-only surface (code, not comments). */
const FORBIDDEN_CODE_TOKENS = [
  "storeApprovedMemory",
  "persistApprovedMemory",
  "supersedeMemory",
  "archiveMemory",
  "createAdmissionEngine",
  "runAdmissionPipeline",
  "runtimeProjectionRegistry",
  "MemoryRuntimeService",
];

function featureImportsAreClean(): void {
  for (const file of featureFiles) {
    const source = readFileSync(join(featureDir, file), "utf8");
    for (const target of importsOf(source)) {
      for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
        assert.ok(!target.includes(fragment), `${file} must not import ${target} (contains "${fragment}")`);
      }
      if (target.startsWith("@/features/")) {
        const allowed = ALLOWED_FEATURES.has(target) || target.startsWith("@/features/company-memory");
        assert.ok(allowed, `${file} imports a non-allowlisted feature: ${target}`);
      }
    }
  }
}

function noWriteOrAdmission(): void {
  for (const file of featureFiles) {
    const code = stripComments(readFileSync(join(featureDir, file), "utf8"));
    for (const token of FORBIDDEN_CODE_TOKENS) {
      assert.ok(!code.includes(token), `${file} must not reference ${token} (read-only, no admission/write)`);
    }
  }
}

function noSuppressionOrUnsafeCasts(): void {
  for (const file of featureFiles) {
    const source = readFileSync(join(featureDir, file), "utf8");
    for (const banned of ["@ts-ignore", "@ts-expect-error", "@ts-nocheck", "eslint-disable", "as any", ": any"]) {
      assert.ok(!source.includes(banned), `${file} must not contain ${banned}`);
    }
  }
}

function authoritativePageDroppedSeededMemory(): void {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "(dashboard)", "director", "memory", "page.tsx"),
    "utf8",
  );
  for (const target of importsOf(page)) {
    for (const fragment of ["memory-runtime", "memory-engine", "memory-registry-workspace", "runtime-projection"]) {
      assert.ok(!target.includes(fragment), `/director/memory must not import ${target}`);
    }
    assert.ok(
      target !== "@/features/memory",
      "/director/memory must not import the legacy seeded @/features/memory",
    );
  }
  assert.ok(
    importsOf(page).some((t) => t.includes("company-memory")),
    "/director/memory reads the real Enterprise Memory authority via company-memory",
  );
}

function orphanMemoryRetired(): void {
  // Phase 21D retired the /memory orphan: it now permanently redirects to the single
  // authoritative Company Memory surface and no longer renders the legacy seeded runtime.
  const orphan = readFileSync(
    join(process.cwd(), "src", "app", "(dashboard)", "memory", "page.tsx"),
    "utf8",
  );
  assert.ok(
    orphan.includes('permanentRedirect("/director/memory")'),
    "orphan /memory is retired — it redirects to the authoritative Company Memory (Phase 21D)",
  );
  assert.ok(
    !orphan.includes("MemoryRuntimeService"),
    "orphan /memory no longer renders the legacy seeded memory runtime",
  );
}

function main(): void {
  featureImportsAreClean();
  noWriteOrAdmission();
  noSuppressionOrUnsafeCasts();
  authoritativePageDroppedSeededMemory();
  orphanMemoryRetired();
  console.log("company-memory boundary contract checks passed");
}

main();
