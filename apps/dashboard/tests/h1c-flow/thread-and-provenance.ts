/*
 * H1C — pure thread composition + provenance (no React, no DB, no network).
 */
import assert from "node:assert/strict";
import {
  describeMessageProvenance,
  deriveLatestProvenance,
  buildConversationSuggestions,
  splitModelDiagnostics,
} from "../../src/components/layout/heby/heby-provenance";
import { buildTurns } from "../../src/components/layout/heby/heby-thread";
import type { HebyRuntimeResponse } from "../../src/features/heby-runtime";

function response(over: Record<string, unknown>): HebyRuntimeResponse {
  return {
    origin: "model",
    limitations: [],
    evidence: [],
    body: ["answer"],
    modelAttribution: { transport: "fake" },
    ...over,
  } as unknown as HebyRuntimeResponse;
}

function main(): void {
  // --- describeMessageProvenance (restored messages) ---
  assert.deepEqual(describeMessageProvenance("model", "fake"), { label: "Model-assisted · test transport (simulated)", tone: "warn" });
  assert.deepEqual(describeMessageProvenance("model", "live"), { label: "Model-assisted · live provider", tone: "info" });
  assert.deepEqual(describeMessageProvenance("deterministic", null), { label: "Deterministic", tone: "muted" });
  assert.equal(describeMessageProvenance("user", null), null);

  /* ── AGENT-PROPOSAL-4A — served origin vs model invocation attempted ─────────
   * These are orthogonal facts. A deterministic row that carries a transport is a turn whose
   * model answer was WITHHELD: the call happened, only the answer was refused. */
  assert.deepEqual(
    describeMessageProvenance("deterministic", "live"),
    { label: "Deterministic · a model was attempted and its answer withheld", tone: "warn" },
    "a withheld live attempt must not read as a plain deterministic turn",
  );
  assert.deepEqual(
    describeMessageProvenance("deterministic", "fake"),
    { label: "Deterministic · a model was attempted and its answer withheld", tone: "warn" },
    "the fake transport is still an attempt; it is simply not a live provider",
  );
  /* CASE A is unchanged: no transport means no invocation is proven, and the badge stays plain. */
  assert.deepEqual(describeMessageProvenance("deterministic", null), { label: "Deterministic", tone: "muted" });

  /* The live-turn projection: the withheld case must NOT claim the model went unused. */
  const withheldTurn = deriveLatestProvenance(
    response({ origin: "deterministic", modelAttribution: undefined, limitations: [], modelInvocationAttempted: true }),
  );
  assert.doesNotMatch(withheldTurn.label, /model not used/i, "a spent provider call may never read as 'model not used'");
  assert.match(withheldTurn.label, /attempted/i);
  assert.equal(withheldTurn.tone, "warn");

  /* CASE A live turn keeps the old, correct badge. */
  const noModelTurn = deriveLatestProvenance(
    response({ origin: "deterministic", modelAttribution: undefined, limitations: [] }),
  );
  assert.equal(noModelTurn.label, "Deterministic — model not used");

  /* Director-disabled outranks the attempt flag and never claims an attempt. */
  const disabled = deriveLatestProvenance(
    response({
      origin: "deterministic",
      modelAttribution: undefined,
      limitations: ["Claude connectivity is disabled by the Director; this answer is deterministic."],
    }),
  );
  assert.doesNotMatch(disabled.label, /attempted/i, "a disabled provider was never asked");

  // --- deriveLatestProvenance (current turn) ---
  assert.equal(deriveLatestProvenance(response({ origin: "model", modelAttribution: { transport: "fake" } })).tone, "warn");
  assert.match(deriveLatestProvenance(response({ origin: "model", modelAttribution: { transport: "live" } })).label, /live provider/);
  assert.match(
    deriveLatestProvenance(response({ origin: "deterministic", limitations: ["Claude connectivity is disabled by the Director; ..."] })).label,
    /disabled by Director/i,
  );
  assert.match(
    deriveLatestProvenance(response({ origin: "deterministic", limitations: ["Model generation is unavailable (TRANSPORT_UNAVAILABLE)."] })).label,
    /unavailable/i,
  );
  assert.match(deriveLatestProvenance(response({ origin: "deterministic", limitations: [] })).label, /Deterministic/);

  // --- suggestions are honest prompt shortcuts (no monitoring/alerts/execution claims) ---
  const suggestions = buildConversationSuggestions("Operations");
  assert.equal(suggestions.length, 3);
  const joined = suggestions.join(" ").toLowerCase();
  for (const banned of ["monitor", "alert", "execute", "background", "autonomous", "agent"]) {
    assert.ok(!joined.includes(banned), `suggestion must not imply "${banned}"`);
  }

  // --- buildTurns: durable authority → turns; evidence/provenance on the newest Heby turn ---
  const messages = [
    { id: "m1", role: "user", content: "Q1" },
    { id: "m2", role: "assistant", content: "A1", origin: "model", transport: "fake" },
  ];
  const plain = buildTurns(messages, null);
  assert.equal(plain.length, 2);
  assert.equal(plain[0]!.role, "user");
  assert.equal(plain[1]!.role, "heby");
  assert.equal(plain[1]!.durable, true);
  assert.equal(plain[1]!.evidence, undefined, "no evidence without a latest response (restored history)");

  const withLatest = buildTurns(messages, {
    userText: "Q1",
    durable: true,
    response: response({ origin: "model", evidence: [{ sourceClass: "ops", recordRef: "r1" }], modelAttribution: { transport: "fake" } }),
  });
  assert.deepEqual(withLatest[1]!.evidence, [{ sourceClass: "ops", recordRef: "r1" }], "latest evidence attached to newest Heby turn");
  assert.match(withLatest[1]!.provenance!.label, /test transport/);

  // --- Not durable → ephemeral session-only turns, never marked durable ---
  const ephemeral = buildTurns([], {
    userText: "hi",
    durable: false,
    response: response({ origin: "deterministic", body: ["det"], limitations: [] }),
  });
  assert.equal(ephemeral.length, 2);
  assert.equal(ephemeral[0]!.role, "user");
  assert.equal(ephemeral[1]!.role, "heby");
  assert.ok(ephemeral.every((t) => t.durable === false), "ephemeral turns are not durable");

  // --- No database id leaks into rendered content ---
  for (const turn of [...plain, ...withLatest, ...ephemeral]) {
    assert.ok(!/^m\d+$/.test(turn.content) && !turn.content.includes("m1") && !turn.content.includes("m2"), "content carries no db id");
  }

  modelDiagnosticsAreClassifiedNotInterpreted();

  console.log("h1c thread + provenance checks passed");
}

