/*
 * VOICE V1 — what the surfaces actually render.
 *
 * The presence field is now driven by a real measurement, so the honesty question changed shape:
 * it is no longer "does Heby claim audio?" but "does Heby claim audio ONLY when audio is genuinely happening?"
 * These proofs answer that on rendered markup — both surfaces, every voice state, with and without a
 * voice runtime attached.
 *
 * They also prove the fallback that matters most: a browser that cannot do voice, a denied
 * microphone, and a failed recognizer all leave typed Heby completely intact.
 *
 * renderToStaticMarkup only. No browser, no network, no database, no microphone.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HebyWorkspace, type HebyWorkspaceProps } from "../../src/components/layout/heby/heby-workspace";
import { HebyQuickPanel, type HebyQuickPanelProps } from "../../src/components/layout/heby/heby-quick-panel";
import {
  HebyVisualizer,
  type HebyPresenceState,
  type HebyPresenceSize,
} from "../../src/components/layout/heby/heby-visualizer";
import type { HebyVoiceView } from "../../src/components/layout/heby/heby-voice-control";
import { resolveHebyPresence } from "../../src/components/layout/heby/heby-presence";
import {
  resolveHebyVoiceCapability,
  type HebyVoiceState,
} from "../../src/features/heby-voice";

const NOOP = () => {};

const FULL_CAPABILITY = resolveHebyVoiceCapability({
  hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: true,
  hasSpeechSynthesis: true, hasOnDeviceRecognition: false, isSecureContext: true,
});
const NO_VOICE_BROWSER = resolveHebyVoiceCapability({
  hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: false,
  hasSpeechSynthesis: false, hasOnDeviceRecognition: false, isSecureContext: true,
});

function voiceView(overrides: Partial<HebyVoiceView> = {}): HebyVoiceView {
  return {
    state: "idle",
    capability: FULL_CAPABILITY,
    outputEnabled: false,
    failure: null,
    disclosureLines: ["Line one.", "Line two."],
    busy: false,
    language: "en",
    /* The conservative default, so a test that forgets to set it cannot accidentally assert local. */
    recognitionLocality: "cloud",
    /* V1.3 defaults: nothing stalled, nothing installing — the quiet case. */
    mediaStalled: false,
    installStatus: "idle",
    onSelectLanguage: NOOP,
    onInstallOnDevice: null,
    onActivate: NOOP,
    onAcknowledge: NOOP,
    onStop: NOOP,
    onCancel: NOOP,
    onToggleOutput: NOOP,
    onStopSpeaking: NOOP,
    ...overrides,
  };
}

function workspace(overrides: Partial<HebyWorkspaceProps>): string {
  const props: HebyWorkspaceProps = {
    contextLabel: "Operations", authorityLabel: "Advisory only", turns: [], pending: null,
    asking: false, busy: false, presence: "idle", notice: null, commandOutput: null, facts: {},
    composerValue: "", suggestions: [], paletteItems: [], paletteIndex: 0, returnLabel: "Operations",
    onClose: NOOP, onComposerChange: NOOP, onSubmit: NOOP, onNewConversation: NOOP,
    onSuggestion: NOOP, onPaletteMove: NOOP, onPaletteSelect: NOOP, onPaletteClose: NOOP,
    onDismissCommandOutput: NOOP,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HebyWorkspace, props));
}

function panel(overrides: Partial<HebyQuickPanelProps>): string {
  const props: HebyQuickPanelProps = {
    contextLabel: "Operations", authorityLabel: "Advisory only", turns: [], pending: null,
    asking: false, busy: false, presence: "idle", notice: null, commandOutput: null, facts: {},
    composerValue: "", suggestions: [], paletteItems: [], paletteIndex: 0,
    onClose: NOOP, onComposerChange: NOOP, onSubmit: NOOP, onNewConversation: NOOP,
    onSuggestion: NOOP, onPaletteMove: NOOP, onPaletteSelect: NOOP, onPaletteClose: NOOP,
    onDismissCommandOutput: NOOP,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(HebyQuickPanel, props));
}

