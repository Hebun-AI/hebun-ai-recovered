import {
  HEBY_AUTHORITY_DESCRIPTORS,
  resolveHebyWorkspace,
  resolveHebyWorkspaceContext,
} from "@/features/heby-integration";
import { resolveHebyWorkspaceEntry } from "@/features/heby-workspace/context";
import { resolveHebyReturnLabel, resolveHebyReturnRoute } from "@/features/heby-surface";
import { toStreamItems, type HebyStreamState } from "@/features/heby-stream";
import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readCommandCapabilityView } from "@/features/heby-commands/command-capability-projection.server";
import { HebyWorkspaceClient } from "@/components/layout/heby/heby-workspace-client";

export const metadata = { title: "Heby — Hebun AI" };

/*
 * /heby — THE Heby product surface (HW1).
 *
 * This route is the primary Heby experience: a full main-content workspace inside the Hebun shell,
 * not a side drawer. It creates no second Heby: the conversation runs on the existing H1 authority
 * (askHebyAction / loadHebyConversationAction → tenant-resolved server flow → bounded history →
 * Claude boundary → R2E Director kill-switch → durable conversation). No new table, no migration,
 * no alternate backend, no second transcript.
 *
 * CONTEXT IS RESOLVED HERE, ON THE SERVER. A caller may hint where they came from
 * (`/heby?from=operations`), but the hint is checked against the closed set of known workspace
 * identities before anything is rendered; an unknown value silently becomes the general Hebun
 * context. The hint therefore selects the scope of already-visible read models — it can never
 * establish identity, tenancy, or access. The conversation flow re-resolves the route again on its
 * own side, so this page is a convenience, not an authority.
 *
 * HW3 — THE WAY BACK OUT IS RESOLVED HERE TOO, THROUGH THE SAME ALLOW-LIST. The `from` hint also
 * decides where closing the Full Workspace returns to. That resolution is a closed allow-list, not
 * a sanitizer: the hint must be exactly one of the known workspace identities, and the route then
 * comes from that identity's own registry profile. An absolute URL, a protocol-relative URL, a
 * `javascript:` URI, traversal, markup or any arbitrary path is simply not an identity and lands on
 * the canonical `/command` fallback, so no caller-supplied string can ever become a redirect target.
 */

/**
 * G7 — the contextual rail's content, read SERVER-SIDE.
 *
 * ONE READ, AND IT IS SOMEBODY ELSE'S. `readPendingActionRequests` is R3A's own tenant-scoped
 * reader, taken unchanged: the tenant comes from the R1 session, the predicate is `tenant_id = <that
 * tenant> AND status = 'pending'`, and there is no parameter through which this page could ask
 * about another tenant or widen the query. This page adds no read of its own and no authority.
 *
 * IT IS ALLOWED TO FAIL, AND IT SAYS SO. An unavailable read becomes an `unavailable` state that
 * the rail renders as a sentence, never an empty list. "You have nothing to decide" and "Hebun
 * could not read your queue" are different facts and must never share a rendering.
 *
 * NOTHING ELSE FEEDS THE RAIL. The reference design shows uploads, approvals, completed analyses,
 * finished tasks and detected signals; four of those have no read seam in this repository, and the
 * fifth exists only as a tally, which is not an event. They are absent rather than approximated.
 */
async function readStream(): Promise<HebyStreamState> {
  const tenant = await resolveTenantContext();
  const pending = await readPendingActionRequests(tenant);
  if (pending.status !== "read") return { status: "unavailable", reason: pending.reason };
  const items = toStreamItems(pending.items);
  return items.length === 0 ? { status: "empty" } : { status: "items", items };
}

export default async function HebyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawFrom = Array.isArray(params.from) ? params.from[0] : params.from;
  const entry = resolveHebyWorkspaceEntry(rawFrom);

  // The authority boundary for the resolved context — the same mapping the runtime uses.
  const workspaceContext = resolveHebyWorkspaceContext({
    workspace: resolveHebyWorkspace(entry.route),
    route: entry.route,
  });
  const authorityLabel = HEBY_AUTHORITY_DESCRIPTORS[workspaceContext.authority].label;

  /*
   * HEBY-CAP1 — command capability, resolved HERE, on the server, for the authenticated tenant.
   *
   * THE TENANT COMES FROM THE SESSION AND FROM NOWHERE ELSE. `resolveTenantContext()` takes no
   * argument, so there is no parameter through which this page — or a caller's query string —
   * could name a different organization. This page adds no read of its own and no authority: it
   * calls one projection, which composes released authorities and owns no capability state.
   *
   * IT REACHES NO PROVIDER. The projection's authorities read the control plane and pure config,
   * so rendering `/help` can never become a request to GitHub or Google.
   */
  const capabilityView = await readCommandCapabilityView(await resolveTenantContext());

  return (
    <HebyWorkspaceClient
      capabilityView={capabilityView}
      contextRoute={entry.route}
      contextLabel={entry.label}
      contextDetail={entry.detail}
      authorityLabel={authorityLabel}
      returnRoute={resolveHebyReturnRoute(rawFrom)}
      returnLabel={resolveHebyReturnLabel(rawFrom)}
      stream={await readStream()}
    />
  );
}
