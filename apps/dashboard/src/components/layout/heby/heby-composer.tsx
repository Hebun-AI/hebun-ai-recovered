"use client";

/*
 * heby-composer.tsx — THE Heby composer, shared by both presentation surfaces (HW3).
 *
 * The Quick Panel and the Full Workspace must feel like the same Heby, so they do not each own a
 * composer: they own a DENSITY. One component holds the keyboard semantics (Enter sends,
 * Shift+Enter is a newline, "/" opens command discovery), the command palette, the ephemeral
 * command-output block, the truthful peripheral facts, and the advisory boundary line.
 *
 * Pure presentation. Every value arrives as a prop and every action is a callback, so it holds no
 * conversation authority, calls no server action, parses no command, and is provable with
 * renderToStaticMarkup. It never string-matches a slash command — classification belongs to the one
 * parser, upstream of this file.
 *
 * VOICE V1 LIVES HERE, AND ONLY HERE. There is no second "voice composer": the microphone control
 * sits in this component's own input row and its notices sit above this component's own field, so
 * both surfaces get voice by getting the composer. A recognized transcript is written into THIS
 * field as ordinary text and is then indistinguishable from typing — which is precisely why it
 * cannot bypass the slash parser, the submission gate, or the Director's authority. Voice is
 * optional: with no `voice` prop the composer renders exactly as it did before Voice V1.
 */

import { useEffect, useRef } from "react";
import { Slash, X, ArrowUp, Lock } from "lucide-react";
import { HebyVoiceButtons, HebyVoiceNotices, type HebyVoiceView } from "./heby-voice-control";
import {
  HEBY_CATEGORY_LABELS,
  HEBY_COMMAND_CATEGORIES,
  commandUsage,
  type HebyCommandCategory,
  type HebyCommandDescriptor,
} from "@/features/heby-commands";
import type { HebyCommandOutput, HebyConversationFacts } from "./use-heby-conversation";

/** How much room the composer gets. Same language, different density — never a different composer. */
export type HebyComposerDensity = "workspace" | "panel";

export interface HebyComposerProps {
  readonly density: HebyComposerDensity;
  readonly composerValue: string;
  /** The seam is busy (a model request OR a server read). Disables input; claims nothing. */
  readonly asking: boolean;
  /** A truthful non-answer notice (sign-in required / prompt rejected). */
  readonly notice: { readonly tone: "warn"; readonly text: string } | null;
  /** The result of the most recent slash command, if any. */
  readonly commandOutput: HebyCommandOutput | null;
  /** Peripheral facts — only ever what an authoritative source produced. */
  readonly facts: HebyConversationFacts;
  /** Command palette (open only while the composer holds a "/…" token). */
  readonly paletteItems: readonly HebyCommandDescriptor[];
  readonly paletteIndex: number;
  /** Focus the field on mount. The Quick Panel wants this; the workspace does too. */
  readonly autoFocus?: boolean;
  /**
   * The ONE voice runtime's view model, or undefined where there is none. Absent means no
   * microphone affordance at all — not a disabled one, not a hidden one.
   */
  readonly voice?: HebyVoiceView;
  readonly onComposerChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onPaletteMove: (delta: number) => void;
  /** Selection is by command id — never by the typed text. */
  readonly onPaletteSelect: (commandId: string) => void;
  readonly onPaletteClose: () => void;
  readonly onDismissCommandOutput: () => void;
}

/**
 * Group the matching commands by category, preserving the registry's category order. Pure — the
 * palette shows what the registry declares and adds nothing of its own.
 */
function groupByCategory(
  commands: readonly HebyCommandDescriptor[],
): ReadonlyArray<{ category: HebyCommandCategory; commands: readonly HebyCommandDescriptor[] }> {
  return HEBY_COMMAND_CATEGORIES.map((category) => ({
    category,
    commands: commands.filter((command) => command.category === category),
  })).filter((group) => group.commands.length > 0);
}

/**
 * The honest short label for a command that cannot run. It never reads as a state the command is
 * "in" — it names the thing Hebun is missing.
 */
const AVAILABILITY_LABEL: Record<string, string> = {
  "requires-source": "no source yet",
  "requires-capability": "needs a capability",
  "requires-execution": "needs execution runtime",
};

