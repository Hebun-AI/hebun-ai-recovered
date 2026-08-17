/*
 * R3B — the RESEND WIRE MAPPING, and the firewalls around the two values Hebun now has to supply.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Hebun posts exactly Resend's documented request to exactly Resend's documented host, carrying
 *    the permit's own handoff as the provider idempotency key and the approved revision bytes
 *    unaltered — while the sender and the subject can come from nothing but deployment
 *    configuration, the credential appears in no body, and no recipient address, tenant, permit or
 *    authority value crosses the wire."
 *
 * EVERY FETCH IS INJECTED. Nothing in this file opens a socket, and the one place `RESEND_SEND_
 * ENDPOINT` is compared is a string comparison against the constant.
 *
 * Pure. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  createResendEmailTransport,
  RESEND_IDEMPOTENCY_DOCTRINE,
  RESEND_SEND_ENDPOINT,
  type FetchLike,
} from "../../src/features/action-execution-live/resend-email-transport.server";
import { EXECUTION_RETRY_POLICY } from "../../src/features/action-execution/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });

const LIVE_CODE = collect("src/features/action-execution-live").map((f) => codeOf(read(f))).join("\n");
const CONTRACT_CODE = codeOf(read("src/features/action-execution/adapter-contract.ts"));

const SENDER = "operations@hebun.invalid";
const SUBJECT = "A fixed deployment subject";
const API_KEY = "re_test_never_real_do_not_leak";
const RECIPIENT = "someone@example.invalid";
const APPROVED_BYTES = "Merhaba,\n\nSipariş #42 hazır. Değeri: 1.250,00 ₺ — teşekkürler.\n\n— TRH";

interface Captured {
  url: string;
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal };
}

/** A fetch that records the request and answers however the case needs. Never touches a socket. */
function capturingFetch(
  answer: () => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>,
): { fetchImpl: FetchLike; calls: Captured[] } {
  const calls: Captured[] = [];
  return {
    calls,
    fetchImpl: async (url, init) => {
      calls.push({ url, init: init as Captured["init"] });
      return answer();
    },
  };
}

const ok = (body: unknown, status = 200) => async () => ({
  ok: status < 400,
  status,
  json: async () => body,
});

const transport = (fetchImpl: FetchLike) =>
  createResendEmailTransport({ apiKey: API_KEY, sender: SENDER, subject: SUBJECT, fetchImpl });

const send = (fetchImpl: FetchLike, over: Partial<{ endpoint: string; content: string; idempotencyKey: string }> = {}) =>
  transport(fetchImpl).send({
    endpointKind: "email",
    endpoint: over.endpoint ?? RECIPIENT,
    content: over.content ?? APPROVED_BYTES,
    idempotencyKey: over.idempotencyKey ?? "11111111-2222-3333-4444-555555555555",
  });

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE REQUEST — A, B, C, D, E, F, G, H.
 * ═════════════════════════════════════════════════════════════════════════ */
async function requestMapping(): Promise<void> {
  const { fetchImpl, calls } = capturingFetch(ok({ id: "resend-msg-1" }));
  const outcome = await send(fetchImpl, { idempotencyKey: "handoff-abc-123" });

  assert.equal(calls.length, 1);
  const { url, init } = calls[0]!;

  /* A + B — exactly Resend's documented endpoint, by POST. */
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(url, RESEND_SEND_ENDPOINT);
  assert.equal(init.method, "POST");

  /* C + D + E — the three headers, with Resend's documented casing. */
  assert.equal(init.headers.Authorization, `Bearer ${API_KEY}`);
  assert.equal(init.headers["Content-Type"], "application/json");
  assert.equal(
    init.headers["Idempotency-Key"],
    "handoff-abc-123",
    "the provider idempotency key is the permit handoff, verbatim",
  );
  assert.equal(Object.keys(init.headers).length, 3, "no fourth header is sent");

  /* F — the body has exactly Resend's four fields, and no fifth. */
  const body = JSON.parse(init.body) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["from", "subject", "text", "to"]);
  assert.equal(body.from, SENDER);
  assert.deepEqual(body.to, [RECIPIENT], "the recipient travels as a single-element array");
  assert.equal(body.subject, SUBJECT);

  /* H — the approved bytes cross the wire unaltered: not trimmed, escaped away or normalised. */
  assert.equal(body.text, APPROVED_BYTES);
  assert.equal(
    JSON.parse(init.body).text,
    APPROVED_BYTES,
    "Turkish characters, the lira sign, the em dash and the newlines all survive the round trip",
  );

  /* G — nothing internal leaks into the provider body. */
  for (const forbidden of [
    "channel",
    "content",
    "idempotencyKey",
    "endpointKind",
    "tenantId",
    "permitId",
    "actionRequestId",
    "handoffId",
    "recipientId",
    "apiKey",
    "authorization",
    "governance",
    "decision",
  ]) {
    assert.ok(
      !(forbidden in body),
      `the provider body must not carry \`${forbidden}\` — internal contract is not wire contract`,
    );
  }
  assert.ok(!init.body.includes("handoff-abc-123"), "the idempotency key is a header, not a field");
  assert.ok(!init.body.includes(API_KEY), "the credential never enters the body");

  /* I — the documented `id` becomes the acceptance evidence, and nothing stronger is claimed. */
  assert.deepEqual(outcome, { class: "accepted", providerMessageId: "resend-msg-1" });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE OUTCOMES — I, J, K, L, M, N.
 * ═════════════════════════════════════════════════════════════════════════ */
