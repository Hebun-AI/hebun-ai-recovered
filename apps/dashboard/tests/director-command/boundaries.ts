import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as directorCommand from "../../src/features/director-command";
import { createDefaultCommandRegistry } from "../../src/features/director-command";

const FEATURE_DIR = "src/features/director-command";
const sources = readdirSync(FEATURE_DIR)
  .filter((name) => name.endsWith(".ts"))
  .map((name) => ({ name, text: readFileSync(join(FEATURE_DIR, name), "utf8") }));

/** No runtime, memory, storage, provider, or observability access. */
function reachesNoAuthority(): void {
  const forbidden = [
    "../runtime-projection", "../runtime-observability", "../runtime-boundary", "../runtime-activation",
    "../organization-runtime", "../agent-runtime", "../workflow-runtime", "../execution",
    "../memory", "../memory-engine", "../memory-crud", "../memory-runtime",
    "../persistence", "../observability", "../monitoring", "../diagnostics-read-models",
    "../evaluation", "../auth", "../providers", "../provider-invocation", "../orchestration",
    "../commands", "@/db", "drizzle-orm", "pg", "postgres", "node:fs", "node:child_process",
  ];
  assert.equal(sources.length > 0, true);
  for (const { name, text } of sources) {
    for (const specifier of forbidden) {
      assert.equal(text.includes(`"${specifier}`), false, `${name} must not import ${specifier}`);
    }
  }
}

