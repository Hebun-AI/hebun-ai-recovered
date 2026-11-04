/*
 * MEDIA STORE V2 — EARLY REFUSAL REACHES A STREAMING CLIENT (Package 3 M2-R10C).
 *
 * The store refuses some writes before reading the body (a type it does not admit, a bad grant). The
 * production client streams video chunked, so it is still sending when that answer is written. The
 * store used to close with the body unread, which resets the connection: the client failed with EPIPE
 * and read no status, and admission called the store unreachable. mv3 hit this in CI (EPIPE).
 *
 * The store now half-closes and discards a bounded amount (infra/media-store-vps/hebun_media_store.py,
 * MAX_LINGER_BYTES / LINGER_SECONDS). This proves, with the REAL store process and the REAL v2 client
 * (chunked, as production sends it), that the HTTP answer arrives every time:
 *
 *   - video storage disabled  -> every attempt reads 415, none is a transport error;
 *   - a bad grant             -> every attempt reads 401;
 *   - a refused write leaves no object behind.
 *
 * M2-R10O (B1): the same for a body exactly at the 20 MiB ceiling — the store decodes a refused chunked
 * body to its terminator and counts its payload, so the framing no longer matters — and the SOURCE side.
 * After a refusal, a transport failure or a timeout, `putStream` cancels the caller's source — the
 * Drive download (real `relayDriveFileVideo`) and the provider download (real `openProviderOutputStream`),
 * each piped through the admission's `boundedRelay` exactly as the admit paths do. A successful write
 * cancels nothing, and every failure still classifies exactly as before.
 *
 * It also runs the store's own v2 Python suite (bounds, slow client, success paths), which no other
 * test runs.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { createServer, type AddressInfo } from "node:net";
import path from "node:path";

import { boundedRelay } from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { openProviderOutputStream } from "../../src/features/media-assets/provider-output-download.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { relayDriveFileVideo } from "../../src/features/provider-google/google-transport.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";

const ROOT = process.cwd();
const TENANT = "00000000-0000-4000-8000-0000000010c1";
const ATTEMPTS = 100;
const BODY_BYTES = 256 * 1024;
const PIECE = 16 * 1024;

const TRANSPORT_CODES = new Set(["ECONNRESET", "EPIPE", "UND_ERR_SOCKET", "ECONNREFUSED"]);

/** What one attempt produced, in closed values: an HTTP status, a transport class, or a stored object. */
function outcomeOf(error: unknown): string {
  const status = /\((\d{3})\)/.exec(error instanceof Error ? error.message : "");
  if (status) return `http-${status[1]}`;
  for (let link: unknown = error, depth = 0; link && typeof link === "object" && depth < 6; depth++) {
    const { code, name, cause } = link as { code?: unknown; name?: unknown; cause?: unknown };
    if (typeof code === "string" && TRANSPORT_CODES.has(code)) return `transport-${code}`;
    if (name === "TimeoutError" || name === "AbortError") return "transport-TIMEOUT";
    link = cause;
  }
  return "transport-OTHER";
}

function chunkedBody(size: number): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= size) return controller.close();
      controller.enqueue(new Uint8Array(Math.min(PIECE, size - offset)));
      offset += PIECE;
    },
  });
}

async function attempts(
  store: LocalVpsStore,
  writeSecret: string,
  contentType: string,
  bodyBytes = BODY_BYTES,
  count = ATTEMPTS,
): Promise<Record<string, number>> {
  const client = createVpsMediaStorageV2({ origin: store.origin, writeSecret, readSecret: store.readSecret });
  const tally: Record<string, number> = {};
  for (let i = 0; i < count; i++) {
    let outcome: string;
    try {
      await client.putStream({
        key: `tenants/${TENANT}/media/${randomUUID()}`,
        contentType,
        body: chunkedBody(bodyBytes),
        maxBytes: 20 * 1024 * 1024,
        probe: "required",
      });
      outcome = "stored";
    } catch (error) {
      outcome = outcomeOf(error);
    }
    tally[outcome] = (tally[outcome] ?? 0) + 1;
  }
  return tally;
}

