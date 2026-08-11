/*
 * H1C — pure thread composition + provenance (no React, no DB, no network).
 */
import assert from "node:assert/strict";
import {
  describeMessageProvenance,
  deriveLatestProvenance,
  buildConversationSuggestions,
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

  console.log("h1c thread + provenance checks passed");
}

main();
