/*
 * GIA-1 — DO THE GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the target suite in
 * a CHILD PROCESS, and requires it to fail FOR THE STATED REASON. A mutation that did not APPLY
 * looks exactly like a guard that did not bite, so every mutation asserts the source changed first;
 * a child killed by a timeout also exits non-zero, so the run is bounded and the status is checked.
 *
 * Every mutation is restored in `finally` and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. Never commit while it is
 * running, and never run it concurrently with another suite.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/gia1-governed-internal-action/internal-act-firewall.ts";

const REGISTRY = "src/features/heby-actions/action-registry.ts";
const EXECUTOR = "src/features/governed-internal-action/execute-record-work.server.ts";
const INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";
const WORK_WRITER = "src/features/organizational-work/write-work.server.ts";
const WORK_AUDIT = "src/features/governance-audit/organizational-work-audit.server.ts";
const PREPARER = "src/features/heby-actions/action-preparer.ts";
const ORIGINATION = "src/features/agent-origination/contracts.ts";
const DEPARTMENT_REF = "src/features/organization-authority/department-ref.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");
const CHILD_TIMEOUT_MS = 180_000;

function runSuite(suite: string): { ok: boolean; output: string; detail: string } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const detail = [
    r.status === null ? null : `exit ${r.status}`,
    r.signal ? `signal ${r.signal}` : null,
    r.error ? `spawn error ${(r.error as NodeJS.ErrnoException).code ?? ""}`.trim() : null,
  ]
    .filter(Boolean)
    .join(", ");
  return { ok: r.status === 0, output: `${r.stdout ?? ""}\n${r.stderr ?? ""}`, detail };
}

function proof(
  label: string,
  file: string,
  from: string,
  to: string,
  expected: string,
  suite: string = FIREWALL,
): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite(suite);
    assert.ok(!ok, `${label}: the suite PASSED with the defect present (${detail})`);
    assert.ok(
      output.includes(expected),
      `${label}: failed, but not for the stated reason. Expected "${expected}". Ran as: ${detail}. Output:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
}

function main(): void {
  const baseline = runSuite(FIREWALL);
  assert.ok(baseline.ok, `baseline: ${FIREWALL} must pass before any mutation (${baseline.detail})`);

  /* ── 1. A THIRD EXECUTOR APPEARS ────────────────────────────────────────
   *
   * THE LOAD-BEARING PROOF OF THIS PHASE. The old guard was a cardinality; if the replacement were
   * merely "at most two", this mutation would pass. A tool that satisfies every generic shape —
   * consequential, irreversible, human-reviewed, governance-gated — must still be refused, because
   * its KIND is not in the closed set.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "a third action kind declares a connected mutation substrate",
    REGISTRY,
    /*
     * The flag is FLIPPED, not prepended: a duplicate key later in the same object literal is
     * overwritten by the declared one, so a prepended `substrateConnected: true` would be inert and
     * the proof would silently prove nothing. Anchored on `subjectRef`, which only this tool declares.
     */
    `    substrateConnected: false,
    argumentSchema: {
      fields: [
        { name: "subjectRef", kind: "record-ref", required: true, describes: "The subject to grant to." },`,
    `    substrateConnected: true,
    argumentSchema: {
      fields: [
        { name: "subjectRef", kind: "record-ref", required: true, describes: "The subject to grant to." },`,
    "the executable set is closed",
  );

  /* ── 2. THE CLOSED SET IS WIDENED BY A LIST EDIT ────────────────────────
   *
   * Adding a posture is how a third executor SHOULD have to happen — deliberately, in this table,
   * with its own obligations. The firewall pins the exact membership so even that edit fails until
   * a human changes the pin too.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the closed executable set grows a third member",
    REGISTRY,
    `export const EXECUTABLE_ACTION_POSTURES: readonly ExecutableActionPosture[] = Object.freeze([`,
    `export const EXECUTABLE_ACTION_POSTURES: readonly ExecutableActionPosture[] = Object.freeze([
  Object.freeze({
    actionKind: "restart-workflow" as const,
    toolId: "heby.operations.restart-workflow",
    sideEffect: "CONSEQUENTIAL_MUTATION" as const,
    reversibility: "irreversible" as const,
    execution: "internal-authority" as const,
  }),`,
    /*
     * The exact-set guard's SECOND direction catches this first: a posture with no tool backing it
     * is a claim that an act is executable when nothing can perform it. That is the stronger of the
     * two failures the mutation causes, and it is the one asserted.
     */
    "an executable action kind declares no connected mutation substrate",
  );

  /* ── 3. THE INTERNAL ACT IS DESCRIBED AS IRREVERSIBLE ───────────────────
   *
   * The cheapest way to make the registry validator happy again: copy the sibling's posture. It
   * would put a false sentence in front of the human who authorizes the act.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "record-work is relabelled irreversible to match its sibling",
    REGISTRY,
    `    actionKind: "record-work",
    capability: "organizational-work-record",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "deterministic-inverse",`,
    `    actionKind: "record-work",
    capability: "organizational-work-record",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",`,
    /*
     * The per-kind posture check catches it before the human-facing sentence does: the tool no
     * longer states the reversibility its posture declares.
     */
    "connected mutation substrate must state its declared reversibility",
  );

  /* ── 4. THE SEND IS RELAXED TO ACCOMMODATE THE NEW KIND ─────────────────
   *
   * The opposite defect, and the one the Director explicitly forbade: weakening the released
   * external posture so one rule covers both.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the external send is relabelled reversible",
    REGISTRY,
    `    actionKind: "send-external-communication",
    capability: "external-communication",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",`,
    `    actionKind: "send-external-communication",
    capability: "external-communication",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "deterministic-inverse",`,
    "connected mutation substrate must state its declared reversibility",
  );

  /* ── 5. THE PERMIT STOPS BEING THE ENTRY ────────────────────────────────
   *
   * The executor takes its own database handle and mutates outside the permit's transaction. The
   * spend and the mutation stop being atomic, so an authorization could be spent with no work
   * recorded — or work recorded with no authorization spent.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the mutation leaves the permit's own transaction",
    EXECUTOR,
    `          const result = await recordWithin(tx, tenant, work!, { kind: "system" });`,
    `          const db = getControlPlaneDb();
          const result = await recordWithin(db as never, tenant, work!, { kind: "system" });`,
    "the Work Authority is called with the PERMIT'S OWN transaction, never a handle of its own",
  );

  /* ── 6. THE ACTION KIND IS NO LONGER CHECKED ────────────────────────────
   *
   * A permit that authorized an external send would be spent into a work record. The closed set
   * would exist in the registry and mean nothing at the moment of execution.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the executor stops checking which act the permit authorized",
    EXECUTOR,
    `          if (authorization.actionKind !== INTERNAL_ACTION_KIND) abort("action-kind-mismatch");`,
    `          void INTERNAL_ACTION_KIND;`,
    "the internal executor refuses a permit that authorized an external send",
    "tests/gia1-governed-internal-action/internal-act-postgres.ts",
  );

  /* ── 7. THE ATTRIBUTION COLLAPSES ───────────────────────────────────────
   *
   * The row says a human authored a mutation Hebun performed. This is the falsehood the whole
   * `WorkStateAuthor` type exists to make unrepresentable.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the system's mutation is attributed to the human who authorized it",
    WORK_WRITER,
    `      createdByType: author.kind,`,
    `      createdByType: "human",`,
    "the SYSTEM authored this state",
    "tests/gia1-governed-internal-action/internal-act-postgres.ts",
  );

  /* ── 8. THE AUDIT EVENT LIES ABOUT WHO PERFORMED IT ─────────────────────
   *
   * The row can be right and the audit wrong. They are written by different modules, so both are
   * proved separately.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the audit event attributes the act to a human",
    WORK_AUDIT,
    `    actorType: executor,`,
    `    actorType: "human",`,
    "the audit says the system performed it",
    "tests/gia1-governed-internal-action/internal-act-postgres.ts",
  );

  /* ── 9. THE APPROVED PAYLOAD IS AUGMENTED ───────────────────────────────
   *
   * A value the human never saw enters the mutation. A default is the friendly-looking form of
   * exactly that defect.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the executor invents a value the human did not approve",
    EXECUTOR,
    `  return { title, departmentId: parsed.departmentId };`,
    `  return { title, departmentId: parsed.departmentId, declaredState: "in-progress" } as never;`,
    "no value is defaulted or invented while reading the approved payload",
  );

  /* ── 10. THE PROPOSAL INLET LEARNS TO EXECUTE ───────────────────────────
   *
   * PROPOSED != EXECUTED. An inlet that can reach the executor has collapsed the whole chain into
   * one call, and the human decision in the middle becomes optional.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the proposal inlet reaches the executor",
    INLET,
    `import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";`,
    `import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import { executeRecordWork } from "@/features/governed-internal-action/execute-record-work.server";
void executeRecordWork;`,
    /* The name ban catches it first; the import-graph walk would catch it too. */
    "the proposal inlet cannot reach executeRecordWork",
  );

  /* ── 11. THE INTERNAL PATH REACHES A PROVIDER ADAPTER ───────────────────
   *
   * The firewall direction the Director asked for by name. An import is enough: reachability is the
   * property, not whether a line happens to call it.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the internal act's graph reaches the external execution runtime",
    EXECUTOR,
    `import { parseDepartmentRef } from "@/features/organization-authority/department-ref";`,
    `import { parseDepartmentRef } from "@/features/organization-authority/department-ref";
import { resolveExternalSendAdapter } from "@/features/action-execution/adapter-registry.server";
void resolveExternalSendAdapter;`,
    "the internal act reaches no execution runtime",
  );

  /* ── 12. A SECOND WORK INSERT PATH APPEARS ──────────────────────────────
   *
   * Two inserts drift: one gains a precondition the other does not, and the governed path and the
   * human path stop being the same act.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the human path grows an insert of its own",
    WORK_WRITER,
    `      outcome = await recordWorkWithin(tx, authenticated, input, { kind: "human" }, now);`,
    `      await tx.insert(workItems).values({
        tenantId: authenticated.tenantId,
        title: input.title,
        departmentId: null,
        accountableActorType: null,
        accountableActorId: null,
        createdBy: authenticated.userId,
        createdByType: "human",
        updatedBy: authenticated.userId,
        updatedByType: "human",
      });
      outcome = await recordWorkWithin(tx, authenticated, input, { kind: "human" }, now);`,
    "there is EXACTLY ONE `work_items` insert in the whole authority",
  );

  /* ── 13. THE CONSEQUENCE SENTENCE GOES BACK TO THE CLASS ────────────────
   *
   * The human reads this before authorizing. Keying it on the side-effect class again tells them a
   * reversible act is irreversible.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the consequence line is derived from the class instead of the tool",
    PREPARER,
    `      consequences.push(
        tool.reversibility === "deterministic-inverse"`,
    `      consequences.push(
        false`,
    "a human is never told this act is irreversible",
  );

  /* ── 14. THE ORIGINATION MAP LOSES ITS NEW ENTRY ────────────────────────
   *
   * A mandate could then name `record-work` while the ceiling resolved it to nothing — an in-scope
   * act reported as out of scope, which is the exact defect AMA-2's map was built to prevent.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the alias-to-registry-kind map drops record-work",
    ORIGINATION,
    `  [RECORD_WORK_ORIGINATION_ALIAS]: RECORD_WORK_ACTION_KIND,`,
    `  [RECORD_WORK_ORIGINATION_ALIAS]: SEND_ACTION_KIND,`,
    "the new alias maps to the released constant itself",
  );

  /* ── 15. THE REFERENCE STOPS FAILING CLOSED ─────────────────────────────
   *
   * Several spellings of one department would hash as several different payloads, so one approval
   * would no longer name one thing.
   * ─────────────────────────────────────────────────────────────────────── */
  proof(
    "the department reference parser accepts a permissive spelling",
    DEPARTMENT_REF,
    `  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value);`,
    `  if (typeof value !== "string") return null;
  const match = REF_RE.exec(value.trim().toLowerCase());`,
    "is not a reference",
  );

  console.log("gia1-governed-internal-action/bite-proofs: all guards bit.");
}

main();
