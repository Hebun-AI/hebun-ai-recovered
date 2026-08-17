/*
 * action-execution-live/resend-email-transport.server.ts — the ONE module in R3B that can reach the
 * network.
 *
 * It follows the architecture that worked for `heby-model-live/claude-http-transport.server.ts`:
 * server-only, direct HTTPS with zero new dependencies, an injectable fetch seam so every path is
 * provable without a real call, an explicit `AbortController` timeout, no automatic retries, and
 * typed errors that never carry provider text or the credential. It lives in its OWN feature so
 * `action-execution` stays provably network-free.
 *
 * ── WHERE IT DELIBERATELY DIVERGES FROM THAT PRECEDENT ───────────────────────
 *
 * The Claude transport maps every non-abort throw to `provider-unavailable` and every abort to
 * `timeout`. Copying that here would be a defect. A model call is a read; a send has a side
 * effect, and the question is not "did it work" but "COULD IT HAVE WORKED".
 *
 *   PROVABLY PRE-WRITE → `unreachable`. Safe to call a clean failure. Nothing was transmitted.
 *   ANYTHING ELSE      → `ambiguous`. The provider may hold the request.
 *
 * The bias is one-directional and it is not symmetric with the truth: claiming `unreachable`
 * without positive evidence turns a possible send into a reported non-send, and the Director then
 * retries and sends twice. Claiming `ambiguous` when nothing happened merely asks a human to look.
 * One mistake is expensive and irreversible; the other is cheap.
 *
 * ── THE VENDOR IS RESEND, AND THE HOST IS A FROZEN CONSTANT ──────────────────
 *
 * The vendor selection gate chose Resend on two facts no other candidate had together: a message
 * id in the JSON RESPONSE BODY (SendGrid returns it only in an `X-Message-Id` response header,
 * which `FetchLike` deliberately cannot see, so every SendGrid send would be UNKNOWN forever), and
 * a documented general-purpose `Idempotency-Key` with published duplicate semantics (Postmark
 * publishes that it has none; Mailgun's only key is scoped to Inbox Placement tests).
 *
 * Because a vendor is now selected, the provider host is a CONSTANT rather than deployment
 * configuration. That is a narrowing, not a convenience: a configurable URL is an arbitrary-URL
 * capability, and `ADAPTER_SANDBOX_BOUNDARY` says there is none. Resend's sending region is a
 * property of the verified DOMAIN, not of the base URL, so no regional endpoint is given up.
 *
 * ── WHAT THIS MODULE STILL DOES NOT DO ───────────────────────────────────────
 *
 * It does not retry, reconcile, look up, cancel, or verify. Hebun RELIES ON Resend's published
 * 24-hour idempotency window only as a property of the outside world — nothing here acts on it.
 * See `RESEND_IDEMPOTENCY_DOCTRINE`.
 */
import type {
  ExternalSendAdapter,
  ProviderOutcome,
  SendExternalMessageInput,
} from "@/features/action-execution/adapter-contract";

/** The adapter id recorded on every attempt row. Versioned, and it NAMES THE VENDOR on purpose. */
export const RESEND_ADAPTER_ID = "resend-email-v1" as const;

/**
 * The provider host. A frozen constant, not configuration — see the header.
 *
 * `adapter-registry.server.ts` re-exports nothing about it: there is no env var to set, so there is
 * no way for a deployment, a record, or a model to point this adapter somewhere else.
 */
export const RESEND_SEND_ENDPOINT = "https://api.resend.com/emails" as const;

/**
 * Deployment configuration. Presence-checked, never logged, never persisted, never returned.
 *
 * The sender and the subject are HERE, in deployment configuration, and nowhere else. Generation
 * one has one system-owned sender and one fixed subject for every tenant — see the firewalls in
 * `tests/r3b-flow/resend-mapping.ts`. Tenant-owned sender identities are R5 debt, recorded rather
 * than faked behind a shape the credential model cannot honour.
 */
export const EXTERNAL_SEND_API_KEY_ENV = "HEBUN_EXTERNAL_SEND_API_KEY" as const;
export const EXTERNAL_SEND_FROM_ENV = "HEBUN_EXTERNAL_SEND_FROM" as const;
export const EXTERNAL_SEND_SUBJECT_ENV = "HEBUN_EXTERNAL_SEND_SUBJECT" as const;

