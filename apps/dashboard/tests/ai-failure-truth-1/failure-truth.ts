/*
 * AI-FAILURE-TRUTH-1 — a failure record claims only what the failure proves.
 *
 *   T1  402 and `billing_error` → provider-billing
 *   T2  a 400 with credit or spend words stays the general refusal: free text decides nothing
 *   T3  the other 4xx are provider-request-rejected, 429 is provider-rate-limited
 *   T4  an unreadable or stalled error body falls back to the status
 *   T5  no fetch happened → not-dispatched, for every code raised before fetch
 *   T6  fetch attempted without an HTTP response → dispatch-failed, receipt unknown
 *   T7  provider responded → dispatch-failed; 2xx with an unreadable body is not completed work
 *   T8  historical codes never prove not-dispatched
 *   T9  the dispatch table is total over the code union
 *   T10 provider text reaches no error, message or log line
 *   T11 the preparation surface says what the code proves
 *   T12 the live transport still logs nothing; the failure line is closed values
 *
 * Synthetic: every provider here is a scripted fetch. No network, no model call.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MODEL_DISPATCH_FACTS,
  ModelConnectivityError,
  dispatchStateForFailure,
  modelFailureLogLine,
  type ModelConnectivityErrorCode,
} from "../../src/features/heby-model/model-error";
import { createLiveClaudeTransport, MAX_LIVE_OUTPUT_TOKENS, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { modelFallbackSentence } from "../../src/components/operations-preparation/prepare-with-hebun";

const REQ = { model: "m", system: "s", maxTokens: 100, messages: [{ role: "user" as const, content: "hi" }] } as never;
const CANARY = "CANARY-your credit balance is too low";

function responding(status: number, json: () => Promise<unknown>): { fetchImpl: FetchLike; count: () => number } {
  let n = 0;
  const fetchImpl = (async () => {
    n += 1;
    return { ok: status >= 200 && status < 300, status, json };
  }) as unknown as FetchLike;
  return { fetchImpl, count: () => n };
}

const errorBody = (type: unknown, message = CANARY) => async () => ({ type: "error", error: { type, message } });

async function failure(fetchImpl: FetchLike): Promise<ModelConnectivityError> {
  const transport = createLiveClaudeTransport({ apiKey: "k", fetchImpl, spendBudget: createLiveSpendBudget(5) });
  try {
    await transport.send(REQ);
  } catch (error) {
    assert.ok(error instanceof ModelConnectivityError, "only the typed error crosses the transport");
    return error;
  }
  throw new Error("the send did not fail");
}

async function main(): Promise<void> {
  /* T1 */
  assert.equal((await failure(responding(402, errorBody("billing_error")).fetchImpl)).code, "provider-billing");
  assert.equal((await failure(responding(402, errorBody(undefined)).fetchImpl)).code, "provider-billing", "T1: 402 needs no body");
  assert.equal((await failure(responding(400, errorBody("billing_error")).fetchImpl)).code, "provider-billing", "T1: the closed type decides");

  /* T2 */
  for (const message of ["Your credit balance is too low to access the Anthropic API.", "spend limit reached", "billing_error"]) {
    assert.equal(
      (await failure(responding(400, errorBody("invalid_request_error", message)).fetchImpl)).code,
      "provider-request-rejected",
      `T2: "${message}" is not read`,
    );
  }

  /* T3 */
  for (const status of [400, 404, 409, 413, 422]) {
    assert.equal((await failure(responding(status, errorBody("x")).fetchImpl)).code, "provider-request-rejected", `T3: ${status}`);
  }
  assert.equal((await failure(responding(429, errorBody("rate_limit_error")).fetchImpl)).code, "provider-rate-limited");
  assert.equal((await failure(responding(401, errorBody("authentication_error")).fetchImpl)).code, "authentication-failed");
  assert.equal((await failure(responding(529, errorBody("overloaded_error")).fetchImpl)).code, "provider-unavailable");

  /* T4 */
  const unreadable = async () => {
    throw new Error(CANARY);
  };
  assert.equal((await failure(responding(400, unreadable).fetchImpl)).code, "provider-request-rejected", "T4: a throwing body");
  assert.equal((await failure(responding(400, async () => null).fetchImpl)).code, "provider-request-rejected", "T4: a null body");
  const started = Date.now();
  assert.equal((await failure(responding(400, () => new Promise(() => {})).fetchImpl)).code, "provider-request-rejected", "T4: a stalled body");
  assert.ok(Date.now() - started < 5_000, "T4: a stalled body cannot hold the request open");

  /* T5 */
  {
    const f = responding(200, async () => ({}));
    const t = createLiveClaudeTransport({ apiKey: "k", fetchImpl: f.fetchImpl, spendBudget: createLiveSpendBudget(5) });
    const refused = await t.send({ model: "m", system: "s", maxTokens: MAX_LIVE_OUTPUT_TOKENS + 1, messages: [] } as never).catch((e) => e);
    assert.equal(refused.code, "output-bound-exceeded");
    assert.equal(f.count(), 0, "T5: no fetch");
    assert.equal(dispatchStateForFailure(refused.code), "not-dispatched");
  }
  for (const code of ["output-bound-exceeded", "transport-call-limit", "budget-exhausted", "missing-credential", "boundary-unavailable", "transport-unavailable", "connectivity-disabled"] as const) {
    assert.equal(dispatchStateForFailure(code), "not-dispatched", `T5: ${code}`);
  }

  /* T6 */
  {
    const unreachable = (async () => {
      throw new Error(CANARY);
    }) as unknown as FetchLike;
    const aborted = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as unknown as FetchLike;
    const a = await failure(unreachable);
    const b = await failure(aborted);
    assert.deepEqual([a.code, b.code], ["provider-unreachable", "timeout"]);
    for (const code of [a.code, b.code]) {
      assert.equal(MODEL_DISPATCH_FACTS[code], "receipt-unknown", `T6: ${code}`);
      assert.equal(dispatchStateForFailure(code), "dispatch-failed", `T6: ${code}`);
    }
  }

  /* T7 */
  for (const code of ["provider-billing", "provider-rate-limited", "provider-request-rejected", "authentication-failed", "provider-unavailable", "malformed-response"] as const) {
    assert.equal(MODEL_DISPATCH_FACTS[code], "provider-responded", `T7: ${code}`);
    assert.equal(dispatchStateForFailure(code), "dispatch-failed", `T7: ${code}`);
  }
  assert.equal((await failure(responding(200, unreadable).fetchImpl)).code, "malformed-response", "T7: a 2xx with no readable body");

  /* T8 */
  for (const code of ["invalid-configuration", "rate-limited"] as const) {
    assert.notEqual(dispatchStateForFailure(code), "not-dispatched", `T8: ${code} proves nothing`);
  }
  assert.ok(!readFileSync("src/features/heby-model-live/claude-http-transport.server.ts", "utf8").match(/"invalid-configuration"|"rate-limited"/), "T8: the transport no longer raises either");

  /* T9 */
  const union = readFileSync("src/features/heby-model/model-error.ts", "utf8").split("export type ModelConnectivityErrorCode =")[1]!.split("const RETRYABLE")[0]!;
  const codes = [...union.matchAll(/\|\s+"([a-z-]+)"/g)].map((m) => m[1]! as ModelConnectivityErrorCode);
  assert.ok(codes.length >= 18, "T9: the union was read");
  assert.deepEqual([...codes].sort(), Object.keys(MODEL_DISPATCH_FACTS).sort(), "T9: every code has one fact");

  /* T10 */
  {
    const error = await failure(responding(400, errorBody("invalid_request_error")).fetchImpl);
    assert.ok(!`${error.message} ${JSON.stringify(error)} ${modelFailureLogLine(error.code)}`.includes("CANARY"), "T10: provider text stays out");
  }

  /* T11 */
  const said = (code: string) => modelFallbackSentence({ kind: "provider-failed", code, dispatch: MODEL_DISPATCH_FACTS[code as ModelConnectivityErrorCode] } as never);
  assert.match(said("provider-billing"), /billing error/);
  assert.match(said("provider-rate-limited"), /limited this request/);
  assert.match(said("provider-request-rejected"), /rejected this request/);
  assert.match(said("malformed-response"), /responded, but the response could not be read/);
  assert.match(said("output-bound-exceeded"), /before sending it .*model was not asked/);
  assert.match(said("transport-call-limit"), /before sending it .*model was not asked/);
  for (const code of ["provider-unreachable", "timeout", "rate-limited", "invalid-configuration", "unknown-provider-error"]) {
    assert.match(said(code), /Whether the provider received it is not known/, `T11: ${code}`);
  }
  for (const code of ["provider-billing", "provider-rate-limited", "provider-request-rejected", "malformed-response", "provider-unavailable"]) {
    assert.ok(!/not asked|not known|complete/i.test(said(code)), `T11: ${code} claims neither absence nor completion`);
  }

  assert.match(modelFallbackSentence({ kind: "provider-failed", code: "output-bound-exceeded" } as never), /Whether the provider received it is not known/, "T11: a record without the fact claims nothing");

  assert.match(readFileSync("src/features/heby-answer/model-answer.server.ts", "utf8"), /kind: "provider-failed", code, dispatch: MODEL_DISPATCH_FACTS\[code\]/, "T11: the server states the fact");

  /* T12 */
  assert.ok(!readFileSync("src/features/heby-model-live/claude-http-transport.server.ts", "utf8").includes("console."), "T12: the transport stays silent");
  assert.deepEqual(JSON.parse(modelFailureLogLine("provider-billing")), { event: "model-request-failed", code: "provider-billing", dispatch: "provider-responded" });

  console.log("ai-failure-truth-1/failure-truth: T1–T12 ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
