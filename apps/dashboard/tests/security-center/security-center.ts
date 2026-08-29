import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACES, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { resolveNavigation } from "../../src/features/heby-runtime/navigate-tool";
import { invokableTools, invokeTool, NAVIGATE_TOOL_ID } from "../../src/features/heby-runtime";
import {
  getSecurityCenterModel,
  listSecuritySources,
  hasConnectedSecurityFeed,
  getSecuritySource,
  listSecuritySignals,
  listSecurityFindings,
  FINDING_STATUS_DESCRIPTORS,
  isBreachConfirmable,
  listResponseOptions,
  validateResponseModel,
  anyOptionDirectlyExecutable,
  getResponseOption,
  describeSecurityBoundary,
  getDeviceSecuritySummary,
  SECURITY_SIGNAL_KINDS,
  SECURITY_FINDING_STATUSES,
} from "../../src/features/security-center";

const MODEL = getSecurityCenterModel("tenant-a");

/* --- 1/2/3. Route real, Governance-owned, no 8th workspace ---------------------------- */
function routeAndOwnership(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces");
  const governance = WORKSPACES.find((w) => w.id === "governance")!;
  const dest = governance.destinations.find((d) => d.href === "/director/governance/security");
  assert.ok(dest, "Security Center is a Governance destination");
  assert.equal(dest!.label, "Security Center");
  assert.equal(resolveActiveWorkspace("/director/governance/security"), "governance", "route belongs to Governance");
}

/* --- 4/5/14/15. No fabricated incident/finding/attack-path/timeline ------------------- */
function noFabricatedInstances(): void {
  assert.deepEqual(MODEL.incidents, [], "no incidents");
  assert.deepEqual(MODEL.findings, [], "no findings");
  assert.deepEqual(MODEL.signals, [], "no signals");
  assert.deepEqual(MODEL.timeline, [], "no timeline / attack path");
}

/* --- 6. No fake threat/risk score (vocabulary only) ---------------------------------- */
function noFakeScore(): void {
  for (const risk of MODEL.riskClasses) assert.equal(typeof risk, "string", "risk is a class, not a score");
  // The model exposes no numeric score/percentage field anywhere.
  assert.equal(JSON.stringify(MODEL).includes("score"), false, "no score field");
}

/* --- 9/10. signal ≠ incident; finding ≠ breach (no CONFIRMED) ------------------------ */
function categoryDiscipline(): void {
  assert.equal((SECURITY_SIGNAL_KINDS as readonly string[]).includes("INCIDENT"), false, "a signal kind is not an incident");
  assert.equal((SECURITY_FINDING_STATUSES as readonly string[]).includes("CONFIRMED"), false, "no confirmed-breach status");
  assert.equal(isBreachConfirmable(), false);
  assert.equal(Object.keys(FINDING_STATUS_DESCRIPTORS).includes("CONFIRMED"), false);
}

/* --- 11/12/13. Degradation ≠ attack; unavailable ≠ compromise ------------------------ */
function noReinterpretation(): void {
  assert.equal(getSecuritySource("runtime").state, "derived", "runtime is derived, not an attack feed");
  assert.equal(getSecuritySource("authentication").state, "derived", "auth is derived, not an intrusion feed");
  assert.equal(getSecuritySource("incident-feed").state, "not-connected");
  /*
   * E2-2 REPAIRED THIS ASSERTION, STRICTER RATHER THAN WEAKER.
   *
   * It read `hasConnectedSecurityFeed() === false`, which was true while nothing was connected and
   * became stale when the `audit` class was connected to its released tenant-scoped reader. The
   * weak repair would have been `=== true` or "some feed exists"; both would let a future slice
   * connect anything at all without a word. So the truth is ENUMERATED: exactly one class is
   * connected, and it is that one.
   */
  assert.equal(hasConnectedSecurityFeed(), true, "E2-2 connected exactly one source class");
  assert.deepEqual(
    listSecuritySources().filter((s) => s.state === "connected").map((s) => s.sourceClass),
    ["audit"],
    "the audit class and nothing else — a seam existing elsewhere connects nothing",
  );
  /* And connected is not a claim about the evidence's standing, nor about liveness. */
  assert.match(getSecuritySource("audit").cannotProve, /security event/i);
  assert.match(getSecuritySource("audit").detail, /not a stream/i);
  // No finding is produced from degraded/unavailable state.
  assert.deepEqual(MODEL.findings, []);
}

