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
