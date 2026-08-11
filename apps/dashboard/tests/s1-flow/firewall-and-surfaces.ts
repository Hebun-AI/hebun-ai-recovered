/*
 * S1 — the security firewall around the command layer, and the proof that both Heby surfaces run on
 * ONE registry, ONE parser, ONE dispatcher.
 *
 * SLASH INPUT IS NOT SHELL INPUT. That is asserted structurally over the shipped source: nothing in
 * the command layer evaluates, spawns, fetches, navigates to a caller-supplied URL, reads a file, or
 * reaches an execution or Computer Use surface. The read boundary imports no model client, so a
 * READ command has no representation in which it could become a provider call.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { HEBY_COMMANDS } from "../../src/features/heby-commands";

const read = (path: string) => readFileSync(path, "utf8");

const FEATURE_DIR = "src/features/heby-commands";
const CONTRACTS = `${FEATURE_DIR}/contracts.ts`;
const REGISTRY = `${FEATURE_DIR}/registry.ts`;
const PARSER = `${FEATURE_DIR}/parser.ts`;
const DISPATCH = `${FEATURE_DIR}/dispatch.ts`;
const PROMPTS = `${FEATURE_DIR}/advisory-prompts.ts`;
const READ_SERVER = `${FEATURE_DIR}/read-commands.server.ts`;
const INDEX = `${FEATURE_DIR}/index.ts`;

const HOOK = "src/components/layout/heby/use-heby-conversation.ts";
const COMPOSER = "src/components/layout/heby/heby-composer.tsx";
const WORKSPACE_CLIENT = "src/components/layout/heby/heby-workspace-client.tsx";
const PANEL_CLIENT = "src/components/layout/heby/heby-quick-panel-client.tsx";
const ACTIONS = "src/app/(dashboard)/heby/actions.ts";

/** The PURE, client-safe modules of the command layer. */
const PURE_MODULES = [CONTRACTS, REGISTRY, PARSER, DISPATCH, PROMPTS, INDEX];

function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

