/*
 * knowledge/file-ingestion-contracts.ts — the file boundary's vocabulary, bounds and decoder (R4C.1).
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ─────────────────────────────────────────
 *
 * It is the narrow gate a selected file must pass before its bytes are allowed to become text, and
 * the decoder that turns those bytes into text. That is all. It is not a parser, not a storage
 * layer, not a second Knowledge authority, and not a media-type framework. Everything downstream of
 * `text` is the ingestion path that already exists and is not touched.
 *
 * ── WHY THE DECODER LIVES HERE, PURE, AND NOT IN A `.server.ts` ──────────────
 *
 * The workspace must be able to show the operator the SAME character count and record count the
 * server will write. Knowledge ingestion already established that principle for the chunker —
 * the card imports `normalizeSourceText`/`chunkSource` directly rather than carrying a second
 * implementation, because "a preview that lies about the outcome is worse than no preview".
 *
 * A file preview needs one more step in front of that: bytes → text. If the browser decoded
 * leniently (which `File.text()` does — it substitutes U+FFFD for malformed input) and the server
 * decoded strictly, a file could preview as clean text and then be refused. That is exactly the
 * disagreement the shared chunker exists to prevent, so the decoder is shared for the same reason.
 * `TextDecoder` is a platform API present in both runtimes; nothing here needs a server.
 *
 * IT IS STILL NOT AUTHORITY. The workspace decodes to SHOW. The server decodes the bytes itself,
 * from the file it received, and derives `sourceType` from what IT validated. No decoded text and
 * no source type crosses the boundary as a client claim — see `knowledge-file-ingest.server.ts`.
 *
 * ── DETERMINISM IS THE CONTRACT, AS UPSTREAM ─────────────────────────────────
 *
 * Same bytes → same text → same normalized form → same digest → same fact keys. No locale, no
 * clock, no randomness.
 *
 * Pure. No database, no session, no filesystem, no network.
 */

import { KNOWLEDGE_SOURCE_TYPES, type KnowledgeSourceType } from "./create-contracts";
import {
  MAX_SOURCE_CHARACTERS,
  MAX_SOURCE_TITLE_CHARACTERS,
  hasSingleLineControlCharacters,
} from "./ingestion-contracts";

/**
 * The file types generation one accepts, and the source type each becomes.
 *
 * Deliberately two, and deliberately both text-native: neither needs a parser, a dependency, or a
 * single byte of third-party code to become text. PDF, DOCX, HTML, CSV, images and archives are all
 * absent on purpose — adding one is a phase, not a line in this table.
 *
 * Markdown is NOT parsed. It is stored as the Markdown the human wrote, exactly as pasted Markdown
 * already is; the distinct source type records what the file WAS, not a different treatment.
 */
export const SUPPORTED_FILE_EXTENSIONS: Readonly<Record<string, KnowledgeSourceType>> =
  Object.freeze({
    ".txt": "plain-text",
    ".md": "markdown",
    ".markdown": "markdown",
    /*
     * R4C.2. The first entry whose bytes are not text: a parser stands between the file and the
     * characters. Everything after that parser is the path the other two already take.
     */
    ".pdf": "pdf",
  });

/**
 * The largest file one ingestion may carry, in BYTES.
 *
 * ── WHY 240 000, AND WHY IT IS NOT AN ARBITRARY ROUND NUMBER ─────────────────
 *
 * It is derived from the bound that already exists. `MAX_SOURCE_CHARACTERS` is 60 000 Unicode code
 * points, and UTF-8 spends at most 4 bytes on a code point. A file larger than 60 000 × 4 bytes
 * therefore CANNOT decode to 60 000 code points or fewer — it was always going to be refused, and
 * this refuses it before its bytes are read into memory rather than after.
 *
 * ── WHY IT SITS SO FAR BELOW THE FRAMEWORK'S OWN LIMIT ───────────────────────
 *
 * Next 16.2.10 caps a server action's request body at 1 MB
 * (`next/dist/server/app-render/action-handler.js`: `defaultBodySizeLimit = '1 MB'`), and this
 * repository sets no override. That cap is enforced on the request STREAM: it raises an HTTP 413
 * before the action function is ever entered, so Hebun could not refuse the file, explain why, or
 * name the real bound. Every oversize file must therefore be refused by Hebun BELOW that line, and
 * the remaining ~800 KB is slack the multipart envelope can never plausibly consume.
 *
 * ── THE ONE CASE THIS IS STRICTER THAN IT STRICTLY HAS TO BE ─────────────────
 *
 * Normalization collapses blank lines and trailing spaces, so a file that is mostly whitespace could
 * decode above 240 000 bytes and still normalize under 60 000 characters. It is refused anyway. The
 * bound is a MEMORY bound as well as a character bound, and being predictable about it is worth more
 * than admitting a pathological file.
 */
