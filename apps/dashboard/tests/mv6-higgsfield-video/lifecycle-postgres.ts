/*
 * MV-6 — the REAL Higgsfield transport behind the RELEASED MV-4 lifecycle writer. Real Postgres, real
 * migrations, real authority code; only the HTTP boundary is fake, and the global `fetch` throws.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "Behind the one MV-4 CAS writer, an acknowledged Higgsfield submission records the provider's
 *    request id and moves the invocation to provider-pending; polling moves it to provider-succeeded
 *    with the request id as the opaque reference, and creates NO Media asset. An ambiguous dispatch
 *    (timeout, 5xx) lands in dispatch-unknown with no job id and no failure code, after exactly one
 *    POST, and is never dispatched again. A 4xx lands in provider-failed with a closed code.
 *    Higgsfield `failed` and `canceled` land in provider-failed with the two MV-6 codes; a 404 or
 *    any unreadable answer moves nothing and is reported as observation-unreadable, never pending. No credential or provider URL reaches a
 *    row, and a tenant cannot reach another tenant's invocation or make a provider call for it."
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { MIGRATIONS_DIR } from "../../scripts/lib/canonical-migrations";
import { MEDIA_PROVIDER_FAILURES } from "../../src/features/media-assets/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import * as lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import {
  HIGGSFIELD_PROVIDER,
  HIGGSFIELD_VIDEO_MODEL,
  createHiggsfieldVideoTransport,
  type HiggsfieldFetch,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { createFakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { row, seedTenant, type Tenant } from "../mv4-async-generation/scenarios";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const NOW = new Date("2026-09-27T10:00:00.000Z");
const KEY_ID = "hf-test-key-id-not-real-0002";
const KEY_SECRET = "hf-test-secret-not-real-111111111111";
const CDN = "https://cdn.example.com/signed-output.mp4?sig=provider-secret";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv6-higgsfield-video/lifecycle-postgres: exited before completing");
    process.exitCode = 1;
  }
});

type Responder = (url: string, method: string) => Response;

/** A fake Higgsfield. Each test step sets what the next request sees; every request is recorded. */
function fakeHiggsfield() {
  const calls: { url: string; method: string }[] = [];
  let next: Responder = () => {
    throw new Error("no response scripted");
  };
  const fetchImpl: HiggsfieldFetch = async (url, init) => {
    calls.push({ url, method: init.method });
    return next(url, init.method);
  };
  return {
    calls,
    set(responder: Responder) {
      next = responder;
    },
    transport: createHiggsfieldVideoTransport({
      credential: { keyId: KEY_ID, keySecret: KEY_SECRET },
      spendBudget: createLiveSpendBudget(50),
      fetchImpl,
      dispatchTimeoutMs: 50,
      pollTimeoutMs: 50,
    }),
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function assetCount(client: Client): Promise<number> {
  return (await client.query<{ n: number }>(`select count(*)::int n from media_assets`)).rows[0]!.n;
}

/* ── The migration: one CHECK replaced by a strict superset, nothing else, no row rewritten ── */
function migrationProof(): void {
  const TAG = "20260927064103_mv6_higgsfield_failure_codes";
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
  assert.equal(journal.entries.at(-1)!.tag, TAG, "MV-6 authored the newest migration");
  const sql = readFileSync(path.join(MIGRATIONS_DIR, `${TAG}.sql`), "utf8");
  const statements = sql.split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean);
  assert.equal(statements.length, 2, "exactly two statements");
  assert.equal(statements[0], 'ALTER TABLE "media_generation_invocations" DROP CONSTRAINT "media_generation_invocations_provider_failure_chk";');
  assert.match(statements[1]!, /^ALTER TABLE "media_generation_invocations" ADD CONSTRAINT "media_generation_invocations_provider_failure_chk" CHECK \(/);
  assert.ok(!/\b(UPDATE|DELETE|INSERT|DROP TABLE|DROP COLUMN|ADD COLUMN|ALTER COLUMN|TRUNCATE)\b/i.test(sql), "no data is rewritten and no column changes");
  const admitted = (text: string) => [...text.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!).sort();
  const previous = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f < `${TAG}.sql`)
    .sort()
    .map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"))
    .flatMap((t) => t.split("--> statement-breakpoint"))
    .filter((t) => /ADD CONSTRAINT "media_generation_invocations_provider_failure_chk"/.test(t))
    .at(-1)!;
  const before = admitted(previous);
  const after = admitted(statements[1]!);
  assert.ok(before.every((code) => after.includes(code)), "every previously admitted code is still admitted");
  assert.deepEqual(after.filter((c) => !before.includes(c)).sort(), ["generation-failed", "provider-canceled"], "and exactly two are added");
  assert.deepEqual([...MEDIA_PROVIDER_FAILURES].sort(), after, "the closed vocabulary in code equals the CHECK");
}

async function main(): Promise<void> {
  migrationProof();
  const harness = createDisposablePostgresHarness("hebun_mv6_higgsfield");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  try {
    harness.migrateDatabase();
    await client.connect();
    const a = await seedTenant(client, getDb, "Acme");
    const b = await seedTenant(client, getDb, "Beta");
    const hf = fakeHiggsfield();
    const deps = { getDb, now: () => NOW, resolveTransport: () => ({ status: "available" as const, transport: hf.transport }) };
    const assetsAtStart = await assetCount(client);

    const register = async (t: Tenant): Promise<string> => {
      const r = await lifecycle.registerAsyncMediaGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "A slow pan across a kilim.", requestKey: randomUUID() }, deps);
      assert.equal(r.status, "registered", JSON.stringify(r));
      return (r as { invocationId: string }).invocationId;
    };
    const posts = () => hf.calls.filter((c) => c.method === "POST").length;

    /* ── The normal path: accepted → pending → polled → provider-succeeded ────── */
    const jobA = randomUUID();
    const okId = await register(a);
    {
      const r0 = await row(client, okId);
      assert.equal(r0.provider, HIGGSFIELD_PROVIDER, "the invocation records the provider");
      assert.equal(r0.model, HIGGSFIELD_VIDEO_MODEL, "and the pinned model with its parameters");
      assert.equal(r0.transport, "live");

      hf.set(() => json(200, { status: "queued", request_id: jobA, status_url: `https://api.higgsfield.ai/requests/${jobA}/status`, cancel_url: "x" }));
      const before = posts();
      assert.deepEqual(await lifecycle.dispatchAsyncMediaGeneration(a.ctx, okId, deps), { status: "transitioned", from: "registered", state: "provider-pending" });
      assert.equal(posts() - before, 1, "one POST");
      const r1 = await row(client, okId);
      assert.equal(r1.provider_job_id, jobA, "request_id captured when acknowledged");
      assert.ok(r1.provider_accepted_at, "acceptance time recorded");

      for (const state of ["queued", "in_progress"]) {
        hf.set(() => json(200, { status: state, request_id: jobA }));
        assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, okId, deps), { status: "observed-pending", state: "provider-pending" }, `${state} → pending`);
      }
      hf.set(() => json(200, { status: "completed", request_id: jobA, video: { url: CDN } }));
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, okId, deps), { status: "transitioned", from: "provider-pending", state: "provider-succeeded" });
      const r2 = await row(client, okId);
      assert.equal(r2.provider_output_ref, jobA, "the opaque reference is the request id");
      assert.equal(r2.admission_outcome, "not-attempted", "provider completion is not Media admission");
      assert.equal(r2.poll_count, 3);
      assert.equal(await assetCount(client), assetsAtStart, "NO Media asset from provider completion");

      const polls = hf.calls.length;
      assert.equal((await lifecycle.pollAsyncMediaGeneration(a.ctx, okId, deps)).status, "no-transition", "a terminal job is never asked again");
      assert.equal(hf.calls.length, polls, "no provider call for a terminal job");
      assert.equal((await lifecycle.dispatchAsyncMediaGeneration(a.ctx, okId, deps)).status, "no-transition", "and never dispatched again");
      assert.equal(hf.calls.length, polls);
    }

    /* ── Ambiguous dispatch: timeout and 5xx → dispatch-unknown, one POST, never again ─ */
    for (const [label, responder] of [
      ["timeout", () => { throw Object.assign(new Error("aborted"), { name: "TimeoutError" }); }],
      ["connection reset", () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }); }],
      ["502", () => json(502, { detail: "bad gateway" })],
      ["200 without a job", () => json(200, { status: "queued" })],
    ] as const) {
      const id = await register(a);
      hf.set(responder as Responder);
      const before = posts();
      assert.deepEqual(await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, deps), { status: "transitioned", from: "registered", state: "dispatch-unknown" }, label);
      assert.equal(posts() - before, 1, `${label}: exactly one POST`);
      const r = await row(client, id);
      assert.equal(r.provider_job_id, null, `${label}: no invented job id`);
      assert.equal(r.provider_failure, null, `${label}: not a failure`);
      assert.ok(r.finalized_at, `${label}: terminal`);
      hf.set(() => json(200, { status: "queued", request_id: randomUUID() }));
      assert.equal((await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, deps)).status, "no-transition", `${label}: never dispatched again`);
      assert.equal((await lifecycle.pollAsyncMediaGeneration(a.ctx, id, deps)).status, "no-transition", `${label}: nothing to poll`);
      assert.equal(posts() - before, 1, `${label}: still one POST`);
    }

    /* ── A refusal: 401 → provider-failed with a closed code ──────────────────── */
    {
      const id = await register(a);
      hf.set(() => json(401, { detail: "Invalid credentials" }));
      assert.deepEqual(await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, deps), { status: "transitioned", from: "registered", state: "provider-failed" });
      assert.equal((await row(client, id)).provider_failure, "authentication-failed");
    }

    /* ── nsfw → provider-failed, moderation-blocked ────────────────────────────── */
    {
      const id = await register(a);
      const job = randomUUID();
      hf.set(() => json(200, { status: "queued", request_id: job }));
      await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, deps);
      hf.set(() => json(200, { status: "nsfw", request_id: job }));
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, id, deps), { status: "transitioned", from: "provider-pending", state: "provider-failed" });
      assert.equal((await row(client, id)).provider_failure, "moderation-blocked");
    }

    /* ── failed / canceled → provider-failed with the two MV-6 codes; no provider text ─ */
    for (const [label, status, failure] of [
      ["failed", "failed", "generation-failed"],
      ["canceled", "canceled", "provider-canceled"],
    ] as const) {
      const id = await register(a);
      const job = randomUUID();
      hf.set(() => json(200, { status: "queued", request_id: job }));
      await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, deps);
      hf.set(() => json(200, { status, request_id: job, error: "Generation failed" }));
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, id, deps), { status: "transitioned", from: "provider-pending", state: "provider-failed" }, label);
      const r = await row(client, id);
      assert.equal(r.provider_failure, failure, `${label}: the closed MV-6 code`);
      assert.ok(r.provider_completed_at && r.finalized_at, `${label}: terminal`);
      assert.equal(r.admission_outcome, "not-attempted");
    }

    /* ── 404 / unreadable: observation-unreadable, never "still pending", nothing moves ─ */
    for (const [label, body] of [
      ["404", () => json(404, { detail: "Not found" })],
      ["status network failure", () => { throw new TypeError("fetch failed"); }],
      ["unreadable body", () => new Response("<html>", { status: 200 })],
    ] as const) {
      const id = await register(a);
      const job = randomUUID();
      hf.set(() => json(200, { status: "queued", request_id: job }));
      await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, deps);
      hf.set(body as Responder);
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, id, deps), { status: "observation-unreadable", state: "provider-pending" }, `${label}: not reported as pending`);
      const r = await row(client, id);
      assert.equal(r.state, "provider-pending", `${label}: the last provider fact is kept`);
      assert.equal(r.provider_failure, null, `${label}: no failure is invented`);
      assert.equal(r.finalized_at, null, `${label}: not finalized`);
      assert.equal(r.poll_count, 1, `${label}: the poll attempt is counted`);
      /* A later readable answer still resolves it. */
      hf.set(() => json(200, { status: "in_progress", request_id: job }));
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, id, deps), { status: "observed-pending", state: "provider-pending" }, `${label}: recoverable`);
    }

    /* ── Tenancy: B cannot dispatch, poll or read A's invocation, and no call is made ─ */
    {
      const id = await register(a);
      const calls = hf.calls.length;
      assert.deepEqual(await lifecycle.dispatchAsyncMediaGeneration(b.ctx, id, deps), { status: "refused", reason: "invocation-not-found" });
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(b.ctx, id, deps), { status: "refused", reason: "invocation-not-found" });
      assert.deepEqual(await lifecycle.readAsyncMediaGeneration(b.ctx, id, { getDb }), { status: "not-found" });
      assert.equal(hf.calls.length, calls, "no provider call on another tenant's behalf");
      assert.equal((await row(client, id)).state, "registered");
    }

    /* ── A job is only advanced through the transport it was registered with ─── */
    {
      const id = await register(a);
      const fake = createFakeAsyncVideoTransport("accept");
      assert.deepEqual(
        await lifecycle.dispatchAsyncMediaGeneration(a.ctx, id, { ...deps, resolveTransport: () => ({ status: "available", transport: fake }) }),
        { status: "refused", reason: "transport-mismatch" },
      );
      assert.equal(fake.dispatchCalls.length, 0);
    }

    /* ── Secrets and provider URLs never reach a row ───────────────────────────── */
    {
      const all = (await client.query<{ j: unknown }>(`select row_to_json(m)::text j from media_generation_invocations m`)).rows.map((r) => String(r.j)).join("\n");
      assert.ok(!all.includes(KEY_ID) && !all.includes(KEY_SECRET), "no credential in any invocation row");
      assert.ok(!all.includes("cdn.example.com") && !all.includes("provider-secret"), "no provider URL in any invocation row");
      assert.ok(!/Generation failed|Invalid credentials|bad gateway/.test(all), "no provider text in any invocation row");
      assert.equal(await assetCount(client), assetsAtStart, "MV-6 created no Media asset at all");
    }

    finished = true;
    console.log("mv6-higgsfield-video/lifecycle-postgres: PASS");
  } finally {
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
