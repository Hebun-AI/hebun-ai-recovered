/*
 * R3B — the boundaries the execution runtime must never cross.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Exactly one action kind can execute, through exactly one adapter, reached only by an explicit
 *    human click. No worker, no scheduler, no queue, no dispatcher, no agent, no Computer Use, no
 *    shell, no filesystem, no browser. The runtime itself cannot open a socket. Heby cannot reach
 *    the execute boundary. The legacy `executions` table stays dead. And nothing in the repository
 *    still claims execution is impossible now that it is not."
 *
 * Structural assertions run over source with comments stripped: they are about what the code can
 * reach, not about what its prose promises.
 *
 * Pure. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  getActionToolByKind,
  listActionTools,
  validateActionRegistry,
} from "../../src/features/heby-actions/action-registry";
import {
  ACTION_PERMIT_NON_EFFECTS,
  EXECUTION_SUBSTRATE_GAP,
} from "../../src/features/action-authorization/contracts";
import {
  EXECUTABLE_ACTION_KIND,
  EXECUTABLE_TOOL_ID,
  EXECUTION_OUTCOME_WORDING,
  EXTERNAL_SEND_PROVIDER_KEY,
  PROVIDER_ACCEPTANCE_NON_CLAIMS,
} from "../../src/features/action-execution/contracts";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const RUNTIME_FILES = collect("src/features/action-execution");
const RUNTIME_CODE = RUNTIME_FILES.map((f) => codeOf(read(f))).join("\n");
const LIVE_FILES = collect("src/features/action-execution-live");
const LIVE_CODE = LIVE_FILES.map((f) => codeOf(read(f))).join("\n");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE RUNTIME CANNOT OPEN A SOCKET.
 *
 * Release-critical. `action-execution` orchestrates; `action-execution-live` is the ONLY module
 * with a network primitive, exactly as `heby-model` / `heby-model-live` split for the same reason.
 * ═════════════════════════════════════════════════════════════════════════ */
