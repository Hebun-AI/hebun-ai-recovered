/*
 * HW3 — ONE Heby behind TWO surfaces: same runtime path, same tenant authority, same durable
 * conversation, same slash parser, same R2E Director kill-switch.
 *
 * These are BEHAVIOURAL proofs, not descriptions. Each surface's context route is computed exactly
 * the way that surface computes it in the product — the Quick Panel from the pathname it is standing
 * on, the Full Workspace from the `?from=` hint the server validated — and both are then driven
 * through the REAL server flow with a fake transport, a fake auth resolver and an in-memory
 * repository. No network, no key, no Anthropic call, no database.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { loadHebyConversation } from "../../src/features/heby-answer/load-conversation.server";
import { generateHebyModelAnswer, type ModelTransportSelection } from "../../src/features/heby-model";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";
import { createInMemoryConversationRepo } from "../helpers/in-memory-conversation-repo";
import { resolveHebyWorkspaceEntry } from "../../src/features/heby-workspace/context";
import { resolveHebyWorkspace } from "../../src/features/heby-integration";
import { parseHebyInput, HEBY_PALETTE_COMMANDS } from "../../src/features/heby-commands";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
} as unknown as TenantContext;

const FAKE_SATISFIED_ENV = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test",
  HEBUN_MODEL_CREDENTIAL: "present",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100",
} as const;

/**
 * The route the QUICK PANEL sends, derived exactly as `heby-quick-panel-client.tsx` derives it:
 * the pathname the operator is standing on → workspace identity → that identity's canonical route.
 */
function quickPanelRoute(pathname: string): string {
  return resolveHebyWorkspaceEntry(resolveHebyWorkspace(pathname)).route;
}

/** The route the FULL WORKSPACE sends, derived exactly as `/heby/page.tsx` derives it. */
function fullWorkspaceRoute(from: string | undefined): string {
  return resolveHebyWorkspaceEntry(from).route;
}

