/*
 * R3B — THE EXTERNAL-SEND ARMING BOUNDARY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Arming is a durable, explicit, authority-gated permission that is neither implied by
 *    configuration nor reachable by an agent, by Governance, or by the execution runtime itself —
 *    and no combination of arming and configuration short of BOTH can reach the network."
 *
 * It also proves the states stay apart:
 *
 *   MAPPED ≠ CONFIGURED ≠ ARMED ≠ AUTHORIZED ≠ EXECUTED ≠ ACCEPTED ≠ DELIVERED
 *
 * Structural assertions run over source with comments stripped: they are about what the code can
 * reach, not what its prose promises.
 *
 * Pure. No database, no network, no model. Every transport boundary is injected.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  isExternalSendConfigured,
  readExternalSendOpsView,
} from "../../src/features/action-execution/execution-arming-projection.server";
import { EXTERNAL_SEND_PROVIDER_KEY } from "../../src/features/action-execution/contracts";
import { CLAUDE_PROVIDER_KEY } from "../../src/features/heby-provider-ops/provider-connectivity-control.server";
import {
  checkAdapterAvailability,
  resolveExternalSendAdapter,
} from "../../src/features/action-execution/adapter-registry.server";
import { RESEND_SEND_ENDPOINT } from "../../src/features/action-execution-live/resend-email-transport.server";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });

const RUNTIME_CODE = collect("src/features/action-execution").map((f) => codeOf(read(f))).join("\n");
const ACTIONS_CODE = codeOf(read("src/app/(dashboard)/platform/actions.ts"));
const CARD_CODE = codeOf(read("src/components/platform-providers/external-send-arming-card.tsx"));
const CONTROL_CODE = codeOf(read("src/features/action-execution/execution-control.server.ts"));

const FULL = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "A message from Hebun",
});
/** A control repository that answers however the case needs. Never touches a database. */
const controlRepo = (directorEnabled: boolean | null) => ({
  async getControl() {
    return directorEnabled === null
      ? null
      : {
          providerKey: EXTERNAL_SEND_PROVIDER_KEY,
          directorEnabled,
          version: 1,
          updatedAt: new Date(0).toISOString(),
          updatedBy: null,
        };
  },
  async setDirectorEnabled(): Promise<never> {
    throw new Error("no test may write the durable control through this repo");
  },
});
/** Reaching this is the failure: it stands in for the network. */
const forbiddenFetch = () => {
  throw new Error("FetchLike was reached — the arming boundary leaked");
};

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE A/B/C/D MATRIX — can external-send reach the network?
 *
 * The runtime reads the kill switch as gate 1 and configuration as gate 4, both BEFORE the permit
 * is spent. So neither half alone can ever construct a transport.
 * ═════════════════════════════════════════════════════════════════════════ */
