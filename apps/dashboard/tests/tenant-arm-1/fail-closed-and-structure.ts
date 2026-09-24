/*
 * TENANT-ARM-1 — FAIL-CLOSED COMPOSITION AND STRUCTURAL FIREWALL (pure, no database).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "There is NO input and NO failure that yields `reachable`. Execution authority is never
 *    inferred from a credential, a provider connection, a capability descriptor or the legacy
 *    global row alone. The executor's two kill-switch sites go through the conjunction. No second
 *    arming authority was created, the root control was not re-keyed, the frozen machine action set
 *    was not widened, and no publishing, scheduling or write-scope capability was added."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveExternalSendReachability } from "../../src/features/tenant-external-send-authority/resolve-external-send-reachability.server";
import { readExternalSendOpsView } from "../../src/features/action-execution/execution-arming-projection.server";
import {
  TENANT_EXTERNAL_SEND_ARMED_OUTCOME,
  TENANT_EXTERNAL_SEND_DISARMED_OUTCOME,
  TENANT_EXTERNAL_SEND_DOMAIN,
  TENANT_EXTERNAL_SEND_SUBJECT_TYPE,
  TENANT_EXTERNAL_SEND_WORDING,
} from "../../src/features/tenant-external-send-authority/contracts";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
/** Comments are prose about the code, not the code. Structural claims must hold on the code. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const TENANT = "11111111-1111-4111-8111-111111111111";
const FULL_ENV = Object.freeze({
  HEBUN_EXTERNAL_SEND_API_KEY: "test-key-never-real",
  HEBUN_EXTERNAL_SEND_FROM: "nobody@example.invalid",
  HEBUN_EXTERNAL_SEND_SUBJECT: "A message from Hebun",
});

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. NO INPUT AND NO FAILURE YIELDS `reachable`.
   * ═══════════════════════════════════════════════════════════════════════ */
  const armed = async () =>
    ({ status: "read", effective: { state: "active" } }) as never;
  const withdrawn = async () =>
    ({ status: "read", effective: { state: "withdrawn" } }) as never;
  const absent = async () => ({ status: "absent" }) as never;
  const unavailable = async () => ({ status: "unavailable" }) as never;

  const cases: ReadonlyArray<readonly [string, object, string | null]> = [
    ["tenant absent, root on", { readTenant: absent, rootEnabled: async () => true }, "tenant-not-armed"],
    ["tenant withdrawn, root on", { readTenant: withdrawn, rootEnabled: async () => true }, "tenant-arming-withdrawn"],
    ["tenant unreadable, root on", { readTenant: unavailable, rootEnabled: async () => true }, "persistence-unavailable"],
    ["tenant armed, root off", { readTenant: armed, rootEnabled: async () => false }, "root-control-disabled"],
    ["tenant absent, root off", { readTenant: absent, rootEnabled: async () => false }, "tenant-not-armed"],
    ["tenant withdrawn, root off", { readTenant: withdrawn, rootEnabled: async () => false }, "tenant-arming-withdrawn"],
    ["tenant armed, root on", { readTenant: armed, rootEnabled: async () => true }, null],
  ];

  for (const [label, deps, expected] of cases) {
    const got = await resolveExternalSendReachability(TENANT, deps);
    if (expected === null) {
      assert.equal(got.status, "reachable", `${label} → reachable (the ONLY reachable combination)`);
    } else {
      assert.equal(got.status === "refused" && got.reason, expected, `${label} → ${expected}`);
    }
  }

  /* A THROWING ROOT READ REFUSES RATHER THAN PERMITS. */
  await assert.rejects(
    resolveExternalSendReachability(TENANT, {
      readTenant: armed,
      rootEnabled: async () => {
        throw new Error("control plane exploded");
      },
    }),
    /control plane exploded/,
    "a throwing root read propagates — it never resolves to reachable",
  );

  /* SPECIFICITY WINS: a withdrawal is never disguised as an operator stop. */
  const disguised = await resolveExternalSendReachability(TENANT, {
    readTenant: withdrawn,
    rootEnabled: async () => false,
  });
  assert.equal(
    disguised.status === "refused" && disguised.reason,
    "tenant-arming-withdrawn",
    "the tenant's own fact is resolved FIRST, so an outage cannot hide a decision",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. THE PROJECTION NEVER GUESSES A PERMISSION.
   * ═══════════════════════════════════════════════════════════════════════ */
  const noContext = await readExternalSendOpsView({
    env: FULL_ENV,
    repo: null,
    tenantId: null,
  });
  assert.equal(noContext.tenantArming, "not-established", "no session → not established, never 'armed'");
  assert.equal(noContext.effectiveSend, "blocked", "and the composite blocks");

  const rootArmedOnly = await readExternalSendOpsView({
    env: FULL_ENV,
    rootEnabled: async () => true,
    readTenant: absent,
    tenantId: TENANT,
  } as never);
  assert.equal(rootArmedOnly.tenantArming, "never-armed", "an unarmed tenant is reported as such");
  assert.equal(
    rootArmedOnly.effectiveSend,
    "blocked",
    "the deployment being armed does NOT make this organization able to send",
  );

  /*
   * THE DEPLOYMENT HALF IS READ THROUGH THE RELEASED ROOT READER, so proving the composite needs a
   * root row rather than an injected predicate. This fake IS that row, and nothing else.
   */
  const enabledRootRepo = {
    getControl: async (providerKey: string) => ({
      providerKey,
      directorEnabled: true,
      version: 1,
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
    }),
  };

  const both = await readExternalSendOpsView({
    env: FULL_ENV,
    repo: enabledRootRepo,
    rootEnabled: async () => true,
    readTenant: armed,
    tenantId: TENANT,
  } as never);
  assert.equal(both.armingState, "armed", "the deployment half is armed and configured");
  assert.equal(both.tenantArming, "armed", "and this organization holds its own arming");
  assert.equal(both.effectiveSend, "reachable", "both halves present → reachable");

  const unconfigured = await readExternalSendOpsView({
    env: {},
    repo: enabledRootRepo,
    rootEnabled: async () => true,
    readTenant: armed,
    tenantId: TENANT,
  } as never);
  assert.equal(unconfigured.armingState, "unconfigured", "no credential, sender or subject");
  assert.equal(
    unconfigured.effectiveSend,
    "blocked",
    "an armed tenant on an unconfigured deployment still cannot send",
  );

  /* AND THE INVERSE, WHICH IS THE PHASE'S WHOLE POINT: root fully armed, tenant not. */
  const rootFullyArmedTenantAbsent = await readExternalSendOpsView({
    env: FULL_ENV,
    repo: enabledRootRepo,
    rootEnabled: async () => true,
    readTenant: absent,
    tenantId: TENANT,
  } as never);
  assert.equal(rootFullyArmedTenantAbsent.armingState, "armed", "the deployment says 'armed'");
  assert.equal(
    rootFullyArmedTenantAbsent.effectiveSend,
    "blocked",
    "and this organization STILL cannot send — the legacy global state authorizes nobody",
  );

  /* NO SECRET IS EVER PROJECTED. */
  const serialized = JSON.stringify(both);
  assert.ok(!serialized.includes("test-key-never-real"), "the credential value never reaches the view");
  assert.ok(!serialized.includes("nobody@example.invalid"), "the sender address never reaches the view");

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. THE EXECUTOR GOES THROUGH THE CONJUNCTION — AT BOTH SITES.
   * ═══════════════════════════════════════════════════════════════════════ */
  const executor = read("src/features/action-execution/execute-authorized-action.server.ts");
  const executorCode = codeOf(executor);
  const conjunctionCalls = executorCode.match(/resolveExternalSendReachability\(/g) ?? [];
  assert.equal(
    conjunctionCalls.length,
    /*
     * PUBLISH-0: ONE shared site before the spend, plus one immediately before dispatch PER external
     * kind (the send's adapter, the Instagram publish). Every site still goes through the conjunction.
     */
    3,
    "every kill-switch site — before the spend, and immediately before each external dispatch — goes through it",
  );
  assert.ok(
    !/resolveExternalSendEnabled\s*\(/.test(executorCode),
    "the executor no longer reads the ROOT half on its own, which would be the containment bypass",
  );
  assert.ok(
    executorCode.includes("resolveExternalSendReachability(tenant.tenantId"),
    "the tenant comes from the authenticated TenantContext and from nowhere else",
  );
  assert.ok(
    !/resolveExternalSendReachability\(\s*input\./.test(executorCode),
    "it is never taken from caller input",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. NO SECOND ARMING AUTHORITY, AND NO TENANT INPUT ON THE WRITER.
   * ═══════════════════════════════════════════════════════════════════════ */
  const writer = read("src/features/tenant-external-send-authority/authorize-tenant-external-send.server.ts");
  const writerCode = codeOf(writer);
  assert.ok(
    !/readonly\s+tenantId\s*[?:]/.test(writerCode),
    "the write input has NO tenantId field — a client cannot choose the tenant being armed",
  );
  assert.ok(
    writerCode.includes("authenticated.tenantId"),
    "the tenant is read off the authenticated context",
  );
  assert.ok(
    writerCode.includes('authorizedByActorType: "human"'),
    "and the authorizer is a human, matched by the database CHECK",
  );

  /* THE ROOT CONTROL'S OWN MODULES WERE NOT GIVEN A WRITER OR A TENANT DIMENSION. */
  const rootSchema = read("src/db/schema/provider-connectivity-control.ts");
  assert.ok(
    !codeOf(rootSchema).includes("tenantColumns"),
    "the root control is still root-scoped — it gained no tenant dimension",
  );
  assert.ok(
    codeOf(rootSchema).includes('uniqueIndex("provider_connectivity_controls_provider_key_uq").on(t.providerKey)'),
    "and its identity is still provider_key ALONE",
  );
  const rootReader = read("src/features/heby-provider-ops/provider-connectivity-control.server.ts");
  assert.ok(
    !/setDirectorEnabled|setExternalSendDirectorEnabled/.test(codeOf(rootReader)),
    "R5.1's removal of the in-app root writer survives this phase",
  );

  /* EXACTLY ONE MODULE COMPOSES THE TWO HALVES. */
  const composition = read(
    "src/features/tenant-external-send-authority/resolve-external-send-reachability.server.ts",
  );
  const compositionCode = codeOf(composition);
  assert.ok(!/insert\(|update\(|delete\(|transaction\(/.test(compositionCode),
    "the composition writes nothing — it cannot become a third source of truth");
  for (const f of ["credential", "apiKey", "connection", "capabilityDescriptor"]) {
    assert.ok(!compositionCode.includes(f), `authority is never inferred from ${f}`);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. NOTHING WAS WIDENED. NO PUBLISHING, NO SCHEDULING, NO WRITE SCOPES.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.deepEqual(
    [...MACHINE_EXECUTABLE_ACTION_KINDS],
    [RECORD_WORK_ACTION_KIND],
    "the frozen machine action set is untouched — record-work and nothing else",
  );
  assert.ok(
    !MACHINE_EXECUTABLE_ACTION_KINDS.has("send-external-communication"),
    "external sending did NOT become a machine capability",
  );

  const phaseFiles = [
    "src/features/tenant-external-send-authority/contracts.ts",
    "src/features/tenant-external-send-authority/read-tenant-external-send.server.ts",
    "src/features/tenant-external-send-authority/resolve-external-send-reachability.server.ts",
    "src/features/tenant-external-send-authority/authorize-tenant-external-send.server.ts",
    "src/db/schema/tenant-external-send-authorization.ts",
    "scripts/tenant-arm-external-send.ts",
  ];
  /*
   * CAPABILITIES ARE PROVEN ABSENT AS CODE, NOT AS WORDS. The ceremony's console output says
   * "nothing schedules, times or queues a send" — prose that a substring scan would read as the
   * very capability it denies. So the patterns below match CALL and IMPORT forms, and string
   * literals are stripped first, which is what actually distinguishes a capability from a denial.
   */
  const withoutStrings = (code: string): string =>
    code.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/`(?:[^`\\]|\\.)*`/g, "``");

  const FORBIDDEN_CAPABILITIES: ReadonlyArray<readonly [string, RegExp]> = [
    ["Instagram publishing", /instagram/i],
    ["a publish call", /\bpublish\w*\s*\(/i],
    ["a Meta Graph endpoint", /graph\.facebook/i],
    ["a timer", /\bsetInterval\s*\(|\bsetTimeout\s*\(/],
    ["a scheduler", /\bcron\b|\bscheduleJob\s*\(|node-cron/i],
    ["Computer Use", /computer[-_]?use/i],
    ["a provider write scope", /write[_-]scope|scope=.*write/i],
  ];

  for (const file of phaseFiles) {
    const code = withoutStrings(codeOf(read(file)));
    for (const [label, pattern] of FORBIDDEN_CAPABILITIES) {
      assert.ok(!pattern.test(code), `${file} introduces no ${label}`);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. THE VOCABULARY KEEPS ITS DISTINCTIONS.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.equal(TENANT_EXTERNAL_SEND_DOMAIN, "external-send");
  assert.equal(TENANT_EXTERNAL_SEND_SUBJECT_TYPE, "tenant_external_send_authorization");
  assert.notEqual(
    TENANT_EXTERNAL_SEND_ARMED_OUTCOME,
    TENANT_EXTERNAL_SEND_DISARMED_OUTCOME,
    "arming and disarming are different ledger outcomes",
  );
  assert.ok(
    TENANT_EXTERNAL_SEND_WORDING["tenant-not-armed"].includes("never been armed"),
    "the surface says nobody armed it, not that something failed",
  );
  assert.ok(
    TENANT_EXTERNAL_SEND_WORDING["persistence-unavailable"].includes("not a decision"),
    "and an outage is never presented as a decision",
  );
  assert.ok(
    TENANT_EXTERNAL_SEND_WORDING.reachable.includes("permit is still required"),
    "being armed never implies a send is authorized",
  );

  console.log("TENANT-ARM-1 fail-closed composition + structural firewall: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
