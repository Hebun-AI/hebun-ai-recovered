"use server";

/*
 * WF-1 — the READ boundary behind Heby's "propose this as organizational work" affordance.
 *
 * Its own file on purpose: `heby/actions.ts` holds the seams that write or reach a model, and a read
 * that can do neither should not share a module with them. It takes NO input — no tenant, no agent,
 * no scope, no claimed availability. The tenant comes from the R1 session; everything else is read.
 * It writes nothing, calls no provider and records no audit. Confirming an offer goes through the
 * released `originateHebyActionProposalAction({ goal })`, which re-checks everything this read saw.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readOriginationAvailability } from "@/features/origination-availability/read-origination-availability.server";
import type { AgentOriginationAvailability } from "@/features/origination-availability/contracts";

export async function readAgentOriginationAvailabilityAction(): Promise<AgentOriginationAvailability> {
  return readOriginationAvailability({ resolveTenant: resolveTenantContext });
}
