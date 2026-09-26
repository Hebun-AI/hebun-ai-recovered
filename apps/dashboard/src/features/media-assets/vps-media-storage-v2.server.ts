/*
 * media-assets/vps-media-storage-v2.server.ts — MV-1: the storage v2 client for the Hebun VPS store.
 *
 *   (future) Media authority → THIS CLIENT → Hebun VPS media store → private filesystem
 *
 * TECHNICAL CUSTODY ONLY. NOT MEDIA ADMISSION.
 *
 * This file is deliberately NOT part of the `MediaObjectStore` port and is not wired into the Media
 * Asset authority. Nothing in the dashboard calls it yet. A successful `putStream` means "the VPS
 * holds these bytes, measured as N bytes with digest H" — it creates no `media_assets` row, admits
 * nothing, and says nothing about tenant truth, review, selection or publication. MV-2+ decide how
 * (and whether) the authority uses it.
 *
 * ── WHAT IT ADDS OVER V1 ─────────────────────────────────────────────────────
 *
 *   putStream   WRITE-V2. Streams a body whose digest the caller does NOT know. The grant binds key,
 *               content type, expected length (or none), a byte ceiling, an expiry and the probe
 *               mode; the store counts and hashes while writing and answers the measured facts.
 *   head        HEAD on the v1 read route under a v1 read grant (signature unchanged).
 *   readRange   one `bytes=a-b` range on the v1 read route (signature unchanged). 206 or 416.
 *
 * Same two-secret model as v1 (`vps-media-object-store.server.ts`): the write secret signs writes,
 * the read secret signs reads. Errors carry a status code only — never a URL, header or signature.
 *
 * Server-only.
 */
import { randomBytes } from "node:crypto";
import { hmacHex, readCanonical } from "./vps-media-object-store.server";

