/*
 * AEO-1-PROD-DELIVERY-1 — the one diagnostic line authentication mail emits (no DB, no network).
 *
 * A failed send prints exactly `[auth-mail] delivery=<outcome> http=<status|none>` and nothing
 * else: no address, no token, no key, no header, no provider body. An accepted send prints nothing.
 * Every response here is a fake, and each fake body carries the secrets a careless log would leak,
 * so "it was not printed" is asserted against values that were really in reach.
 */
import assert from "node:assert/strict";

import type { FetchLike } from "../../src/features/action-execution-live/resend-email-transport.server";
import { sendEmailVerificationMessage } from "../../src/features/auth-email-ownership/auth-mail.server";

const TO = "owner@example.test";
const REFERENCE = "ref-0123456789abcdef";
const API_KEY = "re_test_should_never_print";
const PROVIDER_MESSAGE = "The owner@example.test domain is not verified (re_test_should_never_print)";

const environment = {
  status: "configured",
  apiKey: API_KEY,
  from: "Hebun <no-reply@auth.example.test>",
  linkOrigin: "https://app.example.test",
} as const;

function respond(status: number, body: unknown, readable = true): FetchLike {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (!readable) throw new Error("unreadable");
      return body;
    },
  });
}

async function capture(fetchImpl: FetchLike): Promise<{ outcome: string; lines: string[] }> {
  const lines: string[] = [];
  const original = { warn: console.warn, log: console.log, error: console.error, info: console.info };
  const record = (...args: unknown[]) => void lines.push(args.map(String).join(" "));
  console.warn = record;
  console.log = record;
  console.error = record;
  console.info = record;
  try {
    const outcome = await sendEmailVerificationMessage(
      { to: TO, reference: REFERENCE, idempotencyKey: "00000000-0000-4000-8000-000000000001" },
      environment,
      { fetchImpl },
    );
    return { outcome, lines };
  } finally {
    Object.assign(console, original);
  }
}

function assertNothingSensitive(lines: string[]): void {
  for (const line of lines) {
    for (const secret of [TO, REFERENCE, API_KEY, "Bearer", "Authorization", PROVIDER_MESSAGE, "example.test"]) {
      assert.ok(!line.includes(secret), `the diagnostic line must not carry ${JSON.stringify(secret)}: ${line}`);
    }
  }
}

async function main(): Promise<void> {
  const rejected = await capture(respond(403, { name: "validation_error", message: PROVIDER_MESSAGE }));
  assert.equal(rejected.outcome, "rejected");
  assert.deepEqual(rejected.lines, ["[auth-mail] delivery=rejected http=403"], "a 403 prints its status and nothing else");
  assertNothingSensitive(rejected.lines);

  const unreadable = await capture(respond(422, null, false));
  assert.deepEqual(unreadable.lines, ["[auth-mail] delivery=rejected http=422"], "an unreadable 4xx still names its status");

  const serverError = await capture(respond(503, { message: PROVIDER_MESSAGE }));
  assert.deepEqual(serverError.lines, ["[auth-mail] delivery=ambiguous http=503"], "a 5xx is ambiguous and names its status");
  assertNothingSensitive(serverError.lines);

  const noSocket = await capture(async () => {
    throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${TO}`), { code: "ENOTFOUND" });
  });
  assert.deepEqual(noSocket.lines, ["[auth-mail] delivery=unreachable http=none"], "no response means no status");
  assertNothingSensitive(noSocket.lines);

  const accepted = await capture(respond(200, { id: "msg_0001" }));
  assert.equal(accepted.outcome, "accepted");
  assert.deepEqual(accepted.lines, [], "an accepted send prints nothing");

  console.log("auth-email-ownership-1 delivery-status-log: PASS");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