export const EXTERNAL_SEND_TIMEOUT_MS = 30_000;

/**
 * WHAT HEBUN RELIES ON FROM THE VENDOR, AND WHAT IT REFUSES TO DO WITH IT.
 *
 * Stated as a frozen value rather than a comment so a test can assert nobody softened it into an
 * automatic recovery path. Resend documents that a repeated request carrying the same
 * `Idempotency-Key` within 24 hours is processed once and returns the ORIGINAL response — which
 * means a replay would be both a reconciliation and a duplicate guarantee.
 *
 * Generation one does not use it. An `ambiguous` attempt becomes UNKNOWN and stays UNKNOWN until a
 * human looks, because `ExternalSendAdapter` has exactly one operation and no reconciliation
 * consumer exists. Recording the property now is what makes the R5 capability cheap later; acting
 * on it now would be a second external effect without a second authorization.
 */
export const RESEND_IDEMPOTENCY_DOCTRINE = Object.freeze({
  /** The provider-visible header. The value is the permit's `handoff_id`, never a minted token. */
  headerName: "Idempotency-Key" as const,
  /** Vendor-documented retention. A DEPENDENCY ON THE OUTSIDE WORLD, not something Hebun enforces. */
  vendorWindowHours: 24 as const,
  /** Generation one never replays, so the window is never relied upon in practice. */
  automaticReplay: false as const,
  automaticReconciliation: false as const,
  /** After the vendor window, a replay is NOT assumed safe. Nothing may quietly assume otherwise. */
  replaySafeAfterWindow: false as const,
  rationale:
    "Resend documents that the same Idempotency-Key within 24 hours returns the original response " +
    "without sending again. Hebun records that as a vendor property and acts on none of it: an " +
    "UNKNOWN attempt is surfaced to a human, never replayed by a machine.",
});

/** Minimal fetch shape — injectable so every branch is provable with NO real call. */
export type FetchLike = (
  input: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

export interface ResendEmailTransportConfig {
  /** Server-only credential. Read once; never logged, returned, persisted, or put in an error. */
  readonly apiKey: string;
  /** The system-owned sender. Deployment configuration — never client, model, record or tenant. */
  readonly sender: string;
  /** The fixed generation-one subject. Deployment configuration, for the same reason. */
  readonly subject: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: FetchLike;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("The external send transport is server-only.");
  }
}

/** Presence only — never the value. Presence is not authentication, reachability, or success. */
export function isExternalSendCredentialPresent(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return Boolean(env[EXTERNAL_SEND_API_KEY_ENV]?.trim());
}

/** The configured system-owned sender, or null. Never defaulted — an absent sender is absent. */
export function resolveExternalSendSender(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return env[EXTERNAL_SEND_FROM_ENV]?.trim() || null;
}

/**
 * The configured fixed subject, or null.
 *
 * NOT defaulted to a friendly string. A missing subject must make the adapter unavailable, because
 * a default would be a subject Hebun invented, and the whole point of the subject firewall is that
 * nothing inside Hebun chooses it.
 */
export function resolveExternalSendSubject(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return env[EXTERNAL_SEND_SUBJECT_ENV]?.trim() || null;
}

/**
 * THE PHASE CLASSIFIER.
 *
 * Only these establish that the connection never came up, so only these prove no external effect.
 * `ECONNRESET`, `EPIPE` and `ETIMEDOUT` are ABSENT on purpose: each can occur after the request
 * body was written, and a wrong `unreachable` is the expensive direction.
 */
const PROVABLY_PRE_WRITE_CODES: ReadonlySet<string> = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

/** Walk the `cause` chain for a Node error code. Bounded, so a cyclic cause cannot hang. */
export function extractErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Classify a thrown transport error into a phase.
 *
 * An abort is our own timeout firing. The request was already dispatched by then, so the provider
 * may hold it — `ambiguous`, never `unreachable`, even though a timeout during DNS would also
 * abort. We cannot tell the two apart, and only one of the two guesses is safe.
 */
export function classifyTransportError(error: unknown): "unreachable" | "ambiguous" {
  if (error instanceof Error && error.name === "AbortError") return "ambiguous";
  const code = extractErrorCode(error);
  if (code && PROVABLY_PRE_WRITE_CODES.has(code)) return "unreachable";
  return "ambiguous";
}

