/*
 * heby-answer/load-conversation.server.ts — read a persisted Heby conversation for the
 * authenticated tenant (R2D reload). Server-only.
 *
 * The client may carry an opaque conversation id, but it is NEVER trusted as authority: the
 * tenant is resolved server-side and the repository re-checks ownership, so a foreign, invalid,
 * or unknown id returns an honest `not-found` — tenant B can never read tenant A's thread. Only
 * safe, presentation-shaped fields cross the boundary; no secret, no raw provider payload.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { fromStoredEvidence } from "@/features/heby-conversation/answer-evidence";
import {
  resolveConversationRepoOrNull,
  type DurableConversationRepository,
} from "@/features/heby-conversation/durable-conversation-repository.server";
import type { RetrievalEvidenceSet } from "@/features/knowledge-retrieval";

export interface HebyConversationMessageView {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  /** "user" | "deterministic" | "model" when known. */
  readonly origin: string | null;
  /** "fake" | "live" — only ever set on a real model message. */
  readonly transport: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly createdAt: string;
  /**
   * KR5 — the evidence RECORDED WITH this answer, replayed from its historical rows.
   *
   * Not a re-read of current Knowledge and not a fresh retrieval: every value is the one stored at
   * answer time, so a fact that has since been superseded still shows the version this answer
   * actually used. Absent when no retrieval ran for this message — which a set with zero items
   * does NOT mean, and the two must stay distinguishable.
   */
  readonly knowledgeEvidence?: RetrievalEvidenceSet;
}

export interface HebyConversationView {
  readonly conversationId: string;
  readonly subject: string | null;
  readonly messages: readonly HebyConversationMessageView[];
}

export type LoadConversationResult =
  | { readonly status: "unauthorized" }
  | { readonly status: "not-configured" }
  | { readonly status: "not-found" }
  | { readonly status: "loaded"; readonly view: HebyConversationView };

export interface LoadConversationDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  readonly getConversationRepo?: () => DurableConversationRepository | null;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Heby conversation load is server-only.");
  }
}

/**
 * Load a tenant-owned conversation. Fail-closed: unauthenticated → `unauthorized`; persistence
 * off → `not-configured`; a foreign/invalid/unknown id, or any persistence error → `not-found`
 * (never another tenant's data, never a fabricated thread).
 */
export async function loadHebyConversation(
  input: { readonly conversationId: string },
  deps: LoadConversationDeps,
): Promise<LoadConversationResult> {
  assertServerRuntime();

  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "unauthorized" };

  const repo = (deps.getConversationRepo ?? resolveConversationRepoOrNull)();
  if (!repo) return { status: "not-configured" };

  const scope = { tenantId: tenant.tenantId, actorId: tenant.userId };
  try {
    const conversation = await repo.getConversation(scope, input.conversationId);
    if (!conversation) return { status: "not-found" };
    const messages = await repo.listConversationMessages(scope, input.conversationId);

    /*
     * KR5 — historical evidence rides the EXISTING authorization, on purpose.
     *
     * Conversation ownership has already been proven above, and the ids handed to the evidence read
     * are the ones that read returned. There is deliberately no standalone evidence endpoint: a
     * caller holding a raw evidence set id has no surface to spend it on, so the conversation
     * boundary stays the only gate. The repository re-scopes by tenant regardless.
     */
    const evidence = await repo.listAnswerEvidence(
      scope,
      messages.map((message) => message.id),
    );
    const evidenceByMessage = new Map(evidence.map((set) => [set.messageId, set]));

    return {
      status: "loaded",
      view: {
        conversationId: conversation.id,
        subject: conversation.subject,
        messages: messages.map((message) => {
          const stored = evidenceByMessage.get(message.id);
          return {
            id: message.id,
            role: message.role,
            content: message.content,
            origin: message.origin,
            transport: message.transport,
            provider: message.provider,
            model: message.model,
            createdAt: message.createdAt,
            ...(stored ? { knowledgeEvidence: fromStoredEvidence(stored) } : {}),
          };
        }),
      },
    };
  } catch {
    // A persistence error must not leak internal state — treat as an honest not-found.
    return { status: "not-found" };
  }
}
