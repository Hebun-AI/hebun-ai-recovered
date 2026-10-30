/*
 * auth-email-ownership/auth-mail.server.ts — the AUTHENTICATION MAIL capability.
 *
 * ── ONE TRANSPORT, TWO AUTHORITIES ───────────────────────────────────────────
 *
 * Hebun already has exactly one outbound mail transport: `createResendEmailTransport`. This module
 * REUSES it — no second HTTP client, no second vendor, no second error classification — and reuses
 * nothing else from the external-send stack. There is no permit, no recipient authority, no arming
 * control and no tenant here, because authentication mail is not a tenant's act: it is the platform
 * telling a human something about their own identity.
 *
 * What keeps the two capabilities apart is CONFIGURATION THAT CANNOT BE SHARED BY ACCIDENT: its own
 * key, its own sender and its own link origin, all under `HEBUN_AUTH_MAIL_*`. The intended key is a
 * Resend `sending_access` key restricted to the authentication sending domain, so it cannot read,
 * manage or send from anything else. None of it is ever logged, persisted or returned.
 *
 * ── WHAT IT CAN SEND ─────────────────────────────────────────────────────────
 *
 * One fixed message, to the one address the challenge recorded. The caller supplies no subject, no
 * body and no URL — only the reference to embed — so this cannot be turned into a general mailer.
 *
 * ── THE LINK ─────────────────────────────────────────────────────────────────
 *
 * The origin comes from configuration, never from a request's Host header: a forged Host would
 * otherwise mail a real token to an attacker's domain. The token rides in the URL FRAGMENT, which a
 * browser never sends to a server — so it never reaches request logs, proxies, or a Referer.
 */
import { createResendEmailTransport, type FetchLike } from "@/features/action-execution-live/resend-email-transport.server";

import { EMAIL_VERIFICATION_FRAGMENT_KEY, type AuthMailDeliveryOutcome } from "./contracts";

export const AUTH_MAIL_ENV_KEYS = Object.freeze({
  apiKey: "HEBUN_AUTH_MAIL_API_KEY",
  from: "HEBUN_AUTH_MAIL_FROM",
  linkOrigin: "HEBUN_AUTH_MAIL_LINK_ORIGIN",
});

/** Short on purpose: a human is waiting, and nothing is retried. */
export const AUTH_MAIL_TIMEOUT_MS = 10_000;

export const EMAIL_VERIFICATION_SUBJECT = "Confirm your email address for Hebun";

export type AuthMailEnvironment =
  | {
      readonly status: "configured";
      readonly apiKey: string;
      readonly from: string;
      readonly linkOrigin: string;
    }
  | {
      readonly status: "not-configured";
      readonly missingKeys: readonly string[];
      readonly invalidKeys: readonly string[];
    };

/**
 * An https origin and nothing else: no path, query, fragment or credentials. Returns the canonical
 * origin, or null. Plain http is refused even for localhost — a link carrying a credential-grade
 * token must never travel in clear.
 */
export function canonicalLinkOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (value.replace(/\/$/, "") !== url.origin) return null;
  return url.origin;
}

/** A bare address or `Name <address>`; the provider validates the rest. */
function isUsableSender(value: string): boolean {
  return /^[^<>\r\n]*<?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(value);
}

export function resolveAuthMailEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuthMailEnvironment {
  const apiKey = env[AUTH_MAIL_ENV_KEYS.apiKey]?.trim() ?? "";
  const from = env[AUTH_MAIL_ENV_KEYS.from]?.trim() ?? "";
  const origin = env[AUTH_MAIL_ENV_KEYS.linkOrigin]?.trim() ?? "";

  const missingKeys: string[] = [];
  const invalidKeys: string[] = [];
  if (!apiKey) missingKeys.push(AUTH_MAIL_ENV_KEYS.apiKey);
  if (!from) missingKeys.push(AUTH_MAIL_ENV_KEYS.from);
  else if (!isUsableSender(from)) invalidKeys.push(AUTH_MAIL_ENV_KEYS.from);
  if (!origin) missingKeys.push(AUTH_MAIL_ENV_KEYS.linkOrigin);
  const linkOrigin = origin ? canonicalLinkOrigin(origin) : null;
  if (origin && linkOrigin === null) invalidKeys.push(AUTH_MAIL_ENV_KEYS.linkOrigin);

  if (missingKeys.length > 0 || invalidKeys.length > 0 || linkOrigin === null) {
    return { status: "not-configured", missingKeys, invalidKeys };
  }
  return { status: "configured", apiKey, from, linkOrigin };
}