/* --- 17/18. No secret exposure; credentials never a capability ----------------------- */
function noSecretExposure(): void {
  const serialized = JSON.stringify(MODEL).toLowerCase();
  for (const token of ["password", "secret", "api-key", "apikey", "private key", "cookie value", "ssh"]) {
    assert.equal(serialized.includes(token), false, `model must not expose "${token}"`);
  }
}

/* --- 19/20/21/32/33. Response uses Phase 17/18; no bypass ---------------------------- */
function responseUsesPipelines(): void {
  assert.deepEqual(validateResponseModel(), [], "response model is internally honest");
  assert.equal(anyOptionDirectlyExecutable(), false, "no option is directly executable");
  // Device-backed device actions are not available (Phase 18 disconnected).
  const isolate = getResponseOption("ISOLATE_DEVICE")!;
  assert.equal(isolate.sideEffect, "DEVICE_ACTION");
  assert.equal(isolate.deviceBacked, true);
  assert.equal(isolate.disposition, "not-available");
  // Consequential mutations require human review.
  const block = getResponseOption("BLOCK_CONNECTION")!;
  assert.equal(block.sideEffect, "CONSEQUENTIAL_MUTATION");
  assert.equal(block.disposition, "requires-human-review");
  // Advisory read-only/preparation options carry advisory-only authority.
  const investigate = getResponseOption("INVESTIGATE_IDENTITY")!;
  assert.equal(investigate.sideEffect, "READ_ONLY");
  assert.equal(investigate.disposition, "advisory");
  // Every option maps onto a Phase 17 side-effect class.
  const classes = new Set(["READ_ONLY", "PREPARATION_ONLY", "REVERSIBLE_MUTATION", "CONSEQUENTIAL_MUTATION", "DEVICE_ACTION"]);
  for (const o of listResponseOptions()) assert.ok(classes.has(o.sideEffect), `${o.kind} maps to a Phase 17 class`);
  // Phase 18 device summary is the disconnected boundary.
  const device = getDeviceSecuritySummary();
  assert.equal(device.runtimeConnected, false);
  assert.equal(device.registeredDevices, 0);
  assert.equal(device.trustedDevices, 0);
}

/* --- 27. Heby security role advisory ------------------------------------------------ */
function hebyAdvisory(): void {
  const boundary = describeSecurityBoundary();
  const heby = boundary.find((row) => row.actor === "Heby")!;
  assert.ok(/advisory/i.test(heby.describes), "Heby is advisory");
  assert.ok(/never.*(execute|approve|control)/i.test(heby.describes), "Heby never executes/approves/controls");
  const runtime = boundary.find((row) => row.actor === "Authorized runtime")!;
  assert.ok(/Phase 17/.test(runtime.describes) && /Phase 18/.test(runtime.describes), "execution routes through Phase 17/18");
}

/* --- 28/29. Navigation resolves real Security Center; unknown fails ------------------ */
function navigationResolves(): void {
  const found = resolveNavigation("security center");
  assert.equal(found.found, true);
  assert.equal(found.target?.route, "/director/governance/security");
  const sec = resolveNavigation("security");
  assert.ok(sec.found || sec.candidates.some((c) => c.route === "/director/governance/security"), "'security' resolves or offers it");
  // Unknown target does not fake success (Phase 16 behavior).
  const nothing = resolveNavigation("zzq-not-a-place");
  assert.equal(nothing.found, false);
  assert.equal(nothing.target, undefined);
}

