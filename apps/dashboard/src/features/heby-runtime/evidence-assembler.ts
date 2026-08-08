/*
 * heby-runtime/evidence-assembler.ts — deterministic evidence assembly (UI Phase 16).
 *
 * Evidence identity comes ONLY from the retrieval layer. A model may later summarize
 * evidence, but it can never create an evidence identity: the assembler builds references
 * from resolved sources, and the response validator rejects any reference not present here.
 * This prevents a model from inventing a citation like "Source: policy-17" for a source that
 * does not exist.
 */

import type { HebyEvidenceReference } from "@/features/heby-integration";
import type { SourceResolution } from "./contracts";

/** Build evidence references from resolved sources. Only "resolved" sources contribute. */
export function assembleEvidence(
  resolutions: readonly SourceResolution[],
): readonly HebyEvidenceReference[] {
  const evidence: HebyEvidenceReference[] = [];
  for (const resolution of resolutions) {
    if (resolution.state !== "resolved") continue;
    for (const item of resolution.items) {
      evidence.push({
        sourceClass: resolution.sourceClass,
        recordRef: item.recordRef,
        lifecycle: item.lifecycle,
      });
    }
  }
  return evidence;
}

/** The provenance statements of the resolved sources, de-duplicated and ordered. */
export function assembleProvenance(
  resolutions: readonly SourceResolution[],
): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const resolution of resolutions) {
    if (resolution.state !== "resolved") continue;
    if (seen.has(resolution.provenance)) continue;
    seen.add(resolution.provenance);
    out.push(resolution.provenance);
  }
  return out;
}

/** Whether an evidence reference is backed by the assembled evidence set. */
export function isSupportedEvidence(
  reference: HebyEvidenceReference,
  assembled: readonly HebyEvidenceReference[],
): boolean {
  return assembled.some(
    (candidate) =>
      candidate.sourceClass === reference.sourceClass && candidate.recordRef === reference.recordRef,
  );
}
