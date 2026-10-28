/*
 * B1-C — an exhausted process budget is `budget-exhausted`, never the provider's `rate-limited`.
 * No network, no key, no spend: injected fetch and injected budgets only.
 *
 *   C1  the process budget refuses with `budget-exhausted`, and the refused call never reaches fetch
 *   C2  a provider 429 is still `rate-limited`, and it did spend a unit (it went out)
 *   C3  the per-instance one-call cap is unchanged (`rate-limited`, pre-dispatch)
 *   C4  the preparation surface says the model was NOT asked — never "whether the provider received it"
 *   C5  origination counts `budget-exhausted` as pre-dispatch (`not-dispatched`, nothing spent)
 *   C6  a provider failure is still `provider-failed` on the surface, unchanged
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ModelConnectivityError } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { modelFallbackSentence } from "../../src/components/operations-preparation/prepare-with-hebun";

const REQ = { model: "m", system: "s", maxTokens: 100, messages: [{ role: "user" as const, content: "hi" }] } as never;
const OK = { id: "msg_b1", model: "m", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };

function fetchWith(status: number): { fetchImpl: FetchLike; count: () => number } {
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    return { ok: status < 400, status, json: async () => OK };
  }) as unknown as FetchLike;
  return { fetchImpl, count: () => n };
}

async function codeOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "sent";
  } catch (error) {
    assert.ok(error instanceof ModelConnectivityError, "a typed error, never a raw throw");
    return (error as ModelConnectivityError).code;
  }
}

async function main(): Promise<void> {
  /* C1 */
  {
    const f = fetchWith(200);
    const budget = createLiveSpendBudget(1);
    const first = await codeOf(() => createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: budget }).send(REQ));
    const second = await codeOf(() => createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: budget }).send(REQ));
    assert.deepEqual([first, second], ["sent", "budget-exhausted"], "C1: the budget's own code");
    assert.equal(f.count(), 1, "C1: the refused call never reached fetch");
  }

  /* C2 */
  {
    const f = fetchWith(429);
    const budget = createLiveSpendBudget(2);
    const code = await codeOf(() => createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: budget }).send(REQ));
    assert.equal(code, "rate-limited", "C2: a provider 429 keeps its code");
    assert.deepEqual([f.count(), budget.spent()], [1, 1], "C2: a 429 went out, so it spent a unit");
  }

  /* C3 */
  {
    const f = fetchWith(200);
    const t = createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: createLiveSpendBudget(5) });
    await t.send(REQ);
    assert.equal(await codeOf(() => t.send(REQ)), "rate-limited", "C3: the instance cap is unchanged");
  }

  /* C4 */
  {
    const said = modelFallbackSentence({ kind: "provider-failed", code: "budget-exhausted" } as never);
    assert.ok(!/Whether the provider received it is not known/.test(said), "C4: nothing left Hebun, so that is not said");
    assert.match(said, /model was not asked/, "C4: the surface says the model was not asked");
    assert.match(said, /No revision was written/, "C4: and that nothing was filed");
  }

  /* C5 */
  for (const file of ["src/features/agent-origination/originate-action.server.ts", "src/features/agent-origination/originate-work-state.server.ts"]) {
    const src = readFileSync(file, "utf8");
    const list = src.slice(src.indexOf("const PRE_DISPATCH_FAILURE_CODES"), src.indexOf("]);", src.indexOf("const PRE_DISPATCH_FAILURE_CODES")));
    assert.match(list, /"budget-exhausted"/, `C5: ${file} counts budget-exhausted as pre-dispatch`);
  }

  /* C6 */
  assert.match(
    modelFallbackSentence({ kind: "provider-failed", code: "timeout" } as never),
    /Whether the provider received it is not known/,
    "C6: a real provider failure keeps its released sentence",
  );

  console.log("b1-live-budget/classification: C1–C6 ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
