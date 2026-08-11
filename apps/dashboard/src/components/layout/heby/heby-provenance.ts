/*
 * heby-provenance.ts — pure, human-readable provenance for the conversational surface (H1C).
 *
 * Truthful by construction: it distinguishes model-assisted (test vs live), deterministic, and
 * provider-disabled — and NEVER emits "connected"/"healthy" or any fabricated provider health.
 */

export type ProvenanceTone = "muted" | "warn" | "info";

export interface ProvenanceBadge {
  readonly label: string;
  readonly tone: ProvenanceTone;
}

/**
 * Provenance for a PERSISTED Heby (assistant) message, from its durable origin/transport. Works
 * for restored history too. Returns null for a user message (no badge).
 */
export function describeMessageProvenance(
  origin: string | null | undefined,
  transport: string | null | undefined,
): ProvenanceBadge | null {
  if (origin === "model") {
    return transport === "live"
      ? { label: "Model-assisted · live provider", tone: "info" }
      : { label: "Model-assisted · test transport (simulated)", tone: "warn" };
  }
  if (origin === "deterministic") {
    return { label: "Deterministic", tone: "muted" };
  }
  return null;
}

/**
 * Provenance for the CURRENT turn, derived from the runtime response — distinguishing
 * model-assisted, provider-disabled (Director OFF), and deterministic fallback. No provider
 * health is invented; a fake transport is never presented as a live Claude connection.
 */
export function deriveLatestProvenance(response: {
  readonly origin: string;
  readonly limitations: readonly string[];
  readonly modelAttribution?: { readonly transport: "fake" | "live" } | undefined;
}): ProvenanceBadge {
  if (response.origin === "model") {
    return response.modelAttribution?.transport === "live"
      ? { label: "Model-assisted · live provider", tone: "info" }
      : { label: "Model-assisted · test transport (simulated — not live Claude)", tone: "warn" };
  }
  const disabledByDirector = response.limitations.some((line) => /disabled by the Director/i.test(line));
  if (disabledByDirector) {
    return { label: "Provider disabled by Director — answered deterministically", tone: "muted" };
  }
  const unavailable = response.limitations.some((line) => /model generation is unavailable/i.test(line));
  if (unavailable) {
    return { label: "Provider unavailable — answered deterministically", tone: "muted" };
  }
  return { label: "Deterministic — model not used", tone: "muted" };
}

/**
 * Honest, workspace-aware conversation starters. They are prompt shortcuts ONLY — they imply no
 * monitoring, alerts, execution, or background agents. Each resolves against the current
 * workspace's read models when asked.
 */
export function buildConversationSuggestions(workspaceLabel: string): readonly string[] {
  const here = workspaceLabel ? workspaceLabel.toLowerCase() : "this workspace";
  return [
    `What should I pay attention to in ${here} right now?`,
    "Summarize the current picture.",
    "What evidence supports this view?",
  ];
}
