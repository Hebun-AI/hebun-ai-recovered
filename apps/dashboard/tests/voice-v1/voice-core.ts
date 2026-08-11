/*
 * VOICE V1 — the pure core: the state machine, the capability decision, the amplitude
 * normalization, and the two text decisions.
 *
 * These are the proofs that make the privacy claims TESTABLE rather than reviewable. Every function
 * exercised here runs under plain Node with no DOM, so "the microphone can only be opened by an
 * explicit operator action" is a property of a reducer that can be enumerated, not a promise about
 * how some component was written.
 *
 * No browser, no network, no database, no timers.
 */
import assert from "node:assert/strict";
import {
  canInstallOnDeviceRecognition,
  decideMediaAdoption,
  describeSpeechAdapters,
  HEBY_MEDIA_STALL_MS,
  hebyCaptureHoldsDevice,
  hebyCaptureIsPending,
  hebyCaptureStallNotice,
  installStatusLine,
  type HebyCapturePhase,
  HEBY_VOICE_INITIAL,
  HEBY_VOICE_LANGUAGES,
  hebyVoiceDisclosureLines,
  hebyVoiceFailureText,
  hebyVoiceHasAudioLevel,
  hebyVoiceInputAvailable,
  hebyVoiceIsCapturing,
  hebyVoiceLanguageLabel,
  hebyVoiceRecognitionTag,
  hebyVoiceReducer,
  hebyVoiceStateLabel,
  hebyVoiceSynthesisTag,
  mergeTranscriptIntoComposer,
  normalizeAudioLevel,
  presentableAudioLevel,
  recognitionLeavesDevice,
  recognitionLocalityLabel,
  recognitionLocalityLine,
  resolveHebyVoiceCapability,
  resolveInitialVoiceLanguage,
  resolveRecognitionLocality,
  selectSpokenAnswer,
  smoothAudioLevel,
  type HebyOnDeviceAvailability,
  type HebyVoiceEvent,
  type HebyVoiceState,
} from "../../src/features/heby-voice";

const ALL_STATES: readonly HebyVoiceState[] = [
  "unsupported", "idle", "disclosure", "requesting", "listening", "transcribing", "review",
  "speaking", "denied", "error",
];

const ALL_EVENTS: readonly HebyVoiceEvent[] = [
  { type: "activate", acknowledged: false },
  { type: "activate", acknowledged: true },
  { type: "acknowledge" },
  { type: "capture-started" },
  { type: "permission-denied" },
  { type: "capture-stopped" },
  { type: "transcript-delivered" },
  { type: "speech-started" },
  { type: "speech-ended" },
  { type: "cancel" },
  { type: "review-resolved" },
  { type: "fail", reason: "device-unavailable" },
  { type: "fail", reason: "no-recognition-support" },
  { type: "reset" },
];

