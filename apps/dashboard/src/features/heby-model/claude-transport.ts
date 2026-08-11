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

export interface ClaudeTransportRequest {
  readonly model: string;
  readonly system: string;
  readonly messages: readonly ClaudeTransportMessage[];
  readonly maxTokens: number;
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
