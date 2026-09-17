/*
 * media-assets/admission-verification.ts — the pure half of admission (MEDIA-1).
 *
 * Given bytes and whatever type the provider DECLARED, decide whether Hebun will admit them and, if
 * so, what they are. Every fact on an admitted asset is produced here from the bytes themselves:
 *
 *   byteSize     counted
 *   byteDigest   SHA-256, lowercase hex
 *   mimeType     read from magic bytes
 *   width/height read from the container header
 *
 * The declared type is used for exactly one thing: refusing when it disagrees. A provider that says
 * `image/png` for JPEG bytes is not corrected, it is refused — a mislabelled output is evidence that
 * something upstream is not what it claims.
 *
 * Pure. No I/O.
 */
import { createHash } from "node:crypto";
import { MEDIA_ASSET_LIMITS, type MediaAdmissionRefusal, type MediaAssetMimeType } from "./contracts";
import { readImageSignature } from "./image-signature";

export interface VerifiedImage {
  readonly mimeType: MediaAssetMimeType;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
}

export type AdmissionVerification =
  | { readonly status: "verified"; readonly image: VerifiedImage }
  | { readonly status: "refused"; readonly reason: MediaAdmissionRefusal };

export function digestBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** `image/png; charset=x` → `image/png`. Null or blank means "declared nothing". */
function normalizeDeclaredType(declared: string | null | undefined): string | null {
  if (typeof declared !== "string") return null;
  const bare = declared.split(";")[0]!.trim().toLowerCase();
  return bare.length > 0 ? bare : null;
}

export function verifyAdmissibleImage(
  bytes: Uint8Array,
  declaredContentType: string | null,
): AdmissionVerification {
  if (bytes.length === 0) return { status: "refused", reason: "empty-bytes" };
  /* Size first: nothing past the limit is parsed or hashed. */
  if (bytes.length > MEDIA_ASSET_LIMITS.maxByteSize) {
    return { status: "refused", reason: "byte-size-exceeded" };
  }

  const signature = readImageSignature(bytes);
  if (signature.status === "refused") return { status: "refused", reason: signature.reason };

  const declared = normalizeDeclaredType(declaredContentType);
  if (declared !== null && declared !== signature.mimeType) {
    return { status: "refused", reason: "declared-type-mismatch" };
  }

  if (
    signature.width > MEDIA_ASSET_LIMITS.maxDimension ||
    signature.height > MEDIA_ASSET_LIMITS.maxDimension
  ) {
    return { status: "refused", reason: "dimensions-exceeded" };
  }

  return {
    status: "verified",
    image: {
      mimeType: signature.mimeType,
      byteSize: bytes.length,
      byteDigest: digestBytes(bytes),
      width: signature.width,
      height: signature.height,
    },
  };
}
