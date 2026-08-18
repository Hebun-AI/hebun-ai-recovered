/*
 * Synthetic PDF fixtures (R4C.2).
 *
 * WHY THESE ARE BUILT RATHER THAN CHECKED IN. A PDF committed as a binary blob is a fixture nobody
 * can read, diff, or reason about — and "why does this test fail" becomes an archaeology problem.
 * These are generated from source, uncompressed, so every byte in the document under test is
 * explained by the code that wrote it.
 *
 * They are ordinary, well-formed documents. Nothing here is an exploit, and nothing tries to be:
 * the security assertions in this phase are about REFUSING inputs (bad signature, too many pages,
 * encrypted, image-only, oversize), and each of those is expressed by structure, not by an attack.
 *
 * TURKISH IS CARRIED THE WAY REAL PDFs CARRY IT — a Type1 font with an `/Encoding` dictionary whose
 * `/Differences` array maps byte codes to standard Adobe glyph names (`scedilla`, `gbreve`,
 * `dotlessi`, `Idotaccent`, …). pdf.js resolves those names back to Unicode, so a round-trip through
 * this fixture proves the real mechanism rather than an ASCII stand-in.
 */

/** Adobe glyph names for the Turkish characters outside WinAnsi. */
const GLYPH: Readonly<Record<string, string>> = {
  "ş": "scedilla",
  "Ş": "Scedilla",
  "ğ": "gbreve",
  "Ğ": "Gbreve",
  "ı": "dotlessi",
  "İ": "Idotaccent",
  "ö": "odieresis",
  "Ö": "Odieresis",
  "ü": "udieresis",
  "Ü": "Udieresis",
  "ç": "ccedilla",
  "Ç": "Ccedilla",
};

export interface PdfFixtureOptions {
  /** Emit pages that draw an image and no text at all — an image-only "scan". */
  readonly imageOnly?: boolean;
  /** Pad the document with a comment block so it reaches at least this many bytes. */
  readonly padToBytes?: number;
  /**
   * Declare standard PDF encryption in the trailer.
   *
   * The `/Encrypt` dictionary is written as a REAL numbered object inside the cross-reference table.
   * That detail is the whole fixture: a first attempt placed it outside the xref, the reference
   * dangled, the reader ignored it, and the document opened normally — a fixture that proved
   * nothing while looking like it proved encryption was handled.
   */
  readonly encrypted?: boolean;
}

/**
 * Build a valid, uncompressed PDF whose pages carry exactly the given strings.
 *
 * Returns the raw bytes. Every string must be representable either in WinAnsi or by one of the
 * glyph names above; anything else throws here rather than silently producing a document that
 * extracts to something different from what the test asked for.
 */