/** The only outward dependency is the dashboard's navigable section list. */
function importsOnlyNavigationIdentifiers(): void {
  const outward = sources.flatMap(({ text }) => [...text.matchAll(/from "(\.\.\/[^"]+)"/g)].map((match) => match[1]));
  assert.deepEqual([...new Set(outward)], ["../director-dashboard-navigation"]);
}

/** No execution surface exists anywhere in the feature. */
function exposesNoExecution(): void {
  const all = sources.map(({ text }) => text).join("\n");
  for (const forbidden of [
    "fetch(", "XMLHttpRequest", "WebSocket", "setTimeout", "setInterval",
    "child_process", "eval(", "new Function", "process.env",
  ]) {
    assert.equal(all.includes(forbidden), false, `feature must not use ${forbidden}`);
  }
  // Phase 4C.1 exports named Runtime execution *contracts*. They are not
  // callable execution entry points and remain explicitly non-authoritative.
  const runtimeArchitectureContracts = new Set([
    "RUNTIME_ADAPTER_FAMILIES", "RUNTIME_EXECUTION_ARCHITECTURE", "RUNTIME_EXECUTION_ERROR_CODES",
    "RUNTIME_EXECUTION_LIFECYCLE_STATES", "RUNTIME_TARGET_KINDS", "UNRESOLVED_RUNTIME_EXECUTION_AUTHORITY",
    "RuntimeExecutionGateway", "RUNTIME_TARGET_RESOLUTION_ERROR_CODES", "RUNTIME_TARGET_RESOLUTION_MAPPING",
    "RUNTIME_TARGET_RESOLUTION_SOURCES", "RUNTIME_TARGET_RESOLUTION_VERSION", "RuntimeTargetResolver",
    "RUNTIME_ADAPTER_AVAILABILITY_STATES", "RUNTIME_ADAPTER_DESCRIPTORS", "RUNTIME_ADAPTER_ERROR_CODES", "RuntimeAdapterRegistry",
    "RUNTIME_CONCURRENCY_SCOPES", "RUNTIME_CONFLICT_CLASSIFICATIONS", "RUNTIME_FRESHNESS_CLASSIFICATIONS", "RUNTIME_IDEMPOTENCY_ERROR_CODES", "RUNTIME_REPLAY_CLASSIFICATIONS",
    "RUNTIME_CANCELLATION_POLICIES", "RUNTIME_EXECUTION_READINESS_STATES", "RUNTIME_ROLLBACK_CLASSIFICATIONS", "RUNTIME_SAFETY_CLASSIFICATIONS", "RUNTIME_SAFETY_ERROR_CODES", "RUNTIME_TIMEOUT_CLASSES",
    "RUNTIME_EXECUTION_OUTCOMES", "RUNTIME_OUTCOME_ERROR_CODES", "RUNTIME_PROJECTION_TARGETS", "RUNTIME_RESULT_CLASSIFICATIONS",
    "RUNTIME_COMPENSATION_STRATEGIES", "RUNTIME_FAILURE_CLASSIFICATIONS", "RUNTIME_RECOVERY_ELIGIBILITY", "RUNTIME_RECOVERY_ERROR_CODES", "RUNTIME_RECOVERY_READINESS", "RUNTIME_RECOVERY_STRATEGIES", "RUNTIME_TERMINALITY",
  "RUNTIME_EXECUTION_INTEGRATION_VERSION", "RUNTIME_INTEGRATION_ERROR_CODES", "RUNTIME_INTEGRATION_GATES", "RUNTIME_INTEGRATION_STAGES",
    "RUNTIME_AUTHORITY_ERROR_CODES", "RUNTIME_AUTHORITY_REASON_CODES", "RUNTIME_AUTHORITY_STATUSES", "RUNTIME_AUTHORITY_VERSION",
    "RUNTIME_AUTHORITY_IDENTITY_ERROR_CODES", "RUNTIME_AUTHORITY_IDENTITY_VERSION", "RUNTIME_AUTHORITY_PRINCIPAL_TYPES",
    "RUNTIME_POLICY_EFFECTS", "RUNTIME_POLICY_ERROR_CODES", "RUNTIME_POLICY_VERSION",
    "RUNTIME_RISK_VERSION", "RUNTIME_RISK_LEVELS", "RUNTIME_RISK_DOMAINS", "RUNTIME_IMPACT_SCOPES", "RUNTIME_BLAST_RADII", "RUNTIME_REVERSIBILITY", "RUNTIME_DATA_SENSITIVITIES", "RUNTIME_SIDE_EFFECT_PROFILES", "RUNTIME_APPROVAL_MODES", "RUNTIME_APPROVAL_CONSTRAINTS", "RUNTIME_RISK_ERROR_CODES",
    "RUNTIME_HUMAN_APPROVAL_VERSION", "RUNTIME_APPROVAL_STATUSES", "RUNTIME_APPROVAL_DECISIONS", "RUNTIME_HUMAN_APPROVAL_ERROR_CODES",
    "RUNTIME_EXECUTION_PERMIT_VERSION", "RUNTIME_PERMIT_STATUSES", "RUNTIME_PERMIT_ERROR_CODES",
    "RUNTIME_EXECUTION_PERMIT_LIFECYCLE_VERSION", "RUNTIME_PERMIT_LIFECYCLE_STATES", "RUNTIME_PERMIT_LIFECYCLE_ERROR_CODES",
    "RUNTIME_ENGINE_VERSION", "RUNTIME_ENGINE_STATES", "RUNTIME_ENGINE_COORDINATION_MODES", "RUNTIME_ENGINE_ERROR_CODES",
    "RUNTIME_EXECUTION_SESSION_VERSION", "RUNTIME_EXECUTION_SESSION_ERROR_CODES",
    "RUNTIME_EXECUTION_PIPELINE_VERSION", "RUNTIME_EXECUTION_PIPELINE_STAGES", "RUNTIME_EXECUTION_PIPELINE_ERROR_CODES",
    "RUNTIME_DISPATCH_VERSION", "RUNTIME_DISPATCH_TARGET_CATEGORIES", "RUNTIME_DISPATCH_ERROR_CODES",
    "RUNTIME_ADAPTER_INVOCATION_CONTRACT_VERSION", "RUNTIME_ADAPTER_INVOCATION_TARGET_CATEGORIES", "RUNTIME_ADAPTER_INVOCATION_ERROR_CODES",
    "RUNTIME_EXECUTION_RESULT_VERSION", "RUNTIME_EXECUTION_STATUSES", "RUNTIME_EXECUTION_OUTPUT_TYPES", "RUNTIME_EXECUTION_RESULT_ERROR_CODES",
    "RUNTIME_RETRY_COMPENSATION_VERSION", "RUNTIME_RETRY_ELIGIBILITY_REASONS", "RUNTIME_RETRY_BACKOFF_STRATEGIES", "RUNTIME_COMPENSATION_STEP_KINDS", "RUNTIME_COMPENSATION_STATUSES", "RUNTIME_RECOVERY_CLASSES", "RUNTIME_RETRY_COMPENSATION_ERROR_CODES",
    "RUNTIME_ERROR_VERSION", "RUNTIME_ERROR_CODES", "RUNTIME_ERROR_CATEGORIES", "RUNTIME_ERROR_SEVERITIES", "RUNTIME_ERROR_ORIGIN_LAYERS", "RUNTIME_ERROR_ERROR_CODES",
    "RUNTIME_OBSERVATION_VERSION", "RUNTIME_OBSERVATION_TYPES", "RUNTIME_OBSERVATION_ORIGIN_LAYERS", "RUNTIME_METRIC_AGGREGATIONS", "RUNTIME_LOG_LEVELS", "RUNTIME_OBSERVATION_ERROR_CODES",
  ]);
  // No other exported symbol suggests or performs execution.
  for (const exported of Object.keys(directorCommand)) {
    assert.equal(runtimeArchitectureContracts.has(exported) || !/^(execute|run|dispatch|invoke|perform|apply|commit|send)/i.test(exported), true,
      `${exported} must not be an execution entry point`);
  }
  assert.equal("executeCommand" in directorCommand, false);
  assert.equal("dispatchCommand" in directorCommand, false);
}

/** Every exported value is data or a pure function; none mutate the registry. */
function exportsAreInertOrPure(): void {
  const registry = createDefaultCommandRegistry();
  const before = JSON.stringify(registry.list());
  // Calling every pure entry point must leave the catalogue untouched.
  directorCommand.validateCommandRequest({
    registry,
    request: { commandId: "workflow.pause", version: "1.0.0", targetSectionId: "active-workflows", targetRecordId: "wf-1" },
    authority: { privilege: "high", capabilities: ["workflow.lifecycle"], approvalGranted: true },
  });
  directorCommand.evaluateCommandPermission(registry.list()[0]!, { privilege: "high", capabilities: [] });
  directorCommand.satisfiesPrivilege("high", "baseline");
  assert.equal(JSON.stringify(registry.list()), before, "no entry point may mutate the registry");
}

/** Definitions carry no secrets, payloads, or endpoints. */
function definitionsCarryNoSensitiveData(): void {
  const serialized = JSON.stringify(directorCommand.DIRECTOR_COMMAND_DEFINITIONS);
  for (const forbidden of [
    "accessToken", "refreshToken", "apiKey", "password", "secret", "Bearer ",
    "postgresql://", "http://", "https://", "endpoint", "providerPayload",
    "hiddenReasoning", "memoryContent", "tenantId",
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false,
      `definitions must not contain ${forbidden}`);
  }
}

/** The legacy CRUD command pipeline is untouched and unused here. */
function legacyCommandPipelineUntouched(): void {
  const all = sources.map(({ text }) => text).join("\n");
  assert.equal(all.includes("features/commands"), false);
  assert.equal(all.includes("registerCommand"), false);
  // The legacy module still exists for its own consumers.
  assert.equal(readFileSync("src/features/commands/registry.ts", "utf8").includes("export function registerCommand"), true);
}

/** No dashboard contract was modified by this phase. */
function dashboardContractsUnchanged(): void {
  const dataTypes = readFileSync("src/features/director-dashboard-data/types.ts", "utf8");
  assert.equal(dataTypes.includes("readonly authoritative: false;"), true);
  const navigationTypes = readFileSync("src/features/director-dashboard-navigation/types.ts", "utf8");
  assert.equal(navigationTypes.includes("export const NAVIGABLE_SECTION_IDS"), true);
  // The record detail contract is consumed, never extended: commands are
  // derived alongside it rather than added to it.
  assert.equal(navigationTypes.includes("commands"), false, "RecordDetailView must not gain a commands field");
  /*
   * From Phase 4B.3 the dashboard presents commands, so consuming the feature
   * is expected. What must stay true is the set of consumers and what they may
   * do: read the presentation model, never reach an execution surface.
   */
  const consumers = ["src/components", "src/app"].flatMap((root) => grep(root, "director-command")).sort();
  assert.deepEqual(consumers, [
    "src/components/director-dashboard/director-command-center-panel.tsx",
    "src/components/director-dashboard/record-command-panel.tsx",
    "src/components/director-dashboard/record-detail-view.tsx",
    "src/components/director-dashboard/widget-runtime-board.tsx",
  ], "only the record command panel, the detail view and the board may consume commands");

  for (const file of consumers) {
    const text = readFileSync(file, "utf8");
    for (const forbidden of ["validateCommandRequest", "evaluateCommandPermission", "executeCommand", "dispatchCommand"]) {
      assert.equal(text.includes(forbidden), false, `${file} must not reach ${forbidden}`);
    }
  }
  // No route or page consumes the feature: presentation lives in the board.
  assert.deepEqual(grep("src/app", "director-command"), []);
}

/** The integration reads record details; it never reaches past them. */
function integrationConsumesReadModelsOnly(): void {
  const integration = sources.find(({ name }) => name === "record-commands.ts");
  assert.notEqual(integration, undefined);
  const text = integration!.text;
  assert.equal(text.includes('from "../director-dashboard-navigation"'), true);
  // It takes the detail as an argument rather than building one itself, so it
  // cannot reach a snapshot, a runtime, or a widget on its own.
  for (const forbidden of [
    "createRecordDetailView", "createSectionListView", "createExecutiveOverview",
    "getDirectorDashboardUiModel", "runtimeProjectionRegistry", "materializeRuntimeEvidence",
  ]) {
    assert.equal(text.includes(forbidden), false, `integration must not call ${forbidden}`);
  }
}

/** Phase 4C.8 is terminal in this declarative chain; earlier layers cannot depend on it. */
function runtimeIntegrationHasNoReverseDependencies(): void {
  const integration = sources.find(({ name }) => name === "runtime-execution-integration.ts");
  assert.notEqual(integration, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-execution-integration.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes("runtime-execution-integration"), false, `${name} must not depend on Phase 4C.8`);
    }
  }
}

