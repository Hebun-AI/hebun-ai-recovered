"use client";

/*
 * heby-quick-panel-client.tsx — the Quick Panel container (HW3).
 *
 * It mounts NOTHING unless the single surface state says `quick-panel`. That is the structural
 * guarantee behind mutual exclusivity: on `/heby` the surface state is `full-workspace`, so this
 * component returns null and the panel is not in the tree at all — not hidden behind the workspace,
 * not an invisible mounted composer, not a second conversation quietly holding state.
 *
 * It creates NO second Heby. It calls the same shared conversation hook the Full Workspace calls,
 * which owns the only `askHebyAction` dispatch site, the only slash-command gate, and the only
 * durable-conversation pointer. There is no quick-panel backend, table, transcript, or provider path.
 *
 * CONTEXT, NOT AUTHORITY. The panel's context is the workspace the operator is standing in,
 * resolved through the SAME closed registry the server uses — a route is mapped to one of eight
 * known workspace identities and then to that identity's own canonical route. Nothing is scraped
 * from the DOM and no free text is forwarded. The route it sends is re-resolved server-side, and
 * the tenant is resolved server-side from the session, so this can widen nothing.
 */

import { usePathname, useRouter } from "next/navigation";
import {
  HEBY_AUTHORITY_DESCRIPTORS,
  resolveHebyWorkspace,
  resolveHebyWorkspaceContext,
} from "@/features/heby-integration";
import { resolveHebyWorkspaceEntry } from "@/features/heby-workspace/context";
import { useHebySurface } from "./heby-surface-context";
import { useHebyConversation } from "./use-heby-conversation";
import { useHebyVoiceSurface } from "./use-heby-voice-surface";
import { HebyQuickPanel } from "./heby-quick-panel";

export function HebyQuickPanelClient() {
  const { surface } = useHebySurface();
  if (surface !== "quick-panel") return null;
  return <MountedQuickPanel />;
}

/**
 * Split out so the conversation hook is only ever instantiated while the panel is genuinely open.
 * A closed panel therefore holds no session, runs no restore, and can never be a second live
 * conversation sitting behind the Full Workspace.
 */
function MountedQuickPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const { closeQuickPanel } = useHebySurface();

  // The closed registry, exactly as the server resolves it: route → workspace identity → that
  // identity's own canonical route. The canonical route is why the Quick Panel and the Full
  // Workspace opened from the same workspace continue the SAME durable conversation, with no
  // transfer, no copy, and no synchronization mechanism.
  const workspace = resolveHebyWorkspace(pathname);
  const entry = resolveHebyWorkspaceEntry(workspace);
  const workspaceContext = resolveHebyWorkspaceContext({ workspace, route: entry.route });
  const authorityLabel = HEBY_AUTHORITY_DESCRIPTORS[workspaceContext.authority].label;

  const conversation = useHebyConversation({
    contextRoute: entry.route,
    contextLabel: entry.label,
    contextDetail: entry.detail,
    surface: "quick-panel",
    returnLabel: entry.label,
    /* `/close` in the panel closes the panel. It ends no conversation and navigates nowhere. */
    onCloseSurface: closeQuickPanel,
    /*
     * `/go` navigation. The route came from the PURE planner's closed registry lookup, never from
     * the operator's text. The panel stays open, so Heby travels with the operator.
     */
    onNavigate: (route) => router.push(route),
  });

  /*
   * The SAME voice binding to the SAME runtime the Full Workspace uses. Nothing is duplicated: the
   * panel claims the transcript sink while it is mounted and releases it when it closes, so the two
   * surfaces hand voice over rather than each holding a microphone.
   */
  const voice = useHebyVoiceSurface(conversation);

  return (
    <HebyQuickPanel
      contextLabel={entry.label}
      authorityLabel={authorityLabel}
      onClose={closeQuickPanel}
      {...conversation}
      {...voice}
    />
  );
}
