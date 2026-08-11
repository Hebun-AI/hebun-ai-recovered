/*
 * HW2 — the immersive visual refinement, and the truth boundary it must not cross.
 *
 * The visual reference for this phase contained a full telemetry dashboard (Memory 98%, Reasoning
 * 96%, Organization 94%, Research 92%, System Health Excellent, Online, Listening, event/approval
 * counts). None of it has an authoritative Hebun source, so none of it may appear. These proofs
 * pin the visual direction we DID take and permanently ban the parts we did not.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";
import {
  HebyVisualizer,
  type HebyPresenceSize,
  type HebyPresenceState,
} from "../../src/components/layout/heby/heby-visualizer";
import type { HebyTurnView } from "../../src/components/layout/heby/heby-turns";

const NOOP = () => {};

function render(overrides: Partial<HebyWorkspaceProps>): string {
  const props: HebyWorkspaceProps = {
    contextLabel: "General Hebun workspace",
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
    onComposerChange: NOOP,
    onSubmit: NOOP,
    returnLabel: "Command",
    onClose: NOOP,
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

function visualizer(state: HebyPresenceState, size?: HebyPresenceSize): string {
  return renderToStaticMarkup(createElement(HebyVisualizer, { state, size }));
}

/** Visible copy only — attributes and utility classes are not what the operator reads. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

const TURN: HebyTurnView = { key: "h", role: "heby", content: "An answer.", durable: true };

/*
 * Every label and figure from the reference concept that Hebun cannot truthfully produce. Matching
 * is done on VISIBLE TEXT so a utility class can never trip it.
 */
const BANNED_TELEMETRY: readonly RegExp[] = [
  /\bMemory\b/i,
  /\bReasoning\b/i,
  /\bOrganization\b/i,
  /\bResearch\b/i,
  /System Health/i,
  /\bExcellent\b/i,
  /\bOnline\b/i,
  /\bSynced\b/i,
  /\bScanning\b/i,
  /\bHEBY ACTIVE\b/i,
  /\bLive\b/i,
  /\bUpdated \d/i,
  /\b\d+\s*new\b/i,
  /\b\d+\s*pending\b/i,
  /\b\d{1,3}\s?%/,
];

/*
 * VOICE V1 NARROWED THIS BAN — deliberately, and only this far.
 *
 * These assertions were written when Heby had no voice capability, so they banned the WORDS
 * outright. Voice V1 implements a real microphone, a real measured amplitude and a real recognizer,
 * so an absolute ban would now prove the product does not do something it does. The surviving
 * invariant — the thing the ban was actually protecting — is asserted instead:
 *
 *   a surface rendered WITHOUT a voice runtime makes NO audio claim, and no presence state other
 *   than a genuinely-live one may say "listening" or "speaking".
 *
 * Matched on visible copy and on the accessible name, not on every byte of markup:
 * `data-heby-audio="0"` is a measured value of zero, not a claim. Full proofs: tests/voice-v1/.
 */
/** Any claim of audio capability, matched on VISIBLE COPY. */
const AUDIO_CLAIM = /listening|speaking|microphone|voice|wake ?word|hey heby|audio|speech|transcri/i;
/** The accessible name must not claim audio either — a hidden claim is still a claim. */
const AUDIO_LABEL = /aria-label="[^"]*(listening|speaking|microphone|voice|audio|speech)/i;
const claimsAudio = (html: string) => AUDIO_CLAIM.test(textOf(html)) || AUDIO_LABEL.test(html);

