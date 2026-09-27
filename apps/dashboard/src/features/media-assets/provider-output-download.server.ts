/*
 * media-assets/provider-output-download.server.ts — following ONE provider output URL, safely
 * (MEDIA-1).
 *
 * This is the only place in the Media Asset authority that opens a socket, and it is the first seam
 * in Hebun that fetches a URL it did not construct itself. So every hop is bounded:
 *
 *   scheme         https only; no credentials in the URL; default port only
 *   host           EXACT match against the transport's `allowedDownloadHosts` — no suffix match, no
 *                  wildcard, no IP literal unless a transport explicitly lists one (none does)
 *   redirects      followed manually, at most `MEDIA_DOWNLOAD_LIMITS.maxRedirects`, and EVERY hop is
 *                  re-checked against the same allowlist
 *   time           one AbortSignal timeout across all hops
 *   size           a declared Content-Length over the limit is refused before reading; the body is
 *                  counted while streaming and abandoned the moment it passes the limit
 *   status         only 200 is a body; anything else is a refusal
 *
 * WHAT IT NEVER DOES WITH THE URL: return it, persist it, log it, or put it in an error message. The
 * result carries bytes and a declared type, or a closed refusal code — nothing else.
 *
 * LIMITATION, STATED RATHER THAN HIDDEN: hostname allowlisting does not pin resolved IP addresses, so
 * it does not by itself defeat DNS rebinding of an allowlisted name. It bounds the fetch to hosts a
 * transport declares; a real provider integration must re-evaluate this before any live traffic.
 *
 * Server-only.
 */
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns";
import { Readable } from "node:stream";
import type { IncomingHttpHeaders } from "node:http";
import type { MediaProviderOutputLocation } from "./async-generation-transport";
import { MEDIA_ASSET_LIMITS, MEDIA_DOWNLOAD_LIMITS, type MediaAdmissionRefusal } from "./contracts";

export type ProviderDownloadResult =
  | { readonly status: "downloaded"; readonly bytes: Uint8Array; readonly declaredContentType: string | null }
  | { readonly status: "refused"; readonly reason: MediaAdmissionRefusal };

export interface ProviderDownloadDeps {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

type HopCheck = { readonly ok: true; readonly url: URL } | { readonly ok: false; readonly reason: MediaAdmissionRefusal };

function checkHop(raw: string, base: URL | null, allowedHosts: ReadonlySet<string>): HopCheck {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return { ok: false, reason: "download-url-invalid" };
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") {
    return { ok: false, reason: "download-url-invalid" };
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: "download-host-not-allowed" };
  }
  return { ok: true, url };
}

async function readBounded(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export async function downloadProviderOutput(
  rawUrl: string,
  allowedDownloadHosts: readonly string[],
  deps: ProviderDownloadDeps = {},
): Promise<ProviderDownloadResult> {
  if (typeof window !== "undefined") {
    throw new Error("Provider output download is server-only.");
  }
  const allowed = new Set(allowedDownloadHosts.map((host) => host.toLowerCase()));
  const fetchImpl = deps.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(deps.timeoutMs ?? MEDIA_DOWNLOAD_LIMITS.timeoutMs);
  const maxBytes = MEDIA_ASSET_LIMITS.maxByteSize;

  let hop = checkHop(rawUrl, null, allowed);
  if (!hop.ok) return { status: "refused", reason: hop.reason };

  try {
    for (let redirects = 0; ; redirects += 1) {
      const response = await fetchImpl(hop.url.toString(), {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { accept: "image/png, image/jpeg, image/webp" },
      });

      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        const location = response.headers.get("location");
        if (!location || redirects >= MEDIA_DOWNLOAD_LIMITS.maxRedirects) {
          return { status: "refused", reason: "download-redirect-refused" };
        }
        const next = checkHop(location, hop.url, allowed);
        if (!next.ok) {
          return {
            status: "refused",
            reason: next.reason === "download-host-not-allowed" ? "download-host-not-allowed" : "download-redirect-refused",
          };
        }
        hop = next;
        continue;
      }

      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined);
        return { status: "refused", reason: "download-status-refused" };
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        return { status: "refused", reason: "byte-size-exceeded" };
      }

      const bytes = await readBounded(response, maxBytes);
      if (bytes === null) return { status: "refused", reason: "byte-size-exceeded" };
      return {
        status: "downloaded",
        bytes,
        declaredContentType: response.headers.get("content-type"),
      };
    }
  } catch (error) {
    const name = (error as { name?: string } | null)?.name;
    if (signal.aborted || name === "TimeoutError" || name === "AbortError") {
      return { status: "refused", reason: "download-timeout" };
    }
    return { status: "refused", reason: "download-failed" };
  }
}