/** A source that records whether it was cancelled, the way a Drive or provider download would be. */
function trackedSource(total: number, delayMs = 0) {
  const state = { pulled: 0, cancelled: false, closed: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        if (state.pulled >= total) {
          state.closed = true;
          return controller.close();
        }
        controller.enqueue(new Uint8Array(Math.min(PIECE, total - state.pulled)));
        state.pulled += PIECE;
      },
      cancel() {
        state.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { state, stream };
}

type Put = ReturnType<typeof createVpsMediaStorageV2>["putStream"];
const MAX = 20 * 1024 * 1024;
/** A download arrives at network speed, not loopback speed: the store's answer lands mid-stream. */
const NETWORK = { delayMs: 2 };

/** The supplied path: Drive's content response, consumed through the admission's relay. */
async function viaDrive(put: Put, source: ReadableStream<Uint8Array>, timeoutMs?: number): Promise<string> {
  const fetchImpl = (async (url: string | URL) =>
    String(url).includes("alt=media")
      ? new Response(source, { status: 200 })
      : Response.json({ id: "f1", name: "a.mp4", mimeType: "video/mp4", size: String(MAX) })) as typeof fetch;
  const relayed = await relayDriveFileVideo(
    "token",
    "f1",
    async (body) => {
      try {
        await put({ key: `tenants/${TENANT}/media/${randomUUID()}`, contentType: "video/mp4", body: body.pipeThrough(boundedRelay(MAX).stream), maxBytes: MAX, timeoutMs });
        return "stored";
      } catch (error) {
        return outcomeOf(error);
      }
    },
    { fetchImpl },
  );
  assert.ok(relayed.ok);
  return relayed.value;
}

/** The generated path: one provider output stream, consumed through the admission's relay. */
async function viaProvider(put: Put, source: ReadableStream<Uint8Array>, timeoutMs?: number): Promise<string> {
  const opened = await openProviderOutputStream(
    { shape: "url", allowedHosts: ["cdn.example"], reveal: () => "https://cdn.example/out.mp4" } as never,
    "video/mp4",
    { get: async () => ({ status: 200, headers: {}, body: source }) },
  );
  assert.equal(opened.status, "streaming");
  if (opened.status !== "streaming") return "unopened";
  try {
    await put({ key: `tenants/${TENANT}/media/${randomUUID()}`, contentType: "video/mp4", body: opened.body.pipeThrough(boundedRelay(MAX).stream), maxBytes: MAX, timeoutMs });
    return "stored";
  } catch (error) {
    return outcomeOf(error);
  }
}

async function cancellation(label: string, put: Put, expect: { outcome: string; cancelled: boolean }, total: number, opts: { delayMs?: number; timeoutMs?: number } = {}) {
  for (const [path_, via] of [["supplied", viaDrive], ["generated", viaProvider]] as const) {
    const { state, stream } = trackedSource(total, opts.delayMs);
    const outcome = await via(put, stream, opts.timeoutMs);
    await new Promise((r) => setTimeout(r, 300));
    const pulled = state.pulled;
    await new Promise((r) => setTimeout(r, 700));
    assert.equal(outcome, expect.outcome, `${path_} ${label}: classified as before`);
    assert.ok(state.cancelled || state.closed, `${path_} ${label}: the source is not left open`);
    assert.equal(state.cancelled, expect.cancelled, `${path_} ${label}: source ${expect.cancelled ? "cancelled" : "not cancelled"}`);
    if (expect.cancelled) assert.equal(state.pulled, pulled, `${path_} ${label}: nothing pulled after the failure`);
    else assert.ok(state.closed, `${path_} ${label}: source read to its end`);
    console.log(`ok ${path_} ${label}: ${outcome}, source ${state.cancelled ? "cancelled" : "closed"} after ${state.pulled} bytes`);
  }
}

/** A loopback port that was just free: connecting to it is refused. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  await new Promise((r) => server.close(r));
  return port;
}

function filesUnder(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    n += statSync(p).isDirectory() ? filesUnder(p) : 1;
  }
  return n;
}

async function main(): Promise<void> {
  /* Video storage disabled (the helper's default): a type refused before the body is read. */
  const store = await startLocalVpsStore();
  try {
    const refusedType = await attempts(store, store.writeSecret, "video/mp4");
    assert.deepEqual(refusedType, { "http-415": ATTEMPTS }, `every streaming client reads the 415: ${JSON.stringify(refusedType)}`);
    console.log(`ok video storage disabled: ${ATTEMPTS}/${ATTEMPTS} read 415 while streaming ${BODY_BYTES} bytes chunked`);

    const badGrant = await attempts(store, "0".repeat(64), "image/png");
    assert.deepEqual(badGrant, { "http-401": ATTEMPTS }, `every streaming client reads the 401: ${JSON.stringify(badGrant)}`);
    console.log(`ok bad grant: ${ATTEMPTS}/${ATTEMPTS} read 401`);

    const full = await attempts(store, store.writeSecret, "video/mp4", MAX, 10);
    assert.deepEqual(full, { "http-415": 10 }, `a refused 20 MiB upload reads its 415: ${JSON.stringify(full)}`);
    console.log(`ok video storage disabled: 10/10 read 415 while streaming ${MAX} bytes chunked`);

    const client = createVpsMediaStorageV2({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret });
    const badClient = createVpsMediaStorageV2({ origin: store.origin, writeSecret: "0".repeat(64), readSecret: store.readSecret });
    const deadClient = createVpsMediaStorageV2({ origin: `http://127.0.0.1:${await closedPort()}`, writeSecret: store.writeSecret, readSecret: store.readSecret });
    await cancellation("early 415", client.putStream, { outcome: "http-415", cancelled: true }, MAX, NETWORK);
    await cancellation("early 401", badClient.putStream, { outcome: "http-401", cancelled: true }, MAX, NETWORK);
    await cancellation("transport failure", deadClient.putStream, { outcome: "transport-ECONNREFUSED", cancelled: true }, MAX, NETWORK);

    assert.equal(filesUnder(store.root), 0, "a refused write leaves nothing in the store");
    console.log("ok nothing was written");
  } finally {
    await store.dispose();
  }

  /* Video storage enabled: a write that completes, and one the client times out mid-stream. */
  const videoStore = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1" });
  try {
    const client = createVpsMediaStorageV2({ origin: videoStore.origin, writeSecret: videoStore.writeSecret, readSecret: videoStore.readSecret });
    await cancellation("successful upload", client.putStream, { outcome: "stored", cancelled: false }, 1024 * 1024);
    await cancellation("timeout", client.putStream, { outcome: "transport-TIMEOUT", cancelled: true }, MAX, { delayMs: 100, timeoutMs: 500 });
    assert.equal(filesUnder(videoStore.root), 2, "only the two completed uploads are stored");
  } finally {
    await videoStore.dispose();
  }

  /* The store's own v2 suite, including the lingering bounds. */
  const py = spawnSync("python3", ["-m", "unittest", "test_hebun_media_store_v2.py"], {
    cwd: path.resolve(ROOT, "../../infra/media-store-vps"),
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", PYTHONDONTWRITEBYTECODE: "1" } as unknown as NodeJS.ProcessEnv,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  const output = `${py.stdout ?? ""}${py.stderr ?? ""}`;
  assert.equal(py.status, 0, `the store v2 Python suite passes:\n${output.slice(-3000)}`);
  assert.match(output, /^OK/m, "unittest reports OK");
  assert.match(output, /^Ran \d+ tests/m);
  console.log(`ok store v2 Python suite: ${/^Ran (\d+) tests/m.exec(output)?.[1]} tests`);

  console.log("media-vps-storage/v2-early-refusal: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
