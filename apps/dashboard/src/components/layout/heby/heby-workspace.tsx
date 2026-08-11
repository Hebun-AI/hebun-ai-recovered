"use client";

/*
 * heby-workspace.tsx — the Heby FULL WORKSPACE surface (HW1 structure, HW2 visual language, HW3
 * dual-surface + composition refinement).
 *
 * One of Heby's two presentation surfaces. Its job is distinct and deliberate:
 *
 *   FULL WORKSPACE   "enter Heby's dedicated workspace" — immersive, presence-first when empty.
 *   QUICK PANEL      "ask without leaving my work" — contextual, conversation-first (see
 *                    heby-quick-panel.tsx). Same Heby, same authority, same memory; different job.
 *
 * Pure presentation. Every value arrives as a prop and every action is a callback, so it holds no
 * conversation authority, calls no server action, and is provable with renderToStaticMarkup. The
 * shared conversation hook owns state; this owns composition.
 *
 * COMPOSITION — three modes, driven by REAL conversation state, so the operator is never trapped in
 * a hero screen and Heby's identity never vanishes the instant they type:
 *
 *   HERO          nothing said yet. The presence field is the anchor; the two REAL peripheral
 *                 labels sit in its visual field rather than at the far edges of the screen.
 *   EMERGING      the conversation has just begun. The presence stays visible but compact above
 *                 the transcript, and the atmosphere is already receding.
 *   CONVERSATION  the thread is the product. The presence collapses to an inline header mark, the
 *                 atmosphere recedes further, and reading owns the room.
 *
 * HONESTY RULES BAKED INTO THE LAYOUT:
 *  - Every peripheral label is backed by an authoritative value the server already resolved
 *    (context, authority boundary, evidence count, provenance of the latest answer). When there is
 *    nothing true to show, the element is ABSENT — never a placeholder, a dash, or a zero.
 *  - There is no health, memory, reasoning, organization, research, agent, event or approval
 *    readout, and no "online"/"active"/"synced"/"scanning" state, because no authoritative read
 *    seam exists for any of them.
 *  - The presence field is driven by real UI/runtime state only (see heby-visualizer.tsx).
 */

import { useEffect, useRef } from "react";
import { Plus, CornerDownLeft, ArrowLeft } from "lucide-react";
import type { HebyCommandDescriptor } from "@/features/heby-commands";
import { resolveHebyComposition, shouldFollowLatest } from "@/features/heby-surface";
import { HebyTurnList, type HebyTurnView } from "./heby-turns";
import { HebyVisualizer, type HebyPresenceState } from "./heby-visualizer";
import { HebyComposer } from "./heby-composer";
import type { HebyVoiceView } from "./heby-voice-control";
import type { HebyCommandOutput, HebyConversationFacts } from "./use-heby-conversation";

/** Re-exported so existing callers keep one import site for the surface's shared view types. */
export type { HebyCommandOutput } from "./use-heby-conversation";
export type HebyWorkspaceFacts = HebyConversationFacts;

