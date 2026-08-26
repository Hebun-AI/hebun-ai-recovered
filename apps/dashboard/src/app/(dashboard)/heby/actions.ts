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
import {
  runHebyProviderReadCommand,
  type HebyProviderReadCommandInput,
  type HebyProviderReadCommandResult,
} from "@/features/heby-commands/provider-read-commands.server";
import {
  runHebyCrossSourceCommand,
  type HebyCrossSourceCommandInput,
  type HebyCrossSourceCommandResult,
} from "@/features/heby-commands/cross-source-commands.server";
import {
  runHebyProposeCommand,
  type HebyProposeCommandInput,
  type HebyProposeCommandOutcome,
} from "@/features/heby-action-inlet/propose-commands.server";

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

/**
 * The R3A.1 boundary for a PROPOSE slash command.
 *
 * A THIRD action, separate from both `askHebyAction` and `runHebyReadCommandAction`, and separate
 * on purpose. A proposal is the only Heby path that writes a durable authorization artifact, so it
 * gets its own seam: a read cannot become a write by editing one line, and a provider failure in
 * the answer flow can never drop a proposal a human is waiting on.
 *
 * The client supplies `{ commandId, args }` — the command id is a lookup key into the closed
 * registry, and the tenant is resolved SERVER-SIDE from the R1 session. It cannot supply a tenant,
 * an actor, an action kind, a digest or an approval; the action kind is fixed by the handler and
 * both digests are derived from what the server actually reads.
 *
 * NOTHING IS SENT. `send-external-communication` still declares `substrateConnected: false`. This
 * files a pending request for `/approvals` and performs no external act.
 *
 * NO CACHE REVALIDATION. This module is forbidden from importing `next/cache`, and that firewall
 * is right: `/approvals` is a separately navigated, server-rendered surface that reads the pending
 * queue when it loads, so it needs no invalidation from here — and giving the Heby boundary the
 * ability to invalidate arbitrary routes would be a real widening of it for a convenience nobody
 * asked for.
 */
export async function proposeHebyActionCommandAction(
  input: HebyProposeCommandInput,
): Promise<HebyProposeCommandOutcome> {
  return runHebyProposeCommand(
    { commandId: input.commandId, args: input.args },
    { resolveTenant: resolveTenantContext },
  );
}

/**
 * The INT-5B1 boundary for a PROVIDER-READ slash command.
 *
 * A FOURTH action, separate from `askHebyAction`, `runHebyReadCommandAction` and the proposal
 * boundary, and separate for the same reason each of those is. This is the ONLY Heby path that can
 * result in Hebun contacting an external provider, so it gets its own seam: an ordinary read cannot
 * acquire external reach by an edit, and a provider being slow or down cannot delay or degrade a
 * read of Hebun's own sources.
 *
 * The client supplies `{ commandId, args }`. The command id is a lookup key into the closed
 * registry and is refused unless it names an available `provider-read` command; the tenant is
 * resolved SERVER-SIDE from the R1 session. It cannot supply a tenant, an integration, an
 * installation, a provider account, a repository address or anything spendable — no parameter for
 * any of them exists, here or in the seam this calls.
 *
 * IT READS. It writes no connection lifecycle, stores no repository, admits nothing into Knowledge,
 * mints no permit, and executes nothing. A provider failure leaves the stored connection byte for
 * byte as it was.
 */
export async function runHebyProviderReadCommandAction(
  input: HebyProviderReadCommandInput,
): Promise<HebyProviderReadCommandResult> {
  return runHebyProviderReadCommand(
    { commandId: input.commandId, args: input.args },
    { resolveTenant: resolveTenantContext },
  );
}

/**
 * INT-5C. The SIXTH Heby server action, and the second that can reach a provider.
 *
 * IT IS SEPARATE FROM THE PROVIDER-READ ACTION ON PURPOSE. Two commands that consult different
 * things should not share one entry point: sharing would mean `/repositories` and this command have
 * one server module between them, and the Knowledge half would then be reachable from the root
 * INT-5B1 proved it was not reachable from.
 *
 * The tenant is resolved on the server, exactly as it is for every other action here. The only
 * client-crossing payload is a registry command id and its (empty) argument list — no tenant, no
 * installation, no repository address, no Knowledge fact id.
 */
export async function runHebyCrossSourceCommandAction(
  input: HebyCrossSourceCommandInput,
): Promise<HebyCrossSourceCommandResult> {
  return runHebyCrossSourceCommand(
    { commandId: input.commandId, args: input.args },
    { resolveTenant: resolveTenantContext },
  );
}
