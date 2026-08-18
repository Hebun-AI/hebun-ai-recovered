/*
 * knowledge/pdf-extract.server.ts — bytes to untrusted text, and nothing else (R4C.2).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A parser. It takes bytes somebody uploaded and returns characters, or a refusal. It is NOT a
 * Knowledge authority, a document authority, a ratification authority, a provenance authority, an
 * execution authority, an agent, or an OCR engine. It writes nothing, persists nothing, and has no
 * opinion about what the text means. Everything it returns is UNTRUSTED INPUT, exactly as pasted
 * text is, and it travels onward through the ingestion path that already exists.
 *
 * ── WHY pdfjs-dist AND NOT unpdf ─────────────────────────────────────────────
 *
 * Both were audited live at the R4C.2 gate. `unpdf` is smaller, ergonomically better and built for
 * serverless — and it BUNDLES its copy of PDF.js into its own `dist`. At audit time that copy sat
 * inside the affected range of CVE-2026-16633 (pdf.js >= 5.6.83, < 6.2.108, CVSS 8.6), and its most
 * recent release — seven days after the advisory — had not bumped it. A bundled parser cannot be
 * patched by the consumer: `overrides` and `resolutions` do not reach inside another package's
 * build output. So the smaller dependency was the one Hebun could not fix.
 *
 * pdfjs-dist IS the upstream, is pinned here at the EXACT patched release, and its version is a
 * number this repository owns. That is the whole argument.
 *
 * ── WHY THE VERSION IS PINNED EXACTLY, NOT WITH A CARET ─────────────────────
 *
 * The security review that authorized this dependency was performed against 6.2.108 specifically. A
 * range would let a future install silently substitute a build nobody reviewed while the lockfile
 * still looked deliberate. A phase test asserts the exact version for the same reason.
 *
 * ── HARDENING, AND ONE HONEST CORRECTION ─────────────────────────────────────
 *
 * The gate expected to set `isEvalSupported: false`. In the installed 6.2.108 that option DOES NOT
 * EXIST — the string appears in no file in the package, because the eval-based path it guarded was
 * removed upstream. Setting it would be a no-op dressed as a control, which is worse than not
 * setting it: it would leave a comment in this file claiming a protection that nothing enforces. So
 * it is deliberately absent, and this paragraph is why.
 *
 * `enableScripting` is likewise NOT reachable from here. It is a parameter of the annotation layer,
 * not of `getDocument` — `types/src/display/api.d.ts` declares `enableXfa` and has no
 * `enableScripting` at all. Since this module constructs no annotation layer and renders nothing,
 * the code path CVE-2026-16633 describes has no way to be entered from a text extraction. That is a
 * structural property of what this module calls, not a setting anyone could flip back.
 *
 * What IS set, and is real: no XFA, no font face, no system fonts, no worker fetch, no rendering, no
 * canvas, no external resource of any kind.
 *
 * ── WHAT "BOUNDED" MEANS HERE, STATED PRECISELY ──────────────────────────────
 *
 * A malicious document can be expensive to parse even when it is small, and pdf.js parses on this
 * process's event loop. A deadline in JavaScript can abandon a RESULT; it cannot reclaim a CPU. So
 * the deadline below is reporting, not isolation, and it is named that way in the type. The bounds
 * that actually constrain work are the ones applied before the work happens: a byte ceiling on the
 * request, a page ceiling read from the document's own structure BEFORE any page is touched, and a
 * character ceiling enforced as pages accumulate.
 *
 * Server-only.
 */

import {
  MAX_PDF_PAGES,
  type FileIngestionProblem,
} from "./file-ingestion-contracts";
import { MAX_SOURCE_CHARACTERS, normalizeSourceText } from "./ingestion-contracts";

/**
 * The exact release this phase's security review was performed against.
 *
 * Exported so a test can assert the installed package matches, rather than trusting the lockfile to
 * still say what it said on the day.
 */
export const REQUIRED_PDFJS_VERSION = "6.2.108";

/**
 * The Node build. The default build throws `ReferenceError: DOMMatrix is not defined` on import in
 * Node and prints "Please use the `legacy` build in Node.js environments" — so this is not a
 * preference, it is the only entry point that loads here at all.
 */
