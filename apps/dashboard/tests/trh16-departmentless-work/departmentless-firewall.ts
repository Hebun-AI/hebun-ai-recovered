/*
 * TRH-16 — governed `record-work` declares its organizational scope, and refuses to infer one.
 *
 * ── THE INVARIANT THIS REPLACES, AND WHY THE REPLACEMENT IS STRICTER ─────────
 *
 * Released, GIA-1 held:
 *
 *     "every governed record-work proposal must name a department"
 *
 * That was strictness in the right spirit and the wrong shape. The reason the governed path is
 * stricter than the human path is stated in the action registry: "a proposal that named nothing
 * real would put a decision about a fiction in front of the Director". THE THREAT IS FICTION, NOT
 * ABSENCE. But `recordWorkWithin` — the authority that OWNS work — has always accepted
 * `departmentId = null`, and an organization with no departments is a valid organization. So the
 * old rule did not merely prevent fiction; for such an organization it FORCED one, because the only
 * way to propose was to name a department that did not exist.
 *
 * This suite pins the replacement:
 *
 *     "every governed record-work proposal must EXPLICITLY DECLARE either a real in-service
 *      department of this tenant, or organization-level work; and no malformed, fabricated,
 *      foreign-tenant or retired organizational reference may enter Governance"
 *
 * That is stricter, not looser. Before, a proposal had to carry a reference. Now it must carry a
 * DECLARATION — and every reference check that existed still runs, unchanged, on the branch that
 * declares one.
 *
 *     EXPLICIT ABSENCE       != MALFORMED REFERENCE
 *     DEPARTMENTLESS WORK    != FICTIONAL DEPARTMENT
 *     EXPLICIT ORGANIZATION-LEVEL != OMITTED REQUIRED INPUT
 *
 * ── WHAT THIS SUITE DOES NOT CLAIM ───────────────────────────────────────────
 *
 * Nothing here says Heby can originate a record-work proposal. It cannot: `record-work` is
 * deliberately not model-selectable, and the agent-originated inlet has no production caller. Those
 * are measured facts pinned at the end, so this phase's scope cannot later be mistaken for a
 * capability it did not deliver.
 *
 * Source-level plus in-process contract execution. No database, no LLM, no network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { prepareAction } from "../../src/features/heby-actions/action-preparer";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { parseAgentActionSelection } from "../../src/features/agent-origination/structured-output";
import {
  formatOrganizationRef,
  isOrganizationRef,
  parseOrganizationRef,
} from "../../src/features/organization-authority/organization-ref";

const ROOT = process.cwd();
const REGISTRY = "src/features/heby-actions/action-registry.ts";
const INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";
const EXECUTOR = "src/features/governed-internal-action/execute-record-work.server.ts";
const WORK_WRITER = "src/features/organizational-work/write-work.server.ts";
const CAPABILITY_GATE = "src/features/heby-actions/capability-gate.ts";
const WORK_SCHEMA = "src/db/schema/work-item.ts";

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** The department branch, exactly as the resolver builds it. */
function preparedWith(args: Readonly<Record<string, unknown>>, evidence: readonly unknown[] = []) {
  return prepareAction({
    actionKind: RECORD_WORK_ACTION_KIND,
    requestingWorkspace: "command",
    target: { kind: "record", ref: "department/11111111-2222-3333-4444-555555555555", label: "Finance" },
    proposedArguments: args,
    evidence: evidence as never,
  });
}

