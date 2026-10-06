/*
 * heby-model/heby-model-generation.server.ts — the server-only generation entry.
 *
 * This is the one place model generation is orchestrated. It resolves server-only
 * configuration, evaluates availability, and — only when AVAILABLE and an explicit
 * transport is injected — runs the Claude client. By default (no transport) it
 * returns an honest `unavailable` outcome; it can never silently reach a live
 * provider. Live invocation is impossible without an explicitly injected transport,
 * and R2B injects only a no-network fake in tests.
 *
 * It does NOT own the request boundary (R2C), persistence (R2D), or any UI. It
 * never trusts a client-supplied tenant id — `request.tenantId`, when present, is
 * expected to have come from the authoritative R1 server-side TenantContext.
 */

import {
  unavailableStatusFor,
  type ModelAdapterStatus,
  type ModelAvailabilityState,
  type ModelGenerationRequest,
  type ModelGenerationResult,
} from "@/features/heby-runtime";
import {
  resolveModelConnectivityConfig,
  type ModelConnectivityConfig,
} from "./model-connectivity-environment.server";
import { evaluateModelAvailability } from "./model-availability";
import { createClaudeModelClient } from "./claude-model-client";
import type { ClaudeTransport } from "./claude-transport";
import { ModelConnectivityError } from "./model-error";
import { isAnthropicMessagesEgress } from "@/features/heby-model-live/claude-http-transport.server";
import { resolveClaudeDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import {
  authorizeExternalAiDisclosure,
  externalAiDisclosureEvidence,
  type AuthorizeExternalAiDisclosure,
  type ExternalAiDisclosureDeclaration,
} from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import {
  recordExternalAiDisclosureDecision,
  type RecordExternalAiDisclosureDecision,
} from "@/features/governance-audit/external-ai-disclosure-audit.server";

export interface HebyModelGenerationDeps {
  /** Config source. Defaults to process.env (server-only). */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /**
   * The live/test transport. ABSENT BY DEFAULT — its absence forces a closed,
   * `TRANSPORT_UNAVAILABLE` outcome, so nothing reaches a provider unless a caller
   * explicitly injects a transport (a no-network fake in R2B).
   */
  readonly transport?: ClaudeTransport;
  /*
   * EXTERNAL-AI-DATA-USE-B2 — what this request discloses, declared by the caller that built it:
   * the tenant from its authenticated context, the purpose, and every data class by the authority
   * that owns it. ABSENT means undeclared, and an undeclared request is refused before the client
   * is built. Every path to the Claude transport passes through here, so this is where it holds.
   */
  readonly disclosure?: ExternalAiDisclosureDeclaration;
  /** Injectable for tests only; defaults to the released three-authority gate. */
  readonly authorizeDisclosure?: AuthorizeExternalAiDisclosure;
  /** Injectable for tests only; defaults to the R2E Claude control's own fail-closed reader. */
  readonly resolveOperatorEnabled?: () => Promise<boolean>;
  /** APF-5. Injectable for tests only; defaults to the released audit writer. */
  readonly recordDisclosure?: RecordExternalAiDisclosureDecision;
}

export type HebyModelOutcome =
  | {
      readonly status: "unavailable";
      readonly state: Exclude<ModelAvailabilityState, "AVAILABLE">;
      /** The honest closed status for the UI. */
      readonly modelStatus: ModelAdapterStatus;
    }
  | {
      readonly status: "generated";
      readonly result: ModelGenerationResult;
    };

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Heby model generation is server-only.");
  }
}

function unavailable(
  state: Exclude<ModelAvailabilityState, "AVAILABLE">,
): HebyModelOutcome {
  // Non-AVAILABLE states always map to a concrete closed status.
  const modelStatus = unavailableStatusFor(state);
  if (!modelStatus) {
    // Unreachable: only AVAILABLE returns null. Fail closed defensively.
    throw new ModelConnectivityError("invalid-configuration");
  }
  return { status: "unavailable", state, modelStatus };
}

