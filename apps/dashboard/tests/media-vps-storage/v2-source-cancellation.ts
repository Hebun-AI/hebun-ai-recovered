/*
 * MEDIA STORE V2 — A FAILED WRITE CANCELS THE CALLER'S SOURCE (Package 3 M2-R10H).
 *
 * `putStream` streams a Drive or provider download into the store. After a refusal, a transport failure
 * or a timeout, fetch keeps pulling that body or abandons it locked, so the download stays open. The
 * client now holds the source's reader and cancels it on every failure; a 201 cancels nothing.
 *
 * No store and no network: the store is the client's `fetchImpl` seam, and each fake reads the request
 * body the way fetch does and then answers, fails or stalls. Every case runs over both admission source
 * shapes, built by the real code:
 *
 *   supplied   Drive's content response (real `relayDriveFileVideo`) → `boundedRelay` → putStream
 *   generated  one provider output stream (real `openProviderOutputStream`) → `boundedRelay` → putStream
 *
 * Proven: 415/401/transport/timeout cancel the source and nothing is pulled after; a 201 cancels nothing;
 * a source error keeps its classification; a cancel that throws masks nothing; and a body chunk read
 * but never written (fetch stopped reading) does not block the cancel, as a pipe abort did.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { boundedRelay } from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { openProviderOutputStream } from "../../src/features/media-assets/provider-output-download.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { relayDriveFileVideo } from "../../src/features/provider-google/google-transport.server";

const TENANT = "00000000-0000-4000-8000-0000000010c1";
const PIECE = 16 * 1024;
const TOTAL = 2 * 1024 * 1024;
const MAX = 20 * 1024 * 1024;
const SETTLE_MS = 300;

let unhandled = 0;
process.on("unhandledRejection", () => {
  unhandled += 1;
});

/* The runner reads only the exit code. A pending promise kept alive only by an unref'd timer (as
 * `AbortSignal.timeout`'s is) lets Node exit 0 with `main()` unsettled, so three guards make an
 * unfinished run red: a REF'D watchdog that keeps the loop alive and fails a hang, an exit check that
 * fails any exit before the last case, and a count of every case that ran. */
const WATCHDOG_MS = 60_000;
const EXPECTED_CASES = 9 * 2; // nine scenarios, each over the supplied and the generated shape
let completed = 0;
let current = "start";
let finished = false;
const watchdog = setTimeout(() => {
  console.error(`v2-source-cancellation: TIMEOUT after ${WATCHDOG_MS} ms in "${current}" (${completed}/${EXPECTED_CASES} cases)`);
  process.exit(1);
}, WATCHDOG_MS);
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error(`v2-source-cancellation: exited before finishing, in "${current}" (${completed}/${EXPECTED_CASES} cases)`);
    process.exitCode = 1;
  }
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A download that records what was pulled and whether it was cancelled. */
function trackedSource(total: number, opts: { cancelThrows?: boolean } = {}) {
  const state = { pulled: 0, cancelled: false, closed: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (state.pulled >= total) {
          state.closed = true;
          return controller.close();
        }
        controller.enqueue(new Uint8Array(Math.min(PIECE, total - state.pulled)));
        state.pulled += PIECE;
      },
      cancel() {
        state.cancelled = true;
        if (opts.cancelThrows) throw new Error("source cancel failed");
      },
    },
    { highWaterMark: 0 },
  );
  return { state, stream };
}

/* ── the store, as fetch sees it ── */

type Fake = (body: ReadableStream<Uint8Array>, signal: AbortSignal) => Promise<Response>;

function storeFetch(fake: Fake): typeof fetch {
  return (async (_url: string | URL, init?: RequestInit) => fake(init!.body as ReadableStream<Uint8Array>, init!.signal!)) as typeof fetch;
}

/** Read `n` chunks, then stop reading — neither cancel nor release, as fetch does after an answer. */
async function readChunks(body: ReadableStream<Uint8Array>, n: number) {
  const reader = body.getReader();
  for (let i = 0; i < n; i++) await reader.read();
  return reader;
}

const answers = (status: number): Fake => async (body) => {
  await readChunks(body, 1);
  return Response.json({ error: "refused" }, { status });
};

const fails = (error: Error, afterMs = 0): Fake => async (body) => {
  await readChunks(body, 1);
  await sleep(afterMs);
  throw error;
};

const stalls: Fake = async (body, signal) => {
  await readChunks(body, 1);
  return new Promise<Response>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
};

/** 201 only once the body is consumed to its end, as the store answers. */
const stores: Fake = async (body) => {
  const reader = body.getReader();
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
  }
  return Response.json({ status: "stored", byteSize: n, sha256Hex: "0".repeat(64) }, { status: 201 });
};

