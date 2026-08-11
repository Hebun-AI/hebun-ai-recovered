"use client";

/*
 * heby-workspace-client.tsx — the Heby Full Workspace container (HW1 origin, HW3 dual surface).
 *
 * It is deliberately thin. All conversation behaviour — the single `askHebyAction` dispatch site,
 * the single slash-command gate, the single detach primitive, the single durable-conversation
 * pointer, the presence derivation — lives in the SHARED hook that the Quick Panel also uses, so
 * the two surfaces cannot drift into two Hebys. This file adds only what is specific to the Full
 * Workspace: the way out.
 *
 * The return target was resolved SERVER-SIDE from the closed workspace allow-list and handed down
 * as a prop. It is registered with the surface controller so the rail toggle and the in-header
 * Back control agree, and so the return survives a direct load or a reload of /heby.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHebySurface } from "./heby-surface-context";
import { useHebyConversation } from "./use-heby-conversation";
import { useHebyVoiceSurface } from "./use-heby-voice-surface";
import { HebyWorkspace } from "./heby-workspace";

export interface HebyWorkspaceClientProps {
  /** Server-resolved context route. The client never invents or widens it. */
  readonly contextRoute: string;
  readonly contextLabel: string;
  /** The honest `/context` body, composed server-side. */
  readonly contextDetail: readonly string[];
  readonly authorityLabel: string;
  /** Server-validated return route (allow-list or the canonical fallback). Never a client URL. */
  readonly returnRoute: string;
  readonly returnLabel: string;
}

export function HebyWorkspaceClient(props: HebyWorkspaceClientProps) {
  const { contextRoute, contextLabel, contextDetail, authorityLabel, returnRoute, returnLabel } = props;
  const { operate, registerWorkspaceReturn } = useHebySurface();
  const router = useRouter();

  // Publish the server-validated return target to the surface controller.
  useEffect(() => {
    registerWorkspaceReturn(returnRoute, returnLabel);
  }, [registerWorkspaceReturn, returnRoute, returnLabel]);

  const conversation = useHebyConversation({
    contextRoute,
    contextLabel,
    contextDetail,
    surface: "full-workspace",
    returnLabel,
    /* `/close` in the workspace is the same safe return the rail control performs. */
    onCloseSurface: () => operate("rail"),
    /*
     * `/go` navigation. The route was resolved by the PURE planner from the closed workspace
     * registry, so this can never receive a caller-supplied URL.
     */
    onNavigate: (route) => router.push(route),
  });

  /*
   * Voice attaches through the one shared binding, to the one runtime the shell mounts. The
   * workspace does not own a microphone and cannot open one — it renders whatever the binding
   * truthfully reports, and its `onSubmit` remains the operator's own act.
   */
  const voice = useHebyVoiceSurface(conversation);

  return (
    <HebyWorkspace
      contextLabel={contextLabel}
      authorityLabel={authorityLabel}
      returnLabel={returnLabel}
      /*
       * Leaving is a PRESENTATION transition, routed through the same planner the rail control
       * uses, so both exits behave identically. It ends no conversation, deletes nothing, and
       * touches no provider state.
       */
      onClose={() => operate("rail")}
      {...conversation}
      /* Spread AFTER the conversation: the arbitrated presence and the operator's wrapped submit. */
      {...voice}
    />
  );
}
