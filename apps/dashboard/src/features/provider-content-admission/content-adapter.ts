/*
 * provider-content-admission/content-adapter.ts — THE ADAPTER (KID-2). PURE.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 *
 * One function. It turns the result of Hebun's OWN released provider content read into the
 * structural file-like surface the released Knowledge file boundary already accepts:
 *
 *     GoogleDriveContent  →  { name, size, type, arrayBuffer() }
 *
 * KID-0 found that seam: `ingestKnowledgeFile` narrows `file: unknown` to that shape rather than
 * taking a browser `File`, so a provider document can enter the EXISTING gate chain — bounds,
 * strict decode, chunker, digest, duplicate rule, transaction, audit row, `draft`/`provisional` —
 * without one new admission authority being written.
 *
 * ── WHAT IT OWNS, AND WHAT IT DOES NOT ───────────────────────────────────────
 *
 *   OWNS      a CLOSED content-kind allowlist, the file representation each kind becomes, and a
 *             safe file name derived from the provider's document name.
 *   NOT OWNED Knowledge lifecycle, Knowledge standing, Knowledge authorization, any credential,
 *             any Governance decision, any execution authority. This module imports none of them,
 *             performs no I/O, resolves no tenant and reads no clock.
 *
 * ── THE EXTENSIONLESS GOOGLE DOC, WHICH IS THE WHOLE TECHNICAL POINT ─────────
 *
 * KID-0's recorded blocker: a native Google Doc has no filename extension, and the Knowledge file
 * boundary derives its source type from one. It is answered by DERIVING the representation from
 * `contentKind` — the closed, normalized answer Hebun's own transport produced under its own
 * contract — and never from `providerMimeType`, which is what the provider said.
 *
 *     A Doc exported as text/plain  →  "<sanitized name>.txt", type text/plain
 *
 * So a document Drive calls `application/pdf`, `image/png` or anything else cannot select a parser
 * here: it never reaches this module at all (KID-1's `GOOGLE_DRIVE_READABLE_TYPES` refuses it at the
 * transport), and if it somehow did, its kind is not in the map below and it is refused again. There
 * is deliberately NO generic MIME parser, no sniffing, and no fallback branch.
 *
 * ── THE NAME IS A LABEL, NEVER AN INSTRUCTION AND NEVER A PATH ───────────────
 *
 * A provider-chosen name is untrusted text. It is stripped of control characters and of both path
 * separators, bounded to the length the Knowledge validator already enforces, and then given
 * HEBUN'S extension — appended last, so `extensionOf` (which reads the LAST dot) can only ever
 * resolve to the one this module chose. A Drive document named `report.pdf` becomes
 * `report.pdf.txt` and is read as text, because what it IS was decided by Hebun's transport.
 *
 * Pure. No I/O, no database, no clock, no randomness, no network.
 */
import type {
  GoogleDriveContent,
  GoogleDriveContentKind,
} from "@/features/provider-google/contracts";
import { MAX_SOURCE_TITLE_CHARACTERS } from "@/features/knowledge/ingestion-contracts";

/**
 * The structural surface `ingestKnowledgeFile` narrows an `unknown` to.
 *
 * It is declared here rather than imported because the boundary declares it PRIVATELY — that is
 * what makes it a structural seam instead of a shared type. Naming it here states the shape this
 * module promises to produce; a test hands the real boundary what this produces, which is the only
 * proof that the two shapes still agree.
 */
