/*
 * heby-provider-ops/provider-connectivity-projection.server.ts — the truthful, secret-free
 * read model for Platform → Providers → Anthropic / Claude.
 *
 * It keeps the operational states DISTINCT and never collapses them into one boolean:
 *   directorEnabled  — the Director's durable permission (this phase's control)
 *   configuration    — whether server config supplies a provider + model + output bound
 *   credential       — PRESENCE only of the live API key; never the value
 *   transport        — which transport the current config would select (live/fake/unavailable)
 *   connectivity     — "not-recorded": R2E performs NO live check, so it invents no health
 *   lastValidation   — null: no authoritative last-validation record exists yet
 *
 * "Director enabled" ≠ "configured" ≠ "credential present" ≠ "connected" ≠ "last request ok".
 * The view carries no API key, no partial key, no health %, no cost, and no latency.
 *
 * Server-only. Reads are pure/inert (constructing a transport performs no I/O).
 */
import {
  resolveModelConnectivityConfig,
  type ModelConnectivityConfig,
} from "@/features/heby-model/model-connectivity-environment.server";
import {
  selectModelTransport,
  type ModelTransportSelection,
} from "@/features/heby-model/model-transport-selection.server";
import { isLiveCredentialPresent } from "@/features/heby-model-live/claude-http-transport.server";
import {
  CLAUDE_PROVIDER_KEY,
  resolveClaudeDirectorEnabled,
} from "./provider-connectivity-control.server";

export interface ProviderOpsView {
  readonly providerLabel: string;
  readonly providerKey: string;
  /** The Director's durable permission. */
  readonly directorEnabled: boolean;
  readonly directorControl: "enabled" | "disabled";
  /** Whether server config supplies provider + model id + a positive output bound. */
  readonly configuration: "configured" | "needs-configuration";
  /** PRESENCE only of the live API key — never the value. */
  readonly credential: "present" | "missing";
  /** The configured model id (non-secret), or null. */
  readonly model: string | null;
  /** Which transport the current configuration would select. */
  readonly transport: "live" | "fake" | "unavailable";
  /** R2E performs no live check, so connectivity health is never invented. */
  readonly connectivity: "not-recorded";
  /** No authoritative last-validation record exists yet. */
  readonly lastValidation: null;
}

export interface ProviderOpsViewDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly resolveDirectorEnabled?: () => Promise<boolean>;
  readonly readConfig?: (env: Readonly<Record<string, string | undefined>>) => ModelConnectivityConfig;
  readonly selectTransport?: (env: Readonly<Record<string, string | undefined>>) => ModelTransportSelection;
  readonly isCredentialPresent?: (env: Readonly<Record<string, string | undefined>>) => boolean;
}

/**
 * Build the truthful provider-ops view. Every field is derived from an authoritative source
 * (durable control, server env config, transport selector) — none is fabricated, and no secret
 * value ever enters the view.
 */
export async function readProviderOpsView(
  deps: ProviderOpsViewDeps = {},
): Promise<ProviderOpsView> {
  const env = deps.env ?? process.env;
  const directorEnabled = await (deps.resolveDirectorEnabled ?? resolveClaudeDirectorEnabled)();
  const config = (deps.readConfig ?? resolveModelConnectivityConfig)(env);
  const selection = (deps.selectTransport ?? selectModelTransport)(env);
  const credentialPresent = (deps.isCredentialPresent ?? isLiveCredentialPresent)(env);
  const configured = Boolean(config.provider && config.modelId && config.maxOutputTokens > 0);

  return {
    providerLabel: "Anthropic / Claude",
    providerKey: CLAUDE_PROVIDER_KEY,
    directorEnabled,
    directorControl: directorEnabled ? "enabled" : "disabled",
    configuration: configured ? "configured" : "needs-configuration",
    credential: credentialPresent ? "present" : "missing",
    model: config.modelId ?? null,
    transport: selection.transportProvenance ?? "unavailable",
    connectivity: "not-recorded",
    lastValidation: null,
  };
}