/** Phase 4D.1 may consume Runtime contracts, but no prior Runtime contract may consume it. */
function runtimeAuthorityHasNoReverseDependencies(): void {
  const authority = sources.find(({ name }) => name === "runtime-authority.ts");
  assert.notEqual(authority, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-authority.ts" && name !== "runtime-authority-identity.ts" && name !== "runtime-policy.ts" && name !== "runtime-risk-classification.ts" && name !== "runtime-human-approval.ts" && name !== "runtime-execution-permit.ts" && name !== "runtime-execution-permit-lifecycle.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-authority"'), false, `${name} must not depend on Phase 4D.1`);
    }
  }
}

/** Phase 4D.2 can consume authority contracts, but no prior Runtime layer can depend on identity binding. */
function runtimeAuthorityIdentityHasNoReverseDependencies(): void {
  const identity = sources.find(({ name }) => name === "runtime-authority-identity.ts");
  assert.notEqual(identity, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-authority-identity.ts" && name !== "runtime-policy.ts" && name !== "runtime-risk-classification.ts" && name !== "runtime-human-approval.ts" && name !== "runtime-execution-permit.ts" && name !== "runtime-execution-permit-lifecycle.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-authority-identity"'), false, `${name} must not depend on Phase 4D.2`);
    }
  }
}

