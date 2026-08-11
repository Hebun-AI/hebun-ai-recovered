/*
 * HW3 — structural proofs over the SHIPPED source: the wiring that makes mutual exclusivity real,
 * the boundary that keeps presentation state from becoming authority, and the firewalls that keep a
 * second Heby surface from becoming a second Heby.
 *
 * These complement the behavioural proofs. A behavioural test shows the planner is right; these show
 * the product actually uses it, that nothing else quietly decides, and that neither surface acquired
 * execution reach, a credential, a tenant, a provider path or a persistence path of its own.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const SURFACE_MODEL = "src/features/heby-surface/surface-state.ts";
const COMPOSITION = "src/features/heby-surface/composition.ts";
const PROVIDER = "src/components/layout/heby/heby-surface-context.tsx";
const LAUNCHER = "src/components/layout/heby/heby-launcher.tsx";
const SHELL = "src/components/layout/hebun-shell.tsx";
const HOOK = "src/components/layout/heby/use-heby-conversation.ts";
const WORKSPACE = "src/components/layout/heby/heby-workspace.tsx";
const WORKSPACE_CLIENT = "src/components/layout/heby/heby-workspace-client.tsx";
const PANEL = "src/components/layout/heby/heby-quick-panel.tsx";
const PANEL_CLIENT = "src/components/layout/heby/heby-quick-panel-client.tsx";
const COMPOSER = "src/components/layout/heby/heby-composer.tsx";
const PAGE = "src/app/(dashboard)/heby/page.tsx";

/** Every client file HW3 touches or introduces. */
const CLIENT_FILES = [
  PROVIDER, LAUNCHER, SHELL, HOOK, WORKSPACE, WORKSPACE_CLIENT, PANEL, PANEL_CLIENT, COMPOSER,
  "src/components/layout/heby/heby-turns.tsx",
  "src/components/layout/heby/heby-visualizer.tsx",
  "src/components/command-center/heby-why.tsx",
];

function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

