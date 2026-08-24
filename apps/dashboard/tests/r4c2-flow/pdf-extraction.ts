/*
 * R4C.2 — the PDF parser, its bounds, and the firewall around the dependency it introduced.
 *
 * WHAT THIS FILE IS FOR. R4C.2 put third-party parser code inside Hebun's ingestion trust boundary
 * for the first time. Everything that makes that acceptable has to be locked here, or the next
 * phase inherits a dependency nobody can tell from an unreviewed one:
 *
 *   the EXACT reviewed release is installed, and no range could substitute another;
 *   the parser is reached only through a signature check and bounds applied BEFORE the work;
 *   the page bound is checked before pages are touched, not after;
 *   an encrypted document is refused rather than asked for a password;
 *   an image-only scan is refused with its own reason rather than reported as empty;
 *   and the parser writes nothing, keeps nothing, and cannot reach any authority.
 *
 * Every refusal is exercised against a real document, built by `tests/helpers/pdf-fixtures.ts`.
 * Nothing here is an exploit: the assertions are about inputs Hebun REFUSES, and each is expressed
 * by ordinary document structure.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  makeEncryptedPdf,
  makePdf,
  makeTruncatedPdf,
  pdfBytes,
} from "../helpers/pdf-fixtures";
import {
  REQUIRED_PDFJS_VERSION,
  extractPdfText,
} from "../../src/features/knowledge/pdf-extract.server";
import {
  MAX_FILE_BYTES,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  NEXT_SERVER_ACTION_BODY_LIMIT_BYTES,
  SUPPORTED_FILE_EXTENSIONS,
  hasPdfSignature,
  maxBytesFor,
  validateSelectedFile,
} from "../../src/features/knowledge/file-ingestion-contracts";
import { MAX_SOURCE_CHARACTERS } from "../../src/features/knowledge/ingestion-contracts";
import { KNOWLEDGE_SOURCE_TYPES } from "../../src/features/knowledge/create-contracts";

const EXTRACTOR = "src/features/knowledge/pdf-extract.server.ts";
const BOUNDARY = "src/features/knowledge/knowledge-file-ingest.server.ts";
const CARD = "src/components/knowledge-workspace/knowledge-ingestion-card.tsx";

const read = (path: string) => readFileSync(path, "utf8");
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

async function main(): Promise<void> {
  const extractorCode = codeOf(read(EXTRACTOR));
  const boundaryCode = codeOf(read(BOUNDARY));

  /* ── 1. THE EXACT REVIEWED RELEASE, NOT A RANGE ────────────────────────── */
  {
    const installed = JSON.parse(read("node_modules/pdfjs-dist/package.json")) as {
      version: string;
      license: string;
    };
    assert.equal(
      installed.version,
      REQUIRED_PDFJS_VERSION,
      "the INSTALLED parser is the exact release this phase's security review was performed against",
    );
    assert.equal(installed.license, "Apache-2.0");

    /*
     * A caret would let a future install substitute a build nobody reviewed while the manifest still
     * looked deliberate. CVE-2026-16633 was fixed in exactly this version; the next one is a new
     * decision, not an automatic upgrade.
     */
    const manifest = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    assert.equal(
      manifest.dependencies["pdfjs-dist"],
      REQUIRED_PDFJS_VERSION,
      "the manifest pins the exact version — no caret, no tilde, no range",
    );

    const lock = JSON.parse(read("package-lock.json")) as {
      packages: Record<string, { version?: string; integrity?: string; hasInstallScript?: boolean }>;
    };
    const locked = lock.packages["node_modules/pdfjs-dist"];
    assert.ok(locked, "the lockfile carries the parser");
    assert.equal(locked.version, REQUIRED_PDFJS_VERSION, "and resolves it to the exact version");
    assert.match(locked.integrity ?? "", /^sha512-/, "with an integrity hash");
    assert.notEqual(locked.hasInstallScript, true, "and it runs no install script");

    /* No second PDF library, and nothing that would compile a native parser. */
    for (const forbidden of ["unpdf", "pdf-parse", "pdf-lib", "pdf2json", "mupdf", "poppler"]) {
      assert.equal(
        manifest.dependencies[forbidden],
        undefined,
        `${forbidden} is not a dependency — one parser, chosen deliberately`,
      );
      assert.equal(manifest.devDependencies?.[forbidden], undefined);
      assert.equal(
        existsSync(join("node_modules", forbidden)),
        false,
        `${forbidden} is not installed`,
      );
    }
  }

  /* ── 2. THE CLOSED VOCABULARY GREW BY EXACTLY ONE ──────────────────────── */
  {
    assert.deepEqual(
      Object.keys(SUPPORTED_FILE_EXTENSIONS).sort(),
      [".markdown", ".md", ".pdf", ".txt"],
      "one new extension, and it maps into the closed vocabulary",
    );
    assert.equal(SUPPORTED_FILE_EXTENSIONS[".pdf"], "pdf");
    assert.deepEqual([...KNOWLEDGE_SOURCE_TYPES].sort(), ["markdown", "pdf", "plain-text"]);

    /* Still refused, and still by extension rather than by attempting anything. */
    for (const rejected of [".docx", ".doc", ".html", ".csv", ".xlsx", ".zip", ".png", ".rtf", ".odt"]) {
      assert.equal(SUPPORTED_FILE_EXTENSIONS[rejected], undefined, `${rejected} is still not read`);
      const verdict = validateSelectedFile({
        fileName: `policy${rejected}`,
        byteLength: 10,
        declaredMediaType: "",
      });
      assert.equal(verdict.ok, false);
    }
  }

  /* ── 3. THE PDF BYTE BOUND IS ITS OWN, AND FITS THE REAL REQUEST ───────── */
  {
    assert.notEqual(
      MAX_PDF_BYTES,
      MAX_FILE_BYTES,
      "a PDF's bytes and its characters are unrelated, so it cannot share the text bound",
    );
    assert.equal(maxBytesFor("pdf"), MAX_PDF_BYTES);
    assert.equal(maxBytesFor("plain-text"), MAX_FILE_BYTES);
    assert.equal(maxBytesFor("markdown"), MAX_FILE_BYTES);
    assert.ok(
      MAX_PDF_BYTES < NEXT_SERVER_ACTION_BODY_LIMIT_BYTES,
      "and it stays under the framework's request cap so Hebun owns the refusal",
    );

    /*
     * THE HEADROOM IS MEASURED, NOT ASSUMED. A real multipart body is serialized here with a file at
     * the bound plus every other field at its own maximum, and the total must still fit. If the
     * envelope ever grows, this fails instead of a 413 appearing in production.
     */
    const payload = new FormData();
    payload.set("file", new File([new ArrayBuffer(MAX_PDF_BYTES)], `${"n".repeat(180)}.pdf`, {
      type: "application/pdf",
    }));
    payload.set("sourceTitle", "T".repeat(200));
    payload.set("domainKey", "d".repeat(64));
    payload.set("scope", "company-wide");
    payload.set(`$ACTION_ID_${"0".repeat(48)}`, "");
    const bodyBytes = (await new Request("https://example.test/", {
      method: "POST",
      body: payload,
    }).arrayBuffer()).byteLength;
    assert.ok(
      bodyBytes <= NEXT_SERVER_ACTION_BODY_LIMIT_BYTES,
      `a file at the bound must fit the real request: ${bodyBytes} of ${NEXT_SERVER_ACTION_BODY_LIMIT_BYTES}`,
    );

    /* A PDF at the bound passes; one byte over is refused. */
    const facts = (byteLength: number) => ({
      fileName: "policy.pdf",
      byteLength,
      declaredMediaType: "application/pdf",
    });
    assert.equal(validateSelectedFile(facts(MAX_PDF_BYTES)).ok, true);
    const over = validateSelectedFile(facts(MAX_PDF_BYTES + 1));
    assert.equal(over.ok, false);
    if (over.ok) throw new Error("unreachable");
    assert.ok(over.problems.some((problem) => problem.code === "too-large"));

    /* And a text file is still held to its own, much smaller bound. */
    const text = validateSelectedFile({
      fileName: "notes.txt",
      byteLength: MAX_FILE_BYTES + 1,
      declaredMediaType: "",
    });
    assert.equal(text.ok, false);
  }

  /* ── 4. THE SIGNATURE IS CHECKED, AND A NAME PROVES NOTHING ────────────── */
  {
    assert.equal(hasPdfSignature(pdfBytes(makePdf(["a"]))), true);
    assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF").buffer as ArrayBuffer), false);
    assert.equal(
      hasPdfSignature(new TextEncoder().encode("Merhaba, bu bir metin dosyasi.").buffer as ArrayBuffer),
      false,
      "a text file renamed .pdf does not begin like a PDF",
    );
    assert.equal(hasPdfSignature(new ArrayBuffer(0)), false);
    /* Leading whitespace is not tolerated: the signature is at byte zero or it is not there. */
    assert.equal(
      hasPdfSignature(new TextEncoder().encode(" %PDF-1.4").buffer as ArrayBuffer),
      false,
    );

    /* The boundary consults it BEFORE the parser. */
    const signatureAt = boundaryCode.indexOf("hasPdfSignature(bytes)");
    const parseAt = boundaryCode.indexOf("extractPdf ?? extractPdfText");
    assert.ok(signatureAt > 0 && parseAt > 0 && signatureAt < parseAt,
      "the signature is checked before the parser is handed anything");
  }

  /* ── 5. REAL DOCUMENTS: WHAT IS READ, AND WHAT IS REFUSED ──────────────── */
  {
    /* Turkish survives byte-identically through a real font encoding. */
    const turkish = "Gider onayı: şube müdürü İK çalışanı ğ harfi ve Çğüöş kontrolü.";
    const ok = await extractPdfText(pdfBytes(makePdf([turkish])));
    assert.equal(ok.ok, true);
    if (!ok.ok) throw new Error("unreachable");
    assert.ok(ok.text.includes(turkish), "every Turkish character round-trips through extraction");
    assert.equal(ok.pageCount, 1);

    /* Multi-page documents keep page order and separate pages. */
    const pages = ["Birinci sayfa: gider politikası.", "İkinci sayfa: fişler yedi yıl saklanır."];
    const multi = await extractPdfText(pdfBytes(makePdf(pages)));
    assert.equal(multi.ok, true);
    if (!multi.ok) throw new Error("unreachable");
    assert.equal(multi.pageCount, 2);
    assert.ok(multi.text.indexOf(pages[0]!) < multi.text.indexOf(pages[1]!), "source order is kept");

    /* Each refusal is its OWN reason — a reader must learn which problem they have. */
    const cases: readonly [string, ArrayBuffer, string][] = [
      ["encrypted", pdfBytes(makeEncryptedPdf()), "pdf-encrypted"],
      ["truncated", pdfBytes(makeTruncatedPdf()), "pdf-unreadable"],
      ["not a document", new TextEncoder().encode("%PDF- but nothing else at all").buffer as ArrayBuffer, "pdf-unreadable"],
      ["image only", pdfBytes(makePdf(["x"], { imageOnly: true })), "pdf-no-text"],
      [
        "over the page bound",
        pdfBytes(makePdf(Array.from({ length: MAX_PDF_PAGES + 1 }, (_, i) => `Sayfa ${i + 1}`))),
        "pdf-too-many-pages",
      ],
    ];
    for (const [label, bytes, code] of cases) {
      const result = await extractPdfText(bytes);
      assert.equal(result.ok, false, `${label} must be refused`);
      if (result.ok) throw new Error("unreachable");
      assert.equal(result.problem.code, code, `${label} is refused as ${code}`);
      assert.ok(result.problem.message.length > 20, `${label} explains itself`);
    }

    /* Exactly at the page bound is accepted — the bound is a limit, not an off-by-one. */
    const atBound = await extractPdfText(
      pdfBytes(makePdf(Array.from({ length: MAX_PDF_PAGES }, (_, i) => `Sayfa ${i + 1}`))),
    );
    assert.equal(atBound.ok, true, `${MAX_PDF_PAGES} pages is allowed`);

    /* The scan refusal says the word, because "empty" would send someone back to retry forever. */
    const scan = await extractPdfText(pdfBytes(makePdf(["x"], { imageOnly: true })));
    if (scan.ok) throw new Error("unreachable");
    assert.match(scan.problem.message, /OCR/, "the scan refusal names why, not just that");

    /* Extraction past the character ceiling refuses the WHOLE document, never a prefix. */
    const line = "Gider onayı kuralları bu satırda tekrar tekrar açıklanmaktadır ve uzundur.";
    const page = Array.from({ length: 60 }, () => line).join("\n");
    const longDoc = Array.from({ length: 25 }, () => page);
    const tooLong = await extractPdfText(pdfBytes(makePdf(longDoc)));
    assert.equal(tooLong.ok, false, "a document over the character ceiling is refused");
    if (tooLong.ok) throw new Error("unreachable");
    assert.equal(tooLong.problem.code, "pdf-text-too-long");
    assert.match(
      tooLong.problem.message,
      new RegExp(String(MAX_SOURCE_CHARACTERS).slice(0, 2)),
      "and the refusal names the ceiling it hit",
    );
  }

  /* ── 6. HARDENING IS REAL, AND THE ONE CONTROL THAT ISN'T IS ABSENT ────── */
  {
    for (const control of [
      /enableXfa: false/,
      /disableFontFace: true/,
      /useSystemFonts: false/,
      /useWorkerFetch: false/,
    ]) {
      assert.match(extractorCode, control, `the extraction options set ${control}`);
    }

    /*
     * `isEvalSupported` is NOT set, and that is deliberate rather than an omission: the option does
     * not exist anywhere in the installed 6.2.108, because the path it guarded was removed upstream.
     * Setting it would be a no-op that reads like a protection. This asserts BOTH halves — the
     * package really does not have it, and this repository really does not pretend to set it.
     */
    const packageHasIt = collect("node_modules/pdfjs-dist/build").some((file) =>
      readFileSync(file, "utf8").includes("isEvalSupported"),
    );
    assert.equal(
      packageHasIt,
      false,
      "the installed parser has no isEvalSupported option — if this fails, the control is real " +
        "again and the extractor must set it",
    );
    assert.ok(
      !/isEvalSupported\s*:/.test(extractorCode),
      "so the extractor does not set an option that does not exist",
    );

    /*
     * `enableScripting` is not reachable either: it belongs to the annotation layer, not to
     * getDocument, and this module builds no annotation layer. Verified against the shipped types.
     */
    const apiTypes = read("node_modules/pdfjs-dist/types/src/display/api.d.ts");
    assert.match(apiTypes, /enableXfa\?: boolean/, "enableXfa IS a document option");
    assert.ok(
      !apiTypes.includes("enableScripting"),
      "enableScripting is NOT a document option, so text extraction cannot reach the scripting path",
    );
    for (const forbidden of ["AnnotationLayer", "render(", "canvas", "getViewport", "sandbox"]) {
      assert.ok(
        !extractorCode.includes(forbidden),
        `the extractor must not reach ${forbidden} — it extracts text and renders nothing`,
      );
    }
    /* It loads the Node build, because the default build throws on import in Node. */
    assert.match(extractorCode, /legacy\/build\/pdf\.mjs/);
  }

  /* ── 7. THE PARSER IS A PARSER: NO WRITES, NO PERSISTENCE, NO AUTHORITY ── */
  {
    for (const forbidden of [
      "knowledgeNodes",
      "knowledgeFacts",
      "durable-knowledge-writer",
      "db.transaction",
      ".insert(",
      "heby",
      "action-authorization",
      "action-execution",
      "provider",
      "governance",
      "ratif",
      "storage_path",
      "node:fs",
      "writeFile",
      "tmpdir",
      "fetch(",
      "@vercel/blob",
      "S3Client",
    ]) {
      assert.ok(
        !extractorCode.toLowerCase().includes(forbidden.toLowerCase()),
        `the parser must not reach ${forbidden}`,
      );
    }
    /*
     * `documents` is checked as a TABLE, not as a word. A refusal message that reads "Longer
     * documents exceed what one ingestion can hold" is good English and tripped a crude token scan —
     * the same trap comment-stripping does not catch, because a string literal is code. The
     * repository-wide consumer check below is the assertion that actually means anything here.
     */
    assert.ok(
      !/from "@\/db\/schema\/document"|insert\(documents\)|from\(documents\)/.test(extractorCode),
      "the parser must not reach the documents table",
    );
    /* It imports only from this repository plus the one pinned parser. */
    const imports = [...extractorCode.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
    for (const specifier of imports) {
      assert.ok(
        specifier.startsWith(".") || specifier.startsWith("@/"),
        `the parser imports ${specifier} statically — only the dynamic parser import is external`,
      );
    }

    /* Still exactly one Knowledge writer in the whole repository. */
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) => /\.insert\(knowledgeNodes\)|\.insert\(knowledgeFacts\)/.test(read(file)));
    assert.deepEqual(
      writers,
      ["src/features/knowledge/durable-knowledge-writer.server.ts"],
      "R4C.2 added a parser, NOT a second writer",
    );

    /* Nothing anywhere writes a file or reaches a blob store. */
    const persisters = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) =>
        /writeFileSync|writeFile\(|createWriteStream|node:fs|tmpdir\(|@vercel\/blob|S3Client/.test(
          codeOf(read(file)),
        ),
      );
    assert.deepEqual(persisters, [], "no application module persists bytes");

    /* documents is still dead. Fifth refusal. */
    const documentConsumers = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) =>
        /from "@\/db\/schema\/document"|insert\(documents\)|from\(documents\)/.test(read(file)),
      );
    assert.deepEqual(documentConsumers, [], "the documents table still has no reader and no writer");
  }

  /* ── 8. THE RESOURCE MODEL IS DESCRIBED HONESTLY ───────────────────────── */
  {
    const source = read(EXTRACTOR);
    assert.match(
      source,
      /reporting, not isolation/,
      "the deadline is named for what it is",
    );
    for (const overclaim of [/\bsandbox(?!Bundle)/i, /isolate[sd]?\b/i, /terminat/i]) {
      assert.ok(
        !overclaim.test(codeOf(source)),
        `the parser must not claim ${overclaim} — nothing here reclaims a CPU`,
      );
    }
    /* And no execution subsystem was introduced to pretend otherwise. */
    for (const forbidden of ["worker_threads", "child_process", "Worker(", "spawn("]) {
      assert.ok(!extractorCode.includes(forbidden), `R4C.2 introduces no ${forbidden}`);
    }

    /* The page bound is applied BEFORE any page is fetched. */
    const boundAt = extractorCode.indexOf("pageCount > MAX_PDF_PAGES");
    const getPageAt = extractorCode.indexOf("document.getPage(");
    assert.ok(boundAt > 0 && getPageAt > 0 && boundAt < getPageAt,
      "the page count is refused before a single page is extracted");
  }

  /* ── 9. NO HTTP SURFACE, AND NO CONFIG WAS NEEDED ──────────────────────── */
  {
    /* AMENDED BY INT-3 — see `r4c-flow/file-boundary-and-firewall.ts` for the reasoning. */
    assert.deepEqual(
      collect("src/app")
        .filter((file) => /\/route\.tsx?$/.test(file))
        .map((file) => file.replace(/\\/g, "/"))
        .sort(),
      /* AMENDED BY GITHUB-2 — the installation pair joins INT-3's OAuth pair; see r4a-flow. */
      [
        "src/app/api/integrations/github/setup/route.ts",
        "src/app/api/integrations/github/start/route.ts",
        "src/app/api/integrations/google/callback/route.ts",
        "src/app/api/integrations/google/start/route.ts",
      ].sort(),
      "R4C.2 introduces no route handler; the only ones are INT-3's OAuth pair",
    );

    /*
     * The Next build compiles the dynamic parser import with no bundling opt-out, so none was added.
     * This asserts the config was left alone rather than changed prophylactically — and it also
     * asserts the request-size setting was NOT touched, which is the setting that would have
     * quietly widened every other server action in the application.
     */
    const config = read("next.config.ts");
    assert.ok(
      !config.includes("serverExternalPackages"),
      "the build did not need a bundling opt-out, so none was added",
    );
    assert.ok(!config.includes("bodySizeLimit"), "and the request body limit is untouched");
  }

  /* ── 10. THE WORKSPACE DOES NOT PARSE, AND DOES NOT OVERCLAIM ──────────── */
  {
    const cardCode = codeOf(read(CARD));
    assert.ok(
      !cardCode.includes("pdfjs") && !cardCode.includes("extractPdfText"),
      "the parser never ships to the browser",
    );
    /* The card states each PDF limitation before anyone selects a file. */
    const prose = read(CARD).replace(/\s+/g, " ");
    for (const claim of [/does not perform OCR/, /Password-protected PDFs are not opened/, /tables and multi-column layouts are flattened/, /not a page number/]) {
      assert.match(prose, claim, `the workspace states: ${claim}`);
    }
    assert.match(prose, new RegExp(`up to \\{MAX_PDF_PAGES\\} pages`), "and names the page bound");
  }

  console.log("PASS r4c2 pdf extraction and firewall");
}

void main();