/** Phase 4D.3 is declarative only; no previous Runtime layer may consume its policy model. */
function runtimePolicyHasNoReverseDependencies(): void {
  const policy = sources.find(({ name }) => name === "runtime-policy.ts");
  assert.notEqual(policy, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-policy.ts" && name !== "runtime-risk-classification.ts" && name !== "runtime-human-approval.ts" && name !== "runtime-execution-permit.ts" && name !== "runtime-execution-permit-lifecycle.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-policy"'), false, `${name} must not depend on Phase 4D.3`);
    }
  }
}

/** Phase 4D.4 is terminal metadata; no prior Runtime or Authority layer may consume it. */
function runtimeRiskHasNoReverseDependencies(): void {
  const risk = sources.find(({ name }) => name === "runtime-risk-classification.ts");
  assert.notEqual(risk, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-risk-classification.ts" && name !== "runtime-human-approval.ts" && name !== "runtime-execution-permit.ts" && name !== "runtime-execution-permit-lifecycle.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-risk-classification"'), false, `${name} must not depend on Phase 4D.4`);
    }
  }
}

/** Phase 4D.5 approval records are terminal metadata; earlier layers may not consume them. */
function runtimeHumanApprovalHasNoReverseDependencies(): void {
  const approval = sources.find(({ name }) => name === "runtime-human-approval.ts");
  assert.notEqual(approval, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-human-approval.ts" && name !== "runtime-execution-permit.ts" && name !== "runtime-execution-permit-lifecycle.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-human-approval"'), false, `${name} must not depend on Phase 4D.5`);
    }
  }
}