/** Code with comments stripped — several guards ban words the docs legitimately explain. */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function main(): void {
  /* ── 32. SLASH INPUT IS NEVER SHELL INPUT ─────────────────────────────────── */
  {
    for (const file of [...PURE_MODULES, READ_SERVER, HOOK, COMPOSER]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of [
        "eval(", "new function(", "child_process", "execsync", "spawnsync", "exec(", "spawn(",
        "/bin/sh", "shelljs", "puppeteer", "playwright", "vm.runin",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not use "${banned}"`);
      }
    }
    // The parser REFUSES shell grammar rather than sanitizing it, and says so.
    const parser = read(PARSER);
    assert.ok(parser.includes("SHELL_METACHARACTERS"), "shell metacharacters are named and refused");
    assert.ok(/unsafe-input/.test(parser), "and produce their own refusal kind");
  }

  /* ── No arbitrary fetch, URL navigation, or file access from the command layer ── */
  {
    for (const file of PURE_MODULES) {
      const code = codeOf(read(file));
      for (const banned of ["fetch(", "XMLHttpRequest", "WebSocket", "window.open", "location.href", "location.assign", "readFile", "writeFile", "node:fs"]) {
        assert.ok(!code.includes(banned), `${file} must not use "${banned}"`);
      }
    }
    // Navigation targets come from the registry, never from the operator's text.
    const dispatch = read(DISPATCH);
    assert.ok(dispatch.includes("isHebyWorkspaceId(value)"), "a /go target must be a known workspace identity");
    assert.ok(dispatch.includes("getHebyWorkspaceProfile(value).defaultRoute") || dispatch.includes("profile.defaultRoute"),
      "the route comes from the registry profile");
    assert.ok(!/route:\s*(raw|value|args\[0\])/.test(dispatch), "the caller's text is never used as a destination");
  }

  /* ── 33. No execution, Computer Use, provider, or persistence reach ───────── */
  {
    const forbidden = [
      "provider-framework", "provider-invocation", "runtime-activation", "device-runtime",
      "computer-use", "features/execution", "features/integration", "features/heby-actions",
      "features/heby-model", "features/heby-model-live",
    ];
    for (const file of PURE_MODULES) {
      const imports = importsOf(read(file));
      for (const marker of [...forbidden, "@/db", "features/heby-answer", "features/heby-conversation", "features/heby-provider-ops"]) {
        assert.ok(!imports.some((i) => i.includes(marker)), `${file} must not import "${marker}"`);
      }
      assert.ok(!imports.some((i) => i.endsWith(".server")), `${file} imports no server-only module`);
    }
    // The SERVER read module may read real sources — but never a model client or a transport.
    const serverImports = importsOf(read(READ_SERVER));
    for (const marker of forbidden) {
      assert.ok(!serverImports.some((i) => i.includes(marker)), `${READ_SERVER} must not import "${marker}"`);
    }
    const serverCode = codeOf(read(READ_SERVER));
    for (const banned of ["selectModelTransport", "generateHebyModelAnswer", "answerHebyModelRequest", "ClaudeTransport", "anthropic"]) {
      assert.ok(!serverCode.includes(banned), `${READ_SERVER} must not reference "${banned}" — a read cannot become a model call`);
    }
  }

  /* ── 34. No secret, no client tenant authority ────────────────────────────── */
  {
    for (const file of [...PURE_MODULES, READ_SERVER, HOOK, COMPOSER, WORKSPACE_CLIENT, PANEL_CLIENT]) {
      const src = read(file);
      for (const leak of ["ANTHROPIC_API_KEY", "HEBUN_MODEL_CREDENTIAL", "HEBUN_MODEL_TRANSPORT", "apiKey", "process.env"]) {
        assert.ok(!src.includes(leak), `${file} must not reference "${leak}"`);
      }
      assert.ok(!/sk-[a-z0-9-]{6,}/i.test(src), `${file} contains no key-shaped literal`);
    }
    // The tenant is resolved SERVER-SIDE only. No client module names it.
    for (const file of [...PURE_MODULES, HOOK, COMPOSER, WORKSPACE_CLIENT, PANEL_CLIENT]) {
      const code = codeOf(read(file));
      assert.ok(!code.includes("tenantId") && !code.includes("TenantContext"), `${file} holds no tenant authority`);
    }
    const server = read(READ_SERVER);
    assert.ok(server.includes("await deps.resolveTenant()"), "the read boundary resolves the tenant server-side");
    assert.ok(server.includes('return { status: "unauthorized" }'), "and fails closed when there is none");
    // The client-crossing payload is a command ID from a closed set — never behaviour.
    const actions = read(ACTIONS);
    assert.ok(actions.includes("runHebyReadCommand("), "the action delegates to the server executor");
    assert.ok(server.includes("findHebyCommandById(input.commandId)"), "the id is a lookup into the registry");
    assert.ok(server.includes('command.kind !== "read"'), "and non-read commands are refused server-side");
    assert.ok(server.includes('command.availability !== "available"'), "as are unavailable ones");
  }

  /* ── 31. ONE registry, ONE parser, ONE dispatcher — for BOTH surfaces ─────── */
  {
    // The retired per-surface command module is gone, and nothing references it.
    assert.ok(!existsSync("src/features/heby-workspace/commands.ts"), "the pre-S1 command module is retired");
    for (const file of readdirSync("src/components/layout/heby")) {
      const src = read(`src/components/layout/heby/${file}`);
      assert.ok(!src.includes("heby-workspace/commands"), `${file} does not reach a second command module`);
    }
    // No parallel registry was created for either surface.
    for (const forbidden of [
      "src/features/heby-commands/quick-panel-registry.ts",
      "src/features/heby-commands/workspace-registry.ts",
      "src/features/quick-heby-commands",
    ]) {
      assert.ok(!existsSync(forbidden), `${forbidden} must not exist`);
    }

    // BOTH surfaces reach the command layer only through the ONE shared hook.
    const hook = read(HOOK);
    assert.ok(hook.includes('from "@/features/heby-commands"'), "the hook owns the command layer");
    assert.ok(hook.includes("parseHebyInput(") && hook.includes("planHebyCommand("), "it parses then plans");
    assert.equal((hook.match(/planHebyCommand\(/g) ?? []).length, 1, "exactly one planning site");
    assert.equal((hook.match(/askHebyAction\(/g) ?? []).length, 1, "still exactly one model dispatch site");
    assert.equal((hook.match(/runHebyReadCommandAction\(/g) ?? []).length, 1, "exactly one read dispatch site");
    for (const file of [WORKSPACE_CLIENT, PANEL_CLIENT]) {
      const src = read(file);
      assert.ok(src.includes("useHebyConversation("), `${file} uses the shared seam`);
      assert.ok(!src.includes("planHebyCommand") && !src.includes("parseHebyInput"), `${file} decides nothing itself`);
      assert.ok(src.includes("surface:"), `${file} declares only its surface identity`);
    }
    // Surface-specific behaviour is a CALLBACK, not a second command set.
    assert.ok(read(WORKSPACE_CLIENT).includes('onCloseSurface: () => operate("rail")'), "/close returns from the workspace");
    assert.ok(read(PANEL_CLIENT).includes("onCloseSurface: closeQuickPanel"), "/close closes the panel");

    // ADVISORY IS THE ONLY BRANCH THAT CAN PRODUCE A PROMPT — asserted on the shipped hook.
    const advisoryAt = hook.indexOf('case "advisory":');
    const dispatchAt = hook.indexOf("askHebyAction({");
    assert.ok(advisoryAt > -1 && advisoryAt < dispatchAt, "the advisory branch precedes the only dispatch");
    for (const branch of ['case "local":', 'case "unavailable":', 'case "detach":', 'case "close":', 'case "navigate":', 'case "read":']) {
      assert.ok(hook.indexOf(branch) > -1 && hook.indexOf(branch) < dispatchAt, `${branch} returns before dispatch`);
    }
  }

  /* ── 18. The future capability seam is DESIGNED, not implemented ──────────── */
  {
    const contracts = read(CONTRACTS);
    assert.ok(contracts.includes("HebyCommandProvider"), "a contribution shape exists for future providers");
    assert.ok(/requiresCapability/.test(contracts), "a contributed command can declare a needed capability");
    // But nothing loads through it yet — no registration, no dynamic import, no marketplace.
    for (const file of PURE_MODULES) {
      const code = codeOf(read(file));
      for (const banned of ["registerCommand", "import(", "require(", "marketplace", "installCapability"]) {
        assert.ok(!code.toLowerCase().includes(banned.toLowerCase()), `${file} must not implement loading ("${banned}")`);
      }
    }
    // The registry is a frozen literal, not a mutable list something could push into.
    const registry = read(REGISTRY);
    assert.ok(registry.includes("Object.freeze(["), "the command set is frozen");
    assert.ok(!/HEBY_COMMANDS\.push|HEBY_COMMANDS\s*=/.test(codeOf(registry)), "nothing mutates it");
  }

  /* ── Result provenance: a local/read result never poses as a model answer ─── */
  {
    const composer = read(COMPOSER);
    assert.ok(composer.includes("data-heby-command-result"), "a command result is structurally distinct");
    assert.ok(composer.includes("props.commandOutput.provenance"), "and always renders its own provenance");
    // Every provenance string the layer can emit disclaims generation.
    const dispatch = read(DISPATCH);
    const server = read(READ_SERVER);
    for (const source of [dispatch, server]) {
      for (const match of source.matchAll(/provenance:\s*\n?\s*"([^"]+)"/g)) {
        assert.ok(!/\bgenerated\b/i.test(match[1]!), `a command result must not claim generation: ${match[1]}`);
      }
    }
  }

  /* ── The registry's own truth claims match what the code can actually do ──── */
  {
    // Nothing may be marked available unless the layer has somewhere real to get it.
    const runnable = HEBY_COMMANDS.filter((command) => command.availability === "available");
    const server = read(READ_SERVER);
    for (const command of runnable.filter((c) => c.kind === "read")) {
      assert.ok(server.includes(`case "${command.handler}"`), `/${command.id} has a real server handler`);
    }
    const dispatch = read(DISPATCH);
    for (const command of runnable.filter((c) => c.kind === "local" || c.kind === "navigation")) {
      assert.ok(dispatch.includes(`case "${command.handler}"`), `/${command.id} has a real local handler`);
    }
    const prompts = read(PROMPTS);
    for (const command of runnable.filter((c) => c.kind === "advisory")) {
      assert.ok(prompts.includes(`case "${command.handler}"`), `/${command.id} has a real prompt`);
    }
  }

  console.log("s1 firewall + shared surfaces passed");
}

main();