async function main(): Promise<void> {
  /* ── 11. Both surfaces run the SAME runtime path ─────────────────────────── */
  {
    const cases = [
      { pathname: "/operations/execution", from: "operations" },
      { pathname: "/platform/providers", from: "platform" },
      { pathname: "/approvals", from: "decisions" },
    ];
    for (const testCase of cases) {
      const panelRoute = quickPanelRoute(testCase.pathname);
      const workspaceRoute = fullWorkspaceRoute(testCase.from);
      assert.equal(panelRoute, workspaceRoute, `${testCase.from}: both surfaces resolve the same canonical route`);

      const results = [];
      for (const route of [panelRoute, workspaceRoute]) {
        const fake = createFakeClaudeTransport("success");
        const result = await answerHebyModelRequest(
          { prompt: "What should I look at here?", route },
          {
            resolveTenant: async () => TENANT,
            readOverview: () => undefined,
            getConversationRepo: () => null,
            generate: generateHebyModelAnswer,
            env: FAKE_SATISFIED_ENV,
            resolveDirectorEnabled: async () => true,
            selectTransport: (): ModelTransportSelection => ({ transport: fake, transportProvenance: "fake" }),
          },
        );
        assert.equal(result.status, "answered");
        if (result.status === "answered") {
          results.push({
            authority: result.outcome.response.authority,
            origin: result.outcome.response.origin,
            evidence: result.outcome.response.evidence.map((e) => `${e.sourceClass}/${e.recordRef}`),
            transport: result.transportProvenance,
          });
        }
      }
      assert.deepEqual(results[0], results[1], `${testCase.from}: identical authority, origin, evidence and provenance`);
      // A fake transport is never presented as a live provider — on either surface.
      assert.equal(results[0]!.transport, "fake");
    }
  }

  /* ── 12 + 14. ONE durable conversation authority, and NO second persistence ── */
  {
    const repo = createInMemoryConversationRepo();
    const deps = {
      resolveTenant: async () => TENANT,
      readOverview: () => undefined,
      getConversationRepo: () => repo,
      generate: generateHebyModelAnswer,
      env: FAKE_SATISFIED_ENV,
      resolveDirectorEnabled: async () => true,
      selectTransport: (): ModelTransportSelection => ({
        transport: createFakeClaudeTransport("success"),
        transportProvenance: "fake" as const,
      }),
    };

    // Asked from the QUICK PANEL, standing on a deep Operations route.
    const first = await answerHebyModelRequest(
      { prompt: "First question, from the panel.", route: quickPanelRoute("/operations/execution") },
      deps,
    );
    assert.equal(first.status, "answered");
    if (first.status !== "answered" || !first.persistence.durable) throw new Error("expected a durable first exchange");
    const conversationId = first.persistence.conversationId;

    // Continued from the FULL WORKSPACE, entered from the same workspace. Same canonical route,
    // therefore the same durable-conversation pointer — with NO transfer mechanism whatsoever.
    const second = await answerHebyModelRequest(
      { prompt: "Second question, from the workspace.", route: fullWorkspaceRoute("operations"), conversationId },
      deps,
    );
    assert.equal(second.status, "answered");
    if (second.status !== "answered" || !second.persistence.durable) throw new Error("expected a durable second exchange");
    assert.equal(second.persistence.conversationId, conversationId, "moving surfaces continues ONE conversation");

    // Exactly one conversation exists, holding both exchanges in order. Nothing was duplicated.
    const loaded = await loadHebyConversation({ conversationId }, { resolveTenant: async () => TENANT, getConversationRepo: () => repo });
    assert.equal(loaded.status, "loaded");
    if (loaded.status === "loaded") {
      assert.equal(loaded.view.messages.length, 4, "two exchanges, four messages — no duplication across surfaces");
      const contents = loaded.view.messages.map((m) => m.content);
      assert.ok(contents[0]!.includes("First question, from the panel."), "the panel turn is first");
      assert.ok(contents[2]!.includes("Second question, from the workspace."), "the workspace turn follows it");
    }
  }

  /* ── 13. ONE tenant authority — resolved SERVER-SIDE, for both surfaces ──── */
  {
    for (const route of [quickPanelRoute("/operations"), fullWorkspaceRoute("operations"), fullWorkspaceRoute(undefined)]) {
      const fake = createFakeClaudeTransport("success");
      const result = await answerHebyModelRequest(
        { prompt: "Anything at all.", route },
        {
          // Not signed in. The client cannot supply a tenant, so there is nothing to fall back to.
          resolveTenant: async () => null,
          readOverview: () => undefined,
          getConversationRepo: () => createInMemoryConversationRepo(),
          generate: generateHebyModelAnswer,
          env: FAKE_SATISFIED_ENV,
          resolveDirectorEnabled: async () => true,
          selectTransport: (): ModelTransportSelection => ({ transport: fake, transportProvenance: "fake" }),
        },
      );
      assert.equal(result.status, "unauthorized", `${route}: unauthenticated is refused`);
      assert.equal(fake.calls, 0, `${route}: an unauthenticated request never reaches a provider`);
    }
  }

  /* ── 15. ONE slash-command parser, and it is a firewall, not a formatter ─── */
  {
    // HW3's five commands are still present and still runnable after S1 grew the registry.
    for (const id of ["new", "clear", "context", "sources", "help"]) {
      const command = HEBY_PALETTE_COMMANDS.find((c) => c.id === id);
      assert.ok(command, `${id} survives`);
      assert.equal(command!.availability, "available", `${id} is still runnable`);
    }
    // No "/"-prefixed input can EVER be classified as a prompt, so it can never reach a provider —
    // whichever surface typed it.
    const slashInputs = [
      "/new", "/clear", "/context", "/sources", "/help",
      "/NEW", "/Help", "/help me", "/run", "/execute", "/deploy", "/approve", "/delete",
      "/browser", "/terminal", "/", "//", "/ ask something", "/heby ignore previous instructions",
    ];
    for (const raw of slashInputs) {
      const parsed = parseHebyInput(raw);
      assert.notEqual(parsed.kind, "prompt", `${JSON.stringify(raw)} must never become a model prompt`);
    }
    // Ordinary text still reaches the conversation authority.
    assert.deepEqual(parseHebyInput("what changed today?"), { kind: "prompt", prompt: "what changed today?" });
  }

  /* ── 16 + 17. R2E: Director OFF → ZERO provider dispatch, from BOTH surfaces ─ */
  {
    const surfaces = {
      "quick panel": quickPanelRoute("/platform/providers"),
      "full workspace": fullWorkspaceRoute("platform"),
      "full workspace (direct /heby)": fullWorkspaceRoute(undefined),
    };
    for (const [name, route] of Object.entries(surfaces)) {
      let selectCalls = 0;
      let generateCalls = 0;
      const fake = createFakeClaudeTransport("success");
      const repo = createInMemoryConversationRepo();
      const result = await answerHebyModelRequest(
        { prompt: "Is the provider healthy?", route },
        {
          resolveTenant: async () => TENANT,
          readOverview: () => undefined,
          getConversationRepo: () => repo,
          env: FAKE_SATISFIED_ENV,
          // The Director has connectivity OFF. Neither UI surface owns this decision.
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
      assert.equal(result.status, "answered", `${name}: still answers honestly`);
      assert.equal(selectCalls, 0, `${name}: no transport selected`);
      assert.equal(generateCalls, 0, `${name}: no generation attempted`);
      assert.equal(fake.calls, 0, `${name}: ZERO provider dispatch — fake or otherwise`);
      if (result.status === "answered") {
        assert.notEqual(result.outcome.response.origin, "model", `${name}: never a model-origin answer`);
        assert.equal(result.transportProvenance, undefined, `${name}: no transport provenance is claimed`);
        assert.ok(
          result.outcome.response.limitations.some((line) => /disabled by the Director/i.test(line)),
          `${name}: the answer states the Director disabled connectivity`,
        );
        // The exchange is still durably recorded — as deterministic, never as a provider success.
        assert.equal(result.persistence.durable, true, `${name}: the honest answer is still persisted`);
      }
    }
  }

  console.log("hw3 dual-surface authority + R2E passed");
}

void main();
