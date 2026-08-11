/*
 * VOICE V1 — the structural proofs over the SHIPPED source.
 *
 * The pure core proves the state machine cannot open a microphone without an operator. These prove
 * the RUNTIME actually obeys that machine, that there is exactly one microphone owner in the whole
 * product, that no audio is ever kept or sent anywhere, and that voice has acquired no conversation
 * authority, no provider path, no tenant, no credential and no execution reach on the way in.
 *
 * Source-level, because these are claims about what the product IS, not about what one render does.
 * No browser, no network, no database.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const RUNTIME = "src/components/layout/heby/heby-voice-runtime.tsx";
const CONTROL = "src/components/layout/heby/heby-voice-control.tsx";
const BINDING = "src/components/layout/heby/use-heby-voice-surface.ts";
const PRESENCE = "src/components/layout/heby/heby-presence.ts";
const SHELL = "src/components/layout/hebun-shell.tsx";
const HOOK = "src/components/layout/heby/use-heby-conversation.ts";
const COMPOSER = "src/components/layout/heby/heby-composer.tsx";
const WORKSPACE_CLIENT = "src/components/layout/heby/heby-workspace-client.tsx";
const PANEL_CLIENT = "src/components/layout/heby/heby-quick-panel-client.tsx";
const VISUALIZER = "src/components/layout/heby/heby-visualizer.tsx";
const FEATURE_DIR = "src/features/heby-voice";

/** Every Voice V1 file. If voice grows a second runtime, it grows it inside this set. */
const VOICE_FILES = [
  RUNTIME, CONTROL, BINDING, PRESENCE,
  ...readdirSync(FEATURE_DIR).map((name) => `${FEATURE_DIR}/${name}`),
];

