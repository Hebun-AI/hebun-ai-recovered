/*
 * media-assets/image-signature.ts — what an image IS, read from its own bytes (MEDIA-1).
 *
 * Hebun never trusts a provider's Content-Type, file extension or claimed dimensions. It reads the
 * container header itself: PNG IHDR, JPEG SOFn, WebP VP8 / VP8L / VP8X. Nothing is decoded, so a
 * decompression bomb cannot be triggered here; the dimension bound is applied to the header value.
 *
 * STRICT ON STRUCTURE, ON PURPOSE. A PNG must end with IEND, a JPEG must end with EOI, a WebP's RIFF
 * length must equal the byte length. A truncated or padded file is `malformed-image`, not an image
 * with a shrug — the digest of truncated bytes is a precise identity for something broken.
 *
 * Not recognized at all: SVG (script-capable markup), GIF, HEIC, AVIF, BMP, TIFF, anything else.
 *
 * Pure. No I/O.
 */
import type { MediaAssetMimeType } from "./contracts";

export type ImageSignatureResult =
  | {
      readonly status: "recognized";
      readonly mimeType: MediaAssetMimeType;
      readonly width: number;
      readonly height: number;
    }
  | { readonly status: "refused"; readonly reason: "unsupported-image-signature" | "malformed-image" };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const UNSUPPORTED = { status: "refused", reason: "unsupported-image-signature" } as const;
const MALFORMED = { status: "refused", reason: "malformed-image" } as const;

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) >>> 0) + (bytes[offset + 1]! << 16) + (bytes[offset + 2]! << 8) + bytes[offset + 3]!;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! + (bytes[offset + 1]! << 8) + (bytes[offset + 2]! << 16) + ((bytes[offset + 3]! << 24) >>> 0);
}

function recognized(mimeType: MediaAssetMimeType, width: number, height: number): ImageSignatureResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return MALFORMED;
  }
  return { status: "recognized", mimeType, width, height };
}

function readPng(bytes: Uint8Array): ImageSignatureResult {
  /* signature(8) + IHDR length(4) + "IHDR"(4) + data(13) + crc(4) + IEND chunk(12) */
  if (bytes.length < 8 + 25 + 12) return MALFORMED;
  if (u32be(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== "IHDR") return MALFORMED;
  const iend = bytes.length - 12;
  if (u32be(bytes, iend) !== 0 || ascii(bytes, iend + 4, 4) !== "IEND") return MALFORMED;
  return recognized("image/png", u32be(bytes, 16), u32be(bytes, 20));
}

/* SOF markers that carry frame dimensions: C0–CF except DHT (C4), JPG (C8) and DAC (CC). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readJpeg(bytes: Uint8Array): ImageSignatureResult {
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return MALFORMED;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return MALFORMED;
    let marker = bytes[offset + 1]!;
    /* Fill bytes: any number of 0xFF may precede a marker. */
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1;
      marker = bytes[offset + 1]!;
    }
    offset += 2;
    /* Standalone markers carry no length. */
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    /* Reaching SOS or EOI before a frame header means no dimensions were declared. */
    if (marker === 0xda || marker === 0xd9) return MALFORMED;
    if (offset + 2 > bytes.length) return MALFORMED;
    const length = (bytes[offset]! << 8) + bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.length) return MALFORMED;
    if (isStartOfFrame(marker)) {
      if (length < 7) return MALFORMED;
      const height = (bytes[offset + 3]! << 8) + bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) + bytes[offset + 6]!;
      return recognized("image/jpeg", width, height);
    }
    offset += length;
  }
  return MALFORMED;
}

function readWebp(bytes: Uint8Array): ImageSignatureResult {
  if (bytes.length < 30) return MALFORMED;
  if (u32le(bytes, 4) + 8 !== bytes.length) return MALFORMED;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    const width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
    const height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    return recognized("image/webp", width, height);
  }
  if (chunk === "VP8 ") {
    /* Keyframe start code 9D 01 2A, then 14-bit width and height. */
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return MALFORMED;
    const width = (bytes[26]! + (bytes[27]! << 8)) & 0x3fff;
    const height = (bytes[28]! + (bytes[29]! << 8)) & 0x3fff;
    return recognized("image/webp", width, height);
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return MALFORMED;
    const bits = u32le(bytes, 21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return recognized("image/webp", width, height);
  }
  return MALFORMED;
}

/** Identify an admissible image from its bytes alone. */
export function readImageSignature(bytes: Uint8Array): ImageSignatureResult {
  if (startsWith(bytes, PNG_SIGNATURE)) return readPng(bytes);
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return readJpeg(bytes);
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return readWebp(bytes);
  return UNSUPPORTED;
}