/**
 * Attempt a read-only model generation. Fail-closed at every gate. Returns a
 * validated `generated` result only when connectivity is AVAILABLE and the
 * injected transport succeeds and passes validation; otherwise an honest
 * `unavailable` outcome (never a fabricated answer).
 */
export async function generateHebyModelAnswer(
  request: ModelGenerationRequest,
  deps: HebyModelGenerationDeps = {},
): Promise<HebyModelOutcome> {
  assertServerRuntime();

  const config: ModelConnectivityConfig = resolveModelConnectivityConfig(
    deps.env ?? process.env,
  );
  const transportPresent = Boolean(deps.transport);
  const state = evaluateModelAvailability(config, { transportPresent });

  if (state !== "AVAILABLE") {
    return unavailable(state);
  }

  /*
   * B2 — NO DISCLOSURE WITHOUT ALL THREE AUTHORITIES. Whenever the transport is real Anthropic
   * egress, checked after the deployment could send at all and before the client exists, so a
   * refusal can never reach the network. A request whose tenant differs from the declaration's is
   * refused rather than trusted. A fake transport discloses nothing and is not gated.
   */
  /* ponytail: keyed on the live transport's egress mark; a wrapper that drops the mark would skip the gate — wrap inside the transport, never around it. */
  if (isAnthropicMessagesEgress(deps.transport)) {
    const declaration = deps.disclosure ?? null;
    const tenantMismatch =
      declaration !== null && request.tenantId !== undefined && request.tenantId !== declaration.tenantId;
    /*
     * APF-5 — THE MODEL CHECKED IS THE MODEL SENT. `config.modelId` was resolved once, above; the
     * gate is handed it, and `client.generate` below sends the same value. Nothing re-reads it.
     */
    const modelId = config.modelId!;
    const decision = tenantMismatch
      ? null
      : await (deps.authorizeDisclosure ?? ((d, o, m) => authorizeExternalAiDisclosure(d, o, m)))(
          declaration,
          await (deps.resolveOperatorEnabled ?? resolveClaudeDirectorEnabled)().catch(() => null),
          modelId,
        );
    /*
     * APF-5 — DECISION → EVIDENCE → TRANSPORT. The decision is recorded as the authority made it. An
     * authorized decision that cannot be recorded is not sent. A refusal stays a refusal whether or
     * not its record lands (best effort, as no act follows it).
     */
    const record = deps.recordDisclosure ?? ((e) => recordExternalAiDisclosureDecision(e));
    const evidence =
      decision && declaration ? externalAiDisclosureEvidence(declaration, decision, modelId, request.correlationId) : null;
    if (decision?.disposition !== "authorized" || !evidence) {
      if (evidence) await record(evidence).catch(() => false);
      return unavailable("DATA_USE_NOT_AUTHORIZED");
    }
    if (!(await record(evidence).catch(() => false))) {
      return unavailable("DATA_USE_NOT_AUTHORIZED");
    }
  }

  const client = createClaudeModelClient({
    provider: config.provider!,
    transport: deps.transport,
  });
  const result = await client.generate({
    ...request,
    // The model id is authoritative from server config, not from the request.
    modelId: config.modelId!,
    /*
     * R2G — THE BOUND IS A CEILING, NOT A SUGGESTION.
     *
     * A caller may ask for LESS than the deployment allows; it may never ask for more. Without
     * the `Math.min` a caller could pass a large `maxOutputTokens` and bypass the configured
     * bound entirely, leaving the live transport's own check as the only thing between a
     * request and real external spend. Two guards are correct here; one of them being the
     * last one before the wire is not.
     *
     * `|| config.maxOutputTokens` keeps the released meaning of 0/absent: "use the deployment's
     * bound". `answerHebyModelRequest` sends exactly that.
     */
    maxOutputTokens: Math.min(
      request.maxOutputTokens || config.maxOutputTokens,
      config.maxOutputTokens,
    ),
  });
  return { status: "generated", result };
}
