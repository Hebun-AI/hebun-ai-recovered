/*
 * heby-runtime/response-builder.ts — deterministic response composition (UI Phase 16).
 *
 * Builds a typed, bounded response from REAL resolved sources — no model, no fabrication.
 * Intents that can be answered deterministically from real derived data (EXPLAIN, SUMMARIZE,
 * TRACE_EVIDENCE, ASSESS_UNCERTAINTY, INVESTIGATE over system state) produce grounded
 * responses with evidence and provenance. Intents that genuinely need generative reasoning
 * (COMPARE, PREPARE_RECOMMENDATION, PREPARE_REVIEW) return an honest UNAVAILABLE, because no
 * model runtime is connected. Every body line is a real, machine-derived statement or static
 * explanatory copy — never invented prose.
 */

import type {
  HebyAuthorityMode,
  HebyProductIntent,
  HebyProvenanceFacet,
  HebyUncertaintyState,
} from "@/features/heby-integration";
import type { HebyRuntimeContext, HebyRuntimeResponse, SourceResolution } from "./contracts";
import { assembleEvidence, assembleProvenance } from "./evidence-assembler";

const COVERED_FACETS: readonly HebyProvenanceFacet[] = [
  "what-was-found",
  "where-it-came-from",
  "how-authoritative",
  "what-remains-uncertain",
];

const MODEL_LIMITATION =
  "No model runtime is connected, so no generated prose is produced; this answer is assembled deterministically from real read models.";

function unavailable(
  kind: HebyRuntimeResponse["kind"],
  title: string,
  reason: string,
  authority: HebyAuthorityMode,
): HebyRuntimeResponse {
  return {
    kind: "UNAVAILABLE",
    origin: "deterministic",
    title,
    body: [reason],
    evidence: [],
    provenance: [],
    provenanceCovered: [],
    uncertainty: "unavailable",
    limitations: [MODEL_LIMITATION],
    authority,
    modelUsed: false,
  };
}

function resolvedItemLines(resolutions: readonly SourceResolution[]): string[] {
  const lines: string[] = [];
  for (const resolution of resolutions) {
    if (resolution.state !== "resolved") continue;
    for (const item of resolution.items) {
      lines.push(`${item.label} — ${item.detail}`);
    }
  }
  return lines;
}

function anyResolved(resolutions: readonly SourceResolution[]): boolean {
  return resolutions.some((r) => r.state === "resolved");
}

/** Uncertainty derived from source coverage. Ordinal — never a fabricated score. */
function uncertaintyFrom(resolutions: readonly SourceResolution[]): HebyUncertaintyState {
  const resolved = resolutions.filter((r) => r.state === "resolved");
  if (resolved.length === 0) return "unavailable";
  // Real derived data exists but is explicitly non-authoritative → "supported", not "known".
  const anyAuthoritative = resolved.some((r) => r.authoritative);
  return anyAuthoritative ? "known" : "supported";
}

