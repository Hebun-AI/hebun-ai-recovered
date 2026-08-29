import { PageHeader } from "@/components/layout/page-header";
import { CommandOverview } from "@/components/command-overview/command-overview";
import { GlobalAwareness } from "@/components/awareness/global-awareness";
import {
  getExpressIntentSummary,
  toWaitingOnYou,
} from "@/features/command-overview/workspace-model";
import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";
import { readLiveMapProjection } from "@/features/live-map/read-live-map.server";
import { summariseLiveMap } from "@/features/live-map/awareness";
import { readSecurityRecordedActObservation } from "@/features/governance-activity/security-observation-source.server";
import { summariseSecurityObservation } from "@/features/security-center/awareness";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";

export const metadata = { title: "Command — Hebun AI" };

/*
 * Command — the canonical Overview (CMD-B1), and the default authenticated landing.
 *
 * ── WHAT THIS ROUTE OWNS ─────────────────────────────────────────────────────
 *
 * The tenant, resolved ONCE, here. That is the convention `/approvals` and `/heby` already follow
 * and the reason no Command component may resolve it: N resolutions per request could describe N
 * different instants, and a component that resolves its own context is a component that can be
 * moved somewhere it should not read.
 *
 * ── ONE READ, AND IT IS SOMEBODY ELSE'S ──────────────────────────────────────
 *
 * `readPendingActionRequests` is the action-authorization authority's own reader, taken unchanged:
 * the tenant comes from the session, the predicate is `tenant_id = <that tenant> AND status =
 * 'pending'`, and there is no parameter through which this page could ask about another tenant or
 * widen the query. This page adds no read of its own, no writer, no resolver and no authority. It
 * is the second non-owning consumer of that seam; `/heby` was the first, and its header records the
 * same doctrine.
 *
 * PERMITS ARE NOT READ HERE, ON PURPOSE. A permit is an authorization already granted — a different
 * lifecycle stage from a request awaiting one. The surest way to guarantee the two are never merged
 * into a single number is not to fetch the second at all.
 *
 * ── THE AWARENESS BAND (LMX-1) ───────────────────────────────────────────────
 *
 * Two more released seams are composed here, for the same reason the pending queue is: this is the
 * default authenticated landing, and the two questions a Director opens Hebun asking — "what shape
 * is my organization in" and "what has actually been recorded" — were previously answerable only by
 * navigating to two other surfaces first.
 *
 * NEITHER IS A NEW READ. `readLiveMapProjection` is L4's released projection and
 * `readSecurityRecordedActObservation` is E2-2's released seam, both taken unchanged and both
 * handed the SAME tenant this route already resolved once. The two summaries beside them are pure
 * functions over those answers — no handle, no clock, no second resolution — so the panels cannot
 * disagree with the surfaces they lead to.
 *
 * THE COST IS STATED. The Live Map projection issues the organization read, the agent identity read
 * and E2-3's nine grouped statements. That is the price of the panel telling the truth rather than
 * approximating it from something cheaper, and it is the same work `/live-map` itself does.
 *
 * ── WHAT REPLACED THE OLD OVERVIEW ───────────────────────────────────────────
 *
 * The Phase 6B/7 Command Center read a demo-gated, tenant-blind executive projection that is
 * WITHHELD for every real tenant — measured authenticated: eight unavailable sections, eight
 * unavailable insights, and a state strip that printed zeros over the withholding. Its eight
 * components are retired, not repaired, because none of them had a connected source to repair.
 * `command-region.tsx`, `health.ts` and `heby-why.tsx` survive: the first is one of VI-1's nine
 * tracked regions and is imported by Operations and Platform, and the last by thirty-one files.
 */

export default async function CommandPage() {
  const tenant = await resolveTenantContext();
  /*
   * Three released seams, one resolved tenant, and each failure contained by its own reader: an
   * unreadable ledger leaves the Live Map panel intact and vice versa. None of them can widen its
   * own scope — not one takes a tenant identifier.
   */
  const [pending, liveMap, recordedActs] = await Promise.all([
    readPendingActionRequests(tenant),
    readLiveMapProjection(tenant),
    readSecurityRecordedActObservation(tenant),
  ]);

  return (
    <>
      <PageHeader
        title="Command"
        /*
         * CMD-V5 dropped the first sentence, which read "What is waiting on a human, and what you
         * can ask Hebun to prepare." It was a table of contents for this page's own two primary
         * sections, and those sections now name themselves and state their own questions — so it
         * spent a reading-size line of the page's tallest block restating what was about to be said
         * twice below it. The authority claim is the sentence that carries truth here, and it is
         * kept VERBATIM: Command summarizes and routes, and owns no act.
         */
        context="Command summarizes and routes; every act belongs to the workspace that owns it."
      />
      {/*
        THE BAND SITS ABOVE THE CANONICAL OVERVIEW, and outside it. CMD-B1 pins the Overview at
        exactly three sections with exactly three provenance chips; awareness is a fourth concern
        with a different shape, so it is a sibling rather than a fourth region inside a composition
        whose grammar was settled over five phases.
      */}
      <div className="mb-7 lg:mb-8">
        <GlobalAwareness
          liveMap={summariseLiveMap(liveMap)}
          security={summariseSecurityObservation(recordedActs)}
        />
      </div>
      <CommandOverview waiting={toWaitingOnYou(pending)} intent={getExpressIntentSummary()} />
    </>
  );
}
