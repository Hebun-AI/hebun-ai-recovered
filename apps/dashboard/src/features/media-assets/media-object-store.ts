/*
 * media-assets/media-object-store.ts — the storage PORT (MEDIA-1).
 *
 * The Media Asset authority talks to bytes only through this interface. It names no vendor, no
 * bucket, no region, no credential and no SDK type, so the authority cannot come to depend on AWS,
 * Vercel Blob or any other backend's semantics. A concrete adapter is a separate, gated phase.
 *
 * ── THE CONTRACT EVERY IMPLEMENTATION MUST HONOUR ────────────────────────────
 *
 *   put            write-once. An existing key is a failure, never an overwrite. The implementation
 *                  must verify the supplied SHA-256 against what it stored (S3 `ChecksumSHA256`, or
 *                  equivalent) and fail on mismatch.
 *   verify         report whether the object exists and, if so, its size and SHA-256 AS STORED — the
 *                  authority compares them to the row before granting any read.
 *   createReadAccess
 *                  a short-lived, read-only access grant for one key. The authority never persists
 *                  it and never logs it.
 *
 * There is deliberately no `delete`: purge is out of scope, and a port without the verb cannot be
 * called by accident.
 *
 * Pure types. No I/O.
 */

export interface MediaObjectPut {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly sha256Hex: string;
}

export type MediaObjectVerification =
  | { readonly status: "present"; readonly byteSize: number; readonly sha256Hex: string }
  | { readonly status: "absent" };

export interface MediaReadAccess {
  readonly url: string;
  readonly expiresAt: string;
}

export interface MediaObjectStore {
  /** Stable backend name recorded on the asset row. `^[a-z0-9-]{1,32}$`. */
  readonly backend: string;
  put(input: MediaObjectPut): Promise<void>;
  verify(key: string): Promise<MediaObjectVerification>;
  createReadAccess(input: {
    readonly key: string;
    readonly contentType: string;
    readonly ttlSeconds: number;
  }): Promise<MediaReadAccess>;
}

export type MediaStorageResolution =
  | { readonly status: "available"; readonly store: MediaObjectStore }
  | { readonly status: "unavailable"; readonly reason: "storage-not-connected" };

/** Read access lifetime. Short on purpose: a leaked grant is a leaked asset until it expires. */
export const MEDIA_READ_ACCESS_TTL_SECONDS = 60;
