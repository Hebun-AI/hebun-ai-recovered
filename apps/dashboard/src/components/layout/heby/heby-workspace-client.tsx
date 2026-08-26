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
import type { HebyStreamState } from "@/features/heby-stream";
import { useHebySurface } from "./heby-surface-context";
import { useHebyConversation } from "./use-heby-conversation";
import { useHebyVoiceSurface } from "./use-heby-voice-surface";
import { HebyWorkspace } from "./heby-workspace";
import type { CommandCapabilityView } from "@/features/heby-commands/contracts";

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
  /**
   * G7 — the contextual rail's content, already read and projected SERVER-SIDE.
   *
   * It arrives as a finished value for the same reason the context and the return target do: this
   * container performs no read, and giving it one would hand a presentation surface a second way
   * into the database beside the one conversation seam. It carries no id, no payload and no
   * authority — only what a reader may see, plus a route the projection fixed.
   */
  readonly stream: HebyStreamState;
  /**
   * HEBY-CAP1 — tenant-resolved command capability, composed SERVER-SIDE.
   *
   * A finished value, for the same reason the context and the stream are: this container performs
   * no read. It carries no credential, no provider payload and no capability state of its own —
   * only each command's resolved state and the governing authority's own sentence.
   */
  readonly capabilityView: CommandCapabilityView;
}

export function HebyWorkspaceClient(props: HebyWorkspaceClientProps) {
  const {
    contextRoute, contextLabel, contextDetail, authorityLabel, returnRoute, returnLabel, stream,
    capabilityView,
  } = props;
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
    capabilityView,
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
      stream={stream}
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
