/*
 * media-assets/media-storage.server.ts — the runtime storage resolver (MEDIA-1).
 *
 * IT ANSWERS `unavailable`, UNCONDITIONALLY, AND THAT IS THE RELEASED BEHAVIOUR.
 *
 * AWS S3 `eu-central-1` reached through Vercel OIDC is the Director's preferred production storage,
 * and it is NOT connected: no bucket is provisioned, no IAM role trusts this deployment, no adapter
 * exists in this repository, and no AWS dependency is installed. This resolver reads no environment
 * variable on purpose — a configuration contract for a backend that does not exist would let a
 * deployment look "configured" while nothing stands behind it.
 *
 * Consequences, all fail-closed:
 *   - a generation request is refused `storage-unavailable` BEFORE any invocation is written or any
 *     transport is called, so nothing is generated that could not be kept;
 *   - a read is answered `unavailable`, never "not found" and never an empty success.
 *
 * Connecting real storage is a separate Director gate: an adapter, its dependency, its credentials
 * model, and a production acceptance of its own. Tests inject an in-memory store through deps; that
 * store lives under `tests/helpers` and is not part of the application bundle.
 *
 * Server-only.
 */
import type { MediaStorageResolution } from "./media-object-store";

export function resolveMediaObjectStore(): MediaStorageResolution {
  if (typeof window !== "undefined") {
    throw new Error("Media storage resolution is server-only.");
  }
  return { status: "unavailable", reason: "storage-not-connected" };
}
