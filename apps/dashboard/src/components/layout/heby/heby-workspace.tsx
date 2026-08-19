"use client";

/*
 * heby-workspace.tsx — the Heby FULL WORKSPACE surface (HW1 structure, HW2 visual language, HW3
 * dual-surface + composition refinement, G7 spatial canvas).
 *
 * One of Heby's two presentation surfaces. Its job is distinct and deliberate:
 *
 *   FULL WORKSPACE   "enter Heby's dedicated workspace" — a spatial canvas with Heby at its centre.
 *   QUICK PANEL      "ask without leaving my work" — contextual, conversation-first (see
 *                    heby-quick-panel.tsx). Same Heby, same authority, same memory; different job.
 *
 * ── WHAT G7 REPLACED, AND WHAT IT REFUSED TO TOUCH ──────────────────────────
 *
 * The approved reference makes Heby the dominant presence on a dark spatial canvas, with a
 * contextual rail beside it and conversation EMERGING from the surface rather than permanently
 * occupying it. That is a change to this file's composition — the arrangement of the presence, the
 * transcript, the rail and the composer — and to nothing else.
 *
 * It is not a change to Heby's colour in this file: not one colour literal appears here. The amber
 * language is a scoped token override on `.heby-surface` in globals.css, which is why the presence
 * field's released geometry, determinism and six-state truthfulness proofs still guard the new look
 * instead of having been rewritten for it.
 *
 * It is not a change to authority. This file stays PURE PRESENTATION: every value arrives as a prop
 * and every action is a callback, so it holds no conversation authority, calls no server action,
 * performs no read, and is provable with renderToStaticMarkup.
 *
 * ── COMPOSITION — three modes, driven by REAL conversation state ────────────
 *
 *   HERO          nothing said yet. The presence field is the anchor; the two REAL peripheral
 *                 labels sit in its visual field rather than at the far edges of the screen.
 *   EMERGING      the conversation has just begun. The presence stays visible but compact above
 *                 the transcript, and the atmosphere is already receding.
 *   CONVERSATION  the thread is the product. The presence collapses to an inline header mark, the
 *                 atmosphere recedes further, and reading owns the room.
 *
 * ── THE COMPOSER EMERGES; IT IS NEVER UNMOUNTED ─────────────────────────────
 *
 * "Conversation emerges from the surface" is implemented as a presentation state on a dock that is
 * ALWAYS in the document and always tabbable (see `resolveHebyDock`). Hiding an input behind a
 * hover would put it out of reach of a keyboard, a touch screen and a screen reader, and would hide
 * the notice line that explains why Heby cannot answer. A draft, an in-flight request, an open
 * microphone and an unavailable surface each force the dock forward.
 *
 * ── HONESTY RULES BAKED INTO THE LAYOUT ─────────────────────────────────────
 *  - Every peripheral label is backed by an authoritative value the server already resolved
 *    (context, authority boundary, evidence count, provenance of the latest answer). When there is
 *    nothing true to show, the element is ABSENT — never a placeholder, a dash, or a zero.
 *  - There is no health, memory, reasoning, organization, research, agent, event or approval
 *    readout, and no "online"/"active"/"synced"/"scanning" state, because no authoritative read
 *    seam exists for any of them.
 *  - The presence field is driven by real UI/runtime state only (see heby-visualizer.tsx).
 *  - The depth floor is decorative and STATIC. It is a function of no value, because a moving field
 *    beneath Heby would be read as activity and Heby has no activity to report.
 *  - The rail renders only what a read seam returned, and renders nothing when it returned nothing.
 */

