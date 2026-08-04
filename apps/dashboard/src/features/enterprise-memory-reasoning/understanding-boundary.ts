/**
 * Enterprise Memory Reasoning — understanding assembly boundary (Phase 8).
 *
 * The boundary through which a reasoning result enters the FINAL assembly and leaves
 * as a single canonical understanding bundle. It validates a proposed subject, scope,
 * and context, then assembles them into a canonical, immutable bundle. It performs NO
 * new reasoning, produces NO new artifact, and mutates NOTHING — it only accepts,
 * checks, gathers, canonically orders, and freezes the published artifacts it is
 * given. This is where the Reasoning Foundation's understanding is completed.
 */

import type {
  UnderstandingContext,
  UnderstandingScope,
  UnderstandingSubject,
} from "@/features/enterprise-memory-reasoning/understanding-types";
import type { UnderstandingBundle } from "@/features/enterprise-memory-reasoning/understanding-types";
import { normalizeUnderstandingBundle } from "@/features/enterprise-memory-reasoning/understanding-normalization";
import { validateUnderstanding } from "@/features/enterprise-memory-reasoning/understanding-validation";

/** A proposed reasoning result entering the assembly boundary. */
export interface UnderstandingInput {
  readonly subject: UnderstandingSubject;
  readonly scope: UnderstandingScope;
  readonly context: UnderstandingContext;
}

/** The result of assembling an understanding: a canonical bundle, or an explicit failure. */
export type UnderstandingResult =
  | { readonly ok: true; readonly value: UnderstandingBundle }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then assembles a canonical, immutable understanding bundle from the given
 * subject, scope, and gathered context. Pure and deterministic: the same input always
 * produces the same bundle. A validation failure yields explicit issues and no bundle.
 */
export function assembleUnderstandingBundle(input: UnderstandingInput): UnderstandingResult {
  const validation = validateUnderstanding(input.subject, input.scope, input.context);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeUnderstandingBundle(input.subject, input.scope, input.context) };
}
