/**
 * Heby Core — intent normalization (Phase 5, Intent and Natural-Language Interaction).
 *
 * Deterministically canonicalizes a routed intent:
 *   - routed element references are de-duplicated and totally ordered — arrangement only,
 *     never a rank, score, priority, or recommendation,
 *   - the bound context is canonicalized through the Phase 2 normalizer, unchanged in
 *     meaning,
 *   - disposition, requested capability, clarification, utterance text, and every identity
 *     are carried UNCHANGED,
 *   - the whole routed intent is emitted immutable and deep-frozen.
 *
 * Pure canonical normalization — NO model call, NO interpretation change, NO mutation of any
 * preserved value, and NO change of semantic meaning. Ordering and de-duplication happen by
 * text key only. Keys use JSON encoding so they are unambiguous, text-safe, UTF-8 stable, and
 * NUL-safe. Normalization is idempotent: the canonical form of a canonical routed intent is
 * itself.
 */

import {
  type CanonicalHebyRoutedIntent,
  type HebyClarification,
  type HebyRoutedIntent,
} from "@/features/heby-core/heby-intent-types";
import { normalizeHebyDeclaredContext } from "@/features/heby-core/heby-input-context-normalization";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of routed element references. */
export function normalizeHebyRoutedRefs(refs: readonly HebyId[]): readonly HebyId[] {
  const seen = new Set<HebyId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** Freezes a clarification, or passes null through. Content carried UNCHANGED. */
function freezeClarification(clarification: HebyClarification | null): HebyClarification | null {
  return clarification === null ? null : Object.freeze({ ...clarification });
}

/**
 * Canonicalizes a routed intent into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical routed intent, and the
 * canonical form of a canonical routed intent is itself. Routed references are ordered; the
 * context is canonicalized; disposition, capability, and clarification are carried UNCHANGED.
 */
export function normalizeHebyRoutedIntent(intent: HebyRoutedIntent): CanonicalHebyRoutedIntent {
  return Object.freeze({
    intentId: intent.intentId,
    utteranceId: intent.utteranceId,
    presentationId: intent.presentationId,
    context: normalizeHebyDeclaredContext(intent.context),
    disposition: intent.disposition,
    requestedCapability: intent.requestedCapability,
    routedElementRefs: Object.freeze(normalizeHebyRoutedRefs(intent.routedElementRefs)),
    clarification: freezeClarification(intent.clarification),
  });
}

/**
 * A canonical, text-safe key for a whole routed intent. The same routed intent always
 * produces the same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyRoutedIntentKey(intent: HebyRoutedIntent): string {
  return JSON.stringify([
    intent.intentId,
    intent.utteranceId,
    intent.presentationId,
    intent.context.contextId,
    intent.disposition,
    intent.requestedCapability,
    normalizeHebyRoutedRefs(intent.routedElementRefs),
    intent.clarification === null ? null : [intent.clarification.question, intent.clarification.reason],
  ]);
}
