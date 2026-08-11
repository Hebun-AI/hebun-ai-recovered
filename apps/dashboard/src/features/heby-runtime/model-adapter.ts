/*
 * heby-runtime/model-adapter.ts — the model/reasoning boundary (UI Phase 16).
 *
 * Discovery proved this repository has NO real model provider: every provider surface is
 * explicitly "simulation only — no SDK, no network, no credentials, no live inference",
 * there are no model environment keys, and there is no network call anywhere in src. So
 * this adapter reports UNAVAILABLE honestly and calls nothing. It is the single seam a
 * future, separately-authorized, server-side live runtime would replace — at which point
 * model output would still be treated as untrusted and validated before display.
 *
 * This module imports no provider SDK, makes no network request, reads no credential, and
 * exposes no secret.
 */

import type { ModelAdapterStatus, ModelAvailabilityState } from "./contracts";

const UNAVAILABLE: ModelAdapterStatus = Object.freeze({
  available: false,
  reason: "no-provider-configured",
  detail:
    "No model runtime is connected. Every provider in this build is simulation-only (no SDK, no network, no credentials), so Heby generates no prose. Deterministic, evidence-grounded answers are still produced from real read models; generative answers are honestly unavailable.",
});

/**
 * The honest model status. Deterministic and side-effect-free. Returns the frozen
 * UNAVAILABLE status by default — the model boundary is closed unless a separate,
 * server-only connectivity layer proves otherwise for a specific request. This
 * function never reaches out and never returns available:true on its own.
 */
export function getModelAdapterStatus(): ModelAdapterStatus {
  return UNAVAILABLE;
}

/** Whether a live, authorized model runtime is connected. False by default. */
export function isModelAvailable(): boolean {
  return getModelAdapterStatus().available;
}

/**
 * Map a connectivity classification to the honest closed status the UI shows when
 * generation cannot be attempted. Pure — it reads no environment and holds no
 * secret. `AVAILABLE` returns `null`: there is no unavailability to report, and an
 * "available" status is never a claim of a successful call — only the validated
 * result of an actual attempt may be surfaced. The server-only connectivity layer
 * computes the state; this keeps the reason mapping in the model boundary it
 * belongs to.
 */
export function unavailableStatusFor(
  state: ModelAvailabilityState,
): ModelAdapterStatus | null {
  switch (state) {
    case "DISABLED":
      return Object.freeze({
        available: false,
        reason: "no-provider-configured",
        detail:
          "Model connectivity is disabled. Heby answers deterministically from real read models only.",
      });
    case "MISCONFIGURED":
      return Object.freeze({
        available: false,
        reason: "no-provider-configured",
        detail:
          "Model connectivity is enabled but its configuration is incomplete. Nothing is connected.",
      });
    case "CREDENTIAL_UNAVAILABLE":
      return Object.freeze({
        available: false,
        reason: "no-credentials",
        detail:
          "No model credential is available server-side, so no request can be attempted.",
      });
    case "TRANSPORT_UNAVAILABLE":
      return Object.freeze({
        available: false,
        reason: "provider-unavailable",
        detail:
          "No live model transport is configured, so the model boundary remains closed.",
      });
    case "AVAILABLE":
      return null;
  }
}
