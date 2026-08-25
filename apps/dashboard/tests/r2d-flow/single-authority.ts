/*
 * H1D — single operational authority (R2E), with the retired live-call env gate.
 *
 * Uses the REAL live transport but with an INJECTED counting fetch, so the full path to the live
 * dispatch seam is exercised with NO network. The invariant: R2E Director OFF blocks ALL provider
 * dispatch regardless of transport mode; ON permits it only when config + credential are valid.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest, type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "../../src/features/heby-model";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/*
 * R2G — these proofs are about the TRANSPORT, so each construction is given its OWN isolated
 * spend budget. Without one they would silently draw on the shared per-process budget, and this
 * suite would start passing or failing for a reason that has nothing to do with what it tests.
 * The shared budget has its own suite.
 */
const isolatedBudget = () => createLiveSpendBudget(99);

function tenant(): TenantContext {
  return { tenantId: "acme", userId: "acme-user" } as unknown as TenantContext;
}

const LIVE_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
  HEBUN_MODEL_TRANSPORT: "live",
} as const;

/** A counting fetch that returns a valid-shaped Anthropic body — NO real network. */
function countingFetch(): { fetchImpl: FetchLike; calls: () => number } {
  let n = 0;
  const fetchImpl: FetchLike = async () => {
    n += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_x", model: "claude-test", content: [{ type: "text", text: "live-shaped answer" }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 3 } }),
    };
  };
  return { fetchImpl, calls: () => n };
}

function deps(directorEnabled: boolean, fetchImpl: FetchLike, env: Record<string, string> = LIVE_ENV): HebyModelAnswerDeps {
  const liveTransport = createLiveClaudeTransport({ apiKey: "sk-fake", spendBudget: isolatedBudget(), fetchImpl });
  return {
    resolveTenant: async () => tenant(),
    readOverview: () => undefined,
    env,
    resolveDirectorEnabled: async () => directorEnabled,
    // Real live transport (with an injected fetch) — provenance "live".
    selectTransport: () => ({ transport: liveTransport, transportProvenance: "live" }),
    generate: generateHebyModelAnswer,
    getConversationRepo: () => null,
    newCorrelationId: () => "corr",
  };
}

const input = { prompt: "What is the operational health?", route: "/operations" };

async function main(): Promise<void> {
  // CASE A — Director OFF + transport mode live + credential + config valid → ZERO dispatch.
  {
    const f = countingFetch();
    const result = await answerHebyModelRequest(input, deps(false, f.fetchImpl));
    assert.equal(f.calls(), 0, "R2E OFF: zero provider dispatch even with the live transport configured");
    assert.ok(result.status === "answered" && result.outcome.response.origin !== "model", "OFF → deterministic");
  }

  // CASE B — Director ON + credential MISSING → ZERO dispatch (availability closes it).
  {
    const f = countingFetch();
    const { HEBUN_MODEL_CREDENTIAL: _omit, ...noCred } = LIVE_ENV;
    const result = await answerHebyModelRequest(input, deps(true, f.fetchImpl, noCred));
    assert.equal(f.calls(), 0, "ON + no credential: zero dispatch");
    assert.ok(result.status === "answered" && result.outcome.response.origin !== "model");
  }

  // CASE C — Director ON + config + credential + live mode → the request REACHES the live seam
  //          (fetch called once, via the injected fetch — NO real Anthropic call).
  {
    const f = countingFetch();
    const result = await answerHebyModelRequest(input, deps(true, f.fetchImpl));
    assert.equal(f.calls(), 1, "ON + valid: request reaches the live transport seam exactly once (no network)");
    assert.equal(result.status === "answered" ? result.outcome.response.origin : "", "model");
    assert.equal(result.status === "answered" ? result.transportProvenance : "", "live");
  }

  console.log("r2d single-authority checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
