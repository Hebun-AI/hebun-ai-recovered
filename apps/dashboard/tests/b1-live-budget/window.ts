/*
 * B1-A — the per-process live-call budget renews on a fixed window instead of never.
 * No network, no key, no spend: an injected clock, injected fetch and injected budgets only.
 *
 *   W1  inside one window the limit holds: N granted, N+1 refused (`budget-exhausted`), never fetched
 *   W2  the count renews only when the window ends: refused 1 ms before, granted at the boundary
 *   W3  the most any span can admit across one boundary is 2N, and never more
 *   W4  a clock that moves backwards renews nothing
 *   W5  a zero budget (invalid configuration) refuses in every window — never unlimited
 *   W6  configuration: absent → 8, 100 allowed, 101 / 0 / garbage → 0; the window is 60 s
 *   W7  a failed provider call (500) still spends its unit, as released
 *   W8  the process budget is one memoised object, and image and video draw on the same one as Claude
 *   W9  a new budget (a restarted process) starts empty; a running one cannot be emptied by a caller
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ModelConnectivityError } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import {
  createLiveSpendBudget,
  getProcessLiveSpendBudget,
  resolveLiveCallBudget,
  DEFAULT_LIVE_CALL_BUDGET,
  LIVE_CALL_BUDGET_ENV_KEY,
  LIVE_CALL_BUDGET_WINDOW_MS,
} from "../../src/features/heby-model-live/live-spend-budget.server";

const REQ = { model: "m", system: "s", maxTokens: 100, messages: [{ role: "user" as const, content: "hi" }] } as never;
const OK = { id: "msg_w", model: "m", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
const WINDOW = 60_000;
const T0 = 1_800_000_000_000; /* a window boundary: divisible by 60 000 */

function fetchWith(status: number): { fetchImpl: FetchLike; count: () => number } {
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    return { ok: status < 400, status, json: async () => OK };
  }) as unknown as FetchLike;
  return { fetchImpl, count: () => n };
}

function clockAt(start: number): { now: () => number; set: (t: number) => void } {
  let t = start;
  return { now: () => t, set: (v: number) => void (t = v) };
}

const grants = (budget: { attempt(): boolean }, n: number): boolean[] => Array.from({ length: n }, () => budget.attempt());