function main(): void {
  /* ── 1. THE DISCRIMINATOR IS REQUIRED, AND CLOSED ─────────────────────────
   *
   * The registry — not the resolver — is what makes silence impossible. A required enum means a
   * proposal that declares nothing cannot reach human review at all.
   */
  const registry = read(REGISTRY);
  assert.match(
    registry,
    /name: "departmentScope",\s*\n\s*kind: "enum",\s*\n\s*required: true,/,
    "the scope discriminator is a REQUIRED enum — declaring nothing is not a proposal",
  );
  assert.match(
    registry,
    /enumValues: \["department", "organization-level"\]/,
    "and it is closed at exactly the two organizational truths",
  );
  assert.match(
    registry,
    /name: "departmentRef",\s*\n\s*kind: "record-ref",\s*\n\s*required: false,/,
    "the reference is optional — supplied on the department branch, absent on the other",
  );

  /* ── 2. THE GENERIC RECORD-REF RULE IS UNWEAKENED ─────────────────────────
   *
   * Optionality here is safe ONLY because the shared gate already distinguishes absent from
   * unresolvable. If that rule ever changed, this phase's reasoning would be void — so it is
   * pinned here rather than assumed.
   */
  const gate = codeOf(read(CAPABILITY_GATE));
  assert.match(
    gate,
    /if \(value === undefined\) continue;/,
    "an absent optional record-ref resolves nothing",
  );
  assert.match(
    gate,
    /const backed = typeof value === "string" && evidence\.some\(\(e\) => e\.recordRef === value\);/,
    "a SUPPLIED record-ref must still be backed by a real retrieval",
  );

  /* ── 3. A DECLARED DEPARTMENT STILL REACHES HUMAN REVIEW ──────────────────
   *
   * The released path, unchanged.
   */
  const withDepartment = preparedWith(
    {
      title: "Q3 supplier audit",
      departmentScope: "department",
      departmentRef: "department/11111111-2222-3333-4444-555555555555",
    },
    [
      {
        sourceClass: "organization",
        recordRef: "department/11111111-2222-3333-4444-555555555555",
        lifecycle: "settled",
      },
    ],
  );
  assert.equal(
    withDepartment.lifecycleState,
    "REQUIRES_HUMAN_REVIEW",
    "a declared, evidenced department still prepares for human review",
  );

  /* ── 4. EXPLICIT ORGANIZATION-LEVEL WORK IS REPRESENTABLE ─────────────────
   *
   * The whole point of the phase. No reference, no evidence, and it still reaches human review —
   * because nothing was named, so nothing needed retrieving.
   */
  const ORG_ID = "9947c78e-2080-4331-81c6-456cb4be7a96";
  const orgRef = formatOrganizationRef(ORG_ID);
  const orgLevel = prepareAction({
    actionKind: RECORD_WORK_ACTION_KIND,
    requestingWorkspace: "command",
    target: { kind: "record", ref: orgRef, label: "Turkish Rug House", sourceClass: "organization" },
    proposedArguments: { title: "Q3 supplier audit", departmentScope: "organization-level" },
    evidence: [{ sourceClass: "organization", recordRef: orgRef, lifecycle: "settled" }],
  });
  assert.equal(
    orgLevel.lifecycleState,
    "REQUIRES_HUMAN_REVIEW",
    "explicit organization-level work prepares for human review, naming no department",
  );

  /* ── 4b. THE EVIDENCE RULE WAS ANSWERED, NOT LOWERED ──────────────────────
   *
   * The load-bearing half. Organization-level work is a CONSEQUENTIAL_MUTATION and still needs one
   * real reference; it earns it by citing the organization it is scoped to. If this branch could
   * prepare with nothing retrieved, the rule would have been weakened rather than satisfied.
   */
  const orgLevelNoEvidence = prepareAction({
    actionKind: RECORD_WORK_ACTION_KIND,
    requestingWorkspace: "command",
    target: { kind: "record", ref: orgRef, label: "Turkish Rug House", sourceClass: "organization" },
    proposedArguments: { title: "Q3 supplier audit", departmentScope: "organization-level" },
    evidence: [],
  });
  assert.notEqual(
    orgLevelNoEvidence.lifecycleState,
    "REQUIRES_HUMAN_REVIEW",
    "organization-level work with NOTHING retrieved is still refused — the evidence rule stands",
  );
  const gateSource = codeOf(read(CAPABILITY_GATE));
  assert.match(
    gateSource,
    /case "CONSEQUENTIAL_MUTATION":[\s\S]*?return 1;/,
    "and the minimum itself is untouched at 1 for consequential mutations",
  );

  /* ── 4c. THE ORGANIZATION REFERENCE VOCABULARY FAILS CLOSED ───────────────
   *
   * Same shape `department-ref` established. Formatting asserts nothing about existence — that is
   * the resolver's question — but a malformed reference must never become a string in a payload
   * that gets hashed into an approval.
   */
  assert.equal(orgRef, `organization/${ORG_ID}`, "the canonical reference is `organization/<uuid>`");
  assert.equal(
    parseOrganizationRef(orgRef)?.organizationId,
    ORG_ID,
    "and it round-trips to the id it names",
  );
  for (const malformed of [
    "organization/not-a-uuid",
    "organization/",
    `Organization/${ORG_ID}`,
    `organization/${ORG_ID} `,
    ` organization/${ORG_ID}`,
    `department/${ORG_ID}`,
    ORG_ID,
    "",
    null,
    undefined,
    42,
    {},
  ]) {
    assert.equal(
      isOrganizationRef(malformed),
      false,
      `a malformed organization reference is refused: ${JSON.stringify(malformed)}`,
    );
  }
  assert.throws(
    () => formatOrganizationRef("not-a-uuid"),
    /uuid organization id/,
    "formatting a non-uuid throws loudly rather than returning a malformed reference",
  );
  /* A department reference is not an organization reference, and neither parses as the other. */
  assert.equal(parseOrganizationRef(`department/${ORG_ID}`), null, "namespaces do not cross");

  /* ── 4d. THE CITED ORGANIZATION COMES FROM THE AUTHORITY, NOT THE CALLER ──
   *
   * Tenant isolation, and the reason a cross-tenant or nonexistent organization cannot be cited:
   * the resolver reads `readOrganizationAuthority`, which takes NO organization parameter, and
   * formats the id from that answer. There is no input through which another organization could
   * arrive, so a spoofed reference is unrepresentable rather than merely rejected.
   */
  const inletSource = codeOf(read(INLET));
  assert.match(
    inletSource,
    /formatOrganizationRef\(authoritative\.organization\.organizationId\)/,
    "the cited organization is the AUTHORITY's answer for this tenant, never a caller-supplied id",
  );
  assert.ok(
    !/organizationRef|formatOrganizationRef/.test(
      inletSource.slice(0, inletSource.indexOf("readOrganizationAuthority")),
    ),
    "no organization reference is built before the authority has been read",
  );

  /* ── 5. AND IT IS STILL A DECISION A HUMAN MAKES ──────────────────────────
   *
   * Organization-level is not a quieter act. Same governance, same review, same reversibility
   * sentence — the only thing removed is a department that did not exist.
   */
  const consequences = orgLevel.consequences.join(" ");
  assert.ok(
    !/irreversibly/i.test(consequences),
    "organization-level work is not described as irreversible, because it is not",
  );
  assert.match(consequences, /deterministic inverse/i, "and the inverse is still disclosed");

  /* ── 6. SILENCE IS NOT A DECLARATION ──────────────────────────────────────
   *
   * The exact regression this phase must never introduce: a proposal that omits the scope quietly
   * becoming organization-level. It must fail to prepare at all.
   */
  const noScope = preparedWith({ title: "Q3 supplier audit" });
  assert.notEqual(
    noScope.lifecycleState,
    "REQUIRES_HUMAN_REVIEW",
    "a proposal declaring no scope does not reach human review — absence is not a declaration",
  );

  const unknownScope = preparedWith({ title: "Q3 supplier audit", departmentScope: "somewhere-else" });
  assert.notEqual(
    unknownScope.lifecycleState,
    "REQUIRES_HUMAN_REVIEW",
    "an undeclared scope value is refused rather than repaired into one of the two",
  );

  /* ── 7. A DECLARED DEPARTMENT WITH AN UNBACKED REFERENCE STILL FAILS ──────
   *
   * Fiction, which is the thing the strictness was always for.
   */
  const unbacked = preparedWith({
    title: "Q3 supplier audit",
    departmentScope: "department",
    departmentRef: "department/11111111-2222-3333-4444-555555555555",
  });
  assert.notEqual(
    unbacked.lifecycleState,
    "REQUIRES_HUMAN_REVIEW",
    "a supplied reference with no retrieval behind it is still refused — fiction cannot reach review",
  );

  /* ── 8. THE RESOLVER VALIDATES THE ENVELOPE BEFORE READING ANYTHING ───────
   *
   * And the two refusals answer different questions: `invalid-department-scope` is about the
   * caller's own envelope, `department-not-found` about rows it may not be allowed to see. The
   * second stays collapsed, which is why the first must be separate.
   */
  const inlet = codeOf(read(INLET));
  assert.ok(
    inlet.includes('"invalid-department-scope"'),
    "a malformed or contradictory declaration has its own refusal",
  );
  assert.ok(
    inlet.includes('scope.kind === "organization-level" && "departmentRef" in scope'),
    "a contradictory envelope is refused, never silently resolved to one of its two claims",
  );
  /*
   * Scoped to the resolver function itself: the organization-level branch is a separate function
   * that legitimately reads the authority, so a whole-file ordering check would measure the wrong
   * thing. What must hold is that THIS function refuses a bad declaration before it reads anything.
   */
  const resolver = inlet.slice(inlet.indexOf("async function fileRecordWorkProposal"));
  assert.ok(
    resolver.indexOf('"invalid-department-scope"') < resolver.indexOf("readOrganizationAuthority"),
    "the declaration is checked BEFORE the Organization Authority is read",
  );

  /*
   * THE DEVIATION, PINNED RATHER THAN HIDDEN (TRH-16).
   *
   * The organization-level branch DOES read the Organization Authority. It must: the evidence rule
   * asks whether the action refers to anything real, and the honest answer for organization-level
   * work is the organization itself. What it must NOT do is resolve a DEPARTMENT — it names none,
   * so it looks none up, evidences none and invents none.
   */
  const orgBranch = inlet.slice(
    inlet.indexOf("async function fileOrganizationLevelProposal"),
    inlet.indexOf("async function fileRecordWorkProposal"),
  );
  assert.ok(orgBranch.length > 0, "the organization-level branch is present to examine");
  assert.ok(
    orgBranch.includes("readOrganizationAuthority"),
    "it reads the organization, because its evidence must refer to something real",
  );
  for (const forbidden of [
    "structure.departments",
    "parseDepartmentRef",
    "isDepartmentRef",
    "formatDepartmentRef",
    "department-not-found",
    "department-retired",
  ]) {
    assert.ok(
      !orgBranch.includes(forbidden),
      `the organization-level branch never reaches \`${forbidden}\` — it names no department`,
    );
  }
  /*
   * The ONE `departmentRef` it may mention is the receipt's declared absence — a null carried as a
   * null, so a surface renders "organization-level" rather than a missing name. Asserted rather
   * than banned, because banning the word would have banned the honest answer.
   */
  assert.ok(
    /departmentRef: null,/.test(orgBranch) && /departmentName: null,/.test(orgBranch),
    "the receipt reports the declared absence as absence, inventing no department name",
  );

  /* ── 9. EXECUTION TRANSLATES THE DECLARATION, AND DEFAULTS NOTHING ────────
   *
   * A value the human did not see is a value they did not authorize — and that applies to an
   * absence exactly as to a value.
   */
  const executor = codeOf(read(EXECUTOR));
  assert.ok(
    executor.includes('if (scope === "organization-level")') &&
      executor.includes("return { title, departmentId: null };"),
    "an approved organization-level payload reaches the Work Authority as departmentId null",
  );
  assert.ok(
    executor.includes('if (scope !== "department") return null;'),
    "an unrecognised or absent scope is not recordable — it never defaults to organization-level",
  );
  assert.ok(
    executor.includes('if (payload["departmentRef"] !== undefined) return null;'),
    "a stray reference beside an organization-level scope is refused, not ignored",
  );

  /* ── 10. THE WORK AUTHORITY IS UNCHANGED, AND STILL THE ONLY WRITER ───────
   *
   *     WORK AUTHORITY OWNS WHETHER WORK MAY BE UNASSIGNED.
   *     THE PROPOSAL CONTRACT OWNS HOW THAT INTENT IS EXPRESSED SAFELY.
   */
  const writer = codeOf(read(WORK_WRITER));
  assert.ok(
    writer.includes("const departmentId = input.departmentId ?? null;") &&
      writer.includes("if (departmentId !== null) {"),
    "the Work Authority still accepts a null department and still validates a non-null one",
  );
  const inserts = readdirSync(path.join(ROOT, "src/features"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) =>
      readdirSync(path.join(ROOT, "src/features", e.name))
        .filter((f) => /\.ts$/.test(f))
        .map((f) => `src/features/${e.name}/${f}`),
    )
    .filter((f) => codeOf(read(f)).includes("insert(workItems)"));
  assert.deepEqual(
    inserts,
    ["src/features/organizational-work/write-work.server.ts"],
    "there is still exactly one Work writer",
  );
  assert.match(
    read(WORK_SCHEMA),
    /departmentId: uuid\("department_id"\),/,
    "and the column is still nullable — this phase required no schema change",
  );

  /* ── 11. THE MANDATE VOCABULARY DID NOT MOVE ──────────────────────────────
   *
   * `record-work` stays mandatable and `send` stays what it was. This phase widened no ceiling.
   */
  const originable = codeOf(read("src/features/agent-origination/contracts.ts"));
  assert.match(
    originable,
    /AGENT_ORIGINABLE_ACTION_KINDS = \["send", "record-work"\] as const;/,
    "the originable vocabulary is untouched",
  );

  /* ── 12. AND HEBY STILL CANNOT SELECT `record-work` ───────────────────────
   *
   * Pinned so this phase's scope cannot be mistaken for the capability it did NOT deliver. GIA-1
   * recorded this gap deliberately; TRH-16 does not close it.
   */
  const selected = parseAgentActionSelection(
    JSON.stringify({
      kind: "record-work",
      args: { title: "x", departmentScope: "organization-level" },
      reason: "because",
    }),
    { recipients: [], drafts: [] },
  );
  assert.equal(selected.status, "refused", "the model still cannot select `record-work`");
  assert.equal(
    selected.status === "refused" ? selected.reason : "",
    "unsupported-action-kind",
    "and it is still refused as an unsupported kind, not repaired into one",
  );

  /* The agent-originated inlet still has no production caller. Measured, not assumed. */
  const productionCallers = (function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  })("src").filter(
    (f) => f !== INLET && codeOf(read(f)).includes("proposeAgentOriginatedRecordWorkAction"),
  );
  assert.deepEqual(
    productionCallers,
    [],
    "no production module calls the agent-originated record-work inlet — TRH-16 connected nothing",
  );

  console.log("trh16-departmentless-work/departmentless-firewall: OK");
}

main();
