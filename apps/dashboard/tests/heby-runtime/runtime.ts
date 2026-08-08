import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HEBY_PRODUCT_INTENTS } from "../../src/features/heby-integration/contracts";
import {
  getModelAdapterStatus,
  isModelAvailable,
} from "../../src/features/heby-runtime/model-adapter";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import {
  assembleEvidence,
  isSupportedEvidence,
} from "../../src/features/heby-runtime/evidence-assembler";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import { resolveNavigation } from "../../src/features/heby-runtime/navigate-tool";
import {
  invokableTools,
  listTools,
  NAVIGATE_TOOL_ID,
  INSPECT_SYSTEM_STATE_TOOL_ID,
} from "../../src/features/heby-runtime/tool-registry";
import { invokeTool } from "../../src/features/heby-runtime/tool-gate";
import { runHebyIntent, runNavigation } from "../../src/features/heby-runtime/runtime";
import type {
  ExecutiveOverviewLike,
  HebyRuntimeContext,
} from "../../src/features/heby-runtime/contracts";

const OVERVIEW: ExecutiveOverviewLike = {
  organizationHealth: "critical",
  criticalAlertCount: 2,
  warningCount: 0,
  unavailableCount: 0,
  freshness: { state: "fresh", ageSeconds: 0 },
  sections: [
    { sectionId: "active-agents", label: "Active Agents", health: "critical", sourceState: "ready", recordCount: 36, reasonCode: "SECTION_CRITICAL" },
    { sectionId: "platform-status", label: "Platform", health: "healthy", sourceState: "ready", recordCount: 1, reasonCode: "SECTION_HEALTHY" },
  ],
  authoritative: false,
};

const OPS_CTX: HebyRuntimeContext = { workspace: "operations", route: "/operations", overview: OVERVIEW };
const KNOW_CTX: HebyRuntimeContext = { workspace: "knowledge", route: "/knowledge" };

/* --- Model boundary is honestly unavailable ----------------------------------------- */
function modelUnavailable(): void {
  assert.equal(isModelAvailable(), false);
  assert.equal(getModelAdapterStatus().available, false);
  assert.equal(getModelAdapterStatus().reason, "no-provider-configured");
}

/* --- Every intent produces a typed response; none throws ---------------------------- */
function allIntentsProduceTypedResponses(): void {
  for (const intent of HEBY_PRODUCT_INTENTS) {
    const outcome = runHebyIntent(intent, OPS_CTX);
    assert.ok(outcome.response.title.length > 0, `${intent} has a title`);
    assert.ok(outcome.response.body.length > 0, `${intent} has a body`);
    assert.equal(outcome.response.modelUsed, false, `${intent} used no model`);
    assert.equal(outcome.model.available, false);
  }
}

/* --- Source resolution: overview-backed vs honest unavailable ----------------------- */
function sourceResolution(): void {
  const ops = resolveSource("operations", OVERVIEW);
  assert.equal(ops.state, "resolved");
  assert.equal(ops.authoritative, false, "Executive Overview is non-authoritative");
  assert.ok(ops.items.length >= 1);
  const opsNoOverview = resolveSource("operations");
  assert.equal(opsNoOverview.state, "unavailable");
  // Non-overview classes are always unavailable — seeded data is never organizational truth.
  for (const cls of ["knowledge", "memory", "intelligence", "workforce", "governance", "decision-records"] as const) {
    assert.equal(resolveSource(cls, OVERVIEW).state, "unavailable", `${cls} unavailable`);
  }
}

/* --- Evidence identity comes only from retrieval ------------------------------------ */
function evidenceBinding(): void {
  const ops = resolveSource("operations", OVERVIEW);
  const evidence = assembleEvidence([ops]);
  assert.ok(evidence.length >= 1);
  assert.equal(evidence[0].sourceClass, "operations");
  // A reference not in the assembled set is unsupported.
  assert.equal(
    isSupportedEvidence({ sourceClass: "governance", recordRef: "policy-17", lifecycle: "unknown" }, evidence),
    false,
  );
}

/* --- Real, evidence-grounded response for a backed workspace ------------------------ */
function realGroundedResponse(): void {
  const outcome = runHebyIntent("EXPLAIN", OPS_CTX);
  assert.equal(outcome.response.origin, "deterministic");
  assert.ok(outcome.response.evidence.length >= 1, "operations EXPLAIN carries real evidence");
  assert.ok(
    outcome.response.provenance.some((p) => /Executive Overview/.test(p)),
    "provenance names the Executive Overview",
  );
  assert.notEqual(outcome.response.uncertainty, "known", "non-authoritative → not 'known'");
}

/* --- Honest unavailable where no source is connected -------------------------------- */
function honestUnavailable(): void {
  const outcome = runHebyIntent("EXPLAIN", KNOW_CTX);
  assert.equal(outcome.response.evidence.length, 0, "no fabricated evidence for Knowledge");
  assert.equal(outcome.response.uncertainty, "unavailable");
  const compare = runHebyIntent("COMPARE", OPS_CTX);
  assert.equal(compare.response.kind, "UNAVAILABLE", "COMPARE needs a model → unavailable");
  const rec = runHebyIntent("PREPARE_RECOMMENDATION", OPS_CTX);
  assert.equal(rec.response.kind, "UNAVAILABLE", "no fabricated recommendation");
}

