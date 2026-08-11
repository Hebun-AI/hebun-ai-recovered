/*
 * HW3 — what the two surfaces actually render: the strengthened presence, the Context/Authority
 * composition, the conversation-growth transition, the long-thread working surface, and the Quick
 * Panel's shared-but-distinct visual language.
 *
 * The HW2 visual reference contained a full telemetry dashboard (Memory 98%, Reasoning 96%,
 * Organization 94%, Research 92%, System Health Excellent, Online, Listening, event/approval
 * counts). None of it has an authoritative Hebun source, so none of it may appear on EITHER
 * surface. Those bans are re-proven here against the new surface as well.
 *
 * renderToStaticMarkup only. No browser, no network, no database.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";
import { HebyQuickPanel, type HebyQuickPanelProps } from "../../src/components/layout/heby/heby-quick-panel";
import { HebyVisualizer, type HebyPresenceState, type HebyPresenceSize } from "../../src/components/layout/heby/heby-visualizer";
import type { HebyTurnView } from "../../src/components/layout/heby/heby-turns";
import { resolveHebyComposition, HEBY_EMERGING_TURN_LIMIT } from "../../src/features/heby-surface";

const NOOP = () => {};

const RICH_TURN: HebyTurnView = {
  key: "h",
  role: "heby",
  content: "HEBY_ANSWER_TEXT",
  durable: true,
  provenance: { label: "Provider disabled by Director — answered deterministically", tone: "muted" },
  evidence: [{ sourceClass: "operations", recordRef: "op-1" }],
  limitations: ["It executes nothing."],
};
const USER_TURN: HebyTurnView = { key: "u", role: "user", content: "USER_QUESTION_TEXT", durable: true };

/** A realistic long conversation: 10 exchanges. */
function longThread(): HebyTurnView[] {
  const turns: HebyTurnView[] = [];
  for (let i = 0; i < 10; i++) {
    turns.push({ key: `u${i}`, role: "user", content: `QUESTION_${i}`, durable: true });
    turns.push({ key: `h${i}`, role: "heby", content: `ANSWER_${i}`, durable: true, provenance: { label: "Deterministic", tone: "muted" } });
  }
  return turns;
}

function workspace(overrides: Partial<HebyWorkspaceProps>): string {
  const props: HebyWorkspaceProps = {
    contextLabel: "Operations",
    authorityLabel: "Advisory only",
    turns: [],
    pending: null,
    asking: false,
    busy: false,
    presence: "idle",
    notice: null,
    commandOutput: null,
    facts: {},
    composerValue: "",
    suggestions: [],
    paletteItems: [],
    paletteIndex: 0,
    returnLabel: "Operations",
    onClose: NOOP,
    onComposerChange: NOOP,
    onSubmit: NOOP,
    onNewConversation: NOOP,
    onSuggestion: NOOP,
    onPaletteMove: NOOP,
    onPaletteSelect: NOOP,
    onPaletteClose: NOOP,
    onDismissCommandOutput: NOOP,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HebyWorkspace, props));
}

function panel(overrides: Partial<HebyQuickPanelProps>): string {
  const props: HebyQuickPanelProps = {
    contextLabel: "Operations",
    authorityLabel: "Advisory only",
    turns: [],
    pending: null,
    asking: false,
    busy: false,
    presence: "idle",
    notice: null,
    commandOutput: null,
    facts: {},
    composerValue: "",
    suggestions: [],
    paletteItems: [],
    paletteIndex: 0,
    onClose: NOOP,
    onComposerChange: NOOP,
    onSubmit: NOOP,
    onNewConversation: NOOP,
    onSuggestion: NOOP,
    onPaletteMove: NOOP,
    onPaletteSelect: NOOP,
    onPaletteClose: NOOP,
    onDismissCommandOutput: NOOP,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HebyQuickPanel, props));
}

function visualizer(state: HebyPresenceState, size?: HebyPresenceSize): string {
  return renderToStaticMarkup(createElement(HebyVisualizer, { state, size }));
}