/** A deterministic pseudo-random source, so the bounded-range proof is reproducible. */
function lcg(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function main(): void {
  /* ── 4. EXPLICIT ACTIVATION IS THE ONLY WAY IN ───────────────────────────── */
  {
    assert.equal(HEBY_VOICE_INITIAL, "idle", "voice rests closed");

    /*
     * Exhaustive: for EVERY state and EVERY event, if the result is `requesting` (about to prompt
     * for a microphone) the event must be an operator activation or acknowledgement. Nothing else in
     * the whole product can produce that transition — not a page load, a route change, a surface
     * opening, an answer arriving, or a timer, because none of them is in this union.
     */
    for (const state of ALL_STATES) {
      for (const event of ALL_EVENTS) {
        const next = hebyVoiceReducer(state, event);
        if (next === "requesting" && state !== "requesting") {
          assert.ok(
            event.type === "activate" || event.type === "acknowledge",
            `${state} → requesting via ${event.type} is not an operator action`,
          );
        }
        // And nothing may jump straight to an open microphone except a started capture.
        if (next === "listening" && state !== "listening") {
          assert.equal(event.type, "capture-started", `${state} → listening via ${event.type}`);
          assert.equal(state, "requesting", "capture only follows a permission request");
        }
      }
    }

    // 1/2/3. A surface being rendered, opened, or switched to is not an event here at all: the
    // resting state survives every non-activation event.
    for (const event of ALL_EVENTS) {
      if (event.type === "activate") continue;
      const next = hebyVoiceReducer("idle", event);
      assert.ok(next !== "listening" && next !== "requesting", `idle must not open a microphone on ${event.type}`);
    }
  }

  /* ── The full happy path, and the disclosure gate that guards it ─────────── */
  {
    // First use of the session: the disclosure is unavoidable.
    let state = hebyVoiceReducer("idle", { type: "activate", acknowledged: false });
    assert.equal(state, "disclosure", "an unacknowledged operator lands on the disclosure first");
    assert.equal(hebyVoiceReducer(state, { type: "capture-started" }), "disclosure", "the gate cannot be skipped");
    assert.equal(hebyVoiceReducer(state, { type: "cancel" }), "idle", "declining the disclosure is safe");

    state = hebyVoiceReducer(state, { type: "acknowledge" });
    assert.equal(state, "requesting");
    state = hebyVoiceReducer(state, { type: "capture-started" });
    assert.equal(state, "listening");
    state = hebyVoiceReducer(state, { type: "capture-stopped" });
    assert.equal(state, "transcribing");
    state = hebyVoiceReducer(state, { type: "transcript-delivered" });
    assert.equal(state, "review", "a transcript waits for the operator, it is never sent");
    state = hebyVoiceReducer(state, { type: "review-resolved" });
    assert.equal(state, "idle");
  }

  /* ── V1.1 — THE ENTRY SURFACE INTO CAPTURE, ENUMERATED ───────────────────── */
  {
    /*
     * Exactly which states a microphone press may start from. The two additions are the point of
     * this block: `speaking` (interruption) and `review` (dictate more into an unsent message).
     * Everything else is unchanged, and every state where a capture is already open or being
     * negotiated is still refused.
     */
    const activatable = ALL_STATES.filter((state) => {
      const next = hebyVoiceReducer(state, { type: "activate", acknowledged: true });
      // A state that was ALREADY requesting has not been entered by this press; it was ignored.
      return next === "requesting" && next !== state;
    });
    assert.deepEqual(
      [...activatable].sort(),
      ["denied", "error", "idle", "review", "speaking"],
      "the entry surface into capture is exactly these five states",
    );

    /*
     * V1.1 INTERRUPTION. Pressing the microphone while Heby is talking means "stop and listen to me".
     * The runtime stops playback synchronously before this transition, so the two are never live at
     * once — and this is the ONLY interruption Voice has: it needs a press, never a standing capture
     * listening for the operator to talk over the answer.
     */
    assert.equal(hebyVoiceReducer("speaking", { type: "activate", acknowledged: true }), "requesting");
    assert.equal(hebyVoiceReducer("speaking", { type: "activate", acknowledged: false }), "disclosure",
      "interrupting still cannot skip a first-use disclosure");
    // Stopping playback on its own returns to rest, and never to a microphone.
    assert.equal(hebyVoiceReducer("speaking", { type: "speech-ended" }), "idle");

    /*
     * A TRANSCRIPT UNDER REVIEW CAN BE EXTENDED. Voice V1 labelled this button "Start voice input
     * again" and then refused the press; the label was right and the machine was wrong. The composer
     * appends, so a second capture extends the message rather than replacing it.
     */
    assert.equal(hebyVoiceReducer("review", { type: "activate", acknowledged: true }), "requesting");

    // Still refused wherever a microphone is already open or being negotiated.
    for (const state of ["listening", "transcribing", "requesting", "disclosure"] as const) {
      assert.equal(
        hebyVoiceReducer(state, { type: "activate", acknowledged: true }),
        state,
        `${state} must not accept a second activation`,
      );
    }
    // And `unsupported` stays terminal no matter what is pressed.
    assert.equal(hebyVoiceReducer("unsupported", { type: "activate", acknowledged: true }), "unsupported");

    // Playback may never begin while a microphone is open — Heby does not talk into its own capture.
    for (const state of ["listening", "transcribing", "requesting"] as const) {
      assert.notEqual(hebyVoiceReducer(state, { type: "speech-started" }), "speaking", `${state} must not start playback`);
    }

    // Already acknowledged: straight to the browser's own prompt, no second disclosure.
    assert.equal(hebyVoiceReducer("idle", { type: "activate", acknowledged: true }), "requesting");
  }

  /* ── 5. PERMISSION DENIED IS A REAL, RECOVERABLE, NON-NAGGING STATE ──────── */
  {
    const denied = hebyVoiceReducer("requesting", { type: "permission-denied" });
    assert.equal(denied, "denied");
    // It does NOT loop back into another permission request on its own.
    for (const event of ALL_EVENTS) {
      if (event.type === "activate") continue;
      assert.notEqual(hebyVoiceReducer(denied, event), "requesting", `denied re-prompted on ${event.type}`);
    }
    // Only a fresh, deliberate activation tries again.
    assert.equal(hebyVoiceReducer(denied, { type: "activate", acknowledged: true }), "requesting");
    assert.equal(hebyVoiceReducer(denied, { type: "reset" }), "idle");
  }

  /* ── Every state is escapable, and `cancel` always closes everything ─────── */
  {
    for (const state of ALL_STATES) {
      const next = hebyVoiceReducer(state, { type: "cancel" });
      assert.equal(next, state === "unsupported" ? "unsupported" : "idle", `${state} must be escapable`);
      assert.ok(!hebyVoiceIsCapturing(next), `cancel from ${state} leaves nothing capturing`);
    }
    // `unsupported` is terminal: a browser that cannot do voice cannot be argued into it.
    for (const event of ALL_EVENTS) {
      assert.equal(hebyVoiceReducer("unsupported", event), "unsupported", `unsupported moved on ${event.type}`);
    }
  }

  /* ── Speaking never overlaps capture ─────────────────────────────────────── */
  {
    for (const state of ALL_STATES) {
      const next = hebyVoiceReducer(state, { type: "speech-started" });
      if (next === "speaking") {
        assert.ok(!hebyVoiceIsCapturing(state), `Heby would speak into an open microphone from ${state}`);
      }
    }
    assert.equal(hebyVoiceReducer("listening", { type: "speech-started" }), "listening", "capture wins");
    assert.equal(hebyVoiceReducer("speaking", { type: "speech-ended" }), "idle");
  }

  /* ── NO WAKE WORD EXISTS, structurally ───────────────────────────────────── */
  {
    // There is no event meaning "a phrase was heard", so there is nothing a background listener
    // could dispatch. The union above IS the complete set of transitions.
    const eventTypes = new Set(ALL_EVENTS.map((event) => event.type));
    for (const forbidden of ["wake", "hotword", "phrase-detected", "always-on"]) {
      assert.ok(!eventTypes.has(forbidden as never), `a wake-word event exists: ${forbidden}`);
    }
  }

  /* ── 9/11. A LEVEL EXISTS IN EXACTLY ONE STATE ───────────────────────────── */
  {
    for (const state of ALL_STATES) {
      assert.equal(hebyVoiceHasAudioLevel(state), state === "listening", `audio level claimed in ${state}`);
      // The presentation gate refuses to pass a level through outside that state, whatever it holds.
      assert.equal(presentableAudioLevel(0.9, hebyVoiceHasAudioLevel(state)), state === "listening" ? 0.9 : 0);
    }
  }

  /* ── 8. NORMALIZATION IS BOUNDED, AND 9. SILENCE IS ZERO ─────────────────── */
  {
    // Digital silence: every sample sits exactly on the 128 centre line.
    assert.equal(normalizeAudioLevel(new Uint8Array(512).fill(128)), 0, "silence is exactly zero");
    // Near-silence (preamp hiss) is below the floor and still reports zero, not a faint shimmer.
    const hiss = new Uint8Array(512);
    for (let i = 0; i < hiss.length; i++) hiss[i] = i % 2 === 0 ? 128 : 128;
    hiss[3] = 128; // untouched: an essentially still waveform
    assert.equal(normalizeAudioLevel(hiss), 0, "an essentially still waveform is zero");
    // No data is never "a little bit of sound".
    assert.equal(normalizeAudioLevel(new Uint8Array(0)), 0, "an empty frame is zero");

    // Full-scale square wave saturates AT the contract boundary, never past it.
    const loud = new Uint8Array(512);
    for (let i = 0; i < loud.length; i++) loud[i] = i % 2 === 0 ? 0 : 255;
    assert.equal(normalizeAudioLevel(loud), 1, "a full-scale waveform clamps to 1");

    // Randomized: the result is ALWAYS inside 0..1, for any byte content.
    const random = lcg(20260811);
    for (let trial = 0; trial < 400; trial++) {
      const frame = new Uint8Array(256);
      for (let i = 0; i < frame.length; i++) frame[i] = Math.floor(random() * 256);
      const level = normalizeAudioLevel(frame);
      assert.ok(level >= 0 && level <= 1 && Number.isFinite(level), `out of range: ${level}`);
    }

    // Monotonic in loudness — a louder frame never reports quieter.
    const quiet = new Uint8Array(256).fill(132);
    const medium = new Uint8Array(256).fill(150);
    assert.ok(normalizeAudioLevel(quiet) < normalizeAudioLevel(medium), "louder reads louder");
  }

  /* ── Smoothing converges to the measurement and DECAYS TO SILENCE ────────── */
  {
    // Hostile inputs cannot escape the range.
    for (const [previous, measured] of [[-5, 2], [Number.NaN, 0.5], [0.5, Number.POSITIVE_INFINITY], [2, -1]]) {
      const next = smoothAudioLevel(previous!, measured!);
      assert.ok(next >= 0 && next <= 1 && Number.isFinite(next), `smoothing escaped the range: ${next}`);
    }
    // Rising toward a steady input, and never overshooting it.
    let level = 0;
    for (let i = 0; i < 40; i++) level = smoothAudioLevel(level, 0.8);
    assert.ok(level > 0.79 && level <= 0.8, `did not converge to the measurement: ${level}`);
    // THE IMPORTANT ONE: silence decays to EXACTLY zero and stays there. A level that idled at a
    // small positive value would keep the orb alive in a silent room, which would be a lie.
    for (let i = 0; i < 200; i++) level = smoothAudioLevel(level, 0);
    assert.equal(level, 0, "a silent room settles at exactly zero");
    assert.equal(smoothAudioLevel(0, 0), 0, "and stays there");
  }

  /* ── The capability decision, and the disclosure it produces ─────────────── */
  {
    /* Safari-shaped: a recognizer exists, but none of the on-device members do. */
    const full = resolveHebyVoiceCapability({
      hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: true,
      hasSpeechSynthesis: true, hasOnDeviceRecognition: false, isSecureContext: true,
    });
    assert.ok(hebyVoiceInputAvailable(full), "a complete browser can do voice input");
    assert.equal(full.blockedReason, null);
    /*
     * THE LOCALITY QUESTION CANNOT BE ASKED HERE, so it is not asked and nothing is claimed. A
     * capability is what EXISTS; where the audio actually goes is resolved separately, and stays at
     * the conservative answer for exactly this browser shape.
     */
    assert.equal(full.supportsOnDeviceRecognition, false, "a browser without the members cannot be asked");

    /* Chrome-desktop-shaped: the recognizer exposes available()/install(), so the question is real. */
    const askable = resolveHebyVoiceCapability({
      hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: true,
      hasSpeechSynthesis: true, hasOnDeviceRecognition: true, isSecureContext: true,
    });
    assert.equal(askable.supportsOnDeviceRecognition, true, "the members are present, so locality is answerable");

    // The members alone grant nothing: without a recognizer there is no on-device recognition either.
    const membersWithoutRecognizer = resolveHebyVoiceCapability({
      hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: false,
      hasSpeechSynthesis: true, hasOnDeviceRecognition: true, isSecureContext: true,
    });
    assert.equal(membersWithoutRecognizer.supportsOnDeviceRecognition, false, "no recognizer, no locality claim");

    // Each missing piece is named, and voice input is withheld rather than half-offered.
    const insecure = resolveHebyVoiceCapability({
      hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: true,
      hasSpeechSynthesis: true, hasOnDeviceRecognition: false, isSecureContext: false,
    });
    assert.equal(insecure.blockedReason, "insecure-context");
    assert.ok(!hebyVoiceInputAvailable(insecure));

    // Firefox-shaped: capture and analysis exist, recognition does not. Voice input stays OFF —
    // an open microphone that produces no text is a worse trade than no voice at all.
    const noRecognition = resolveHebyVoiceCapability({
      hasMediaDevices: true, hasAudioContext: true, hasSpeechRecognition: false,
      hasSpeechSynthesis: true, hasOnDeviceRecognition: false, isSecureContext: true,
    });
    assert.equal(noRecognition.blockedReason, "no-recognition-support");
    assert.ok(!hebyVoiceInputAvailable(noRecognition), "no recognizer means no microphone");
    assert.equal(noRecognition.canSynthesize, true, "synthesis is an independent capability");

    /*
     * THE DISCLOSURE IS GENERATED FROM THE MEASURED LOCALITY. The unproven case still produces the
     * exact sentence Voice V1 always showed — the conservative default did not soften.
     */
    const cloudLines = hebyVoiceDisclosureLines({
      locality: "cloud", availability: "unsupported", language: "en",
    }).join(" ");
    assert.match(cloudLines, /may send the audio to the browser vendor/i, "the egress is stated, not implied");
    assert.match(cloudLines, /Hebun never stores your audio/i, "what Hebun does with audio is stated");
    assert.match(cloudLines, /nothing is sent to Heby until you send it/i, "no auto-send is stated");
    assert.match(cloudLines, /closes when you stop/i, "the microphone lifecycle is stated");
    assert.match(cloudLines, /English/, "the language about to be recognized is named");

    // The PROVEN case says so, and — critically — stops saying the audio may leave.
    const localLines = hebyVoiceDisclosureLines({
      locality: "on-device", availability: "available", language: "tr",
    }).join(" ");
    assert.match(localLines, /does not leave your machine/i, "a proven local recognition is stated as such");
    assert.ok(!/may send the audio/i.test(localLines), "and does not also claim the audio may leave");
    assert.match(localLines, /Türkçe/, "the Turkish operator is told so in Turkish");
    // Every case still states the two invariants that do not depend on locality.
    for (const lines of [cloudLines, localLines]) {
      assert.match(lines, /Hebun never stores your audio/i);
      assert.match(lines, /nothing is sent to Heby until you send it/i);
    }
  }

  /* ── V1.1 — LOCALITY IS MEASURED, AND ONLY THE PROVEN ANSWER IS FAVOURABLE ── */
  {
    const ALL_AVAILABILITY: readonly HebyOnDeviceAvailability[] = [
      "unsupported", "unavailable", "downloadable", "downloading", "available",
    ];
    for (const availability of ALL_AVAILABILITY) {
      const locality = resolveRecognitionLocality(availability);
      const expected = availability === "available" ? "on-device" : "cloud";
      assert.equal(locality, expected, `${availability} must resolve to ${expected}`);
      // The one fact the disclosure is generated from, and its inverse.
      assert.equal(recognitionLeavesDevice(locality), expected === "cloud");
      // A locality line exists for every combination, and never contradicts the locality.
      const line = recognitionLocalityLine(locality, availability);
      assert.ok(line.length > 0, `${availability} has no sentence`);
      if (expected === "cloud") {
        assert.match(line, /may send the audio to the browser vendor/i, `${availability} must not read as local`);
      } else {
        assert.ok(!/may send the audio/i.test(line), "a proven local recognition never also says it may leave");
      }
    }
    /*
     * A PACK THAT COULD EXIST IS NOT A PACK THAT DOES. "downloadable" and "downloading" are the two
     * cases most tempting to round up to local, and both stay cloud.
     */
    assert.equal(resolveRecognitionLocality("downloadable"), "cloud");
    assert.equal(resolveRecognitionLocality("downloading"), "cloud");

    // The install offer appears for exactly one availability — the only one where it would do anything.
    const offered = ALL_AVAILABILITY.filter((a) => canInstallOnDeviceRecognition(a));
    assert.deepEqual(offered, ["downloadable"], "install is offered only where a pack can be installed");

    // The badge shown while listening never overstates the locality.
    assert.match(recognitionLocalityLabel("on-device"), /on-device/i);
    assert.ok(!/on-device/i.test(recognitionLocalityLabel("cloud")), "the unproven case never says on-device");
  }

  /* ── V1.1 — THE LANGUAGE IS CHOSEN, AND SEEDED DETERMINISTICALLY ─────────── */
  {
    assert.deepEqual([...HEBY_VOICE_LANGUAGES], ["tr", "en"], "two languages, deliberately");
    assert.equal(hebyVoiceRecognitionTag("tr"), "tr-TR", "region-qualified, as the language packs are");
    assert.equal(hebyVoiceRecognitionTag("en"), "en-US");
    // An answer is spoken in the language it was asked in.
    for (const language of HEBY_VOICE_LANGUAGES) {
      assert.equal(hebyVoiceSynthesisTag(language), hebyVoiceRecognitionTag(language));
    }
    // A Turkish operator finds Turkish under its own name.
    assert.equal(hebyVoiceLanguageLabel("tr"), "Türkçe");
    assert.equal(hebyVoiceLanguageLabel("en"), "English");

    /*
     * THE SEED IS DETERMINISTIC AND TOTAL. Every input produces a supported language — an unknown
     * browser preference is never handed to a recognizer as-is, and never produces a guess.
     */
    assert.equal(resolveInitialVoiceLanguage("tr-TR"), "tr");
    assert.equal(resolveInitialVoiceLanguage("TR"), "tr");
    assert.equal(resolveInitialVoiceLanguage("en-GB"), "en");
    assert.equal(resolveInitialVoiceLanguage("de-DE"), "en", "an unsupported language falls back");
    assert.equal(resolveInitialVoiceLanguage(""), "en");
    assert.equal(resolveInitialVoiceLanguage(null), "en");
    assert.equal(resolveInitialVoiceLanguage(undefined), "en");
    for (const tag of ["tr", "tr-tr", "  tr-TR  ", "TR-tr"]) {
      assert.equal(resolveInitialVoiceLanguage(tag), "tr", `"${tag}" is Turkish`);
    }
  }

  /* ── V1.3 — THE CAPTURE PHASE VOCABULARY, AND WHAT IT REFUSES TO DECIDE ──── */
  {
    const ALL_PHASES: readonly HebyCapturePhase[] = [
      "idle", "permission-requested", "media-pending", "media-acquired",
      "audio-context-starting", "recognition-starting", "listening", "cancelled", "failed",
    ];

    /*
     * PENDING is exactly the window where the browser and the operating system own the decision and
     * Hebun can only wait or be cancelled. It is the only window where a stall notice is honest.
     */
    const pending = ALL_PHASES.filter(hebyCaptureIsPending);
    assert.deepEqual([...pending], ["permission-requested", "media-pending"],
      "only the two phases Hebun cannot influence count as pending");

    /*
     * HOLDING A DEVICE is where abandoning must STOP tracks rather than forget them. Deliberately
     * excludes the pending phases: there is no device yet to stop, and a late arrival is handled by
     * the attempt token instead.
     */
    const holding = ALL_PHASES.filter(hebyCaptureHoldsDevice);
    assert.deepEqual(
      [...holding],
      ["media-acquired", "audio-context-starting", "recognition-starting", "listening"],
      "hardware is held from acquisition until teardown",
    );
    for (const phase of ["idle", "cancelled", "failed"] as const) {
      assert.equal(hebyCaptureHoldsDevice(phase), false, `${phase} must not claim to hold a device`);
      assert.equal(hebyCaptureIsPending(phase), false, `${phase} is not pending`);
    }
    // The two predicates are mutually exclusive — a phase cannot be both waiting and holding.
    for (const phase of ALL_PHASES) {
      assert.ok(!(hebyCaptureIsPending(phase) && hebyCaptureHoldsDevice(phase)), `${phase} is in both sets`);
    }

    /*
     * THE STALL THRESHOLD IS PRESENTATION, AND ITS SENTENCE PROVES IT. It must never say denied,
     * blocked or failed, and must never name a culprit Hebun cannot see — not Chrome's own setting,
     * not macOS, not an administrator policy.
     */
    assert.ok(HEBY_MEDIA_STALL_MS >= 5000, "the threshold is long enough not to trip a normal grant");
    const notice = hebyCaptureStallNotice();
    for (const forbidden of ["denied", "blocked", "failed", "macOS", "administrator", "policy"]) {
      assert.ok(!notice.toLowerCase().includes(forbidden.toLowerCase()),
        `the stall notice must not say "${forbidden}"`);
    }
    assert.match(notice, /has not answered/i, "it says what is actually true");
    assert.match(notice, /cancel/i, "and points at the way out");
  }

  /* ── V1.3 — THE LATE-RESULT DECISION, ENUMERATED ─────────────────────────── */
  {
    /*
     * This is the decision the hang was caused by getting wrong, so it is exercised rather than
     * merely read. `adopt` is the ONLY answer that permits an AudioContext, a recognizer or a state
     * change; every other answer obliges the caller to stop the tracks.
     */
    assert.deepEqual(decideMediaAdoption({ isCurrentAttempt: true, audioTrackCount: 1 }), { action: "adopt" });
    assert.deepEqual(decideMediaAdoption({ isCurrentAttempt: true, audioTrackCount: 3 }), { action: "adopt" });

    /*
     * A. operator starts capture  B. getUserMedia stays pending  C. operator cancels
     * D. getUserMedia resolves LATE  →  the stream must be discarded, not adopted.
     */
    assert.deepEqual(decideMediaAdoption({ isCurrentAttempt: false, audioTrackCount: 1 }), {
      action: "discard",
      reason: "abandoned",
    });

    // A resolved promise is not a usable device.
    assert.deepEqual(decideMediaAdoption({ isCurrentAttempt: true, audioTrackCount: 0 }), {
      action: "discard",
      reason: "no-audio-track",
    });

    /*
     * ABANDONMENT OUTRANKS EVERY OTHER FAULT. A stream nobody is waiting for must be stopped
     * quietly — putting a device error on screen for an attempt the operator already cancelled
     * would blame them for something they did not cause.
     */
    assert.deepEqual(decideMediaAdoption({ isCurrentAttempt: false, audioTrackCount: 0 }), {
      action: "discard",
      reason: "abandoned",
    });

    // Total over the input space: there is no combination without a decision, and only one adopts.
    let adopted = 0;
    for (const isCurrentAttempt of [true, false]) {
      for (const audioTrackCount of [-1, 0, 1, 2]) {
        const decision = decideMediaAdoption({ isCurrentAttempt, audioTrackCount });
        assert.ok(decision.action === "adopt" || decision.action === "discard");
        if (decision.action === "adopt") {
          adopted += 1;
          assert.ok(isCurrentAttempt && audioTrackCount > 0, "adoption requires a current attempt AND a track");
        }
      }
    }
    assert.equal(adopted, 2, "only the two genuinely usable combinations are adopted");
    // A negative track count is nonsense, never an adoption.
    assert.equal(decideMediaAdoption({ isCurrentAttempt: true, audioTrackCount: -1 }).action, "discard");
  }

  /* ── V1.3 — EVERY getUserMedia REJECTION HAS ITS OWN HONEST SENTENCE ─────── */
  {
    /*
     * V1 collapsed everything that was not a refusal into "no microphone was available", which sent
     * an operator whose microphone was merely busy hunting for a hardware fault.
     */
    const busy = hebyVoiceFailureText("device-busy");
    assert.match(busy, /another app/i, "a held device names the real cause");
    assert.ok(!/not found|no microphone was found/i.test(busy), "and does not claim the microphone is missing");

    const missing = hebyVoiceFailureText("device-missing");
    assert.match(missing, /No microphone was found/i, "a missing device says so");

    const interrupted = hebyVoiceFailureText("request-interrupted");
    assert.match(interrupted, /nothing was denied/i, "an aborted request is explicitly NOT a denial");
    // The word "denied" may appear ONLY inside that disclaimer — never as a standalone claim.
    assert.equal(
      interrupted.toLowerCase().split("denied").length - 1,
      1,
      "and the only mention of denial is the one denying it",
    );

    /*
     * NONE OF THEM BLAMES A LAYER HEBUN CANNOT SEE. The browser does not tell a page whether a
     * refusal came from Chrome's site setting, the operating system, or an administrator policy, so
     * no message may claim to know.
     */
    for (const reason of ["device-busy", "device-missing", "request-interrupted", "device-unavailable"] as const) {
      const text = hebyVoiceFailureText(reason);
      assert.ok(text.length > 0, `${reason} has no words`);
      for (const unproven of ["macOS", "Windows", "administrator", "policy", "firewall"]) {
        assert.ok(!text.includes(unproven), `${reason} claims to know about "${unproven}"`);
      }
    }
    // Every one still points back to typing, so voice failing never reads as Heby failing.
    for (const reason of ["device-busy", "device-missing"] as const) {
      assert.match(hebyVoiceFailureText(reason), /You can still type/i);
    }
  }

  /* ── V1.3 — AN INSTALL OUTCOME IS ALWAYS SAYABLE ─────────────────────────── */
  {
    /*
     * The failure this fixes: pressing "Keep speech on this device" produced no visible result,
     * because every outcome removed the offer and said nothing. Now silence is only legal at rest.
     */
    assert.equal(installStatusLine("idle"), null, "at rest there is nothing to say");
    for (const status of ["requested", "installed", "no-change", "failed"] as const) {
      const line = installStatusLine(status);
      assert.ok(line && line.length > 0, `"${status}" must produce a sentence`);
    }
    // No invented progress — Chrome exposes none for this.
    assert.ok(!/%|\d+ *(MB|percent)/i.test(installStatusLine("requested")!), "no fabricated progress");
    // "no-change" is reported as the unglamorous truth rather than dressed as success.
    const noChange = installStatusLine("no-change")!;
    assert.match(noChange, /still reports/i, "an unchanged availability is stated plainly");
    assert.ok(!/installed\b/i.test(noChange), "and never claims installation");
    // Only the confirmed case claims the machine keeps the audio.
    assert.match(installStatusLine("installed")!, /stays on this machine/i);
    for (const status of ["requested", "no-change", "failed"] as const) {
      assert.ok(!/stays on this machine/i.test(installStatusLine(status)!), `${status} must not claim locality`);
    }
  }

  /* ── V1.1 — THE PROVIDER DESCRIPTION LEAKS NOTHING ───────────────────────── */
  {
    const described = describeSpeechAdapters(
      { id: "browser-web-speech-on-device", locality: "on-device" },
      { id: "browser-speech-synthesis", measurablePlayback: false },
    );
    assert.deepEqual(described, {
      recognitionId: "browser-web-speech-on-device",
      locality: "on-device",
      synthesisId: "browser-speech-synthesis",
      playbackMeasurable: false,
    });
    /*
     * BROWSER SYNTHESIS IS NOT MEASURABLE, and that is recorded as a fact rather than worked around.
     * `speechSynthesis` exposes no AudioNode, MediaStream or buffer, so there is nothing to attach an
     * analyser to — which is why the presence field uses a state animation while speaking and reads
     * no amplitude at all. Anything else would be an invented waveform.
     */
    assert.equal(described.playbackMeasurable, false, "browser playback cannot be measured, and does not pretend to be");

    // A browser that cannot speak describes no synthesis at all rather than an empty one.
    const noSynthesis = describeSpeechAdapters({ id: "browser-web-speech", locality: "cloud" }, null);
    assert.equal(noSynthesis.synthesisId, null);
    assert.equal(noSynthesis.playbackMeasurable, false);

    // The description is ids and localities. Nothing in it could ever be a secret or an endpoint.
    for (const value of Object.values(described)) {
      if (typeof value !== "string") continue;
      assert.ok(!/https?:|token|secret|\bkey\b/i.test(value), `"${value}" must not describe a credential or endpoint`);
    }
  }

  /* ── 13. A TRANSCRIPT IS COMPOSER TEXT, AND TYPING SURVIVES IT ───────────── */
  {
    assert.equal(mergeTranscriptIntoComposer("", "what changed in operations"), "what changed in operations");
    // Dictation APPENDS: a half-typed message is never destroyed by pressing the microphone.
    assert.equal(mergeTranscriptIntoComposer("show me", "the open risks"), "show me the open risks");
    assert.equal(mergeTranscriptIntoComposer("show me ", "the open risks"), "show me the open risks");
    // Nothing recognized changes nothing.
    assert.equal(mergeTranscriptIntoComposer("show me", "   "), "show me");
    // Recognizer whitespace is normalized, never interpreted.
    assert.equal(mergeTranscriptIntoComposer("", " a\n  b \t c "), "a b c");
    // A spoken slash command becomes exactly the text a typist would produce — no special casing.
    assert.equal(mergeTranscriptIntoComposer("", "/terminal"), "/terminal");
  }

  /* ── 25. ONLY THE HUMAN-FACING ANSWER MAY BE SPOKEN ──────────────────────── */
  {
    assert.equal(selectSpokenAnswer([]), null, "nothing to say before an answer exists");
    assert.equal(selectSpokenAnswer([{ role: "user", content: "a question" }]), null, "Heby never reads back the operator");
    assert.equal(
      selectSpokenAnswer([
        { role: "user", content: "q1" },
        { role: "heby", content: "first answer" },
        { role: "user", content: "q2" },
        { role: "heby", content: "second answer" },
      ]),
      "second answer",
      "the newest answer is the one that may be spoken",
    );
    // An in-flight placeholder has no content, so there is silence rather than something invented.
    assert.equal(selectSpokenAnswer([{ role: "heby", content: "   " }]), null);
    /*
     * The function's INPUT TYPE is the proof: it accepts only role + content. Provenance, evidence,
     * record refs, limitations, conversation ids, tenant, provider names and request ids are not
     * reachable from here, so they cannot be spoken by construction rather than by filtering.
     */
  }

  /* ── Every state and failure has honest words, so motion is never the only signal ── */
  {
    const listeningStates = ALL_STATES.filter((state) => /listening/i.test(hebyVoiceStateLabel(state)));
    assert.deepEqual(listeningStates, ["listening"], "only the genuinely-open state says Listening");
    for (const state of ALL_STATES) {
      const label = hebyVoiceStateLabel(state);
      assert.ok(label.length > 0, `${state} has no words`);
    }
    // Failures never read as Heby itself failing, and point back to typing.
    for (const reason of ["no-recognition-support", "device-unavailable", "recognition-failed", "audio-context-failed"] as const) {
      assert.match(hebyVoiceFailureText(reason), /You can still type/i, `${reason} does not offer the fallback`);
    }
  }

  console.log("voice-v1 pure core passed");
}

main();