/* --- 30. Tenant isolation preserved ------------------------------------------------- */
function tenantIsolation(): void {
  assert.deepEqual(listSecuritySignals("tenant-a"), []);
  assert.deepEqual(listSecuritySignals("attacker-tenant"), []);
  assert.deepEqual(listSecurityFindings("tenant-a"), []);
  assert.deepEqual(listSecurityFindings("attacker-tenant"), []);
}

/* --- 31. Phase 16 READ_ONLY behavior preserved -------------------------------------- */
function phase16Preserved(): void {
  for (const tool of invokableTools()) assert.equal(tool.sideEffect, "READ_ONLY");
  const nav = invokeTool({ toolId: NAVIGATE_TOOL_ID, query: "governance" });
  assert.equal(nav.state, "SUCCESS");
  assert.equal(nav.sideEffectOccurred, false);
}

/* --- Sources honest ----------------------------------------------------------------- */
function sourcesHonest(): void {
  /*
   * E2-2: the blanket "never connected" became stale for exactly one class. Enumerated rather than
   * relaxed — every source is still pinned to a named state, so a silent transition anywhere else
   * fails here.
   */
  const RELEASED: Readonly<Record<string, string>> = {
    authentication: "derived",
    authorization: "derived",
    device: "derived",
    runtime: "derived",
    integration: "derived",
    provider: "derived",
    policy: "not-connected",
    audit: "connected",
    network: "not-connected",
    "incident-feed": "not-connected",
  };
  for (const source of listSecuritySources()) {
    assert.equal(source.state, RELEASED[source.sourceClass], `${source.sourceClass} keeps its pinned state`);
    assert.ok(["connected", "derived", "not-connected"].includes(source.state));
    /* Only a connected or derived source may be usable; a not-connected one contributes nothing. */
    assert.equal(source.usable, source.state !== "not-connected", `${source.sourceClass} usability matches its state`);
  }
  assert.equal(Object.keys(RELEASED).length, listSecuritySources().length, "no source class was added");
}

/* --- Refinement: source coverage states what it can/cannot prove --------------------- */
function sourceCoverageHonest(): void {
  for (const source of listSecuritySources()) {
    assert.ok(source.canProve.length > 0, `${source.sourceClass} states what it can prove`);
    assert.ok(source.cannotProve.length > 0, `${source.sourceClass} states what it cannot prove`);
    if (source.state === "not-connected") {
      assert.match(source.canProve, /nothing/i, `${source.sourceClass} not-connected proves nothing`);
    }
  }
}

/* --- Refinement: pipeline stages reflect REAL availability --------------------------- */
function pipelineHonest(): void {
  assert.ok(MODEL.pipeline.length >= 10, "pipeline has the full flow");
  for (const stage of MODEL.pipeline) {
    assert.notEqual(stage.state, "connected", `${stage.stage} is never 'connected'`);
  }
  assert.equal(MODEL.pipeline.find((s) => s.stage === "runtime")!.state, "not-connected", "Phase 18 runtime not connected");
  assert.equal(MODEL.pipeline.find((s) => s.stage === "signals")!.state, "none", "no signals");
  assert.equal(MODEL.pipeline.find((s) => s.stage === "finding")!.state, "none", "no finding");
  assert.equal(MODEL.pipeline.find((s) => s.stage === "human-authority")!.state, "human-authority");
}

/* --- Refinement: domains — unknown/not-connected is NEVER healthy -------------------- */
function domainsHonest(): void {
  assert.equal(MODEL.domains.length, 8);
  const honest = new Set(["connected", "derived", "not-connected", "restricted", "none"]);
  for (const domain of MODEL.domains) {
    assert.ok(honest.has(domain.state), `${domain.domain} carries an honest state`);
    assert.notEqual(domain.state as string, "healthy", "no domain is 'healthy'");
  }
  // A domain with no connected feed is not-connected — never derived-as-healthy.
  assert.equal(MODEL.domains.find((d) => d.domain === "policy-governance")!.state, "not-connected");
  /*
   * E2-2: `data-access` is the row bound to the `audit` source class, so it moved with it — and it
   * is the ONLY domain that moved. Enumerated, so a future slice cannot connect a second domain on
   * the strength of this same read.
   */
  assert.deepEqual(
    MODEL.domains.filter((d) => d.state === "connected").map((d) => d.domain),
    ["data-access"],
    "exactly the domain bound to the connected source class",
  );
  /*
   * And connected here means the governed-act ledger, NOT data-access monitoring. The label is the
   * released one; the detail is what stops it being read as a capability Hebun does not have.
   */
  const dataAccess = MODEL.domains.find((d) => d.domain === "data-access")!;
  assert.equal(dataAccess.sourceClass, "audit");
  assert.match(dataAccess.detail, /governed-act ledger/i);
  assert.match(dataAccess.detail, /No data classification, DLP or exfiltration detection exists/i);
}

