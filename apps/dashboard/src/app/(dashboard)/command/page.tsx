import { PageHeader } from "@/components/layout/page-header";
import { CommandOverview } from "@/components/command-overview/command-overview";
import {
  getExpressIntentSummary,
  toWaitingOnYou,
} from "@/features/command-overview/workspace-model";
import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";
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
  const pending = await readPendingActionRequests(tenant);

  return (
    <>
      <PageHeader
        title="Command"
        context="What is waiting on a human, and what you can ask Hebun to prepare. Command summarizes and routes; every act belongs to the workspace that owns it."
      />
      <CommandOverview waiting={toWaitingOnYou(pending)} intent={getExpressIntentSummary()} />
    </>
  );
}
