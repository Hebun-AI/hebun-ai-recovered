"use server";

/*
 * CONTROLLED AGENT REASONING · PHASE 4 — the server boundary for "plan with AI".
 *
 * Its own action, separate from the read, the answer and the propose actions: a read must never
 * acquire a model call by an edit, and this is the one planning path that may contact a model. The
 * tenant comes from the session only; the client supplies the message and nothing else.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { runAiOperationalPlan, type AiOperationalPlanResult } from "@/features/heby-commands/ai-operational-plan.server";

export async function planWithAiAction(input: { readonly message: string }): Promise<AiOperationalPlanResult> {
  const message = typeof input?.message === "string" ? input.message.slice(0, 2_000) : "";
  return runAiOperationalPlan({ message }, { resolveTenant: resolveTenantContext });
}
