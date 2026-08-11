/*
 * heby-model/model-availability.ts — the authoritative connectivity evaluator.
 *
 * Deterministic and pure. It never performs I/O and never mutates. It classifies
 * connectivity into explicit states so the rest of the system can fail closed:
 *
 *   configured        ≠ connected
 *   credential-present ≠ authenticated
 *   transport-present  ≠ provider-reachable
 *   AVAILABLE          ≠ successful-call
 *
 * `AVAILABLE` only means "an attempt is permitted". It is never, on its own, a
 * claim that a provider is reachable or that a call would succeed.
 */

import type { ModelAvailabilityState } from "@/features/heby-runtime";
import type { ModelConnectivityConfig } from "./model-connectivity-environment.server";

export interface AvailabilityInputs {
  /** Whether a concrete transport has been injected. Presence is not reachability. */
  readonly transportPresent: boolean;
}

export function evaluateModelAvailability(
  config: ModelConnectivityConfig,
  inputs: AvailabilityInputs,
): ModelAvailabilityState {
  if (!config.enabled) return "DISABLED";
  if (!config.provider || !config.modelId || config.maxOutputTokens <= 0) {
    return "MISCONFIGURED";
  }
  if (!config.credentialPresent) return "CREDENTIAL_UNAVAILABLE";
  if (!inputs.transportPresent) return "TRANSPORT_UNAVAILABLE";
  return "AVAILABLE";
}
