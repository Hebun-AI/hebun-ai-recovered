/*
 * knowledge/knowledge-file-ingest.server.ts — the file boundary (R4C.1, extended by R4C.2).
 *
 * ── IT IS A DOOR, NOT AN AUTHORITY ───────────────────────────────────────────
 *
 * Its entire job is to turn a file a human selected into TEXT, and then hand that text to the
 * ingestion path that already exists. It writes nothing. It imports no writer, opens no
 * transaction, and names no canonical table. Everything that decides what becomes organizational
 * Knowledge — the authority band, the validation, the chunker, the duplicate rule, the transaction,
 * the audit row, the provisional standing — is upstream code this module calls and does not repeat.
 *
 *   selected file → bounds → decode or parse → text → ingestKnowledgeSource → the ONE writer
 *
 * R4C.2 added a second way for bytes to become characters — a bounded PDF parser — and deliberately
 * nothing else. The formats diverge at exactly one branch (step 6) and converge again immediately;
 * every gate before and after it is shared. Adding a format is adding a branch, never an authority.
 *
 * ── THE GATE ORDER IS THE INGESTION PATH'S, FOR THE INGESTION PATH'S REASON ──
 *
 *   1. AUTHENTICATED?  a server-resolved TenantContext must exist
 *   2. AUTHORIZED?     the durable role band must permit authoring Knowledge
 *   3. only then is the file looked at, and only then are its bytes read
 *
 * Authorization comes first so an unauthorized caller cannot use the refusals as an oracle for what
 * Hebun accepts. Here it buys something further: an unauthorized request's bytes are never read into
 * memory at all. The delegate re-checks both gates for itself — that is deliberate. It must stay
 * safe when called from anywhere, and a door is not a reason to unlock the room behind it.
 *
 * ── WHAT THE CLIENT CANNOT SUPPLY ────────────────────────────────────────────
 *
 * `sourceType` is DERIVED here, from the extension this module validated. The input type has no
 * field for it, so "this .txt is really a PDF, label it accordingly" has nowhere to arrive. The
 * extracted text is likewise never accepted from the caller: for a text file the browser may decode
 * a copy to preview a character count, but the text that becomes Knowledge is produced HERE, from
 * the bytes received. A PDF is never parsed in the browser at all — the parser is server-only, so
 * the client cannot preview its record count and the workspace says so rather than inventing one.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It does not persist the file. The bytes exist as one `ArrayBuffer` for the length of this call and
 * are unreachable afterwards; there is no filesystem write, no temporary path, no object store, no
 * blob client, and no row recording that a file was ever received. It does not ratify, supersede,
 * classify, summarize, translate, or repair an encoding. It calls no model and opens no socket.
 *
 * Server-only.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeWriteAuthority,
  type KnowledgeWriteAuthority,
} from "./knowledge-write-authority.server";
import {
  ingestKnowledgeSource,
  type KnowledgeIngestDeps,
  type IngestKnowledgeResult,
} from "./knowledge-ingest.server";
import type { IngestKnowledgeInput } from "./ingestion-contracts";
import {
  decodeUtf8Strictly,
  hasPdfSignature,
  maxBytesFor,
  validateSelectedFile,
  type FileIngestionProblem,
} from "./file-ingestion-contracts";
import { extractPdfText, type PdfExtractionDeps } from "./pdf-extract.server";

/**
 * What a caller supplies. Note what is absent BY TYPE: no tenant, no actor, no role, no source type,
 * no decoded text, no digest, no standing.
 */
export interface IngestKnowledgeFileInput {
  /**
   * Typed `unknown` on purpose. A caller reaching in from a form cannot assert that what it found
   * under a key is a file, so this module narrows it rather than trusting the assertion.
   */
  readonly file: unknown;
  /** The human's title for the source. Empty means "use the file name". */
  readonly sourceTitle: string;
  readonly domainKey: string;
  readonly scope: IngestKnowledgeInput["scope"];
}

export type IngestKnowledgeFileResult =
  /** The file never became text. Nothing was validated as Knowledge, and nothing was written. */
  | { readonly status: "file-rejected"; readonly problems: readonly FileIngestionProblem[] }
  /** Every other outcome is the ingestion path's own, unchanged and unwrapped. */
  | IngestKnowledgeResult;

export interface KnowledgeFileIngestDeps extends KnowledgeIngestDeps {
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<KnowledgeWriteAuthority>;
  /** Test seam for the delegate, so the boundary can be exercised without a database. */
  readonly ingest?: typeof ingestKnowledgeSource;
  /** Test seam for the parser, so boundary refusals can be exercised without a real document. */
  readonly extractPdf?: typeof extractPdfText;
  /**
   * Parser seams, kept in their own object rather than merged.
   *
   * Both layers happen to want a clock and they mean different things by it — the ingestion path
   * stamps provenance with a `Date`, the parser measures elapsed milliseconds as a `number`.
   * Flattening them would have forced one of the two to change its meaning to fit the other.
   */
  readonly pdf?: PdfExtractionDeps;
}

