/*
 * content-composition/media-prefill.ts — HEBY-MEDIA-3: a recommendation turned into a PREPARATION
 * for an existing human action. Data only.
 *
 * PURE. Input: the facts HEBY-MEDIA-1 read and the choice HEBY-MEDIA-2 made from them. Output: a
 * closed, ephemeral view-model. It is never persisted, carries no token, grants nothing, and is
 * recomputed on every render. A firewall test pins that this file imports nothing at runtime.
 *
 *     PREPARED != SELECTED     RECOMMENDED != AUTHORIZED     SNAPSHOT != AUTHORITY
 *
 * ── WHAT A PREFILL CAN POINT AT ──────────────────────────────────────────────
 *
 *  - `use-existing`, some named asset not yet selected → `select-existing`: the asset ids for the
 *    EXISTING per-asset selection action (CONTENT-COMPOSE-1). One human click per asset; the writer
 *    re-checks tenant, custody, kind coherence and the draft binding when the human acts.
 *  - `use-existing`, every named asset already selected → `satisfied`: there is nothing to do.
 *  - a generation recommendation → ALWAYS `generation-not-actionable` in this phase, carrying the
 *    path's blockers and unknowns verbatim. Every generation path carries `price-unknown` (no price
 *    exists in the repository) and image-to-video carries `data-use-unresolved`, so no generation
 *    can be prepared as actionable, and no prefill is wired to a generation door.
 *  - `none-ask-human` → `ask-human`: the reasons, and no action at all.
 *
 * REVIEW is never prefilled. `reviewPending` names generated assets that have no MEDIA-3 record, so
 * a human knows where review is due. It carries no decision and no reason — both are the human's.
 * PUBLISH is absent by construction: no variant, field or target refers to it.
 */
import type { DraftMediaFacts, GenerationPath, MediaChoice, MediaChoiceCode } from "./media-choice";

interface PrefillBase {
  /** Snapshot identity — explains where this came from; it authorizes nothing. */
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly recommendation: MediaChoice["kind"];
  readonly explanation: readonly string[];
  /** Generated, admitted assets of this draft with no MEDIA-3 record. No decision, no reason. */
  readonly reviewPending: readonly string[];
}

export type MediaPrefill =
  | (PrefillBase & {
      readonly kind: "select-existing";
      /** Recommended and not yet selected: one existing selection action each. */
      readonly assetIds: readonly string[];
      /** Recommended and already selected: shown, never re-submitted. */
      readonly alreadySelected: readonly string[];
    })
  | (PrefillBase & { readonly kind: "satisfied"; readonly assetIds: readonly string[] })
  | (PrefillBase & {
      readonly kind: "generation-not-actionable";
      readonly path: GenerationPath;
      readonly blockers: readonly MediaChoiceCode[];
      readonly unknowns: readonly MediaChoiceCode[];
    })
  | (PrefillBase & {
      readonly kind: "ask-human";
      readonly reasons: readonly MediaChoiceCode[];
      readonly blockers: readonly MediaChoiceCode[];
      readonly unknowns: readonly MediaChoiceCode[];
    });

export function prefillFromChoice(facts: DraftMediaFacts, choice: MediaChoice): MediaPrefill {
  const base: PrefillBase = {
    artifactId: facts.artifactId,
    revisionNo: facts.currentRevision,
    recommendation: choice.kind,
    explanation: choice.explanation,
    reviewPending: facts.media
      .filter((m) => m.origin === "generated" && m.lifecycle === "admitted" && m.review === "none")
      .map((m) => m.assetId)
      .sort(),
  };

  if (choice.kind === "use-existing") {
    /* Only ids that are this draft's facts AND eligible now; the recommendation cannot name others. */
    const known = new Map(facts.media.map((m) => [m.assetId, m]));
    const named = choice.assetIds.filter((id) => {
      const m = known.get(id);
      return m !== undefined && m.origin === "generated" && m.lifecycle === "admitted" && m.review === "accepted";
    });
    const pending = named.filter((id) => !known.get(id)!.selectedInCurrentRevision);
    const selected = named.filter((id) => known.get(id)!.selectedInCurrentRevision);
    if (named.length > 0 && pending.length === 0) return { ...base, kind: "satisfied", assetIds: selected };
    if (pending.length > 0) return { ...base, kind: "select-existing", assetIds: pending, alreadySelected: selected };
    return { ...base, kind: "ask-human", reasons: ["human-choice-required"], blockers: [], unknowns: [] };
  }

  if (choice.kind === "none-ask-human") {
    return { ...base, kind: "ask-human", reasons: choice.reasons, blockers: choice.blockers, unknowns: choice.unknowns };
  }

  /* A generation recommendation: shown with its blockers and unknowns, never as an action. */
  const path = choice.paths.find((p) => p.path === choice.kind);
  return {
    ...base,
    kind: "generation-not-actionable",
    path: choice.kind,
    blockers: path ? path.blockers : choice.blockers,
    unknowns: path ? path.unknowns : choice.unknowns,
  };
}
