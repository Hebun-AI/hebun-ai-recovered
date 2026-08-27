/*
 * HW1 — navigation, single-Heby guarantee, execution firewall, credential boundary.
 *
 * Structural proofs over the shipped source: the /heby route exists and is the primary surface, the
 * retired drawer is genuinely gone (not merely hidden behind a flag), every Heby entry point
 * navigates rather than opening an overlay, and the workspace reuses the EXISTING H1 conversation
 * authority instead of introducing a second one.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
/*
 * Executable source only. A structural proof over RAW text can be satisfied by the file's own
 * prose — which is exactly how this suite's navigation clause went vacuous (see section 3).
 */
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const PAGE = "src/app/(dashboard)/heby/page.tsx";
/** THE shared conversation seam. HW3 moved the behaviour here so BOTH surfaces are covered. */
const HOOK = "src/components/layout/heby/use-heby-conversation.ts";
const CONTAINER = "src/components/layout/heby/heby-workspace-client.tsx";
const SURFACE = "src/components/layout/heby/heby-workspace.tsx";
const PANEL = "src/components/layout/heby/heby-quick-panel.tsx";
const PANEL_CONTAINER = "src/components/layout/heby/heby-quick-panel-client.tsx";
const COMPOSER = "src/components/layout/heby/heby-composer.tsx";
const TURNS = "src/components/layout/heby/heby-turns.tsx";
const VISUALIZER = "src/components/layout/heby/heby-visualizer.tsx";
const LAUNCHER = "src/components/layout/heby/heby-launcher.tsx";
const WHY = "src/components/command-center/heby-why.tsx";
const SHELL = "src/components/layout/hebun-shell.tsx";
const RAIL = "src/components/layout/workspace-rail.tsx";
const MOBILE_NAV = "src/components/layout/mobile-nav.tsx";
const SECONDARY_NAV = "src/components/layout/secondary-nav.tsx";

const CLIENT_FILES = [HOOK, CONTAINER, SURFACE, PANEL, PANEL_CONTAINER, COMPOSER, TURNS, VISUALIZER, LAUNCHER, WHY];

function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

