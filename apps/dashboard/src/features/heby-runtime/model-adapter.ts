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

import type { ModelAdapterStatus } from "./contracts";

const UNAVAILABLE: ModelAdapterStatus = Object.freeze({
  available: false,
  reason: "no-provider-configured",
  detail:
    "No model runtime is connected. Every provider in this build is simulation-only (no SDK, no network, no credentials), so Heby generates no prose. Deterministic, evidence-grounded answers are still produced from real read models; generative answers are honestly unavailable.",
});

/**
 * The honest model status. Deterministic and side-effect-free. Never returns available:true
 * in Phase 16 — there is nothing real to connect to.
 */
export function getModelAdapterStatus(): ModelAdapterStatus {
  return UNAVAILABLE;
}

/** Whether a live, authorized model runtime is connected. Always false in Phase 16. */
export function isModelAvailable(): boolean {
  return getModelAdapterStatus().available;
}