function runtimeIsNetworkFree(): void {
  for (const forbidden of [
    "fetch(",
    "globalThis.fetch",
    "node:http",
    "node:https",
    "node:net",
    "node:tls",
    "node:dgram",
    "axios",
    "undici",
    "nodemailer",
    "XMLHttpRequest",
    "WebSocket",
  ]) {
    assert.ok(
      !RUNTIME_CODE.includes(forbidden),
      `the execution runtime must not reach ${forbidden} — only the live transport may`,
    );
  }

  /* And it never reads a credential. Only the registry hands one to the transport. */
  for (const forbidden of ["ANTHROPIC", "process.env.HEBUN_EXTERNAL_SEND_API_KEY"]) {
    assert.ok(!RUNTIME_CODE.includes(forbidden), `the runtime must not reach ${forbidden}`);
  }

  /*
   * The live transport reaches exactly one host, and since the vendor selection gate that host is
   * a FROZEN LITERAL rather than deployment configuration.
   *
   * REPAIRED: this assertion used to demand the opposite — "never a literal in the transport" —
   * because no vendor had been chosen and a literal would have been an invented one. Now that
   * Resend is selected, a settable URL is the weaker arrangement: it is an arbitrary-URL
   * capability, and `ADAPTER_SANDBOX_BOUNDARY` says none exists. So the guard is inverted rather
   * than dropped, and it is strictly tighter: exactly one https literal may appear in the live
   * feature, it must be Resend's send endpoint, and no endpoint env var may come back.
   */
  const hosts = [...LIVE_CODE.matchAll(/https:\/\/[a-z0-9.-]+\/[a-z0-9/._-]*/gi)].map((m) => m[0]);
  assert.deepEqual(
    [...new Set(hosts)],
    ["https://api.resend.com/emails"],
    "the live transport may reach exactly one host, and it is Resend's send endpoint",
  );
  assert.ok(
    !LIVE_CODE.includes("EXTERNAL_SEND_ENDPOINT"),
    "the provider host must not be reintroduced as configuration",
  );
  assert.ok(
    !RUNTIME_CODE.includes("https://"),
    "the orchestration layer names no host at all",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. NO WORKER, NO SCHEDULER, NO QUEUE, NO DISPATCHER, NO AGENT, NO DEVICE.
 * ═════════════════════════════════════════════════════════════════════════ */
function noAutonomousExecution(): void {
  const ALL = RUNTIME_CODE + LIVE_CODE;
  for (const forbidden of [
    "setInterval",
    "setImmediate",
    "cron",
    "bullmq",
    "pg-boss",
    "worker_threads",
    "new Worker",
    "child_process",
    "execSync",
    "spawn(",
    "node:fs",
    "readFileSync",
    "writeFileSync",
    "puppeteer",
    "playwright",
    "computer-use",
    "computerUse",
    "deviceAction",
    "DEVICE_ACTION",
    "dispatchAgent",
    "executionDispatcher",
  ]) {
    assert.ok(
      !ALL.includes(forbidden),
      `R3B is one action, not a platform — it must not reach ${forbidden}`,
    );
  }

  /* The one timer that exists is the adapter's hard timeout, and it is cleared. */
  assert.ok(LIVE_CODE.includes("setTimeout") && LIVE_CODE.includes("clearTimeout"));
  assert.ok(!RUNTIME_CODE.includes("setTimeout"), "the runtime itself schedules nothing");

  /* No retry vocabulary anywhere. */
  for (const forbidden of ["backoff", "maxRetries", "retryCount", "attempt + 1", "while (true)"]) {
    assert.ok(!ALL.includes(forbidden), `generation one has zero automatic retry: ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE LEGACY `executions` TABLE STAYS DEAD.
 * ═════════════════════════════════════════════════════════════════════════ */
function legacyExecutionsStaysDead(): void {
  const ALL = RUNTIME_CODE + LIVE_CODE;
  for (const forbidden of ["schema/execution\"", "from \"@/db/schema/execution\"", "executions,"]) {
    assert.ok(
      !ALL.includes(forbidden),
      `Gate A ruled the legacy executions table DEAD — R3B must not revive it (${forbidden})`,
    );
  }
  /* Nor the dead provider/integration registries. */
  for (const forbidden of ["schema/provider\"", "schema/integration\"", "providersTable"]) {
    assert.ok(!ALL.includes(forbidden), `R3B must not activate ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. R3B MUTATES NOTHING IT DOES NOT OWN.
 * ═════════════════════════════════════════════════════════════════════════ */
function ownsOnlyAttempts(): void {
  const ALL = RUNTIME_CODE + LIVE_CODE;
  /* It never writes Knowledge, Governance decisions, permissions, policy or workflows. */
  for (const forbidden of [
    "knowledgeNodes",
    "knowledgeFacts",
    "knowledgeEdges",
    "decisionRecords",
    "governanceSessions",
    "writeGovernanceDecision",
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "recordActionRequest",
    "rolePermissions",
    "policies",
    "workflows",
    "memories",
  ]) {
    assert.ok(!ALL.includes(forbidden), `the execution runtime must not reach ${forbidden}`);
  }

  /* The ONLY table it inserts into is its own; the only one it updates is its own. */
  const inserts = [...RUNTIME_CODE.matchAll(/\.insert\((\w+)\)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(inserts)].sort(),
    ["actionExecutionAttempts"],
    "the runtime inserts into exactly one table of its own",
  );
  const updates = [...RUNTIME_CODE.matchAll(/\.update\((\w+)\)/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(updates)].sort(),
    ["actionExecutionAttempts"],
    "the runtime updates exactly one table of its own — never a permit, never a recipient",
  );
  assert.ok(!RUNTIME_CODE.includes(".delete("), "nothing is ever deleted");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. ONE EXECUTABLE ACTION KIND, AND THE REGISTRY GUARD IS STRONGER THAN BEFORE.
 * ═════════════════════════════════════════════════════════════════════════ */
function exactlyOneExecutableAction(): void {
  assert.deepEqual(validateActionRegistry(), [], "the registry must remain internally honest");

  const connected = listActionTools().filter(
    (t) => t.sideEffect !== "READ_ONLY" && t.sideEffect !== "PREPARATION_ONLY" && t.substrateConnected,
  );
  assert.equal(connected.length, 1, "exactly one mutation tool declares a connected substrate");
  assert.equal(connected[0]!.actionKind, EXECUTABLE_ACTION_KIND);
  assert.equal(connected[0]!.toolId, EXECUTABLE_TOOL_ID);

  /* And it kept every obligation the exception was granted under. */
  const send = getActionToolByKind("send-external-communication")!;
  assert.equal(send.sideEffect, "CONSEQUENTIAL_MUTATION");
  assert.equal(send.reversibility, "irreversible");
  assert.equal(send.authorityRequirement, "human-review-required");
  assert.equal(send.governanceGated, true);

  /* EVERY OTHER mutation and device tool is still disconnected. */
  for (const tool of listActionTools()) {
    if (tool.actionKind === EXECUTABLE_ACTION_KIND) continue;
    if (tool.sideEffect === "READ_ONLY" || tool.sideEffect === "PREPARATION_ONLY") continue;
    assert.equal(
      tool.substrateConnected,
      false,
      `${tool.toolId} must NOT declare a connected substrate`,
    );
  }

  /* The device tool is disconnected and stays that way. */
  assert.equal(getActionToolByKind("device-action")!.substrateConnected, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. HEBY CANNOT EXECUTE. ONLY A HUMAN CLICK CAN.
 * ═════════════════════════════════════════════════════════════════════════ */
function onlyAHumanCanExecute(): void {
  /* The execute boundary lives in exactly one server-action file. */
  const callers = collect("src")
    .filter((f) => codeOf(read(f)).includes("executeAuthorizedAction"))
    .sort();
  assert.deepEqual(
    callers,
    [
      path.join("src", "app", "(dashboard)", "approvals", "actions.ts"),
      path.join("src", "components", "decision-workspace", "action-authorizations.tsx"),
      path.join("src", "features", "action-execution", "execute-authorized-action.server.ts"),
    ],
    "the execute path is reachable from the approvals boundary and nowhere else",
  );

  /* No Heby surface imports it — not the inlet, not the commands, not the model. */
  for (const dir of [
    "src/features/heby-action-inlet",
    "src/features/heby-commands",
    "src/features/heby-model",
    "src/features/heby-runtime",
    "src/features/heby-actions",
    "src/app/(dashboard)/heby",
  ]) {
    const code = collect(dir).map((f) => codeOf(read(f))).join("\n");
    for (const forbidden of ["executeAuthorizedAction", "action-execution/execute"]) {
      assert.ok(
        !code.includes(forbidden),
        `${dir} must have no representation in which it could execute (${forbidden})`,
      );
    }
  }

  /* The approvals boundary auto-executes nothing: approval and execution are separate calls. */
  const approvalsCode = codeOf(read("src/app/(dashboard)/approvals/actions.ts"));
  const approveBody = approvalsCode.slice(
    approvalsCode.indexOf("approveActionRequestAction"),
    approvalsCode.indexOf("rejectActionRequestAction"),
  );
  assert.ok(
    !approveBody.includes("executeAuthorizedAction"),
    "approving must never execute — APPROVED != EXECUTED",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE KILL SWITCH IS A SEPARATE KEY, AND THE CLAUDE ROW IS UNTOUCHED.
 * ═════════════════════════════════════════════════════════════════════════ */
function killSwitchIsSeparate(): void {
  assert.equal(EXTERNAL_SEND_PROVIDER_KEY, "external-send");
  assert.notEqual(
    EXTERNAL_SEND_PROVIDER_KEY,
    CLAUDE_PROVIDER_KEY,
    "enabling Hebun to think must never thereby enable it to act",
  );
  assert.ok(
    !RUNTIME_CODE.includes("CLAUDE_PROVIDER_KEY") && !RUNTIME_CODE.includes("\"claude\""),
    "the execution runtime must never read or write the model connectivity row",
  );
  /* No second kill-switch table was invented. */
  assert.ok(
    RUNTIME_CODE.includes("resolveDirectorEnabled"),
    "the switch reuses the existing durable control rather than a second table",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. PRODUCT TRUTH. The surface may never claim delivery.
 * ═════════════════════════════════════════════════════════════════════════ */
function productTruth(): void {
  const wording = Object.values(EXECUTION_OUTCOME_WORDING).join(" ").toLowerCase();
  for (const forbidden of ["delivered", "successfully sent", "the recipient received"]) {
    assert.ok(!wording.includes(forbidden), `R3B may never say "${forbidden}"`);
  }
  assert.ok(EXECUTION_OUTCOME_WORDING.accepted.includes("Accepted by the provider"));
  assert.ok(
    EXECUTION_OUTCOME_WORDING.unknown.includes("Do not retry blindly"),
    "an ambiguous outcome must tell the human not to retry",
  );
  assert.ok(
    EXECUTION_OUTCOME_WORDING.unknown.includes("may have accepted"),
    "an ambiguous outcome must state the provider may hold the request",
  );

  assert.ok(PROVIDER_ACCEPTANCE_NON_CLAIMS.includes("does not mean the message was delivered"));

  /* The UI never renders the banned words either. */
  const ui = codeOf(read("src/components/decision-workspace/action-authorizations.tsx"));
  assert.ok(!/\bDelivered\b/.test(ui), "the surface must not render 'Delivered'");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. RECORD INTEGRITY. No shipped claim survives that R3B made false.
 * ═════════════════════════════════════════════════════════════════════════ */
function staleClaimsRepaired(): void {
  /* The gap constant now reports the truth: a runtime EXISTS and is NOT armed. */
  assert.equal(EXECUTION_SUBSTRATE_GAP.authorizationPresent, true);
  assert.equal(
    EXECUTION_SUBSTRATE_GAP.executionPresent,
    true,
    "an execution runtime exists — the constant must say so",
  );
  assert.equal(
    EXECUTION_SUBSTRATE_GAP.executionArmed,
    false,
    "and it must record that no provider is armed",
  );
  assert.ok(!EXECUTION_SUBSTRATE_GAP.observation.includes("no execution attempt table"));

  /* The permit non-effects no longer claim the repository cannot execute. */
  assert.ok(
    !ACTION_PERMIT_NON_EFFECTS.includes("does not connect an execution substrate"),
    "that claim became false when R3B connected one",
  );
  assert.ok(ACTION_PERMIT_NON_EFFECTS.includes("does not execute the action"));
  assert.ok(ACTION_PERMIT_NON_EFFECTS.includes("does not send any communication by itself"));
  assert.ok(
    ACTION_PERMIT_NON_EFFECTS.includes("does not authorize a retry of a failed or unknown attempt"),
  );

  /* The stale header on the permit spend was repaired to match the code. */
  const consume = read("src/features/action-authorization/consume-action-permit.server.ts");
  assert.ok(
    consume.includes("ROLLS THE SPEND BACK WITH IT"),
    "the header must describe the rollback the code actually performs",
  );
  assert.ok(
    !consume.includes("a suspicious permit is burned rather than re-offered"),
    "the stale claim that a digest mismatch burns the permit must be gone",
  );

  /* The approvals page no longer says the substrate is not connected. */
  const page = read("src/app/(dashboard)/approvals/page.tsx");
  assert.ok(
    !page.includes("The execution substrate is not connected"),
    "the approvals page must not still claim there is no execution substrate",
  );
}

function main(): void {
  runtimeIsNetworkFree();
  noAutonomousExecution();
  legacyExecutionsStaysDead();
  ownsOnlyAttempts();
  exactlyOneExecutableAction();
  onlyAHumanCanExecute();
  killSwitchIsSeparate();
  productTruth();
  staleClaimsRepaired();
  console.log("R3B boundaries and firewall: all assertions passed.");
}

main();
