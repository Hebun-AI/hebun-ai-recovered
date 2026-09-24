/*
 * PUBLISH-0 — the publish transport and the runtime identity read, against a FAKE fetch only.
 *
 * `globalThis.fetch` is replaced with a function that throws, so any path that forgot to use the
 * injected fake fails loudly instead of reaching Meta. No real provider call happens in this file.
 */
import assert from "node:assert/strict";
import {
  INSTAGRAM_PUBLISH_OPERATIONS,
  INSTAGRAM_PUBLISH_PATH_PATTERN,
  publishInstagramImage,
} from "../../src/features/provider-instagram/instagram-publish-transport.server";
import { readPublishingIdentity } from "../../src/features/provider-instagram/instagram-transport.server";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED — tests must inject fetchImpl");
}) as typeof fetch;

const TOKEN = "SECRET-TOKEN-must-not-leak";
const IG_ID = "17841408635351823";
const APP_ID = "28295264780115792";

interface Call {
  readonly method: string;
  readonly url: string;
  readonly body: string | undefined;
  readonly auth: string | undefined;
}

function fakeFetch(answers: Array<{ status: number; body: unknown } | "throw-lost" | "throw-dns">) {
  const calls: Call[] = [];
  const impl = async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    calls.push({ method: String(init.method), url, body: init.body as string | undefined, auth: headers.Authorization });
    const next = answers.shift();
    if (!next) throw new Error("unexpected extra call");
    if (next === "throw-lost") throw new Error("socket hang up");
    if (next === "throw-dns") throw Object.assign(new Error("dns"), { cause: { code: "ENOTFOUND" } });
    return new Response(JSON.stringify(next.body), { status: next.status });
  };
  return { calls, impl: impl as never };
}

const input = { publishingAccountId: IG_ID, imageUrl: "https://media.example.com/a.jpg", caption: "Kilim" };
const noSleep = { sleep: async () => {}, statusPolls: 3 };

/* ── The operation list is closed and pinned. ── */
assert.deepEqual(
  INSTAGRAM_PUBLISH_OPERATIONS.map((o) => `${o.method} ${o.path}`),
  ["POST /{ig-user-id}/media", "GET /{container-id}", "POST /{ig-user-id}/media_publish"],
);
for (const bad of ["/1/comments", "/1/insights", "/me/media", "/1/media/x", "/../1", "/abc/media", "https://evil/1"]) {
  assert.equal(INSTAGRAM_PUBLISH_PATH_PATTERN.test(bad), false, `${bad} is unrepresentable`);
}

