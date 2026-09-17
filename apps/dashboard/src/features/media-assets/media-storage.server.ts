/*
 * media-assets/media-storage.server.ts — the runtime storage resolver.
 *
 * MEDIA-1 released this resolver answering `unavailable` unconditionally. The VPS storage phase gives
 * it exactly one backend it may select: the dedicated Hebun VPS media store, reached through
 * `vps-media-object-store.server.ts`. The authority above it does not change.
 *
 * ── THE CONFIGURATION CONTRACT, AND HOW IT FAILS CLOSED ──────────────────────
 *
 *   HEBUN_MEDIA_STORE_ORIGIN         https origin of the store — no path, query, fragment or credentials
 *   HEBUN_MEDIA_STORE_WRITE_SECRET   ≥ 32 characters; signs put and verify
 *   HEBUN_MEDIA_STORE_READ_SECRET    ≥ 32 characters; signs browser read grants; must differ
 *
 *   none of the three set            unavailable  storage-not-connected   (the released behaviour)
 *   any set, any missing or invalid  unavailable  storage-misconfigured   (never a partial store)
 *   all three valid                  available    backend `hebun-vps`
 *
 * A deployment that looks half-configured is NOT connected. Nothing here falls back to memory, to
 * a local path, or to plain http. Values are never echoed, logged or returned.
 *
 * WHAT "AVAILABLE" DOES NOT MEAN: that the store is reachable, that bytes were ever written, or that
 * anything is backed up. Reachability is proved per call by `put`/`verify`, each of which fails closed.
 *
 * Server-only.
 */
import type { MediaStorageResolution } from "./media-object-store";
import { createVpsMediaObjectStore } from "./vps-media-object-store.server";

export const MEDIA_STORE_ENV = Object.freeze({
  origin: "HEBUN_MEDIA_STORE_ORIGIN",
  writeSecret: "HEBUN_MEDIA_STORE_WRITE_SECRET",
  readSecret: "HEBUN_MEDIA_STORE_READ_SECRET",
});

const MIN_SECRET_LENGTH = 32;

function validOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    (url.pathname === "/" || url.pathname === "") &&
    !value.endsWith("?") &&
    !value.endsWith("#")
  );
}

export function resolveMediaObjectStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MediaStorageResolution {
  if (typeof window !== "undefined") {
    throw new Error("Media storage resolution is server-only.");
  }
  const origin = env[MEDIA_STORE_ENV.origin]?.trim() ?? "";
  const writeSecret = env[MEDIA_STORE_ENV.writeSecret] ?? "";
  const readSecret = env[MEDIA_STORE_ENV.readSecret] ?? "";

  if (!origin && !writeSecret && !readSecret) {
    return { status: "unavailable", reason: "storage-not-connected" };
  }
  if (
    !validOrigin(origin) ||
    writeSecret.length < MIN_SECRET_LENGTH ||
    readSecret.length < MIN_SECRET_LENGTH ||
    writeSecret === readSecret
  ) {
    return { status: "unavailable", reason: "storage-misconfigured" };
  }
  return {
    status: "available",
    store: createVpsMediaObjectStore({ origin: new URL(origin).origin, writeSecret, readSecret }),
  };
}
