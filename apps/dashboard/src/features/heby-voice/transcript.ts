/*
 * heby-voice/transcript.ts — the two pure text decisions Voice makes.
 *
 *   INBOUND   where a recognized transcript goes. Answer: into the composer, as ordinary text,
 *             appended to whatever the operator had already typed.
 *   OUTBOUND  what may be spoken aloud. Answer: the human-facing answer the operator can already
 *             read on screen, and nothing else.
 *
 * NOTHING HERE DISPATCHES. There is no submit, no send, no server action and no model in this file
 * or anywhere in `heby-voice`. A transcript becomes composer text; turning composer text into a
 * question remains the operator's explicit act, through the existing single submission gate — which
 * is what keeps a spoken "/terminal" a refused slash command rather than an execution request.
 *
 * Pure: no React, no DOM, no I/O.
 */

/** The minimum a spoken-answer decision needs to know about a rendered turn. */
export interface SpeakableTurn {
  readonly role: "user" | "heby";
  readonly content: string;
}

/**
 * Merge a recognized transcript into whatever is already in the composer.
 *
 * Typing and speaking coexist: dictation APPENDS rather than replacing, so a half-typed message is
 * never destroyed by pressing the microphone. Whitespace is normalized to a single separator, and an
 * empty transcript changes nothing at all.
 */
export function mergeTranscriptIntoComposer(existing: string, transcript: string): string {
  const spoken = transcript.trim().replace(/\s+/g, " ");
  if (spoken.length === 0) return existing;
  if (existing.trim().length === 0) return spoken;
  return `${existing.replace(/\s+$/, "")} ${spoken}`;
}

/**
 * The answer that may be spoken aloud: the content of the most recent Heby turn, exactly as it is
 * rendered for reading.
 *
 * DELIBERATELY NOT SPOKEN — none of these is reachable from here, because a turn's content is the
 * only field this function accepts: provenance labels, evidence references, record ids, limitation
 * notes, conversation ids, tenant identity, provider names, request ids, token counts, system or
 * hidden instructions, or any part of a raw provider payload. Speech reads what the operator can
 * already read, and nothing they cannot.
 *
 * Returns null when there is no answer yet, so silence is the default rather than something invented
 * to fill it.
 */
export function selectSpokenAnswer(turns: readonly SpeakableTurn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (!turn || turn.role !== "heby") continue;
    const content = turn.content.trim();
    return content.length > 0 ? content : null;
  }
  return null;
}