/** Phase 4D.6 permit evidence is terminal metadata; earlier layers may not consume it. */
function runtimeExecutionPermitHasNoReverseDependencies(): void {
  const permit = sources.find(({ name }) => name === "runtime-execution-permit.ts");
  assert.notEqual(permit, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-execution-permit.ts" && name !== "runtime-execution-permit-lifecycle.ts" && name !== "runtime-engine.ts" && name !== "runtime-execution-session.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-execution-permit"'), false, `${name} must not depend on Phase 4D.6`);
    }
  }
}

/** Phase 4E.1 consumes only the permit contract and inert validation helpers. */
function runtimeEngineIsExecutionFree(): void {
  const engine = sources.find(({ name }) => name === "runtime-engine.ts");
  assert.notEqual(engine, undefined);
  const imports = [...engine!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-execution-permit", "./validation"]);
  for (const forbidden of [
    "runtime-execution-permit-lifecycle", "runtime-authority", "runtime-policy",
    "runtime-risk-classification", "runtime-human-approval", "runtime-adapter",
    "runtime-execution-gateway", "runtime-execution-integration", "provider",
    "fetch(", "node:fs", "node:child_process", "drizzle", "postgres", "redis",
  ]) {
    assert.equal(engine!.text.toLowerCase().includes(forbidden.toLowerCase()), false, `Runtime Engine must not depend on ${forbidden}`);
  }
}

/** Phase 4E.2 consumes Engine and Permit metadata; neither may depend on Session. */
function runtimeExecutionSessionIsExecutionFree(): void {
  const session = sources.find(({ name }) => name === "runtime-execution-session.ts");
  assert.notEqual(session, undefined);
  const imports = [...session!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-engine", "./runtime-execution-permit", "./validation"]);
  for (const forbidden of [
    "runtime-execution-permit-lifecycle", "runtime-authority", "runtime-policy",
    "runtime-risk-classification", "runtime-human-approval", "runtime-adapter",
    "runtime-execution-gateway", "runtime-execution-integration", "provider",
    "fetch(", "node:fs", "node:child_process", "drizzle", "postgres", "redis",
    "settimeout", "setinterval", "queue", "scheduler", "react", "dashboard",
  ]) {
    assert.equal(session!.text.toLowerCase().includes(forbidden), false, `Runtime Execution Session must not depend on ${forbidden}`);
  }
  for (const { name, text } of sources) {
    if (name !== "runtime-execution-session.ts" && name !== "runtime-execution-pipeline.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-execution-session"'), false, `${name} must not depend on Phase 4E.2`);
    }
  }
  const barrel = sources.find(({ name }) => name === "index.ts")!.text;
  assert.equal(barrel.includes("type RuntimeExecutionContext,"), true, "Phase 4C RuntimeExecutionContext export must remain canonical");
  assert.equal(barrel.includes("type RuntimeExecutionSession,"), true, "Phase 4E.2 RuntimeExecutionSession export must coexist");
}

/** Phase 4E.3 consumes Session metadata; no earlier Runtime layer may depend on Pipeline. */
function runtimeExecutionPipelineIsExecutionFree(): void {
  const pipeline = sources.find(({ name }) => name === "runtime-execution-pipeline.ts");
  assert.notEqual(pipeline, undefined);
  const imports = [...pipeline!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-execution-session", "./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-permit", "runtime-execution-context",
    "runtime-execution-contracts", "runtime-adapter", "runtime-execution-gateway",
    "runtime-execution-integration", "provider", "fetch(", "node:fs", "node:child_process",
    "drizzle", "postgres", "redis", "settimeout", "setinterval", "queue", "scheduler",
    "react", "dashboard",
  ]) {
    assert.equal(pipeline!.text.toLowerCase().includes(forbidden), false, `Runtime Execution Pipeline must not depend on ${forbidden}`);
  }
  for (const { name, text } of sources) {
    if (name !== "runtime-execution-pipeline.ts" && name !== "runtime-command-dispatcher.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-execution-pipeline"'), false, `${name} must not depend on Phase 4E.3`);
    }
  }
}

/** Phase 4E.4 consumes Pipeline metadata; no earlier Runtime layer may depend on Dispatcher. */
function runtimeCommandDispatcherIsExecutionFree(): void {
  const dispatcher = sources.find(({ name }) => name === "runtime-command-dispatcher.ts");
  assert.notEqual(dispatcher, undefined);
  const imports = [...dispatcher!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-execution-pipeline", "./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-session", "runtime-execution-permit",
    "runtime-execution-context", "runtime-execution-contracts", "runtime-adapter",
    "runtime-execution-gateway", "runtime-execution-integration", "provider",
    "fetch(", "node:fs", "node:child_process", "drizzle", "postgres", "redis",
    "settimeout", "setinterval", "queue", "scheduler", "react", "dashboard",
  ]) {
    assert.equal(dispatcher!.text.toLowerCase().includes(forbidden), false, `Runtime Command Dispatcher must not depend on ${forbidden}`);
  }
  for (const { name, text } of sources) {
    if (name !== "runtime-command-dispatcher.ts" && name !== "runtime-adapter-invocation-contract.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-command-dispatcher"'), false, `${name} must not depend on Phase 4E.4`);
    }
  }
}