/** A source error surfaces as fetch's own failure, the cause chained. */
const relaysSourceError: Fake = async (body) => {
  const reader = body.getReader();
  for (;;) {
    try {
      const { done } = await reader.read();
      if (done) break;
    } catch (cause) {
      throw new TypeError("fetch failed", { cause });
    }
  }
  return Response.json({ status: "stored", byteSize: 1, sha256Hex: "0".repeat(64) }, { status: 201 });
};

/* ── the two admission source shapes ── */

type Run = { outcome: unknown; overrun: boolean; readerCancels: number };
type Shape = (fake: Fake, source: ReadableStream<Uint8Array>, relayMax: number, timeoutMs?: number) => Promise<Run>;

function client(fake: Fake) {
  return createVpsMediaStorageV2({ origin: "https://store.test", writeSecret: "a".repeat(64), readSecret: "b".repeat(64), fetchImpl: storeFetch(fake) });
}

/** The body handed to putStream, with every `cancel()` on the reader it takes counted. A cancel on a
 * stream that has already ended reaches nothing below it, so the source alone cannot show it: the
 * reader call itself is the evidence. */
async function put(fake: Fake, body: ReadableStream<Uint8Array>, timeoutMs?: number): Promise<{ outcome: unknown; readerCancels: number }> {
  let readerCancels = 0;
  const getReader = body.getReader.bind(body);
  body.getReader = ((...args: Parameters<typeof body.getReader>) => {
    const reader = getReader(...args) as ReadableStreamDefaultReader<Uint8Array>;
    const cancel = reader.cancel.bind(reader);
    reader.cancel = (reason?: unknown) => {
      readerCancels += 1;
      return cancel(reason);
    };
    return reader;
  }) as typeof body.getReader;
  try {
    await client(fake).putStream({ key: `tenants/${TENANT}/media/${randomUUID()}`, contentType: "video/mp4", body, maxBytes: MAX, timeoutMs });
    return { outcome: "stored", readerCancels };
  } catch (error) {
    return { outcome: error, readerCancels };
  }
}

const supplied: Shape = async (fake, source, relayMax, timeoutMs) => {
  const driveFetch = (async (url: string | URL) =>
    String(url).includes("alt=media")
      ? new Response(source, { status: 200 })
      : Response.json({ id: "f1", name: "a.mp4", mimeType: "video/mp4", size: String(TOTAL) })) as typeof fetch;
  const relayed = await relayDriveFileVideo(
    "token",
    "f1",
    async (body) => {
      const relay = boundedRelay(relayMax);
      const written = await put(fake, body.pipeThrough(relay.stream), timeoutMs);
      return { ...written, overrun: relay.result().overrun };
    },
    { fetchImpl: driveFetch },
  );
  assert.ok(relayed.ok, "the Drive relay reached its consumer");
  return relayed.value;
};

const generated: Shape = async (fake, source, relayMax, timeoutMs) => {
  const opened = await openProviderOutputStream(
    { shape: "url", allowedHosts: ["cdn.example"], reveal: () => "https://cdn.example/out.mp4" } as never,
    "video/mp4",
    { get: async () => ({ status: 200, headers: {}, body: source }) },
  );
  assert.equal(opened.status, "streaming", "the provider output opened");
  if (opened.status !== "streaming") throw new Error("unopened");
  const relay = boundedRelay(relayMax);
  const written = await put(fake, opened.body.pipeThrough(relay.stream), timeoutMs);
  return { ...written, overrun: relay.result().overrun || opened.overran() };
};

const SHAPES: ReadonlyArray<[string, Shape]> = [
  ["supplied", supplied],
  ["generated", generated],
];

/** The admission paths' own classification of a failed write. */
function classify(run: Run): string {
  if (run.overrun) return "overrun";
  if (run.outcome === "stored") return "stored";
  const m = /\((\d{3})\)/.exec(run.outcome instanceof Error ? run.outcome.message : "");
  return m ? `store-${m[1]}` : "store-unreachable";
}

async function each(
  label: string,
  make: () => Fake,
  check: (run: Run, state: ReturnType<typeof trackedSource>["state"], fake: Fake) => void,
  opts: { relayMax?: number; timeoutMs?: number; cancelThrows?: boolean } = {},
) {
  for (const [name, shape] of SHAPES) {
    current = `${name} ${label}`;
    const { state, stream } = trackedSource(TOTAL, opts);
    const fake = make();
    const run = await shape(fake, stream, opts.relayMax ?? MAX, opts.timeoutMs);
    await sleep(SETTLE_MS);
    const pulledAtSettle = state.pulled;
    await sleep(SETTLE_MS);
    assert.equal(state.pulled, pulledAtSettle, `${name} ${label}: nothing is pulled once the write has ended`);
    check(run, state, fake);
    completed += 1;
    console.log(`ok ${name} ${label}: ${classify(run)}, reader cancels ${run.readerCancels}, source ${state.cancelled ? "cancelled" : state.closed ? "closed" : "untouched"} after ${state.pulled} bytes`);
  }
}

