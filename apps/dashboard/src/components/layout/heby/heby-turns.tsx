/*
 * heby-turns.tsx — the reusable conversation rendering for Heby (HW1 extraction, HW2 visual
 * language). Exactly ONE component knows how a Heby turn looks.
 *
 * It renders a caller-built `turns` view model and holds NO conversation authority of its own — the
 * durable server conversation is authoritative, and the container composes `turns` from it. All
 * data arrives as props, so this is renderable (and provable) with renderToStaticMarkup.
 *
 * HW2 presentation: the operator's turns are compact, right-aligned cards; Heby's turns are
 * full-width prose anchored by a presence mark and a thin accent rule, so Heby reads as speaking
 * INTO the workspace rather than as the other party in a messenger thread. Roles carry a stable
 * `data-heby-role` attribute, so the distinction is asserted structurally rather than by colour.
 *
 * Truthful by construction: provenance is human-readable but never claims "connected"/"healthy";
 * a turn that was not durably saved says so; database ids are React keys only and are never
 * rendered; no secret can reach this layer because none is ever passed to it.
 */

import { Sparkles, ChevronRight } from "lucide-react";
import type { ProvenanceBadge, ProvenanceTone } from "./heby-provenance";

export interface HebyEvidenceRef {
  readonly sourceClass: string;
  readonly recordRef: string;
}

export interface HebyTurnView {
  /** React key only — never a rendered database id. */
  readonly key: string;
  readonly role: "user" | "heby";
  readonly content: string;
  /** Heby turns only. */
  readonly provenance?: ProvenanceBadge | null;
  /** False → this turn was not durably saved (shown for this session only). */
  readonly durable: boolean;
  /** Newest Heby turn only — the server-returned evidence for THAT response. */
  readonly evidence?: readonly HebyEvidenceRef[];
  /** Newest Heby turn only — the response's honest limitations. */
  readonly limitations?: readonly string[];
}

const TONE_TEXT: Record<ProvenanceTone, string> = {
  muted: "text-fg-muted",
  warn: "text-warning",
  info: "text-info",
};
const TONE_DOT: Record<ProvenanceTone, string> = {
  muted: "bg-fg-muted",
  warn: "bg-warning",
  info: "bg-info",
};

/** Turns fade in. Presentation only — it says nothing about the turn's content or freshness. */
const ENTER = "motion-safe:[animation:heby-turn-in_var(--dur-base)_var(--ease-out)_both]";

export function ProvenancePill({ badge }: { badge: ProvenanceBadge }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.68rem] font-medium ${TONE_TEXT[badge.tone]}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[badge.tone]}`} aria-hidden="true" />
      {badge.label}
    </span>
  );
}

function Disclosure({
  summary,
  children,
}: {
  readonly summary: string;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="text-[0.72rem]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-fg-muted transition-colors hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight">
        <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
        {summary}
      </summary>
      {children}
    </details>
  );
}

export function UserBubble({ content }: { content: string }) {
  return (
    <li data-heby-role="user" className={`flex justify-end ${ENTER}`}>
      <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-border-strong/60 bg-surface-raised px-4 py-2.5 text-[0.95rem] leading-6 text-fg">
        {content}
      </div>
    </li>
  );
}

export function HebyBubble({ turn }: { turn: HebyTurnView }) {
  return (
    <li data-heby-role="heby" className={`flex flex-col gap-2.5 ${ENTER}`}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-highlight/25 bg-highlight/10 text-highlight"
          aria-hidden="true"
        >
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1 border-l border-highlight/15 pl-4">
          <div className="whitespace-pre-wrap break-words text-[0.95rem] leading-7 text-fg-secondary">
            {turn.content}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {turn.provenance ? <ProvenancePill badge={turn.provenance} /> : null}
            {!turn.durable ? (
              <span className="text-[0.68rem] text-fg-muted">Not saved — shown for this session only.</span>
            ) : null}
            {turn.evidence && turn.evidence.length > 0 ? (
              <Disclosure summary={`Evidence (${turn.evidence.length})`}>
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-4 text-fg-secondary">
                  {turn.evidence.map((item) => (
                    <li key={`${item.sourceClass}-${item.recordRef}`}>
                      {item.sourceClass} · {item.recordRef}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            ) : null}
            {turn.limitations && turn.limitations.length > 0 ? (
              <Disclosure summary="What this answer is (and isn’t)">
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-4 text-fg-muted">
                  {turn.limitations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Disclosure>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

/** The chronological thread. Order is the caller's; this renders it and nothing else. */
export function HebyTurnList({
  turns,
  pending,
  asking,
}: {
  readonly turns: readonly HebyTurnView[];
  /** In-flight user text (optimistic presentation only; never authoritative). */
  readonly pending: string | null;
  readonly asking: boolean;
}) {
  return (
    <ul aria-label="Conversation" className="flex flex-col gap-7">
      {turns.map((turn) =>
        turn.role === "user" ? (
          <UserBubble key={turn.key} content={turn.content} />
        ) : (
          <HebyBubble key={turn.key} turn={turn} />
        ),
      )}
      {pending !== null ? <UserBubble content={pending} /> : null}
      {asking ? (
        <li className="flex items-center gap-3 text-xs text-fg-muted" aria-live="polite">
          <span
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-highlight/25 bg-highlight/10 text-highlight"
            aria-hidden="true"
          >
            <Sparkles className="size-3.5 motion-safe:animate-pulse" />
          </span>
          Heby is responding…
        </li>
      ) : null}
    </ul>
  );
}
