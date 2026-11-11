/*
 * P5 BYOK slice 2 — the Heby conversation path uses the tenant-aware selector, refuses without a
 * model call when the tenant's key cannot carry the turn, and records whose credential carried a
 * live call. In-memory repository, simulated fetch, no network.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest, type HebyModelAnswerDeps } from "../../src/features/heby-answer/model-answer.server";
import { createLiveClaudeTransport } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createInMemoryConversationRepo } from "../helpers/in-memory-conversation-repo";
import type { PersistExchangeInput } from "../../src/features/heby-conversation/durable-conversation-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { HebyModelOutcome } from "../../src/features/heby-model";

const TENANT = { tenantId: "acme", userId: "acme-user" } as unknown as TenantContext;
const ENV = {
  HEBUN_MODEL_TRANSPORT: "live",
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;
const INTEGRATION = "11111111-1111-4111-8111-111111111111";

function harness(selection: Awaited<ReturnType<NonNullable<HebyModelAnswerDeps["selectTenantTransport"]>>>) {
  const repo = createInMemoryConversationRepo();
  const persisted: PersistExchangeInput[] = [];
  const persist = repo.persistExchange.bind(repo);
  repo.persistExchange = async (scope, input) => {
    persisted.push(input);
    return persist(scope, input);
  };
  let generated = 0;
  const seenTenants: (TenantContext | null)[] = [];
  const deps: HebyModelAnswerDeps = {
    resolveTenant: async () => TENANT,
    readOverview: () => undefined,
    env: ENV,
    resolveDirectorEnabled: async () => true,
    selectTenantTransport: async (tenant) => {
      seenTenants.push(tenant);
      return selection;
    },
    generate: async (request): Promise<HebyModelOutcome> => {
      generated += 1;
      return {
        status: "generated",
        result: { text: "ok", provider: "claude", model: "claude-test", origin: "model", correlationId: request.correlationId, inputTokens: 2, outputTokens: 1, totalTokens: 3 },
      };
    },
    getConversationRepo: () => repo,
    newCorrelationId: () => "corr",
  };
  return { deps, persisted, generatedCount: () => generated, seenTenants };
}

async function main(): Promise<void> {
  /* ── a refused BYOK turn: no generation, an honest note, no credential recorded ── */
  {
    const h = harness({ byokRefusal: "byok-key-revoked" });
    const r = await answerHebyModelRequest({ prompt: "hi", route: "/operations" }, h.deps);
    assert.equal(r.status, "answered");
    assert.equal(h.generatedCount(), 0, "the generator is never reached");
    assert.deepEqual(h.seenTenants, [TENANT], "selection is made from the session's tenant");
    const response = r.status === "answered" ? r.outcome.response : undefined;
    assert.deepEqual(response?.modelFallback, { kind: "provider-failed", code: "missing-credential", dispatch: "not-sent" });
    assert.ok(response?.limitations?.some((n) => n.includes("not used in its place")), "the note says the platform key was not used");
    const a = h.persisted[0]!.assistant;
    assert.equal(a.transport, undefined);
    assert.equal(a.credentialSource, undefined);
    console.log("PASS refused BYOK turn: deterministic, generator never reached, nothing attributed");
  }

  /* ── a live turn under the tenant key is attributed to that connection ── */
  {
    const transport = createLiveClaudeTransport({
      tenantCredential: { withApiKey: async (run) => run("unused"), integrationId: INTEGRATION, accountRef: `tenant-byok:${INTEGRATION}` },
    });
    const h = harness({ transport, transportProvenance: "live" });
    await answerHebyModelRequest({ prompt: "hi", route: "/operations" }, h.deps);
    assert.equal(h.generatedCount(), 1);
    const a = h.persisted[0]!.assistant;
    assert.equal(a.transport, "live");
    assert.equal(a.credentialSource, "tenant");
    assert.equal(a.credentialIntegrationId, INTEGRATION);
    console.log("PASS tenant-key turn: recorded as tenant + its connection");
  }

  /* ── a live turn under the platform key is attributed to the platform ── */
  {
    const h = harness({ transport: createLiveClaudeTransport({ apiKey: "sk-platform-fake" }), transportProvenance: "live" });
    await answerHebyModelRequest({ prompt: "hi", route: "/operations" }, h.deps);
    const a = h.persisted[0]!.assistant;
    assert.equal(a.credentialSource, "platform");
    assert.equal(a.credentialIntegrationId, undefined);
    console.log("PASS platform-key turn: recorded as platform, no connection");
  }

  /* ── an injected env-only selector (every released test) keeps its released behaviour ── */
  {
    const h = harness({ byokRefusal: "byok-unavailable" });
    let envOnly = 0;
    await answerHebyModelRequest(
      { prompt: "hi", route: "/operations" },
      { ...h.deps, selectTransport: () => ((envOnly += 1), { transport: createLiveClaudeTransport({ apiKey: "sk-platform-fake" }), transportProvenance: "live" }) },
    );
    assert.equal(envOnly, 1);
    assert.equal(h.seenTenants.length, 0, "the tenant selector is not consulted when a selector is injected");
    console.log("PASS injected selector: unchanged");
  }
  console.log("\nP5 BYOK answer wiring: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
