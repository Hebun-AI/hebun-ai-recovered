/*
 * knowledge/ingestion-contracts.ts — the ingestion vocabulary, normalization and chunker.
 *
 * ── WHAT INGESTION IS, AND IS NOT ────────────────────────────────────────────
 *
 * It is a PRODUCER for the Knowledge authority that already exists. One human paste becomes N
 * canonical facts through the SAME K2 writer, with the SAME governed identity, the SAME audit sink
 * and the SAME provisional standing. It is not a second authority, not a parser, not a retrieval
 * system, and it does not make anything true.
 *
 * ── EVERYTHING HERE IS PURE ──────────────────────────────────────────────────
 *
 * No database, no clock, no session, no model. The orchestrator supplies all of those. That is what
 * lets the workspace preview a chunk count with the SAME chunker the server will use, rather than a
 * second implementation that could disagree with it.
 *
 * ── DETERMINISM IS THE CONTRACT ──────────────────────────────────────────────
 *
 * The same text must always produce the same chunks, in the same order, with the same digest, on
 * every machine and every run. So: no locale-sensitive operations, no regular-expression features
 * whose behaviour varies by engine version, no randomness, no time.
 */

import { createHash } from "node:crypto";
import type { KnowledgeScope } from "./contracts";
import { KNOWLEDGE_SCOPES } from "./create-contracts";

/**
 * The largest source one ingestion may carry, in Unicode code points.
 *
 * 60 000 is roughly a 25-page document — large enough for a real policy or handbook, small enough
 * that the resulting fact count stays inside the bound below. It is a REFUSAL, never a truncation:
 * silently ingesting the first half of somebody's policy would be worse than declining it.
 */
export const MAX_SOURCE_CHARACTERS = 60_000;

/**
 * Target size of one chunk, in Unicode code points.
 *
 * Chosen against the READ seam rather than against any model: `KNOWLEDGE_LISTING_LIMIT` is 50, and
 * that same listing is what Heby's evidence path consumes. 1 500 keeps a full-size source inside the
 * chunk bound below, and keeps each chunk large enough to carry a whole argument rather than a
 * fragment.
 */
export const CHUNK_TARGET_CHARACTERS = 1_500;

/**
 * The most facts ONE ingestion may create.
 *
 * This is the honest consequence of the 50-record listing limit: an ingestion that produced more
 * records than the evidence view can show would look successful and then be partly invisible to
 * Heby. 40 leaves room for knowledge the organization already holds. Exceeding it is refused with
 * the real reason, not silently accepted.
 */
export const MAX_CHUNKS_PER_SOURCE = 40;

/** The largest title an ingestion may carry. Mirrors the K2 title bound it will be written through. */
export const MAX_SOURCE_TITLE_CHARACTERS = 200;

export interface IngestKnowledgeInput {
  readonly sourceTitle: string;
  readonly sourceText: string;
  readonly domainKey: string;
  readonly scope: KnowledgeScope;
}

export type IngestionField = "sourceTitle" | "sourceText" | "domainKey" | "scope";

export interface IngestionProblem {
  readonly field: IngestionField;
  readonly code:
    | "required"
    | "too-long"
    | "too-many-chunks"
    | "control-characters"
    | "unknown-scope";
  /** Operator-facing. States what is wrong and never rewrites the input. */
  readonly message: string;
}

/** One deterministic chunk of a normalized source. */
export interface SourceChunk {
  /** Zero-based position in the source. Also the chunk's identity component. */
  readonly index: number;
  readonly text: string;
}

/** Count Unicode code points, not UTF-16 units — the same rule K2's validator uses. */
function length(value: string): number {
  return Array.from(value).length;
}