async function main(): Promise<void> {
  assert.equal(T0 % WINDOW, 0, "fixture: T0 is a window boundary");

  /* W1 */
  {
    const clock = clockAt(T0 + 5_000);
    const budget = createLiveSpendBudget(2, { windowMs: WINDOW, now: clock.now });
    const f = fetchWith(200);
    const codes: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      try {
        await createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: budget }).send(REQ);
        codes.push("sent");
      } catch (error) {
        assert.ok(error instanceof ModelConnectivityError);
        codes.push((error as ModelConnectivityError).code);
      }
    }
    assert.deepEqual(codes, ["sent", "sent", "budget-exhausted"], "W1: N granted, N+1 refused");
    assert.equal(f.count(), 2, "W1: the refused call never reached fetch");
  }

  /* W2 */
  {
    const clock = clockAt(T0 + 1);
    const budget = createLiveSpendBudget(2, { windowMs: WINDOW, now: clock.now });
    assert.deepEqual(grants(budget, 3), [true, true, false], "W2: the window's limit");
    clock.set(T0 + WINDOW - 1);
    assert.equal(budget.attempt(), false, "W2: 1 ms before the boundary, still refused");
    clock.set(T0 + WINDOW);
    assert.deepEqual(grants(budget, 3), [true, true, false], "W2: at the boundary the count renews, to the same limit");
    clock.set(T0 + 3 * WINDOW + 17);
    assert.deepEqual(grants(budget, 3), [true, true, false], "W2: a later window, the same limit — idle windows do not accumulate");
  }

  /* W3 */
  {
    const clock = clockAt(T0 + WINDOW - 1);
    const budget = createLiveSpendBudget(3, { windowMs: WINDOW, now: clock.now });
    const before = grants(budget, 5).filter(Boolean).length;
    clock.set(T0 + WINDOW);
    const after = grants(budget, 5).filter(Boolean).length;
    assert.equal(before + after, 6, "W3: 2 ms across one boundary admits exactly 2N, the stated fixed-window ceiling");
  }

  /* W4 */
  {
    const clock = clockAt(T0 + WINDOW + 10);
    const budget = createLiveSpendBudget(1, { windowMs: WINDOW, now: clock.now });
    assert.deepEqual(grants(budget, 2), [true, false]);
    clock.set(T0 + 10);
    assert.equal(budget.attempt(), false, "W4: a clock moving backwards renews nothing");
    clock.set(T0 + WINDOW + 20);
    assert.equal(budget.attempt(), false, "W4: and returning to the same window renews nothing");
  }

  /* W5 */
  {
    const clock = clockAt(T0);
    const budget = createLiveSpendBudget(resolveLiveCallBudget({ [LIVE_CALL_BUDGET_ENV_KEY]: "garbage" }), { windowMs: WINDOW, now: clock.now });
    for (let w = 0; w < 5; w += 1) {
      clock.set(T0 + w * WINDOW);
      assert.equal(budget.attempt(), false, `W5: window ${w} refuses — invalid configuration is never unlimited`);
    }
    const nan = createLiveSpendBudget(2, { windowMs: Number.NaN, now: clock.now });
    clock.set(T0);
    assert.deepEqual(grants(nan, 3), [true, true, false]);
    clock.set(T0 + 100 * WINDOW);
    assert.equal(nan.attempt(), false, "W5: an invalid window never renews — fail closed");
  }

  /* W6 */
  {
    assert.equal(DEFAULT_LIVE_CALL_BUDGET, 8);
    assert.equal(LIVE_CALL_BUDGET_WINDOW_MS, 60_000, "W6: the window is 60 seconds");
    assert.equal(resolveLiveCallBudget({}), 8);
    assert.equal(resolveLiveCallBudget({ [LIVE_CALL_BUDGET_ENV_KEY]: "100" }), 100);
    for (const raw of ["101", "0", "-1", "abc", "1.5"]) assert.equal(resolveLiveCallBudget({ [LIVE_CALL_BUDGET_ENV_KEY]: raw }), 0, `W6: ${raw} → 0`);
  }

  /* W7 */
  {
    const clock = clockAt(T0);
    const budget = createLiveSpendBudget(2, { windowMs: WINDOW, now: clock.now });
    const f = fetchWith(500);
    await assert.rejects(() => createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: budget }).send(REQ));
    assert.deepEqual([f.count(), budget.spent()], [1, 1], "W7: a failed provider call spent its unit");
  }

  /* W8 */
  {
    assert.equal(getProcessLiveSpendBudget(), getProcessLiveSpendBudget(), "W8: one process budget");
    assert.equal(getProcessLiveSpendBudget().limit, DEFAULT_LIVE_CALL_BUDGET, "W8: the default limit in this test process");
    for (const file of [
      "src/features/heby-model-live/claude-http-transport.server.ts",
      "src/features/media-assets/media-generation-transport.server.ts",
      "src/features/media-generation-live/live-video-generation-resolver.server.ts",
    ]) {
      assert.match(readFileSync(file, "utf8"), /getProcessLiveSpendBudget\(\)/, `W8: ${file} draws on the one process budget`);
    }
  }

  /* W9 */
  {
    const clock = clockAt(T0);
    const first = createLiveSpendBudget(1, { windowMs: WINDOW, now: clock.now });
    assert.deepEqual(grants(first, 2), [true, false]);
    const restarted = createLiveSpendBudget(1, { windowMs: WINDOW, now: clock.now });
    assert.equal(restarted.attempt(), true, "W9: a restarted process starts with its own window");
    assert.deepEqual(Object.keys(first).sort(), ["attempt", "limit", "spent"], "W9: no caller can empty a running budget");
    assert.ok(Object.isFrozen(first), "W9: and the budget object is frozen");
  }

  console.log("b1-live-budget/window: W1–W9 ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