function main(): void {
  // 1. The presence field is a real, substantial visual — not a small icon on a dark page.
  {
    const hero = visualizer("idle", "hero");
    assert.ok(hero.includes("<svg"), "the presence is a rendered field, not an icon glyph");
    const points = [...hero.matchAll(/<circle/g)].length;
    assert.ok(points > 100, `the point field has substance (found ${points} circles)`);
    assert.ok(hero.includes("<ellipse"), "orbital traces are present");
    assert.ok(hero.includes("radialGradient"), "the core is layered light, not a flat disc");
    assert.ok(/size-52|size-64|size-72/.test(hero), "hero presence is large");
  }

  // 2. The field is DETERMINISTIC — identical markup every render, so SSR and client agree and no
  //    randomness can masquerade as activity.
  {
    assert.equal(visualizer("idle", "hero"), visualizer("idle", "hero"), "field markup is stable");
    const source = readFileSync("src/components/layout/heby/heby-visualizer.tsx", "utf8");
    assert.ok(!source.includes("Math.random("), "no randomness in the presence field");
    assert.ok(!/Date\.now|new Date\(/.test(source), "no time-derived geometry");
  }

  // 3. Truthful state semantics survive the redesign, each with TEXT (never colour or motion alone).
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

    // Expanding traces exist ONLY while a request is genuinely in flight.
    assert.ok(responding.includes("heby-ripple"), "responding shows in-flight traces");
    for (const html of [idle, composing, unavailable]) {
      assert.ok(!html.includes("heby-ripple"), "no request in flight → no in-flight traces");
    }

    // `unavailable` is completely still. A dimmed-but-moving field would read as "working".
    assert.ok(!unavailable.includes("[animation:"), "unavailable declares no animation at all");
    assert.ok(!unavailable.includes("--heby-orbit") && !unavailable.includes("--heby-pulse"), "no motion timings either");

    // Motion intensity tracks the state honestly: in-flight is faster than idle.
    const orbitOf = (html: string) => Number(/--heby-orbit:\s*([\d.]+)s/.exec(html)?.[1] ?? NaN);
    assert.ok(orbitOf(responding) < orbitOf(composing), "responding moves faster than composing");
    assert.ok(orbitOf(composing) < orbitOf(idle), "composing moves faster than idle");
  }

  // 4. Reduced motion: every animation declaration is motion-safe gated, in every state and size.
  {
    for (const state of ["idle", "composing", "responding", "unavailable"] as const) {
      for (const size of ["hero", "compact", "inline"] as const) {
        const html = visualizer(state, size);
        for (const match of html.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
          assert.ok(match[0].includes("motion-safe:"), `unguarded animation in ${state}/${size}: ${match[0]}`);
        }
      }
    }
    const workspace = render({ turns: [TURN] });
    for (const match of workspace.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
      assert.ok(match[0].includes("motion-safe:"), `unguarded animation in the workspace: ${match[0]}`);
    }
  }

  /*
   * 5. NO AUDIO RUNTIME IN THE PRESENTATION FILES. Voice V1 narrowed this: a real audio runtime now
   * exists in exactly one file (heby-voice-runtime.tsx), which is deliberately absent from this
   * list. `audioLevel` is no longer "provably unread" — it is provably read in ONE state, which is
   * the stronger honesty claim that replaced it.
   */
  {
    const source = readFileSync("src/components/layout/heby/heby-visualizer.tsx", "utf8");
    assert.ok(source.includes("audioLevel?: number"), "the audio hook is declared");
    assert.ok(
      /state === "listening" \? clampAudioLevel\(props\.audioLevel\) : 0/.test(source),
      "audioLevel is read only while genuinely listening",
    );
    assert.ok(!/props\.audioLevel/.test(source.replace(/state === "listening" \? clampAudioLevel\(props\.audioLevel\) : 0/, "")),
      "there is no second read of audioLevel");
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    for (const file of [
      "src/components/layout/heby/heby-visualizer.tsx",
      "src/components/layout/heby/heby-workspace.tsx",
      "src/components/layout/heby/heby-workspace-client.tsx",
      "src/components/layout/heby/heby-turns.tsx",
    ]) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const api of ["getUserMedia", "AudioContext", "MediaRecorder", "SpeechRecognition", "speechSynthesis", "webkitSpeech"]) {
        assert.ok(!code.includes(api), `${file} must not touch "${api}"`);
      }
    }
  }

  // 6. THE TELEMETRY BAN. None of the reference concept's fabricated readouts may appear — in the
  //    empty state, mid-conversation, or with peripheral facts populated.
  {
    const surfaces = [
      render({}),
      render({ turns: [TURN], facts: { evidenceCount: 6, latestProvenance: { label: "Deterministic — model not used", tone: "muted" } } }),
      render({ presence: "responding", asking: true, pending: "a question" }),
      render({ presence: "unavailable", notice: { tone: "warn", text: "Sign in to ask Heby a question." } }),
    ];
    for (const html of surfaces) {
      const text = textOf(html);
      for (const banned of BANNED_TELEMETRY) {
        assert.ok(!banned.test(text), `fabricated readout leaked into the surface: ${banned} → ${text.slice(0, 220)}`);
      }
      // Rendered with NO voice runtime attached, which is the case this proof is about.
      assert.ok(!claimsAudio(html), "without a voice runtime there is no audio affordance");
      assert.ok(!/\b(agents?|approvals?|events?)\b/i.test(text), "no agent/approval/event readout");
    }
  }

  // 7. Peripheral facts are REAL or ABSENT — never a placeholder, a dash, or a zero.
  {
    const empty = textOf(render({}));
    assert.ok(!/evidence reference/i.test(empty), "no evidence figure before an answer exists");
    assert.ok(!/--|—\s*$/.test(empty.trim().slice(-4)), "no dash placeholder");

    const withFacts = textOf(
      render({
        turns: [TURN],
        facts: { evidenceCount: 6, latestProvenance: { label: "Provider disabled by Director — answered deterministically", tone: "muted" } },
      }),
    );
    assert.ok(withFacts.includes("6 evidence references"), "the real evidence count is shown once it exists");
    assert.ok(withFacts.includes("Provider disabled by Director"), "the real provenance is shown, not hidden for aesthetics");

    const singular = textOf(render({ turns: [TURN], facts: { evidenceCount: 1 } }));
    assert.ok(singular.includes("1 evidence reference") && !singular.includes("references"), "singular reads correctly");

    // A zero evidence count is a REAL value and must be stated, not suppressed.
    assert.ok(textOf(render({ turns: [TURN], facts: { evidenceCount: 0 } })).includes("0 evidence references"), "a real zero is stated");
  }

  // 8. Composition: hero mode anchors on the presence, and a conversation progressively takes the
  //    room, so the operator is never trapped in a decorative screen. HW3 replaced HW2's binary
  //    hero/thread switch with a graceful three-stage transition; the invariant HW2 was protecting
  //    (the hero presence never competes with reading) is asserted here in its stronger form.
  {
    const hero = render({});
    assert.ok(hero.includes('data-heby-mode="hero"'), "empty surface is hero mode");
    assert.ok(hero.includes('data-heby-size="hero"'), "hero mode shows the large presence");
    assert.ok(hero.includes("How can I help?"), "hero states the invitation");
    assert.ok(hero.includes("Context") && hero.includes("Authority"), "hero shows the two REAL peripheral labels");

    const emerging = render({ turns: [TURN] });
    assert.ok(emerging.includes('data-heby-mode="emerging"'), "a starting conversation leaves hero mode");
    assert.ok(emerging.includes('data-heby-size="compact"'), "the presence shrinks rather than vanishing");
    assert.ok(!emerging.includes('data-heby-size="hero"'), "the hero presence no longer competes with reading");
    assert.ok(!emerging.includes("How can I help?"), "the hero invitation is gone once a conversation exists");
    assert.ok(emerging.includes('aria-label="Conversation"'), "the conversation owns the space");

    const conversation = render({ turns: [TURN, TURN, TURN, TURN] });
    assert.ok(conversation.includes('data-heby-mode="conversation"'), "a grown thread becomes conversation-first");
    assert.ok(conversation.includes('data-heby-size="inline"'), "the presence collapses to an inline mark");
    assert.ok(!conversation.includes('data-heby-size="compact"'), "no presence block above a long transcript");
    assert.ok(!conversation.includes('data-heby-size="hero"'), "and certainly no hero presence");
  }

  // 9. The immersive treatment is scoped to the /heby content surface. It builds no second
  //    navigation — the reference concept's bottom tab bar must not appear.
  {
    const html = render({ turns: [TURN] });
    assert.ok(html.includes("heby-workspace"), "the theme scope is local to this surface");
    assert.ok(!/<nav/i.test(html), "the workspace ships no navigation of its own");
    const text = textOf(html);
    for (const tab of ["WORKSPACE", "KNOWLEDGE", "EVENTS", "APPROVALS"]) {
      assert.ok(!text.includes(tab), `no "${tab}" tab — Hebun already owns navigation`);
    }
  }

  // 10. Conversation, composer and command affordances survive the redesign intact.
  {
    const html = render({
      turns: [
        { key: "u", role: "user", content: "USER_TEXT", durable: true },
        { key: "h", role: "heby", content: "HEBY_TEXT", durable: true, provenance: { label: "Deterministic", tone: "muted" }, evidence: [{ sourceClass: "operations", recordRef: "op-1" }], limitations: ["It executes nothing."] },
      ],
      composerValue: "draft",
    });
    assert.ok(html.indexOf("USER_TEXT") < html.indexOf("HEBY_TEXT"), "chronological order preserved");
    assert.ok(html.includes('data-heby-role="user"') && html.includes('data-heby-role="heby"'), "roles stay distinct");
    assert.ok(html.includes("Evidence (1)") && html.includes("operations · op-1"), "evidence still reachable");
    assert.ok(html.includes("What this answer is"), "limitations still reachable");
    assert.ok(html.includes('aria-label="Message Heby"') && html.includes('aria-label="Send"'), "composer intact");
    assert.ok(html.includes("Enter to send, Shift+Enter for a new line"), "keyboard semantics discoverable");
    assert.ok(html.includes("/</span> for commands"), "slash discovery stays visible but subtle");
    assert.ok(html.includes("it never executes"), "the advisory boundary is still stated");
    // No database id and no key-shaped token reaches the markup.
    assert.ok(!/sk-[a-z0-9-]{6,}/i.test(html) && !html.includes("tenantId"), "no secret or tenant id in markup");
  }

  console.log("hw2 presence + truth boundary passed");
}

main();
