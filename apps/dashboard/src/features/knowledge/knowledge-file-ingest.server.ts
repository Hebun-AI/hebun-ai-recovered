/*
 * knowledge/knowledge-file-ingest.server.ts — the file boundary (R4C.1).
 *
 * ── IT IS A DOOR, NOT AN AUTHORITY ───────────────────────────────────────────
 *
 * Its entire job is to turn a file a human selected into TEXT, and then hand that text to the
 * ingestion path that already exists. It writes nothing. It imports no writer, opens no
 * transaction, and names no canonical table. Everything that decides what becomes organizational
 * Knowledge — the authority band, the validation, the chunker, the duplicate rule, the transaction,
 * the audit row, the provisional standing — is upstream code this module calls and does not repeat.
 *
 *   selected file → bounds → strict UTF-8 → text → ingestKnowledgeSource → the ONE writer
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
 * decoded text is likewise never accepted from the caller: the browser may decode a copy to preview
 * a character count, but the text that becomes Knowledge is decoded HERE, from the bytes received.
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
  MAX_FILE_BYTES,
  decodeUtf8Strictly,
  validateSelectedFile,
  type FileIngestionProblem,
} from "./file-ingestion-contracts";

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
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return rejected([
      {
        code: "too-large",
        message: `A file may be at most ${MAX_FILE_BYTES.toLocaleString("en-US")} bytes.`,
      },
    ]);
  }

  /* 6. BYTES BECOME TEXT, STRICTLY — or they do not become anything. */
  const decoded = decodeUtf8Strictly(bytes);
  if (!decoded.ok) return rejected([decoded.problem]);

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
      sourceText: decoded.text,
      domainKey: input.domainKey,
      scope: input.scope,
      sourceType: bounds.sourceType,
    },
    deps,
  );
}