/* --- Refinement: architecture uses real system names, no fake agent ------------------ */
function architectureHonest(): void {
  const owners = MODEL.architecture.map((l) => l.owner).join(" ");
  assert.ok(/Phase 17/.test(owners) && /Phase 18/.test(owners), "architecture references Phase 17 and Phase 18");
  assert.ok(MODEL.architecture.some((l) => l.owner.includes("Security Center")));
  assert.equal(/orchestrator online|agent swarm|ai online/i.test(JSON.stringify(MODEL.architecture)), false, "no fake agent/orchestrator");
}

/* --- 16/22/23/24/25/26 + no shell/network/model/device: no unsafe coupling (source) --- */
function noUnsafeCoupling(): void {
  const dir = "src/features/security-center";
  // Precise executable-API / import / persistence tokens only — NOT English security words, which
  // appear legitimately in denial/explanatory copy. Fabricated DATA is guarded separately, below,
  // against the rendered model output.
  const forbidden = [
    // model / network / scanners
    "openai", "anthropic", "gemini", "generativeai", "fetch(", "axios", "websocket", "socket.io", "pcap", "nmap",
    // shell / process
    "child_process", "execsync", "spawn(", "eval(", "process.env", "kill(",
    // filesystem
    "fs.write", "fs.unlink", "fs.rm", "writefilesync", "readfilesync",
    // device / computer use
    "getusermedia", "mediadevices", "getdisplaymedia", "playwright", "puppeteer", "chromium",
    // write-boundary / governance-mutation imports
    "features/memory", "features/enterprise-memory", "features/decision", "features/human-approval",
    "features/intelligence", "features/organizational-intelligence", "features/policy", "features/execution",
    "features/governance",
    // persistence
    ".insert(", "persist(", "drizzle",
  ];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(join(dir, file), "utf8").toLowerCase();
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference "${token}"`);
    }
  }
}

/* --- Fake-security data audit: the RENDERED model output carries no fabrication -------- */
function noFabricatedSecurityData(): void {
  const rendered = JSON.stringify([
    MODEL,
    listResponseOptions(),
    listSecuritySources(),
    describeSecurityBoundary(),
  ]).toLowerCase();
  const fabricated = [
    "cve-", "inc-0", "inc-1", "apt2", "apt3", "apt-", "malware", "ransomware", "phishing",
    "attacker", "threat score", "risk score", "probability", "quarantine", "compromised device",
    "under attack", "breach detected", "infected",
  ];
  for (const token of fabricated) {
    assert.equal(rendered.includes(token), false, `rendered model must not contain "${token}"`);
  }
  // No fabricated IP address or percentage in the rendered output.
  assert.equal(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(rendered), false, "no fabricated IP");
  assert.equal(/\d+(\.\d+)?\s*%/.test(rendered), false, "no fabricated percentage/score");
}

routeAndOwnership();
noFabricatedInstances();
noFakeScore();
categoryDiscipline();
noReinterpretation();
noSecretExposure();
responseUsesPipelines();
hebyAdvisory();
navigationResolves();
tenantIsolation();
phase16Preserved();
sourcesHonest();
sourceCoverageHonest();
pipelineHonest();
domainsHonest();
architectureHonest();
noUnsafeCoupling();
noFabricatedSecurityData();

console.log("security-center checks passed");
