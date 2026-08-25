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
import type { HebySourceEvidenceGroup } from "@/features/heby-runtime";
import type { RetrievalEvidenceSet } from "@/features/knowledge-retrieval";
import { HebyEvidenceNotRetained, HebyEvidencePanel } from "./heby-evidence";
import { HebySourceEvidencePanel } from "./heby-source-evidence";
import type { ProvenanceBadge, ProvenanceTone } from "./heby-provenance";
import { splitModelDiagnostics } from "./heby-provenance";

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
  /**
   * KR4 — the derived evidence explanation for THIS response, when a Knowledge retrieval ran.
   *
   * Undefined when no retrieval happened at all (a non-Knowledge workspace, or a reloaded turn).
   * That is a different fact from an empty evidence set, and the two render differently.
   */
  readonly knowledgeEvidence?: RetrievalEvidenceSet;
  /**
   * G7 — the NON-KNOWLEDGE records this answer cited, with the standing each asserting class held
   * at answer time. Present on the live answer and on a reloaded one, and equal on both: the live
   * value and the stored rows are one projection over one set of resolutions.
   *
   * Undefined when the answer cited no such record. That is a different fact from an empty list,
   * so the panel is ABSENT rather than empty.
   */
  readonly sourceEvidence?: readonly HebySourceEvidenceGroup[];
  /**
   * True for a durable Heby turn that is NOT this session's latest answer.
   *
   * It means "what follows is a record of what this answer was shown, not a reading of today" —
   * NOT "there is nothing to show". KR5 made the Knowledge set durable and G6D made the source
   * citations durable, so a historical turn usually HAS evidence; the flag is the frame that stops
   * a preserved snapshot being read as a current-state claim.
   */
  readonly historical?: boolean;
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
  /* Partitioned once, so no line is dropped and none is rendered in both places. */
  const { diagnostics: modelDiagnostics, rest: otherLimitations } = splitModelDiagnostics(
    turn.limitations ?? [],
  );
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
            {/*
              KR4. The evidence explanation replaces the bare `sourceClass · recordRef` list when a
              Knowledge retrieval actually ran. The reference list is kept as the fallback for
              sources that have no retrieval behind them (Operations, Platform), because a record
              reference is still more honest than showing nothing.
            */}
            {/*
              G7 RESTRUCTURED THIS FROM A CHAIN INTO THREE INDEPENDENT DECISIONS, and the change is
              not cosmetic.

              KR4 wrote it as an if/else-if because only one of the branches could ever have
              content. That stopped being true at G6D: an answer can cite Knowledge AND its
              tenant's own Governance record in the same breath, and a chain would have shown the
              first and silently dropped the second. Each evidence authority now renders on its
              own terms, so a mixed answer presents as the mixture it was.

              The bare reference list stays as the LAST fallback — for classes with neither a
              Knowledge retrieval nor a source resolution behind them, where a record reference is
              still more honest than showing nothing.
            */}
            {turn.knowledgeEvidence ? (
              <Disclosure
                summary={
                  /*
                   * KR5. A historical turn says so in the summary, before the panel is ever
                   * opened — a reader scanning a restored thread should not have to expand a
                   * disclosure to learn that what is inside is a record rather than a reading of
                   * today's Knowledge.
                   */
                  `${turn.historical ? "Recorded evidence" : "Evidence"}${
                    turn.knowledgeEvidence.status === "matched"
                      ? ` (${turn.knowledgeEvidence.items.length})`
                      : ""
                  }`
                }
              >
                <HebyEvidencePanel
                  set={turn.knowledgeEvidence}
                  historical={turn.historical === true}
                />
              </Disclosure>
            ) : null}

            {turn.sourceEvidence && turn.sourceEvidence.length > 0 ? (
              <Disclosure
                summary={`${turn.historical ? "Recorded sources" : "Sources"} (${turn.sourceEvidence.reduce(
                  (total, group) => total + group.items.length,
                  0,
                )})`}
              >
                <HebySourceEvidencePanel
                  groups={turn.sourceEvidence}
                  historical={turn.historical === true}
                />
              </Disclosure>
            ) : null}

            {!turn.knowledgeEvidence &&
            !(turn.sourceEvidence && turn.sourceEvidence.length > 0) &&
            turn.evidence &&
            turn.evidence.length > 0 ? (
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

            {/*
              THE STALE STATE, FIXED.

              This notice used to render for ANY historical turn that had no Knowledge set, which
              since G6D has included every reloaded answer that cited a Governance record. It said
              evidence was not retained while the retained evidence sat one field away. It is now
              what it was always meant to be: what remains true when a turn genuinely stored
              nothing — an answer produced before these records existed, or one where no retrieval
              and no source resolution ran at all.
            */}
            {turn.historical &&
            !turn.knowledgeEvidence &&
            !(turn.sourceEvidence && turn.sourceEvidence.length > 0) &&
            !(turn.evidence && turn.evidence.length > 0) ? (
              <HebyEvidenceNotRetained />
            ) : null}
            {/*
              * THE MODEL DIAGNOSTIC IS SHOWN, NOT FILED.
              *
              * When the runtime blocks or fails a model attempt it writes the reason here, and
              * that text is the only place the reason survives — nothing persists it. Behind the
              * collapsed disclosure below it was present and unread through two controlled
              * production attempts. It is rendered verbatim: the runtime owns the wording, and a
              * code is never restated as a claim about a provider being reached or refused.
              */}
            {modelDiagnostics.length > 0 ? (
              <ul
                data-heby-diagnostic=""
                className="mt-1.5 flex flex-col gap-0.5 text-[0.72rem] leading-5 text-warning"
              >
                {modelDiagnostics.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {otherLimitations.length > 0 ? (
              <Disclosure summary="What this answer is (and isn’t)">
                <ul className="mt-1.5 flex flex-col gap-0.5 pl-4 text-fg-muted">
                  {otherLimitations.map((line) => (
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
