/*
 * R2G — the two proven pre-production gaps, closed and pinned. No network, no key, no spend.
 *
 * K-1  the configured output default must be a value the LIVE transport accepts, and an
 *      out-of-range override must fail BEFORE any provider contact.
 * K-2  the live-call budget must survive the construction of a new transport, because that is
 *      exactly how the released per-instance counter was defeated.
 *
 * Everything here uses injected fetch and injected budgets. Nothing reaches a provider.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  MODEL_OUTPUT_TOKEN_CEILING,
  MODEL_CONNECTIVITY_ENV_KEYS,
  resolveModelConnectivityConfig,
  evaluateModelAvailability,
  generateHebyModelAnswer,
  ModelConnectivityError,
  type ClaudeTransport,
  type ClaudeTransportRequest,
} from "../../src/features/heby-model";
import {
  createLiveClaudeTransport,
  MAX_LIVE_OUTPUT_TOKENS,
  type FetchLike,
} from "../../src/features/heby-model-live/claude-http-transport.server";
import {
  createLiveSpendBudget,
  getProcessLiveSpendBudget,
  resolveLiveCallBudget,
  DEFAULT_LIVE_CALL_BUDGET,
  MAX_CONFIGURABLE_LIVE_CALL_BUDGET,
  LIVE_CALL_BUDGET_ENV_KEY,
} from "../../src/features/heby-model-live/live-spend-budget.server";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime";

const OK_BODY = {
  id: "msg_r2g",
  model: "configured-model",
  content: [{ type: "text", text: "ok" }],
  stop_reason: "end_turn",
  usage: { input_tokens: 3, output_tokens: 2 },
};

/** A fetch that counts how many times the network was actually reached. */
function countingFetch(): { fetchImpl: FetchLike; count: () => number } {
  let n = 0;
  return {
    count: () => n,
    fetchImpl: async () => {
      n += 1;
      return { ok: true, status: 200, json: async () => OK_BODY };
    },
  };
}

const REQ: ClaudeTransportRequest = {
  model: "configured-model",
  system: "You are Heby.",
  messages: [{ role: "user", content: "Ping" }],
  maxTokens: DEFAULT_MAX_OUTPUT_TOKENS,
};

const LIVE_ENV = {
  [MODEL_CONNECTIVITY_ENV_KEYS.enabled]: "true",
  [MODEL_CONNECTIVITY_ENV_KEYS.provider]: "anthropic",
  [MODEL_CONNECTIVITY_ENV_KEYS.modelId]: "configured-model",
  [MODEL_CONNECTIVITY_ENV_KEYS.credential]: "synthetic",
} as const;