/** Visible copy only — attributes and utility classes are not what the operator reads. */
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ");

/** Every fabricated readout from the visual reference. Matched on VISIBLE TEXT. */
const BANNED_TELEMETRY: readonly RegExp[] = [
  /\bMemory\b/i, /\bReasoning\b/i, /\bOrganization\b/i, /\bResearch\b/i, /System Health/i,
  /\bExcellent\b/i, /\bOnline\b/i, /\bSynced\b/i, /\bScanning\b/i, /\bHEBY ACTIVE\b/i,
  /\bLive\b/i, /\bUpdated \d/i, /\b\d+\s*new\b/i, /\b\d+\s*pending\b/i, /\b\d{1,3}\s?%/,
];
/*
 * VOICE V1 NARROWED THIS BAN — deliberately, and only this far.
 *
 * Written when Heby had no voice capability, this banned the WORDS outright. Voice V1 implements a
 * real microphone, a real measured amplitude and a real recognizer, so an absolute ban would now
 * prove the product does not do something it does. The surviving invariant is asserted instead:
 *
 *   a surface rendered WITHOUT a voice runtime makes NO audio claim, and no presence state other
 *   than a genuinely-live one may say "listening" or "speaking".
 *
 * Matched on visible copy and on the accessible name, not on every byte of markup:
 * `data-heby-audio="0"` is a measured value of zero, not a claim. Full proofs: tests/voice-v1/.
 */
const AUDIO_CLAIM = /listening|speaking|microphone|voice|wake ?word|hey heby|audio|speech|transcri/i;
const AUDIO_LABEL = /aria-label="[^"]*(listening|speaking|microphone|voice|audio|speech)/i;
const claimsAudio = (html: string) => AUDIO_CLAIM.test(textOf(html)) || AUDIO_LABEL.test(html);