/*
 * ── THE SPLIT CLASSIFIES; IT NEVER INTERPRETS ────────────────────────────────
 *
 * `splitModelDiagnostics` decides only WHERE a runtime limitation is shown. It must be total —
 * every line lands in exactly one bucket, so nothing is dropped and nothing is rendered twice —
 * and it must pass the runtime's own words through untouched.
 *
 * It pins no code vocabulary: a future phase may change what the runtime writes inside the
 * parentheses, or add a state, without failing this suite.
 */
function modelDiagnosticsAreClassifiedNotInterpreted(): void {
  const FAILED = "Model generation failed (provider-unavailable); this answer is deterministic.";
  const UNAVAILABLE = "Model generation is unavailable (CREDENTIAL_UNAVAILABLE); this answer is deterministic.";
  const WITHHELD = "A model answer was produced but failed validation and was withheld; this answer is deterministic.";
  const ORDINARY = "Counts are derived from a non-authoritative read model.";
  const DIRECTOR_OFF =
    "Claude connectivity is disabled by the Director; this answer is deterministic and no provider request was made.";

  for (const line of [FAILED, UNAVAILABLE, WITHHELD]) {
    const { diagnostics, rest } = splitModelDiagnostics([line]);
    assert.deepEqual(diagnostics, [line], "the runtime line is carried through verbatim");
    assert.deepEqual(rest, [], "and is not also left in the ordinary list");
  }

  /*
   * THE DIRECTOR-DISABLED NOTE STAYS ORDINARY, on purpose: `deriveLatestProvenance` already states
   * that case in the badge, and the note carries no code the badge lacks. Separating it too would
   * say the same thing twice.
   */
  assert.deepEqual(splitModelDiagnostics([DIRECTOR_OFF]).diagnostics, [], "director-disabled is not duplicated here");
  assert.deepEqual(splitModelDiagnostics([DIRECTOR_OFF]).rest, [DIRECTOR_OFF]);

  /* Ordinary limitations are untouched. */
  assert.deepEqual(splitModelDiagnostics([ORDINARY]).diagnostics, []);
  assert.deepEqual(splitModelDiagnostics([ORDINARY]).rest, [ORDINARY]);

  /* TOTAL: mixed input loses nothing and duplicates nothing. */
  const mixed = [ORDINARY, FAILED, DIRECTOR_OFF, WITHHELD];
  const split = splitModelDiagnostics(mixed);
  assert.deepEqual([...split.diagnostics, ...split.rest].sort(), [...mixed].sort(), "every line is kept exactly once");
  assert.equal(split.diagnostics.length + split.rest.length, mixed.length);

  /* Nothing is invented from nothing. */
  assert.deepEqual(splitModelDiagnostics([]).diagnostics, []);
}

main();
