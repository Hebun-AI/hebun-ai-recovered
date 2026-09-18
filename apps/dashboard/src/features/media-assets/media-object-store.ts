/*
 * media-assets/media-object-store.ts — the storage PORT (MEDIA-1).
 *
 * The Media Asset authority talks to bytes only through this interface. It names no vendor, no
 * bucket, no region, no credential and no SDK type, so the authority cannot come to depend on AWS,
 * Vercel Blob or any other backend's semantics. Adapters live beside it (the VPS store today); swapping
 * one for another (e.g. S3) changes the resolver, never the authority.
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
 *                  it and never logs it. FOR A HUMAN TO OPEN — it produces a URL.
 *   get            MEDIA-5. The object's BYTES, into this process. For server-side use only, when
 *                  the authority itself must hold the bytes — the one case being a reference-guided
 *                  generation, where an admitted image is the input to the next one.
 *
 * ── WHY `get` IS NOT `createReadAccess` ─────────────────────────────────────
 *
 * They answer different questions and must not be collapsed. `createReadAccess` mints a URL for a
 * BROWSER; its TTL is sized for an `<img>` tag and its product is a credential-shaped string. `get`
 * returns bytes to the SERVER and produces no URL for anyone to hold. Handing a provider a read
 * grant, or widening a grant's TTL so a server could fetch it comfortably, would turn a human
 * preview seam into a machine input seam and make every leak of that URL a leak of the asset.
 *
 * An implementation may of course reach its own backend however it must — the VPS adapter signs the
 * same short-lived read it already signs — but that is an implementation detail BELOW this port, and
 * the grant never leaves the process.
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

export type MediaObjectRead =
  | { readonly status: "read"; readonly bytes: Uint8Array }
  | { readonly status: "absent" }
  /** The object is larger than `maxBytes`. Read abandoned; no bytes are returned. */
  | { readonly status: "too-large" };

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
  /**
   * MEDIA-5 — the object's bytes, server-side.
   *
   * `maxBytes` is a hard ceiling the implementation must enforce while reading, so an object larger
   * than the caller can accept is abandoned mid-stream rather than buffered and then rejected.
   * Returns `absent` when there is no such object; throws on a transport or protocol failure.
   *
   * IT VERIFIES NOTHING. The bytes are reported as stored; comparing them to the authoritative row
   * is the Media Asset authority's job and it is never skipped.
   */
  get(input: { readonly key: string; readonly maxBytes: number }): Promise<MediaObjectRead>;
  createReadAccess(input: {
    readonly key: string;
    readonly contentType: string;
    readonly ttlSeconds: number;
  }): Promise<MediaReadAccess>;
}

export type MediaStorageResolution =
  | { readonly status: "available"; readonly store: MediaObjectStore }
  | { readonly status: "unavailable"; readonly reason: "storage-not-connected" | "storage-misconfigured" };

/** Read access lifetime. Short on purpose: a leaked grant is a leaked asset until it expires. */
export const MEDIA_READ_ACCESS_TTL_SECONDS = 60;
