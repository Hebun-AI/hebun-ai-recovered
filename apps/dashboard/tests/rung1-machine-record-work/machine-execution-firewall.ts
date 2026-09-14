/*
 * RUNG 1 — THE ARCHITECTURAL FIREWALL.
 *
 * The behaviour suite proves what the capability DOES. This one proves what it cannot become: a
 * machine that authorizes, that widens what it was authorized to do, or that quietly grows a second
 * executable action because somebody added a string somewhere.
 *
 * Every assertion below reads released source rather than trusting a comment, and the bans are
 * matched against COMMENT- AND STRING-STRIPPED code so that honest prose naming a forbidden module
 * cannot satisfy or violate a rule.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

const PRINCIPAL = "src/features/action-authorization/machine-execution-principal.server.ts";
const CONSUMER = "src/features/action-authorization/consume-action-permit.server.ts";
const EXECUTOR = "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts";
/*
 * THE ALLOWLIST MOVED HOUSE, AND THE PROPERTY DID NOT.
 *
 * The RUNG 2 prerequisite gave the executor a tenant-reachability check, and the composition that
 * answers it needs the same frozen set — so leaving the constant in the executor would have made
 * the two modules import each other. TypeScript compiles such a cycle and ESM resolves it to
 * `undefined` at runtime, where `undefined.has(...)` THROWS on the arming path: worse than any
 * refusal. So the VOCABULARY lives here now and the executor RE-EXPORTS it, which is asserted
 * below so the move cannot become a second definition.
 */
const ACTION_KINDS = "src/features/governed-machine-execution/contracts.ts";
const CONTROL = "src/features/governed-machine-execution/machine-execution-control.server.ts";
const WORK_WRITER = "src/features/organizational-work/write-work.server.ts";
const PERMIT_SCHEMA = "src/db/schema/action-authorization.ts";

