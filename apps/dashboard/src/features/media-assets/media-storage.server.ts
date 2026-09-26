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
import { createVpsMediaStorageV2 } from "./vps-media-storage-v2.server";

export type VpsMediaStorageV2 = ReturnType<typeof createVpsMediaStorageV2>;

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

/*
 * MV-3 — the storage v2 client (streamed write, HEAD, Range), from the SAME three keys under the SAME
 * validation as the port above. Not a second configuration, not a second store: the same VPS store,
 * reached through its v2 verbs. Whether that store accepts `video/mp4` is the store's own switch
 * (HEBUN_MEDIA_STORE_ENABLE_VIDEO on the VPS), not something this resolver can turn on.
 */
export type MediaStorageV2Resolution =
  | { readonly status: "available"; readonly client: VpsMediaStorageV2 }
  | { readonly status: "unavailable"; readonly reason: "storage-not-connected" | "storage-misconfigured" };

export function resolveMediaStorageV2(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MediaStorageV2Resolution {
  const port = resolveMediaObjectStore(env);
  if (port.status !== "available") return port;
  return {
    status: "available",
    client: createVpsMediaStorageV2({
      origin: new URL(env[MEDIA_STORE_ENV.origin]!.trim()).origin,
      writeSecret: env[MEDIA_STORE_ENV.writeSecret]!,
      readSecret: env[MEDIA_STORE_ENV.readSecret]!,
    }),
  };
}