const PDFJS_NODE_ENTRY = "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * The narrow surface of pdf.js this module uses.
 *
 * Declared structurally rather than imported from the package's own types. It documents the entire
 * blast radius in one place: four calls and two properties. Anything the library can also do is,
 * by construction, not reachable from here.
 */
interface PdfjsTextApi {
  readonly getDocument: (parameters: Record<string, unknown>) => {
    readonly promise: Promise<PdfDocument>;
    destroy(): Promise<void>;
  };
}

interface PdfDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfPage {
  getTextContent(): Promise<{ readonly items: readonly { readonly str?: string }[] }>;
  cleanup(): void;
}

/**
 * The options every extraction runs under.
 *
 * Every one of these turns something OFF. There is no option here that enables a capability, and
 * that is the intended shape of the list.
 */
const HARDENED_DOCUMENT_OPTIONS: Readonly<Record<string, unknown>> = Object.freeze({
  /** No XFA forms. This is a real `getDocument` option and it defaults to false; set anyway. */
  enableXfa: false,
  /** No font face construction — nothing is prepared for rendering, because nothing is rendered. */
  disableFontFace: true,
  /** Do not reach for fonts installed on the host. */
  useSystemFonts: false,
  /** Do not fetch anything over the network for fonts or character maps. */
  useWorkerFetch: false,
  /** No standardFontDataUrl and no cMapUrl are supplied: there is no path to fetch from. */
  verbosity: 0,
});

export interface PdfExtractionDeps {
  /** Test seam. Production resolves the pinned package. */
  readonly loadPdfjs?: () => Promise<PdfjsTextApi>;
  /** Injected clock so the elapsed figure is deterministic in tests. */
  readonly now?: () => number;
  /**
   * Best-effort deadline in milliseconds. See the header: this is a REPORTING boundary, checked
   * between pages. It cannot stop work already running inside the parser.
   */
  readonly deadlineMs?: number;
}

export interface PdfExtracted {
  readonly ok: true;
  /** The raw extracted characters, in the parser's own order. Nothing is reconstructed. */
  readonly text: string;
  readonly pageCount: number;
  /** Wall clock, for the closure record and for operators. Not a guarantee of anything. */
  readonly elapsedMs: number;
}

export type PdfExtraction = PdfExtracted | { readonly ok: false; readonly problem: FileIngestionProblem };

function refuse(
  code: FileIngestionProblem["code"],
  message: string,
): { readonly ok: false; readonly problem: FileIngestionProblem } {
  return { ok: false, problem: { code, message } };
}

/** Count Unicode code points — the same unit every Knowledge bound is expressed in. */
function length(value: string): number {
  return Array.from(value).length;
}

/**
 * Whether a thrown value is pdf.js's encrypted-document signal.
 *
 * Matched on `name`, which pdf.js sets on its exception classes, rather than on the message text —
 * a message is prose and can be reworded by a patch release without anyone noticing that a refusal
 * quietly became a different refusal.
 */
function isPasswordException(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "PasswordException"
  );
}

async function loadPdfjsModule(): Promise<PdfjsTextApi> {
  /*
   * Dynamic, so a 34 MB parser is loaded only by a request that actually carries a document, and
   * never by a module graph that merely imports this file.
   */
  return (await import(/* webpackIgnore: false */ PDFJS_NODE_ENTRY)) as unknown as PdfjsTextApi;
}

/**
 * Extract text from a text-bearing PDF, or refuse.
 *
 * The bytes are not retained: they are handed to the parser, and both this function's locals and the
 * parser's document are released before it returns.
 */
