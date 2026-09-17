/*
 * media-assets/vps-media-object-store.server.ts — the VPS adapter behind the storage PORT.
 *
 *   Media Asset authority → MediaObjectStore → THIS ADAPTER → Hebun VPS media store → private filesystem
 *
 * A transport, not an authority. It implements exactly the port's three verbs and decides nothing:
 * which key, which bytes, whether a read is granted — all of that is the authority's, against the
 * `media_assets` row. The far side (`infra/media-store-vps/hebun_media_store.py`) is equally dumb: it
 * keeps what an authenticated caller wrote and refuses to overwrite it.
 *
 * ── AUTHENTICATION: THE PER-INGRESS SHARED-SECRET PATTERN, MADE REPLAY-RESISTANT ─
 *
 * Hebun's machine ingresses already authenticate with one per-ingress secret compared in constant
 * time. This adapter uses the same model, with two narrow additions a byte store needs:
 *
 *   write secret   signs PUT and verify: HMAC-SHA256 over method, key, timestamp, nonce, digest,
 *                  content type and length. The store refuses a stale or future timestamp (±60s), a
 *                  reused nonce, and anything signed before it started.
 *   read secret    signs browser read grants: HMAC-SHA256 over key, content type and expiry. It cannot
 *                  write. A grant is created per call, never persisted and never logged.
 *
 * Two secrets, because a read grant leaves the server (it is a URL in a browser) and a write
 * credential must not share a key with anything that does.
 *
 * ── FAILURE IS AN EXCEPTION, NEVER A GUESS ───────────────────────────────────
 *
 * Any non-success status, timeout, redirect or malformed answer throws. The authority already maps a
 * throwing `put` to `storage-write-failed` and a throwing `verify` to `object-absent`. Error messages
 * carry a status code only — never a URL, header, signature or secret.
 *
 * Server-only.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { MediaObjectStore, MediaObjectVerification, MediaReadAccess } from "./media-object-store";

export const VPS_MEDIA_STORE_BACKEND = "hebun-vps";

/** Mirrors `READ_MAX_TTL_SECONDS` in the store: a grant the store would refuse is never minted. */
export const VPS_READ_MAX_TTL_SECONDS = 300;

const WRITE_SCHEME = "HEBUN-MEDIA-WRITE-V1";
const READ_SCHEME = "HEBUN-MEDIA-READ-V1";
const PUT_TIMEOUT_MS = 30_000;
const VERIFY_TIMEOUT_MS = 15_000;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^tenants/${UUID}/media/${UUID}$`);

export interface VpsMediaStoreOptions {
  /** Origin only, e.g. `https://host`. The resolver enforces https; tests may pass loopback http. */
  readonly origin: string;
  readonly writeSecret: string;
  readonly readSecret: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly nonce?: () => string;
}

export function writeCanonical(input: {
  readonly method: "PUT" | "GET";
  readonly key: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly sha256Hex: string;
  readonly contentType: string;
  readonly contentLength: number;
}): string {
  return [
    WRITE_SCHEME,
    input.method,
    input.key,
    input.timestamp,
    input.nonce,
    input.sha256Hex,
    input.contentType,
    String(input.contentLength),
  ].join("\n");
}

export function readCanonical(input: { readonly key: string; readonly contentType: string; readonly expires: string }): string {
  return [READ_SCHEME, input.key, input.contentType, input.expires].join("\n");
}

export function hmacHex(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

function assertKey(key: string): void {
  if (!KEY_RE.test(key)) throw new Error("media store: key is not canonical");
}

export function createVpsMediaObjectStore(options: VpsMediaStoreOptions): MediaObjectStore {
  if (typeof window !== "undefined") {
    throw new Error("The VPS media store adapter is server-only.");
  }
  const origin = options.origin.replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch;
  const nowMs = options.now ?? (() => Date.now());
  const nonce = options.nonce ?? (() => randomBytes(16).toString("hex"));

  const signedHeaders = (method: "PUT" | "GET", key: string, sha256Hex: string, contentType: string, contentLength: number) => {
    const timestamp = String(Math.floor(nowMs() / 1000));
    const n = nonce();
    const signature = hmacHex(
      options.writeSecret,
      writeCanonical({ method, key, timestamp, nonce: n, sha256Hex, contentType, contentLength }),
    );
    return { "x-hebun-timestamp": timestamp, "x-hebun-nonce": n, "x-hebun-signature": signature };
  };

  return {
    backend: VPS_MEDIA_STORE_BACKEND,

    async put(input) {
      assertKey(input.key);
      /* The store verifies the digest against what it wrote; checking here too refuses to send bytes
         the caller mislabelled, so a mismatch never costs a round trip or a temp file. */
      const actual = createHash("sha256").update(input.bytes).digest("hex");
      if (actual !== input.sha256Hex) throw new Error("media store: digest mismatch before put");
      const response = await doFetch(`${origin}/v1/objects/${input.key}`, {
        method: "PUT",
        headers: {
          "content-type": input.contentType,
          "content-length": String(input.bytes.byteLength),
          "x-hebun-content-sha256": input.sha256Hex,
          ...signedHeaders("PUT", input.key, input.sha256Hex, input.contentType, input.bytes.byteLength),
        },
        body: new Uint8Array(input.bytes),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
      });
      await response.body?.cancel().catch(() => undefined);
      if (response.status !== 201) throw new Error(`media store: put refused (${response.status})`);
    },

    async verify(key): Promise<MediaObjectVerification> {
      assertKey(key);
      const response = await doFetch(`${origin}/v1/verify/${key}`, {
        method: "GET",
        headers: signedHeaders("GET", key, "", "", 0),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`media store: verify refused (${response.status})`);
      }
      const body: unknown = await response.json();
      if (body && typeof body === "object" && (body as { status?: unknown }).status === "absent") {
        return { status: "absent" };
      }
      const present = body as { status?: unknown; byteSize?: unknown; sha256Hex?: unknown };
      if (
        present?.status === "present" &&
        Number.isSafeInteger(present.byteSize) &&
        (present.byteSize as number) >= 0 &&
        typeof present.sha256Hex === "string" &&
        /^[0-9a-f]{64}$/.test(present.sha256Hex)
      ) {
        return { status: "present", byteSize: present.byteSize as number, sha256Hex: present.sha256Hex };
      }
      throw new Error("media store: verify answer malformed");
    },

    async createReadAccess(input): Promise<MediaReadAccess> {
      assertKey(input.key);
      const ttl = Math.min(Math.max(Math.floor(input.ttlSeconds), 1), VPS_READ_MAX_TTL_SECONDS);
      const expiresSeconds = Math.floor(nowMs() / 1000) + ttl;
      const expires = String(expiresSeconds);
      const sig = hmacHex(options.readSecret, readCanonical({ key: input.key, contentType: input.contentType, expires }));
      const query = new URLSearchParams({ ct: input.contentType, exp: expires, sig });
      return {
        url: `${origin}/v1/read/${input.key}?${query.toString()}`,
        expiresAt: new Date(expiresSeconds * 1000).toISOString(),
      };
    },
  };
}