const WRITE_V2_SCHEME = "HEBUN-MEDIA-WRITE-V2";
/** Mirrors `WRITE_V2_MAX_TTL_SECONDS` in the store. */
export const VPS_WRITE_V2_MAX_TTL_SECONDS = 600;
const SERVER_READ_TTL_SECONDS = 30;
const HEAD_TIMEOUT_MS = 15_000;
const RANGE_TIMEOUT_MS = 30_000;
/** Hard cap on one range read into this process. A range is for probing/serving slices, not bulk. */
export const VPS_MAX_RANGE_BYTES = 8 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^tenants/${UUID}/media/${UUID}$`);
const SHA_RE = /^[0-9a-f]{64}$/;

export type ProbeMode = "none" | "required";

export interface ProbeFacts {
  readonly container: string;
  readonly durationSeconds: number | null;
  readonly video: { readonly codec: string; readonly width: number | null; readonly height: number | null; readonly frameRate: string | null } | null;
  readonly audio: { readonly codec: string } | null;
}

/** Measured technical facts. Evidence for a later authority decision — never an admission. */
export interface StoredObjectFacts {
  readonly byteSize: number;
  readonly sha256Hex: string;
  readonly probe: ProbeFacts | null;
}

export type HeadResult = { readonly status: "present"; readonly byteSize: number } | { readonly status: "absent" };

export type RangeResult =
  | { readonly status: "range"; readonly bytes: Uint8Array; readonly start: number; readonly end: number; readonly totalSize: number }
  | { readonly status: "absent" }
  | { readonly status: "unsatisfiable"; readonly totalSize: number | null };

export interface VpsStorageV2Options {
  readonly origin: string;
  readonly writeSecret: string;
  readonly readSecret: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly nonce?: () => string;
}

export function writeV2Canonical(input: {
  readonly key: string;
  readonly timestamp: string;
  readonly nonce: string;
  readonly contentType: string;
  readonly expectedLength: string;
  readonly maxBytes: number;
  readonly expires: string;
  readonly probe: ProbeMode;
}): string {
  return [
    WRITE_V2_SCHEME,
    "PUT",
    input.key,
    input.timestamp,
    input.nonce,
    input.contentType,
    input.expectedLength,
    String(input.maxBytes),
    input.expires,
    input.probe,
  ].join("\n");
}

function assertKey(key: string): void {
  if (!KEY_RE.test(key)) throw new Error("media store: key is not canonical");
}

function positiveInt(n: number, label: string): number {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`media store: ${label} must be a positive integer`);
  return n;
}

function parseFacts(body: unknown, probe: ProbeMode): StoredObjectFacts {
  const b = body as { status?: unknown; byteSize?: unknown; sha256Hex?: unknown; probe?: unknown };
  if (
    b?.status !== "stored" ||
    !Number.isSafeInteger(b.byteSize) ||
    (b.byteSize as number) < 1 ||
    typeof b.sha256Hex !== "string" ||
    !SHA_RE.test(b.sha256Hex)
  ) {
    throw new Error("media store: write answer malformed");
  }
  if (probe === "required" && (typeof b.probe !== "object" || b.probe === null)) {
    throw new Error("media store: probe facts missing");
  }
  return {
    byteSize: b.byteSize as number,
    sha256Hex: b.sha256Hex,
    probe: probe === "required" ? (b.probe as ProbeFacts) : null,
  };
}

export function createVpsMediaStorageV2(options: VpsStorageV2Options) {
  if (typeof window !== "undefined") throw new Error("The VPS media storage v2 client is server-only.");
  const origin = options.origin.replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch;
  const nowMs = options.now ?? (() => Date.now());
  const nonce = options.nonce ?? (() => randomBytes(16).toString("hex"));

  const readUrl = (key: string, contentType: string): string => {
    const expires = String(Math.floor(nowMs() / 1000) + SERVER_READ_TTL_SECONDS);
    const sig = hmacHex(options.readSecret, readCanonical({ key, contentType, expires }));
    return `${origin}/v1/read/${key}?${new URLSearchParams({ ct: contentType, exp: expires, sig }).toString()}`;
  };

  return {
    /**
     * Stream `body` to the store under a WRITE-V2 grant. With `expectedBytes`, the request declares
     * Content-Length; without it, the body goes chunked and the store enforces `maxBytes` mid-stream.
     */
    async putStream(input: {
      readonly key: string;
      readonly contentType: string;
      readonly body: ReadableStream<Uint8Array>;
      readonly maxBytes: number;
      readonly expectedBytes?: number;
      readonly probe?: ProbeMode;
      readonly ttlSeconds?: number;
      readonly timeoutMs?: number;
    }): Promise<StoredObjectFacts> {
      assertKey(input.key);
      const maxBytes = positiveInt(input.maxBytes, "maxBytes");
      const expected = input.expectedBytes === undefined ? undefined : positiveInt(input.expectedBytes, "expectedBytes");
      if (expected !== undefined && expected > maxBytes) throw new Error("media store: expectedBytes exceeds maxBytes");
      const probe: ProbeMode = input.probe ?? "none";
      const ttl = Math.min(Math.max(Math.floor(input.ttlSeconds ?? 120), 1), VPS_WRITE_V2_MAX_TTL_SECONDS);
      const nowSeconds = Math.floor(nowMs() / 1000);
      const timestamp = String(nowSeconds);
      const expires = String(nowSeconds + ttl);
      const n = nonce();
      const expectedLength = expected === undefined ? "" : String(expected);
      const signature = hmacHex(
        options.writeSecret,
        writeV2Canonical({ key: input.key, timestamp, nonce: n, contentType: input.contentType, expectedLength, maxBytes, expires, probe }),
      );
      const headers: Record<string, string> = {
        "content-type": input.contentType,
        "x-hebun-timestamp": timestamp,
        "x-hebun-nonce": n,
        "x-hebun-signature": signature,
        "x-hebun-expected-length": expectedLength,
        "x-hebun-max-bytes": String(maxBytes),
        "x-hebun-expires": expires,
        "x-hebun-probe": probe,
      };
      if (expected !== undefined) headers["content-length"] = String(expected);
      const response = await doFetch(`${origin}/v2/objects/${input.key}`, {
        method: "PUT",
        headers,
        body: input.body,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(input.timeoutMs ?? ttl * 1000),
        duplex: "half",
      } as RequestInit & { duplex: "half" });
      if (response.status !== 201) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`media store: v2 write refused (${response.status})`);
      }
      return parseFacts(await response.json(), probe);
    },

    async head(input: { readonly key: string; readonly contentType: string }): Promise<HeadResult> {
      assertKey(input.key);
      const response = await doFetch(readUrl(input.key, input.contentType), {
        method: "HEAD",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      });
      if (response.status === 404) return { status: "absent" };
      if (response.status !== 200) throw new Error(`media store: head refused (${response.status})`);
      const size = Number(response.headers.get("content-length"));
      if (!Number.isSafeInteger(size) || size < 0) throw new Error("media store: head answer malformed");
      return { status: "present", byteSize: size };
    },

    /** One inclusive byte range. Bounded by VPS_MAX_RANGE_BYTES before any byte is requested. */
    async readRange(input: {
      readonly key: string;
      readonly contentType: string;
      readonly start: number;
      readonly end: number;
    }): Promise<RangeResult> {
      assertKey(input.key);
      if (!Number.isSafeInteger(input.start) || !Number.isSafeInteger(input.end) || input.start < 0 || input.end < input.start) {
        throw new Error("media store: invalid range");
      }
      if (input.end - input.start + 1 > VPS_MAX_RANGE_BYTES) throw new Error("media store: range too large");
      const response = await doFetch(readUrl(input.key, input.contentType), {
        method: "GET",
        headers: { range: `bytes=${input.start}-${input.end}` },
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(RANGE_TIMEOUT_MS),
      });
      if (response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        return { status: "absent" };
      }
      if (response.status === 416) {
        await response.body?.cancel().catch(() => undefined);
        const m = /^bytes \*\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
        return { status: "unsatisfiable", totalSize: m ? Number(m[1]) : null };
      }
      if (response.status !== 206) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`media store: range refused (${response.status})`);
      }
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
      if (!m) throw new Error("media store: range answer malformed");
      const [start, end, totalSize] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (start !== input.start || end > input.end || end < start) throw new Error("media store: range answer malformed");
      /* Bounded while reading: never more than the range the store itself declared. */
      const want = end - start + 1;
      const reader = response.body?.getReader();
      if (!reader) throw new Error("media store: range answer malformed");
      const bytes = new Uint8Array(want);
      let offset = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        if (offset + value.byteLength > want) {
          await reader.cancel().catch(() => undefined);
          throw new Error("media store: range answer malformed");
        }
        bytes.set(value, offset);
        offset += value.byteLength;
      }
      if (offset !== want) throw new Error("media store: range answer malformed");
      return { status: "range", bytes, start, end, totalSize };
    },
  };
}