export const MAX_FILE_BYTES = MAX_SOURCE_CHARACTERS * 4;

/** The framework body cap this bound deliberately stays under. Recorded so the gap is legible. */
export const NEXT_SERVER_ACTION_BODY_LIMIT_BYTES = 1024 * 1024;

/**
 * The largest PDF one ingestion may carry, in BYTES (R4C.2).
 *
 * ── WHY IT IS NOT `MAX_FILE_BYTES` ──────────────────────────────────────────
 *
 * `MAX_FILE_BYTES` is derived from `MAX_SOURCE_CHARACTERS * 4` because a text file's bytes and its
 * characters are the same thing wearing different units. A PDF's are not related at all: embedded
 * fonts, subset glyphs and a logo routinely make a twelve-page document 900 KB while it yields
 * 25 000 characters. Reusing 240 000 here would refuse most legitimate PDFs for a reason that has
 * nothing to do with how much they say.
 *
 * ── WHY EXACTLY 1 000 000, AND HOW THAT WAS ESTABLISHED ─────────────────────
 *
 * The binding constraint is the transport, not the parser. Next caps a server action's request body
 * at `NEXT_SERVER_ACTION_BODY_LIMIT_BYTES` on the STREAM, raising a 413 before the action runs, so
 * Hebun must refuse below that line to own the message at all.
 *
 * The gap was MEASURED rather than guessed. Serializing a real `FormData` carrying a file of this
 * size plus the action's other fields at their own maximum lengths produced 902 bytes of multipart
 * envelope — total 1 000 902 bytes, leaving 47 674 bytes of headroom under the cap. The bound is
 * therefore known to fit the real request, not assumed to.
 *
 * The 60 000-character ceiling still applies AFTER extraction and is unchanged. A PDF may be
 * accepted here and still be refused for saying too much.
 */
export const MAX_PDF_BYTES = 1_000_000;

/**
 * The most pages one PDF may carry (R4C.2).
 *
 * Tied to the character ceiling rather than invented: 60 000 characters is roughly 25 pages of
 * prose, so a document beyond 30 pages was overwhelmingly going to be refused by
 * `MAX_SOURCE_CHARACTERS` anyway. Checking it against the page count FIRST means that refusal costs
 * one structural parse instead of thirty page extractions — it is the cheapest bound available
 * against a document that is expensive on purpose.
 */
export const MAX_PDF_PAGES = 30;

/**
 * The byte bound that applies to one source type.
 *
 * A single constant cannot serve both, for the reason given on `MAX_PDF_BYTES`. Keeping the choice
 * here — beside both numbers — means the boundary asks one question instead of carrying its own
 * table that could drift away from this one.
 */
export function maxBytesFor(sourceType: KnowledgeSourceType): number {
  return sourceType === "pdf" ? MAX_PDF_BYTES : MAX_FILE_BYTES;
}

export type FileIngestionProblemCode =
  | "no-file"
  | "empty-file"
  | "too-large"
  | "unsupported-extension"
  | "media-type-mismatch"
  | "file-name-required"
  | "file-name-too-long"
  | "file-name-control-characters"
  | "undecodable"
  /* ── R4C.2: refusals only a parsed format can produce ────────────────────── */
  /** The bytes do not begin with the PDF signature, whatever the name says. */
  | "not-a-pdf"
  /** The document is encrypted or password-protected. Hebun accepts no password. */
  | "pdf-encrypted"
  /** The structure could not be parsed: malformed, truncated, or not a document. */
  | "pdf-unreadable"
  | "pdf-too-many-pages"
  /** Parsed successfully and carries no extractable text — an image-only scan. */
  | "pdf-no-text"
  /** Extraction passed the source-character ceiling. Refused whole, never truncated. */
  | "pdf-text-too-long";

export interface FileIngestionProblem {
  readonly code: FileIngestionProblemCode;
  /** Operator-facing. States what is wrong and never rewrites or repairs the input. */
  readonly message: string;
}

/** Everything about a selected file that can be judged WITHOUT reading its bytes. */
export interface SelectedFileFacts {
  readonly fileName: string;
  readonly byteLength: number;
  /** The media type the CLIENT declared. Attacker-controlled — see `contradictsDeclaredType`. */
  readonly declaredMediaType: string;
}

export type SelectedFileValidation =
  | {
      readonly ok: true;
      /** Derived from the extension this validator accepted — never from client input. */
      readonly sourceType: KnowledgeSourceType;
      /** A prefilled default the human may overwrite. It is a suggestion, not an identity. */
      readonly defaultSourceTitle: string;
    }
  | { readonly ok: false; readonly problems: readonly FileIngestionProblem[] };