import { useEffect, useRef, useState } from "react";
import { Plus, CornerDownLeft, ArrowLeft, ChevronsRight, ChevronsLeft } from "lucide-react";
import type { HebyCommandDescriptor } from "@/features/heby-commands";
import { resolveHebyComposition, resolveHebyDock, shouldFollowLatest } from "@/features/heby-surface";
import type { HebyStreamState } from "@/features/heby-stream";
import { HebyTurnList, type HebyTurnView } from "./heby-turns";
import { HebyVisualizer, type HebyPresenceState } from "./heby-visualizer";
import { HebyComposer } from "./heby-composer";
import { HebyStreamRail } from "./heby-stream-rail";
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
   * G7 — the contextual rail's content, projected SERVER-SIDE from a real read.
   *
   * Optional, and absent means the rail is not rendered at all. That is not the same as an empty
   * rail: `{ status: "empty" }` is a read that returned no rows and says so, whereas an omitted
   * stream is a surface that was never given one. Nothing here can synthesize either.
   */
  readonly stream?: HebyStreamState;
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
  /*
   * Real pointer and focus facts about the dock region. They are UI state and nothing else: they
   * say where the operator's attention is, and they are the only inputs the dock rule takes that
   * are not already derived from the conversation.
   */
  const [pointerInDock, setPointerInDock] = useState(false);
  const [focusInDock, setFocusInDock] = useState(false);
  /*
   * Whether the contextual rail is showing. Presentation state, local, and starting OPEN: a rail
   * fed by a real read should be visible by default, and putting it away is the operator's choice
   * rather than a state they have to discover. It marks nothing and reads nothing.
   */
  const [railOpen, setRailOpen] = useState(true);

  const composition = resolveHebyComposition({
    turnCount: props.turns.length,
    pending: props.pending,
    asking: props.asking,
  });
  const hero = composition === "hero";
  const follow = shouldFollowLatest(composition);

  const dock = resolveHebyDock({
    composition,
    pointerInDock,
    focusInDock,
    hasDraft: props.composerValue.trim().length > 0,
    busy: props.busy,
    /* Only the two states that mean a device is genuinely in use. Nothing is inferred. */
    voiceActive: props.voice?.state === "listening" || props.voice?.state === "speaking",
    unavailable: props.presence === "unavailable" || props.notice !== null,
  });
  const inviting = dock === "inviting";

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
      data-heby-dock={dock}
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
       * ── THE CANVAS ────────────────────────────────────────────────────────
       * Heby's field and the contextual rail share the room below the chrome. The rail is a fixed
       * column at `lg` and above and is not rendered below it: on a narrow viewport it would push
       * Heby off the screen, and every record it points at remains reachable through the shell's
       * own navigation, so nothing is lost — only this convenience view of it.
       */}
      <div className="flex min-h-0 flex-1 gap-0 lg:gap-6 lg:px-8 lg:pb-2">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {/*
           * ── THE AMBIENT LAYERS ──────────────────────────────────────────────
           *
           * Three of them, all `aria-hidden`, all pointer-transparent, all behind everything, and
           * all STATIC. Together they are what turns a dark rectangle into a space: light behind
           * the presence, a floor under it, a horizon where the floor ends.
           *
           * NOT ONE OF THEM IS A FUNCTION OF ANY VALUE. There is no prop, no state and no clock in
           * this block — the geometry is constants in CSS. That is deliberate and it is the line
           * between atmosphere and fabricated activity: a drifting field, a pulsing floor or a
           * brightening horizon would each be read as something happening in the organization, and
           * nothing here would be reporting anything. The only motion Heby has is in the presence
           * field, where every state is real and stated in words.
           *
           * They recede together as the conversation grows (CSS, by `data-heby-mode`).
           */}
          <div
            aria-hidden="true"
            className="heby-aurora pointer-events-none absolute left-1/2 top-[40%] h-[min(64rem,150dvh)] w-[min(64rem,150dvh)] -translate-x-1/2 -translate-y-1/2"
          />
          <div aria-hidden="true" className="heby-horizon pointer-events-none absolute inset-x-0 bottom-0 h-[38%]" />
          <div aria-hidden="true" className="heby-floor pointer-events-none absolute inset-x-0 bottom-0 h-2/5" />

          {/*
           * EMERGING — the conversation has started but has not yet earned the whole screen. The
           * presence stays, compact and outside the scroll area so it never obstructs the
           * transcript.
           */}
          {composition === "emerging" ? (
            <div className="flex shrink-0 justify-center px-5 pb-1 pt-1 sm:px-8 lg:px-0">
              <HebyVisualizer state={props.presence} audioLevel={props.audioLevel} size="compact" captionHidden />
            </div>
          ) : null}

          {/* ── CONVERSATION / PRESENCE ─────────────────────────────────────── */}
          <div ref={scrollRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
            {hero ? (
              /*
                `min-h-full`, NOT `flex-1`. A `flex-1` child is exactly the scroll container's
                height, so once its content is taller than that, `justify-center` centres the
                overflow and crops BOTH ends — the framing line and the suggestions disappear off
                a short desktop with no scrollbar to reveal them. With `min-h-full` the block
                centres while it fits and grows (and scrolls) when it does not.
              */
              <div className="flex min-h-full w-full flex-col items-center justify-center gap-3 px-5 py-3 sm:px-8 sm:py-4">
                {/*
                 * The peripheral facts belong to the presence, not to the screen edges. They sit
                 * inside the orb's own visual field on a deliberate diagonal — Context above-left,
                 * Authority below-right — each reading inward along a quiet hairline. Not
                 * symmetrical for the sake of symmetry, and never a ring of readouts around the
                 * orb. Hidden below `lg`, where both values remain visible in the header line
                 * above.
                 */}
                <div className="relative flex w-full max-w-[42rem] items-center justify-center xl:max-w-[58rem]">
                  <div className="absolute left-0 top-[16%] hidden w-40 lg:block">
                    <Fact label="Context" value={props.contextLabel} side="left" />
                  </div>

                  <HebyVisualizer state={props.presence} audioLevel={props.audioLevel} size="hero" />

                  <div className="absolute bottom-[14%] right-0 hidden w-40 lg:block">
                    <Fact label="Authority" value={props.authorityLabel} side="right" />
                  </div>
                </div>

              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-6 px-5 py-6 sm:px-8">
                <HebyTurnList turns={props.turns} pending={props.pending} asking={props.asking} />
              </div>
            )}
          </div>

          {/* ── COMPOSER DOCK ──────────────────────────────────────────────────
            * The dock is ALWAYS mounted, always tabbable and always clickable. `resting` dims and
            * lowers it so the empty canvas belongs to Heby; it never removes it, never blocks the
            * pointer, and never hides the notice line. The hint below is a real affordance, not an
            * instruction the operator must obey — clicking, tabbing or typing all work regardless.
            */}
          <div
            data-heby-dock-zone={dock}
            onPointerEnter={() => setPointerInDock(true)}
            onPointerLeave={() => setPointerInDock(false)}
            onFocus={() => setFocusInDock(true)}
            onBlur={() => setFocusInDock(false)}
            className="relative shrink-0 px-5 pb-5 pt-2 sm:px-8 sm:pb-6 lg:px-0"
          >
            <div
              className={`mx-auto flex w-full max-w-[52rem] flex-col transition-[opacity,transform] duration-(--dur-base) ${
                inviting ? "opacity-100" : "opacity-55 motion-safe:translate-y-1"
              }`}
            >
              {/*
                THE FRAMING LINE LIVES ON THE DOCK TOO, AND FOR A BETTER REASON THAN SPACE.

                It says where the answers come from and what happens when there is no evidence —
                which is a statement about what the field below will do, not about the presence
                above it. Under the orb it also competed for the room the presence needed; here it
                reads as the terms of the thing you are about to use. The hero is now the presence
                and its two real labels, and nothing else.
              */}
              {hero ? (
                <p className="mb-2 text-center text-[0.78rem] leading-5 text-fg-muted">
                  Answers about {props.contextLabel} come from the current read models, with their
                  evidence — or a plain statement that there is none.
                </p>
              ) : null}

              {/*
                SUGGESTIONS LIVE ON THE DOCK, NOT IN THE PRESENCE FIELD.

                They were under the orb, which put them inside a scroll region sized by whatever
                the presence left over — so on a real 900px desktop, inside the Hebun shell, they
                scrolled out of sight. They are prompts for the composer, so they belong with the
                composer: always visible, always the same distance from the field they fill, and no
                longer competing with Heby for the centre of the canvas.
              */}
              {hero && props.suggestions.length > 0 ? (
                <div className="mb-2.5 flex flex-wrap items-center justify-center gap-2">
                  {props.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => props.onSuggestion(suggestion)}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3.5 py-1.5 text-[0.75rem] leading-5 text-fg-muted transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                    >
                      <span className="min-w-0">{suggestion}</span>
                      <CornerDownLeft
                        className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              ) : null}

              {/*
                The invitation, in hero mode only, and only while the dock is resting. It describes
                what already works rather than gating anything: the field below is focusable and
                clickable in every state, so a reader who ignores this line loses nothing.
              */}
              {hero && !inviting ? (
                <p
                  data-heby-dock-hint=""
                  className="mb-2 text-center text-[0.68rem] leading-5 text-fg-muted"
                >
                  The field below is ready when you are.
                </p>
              ) : null}
              <HebyComposer
                density="workspace"
                /*
                 * NOT auto-focused on the empty canvas. Stealing focus there would park a lit
                 * composer across the bottom of the surface the reference gives to Heby, and would
                 * make the dock's resting state unreachable in practice. Once a conversation
                 * exists the operator is working, and focus follows them back to the field.
                 */
                autoFocus={!hero}
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
        </div>

        {/*
         * The contextual rail. Rendered only when the container was actually given a stream, so a
         * surface with no read behind it shows no rail rather than an empty frame implying one.
         *
         * IT CAN BE PUT AWAY, because Heby must be able to be the only thing on the canvas. The
         * control is a width, exactly like the Quick Panel's: dismissing it reads nothing, marks
         * nothing, and asserts nothing about the records — they are still pending, and still at
         * `/approvals`. It is not a "mark all seen", and there is no such act anywhere near it.
         */}
        {props.stream ? (
          <div className="hidden shrink-0 pb-4 lg:block">
            {railOpen ? (
              <div className="flex h-full w-[19rem] flex-col gap-2">
                <div className="flex shrink-0 justify-end">
                  <button
                    type="button"
                    aria-label="Hide Hebun Akışı"
                    aria-expanded={railOpen}
                    data-heby-rail-hide=""
                    onClick={() => setRailOpen(false)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[0.62rem] font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                  >
                    <ChevronsRight className="size-3" aria-hidden="true" />
                    Hide
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <HebyStreamRail stream={props.stream} />
                </div>
              </div>
            ) : (
              <div className="flex h-full w-10 justify-center pt-1">
                <button
                  type="button"
                  aria-label="Show Hebun Akışı"
                  aria-expanded={railOpen}
                  data-heby-rail-show=""
                  onClick={() => setRailOpen(true)}
                  className="flex size-9 items-center justify-center rounded-full border border-border/60 text-fg-muted transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                >
                  <ChevronsLeft className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