/**
 * The file's CODE, with block comments and full-line `//` comments removed. Several of these guards
 * ban a word from the product; the doc comments legitimately NAME what they ban ("this is not a
 * claim that Heby is online"), and a proof that fails on its own explanation is a bad proof.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function main(): void {
  /* ── The surface model is PRESENTATION ONLY, and provably pure ───────────── */
  {
    for (const file of [SURFACE_MODEL, COMPOSITION]) {
      const src = read(file);
      for (const forbidden of ["react", "next/", "@/db", ".server", "heby-answer", "heby-model", "heby-provider-ops", "heby-conversation"]) {
        assert.ok(!importsOf(src).some((i) => i.includes(forbidden)), `${file} must not import "${forbidden}"`);
      }
      // It cannot become authority: no tenant, no role, no credential, no session vocabulary.
      const code = codeOf(src);
      for (const authority of ["tenantId", "TenantContext", "roleId", "apiKey", "session", "cookie"]) {
        assert.ok(!code.includes(authority), `${file} must not use "${authority}"`);
      }
      assert.ok(!code.includes("askHebyAction") && !code.includes("fetch("), `${file} performs no I/O`);
    }
  }

  /* ── 7 (structural). Mutual exclusivity is BUILT IN, not defended ────────── */
  {
    const model = read(SURFACE_MODEL);
    // One derived value, and the route wins — so "both surfaces" is unrepresentable.
    assert.ok(model.includes("export function resolveHebySurfaceState"), "one resolver owns the surface");
    assert.ok(/isHebyWorkspaceRoute\(input\.pathname\)\) return "full-workspace"/.test(model), "the route wins");

    // The Quick Panel is not merely hidden on /heby — it is NOT MOUNTED.
    const panelClient = read(PANEL_CLIENT);
    assert.ok(/surface !== "quick-panel"\) return null/.test(panelClient), "the panel returns null unless it is the active surface");
    // The conversation hook is instantiated only inside the mounted panel, so a closed panel holds
    // no session and can never be a second live conversation behind the workspace.
    const mountIndex = panelClient.indexOf("function MountedQuickPanel");
    assert.ok(mountIndex > -1 && panelClient.indexOf("useHebyConversation(") > mountIndex, "no hook runs while closed");
    const panelClientCode = codeOf(panelClient);
    assert.ok(!panelClientCode.includes("hidden") && !panelClientCode.includes("display: none"), "not hidden — absent");
  }

  /* ── The adapter executes the planner, and nothing else decides ──────────── */
  {
    const provider = read(PROVIDER);
    assert.ok(provider.includes("planHebyTransition("), "the provider delegates every transition");
    for (const kind of ["open-quick", "close-quick", "enter-workspace", "leave-workspace"]) {
      assert.ok(provider.includes(`case "${kind}"`), `the adapter handles "${kind}"`);
    }
    // Entering the workspace clears the panel request in the SAME command — never stacked.
    const enterAt = provider.indexOf('case "enter-workspace"');
    const clearAt = provider.indexOf("setQuickPanelRequested(false)", enterAt);
    const pushAt = provider.indexOf("router.push(command.href)", enterAt);
    assert.ok(enterAt > -1 && clearAt > -1 && clearAt < pushAt, "the panel closes as part of entering the workspace");

    // No PRESENTATION component navigates or holds open/close state — they only raise callbacks.
    for (const file of [LAUNCHER, WORKSPACE, PANEL, COMPOSER]) {
      const code = codeOf(read(file));
      assert.ok(!code.includes("router.push"), `${file} does not navigate on its own`);
      assert.ok(!/href="\/heby|'\/heby'|`\/heby/.test(code), `${file} hardcodes no Heby link`);
    }
    // The containers DO navigate — for `/go` — but only with a route the PURE planner resolved from
    // the closed workspace registry. Neither container builds a destination of its own.
    for (const file of [WORKSPACE_CLIENT, PANEL_CLIENT]) {
      const code = codeOf(read(file));
      assert.ok(code.includes("onNavigate: (route) => router.push(route)"), `${file} pushes only the planner's route`);
      assert.ok(!/router\.push\(["'`]/.test(code), `${file} never pushes a literal destination`);
      assert.ok(!/href="\/heby|'\/heby'|`\/heby/.test(code), `${file} hardcodes no Heby link`);
    }
    // Both controls route through the planner.
    const launcher = read(LAUNCHER);
    assert.ok(launcher.includes('operate("rail")') && launcher.includes('operate("topbar")'), "both controls are planned");
    assert.ok(!launcher.includes("next/link"), "the topbar control no longer navigates to /heby");
  }

  /* ── 18 (structural). Active state means "this surface is open" — nothing more ─ */
  {
    const launcher = read(LAUNCHER);
    assert.ok(launcher.includes('surface === "quick-panel"') && launcher.includes('surface === "full-workspace"'),
      "active is derived from the open surface, per control");
    // It must never be dressed as connectivity, health, or activity.
    const launcherCode = codeOf(launcher);
    for (const misleading of ["Connected", "Online", "Healthy", "Live", "Listening", "Active now", "Running", "Ready to act"]) {
      assert.ok(!launcherCode.includes(misleading), `the control must not claim "${misleading}"`);
    }
    assert.ok(launcher.includes("aria-expanded") && launcher.includes("aria-pressed"), "the state is announced, not colour-only");
  }

  /* ── The shell mounts exactly one Heby, and does not resurrect the drawer ── */
  {
    const shell = read(SHELL);
    assert.ok(shell.includes("HebySurfaceProvider"), "the surface state wraps the shell so it survives navigation");
    assert.ok(shell.includes("HebyQuickPanelClient"), "the Quick Panel is mounted once, at shell level");
    assert.equal((shell.match(/HebyQuickPanelClient/g) ?? []).length, 2, "mounted exactly once (import + use)");
    assert.ok(!shell.includes("HebyPanel") && !shell.includes("HebyProvider"), "the pre-H1 drawer stays retired");
    for (const retired of [
      "src/components/layout/heby/heby-panel.tsx",
      "src/components/layout/heby/heby-context.tsx",
      "src/components/layout/heby/heby-conversation.tsx",
    ]) {
      assert.ok(!existsSync(retired), `${retired} is still retired`);
    }
  }

  /* ── 11–15 (structural). ONE conversation seam behind both surfaces ──────── */
  {
    // Both containers call the same hook; neither has its own dispatch, loader, or storage key.
    for (const file of [WORKSPACE_CLIENT, PANEL_CLIENT]) {
      const src = read(file);
      assert.ok(src.includes("useHebyConversation("), `${file} uses the shared conversation seam`);
      assert.ok(!/askHebyAction\s*\(/.test(src), `${file} has no dispatch site`);
      assert.ok(!src.includes("loadHebyConversationAction"), `${file} has no loader of its own`);
      assert.ok(!src.includes("localStorage"), `${file} owns no conversation pointer`);
    }
    // Exactly one storage key exists, derived from the server-resolved route.
    const hook = read(HOOK);
    assert.equal((hook.match(/localStorage\.setItem/g) ?? []).length, 1, "one place writes the conversation pointer");
    assert.ok(hook.includes("function conversationKey(route: string)"), "the pointer is keyed by the canonical route");
    // No second persistence vocabulary anywhere on the surfaces.
    for (const file of CLIENT_FILES) {
      const code = codeOf(read(file)).toLowerCase();
      for (const invented of ["quick_panel_conversation", "panel_conversations", "workspace_conversations", "sessionstorage", "indexeddb"]) {
        assert.ok(!code.includes(invented), `${file} must not introduce "${invented}"`);
      }
    }
    // Both surfaces feed from the ONE parser via the hook; neither imports it directly to re-decide.
    assert.ok(hook.includes('from "@/features/heby-commands"'), "the hook owns the parser call");
    for (const file of [WORKSPACE, PANEL, COMPOSER]) {
      assert.ok(!read(file).includes("parseHebyInput"), `${file} does not classify input itself`);
    }
  }

  /* ── 29. /clear remains DETACH, not delete ───────────────────────────────── */
  {
    const hook = read(HOOK);
    // S1 moved the copy into the one dispatch planner; the behaviour still lives in the one hook.
    const planner = read("src/features/heby-commands/dispatch.ts");
    assert.ok(planner.includes("Cleared this view and detached the current conversation."), "/clear says what it did");
    assert.ok(planner.includes("Nothing was deleted — your saved conversation history is intact."), "/clear says what it did not do");
    assert.ok(hook.includes("removeItem(conversationKey(contextRoute))"), "/clear drops only the local pointer");
    // Closing the Quick Panel is presentation only — it touches nothing durable.
    const panelClient = read(PANEL_CLIENT);
    assert.ok(panelClient.includes("onClose={closeQuickPanel}"), "closing the panel only closes the panel");
    for (const src of [read(PANEL), panelClient]) {
      assert.ok(!/detachConversation|removeItem|clearHistory/.test(src), "closing the panel does not clear anything");
    }
  }

  /*
   * ── 21/22/23. EXACTLY ONE MICROPHONE OWNER, AND IT IS NOT AN HW3 FILE ──────
   *
   * Voice V1 narrowed this proof. It used to assert that no audio runtime existed anywhere; one now
   * does, in exactly one file (heby-voice-runtime.tsx), deliberately absent from this list. The
   * surviving — and now sharper — invariant is that no HW3 surface, container, hook, route or
   * surface-model file owns audio machinery or claims a wake word, so voice cannot become a second
   * runtime by accident. Checked against CODE, because several of these files legitimately deny
   * audio machinery in prose.
   */
  {
    for (const file of [...CLIENT_FILES, PAGE, SURFACE_MODEL, COMPOSITION]) {
      const code = codeOf(read(file));
      for (const api of ["getUserMedia", "AudioContext", "MediaRecorder", "SpeechRecognition", "speechSynthesis", "webkitSpeech", "<audio"]) {
        assert.ok(!code.includes(api), `${file} must not touch "${api}"`);
      }
      assert.ok(!/hey heby|wake ?word/i.test(code), `${file} declares no wake word`);
    }
    const visualizer = read("src/components/layout/heby/heby-visualizer.tsx");
    assert.ok(visualizer.includes("audioLevel?: number"), "the audio hook stays declared");
    // Read in ONE state only — the honesty rule that replaced "never read".
    assert.ok(
      /state === "listening" \? clampAudioLevel\(props\.audioLevel\) : 0/.test(visualizer),
      "audioLevel is read only while genuinely listening",
    );
  }

  /* ── 22/32. EXECUTION FIREWALL — HW3 remains advisory/text-only ──────────── */
  {
    // Scoped to the module path so a legitimate LOCAL module (./use-heby-conversation) is not
    // mistaken for the server-only feature it deliberately does not import.
    const forbidden = [
      "provider-framework", "provider-invocation", "runtime-activation", "device-runtime",
      "computer-use", "features/execution", "features/integration", "features/heby-actions",
      "features/heby-model", "features/heby-answer", "features/heby-provider-ops",
      "features/heby-model-live", "features/heby-conversation", "@/db",
    ];
    for (const file of CLIENT_FILES) {
      const src = read(file);
      for (const marker of forbidden) {
        assert.ok(!importsOf(src).some((i) => i.includes(marker)), `${file} must not import "${marker}"`);
      }
      assert.ok(!importsOf(src).some((i) => i.endsWith(".server")), `${file} imports no server-only module`);
      // No execution vocabulary was introduced by the new surface.
      // Execution capability is judged on API shape, not on prose — a word like "shell" is too
      // generic to mean anything, but none of these can appear by accident.
      const code = codeOf(src).toLowerCase();
      for (const capability of [
        "puppeteer", "playwright", "child_process", "execsync", "spawnsync", "/bin/sh",
        "computer_use", "computeruse", "newpage(", "eval(", "new function(",
      ]) {
        assert.ok(!code.includes(capability), `${file} must not use "${capability}"`);
      }
    }
  }

  /* ── 30/31. Client payload boundary and credential/tenant boundary unchanged ─ */
  {
    const hook = read(HOOK);
    assert.match(
      hook,
      /askHebyAction\(\{\s*prompt,\s*route:\s*contextRoute,\s*conversationId:\s*prior\s*\}\)/,
      "the client payload is still exactly prompt + route + conversationId",
    );
    for (const file of [...CLIENT_FILES, PAGE]) {
      const src = read(file);
      for (const leak of [
        "ANTHROPIC_API_KEY", "HEBUN_MODEL_CREDENTIAL", "HEBUN_MODEL_PROVIDER", "HEBUN_MODEL_ID",
        "HEBUN_MODEL_TRANSPORT", "apiKey", "tenantId", "roleId", "process.env",
      ]) {
        assert.ok(!src.includes(leak), `${file} must not reference "${leak}"`);
      }
      assert.ok(!/sk-[a-z0-9-]{6,}/i.test(src), `${file} contains no key-shaped literal`);
    }
    // The `from` hint is resolved on the SERVER, through the allow-list, before anything renders.
    const page = read(PAGE);
    assert.ok(page.includes("await searchParams"), "the hint is read server-side");
    assert.ok(page.includes("resolveHebyWorkspaceEntry"), "context comes from the allow-list");
    assert.ok(page.includes("resolveHebyReturnRoute(rawFrom)"), "the return target comes from the allow-list too");
    assert.ok(!page.includes("redirect("), "the page performs no caller-driven redirect");
  }

  /* ── 29 (audit). NO new persistence, migration, or DB authority ──────────── */
  {
    // HW3 introduced no migration. The newest migrations are the pre-existing R2D/R2E ones.
    const migrations = readdirSync("src/db/migrations").filter((f) => f.endsWith(".sql")).sort();
    const newest = migrations[migrations.length - 1]!;
    assert.ok(newest.includes("r2e_provider_connectivity_control"), `HW3 added no migration (newest is ${newest})`);
    for (const file of migrations) {
      assert.ok(!/hw3|quick_panel|surface/i.test(file), `no HW3/surface migration exists (${file})`);
    }
    // And no schema module was added for a surface.
    const schemas = readdirSync("src/db/schema");
    for (const file of schemas) {
      assert.ok(!/surface|panel|hw3/i.test(file), `no surface-state schema exists (${file})`);
    }
  }

  console.log("hw3 wiring + firewall + security audit passed");
}

main();
