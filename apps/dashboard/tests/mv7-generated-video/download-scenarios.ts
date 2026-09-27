/*
 * MV-7 provider-output STREAM scenarios, parameterised by the download module so the SAME claims run
 * against the released seam (download-security.ts) and against deliberately broken copies
 * (download-bite-proofs.ts). No network: hops are served by an injected `get`, DNS by an injected
 * resolver. The one default-`get` scenario proves the socket's lookup refuses a non-public address
 * before any connection exists.
 */
import assert from "node:assert/strict";
import type * as Download from "../../src/features/media-assets/provider-output-download.server";
import type { MediaProviderOutputLocation } from "../../src/features/media-assets/async-generation-transport";

type DownloadModule = typeof Download;

export const URL_SECRET = "SIG-VALUE-MV7-NOT-A-REAL-TOKEN";
const HOST = "cdn.mv7.test";

export function location(url: string, allowedHosts: readonly string[] = [HOST]): MediaProviderOutputLocation {
  return Object.freeze({
    shape: Object.freeze({ scheme: "https", hostname: "x", hasPort: false, hasCredentials: false, queryParameterNames: [], pathSegmentCount: 0, pathExtension: null }),
    allowedHosts,
    reveal: () => url,
  });
}

function streamOf(bytes: Uint8Array, chunk = 64 * 1024): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.byteLength) return controller.close();
      controller.enqueue(bytes.subarray(offset, offset + chunk));
      offset += chunk;
    },
  });
}

type Hop = { status: number; headers?: Record<string, string>; body?: Uint8Array };
function server(routes: Record<string, Hop>) {
  const seen: string[] = [];
  const get: Download.ProviderHopGet = async (url) => {
    seen.push(url.toString());
    const hop = routes[url.toString()] ?? { status: 404 };
    return { status: hop.status, headers: hop.headers ?? {}, body: streamOf(hop.body ?? new Uint8Array(0)) };
  };
  return { get, seen };
}

async function drain(body: ReadableStream<Uint8Array>): Promise<{ bytes: number; errored: boolean }> {
  const reader = body.getReader();
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return { bytes, errored: false };
      bytes += value.byteLength;
    }
  } catch {
    return { bytes, errored: true };
  }
}

