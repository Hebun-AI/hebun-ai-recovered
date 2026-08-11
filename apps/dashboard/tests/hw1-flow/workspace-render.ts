/*
 * HW1 — Heby Full Workspace rendering (renderToStaticMarkup, no browser).
 *
 * Proves the workspace layout, the visualizer's truthful state set, the command palette and command
 * output blocks — and, just as importantly, proves what is ABSENT: no fabricated telemetry, no
 * health/agent/approval counters, no voice or audio claim, no execution control.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";
import { HebyVisualizer, type HebyPresenceState } from "../../src/components/layout/heby/heby-visualizer";
import { HEBY_PALETTE_COMMANDS, commandUsage } from "../../src/features/heby-commands";
import type { HebyCommandResult } from "../../src/features/heby-commands";

const NOOP = () => {};

function render(overrides: Partial<HebyWorkspaceProps>): string {
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

/** Build a command result the way the shared seam does. */
function commandResult(command: string, lines: readonly string[]): HebyCommandResult {
  return { command, title: command, lines, tone: "info", provenance: "Local — no model was used." };
}

function visualizer(state: HebyPresenceState): string {
  return renderToStaticMarkup(createElement(HebyVisualizer, { state }));
}

/** Visible copy only — attributes and utility classes are not what the operator reads. */
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/** Numbers-with-units and score-shaped strings that would imply telemetry we cannot read. */
const FABRICATED_METRIC = /\b\d{1,3}\s?%|\b\d+\s+(?:agents?|approvals?|events?|systems?|tasks?)\b|uptime|latency|health score/i;
/*
 * VOICE V1 NARROWED THIS BAN — deliberately, and only this far.
 *
 * This assertion was written when Heby had no voice capability at all, so it banned the WORDS
 * outright. Voice V1 implements a real microphone, a real measured amplitude and a real recognizer,
 * so an absolute ban would now be a proof that the product does not do something it does. What must
 * still hold, and is what is asserted below, is the thing the ban was protecting:
 *
 *   a surface rendered WITHOUT a voice runtime makes NO audio claim of any kind, and no presence
 *   state other than a genuinely-live one may say "listening" or "speaking".
 *
 * The bans are therefore applied to what the operator actually reads and to the accessible name,
 * rather than to every byte of markup — `data-heby-audio="0"` is a measured value of zero, not a
 * claim. The full Voice V1 proofs live in tests/voice-v1/.
 */
/** Any claim of audio capability, matched on VISIBLE COPY. */
const AUDIO_CLAIM = /listening|speaking|microphone|voice|wake ?word|hey heby|audio|speech|transcri/i;
/** The accessible name must not claim audio either — a hidden claim is still a claim. */
const AUDIO_LABEL = /aria-label="[^"]*(listening|speaking|microphone|voice|audio|speech)/i;
const claimsAudio = (html: string) => AUDIO_CLAIM.test(textOf(html)) || AUDIO_LABEL.test(html);