function problem(code: FileIngestionProblemCode, message: string): FileIngestionProblem {
  return { code, message };
}

/** Count Unicode code points, not UTF-16 units — the same rule every Knowledge bound uses. */
function length(value: string): number {
  return Array.from(value).length;
}

/**
 * The file's extension, lowercased, or `""` when it has none.
 *
 * Read from the LAST dot so `policy.v2.md` resolves to `.md`. A name that begins with a dot and has
 * no other (`.gitignore`) has no extension by this rule, which is correct: it is not a `.txt`.
 */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return "";
  return fileName.slice(dot).toLowerCase();
}

/**
 * The default source title derived from a file name: the name without its extension.
 *
 * It is only ever a DEFAULT. The human sees it in the title field and may replace it, and the title
 * they end up with is validated by the ingestion validator that already owns that bound — this does
 * not re-decide what a title may be.
 */
export function sourceTitleFromFileName(fileName: string): string {
  const extension = extensionOf(fileName);
  const stem = extension.length > 0 ? fileName.slice(0, -extension.length) : fileName;
  return stem.trim();
}

/**
 * Whether a client-declared media type positively contradicts what the extension says this is.
 *
 * ── A DECLARED MEDIA TYPE MAY REFUSE. IT MAY NEVER ACCEPT ────────────────────
 *
 * `File.type` in a browser is filled in from the operating system's own media-type registry and is
 * trivially controllable by anything that constructs the request. Treating it as evidence that a
 * file IS what it claims would be worthless. What it can still do is catch an obvious mismatch —
 * a `.txt` carrying `application/pdf`, or a `.pdf` carrying `text/plain` — for free.
 *
 * ── IT IS JUDGED AGAINST THE SOURCE TYPE, NOT AGAINST "TEXT" ─────────────────
 *
 * This started as a single rule that tolerated `text/*` and refused everything else, because every
 * format Hebun read was text. R4C.2 made that rule wrong in both directions at once: it refused
 * `application/pdf` on a `.pdf` — the correct and most common declaration — and it would have
 * tolerated `text/plain` on one. The tolerated set belongs to the type, so it lives with the type.
 *
 * ── WHY EMPTY AND GENERIC TYPES ARE ALWAYS TOLERATED ────────────────────────
 *
 * The registry that fills this in is the operator's machine, not ours. `.md` resolves to
 * `text/markdown` on some systems, `text/plain` on others, and to nothing at all on a machine with
 * no entry for it; `application/octet-stream` is the standard "unknown". Refusing those would
 * reject legitimate files for a reason the operator cannot see or fix, in exchange for no security
 * — the extension allowlist, the signature check and the parser are the actual gates, and none of
 * them can be talked out of a verdict by a header.
 */
const TOLERATED_MEDIA_TYPES: Readonly<Record<KnowledgeSourceType, readonly string[]>> = Object.freeze(
  {
    "plain-text": ["text/"],
    markdown: ["text/"],
    pdf: ["application/pdf", "application/x-pdf"],
  },
);

/** Always tolerated, for any type: the machine simply did not know. */
const UNKNOWN_MEDIA_TYPES: readonly string[] = ["", "application/octet-stream"];

export function contradictsDeclaredType(
  sourceType: KnowledgeSourceType,
  declaredMediaType: string,
): boolean {
  const declared = declaredMediaType.trim().toLowerCase();
  if (UNKNOWN_MEDIA_TYPES.includes(declared)) return false;
  return !TOLERATED_MEDIA_TYPES[sourceType].some((allowed) =>
    allowed.endsWith("/") ? declared.startsWith(allowed) : declared === allowed,
  );
}

