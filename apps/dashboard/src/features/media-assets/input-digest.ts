/*
 * media-assets/input-digest.ts — the canonical generation input and its digest (MEDIA-1).
 *
 * WHAT IS DIGESTED: everything that determines what was ASKED of the transport —
 *
 *   v                  the canonical form's own version
 *   promptText         the exact prompt, verbatim
 *   source             the exact draft revision: artifact id, revision number, and that revision's
 *                      content digest as read at request time
 *   transport/provider/model
 *
 * WHY THE SOURCE CONTENT DIGEST IS INSIDE BUT NOT STORED BESIDE IT. The revision is immutable and
 * already carries its digest; copying it onto the invocation would be one fact in two places. It is
 * folded into `input_digest` instead, so a reader can recompute the digest from the invocation row
 * plus a join and prove the attempt was made against those exact draft bytes.
 *
 * The serialization is fixed-order JSON built from an explicit literal, never from caller objects, so
 * key order cannot vary and no unexpected field can enter.
 *
 * Pure. No I/O.
 */
import { createHash } from "node:crypto";

export const MEDIA_INPUT_CANONICAL_VERSION = 1 as const;

export interface MediaGenerationCanonicalInput {
  readonly promptText: string;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  readonly sourceContentDigest: string;
  readonly transport: string;
  readonly provider: string;
  readonly model: string;
}

export function canonicalMediaGenerationInput(input: MediaGenerationCanonicalInput): string {
  return JSON.stringify({
    v: MEDIA_INPUT_CANONICAL_VERSION,
    promptText: input.promptText,
    source: {
      artifactId: input.sourceArtifactId.toLowerCase(),
      revisionNo: input.sourceRevisionNo,
      contentDigest: input.sourceContentDigest,
    },
    transport: input.transport,
    provider: input.provider,
    model: input.model,
  });
}

export function digestMediaGenerationInput(input: MediaGenerationCanonicalInput): string {
  return createHash("sha256").update(canonicalMediaGenerationInput(input), "utf8").digest("hex");
}
