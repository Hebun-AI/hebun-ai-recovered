/*
 * H1C — structural guards: single transcript authority, no tenant/credential in the client
 * payload, keyboard-send semantics, New Conversation never deletes, execution firewall intact.
 *
 * HW1 re-pointed these guards from the retired side panel onto the Heby Full Workspace. HW3 gave
 * Heby a SECOND presentation surface (the Quick Panel), so the guards now sit where the behaviour
 * actually lives: the shared conversation hook that BOTH surfaces call. That is strictly stronger —
 * one proof now covers both surfaces, and neither can acquire its own transcript, payload, detach
 * semantics, or execution reach without breaking this file.
 *
 * Source-level (the behaviours are enforced in code that a browser proof also exercises).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** THE shared conversation seam — the only place either surface can reach the server action. */
const HOOK = readFileSync("src/components/layout/heby/use-heby-conversation.ts", "utf8");
const WORKSPACE = readFileSync("src/components/layout/heby/heby-workspace.tsx", "utf8");
const WORKSPACE_CLIENT = readFileSync("src/components/layout/heby/heby-workspace-client.tsx", "utf8");
const QUICK_PANEL = readFileSync("src/components/layout/heby/heby-quick-panel.tsx", "utf8");
const QUICK_PANEL_CLIENT = readFileSync("src/components/layout/heby/heby-quick-panel-client.tsx", "utf8");
const COMPOSER = readFileSync("src/components/layout/heby/heby-composer.tsx", "utf8");
const TURNS = readFileSync("src/components/layout/heby/heby-turns.tsx", "utf8");
const THREAD = readFileSync("src/components/layout/heby/heby-thread.ts", "utf8");

const CLIENT_UI = [HOOK, WORKSPACE, WORKSPACE_CLIENT, QUICK_PANEL, QUICK_PANEL_CLIENT, COMPOSER, TURNS, THREAD];

function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

function main(): void {
  // 1. Single transcript authority: the thread is composed from the DURABLE messages loaded by the
  //    server action, via the pure buildTurns — not from a client-accumulated transcript.
  assert.ok(HOOK.includes("loadHebyConversationAction"), "durable conversation is loaded from the server");
  assert.ok(HOOK.includes("buildTurns(session.messages, session.latest)"), "thread rendered from durable messages");
  // The client keeps no parallel durable transcript array (only the loaded `messages` + ephemeral latest).
  assert.ok(!/\.messages\.push\(|session\.messages,\s*[^)]*newMessage/.test(HOOK), "no client-side durable transcript accumulation");
  // Neither surface may load or accumulate a transcript of its own.
  for (const [name, src] of Object.entries({ WORKSPACE_CLIENT, QUICK_PANEL_CLIENT, WORKSPACE, QUICK_PANEL })) {
    assert.ok(!src.includes("loadHebyConversationAction"), `${name} does not load a transcript of its own`);
  }

  // 2. Client payload carries NO authority — only prompt/route/conversationId.
  assert.match(HOOK, /askHebyAction\(\{\s*prompt,\s*route:\s*contextRoute,\s*conversationId:\s*prior\s*\}\)/, "payload is prompt+route+conversationId only");
  for (const src of CLIENT_UI) {
    assert.ok(!src.includes("tenantId") && !src.includes("roleId") && !src.includes("apiKey"), "no tenant/role/credential in the client");
  }

  // 3. Keyboard send: Enter sends, Shift+Enter is a newline — in the ONE shared composer.
  assert.ok(COMPOSER.includes('event.key === "Enter" && !event.shiftKey'), "Enter=send, Shift+Enter=newline");
  for (const [name, src] of Object.entries({ WORKSPACE, QUICK_PANEL })) {
    assert.ok(!src.includes('event.key === "Enter"'), `${name} does not reimplement send semantics`);
  }

  // 4. New Conversation DETACHES (drops the local pointer + clears view) and never deletes durable data.
  assert.ok(HOOK.includes("const detachConversation"), "the single detach primitive exists");
  assert.ok(HOOK.includes("onNewConversation: detachConversation"), "New Conversation uses that primitive");
  assert.ok(HOOK.includes("removeItem(conversationKey(contextRoute))"), "New Conversation drops the local conversation pointer");
  for (const src of CLIENT_UI) {
    assert.ok(!src.includes("deleteConversation") && !/\.delete\(/.test(src) && !/dropDatabase|DELETE FROM/i.test(src), "New Conversation never deletes a durable conversation/message");
  }

  // 5. Execution firewall: the conversational UI imports NOTHING from an execution/provider/runtime
  //    surface. It is TEXT interaction only.
  // NB: "heby-integration" is a legitimate PRESENTATION model (workspace/authority labels), not an
  // execution surface — so the markers target execution/provider/runtime surfaces specifically.
  const forbidden = [
    "provider-framework",
    "provider-invocation",
    "runtime-activation",
    "device-runtime",
    "computer-use",
    "features/execution",
    "features/integration",
    "heby-actions",
  ];
  for (const src of CLIENT_UI) {
    for (const marker of forbidden) {
      assert.ok(!importsOf(src).some((i) => i.includes(marker)), `no import of "${marker}" in the conversational UI`);
    }
  }
  // No direct DB / control-plane / model-transport import from the client UI either.
  for (const src of CLIENT_UI) {
    assert.ok(!importsOf(src).some((i) => /db\/client|heby-model-live|heby-provider-ops|\.server$/.test(i)), "client UI imports no server-only module");
  }

  console.log("h1c structure + firewall checks passed");
}

main();
