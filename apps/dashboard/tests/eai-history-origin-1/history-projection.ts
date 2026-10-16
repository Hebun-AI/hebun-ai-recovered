/*
 * EAI-HISTORY-ORIGIN-1 — the model-facing history projection, pure.
 *
 *   A. A deterministic assistant turn is replaced whole by the fixed marker.
 *   B. A legacy assistant turn (origin null, or no origin at all) is withheld.
 *   C. An origin this code does not know (any spelling but exactly "model") is withheld.
 *   D. The human's turns travel as typed, whatever origin they carry.
 *   E. A model assistant turn travels, minimized as before.
 *   F. A deterministic answer mixing disclosable and withheld lines is withheld WHOLE.
 *   J. Identity minimization still applies to the model turns that travel.
 *   K. `buildBoundedHistory` keeps its count and character bounds and carries `origin` unchanged.
 *   L. Only `role` and `content` leave the projection — `origin` never reaches the transport shape.
 *   M. Bite-proof: the same checks run against the pre-phase projection must fail.
 */
import assert from "node:assert/strict";
import type { ConversationTurn } from "../../src/features/heby-runtime";
import {
  MAX_HISTORY_CHARS,
  MAX_HISTORY_MESSAGES,
  buildBoundedHistory,
  type HistoryTurn,
} from "../../src/features/heby-answer/bounded-history";
import {
  MODEL_WITHHELD_ADDRESS,
  MODEL_WITHHELD_HISTORY_ANSWER,
  minimizeModelFacingText,
  modelFacingHistory,
} from "../../src/features/heby-answer/model-facing-projection";

const PERSON = "44444444-4444-4444-8444-444444444444";
const MARK = MODEL_WITHHELD_HISTORY_ANSWER;
type Project = (turns: readonly HistoryTurn[]) => readonly ConversationTurn[];

/** Every security check, against any projection. Throws on the first violation. */
function checkProjection(project: Project): void {
  /* A. */
  assert.deepEqual(project([{ role: "assistant", content: "People: CANARY-DET-A owns Finance.", origin: "deterministic" }]), [
    { role: "assistant", content: MARK },
  ]);
  /* B. */
  assert.deepEqual(project([{ role: "assistant", content: "CANARY-LEGACY-NULL", origin: null }]), [{ role: "assistant", content: MARK }]);
  assert.deepEqual(project([{ role: "assistant", content: "CANARY-LEGACY-ABSENT" }]), [{ role: "assistant", content: MARK }]);
  /* C. */
  for (const origin of ["bogus", "", "Model", " model", "model ", "user", "MODEL", "deterministic\u0000"]) {
    assert.deepEqual(project([{ role: "assistant", content: `CANARY-UNKNOWN-${origin}`, origin }]), [{ role: "assistant", content: MARK }], `origin ${JSON.stringify(origin)}`);
  }
  /* D. The human's words are never rewritten, never withheld, whatever their stored origin. */
  const typed = `Is ${PERSON} the owner? Mail me at me@acme.example — CANARY-USER`;
  for (const origin of ["user", null, undefined, "deterministic", "bogus"] as const) {
    const turn: HistoryTurn = origin === undefined ? { role: "user", content: typed } : { role: "user", content: typed, origin };
    assert.deepEqual(project([turn]), [{ role: "user", content: typed }]);
  }
  /* E + J. */
  assert.deepEqual(project([{ role: "assistant", content: `Ayşe (${PERSON}) owns it; write to ops@acme.example. CANARY-MODEL`, origin: "model" }]), [
    { role: "assistant", content: `Ayşe owns it; write to ${MODEL_WITHHELD_ADDRESS}. CANARY-MODEL` },
  ]);
  /* F. Disclosable and withheld lines in one deterministic body: nothing of either survives. */
  const mixed = project([
    {
      role: "assistant",
      content: "Connected sources:\nDraft “Spring” — work-artifact excerpt CANARY-MIX-DISCLOSABLE\nAyşe Yılmaz — people CANARY-MIX-WITHHELD",
      origin: "deterministic",
    },
  ]);
  assert.deepEqual(mixed, [{ role: "assistant", content: MARK }]);
  /* L. Order and roles are kept; nothing but role and content leaves. */
  const out = project([
    { role: "user", content: "q1", origin: "user" },
    { role: "assistant", content: "det", origin: "deterministic" },
    { role: "user", content: "q2", origin: "user" },
    { role: "assistant", content: "m", origin: "model" },
  ]);
  assert.deepEqual(out.map((t) => t.role), ["user", "assistant", "user", "assistant"]);
  for (const turn of out) assert.deepEqual(Object.keys(turn).sort(), ["content", "role"]);
}

/* ── The released projection satisfies every check. ── */
checkProjection(modelFacingHistory);

/* ── K. Bounds unchanged; `origin` carried exactly as given, absent when the input had none. ── */
{
  const many = Array.from({ length: MAX_HISTORY_MESSAGES + 4 }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: `turn ${i}`,
    origin: i % 2 === 0 ? "user" : "deterministic",
  }));
  const bounded = buildBoundedHistory(many);
  assert.equal(bounded.length, MAX_HISTORY_MESSAGES);
  assert.deepEqual(bounded[0], { role: "user", content: "turn 4", origin: "user" });
  assert.deepEqual(bounded[1], { role: "assistant", content: "turn 5", origin: "deterministic" });

  const big = buildBoundedHistory([
    { role: "user", content: "a".repeat(MAX_HISTORY_CHARS - 10), origin: "user" },
    { role: "assistant", content: "b".repeat(20), origin: "model" },
  ]);
  assert.deepEqual(big, [{ role: "assistant", content: "b".repeat(20), origin: "model" }], "char budget still drops the oldest whole turn");

  assert.deepEqual(buildBoundedHistory([{ role: "assistant", content: "x", origin: null }]), [{ role: "assistant", content: "x", origin: null }]);
  assert.deepEqual(buildBoundedHistory([{ role: "assistant", content: "x" }]), [{ role: "assistant", content: "x" }], "no origin in, no origin key out");
  /* The projection of a bounded history: a withheld turn costs no more than its marker downstream. */
  assert.deepEqual(modelFacingHistory(bounded).filter((t) => t.role === "assistant").map((t) => t.content), [MARK, MARK, MARK]);
}

/* ── M. Bite-proof: the pre-phase projection (role-only, minimize every assistant turn) must fail. ── */
const prePhase: Project = (turns) =>
  turns.map((turn) => (turn.role === "assistant" ? { role: turn.role, content: minimizeModelFacingText(turn.content) } : { role: turn.role, content: turn.content }));
assert.throws(() => checkProjection(prePhase), assert.AssertionError, "the role-only projection must not pass these checks");
/* …and a projection that trusts any non-null origin must fail too (the allowlist is exact). */
const anyOrigin: Project = (turns) =>
  turns.map((turn) =>
    turn.role === "assistant" && turn.origin == null ? { role: turn.role, content: MARK } : { role: turn.role, content: turn.role === "assistant" ? minimizeModelFacingText(turn.content) : turn.content },
  );
assert.throws(() => checkProjection(anyOrigin), assert.AssertionError, "an origin denylist must not pass these checks");

console.log("PASS eai-history-origin-1 history-projection");
