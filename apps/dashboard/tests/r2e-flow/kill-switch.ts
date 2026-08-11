/*
 * R2E — the Director kill-switch (fail-closed, no DB, no network).
 *
 * Proves that the durable Director permission gates the product model-answer flow BEFORE any
 * transport is selected or dispatched. Director OFF → zero transport selection, zero generation,
 * zero send — an honest deterministic answer. Director ON → the existing R2 gates still apply
 * (credential, transport, availability), and only an all-satisfied fake path actually sends.
 *
 * The Director permission is INJECTED here (no DB); the durable fail-closed default is proven in
 * the durability test. No provider, no key, no network.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ModelTransportSelection } from "../../src/features/heby-model";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "11111111-1111-1111-1111-111111111111", userId: "22222222-2222-2222-2222-222222222222" } as unknown as TenantContext;

const FAKE_SATISFIED_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;

const baseDeps = () => ({
  resolveTenant: async () => TENANT,
  readOverview: () => undefined,
  getConversationRepo: () => null,
  generate: generateHebyModelAnswer,
});

async function main(): Promise<void> {
  // 1. Director OFF → no transport is selected, no generation runs, no send. Deterministic answer.
  {
    let selectCalls = 0;
    let generateCalls = 0;
    const fake = createFakeClaudeTransport("success");
    const result = await answerHebyModelRequest(
      { prompt: "What is the health?", route: "/platform" },
      {
        ...baseDeps(),
        env: FAKE_SATISFIED_ENV,
        resolveDirectorEnabled: async () => false,
        selectTransport: (): ModelTransportSelection => {
          selectCalls += 1;
          return { transport: fake, transportProvenance: "fake" };
        },
        generate: async (...args) => {
          generateCalls += 1;
          return generateHebyModelAnswer(...args);
        },
      },
    );
    assert.equal(result.status, "answered");
    assert.equal(selectCalls, 0, "OFF: no transport selection");
    assert.equal(generateCalls, 0, "OFF: no generation attempt");
    assert.equal(fake.calls, 0, "OFF: zero provider send");
    if (result.status === "answered") {
      assert.notEqual(result.outcome.response.origin, "model", "OFF: never a model-origin answer");
      assert.ok(
        result.outcome.response.limitations.some((l) => /disabled by the Director/i.test(l)),
        "OFF: honest disabled note present",
      );
      assert.equal(result.transportProvenance, undefined, "OFF: no transport provenance");
    }
  }

  // 2. Director ON + all fake gates satisfied → exactly one send, a validated model answer.
  {
    const fake = createFakeClaudeTransport("success");
    const result = await answerHebyModelRequest(
      { prompt: "What is the health?", route: "/platform" },
      {
        ...baseDeps(),
        env: FAKE_SATISFIED_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: (): ModelTransportSelection => ({ transport: fake, transportProvenance: "fake" }),
      },
    );
    assert.equal(result.status, "answered");
    assert.equal(fake.calls, 1, "ON+satisfied: exactly one send");
    if (result.status === "answered") {
      assert.equal(result.outcome.response.origin, "model", "ON+satisfied: model-origin answer");
      assert.equal(result.transportProvenance, "fake");
    }
  }

  // 3. Director ON + credential missing → availability closes it; zero send, deterministic.
  {
    const fake = createFakeClaudeTransport("success");
    const noCredEnv = {
      HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
      HEBUN_MODEL_PROVIDER: "claude",
      HEBUN_MODEL_ID: "claude-test",
      HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
    };
    const result = await answerHebyModelRequest(
      { prompt: "What is the health?", route: "/platform" },
      {
        ...baseDeps(),
        env: noCredEnv,
        resolveDirectorEnabled: async () => true,
        selectTransport: (): ModelTransportSelection => ({ transport: fake, transportProvenance: "fake" }),
      },
    );
    assert.equal(fake.calls, 0, "ON+no-credential: zero send");
    if (result.status === "answered") {
      assert.notEqual(result.outcome.response.origin, "model");
    }
  }

  // 4. Director ON + transport unavailable → no transport, zero send, deterministic.
  {
    const result = await answerHebyModelRequest(
      { prompt: "What is the health?", route: "/platform" },
      {
        ...baseDeps(),
        env: FAKE_SATISFIED_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: (): ModelTransportSelection => ({}),
      },
    );
    if (result.status === "answered") {
      assert.notEqual(result.outcome.response.origin, "model", "ON+no-transport: deterministic");
    }
  }

  console.log("r2e kill-switch checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