/* ── 1. THE PRINCIPAL IS NOT A `TenantContext`, AND CANNOT BECOME ONE ─────── */
function thePrincipalIsItsOwnType(): void {
  const src = codeOf(read(PRINCIPAL));
  assert.ok(
    !src.includes("TenantContext"),
    "the machine principal neither imports nor mentions the human context type in code",
  );
  assert.ok(
    !/extends\s+TenantContext/.test(src),
    "and it is not a subtype of one",
  );
  /* 2. THE BRAND IS A RUNTIME SYMBOL AND IS NEVER EXPORTED — a cast cannot forge one. */
  assert.match(
    src,
    /const machineExecutionPrincipalBrand:\s*unique symbol\s*=\s*Symbol\(/,
    "the brand exists at runtime, so a type assertion cannot mint a principal",
  );
  assert.ok(
    !/export\s+(const|type)\s+machineExecutionPrincipalBrand/.test(src),
    "and it is module-private, so no other module can write the key into an object literal",
  );
  assert.ok(
    src.includes("export function isMachineExecutionPrincipal"),
    "a runtime guard exists for the spend door to use",
  );
}

/* ── 3+4. IT CANNOT AUTHORIZE, AND IT CANNOT MINT AN AUTHORIZATION ───────── */
function theMachineCannotAuthorize(): void {
  for (const file of [PRINCIPAL, EXECUTOR, CONTROL]) {
    const src = codeOf(read(file));
    for (const forbidden of [
      "decide-action-request",
      "approveActionRequest",
      "bootstrap-authority",
      "recordDecision",
      "governance-decision/write",
    ]) {
      assert.ok(
        !src.includes(forbidden),
        `${file} holds no Governance decision authority: ${forbidden}`,
      );
    }
    assert.ok(
      !/\.insert\(\s*actionPermits/.test(src),
      `${file} mints no permit`,
    );
    assert.ok(
      !/\.update\(\s*actionPermits/.test(src),
      `${file} does not rewrite a permit — not its expiry, not its scope, not its state`,
    );
  }
}

/* ── 5. EXACTLY ONE ACTION IS ADMITTED, AND WIDENING IS A CODE CHANGE ────── */
function onlyRecordWorkIsAdmitted(): void {
  const vocabulary = read(ACTION_KINDS);
  const src = read(EXECUTOR);
  const code = codeOf(src) + codeOf(vocabulary);
  assert.match(
    vocabulary,
    /MACHINE_EXECUTABLE_ACTION_KINDS[\s\S]{0,200}Object\.freeze\(/,
    "the allowlist is frozen",
  );
  assert.ok(
    vocabulary.includes("new Set<string>([RECORD_WORK_ACTION_KIND])"),
    "and its only member is `record-work`, named by the released constant",
  );
  /* EXACTLY ONE DEFINITION. The executor re-exports it and never re-declares it. */
  assert.match(
    withoutComments(src),
    /export \{ MACHINE_EXECUTABLE_ACTION_KINDS \} from "\.\/contracts"/,
    "the executor re-exports the allowlist, so released import paths still resolve",
  );
  assert.ok(
    !/const MACHINE_EXECUTABLE_ACTION_KINDS/.test(codeOf(src)),
    "and does not declare a second copy of it",
  );
  /* The vocabulary module imports nothing that could import it back. */
  assert.ok(
    !withoutComments(vocabulary).includes("execute-record-work-as-machine"),
    "the vocabulary cannot import the executor — that cycle is what this move removed",
  );
  /* Nothing may add to it at runtime. */
  for (const mutator of [".add(", ".delete(", ".clear("]) {
    assert.ok(
      !code.includes(`MACHINE_EXECUTABLE_ACTION_KINDS${mutator}`),
      `the allowlist is never mutated: ${mutator}`,
    );
  }
  assert.ok(
    !/process\.env/.test(code),
    "and no environment variable can widen it",
  );
  /* It is consulted twice: before the spend, and inside the transaction that is atomic with it. */
  const checks = code.split("MACHINE_EXECUTABLE_ACTION_KINDS.has(").length - 1;
  assert.equal(checks, 2, "the allowlist is checked before the spend AND inside the transaction");
}

/* ── 6+7. NEITHER EXTERNAL SEND NOR GIA-2 PLACEMENT IS REACHABLE ─────────── */
function noOtherActIsReachable(): void {
  const src = codeOf(read(EXECUTOR));
  for (const forbidden of [
    "action-execution/execute-authorized-action",
    "action-execution-live",
    "adapter-registry",
    "resend",
    "execute-place-human",
    "write-placement",
    "placeUnplacedHumanWithin",
    "executeAuthorizedAction",
  ]) {
    assert.ok(
      !src.toLowerCase().includes(forbidden.toLowerCase()),
      `the machine path cannot reach ${forbidden}`,
    );
  }
}

/* ── 8. TRUSTED IDENTITY CANNOT ARRIVE FROM A CALLER ─────────────────────── */
function identityIsNeverSupplied(): void {
  const exec = read(EXECUTOR);
  const signature = exec.slice(
    exec.indexOf("export async function executeRecordWorkAsMachine"),
    exec.indexOf("): Promise<MachineRecordWorkResult> {"),
  );
  for (const forbidden of ["tenantId", "agentId", "actionKind", "payload", "title"]) {
    assert.ok(
      !signature.includes(forbidden),
      `the entry point takes no ${forbidden} — the caller supplies a permit id and nothing else`,
    );
  }
  const principal = read(PRINCIPAL);
  const mintSig = principal.slice(
    principal.indexOf("export async function mintMachineExecutionPrincipal"),
    principal.indexOf("): Promise<MachinePrincipalResult> {"),
  );
  assert.ok(
    !mintSig.includes("tenantId"),
    "and the mint takes no tenant either — the tenant is a property of the permit row",
  );
  assert.match(
    codeOf(read(PRINCIPAL)),
    /tenantId:\s*permit\.tenantId/,
    "it is READ off the permit, never received",
  );
}

/* ── 9+11. ONE SINGLE-SPEND STATEMENT SERVES BOTH DOORS ──────────────────── */
function thereIsExactlyOneSpend(): void {
  const consumer = codeOf(read(CONSUMER));
  const spends = consumer.split(".update(actionPermits)").length - 1;
  assert.equal(spends, 1, "one UPDATE spends a permit, and both doors go through it");

  /* No OTHER module spends one. */
  const spenders = walk("src").filter(
    (f) => f !== CONSUMER && /\.update\(\s*actionPermits/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    spenders.filter((f) => !f.includes("revoke-action-permit")),
    [],
    "no second module learned to consume an authorization",
  );

  assert.ok(
    consumer.includes("export async function consumeActionPermit(") &&
      consumer.includes("export async function consumeActionPermitAsMachine("),
    "two typed doors exist",
  );
  assert.ok(
    !/export\s+(interface|type)\s+PermitSpendCaller/.test(consumer),
    "and the caller shape they share is module-private, so nobody else can assemble one",
  );
  assert.ok(
    consumer.includes("if (!isMachineExecutionPrincipal(principal)) return refused("),
    "the machine door verifies the runtime brand before spending",
  );
}

/* ── 10. THE KILL SWITCH IS MANDATORY AND FAILS CLOSED ───────────────────── */
function theSwitchIsMandatory(): void {
  const control = codeOf(read(CONTROL));
  assert.ok(
    control.includes("resolveDirectorEnabled(MACHINE_INTERNAL_EXECUTION_CONTROL_KEY"),
    "the control reuses the released fail-closed read rather than inventing one",
  );
  assert.ok(
    !/export\s+(async\s+)?function\s+set/.test(control),
    "and it ships no writer — arming stays a deployment-possession ceremony",
  );
  const key = read(CONTROL);
  for (const other of ["external-send", "provider-observation-read", "claude"]) {
    assert.ok(
      !key.includes(`= "${other}"`),
      `the key is this capability's own, not ${other}'s`,
    );
  }
  const exec = read(EXECUTOR);
  const armedAt = exec.indexOf("await armed(deps)");
  const mintAt = exec.indexOf("await mint(");
  assert.ok(armedAt > 0 && mintAt > armedAt, "arming is read BEFORE a principal is minted");
}

/* ── 12. THE AUTHORIZER IS HUMAN, IN THE DATABASE ────────────────────────── */
function authorizationStaysHuman(): void {
  const schema = read(PERMIT_SCHEMA);
  assert.ok(
    schema.includes("action_permits_human_authorizer_chk"),
    "an agent may never authorize a consequential act — enforced by CHECK, not by convention",
  );
  assert.ok(
    schema.includes("heby_action_requests_human_approver_chk"),
    "and the approver is human by CHECK too",
  );
}

/* ── 13. THE MACHINE ACT TELLS THE TRUTH ABOUT ITSELF ────────────────────── */
function theActIsHonest(): void {
  const writer = read(WORK_WRITER);
  const door = writer.slice(writer.indexOf("export async function recordWorkWithinAsMachine"));
  assert.ok(
    door.includes("createdBy: null") || writer.includes("createdBy: ctx.createdBy"),
    "no human is named as the creator of a machine-triggered row",
  );
  assert.match(door, /executor:\s*WorkAuditExecutor\s*=\s*"system"/, "HEBUN performed it");
  assert.match(door, /userId:\s*principal\.agentId/, "and the audit correlates to the durable agent");
  assert.match(door, /kind:\s*"system"/, "the row is authored `system`, exactly as GIA-1 authors it");
  /* The released two-value vocabulary was NOT widened to admit an agent performer. */
  assert.match(
    withoutComments(read("src/features/governance-audit/organizational-work-audit.server.ts")),
    /export type WorkAuditExecutor = "human" \| "system";/,
    "an agent proposes, it never performs — the released rule is untouched",
  );
}

/* ── 14. THERE IS NO TRIGGER, AND NO PRODUCT SURFACE REACHES THIS ────────── */
function nothingTriggersItYet(): void {
  const callers = [...walk("src/app"), ...walk("src/components")].filter((f) =>
    codeOf(read(f)).includes("executeRecordWorkAsMachine"),
  );
  assert.deepEqual(
    callers,
    [],
    "RUNG 1 makes an act machine-TRIGGERABLE; no route, page or server action triggers it",
  );
  const exec = codeOf(read(EXECUTOR));
  for (const forbidden of ["setInterval", "setTimeout", "cron", "schedule"]) {
    assert.ok(!exec.includes(forbidden), `and it schedules nothing itself: ${forbidden}`);
  }
}

function main(): void {
  thePrincipalIsItsOwnType();
  theMachineCannotAuthorize();
  onlyRecordWorkIsAdmitted();
  noOtherActIsReachable();
  identityIsNeverSupplied();
  thereIsExactlyOneSpend();
  theSwitchIsMandatory();
  authorizationStaysHuman();
  theActIsHonest();
  nothingTriggersItYet();
  console.log("rung1 machine execution firewall: OK");
}

main();