/** Phase 4E.5 consumes Dispatcher metadata; no earlier Runtime layer may depend on the invocation contract. */
function runtimeAdapterInvocationContractIsExecutionFree(): void {
  const contract = sources.find(({ name }) => name === "runtime-adapter-invocation-contract.ts");
  assert.notEqual(contract, undefined);
  const imports = [...contract!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-command-dispatcher", "./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-session", "runtime-execution-permit",
    "runtime-execution-context", "runtime-execution-contracts", "runtime-adapter-framework",
    "runtime-adapter-registry", "runtime-adapter-selection", "runtime-execution-gateway",
    "runtime-execution-integration", "provider-invocation", "fetch(", "xmlhttprequest",
    "websocket", "node:fs", "node:child_process", "drizzle", "postgres", "redis",
    "settimeout", "setinterval", "queue", "scheduler", "react", "dashboard",
  ]) {
    assert.equal(contract!.text.toLowerCase().includes(forbidden), false, `Runtime Adapter Invocation Contract must not depend on ${forbidden}`);
  }
  for (const { name, text } of sources) {
    if (name !== "runtime-adapter-invocation-contract.ts" && name !== "runtime-execution-result.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-adapter-invocation-contract"'), false, `${name} must not depend on Phase 4E.5`);
    }
  }
}

