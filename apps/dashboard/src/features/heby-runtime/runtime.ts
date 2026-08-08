/*
 * heby-runtime/runtime.ts — the Heby runtime orchestrator (UI Phase 16).
 *
 * Path: request → workspace context → intent → source resolution → evidence assembly →
 * deterministic response build → response validation → outcome. Navigation is a gated
 * READ_ONLY tool, not an intent. No model is invoked (none exists); the model status is
 * reported honestly on every outcome. Pure and deterministic — safe to run server-side or,
 * because it reads only non-authoritative derived state and holds no secret, in the client
 * panel. It never writes memory, records a decision, executes anything, or self-escalates.
 */

import {
  resolveHebyWorkspaceContext,
  type HebyProductIntent,
  type HebySourceClass,
} from "@/features/heby-integration";
import type {
  HebyRuntimeContext,
  HebyRuntimeOutcome,
  HebyRuntimeResponse,
} from "./contracts";
import { getModelAdapterStatus } from "./model-adapter";
import { resolveSources } from "./source-resolver";
import { assembleEvidence } from "./evidence-assembler";
import { buildResponse } from "./response-builder";
import { validateResponse } from "./response-validator";
import { invokeTool } from "./tool-gate";
import { NAVIGATE_TOOL_ID } from "./tool-registry";

/** The source classes relevant to a workspace, from the Phase 15 registry. */
function workspaceSourceClasses(context: HebyRuntimeContext): readonly HebySourceClass[] {
  const resolved = resolveHebyWorkspaceContext({ workspace: context.workspace, route: context.route });
  return resolved.sources.map((source) => source.sourceClass as HebySourceClass);
}

function expectedAuthority(context: HebyRuntimeContext): HebyRuntimeResponse["authority"] {
  if (context.workspace === "decisions") return "human-review-required";
  if (context.workspace === "governance" || context.workspace === "platform") return "restricted";
  return "advisory-only";
}

/**
 * Run one of the eight Phase 15 product intents deterministically. Returns a validated,
 * evidence-grounded response, or an honest UNAVAILABLE when the intent needs a model or no
 * source is connected.
 */
export function runHebyIntent(
  intent: HebyProductIntent,
  context: HebyRuntimeContext,
): HebyRuntimeOutcome {
  const sourceClasses = workspaceSourceClasses(context);
  const resolutions = resolveSources(sourceClasses, context.overview);
  const built = buildResponse(intent, context, resolutions);
  const validation = validateResponse(built, assembleEvidence(resolutions), expectedAuthority(context));
  return { intent, response: validation.response, model: getModelAdapterStatus() };
}

/**
 * Resolve an in-app navigation target through the gated READ_ONLY navigate tool. Returns a
 * NAVIGATION response carrying a real route the human may follow — never auto-followed, and
 * never a fabricated route.
 */
export function runNavigation(query: string, context: HebyRuntimeContext): HebyRuntimeOutcome {
  const authority = expectedAuthority(context);
  const result = invokeTool({ toolId: NAVIGATE_TOOL_ID, query });

  const response: HebyRuntimeResponse = {
    kind: "NAVIGATION",
    origin: "deterministic",
    title: "Navigation",
    body: [result.summary],
    evidence: [],
    provenance: result.provenance,
    provenanceCovered: ["where-it-came-from"],
    uncertainty: result.state === "SUCCESS" ? "known" : "unavailable",
    limitations: ["Heby resolves the route; it does not navigate for you.", "In-app routes only."],
    authority,
    navigationTarget: result.navigationTarget,
    modelUsed: false,
  };

  // NAVIGATION carries no evidence, so the validator sees an empty assembled set.
  const validation = validateResponse(response, [], authority);
  return { intent: "NAVIGATE", response: validation.response, model: getModelAdapterStatus() };
}
