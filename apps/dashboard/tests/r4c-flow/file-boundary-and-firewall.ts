/*
 * R4C.1 — the file upload boundary: bounds, decoder, and the firewall around them.
 *
 * WHAT THIS FILE IS FOR. R4C.1 deliberately falsified a claim Hebun used to make ("there is no
 * upload path at all"). Everything that is STILL true after that change has to be locked here, or
 * the next phase inherits a boundary nobody can tell from a wider one: a manually selected, bounded,
 * strictly-decoded `.txt`/`.md` file exists — and permanent raw-file storage, an HTTP upload
 * endpoint, PDF/DOCX/OCR, and any form of automation do NOT.
 *
 * The decoder and bounds are exercised as FUNCTIONS, not described. Where the claim is about what
 * the code may not become, the released source is read.
 *
 * Pure — no database, no clock, no network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_FILE_BYTES,
  NEXT_SERVER_ACTION_BODY_LIMIT_BYTES,
  SUPPORTED_FILE_EXTENSIONS,
  contradictsTextMediaType,
  decodeUtf8Strictly,
  extensionOf,
  sourceTitleFromFileName,
  validateSelectedFile,
} from "../../src/features/knowledge/file-ingestion-contracts";
import {
  MAX_SOURCE_CHARACTERS,
  MAX_SOURCE_TITLE_CHARACTERS,
  chunkSource,
  normalizeSourceText,
} from "../../src/features/knowledge/ingestion-contracts";
import { KNOWLEDGE_SOURCE_TYPES } from "../../src/features/knowledge/create-contracts";

const BOUNDARY = "src/features/knowledge/knowledge-file-ingest.server.ts";
const CONTRACTS = "src/features/knowledge/file-ingestion-contracts.ts";
const ACTIONS = "src/app/(dashboard)/knowledge/actions.ts";
const CARD = "src/components/knowledge-workspace/knowledge-ingestion-card.tsx";
const WRITER = "src/features/knowledge/durable-knowledge-writer.server.ts";

const read = (path: string) => readFileSync(path, "utf8");
/** Strip block and line comments, so prose about a thing is never mistaken for the thing. */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const bytesOf = (text: string): ArrayBuffer => {
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
};

function facts(fileName: string, byteLength = 10, declaredMediaType = "") {
  return { fileName, byteLength, declaredMediaType };
}