/**
 * Classify a response that arrived, against RESEND's documented shape.
 *
 *   2xx + `id`  → accepted. The only shape that proves the provider holds the operation.
 *   2xx, no id  → ambiguous. It probably accepted, and nothing can reconcile it later.
 *   4xx         → rejected. It answered and declined; nothing was sent.
 *   5xx         → ambiguous. A server error may follow an accept.
 *
 * ONLY `id` is read. The vendor is known and documents `{"id": "…"}`; tolerating other key names
 * would mean claiming `accepted` on a shape Resend never sends. Narrower acceptance can only ever
 * fail toward `ambiguous`, which is the safe direction.
 *
 * NOTE ON 409, which Resend uses for BOTH "same key, different payload" and "same key already in
 * flight". It is a 4xx, so it classifies as `rejected` — "nothing was sent". That is truthful for
 * the payload-mismatch case. It would be a lie for the concurrent case, and the reason it is not
 * one is structural rather than lucky: `handoff_id` is minted once inside the permit spend, and
 * `action_execution_attempts_handoff_uq` / `_permit_uq` make a second attempt on that key
 * impossible. Hebun cannot issue two concurrent requests with one key.
 */
export function classifyResponse(status: number, payload: unknown): ProviderOutcome {
  if (status >= 500) return { class: "ambiguous" };
  if (status >= 400) return { class: "rejected" };
  const id = (payload as { id?: unknown } | null)?.id;
  if (typeof id === "string" && id.trim().length > 0) {
    return { class: "accepted", providerMessageId: id.trim() };
  }
  return { class: "ambiguous" };
}

/**
 * Build the transport. Constructing it is inert — no I/O, no connection, no credential validation.
 * Only `send()` calls out, and it is called exactly once per attempt.
 */
export function createResendEmailTransport(
  config: ResendEmailTransportConfig,
): ExternalSendAdapter {
  assertServerRuntime();
  const apiKey = config.apiKey?.trim();
  if (!apiKey) throw new Error("No external send credential is configured.");
  const sender = config.sender?.trim();
  if (!sender) throw new Error("No external send sender is configured.");
  const subject = config.subject?.trim();
  if (!subject) throw new Error("No external send subject is configured.");
  const timeoutMs = config.timeoutMs ?? EXTERNAL_SEND_TIMEOUT_MS;
  const doFetch: FetchLike = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  return {
    adapterId: RESEND_ADAPTER_ID,
    endpointKind: "email",

    async send(input: SendExternalMessageInput): Promise<ProviderOutcome> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: { ok: boolean; status: number; json(): Promise<unknown> };
      try {
        response = await doFetch(RESEND_SEND_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            /* The credential travels in a header and appears in no log, error or record. */
            Authorization: `Bearer ${apiKey}`,
            /*
             * THE PROVIDER-VISIBLE IDEMPOTENCY KEY. It is the permit's `handoff_id` verbatim — no
             * transformation, no prefix, no minted token — so the provider collapses a duplicated
             * request into the one operation this permit authorized.
             */
            [RESEND_IDEMPOTENCY_DOCTRINE.headerName]: input.idempotencyKey,
          },
          /*
           * RESEND'S WIRE CONTRACT, and nothing else. The internal adapter input still carries
           * `endpointKind` and `idempotencyKey`; neither belongs in the provider body. The
           * idempotency key is a HEADER for Resend, so sending it in the body too would be a
           * second, unread copy of an authorization-bearing value — internal contract is not
           * provider contract.
           *
           * `text` is the exact approved revision bytes: not summarized, not sanitized, not
           * wrapped, no signature appended. `subject` and `from` are deployment configuration.
           */
          body: JSON.stringify({
            from: sender,
            to: [input.endpoint],
            subject,
            text: input.content,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        /* The raw error never surfaces. Only the phase does. */
        return { class: classifyTransportError(error) };
      } finally {
        clearTimeout(timer);
      }

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        /*
         * A body we cannot read is not a rejection. The provider answered; we simply cannot tell
         * what it said, and a 2xx with an unreadable body may well hold a message id.
         */
        return { class: response.status >= 400 && response.status < 500 ? "rejected" : "ambiguous" };
      }
      return classifyResponse(response.status, payload);
    },
  };
}
