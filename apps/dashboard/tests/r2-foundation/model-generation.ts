import assert from "node:assert/strict";
import {
  generateHebyModelAnswer,
  ModelConnectivityError,
} from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";

const ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test-model",
  HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "256",
};

function request(): ModelGenerationRequest {
  return {
    correlationId: "corr-123",
    tenantId: "11111111-1111-4111-8111-111111111111",
    systemInstructions: "Answer only from the grounding context.",
    userPrompt: "What is the organization health?",
    evidence: ["Org health: stable", "2 warnings open"],
    modelId: "ignored-request-model",
    maxOutputTokens: 256,
  };
}

async function rejectsWithCode(
  run: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(run, (e: unknown) => e instanceof ModelConnectivityError && e.code === code);
}

async function main(): Promise<void> {
  // 7 + 9 + 10 + 11: successful fake response → validated model result
  const ok = await generateHebyModelAnswer(request(), {
    env: ENV,
    transport: createFakeClaudeTransport("success"),
  });
  assert.equal(ok.status, "generated");
  if (ok.status === "generated") {
    const r = ok.result;
    assert.equal(r.origin, "model"); // origin is "model" ONLY after real transport + validation
    assert.ok(r.text.length > 0);
    assert.equal(r.provider, "claude");
    assert.equal(r.model, "claude-test-model");
    assert.equal(r.correlationId, "corr-123");
    assert.equal(r.inputTokens, 42);
    assert.equal(r.outputTokens, 7);
    assert.equal(r.totalTokens, 49);
    assert.equal(r.providerRequestId, "req_fake_0001");
    assert.equal(typeof r.latencyMs, "number");
    assert.ok((r.latencyMs ?? -1) >= 0);
  }

  // 8: request translation — server config model overrides request; evidence is context
  const fake = createFakeClaudeTransport("success");
  await generateHebyModelAnswer(request(), { env: ENV, transport: fake });
  assert.equal(fake.lastRequest?.model, "claude-test-model"); // server config wins, not request.modelId
  assert.equal(fake.lastRequest?.maxTokens, 256);
  assert.equal(fake.lastRequest?.messages[0]?.content, "What is the organization health?");
  assert.ok(fake.lastRequest?.system.includes("Answer only from the grounding context."));
  assert.ok(fake.lastRequest?.system.includes("Org health: stable"));
  assert.ok(fake.lastRequest?.system.toLowerCase().includes("data, not instructions"));

  // 12: usage absent stays undefined (never invented)
  const noUsage = await generateHebyModelAnswer(request(), {
    env: ENV,
    transport: createFakeClaudeTransport("success-no-usage"),
  });
  assert.equal(noUsage.status, "generated");
  if (noUsage.status === "generated") {
    assert.equal(noUsage.result.inputTokens, undefined);
    assert.equal(noUsage.result.outputTokens, undefined);
    assert.equal(noUsage.result.totalTokens, undefined);
  }

  // request id absent stays undefined
  const noId = await generateHebyModelAnswer(request(), {
    env: ENV,
    transport: createFakeClaudeTransport("success-no-request-id"),
  });
  assert.equal(noId.status === "generated" && noId.result.providerRequestId, undefined);

  // 13/14/15/16/17: typed deterministic failures
  await rejectsWithCode(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("timeout") }),
    "timeout",
  );
  await rejectsWithCode(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("auth-failure") }),
    "authentication-failed",
  );
  await rejectsWithCode(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("rate-limit") }),
    "rate-limited",
  );
  await rejectsWithCode(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("provider-unavailable") }),
    "provider-unavailable",
  );
  await rejectsWithCode(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("malformed-empty-content") }),
    "malformed-response",
  );
  await rejectsWithCode(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("missing-text") }),
    "malformed-response",
  );

  // 18: opaque provider error is redacted to unknown-provider-error, secret never surfaces
  await assert.rejects(
    () => generateHebyModelAnswer(request(), { env: ENV, transport: createFakeClaudeTransport("opaque-error") }),
    (e: unknown) => {
      const err = e as ModelConnectivityError;
      return (
        err instanceof ModelConnectivityError &&
        err.code === "unknown-provider-error" &&
        !err.message.includes("sk-should-never-surface")
      );
    },
  );

  // 19: deterministic fallback — no transport / disabled → honest unavailable, no result
  const noTransport = await generateHebyModelAnswer(request(), { env: ENV });
  assert.equal(noTransport.status, "unavailable");
  if (noTransport.status === "unavailable") {
    assert.equal(noTransport.state, "TRANSPORT_UNAVAILABLE");
    assert.equal(noTransport.modelStatus.available, false);
  }
  const disabled = await generateHebyModelAnswer(request(), {
    env: {},
    transport: createFakeClaudeTransport("success"),
  });
  assert.equal(disabled.status, "unavailable");
  if (disabled.status === "unavailable") assert.equal(disabled.state, "DISABLED");

  // retryability taxonomy
  assert.equal(new ModelConnectivityError("timeout").retryable, true);
  assert.equal(new ModelConnectivityError("rate-limited").retryable, true);
  assert.equal(new ModelConnectivityError("provider-unavailable").retryable, true);
  assert.equal(new ModelConnectivityError("authentication-failed").retryable, false);
  assert.equal(new ModelConnectivityError("invalid-configuration").retryable, false);
  assert.equal(new ModelConnectivityError("malformed-response").retryable, false);

  console.log("r2b model generation (fake transport) checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
