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
    /*
     * AGENT-PROPOSAL-4A. A deterministic row that carries a transport is a turn where a model WAS
     * asked and its answer was withheld — the provenance columns are written only from a real
     * generation result, so their presence is the durable proof. Saying only "Deterministic" here
     * would repeat the exact false impression this phase exists to remove.
     */
    return transport
      ? { label: "Deterministic · a model was attempted and its answer withheld", tone: "warn" }
      : { label: "Deterministic", tone: "muted" };
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
  readonly modelInvocationAttempted?: boolean | undefined;
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
  /*
   * AGENT-PROPOSAL-4A. Checked BEFORE the generic fallthrough, because that fallthrough is the
   * badge that was wrong: a withheld model answer landed here and was announced as "model not
   * used". The runtime states the attempt as its own fact rather than leaving the surface to infer
   * it from `origin`, which cannot carry it.
   */
  if (response.modelInvocationAttempted) {
    return { label: "Model attempted — answer withheld, answered deterministically", tone: "warn" };
  }
  return { label: "Deterministic — model not used", tone: "muted" };
}

/*
 * ── THE MODEL DIAGNOSTIC, SEPARATED SO IT CAN BE SHOWN ───────────────────────
 *
 * When a model answer is not produced, the runtime already writes the reason into
 * `response.limitations` — the state it was blocked at, or the typed connectivity code it failed
 * with. That text is the ONLY place those facts survive: nothing persists them, and the model
 * stack logs nothing by design.
 *
 * It was rendered inside a collapsed `<details>`, so an operator saw a badge and never the reason.
 * Two controlled production provider attempts were classified as "deterministic, model not used"
 * and the decisive line was on screen, unopened, then lost on navigation.
 *
 * This splits that line out so the surface can show it. It CLASSIFIES the released strings by
 * their own prefixes and never parses, translates or strengthens them: a code like
 * `provider-unavailable` is displayed exactly as the runtime wrote it, and is never rendered as a
 * claim about a provider having been reached, refused, or unreachable. The runtime owns the words;
 * this owns only where they appear.
 *
 * The Director-disabled note is deliberately NOT included: `deriveLatestProvenance` already states
 * that case in the badge, and the note carries no code the badge lacks. Only the three states that
 * currently fall through to the generic "model not used" badge are separated here.
 */
const MODEL_DIAGNOSTIC_PREFIXES: readonly string[] = Object.freeze([
  "Model generation is unavailable (",
  "Model generation failed (",
  "A model answer was produced but failed validation and was withheld",
]);

function isModelDiagnostic(line: string): boolean {
  return MODEL_DIAGNOSTIC_PREFIXES.some((prefix) => line.startsWith(prefix));
}

export interface SplitLimitations {
  /** Runtime model-generation diagnostics, verbatim. Shown without an expand. */
  readonly diagnostics: readonly string[];
  /** Everything else, which keeps its existing collapsed home. */
  readonly rest: readonly string[];
}

/**
 * Partition limitations into the model-generation diagnostic and the ordinary rest.
 *
 * Pure and total: every input line lands in exactly one bucket, so nothing is dropped and nothing
 * is shown twice. An empty diagnostics list means the runtime reported no model diagnostic — the
 * surface must then show none, rather than inventing one.
 */
export function splitModelDiagnostics(
  limitations: readonly string[],
): SplitLimitations {
  const diagnostics = limitations.filter(isModelDiagnostic);
  const rest = limitations.filter((line) => !isModelDiagnostic(line));
  return { diagnostics, rest };
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