/** A failed write cancels the reader it holds exactly once. */
function readerCancelledOnce(name: string, run: Run) {
  assert.equal(run.readerCancels, 1, `${name}: putStream cancels its reader once`);
}

function cancelledAfterFailure(name: string) {
  return (run: Run, state: { cancelled: boolean; pulled: number }) => {
    readerCancelledOnce(name, run);
    assert.ok(state.cancelled, `${name}: the source is cancelled`);
    assert.ok(state.pulled < TOTAL, `${name}: the source was not drained`);
  };
}

async function main(): Promise<void> {
  /* 1, 2. An HTTP refusal while the body is still flowing. */
  for (const status of [415, 401]) {
    await each(`HTTP ${status}`, () => answers(status), (run, state) => {
      assert.equal(classify(run), `store-${status}`, `HTTP ${status} classifies as before`);
      cancelledAfterFailure(`HTTP ${status}`)(run, state);
    });
  }

  /* 3. A transport failure: the error thrown is fetch's own, unchanged. */
  const reset = new TypeError("fetch failed", { cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }) });
  await each("transport failure", () => fails(reset), (run, state) => {
    assert.equal(run.outcome, reset, "the transport error is the one fetch threw");
    assert.equal(classify(run), "store-unreachable");
    cancelledAfterFailure("transport failure")(run, state);
  });

  /* 4. A timeout. */
  await each(
    "timeout",
    () => stalls,
    (run, state) => {
      assert.equal((run.outcome as Error | null)?.name, "TimeoutError", "the timeout surfaces as fetch's TimeoutError");
      assert.equal(classify(run), "store-unreachable");
      cancelledAfterFailure("timeout")(run, state);
    },
    { timeoutMs: 100 },
  );

  /* 5. A 201, answered once the body is consumed to its end: nothing is cancelled. The source has
   *    ended by then, so a needless cancel would reach nothing below; the reader count still sees it. */
  await each("HTTP 201", () => stores, (run, state) => {
    assert.equal(run.outcome, "stored");
    assert.equal(run.readerCancels, 0, "a successful write never cancels its reader");
    assert.equal(state.cancelled, false, "a successful write cancels nothing");
    assert.equal(state.pulled, TOTAL, "every byte was relayed");
  });

  /* 6. The source fails mid-stream (the relay ceiling): still classified as an overrun. */
  await each(
    "source error",
    () => relaysSourceError,
    (run) => {
      assert.ok(run.outcome instanceof TypeError && run.outcome.message === "fetch failed", "fetch's failure reaches the caller");
      assert.equal(classify(run), "overrun", "a source overrun classifies as before");
      readerCancelledOnce("source error", run);
    },
    { relayMax: 256 * 1024 },
  );

  /* 7. A cancel that throws masks neither an HTTP nor a transport error. */
  await each("HTTP 415, cancel throws", () => answers(415), (run, state) => {
    assert.equal(classify(run), "store-415");
    readerCancelledOnce("HTTP 415, cancel throws", run);
    assert.ok(state.cancelled);
  }, { cancelThrows: true });
  await each("transport failure, cancel throws", () => fails(reset), (run, state) => {
    assert.equal(run.outcome, reset);
    readerCancelledOnce("transport failure, cancel throws", run);
    assert.ok(state.cancelled);
  }, { cancelThrows: true });

  /* 9. A chunk read but never written: fetch read one chunk and stalled long enough for the body to
   *    read the next, then failed. A pipe abort waits for that write forever; the cancel must not. */
  await each("chunk in flight", () => fails(reset, 50), (run, state) => {
    assert.equal(run.outcome, reset);
    cancelledAfterFailure("chunk in flight")(run, state);
  });

  /* 8 is asserted by every case above: nothing pulled between the two settle reads. */
  assert.equal(unhandled, 0, "no unhandled rejection");
  assert.equal(completed, EXPECTED_CASES, "every scenario ran over both shapes");
  finished = true;
  clearTimeout(watchdog);
  console.log(`media-vps-storage/v2-source-cancellation: ok (${completed} cases)`);
}

main().catch((error: unknown) => {
  console.error(error);
  clearTimeout(watchdog);
  process.exitCode = 1;
});