/*
 * ── MV-7: STREAMING ONE PROVIDER VIDEO, WITH THE RESOLVED ADDRESS CHECKED ─────
 *
 * The image path above buffers at most 20 MiB and leaves DNS rebinding open (its own LIMITATION note).
 * A provider video is streamed instead, and the gap is closed:
 *
 *   hop            https, no credentials, no port, NOT an IP literal (a literal would bypass the
 *                  lookup below), and the hostname EXACTLY in the allowlist — every hop, including
 *                  each redirect (at most `MEDIA_DOWNLOAD_LIMITS.maxRedirects`, followed manually)
 *   address        the socket connects only through `publicOnlyLookup`: EVERY address the name
 *                  resolves to must be public unicast. Loopback, private, CGNAT, link-local, ULA,
 *                  multicast, documentation, benchmarking, unspecified, IPv4-mapped/NAT64 forms of
 *                  those — refused before a connection is made. The check is on the address the
 *                  socket actually uses, so a name that re-resolves between checks cannot slip past.
 *   time           one AbortSignal across every hop AND the body
 *   size           a declared Content-Length over the ceiling is refused before reading; the body is
 *                  counted as it flows and the stream errors the moment it passes the ceiling
 *   status         only 200 is a body
 *
 * It returns a STREAM, never bytes: the caller relays it straight into storage. The URL is read from
 * `reveal()` here and nowhere else in the authority, and it never enters a result or an error.
 */

export type ProviderStreamRefusal =
  | "download-url-invalid"
  | "download-host-not-allowed"
  | "download-address-refused"
  | "download-redirect-refused"
  | "download-status-refused"
  | "download-timeout"
  | "download-failed"
  | "byte-size-exceeded";

export type ProviderStreamResult =
  | {
      readonly status: "streaming";
      readonly body: ReadableStream<Uint8Array>;
      readonly declaredContentType: string | null;
      readonly declaredLength: number | null;
      /** True once the body passed the ceiling mid-stream (the stream has errored). */
      readonly overran: () => boolean;
    }
  | { readonly status: "refused"; readonly reason: ProviderStreamRefusal };

/** A resolved address. `family` is 4 or 6. */
export interface ResolvedAddress {
  readonly address: string;
  readonly family: number;
}

/** One GET of one hop. Injected in tests; production is `node:https` through `publicOnlyLookup`. */
export type ProviderHopGet = (
  url: URL,
  init: { readonly signal: AbortSignal; readonly accept: string },
) => Promise<{ readonly status: number; readonly headers: IncomingHttpHeaders; readonly body: ReadableStream<Uint8Array> }>;

export interface ProviderStreamDeps {
  readonly get?: ProviderHopGet;
  /** The resolver the default `get` filters. Injected in tests to stand in for DNS. */
  readonly resolve?: (hostname: string) => Promise<readonly ResolvedAddress[]>;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
}

class AddressRefused extends Error {
  constructor() {
    super("provider output address refused");
    this.name = "ProviderOutputAddressRefused";
  }
}

const NON_PUBLIC = (() => {
  const b = new BlockList();
  for (const [net, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
    ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
    ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
  ] as const) b.addSubnet(net, prefix, "ipv4");
  for (const [net, prefix] of [
    /* No `::ffff:0:0/96` rule: BlockList applies it to every IPv4 check. Mapped forms are unwrapped below. */
    ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
    ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
  ] as const) b.addSubnet(net, prefix, "ipv6");
  return b;
})();

/** True only for a public unicast address. Anything unparseable is not public. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC.check(address, "ipv4");
  if (family === 6) {
    /* An IPv4-mapped IPv6 address is judged as the IPv4 address it carries, in either notation. */
    const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
    if (dotted) return isPublicAddress(dotted[1]!);
    let normalized: string;
    try {
      normalized = new URL(`http://[${address}]/`).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    } catch {
      return false;
    }
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
    if (hex) {
      const hi = parseInt(hex[1]!, 16);
      const lo = parseInt(hex[2]!, 16);
      return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return !NON_PUBLIC.check(normalized, "ipv6");
  }
  return false;
}

function defaultResolve(hostname: string): Promise<readonly ResolvedAddress[]> {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => (error ? reject(error) : resolve(addresses)));
  });
}

type LookupCallback = (error: Error | null, address: string | { address: string; family: number }[], family?: number) => void;

/**
 * A `net.connect` lookup that answers only when EVERY resolved address is public. Used by the default
 * hop GET so the socket itself can only reach a public address.
 */
export function publicOnlyLookup(resolve: (hostname: string) => Promise<readonly ResolvedAddress[]>) {
  return (hostname: string, options: { all?: boolean } | number | undefined, callback: LookupCallback): void => {
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
          callback(new AddressRefused(), "", 0);
          return;
        }
        if (typeof options === "object" && options?.all) callback(null, addresses.map((a) => ({ address: a.address, family: a.family })));
        else callback(null, addresses[0]!.address, addresses[0]!.family);
      },
      () => callback(new AddressRefused(), "", 0),
    );
  };
}