async function main(): Promise<void> {
  /* ── K-1 · the default is a value the live transport accepts ───────────────────────────── */
  {
    assert.equal(
      DEFAULT_MAX_OUTPUT_TOKENS,
      MODEL_OUTPUT_TOKEN_CEILING,
      "the configured default IS the one ceiling",
    );
    assert.equal(
      MAX_LIVE_OUTPUT_TOKENS,
      MODEL_OUTPUT_TOKEN_CEILING,
      "the live transport enforces the SAME constant it does not own",
    );
    assert.ok(
      DEFAULT_MAX_OUTPUT_TOKENS <= MAX_LIVE_OUTPUT_TOKENS,
      "THE REGRESSION THAT MATTERS: the default must never exceed what the live path accepts",
    );

    // And end to end: the default config, through the live transport, actually reaches fetch.
    const config = resolveModelConnectivityConfig(LIVE_ENV);
    assert.equal(config.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS, "unset override → the default");
    const s = countingFetch();
    const transport = createLiveClaudeTransport({
      apiKey: "sk-fake",
      fetchImpl: s.fetchImpl,
      spendBudget: createLiveSpendBudget(4),
    });
    await transport.send({ ...REQ, maxTokens: config.maxOutputTokens });
    assert.equal(s.count(), 1, "the DEFAULT bound reaches the provider instead of being refused");
  }

  /* ── K-1 · an out-of-range override fails closed, with no provider contact ─────────────── */
  {
    for (const [label, raw] of [
      ["above the ceiling", String(MODEL_OUTPUT_TOKEN_CEILING + 1)],
      ["absurdly above", "100000"],
      ["garbage", "lots"],
      ["zero", "0"],
      ["negative", "-5"],
    ] as const) {
      const config = resolveModelConnectivityConfig({
        ...LIVE_ENV,
        [MODEL_CONNECTIVITY_ENV_KEYS.maxOutputTokens]: raw,
      });
      assert.equal(config.maxOutputTokens, 0, `${label} → refused, never clamped`);
      assert.equal(
        evaluateModelAvailability(config, { transportPresent: true }),
        "MISCONFIGURED",
        `${label} → MISCONFIGURED at the availability gate, BEFORE any provider contact`,
      );
    }
    // A valid in-range override is honoured.
    const ok = resolveModelConnectivityConfig({
      ...LIVE_ENV,
      [MODEL_CONNECTIVITY_ENV_KEYS.maxOutputTokens]: "120",
    });
    assert.equal(ok.maxOutputTokens, 120, "a valid in-range override is honoured");
    assert.equal(evaluateModelAvailability(ok, { transportPresent: true }), "AVAILABLE");
  }

  /* ── K-1 · a caller cannot raise the bound above the configured one ───────────────────── */
  {
    let seen = -1;
    const spy: ClaudeTransport = {
      async send(request) {
        seen = request.maxTokens;
        return { model: request.model, content: [{ type: "text", text: "ok" }], usage: {} };
      },
    };
    const request = {
      correlationId: "c",
      tenantId: "t",
      systemInstructions: "s",
      userPrompt: "p",
      evidence: [],
      modelId: "",
      // A caller asking for far more than the deployment permits.
      maxOutputTokens: 100_000,
      history: [],
    } as unknown as ModelGenerationRequest;
    await generateHebyModelAnswer(request, { env: LIVE_ENV, transport: spy });
    assert.equal(
      seen,
      DEFAULT_MAX_OUTPUT_TOKENS,
      "a caller-supplied bound is CLAMPED to the configured one, never honoured above it",
    );
    assert.ok(seen <= MAX_LIVE_OUTPUT_TOKENS, "the clamped value is inside the live ceiling");
  }

  /* ── K-2 · the budget survives a NEW transport instance ───────────────────────────────── */
  {
    const s = countingFetch();
    const shared = createLiveSpendBudget(2);
    // Each iteration builds a FRESH transport — the exact move that defeated the old counter.
    const results: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const transport = createLiveClaudeTransport({
        apiKey: "sk-fake",
        fetchImpl: s.fetchImpl,
        spendBudget: shared,
      });
      try {
        await transport.send(REQ);
        results.push("sent");
      } catch (error) {
        assert.ok(error instanceof ModelConnectivityError, "a typed error, never a raw throw");
        results.push((error as ModelConnectivityError).code);
      }
    }
    assert.deepEqual(results, ["sent", "sent", "rate-limited"], "N allowed, N+1 refused");
    assert.equal(s.count(), 2, "THE POINT: the refused call never reached fetch");
    assert.equal(shared.spent(), 2, "an exhausted budget does not keep counting");
  }

  /* ── K-2 · a refusal costs nothing, and a pre-network refusal spends nothing ──────────── */
  {
    const s = countingFetch();
    const budget = createLiveSpendBudget(3);
    const transport = createLiveClaudeTransport({
      apiKey: "sk-fake",
      fetchImpl: s.fetchImpl,
      spendBudget: budget,
    });
    await assert.rejects(
      () => transport.send({ ...REQ, maxTokens: MAX_LIVE_OUTPUT_TOKENS + 1 }),
      (e: unknown) =>
        e instanceof ModelConnectivityError && e.code === "invalid-configuration",
    );
    assert.equal(s.count(), 0, "an over-bound request never reaches fetch");
    assert.equal(
      budget.spent(),
      0,
      "AND it does not spend a unit: a request that never went out did not cost anything",
    );
  }

  /* ── K-2 · no retry, and no credential in any refusal ─────────────────────────────────── */
  {
    let attempts = 0;
    const failing: FetchLike = async () => {
      attempts += 1;
      return { ok: false, status: 500, json: async () => ({ error: "sk-should-never-appear" }) };
    };
    const transport = createLiveClaudeTransport({
      apiKey: "sk-secret-value",
      fetchImpl: failing,
      spendBudget: createLiveSpendBudget(5),
    });
    const error = await transport.send(REQ).then(() => null, (e: unknown) => e);
    assert.equal(attempts, 1, "exactly one attempt — no retry amplification");
    assert.ok(error instanceof ModelConnectivityError);
    const text = `${(error as Error).message} ${(error as Error).stack ?? ""}`;
    assert.ok(!text.includes("sk-secret-value"), "the API key never appears in the error");
    assert.ok(!text.includes("sk-should-never-appear"), "the provider body never appears either");
  }

  /* ── K-2 · budget configuration is finite and fails closed ────────────────────────────── */
  {
    assert.equal(resolveLiveCallBudget({}), DEFAULT_LIVE_CALL_BUDGET, "absent → the safe default");
    assert.equal(resolveLiveCallBudget({ [LIVE_CALL_BUDGET_ENV_KEY]: "3" }), 3, "valid → honoured");
    for (const [label, raw] of [
      ["zero", "0"],
      ["negative", "-1"],
      ["garbage", "many"],
      ["unlimited", "unlimited"],
      ["above the configurable maximum", String(MAX_CONFIGURABLE_LIVE_CALL_BUDGET + 1)],
      ["a typo", "100000"],
    ] as const) {
      assert.equal(
        resolveLiveCallBudget({ [LIVE_CALL_BUDGET_ENV_KEY]: raw }),
        0,
        `${label} → 0, which refuses every live call`,
      );
    }
    // A zero budget refuses immediately, and never reaches fetch.
    const s = countingFetch();
    const transport = createLiveClaudeTransport({
      apiKey: "sk-fake",
      fetchImpl: s.fetchImpl,
      spendBudget: createLiveSpendBudget(0),
    });
    await assert.rejects(
      () => transport.send(REQ),
      (e: unknown) => e instanceof ModelConnectivityError && e.code === "rate-limited",
    );
    assert.equal(s.count(), 0, "a zero budget contacts nothing");
  }

  /* ── The dev/proof transport does not draw on the LIVE budget ─────────────────────────── */
  {
    const { createDevProofTransport } = await import(
      "../../src/features/heby-model/dev-proof-transport.server"
    );
    const shared = createLiveSpendBudget(1);
    const fake = createDevProofTransport();
    for (let i = 0; i < 5; i += 1) await fake.send(REQ);
    assert.equal(
      shared.spent(),
      0,
      "the simulation cannot consume a live allowance — it is not wired to one at all",
    );
    // Structural, not incidental: the fake transport module names no budget.
    const { readFileSync } = await import("node:fs");
    const fakeSrc = readFileSync("src/features/heby-model/dev-proof-transport.server.ts", "utf8");
    assert.ok(
      !fakeSrc.includes("SpendBudget") && !fakeSrc.includes("spendBudget"),
      "the fake transport has no spend seam to accidentally share",
    );
  }

  /* ── K-2 · THE PRODUCTION DEFAULT PATH: the process budget is ONE object ──────────────────
   *
   * Every proof above injects a budget, which is right for testing the transport and WRONG as
   * the only coverage: it leaves the memoisation — the actual K-2 fix — unproven. Removing the
   * `if (!processBudget)` guard would hand every transport a fresh allowance and resurrect the
   * exact defect, and nothing above would notice.
   *
   * This block is last on purpose: it CONSUMES this process's real budget.
   */
  {
    assert.equal(
      getProcessLiveSpendBudget(),
      getProcessLiveSpendBudget(),
      "the process budget is memoised — the same object, not a fresh allowance per call",
    );

    // End to end through the PRODUCTION default: no `spendBudget` is injected anywhere here.
    const s = countingFetch();
    const limit = DEFAULT_LIVE_CALL_BUDGET;
    const outcomes: string[] = [];
    for (let i = 0; i < limit + 1; i += 1) {
      // A FRESH transport every iteration, each allowed exactly one call by its instance cap,
      // so any refusal below can only have come from the shared budget.
      const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl: s.fetchImpl });
      try {
        await transport.send(REQ);
        outcomes.push("sent");
      } catch (error) {
        assert.ok(error instanceof ModelConnectivityError);
        assert.match(
          (error as Error).message,
          /budget for this process is exhausted/,
          "the refusal is the PROCESS budget, not the per-instance cap",
        );
        outcomes.push("refused");
      }
    }
    assert.deepEqual(
      outcomes,
      [...Array<string>(limit).fill("sent"), "refused"],
      `${limit} shared units across ${limit + 1} DIFFERENT transports, then refusal`,
    );
    assert.equal(s.count(), limit, "a new transport buys no new allowance");
  }

  console.log("r2g bounds and spend checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
