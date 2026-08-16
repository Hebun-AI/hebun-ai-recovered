/*
 * heby-action-inlet/propose-commands.server.ts — the server execution of PROPOSE slash commands
 * (R3A.1).
 *
 * The mirror of `read-commands.server.ts`, and deliberately a SEPARATE module from it: a read must
 * never be one edited line away from becoming a write. This module can persist a proposal and
 * cannot read a source; that one imports read models and cannot persist anything.
 *
 * ── WHY THIS IS NOT PART OF THE ANSWER FLOW ──────────────────────────────────
 *
 * Filing a proposal has its own transaction boundary and its own failure mode, on purpose:
 *
 *   failure to answer            ≠  failure to file a proposal
 *   failure to file a proposal   ≠  failure to store the conversation
 *
 * Folding this into `askHebyAction` would tie a durable authorization artifact to the success of a
 * model call — a provider timeout would silently drop a proposal a human was waiting on, and a
 * failed proposal would look like a failed conversation. They are separate acts with separate
 * truth, so they get separate seams.
 *
 * ── WHAT THE CLIENT SUPPLIES ─────────────────────────────────────────────────
 *
 * A command id, its positional arguments, and nothing else. The command id is a lookup key into the
 * CLOSED registry, so it can never select behaviour the registry does not declare; the action kind
 * is fixed by the handler here, not by the caller. The tenant is resolved SERVER-SIDE from the R1
 * session exactly as the answer flow does. A command that is unknown, is not a `propose`, or is not
 * currently available is refused without touching the database.
 *
 * Server-only. Imports no model client and constructs no transport.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { findHebyCommandById } from "@/features/heby-commands/registry";
import { proposeSendAction, type SendProposalDeps } from "./send-proposal.server";
import type { SendProposalResult } from "./contracts";

export interface HebyProposeCommandInput {
  readonly commandId: string;
  readonly args: readonly string[];
}

export type HebyProposeCommandOutcome =
  | { readonly status: "ok"; readonly result: SendProposalResult }
  | { readonly status: "unauthorized" }
  | { readonly status: "refused"; readonly reason: "unknown-command" | "not-proposable" | "invalid-arguments" };

export interface HebyProposeCommandDeps extends SendProposalDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
}

export async function runHebyProposeCommand(
  input: HebyProposeCommandInput,
  deps: HebyProposeCommandDeps,
): Promise<HebyProposeCommandOutcome> {
  if (typeof window !== "undefined") {
    throw new Error("Action proposals are server-only.");
  }

  /*
   * The registry is re-consulted on the SERVER. The client already planned this, but a client plan
   * is a request, not an authorization: without this the caller could name any command id and reach
   * the writer below.
   */
  const command = findHebyCommandById(input.commandId);
  if (!command) return { status: "refused", reason: "unknown-command" };
  if (command.kind !== "propose") return { status: "refused", reason: "not-proposable" };
  if (command.availability !== "available") return { status: "refused", reason: "not-proposable" };

  const tenant = await deps.resolveTenant();
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthorized" };

  switch (command.handler) {
    case "send": {
      const [recipientRef, draftRef] = input.args;
      if (!recipientRef || !draftRef) return { status: "refused", reason: "invalid-arguments" };
      const result = await proposeSendAction(tenant, { recipientRef, draftRef }, deps);
      return { status: "ok", result };
    }
    default:
      /*
       * A `propose` command with no handler here proposes NOTHING. It does not fall through to a
       * generic writer, because there is no generic writer: each proposable action names its own
       * module, so adding a second one is a deliberate act rather than a registry edit.
       */
      return { status: "refused", reason: "not-proposable" };
  }
}