function main(): void {
  const boundaryCode = codeOf(read(BOUNDARY));
  const contractsCode = codeOf(read(CONTRACTS));

  /* ── 1. THE ACCEPTED SET IS EXACTLY TWO TEXT-NATIVE FORMATS ────────────── */
  {
    assert.deepEqual(
      Object.keys(SUPPORTED_FILE_EXTENSIONS).sort(),
      [".markdown", ".md", ".txt"],
      "generation one reads .txt and .md and nothing else",
    );
    assert.deepEqual(
      [...new Set(Object.values(SUPPORTED_FILE_EXTENSIONS))].sort(),
      ["markdown", "plain-text"],
      "and each maps into the CLOSED source-type vocabulary",
    );
    /* The vocabulary is closed at its owner, so a caller cannot invent a provenance label. */
    assert.deepEqual([...KNOWLEDGE_SOURCE_TYPES].sort(), ["markdown", "plain-text"]);

    for (const rejected of [".pdf", ".docx", ".doc", ".html", ".htm", ".csv", ".xlsx", ".zip", ".png", ".jpg", ".rtf", ".odt", ""]) {
      assert.equal(
        SUPPORTED_FILE_EXTENSIONS[rejected],
        undefined,
        `${rejected || "(no extension)"} is not readable in generation one`,
      );
      const verdict = validateSelectedFile(facts(`policy${rejected}`));
      assert.equal(verdict.ok, false);
      if (verdict.ok) throw new Error("unreachable");
      assert.ok(
        verdict.problems.some((problem) => problem.code === "unsupported-extension"),
        `${rejected || "(no extension)"} is refused by extension, not attempted`,
      );
    }

    /* A multi-dot name resolves on the LAST dot, and a dotfile has no extension. */
    assert.equal(extensionOf("policy.v2.MD"), ".md");
    assert.equal(extensionOf(".gitignore"), "");
    assert.equal(extensionOf("plain"), "");
  }

  /* ── 2. NO PARSER, NO OCR, NO ARCHIVE — BY ABSENCE ─────────────────────── */
  {
    for (const forbidden of [
      "pdf",
      "docx",
      "mammoth",
      "pdfjs",
      "unpdf",
      "ocr",
      "tesseract",
      "jszip",
      "yauzl",
      "unzip",
      "embedding",
      "pgvector",
      "similarity",
      "openai",
      "anthropic",
      "provider-invocation",
      "live-dispatch",
      "permit",
      "agent-runtime",
      "documents",
      "storage_path",
      "supabase",
      "s3",
      "blob",
      "fetch(",
      "readFile",
      "writeFile",
      "node:fs",
      "tmpdir",
      "ratify",
      "ratification",
    ]) {
      assert.ok(
        !boundaryCode.toLowerCase().includes(forbidden),
        `the file boundary must not reach ${forbidden}`,
      );
      assert.ok(
        !contractsCode.toLowerCase().includes(forbidden),
        `the file contract must not reach ${forbidden}`,
      );
    }
    /* Zero dependencies: both modules import only from within this repository. */
    for (const [label, code] of [["boundary", boundaryCode], ["contract", contractsCode]] as const) {
      const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
      for (const specifier of imports) {
        assert.ok(
          specifier.startsWith(".") || specifier.startsWith("@/"),
          `${label} imports ${specifier} — R4C.1 adds no dependency`,
        );
      }
    }
  }

  /* ── 3. THE BYTE BOUND IS DERIVED, AND SITS UNDER THE FRAMEWORK'S ──────── */
  {
    assert.equal(
      MAX_FILE_BYTES,
      MAX_SOURCE_CHARACTERS * 4,
      "the bound is the largest UTF-8 encoding of the character bound that already exists",
    );
    assert.ok(
      MAX_FILE_BYTES < NEXT_SERVER_ACTION_BODY_LIMIT_BYTES,
      "and it stays under the framework body cap, so Hebun owns the refusal rather than an HTTP 413",
    );
    /*
     * The framework figure is not folklore: it is read back out of the INSTALLED Next, so a version
     * bump that changed it would fail here instead of silently moving the boundary.
     */
    const handler = "node_modules/next/dist/server/app-render/action-handler.js";
    if (existsSync(handler)) {
      assert.match(
        read(handler),
        /defaultBodySizeLimit = '1 MB'/,
        "the installed Next still defaults a server action body to 1 MB",
      );
    }

    assert.equal(validateSelectedFile(facts("a.txt", MAX_FILE_BYTES)).ok, true);
    const over = validateSelectedFile(facts("a.txt", MAX_FILE_BYTES + 1));
    assert.equal(over.ok, false);
    if (over.ok) throw new Error("unreachable");
    assert.ok(over.problems.some((problem) => problem.code === "too-large"));

    const empty = validateSelectedFile(facts("a.txt", 0));
    assert.equal(empty.ok, false);
    if (empty.ok) throw new Error("unreachable");
    assert.ok(empty.problems.some((problem) => problem.code === "empty-file"));
  }

  /* ── 4. THE FILE NAME IS A TITLE CANDIDATE, JUDGED BY THE TITLE'S RULE ─── */
  {
    const control = validateSelectedFile(facts("policy.txt"));
    assert.equal(control.ok, false);
    if (control.ok) throw new Error("unreachable");
    assert.ok(control.problems.some((problem) => problem.code === "file-name-control-characters"));

    const long = validateSelectedFile(facts(`${"n".repeat(MAX_SOURCE_TITLE_CHARACTERS + 1)}.txt`));
    assert.equal(long.ok, false);
    if (long.ok) throw new Error("unreachable");
    assert.ok(long.problems.some((problem) => problem.code === "file-name-too-long"));

    /* The bound is the TITLE's bound, imported — not a second number that could drift. */
    assert.match(
      contractsCode,
      /MAX_SOURCE_TITLE_CHARACTERS/,
      "the file name bound is the source-title bound, one owner",
    );
    assert.match(
      contractsCode,
      /hasSingleLineControlCharacters/,
      "and the control-character rule is the source-title rule, one owner",
    );

    assert.equal(sourceTitleFromFileName("Expense policy 2026.md"), "Expense policy 2026");
    assert.equal(sourceTitleFromFileName("policy.v2.txt"), "policy.v2");
    /* Turkish file names survive intact — the default title is the operator's own words. */
    assert.equal(sourceTitleFromFileName("Gider Politikası şubat.md"), "Gider Politikası şubat");
  }

  /* ── 5. A DECLARED MEDIA TYPE MAY REFUSE, NEVER ACCEPT ─────────────────── */
  {
    /* Empty and generic are accepted: the OS registry, not the user, decides what is present. */
    for (const tolerated of ["", "   ", "text/plain", "text/markdown", "text/x-markdown", "TEXT/PLAIN", "application/octet-stream"]) {
      assert.equal(contradictsTextMediaType(tolerated), false, `${tolerated || "(empty)"} is tolerated`);
      assert.equal(validateSelectedFile(facts("a.md", 10, tolerated)).ok, true);
    }
    /* A positive contradiction refuses. */
    for (const contradiction of ["application/pdf", "image/png", "application/zip", "video/mp4"]) {
      assert.equal(contradictsTextMediaType(contradiction), true);
      const verdict = validateSelectedFile(facts("a.txt", 10, contradiction));
      assert.equal(verdict.ok, false);
      if (verdict.ok) throw new Error("unreachable");
      assert.ok(verdict.problems.some((problem) => problem.code === "media-type-mismatch"));
    }
    /*
     * AND IT CAN NEVER RESCUE AN UNREADABLE FILE. A perfect `text/plain` header on a `.pdf` is
     * still refused — the extension allowlist and the decoder are the gates, not the header.
     */
    const spoofed = validateSelectedFile(facts("invoice.pdf", 10, "text/plain"));
    assert.equal(spoofed.ok, false);
    if (spoofed.ok) throw new Error("unreachable");
    assert.ok(spoofed.problems.some((problem) => problem.code === "unsupported-extension"));
  }

  /* ── 6. THE DECODER IS STRICT, AND SHARED WITH THE PREVIEW ─────────────── */
  {
    /* Turkish round-trips byte-identically — the corpus is Turkish, so this is not decoration. */
    const turkish = "Şirket giderleri: ığüşöçİĞÜŞÖÇ. Beş bin lira üstü onay ister.";
    const decoded = decodeUtf8Strictly(bytesOf(turkish));
    assert.equal(decoded.ok, true);
    if (!decoded.ok) throw new Error("unreachable");
    assert.equal(decoded.text, turkish, "no character is altered, replaced or normalized");

    /* A byte-order mark is removed rather than becoming an invisible first character. */
    const withBom = decodeUtf8Strictly(bytesOf("﻿Expense policy"));
    assert.equal(withBom.ok, true);
    if (!withBom.ok) throw new Error("unreachable");
    assert.equal(withBom.text, "Expense policy");

    /* Markdown is text. It is carried, never parsed. */
    const markdown = "# Expense policy\n\nApprovals follow the matrix.\n\n- Receipts kept 7 years";
    const md = decodeUtf8Strictly(bytesOf(markdown));
    assert.equal(md.ok, true);
    if (!md.ok) throw new Error("unreachable");
    assert.equal(md.text, markdown, "no heading, bullet or marker is stripped or rewritten");
    assert.match(chunkSource(normalizeSourceText(md.text))[0]!.text, /^# Expense policy/);

    /* Malformed input FAILS CLOSED — it is never repaired into replacement characters. */
    for (const [label, bad] of [
      ["a lone continuation byte", new Uint8Array([0x41, 0x80, 0x42])],
      ["a truncated sequence", new Uint8Array([0xc3])],
      ["a JPEG header", new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
      ["UTF-16LE with a BOM", new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00])],
      ["Windows-1254 Turkish", new Uint8Array([0x53, 0xfe, 0x69, 0x72, 0x6b, 0x65, 0x74])],
    ] as const) {
      const attempt = decodeUtf8Strictly(
        bad.buffer.slice(bad.byteOffset, bad.byteOffset + bad.byteLength),
      );
      assert.equal(attempt.ok, false, `${label} must be refused`);
      if (attempt.ok) throw new Error("unreachable");
      assert.equal(attempt.problem.code, "undecodable");
      assert.ok(
        !attempt.problem.message.includes("�"),
        "and the refusal does not hand back a repaired string",
      );
    }

    /* The card decodes with THIS function, so a file it previews is one the server can read. */
    const cardCode = codeOf(read(CARD));
    assert.match(
      cardCode,
      /import \{[\s\S]*?decodeUtf8Strictly[\s\S]*?validateSelectedFile[\s\S]*?\} from "@\/features\/knowledge\/file-ingestion-contracts"/,
      "the workspace previews with the SERVER'S decoder and the SERVER'S bounds",
    );
    assert.ok(
      !/new TextDecoder|\.text\(\)/.test(cardCode),
      "and carries no second decoder that could disagree with it",
    );
  }

  /* ── 7. THE BOUNDARY WRITES NOTHING AND KEEPS NOTHING ──────────────────── */
  {
    /* Still exactly one Knowledge writer in the whole repository. */
    const writers = collect("src/features")
      .concat(collect("src/app"))
      .filter((file) => /\.insert\(knowledgeNodes\)|\.insert\(knowledgeFacts\)/.test(read(file)));
    assert.deepEqual(writers.sort(), [WRITER], "R4C.1 added a door, NOT a second writer");

    assert.ok(
      !/\.insert\(|\.update\(|\.delete\(|db\.transaction/.test(boundaryCode),
      "the file boundary issues no statement of its own",
    );
    assert.match(
      boundaryCode,
      /ingestKnowledgeSource/,
      "it delegates to the existing producer",
    );
    /* The bytes are read once, into one local, and handed to exactly one function. */
    assert.equal(
      (boundaryCode.match(/await file\.arrayBuffer\(\)/g) ?? []).length,
      1,
      "the file is read exactly once",
    );
    assert.deepEqual(
      [...new Set([...boundaryCode.matchAll(/(\w+)\(bytes\)/g)].map((match) => match[1]!))],
      ["decodeUtf8Strictly"],
      "and the buffer is passed to the decoder and to nothing else",
    );
  }

  /* ── 8. AUTHORITY IS SERVER-RESOLVED, AND ORDERED BEFORE THE FILE ──────── */
  {
    /*
     * Anchored INSIDE the function body on purpose. Searching the whole module for
     * "resolveAuthority" finds the deps interface declared above it, which is always first — an
     * assertion that can never fail, which is worse than no assertion. Both positions are taken
     * from the call sites, each of which appears exactly once.
     */
    const bodyAt = boundaryCode.indexOf("export async function ingestKnowledgeFile");
    assert.ok(bodyAt > 0, "the boundary function is declared");
    const authenticatedAt = boundaryCode.indexOf("return { status: \"unauthorized\" }", bodyAt);
    const authorityAt = boundaryCode.indexOf("deps.resolveAuthority ??", bodyAt);
    const fileAt = boundaryCode.indexOf("asSelectedFile(input", bodyAt);
    const readAt = boundaryCode.indexOf("await file.arrayBuffer()", bodyAt);
    assert.ok(
      authenticatedAt > bodyAt && authorityAt > bodyAt && fileAt > bodyAt && readAt > bodyAt,
      "all four gates are present in the body",
    );
    assert.ok(
      authenticatedAt < authorityAt && authorityAt < fileAt && fileAt < readAt,
      "authenticated, then authorized, THEN the file is looked at, and only then read — an " +
        "unauthorized request's bytes never enter memory",
    );

    /* The input type cannot carry authority, a source type, or pre-decoded text. */
    const inputBlock = /export interface IngestKnowledgeFileInput \{[\s\S]*?\n\}/.exec(boundaryCode);
    assert.ok(inputBlock, "the input contract is declared");
    assert.ok(
      !/tenantId|userId|roleId|actorId|sourceType|sourceText|status|authority|digest/.test(
        inputBlock![0],
      ),
      "no tenant, actor, role, source type, decoded text, standing or digest is representable",
    );
    /* `sourceType` is DERIVED from what the validator accepted, never copied from input. */
    assert.match(
      boundaryCode,
      /sourceType: bounds\.sourceType/,
      "the source type comes from the validated extension",
    );
  }

  /* ── 9. THE ACTION IS THE ONLY CLIENT-CROSSABLE ENTRY, AND IS NOT A ROUTE ─ */
  {
    const actionsCode = codeOf(read(ACTIONS));
    assert.match(actionsCode, /export async function ingestKnowledgeFileAction/);
    assert.match(
      actionsCode,
      /const tenant = await resolveTenantContext\(\);[\s\S]{0,400}ingestKnowledgeFile\(tenant/,
      "the tenant is resolved server-side and never accepted from the form",
    );

    /*
     * R4C.1 INTRODUCES NO HTTP SURFACE. This is the same repo-wide claim the released R4A and R4B
     * boundary suites assert; it is restated here because THIS is the phase that would have been
     * tempted to break it.
     */
    assert.deepEqual(
      collect("src/app").filter((file) => /\/route\.tsx?$/.test(file)),
      [],
      "no route handler exists",
    );
    assert.equal(existsSync("src/app/api"), false, "and there is no API directory");

    /* Heby cannot reach the file boundary: no Heby module imports it. */
    const hebyImporters = collect("src/features")
      .filter((file) => /heby/.test(file))
      .filter((file) => read(file).includes("knowledge-file-ingest"));
    assert.deepEqual(hebyImporters, [], "no Heby module can reach the file boundary");
    /* And the boundary reaches no Heby, action, provider or execution module. */
    assert.ok(
      !/heby|action-authorization|action-execution|provider|external-recipients/.test(boundaryCode),
      "the file boundary imports nothing from Heby, actions, providers or execution",
    );
  }

  /* ── 10. NOTHING ANYWHERE PERSISTS A RAW FILE ──────────────────────────── */
  {
    const appFiles = collect("src/features").concat(collect("src/app"));
    const persisters = appFiles.filter((file) =>
      /writeFileSync|writeFile\(|createWriteStream|node:fs|tmpdir\(|@vercel\/blob|S3Client|createClient\(.*storage/.test(
        codeOf(read(file)),
      ),
    );
    assert.deepEqual(persisters, [], "no application module writes a file or reaches a blob store");

    /* `documents` remains without a consumer — the third refusal, still holding. */
    const documentConsumers = appFiles.filter((file) =>
      /from "@\/db\/schema\/document"|insert\(documents\)|from\(documents\)/.test(read(file)),
    );
    assert.deepEqual(documentConsumers, [], "the documents table still has no reader and no writer");
  }

  /* ── 11. THE CAPABILITY MAP NO LONGER DENIES WHAT NOW EXISTS ───────────── */
  {
    const map = read("src/features/knowledge/capability-map.ts");
    assert.ok(
      !map.includes("there is no upload path at all"),
      "the claim R4C.1 falsified has been repaired, not left standing",
    );
    /* And the claims that ARE still true are stated, so the repair did not overshoot. */
    for (const stillTrue of [
      "no parser and no OCR",
      "the `documents` table still has no consumer",
      "ingesting is not ratifying",
    ]) {
      assert.ok(map.includes(stillTrue), `the map still states: ${stillTrue}`);
    }
  }

  console.log("PASS r4c file boundary and firewall");
}

main();