async function main() {
  /* ── Success: three calls, in order, token only in the header, real media id recorded. ── */
  {
    const f = fakeFetch([
      { status: 200, body: { id: "900" } },
      { status: 200, body: { status_code: "FINISHED" } },
      { status: 200, body: { id: "18000000000000001" } },
    ]);
    const out = await publishInstagramImage(input, TOKEN, { ...noSleep, fetchImpl: f.impl });
    assert.deepEqual(out, { class: "accepted", mediaId: "18000000000000001", containerId: "900" });
    assert.deepEqual(
      f.calls.map((c) => `${c.method} ${new URL(c.url).pathname}`),
      ["POST /v23.0/17841408635351823/media", "GET /v23.0/900", "POST /v23.0/17841408635351823/media_publish"],
    );
    for (const c of f.calls) {
      assert.equal(new URL(c.url).host, "graph.instagram.com");
      assert.equal(c.auth, `Bearer ${TOKEN}`);
      assert.equal(c.url.includes(TOKEN), false, "token never in URL");
      assert.equal((c.body ?? "").includes(TOKEN), false, "token never in body");
    }
    assert.equal(f.calls[2]!.body, "creation_id=900");
    assert.equal(JSON.stringify(out).includes(TOKEN), false, "token never in outcome");
  }

  /* ── Container refused: NO publish call; rejected; no media id. ── */
  {
    const f = fakeFetch([{ status: 400, body: { error: { code: 100, message: TOKEN } } }]);
    const out = await publishInstagramImage(input, TOKEN, { ...noSleep, fetchImpl: f.impl });
    assert.equal(out.class, "rejected");
    assert.equal(f.calls.length, 1, "no publish after a failed container");
    assert.equal(JSON.stringify(out).includes(TOKEN), false, "provider body never echoed");
  }

  /* ── Container never FINISHED / ERROR / already PUBLISHED: no publish call. ── */
  for (const code of ["IN_PROGRESS", "ERROR", "EXPIRED", "PUBLISHED"]) {
    const answers = [{ status: 200, body: { id: "900" } }, ...Array(3).fill({ status: 200, body: { status_code: code } })];
    const f = fakeFetch(answers);
    const out = await publishInstagramImage(input, TOKEN, { ...noSleep, fetchImpl: f.impl });
    assert.equal(out.class, "rejected", `${code} → rejected`);
    assert.equal(f.calls.some((c) => c.url.includes("media_publish")), false, `${code} → never published`);
  }

  /* ── Publish failures are never recorded as success. ── */
  const publishCase = async (last: { status: number; body: unknown } | "throw-lost" | "throw-dns") => {
    const f = fakeFetch([
      { status: 200, body: { id: "900" } },
      { status: 200, body: { status_code: "FINISHED" } },
      last,
    ]);
    return publishInstagramImage(input, TOKEN, { ...noSleep, fetchImpl: f.impl });
  };
  assert.equal((await publishCase({ status: 400, body: { error: { code: 10 } } })).class, "rejected");
  assert.equal((await publishCase({ status: 500, body: {} })).class, "ambiguous", "5xx after write = ambiguous");
  assert.equal((await publishCase("throw-lost")).class, "ambiguous", "lost answer = ambiguous, never failed");
  assert.equal((await publishCase("throw-dns")).class, "unreachable", "provable pre-write = unreachable");
  assert.equal((await publishCase({ status: 200, body: {} })).class, "ambiguous", "success without id ≠ accepted");

  /* ── Input refused before any call. ── */
  for (const bad of [
    { ...input, publishingAccountId: "../x" },
    { ...input, imageUrl: "http://insecure/a.jpg" },
    { ...input, imageUrl: "https://u:p@host/a.jpg" },
    { ...input, caption: "x".repeat(2201) },
  ]) {
    const f = fakeFetch([]);
    const out = await publishInstagramImage(bad, TOKEN, { ...noSleep, fetchImpl: f.impl });
    assert.equal(out.class, "rejected");
    assert.equal(f.calls.length, 0, "invalid input never leaves the process");
  }

  /* ── Runtime identity: GET /me?fields=id,user_id, bound to the connection's own id. ── */
  {
    const f = fakeFetch([{ status: 200, body: { id: APP_ID, user_id: IG_ID } }]);
    const out = await readPublishingIdentity(TOKEN, APP_ID, { fetchImpl: f.impl });
    assert.deepEqual(out, { ok: true, value: { appScopedAccountId: APP_ID, publishingAccountId: IG_ID } });
    assert.equal(f.calls[0]!.method, "GET");
    const url = new URL(f.calls[0]!.url);
    assert.equal(url.pathname, "/v23.0/me");
    assert.equal(url.searchParams.get("fields"), "id,user_id");
  }
  {
    const f = fakeFetch([{ status: 200, body: { id: "111", user_id: IG_ID } }]);
    const out = await readPublishingIdentity(TOKEN, APP_ID, { fetchImpl: f.impl });
    assert.equal(out.ok, false, "a token for another account is refused");
  }
  {
    const f = fakeFetch([{ status: 200, body: { id: APP_ID } }]);
    const out = await readPublishingIdentity(TOKEN, APP_ID, { fetchImpl: f.impl });
    assert.deepEqual(out.ok === false && out.reason, "instagram-publishing-id-missing");
  }
  {
    /* 17841408635351823 as a JSON NUMBER parses to ...820 — a different account. Refused. */
    const impl = (async () =>
      new Response(`{"id":"${APP_ID}","user_id":17841408635351823}`, { status: 200 })) as never;
    const out = await readPublishingIdentity(TOKEN, APP_ID, { fetchImpl: impl });
    assert.equal(out.ok, false, "an unsafe numeric user_id is refused, never rounded");
  }

  console.log("PASS publish-0 transport boundary (fake fetch only)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
