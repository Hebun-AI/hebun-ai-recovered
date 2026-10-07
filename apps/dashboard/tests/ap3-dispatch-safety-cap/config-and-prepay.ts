/*
 * AP-3 — the cap's configuration is fail-closed, and the process-budget prepay seam cannot skip a unit.
 *
 *   1. Defaults are 50 model / 5 media per tenant per UTC day; absent → default.
 *   2. Garbage, 0, negative, fractional or above the class maximum → 0. There is no "unlimited".
 *   3. The UTC day window is half-open [00:00, 24:00).
 *   4. `prepayLiveDispatch` takes exactly ONE unit from the transport's own budget; the send that
 *      follows uses it instead of taking a second; without a prepay the send takes its own unit.
 *   5. A prepay is single-use, per instance: a second prepay is refused without spending, a prepay on
 *      an exhausted budget is refused and marks nothing, and a fake transport cannot be prepaid.
 *   6. The prepay key is module-private: `Symbol.for` cannot reach it, and even the raw function
 *      (found by reflection) charges the budget — there is no way to mark a send paid without paying.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_AI_DISPATCH_CAPS,
  MAX_CONFIGURABLE_AI_DISPATCH_CAPS,
  resolveAiDispatchCap,
  utcDayWindow,
} from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { createLiveClaudeTransport, prepayLiveDispatch, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ClaudeTransport } from "../../src/features/heby-model/claude-transport";

/* ── 1–2. CONFIG ─────────────────────────────────────────────────────────── */
assert.deepEqual(DEFAULT_AI_DISPATCH_CAPS, { model: 50, media: 5 });
assert.equal(resolveAiDispatchCap("model", {}), 50);
assert.equal(resolveAiDispatchCap("media", {}), 5);
assert.equal(resolveAiDispatchCap("model", { HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY: "  " }), 50, "blank is absent");
assert.equal(resolveAiDispatchCap("model", { HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY: "12" }), 12);
assert.equal(resolveAiDispatchCap("media", { HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY: "3" }), 3);
assert.equal(resolveAiDispatchCap("media", { HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY: "3" }), 5, "classes do not share a key");
for (const bad of ["abc", "0", "-1", "1.5", "1e3", "Infinity", "unlimited", "99999999999999999999"]) {
  assert.equal(resolveAiDispatchCap("model", { HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY: bad }), 0, `model "${bad}" fails closed to 0`);
  assert.equal(resolveAiDispatchCap("media", { HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY: bad }), 0, `media "${bad}" fails closed to 0`);
}
for (const cls of ["model", "media"] as const) {
  const key = cls === "model" ? "HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY" : "HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY";
  const max = MAX_CONFIGURABLE_AI_DISPATCH_CAPS[cls];
  assert.equal(resolveAiDispatchCap(cls, { [key]: String(max) }), max, `${cls}: the maximum itself is honoured`);
  assert.equal(resolveAiDispatchCap(cls, { [key]: String(max + 1) }), 0, `${cls}: above the maximum is 0, never unlimited`);
}

/* ── 3. WINDOW ───────────────────────────────────────────────────────────── */
{
  const w = utcDayWindow(new Date("2026-10-07T23:59:59.999Z"));
  assert.equal(w.start.toISOString(), "2026-10-07T00:00:00.000Z");
  assert.equal(w.end.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(utcDayWindow(new Date("2026-10-08T00:00:00.000Z")).start.toISOString(), "2026-10-08T00:00:00.000Z");
}

/* ── 4–6. PREPAY SEAM ────────────────────────────────────────────────────── */
async function prepay(): Promise<void> {
  let fetches = 0;
  const fetchImpl: FetchLike = async () => {
    fetches += 1;
    return { ok: true, status: 200, json: async () => ({ id: "m", model: "x", content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } }) };
  };
  const req = { model: "x", system: "s", messages: [{ role: "user" as const, content: "q" }], maxTokens: 10 };
  const live = (budget = createLiveSpendBudget(5)) => ({ budget, t: createLiveClaudeTransport({ apiKey: "k", fetchImpl, spendBudget: budget }) });

  {
    const { budget, t } = live();
    assert.equal(prepayLiveDispatch(t), true);
    assert.equal(budget.spent(), 1, "a prepay takes exactly one unit");
    assert.equal(prepayLiveDispatch(t), false, "a second prepay on the same instance is refused");
    assert.equal(budget.spent(), 1, "and spends nothing");
    await t.send(req);
    assert.equal(budget.spent(), 1, "the prepaid send does not take a second unit");
    assert.equal(fetches, 1);
    await assert.rejects(t.send(req), /already made its live call/, "the instance still makes one call");
    assert.equal(prepayLiveDispatch(t), false, "an instance that has made its call cannot be prepaid");
    assert.equal(budget.spent(), 1);
  }
  {
    const { budget, t } = live();
    await t.send(req);
    assert.equal(budget.spent(), 1, "without a prepay the send takes its own unit, as released");
  }
  {
    const { budget, t } = live(createLiveSpendBudget(0));
    assert.equal(prepayLiveDispatch(t), false, "an exhausted budget refuses the prepay");
    await assert.rejects(t.send(req), /budget for this process is exhausted/, "and marked nothing: the send is still refused");
    assert.equal(budget.spent(), 0);
  }
  {
    const fake: ClaudeTransport = { send: async () => ({ content: [] }) };
    assert.equal(prepayLiveDispatch(fake), false, "a fake transport cannot be prepaid");
    assert.equal(prepayLiveDispatch(undefined), false);
    const forged = { ...fake, [Symbol.for("hebun.live-dispatch-prepay")]: () => true } as unknown as ClaudeTransport;
    assert.equal(prepayLiveDispatch(forged), false, "a Symbol.for key does not reach the private seam");
  }
  {
    const { budget, t } = live(createLiveSpendBudget(1));
    const raw = Object.getOwnPropertySymbols(t)
      .map((s) => (t as unknown as Record<symbol, unknown>)[s])
      .find((v): v is () => boolean => typeof v === "function");
    assert.ok(raw, "the seam exists on the live transport");
    assert.equal(raw.call(t), true);
    assert.equal(budget.spent(), 1, "reached by reflection, the seam still charges the budget");
  }
}

prepay()
  .then(() => console.log("ap3-dispatch-safety-cap/config-and-prepay: passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
