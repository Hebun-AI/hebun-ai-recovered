"use server";

/*
 * /intelligence/social — the SOC-ACT1 server boundary.
 *
 * ── WHAT CROSSES THIS LINE, AND WHAT CANNOT ──────────────────────────────────
 *
 * A reference and a sentence. That is the entire input surface, and the type says so: there is no
 * tenant, no actor, no authorization, no permit, no provider fact, no measurement and no work state
 * a caller could express. They are unrepresentable rather than merely rejected.
 *
 * The tenant is resolved HERE, server-side, from the session. The observation is re-read by the
 * inlet from the authority that owns it. Nothing this page rendered is trusted on the way back in —
 * a browser that lies about a measurement changes nothing, because no measurement is read from it.
 *
 * ── THIS FILE HOLDS NO AUTHORITY ─────────────────────────────────────────────
 *
 * It resolves a tenant and forwards. It records no work, approves nothing, mints no permit, executes
 * nothing and reaches no provider. The inlet's verdict is returned unchanged and unreworded — a
 * boundary that rephrased a refusal would be a second, drifting account of what happened.
 *
 * ── WHY `/approvals` IS REVALIDATED AND THIS PAGE IS NOT ─────────────────────
 *
 * Filing a proposal changes the decision queue and changes nothing here. Revalidating the Social
 * Intelligence surface would suggest something about the observations moved; nothing did.
 */
import { revalidatePath } from "next/cache";

import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { proposeSocialObservationWorkAction } from "@/features/heby-action-inlet/record-work-proposal.server";
import type { SocialWorkProposalResult } from "@/features/heby-action-inlet/contracts";

export async function proposeWorkFromSocialObservationAction(input: {
  observationRef: string;
  title: string;
}): Promise<SocialWorkProposalResult> {
  const tenant = await resolveTenantContext();
  const result = await proposeSocialObservationWorkAction(tenant, {
    observationRef: String(input?.observationRef ?? ""),
    title: String(input?.title ?? ""),
  });
  if (result.status === "proposed") revalidatePath("/approvals");
  return result;
}
