import {
  HEBY_AUTHORITY_DESCRIPTORS,
  resolveHebyWorkspace,
  resolveHebyWorkspaceContext,
} from "@/features/heby-integration";
import { resolveHebyWorkspaceEntry } from "@/features/heby-workspace/context";
import { resolveHebyReturnLabel, resolveHebyReturnRoute } from "@/features/heby-surface";
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

  return (
    <HebyWorkspaceClient
      contextRoute={entry.route}
      contextLabel={entry.label}
      contextDetail={entry.detail}
      authorityLabel={authorityLabel}
      returnRoute={resolveHebyReturnRoute(rawFrom)}
      returnLabel={resolveHebyReturnLabel(rawFrom)}
    />
  );
}
