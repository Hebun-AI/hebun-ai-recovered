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
import { isAnthropicMessagesEgress, prepayLiveDispatch } from "@/features/heby-model-live/claude-http-transport.server";
import { liveBudgetExhaustedError } from "@/features/heby-model-live/live-spend-budget.server";
import { admitAiDispatch, type AdmitAiDispatch } from "@/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { isHebunInstruction } from "@/features/heby-runtime/instruction-channel";
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
  /** AP-3. Injectable for tests only; defaults to the persistent tenant AI dispatch safety cap. */
  readonly admitDispatch?: AdmitAiDispatch;
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
    /*
     * SCI-1 — INSTRUCTION AUTHORITY IS HEBUN'S ALONE. The instruction channel must be exactly a value
     * Hebun minted (`instruction-channel.ts`), checked by identity before EAI is even asked: data that
     * EAI would authorize for disclosure is still not authorized as instruction. A fake transport
     * sends nothing and is not gated, exactly as the disclosure gate below.
     */
    if (!isHebunInstruction(request.systemInstructions)) {
      return unavailable("INSTRUCTION_CHANNEL_REFUSED");
    }
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
    /*
     * AP-3 — DECISION → CAP + PROCESS BUDGET → EVIDENCE → TRANSPORT, as ONE admission.
     *
     * The persistent tenant cap counts authorized evidence, so the evidence row IS the charge. It is
     * written inside the cap's locked transaction, only after the cap admits AND this transport's
     * process-budget unit is granted (`prepayLiveDispatch` takes the unit now; the send then uses it
     * instead of taking a second). Cap reached ⇒ budget untouched, no evidence, refusal audited.
     * Budget exhausted ⇒ no evidence, cap not charged, the same error the transport always raised.
     */
    const admission = await (deps.admitDispatch ?? admitAiDispatch)({
      tenantId: evidence.tenantId,
      dispatchClass: "model",
      actorUserId: evidence.actorUserId,
      correlationId: evidence.correlationId,
      prepay: () => prepayLiveDispatch(deps.transport),
      commit: async (db) => {
        if (!(await record(evidence, { getDb: () => db }).catch(() => false))) {
          throw new Error("The disclosure evidence could not be recorded.");
        }
      },
    }, { env: deps.env });
    if (admission.status === "refused") {
      if (admission.reason === "dispatch-safety-cap-reached") return unavailable("DISPATCH_SAFETY_CAP_REACHED");
      if (admission.reason === "process-budget-exhausted") throw liveBudgetExhaustedError();
      /* The authorized decision could not be recorded: not sent, exactly as APF-5 released. */
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