export function makePdf(pages: readonly string[], options: PdfFixtureOptions = {}): Uint8Array {
  const { imageOnly = false, padToBytes, encrypted = false } = options;
  const objects: string[] = [];
  const add = (body: string): number => objects.push(body);

  const special = [...new Set(pages.join("").split(""))].filter((character) => GLYPH[character]);
  const codeOf = new Map(special.map((character, index) => [character, 0x80 + index]));

  const encodeHex = (text: string): string =>
    [...text]
      .map((character) => {
        const assigned = codeOf.get(character);
        if (assigned !== undefined) return assigned.toString(16).padStart(2, "0");
        const point = character.codePointAt(0) ?? 0;
        if (point > 0xff) {
          throw new Error(`pdf fixture: no glyph mapping for ${JSON.stringify(character)}`);
        }
        return point.toString(16).padStart(2, "0");
      })
      .join("");

  const contentIds: number[] = [];
  for (const text of pages) {
    /*
     * ONE SHOW-TEXT OPERATOR PER LINE, which is what a real producer emits.
     *
     * A first version put a whole page into a single `Tj`. A reader extracted 2 698 characters out
     * of 111 000 from it — so a test that meant to exceed the character ceiling quietly stayed
     * under it, and the bound it was checking never fired. Splitting on newlines both matches how
     * documents are actually written and makes long fixtures behave like long documents.
     */
    const lines = text.split("\n");
    const stream = imageOnly
      ? `q 100 0 0 100 72 600 cm /Im0 Do Q`
      : `BT /F1 12 Tf 14 TL 72 720 Td ${lines
          .map((line) => `<${encodeHex(line)}> Tj T*`)
          .join(" ")} ET`;
    contentIds.push(
      add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`),
    );
  }

  let resourceId: number;
  if (imageOnly) {
    resourceId = add(
      `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceGray ` +
        `/BitsPerComponent 8 /Length 1 >>\nstream\nZ\nendstream`,
    );
  } else {
    const differences = special.length
      ? ` /Differences [${special.map((character) => `${codeOf.get(character)} /${GLYPH[character]}`).join(" ")}]`
      : "";
    const encodingId = add(
      `<< /Type /Encoding /BaseEncoding /WinAnsiEncoding${differences} >>`,
    );
    resourceId = add(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding ${encodingId} 0 R >>`,
    );
  }

  const resources = imageOnly
    ? `<< /XObject << /Im0 ${resourceId} 0 R >> >>`
    : `<< /Font << /F1 ${resourceId} 0 R >> >>`;

  const pagesObjectId = objects.length + pages.length + 1;
  const kidIds = pages.map((_, index) =>
    add(
      `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources ${resources} /Contents ${contentIds[index]} 0 R >>`,
    ),
  );
  const pagesId = add(
    `<< /Type /Pages /Kids [${kidIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${kidIds.length} >>`,
  );
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  /*
   * Standard security handler, revision 2. No real cipher is applied and none is needed: a reader
   * decides a password is required from this dictionary, before it decrypts anything. The `/U`
   * value deliberately does not match the empty user password, so the reader must ask.
   */
  const encryptId = encrypted
    ? add(
        `<< /Filter /Standard /V 1 /R 2 /O <${"ab".repeat(32)}> /U <${"cd".repeat(32)}> /P -1 >>`,
      )
    : 0;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const [index, body] of objects.entries()) {
    offsets[index + 1] = Buffer.byteLength(out, "latin1");
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  /* Padding goes in a comment, so the document stays valid while its byte size is controllable. */
  if (padToBytes !== undefined) {
    const shortfall = padToBytes - (Buffer.byteLength(out, "latin1") + 200 + objects.length * 20);
    if (shortfall > 0) out += `%${"p".repeat(shortfall)}\n`;
  }
  const startxref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    out += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  const encryptEntry = encrypted
    ? ` /Encrypt ${encryptId} 0 R /ID [<${"11".repeat(16)}> <${"22".repeat(16)}>]`
    : "";
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R${encryptEntry} >>\n`;
  out += `startxref\n${startxref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** The bytes of a document that is well-formed up to a point and then simply stops. */
export function makeTruncatedPdf(): Uint8Array {
  return makePdf(["Gider politikası"]).slice(0, 140);
}

/** A document a reader must ask for a password before opening. */
export function makeEncryptedPdf(): Uint8Array {
  return makePdf(["Gizli gider politikası"], { encrypted: true });
}

/**
 * Copy fixture bytes into a standalone `ArrayBuffer`.
 *
 * `Buffer.from` hands back a view over Node's shared pool, typed `Uint8Array<ArrayBufferLike>`. That
 * is not assignable where an `ArrayBuffer` is required, and passing the pooled buffer straight
 * through would also hand a caller a window onto memory it does not own. One explicit copy fixes
 * both.
 */
export function pdfBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/** Turn fixture bytes into the `File` a browser would submit. */
export function pdfFile(name: string, bytes: Uint8Array, type = "application/pdf"): File {
  return new File([pdfBytes(bytes)], name, { type });
}
