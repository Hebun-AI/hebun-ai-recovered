/*
 * action-execution-live/email-https-transport.server.ts — the ONE module in R3B that can reach the
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
 * ── NO VENDOR IS SELECTED HERE ───────────────────────────────────────────────
 *
 * This implements a declared, minimal JSON contract over HTTPS — it does not name, import or
 * assume any provider. Choosing and arming an actual vendor is a separate Director gate, and until
 * that happens the endpoint env var is unset, `resolveExternalSendAdapter` returns nothing, and no
 * code path here can execute. HTTPS over SMTP because an HTTP status gives a determinate
 * accept/reject with an id to reconcile against, which is exactly the evidence `accepted` requires.
 */
import type {
  ExternalSendAdapter,
  ProviderOutcome,
  SendExternalMessageInput,
} from "@/features/action-execution/adapter-contract";

/** The adapter id recorded on every attempt row. Versioned, because the contract may change. */
export const EMAIL_HTTPS_ADAPTER_ID = "email-https-v1" as const;

/** Deployment configuration. Presence-checked, never logged, never persisted, never returned. */
export const EXTERNAL_SEND_API_KEY_ENV = "HEBUN_EXTERNAL_SEND_API_KEY" as const;
export const EXTERNAL_SEND_ENDPOINT_ENV = "HEBUN_EXTERNAL_SEND_ENDPOINT" as const;

export const EXTERNAL_SEND_TIMEOUT_MS = 30_000;

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

export interface EmailHttpsTransportConfig {
  /** Server-only credential. Read once; never logged, returned, persisted, or put in an error. */
  readonly apiKey: string;
  /** The provider endpoint. Must be HTTPS — asserted at construction, before any I/O. */
  readonly endpointUrl: string;
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

/** The configured endpoint, or null. Non-HTTPS is treated as absent rather than downgraded. */
export function resolveExternalSendEndpoint(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  const raw = env[EXTERNAL_SEND_ENDPOINT_ENV]?.trim();
  if (!raw) return null;
  return raw.toLowerCase().startsWith("https://") ? raw : null;
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
 * Classify a response that arrived.
 *
 *   2xx + message id → accepted. The only shape that proves the provider holds the operation.
 *   2xx, no id       → ambiguous. It probably accepted, and nothing can reconcile it later.
 *   4xx              → rejected. It answered and declined; nothing was sent.
 *   5xx              → ambiguous. A server error may follow an accept.
 */
export function classifyResponse(status: number, payload: unknown): ProviderOutcome {
  if (status >= 500) return { class: "ambiguous" };
  if (status >= 400) return { class: "rejected" };
  const id = (payload as { id?: unknown; messageId?: unknown } | null)?.messageId
    ?? (payload as { id?: unknown } | null)?.id;
  if (typeof id === "string" && id.trim().length > 0) {
    return { class: "accepted", providerMessageId: id.trim() };
  }
  return { class: "ambiguous" };
}

/**
 * Build the transport. Constructing it is inert — no I/O, no connection, no credential validation.
 * Only `send()` calls out, and it is called exactly once per attempt.
 */
export function createEmailHttpsTransport(config: EmailHttpsTransportConfig): ExternalSendAdapter {
  assertServerRuntime();
  const apiKey = config.apiKey?.trim();
  if (!apiKey) throw new Error("No external send credential is configured.");
  const endpointUrl = config.endpointUrl?.trim();
  if (!endpointUrl || !endpointUrl.toLowerCase().startsWith("https://")) {
    throw new Error("The external send endpoint must be an https:// URL.");
  }
  const timeoutMs = config.timeoutMs ?? EXTERNAL_SEND_TIMEOUT_MS;
  const doFetch: FetchLike = config.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);

  return {
    adapterId: EMAIL_HTTPS_ADAPTER_ID,
    endpointKind: "email",

    async send(input: SendExternalMessageInput): Promise<ProviderOutcome> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let response: { ok: boolean; status: number; json(): Promise<unknown> };
      try {
        response = await doFetch(endpointUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            /* The credential travels in a header and appears in no log, error or record. */
            authorization: `Bearer ${apiKey}`,
            /*
             * THE PROVIDER-VISIBLE IDEMPOTENCY KEY. It is the permit's `handoff_id`, so a provider
             * that honours the header collapses a duplicated request into one operation.
             */
            "idempotency-key": input.idempotencyKey,
          },
          body: JSON.stringify({
            to: input.endpoint,
            channel: input.endpointKind,
            content: input.content,
            idempotencyKey: input.idempotencyKey,
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