export async function runDownloadScenarios(mod: DownloadModule, label: string): Promise<void> {
  const url = `https://${HOST}/v/abc/out.mp4?sig=${URL_SECRET}&exp=1`;
  const payload = new Uint8Array(300_000).fill(7);
  const noLeak = (r: unknown, why: string) => assert.ok(!JSON.stringify(r).includes(URL_SECRET) && !JSON.stringify(r).includes("/v/abc"), `${label}: ${why} — no URL in the result`);

  /* ── 1. the happy stream: exact host, 200, bounded body ── */
  {
    const s = server({ [url]: { status: 200, headers: { "content-type": "video/mp4", "content-length": String(payload.byteLength) }, body: payload } });
    const r = await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get });
    assert.equal(r.status, "streaming", `${label}: exact allowed host streams`);
    if (r.status === "streaming") assert.deepEqual(await drain(r.body), { bytes: payload.byteLength, errored: false });
    noLeak(r, "streaming");
  }

  /* ── 2. host trust is EXACT: no suffix, no parent, no sibling, no wildcard, empty = nothing ── */
  for (const [target, allowed, why] of [
    [`https://evil${HOST}/x.mp4`, [HOST], "suffix look-alike"],
    [`https://a.${HOST}/x.mp4`, [HOST], "subdomain of an allowed host"],
    [`https://mv7.test/x.mp4`, [HOST], "parent of an allowed host"],
    [`https://${HOST}/x.mp4`, [`*.mv7.test`], "wildcard entry"],
    [`https://mv7.test/x.mp4`, [`*.mv7.test`], "a wildcard entry is dropped, never rewritten into its apex"],
    [`https://${HOST}/x.mp4`, [`.mv7.test`], "leading-dot suffix entry"],
    [`https://${HOST}/x.mp4`, [], "empty allowlist"],
    /* The Director-approved CloudFront name, and its look-alikes. */
    [`https://other.cloudfront.net/x.mp4`, ["d3u0tzju9qaucj.cloudfront.net"], "another CloudFront distribution"],
    [`https://x.d3u0tzju9qaucj.cloudfront.net/x.mp4`, ["d3u0tzju9qaucj.cloudfront.net"], "a subdomain of the approved distribution"],
    [`https://d3u0tzju9qaucj.cloudfront.net.evil.test/x.mp4`, ["d3u0tzju9qaucj.cloudfront.net"], "the approved name as a prefix"],
    [`https://cloudfront.net/x.mp4`, ["d3u0tzju9qaucj.cloudfront.net"], "the CloudFront parent"],
  ] as const) {
    const s = server({ [target]: { status: 200, body: payload } });
    const r = await mod.openProviderOutputStream(location(target, allowed), "video/mp4", { get: s.get });
    assert.deepEqual(r, { status: "refused", reason: "download-host-not-allowed" }, `${label}: ${why}`);
    assert.equal(s.seen.length, 0, `${label}: ${why} — nothing fetched`);
  }

  /* ── 3. the URL itself: https only, no port, no credentials, no IP literal ── */
  for (const [target, allowed, reason, why] of [
    [`http://${HOST}/x.mp4`, [HOST], "download-url-invalid", "plain http"],
    [`https://${HOST}:8443/x.mp4`, [HOST], "download-url-invalid", "explicit port"],
    [`https://u:p@${HOST}/x.mp4`, [HOST], "download-url-invalid", "credentials"],
    [`https://127.0.0.1/x.mp4`, ["127.0.0.1"], "download-host-not-allowed", "IPv4 literal even if listed"],
    [`https://[::1]/x.mp4`, ["[::1]", "::1"], "download-host-not-allowed", "IPv6 literal even if listed"],
    [`not a url`, [HOST], "download-url-invalid", "garbage"],
  ] as const) {
    const s = server({});
    const r = await mod.openProviderOutputStream(location(target, allowed), "video/mp4", { get: s.get });
    assert.deepEqual(r, { status: "refused", reason }, `${label}: ${why}`);
    assert.equal(s.seen.length, 0, `${label}: ${why} — nothing fetched`);
  }

  /* ── 4. redirects: every hop re-checked; at most two ── */
  {
    const approved = "https://d3u0tzju9qaucj.cloudfront.net/a/out.mp4";
    const elsewhere = "https://evil.cloudfront.net/b.mp4";
    const s = server({ [approved]: { status: 302, headers: { location: elsewhere } }, [elsewhere]: { status: 200, body: payload } });
    assert.deepEqual(await mod.openProviderOutputStream(location(approved, ["d3u0tzju9qaucj.cloudfront.net"]), "video/mp4", { get: s.get }), { status: "refused", reason: "download-host-not-allowed" }, `${label}: approved host redirecting to another distribution`);
    assert.equal(s.seen.length, 1);
  }
  {
    const other = `https://other.mv7.test/y.mp4`;
    const s = server({ [url]: { status: 302, headers: { location: other } }, [other]: { status: 200, body: payload } });
    const r = await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get });
    assert.deepEqual(r, { status: "refused", reason: "download-host-not-allowed" }, `${label}: redirect to an unlisted host`);
    assert.equal(s.seen.length, 1, `${label}: the unlisted hop is never fetched`);
    noLeak(r, "redirect refusal");
  }
  {
    const s = server({ [url]: { status: 302, headers: { location: "http://" + HOST + "/y.mp4" } } });
    assert.deepEqual(await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get }), { status: "refused", reason: "download-redirect-refused" }, `${label}: redirect downgrade to http`);
  }
  {
    const s = server({ [url]: { status: 302, headers: { location: "https://169.254.169.254/latest" } } });
    assert.deepEqual(await mod.openProviderOutputStream(location(url, [HOST, "169.254.169.254"]), "video/mp4", { get: s.get }), { status: "refused", reason: "download-host-not-allowed" }, `${label}: redirect to a metadata IP literal`);
    assert.equal(s.seen.length, 1);
  }
  {
    const a = `https://${HOST}/a`, b = `https://${HOST}/b`, c = `https://${HOST}/c`;
    const s = server({ [url]: { status: 302, headers: { location: a } }, [a]: { status: 302, headers: { location: b } }, [b]: { status: 302, headers: { location: c } }, [c]: { status: 200, body: payload } });
    assert.deepEqual(await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get }), { status: "refused", reason: "download-redirect-refused" }, `${label}: a third redirect`);
    assert.equal(s.seen.length, 3, `${label}: the third target is never fetched`);
  }
  {
    const s = server({ [url]: { status: 302, headers: { location: "/relative.mp4" } }, [`https://${HOST}/relative.mp4`]: { status: 200, body: payload } });
    assert.equal((await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get })).status, "streaming", `${label}: a same-host relative redirect is fine`);
  }

  /* ── 5. status and size ── */
  {
    const s = server({ [url]: { status: 403 } });
    assert.deepEqual(await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get }), { status: "refused", reason: "download-status-refused" }, `${label}: 403`);
  }
  {
    const s = server({ [url]: { status: 200, headers: { "content-length": String(1024 * 1024 + 1) }, body: new Uint8Array(10) } });
    assert.deepEqual(await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get, maxBytes: 1024 * 1024 }), { status: "refused", reason: "byte-size-exceeded" }, `${label}: declared length over the ceiling`);
  }
  {
    const big = new Uint8Array(20 * 1024 * 1024 + 1);
    const s = server({ [url]: { status: 200, body: big } });
    const r = await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get });
    assert.equal(r.status, "streaming", `${label}: undeclared length streams until the ceiling`);
    if (r.status === "streaming") {
      const d = await drain(r.body);
      assert.equal(d.errored, true, `${label}: 20 MiB + 1 errors the stream`);
      assert.ok(d.bytes <= 20 * 1024 * 1024, `${label}: no more than the ceiling was delivered`);
      assert.equal(r.overran(), true, `${label}: overrun is reported`);
    }
  }
  {
    const exact = new Uint8Array(20 * 1024 * 1024);
    const s = server({ [url]: { status: 200, body: exact } });
    const r = await mod.openProviderOutputStream(location(url), "video/mp4", { get: s.get });
    assert.ok(r.status === "streaming" && !(await drain(r.body)).errored, `${label}: exactly 20 MiB is within the ceiling`);
  }

  /* ── 6. time ── */
  {
    /* AbortSignal.timeout's timer is unref'd; a real socket holds the loop open, so this stand-in does too. */
    const hang: Download.ProviderHopGet = (_u, init) =>
      new Promise((_, reject) => {
        const hold = setInterval(() => undefined, 1_000);
        init.signal.addEventListener("abort", () => { clearInterval(hold); reject(init.signal.reason); }, { once: true });
      });
    assert.deepEqual(await mod.openProviderOutputStream(location(url), "video/mp4", { get: hang, timeoutMs: 50 }), { status: "refused", reason: "download-timeout" }, `${label}: timeout`);
  }

  /* ── 7. addresses: only public unicast ── */
  for (const a of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "198.18.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:a9fe:a9fe", "64:ff9b::a00:1", "2001:db8::1", "not-an-ip"]) {
    assert.equal(mod.isPublicAddress(a), false, `${label}: ${a} is not public`);
  }
  for (const a of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(mod.isPublicAddress(a), true, `${label}: ${a} is public`);
  }
  const lookupOf = (addresses: { address: string; family: number }[]) =>
    new Promise<{ error: Error | null }>((resolve) =>
      mod.publicOnlyLookup(async () => addresses)("h", { all: true }, (error) => resolve({ error })),
    );
  assert.notEqual((await lookupOf([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }])).error, null, `${label}: ONE private answer among public ones refuses`);
  assert.notEqual((await lookupOf([])).error, null, `${label}: no answer refuses`);
  assert.equal((await lookupOf([{ address: "93.184.216.34", family: 4 }])).error, null, `${label}: a public answer resolves`);

  /* The default socket path: a name resolving to loopback / ULA is refused before any connection. */
  for (const bad of [{ address: "127.0.0.1", family: 4 }, { address: "fd00::1", family: 6 }, { address: "169.254.169.254", family: 4 }]) {
    const r = await mod.openProviderOutputStream(location(url), "video/mp4", { resolve: async () => [bad], timeoutMs: 5_000 });
    assert.deepEqual(r, { status: "refused", reason: "download-address-refused" }, `${label}: ${bad.address} via the real socket lookup`);
  }
}