/** Phase 4E.6 consumes Invocation metadata; earlier Runtime layers cannot depend on result metadata. */
function runtimeExecutionResultIsExecutionFree(): void {
  const result = sources.find(({ name }) => name === "runtime-execution-result.ts");
  assert.notEqual(result, undefined);
  const imports = [...result!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-adapter-invocation-contract", "./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-session", "runtime-execution-permit",
    "runtime-execution-context", "runtime-execution-contracts", "runtime-adapter-framework",
    "runtime-adapter-registry", "runtime-adapter-selection", "runtime-execution-gateway",
    "runtime-execution-integration", "provider-invocation", "retry", "recover",
    "fetch(", "xmlhttprequest", "websocket", "node:fs", "node:child_process",
    "drizzle", "postgres", "redis", "settimeout", "setinterval", "queue", "scheduler",
    "react", "dashboard",
  ]) {
    assert.equal(result!.text.toLowerCase().includes(forbidden), false, `Runtime Execution Result must not depend on ${forbidden}`);
  }
  for (const { name, text } of sources) {
    // Phase 4E.7 (retry & compensation) is the sanctioned downstream consumer
    // of the result, per the canonical flow Result -> RetryPolicy -> Plan.
    if (name !== "runtime-execution-result.ts" && name !== "runtime-retry-compensation.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-execution-result"'), false, `${name} must not depend on Phase 4E.6`);
    }
  }
}

/** Phase 4E.7 consumes the execution result; nothing may depend back on retry metadata. */
function runtimeRetryCompensationIsExecutionFree(): void {
  const retry = sources.find(({ name }) => name === "runtime-retry-compensation.ts");
  assert.notEqual(retry, undefined);
  const imports = [...retry!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./runtime-execution-result", "./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-session", "runtime-execution-permit",
    "runtime-execution-context", "runtime-execution-contracts", "runtime-adapter-framework",
    "runtime-adapter-registry", "runtime-adapter-selection", "runtime-execution-gateway",
    "runtime-execution-integration", "runtime-command-dispatcher", "provider-invocation",
    "fetch(", "xmlhttprequest", "websocket", "node:fs", "node:child_process",
    "drizzle", "postgres", "redis", "settimeout", "setinterval", "setimmediate",
    "queuemicrotask", "queue", "scheduler", " timer", "react", "dashboard",
    "new promise", "await ",
  ]) {
    assert.equal(retry!.text.toLowerCase().includes(forbidden), false, `Runtime Retry & Compensation must not depend on ${forbidden}`);
  }
  // The retry & compensation layer is terminal: no earlier Runtime layer may
  // depend on it; only a future executor consumes it.
  for (const { name, text } of sources) {
    if (name !== "runtime-retry-compensation.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-retry-compensation"'), false, `${name} must not depend on Phase 4E.7`);
    }
  }
}

/** Phase 4D.7 lifecycle metadata is terminal; earlier layers may not consume it. */
function runtimeExecutionPermitLifecycleHasNoReverseDependencies(): void {
  const lifecycle = sources.find(({ name }) => name === "runtime-execution-permit-lifecycle.ts");
  assert.notEqual(lifecycle, undefined);
  for (const { name, text } of sources) {
    if (name !== "runtime-execution-permit-lifecycle.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-execution-permit-lifecycle"'), false, `${name} must not depend on Phase 4D.7`);
    }
  }
}