export interface HebyWorkspaceProps {
  /** What Heby is actually looking at, resolved SERVER-SIDE. */
  readonly contextLabel: string;
  /** The authority boundary Heby operates under on this context. */
  readonly authorityLabel: string;
  readonly turns: readonly HebyTurnView[];
  /** In-flight user text (optimistic presentation only; never authoritative). */
  readonly pending: string | null;
  /** A MODEL request is in flight. Drives the presence field and the responding turn. */
  readonly asking: boolean;
  /** The seam is busy with a model request OR a server read. Disables the composer only. */
  readonly busy: boolean;
  readonly presence: HebyPresenceState;
  /**
   * Normalized 0–1 microphone amplitude, MEASURED. The presence field reads it only while it is
   * genuinely `listening`; supplying it in any other state changes nothing.
   */
  readonly audioLevel?: number;
  /** The one voice runtime's view model, or undefined where voice is not attached. */
  readonly voice?: HebyVoiceView;
  /** A truthful non-answer notice (sign-in required / prompt rejected). */
  readonly notice: { readonly tone: "warn"; readonly text: string } | null;
  /** The result of the most recent slash command, if any. */
  readonly commandOutput: HebyCommandOutput | null;
  /** Peripheral facts — only ever what an authoritative source produced. */
  readonly facts: HebyConversationFacts;
  readonly composerValue: string;
  readonly suggestions: readonly string[];
  /** Command palette (open only while the composer holds a "/…" token). */
  readonly paletteItems: readonly HebyCommandDescriptor[];
  readonly paletteIndex: number;
  /**
   * The workspace the operator returns to when they leave Heby. Server-validated through the
   * closed workspace allow-list — never a client-supplied URL.
   */
  readonly returnLabel: string;
  /** Leave the Full Workspace. Presentation only: it ends no conversation and deletes nothing. */
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

/**
 * A peripheral label anchored to the presence field. Rendered only when the caller has a real value
 * for it. Its relationship to Heby is built from typography, spacing and one quiet hairline — never
 * from card chrome, and never as fabricated telemetry orbiting the orb.
 */
function Fact({
  label,
  value,
  side,
}: {
  readonly label: string;
  readonly value: string;
  /** Which side of the presence this label sits on; it reads INWARD, toward Heby. */
  readonly side: "left" | "right";
}) {
  const inward = side === "left";
  return (
    <div className={`flex flex-col gap-1.5 ${inward ? "items-end text-right" : "items-start text-left"}`}>
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-fg-muted">{label}</span>
      <span className="text-[0.8rem] leading-5 text-fg-secondary">{value}</span>
      <span
        aria-hidden="true"
        className={`h-px w-9 ${
          inward ? "bg-linear-to-r from-transparent to-highlight/30" : "bg-linear-to-l from-transparent to-highlight/30"
        }`}
      />
    </div>
  );
}

export function HebyWorkspace(props: HebyWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const composition = resolveHebyComposition({
    turnCount: props.turns.length,
    pending: props.pending,
    asking: props.asking,
  });
  const hero = composition === "hero";
  const follow = shouldFollowLatest(composition);

  // Auto-scroll toward the newest message — never in hero mode, where the presence field is the
  // composition's anchor and scrolling to the bottom would crop it. No-op during SSR.
  useEffect(() => {
    if (!follow) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [follow, composition, props.turns.length, props.pending, props.asking]);

  return (
    <section
      aria-label="Heby workspace"
      data-heby-surface="full-workspace"
      data-heby-mode={composition}
      /*
       * The workspace occupies the shell's content region exactly: the negative margins cancel the
       * shell's own padding, and a FIXED height (not min-height) makes the flex children share the
       * space — header and composer never shrink, only the conversation scrolls. The page itself
       * therefore never scrolls, and the composer stays reachable on short viewports.
       */
      className="heby-surface heby-workspace -mx-4 -my-5 flex h-[calc(100dvh-var(--topbar-h))] flex-col overflow-hidden bg-background bg-(image:--heby-canvas) text-fg sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-7"
    >
      {/* ── TOP BAR ─────────────────────────────────────────────────────────────
        * Identity, the context Heby actually has, its authority boundary, the way back out, and
        * New Conversation. No connectivity indicator: none would be truthful.
        */}
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {/* Once the thread is the product, the presence collapses to an inline mark. */}
          {composition === "conversation" ? (
            <HebyVisualizer state={props.presence} audioLevel={props.audioLevel} size="inline" captionHidden />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[0.95rem] font-semibold tracking-tight text-fg">Heby</h1>
            <p className="truncate text-xs text-fg-muted">
              {props.contextLabel} · {props.authorityLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/*
           * An explicit way out. The rail control is a true toggle, but browser Back must never be
           * the only exit from the surface the operator dropped into.
           */}
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/50 hover:bg-highlight/5 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Back to {props.returnLabel}</span>
            <span className="sm:hidden">Back</span>
          </button>
          <button
            type="button"
            onClick={props.onNewConversation}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/50 hover:bg-highlight/5 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">New conversation</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/*
       * EMERGING — the conversation has started but has not yet earned the whole screen. The
       * presence stays, compact and outside the scroll area so it never obstructs the transcript.
       */}
      {composition === "emerging" ? (
        <div className="flex shrink-0 justify-center px-5 pb-1 pt-1 sm:px-8">
          <HebyVisualizer state={props.presence} audioLevel={props.audioLevel} size="compact" captionHidden />
        </div>
      ) : null}

      {/* ── CONVERSATION / PRESENCE ─────────────────────────────────────────── */}
      <div ref={scrollRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {hero ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-6 sm:gap-8 sm:px-8 sm:py-10">
            {/*
             * The peripheral facts belong to the presence, not to the screen edges. They sit inside
             * the orb's own visual field on a deliberate diagonal — Context above-left, Authority
             * below-right — each reading inward along a quiet hairline. Not symmetrical for the
             * sake of symmetry, and never a ring of readouts around the orb. Hidden below `lg`,
             * where both values remain visible in the header line above.
             */}
            <div className="relative flex w-full max-w-[42rem] items-center justify-center">
              <div className="absolute left-0 top-[16%] hidden w-40 lg:block">
                <Fact label="Context" value={props.contextLabel} side="left" />
              </div>

              <HebyVisualizer state={props.presence} audioLevel={props.audioLevel} size="hero" />

              <div className="absolute bottom-[14%] right-0 hidden w-40 lg:block">
                <Fact label="Authority" value={props.authorityLabel} side="right" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2.5 text-center">
              <p className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">How can I help?</p>
              <p className="max-w-[32rem] text-sm leading-6 text-fg-muted">
                Ask about {props.contextLabel}. Heby answers from the current read models, shows its
                evidence, and says honestly when it can&rsquo;t.
              </p>
            </div>

            <div className="flex w-full max-w-[38rem] flex-col gap-2">
              {props.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => props.onSuggestion(suggestion)}
                  className="group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/60 px-5 py-3 text-left text-sm text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                >
                  <span className="min-w-0">{suggestion}</span>
                  <CornerDownLeft
                    className="size-3.5 shrink-0 text-fg-muted transition-colors group-hover:text-highlight"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-6 px-5 py-6 sm:px-8">
            <HebyTurnList turns={props.turns} pending={props.pending} asking={props.asking} />
          </div>
        )}
      </div>

      {/* ── COMPOSER ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-5 sm:px-8 sm:pb-6">
        <div className="mx-auto flex w-full max-w-[52rem] flex-col">
          <HebyComposer
            density="workspace"
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
      </div>
    </section>
  );
}
