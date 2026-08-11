/*
 * R2D — boundary, firewall & budget structural proof.
 *
 * Proves by construction that the durable layer and the prepared live transport cannot reach
 * execution, a device, Computer Use, or unexpected mutation; that persistence stays inside the
 * repository boundary; that only the live transport module touches the network; that the live
 * budget is hard; and that no server-only surface or credential leaks into the client panel.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectModelTransport } from "../../src/features/heby-model";
import { MAX_LIVE_CALLS, MAX_LIVE_OUTPUT_TOKENS } from "../../src/features/heby-model-live/claude-http-transport.server";

const REPO = "src/features/heby-conversation/durable-conversation-repository.server.ts";
const LIVE = "src/features/heby-model-live/claude-http-transport.server.ts";
const R2D_SERVER_FILES = [
  REPO,
  "src/features/heby-answer/model-answer.server.ts",
  "src/features/heby-answer/load-conversation.server.ts",
  "src/features/heby-model/model-transport-selection.server.ts",
  LIVE,
  "src/app/(dashboard)/heby/actions.ts",
];

/* Network / SDK / exec primitives. Only the live transport may contain `fetch(`. */
const NET_PRIMITIVES = ["fetch(", "XMLHttpRequest", "WebSocket", "child_process", "execSync", "spawn(", "@anthropic-ai", "import Anthropic"];
/* Imports that would breach the execution / device / mutation firewall — forbidden anywhere. */
const EXEC_IMPORTS = [
  'from "@/features/provider-invocation',
  'from "@/features/provider-framework',
  'from "@/features/providers',
  'from "@/features/runtime-activation',
  'from "@/features/runtime-boundary',
  'from "@/features/heby-actions',
  'from "@/features/device-runtime',
  'from "@/features/operations',
  'from "@/features/execution',
  'from "next/cache"',
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function main(): void {
  // --- Execution / device firewall: no R2D file imports execution or device authority. ---
  for (const file of R2D_SERVER_FILES) {
    const source = read(file);
    for (const imp of EXEC_IMPORTS) {
      assert.ok(!source.includes(imp), `${file} must not import "${imp}"`);
    }
  }

  // --- Only the live transport touches the network; nothing anywhere touches an SDK/exec. ---
  for (const file of R2D_SERVER_FILES) {
    const source = read(file);
    for (const primitive of NET_PRIMITIVES) {
      if (primitive === "fetch(" && file === LIVE) continue; // the live transport IS the network edge
      assert.ok(!source.includes(primitive), `${file} must not contain "${primitive}"`);
    }
  }

  // --- Persistence stays in the repository: no other R2D file imports the DB/ORM directly. ---
  for (const file of R2D_SERVER_FILES) {
    if (file === REPO) continue;
    const source = read(file);
    assert.ok(!source.includes('from "@/db'), `${file} must not import the DB directly`);
    assert.ok(!source.includes('from "drizzle-orm'), `${file} must not import drizzle directly`);
  }
  // The repository is the one place that owns the DB + ORM.
  assert.ok(read(REPO).includes('from "@/db/client.server"'), "repository uses the control-plane DB");
  assert.ok(read(REPO).includes('from "drizzle-orm"'), "repository owns the ORM query boundary");

  // --- Server-only guards on the orchestration + live surfaces. ---
  for (const file of [
    "src/features/heby-answer/model-answer.server.ts",
    "src/features/heby-answer/load-conversation.server.ts",
    "src/features/heby-model/model-transport-selection.server.ts",
    LIVE,
  ]) {
    assert.ok(read(file).includes('typeof window !== "undefined"'), `${file} must be server-guarded`);
  }

  // --- Live transport secret discipline: reads the key, never logs anything. ---
  const live = read(LIVE);
  assert.ok(live.includes("ANTHROPIC_API_KEY"), "live transport reads the API key env");
  assert.ok(!live.includes("console."), "live transport logs nothing (no secret leakage)");

  // --- Hard live budget is exactly the smoke-test gate. ---
  assert.equal(MAX_LIVE_CALLS, 1, "max live calls is 1");
  assert.equal(MAX_LIVE_OUTPUT_TOKENS, 300, "max live output tokens is 300");

  // --- Transport selector: default closed; fake explicit; live requires the double gate. ---
  assert.deepEqual(selectModelTransport({}), {}, "default transport is closed");
  assert.equal(selectModelTransport({ HEBUN_MODEL_TRANSPORT: "fake" }).transportProvenance, "fake");
  assert.deepEqual(selectModelTransport({ HEBUN_MODEL_TRANSPORT: "live" }), {}, "live closed without authorization");

  // --- BOTH Heby presentation surfaces expose no credential and import no server-only/persistence
  //     module, and neither owns a provider path: the one crossing is the shared conversation hook.
  const hook = read("src/components/layout/heby/use-heby-conversation.ts");
  const clientSurfaces = {
    hook,
    workspace: read("src/components/layout/heby/heby-workspace-client.tsx"),
    quickPanel: read("src/components/layout/heby/heby-quick-panel-client.tsx"),
  };
  for (const [name, src] of Object.entries(clientSurfaces)) {
    for (const leak of [
      "HEBUN_MODEL_CREDENTIAL",
      "HEBUN_MODEL_TRANSPORT",
      "ANTHROPIC_API_KEY",
      ".server",
      'from "@/features/heby-model',
      'from "@/features/heby-answer',
      'from "@/features/heby-conversation',
      'from "@/db',
    ]) {
      assert.ok(!src.includes(leak), `${name} must not reference "${leak}"`);
    }
  }
  assert.ok(hook.includes('from "@/app/(dashboard)/heby/actions"'), "the shared hook talks only to the server actions");

  console.log("r2d boundary & security checks passed");
}

main();