export function buildResponse(
  intent: HebyProductIntent,
  context: HebyRuntimeContext,
  resolutions: readonly SourceResolution[],
): HebyRuntimeResponse {
  const authority: HebyAuthorityMode =
    context.workspace === "decisions"
      ? "human-review-required"
      : context.workspace === "governance" || context.workspace === "platform"
        ? "restricted"
        : "advisory-only";

  const evidence = assembleEvidence(resolutions);
  const provenance = assembleProvenance(resolutions);
  const unavailableReasons = resolutions
    .filter((r) => r.state !== "resolved" && r.unavailableReason)
    .map((r) => `${r.sourceClass}: ${r.unavailableReason}`);

  switch (intent) {
    case "EXPLAIN":
    case "INVESTIGATE": {
      if (!anyResolved(resolutions)) {
        return {
          kind: "EXPLANATION",
          origin: "deterministic",
          title: `${context.workspace} — structural explanation`,
          body: [
            `Heby is ${authority.replace(/-/g, " ")} here.`,
            "No connected source backs this workspace yet, so no live findings are shown.",
            ...unavailableReasons,
          ],
          evidence: [],
          provenance: [],
          provenanceCovered: ["what-remains-uncertain"],
          uncertainty: "unavailable",
          limitations: [MODEL_LIMITATION, "No source is connected for this workspace."],
          authority,
          modelUsed: false,
        };
      }
      return {
        kind: "EXPLANATION",
        origin: "deterministic",
        title: `${context.workspace} — system state`,
        body: [
          "Derived from real, non-authoritative system read models:",
          ...resolvedItemLines(resolutions),
        ],
        evidence,
        provenance,
        provenanceCovered: COVERED_FACETS,
        uncertainty: uncertaintyFrom(resolutions),
        limitations: [MODEL_LIMITATION, "System state is derived and non-authoritative."],
        authority,
        modelUsed: false,
      };
    }

    case "SUMMARIZE": {
      if (!anyResolved(resolutions)) {
        return unavailable("SUMMARY", "Nothing to summarize", "No connected source backs this workspace.", authority);
      }
      const items = resolutions.flatMap((r) => (r.state === "resolved" ? r.items : []));
      const criticalish = items.filter((i) => /critical|CRITICAL/.test(i.detail)).length;
      return {
        kind: "SUMMARY",
        origin: "deterministic",
        title: `${context.workspace} — summary`,
        body: [
          `${items.length} section${items.length === 1 ? "" : "s"} read; ${criticalish} reporting a critical state.`,
        ],
        evidence,
        provenance,
        provenanceCovered: COVERED_FACETS,
        uncertainty: uncertaintyFrom(resolutions),
        limitations: [MODEL_LIMITATION, "Counts are derived from a non-authoritative read model."],
        authority,
        modelUsed: false,
      };
    }

    case "TRACE_EVIDENCE": {
      return {
        kind: "EVIDENCE_TRACE",
        origin: "deterministic",
        title: `${context.workspace} — evidence trace`,
        body:
          evidence.length > 0
            ? [`${evidence.length} evidence reference${evidence.length === 1 ? "" : "s"} from connected sources:`, ...evidence.map((e) => `${e.sourceClass} · ${e.recordRef}`)]
            : ["No evidence is connected for this workspace.", ...unavailableReasons],
        evidence,
        provenance,
        provenanceCovered: evidence.length > 0 ? COVERED_FACETS : ["what-remains-uncertain"],
        uncertainty: uncertaintyFrom(resolutions),
        limitations: ["Evidence identity comes only from the retrieval layer; none is invented."],
        authority,
        modelUsed: false,
      };
    }

    case "ASSESS_UNCERTAINTY": {
      const resolved = resolutions.filter((r) => r.state === "resolved").length;
      const total = resolutions.length;
      return {
        kind: "UNCERTAINTY_ASSESSMENT",
        origin: "deterministic",
        title: `${context.workspace} — uncertainty`,
        body: [
          `${resolved} of ${total} relevant source${total === 1 ? "" : "s"} connected.`,
          ...(resolved === 0 ? ["Nothing here is currently known to Heby."] : ["Connected sources are derived and non-authoritative."]),
          ...unavailableReasons,
        ],
        evidence,
        provenance,
        provenanceCovered: COVERED_FACETS,
        uncertainty: uncertaintyFrom(resolutions),
        limitations: ["Uncertainty is ordinal, not a score."],
        authority,
        modelUsed: false,
      };
    }

    case "COMPARE":
      return unavailable("UNAVAILABLE", "Comparison needs a model", "Comparing options requires generative reasoning, and no model runtime is connected.", authority);
    case "PREPARE_RECOMMENDATION":
      return unavailable("ADVISORY_RECOMMENDATION", "Recommendation needs a model", "An advisory recommendation requires generative reasoning over connected sources; no model runtime is connected. No recommendation is fabricated.", authority);
    case "PREPARE_REVIEW":
      return unavailable("REVIEW_PREPARATION", "Review preparation needs sources", "Preparing human-review material requires connected sources and/or a model runtime; neither is available. No review content is fabricated.", authority);
    default: {
      const never: never = intent;
      return never;
    }
  }
}