function main(): void {
  /* ── 18 + 19. Truthful presence states survive the strengthening ─────────── */
  {
    const idle = visualizer("idle");
    const composing = visualizer("composing");
    const responding = visualizer("responding");
    const unavailable = visualizer("unavailable");

    assert.ok(idle.includes("Ready"));
    assert.ok(composing.includes("Waiting for your message"));
    assert.ok(responding.includes("Working on your question"));
    assert.ok(unavailable.includes("Not available right now"));
    for (const [name, html] of Object.entries({ idle, composing, responding, unavailable })) {
      assert.ok(html.includes(`data-heby-presence="${name}"`), `${name} is addressable`);
      assert.ok(!claimsAudio(html), `${name} makes no audio/voice claim`);
    }

    // In-flight traces exist ONLY while a request is genuinely in flight.
    assert.ok(responding.includes("heby-ripple"));
    for (const html of [idle, composing, unavailable]) assert.ok(!html.includes("heby-ripple"));

    // 19. `unavailable` is visually INACTIVE — a dimmed-but-moving field would read as "working".
    assert.ok(!unavailable.includes("[animation:"), "unavailable declares no animation at all");
    assert.ok(!unavailable.includes("--heby-orbit") && !unavailable.includes("--heby-pulse"), "no motion timings either");
    assert.ok(unavailable.includes("opacity-25"), "unavailable is visibly reduced");
    assert.ok(!unavailable.includes("text-(--heby-presence)"), "unavailable drops the live accent");
    // Both the forward AND the counter-rotating trace must be still.
    assert.ok(!unavailable.includes("heby-orbit-reverse"), "the counter-rotation is off too");

    // Motion intensity still tracks the state honestly.
    const orbitOf = (html: string) => Number(/--heby-orbit:\s*([\d.]+)s/.exec(html)?.[1] ?? NaN);
    assert.ok(orbitOf(responding) < orbitOf(composing), "responding moves faster than composing");
    assert.ok(orbitOf(composing) < orbitOf(idle), "composing moves faster than idle");
  }

  /* ── HW3: the orb is STRONGER, and strengthened by STRUCTURE, not by loudness ─ */
  {
    const hero = visualizer("idle", "hero");
    const source = readFileSync("src/components/layout/heby/heby-visualizer.tsx", "utf8");

    // Real interior volume: two nested shells, not one denser skin of dots.
    assert.equal((source.match(/buildShell\(/g) ?? []).length, 3, "two shells are built from one generator");
    const circles = [...hero.matchAll(/<circle/g)].length;
    assert.ok(circles > 250, `the field gained genuine substance (found ${circles} circles)`);

    // A centre of mass and a silhouette — the two things that make it read as an OBJECT.
    assert.ok(hero.includes('fill="url(#heby-nucleus)"'), "the presence has a defined nucleus");
    assert.ok(hero.includes('stroke="url(#heby-rim)"'), "the presence has a lit rim, so it has an edge");
    assert.ok(hero.includes("<ellipse"), "orbital traces are present");
    assert.ok(/size-72/.test(hero), "the hero presence owns more of the empty state than HW2's");

    // And it did NOT get there by being loud. These are the forbidden shortcuts.
    assert.ok(!/blur-|backdrop-blur|drop-shadow-/.test(hero), "no blur was used to fake presence");
    assert.ok(!/<filter|feGaussianBlur|feTurbulence/.test(hero), "no SVG blur/noise filters");
    assert.ok(!/mix-blend|saturate-\d|brightness-\d{3}/.test(hero), "no blend/saturation tricks");
    assert.ok(!source.includes("Math.random("), "no randomness masquerading as activity");
    assert.ok(!/Date\.now|new Date\(/.test(source), "no time-derived geometry");

    // Deterministic: identical markup every render, so SSR and client agree.
    assert.equal(visualizer("idle", "hero"), visualizer("idle", "hero"), "field markup is stable");
  }

  /* ── 20. Reduced motion is preserved, in every state and every size ──────── */
  {
    for (const state of ["idle", "composing", "responding", "unavailable"] as const) {
      for (const size of ["hero", "compact", "inline"] as const) {
        const html = visualizer(state, size);
        for (const match of html.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
          assert.ok(match[0].includes("motion-safe:"), `unguarded animation in ${state}/${size}: ${match[0]}`);
        }
      }
    }
    for (const html of [workspace({ turns: [RICH_TURN] }), panel({ turns: [RICH_TURN] })]) {
      for (const match of html.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
        assert.ok(match[0].includes("motion-safe:"), `unguarded animation on a Heby surface: ${match[0]}`);
      }
    }
  }

  /* ── HW3: the Context/Authority composition belongs to the orb, not to the edges ─ */
  {
    const hero = workspace({ contextLabel: "Operations", authorityLabel: "Advisory only" });
    assert.ok(hero.includes("Context") && hero.includes("Authority"), "both REAL labels are present");
    // Brought IN to the presence's own field — the HW2 full-width edge container is gone.
    assert.ok(hero.includes("max-w-[42rem]"), "the labels sit inside the orb's visual field");
    assert.ok(!hero.includes("max-w-[64rem]"), "no full-width HUD rail at the screen edges");
    // A deliberate diagonal, not symmetry for symmetry's sake.
    assert.ok(hero.includes("top-[16%]") && hero.includes("bottom-[14%]"), "the two labels are deliberately offset");
    assert.ok(!/top-1\/2 -translate-y-1\/2[\s\S]*top-1\/2 -translate-y-1\/2/.test(hero), "they are not mirrored on one axis");
    // Typography and a hairline, never card chrome — and never fabricated telemetry around the orb.
    assert.ok(hero.includes("h-px w-9"), "the relationship is drawn with a quiet anchor, not a card");
    for (const banned of BANNED_TELEMETRY) {
      assert.ok(!banned.test(textOf(hero)), `fabricated readout near the presence: ${banned}`);
    }
  }

  /* ── 26. The conversation-growth transition, driven by REAL state ────────── */
  {
    // The pure decision first.
    assert.equal(resolveHebyComposition({ turnCount: 0, pending: null, asking: false }), "hero");
    assert.equal(resolveHebyComposition({ turnCount: 0, pending: "a question", asking: true }), "emerging");
    assert.equal(resolveHebyComposition({ turnCount: HEBY_EMERGING_TURN_LIMIT, pending: null, asking: false }), "emerging");
    assert.equal(resolveHebyComposition({ turnCount: HEBY_EMERGING_TURN_LIMIT + 1, pending: null, asking: false }), "conversation");
    assert.equal(resolveHebyComposition({ turnCount: 20, pending: null, asking: false }), "conversation");

    // Then the rendered consequence: presence-first → conversation-first.
    const hero = workspace({});
    assert.ok(hero.includes('data-heby-mode="hero"') && hero.includes('data-heby-size="hero"'));
    assert.ok(hero.includes("How can I help?"), "the hero states the invitation");

    const emerging = workspace({ turns: [USER_TURN, RICH_TURN] });
    assert.ok(emerging.includes('data-heby-mode="emerging"'), "one exchange leaves hero mode");
    assert.ok(emerging.includes('data-heby-size="compact"'), "the presence shrinks rather than disappearing");
    assert.ok(!emerging.includes('data-heby-size="hero"'), "the hero presence is gone");
    assert.ok(!emerging.includes("How can I help?"), "and so is the hero invitation");

    const conversation = workspace({ turns: longThread() });
    assert.ok(conversation.includes('data-heby-mode="conversation"'), "a grown thread is conversation-first");
    assert.ok(conversation.includes('data-heby-size="inline"'), "the presence is only an inline mark");
    assert.ok(!conversation.includes('data-heby-size="compact"') && !conversation.includes('data-heby-size="hero"'),
      "no presence block sits above a long transcript");
  }

  /* ── 15/25/27/28 on a LONG conversation: the working surface stays usable ── */
  {
    const html = workspace({
      turns: longThread(),
      facts: { evidenceCount: 3, latestProvenance: { label: "Deterministic — model not used", tone: "muted" } },
      composerValue: "still typing",
      presence: "composing",
    });
    // 25. Every turn renders, in order, with roles distinguished structurally.
    assert.ok(html.indexOf("QUESTION_0") < html.indexOf("ANSWER_0"), "chronological order preserved");
    assert.ok(html.indexOf("ANSWER_0") < html.indexOf("QUESTION_9"), "the whole thread is present");
    assert.ok(html.includes('data-heby-role="user"') && html.includes('data-heby-role="heby"'), "roles stay distinct");
    assert.ok(html.includes('aria-label="Conversation"'), "the conversation owns the space");
    // 27. The composer is still there, still labelled, still describes its keyboard semantics.
    assert.ok(html.includes('aria-label="Message Heby"') && html.includes('aria-label="Send"'), "composer available");
    assert.ok(html.includes("Enter to send, Shift+Enter for a new line"), "keyboard semantics discoverable");
    // The scroll region is the transcript only: header and composer never scroll away.
    assert.ok(html.includes("overflow-y-auto"), "the transcript scrolls");
    assert.ok(html.includes("h-[calc(100dvh-var(--topbar-h))]"), "the surface itself does not grow the page");
    // 28. Peripheral truth stays visible during a long thread.
    assert.ok(textOf(html).includes("3 evidence references"), "the real evidence count is still shown");
    assert.ok(textOf(html).includes("Deterministic — model not used"), "the real provenance is still shown");
    assert.ok(html.includes("it never executes"), "the advisory boundary is still stated");
    // And nothing fabricated crept in with the length.
    for (const banned of BANNED_TELEMETRY) assert.ok(!banned.test(textOf(html)), `banned readout: ${banned}`);
  }

  /* ── The way out of the Full Workspace is explicit ───────────────────────── */
  {
    const html = workspace({ returnLabel: "Operations" });
    assert.ok(html.includes("Back to Operations"), "an explicit return control names its destination");
    assert.ok(html.includes("New conversation"), "New Conversation is still there");
    // The Full Workspace is a surface, not a modal.
    assert.ok(!html.includes('role="dialog"'), "the workspace is not a dialog");
  }

  /* ── 17/25/28. THE QUICK PANEL: same Heby, different job ─────────────────── */
  {
    const empty = panel({ suggestions: ["What should I pay attention to in operations right now?"] });
    // It is a genuine overlay surface, closable, and labelled for assistive technology.
    assert.ok(empty.includes('role="dialog"') && empty.includes('aria-label="Heby"'), "the panel is an addressable dialog");
    assert.ok(empty.includes('aria-label="Close Heby panel"'), "an obvious close control exists");
    assert.ok(empty.includes('data-heby-surface="quick-panel"'), "the surface names itself");
    // SHARED language: the same token scope, the same composer, the same identity mark.
    assert.ok(empty.includes("heby-surface"), "it inherits the Heby token scope");
    assert.ok(empty.includes('aria-label="Message Heby"'), "the same composer");
    assert.ok(empty.includes("Enter to send, Shift+Enter for a new line"), "the same keyboard semantics");
    assert.ok(empty.includes("it never executes"), "the same advisory boundary");
    assert.ok(empty.includes('data-heby-size="inline"'), "a compact presence identity");
    // DIFFERENT job: it does NOT squeeze the immersive hero composition into a panel.
    assert.ok(!empty.includes("heby-workspace"), "it is not the Full Workspace");
    assert.ok(!empty.includes('data-heby-size="hero"'), "no immersive orb in the panel");
    assert.ok(!empty.includes("How can I help?"), "no hero invitation");
    assert.ok(!empty.includes("Context</span>") && !empty.includes("Authority</span>"), "no hero peripheral rail");
    // It keeps the current workspace visible: it is a side overlay, not a full takeover.
    assert.ok(empty.includes("sm:w-[27rem]"), "a right-hand overlay on desktop");
    assert.ok(empty.includes("top-(--topbar-h)"), "it sits below the control that opened it");
    assert.ok(empty.includes("left-0"), "and becomes a full-width sheet on mobile");

    // 25 + 28. The SAME conversation rendering, provenance, evidence and limitations.
    const withThread = panel({
      turns: [USER_TURN, RICH_TURN],
      facts: { evidenceCount: 1, latestProvenance: { label: "Deterministic — model not used", tone: "muted" } },
    });
    assert.ok(withThread.indexOf("USER_QUESTION_TEXT") < withThread.indexOf("HEBY_ANSWER_TEXT"), "chronological");
    assert.ok(withThread.includes('data-heby-role="user"') && withThread.includes('data-heby-role="heby"'), "roles distinct");
    assert.ok(withThread.includes("Provider disabled by Director"), "provenance preserved");
    assert.ok(withThread.includes("Evidence (1)") && withThread.includes("operations · op-1"), "evidence preserved");
    assert.ok(withThread.includes("What this answer is"), "limitations preserved");
    assert.ok(textOf(withThread).includes("1 evidence reference"), "peripheral truth preserved");

    // 24. No fabricated telemetry, no audio claim, no second navigation — on this surface either.
    for (const html of [empty, withThread, panel({ presence: "unavailable", notice: { tone: "warn", text: "Sign in to ask Heby a question." } })]) {
      const text = textOf(html);
      for (const banned of BANNED_TELEMETRY) assert.ok(!banned.test(text), `panel leaked a fabricated readout: ${banned}`);
      // Rendered with NO voice runtime attached, which is the case this proof is about.
      assert.ok(!claimsAudio(html), "without a voice runtime the panel has no audio affordance");
      assert.ok(!html.includes("data-heby-voice-mic"), "no microphone control appears without a runtime");
      assert.ok(!/<nav/i.test(html), "the panel ships no navigation of its own");
      assert.ok(!/sk-[a-z0-9-]{6,}/i.test(html) && !html.includes("tenantId"), "no secret or tenant id in markup");
    }
  }

  console.log("hw3 dual-surface render + visual truth passed");
}

main();
