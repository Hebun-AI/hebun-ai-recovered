/*
 * heby-model/claude-transport.ts — the injectable transport seam.
 *
 * This defines the Claude Messages-shaped request/response the client translates
 * to and from, and the transport interface the client depends on. R2B ships NO
 * network transport and NO SDK. The default transport is `unavailableClaudeTransport`,
 * which performs no I/O and always fails closed. A real network transport is a
 * separate, explicitly-authorized live-connectivity step (not R2B).
 *
 * The client depends only on this interface — never on a concrete SDK — so the
 * whole request/response lifecycle is provable with an injected fake transport.
 */

import { ModelConnectivityError } from "./model-error";

export interface ClaudeTransportMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

/**
 * RELEVANCE-2A — an OPTIONAL request for a structured (JSON-object) answer.
 *
 * Generic on purpose: the transport carries a closed JSON schema and nothing else. What the object
 * MEANS — which keys, which values, which ids are legitimate — is validated by the consumer, never
 * here, and never by trusting a provider's own schema enforcement.
 *
 * ABSENT means exactly the request every released caller already sends. No existing caller sets it.
 *
 * NOT YET SERIALISED FOR A REAL PROVIDER. Which provider mechanism carries it (a native structured
 * output, a forced tool call, or neither) is unverified and is a provider-acceptance gate; until
 * that gate the live transport refuses any request carrying this field before any I/O.
 */
export interface ClaudeTransportStructuredOutput {
  /** A short identifier for the schema, e.g. `relevance_selection`. */
  readonly name: string;
  /** A closed JSON schema object. Transported as data; the transport never interprets it. */
  readonly schema: Readonly<Record<string, unknown>>;
}

export interface ClaudeTransportRequest {
  readonly model: string;
  readonly system: string;
  readonly messages: readonly ClaudeTransportMessage[];
  readonly maxTokens: number;
  /** RELEVANCE-2A — absent for every text request. See `ClaudeTransportStructuredOutput`. */
  readonly structuredOutput?: ClaudeTransportStructuredOutput;
}

export interface ClaudeTransportUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export interface ClaudeTransportContentBlock {
  readonly type: string;
  readonly text?: string;
}

export interface ClaudeTransportResponse {
  readonly id?: string;
  readonly model?: string;
  readonly content: readonly ClaudeTransportContentBlock[];
  readonly stopReason?: string;
  readonly usage?: ClaudeTransportUsage;
  /**
   * RELEVANCE-2A — the parsed structured value, present only when a transport that supports
   * structured output answered a request that asked for it. `unknown` on purpose: nothing here
   * vouches for its shape. Text responses never carry it.
   */
  readonly structured?: unknown;
}

export interface ClaudeTransport {
  send(request: ClaudeTransportRequest): Promise<ClaudeTransportResponse>;
}

/**
 * The default transport: no network, no SDK, no credentials — always closed. Its
 * presence guarantees that wiring the client without an explicit live transport
 * can never accidentally reach a provider.
 */
export const unavailableClaudeTransport: ClaudeTransport = Object.freeze({
  async send(): Promise<ClaudeTransportResponse> {
    throw new ModelConnectivityError(
      "transport-unavailable",
      "No live model transport is configured.",
    );
  },
});
