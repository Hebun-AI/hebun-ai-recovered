/*
 * heby-model/model-transport-selection.server.ts — the explicit, fail-closed choice of WHICH
 * transport IMPLEMENTATION a Heby model request may use (R2C; single-authority since H1D).
 *
 * This selects the transport MODE only. It is NOT operational authorization to call a provider.
 *
 *   HEBUN_MODEL_TRANSPORT=fake  → the local PROOF transport (simulation), provenance "fake".
 *   HEBUN_MODEL_TRANSPORT=live  → the REAL Claude transport, provenance "live" — selected when a
 *                                 credential is present to construct it. Constructing it performs
 *                                 NO I/O; only a subsequent `send()` would call out.
 *   anything else / unset       → NO transport (fail-closed default).
 *
 * SINGLE OPERATIONAL AUTHORITY: whether Hebun may actually dispatch a request is decided ONLY by
 * the durable R2E Director connectivity control, read fail-closed BEFORE dispatch in
 * `answerHebyModelRequest`. The former `HEBUN_MODEL_LIVE_CALL_AUTHORIZED` env gate (an R2D-era
 * one-shot smoke-test permission) has been RETIRED — it no longer participates in selection or
 * authorization, so a forgotten env flag can never silently block or permit the product.
 */

import type { ClaudeTransport } from "./claude-transport";
import { createDevProofTransport } from "./dev-proof-transport.server";
import {
  createLiveClaudeTransport,
  isLiveCredentialPresent,
  ANTHROPIC_API_KEY_ENV,
} from "@/features/heby-model-live/claude-http-transport.server";

export const MODEL_TRANSPORT_ENV_KEY = "HEBUN_MODEL_TRANSPORT";

export interface ModelTransportSelection {
  /** Absent = closed. Present only for an explicit proof (`fake`) or a configured live path. */
  readonly transport?: ClaudeTransport;
  /** Truthful transport provenance, present only when a transport is returned. */
  readonly transportProvenance?: "fake" | "live";
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Model transport selection is server-only.");
  }
}

/**
 * Resolve the transport IMPLEMENTATION for this process from deployment config. Fail-closed: the
 * `fake` flag returns the simulated transport; `live` returns the REAL transport when a credential
 * is present to build it; everything else returns NO transport. Selecting the live transport is
 * NOT authorization to call the provider — the durable R2E Director control gates dispatch.
 */
export function selectModelTransport(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ModelTransportSelection {
  assertServerRuntime();
  const mode = env[MODEL_TRANSPORT_ENV_KEY]?.trim();
  if (mode === "fake") {
    return { transport: createDevProofTransport(), transportProvenance: "fake" };
  }
  if (mode === "live" && isLiveCredentialPresent(env)) {
    // Live transport is SELECTED (deployment mode + a credential to construct it). This is not
    // authorization: the R2E Director control decides whether a request may actually be dispatched.
    return {
      transport: createLiveClaudeTransport({ apiKey: env[ANTHROPIC_API_KEY_ENV]!.trim() }),
      transportProvenance: "live",
    };
  }
  // `live` without a credential, unset, or any other value: closed.
  return {};
}