/** Narrow an unknown to the file-like surface this module actually uses. */
interface SelectedFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function asSelectedFile(candidate: unknown): SelectedFile | null {
  if (typeof candidate !== "object" || candidate === null) return null;
  const value = candidate as Partial<SelectedFile>;
  if (typeof value.name !== "string") return null;
  if (typeof value.size !== "number" || !Number.isFinite(value.size)) return null;
  if (typeof value.arrayBuffer !== "function") return null;
  return {
    name: value.name,
    size: value.size,
    type: typeof value.type === "string" ? value.type : "",
    arrayBuffer: value.arrayBuffer.bind(candidate),
  };
}

function rejected(problems: readonly FileIngestionProblem[]): IngestKnowledgeFileResult {
  return { status: "file-rejected", problems };
}

/**
 * Read ONE selected text file and ingest it through the existing Knowledge authority.
 *
 * The raw bytes do not outlive this call.
 */
export async function ingestKnowledgeFile(
  tenant: TenantContext | null,
  input: IngestKnowledgeFileInput,
  deps: KnowledgeFileIngestDeps = {},
): Promise<IngestKnowledgeFileResult> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge file ingestion is server-only.");
  }

  /* 1. AUTHENTICATED — before the file is even looked at. */
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthorized" };

  /* 2. AUTHORIZED — the same durable role band the paste path requires, resolved the same way. */
  const authority = await (deps.resolveAuthority ?? resolveKnowledgeWriteAuthority)(tenant);
  if (!authority.authorized) {
    return { status: "forbidden", roleType: authority.roleType };
  }

  /* 3. IS THERE A FILE AT ALL? */
  const file = asSelectedFile(input?.file);
  if (!file) {
    return rejected([{ code: "no-file", message: "No file was selected. Nothing was ingested." }]);
  }

  /*
   * 4. BOUNDS, JUDGED BEFORE THE BYTES ARE READ.
   *
   * `size` is what the request declares. Reading it first is the memory guard — an oversize file is
   * refused without ever being materialized — and the length actually received is re-checked below,
   * so a declared size that undersells the payload buys nothing.
   */
  const bounds = validateSelectedFile({
    fileName: file.name,
    byteLength: file.size,
    declaredMediaType: file.type,
  });
  if (!bounds.ok) return rejected(bounds.problems);

  /* 5. READ, then hold the received length to the same bound the declared one was held to. */
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return rejected([
      { code: "no-file", message: "That file could not be read. Nothing was ingested." },
    ]);
  }
  if (bytes.byteLength <= 0) {
    return rejected([{ code: "empty-file", message: "That file is empty. Nothing was ingested." }]);
  }
  const byteBound = maxBytesFor(bounds.sourceType);
  if (bytes.byteLength > byteBound) {
    return rejected([
      {
        code: "too-large",
        message: `A file may be at most ${byteBound.toLocaleString("en-US")} bytes.`,
      },
    ]);
  }

  /*
   * 6. BYTES BECOME TEXT — or they do not become anything.
   *
   * ── THIS IS THE ONLY PLACE THE FORMATS DIFFER ────────────────────────────
   *
   * A text file is decoded; a PDF is parsed. Both produce a string and a refusal type, and both
   * hand that string to the same delegate below. Adding a format is adding a branch here — it is
   * not adding an authority, a writer, a table, or a second ingestion path, and this shape is what
   * keeps that true.
   */
  let sourceText: string;
  if (bounds.sourceType === "pdf") {
    /*
     * The signature is checked BEFORE the parser sees anything. The extension was chosen by the
     * person uploading and the media type by their machine; these five bytes are the first evidence
     * about the content itself, and they cost nothing.
     */
    if (!hasPdfSignature(bytes)) {
      return rejected([
        {
          code: "not-a-pdf",
          message:
            "That file is named .pdf but does not begin like a PDF, so it was not opened. Nothing " +
            "was guessed about its real format.",
        },
      ]);
    }
    const extracted = await (deps.extractPdf ?? extractPdfText)(bytes, deps.pdf ?? {});
    if (!extracted.ok) return rejected([extracted.problem]);
    sourceText = extracted.text;
  } else {
    const decoded = decodeUtf8Strictly(bytes);
    if (!decoded.ok) return rejected([decoded.problem]);
    sourceText = decoded.text;
  }

  /*
   * 7. DELEGATE. From here the file has stopped existing as far as Hebun is concerned: what travels
   * on is text, a title, a classification, and a source type this module derived. Every remaining
   * decision — normalization, chunking, the digest, the duplicate rule, the transaction, the audit
   * row, `draft`/`provisional` — belongs to the path that already made them for pasted text.
   *
   * The title falls back to the file name only when the human left it blank. It is a convenience,
   * not an identity: the title bound is still enforced by the validator that owns it.
   */
  const chosenTitle = input.sourceTitle?.trim() ?? "";
  return (deps.ingest ?? ingestKnowledgeSource)(
    tenant,
    {
      sourceTitle: chosenTitle.length > 0 ? chosenTitle : bounds.defaultSourceTitle,
      sourceText,
      domainKey: input.domainKey,
      scope: input.scope,
      sourceType: bounds.sourceType,
    },
    deps,
  );
}