/** The link a human opens. The token is in the fragment and nowhere else. */
export function buildEmailVerificationLink(linkOrigin: string, reference: string): string {
  return `${linkOrigin}/verify-email#${EMAIL_VERIFICATION_FRAGMENT_KEY}=${reference}`;
}

export function buildEmailVerificationText(link: string): string {
  return [
    "Someone signed in to Hebun with this email address asked to confirm that it belongs to them.",
    "",
    "To confirm it, open this link in a browser where you are signed in to Hebun with this address:",
    link,
    "",
    "The link works once and expires in 24 hours. Confirming does not sign you in.",
    "If you did not ask for this, ignore this message. Nothing will change.",
  ].join("\n");
}

/**
 * THE ONE DIAGNOSTIC THIS PATH EMITS (AEO-1-PROD-DELIVERY-1, a named Director exception).
 *
 * A `rejected` outcome covers every 400–499, so without the status a production failure cannot be
 * told apart: authentication, sender permission, request format and quota all look the same. This
 * line names the status and NOTHING else — no address, no token, no key, no header, no provider
 * text. Only a failed send prints it. `boundaries-and-firewall.ts` pins this helper verbatim.
 */
function isHttpStatus(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= 100 && value <= 599;
}

function warnDeliveryFailure(outcome: AuthMailDeliveryOutcome, httpStatus: number | null): void {
  const status = isHttpStatus(httpStatus) ? String(httpStatus) : "none";
  console.warn(`[auth-mail] delivery=${outcome} http=${status}`);
}

export interface AuthMailDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Test seam only: the transport's own fetch seam, so no test can reach the network. */
  readonly fetchImpl?: FetchLike;
}

/**
 * Send ONE verification message. Never throws: every failure is an outcome. No retry, ever — an
 * `ambiguous` send is reported, not repeated, because repeating could deliver twice.
 *
 * `idempotencyKey` is the challenge id, so even an accidental second call for the same challenge is
 * deduplicated by the provider.
 *
 * The transport keeps its released behaviour; it is handed a wrapper over the same fetch it would
 * use by default, which records `response.status` and touches nothing of the request. That
 * `globalThis.fetch` reference is the second named exception, pinned by the firewall.
 */
export async function sendEmailVerificationMessage(
  input: { readonly to: string; readonly reference: string; readonly idempotencyKey: string },
  environment: Extract<AuthMailEnvironment, { status: "configured" }>,
  deps: AuthMailDeps = {},
): Promise<AuthMailDeliveryOutcome> {
  let httpStatus: number | null = null;
  const base: FetchLike = deps.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const observed: FetchLike = async (url, init) => {
    const response = await base(url, init);
    httpStatus = response.status;
    return response;
  };

  let outcome: AuthMailDeliveryOutcome;
  try {
    const transport = createResendEmailTransport({
      apiKey: environment.apiKey,
      sender: environment.from,
      subject: EMAIL_VERIFICATION_SUBJECT,
      timeoutMs: AUTH_MAIL_TIMEOUT_MS,
      fetchImpl: observed,
    });
    const sent = await transport.send({
      endpointKind: "email",
      endpoint: input.to,
      content: buildEmailVerificationText(
        buildEmailVerificationLink(environment.linkOrigin, input.reference),
      ),
      idempotencyKey: input.idempotencyKey,
    });
    outcome = sent.class;
  } catch {
    /* Construction cannot fail with a configured environment; if it ever does, nothing was sent. */
    outcome = "unreachable";
  }
  if (outcome !== "accepted") warnDeliveryFailure(outcome, httpStatus);
  return outcome;
}