export async function extractPdfText(
  bytes: ArrayBuffer,
  deps: PdfExtractionDeps = {},
): Promise<PdfExtraction> {
  if (typeof window !== "undefined") {
    throw new Error("PDF extraction is server-only.");
  }

  const now = deps.now ?? (() => Date.now());
  const startedAt = now();
  const deadlineMs = deps.deadlineMs;

  let pdfjs: PdfjsTextApi;
  try {
    pdfjs = await (deps.loadPdfjs ?? loadPdfjsModule)();
  } catch {
    return refuse("pdf-unreadable", "Hebun could not start the PDF reader. Nothing was ingested.");
  }

  const task = pdfjs.getDocument({
    /* A copy the parser owns. `data` is consumed in place, so the caller's buffer is not aliased. */
    data: new Uint8Array(bytes.slice(0)),
    ...HARDENED_DOCUMENT_OPTIONS,
  });

  let document: PdfDocument;
  try {
    document = await task.promise;
  } catch (error) {
    await task.destroy().catch(() => {});
    if (isPasswordException(error)) {
      return refuse(
        "pdf-encrypted",
        "That PDF is password-protected. Hebun does not accept document passwords, so it was not " +
          "read. Remove the protection and select it again.",
      );
    }
    return refuse(
      "pdf-unreadable",
      "That file could not be read as a PDF. It may be damaged, incomplete, or not a document at all.",
    );
  }

  try {
    /*
     * THE PAGE BOUND IS CHECKED BEFORE ANY PAGE IS TOUCHED. `numPages` comes from the structure the
     * load above already parsed, so refusing here costs one structural parse instead of thirty page
     * extractions. Iterating first and counting afterwards would do exactly the work the bound
     * exists to prevent.
     */
    const pageCount = document.numPages;
    if (!Number.isFinite(pageCount) || pageCount <= 0) {
      return refuse("pdf-unreadable", "That PDF reports no pages, so there was nothing to read.");
    }
    if (pageCount > MAX_PDF_PAGES) {
      return refuse(
        "pdf-too-many-pages",
        `That PDF has ${pageCount} pages and Hebun reads at most ${MAX_PDF_PAGES}. Longer documents ` +
          `exceed what one ingestion can hold. Split it and ingest the part you need.`,
      );
    }

    const pages: string[] = [];
    let accumulated = 0;

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      let pageText: string;
      try {
        const content = await page.getTextContent();
        /*
         * Items joined in the order the parser produced them, with a newline per page and nothing
         * else. No column detection, no header or footer removal, no hyphen rejoining, no table
         * reconstruction — every one of those is a guess about layout, and a guess stored as
         * organizational knowledge is worse than the flattening it tried to fix.
         */
        pageText = content.items.map((item) => item.str ?? "").join("");
      } finally {
        page.cleanup();
      }
      pages.push(pageText);

      /*
       * THE CHARACTER CEILING, ENFORCED AS IT ACCUMULATES. Refusing the WHOLE file is the point:
       * keeping the pages read so far would store a document's first half as if it were the
       * document, which is the silent truncation `MAX_SOURCE_CHARACTERS` exists to refuse.
       */
      accumulated += length(pageText);
      if (accumulated > MAX_SOURCE_CHARACTERS) {
        return refuse(
          "pdf-text-too-long",
          `That PDF holds more than ${MAX_SOURCE_CHARACTERS.toLocaleString("en-US")} characters of ` +
            `text. It was refused whole rather than ingested in part. Split it and ingest the ` +
            `section you need.`,
        );
      }

      if (deadlineMs !== undefined && now() - startedAt > deadlineMs) {
        return refuse(
          "pdf-unreadable",
          "Reading that PDF took longer than Hebun allows, so it was not ingested.",
        );
      }
    }

    const text = pages.join("\n\n");

    /*
     * NO TEXT MEANS A SCAN, AND IT IS SAID SO. Falling through to the generic empty-source refusal
     * would tell an operator their document was empty, which is false and would have them retry the
     * same file forever. Hebun has no OCR and this is where it says that out loud.
     */
    if (normalizeSourceText(text).length === 0) {
      return refuse(
        "pdf-no-text",
        "That PDF contains no text Hebun can read — it looks like a scan or images of pages. Hebun " +
          "does not perform OCR, so nothing was ingested.",
      );
    }

    return { ok: true, text, pageCount, elapsedMs: now() - startedAt };
  } catch {
    return refuse(
      "pdf-unreadable",
      "That PDF could not be read to the end. It may be damaged or incomplete. Nothing was ingested.",
    );
  } finally {
    /* The parser's copy of the document goes with the request, whatever the outcome above was. */
    await task.destroy().catch(() => {});
  }
}
