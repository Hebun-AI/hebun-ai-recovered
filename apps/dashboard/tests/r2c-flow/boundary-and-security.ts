/*
 * R2C — boundary & security structural proof.
 *
 * Proves by construction that the R2C server flow cannot reach the network, an SDK,
 * execution, a device, or persistence; that the fail-closed transport default holds; and
 * that no server-only surface or credential key leaks into the client panel.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectModelTransport } from "../../src/features/heby-model";

/** The R2C-owned server orchestration surface. */
const R2C_SERVER_FILES = [
  "src/features/heby-answer/model-answer.server.ts",
  "src/features/heby-runtime/prompt-validation.ts",
  "src/features/heby-runtime/overview-source.server.ts",
  "src/features/heby-model/dev-proof-transport.server.ts",
  "src/features/heby-model/model-transport-selection.server.ts",
  "src/app/(dashboard)/heby/actions.ts",
];

/* No network, no exec, no SDK — anywhere in the R2C server surface. */
const FORBIDDEN_PRIMITIVES = [
  "fetch(",
  "XMLHttpRequest",
  "WebSocket",
  "child_process",
  "execSync",
  "spawn(",
  "@anthropic-ai",
  "import Anthropic",
  'require("anthropic',
];

/* Imports that would breach the execution / mutation / device / persistence firewall. */
const FORBIDDEN_IMPORTS = [
  'from "@/features/provider-invocation',
  'from "@/features/provider-framework',
  'from "@/features/providers',
  'from "@/features/runtime-activation',
  'from "@/features/runtime-boundary',
  'from "@/features/heby-actions',
  'from "@/features/device-runtime',
  'from "@/features/operations',
  'from "@/features/execution',
  'from "@/db',
  'from "drizzle-orm',
  'from "next/cache"',
  'from "next/headers"',
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function main(): void {
  // --- The R2C server surface reaches no network, no SDK, no exec, no persistence. ---
  for (const file of R2C_SERVER_FILES) {
    const source = read(file);
    for (const primitive of FORBIDDEN_PRIMITIVES) {
      assert.ok(!source.includes(primitive), `${file} must not contain "${primitive}"`);
    }
    for (const imp of FORBIDDEN_IMPORTS) {
      assert.ok(!source.includes(imp), `${file} must not import "${imp}"`);
    }
  }

  // --- Server-only files carry the runtime guard (defence in depth). ---
  for (const file of [
    "src/features/heby-answer/model-answer.server.ts",
    "src/features/heby-runtime/overview-source.server.ts",
    "src/features/heby-model/dev-proof-transport.server.ts",
    "src/features/heby-model/model-transport-selection.server.ts",
  ]) {
    assert.ok(read(file).includes('typeof window !== "undefined"'), `${file} must be server-guarded`);
  }

  // --- The action resolves the tenant SERVER-SIDE and is "use server". ---
  const action = read("src/app/(dashboard)/heby/actions.ts");
  assert.ok(action.includes('"use server"'), "action is a server module");
  assert.ok(action.includes("resolveTenant: resolveTenantContext"), "tenant resolved server-side via R1");

  // --- The client panel exposes no credential and imports no server-only module. ---
  // HW3: Heby has two presentation surfaces, and the crossing into model generation belongs to
  // NEITHER of them — it lives in the one shared conversation hook they both call.
  const hook = read("src/components/layout/heby/use-heby-conversation.ts");
  const surfaces = {
    hook,
    workspace: read("src/components/layout/heby/heby-workspace-client.tsx"),
    quickPanel: read("src/components/layout/heby/heby-quick-panel-client.tsx"),
  };
  assert.ok(hook.includes('"use client"'), "the conversation seam is a client module");
  for (const [name, src] of Object.entries(surfaces)) {
    for (const leak of [
      "HEBUN_MODEL_CREDENTIAL",
      "HEBUN_MODEL_PROVIDER",
      "HEBUN_MODEL_ID",
      "HEBUN_MODEL_TRANSPORT",
      ".server",
      'from "@/features/heby-model"',
      'from "@/features/heby-answer',
    ]) {
      assert.ok(!src.includes(leak), `${name} must not reference "${leak}"`);
    }
  }
  // The ONE crossing into model generation is the server action, in the shared hook only.
  assert.ok(hook.includes('from "@/app/(dashboard)/heby/actions"'), "the shared hook calls the server action");
  assert.equal((hook.match(/askHebyAction\(/g) ?? []).length, 1, "exactly one dispatch site exists");
  for (const [name, src] of Object.entries(surfaces)) {
    if (name === "hook") continue;
    // A CALL site, not a mention: the surfaces are allowed to document the boundary they respect.
    assert.ok(!/askHebyAction\s*\(/.test(src), `${name} has no dispatch site of its own`);
  }

  // --- Fail-closed transport default: only the explicit "fake" flag yields a transport. ---
  assert.deepEqual(selectModelTransport({}), {}, "no transport by default");
  assert.deepEqual(selectModelTransport({ HEBUN_MODEL_TRANSPORT: "live" }), {}, "live is not wired in R2C");
  assert.deepEqual(selectModelTransport({ HEBUN_MODEL_TRANSPORT: "anything" }), {}, "unknown modes fail closed");
  const fake = selectModelTransport({ HEBUN_MODEL_TRANSPORT: "fake" });
  assert.equal(fake.transportProvenance, "fake");
  assert.ok(fake.transport, "fake proof transport is returned only on the explicit flag");

  console.log("r2c boundary & security checks passed");
}

main();
