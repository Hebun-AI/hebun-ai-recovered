/*
 * H1A — bounded recent-history builder (pure, no DB, no network).
 *
 * Proves the builder is deterministic and bounded: only user/assistant turns, order preserved,
 * at most N messages AND M chars, oldest whole turns dropped first, never split, never re-roled.
 */
import assert from "node:assert/strict";
import {
  buildBoundedHistory,
  MAX_HISTORY_MESSAGES,
  MAX_HISTORY_CHARS,
} from "../../src/features/heby-answer/bounded-history";

function main(): void {
  // 1. Filters non-conversational roles and empty content; preserves order.
  {
    const out = buildBoundedHistory([
      { role: "user", content: "u1" },
      { role: "system", content: "should be dropped" },
      { role: "assistant", content: "  " }, // empty after trim → dropped
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
    assert.deepEqual(out, [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
    ]);
  }

  // 2. Keeps only the most-recent MAX_HISTORY_MESSAGES; drops oldest first.
  {
    const many = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `m${i}`,
    }));
    const out = buildBoundedHistory(many);
    assert.equal(out.length, MAX_HISTORY_MESSAGES, "capped at MAX_HISTORY_MESSAGES");
    // The last kept message is the newest; the first kept is exactly N back.
    assert.equal(out[out.length - 1]!.content, "m19");
    assert.equal(out[0]!.content, `m${20 - MAX_HISTORY_MESSAGES}`);
  }

  // 3. Char budget: drops OLDEST whole turns until under MAX_HISTORY_CHARS; never splits.
  {
    const big = "x".repeat(4000);
    const out = buildBoundedHistory([
      { role: "user", content: big }, // oldest — should be dropped
      { role: "assistant", content: big }, // 4000
      { role: "user", content: "y".repeat(100) },
    ]);
    const totalChars = out.reduce((n, t) => n + t.content.length, 0);
    assert.ok(totalChars <= MAX_HISTORY_CHARS, "within char budget");
    assert.equal(out.length, 2, "oldest big turn dropped");
    assert.equal(out[out.length - 1]!.content, "y".repeat(100), "newest retained");
    // No turn was split (each content is intact).
    assert.equal(out[0]!.content.length, 4000);
  }

  // 4. A single most-recent turn larger than the whole budget is dropped (fail to less history,
  //    never a partial turn).
  {
    const out = buildBoundedHistory([{ role: "user", content: "z".repeat(MAX_HISTORY_CHARS + 1) }]);
    assert.deepEqual(out, [], "over-budget single turn dropped whole");
  }

  // 5. Empty input → empty history.
  assert.deepEqual(buildBoundedHistory([]), []);

  console.log("h1 bounded-history checks passed");
}

main();
