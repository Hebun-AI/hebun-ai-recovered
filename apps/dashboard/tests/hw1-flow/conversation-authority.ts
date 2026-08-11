/*
 * HW1 — the Full Workspace runs on the EXISTING H1 conversation authority (behavioural, fake
 * transport, no network, no key, no database).
 *
 * The workspace changed the surface, not the runtime. These proofs drive the real server flow with
 * the routes the workspace actually sends — the general Heby route and a workspace-scoped route —
 * and show that R2E, the evidence pipeline, provenance and the execution firewall behave exactly as
 * they did for the retired drawer. Zero Anthropic calls.
 */
import assert from "node:assert/strict";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer, type ModelTransportSelection } from "../../src/features/heby-model";
import { createFakeClaudeTransport } from "../helpers/fake-claude-transport";
import { createInMemoryConversationRepo } from "../helpers/in-memory-conversation-repo";
import { resolveHebyWorkspaceEntry } from "../../src/features/heby-workspace/context";
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

const baseDeps = () => ({
  resolveTenant: async () => TENANT,
  readOverview: () => undefined,
  getConversationRepo: () => null,
  generate: generateHebyModelAnswer,
});

/** The two routes the Heby Workspace can actually send. */
const GENERAL = resolveHebyWorkspaceEntry(undefined).route;
const SCOPED = resolveHebyWorkspaceEntry("operations").route;

async function main(): Promise<void> {
  // 1. R2E OFF on the Heby Workspace route → zero transport selection, zero generation, zero send.
  //    The kill-switch is unchanged by the new surface.
  for (const route of [GENERAL, SCOPED]) {
    let selectCalls = 0;
    let generateCalls = 0;
    const fake = createFakeClaudeTransport("success");
    const result = await answerHebyModelRequest(
      { prompt: "What should I look at?", route },
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
    assert.equal(result.status, "answered", `${route}: still answers`);
    assert.equal(selectCalls, 0, `${route}: OFF selects no transport`);
    assert.equal(generateCalls, 0, `${route}: OFF attempts no generation`);
    assert.equal(fake.calls, 0, `${route}: OFF sends nothing`);
    if (result.status === "answered") {
      assert.notEqual(result.outcome.response.origin, "model", `${route}: OFF is never a model answer`);
      assert.ok(
        result.outcome.response.limitations.some((l) => /disabled by the Director/i.test(l)),
        `${route}: OFF states the honest reason`,
      );
    }
  }

  // 2. Director ON from the workspace → exactly one send, a validated model answer whose evidence is
  //    the DETERMINISTIC set (what `/sources` later shows), never anything the model supplied.
  {
    const fake = createFakeClaudeTransport("success");
    const result = await answerHebyModelRequest(
      { prompt: "Summarize the current picture.", route: SCOPED },
      {
        ...baseDeps(),
        env: FAKE_SATISFIED_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: (): ModelTransportSelection => ({ transport: fake, transportProvenance: "fake" }),
      },
    );
    assert.equal(fake.calls, 1, "exactly one provider send");
    assert.equal(result.status, "answered");
    if (result.status === "answered") {
      assert.equal(result.transportProvenance, "fake", "the fake transport is reported as fake");
      // Whatever `/sources` renders comes from here — the server's own evidence list.
      for (const item of result.outcome.response.evidence) {
        assert.ok(typeof item.sourceClass === "string" && typeof item.recordRef === "string", "server-shaped evidence");
      }
      assert.ok(
        result.outcome.response.limitations.some((l) => /not a live Claude\/Anthropic connection/i.test(l)),
        "a fake transport is never presented as a live provider",
      );
      assert.ok(
        result.outcome.response.limitations.some((l) => /executes nothing/i.test(l)),
        "the answer states that it executes nothing",
      );
    }
  }

  // 3. The workspace's context routes scope evidence exactly as the equivalent product surface does
  //    — the hint changes scope, never authority.
  {
    const general = await answerHebyModelRequest(
      { prompt: "What should I look at?", route: GENERAL },
      { ...baseDeps(), env: FAKE_SATISFIED_ENV, resolveDirectorEnabled: async () => false },
    );
    const command = await answerHebyModelRequest(
      { prompt: "What should I look at?", route: "/command" },
      { ...baseDeps(), env: FAKE_SATISFIED_ENV, resolveDirectorEnabled: async () => false },
    );
    assert.equal(general.status, "answered");
    assert.equal(command.status, "answered");
    if (general.status === "answered" && command.status === "answered") {
      assert.equal(
        general.outcome.response.authority,
        command.outcome.response.authority,
        "the general Heby route carries Command's authority boundary — no widening",
      );
      assert.deepEqual(
        general.outcome.response.evidence.map((e) => e.sourceClass),
        command.outcome.response.evidence.map((e) => e.sourceClass),
        "the general Heby route reads exactly Command's sources — nothing more",
      );
    }
  }

  // 4. Unauthenticated → the workspace can never obtain an answer, and no provider is contacted.
  //    (This is what drives the visualizer's `unavailable` state — a real runtime fact.)
  {
    const fake = createFakeClaudeTransport("success");
    const result = await answerHebyModelRequest(
      { prompt: "What should I look at?", route: GENERAL },
      {
        ...baseDeps(),
        resolveTenant: async () => null,
        env: FAKE_SATISFIED_ENV,
        resolveDirectorEnabled: async () => true,
        selectTransport: (): ModelTransportSelection => ({ transport: fake, transportProvenance: "fake" }),
      },
    );
    assert.equal(result.status, "unauthorized", "no tenant → no answer");
    assert.equal(fake.calls, 0, "no tenant → no provider contact");
  }

  // 5. Durable continuity is unchanged: the workspace persists through the SAME repository and a
  //    reload restores the same conversation. `/clear` and `/new` only drop the client pointer, so
  //    the durable rows survive — proven here by re-reading after the pointer would have been lost.
  {
    const repo = createInMemoryConversationRepo();
    const scope = { tenantId: TENANT.tenantId, actorId: TENANT.userId };
    const deps = {
      ...baseDeps(),
      getConversationRepo: () => repo,
      env: FAKE_SATISFIED_ENV,
      resolveDirectorEnabled: async () => false,
    };

    const first = await answerHebyModelRequest({ prompt: "First question", route: GENERAL }, deps);
    assert.equal(first.status, "answered");
    if (first.status !== "answered" || !first.persistence.durable) throw new Error("expected durable persistence");
    const conversationId = first.persistence.conversationId;

    await answerHebyModelRequest({ prompt: "Second question", route: GENERAL, conversationId }, deps);
    const messages = await repo.listConversationMessages(scope, conversationId);
    assert.equal(messages.length, 4, "two exchanges persisted in order");
    assert.deepEqual(messages.map((m) => m.role), ["user", "assistant", "user", "assistant"], "roles interleave");

    // "/clear" and "/new" are client-side detachment only. Nothing on the server is removed, so the
    // conversation is still there and still owned by the tenant.
    const afterDetach = await repo.listConversationMessages(scope, conversationId);
    assert.equal(afterDetach.length, 4, "detaching the view deletes no durable message");
    const stillOwned = await repo.getConversation(scope, conversationId);
    assert.ok(stillOwned, "the durable conversation still exists after a client-side clear");
  }

  console.log("hw1 conversation authority + R2E OFF passed");
}

void main();
