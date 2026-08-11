"use client";

/*
 * heby-quick-panel.tsx — the Heby QUICK PANEL surface (HW3).
 *
 * The second of Heby's two presentation surfaces, and deliberately NOT a shrunken copy of the first:
 *
 *   QUICK PANEL     "ask without leaving my work" — contextual, immediate, CONVERSATION-FIRST. The
 *                   current Hebun workspace stays visible beside it and is the truthful context.
 *   FULL WORKSPACE  "enter Heby's dedicated workspace" — immersive, presence-first when empty.
 *
 * SAME HEBY, DIFFERENT JOB. It shares the surface tokens (`.heby-surface`), the typography, the
 * Heby green, the turn styling, the provenance language, the evidence disclosure, the advisory
 * boundary and the one composer — so it is unmistakably the same product. It does NOT inherit the
 * immersive hero composition: the central presence field belongs to the Full Workspace, and forcing
 * it into 27rem would produce a worse version of both surfaces. Here Heby's identity is a compact
 * presence mark that carries the same truthful state.
 *
 * It is NOT a second Heby. It renders the same turns from the same durable conversation, driven by
 * the same shared conversation hook, which has the only dispatch site into the only server action.
 *
 * Pure presentation: every value is a prop, every action a callback. It calls no server action,
 * parses no slash command, holds no conversation authority, and executes nothing.
 */

import { useEffect, useRef } from "react";
import { Plus, X, CornerDownLeft } from "lucide-react";
import type { HebyCommandDescriptor } from "@/features/heby-commands";
import { HebyTurnList, type HebyTurnView } from "./heby-turns";
import { HebyVisualizer, type HebyPresenceState } from "./heby-visualizer";
import { HebyComposer } from "./heby-composer";
import type { HebyVoiceView } from "./heby-voice-control";
import type { HebyCommandOutput, HebyConversationFacts } from "./use-heby-conversation";

export interface HebyQuickPanelProps {
  /** The workspace the operator is on. Resolved through the closed registry, never scraped. */
  readonly contextLabel: string;
  /** The authority boundary Heby operates under in this context. */
  readonly authorityLabel: string;
  readonly turns: readonly HebyTurnView[];
  readonly pending: string | null;
  /** A MODEL request is in flight. Drives the presence field and the responding turn. */
  readonly asking: boolean;
  /** The seam is busy with a model request OR a server read. Disables the composer only. */
  readonly busy: boolean;
  readonly presence: HebyPresenceState;
  /**
   * Normalized 0–1 microphone amplitude, MEASURED. The compact presence mark reads it only while it
   * is genuinely `listening`.
   */
  readonly audioLevel?: number;
  /** The one voice runtime's view model — the SAME runtime the Full Workspace uses. */
  readonly voice?: HebyVoiceView;
  readonly notice: { readonly tone: "warn"; readonly text: string } | null;
  readonly commandOutput: HebyCommandOutput | null;
  readonly facts: HebyConversationFacts;
  readonly composerValue: string;
  readonly suggestions: readonly string[];
  readonly paletteItems: readonly HebyCommandDescriptor[];
  readonly paletteIndex: number;
  /**
   * Close the panel. It ONLY hides this surface: no durable conversation is deleted, no provider
   * state is touched, no server history is cleared, and the current workspace is not navigated away.
   */
  readonly onClose: () => void;
  readonly onComposerChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onNewConversation: () => void;
  readonly onSuggestion: (value: string) => void;
  readonly onPaletteMove: (delta: number) => void;
  readonly onPaletteSelect: (commandId: string) => void;
  readonly onPaletteClose: () => void;
  readonly onDismissCommandOutput: () => void;
}

export function HebyQuickPanel(props: HebyQuickPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onClose } = props;
  const empty = props.turns.length === 0 && props.pending === null && !props.asking;

  // Follow the newest turn. The Quick Panel is conversation-first at every size, so there is no
  // hero exception here.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [props.turns.length, props.pending, props.asking]);

  /*
   * Escape closes the panel — but only when nothing nearer has already claimed the key. The command
   * palette calls preventDefault() on its own Escape, so `defaultPrevented` is the handshake: it
   * lets the operator dismiss the palette without losing the panel (or what they typed).
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      aria-label="Heby"
      data-heby-surface="quick-panel"
      /*
       * A right-hand overlay that leaves the current workspace visible — the whole point of this
       * surface. It sits BELOW the topbar so the control that opened it stays reachable to close it.
       * Mobile widens it to a full sheet; that is still the QUICK_PANEL state, not a third
       * architecture.
       */
      className="heby-surface fixed bottom-0 left-0 right-0 top-(--topbar-h) z-(--z-overlay) flex flex-col border-l border-border bg-background bg-(image:--heby-canvas) text-fg shadow-2xl sm:left-auto sm:w-[27rem] md:w-[29rem] lg:w-[27rem]"
    >
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* Compact presence identity — the same truthful states, without the immersive field. */}
          <HebyVisualizer state={props.presence} audioLevel={props.audioLevel} size="inline" captionHidden />
          <div className="flex min-w-0 flex-col">
            <p className="text-[0.85rem] font-semibold tracking-tight text-fg">Heby</p>
            <p className="truncate text-[0.7rem] text-fg-muted">
              {props.contextLabel} · {props.authorityLabel}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="New conversation"
            title="New conversation"
            onClick={props.onNewConversation}
            className="flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Close Heby panel"
            onClick={props.onClose}
            className="flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        {empty ? (
          <div className="flex flex-col gap-4">
            <p className="text-[0.82rem] leading-6 text-fg-muted">
              Ask about {props.contextLabel}{" "}
              without leaving it. Heby answers from the current read models, shows its evidence, and
              says honestly when it can&rsquo;t.
            </p>
            <div className="flex flex-col gap-1.5">
              {props.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => props.onSuggestion(suggestion)}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-surface/60 px-3.5 py-2.5 text-left text-[0.82rem] leading-5 text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                >
                  <span className="min-w-0">{suggestion}</span>
                  <CornerDownLeft
                    className="size-3 shrink-0 text-fg-muted transition-colors group-hover:text-highlight"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <HebyTurnList turns={props.turns} pending={props.pending} asking={props.asking} />
        )}
      </div>

      <div className="shrink-0 px-4 pb-4">
        <HebyComposer
          density="panel"
          autoFocus
          voice={props.voice}
          composerValue={props.composerValue}
          asking={props.busy}
          notice={props.notice}
          commandOutput={props.commandOutput}
          facts={props.facts}
          paletteItems={props.paletteItems}
          paletteIndex={props.paletteIndex}
          onComposerChange={props.onComposerChange}
          onSubmit={props.onSubmit}
          onPaletteMove={props.onPaletteMove}
          onPaletteSelect={props.onPaletteSelect}
          onPaletteClose={props.onPaletteClose}
          onDismissCommandOutput={props.onDismissCommandOutput}
        />
      </div>
    </aside>
  );
}