/** Phase 4E.8 is a foundational error leaf: it imports only validation and nothing depends back on it. */
function runtimeErrorIsExecutionFree(): void {
  const errorModel = sources.find(({ name }) => name === "runtime-error.ts");
  assert.notEqual(errorModel, undefined);
  const imports = [...errorModel!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-session", "runtime-execution-permit",
    "runtime-execution-result", "runtime-retry-compensation", "runtime-adapter-invocation-contract",
    "runtime-command-dispatcher", "runtime-execution-pipeline", "runtime-adapter-framework",
    "runtime-execution-integration", "provider-invocation",
    "throw new error", "try {", "catch (", "catch {", "console.",
    "fetch(", "xmlhttprequest", "websocket", "node:fs", "node:child_process",
    "drizzle", "postgres", "redis", "settimeout", "setinterval", "setimmediate",
    "queuemicrotask", "queue", "scheduler", " timer", "react", "dashboard",
    "new promise", "await ",
  ]) {
    assert.equal(errorModel!.text.toLowerCase().includes(forbidden), false, `Runtime Error must not depend on ${forbidden}`);
  }
  // Terminal leaf: no other Runtime layer may depend on the error model.
  for (const { name, text } of sources) {
    if (name !== "runtime-error.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-error"'), false, `${name} must not depend on Phase 4E.8`);
    }
  }
}

/** Phase 4E.9 is a foundational observability leaf: it imports only validation, emits nothing, and nothing depends back on it. */
function runtimeObservationIsExecutionFree(): void {
  const observation = sources.find(({ name }) => name === "runtime-observation.ts");
  assert.notEqual(observation, undefined);
  const imports = [...observation!.text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(imports, ["./validation"]);
  for (const forbidden of [
    "runtime-engine", "runtime-execution-session", "runtime-execution-permit",
    "runtime-execution-result", "runtime-retry-compensation", "runtime-error",
    "runtime-adapter-invocation-contract", "runtime-command-dispatcher",
    "runtime-execution-pipeline", "runtime-adapter-framework",
    "runtime-execution-integration", "provider-invocation",
    "opentelemetry", "@opentelemetry", "telemetry", "winston", "pino", "bunyan",
    "jaeger", "zipkin", "prom-client", "statsd", "datadog",
    "throw new error", "try {", "catch (", "catch {", "console.", "process.env",
    "fetch(", "xmlhttprequest", "websocket", "node:fs", "node:child_process",
    "drizzle", "postgres", "redis", "settimeout", "setinterval", "setimmediate",
    "queuemicrotask", "queue", "scheduler", " timer", "react", "dashboard",
    "new promise", "await ",
  ]) {
    assert.equal(observation!.text.toLowerCase().includes(forbidden), false, `Runtime Observation must not depend on ${forbidden}`);
  }
  // Terminal leaf: no other Runtime layer may depend on the observation model.
  for (const { name, text } of sources) {
    if (name !== "runtime-observation.ts" && name.startsWith("runtime-")) {
      assert.equal(text.includes('from "./runtime-observation"'), false, `${name} must not depend on Phase 4E.9`);
    }
  }
}

function grep(root: string, needle: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name) && readFileSync(path, "utf8").includes(needle)) found.push(path);
    }
  };
  walk(root);
  return found;
}

function main(): void {
  reachesNoAuthority();
  importsOnlyNavigationIdentifiers();
  exposesNoExecution();
  exportsAreInertOrPure();
  definitionsCarryNoSensitiveData();
  legacyCommandPipelineUntouched();
  dashboardContractsUnchanged();
  integrationConsumesReadModelsOnly();
  runtimeIntegrationHasNoReverseDependencies();
  runtimeAuthorityHasNoReverseDependencies();
  runtimeAuthorityIdentityHasNoReverseDependencies();
  runtimePolicyHasNoReverseDependencies();
  runtimeRiskHasNoReverseDependencies();
  runtimeHumanApprovalHasNoReverseDependencies();
  runtimeExecutionPermitHasNoReverseDependencies();
  runtimeExecutionPermitLifecycleHasNoReverseDependencies();
  runtimeEngineIsExecutionFree();
  runtimeExecutionSessionIsExecutionFree();
  runtimeExecutionPipelineIsExecutionFree();
  runtimeCommandDispatcherIsExecutionFree();
  runtimeAdapterInvocationContractIsExecutionFree();
  runtimeExecutionResultIsExecutionFree();
  runtimeRetryCompensationIsExecutionFree();
  runtimeErrorIsExecutionFree();
  runtimeObservationIsExecutionFree();
  console.log("director command boundary checks passed");
}

main();