/**
 * Normalize ONLY layout, never wording.
 *
 * Line endings are unified, trailing spaces per line are dropped, runs of blank lines collapse to a
 * single separator, and the document's own leading/trailing whitespace goes. Nothing is lowercased,
 * nothing is de-punctuated, nothing is summarized, and no word is changed. The human's text is what
 * gets stored.
 *
 * Blank-line collapsing is not cosmetic: paragraphs are the chunk boundary, so "how many blank lines
 * did the author leave" must not change the resulting chunks.
 */
export function normalizeSourceText(raw: string): string {
  const unified = raw.replace(/\r\n?/g, "\n");
  const trimmedLines = unified
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
  return trimmedLines.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * The identity of a source's CONTENT.
 *
 * SHA-256 over the normalized text. This is provenance and idempotency metadata, not a secret: it
 * exists so "the same document again" and "the same title, different document" are distinguishable
 * without reading either. It is derived from the normalized form on purpose — reformatting a
 * document must not present as new knowledge.
 */
export function digestSource(normalizedText: string): string {
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
}

/**
 * Split a paragraph that is longer than the target.
 *
 * Sentence boundaries first, because a sentence is the smallest unit that still carries a claim.
 * Only when a single sentence exceeds the target does this cut on character count — a hard cut is
 * ugly, but silently dropping the remainder would be dishonest.
 */
function splitLongParagraph(paragraph: string, target: number): readonly string[] {
  const sentences = paragraph.split(/(?<=[.!?])\s+/g);
  const out: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim().length > 0) out.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    if (length(sentence) > target) {
      flush();
      const points = Array.from(sentence);
      for (let i = 0; i < points.length; i += target) {
        out.push(points.slice(i, i + target).join("").trim());
      }
      continue;
    }
    const candidate = current.length === 0 ? sentence : `${current} ${sentence}`;
    if (length(candidate) > target) {
      flush();
      current = sentence;
    } else {
      current = candidate;
    }
  }
  flush();
  return out.filter((piece) => piece.length > 0);
}

/**
 * Chunk a NORMALIZED source deterministically.
 *
 * Paragraphs are packed in source order up to the target; an oversized paragraph is split as above.
 * There is deliberately NO overlap: the read seam lists records, it does not rank them, so an
 * overlapping copy would consume one of the scarce 50 listing slots to say something already said.
 *
 * A heading survives as the first line of the chunk it introduces, because a heading and the
 * paragraph beneath it are packed together whenever they fit — which is the common case.
 */
