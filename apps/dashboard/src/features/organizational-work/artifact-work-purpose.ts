/*
 * organizational-work/artifact-work-purpose.ts — the SAME Work-owned relationship, grouped by
 * referent instead of by work item (REV-3). Pure.
 *
 * ── WHY THERE IS NO NEW READER HERE ──────────────────────────────────────────
 *
 * WEV-1 released ONE seam for both directions and said so in its own words: `WORK → REFERENTS` and
 * `REFERENT → WORK` are the same declaration read the same way and grouped differently by the
 * caller, and "a second seam for the inverse would have been a second authority for one
 * relationship". The schema agrees — `work_evidence_references_tenant_artifact_idx` exists
 * precisely to serve the inverse.
 *
 * So this module reads NOTHING. It takes what the two released Work seams already returned and
 * arranges it by artifact. There is no query, no database handle, no tenant parameter and no I/O,
 * which is what makes it impossible for this file to become a second source of the relationship.
 *
 * ── WHAT THE RELATIONSHIP MEANS, AND THE FIVE THINGS IT DOES NOT ─────────────
 *
 * A row in `work_evidence_references` is one human's DECLARATION that a work item concerns this
 * artifact. That is all it is.
 *
 *     DECLARED EVIDENCE != PURPOSE FACT != APPROVAL != USE != OUTCOME
 *
 * It does not say the artifact was created for that work, that anyone used it, that it was
 * reviewed, accepted or approved, or that the work progressed because of it. Hebun holds no review,
 * approval or rejection for prepared work at all — those states do not exist in the artifact
 * authority — and nothing here invents them.
 *
 * ── CARDINALITY IS MANY, AND IS NOT COLLAPSED ────────────────────────────────
 *
 * The unique index is `(tenant_id, work_item_id, work_artifact_id) where withdrawn_at is null`, so
 * one artifact may be declared evidence for SEVERAL work items. Production happens to hold exactly
 * one such declaration today; a projection that returned a single work item would be correct by
 * accident and wrong the first time a second declaration is made. Every artifact therefore maps to
 * a LIST, including when that list has one entry.
 *
 * ── UNRESOLVED IS NOT ABSENT ─────────────────────────────────────────────────
 *
 * A declaration names a work item by id. If the register did not carry that item — it is bounded,
 * and a read can fail — the entry is kept with a NULL title rather than dropped, exactly as WEV-1
 * keeps an unresolvable referent instead of inventing a label. Dropping it would turn "Hebun could
 * not name this work" into "this artifact serves no work", which is a different and false claim.
 */
import type { WorkEvidenceRead } from "./read-work-evidence.server";
import type { WorkRegister } from "./read-work.server";
import type { WorkDeclaredState } from "./work-contracts";

/** One work item that has declared this artifact as evidence. */
export interface ArtifactWorkPurposeItem {
  readonly workItemId: string;
  /** The work item's own title, or NULL when the register could not name it. Never invented. */
  readonly title: string | null;
  /** The work item's DECLARED state, or NULL when unresolved. Declared, never observed. */
  readonly declaredState: WorkDeclaredState | null;
}

/**
 * Artifact id → the work items that declare it, as a plain object so it crosses the server/client
 * boundary. `unavailable` is a READ FAILURE and is deliberately a different value from an artifact
 * with an empty list: one means "Hebun could not ask", the other means "this organization has
 * declared nothing".
 */
export type ArtifactWorkPurposeIndex =
  | { readonly status: "available"; readonly byArtifactId: Readonly<Record<string, readonly ArtifactWorkPurposeItem[]>> }
  | { readonly status: "unavailable"; readonly detail: string };

/** What a surface says when an artifact carries no current declaration. */
export const NO_DECLARED_WORK_PURPOSE = "Not declared as evidence for recorded work." as const;

/** What a surface says when the relationship could not be read at all. */
export const WORK_PURPOSE_UNAVAILABLE: string =
  "Hebun could not read what this organization's work declares, so whether this draft serves " +
  "recorded work is UNKNOWN — not known to be nothing.";

/**
 * WHAT A DECLARATION DOES NOT ESTABLISH. Rendered beside the relationship for the same reason
 * `WORK_ARTIFACT_AUTHORSHIP_NON_CLAIMS` is rendered beside authorship: the risk of showing a link
 * is that a reader upgrades "this work names this draft" into "so this draft was accepted".
 */
export const ARTIFACT_WORK_PURPOSE_NON_CLAIMS: readonly string[] = [
  "A declaration says one person recorded that this work concerns this draft. It does not say the draft was written for it.",
  "It is not a review, not an approval, not acceptance, and not evidence that the draft was used or that the work progressed because of it.",
  "The work state shown is what this organization DECLARED about the work, not something Hebun observed.",
] as const;

/**
 * Group the two released Work reads by artifact.
 *
 * The evidence read is the authority on the relationship; the register is consulted ONLY to name
 * the work item a declaration already points at. A register failure therefore degrades the LABEL,
 * never the relationship — the entry survives with a null title.
 */
export function indexArtifactWorkPurpose(
  evidence: WorkEvidenceRead,
  register: WorkRegister,
): ArtifactWorkPurposeIndex {
  if (evidence.status !== "available") {
    return { status: "unavailable", detail: evidence.detail };
  }

  const named = new Map<string, { title: string; declaredState: WorkDeclaredState }>();
  if (register.status === "available") {
    for (const item of register.items) {
      named.set(item.workItemId, { title: item.title, declaredState: item.declaredState });
    }
  }

  const byArtifactId: Record<string, ArtifactWorkPurposeItem[]> = {};
  for (const reference of evidence.references) {
    /* Knowledge facts are declared through the same table and are NOT this projection's subject. */
    if (reference.kind !== "work-artifact") continue;
    const resolved = named.get(reference.workItemId) ?? null;
    const entry: ArtifactWorkPurposeItem = {
      workItemId: reference.workItemId,
      title: resolved?.title ?? null,
      declaredState: resolved?.declaredState ?? null,
    };
    (byArtifactId[reference.referentId] ??= []).push(entry);
  }

  return { status: "available", byArtifactId };
}