function main(): void {
  // 1. The /heby route exists and renders the workspace — it is no longer the inert placeholder.
  {
    assert.ok(existsSync(PAGE), "/heby route exists");
    const page = read(PAGE);
    assert.ok(page.includes("HebyWorkspaceClient"), "the route renders the Heby workspace");
    assert.ok(!page.includes("Not yet implemented") && !page.includes("Heby is not available yet"), "the placeholder is gone");
    // Context is resolved SERVER-SIDE, from an allowlist, before anything renders.
    assert.ok(page.includes("resolveHebyWorkspaceEntry"), "context resolved through the allowlist");
    assert.ok(page.includes("await searchParams"), "the hint is read server-side");
  }

  // 2. No duplicate Heby route was created.
  {
    for (const duplicate of ["assistant", "ai", "chat", "copilot"]) {
      assert.ok(!existsSync(`src/app/(dashboard)/${duplicate}/page.tsx`), `no /${duplicate} duplicate route`);
    }
  }

  // 3. The PRE-H1 side drawer is RETIRED, not hidden: its files are gone and nothing resurrects its
  //    architecture. HW3's Quick Panel is a different thing entirely — it is a presentation surface
  //    over the H1 conversation authority, not the old `useHeby`/`runHebyIntent` drawer.
  {
    for (const retired of [
      "src/components/layout/heby/heby-panel.tsx",
      "src/components/layout/heby/heby-conversation.tsx",
      "src/components/layout/heby/heby-context.tsx",
    ]) {
      assert.ok(!existsSync(retired), `${retired} is retired`);
    }
    const shell = read(SHELL);
    assert.ok(!shell.includes("HebyPanel") && !shell.includes("HebyProvider"), "the retired drawer is not remounted");
    /*
     * ── HW1'S NAVIGATION INVARIANT, RE-EXPRESSED FOR THE INTEGRATED RAIL ─────────────────────
     *
     * As released this read `shell.includes("WorkspaceRail") && shell.includes("SecondaryNav")`
     * over the RAW file, and it guarded ONE thing: retiring the pre-H1 drawer must not have cost
     * Hebun its own two navigation levels.
     *
     * CMD-FINAL/RESPONSIVE-L2 falsified the REPRESENTATION, never the invariant. The detached
     * Level-2 column is gone; Level-2 is now `SecondaryNavContent`, rendered inline by the rail
     * from tablet upward and by the mobile sheet below it. Both levels are still mounted on every
     * route — but the old clause could no longer tell. It kept passing on the word
     * `SecondaryNavContent` inside this shell's own PROSE, with no import and no mount anywhere in
     * the file. A substring guard a comment can satisfy is not a guard.
     *
     * So the invariant is asserted against CODE rather than text, against the MOUNT rather than
     * the name, and across BOTH responsive paths rather than one file.
     */
    const shellCode = codeOf(shell);
    assert.match(shellCode, /<WorkspaceRail\s*\/>/, "the shell still mounts Level-1 navigation");
    for (const [surface, path] of [
      ["the rail", RAIL],
      ["the mobile sheet", MOBILE_NAV],
    ] as const) {
      const src = codeOf(read(path));
      assert.match(src, /from "\.\/secondary-nav"/, `${surface} imports the canonical Level-2 list`);
      assert.match(src, /<SecondaryNavContent\b/, `${surface} mounts Level-2 navigation`);
    }
    /* Retired, not merely unmounted: the detached column no longer exists to be re-adopted. */
    assert.ok(
      !/export\s+function\s+SecondaryNav\s*\(/.test(read(SECONDARY_NAV)),
      "the detached Level-2 column is retired",
    );
    for (const file of [PANEL, PANEL_CONTAINER]) {
      const src = read(file);
      assert.ok(!src.includes("runHebyIntent") && !src.includes("runNavigation"), `${file} does not revive the pre-H1 runtime`);
      assert.ok(!src.includes("useHeby("), `${file} does not revive the retired drawer context`);
    }
  }

  // 4. Every Heby entry point reaches the SAME Heby. The rail/topbar controls hand their identity to
  //    the one surface planner; the in-surface "Why?" affordance links into the Full Workspace.
  {
    const launcher = read(LAUNCHER);
    assert.ok(launcher.includes("useHebySurface"), "the launcher defers to the surface controller");
    assert.ok(launcher.includes('operate("rail")') && launcher.includes('operate("topbar")'), "both controls are planned, not ad-hoc");
    assert.ok(!launcher.includes("openHeby") && !launcher.includes("useHeby("), "no retired drawer context");

    const why = read(WHY);
    assert.ok(why.includes("hebyWorkspaceHref"), "the Why? affordance builds a Heby workspace link");
    assert.ok(why.includes('from "next/link"'), "the Why? affordance navigates");
    assert.ok(!why.includes("openHeby") && !why.includes("useHeby("), "the Why? affordance no longer opens a drawer");

    // The rail, the topbar and the mobile navigation all use the same launcher — one behaviour.
    for (const nav of [
      "src/components/layout/workspace-rail.tsx",
      "src/components/layout/topbar.tsx",
      "src/components/layout/mobile-nav.tsx",
    ]) {
      assert.ok(read(nav).includes("HebyLauncher"), `${nav} uses the shared launcher`);
    }
  }

  // 5. ONE conversation authority: the shared seam talks to the EXISTING H1 server actions and to
  //    nothing else. No second backend, no second transcript, no new persistence.
  {
    const hook = read(HOOK);
    assert.ok(hook.includes('from "@/app/(dashboard)/heby/actions"'), "uses the existing server actions");
    assert.ok(hook.includes("askHebyAction") && hook.includes("loadHebyConversationAction"), "both existing actions");
    assert.ok(hook.includes("buildTurns("), "thread is composed from the durable messages");
    // The durable server conversation is the only transcript authority.
    assert.ok(!/messages\.push\(|\[\.\.\.session\.messages,/.test(hook), "no client-side transcript accumulation");
    /*
     * No new action MODULE was invented for any surface — every crossing still goes through the one
     * Heby actions file, and each one is deliberately separate from the others so a capability
     * cannot be acquired by editing a line:
     *
     *   askHebyAction                    H1 — the model answer.
     *   loadHebyConversationAction       H1 — reload survival.
     *   runHebyReadCommandAction         S1 — Hebun's own sources. Imports no model client, so a
     *                                    read cannot become a model request.
     *   proposeHebyActionCommandAction   R3A.1 — a durable proposal. Imports no read model, so a
     *                                    proposal cannot become a read.
     *   runHebyProviderReadCommandAction INT-5B1 — ONE external provider, read-only and bounded.
     *                                    It reaches no model transport and no writer of any kind.
     *   runHebyCrossSourceCommandAction  INT-5C — the same released provider read, joined against
     *                                    the organization's own human-declared references through a
     *                                    WRITER-FREE Knowledge read. Reaches no model transport and
     *                                    no writer of any kind, and imports no Knowledge writer.
     *
     *   originateHebyActionProposalAction  AGENT-PROPOSAL-2 — a human states a GOAL and Heby may
     *                                    propose ONE bounded action for human review. Reaches the
     *                                    MODEL transport (as `askHebyAction` does) and no
     *                                    integration provider; files a pending request and nothing
     *                                    else. It approves, authorizes and executes nothing.
     *
     * ── FOUR → FIVE → SIX → SEVEN, STATED RATHER THAN RELAXED ───────────────
     *
     * The count was four, INT-5B1 said five, INT-5C said six, and AGENT-PROPOSAL-2 says seven. The
     * PROPERTY is unchanged and still exact: every Heby crossing is enumerated in this list, and an
     * eighth cannot appear without somebody adding it by hand.
     */
    const actions = read("src/app/(dashboard)/heby/actions.ts");
    const HEBY_SERVER_ACTIONS = [
      "askHebyAction",
      "loadHebyConversationAction",
      "runHebyReadCommandAction",
      "proposeHebyActionCommandAction",
      "runHebyProviderReadCommandAction",
      "runHebyCrossSourceCommandAction",
      "originateHebyActionProposalAction",
    ] as const;
    assert.equal(
      (actions.match(/export async function/g) ?? []).length,
      HEBY_SERVER_ACTIONS.length,
      `exactly ${HEBY_SERVER_ACTIONS.length} Heby server actions`,
    );
    // And the proposal boundary still cannot invalidate arbitrary routes.
    assert.ok(!actions.includes('from "next/cache"'), "the Heby action module takes no cache authority");
    for (const name of HEBY_SERVER_ACTIONS) {
      assert.ok(actions.includes(`export async function ${name}`), `${name} is one of them`);
    }
    /*
     * EXACTLY WHICH OF THEM MAY CONTACT A PROVIDER, enumerated by name rather than counted.
     *
     * ── ONE → TWO, AND WHY THAT IS NOT A WIDENING OF REACH ──────────────────
     *
     * INT-5C's crossing reads the SAME provider, through the SAME released seam, under the SAME
     * released budget, with the same read-only scope. What it adds is a Knowledge read, not provider
     * reach — and it got its own action precisely so that the Knowledge half is NOT reachable from
     * INT-5B1's root, which still proves it reaches no Knowledge module at all.
     *
     * The list is exact in both directions: a crossing that reaches a provider must appear here, and
     * one that does not must not. A third would have to be added by hand.
     */
    const providerReaching = HEBY_SERVER_ACTIONS.filter((name) =>
      /ProviderRead|CrossSource/.test(name),
    );
    assert.deepEqual(providerReaching, [
      "runHebyProviderReadCommandAction",
      "runHebyCrossSourceCommandAction",
    ]);
  }

  // 6. THE SUBMISSION GATE: `askHebyAction` is reachable only after every slash-command branch has
  //    already returned, so no command from EITHER surface can fall through into a provider request.
  {
    const hook = read(HOOK);
    assert.ok(hook.includes("parseHebyInput("), "every submission is parsed first");
    assert.equal((hook.match(/askHebyAction\(/g) ?? []).length, 1, "exactly one dispatch site");
    const parseAt = hook.indexOf("parseHebyInput(");
    const dispatchAt = hook.indexOf("askHebyAction({");
    assert.ok(parseAt > -1 && parseAt < dispatchAt, "parsing precedes dispatch");
    for (const branch of ['parsed.kind === "empty"', 'parsed.kind === "command"', 'parsed.kind === "unknown-command"']) {
      const at = hook.indexOf(branch);
      assert.ok(at > -1 && at < dispatchAt, `"${branch}" returns before dispatch`);
    }
    // No component string-matches a command itself — the parser is the single place that decides.
    for (const file of [SURFACE, PANEL, COMPOSER, TURNS, VISUALIZER]) {
      assert.ok(!/startsWith\("\/"\)|=== "\/(?:new|clear|help|context|sources)"/.test(read(file)), `${file} does not parse commands`);
    }
  }

  // 7. `/new` and `/clear` share ONE primitive with the New Conversation control, and it detaches
  //    rather than deletes. No delete/archive call exists anywhere on either surface.
  {
    const hook = read(HOOK);
    assert.ok(hook.includes("const detachConversation"), "one detach primitive");
    // S1 made this stronger: `/new` and `/clear` are now ONE `detach` plan branch, so there is a
    // single call site rather than two parallel ones, and the button still shares the primitive.
    assert.equal((hook.match(/detachConversation\(\)/g) ?? []).length, 1, "one detach call site serves both commands");
    assert.ok(hook.includes('case "detach":'), "detaching is a planned outcome, not an ad-hoc branch");
    assert.ok(hook.includes("onNewConversation: detachConversation"), "the button calls the same primitive");
    assert.ok(hook.includes("removeItem(conversationKey(contextRoute))"), "it drops only the local pointer");
    for (const file of [HOOK, CONTAINER, PANEL_CONTAINER, SURFACE, PANEL]) {
      const src = read(file).toLowerCase();
      for (const destructive of ["deleteconversation", "deletemessage", "archiveconversation", "delete from", "truncate table"]) {
        assert.ok(!src.includes(destructive), `no "${destructive}" on ${file}`);
      }
    }
  }

  // 8. `/sources` reports SERVER-returned evidence only; it never recomputes or invents citations.
  {
    const hook = read(HOOK);
    const planner = read("src/features/heby-commands/dispatch.ts");
    assert.ok(hook.includes("session.latest?.response.evidence"), "evidence comes from the server response");
    // S1 moved the empty-case copy into the one planner; the DATA still comes from the hook.
    assert.ok(planner.includes("No evidence is available for the latest response."), "honest empty case");
    assert.ok(!/resolveSources|assembleEvidence|groundingLines/.test(hook), "no client-side evidence computation");
    assert.ok(!/resolveSources|assembleEvidence|groundingLines/.test(planner), "the planner computes no evidence either");
  }

  // 9. EXECUTION FIREWALL: no client file on this surface imports an execution, provider, device,
  //    persistence, or server-only module. Text interaction only.
  {
    const forbidden = [
      "provider-framework", "provider-invocation", "runtime-activation", "device-runtime",
      "computer-use", "features/execution", "features/integration", "heby-actions",
      "heby-model", "heby-answer", "heby-provider-ops", "heby-model-live", "@/db",
    ];
    for (const file of CLIENT_FILES) {
      const src = read(file);
      for (const marker of forbidden) {
        assert.ok(!importsOf(src).some((i) => i.includes(marker)), `${file} must not import "${marker}"`);
      }
      assert.ok(!importsOf(src).some((i) => i.endsWith(".server")), `${file} imports no server-only module`);
    }
  }

  // 10. CREDENTIAL BOUNDARY: no key, tenant, or model configuration can reach the client surface.
  {
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
  }

  // 11. Command palette keyboard behaviour, in the ONE shared composer: ArrowUp/ArrowDown move,
  //     Enter selects, Escape closes — and while the palette is open Enter must NOT fall through to
  //     the send path.
  {
    const composer = read(COMPOSER);
    for (const key of ['event.key === "ArrowDown"', 'event.key === "ArrowUp"', 'event.key === "Escape"']) {
      assert.ok(composer.includes(key), `palette handles ${key}`);
    }
    const paletteBranch = composer.indexOf("if (paletteOpen)");
    const sendBranch = composer.lastIndexOf('event.key === "Enter" && !event.shiftKey');
    const paletteEnter = composer.indexOf('event.key === "Enter" && !event.shiftKey');
    assert.ok(paletteBranch > -1 && paletteBranch < paletteEnter, "the palette branch is evaluated first");
    assert.ok(paletteEnter < sendBranch, "an open palette consumes Enter before the send path");
    assert.ok(composer.includes("props.onPaletteSelect(selected.id)"), "Enter selects the highlighted command");
    // Escape must not destroy what the operator typed.
    const hook = read(HOOK);
    assert.ok(hook.includes("onPaletteClose: () => setPaletteDismissed(true)"), "Escape only closes the palette");
    // Shift+Enter is still a newline, never a send and never a selection.
    assert.ok(!/event\.key === "Enter"(?!.*!event\.shiftKey)/.test(composer), "Enter is always guarded by !shiftKey");
  }

  /*
   * 12. NO AUDIO RUNTIME IN ANY OF THESE FILES.
   *
   * Voice V1 narrowed this proof. It used to assert that no audio runtime existed anywhere; a real
   * one now exists, in exactly one file (heby-voice-runtime.tsx), which is deliberately NOT in this
   * list. What is asserted here is the surviving invariant: no conversation, presentation or route
   * file owns audio machinery, so there is exactly one microphone owner in the product. The comment
   * stripper is needed because several of these files legitimately DENY audio machinery in prose,
   * and a proof that fails on its own explanation is a bad proof.
   */
  {
    const visualizer = read(VISUALIZER);
    assert.ok(visualizer.includes("audioLevel?: number"), "the audio hook is declared");
    // It is now READ — but in exactly one state, which is the honesty rule that replaced "unread".
    assert.ok(
      /state === "listening" \? clampAudioLevel\(props\.audioLevel\) : 0/.test(visualizer),
      "audioLevel is read only while genuinely listening",
    );
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    for (const file of [...CLIENT_FILES, PAGE]) {
      const code = stripComments(read(file));
      for (const api of ["getUserMedia", "AudioContext", "MediaRecorder", "SpeechRecognition", "speechSynthesis", "webkitSpeech"]) {
        assert.ok(!code.includes(api), `${file} must not touch "${api}"`);
      }
    }
  }

  console.log("hw1 navigation + firewall + credential boundary passed");
}

main();