function defaultHopGet(resolve: (hostname: string) => Promise<readonly ResolvedAddress[]>): ProviderHopGet {
  const lookup = publicOnlyLookup(resolve);
  return (url, init) =>
    new Promise((resolveResponse, reject) => {
      const req = httpsRequest(
        url,
        { method: "GET", headers: { accept: init.accept }, lookup: lookup as never, signal: init.signal, agent: false },
        (res) => {
          resolveResponse({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Readable.toWeb(res) as unknown as ReadableStream<Uint8Array>,
          });
        },
      );
      req.on("error", reject);
      req.end();
    });
}

type StreamHop = { readonly ok: true; readonly url: URL } | { readonly ok: false; readonly reason: ProviderStreamRefusal };

function checkStreamHop(raw: string, base: URL | null, allowed: ReadonlySet<string>): StreamHop {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return { ok: false, reason: "download-url-invalid" };
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") {
    return { ok: false, reason: "download-url-invalid" };
  }
  const host = url.hostname.toLowerCase();
  /* A literal address would bypass the resolver check, so it is never a download host. */
  if (isIP(host.replace(/^\[|\]$/g, "")) !== 0) return { ok: false, reason: "download-host-not-allowed" };
  if (!allowed.has(host)) return { ok: false, reason: "download-host-not-allowed" };
  return { ok: true, url };
}

function header(headers: IncomingHttpHeaders, name: string): string | null {
  const v = headers[name];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}

/** A pass-through that errors the stream the moment more than `max` bytes have flowed. */
function ceiling(max: number) {
  let count = 0;
  let overran = false;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      count += chunk.byteLength;
      if (count > max) {
        overran = true;
        controller.error(new Error("provider output ceiling exceeded"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  return { stream, overran: () => overran };
}

/**
 * Open ONE provider output as a bounded stream. The host allowlist comes from the location's own
 * transport; an empty allowlist refuses everything.
 */
export async function openProviderOutputStream(
  location: MediaProviderOutputLocation,
  accept: string,
  deps: ProviderStreamDeps = {},
): Promise<ProviderStreamResult> {
  if (typeof window !== "undefined") throw new Error("Provider output download is server-only.");
  const allowed = new Set(location.allowedHosts.map((h) => h.toLowerCase()).filter((h) => h.length > 0 && !h.includes("*")));
  const maxBytes = deps.maxBytes ?? MEDIA_ASSET_LIMITS.maxByteSize;
  const get = deps.get ?? defaultHopGet(deps.resolve ?? defaultResolve);
  const signal = AbortSignal.timeout(deps.timeoutMs ?? MEDIA_DOWNLOAD_LIMITS.timeoutMs);

  let hop = checkStreamHop(location.reveal(), null, allowed);
  if (!hop.ok) return { status: "refused", reason: hop.reason };

  try {
    for (let redirects = 0; ; redirects += 1) {
      const response = await get(hop.url, { signal, accept });
      if (response.status >= 300 && response.status < 400) {
        await response.body.cancel().catch(() => undefined);
        const next = header(response.headers, "location");
        if (!next || redirects >= MEDIA_DOWNLOAD_LIMITS.maxRedirects) return { status: "refused", reason: "download-redirect-refused" };
        const checked = checkStreamHop(next, hop.url, allowed);
        if (!checked.ok) {
          return { status: "refused", reason: checked.reason === "download-host-not-allowed" ? "download-host-not-allowed" : "download-redirect-refused" };
        }
        hop = checked;
        continue;
      }
      if (response.status !== 200) {
        await response.body.cancel().catch(() => undefined);
        return { status: "refused", reason: "download-status-refused" };
      }
      const declared = Number(header(response.headers, "content-length"));
      const declaredLength = Number.isSafeInteger(declared) && declared >= 0 ? declared : null;
      if (declaredLength !== null && declaredLength > maxBytes) {
        await response.body.cancel().catch(() => undefined);
        return { status: "refused", reason: "byte-size-exceeded" };
      }
      const bound = ceiling(maxBytes);
      return {
        status: "streaming",
        body: response.body.pipeThrough(bound.stream, { signal }),
        declaredContentType: header(response.headers, "content-type"),
        declaredLength,
        overran: bound.overran,
      };
    }
  } catch (error) {
    if (error instanceof AddressRefused || (error as { cause?: unknown } | null)?.cause instanceof AddressRefused) {
      return { status: "refused", reason: "download-address-refused" };
    }
    const name = (error as { name?: string } | null)?.name;
    if (signal.aborted || name === "TimeoutError" || name === "AbortError") return { status: "refused", reason: "download-timeout" };
    return { status: "refused", reason: "download-failed" };
  }
}