export interface ProviderFileLike {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * WHICH CONTENT KINDS MAY BECOME A KNOWLEDGE FILE, AND WHAT EACH BECOMES.
 *
 * A CLOSED map over the closed vocabulary KID-1 owns, and the ONLY way through this module. A kind
 * absent from it is refused — the fail-closed direction, and the reason this is keyed by kind and
 * not by MIME type: adding a readable type to the provider transport does NOT silently make it
 * admissible into organizational Knowledge. That is a second, separate decision, taken here.
 *
 * Both text kinds resolve to `.txt` and Markdown to `.md`, which is what the released
 * `SUPPORTED_FILE_EXTENSIONS` table maps to `plain-text` and `markdown`. This module does not
 * choose the Knowledge source type; the boundary derives it from the extension IT validates.
 */
export const ADMISSIBLE_CONTENT_KINDS: Readonly<
  Record<GoogleDriveContentKind, { readonly extension: string; readonly mediaType: string }>
> = Object.freeze({
  /* A native Google Doc, exported by KID-1 as text/plain. It has no extension of its own. */
  "google-doc-text": Object.freeze({ extension: ".txt", mediaType: "text/plain" }),
  "plain-text": Object.freeze({ extension: ".txt", mediaType: "text/plain" }),
  markdown: Object.freeze({ extension: ".md", mediaType: "text/markdown" }),
});

/** Why a provider document could not be represented as a Knowledge file. */
export type ProviderContentRefusal =
  /** The content kind is not in the closed allowlist above. Nothing was guessed. */
  | "content-kind-not-admissible"
  /** The provider's document name has nothing usable left after sanitization. */
  | "document-name-unusable";

export type ProviderContentAdaptation =
  | { readonly ok: true; readonly file: ProviderFileLike; readonly mediaType: string }
  | { readonly ok: false; readonly reason: ProviderContentRefusal; readonly detail: string };

/** Count Unicode code points — the same rule every Knowledge bound uses. */
function length(value: string): number {
  return Array.from(value).length;
}

/**
 * A provider-chosen document name, reduced to something that can safely be a file name.
 *
 * REMOVES rather than replaces: control characters (C0 and C1), and both path separators. A removal
 * cannot introduce a character that changes how the name is read, which a substitution can. Runs of
 * whitespace collapse to one space, and leading dots go — a name that begins with a dot and has no
 * other has no extension by `extensionOf`'s rule, and this module must not have the provider's name
 * decide anything about the extension.
 */
export function sanitizeDocumentName(rawName: string): string {
  return (rawName ?? "")
    /* C0 and C1: written as escapes so the source stays readable and the class stays exact. */
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[/\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
}

/**
 * Represent ONE already-read provider document as the file the Knowledge boundary accepts.
 *
 * The input is the trusted result of Hebun's own transport contract — never arbitrary caller input,
 * and never a browser file. The output carries no provider state: no owner, no permission, no
 * sharing link, no export URL, no token and no credential. It carries the text, a name and a type.
 */
export function adaptProviderContent(content: GoogleDriveContent): ProviderContentAdaptation {
  /*
   * `Object.hasOwn`, NOT a bare lookup — INT-4's finding, applied to a second closed map. A plain
   * `map[kind]` reaches the prototype chain, where `"constructor"` and `"toString"` both resolve to
   * something that is not `undefined`, so a fallback would never fire.
   */
  if (!Object.hasOwn(ADMISSIBLE_CONTENT_KINDS, content?.contentKind)) {
    return {
      ok: false,
      reason: "content-kind-not-admissible",
      detail:
        "Hebun admits Google Docs, plain text and Markdown from a connected provider. This " +
        "document is a kind Hebun does not admit, so nothing was extracted or guessed from it.",
    };
  }
  const representation = ADMISSIBLE_CONTENT_KINDS[content.contentKind];

  const stem = sanitizeDocumentName(content.name);
  if (stem.length === 0) {
    return {
      ok: false,
      reason: "document-name-unusable",
      detail:
        "This document's name in the provider has no usable characters, so Hebun could not name " +
        "the source it would become. Rename it in the provider and select it again.",
    };
  }

  /*
   * BOUND THE STEM, THEN APPEND HEBUN'S EXTENSION. Bounding first means the extension survives the
   * truncation, so a very long provider name cannot silently change which format this becomes.
   */
  const room = MAX_SOURCE_TITLE_CHARACTERS - length(representation.extension);
  const bounded = length(stem) > room ? Array.from(stem).slice(0, room).join("") : stem;
  const name = `${bounded}${representation.extension}`;

  /*
   * THE BYTES. KID-1 decoded the provider's body STRICTLY as UTF-8, so re-encoding that string is a
   * lossless round trip — an unpaired surrogate cannot survive a strict decode, so `TextEncoder`
   * has nothing to substitute. The buffer is sliced to its exact extent so `size` is a measurement
   * of what `arrayBuffer()` returns rather than a claim about it.
   */
  const encoded = new TextEncoder().encode(content.text ?? "");
  const bytes = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);

  return {
    ok: true,
    mediaType: representation.mediaType,
    file: Object.freeze({
      name,
      size: bytes.byteLength,
      type: representation.mediaType,
      arrayBuffer: async () => bytes,
    }),
  };
}