export function HebyComposer(props: HebyComposerProps) {
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const paletteOpen = props.paletteItems.length > 0;
  const panel = props.density === "panel";

  useEffect(() => {
    if (props.autoFocus) composerRef.current?.focus();
  }, [props.autoFocus]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (paletteOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        props.onPaletteMove(1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        props.onPaletteMove(-1);
        return;
      }
      if (event.key === "Escape") {
        // Consumed here so the surrounding surface does not ALSO treat Escape as "close me".
        event.preventDefault();
        props.onPaletteClose();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const selected = props.paletteItems[props.paletteIndex];
        if (selected) props.onPaletteSelect(selected.id);
        return;
      }
    }
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      props.onSubmit();
    }
  }

  const hintId = panel ? "heby-panel-composer-hint" : "heby-composer-hint";

  return (
    <div className="flex w-full flex-col">
      {/*
       * THE COMMAND RESULT. It is deliberately NOT shaped like a Heby turn: it is labelled with the
       * command that produced it and closes with its own provenance line, so a deterministic local
       * or read result can never be mistaken for something the model generated. An unavailable
       * result renders in a warning tone and never looks runnable.
       */}
      {props.commandOutput ? (
        <div
          data-heby-command-result={props.commandOutput.tone}
          className={`mb-3 rounded-2xl border bg-surface-sunken px-4 ${panel ? "py-2.5" : "py-3"} ${
            props.commandOutput.tone === "unavailable" ? "border-warning/40" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] ${
                props.commandOutput.tone === "unavailable" ? "text-warning" : "text-highlight"
              }`}
            >
              {props.commandOutput.tone === "unavailable" ? (
                <Lock className="size-3" aria-hidden="true" />
              ) : (
                <Slash className="size-3" aria-hidden="true" />
              )}
              {props.commandOutput.command}
            </span>
            <button
              type="button"
              aria-label="Dismiss command output"
              onClick={props.onDismissCommandOutput}
              className="flex size-6 items-center justify-center rounded-md text-fg-muted transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1.5 text-[0.8rem] font-medium text-fg">{props.commandOutput.title}</p>
          <ul className="mt-1.5 flex max-h-64 flex-col gap-1 overflow-y-auto text-[0.8rem] leading-5 text-fg-secondary">
            {props.commandOutput.lines.map((line, index) => (
              <li key={`${index}-${line}`} className="whitespace-pre-wrap">
                {line === "" ? " " : line}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.68rem] leading-4 text-fg-muted">{props.commandOutput.provenance}</p>
        </div>
      ) : null}

      {props.notice ? <p className="mb-2 text-xs leading-5 text-warning">{props.notice.text}</p> : null}

      {/* Voice's own truthful state, above the field it writes into. Silent when nothing is happening. */}
      {props.voice ? <HebyVoiceNotices voice={props.voice} /> : null}

      <div className="relative">
        {/*
         * THE COMMAND PALETTE. Grouped by the registry's own categories, with the inert future last.
         * An unavailable command is SHOWN — hiding it would hurt discovery — but it is dimmed,
         * carries a lock and a short reason, and is announced as disabled, so it can never look
         * runnable. Selection is by command id, never by the typed text.
         */}
        {paletteOpen ? (
          <div
            aria-label="Heby commands"
            role="listbox"
            className="absolute bottom-[calc(100%+0.6rem)] left-0 z-(--z-dropdown) max-h-[22rem] w-full max-w-[30rem] overflow-y-auto rounded-2xl border border-border bg-surface-raised py-1 shadow-lg"
          >
            {groupByCategory(props.paletteItems).map((group) => (
              <div key={group.category}>
                <p className="px-4 pb-1 pt-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-fg-muted">
                  {HEBY_CATEGORY_LABELS[group.category]}
                </p>
                <ul>
                  {group.commands.map((item) => {
                    const index = props.paletteItems.indexOf(item);
                    const runnable = item.availability === "available";
                    const active = index === props.paletteIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          aria-disabled={!runnable}
                          data-heby-command={item.id}
                          data-heby-availability={item.availability}
                          onClick={() => props.onPaletteSelect(item.id)}
                          className={`flex w-full items-baseline gap-2.5 px-4 py-2 text-left transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-highlight ${
                            active
                              ? runnable
                                ? "bg-highlight/10 text-highlight"
                                : "bg-surface-sunken text-fg-secondary"
                              : "text-fg-secondary hover:bg-surface-sunken"
                          } ${runnable ? "" : "opacity-60"}`}
                        >
                          <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold">
                            {runnable ? null : <Lock className="size-3 shrink-0" aria-hidden="true" />}
                            {commandUsage(item)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[0.72rem] text-fg-muted">
                            {item.description}
                          </span>
                          {runnable ? null : (
                            <span className="shrink-0 text-[0.62rem] uppercase tracking-wider text-warning">
                              {AVAILABILITY_LABEL[item.availability] ?? "unavailable"}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {/*
         * The composer is the second visual anchor after Heby itself: a single calm, high-contrast
         * field that belongs to the environment rather than sitting on top of it. It keeps its
         * presence during a long conversation — that matters more than any decorative styling.
         */}
        <form
          /*
           * G7 — `flex-wrap` + a real basis on the field.
           *
           * Found on the authenticated mobile pass: at 390px the language selector, the two voice
           * controls and Send left the field about 150px, so the placeholder wrapped inside a
           * one-row textarea and was clipped mid-word. `min-w-0 flex-1` let it shrink to
           * unusable rather than push anything.
           *
           * Now the field declares the width it needs and the controls move to a second row when
           * they no longer fit beside it. Nothing is hidden and nothing is removed — on a wide
           * viewport the row is unchanged.
           */
          className={`flex flex-wrap items-end justify-end gap-2 border border-border bg-surface/80 transition-colors duration-(--dur-fast) focus-within:border-highlight/45 ${
            panel ? "rounded-[1.4rem] p-1.5" : "rounded-[1.75rem] p-2"
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            props.onSubmit();
          }}
        >
          <textarea
            ref={composerRef}
            value={props.composerValue}
            onChange={(event) => props.onComposerChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Heby…"
            aria-label="Message Heby"
            aria-describedby={hintId}
            rows={1}
            disabled={props.asking}
            className={`min-w-0 grow basis-52 resize-none bg-transparent text-fg outline-none placeholder:text-fg-muted disabled:opacity-60 ${
              panel
                ? "max-h-32 min-h-9 px-3 py-2 text-[0.875rem] leading-6"
                : "max-h-44 min-h-11 px-4 py-2.5 text-[0.95rem] leading-6"
            }`}
          />
          {/*
           * The microphone sits in the composer's own row, beside Send — one input surface with two
           * ways to fill it, never a separate voice widget bolted alongside.
           */}
          {props.voice ? <HebyVoiceButtons voice={props.voice} density={props.density} /> : null}
          <button
            type="submit"
            aria-label="Send"
            disabled={props.asking || props.composerValue.trim().length === 0}
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors duration-(--dur-fast) hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:cursor-not-allowed disabled:opacity-40 ${
              panel ? "size-9" : "size-11"
            }`}
          >
            <ArrowUp className={panel ? "size-4" : "size-5"} aria-hidden="true" />
          </button>
        </form>
      </div>

      <div
        id={hintId}
        className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[0.68rem] leading-4 text-fg-muted"
      >
        <p>
          Enter to send, Shift+Enter for a new line, <span className="font-mono">/</span> for commands.
        </p>
        {/*
         * Peripheral truth, shown ONLY once an answer exists: how much evidence the server
         * returned, and that answer's honest provenance. Absent otherwise — never a zero.
         */}
        <p className="flex items-center gap-3">
          {typeof props.facts.evidenceCount === "number" ? (
            <span>
              {props.facts.evidenceCount} evidence{" "}
              {props.facts.evidenceCount === 1 ? "reference" : "references"}
            </span>
          ) : null}
          {props.facts.latestProvenance ? <span>{props.facts.latestProvenance.label}</span> : null}
        </p>
      </div>

      <p className="mt-1.5 px-1 text-[0.68rem] leading-4 text-fg-muted">
        Heby advises and prepares; it never executes — the authoritative act is yours. Recent
        conversation is context, not organizational fact.
      </p>
    </div>
  );
}