/** Code with comments removed — a proof that fails on its own explanation is a bad proof. */
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const importsOf = (src: string) => [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

function main(): void {
  /* ── 1/2/3/4. `getUserMedia` EXISTS ONCE, AND ONLY A STATE TRANSITION REACHES IT ── */
  {
    const runtime = read(RUNTIME);
    const code = codeOf(runtime);

    const calls = [...code.matchAll(/getUserMedia\s*\(/g)].length;
    assert.equal(calls, 1, `getUserMedia is called ${calls} times; it must be exactly once`);

    // It lives inside `beginCapture`, and `beginCapture` is the only thing that can start capture.
    const beginIndex = code.indexOf("const beginCapture = useCallback(");
    const getUserMediaIndex = code.indexOf("getUserMedia({ audio: true })");
    assert.ok(beginIndex > -1 && getUserMediaIndex > beginIndex, "the only capture call is inside beginCapture");

    /*
     * EVERY invocation of it is gated on the PURE REDUCER returning `requesting`. The handlers run
     * the same state machine the component does and act only on its verdict, so there is no call
     * site anywhere that opens a microphone on its own judgement.
     */
    const invocations = [...code.matchAll(/void beginCapture\(/g)];
    const guarded = [
      ...code.matchAll(
        /const next = hebyVoiceReducer\([\s\S]{0,260}?if \(next === "requesting"\) void beginCapture\(\(captureAttemptRef\.current \+= 1\)\);/g,
      ),
    ];
    assert.ok(invocations.length >= 1, "capture is reachable at all");
    assert.equal(guarded.length, invocations.length,
      `${invocations.length} capture call(s) but only ${guarded.length} guarded by the state machine`);

    // Both guarded call sites are operator handlers — an activation and a disclosure acknowledgement.
    assert.ok(code.includes("const onActivate = useCallback(") && code.includes("const onAcknowledge = useCallback("),
      "the guarded call sites are the operator's own controls");

    // Nothing runs capture on mount, on a route change, or on a surface opening. Capability
    // detection READS the property to see whether it exists; the single call site proven above is
    // the only place it is ever invoked.
    assert.match(code, /!!navigator\.mediaDevices\?\.getUserMedia,/, "detection only tests for existence");
    for (const trigger of ["pathname", "usePathname", "useRouter", "setInterval"]) {
      assert.ok(!code.includes(trigger), `the voice runtime must not react to "${trigger}"`);
    }
    /*
     * V1.3 — THE TIMER BAN, NARROWED TO WHAT IT PROTECTS. `setTimeout` was banned outright so that
     * nothing could open a microphone on a schedule. V1.3 needs exactly one — to change the WORDS
     * under a request the browser has not answered. So the ban now permits one timer and pins what
     * it is allowed to do: set a presentation flag, and nothing else.
     */
    const timers = [...code.matchAll(/setTimeout\(/g)];
    assert.equal(timers.length, 1, `the runtime has ${timers.length} timers; exactly one is allowed`);
    assert.match(code, /const timer = setTimeout\(\(\) => setMediaStalled\(true\), HEBY_MEDIA_STALL_MS\);/,
      "the one timer only marks a pending request as stalled");
    assert.match(code, /return \(\) => clearTimeout\(timer\);/, "and it is always cleared");
    // It can never deny, cancel, retry or open anything.
    const stallStart = code.indexOf("if (capturePhase !== \"media-pending\") return;");
    const stall = code.slice(stallStart, stallStart + 260);
    for (const forbidden of ["beginCapture", "getUserMedia", "permission-denied", "onCancel", "teardown", "dispatch"]) {
      assert.ok(!stall.includes(forbidden), `the stall timer must not "${forbidden}"`);
    }

    // The mount effect FEATURE-DETECTS ONLY. Detection reads whether APIs exist; it constructs
    // nothing, so it cannot trigger a permission prompt.
    const detectStart = code.indexOf("resolveHebyVoiceCapability({");
    assert.ok(detectStart > -1, "detection exists");
    // Bounded to the detection call itself — the closing `});` of that one object literal — so the
    // proof is about detection rather than about whatever happens to follow it in the file.
    const detectEnd = code.indexOf("});", detectStart);
    assert.ok(detectEnd > detectStart, "and it is a single bounded call");
    const detection = code.slice(detectStart, detectEnd);
    assert.ok(!detection.includes("getUserMedia()"), "detection does not call getUserMedia");
    assert.ok(!/new AudioCtor|new RecognizerCtor|new Ctor\(|\.start\(\)/.test(detection), "detection constructs nothing");
    /*
     * V1.1 — the two on-device members are DETECTED, not invoked. `available()` would be a question
     * about installed language packs and `install()` would start a download; detection only asks
     * whether the functions exist.
     */
    assert.match(detection, /typeof Recognizer\?\.available === "function" && typeof Recognizer\.install === "function"/,
      "the on-device members are tested for existence");
    assert.ok(!/available\(\{|install\(\{/.test(detection), "and neither is called during detection");
  }

  /* ── 15. NO WAKE WORD, NO BACKGROUND LISTENING, ANYWHERE IN VOICE ────────── */
  {
    for (const file of VOICE_FILES) {
      const code = codeOf(read(file));
      for (const forbidden of ["hey heby", "wakeword", "wake_word", "hotword", "alwaysOn", "always-on", "MediaRecorder"]) {
        assert.ok(!code.toLowerCase().includes(forbidden.toLowerCase()), `${file} contains "${forbidden}"`);
      }
    }
    // `continuous` recognition is scoped to ONE capture the operator started, not a standing
    // listener: it is set immediately before `start()` and torn down by the same teardown.
    const code = codeOf(read(RUNTIME));
    assert.ok(code.includes("recognizer.continuous = true"), "one capture may span natural pauses");
    assert.ok(code.includes("recognizer.abort()") && code.includes("recognizer.stop()"), "and it is always ended");
  }

  /* ── 6/7/22. DETERMINISTIC TEARDOWN, AND EXACTLY ONE MICROPHONE OWNER ────── */
  {
    const code = codeOf(read(RUNTIME));

    // Every track is stopped wherever a stream is released — there is no path that drops the
    // reference without stopping the device.
    const releases = [...code.matchAll(/streamRef\.current = null/g)].length;
    const stops = [...code.matchAll(/for \(const track of stream\.getTracks\(\)\) track\.stop\(\)/g)].length;
    assert.ok(stops >= releases, `a stream is released ${releases}× but tracks stopped only ${stops}×`);

    assert.ok(code.includes("context.close()"), "the AudioContext is closed, not merely dropped");
    assert.ok(code.includes("cancelAnimationFrame"), "the measurement loop is cancelled");

    // Unmount tears everything down: the microphone must never outlive the tree that opened it.
    assert.match(code, /return \(\) => \{\s*teardown\(true\);/, "unmount tears down capture");
    assert.ok(code.includes("window.speechSynthesis.cancel()"), "unmount also stops playback");

    // ONE OWNER. The provider refuses to mount twice, so a surface switch cannot produce a second
    // capture even transiently.
    assert.ok(code.includes("mountedRuntimes += 1"), "the runtime counts its own instances");
    assert.match(code, /if \(mountedRuntimes > 1\)/, "a second instance is detected");
    assert.match(code, /throw new Error\("HebyVoiceProvider must be mounted exactly once/, "and refused");

    // Mounted in exactly one place, above both surfaces.
    const shell = read(SHELL);
    assert.equal([...shell.matchAll(/<HebyVoiceProvider>/g)].length, 1, "the provider is mounted once");
    for (const file of [WORKSPACE_CLIENT, PANEL_CLIENT]) {
      assert.ok(!read(file).includes("HebyVoiceProvider"), `${file} must not mount a voice runtime of its own`);
    }
  }

  /* ── 23. NO RAW AUDIO IS KEPT, COPIED, OR SENT ANYWHERE ──────────────────── */
  {
    for (const file of VOICE_FILES) {
      const code = codeOf(read(file));
      for (const forbidden of [
        "MediaRecorder", "ondataavailable", "new Blob", "FileReader", "URL.createObjectURL",
        "fetch(", "XMLHttpRequest", "WebSocket", "navigator.sendBeacon",
        "localStorage", "sessionStorage", "indexedDB", "document.cookie",
      ]) {
        assert.ok(!code.includes(forbidden), `${file} must not use "${forbidden}" — audio must not be kept or sent`);
      }
    }
    const code = codeOf(read(RUNTIME));
    // ONE reused sample buffer, read per frame and never retained beyond it.
    assert.equal([...code.matchAll(/new Uint8Array\(/g)].length, 1, "exactly one sample buffer exists");
    assert.ok(code.includes("getByteTimeDomainData(frame)"), "samples are read into that one buffer");
    assert.ok(!/frames?\.push|samples?\.push|buffer\.push|\.slice\(\)/.test(code), "no frame is accumulated");
    // The analyser is a SINK: never connected to the speakers, so nothing is played back.
    assert.ok(!code.includes("context.destination"), "the microphone is never routed to the speakers");
    // The transcript ref holds TEXT, and is cleared on every path that ends a capture.
    assert.ok(code.includes('transcriptRef.current = ""'), "the transcript buffer is cleared");
  }

  /* ── 17/18/19/20. VOICE HAS NO CONVERSATION, PROVIDER OR EXECUTION REACH ─── */
  {
    const forbiddenImports = [
      "heby/actions", "askHebyAction", "features/heby-runtime", "features/heby-model",
      "features/heby-model-live", "features/heby-answer", "features/heby-conversation",
      "features/heby-provider-ops", "features/heby-actions", "features/execution",
      "features/execution-engine", "features/device-runtime", "features/provider-framework",
      "features/provider-invocation", "features/runtime-activation", "features/integrations",
      "@/db", ".server", "next/headers", "next/navigation",
    ];
    for (const file of VOICE_FILES) {
      const src = read(file);
      for (const forbidden of forbiddenImports) {
        assert.ok(
          !importsOf(src).some((specifier) => specifier.includes(forbidden)),
          `${file} must not import "${forbidden}"`,
        );
      }
      const code = codeOf(src);
      // No dispatch vocabulary at all — not a call, not a reference.
      for (const authority of [
        "askHebyAction", "runHebyReadCommandAction", "loadHebyConversationAction",
        "tenantId", "TenantContext", "apiKey", "ANTHROPIC", "sk-ant",
        "computer-use", "computerUse", "terminal", "exec(", "spawn(",
      ]) {
        assert.ok(!code.includes(authority), `${file} must not reference "${authority}"`);
      }
      /*
       * V1.2 — THE ENVIRONMENT BAN, NARROWED TO WHAT IT ACTUALLY PROTECTS. Voice V1 banned
       * `process.env` outright because voice had no legitimate use for it and a credential read
       * would be the dangerous one. V1.2 has exactly one legitimate use — gating the dev-only
       * diagnostic out of production — so the ban now enumerates every environment read and permits
       * only `NODE_ENV`. A configuration or credential read still fails here.
       */
      const environmentReads = [...code.matchAll(/process\.env\.([A-Za-z0-9_]+)/g)].map((m) => m[1]!);
      for (const name of environmentReads) {
        assert.equal(name, "NODE_ENV", `${file} reads process.env.${name} — voice may only read NODE_ENV`);
      }
      assert.ok(!/process\.env\[/.test(code), `${file} must not read the environment dynamically`);
    }
  }

  /* ── VOICE NEVER SENDS. There is no submit anywhere in the voice layer ───── */
  {
    for (const file of [RUNTIME, CONTROL, ...readdirSync(FEATURE_DIR).map((n) => `${FEATURE_DIR}/${n}`)]) {
      const code = codeOf(read(file));
      for (const forbidden of ["onSubmit", "submitInput", 'type="submit"', "requestSubmit"]) {
        assert.ok(!code.includes(forbidden), `${file} must not be able to send — found "${forbidden}"`);
      }
    }
    /*
     * The binding wraps the operator's submit; it never originates one. The transcript sink writes
     * to the composer and returns — there is no call to submit on that path.
     */
    const binding = codeOf(read(BINDING));
    const sinkStart = binding.indexOf("return register((transcript) => {");
    const sinkEnd = binding.indexOf("});", sinkStart);
    const sink = binding.slice(sinkStart, sinkEnd);
    assert.ok(sink.includes("mergeTranscriptIntoComposer"), "the transcript becomes composer text");
    assert.ok(!sink.includes("Submit") && !sink.includes("submit"), "and nothing more");
    assert.ok(binding.includes("conversationSubmit();"), "submit is only ever the operator's own, wrapped");
  }

  /* ── 30. THE CONVERSATION SEAM IS UNCHANGED, AND VOICE-UNAWARE ───────────── */
  {
    const hook = read(HOOK);
    // Its CODE, because the file's architecture notes legitimately use the word "transcript" for
    // the durable conversation — the thing that is not allowed here is voice machinery.
    const hookCode = codeOf(hook);
    for (const term of ["voice", "Voice", "audio", "Audio", "microphone", "speech", "Transcript"]) {
      assert.ok(!hookCode.includes(term), `the conversation seam learned about "${term}" — it must not`);
    }
    assert.ok(!importsOf(hook).some((i) => i.includes("heby-voice")), "the seam does not import voice");
    // Persistence, dispatch and the slash gate are untouched by Voice V1.
    assert.ok(hook.includes("askHebyAction({ prompt, route: contextRoute, conversationId: prior })"),
      "the single dispatch payload is unchanged");
    assert.ok(hook.includes("const parsed = parseHebyInput(override ?? session.composer)"),
      "the single submission gate still parses first");
    assert.ok(hook.includes("conversationKey(contextRoute)"), "the single durable pointer is unchanged");
  }

  /* ── 21. ONE VOICE AUTHORITY, SHARED BY BOTH SURFACES ────────────────────── */
  {
    for (const file of [WORKSPACE_CLIENT, PANEL_CLIENT]) {
      const src = read(file);
      assert.ok(src.includes('from "./use-heby-voice-surface"'), `${file} uses the shared voice binding`);
      assert.ok(src.includes("useHebyVoiceSurface(conversation)"), `${file} binds through the one seam`);
      assert.ok(!src.includes("useHebyVoiceRuntime"), `${file} must not reach the runtime directly`);
    }
    // Neither surface component owns voice behaviour; they receive a view model.
    for (const file of [COMPOSER, "src/components/layout/heby/heby-workspace.tsx",
      "src/components/layout/heby/heby-quick-panel.tsx"]) {
      const code = codeOf(read(file));
      assert.ok(!code.includes("useHebyVoiceRuntime"), `${file} must stay pure presentation`);
      assert.ok(!code.includes("getUserMedia"), `${file} must not touch capture`);
    }
    // There is exactly ONE composer, and therefore exactly one place a transcript can land.
    const workspace = read("src/components/layout/heby/heby-workspace.tsx");
    const panel = read("src/components/layout/heby/heby-quick-panel.tsx");
    assert.ok(workspace.includes("<HebyComposer") && panel.includes("<HebyComposer"), "one shared composer");
    assert.ok(!workspace.includes("HebyVoiceButtons") && !panel.includes("HebyVoiceButtons"),
      "neither surface builds its own voice composer");
  }

  /* ── 11. THE VISUALIZER CANNOT FABRICATE AUDIO ───────────────────────────── */
  {
    const visualizer = read(VISUALIZER);
    const code = codeOf(visualizer);
    assert.ok(!code.includes("Math.random("), "no randomness masquerading as amplitude");
    assert.ok(!/Date\.now|new Date\(|setInterval|requestAnimationFrame/.test(code), "no self-driven motion");
    // Exactly one read of the prop, and it is state-gated.
    assert.equal([...code.matchAll(/props\.audioLevel/g)].length, 1, "audioLevel is read exactly once");
    assert.match(code, /state === "listening" \? clampAudioLevel\(props\.audioLevel\) : 0/,
      "and only while genuinely listening");
    // The presence field opens nothing and measures nothing.
    for (const api of ["getUserMedia", "AudioContext", "SpeechRecognition", "speechSynthesis"]) {
      assert.ok(!code.includes(api), `the visualizer must not touch "${api}"`);
    }
  }

  /* ── The one pure arbiter decides presence; no component second-guesses it ─ */
  {
    const presence = codeOf(read(PRESENCE));
    for (const forbidden of ["react", "useState", "useEffect", "getUserMedia"]) {
      assert.ok(!presence.includes(forbidden), `the presence arbiter must stay pure — found "${forbidden}"`);
    }
    for (const file of [WORKSPACE_CLIENT, PANEL_CLIENT]) {
      assert.ok(!read(file).includes("resolveHebyPresence"), `${file} must not arbitrate presence itself`);
    }
  }

  /* ── V1.1 — THE PROVIDER SEAM IS REAL, AND IT COVERS EXACTLY TWO THINGS ─── */
  {
    const code = codeOf(read(RUNTIME));

    /*
     * RECOGNITION AND SYNTHESIS GO THROUGH THE NEUTRAL INTERFACES. This is what makes "a Director-
     * authorized provider would be one more factory in this file" a checkable claim rather than a
     * comment: the runtime already talks to the interface, not to the browser API.
     */
    assert.ok(
      code.includes("const speechToText: HebySpeechToTextAdapter = createBrowserSpeechToText("),
      "recognition is obtained through the provider-neutral interface",
    );
    assert.ok(code.includes("useMemo<HebyTextToSpeechAdapter | null>"), "synthesis is too");

    /*
     * CAPTURE AND ANALYSIS ARE NOT BEHIND AN ADAPTER, AND MUST NEVER BE. A provider that could open
     * a microphone or receive the amplitude stream would be a different product. There is no
     * interface for either, and the runtime owns both outright.
     */
    for (const forbidden of ["CaptureAdapter", "createBrowserCapture", "AudioLevelAdapter", "AnalyserAdapter"]) {
      assert.ok(!code.includes(forbidden), `capture/analysis must not gain an adapter — found "${forbidden}"`);
    }
    // The adapter is handed the capture but never the analyser, and never the measured level.
    const adapterStart = code.indexOf("function createBrowserSpeechToText(");
    const adapterEnd = code.indexOf("function createBrowserTextToSpeech(");
    assert.ok(adapterStart > -1 && adapterEnd > adapterStart, "both adapters live in the one owning file");
    const adapter = code.slice(adapterStart, adapterEnd);
    for (const forbidden of ["analyser", "Analyser", "audioLevel", "getUserMedia", "setLevel", "frameRef"]) {
      assert.ok(!adapter.includes(forbidden), `the recognition adapter must not reach "${forbidden}"`);
    }
  }

  /* ── V1.1 — LOCAL PROCESSING IS REQUIRED WHERE PROVEN, ASSUMED NOWHERE ──── */
  {
    const code = codeOf(read(RUNTIME));

    // `processLocally` is set in exactly one place, and only for a locality that was MEASURED.
    assert.equal([...code.matchAll(/processLocally = true/g)].length, 1, "local processing is required in one place");
    assert.match(
      code,
      /if \(locality === "on-device"\) recognizer\.processLocally = true;/,
      "and only when the browser already answered that this language is available locally",
    );

    /*
     * THE QUESTION IS THE ON-DEVICE ONE. `available()` without `processLocally: true` would answer
     * "yes" for a cloud recognizer, which is the exact confusion this whole mechanism exists to
     * avoid. Every call site asks the narrow question.
     */
    const asks = [...code.matchAll(/ask\(\{ langs: \[[^\]]*\], processLocally: true \}\)/g)];
    const bareAsks = [...code.matchAll(/ask\(\{ langs: \[[^\]]*\] \}\)/g)];
    assert.equal(asks.length, 2, "availability is asked on mount and re-asked after an install");
    assert.equal(bareAsks.length, 0, "the broad availability question is never asked");
    // `ask` is the only name that reaches the availability API, so those two are all of them.
    assert.equal([...code.matchAll(/\?\.available;/g)].length, 2, "the availability API is bound in two places");

    /*
     * IT FAILS CLOSED. An unanswerable question, a rejected promise, or a browser without the
     * members all land on the conservative answer — never on the flattering one.
     */
    assert.match(
      code,
      /const availability: HebyOnDeviceAvailability =\s*capability\.supportsOnDeviceRecognition && answered\?\.language === language \? answered\.value : "unsupported";/,
      "availability is DERIVED, and every missing precondition lands on the conservative value",
    );
    assert.match(code, /\.catch\(\(\) => \{[\s\S]{0,220}value: "unsupported"/,
      "a failed availability question stays conservative");
    /*
     * HEBUN NEVER WRITES THE FAVOURABLE ANSWER. The only value that earns "on-device" is one the
     * browser returned; there is no assignment of it anywhere, so it cannot be reached by a bug in a
     * branch, only by an actual answer.
     */
    /*
     * Hebun never WRITES the favourable value; it may only COMPARE against one the browser returned.
     * The lookbehind is what keeps that distinction: `=== "available"` is a question, `= "available"`
     * would be a claim.
     */
    assert.ok(!/value: "available"/.test(code) && !/(?<![=!])= "available"/.test(code),
      "availability is never asserted by Hebun — only relayed from the browser");
    // The stale-answer case is closed by construction: an answer carries the language it is about.
    assert.match(code, /setAnswered\(\{ language, value: answer \}\)/, "an answer is tagged with its language");
    assert.equal([...code.matchAll(/setAnswered\(/g)].length, 5, "every write of the answer is accounted for");

    // Asking opens nothing. `available()` and `install()` construct no recognizer and no capture.
    const askEffectStart = code.indexOf("const ask = recognizerConstructor()?.available;");
    const askEffect = code.slice(askEffectStart, askEffectStart + 700);
    for (const forbidden of ["getUserMedia", "new AudioCtor", "recognizer.start()", "new Ctor()"]) {
      assert.ok(!askEffect.includes(forbidden), `asking about locality must not "${forbidden}"`);
    }
    // Installing is the operator's press, and its result is not trusted — availability is re-asked.
    assert.match(code, /void install\(\{ langs: \[tag\] \}\)[\s\S]{0,120}\.then\(\(\) => ask\(/,
      "an install is followed by re-asking the browser, not by assuming success");
  }

  /* ── V1.1 — INTERRUPTION STOPS PLAYBACK BEFORE IT OPENS A MICROPHONE ────── */
  {
    const code = codeOf(read(RUNTIME));
    const activateStart = code.indexOf("const onActivate = useCallback(");
    const activateEnd = code.indexOf("const onAcknowledge = useCallback(", activateStart);
    assert.ok(activateStart > -1 && activateEnd > activateStart);
    const activate = code.slice(activateStart, activateEnd);

    const stopIndex = activate.indexOf('if (stateRef.current === "speaking") synthesis?.stop();');
    const dispatchIndex = activate.indexOf("dispatch(event);");
    assert.ok(stopIndex > -1, "reaching for the microphone while Heby speaks stops the playback");
    assert.ok(dispatchIndex > stopIndex, "and stops it BEFORE the transition, so the two are never both live");

    /*
     * AND IT IS THE ONLY INTERRUPTION. Barge-in driven by a standing microphone would need a capture
     * nobody pressed for, which does not exist anywhere in the voice layer.
     */
    for (const file of VOICE_FILES) {
      const source = codeOf(read(file));
      for (const forbidden of ["bargeIn", "barge_in", "vad", "voiceActivity", "autoListen", "autoStart"]) {
        assert.ok(!source.includes(forbidden), `${file} must not contain "${forbidden}"`);
      }
    }
  }

  /* ── V1.1 — SPOKEN OUTPUT IS THE VISIBLE ANSWER, AND NOTHING ELSE ───────── */
  {
    const code = codeOf(read(RUNTIME));
    const speakStart = code.indexOf("synthesis.speak({");
    assert.ok(speakStart > -1, "there is exactly one place an answer is spoken");
    assert.equal([...code.matchAll(/synthesis\.speak\(/g)].length, 1, "and only one");
    const speakEnd = code.indexOf("});", speakStart);
    const payload = code.slice(speakStart, speakEnd);

    // The whole payload: one string, one language, three lifecycle callbacks.
    for (const leak of [
      "prompt", "evidence", "provenance", "conversationId", "requestId", "correlation",
      "limitation", "record", "turn.", "message", "system",
    ]) {
      assert.ok(!payload.includes(leak), `the spoken payload must not carry "${leak}"`);
    }
    assert.ok(payload.includes("text,"), "the payload is the answer text");

    /*
     * THERE IS NO OUTPUT AMPLITUDE, AND THAT IS THE HONEST ANSWER RATHER THAN A GAP. Browser speech
     * synthesis exposes no AudioNode, MediaStream or buffer, so playback cannot be measured; the
     * adapter says so, and nothing anywhere invents a level to fill the silence.
     */
    assert.match(code, /measurablePlayback: false/, "browser playback declares itself unmeasurable");
    for (const fabricated of ["outputAudioLevel", "createMediaElementSource", "speakingLevel", "ttsLevel"]) {
      assert.ok(!code.includes(fabricated), `no invented playback amplitude — found "${fabricated}"`);
    }
    // Exactly one audio level reaches the surfaces, and it is the microphone's.
    assert.equal([...code.matchAll(/audioLevel:/g)].length, 1, "one level exists, and it is measured from the microphone");
  }

  /* ── V1.1 — NO SPEECH PROVIDER, NO CREDENTIAL, NO ENDPOINT, NO DEPENDENCY ─ */
  {
    /*
     * The seam exists so a provider CAN be added under a Director gate. This proves none has been
     * added without one: no speech SDK is installed, and no voice file names an endpoint or carries
     * anything that could authorize a request.
     */
    const manifest = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const installed = [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})];
    for (const vendor of [
      "deepgram", "assemblyai", "openai", "cognitiveservices-speech", "@google-cloud/speech",
      "elevenlabs", "whisper", "speechmatics", "rev.ai", "picovoice", "vosk",
    ]) {
      assert.ok(
        !installed.some((name) => name.toLowerCase().includes(vendor)),
        `a speech provider SDK ("${vendor}") was installed without a Director gate`,
      );
    }

    for (const file of VOICE_FILES) {
      const code = codeOf(read(file));
      assert.ok(!code.includes("://"), `${file} must not name a remote endpoint`);
      for (const secret of [
        "Authorization", "Bearer", "API_KEY", "apiKey", "accessToken", "clientSecret",
        "ephemeralKey", "grantToken", "subscriptionKey",
      ]) {
        assert.ok(!code.includes(secret), `${file} must not carry "${secret}"`);
      }
    }
  }

  /* ── V1.1 — THE LANGUAGE IS THE OPERATOR'S, NOT THE BROWSER'S, PER UTTERANCE ── */
  {
    const code = codeOf(read(RUNTIME));
    /*
     * `navigator.language` is read EXACTLY ONCE, as a seed for the initial preference, and never
     * again. Voice V1 handed it straight to the recognizer on every capture, which meant a Turkish
     * operator on an English browser got confident nonsense with no way to correct it.
     */
    assert.equal([...code.matchAll(/navigator\.language/g)].length, 1, "the browser preference is a seed, read once");
    assert.match(code, /useState<HebyVoiceLanguage>\(\(\) =>\s*resolveInitialVoiceLanguage\(/,
      "and it seeds a lazy initializer, so it cannot be re-read on a later render");
    assert.ok(!/recognizer\.lang = [^;]*navigator/.test(code), "the recognizer is never pointed at the browser preference");
    assert.match(code, /recognizer\.lang = hebyVoiceRecognitionTag\(request\.language\)/,
      "the recognizer is pointed at the language the operator chose");

    // The preference is session-local: it is never written anywhere. (Storage APIs are already
    // banned across every voice file above; this names the specific claim being made.)
    for (const file of VOICE_FILES) {
      const source = codeOf(read(file));
      for (const persistence of ["localStorage", "sessionStorage", "document.cookie", "indexedDB"]) {
        assert.ok(!source.includes(persistence), `the language preference must stay session-local — ${file}`);
      }
    }
  }

  /* ── V1.2 — THE AMPLITUDE PATH, AND THE TWO DEFECTS A REAL MICROPHONE FOUND ── */
  {
    const code = codeOf(read(RUNTIME));

    /*
     * ONE AUDIO GRAPH, ONE OWNER, AND IT IS A SINK.
     *   MediaStream → MediaStreamAudioSourceNode → AnalyserNode → (nothing)
     */
    assert.equal([...code.matchAll(/new AudioCtor\(\)/g)].length, 1, "exactly one AudioContext is ever constructed");
    assert.equal([...code.matchAll(/createAnalyser\(\)/g)].length, 1, "exactly one analyser exists");
    assert.match(code, /context\.createMediaStreamSource\(stream\)\.connect\(analyser\)/,
      "the analyser is fed from the SAME live stream the runtime owns");
    assert.ok(!code.includes("context.destination"), "the microphone is never routed to the speakers");

    /*
     * DEFECT 1 REGRESSION — THE MEASUREMENT LOOP MUST NOT DEPEND ON REACT COMMIT ORDERING.
     *
     * It used to exit when `stateRef.current` was not yet `listening`. The loop is started while the
     * reducer is still `requesting` and `stateRef` is advanced by a PASSIVE EFFECT, which runs after
     * paint — while requestAnimationFrame runs before it. So the first tick always lost the race,
     * killed the loop, and produced a live microphone with a permanently zero amplitude. A real
     * microphone found it; these two assertions are why it cannot come back.
     */
    const tickStart = code.indexOf("const tick = () => {");
    assert.ok(tickStart > -1, "the measurement loop exists");
    const tickEnd = code.indexOf("frameRef.current = requestAnimationFrame(tick);\n    };", tickStart);
    const tick = code.slice(tickStart, tickEnd > tickStart ? tickEnd : tickStart + 1200);
    assert.ok(!tick.includes("stateRef"), "the measurement loop must not consult React state");
    assert.ok(!tick.includes("hebyVoiceHasAudioLevel"), "nor the presentation predicate — that gate lives downstream");
    assert.match(tick, /if \(!active \|\| !measuringRef\.current\)/,
      "it is gated on the synchronous device flag instead");

    // The flag is raised BEFORE the loop starts, so no frame can observe a stale gate.
    const raise = code.indexOf("measuringRef.current = true;");
    const start = code.indexOf("startMeasuring(analyser);");
    assert.ok(raise > -1 && start > raise, "measurement is armed before the loop is scheduled");

    // And lowered FIRST in teardown, so a scheduled frame cannot sample a closing device.
    const tdStart = code.indexOf("const teardown = useCallback(");
    const td = code.slice(tdStart, tdStart + 500);
    assert.ok(
      td.indexOf("measuringRef.current = false") > -1 &&
        td.indexOf("measuringRef.current = false") < td.indexOf("cancelAnimationFrame"),
      "teardown disarms measurement before it cancels the frame",
    );

    /*
     * DEFECT 2 REGRESSION — THE CONTEXT MUST BE PROVEN RUNNING.
     *
     * The AudioContext is constructed in an async continuation after `await getUserMedia`, past the
     * expiry of transient user activation, so Chrome starts it SUSPENDED. A suspended context feeds
     * the analyser silence bytes forever. It is resumed, then verified, then failed loudly.
     */
    assert.match(code, /if \(context\.state === "suspended"\) \{[\s\S]{0,140}await context\.resume\(\);/,
      "a suspended context is resumed");
    assert.match(code, /if \(context\.state !== "running"\) \{[\s\S]{0,300}failWith\("audio-context-failed"\);/,
      "and a context that still will not run fails loudly rather than showing a dead orb");
    const resumeAt = code.indexOf("await context.resume();");
    assert.ok(resumeAt > -1 && raise > resumeAt, "measurement is armed only after the context is proven running");
    // Teardown OR a cancelled attempt racing the resume must win.
    assert.match(code, /if \(!current\(\) \|\| contextRef\.current !== context\) \{/,
      "a context closed — or an attempt abandoned — mid-resume is not resurrected");

    /*
     * THE HONESTY INVARIANT DID NOT MOVE. Measurement now follows the device, but PRESENTATION still
     * follows the state machine — a level can only be shown while the reducer genuinely says
     * `listening`, which is the property every earlier phase relied on.
     */
    assert.match(code, /audioLevel: presentableAudioLevel\(level, hebyVoiceHasAudioLevel\(state\)\)/,
      "the presentation gate is unchanged");

    // Still exactly one sample buffer, still nothing accumulated.
    assert.equal([...code.matchAll(/new Uint8Array\(/g)].length, 1, "exactly one sample buffer exists");
    assert.ok(!/frames?\.push|samples?\.push|buffer\.push/.test(code), "no frame is accumulated");
  }

  /* ── V1.2 — REDUCED MOTION SUPPRESSES MOVEMENT, NEVER MEASUREMENT ────────── */
  {
    /*
     * Reduced motion is a VISUAL preference. An operator who asks for less movement has not asked to
     * be unable to dictate, so it must never reach the audio graph or the recognizer. It is enforced
     * entirely in CSS (`motion-safe:` utilities plus a media query), and these assertions keep it
     * there: no voice file may branch on it in JavaScript.
     */
    for (const file of [...VOICE_FILES, VISUALIZER]) {
      const code = codeOf(read(file));
      for (const gate of ["matchMedia", "prefers-reduced-motion", "prefersReducedMotion"]) {
        assert.ok(!code.includes(gate), `${file} must not branch on motion preference in JS — found "${gate}"`);
      }
    }
    // The visualizer still reads the level exactly once and only while listening; motion state
    // cannot reach that expression.
    const visualizer = codeOf(read(VISUALIZER));
    assert.match(visualizer, /state === "listening" \? clampAudioLevel\(props\.audioLevel\) : 0/,
      "the level is read on state alone, never on a motion preference");
  }

  /* ── V1.2 — THE DIAGNOSTIC IS DEVELOPMENT-ONLY AND IS NOT TELEMETRY ──────── */
  {
    const code = codeOf(read(RUNTIME));

    assert.match(code, /if \(process\.env\.NODE_ENV === "production" \|\| typeof window === "undefined"\) return;/,
      "the diagnostic is not attached in production");
    assert.match(code, /delete holder\.__hebyVoiceDiagnostics;/, "and is removed on unmount");
    assert.equal([...code.matchAll(/__hebyVoiceDiagnostics/g)].length, 3,
      "it is attached, deleted, and typed — and referenced nowhere else in the product");

    /*
     * IT IS PULLED, NEVER PUSHED. The network and storage bans above already cover every voice file;
     * this names the specific claim: the snapshot is a function the operator calls, not something the
     * product reports.
     */
    const diagStart = code.indexOf("const snapshot = () => ({");
    assert.ok(diagStart > -1, "the snapshot exists");
    const diagEnd = code.indexOf("    });", diagStart);
    const diag = code.slice(diagStart, diagEnd);
    for (const leak of [
      "transcriptRef", "getByteTimeDomainData", "Uint8Array", "deviceId", "label", "getSettings",
      "sinkRef", "lastAnswerRef",
    ]) {
      assert.ok(!diag.includes(leak), `the diagnostic must not expose "${leak}"`);
    }
    assert.ok(diag.includes("readyState") && diag.includes("muted"), "it reports device flags the browser already exposes");
    assert.ok(diag.includes("samples") && diag.includes("peakLevel"), "and the two counters the zero-amplitude defect needed");
  }

  /* ── V1.3 — THE CAPTURE ATTEMPT TOKEN, AND THE HANG IT EXISTS TO KILL ────── */
  {
    const code = codeOf(read(RUNTIME));

    /*
     * THE DEFECT: `beginCapture` decided whether its own result was still wanted by reading
     * `stateRef.current !== "requesting"`. `stateRef` is advanced by a PASSIVE EFFECT, so that was a
     * bet on React committing before `getUserMedia` settled — a bet that is LOST exactly when the
     * permission is already granted and the promise resolves in milliseconds. The guard then stopped
     * the tracks the operator had just been granted and returned without dispatching, leaving the
     * surface on "Waiting for microphone permission" forever.
     *
     * Same class as the V1.2 measurement defect: control flow must not depend on commit ordering.
     */
    const captureStart = code.indexOf("const beginCapture = useCallback(");
    const captureEnd = code.indexOf("markPhase(\"listening\");", captureStart);
    assert.ok(captureStart > -1 && captureEnd > captureStart, "beginCapture is bounded");
    const capture = code.slice(captureStart, captureEnd);
    assert.ok(!capture.includes("stateRef.current !== \"requesting\""),
      "the capture path must not gate on a React-committed state ref");
    assert.match(capture, /const current = \(\) => captureAttemptRef\.current === attempt;/,
      "an attempt carries a synchronous token instead");

    // ONE operator action mints exactly ONE attempt, and only when the reducer legalised it.
    const mints = [...code.matchAll(/void beginCapture\(\(captureAttemptRef\.current \+= 1\)\)/g)];
    assert.equal(mints.length, 2, "the two operator handlers are the only places an attempt is minted");
    // The declaration reads `beginCapture = useCallback(`, so every `beginCapture(` in the file is a
    // CALL. All of them must be the token-minting ones proven above.
    assert.equal([...code.matchAll(/beginCapture\(/g)].length, mints.length,
      "there is no other call site for beginCapture");
    assert.equal([...code.matchAll(/getUserMedia\(\{ audio: true \}\)/g)].length, 1,
      "one attempt can therefore produce at most one getUserMedia call");

    /*
     * THE LATE RESULT IS STOPPED, NEVER ADOPTED. Teardown invalidates the token first, so a promise
     * the browser is still holding resolves into a stale attempt, stops its own tracks and returns.
     */
    const tdStart = code.indexOf("const teardown = useCallback(");
    const td = code.slice(tdStart, tdStart + 400);
    assert.ok(td.includes("captureAttemptRef.current += 1"), "teardown invalidates the attempt in flight");
    assert.ok(
      td.indexOf("captureAttemptRef.current += 1") < td.indexOf("measuringRef.current = false"),
      "and it does so FIRST, before anything else is released",
    );
    /*
     * The adoption decision is the gate, and it is a PURE FUNCTION so the branch logic can be
     * enumerated in a test rather than only read here.
     */
    assert.match(capture, /const adoption = decideMediaAdoption\(\{\s*isCurrentAttempt: current\(\),\s*audioTrackCount: audioTracks\.length,\s*\}\);/,
      "the settled stream is put through the pure adoption decision");
    assert.match(capture, /if \(adoption\.action === "discard"\) \{\s*discard\(stream\);/,
      "every refusal discards the stream");
    assert.match(code, /const discard = \(stream: MediaStream\) => \{\s*for \(const track of stream\.getTracks\(\)\) track\.stop\(\);/,
      "and discarding means stopping every track, not dropping the reference");
    // Nothing downstream can run after a discard.
    const discardBranch = capture.slice(capture.indexOf('if (adoption.action === "discard")'));
    const afterDiscard = discardBranch.slice(0, discardBranch.indexOf("markPhase(\"media-acquired\")"));
    for (const forbidden of ["new AudioCtor", "createAnalyser", "speechToText.start", "capture-started"]) {
      assert.ok(!afterDiscard.includes(forbidden), `a discarded stream must not reach "${forbidden}"`);
    }

    /*
     * THE TOKEN IS RE-CHECKED AT EVERY AWAIT BOUNDARY, not only the first: the rejection path, the
     * resolution path, and again after `resume()`.
     */
    assert.equal([...code.matchAll(/current\(\)/g)].length, 3,
      "all three await boundaries re-check whether the attempt is still wanted");

    /*
     * A RESOLVED PROMISE IS NOT A USABLE DEVICE — and abandonment outranks it, so a stream nobody
     * wants is stopped quietly rather than reported as a device fault the operator did not cause.
     */
    assert.match(capture, /if \(adoption\.reason === "no-audio-track"\) \{[\s\S]{0,120}failWith\("device-missing"\);/,
      "only a genuinely faulty device produces a failure");

    // Cancellation is the operator's, and it never auto-retries.
    assert.match(code, /markPhase\("cancelled"\);/, "cancelling is recorded as such");
    for (const forbidden of ["retry", "Retry", "attemptAgain", "reopen"]) {
      assert.ok(!code.includes(forbidden), `the runtime must never auto-retry — found "${forbidden}"`);
    }
  }

  /* ── V1.3 — THE PERMISSIONS API IS CONTEXT, NEVER AUTHORITY ──────────────── */
  {
    const code = codeOf(read(RUNTIME));
    assert.match(code, /permissions\s*\.query\(\{ name: "microphone" as PermissionName \}\)/,
      "the permission is observed");
    /*
     * And observed ONLY. `granted` does not prove a stream exists; `prompt` does not prove a prompt
     * is on screen. So nothing may branch on it: capture authority stays with getUserMedia.
     */
    /*
     * Line-precise rather than clever: every line mentioning the observation must be a declaration,
     * a plain record of it, or a dependency list. A line that also contains a conditional, a return
     * or a boolean operator would mean behaviour is being selected from it.
     */
    const lines = code.split("\n").filter((line) => line.includes("permissionState"));
    assert.ok(lines.length > 0, "the observation is recorded");
    for (const line of lines) {
      for (const branch of ["if (", "if(", " ? ", "&&", "||", "return "]) {
        assert.ok(!line.includes(branch), `nothing may branch on the permission observation: ${line.trim()}`);
      }
    }
    assert.ok(
      lines.some((line) => line.includes("observedState: permissionState")),
      "it is reported in the diagnostic and nowhere else that matters",
    );
    // It cannot short-circuit the real request.
    const captureStart = code.indexOf("const beginCapture = useCallback(");
    const capture = code.slice(captureStart, code.indexOf("markPhase(\"listening\");", captureStart));
    assert.ok(!capture.includes("permissionState"), "the capture path never reads it");
  }

  /* ── V1.3 — THE CAPTURE PHASE IS A DIAGNOSTIC, NOT A SECOND STATE MACHINE ── */
  {
    const code = codeOf(read(RUNTIME));
    const phase = codeOf(read(`${FEATURE_DIR}/capture-phase.ts`));

    // The phase vocabulary is pure and has no transition function — nothing to compete with.
    for (const forbidden of ["react", "useState", "useEffect", "dispatch", "reducer"]) {
      assert.ok(!phase.includes(forbidden), `the phase vocabulary must stay pure — found "${forbidden}"`);
    }
    // Nothing in the runtime decides capture legality from the phase.
    assert.ok(!/if \([^)]*capturePhaseRef\.current[^)]*\)[\s\S]{0,80}dispatch\(/.test(code),
      "the phase must never drive a state transition");
    assert.ok(!/capturePhase[^;]{0,60}beginCapture/.test(code), "nor start a capture");
    // Its single presentation use is the stall wording, and the reducer still owns the state.
    assert.match(code, /mediaStalled: mediaStalled && capturePhase === "media-pending"/,
      "the stall flag is scoped to the one phase it describes");
    assert.match(code, /const state: HebyVoiceState = hebyVoiceInputAvailable\(capability\) \? rawState : "unsupported";/,
      "the user-facing state still comes from the reducer alone");
  }

  /* ── V1.3 — AN INSTALL REQUEST IS NEVER INVISIBLE ────────────────────────── */
  {
    const code = codeOf(read(RUNTIME));
    /*
     * The Director pressed "Keep speech on this device" and nothing visibly happened, because every
     * outcome — including a rejection — removed the offer and changed nothing else. Now each outcome
     * has a status of its own, and success is decided by RE-ASKING rather than by the promise.
     */
    assert.match(code, /setInstallStatus\("requested"\)/, "requesting is visible");
    assert.match(code, /setInstallStatus\(answer === "available" \? "installed" : "no-change"\)/,
      "installed is claimed only when a re-check proves it, and no-change is reported honestly");
    assert.match(code, /setInstallStatus\("failed"\)/, "a failure is reported rather than swallowed");
    // The re-check is the authority, exactly as in V1.1.
    assert.match(code, /\.then\(\(\) => ask\(\{ langs: \[tag\], processLocally: true \}\)\)/,
      "availability is re-asked after the install settles");
    assert.ok(!/setInstallStatus\("installed"\)(?![\s\S]{0,10}:)/.test(code),
      "nothing sets installed unconditionally");
  }

  console.log("voice-v1 runtime firewall + privacy audit passed");
}

main();