async function armingMatrix(): Promise<void> {
  const cases = [
    { label: "A config ABSENT + control ABSENT", env: {}, control: null },
    { label: "B config PRESENT + control ABSENT", env: FULL, control: null },
    { label: "C config PRESENT + control DISABLED", env: FULL, control: false },
    { label: "D config ABSENT + control ENABLED", env: {}, control: true },
  ] as const;

  for (const c of cases) {
    const view = await readExternalSendOpsView({ env: c.env, repo: controlRepo(c.control) });
    /* An adapter — the only thing that owns a FetchLike — must not exist without configuration. */
    const adapter = resolveExternalSendAdapter("email", { env: c.env, fetchImpl: forbiddenFetch });
    const reachable = view.directorEnabled && adapter !== null;
    assert.equal(reachable, false, `${c.label}: the network must be unreachable`);
    assert.notEqual(view.armingState, "armed", `${c.label}: must never read as armed`);
  }

  /* E — BOTH. Only now is the transport constructible, and even then nothing is dispatched. */
  const armed = await readExternalSendOpsView({ env: FULL, repo: controlRepo(true) });
  assert.equal(armed.armingState, "armed");
  assert.equal(armed.directorEnabled, true);
  assert.ok(
    resolveExternalSendAdapter("email", { env: FULL, fetchImpl: forbiddenFetch }) !== null,
    "with BOTH halves the adapter exists — and still sends nothing by itself",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. CONFIGURATION ALONE CANNOT ARM (5), AND ARMING ALONE CANNOT SEND (4).
 * ═════════════════════════════════════════════════════════════════════════ */
async function configurationIsNotArming(): Promise<void> {
  /* Full configuration, no durable permission → configured, explicitly disarmed. */
  const configured = await readExternalSendOpsView({ env: FULL, repo: controlRepo(null) });
  assert.equal(configured.configuration, "configured");
  assert.equal(configured.directorEnabled, false, "a missing row is a DISABLED permission");
  assert.equal(configured.armingState, "configured-disarmed");

  /* Permission on, nothing configured → NOT armed, and the raw permission stays visible. */
  const enabledButBare = await readExternalSendOpsView({ env: {}, repo: controlRepo(true) });
  assert.equal(enabledButBare.armingState, "unconfigured");
  assert.equal(
    enabledButBare.directorEnabled,
    true,
    "the raw permission is never hidden behind the composite — an operator must see it",
  );
  assert.equal(checkAdapterAvailability("email", { env: {} }), "credential-unavailable");

  /* Each missing value alone is enough to keep it unconfigured. */
  for (const missing of Object.keys(FULL) as (keyof typeof FULL)[]) {
    const partial: Record<string, string> = { ...FULL };
    delete partial[missing];
    assert.equal(isExternalSendConfigured(partial), false, `${missing} alone must block configuration`);
    const view = await readExternalSendOpsView({ env: partial, repo: controlRepo(true) });
    assert.equal(view.armingState, "unconfigured", `${missing} alone must prevent ARMED`);
  }
  assert.equal(isExternalSendConfigured(FULL), true);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. WHO MAY ARM — 6, 7, 8, 9.
 * ═════════════════════════════════════════════════════════════════════════ */
function armingAuthority(): void {
  /*
   * 6/7/8 — the ONLY writer reachable from outside the control module is the platform server
   * action. Nothing in `action-execution` (the execution runtime), and nothing an agent or
   * Governance can reach, calls it.
   */
  const writer = "setExternalSendDirectorEnabled";
  const runtimeCallSites = RUNTIME_CODE.split("\n").filter(
    (l) => l.includes(writer) && !l.includes("export function"),
  );
  assert.deepEqual(
    runtimeCallSites,
    [],
    "the execution runtime must never be able to arm itself — it only READS the switch",
  );
  assert.ok(
    CONTROL_CODE.includes(`export function ${writer}`),
    "the writer lives in the control module, beside the read it guards",
  );
  assert.ok(ACTIONS_CODE.includes(writer), "the platform server action is the one caller");

  /* No agent / Heby / Governance seam may reach the writer. */
  for (const dir of ["src/features/heby-actions", "src/features/heby-answer", "src/features/governance-decision"]) {
    const code = collect(dir).map((f) => codeOf(read(f))).join("\n");
    assert.ok(!code.includes(writer), `${dir} must not be able to arm external send`);
    assert.ok(
      !code.includes("setDirectorEnabled"),
      `${dir} must not reach the generic connectivity writer either`,
    );
  }

  /*
   * 9 — arbitrary provider identifiers cannot be written. The action takes ONE boolean; the key is
   * a frozen constant inside the writer, so nothing client-supplied can steer it.
   */
  assert.ok(
    /setExternalSendConnectivityAction\(input: \{\s*enabled: boolean;\s*\}\)/.test(ACTIONS_CODE),
    "the arming action accepts a boolean and nothing else — no provider key crosses the boundary",
  );
  assert.ok(
    CONTROL_CODE.includes("EXTERNAL_SEND_PROVIDER_KEY"),
    "the writer pins the provider key itself",
  );
  assert.ok(
    !/setExternalSendDirectorEnabled\([^)]*providerKey/.test(CONTROL_CODE),
    "the writer takes no provider key parameter",
  );
  assert.notEqual(EXTERNAL_SEND_PROVIDER_KEY, CLAUDE_PROVIDER_KEY, "two keys, two blast radii");

  /* The action is authority-gated by the SAME resolver R2E established, and fails closed first. */
  const order = ["resolveTenantContext", "unauthorized", "resolveProviderControlAuthority", "forbidden"];
  let cursor = ACTIONS_CODE.indexOf("setExternalSendConnectivityAction");
  assert.ok(cursor > -1);
  for (const token of order) {
    const at = ACTIONS_CODE.indexOf(token, cursor);
    assert.ok(at > -1, `the arming action must reach ${token}`);
    cursor = at;
  }
  /* And configuration is checked BEFORE the durable write, not after. */
  const gate = ACTIONS_CODE.indexOf("configuration-incomplete", ACTIONS_CODE.indexOf("setExternalSendConnectivityAction"));
  const write = ACTIONS_CODE.indexOf("await setExternalSendDirectorEnabled");
  assert.ok(gate > -1 && write > -1 && gate < write, "enabling is refused before anything is written");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE CLAUDE CONTROL IS UNTOUCHED — 10.
 * ═════════════════════════════════════════════════════════════════════════ */
function claudeUnchanged(): void {
  const claudeCode = codeOf(read("src/features/heby-provider-ops/provider-connectivity-control.server.ts"));
  assert.ok(claudeCode.includes('export const CLAUDE_PROVIDER_KEY = "claude"'));
  assert.ok(claudeCode.includes("export function setClaudeDirectorEnabled"));
  assert.ok(claudeCode.includes("export function resolveClaudeDirectorEnabled"));
  /* The generic repository still takes a key — this phase reused it rather than forking it. */
  assert.ok(
    /setDirectorEnabled\(\s*providerKey/.test(claudeCode) ||
      claudeCode.includes("setDirectorEnabled(providerKey"),
    "the generic writer still accepts a provider key — one table, one authority",
  );
  /* Exactly ONE schema owns connectivity control. No second table was created. */
  const schemas = collect("src/db/schema").filter((f) => /connectivity|kill.?switch|arming/i.test(f));
  assert.deepEqual(
    schemas,
    ["src/db/schema/provider-connectivity-control.ts"],
    "there must be exactly one connectivity-control table",
  );
  assert.ok(ACTIONS_CODE.includes("setClaudeConnectivityAction"), "the Claude action still exists");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. NOTHING SENSITIVE CROSSES — 11, 12.
 * ═════════════════════════════════════════════════════════════════════════ */
async function secretFirewall(): Promise<void> {
  const view = await readExternalSendOpsView({ env: FULL, repo: controlRepo(true) });
  const serialized = JSON.stringify(view);
  for (const secret of [
    FULL.HEBUN_EXTERNAL_SEND_API_KEY,
    FULL.HEBUN_EXTERNAL_SEND_FROM,
    FULL.HEBUN_EXTERNAL_SEND_SUBJECT,
  ]) {
    assert.ok(!serialized.includes(secret), "the view carries presence, never a configured value");
  }
  /* The view is PRESENCE vocabulary only. */
  assert.equal(view.credential, "present");
  assert.equal(view.sender, "configured");
  assert.equal(view.subject, "configured");
  /* The frozen host is shown — it is public, auditable, and cannot be moved by configuration. */
  assert.equal(view.providerEndpoint, RESEND_SEND_ENDPOINT);

  /* 11 — the client card never names a credential variable and never receives one. */
  for (const forbidden of [
    "HEBUN_EXTERNAL_SEND_API_KEY",
    "apiKey",
    "process.env",
    "Bearer",
    "localStorage",
    "sessionStorage",
  ]) {
    assert.ok(!CARD_CODE.includes(forbidden), `the client card must not reference ${forbidden}`);
  }
  assert.ok(CARD_CODE.startsWith('"use client"'), "the card is a client component, and stays secret-free");

  /*
   * 12 — the connectivity-control row holds a provider key and a boolean. No sender, no subject,
   * no message body, no address can be persisted through this authority.
   *
   * Asserted over the DECLARED COLUMNS rather than the file text: a raw word sweep flags the ES
   * `import … from` line, which is a module keyword and not a column. The precise question is
   * which columns exist, so ask that.
   */
  const schema = codeOf(read("src/db/schema/provider-connectivity-control.ts"));
  const declared = [...schema.matchAll(/(\w+):\s*(?:text|boolean|uuid|timestamp|integer)\(/g)].map(
    (m) => m[1]!,
  );
  assert.deepEqual(
    declared.sort(),
    ["directorEnabled", "providerKey"],
    "the control table declares exactly a provider key and a boolean, and nothing else",
  );
  for (const forbidden of ["sender", "subject", "recipient", "body", "content", "apiKey", "secret"]) {
    assert.ok(
      !declared.some((c) => c.toLowerCase().includes(forbidden.toLowerCase())),
      `the connectivity-control table must not carry ${forbidden}`,
    );
  }
  /* Everything else it stores comes from the shared root columns, which carry no payload. */
  assert.ok(schema.includes("...rootColumns"), "the rest is the standard root column set");

  /* Hebun never claims the sending domain is verified — Resend owns that fact. */
  assert.equal(view.senderDomainVerification, "not-established-by-hebun");
  assert.equal(view.connectivity, "not-recorded");
  assert.equal(view.lastSend, null);
  for (const forbidden of ["Verified", "verified"]) {
    assert.ok(
      !CARD_CODE.includes(`label="${forbidden}"`),
      "the card must never render a domain-verification badge Hebun cannot substantiate",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. ARMING CREATES NO OPERATIONAL SUBSTRATE — 13, 14, 15, 16.
 * ═════════════════════════════════════════════════════════════════════════ */
function armingCreatesNothing(): void {
  /*
   * The arming path is: server action → writer → repository upsert on ONE table. Proved by what
   * the two modules can even reach: no permit, no attempt, no recipient, no request, no send.
   */
  const armingPath = CONTROL_CODE + "\n" + ACTIONS_CODE;
  for (const forbidden of [
    "consumeActionPermit",
    "executeAuthorizedAction",
    "recordActionRequest",
    "createExternalRecipient",
    "createWorkArtifact",
    "actionExecutionAttempts",
    "actionPermits",
    "approveActionRequest",
    "adapter.send",
    "resolveExternalSendAdapter",
    "fetch(",
  ]) {
    assert.ok(
      !armingPath.includes(forbidden),
      `arming must not be able to reach ${forbidden} — a switch is not an execution`,
    );
  }

  /* 13 — no test in this file can open a socket: the only transport reference is a throwing stub. */
  assert.throws(forbiddenFetch, /arming boundary leaked/);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE STATE VOCABULARY IS NOT COLLAPSED.
 * ═════════════════════════════════════════════════════════════════════════ */
async function statesStayApart(): Promise<void> {
  const armed = await readExternalSendOpsView({ env: FULL, repo: controlRepo(true) });
  /* Armed is the strongest thing this surface may say, and it is still weaker than "sent". */
  assert.equal(armed.lastSend, null, "arming never implies a send");
  assert.equal(armed.connectivity, "not-recorded", "arming never implies reachability");
  assert.equal(
    armed.senderDomainVerification,
    "not-established-by-hebun",
    "arming never implies domain verification",
  );
  /* Three distinct states, all reachable, none aliased. */
  const states = new Set([
    (await readExternalSendOpsView({ env: {}, repo: controlRepo(null) })).armingState,
    (await readExternalSendOpsView({ env: FULL, repo: controlRepo(false) })).armingState,
    armed.armingState,
  ]);
  assert.deepEqual([...states].sort(), ["armed", "configured-disarmed", "unconfigured"]);
}

async function main(): Promise<void> {
  await armingMatrix();
  await configurationIsNotArming();
  armingAuthority();
  claudeUnchanged();
  await secretFirewall();
  armingCreatesNothing();
  await statesStayApart();
  console.log("R3B arming authority: all assertions passed.");
}

void main();