export function chunkSource(
  normalizedText: string,
  target: number = CHUNK_TARGET_CHARACTERS,
): readonly SourceChunk[] {
  if (normalizedText.trim().length === 0) return [];

  const paragraphs = normalizedText
    .split("\n\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const packed: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim().length > 0) packed.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (length(paragraph) > target) {
      flush();
      for (const piece of splitLongParagraph(paragraph, target)) packed.push(piece);
      continue;
    }
    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;
    if (length(candidate) > target) {
      flush();
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  flush();

  return packed.map((text, index) => ({ index, text }));
}

/**
 * A stable, URL-safe key fragment for a title.
 *
 * Deliberately lossy and deliberately NOT the identity on its own — see `chunkFactKey`. Two titles
 * that slug identically are separated by the content digest, so a collision here is harmless.
 */
export function titleKey(sourceTitle: string): string {
  const slug = sourceTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : "untitled";
}

/** How much of the content digest enters the fact key. 12 hex characters ≈ 48 bits. */
export const SOURCE_DIGEST_KEY_LENGTH = 12;

/**
 * The canonical fact key for one chunk.
 *
 * `ingest:<title-key>:<digest-prefix>:<index>` — and every part earns its place:
 *
 *   `ingest`       says how this fact came to exist, so an ingested chunk is never mistaken for a
 *                  hand-authored fact in the same domain.
 *   `<title-key>`  keeps the key legible to the human who ingested it.
 *   `<digest>`     is what makes the identity honest. Title alone would collide the moment somebody
 *                  ingests a corrected version of the same document — the second ingestion would
 *                  land on the first one's identity and be refused as a duplicate, which is a lie.
 *                  With the digest, the same bytes collide (correctly) and different bytes do not.
 *   `<index>`      separates chunks of one source and preserves their order in the key itself.
 *
 * Nothing random participates: the same source always yields the same keys, which is precisely what
 * makes re-ingestion detectable instead of duplicative.
 */
export function chunkFactKey(sourceTitle: string, sourceDigest: string, index: number): string {
  return `ingest:${titleKey(sourceTitle)}:${sourceDigest.slice(0, SOURCE_DIGEST_KEY_LENGTH)}:${index}`;
}

/** The label carried by one chunk's node. Human-facing, and it states the part it is. */
export function chunkTitle(sourceTitle: string, index: number, total: number): string {
  return `${sourceTitle} (${index + 1}/${total})`;
}

/* The scope vocabulary has one owner. Imported, never restated — a second list would drift. */
const VALID_SCOPES: ReadonlySet<string> = new Set<string>(KNOWLEDGE_SCOPES);

/** All C0 controls and DEL except newline and tab — a source has paragraphs. Mirrors K2 exactly. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** All C0 controls and DEL — a title is one line and has no legitimate newline or tab. */
const CONTROL_CHARACTERS_SINGLE_LINE = /[\u0000-\u001F\u007F]/;

/**
 * Validate ingestion input against the normalized text.
 *
 * Order matters: emptiness is judged AFTER normalization, so a source of nothing but blank lines is
 * refused rather than ingested as zero chunks and reported as success.
 */
export function validateIngestion(
  input: IngestKnowledgeInput,
  normalizedText: string,
  chunkCount: number,
): readonly IngestionProblem[] {
  const problems: IngestionProblem[] = [];
  const title = input.sourceTitle?.trim() ?? "";

  if (title.length === 0) {
    problems.push({ field: "sourceTitle", code: "required", message: "A source title is required." });
  } else if (length(title) > MAX_SOURCE_TITLE_CHARACTERS) {
    problems.push({
      field: "sourceTitle",
      code: "too-long",
      message: `A source title may be at most ${MAX_SOURCE_TITLE_CHARACTERS} characters.`,
    });
  } else if (CONTROL_CHARACTERS_SINGLE_LINE.test(title)) {
    problems.push({
      field: "sourceTitle",
      code: "control-characters",
      message: "A source title may not contain control characters.",
    });
  }

  if (normalizedText.length === 0) {
    problems.push({
      field: "sourceText",
      code: "required",
      message: "The source text is empty once blank lines are removed. Nothing was ingested.",
    });
  } else if (length(normalizedText) > MAX_SOURCE_CHARACTERS) {
    problems.push({
      field: "sourceText",
      code: "too-long",
      message: `A source may be at most ${MAX_SOURCE_CHARACTERS} characters. Ingest it in parts rather than losing the remainder.`,
    });
  } else if (CONTROL_CHARACTERS.test(normalizedText)) {
    problems.push({
      field: "sourceText",
      code: "control-characters",
      message: "The source text contains control characters and was not ingested.",
    });
  } else if (chunkCount > MAX_CHUNKS_PER_SOURCE) {
    problems.push({
      field: "sourceText",
      code: "too-many-chunks",
      message:
        `This source would become ${chunkCount} knowledge records, and one ingestion may create at ` +
        `most ${MAX_CHUNKS_PER_SOURCE}. Hebun's evidence view lists a bounded number of records, so a ` +
        `larger ingestion would be partly invisible. Ingest it in parts.`,
    });
  }

  if (!input.domainKey?.trim()) {
    problems.push({ field: "domainKey", code: "required", message: "A domain is required." });
  }
  if (!VALID_SCOPES.has(input.scope as string)) {
    problems.push({ field: "scope", code: "unknown-scope", message: "That scope is not recognized." });
  }

  return problems;
}
