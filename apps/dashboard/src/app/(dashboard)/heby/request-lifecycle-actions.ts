"use server";

/*
 * HEBY-REQUEST-LIFECYCLE — the READ boundary behind "Check what happened" under a proposal Heby filed.
 *
 * Its own file for the reason `origination-availability-actions.ts` is: `heby/actions.ts` holds the
 * seams that write or reach a model, and a read that can do neither does not share a module with
 * them. The only input is the request id the origination receipt returned — a LOOKUP KEY, matched
 * inside the session tenant, so a foreign or invented id reads as `not-found`. It writes nothing,
 * calls no model or provider, decides nothing and records no audit.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  readActionRequestLifecycle,
  type ActionRequestLifecycleRead,
} from "@/features/action-authorization/read-action-authorizations.server";

export type {
  ActionRequestLifecycleRead,
  ActionRequestLifecycleView,
} from "@/features/action-authorization/read-action-authorizations.server";

export async function readHebyRequestLifecycleAction(
  input: { readonly requestId: string },
): Promise<ActionRequestLifecycleRead> {
  return readActionRequestLifecycle(await resolveTenantContext(), input?.requestId);
}
