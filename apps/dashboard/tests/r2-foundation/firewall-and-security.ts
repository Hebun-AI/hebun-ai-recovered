import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getModelAdapterStatus, isModelAvailable } from "../../src/features/heby-runtime/model-adapter";
import { resolveModelConnectivityConfig } from "../../src/features/heby-model";

const HEBY_MODEL_DIR = "src/features/heby-model";

/*
 * Import-based coupling that would breach the R2B firewall: text generation must
 * never reach the agent/execution provider framework, execution, device runtime,
 * Computer Use, or the request/UI layer. Import patterns are used (not bare
 * words) so honest comments do not false-positive.
 */
const FORBIDDEN_IMPORTS = [
  'from "@/features/provider-invocation',
  'from "@/features/provider-framework',
  'from "@/features/provider-routing',
  'from "@/features/provider-matrix',
  'from "@/features/providers',
  'from "@/features/runtime-activation',
  'from "@/features/runtime-boundary',
  'from "@/features/heby-actions',
  'from "@/features/device-runtime',
  'from "@/features/operations',
  'from "@/features/execution',
  'from "next/headers"',
  'from "@/app',
];

/* Dangerous primitives that must never appear (no network, no exec, no SDK). */
const FORBIDDEN_PRIMITIVES = [
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "child_process",
  "execSync",
  "spawn(",
  "@anthropic-ai",
  "import Anthropic",
  "require(",
];

function hebyModelFiles(): string[] {
  return readdirSync(HEBY_MODEL_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(HEBY_MODEL_DIR, f));
}

function main(): void {
  const files = [...hebyModelFiles(), "tests/helpers/fake-claude-transport.ts"];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const forbidden of FORBIDDEN_IMPORTS) {
      assert.equal(source.includes(forbidden), false, `${file} must not import ${forbidden}`);
    }
    for (const forbidden of FORBIDDEN_PRIMITIVES) {
      assert.equal(source.includes(forbidden), false, `${file} must not contain ${forbidden}`);
    }
  }

  // Execution firewall: the fake transport performs no network of any kind.
  const fake = readFileSync("tests/helpers/fake-claude-transport.ts", "utf8");
  assert.equal(/fetch\(|http\.|https\.|net\.|dns\./.test(fake), false);

  // Model boundary default is preserved (integration did not open the boundary).
  assert.equal(isModelAvailable(), false);
  assert.equal(getModelAdapterStatus().available, false);
  assert.equal(getModelAdapterStatus().reason, "no-provider-configured");

  // Secret redaction: the credential value never leaves configuration.
  const config = resolveModelConnectivityConfig({
    HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
    HEBUN_MODEL_PROVIDER: "claude",
    HEBUN_MODEL_ID: "claude-test-model",
    HEBUN_MODEL_CREDENTIAL: "sk-super-secret-do-not-leak",
    HEBUN_MODEL_MAX_OUTPUT_TOKENS: "128",
  });
  assert.equal(JSON.stringify(config).includes("sk-super-secret-do-not-leak"), false);
  assert.equal(config.credentialPresent, true);

  // Tenant attribution is not client-authoritative: heby-model reaches no client
  // request surface (no next/headers, no @/app import — enforced above), so it
  // cannot fabricate a tenant. tenantId must be supplied server-side by R2C.
  const generationSource = readFileSync(
    join(HEBY_MODEL_DIR, "heby-model-generation.server.ts"),
    "utf8",
  );
  assert.ok(generationSource.includes("TenantContext"));

  console.log("r2b firewall + security checks passed");
}

main();