async function outcomeMapping(): Promise<void> {
  /* J — a 2xx that carries no id cannot be reconciled, so it is never acceptance. */
  for (const body of [{}, { id: "" }, { messageId: "wrong-key" }]) {
    assert.deepEqual(await send(capturingFetch(ok(body)).fetchImpl), { class: "ambiguous" });
  }

  /* K — the provider answered and declined. 409 (duplicate key) is one of these. */
  for (const status of [400, 401, 403, 422, 429, 409]) {
    assert.deepEqual(
      await send(capturingFetch(ok({ message: "no" }, status)).fetchImpl),
      { class: "rejected" },
    );
  }

  /* L — a server error may follow an accept. */
  for (const status of [500, 502, 503]) {
    assert.deepEqual(await send(capturingFetch(ok({}, status)).fetchImpl), { class: "ambiguous" });
  }

  /* M — our own timeout fires AFTER dispatch. UNKNOWN territory, never a clean failure. */
  const abort = new Error("aborted");
  abort.name = "AbortError";
  assert.deepEqual(
    await send(async () => {
      throw abort;
    }),
    { class: "ambiguous" },
  );

  /* N — the connection provably never came up, so no external effect is possible. */
  const preWrite = new TypeError("fetch failed");
  (preWrite as { cause?: unknown }).cause = Object.assign(new Error("dns"), { code: "ENOTFOUND" });
  assert.deepEqual(
    await send(async () => {
      throw preWrite;
    }),
    { class: "unreachable" },
  );

  /* …but a reset can happen after the write, and must not be downgraded to a clean failure. */
  const postWrite = new TypeError("fetch failed");
  (postWrite as { cause?: unknown }).cause = Object.assign(new Error("reset"), { code: "ECONNRESET" });
  assert.deepEqual(
    await send(async () => {
      throw postWrite;
    }),
    { class: "ambiguous" },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. O, P, Q — MISSING CONFIGURATION NEVER REACHES THE NETWORK.
 * ═════════════════════════════════════════════════════════════════════════ */
function configurationGates(): void {
  const forbidden: FetchLike = () => {
    throw new Error("a send was attempted with incomplete configuration");
  };
  for (const [label, config] of [
    ["credential", { apiKey: "", sender: SENDER, subject: SUBJECT }],
    ["sender", { apiKey: API_KEY, sender: "", subject: SUBJECT }],
    ["subject", { apiKey: API_KEY, sender: SENDER, subject: "" }],
    ["all three", { apiKey: "", sender: "", subject: "" }],
  ] as const) {
    assert.throws(
      () => createResendEmailTransport({ ...config, fetchImpl: forbidden }),
      /configured/i,
      `a missing ${label} must fail at construction, before any network primitive exists`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. R — ZERO AUTOMATIC RETRY, WHATEVER THE PROVIDER SAYS.
 * ═════════════════════════════════════════════════════════════════════════ */
async function noRetry(): Promise<void> {
  for (const answer of [
    ok({ id: "x" }),
    ok({}, 500),
    ok({ message: "no" }, 429),
    async (): Promise<never> => {
      throw new Error("boom");
    },
  ]) {
    const { fetchImpl, calls } = capturingFetch(answer as () => Promise<never>);
    await send(fetchImpl);
    assert.equal(calls.length, 1, "one send is exactly one request, whatever came back");
  }
  assert.equal(EXECUTION_RETRY_POLICY.automaticRetries, 0);
  assert.equal(EXECUTION_RETRY_POLICY.retriesUnknownOutcomes, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE SUBJECT FIREWALL — release-critical.
 *
 * Generation one's subject is deployment configuration. No tenant, model, artifact, recipient or
 * provider response may influence it.
 * ═════════════════════════════════════════════════════════════════════════ */
async function subjectFirewall(): Promise<void> {
  /*
   * BEHAVIOURAL: the adapter input is the ONLY thing a caller controls, and varying every field of
   * it cannot move the subject by a single byte.
   */
  const seen = new Set<unknown>();
  for (const over of [
    {},
    { endpoint: "other@example.invalid" },
    { content: "Subject: Injected\n\nbody" },
    { content: "" },
    { idempotencyKey: "different-handoff" },
  ]) {
    const { fetchImpl, calls } = capturingFetch(ok({ id: "x" }));
    await send(fetchImpl, over);
    seen.add((JSON.parse(calls[0]!.init.body) as { subject: unknown }).subject);
  }
  assert.deepEqual([...seen], [SUBJECT], "nothing a caller supplies can change the subject");

  /* A caller cannot even express a subject: the adapter input has exactly four fields. */
  const inputShape = CONTRACT_CODE.match(/interface SendExternalMessageInput \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.ok(inputShape.length > 0, "the adapter input interface must be findable");
  assert.deepEqual(
    [...inputShape.matchAll(/readonly (\w+):/g)].map((m) => m[1]),
    ["endpointKind", "endpoint", "content", "idempotencyKey"],
    "the adapter input is still exactly four values — no subject, no sender",
  );

  /* STRUCTURAL: the live feature cannot reach any source a subject could be stolen from. */
  for (const forbidden of [
    "workArtifact",
    "work_artifacts",
    "artifactTitle",
    "revision",
    "knowledge",
    "heby",
    "model",
    "actionRequest",
    "canonicalPayload",
    "tenantId",
  ]) {
    assert.ok(
      !LIVE_CODE.includes(forbidden),
      `the subject may not be derivable from ${forbidden} — the live transport must not see it`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE SENDER FIREWALL — same rule, same reasons.
 * ═════════════════════════════════════════════════════════════════════════ */
async function senderFirewall(): Promise<void> {
  const seen = new Set<unknown>();
  for (const over of [
    {},
    { endpoint: "attacker@example.invalid" },
    { content: "From: someone-else@example.invalid" },
    { idempotencyKey: "another-handoff" },
  ]) {
    const { fetchImpl, calls } = capturingFetch(ok({ id: "x" }));
    await send(fetchImpl, over);
    seen.add((JSON.parse(calls[0]!.init.body) as { from: unknown }).from);
  }
  assert.deepEqual([...seen], [SENDER], "nothing a caller supplies can change the sender");

  /* The recipient never becomes the sender, and never appears anywhere but `to`. */
  const { fetchImpl, calls } = capturingFetch(ok({ id: "x" }));
  await send(fetchImpl);
  const body = JSON.parse(calls[0]!.init.body) as Record<string, unknown>;
  assert.notEqual(body.from, RECIPIENT);
  assert.equal(
    (calls[0]!.init.body.match(new RegExp(RECIPIENT, "g")) ?? []).length,
    1,
    "the recipient address appears exactly once in the request, inside `to`",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE PRIVACY FIREWALL — nothing sensitive survives into a returned value.
 * ═════════════════════════════════════════════════════════════════════════ */
async function privacyFirewall(): Promise<void> {
  for (const answer of [
    ok({ id: "x" }),
    ok({ message: "invalid `to` field: someone@example.invalid" }, 422),
    ok({}, 500),
    async (): Promise<never> => {
      throw Object.assign(new Error(`connect ECONNREFUSED for ${RECIPIENT}`), { code: "ECONNREFUSED" });
    },
  ]) {
    const outcome = await send(capturingFetch(answer as () => Promise<never>).fetchImpl);
    const serialized = JSON.stringify(outcome);
    assert.ok(!serialized.includes(API_KEY), "no outcome carries the credential");
    assert.ok(!serialized.includes(RECIPIENT), "no outcome carries the recipient address");
    assert.ok(!serialized.includes(SENDER), "no outcome carries the sender");
    assert.ok(!serialized.includes(APPROVED_BYTES), "no outcome carries the message body");
    /* Only the released four classes, plus an id when and only when accepted. */
    const { class: cls, ...rest } = outcome as { class: string } & Record<string, unknown>;
    assert.ok(["accepted", "rejected", "unreachable", "ambiguous"].includes(cls));
    assert.deepEqual(
      Object.keys(rest),
      cls === "accepted" ? ["providerMessageId"] : [],
      "the provider response is never returned wholesale — only its classification and its id",
    );
  }

  /* Provider prose never becomes a Hebun value, even when the provider is chatty. */
  const chatty = await send(capturingFetch(ok({ id: "ok", name: "email", to: [RECIPIENT] })).fetchImpl);
  assert.deepEqual(chatty, { class: "accepted", providerMessageId: "ok" });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE IDEMPOTENCY DOCTRINE — a recorded vendor DEPENDENCY, not a mechanism.
 * ═════════════════════════════════════════════════════════════════════════ */
async function idempotencyDoctrine(): Promise<void> {
  /* The same handoff always produces the same key. The adapter mints nothing of its own. */
  const keys = new Set<string>();
  for (let i = 0; i < 3; i += 1) {
    const { fetchImpl, calls } = capturingFetch(ok({ id: "x" }));
    await send(fetchImpl, { idempotencyKey: "stable-handoff" });
    keys.add(calls[0]!.init.headers["Idempotency-Key"]!);
  }
  assert.deepEqual([...keys], ["stable-handoff"], "the key is a function of the handoff and nothing else");

  /* No UUID minting anywhere in the live feature — the key comes from the permit or not at all. */
  for (const forbidden of ["randomUUID", "randomBytes", "Math.random", "uuid"]) {
    assert.ok(!LIVE_CODE.includes(forbidden), `the adapter must not mint an id: ${forbidden}`);
  }

  /* The doctrine is a value, so nobody can quietly soften it into automatic recovery. */
  assert.equal(RESEND_IDEMPOTENCY_DOCTRINE.headerName, "Idempotency-Key");
  assert.equal(RESEND_IDEMPOTENCY_DOCTRINE.vendorWindowHours, 24);
  assert.equal(RESEND_IDEMPOTENCY_DOCTRINE.automaticReplay, false);
  assert.equal(RESEND_IDEMPOTENCY_DOCTRINE.automaticReconciliation, false);
  assert.equal(
    RESEND_IDEMPOTENCY_DOCTRINE.replaySafeAfterWindow,
    false,
    "past the vendor window a replay is NOT assumed safe",
  );

  /*
   * And nothing in the feature ACTS on the window. Checked by mechanism, not by vocabulary: the
   * doctrine value itself contains the word "replay" precisely in order to deny one, so a
   * substring sweep for it would flag the denial as the offence.
   *
   * A replay path needs at least one of: a clock to measure the window against, a scheduler, a
   * loop, or a second dispatch. There is none of any.
   */
  for (const forbidden of ["Date.now", "new Date(", "setInterval", "86400", "24 * 60", "while ("]) {
    assert.ok(
      !LIVE_CODE.includes(forbidden),
      `generation one records the window and acts on none of it: ${forbidden}`,
    );
  }
  assert.equal(
    (LIVE_CODE.match(/await doFetch\(/g) ?? []).length,
    1,
    "exactly one dispatch site exists, so there is nowhere for a replay to live",
  );
}

async function main(): Promise<void> {
  await requestMapping();
  await outcomeMapping();
  configurationGates();
  await noRetry();
  await subjectFirewall();
  await senderFirewall();
  await privacyFirewall();
  await idempotencyDoctrine();
  console.log("R3B Resend mapping: all assertions passed.");
}

void main();
