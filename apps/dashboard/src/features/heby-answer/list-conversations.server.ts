/*
 * heby-answer/list-conversations.server.ts — the authenticated human's own Heby conversations
 * (HEBY-CONVERSATION-CONTINUITY-1). Server-only.
 *
 * The sibling of `load-conversation.server.ts`, on the SAME authority: the tenant and the acting
 * human come from the server-resolved session, and the repository's own tenant + `created_by`
 * predicate decides what is listed. The client carries only an opaque cursor the server issued.
 * Only presentation-shaped fields cross the boundary — an id, the owner's own subject and two times.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveConversationRepoOrNull,
  type DurableConversationRepository,
  type DurableConversationSummary,
} from "@/features/heby-conversation/durable-conversation-repository.server";

export type ListConversationsResult =
  | { readonly status: "unauthorized" }
  | { readonly status: "not-configured" }
  /** The read failed. Distinct from an empty list: "you have none" and "Hebun could not read" differ. */
  | { readonly status: "unavailable" }
  | {
      readonly status: "listed";
      readonly items: readonly DurableConversationSummary[];
      readonly nextCursor: string | null;
    };

export interface ListConversationsDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  readonly getConversationRepo?: () => DurableConversationRepository | null;
}

export async function listHebyConversations(
  input: { readonly cursor?: string },
  deps: ListConversationsDeps,
): Promise<ListConversationsResult> {
  if (typeof window !== "undefined") throw new Error("Heby conversation list is server-only.");

  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "unauthorized" };

  const repo = (deps.getConversationRepo ?? resolveConversationRepoOrNull)();
  if (!repo) return { status: "not-configured" };

  try {
    const page = await repo.listOwnedConversations(
      { tenantId: tenant.tenantId, actorId: tenant.userId },
      { cursor: typeof input.cursor === "string" ? input.cursor : undefined },
    );
    return { status: "listed", items: page.items, nextCursor: page.nextCursor };
  } catch {
    return { status: "unavailable" };
  }
}
