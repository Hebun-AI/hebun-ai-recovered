/*
 * AUTH-EMAIL-OWNERSHIP-1 test helper — give a seeded human a PROVEN address the way the product does.
 *
 * Genesis acceptance now requires a proven address. Tests that exercise acceptance therefore need
 * one, and they get it through the RELEASED authority — issue a link (to a fake transport that never
 * reaches the network), then present it from the human's own session — rather than by writing the
 * proof columns directly. A raw write would prove nothing about the path a real human takes.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { FetchLike } from "../../src/features/action-execution-live/resend-email-transport.server";
import type { AuthenticationDigestKey } from "../../src/features/auth/environment/auth-environment.server";
import { AUTH_MAIL_ENV_KEYS } from "../../src/features/auth-email-ownership/auth-mail.server";
import {
  confirmEmailVerification,
  issueEmailVerification,
} from "../../src/features/auth-email-ownership/email-verification.server";

/** A digest key that exists only in tests. */
export const TEST_EMAIL_DIGEST_KEY: AuthenticationDigestKey = Object.freeze({
  version: 1,
  secret: "test-only-email-ownership-digest-secret-0123456789",
});

/** Mail configuration that names no real account. Only ever paired with a fake transport. */
export const TEST_AUTH_MAIL_ENV: Readonly<Record<string, string>> = Object.freeze({
  [AUTH_MAIL_ENV_KEYS.apiKey]: "re_test_not_a_real_key",
  [AUTH_MAIL_ENV_KEYS.from]: "Hebun <auth@auth.example.test>",
  [AUTH_MAIL_ENV_KEYS.linkOrigin]: "https://app.example.test",
});

export interface RecordedSend {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: { readonly from: string; readonly to: readonly string[]; readonly subject: string; readonly text: string };
}

/** A transport that records what it was asked to send and answers like the provider would. */
export function createRecordingFetch(
  answer: "accepted" | "rejected" | "server-error" | "throw-dns" | "throw-abort" = "accepted",
): { readonly fetchImpl: FetchLike; readonly sends: RecordedSend[] } {
  const sends: RecordedSend[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    sends.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (answer === "throw-dns") throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
    if (answer === "throw-abort") throw Object.assign(new Error("aborted"), { name: "AbortError" });
    if (answer === "rejected") return { ok: false, status: 422, json: async () => ({ message: "x" }) };
    if (answer === "server-error") return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ id: `msg_${randomBytes(4).toString("hex")}` }) };
  };
  return { fetchImpl, sends };
}

/** The token a recorded message carried, read from the link's fragment exactly as a browser would. */
export function tokenFromSend(send: RecordedSend): string {
  const link = send.body.text.split("\n").find((line) => line.startsWith("https://"));
  assert.ok(link, "the message carries a link");
  const url = new URL(link);
  return new URLSearchParams(url.hash.replace(/^#/, "")).get("token") ?? "";
}

/**
 * Prove `authIdentityId`'s current address through the released issue + confirm path.
 * `sessionContextId` must be a real session row of that identity.
 */
export async function proveEmailOwnership(
  db: ControlPlaneDatabase,
  input: { readonly authIdentityId: string; readonly sessionContextId: string; readonly now?: Date },
): Promise<void> {
  const { fetchImpl, sends } = createRecordingFetch("accepted");
  const deps = {
    getDb: () => db,
    mailEnv: TEST_AUTH_MAIL_ENV,
    digestKeys: [TEST_EMAIL_DIGEST_KEY],
    fetchImpl,
    ...(input.now ? { now: () => input.now! } : {}),
  };
  const issued = await issueEmailVerification(input.authIdentityId, deps);
  assert.deepEqual(issued, { status: "issued", delivery: "accepted" }, "the proof link is issued");
  const confirmed = await confirmEmailVerification(
    tokenFromSend(sends[0]!),
    { authIdentityId: input.authIdentityId, sessionContextId: input.sessionContextId },
    deps,
  );
  assert.deepEqual(confirmed, { status: "verified" }, "the proof link is consumed by its own session");
}