function main(): void {
  // 1. It is a WORKSPACE, not a drawer: no modal dialog chrome, no fixed side rail, no close button.
  {
    const html = render({});
    assert.ok(html.includes('aria-label="Heby workspace"'), "the surface names itself a workspace");
    assert.ok(!html.includes('role="dialog"') && !html.includes('aria-modal'), "not a modal drawer");
    assert.ok(!/max-w-\[440px\]|inset-y-0 right-0/.test(html), "no 440px side-panel geometry");
    assert.ok(!/aria-label="Close Heby"/.test(html), "no drawer close affordance");
    assert.ok(html.includes("heby-workspace"), "carries the immersive workspace theme scope");
  }

  // 2. Header states the CONTEXT and the AUTHORITY — and never an online/connected indicator.
  {
    const html = render({ contextLabel: "General Hebun workspace", authorityLabel: "Advisory only" });
    assert.ok(html.includes("General Hebun workspace"), "context shown");
    assert.ok(html.includes("Advisory only"), "authority shown");
    assert.ok(!/online|connected|healthy|live now|all systems/i.test(html), "no connectivity indicator");
    assert.ok(html.includes("New conversation"), "New Conversation control present");
  }

  // 3. NO fabricated telemetry cards anywhere: no memory %, reasoning %, organization %, health,
  //    agent count, approval count, or event count.
  {
    const html = render({
      turns: [{ key: "h", role: "heby", content: "an answer", durable: true }],
      suggestions: ["Summarize the current picture."],
    });
    const text = textOf(html);
    assert.ok(!FABRICATED_METRIC.test(text), `no fabricated metric appears in the workspace: ${text}`);
    assert.ok(!/Memory|Reasoning|Organization\b/i.test(text), "no memory/reasoning/organization gauges");
    assert.ok(!/Analyzing|Scanning|Monitoring|agents? (?:active|working)/i.test(text), "no fake activity");
  }

  // 4. Visualizer: exactly four truthful states, each with TEXT (never colour alone), and motion
  //    only while a request is genuinely in flight.
  {
    const idle = visualizer("idle");
    const composing = visualizer("composing");
    const responding = visualizer("responding");
    const unavailable = visualizer("unavailable");

    assert.ok(idle.includes("Ready") && idle.includes('aria-label="Heby is ready for a question"'));
    assert.ok(composing.includes("Waiting for your message"), "composing has a text label");
    assert.ok(responding.includes("Working on your question"), "responding has a text label");
    assert.ok(unavailable.includes("Not available right now"), "unavailable has a text label");
    for (const [name, html] of Object.entries({ idle, composing, responding, unavailable })) {
      assert.ok(html.includes(`data-heby-presence="${name}"`), `${name} state is addressable`);
      assert.ok(!claimsAudio(html), `${name} state makes no audio/voice claim`);
    }
    // Ripples exist ONLY while responding — no ambient "AI thinking" animation.
    assert.ok(responding.includes("heby-ripple"), "responding animates");
    for (const html of [idle, composing, unavailable]) {
      assert.ok(!html.includes("heby-ripple"), "no request in flight → no responding animation");
    }
    // Unavailable is visibly inert: it does not breathe.
    assert.ok(!unavailable.includes("heby-breathe"), "unavailable does not animate");
    // EVERY animation declaration is motion-safe gated (and the global reduced-motion rule
    // flattens whatever survives). Structure-independent: no `[animation:` may appear unguarded.
    for (const html of [idle, composing, responding, unavailable]) {
      for (const match of html.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
        assert.ok(match[0].includes("motion-safe:"), `unguarded animation declaration: ${match[0]}`);
      }
      assert.ok(!/animate-(?!pulse)/.test(html) || html.includes("motion-safe:animate-"), "no unguarded animate-* utility");
    }
    // `unavailable` is completely still — a dimmed animation would read as "working".
    assert.ok(!unavailable.includes("[animation:"), "unavailable declares no animation at all");
  }

  // 5. The visualizer is driven by the surface's real state, and the workspace passes it through.
  {
    assert.ok(render({ presence: "responding", asking: true, pending: "q" }).includes('data-heby-presence="responding"'));
    assert.ok(render({ presence: "unavailable" }).includes('data-heby-presence="unavailable"'));
    assert.ok(render({ presence: "composing", composerValue: "hi" }).includes('data-heby-presence="composing"'));
  }

  // 6. No voice/audio affordance exists on the surface at all.
  {
    // Rendered with NO voice runtime attached, which is the case this proof is about.
    const html = render({ composerValue: "hello", suggestions: ["Summarize the current picture."] });
    assert.ok(!claimsAudio(html), "without a voice runtime the workspace never mentions voice or listening");
    assert.ok(!html.includes("data-heby-voice-mic"), "no microphone control appears without a runtime");
    assert.ok(!/<audio|getUserMedia|AudioContext|type="?record/i.test(html), "no audio machinery");
  }

  // 7. Command palette renders its items, marks the active one, and is labelled for assistive tech.
  {
    const items = HEBY_PALETTE_COMMANDS.filter((c) => ["clear", "context"].includes(c.id));
    const html = render({ composerValue: "/c", paletteItems: items, paletteIndex: 1 });
    assert.ok(html.includes('aria-label="Heby commands"'), "palette is labelled");
    assert.ok(html.includes("/clear") && html.includes("/context"), "palette lists matching commands");
    assert.ok(html.includes('aria-selected="true"'), "the highlighted item is announced, not colour-only");
    assert.ok(!html.includes("/help"), "the palette shows only what was passed in");
    // No palette without palette items.
    assert.ok(!render({}).includes('aria-label="Heby commands"'), "no palette when nothing matches");
  }

  // 8. Command output is a clearly-labelled local block — never dressed up as a Heby answer.
  {
    const html = render({ commandOutput: commandResult("/help", HEBY_PALETTE_COMMANDS.map(commandUsage)) });
    assert.ok(html.includes("/help"), "the command that produced the block is shown");
    // React escapes the argument angle brackets, so compare on decoded text.
    const decoded = html.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    for (const command of HEBY_PALETTE_COMMANDS) {
      assert.ok(decoded.includes(commandUsage(command)), `${commandUsage(command)} listed by /help`);
    }
    assert.ok(html.includes('aria-label="Dismiss command output"'), "the block can be dismissed");
    // It is not inside the conversation list, so it can never be mistaken for a durable turn.
    const conversationIndex = html.indexOf('aria-label="Conversation"');
    const outputIndex = html.indexOf("Dismiss command output");
    assert.ok(conversationIndex === -1 || outputIndex > conversationIndex, "command output is outside the thread");
  }

  // 9. /sources with no evidence says so plainly rather than inventing citations.
  {
    const html = render({ commandOutput: commandResult("/sources", ["No evidence is available for the latest response."]) });
    assert.ok(html.includes("No evidence is available for the latest response."), "honest empty evidence");
  }

  // 10. NO execution control is reachable from the workspace.
  {
    const html = render({
      turns: [{ key: "h", role: "heby", content: "advice", durable: true, limitations: ["It executes nothing."] }],
      commandOutput: commandResult("/help", HEBY_PALETTE_COMMANDS.map(commandUsage)),
    });
    assert.ok(
      !/\b(Run|Execute|Deploy|Approve|Reject|Delete|Terminate|Restart|Apply)\b\s*<\/(?:button|a)>/i.test(html),
      "no execution/approval action control",
    );
    assert.ok(html.includes("it never executes"), "the surface states it does not execute");
  }

  // 11. Composer semantics + accessibility: labelled, described, keyboard hint, no autofocus trap.
  {
    const html = render({ notice: { tone: "warn", text: "Sign in to ask Heby a question." } });
    assert.ok(html.includes('aria-label="Message Heby"'), "composer is labelled");
    assert.ok(html.includes('aria-describedby="heby-composer-hint"'), "composer has a description");
    assert.ok(html.includes("Enter to send, Shift+Enter for a new line"), "keyboard semantics are discoverable");
    assert.ok(html.includes("Sign in to ask Heby a question."), "notice rendered truthfully");
  }

  console.log("hw1 workspace render checks passed");
}

main();