/* --- Response validation fails closed ---------------------------------------------- */
function responseValidationFailsClosed(): void {
  const base = buildResponse("EXPLAIN", OPS_CTX, [resolveSource("operations", OVERVIEW)]);
  // Authority mismatch → withheld.
  const mismatch = validateResponse(base, base.evidence, "human-review-required");
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.response.kind, "UNAVAILABLE");
  // Unsupported evidence → withheld.
  const tampered = { ...base, evidence: [{ sourceClass: "governance" as const, recordRef: "ghost", lifecycle: "unknown" as const }] };
  assert.equal(validateResponse(tampered, base.evidence, base.authority).valid, false);
  // Fabricated action claim → withheld.
  const acted = { ...base, body: ["The deploy was executed."] };
  assert.equal(validateResponse(acted, base.evidence, base.authority).valid, false);
  // Malformed (empty body) → withheld.
  const empty = { ...base, body: [] as string[] };
  assert.equal(validateResponse(empty, base.evidence, base.authority).valid, false);
  // A valid deterministic response passes.
  assert.equal(validateResponse(base, base.evidence, base.authority).valid, true);
}

/* --- Authority preserved per workspace --------------------------------------------- */
function authorityPreserved(): void {
  assert.equal(runHebyIntent("EXPLAIN", OPS_CTX).response.authority, "advisory-only");
  assert.equal(runHebyIntent("EXPLAIN", { workspace: "governance", route: "/governance" }).response.authority, "restricted");
  assert.equal(runHebyIntent("EXPLAIN", { workspace: "platform", route: "/platform" }).response.authority, "restricted");
  assert.equal(runHebyIntent("EXPLAIN", { workspace: "decisions", route: "/approvals" }).response.authority, "human-review-required");
}

/* --- Navigation tool: real routes only --------------------------------------------- */
function navigationRealRoutesOnly(): void {
  const gov = resolveNavigation("governance");
  assert.equal(gov.found, true);
  assert.equal(gov.target?.route, "/governance");
  const nothing = resolveNavigation("zzq-not-a-place");
  assert.equal(nothing.found, false);
  assert.equal(nothing.target, undefined);
  const blank = resolveNavigation("   ");
  assert.equal(blank.found, false);
  // Runtime navigation response carries the real route, never auto-followed.
  const outcome = runNavigation("operations", OPS_CTX);
  assert.equal(outcome.response.kind, "NAVIGATION");
  assert.equal(outcome.response.navigationTarget?.route, "/operations");
  assert.equal(outcome.response.modelUsed, false);
}

/* --- Tool registry + gate: only READ_ONLY invokable, no fake success ---------------- */
function toolGate(): void {
  // Only READ_ONLY tools are invokable.
  for (const tool of invokableTools()) assert.equal(tool.sideEffect, "READ_ONLY");
  // The reserved device tool exists but is not invokable and never runs.
  const device = listTools().find((t) => t.sideEffect === "DEVICE_ACTION");
  assert.ok(device, "device boundary declared");
  assert.equal(device!.available, false);
  const deviceResult = invokeTool({ toolId: device!.toolId });
  assert.equal(deviceResult.state, "RESTRICTED");
  assert.equal(deviceResult.sideEffectOccurred, false);
  // Navigate tool success carries a real route and no side effect.
  const nav = invokeTool({ toolId: NAVIGATE_TOOL_ID, query: "platform" });
  assert.equal(nav.state, "SUCCESS");
  assert.equal(nav.sideEffectOccurred, false);
  assert.equal(nav.navigationTarget?.route, "/platform");
  // Inspect-state tool reads real derived sections; no side effect.
  const inspect = invokeTool({ toolId: INSPECT_SYSTEM_STATE_TOOL_ID, overview: OVERVIEW });
  assert.equal(inspect.state, "SUCCESS");
  assert.equal(inspect.sideEffectOccurred, false);
  assert.ok(inspect.evidence.length >= 1);
  // Unknown tool fails, does nothing.
  assert.equal(invokeTool({ toolId: "heby.unknown" }).state, "FAILED");
}

/* --- No side-effecting coupling anywhere in the runtime ----------------------------- */
function noUnsafeCoupling(): void {
  const dir = "src/features/heby-runtime";
  const forbidden = [
    "openai", "anthropic", "gemini", "generativeai", "mistral", "cohere", "ollama",
    "provider-routing", "fetch(", "xmlhttprequest", "websocket", "child_process",
    "execsync", "spawn(", "eval(", "process.env", "fs.readfile", "fs.writefile",
    "navigator.mediadevices", "getusermedia",
  ];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(join(dir, file), "utf8").toLowerCase();
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference "${token}"`);
    }
  }
}

modelUnavailable();
allIntentsProduceTypedResponses();
sourceResolution();
evidenceBinding();
realGroundedResponse();
honestUnavailable();
responseValidationFailsClosed();
authorityPreserved();
navigationRealRoutesOnly();
toolGate();
noUnsafeCoupling();

console.log("heby-runtime checks passed");
