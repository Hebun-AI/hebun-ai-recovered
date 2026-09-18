/*
 * MEDIA-1 test fakes — a memory storage port, an unmistakably fake generation transport, and minimal
 * structurally valid PNG / JPEG / WebP byte fixtures.
 *
 * These live under tests/helpers ON PURPOSE: they are not part of the application bundle, so no
 * runtime resolver can ever select them. The application's own resolvers answer `unavailable`.
 */
import { createHash } from "node:crypto";
import type {
  MediaGenerationMode,
  MediaGenerationOutcome,
  MediaGenerationRequest,
  MediaGenerationTransport,
} from "../../src/features/media-assets/media-generation-transport";
import type {
  MediaObjectRead,
  MediaObjectStore,
  MediaObjectVerification,
  MediaReadAccess,
} from "../../src/features/media-assets/media-object-store";

export const FAKE_MEDIA_PROVIDER = "hebun-fake-image-provider";
export const FAKE_MEDIA_MODEL = "fake-fixture-image-v1";
export const FAKE_MEDIA_HOST = "fake-media.hebun.invalid";

const sha = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export interface MemoryMediaStore extends MediaObjectStore {
  readonly objects: Map<string, { bytes: Uint8Array; contentType: string }>;
  readonly puts: string[];
  readonly readGrants: string[];
  /** MEDIA-5 — every server-side byte read, in order. */
  /** MEDIA-5: what each server-side read asked for, so a test can assert the type it carried. */
  readonly gets: { readonly key: string; readonly contentType: string }[];
  failNextPut: boolean;
  /** MEDIA-5 — corrupt what the store returns, without touching the row, to prove the digest check. */
  corruptNextGet: boolean;
}

export function createMemoryMediaObjectStore(): MemoryMediaStore {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const store: MemoryMediaStore = {
    backend: "test-memory",
    objects,
    puts: [],
    readGrants: [],
    gets: [],
    failNextPut: false,
    corruptNextGet: false,
    async put(input) {
      store.puts.push(input.key);
      if (store.failNextPut) {
        store.failNextPut = false;
        throw new Error("fake storage write failure");
      }
      if (objects.has(input.key)) throw new Error("write-once: key exists");
      if (sha(input.bytes) !== input.sha256Hex) throw new Error("checksum mismatch");
      objects.set(input.key, { bytes: new Uint8Array(input.bytes), contentType: input.contentType });
    },
    async verify(key): Promise<MediaObjectVerification> {
      const object = objects.get(key);
      if (!object) return { status: "absent" };
      return { status: "present", byteSize: object.bytes.length, sha256Hex: sha(object.bytes) };
    },
    async get(input): Promise<MediaObjectRead> {
      store.gets.push({ key: input.key, contentType: input.contentType });
      const object = objects.get(input.key);
      if (!object) return { status: "absent" };
      if (object.bytes.length > input.maxBytes) return { status: "too-large" };
      if (store.corruptNextGet) {
        store.corruptNextGet = false;
        const tampered = new Uint8Array(object.bytes);
        tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
        return { status: "read", bytes: tampered };
      }
      return { status: "read", bytes: new Uint8Array(object.bytes) };
    },
    async createReadAccess(input): Promise<MediaReadAccess> {
      store.readGrants.push(input.key);
      return {
        url: `memory://test-memory/${input.key}?ttl=${input.ttlSeconds}`,
        expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
      };
    },
  };
  return store;
}

export type FakeBehaviour =
  | { readonly kind: "bytes"; readonly bytes: Uint8Array; readonly declaredContentType?: string | null }
  | { readonly kind: "url"; readonly url: string; readonly declaredContentType?: string | null }
  | { readonly kind: "provider-failure" }
  | { readonly kind: "throw" };

export interface FakeTransport extends MediaGenerationTransport {
  readonly calls: {
    promptText: string;
    inputDigest: string;
    invocationId: string;
    request: MediaGenerationRequest;
  }[];
  behaviour: FakeBehaviour;
}

export function createFakeMediaGenerationTransport(
  behaviour: FakeBehaviour,
  /** MEDIA-5. Defaults to BOTH modes; pass text-only to prove the authority refuses fail-closed. */
  modes: readonly MediaGenerationMode[] = ["text-to-image", "reference-edit"],
): FakeTransport {
  const transport: FakeTransport = {
    transport: "fake",
    provider: FAKE_MEDIA_PROVIDER,
    model: FAKE_MEDIA_MODEL,
    allowedDownloadHosts: [FAKE_MEDIA_HOST],
    modes,
    calls: [],
    behaviour,
    async generate(input): Promise<MediaGenerationOutcome> {
      transport.calls.push({
        promptText: input.promptText,
        inputDigest: input.inputDigest,
        invocationId: input.invocationId,
        request: input.request,
      });
      const b = transport.behaviour;
      const jobId = `fake-job-${transport.calls.length}`;
      if (b.kind === "throw") throw new Error("fake transport unreachable");
      if (b.kind === "provider-failure") return { status: "failed", providerJobId: jobId, failure: "provider-unavailable", usage: null };
      if (b.kind === "bytes") {
        return {
          status: "succeeded",
          providerJobId: jobId,
          output: { kind: "bytes", bytes: b.bytes, declaredContentType: b.declaredContentType ?? null },
          usage: null,
        };
      }
      return {
        status: "succeeded",
        providerJobId: jobId,
        output: { kind: "url", url: b.url, declaredContentType: b.declaredContentType ?? null },
        usage: null,
      };
    },
  };
  return transport;
}

/* ── Image fixtures ────────────────────────────────────────────────────────── */

function u32be(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function asciiBytes(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

/** A PNG header + IHDR + a tiny IDAT + IEND. Not decodable pixels — Hebun never decodes. */
export function pngBytes(width: number, height: number, padding = 0): Uint8Array {
  const ihdr = [...u32be(13), ...asciiBytes("IHDR"), ...u32be(width), ...u32be(height), 8, 2, 0, 0, 0, 0, 0, 0, 0];
  const idat = [...u32be(padding), ...asciiBytes("IDAT"), ...new Array(padding).fill(7), 0, 0, 0, 0];
  const iend = [...u32be(0), ...asciiBytes("IEND"), 0xae, 0x42, 0x60, 0x82];
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...ihdr, ...idat, ...iend]);
}

export function jpegBytes(width: number, height: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...asciiBytes("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof0 = [
    0xff, 0xc0, 0x00, 0x11, 8, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff,
    3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1,
  ];
  const sos = [0xff, 0xda, 0x00, 0x0c, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0, 0x12, 0x34];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, ...sos, 0xff, 0xd9]);
}

/** RIFF/WEBP with a VP8X canvas chunk carrying the dimensions. */
export function webpBytes(width: number, height: number): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  const vp8x = [
    ...asciiBytes("VP8X"), 10, 0, 0, 0,
    0, 0, 0, 0,
    w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff,
    h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff,
  ];
  const body = [...asciiBytes("WEBP"), ...vp8x];
  const size = body.length;
  return new Uint8Array([
    ...asciiBytes("RIFF"), size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff, ...body,
  ]);
}

export function gifBytes(): Uint8Array {
  return new Uint8Array([...asciiBytes("GIF89a"), 1, 0, 1, 0, 0, 0, 0, 0x3b]);
}

export function svgBytes(): Uint8Array {
  return new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
}
