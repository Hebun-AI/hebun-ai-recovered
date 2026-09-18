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
 * ── MEDIA-5: VERSION 2, AND WHY THE VERSION WAS ALREADY INSIDE THE DIGEST ────
 *
 * A reference-guided generation is asked against a draft revision AND an admitted image. Both are
 * part of what was asked, so both belong in the canonical form. v2 adds `sourceAsset`: the asset's
 * id and its exact `byteDigest` as recorded on the row at request time.
 *
 * THE BYTE DIGEST IS THE POINT. The id alone would say which row was named; the digest says which
 * BYTES were sent. Since `media_assets` byte identity is immutable, the two can never disagree —
 * which is exactly why recording the digest costs nothing and proves something the id cannot.
 *
 * SAME PROMPT + SAME REVISION + ASSET A DIGESTS DIFFERENTLY FROM ASSET B. That is the whole
 * requirement, and it falls out of including the pair rather than from any special casing.
 *
 * V1 ROWS REMAIN RECOMPUTABLE. The version lives INSIDE the digested document, so a v1 row is
 * reproduced by digesting the v1 form — not by guessing which fields a reader should omit. A
 * text-to-image request keeps emitting v1 verbatim: its canonical bytes are unchanged, so every
 * digest MEDIA-1 and MEDIA-2B ever wrote still verifies, byte for byte.
 *
 * The serialization is fixed-order JSON built from an explicit literal, never from caller objects, so
 * key order cannot vary and no unexpected field can enter.
 *
 * Pure. No I/O.
 */
import { createHash } from "node:crypto";

export const MEDIA_INPUT_CANONICAL_VERSION = 1 as const;
/** MEDIA-5. Used ONLY when a source asset is present; a text-to-image request stays at v1. */
export const MEDIA_INPUT_CANONICAL_VERSION_REFERENCE = 2 as const;

export interface MediaGenerationCanonicalInput {
  readonly promptText: string;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  readonly sourceContentDigest: string;
  readonly transport: string;
  readonly provider: string;
  readonly model: string;
  /**
   * MEDIA-5. The admitted image this generation was performed ON, when there is one.
   *
   * Absent (or null) for text-to-image, which is what keeps that form at v1 and its digests
   * unchanged. Draft provenance above and asset lineage here COEXIST — the source revision is still
   * digested for a reference edit, because a reference edit is still asked from a draft revision.
   */
  readonly sourceAsset?: { readonly assetId: string; readonly byteDigest: string } | null;
}

export function canonicalMediaGenerationInput(input: MediaGenerationCanonicalInput): string {
  const source = {
    artifactId: input.sourceArtifactId.toLowerCase(),
    revisionNo: input.sourceRevisionNo,
    contentDigest: input.sourceContentDigest,
  };
  /*
   * TWO LITERALS, NOT ONE WITH A CONDITIONAL KEY. A single object with an optional property would
   * make v1's bytes depend on whether a key was omitted or present-and-undefined — a difference
   * JSON.stringify hides and a digest does not. Written out, the v1 document is textually the same
   * document MEDIA-1 shipped.
   */
  if (!input.sourceAsset) {
    return JSON.stringify({
      v: MEDIA_INPUT_CANONICAL_VERSION,
      promptText: input.promptText,
      source,
      transport: input.transport,
      provider: input.provider,
      model: input.model,
    });
  }
  return JSON.stringify({
    v: MEDIA_INPUT_CANONICAL_VERSION_REFERENCE,
    promptText: input.promptText,
    source,
    sourceAsset: {
      assetId: input.sourceAsset.assetId.toLowerCase(),
      byteDigest: input.sourceAsset.byteDigest,
    },
    transport: input.transport,
    provider: input.provider,
    model: input.model,
  });
}

export function digestMediaGenerationInput(input: MediaGenerationCanonicalInput): string {
  return createHash("sha256").update(canonicalMediaGenerationInput(input), "utf8").digest("hex");
}