function visualizer(state: HebyPresenceState, audioLevel?: number, size?: HebyPresenceSize): string {
  return renderToStaticMarkup(createElement(HebyVisualizer, { state, audioLevel, size }));
}

/** Visible copy only — attributes and utility classes are not what the operator reads. */
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ");

/** The whole opening tag of the button carrying `marker`, whatever order React emitted attributes in. */
function buttonWith(html: string, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<button[^>]*${escaped}[^>]*>`).exec(html)?.[0] ?? "";
}

/**
 * The real `disabled` ATTRIBUTE — never the `disabled:` Tailwind variant that legitimately appears
 * in these controls' styling.
 */
const isDisabled = (tag: string) => /\sdisabled[=\s>]/.test(tag);

const ALL_VOICE_STATES: readonly HebyVoiceState[] = [
  "unsupported", "idle", "disclosure", "requesting", "listening", "transcribing", "review",
  "speaking", "denied", "error",
];

function main(): void {
  /* ── 10. THE ORB USES THE REAL SUPPLIED LEVEL ────────────────────────────── */
  {
    for (const level of [0, 0.25, 0.5, 0.87, 1]) {
      const html = visualizer("listening", level);
      assert.ok(html.includes(`data-heby-audio="${level}"`), `the measured level ${level} reaches the field`);
      assert.ok(html.includes("--heby-audio:" + level) || html.includes(`--heby-audio:${level}`),
        "the level is published as the one CSS variable");
    }
    // The three reactive elements all exist while listening, and all read the same variable.
    const listening = visualizer("listening", 0.6, "hero");
    assert.ok(listening.includes("heby-audio-scale"), "the nucleus answers to the measurement");
    assert.ok(listening.includes("heby-audio-scale-soft"), "the field answers, far more faintly");
    assert.ok(listening.includes("heby-audio-aura"), "the atmosphere answers");
    // And the state is stated in words, not only in movement.
    assert.ok(textOf(listening).includes("Listening"), "listening says so");
    assert.ok(listening.includes('aria-label="Heby is listening to your microphone"'), "and says so accessibly");
  }

  /* ── 11. AND CANNOT FABRICATE ONE ────────────────────────────────────────── */
  {
    // A level supplied in ANY other state is ignored completely — no stale reading can animate.
    for (const state of ["idle", "composing", "responding", "speaking", "unavailable"] as const) {
      const html = visualizer(state, 0.95);
      assert.ok(html.includes('data-heby-audio="0"'), `${state} must report no measurement`);
      assert.ok(!html.includes("heby-audio-scale"), `${state} must not react to an amplitude`);
      assert.ok(!html.includes("heby-audio-aura"), `${state} must not react to an amplitude`);
    }
    // Out-of-range and non-finite values become silence, not motion.
    for (const bad of [-1, 4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const html = visualizer("listening", bad);
      const value = /data-heby-audio="([^"]+)"/.exec(html)?.[1];
      const numeric = Number(value);
      assert.ok(numeric >= 0 && numeric <= 1, `an out-of-range level leaked through: ${value}`);
    }
    assert.ok(visualizer("listening", undefined).includes('data-heby-audio="0"'), "no level means silence");
    // Silence while listening is STILL: the state is honest, but nothing swells.
    assert.ok(visualizer("listening", 0).includes('data-heby-audio="0"'), "a silent room reports zero");
  }

  /*
   * ── 9 (presentation). SPEAKING IS A STATE, NOT AN AMPLITUDE ──────────────
   * Browser speech synthesis exposes no output stream, so no amplitude can be measured from it. The
   * state is rendered honestly; a waveform-shaped animation would be a fabricated one.
   */
  {
    const speaking = visualizer("speaking", 0.9);
    assert.ok(textOf(speaking).includes("Speaking the answer"), "speaking says so");
    assert.ok(speaking.includes('data-heby-audio="0"'), "with no amplitude claimed");
    assert.ok(speaking.includes("--heby-orbit"), "it has its own cadence");
    assert.notEqual(
      /--heby-orbit:\s*([\d.]+)s/.exec(speaking)?.[1],
      /--heby-orbit:\s*([\d.]+)s/.exec(visualizer("responding"))?.[1],
      "speaking is distinguishable from waiting for the model",
    );
  }

  /* ── 12. REDUCED MOTION IS PRESERVED, AND VOICE STILL WORKS ──────────────── */
  {
    for (const state of ["listening", "speaking"] as const) {
      for (const size of ["hero", "compact", "inline"] as const) {
        const html = visualizer(state, 0.7, size);
        for (const match of html.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
          assert.ok(match[0].includes("motion-safe:"), `unguarded animation in ${state}/${size}: ${match[0]}`);
        }
      }
    }
    for (const html of [
      workspace({ presence: "listening", audioLevel: 0.5, voice: voiceView({ state: "listening" }) }),
      panel({ presence: "listening", audioLevel: 0.5, voice: voiceView({ state: "listening" }) }),
    ]) {
      for (const match of html.matchAll(/[\s"']([a-z-]*:)*\[animation:/g)) {
        assert.ok(match[0].includes("motion-safe:"), `unguarded animation on a voice surface: ${match[0]}`);
      }
    }
    /*
     * The amplitude reaches the screen as a CSS transform, which the global reduced-motion rule only
     * flattens the DURATION of. So it is cancelled explicitly — and the capability is not: the
     * operator keeps voice, and reads the written state instead of watching the orb.
     */
    const css = readFileSync("src/app/globals.css", "utf8");
    const audioBlockStart = css.indexOf(".heby-audio-scale {");
    const reduced = css.slice(audioBlockStart, css.indexOf("@keyframes heby-turn-in", audioBlockStart));
    assert.match(reduced, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.heby-audio-scale,[\s\S]*transform: none;/,
      "reduced motion cancels the amplitude transform");
    assert.ok(!/@media \(prefers-reduced-motion: reduce\)[\s\S]*display:\s*none/.test(reduced),
      "reduced motion must not remove the voice affordance");
    // No keyframes drive the audio layer: it is a function of the measurement, not of a clock.
    assert.ok(!/@keyframes heby-audio/.test(css), "the audio layer runs on measurement, never on a timer");
  }

  /* ── The presence arbiter, and what it refuses to let voice claim ────────── */
  {
    // A surface that cannot answer never looks like it is listening.
    assert.equal(resolveHebyPresence({ conversation: "unavailable", voice: "listening" }), "unavailable");
    assert.equal(resolveHebyPresence({ conversation: "unavailable", voice: "speaking" }), "unavailable");
    // A model request in flight outranks voice — it is what the operator is waiting on.
    assert.equal(resolveHebyPresence({ conversation: "responding", voice: "listening" }), "responding");
    // Genuine voice states show.
    assert.equal(resolveHebyPresence({ conversation: "idle", voice: "listening" }), "listening");
    assert.equal(resolveHebyPresence({ conversation: "composing", voice: "speaking" }), "speaking");
    /*
     * And the conversation-neutral voice states change NOTHING. Waiting for permission, reviewing a
     * transcript, or a failure are not things the orb may dramatize.
     */
    for (const quiet of ["unsupported", "idle", "disclosure", "requesting", "transcribing", "review", "denied", "error"] as const) {
      assert.equal(resolveHebyPresence({ conversation: "idle", voice: quiet }), "idle", `${quiet} moved the orb`);
      assert.equal(resolveHebyPresence({ conversation: "composing", voice: quiet }), "composing", `${quiet} moved the orb`);
    }
    // No voice runtime at all leaves the conversation's own presence untouched.
    for (const conversation of ["idle", "composing", "responding", "unavailable"] as const) {
      assert.equal(resolveHebyPresence({ conversation, voice: null }), conversation);
    }
  }

  /* ── 1/2/3 (presentation). RENDERING A SURFACE CLAIMS NOTHING ────────────── */
  {
    for (const html of [workspace({ voice: voiceView() }), panel({ voice: voiceView() })]) {
      const text = textOf(html);
      // The control exists and invites; it does not announce a state that is not happening.
      assert.ok(html.includes('data-heby-voice-mic="idle"'), "the microphone control is present and idle");
      assert.ok(html.includes('aria-label="Start voice input"'), "it invites rather than claims");
      assert.ok(html.includes('aria-pressed="false"'), "it is not engaged");
      assert.ok(!/Listening/.test(text), "an idle surface never says Listening");
      assert.ok(!/Speaking/.test(text), "an idle surface never says Speaking");
      assert.ok(!html.includes("data-heby-voice-state"), "no voice state line on an idle surface");
      assert.ok(!html.includes("data-heby-voice-disclosure"), "no disclosure until the operator asks");
      assert.ok(html.includes('data-heby-audio="0"'), "and no amplitude is claimed");
    }
  }

  /* ── The disclosure is a real gate, shown BEFORE anything opens ──────────── */
  {
    const html = workspace({ voice: voiceView({ state: "disclosure", disclosureLines: ["EGRESS_LINE", "STORAGE_LINE"] }) });
    assert.ok(html.includes('data-heby-voice-disclosure="open"'), "the disclosure is addressable");
    assert.ok(html.includes('role="dialog"') && html.includes('aria-label="Before you use voice input"'),
      "and is announced as a dialog");
    assert.ok(textOf(html).includes("EGRESS_LINE") && textOf(html).includes("STORAGE_LINE"),
      "the operator reads the actual disclosure");
    assert.ok(textOf(html).includes("Turn on the microphone") && textOf(html).includes("Not now"),
      "both answers are offered");
    assert.ok(!textOf(html).includes("Listening"), "nothing is open while the disclosure is up");
  }

  /* ── Every voice state renders truthfully on BOTH surfaces ───────────────── */
  {
    for (const state of ALL_VOICE_STATES) {
      for (const render of [workspace, panel]) {
        const presence = resolveHebyPresence({ conversation: "idle", voice: state });
        const html = render({ presence, audioLevel: state === "listening" ? 0.4 : 0, voice: voiceView({ state }) });
        const text = textOf(html);

        // THE CENTRAL RULE: only a genuinely open microphone may say "Listening".
        assert.equal(/\bListening\b/.test(text), state === "listening", `"Listening" mismatched in ${state}`);
        // And only genuine playback may say "Speaking".
        assert.equal(/\bSpeaking\b/.test(text), state === "speaking", `"Speaking" mismatched in ${state}`);
        // A measurement exists in exactly one state.
        assert.ok(html.includes(state === "listening" ? 'data-heby-audio="0.4"' : 'data-heby-audio="0"'),
          `amplitude mismatched in ${state}`);
        // The composer survives every voice state — voice never takes the keyboard away.
        assert.ok(html.includes('aria-label="Message Heby"'), `the composer vanished in ${state}`);
        assert.ok(html.includes('aria-label="Send"'), `send vanished in ${state}`);
      }
    }
  }

  /* ── 14. THE TRANSCRIPT IS EDITABLE, AND SENDING STAYS THE OPERATOR'S ───── */
  {
    const html = workspace({
      composerValue: "what changed in operations today",
      voice: voiceView({ state: "review" }),
      presence: "idle",
    });
    // The field holds the transcript and is NOT disabled while it is under review.
    assert.ok(html.includes("what changed in operations today"), "the transcript is in the composer");
    // The real `disabled` ATTRIBUTE, not the `disabled:` utility class in the field's styling.
    const textarea = /<textarea[^>]*>/.exec(html)?.[0] ?? "";
    assert.ok(textarea.startsWith("<textarea"), "the field is rendered");
    assert.ok(!/\sdisabled[=\s>]/.test(textarea), "the transcript can be edited before sending");
    // Send is enabled, and it is the ordinary Send — there is no separate "send voice" control.
    assert.ok(!isDisabled(buttonWith(html, 'aria-label="Send"')), "the operator can send it");
    assert.ok(!/aria-label="[^"]*[Ss]end (voice|transcript|recording)/.test(html), "no second send path");
    assert.ok(textOf(html).includes("Check the text before sending"), "and is told to check it first");
  }

  /* ── 26. PLAYBACK CAN ALWAYS BE STOPPED, AND OUTPUT IS OPT-IN ────────────── */
  {
    const speaking = workspace({ voice: voiceView({ state: "speaking", outputEnabled: true }), presence: "speaking" });
    assert.ok(textOf(speaking).includes("Stop speaking"), "playback has an explicit stop");
    // Voice output is OFF by default and is a real toggle, announced as pressed/unpressed.
    const off = workspace({ voice: voiceView() });
    assert.ok(off.includes('data-heby-voice-output="off"'), "spoken answers are off until asked for");
    assert.ok(off.includes('aria-label="Turn on spoken answers"') && off.includes('aria-pressed="false"'));
    const on = workspace({ voice: voiceView({ outputEnabled: true }) });
    assert.ok(on.includes('data-heby-voice-output="on"') && on.includes('aria-label="Turn off spoken answers"'));
    // A browser with no synthesizer gets no toggle at all — not a dead one.
    const noSynth = workspace({ voice: voiceView({ capability: NO_VOICE_BROWSER, state: "unsupported" }) });
    assert.ok(!noSynth.includes("data-heby-voice-output"), "no spoken-answer toggle where nothing can speak");
  }

  /* ── 27. VOICE FAILURE FALLS BACK TO TEXT, ALWAYS ────────────────────────── */
  {
    // Unsupported browser: the control is inert and says why, and typing is untouched.
    const unsupported = workspace({
      voice: voiceView({ capability: NO_VOICE_BROWSER, state: "unsupported" }),
      composerValue: "typed by hand",
    });
    assert.ok(isDisabled(buttonWith(unsupported, 'data-heby-voice-mic="unsupported"')), "the control is inert");
    assert.ok(unsupported.includes("This browser cannot turn speech into text."), "and says why");
    assert.ok(unsupported.includes("typed by hand"), "typed text is untouched");
    assert.ok(!/<textarea[^>]*\sdisabled[=\s>]/.test(unsupported), "and the field still accepts typing");

    // Denied: the reason is VISIBLE, because the operator just tried.
    const denied = workspace({ voice: voiceView({ state: "denied" }) });
    assert.ok(textOf(denied).includes("Microphone blocked"), "the state is stated");
    // Apostrophes arrive HTML-escaped from the renderer; match the part that carries the meaning.
    assert.ok(/Microphone access is blocked for this site/.test(textOf(denied)), "the cause is named");
    assert.ok(/site settings, then try again/.test(textOf(denied)), "with the way to fix it");
    assert.ok(isDisabled(buttonWith(denied, 'data-heby-voice-mic="denied"')), "and it does not re-prompt");

    // A failure sentence is shown and never reads as Heby itself failing.
    const failed = workspace({
      voice: voiceView({ state: "error", failure: "Speech recognition failed, so nothing was transcribed. You can still type." }),
    });
    assert.ok(textOf(failed).includes("You can still type"), "the fallback is named");
    assert.ok(!/<textarea[^>]*\sdisabled[=\s>]/.test(failed), "and it is genuinely available");
    assert.ok(failed.includes('aria-label="Send"'), "sending typed text still works");
  }

  /* ── 17. ACCESSIBILITY: keyboard-reachable, labelled, announced, not colour-only ── */
  {
    const listening = workspace({ voice: voiceView({ state: "listening" }), presence: "listening", audioLevel: 0.3 });
    // Real buttons: focusable and operable by keyboard with no custom handling.
    for (const control of ['data-heby-voice-mic="listening"', 'data-heby-voice-output="off"']) {
      const button = buttonWith(listening, control);
      assert.ok(button.startsWith("<button"), `${control} is a real button`);
      assert.ok(!button.includes("tabindex=\"-1\""), `${control} stays in the tab order`);
      assert.ok(/aria-label="/.test(button), `${control} has an accessible name`);
      assert.ok(button.includes("focus-visible:outline"), `${control} shows keyboard focus`);
    }
    // State changes are announced politely rather than assertively.
    assert.ok(/role="status"[^>]*aria-live="polite"|aria-live="polite"[^>]*role="status"/.test(listening),
      "voice state is announced to assistive technology");
    // Never colour-only: the state is in words as well as in the dot and the orb.
    assert.ok(textOf(listening).includes("Listening"), "the state is written, not only coloured");
    // The decorative dot is hidden from assistive technology.
    assert.ok(/<span aria-hidden="true" class="[^"]*rounded-full/.test(listening), "the status dot is decorative only");
  }

  /* ── 24. NO SECRET, TENANT, OR PROVIDER DETAIL IN VOICE MARKUP ───────────── */
  {
    for (const state of ALL_VOICE_STATES) {
      for (const render of [workspace, panel]) {
        const html = render({ voice: voiceView({ state }), audioLevel: 0.4, presence: "idle" });
        assert.ok(!/sk-[a-z0-9-]{6,}/i.test(html), `${state} leaked a credential-shaped string`);
        for (const forbidden of ["tenantId", "TenantContext", "apiKey", "ANTHROPIC", "conversationId", "requestId"]) {
          assert.ok(!html.includes(forbidden), `${state} leaked "${forbidden}" into markup`);
        }
      }
    }
  }

  /* ── Voice defers to the conversation, and never traps an open microphone ── */
  {
    // While the seam is busy, a NEW capture cannot be started.
    const busy = workspace({ busy: true, voice: voiceView({ busy: true }) });
    assert.ok(isDisabled(buttonWith(busy, 'data-heby-voice-mic="idle"')), "busy defers a new capture");
    // But an already-open microphone can ALWAYS be stopped, busy or not.
    const busyListening = workspace({ busy: true, voice: voiceView({ state: "listening", busy: true }) });
    assert.ok(!isDisabled(buttonWith(busyListening, 'data-heby-voice-mic="listening"')),
      "an open microphone can always be closed");
    assert.ok(busyListening.includes('aria-label="Stop listening"'), "and the way to close it is named");
  }

  /* ── Both surfaces get the SAME voice, at their own density ──────────────── */
  {
    const view = voiceView({ state: "listening" });
    const w = workspace({ voice: view, presence: "listening", audioLevel: 0.5 });
    const p = panel({ voice: view, presence: "listening", audioLevel: 0.5 });
    for (const html of [w, p]) {
      assert.ok(html.includes('data-heby-voice-mic="listening"'), "the same control");
      assert.ok(html.includes('data-heby-voice-controls="available"'), "the same availability");
      assert.ok(textOf(html).includes("Listening"), "the same words");
      assert.ok(html.includes('data-heby-audio="0.5"'), "the same measurement");
    }
    // Different density, never a different component: the panel's buttons are smaller.
    assert.ok(w.includes("size-10") && p.includes("size-9"), "density differs, the component does not");
  }

  /* ── V1.1 — WHERE THE AUDIO GOES IS ON SCREEN WHILE IT IS GOING THERE ───── */
  {
    /*
     * The disclosure is read once. The locality badge is visible for the whole of every capture, so
     * an operator who is speaking never has to remember what they agreed to.
     */
    for (const render of [workspace, panel]) {
      const cloud = render({ voice: voiceView({ state: "listening", recognitionLocality: "cloud" }), presence: "listening" });
      assert.ok(cloud.includes('data-heby-voice-locality="cloud"'), "the locality is stated while listening");
      assert.ok(!/on-device/i.test(textOf(cloud)), "an unproven locality never reads as on-device");
      assert.ok(textOf(cloud).includes("Browser speech service"), "and it names what is processing the audio");

      const local = render({
        voice: voiceView({ state: "listening", recognitionLocality: "on-device" }),
        presence: "listening",
      });
      assert.ok(local.includes('data-heby-voice-locality="on-device"'));
      assert.ok(/on-device/i.test(textOf(local)), "a proven local recognition is stated plainly");

      // It appears only while something is genuinely being heard or finished — never at rest.
      for (const state of ["idle", "review", "speaking", "denied"] as const) {
        const resting = render({ voice: voiceView({ state }) });
        assert.ok(!resting.includes("data-heby-voice-locality"), `${state} must not carry a locality badge`);
      }
      assert.ok(
        render({ voice: voiceView({ state: "transcribing" }) }).includes("data-heby-voice-locality"),
        "a recognizer still finishing is still processing audio, and says so",
      );
    }
  }

  /* ── V1.1 — THE INSTALL OFFER EXISTS ONLY WHERE IT WOULD DO SOMETHING ───── */
  {
    const notOffered = workspace({ voice: voiceView({ state: "disclosure", onInstallOnDevice: null }) });
    assert.ok(!notOffered.includes("data-heby-voice-install"), "no offer where no pack can be installed");
    assert.ok(!/Keep speech on this device/i.test(textOf(notOffered)), "and no promise of one");

    const offered = workspace({ voice: voiceView({ state: "disclosure", onInstallOnDevice: NOOP }) });
    assert.ok(offered.includes('data-heby-voice-install="offered"'), "the offer appears where a pack is downloadable");
    assert.ok(/Keep speech on this device/i.test(textOf(offered)), "and says what it is for");
    // It is an ordinary button, inside the disclosure, alongside the way out.
    assert.ok(/type="button"/.test(buttonWith(offered, 'data-heby-voice-install="offered"')));
    assert.ok(/Not now/.test(textOf(offered)), "declining is still available beside it");
  }

  /* ── V1.1 — THE LANGUAGE IS A CONTROL, AND IT LOCKS DURING A CAPTURE ────── */
  {
    for (const render of [workspace, panel]) {
      const english = render({ voice: voiceView({ language: "en" }) });
      assert.ok(english.includes('data-heby-voice-language="en"'), "the chosen language is on the control");
      assert.ok(english.includes('aria-label="Voice input language"'), "and the control is named for assistive tech");
      // Both options are offered, each under its own name.
      assert.ok(textOf(english).includes("Türkçe") && textOf(english).includes("English"),
        "a Turkish operator finds Turkish under its own name");

      const turkish = render({ voice: voiceView({ language: "tr" }) });
      assert.ok(turkish.includes('data-heby-voice-language="tr"'));

      /*
       * LOCKED WHILE A CAPTURE IS OPEN. Changing language mid-recognition would mean earlier and
       * later words were interpreted under different assumptions with nothing on screen saying so.
       */
      const selectTag = (html: string) => /<select[^>]*data-heby-voice-language[^>]*>/.exec(html)?.[0] ?? "";
      for (const state of ["listening", "transcribing", "requesting"] as const) {
        const busyCapture = render({ voice: voiceView({ state }) });
        assert.ok(isDisabled(selectTag(busyCapture)), `the language must be locked during ${state}`);
      }
      for (const state of ["idle", "review", "speaking"] as const) {
        assert.ok(!isDisabled(selectTag(render({ voice: voiceView({ state }) }))),
          `the language must be changeable at ${state}`);
      }
      // A browser that cannot do voice input offers no language control at all.
      assert.ok(
        !render({ voice: voiceView({ capability: NO_VOICE_BROWSER, state: "unsupported" }) })
          .includes("data-heby-voice-language"),
        "no language control where there is no voice input",
      );
    }
  }

  /* ── V1.1 — SPEAKING HAS MOTION, NEVER A MEASUREMENT ─────────────────────── */
  {
    /*
     * Browser speech synthesis exposes no measurable output, so `speaking` is a STATE ANIMATION and
     * says nothing about amplitude. This proves the two are visibly different things: the same
     * `audioLevel` prop that drives the orb while listening is ignored entirely while speaking.
     */
    const speaking = visualizer("speaking", 0.9);
    assert.ok(speaking.includes('data-heby-audio="0"'), "a spoken answer never reports an amplitude");
    assert.ok(speaking.includes('data-heby-presence="speaking"'), "it has its own honest state instead");
    const listening = visualizer("listening", 0.9);
    assert.ok(listening.includes('data-heby-audio="0.9"'), "only a real microphone measurement is reported");

    // The same holds through a whole surface, with voice output on.
    const surface = workspace({
      voice: voiceView({ state: "speaking", outputEnabled: true }),
      presence: "speaking",
      audioLevel: 0.8,
    });
    assert.ok(surface.includes('data-heby-audio="0"'), "and the surface cannot route a level around it");
  }

  /* ── V1.3 — A STALLED REQUEST SAYS SO, AND OFFERS THE WAY OUT ────────────── */
  {
    /*
     * The defect this closes: "Waiting for microphone permission" rendered forever, with no
     * explanation and no obvious exit, while the browser silently held the promise.
     */
    for (const render of [workspace, panel]) {
      const quiet = render({ voice: voiceView({ state: "requesting", mediaStalled: false }) });
      assert.ok(!quiet.includes("data-heby-voice-stalled"), "a normal request shows no stall notice");
      assert.ok(textOf(quiet).includes("Waiting for microphone permission"), "just the ordinary state line");

      const stalled = render({ voice: voiceView({ state: "requesting", mediaStalled: true }) });
      assert.ok(stalled.includes('data-heby-voice-stalled="true"'), "a stalled request is named");
      const words = textOf(stalled);
      assert.match(words, /has not answered/i, "it says what is true");
      assert.match(words, /Cancel the request/i, "and the way out is right there");
      /*
       * IT MUST NOT LIE. A pending promise is not a denial, and Hebun cannot see whether Chrome, the
       * operating system or an administrator is holding it.
       */
      for (const forbidden of ["denied", "blocked", "macOS", "administrator"]) {
        assert.ok(!words.toLowerCase().includes(forbidden.toLowerCase()),
          `a stalled request must not claim "${forbidden}"`);
      }
      // The state machine has NOT moved — the notice is words, not a state.
      assert.ok(stalled.includes('data-heby-voice-mic="requesting"'), "the machine still says requesting");
      // And it appears only there.
      for (const state of ["idle", "listening", "review", "denied"] as const) {
        assert.ok(
          !render({ voice: voiceView({ state, mediaStalled: true }) }).includes("data-heby-voice-stalled"),
          `${state} must not render a stall notice`,
        );
      }
    }
  }

  /* ── V1.3 — AN INSTALL REQUEST IS VISIBLE, INCLUDING WHEN IT CHANGES NOTHING ── */
  {
    const quiet = workspace({ voice: voiceView({ installStatus: "idle" }) });
    assert.ok(!quiet.includes("data-heby-voice-install-status"), "at rest there is nothing to say");

    for (const status of ["requested", "installed", "no-change", "failed"] as const) {
      const html = workspace({ voice: voiceView({ installStatus: status }) });
      assert.ok(html.includes(`data-heby-voice-install-status="${status}"`), `${status} is rendered`);
      assert.ok(textOf(html).trim().length > 0, `${status} produces words`);
    }
    /*
     * The exact failure the Director hit: pressing the button and seeing nothing. `no-change` is now
     * a visible, honest outcome rather than a silently vanished offer.
     */
    const noChange = textOf(workspace({ voice: voiceView({ installStatus: "no-change" }) }));
    assert.match(noChange, /still reports/i, "an unchanged availability is stated");
    assert.ok(!/installed/i.test(noChange), "and never dressed as success");

    const failed = textOf(workspace({ voice: voiceView({ installStatus: "failed" }) }));
    assert.match(failed, /could not be installed/i, "a failure is stated");
    // Only the confirmed case may claim the audio stays local.
    assert.match(textOf(workspace({ voice: voiceView({ installStatus: "installed" }) })), /stays on this machine/i);
    for (const status of ["requested", "no-change", "failed"] as const) {
      assert.ok(
        !/stays on this machine/i.test(textOf(workspace({ voice: voiceView({ installStatus: status }) }))),
        `${status} must not claim locality`,
      );
    }
  }

  console.log("voice-v1 surfaces + presence + accessibility passed");
}

main();
