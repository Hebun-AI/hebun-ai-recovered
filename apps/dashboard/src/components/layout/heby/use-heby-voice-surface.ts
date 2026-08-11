"use client";

/*
 * use-heby-voice-surface.ts — the ONE binding between the one voice runtime and a Heby surface.
 *
 * The Quick Panel and the Full Workspace do not each wire voice up: they call this, and this is the
 * only place where voice and the conversation seam touch. The seam itself stays completely
 * voice-unaware — it has no idea a microphone exists — which is what keeps voice an I/O layer rather
 * than a second conversation authority.
 *
 * THE FOUR THINGS THIS BINDING DOES, AND THE FIFTH IT REFUSES TO:
 *
 *   1. Transcript in.  A recognized transcript is APPENDED to the composer as ordinary text.
 *   2. Answer out.     The newest Heby answer is offered to the runtime, which speaks it only if the
 *                      operator turned spoken answers on.
 *   3. Presence.       Conversation state and voice state are merged by one pure arbiter.
 *   4. Review closed.  Submitting tells voice the transcript is no longer under review.
 *   5. IT NEVER SUBMITS ON VOICE'S BEHALF. `onSubmit` is only ever the operator's own action,
 *      wrapped. There is no path from a transcript to a dispatch, which is exactly why a spoken
 *      "/deploy production" is a refused slash command and not a deployment.
 *
 * A surface rendered with no voice runtime above it gets `voice: undefined` and its own unmodified
 * presence — voice being absent or broken must never change how typed Heby behaves.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { mergeTranscriptIntoComposer, selectSpokenAnswer } from "@/features/heby-voice";
import { resolveHebyPresence } from "./heby-presence";
import { useHebyVoiceRuntime } from "./heby-voice-runtime";
import type { HebyVoiceView } from "./heby-voice-control";
import type { HebyPresenceState } from "./heby-visualizer";
import type { HebyConversationModel } from "./use-heby-conversation";

export interface HebyVoiceSurfaceBinding {
  /** The arbitrated presence: conversation state and voice state, resolved by one pure function. */
  readonly presence: HebyPresenceState;
  /** Measured 0–1 amplitude, or undefined when there is no voice runtime. */
  readonly audioLevel?: number;
  /** The view model for the composer's voice controls, or undefined when there is no runtime. */
  readonly voice?: HebyVoiceView;
  /** The operator's own submit, with the voice review state closed out first. */
  readonly onSubmit: () => void;
}

export function useHebyVoiceSurface(conversation: HebyConversationModel): HebyVoiceSurfaceBinding {
  const runtime = useHebyVoiceRuntime();

  /*
   * The composer's current text, read at DELIVERY time rather than captured when the sink was
   * registered — otherwise a transcript arriving after the operator typed would overwrite their
   * words with a stale value.
   */
  const composerRef = useRef(conversation.composerValue);
  const changeRef = useRef(conversation.onComposerChange);
  // Refreshed after every commit, never during render. The sink only ever fires from a browser
  // event, which is always after a commit, so it always sees the operator's latest text.
  useEffect(() => {
    composerRef.current = conversation.composerValue;
    changeRef.current = conversation.onComposerChange;
  });

  /*
   * 1. TRANSCRIPT IN. The mounted surface claims the sink; unmounting releases it. Because surfaces
   * are mutually exclusive, exactly one composer is ever the target, and a surface switch hands the
   * sink over rather than duplicating it.
   */
  const register = runtime?.registerTranscriptSink;
  useEffect(() => {
    if (!register) return;
    return register((transcript) => {
      changeRef.current(mergeTranscriptIntoComposer(composerRef.current, transcript));
    });
  }, [register]);

  /*
   * 2. ANSWER OUT. Only the human-facing answer text — never provenance, evidence, limitations,
   * record refs, conversation ids, or anything else the operator cannot already read on screen.
   */
  const spokenAnswer = useMemo(() => selectSpokenAnswer(conversation.turns), [conversation.turns]);
  const announce = runtime?.announceAnswer;
  useEffect(() => {
    announce?.(spokenAnswer);
  }, [announce, spokenAnswer]);

  /* 4. REVIEW CLOSED. Wrapping the operator's submit — never calling it. */
  const resolveReview = runtime?.resolveReview;
  const conversationSubmit = conversation.onSubmit;
  const onSubmit = useCallback(() => {
    resolveReview?.();
    conversationSubmit();
  }, [conversationSubmit, resolveReview]);

  /* The composer's voice view model. `busy` is the conversation's, so voice defers to it. */
  const voice = useMemo<HebyVoiceView | undefined>(() => {
    if (!runtime) return undefined;
    return {
      state: runtime.state,
      capability: runtime.capability,
      outputEnabled: runtime.outputEnabled,
      failure: runtime.failure,
      disclosureLines: runtime.disclosureLines,
      busy: conversation.busy,
      language: runtime.language,
      recognitionLocality: runtime.recognitionLocality,
      mediaStalled: runtime.mediaStalled,
      installStatus: runtime.installStatus,
      onSelectLanguage: runtime.onSelectLanguage,
      onInstallOnDevice: runtime.onInstallOnDevice,
      onActivate: runtime.onActivate,
      onAcknowledge: runtime.onAcknowledge,
      onStop: runtime.onStop,
      onCancel: runtime.onCancel,
      onToggleOutput: runtime.onToggleOutput,
      onStopSpeaking: runtime.onStopSpeaking,
    };
  }, [runtime, conversation.busy]);

  /* 3. PRESENCE, arbitrated once. */
  const presence = resolveHebyPresence({
    conversation: conversation.presence,
    voice: runtime?.state ?? null,
  });

  return { presence, audioLevel: runtime?.audioLevel, voice, onSubmit };
}