export function validateSelectedFile(facts: SelectedFileFacts): SelectedFileValidation {
  const problems: FileIngestionProblem[] = [];
  const fileName = facts.fileName?.trim() ?? "";

  if (fileName.length === 0) {
    problems.push(problem("file-name-required", "The selected file has no name."));
  } else if (hasSingleLineControlCharacters(fileName)) {
    /* It becomes the default title, and a title is one line. Same rule, one owner. */
    problems.push(
      problem(
        "file-name-control-characters",
        "That file name contains control characters and was not read.",
      ),
    );
  } else if (length(fileName) > MAX_SOURCE_TITLE_CHARACTERS) {
    problems.push(
      problem(
        "file-name-too-long",
        `A file name may be at most ${MAX_SOURCE_TITLE_CHARACTERS} characters.`,
      ),
    );
  }

  const extension = extensionOf(fileName);
  const sourceType = SUPPORTED_FILE_EXTENSIONS[extension];
  if (sourceType === undefined) {
    problems.push(
      problem(
        "unsupported-extension",
        `Hebun reads ${Object.keys(SUPPORTED_FILE_EXTENSIONS).join(", ")} files. ` +
          `Other formats are not read at all — nothing was extracted or guessed from this one.`,
      ),
    );
  } else if (contradictsDeclaredType(sourceType, facts.declaredMediaType ?? "")) {
    problems.push(
      problem(
        "media-type-mismatch",
        `This file is named ${extension} but declares itself as ` +
          `${facts.declaredMediaType.trim()}. It was not read.`,
      ),
    );
  }

  /*
   * The byte bound is per TYPE, because bytes mean different things per type — see `maxBytesFor`.
   * When the extension was not recognised there is no bound to apply and no point inventing one;
   * the unsupported-extension refusal above is the whole answer.
   */
  const byteBound = sourceType === undefined ? undefined : maxBytesFor(sourceType);
  if (facts.byteLength <= 0) {
    problems.push(problem("empty-file", "That file is empty. Nothing was ingested."));
  } else if (byteBound !== undefined && facts.byteLength > byteBound) {
    problems.push(
      problem(
        "too-large",
        sourceType === "pdf"
          ? `A PDF may be at most ${byteBound.toLocaleString("en-US")} bytes. Larger files cannot be ` +
            `sent to Hebun in one request, so this one is refused before it is read rather than ` +
            `failing part-way through.`
          : `A file may be at most ${byteBound.toLocaleString("en-US")} bytes. ` +
            `Above that it cannot fit inside the ${MAX_SOURCE_CHARACTERS.toLocaleString("en-US")}-character ` +
            `source bound, so it is refused before it is read rather than after.`,
      ),
    );
  }

  if (problems.length > 0 || sourceType === undefined) return { ok: false, problems };
  return { ok: true, sourceType, defaultSourceTitle: sourceTitleFromFileName(fileName) };
}

export type Utf8Decoding =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly problem: FileIngestionProblem };

/**
 * Decode bytes as UTF-8, STRICTLY.
 *
 * ── `fatal: true` IS THE WHOLE POINT ─────────────────────────────────────────
 *
 * The permissive default substitutes U+FFFD for every byte it cannot understand, which turns a JPEG
 * renamed to `.txt` into thousands of replacement characters and a Windows-1254 Turkish document
 * into mojibake — and then stores either one as the organization's knowledge. Both are worse than a
 * refusal, because both look like a successful ingestion.
 *
 * So the only two outcomes are the real text or an honest refusal. Nothing is repaired, re-encoded,
 * or guessed at: Hebun does not do character-set detection, and pretending to would mean deciding on
 * a customer's behalf what their document says.
 *
 * ── WHAT IT DOES DO SILENTLY, AND WHY THAT IS RIGHT ──────────────────────────
 *
 * A leading byte-order mark is removed (`ignoreBOM` defaults to false, which means "strip it").
 * Windows editors write one routinely, and leaving it in would put an invisible character at the
 * front of the first record's title and statement.
 *
 * ── THE LIMITATION THIS CREATES, STATED RATHER THAN HIDDEN ───────────────────
 *
 * A legacy-encoded file — Windows-1254, ISO-8859-9, UTF-16 — is REFUSED, not converted. Its Turkish
 * characters are single bytes that are not valid UTF-8, so this cannot read it without inventing an
 * encoding for it. Re-save as UTF-8 is the honest instruction, and the refusal says so.
 */
export function decodeUtf8Strictly(bytes: ArrayBuffer): Utf8Decoding {
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      problem: problem(
        "undecodable",
        "That file is not UTF-8 text, so it was not read. Nothing was guessed or repaired. " +
          "If it is a document in another encoding, re-save it as UTF-8 and select it again.",
      ),
    };
  }
}

/** The five bytes every PDF begins with. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-

/**
 * Whether these bytes actually begin with the PDF signature (R4C.2).
 *
 * ── WHY A NAME AND A MEDIA TYPE ARE NOT ENOUGH ──────────────────────────────
 *
 * The extension is chosen by whoever uploads, and `File.type` comes from their machine. Neither is
 * evidence about CONTENT. This reads the only thing that is: the first five bytes of the document
 * itself. It is five bytes of comparison, not a file-sniffing framework, and it exists so a `.txt`
 * renamed `.pdf` is refused by what it IS rather than being handed to a parser to find out.
 *
 * It can only ever REFUSE. A file that passes still has to survive the parser, which is the real
 * structural gate — a valid signature in front of rubbish is still rubbish.
 */
export function hasPdfSignature(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < PDF_SIGNATURE.length) return false;
  const head = new Uint8Array(bytes, 0, PDF_SIGNATURE.length);
  return PDF_SIGNATURE.every((byte, index) => head[index] === byte);
}

/* Re-exported so a caller has one import for the file boundary's vocabulary. */
export { KNOWLEDGE_SOURCE_TYPES };
export type { KnowledgeSourceType };
