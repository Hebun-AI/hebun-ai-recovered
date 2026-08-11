"use server";

import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  answerHebyModelRequest,
  type HebyModelAnswerInput,
  type HebyModelAnswerResult,
} from "@/features/heby-answer/model-answer.server";
import {
  loadHebyConversation,
  type LoadConversationResult,
} from "@/features/heby-answer/load-conversation.server";
import {
  runHebyReadCommand,
  type HebyReadCommandInput,
  type HebyReadCommandResult,
} from "@/features/heby-commands/read-commands.server";

/**
 * The R2C/R2D server boundary for an authenticated Heby model answer. It is the ONLY thing the
 * client can call to cross into model generation, and it is deliberately thin: it resolves the
 * tenant SERVER-SIDE from the R1 session (the client never supplies identity or tenant), then
 * hands the request to the orchestration service, which generates, validates, and durably
 * persists the exchange. It returns a serializable result — never a credential, a raw provider
 * payload, a stack trace, or any internal security state.
 *
 * The client-controlled input is only `{ prompt, route, conversationId? }`. The conversation
 * id is an opaque continuation hint, re-verified against the tenant server-side; authority is
 * never accepted from the client.
 */
export async function askHebyAction(
  input: HebyModelAnswerInput,
): Promise<HebyModelAnswerResult> {
  return answerHebyModelRequest(
    { prompt: input.prompt, route: input.route, conversationId: input.conversationId },
    { resolveTenant: resolveTenantContext },
  );
}

/**
 * Load a persisted conversation for the authenticated tenant (reload survival). The client
 * carries only an opaque conversation id; the tenant is resolved server-side and ownership is
 * re-checked, so a foreign/invalid/unknown id returns an honest `not-found`.
 */
export async function loadHebyConversationAction(
  input: { conversationId: string },
): Promise<LoadConversationResult> {
  return loadHebyConversation(
    { conversationId: input.conversationId },
    { resolveTenant: resolveTenantContext },
  );
}

/**
 * The S1 boundary for a READ slash command. It is deliberately a SEPARATE action from
 * `askHebyAction`: a read has no way to become a model request, because this path never touches the
 * generation boundary, never selects a transport, and imports no model client at all.
 *
 * The client supplies only `{ commandId, args, route, conversationId? }`. The command id is a
 * lookup key into the closed registry — it can never select behaviour the registry does not
 * declare — and the tenant is resolved SERVER-SIDE from the R1 session, exactly as the answer flow
 * does. A command that is unknown, is not a READ, or is not currently available is refused without
 * reading anything.
 */
export async function runHebyReadCommandAction(
  input: HebyReadCommandInput,
): Promise<HebyReadCommandResult> {
  return runHebyReadCommand(
    {
      commandId: input.commandId,
      args: input.args,
      route: input.route,
      conversationId: input.conversationId,
    },
    { resolveTenant: resolveTenantContext },
  );
}
