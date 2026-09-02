/*
 * GIA-1 — THE EXECUTABLE SET IS CLOSED, EXACT, AND POSTURED PER KIND.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Exactly TWO action kinds are executable, they are the two specifically authorized ones, and
 *    each satisfies its OWN truthful posture. A third cannot become executable by satisfying a
 *    generic shape. The internal act cannot reach an external provider adapter, and the external
 *    adapter contract still receives no database handle and no internal mutation capability.
 *    Nothing short of the full chain grants execution: not a registry entry, not a tool descriptor,
 *    not a mandate, not a proposal, and not a Governance decision without a spendable permit.
 *    There is no second execution ledger, no generic internal-execution authority, no second agent,
 *    and no automatic rollback."
 *
 * The pins:
 *
 *   REGISTERED    != EXECUTABLE      MANDATED     != AUTHORIZED
 *   PROPOSED      != DECIDED         DECIDED      != PERMITTED
 *   PERMITTED     != EXECUTED        EXECUTED     != SUCCESSFUL
 *   REVERSIBLE    != ERASABLE        REVERSIBLE   != AUTOMATICALLY ROLLED BACK
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this milestone's own honest prose
 * about what it refuses to do can never satisfy — or trip — a check about what it does.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  EXECUTABLE_ACTION_KINDS,
  EXECUTABLE_ACTION_POSTURES,
  RECORD_WORK_TOOL_ID,
  executablePostureFor,
  getActionToolByKind,
  listActionTools,
  validateActionRegistry,
} from "../../src/features/heby-actions/action-registry";
import { prepareAction } from "../../src/features/heby-actions/action-preparer";
import { describeActionBoundary } from "../../src/features/heby-actions/boundary";
import {
  AGENT_ORIGINABLE_ACTION_KINDS,
  AGENT_ORIGINABLE_REGISTRY_KIND,
  RECORD_WORK_ORIGINATION_ALIAS,
} from "../../src/features/agent-origination/contracts";
import { parseAgentActionSelection } from "../../src/features/agent-origination/structured-output";
import {
  RECORD_WORK_ACTION_KIND,
  RECORD_WORK_PROPOSAL_EFFECTS,
  RECORD_WORK_PROPOSAL_NON_EFFECTS,
  RECORD_WORK_REVERSIBILITY_MEANING,
} from "../../src/features/heby-action-inlet/contracts";
import {
  formatDepartmentRef,
  isDepartmentRef,
  parseDepartmentRef,
} from "../../src/features/organization-authority/department-ref";
import { AUTHORIZABLE_SIDE_EFFECTS } from "../../src/features/action-authorization/contracts";
import { EXECUTABLE_ACTION_KIND } from "../../src/features/action-execution/contracts";
import { permitOutcomeSentence } from "../../src/components/decision-workspace/action-authorizations";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Comment-stripped AND string-literal-stripped: honest prose in a message cannot satisfy a ban. */
const codeOf = (s: string): string =>
  withoutComments(s)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const EXECUTOR = "src/features/governed-internal-action/execute-record-work.server.ts";
const INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";
const WORK_WRITER = "src/features/organizational-work/write-work.server.ts";
const WORK_AUDIT = "src/features/governance-audit/organizational-work-audit.server.ts";
const REGISTRY = "src/features/heby-actions/action-registry.ts";
const PERMIT = "src/features/action-authorization/consume-action-permit.server.ts";
const ADAPTER_CONTRACT = "src/features/action-execution/adapter-contract.ts";
const APPROVALS_ACTIONS = "src/app/(dashboard)/approvals/actions.ts";
const WORK_ACTIONS = "src/app/(dashboard)/director/work/actions.ts";

/* ── the import-graph walker, the shape OSA-1, WORK-1, WORK-2, OSA-3 and OSA-4 established ── */
function valueEdges(file: string): string[] {
  const source = withoutComments(read(file));
  const specifiers: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    if (clause.includes("=")) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}
function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
  }
  return null;
}
function transitiveGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of valueEdges(file)) {
      const r = resolveSpecifier(file, spec);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}
function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE EXECUTABLE SET IS CLOSED AND EXACT — NOT A CARDINALITY.
 * ═════════════════════════════════════════════════════════════════════════ */
function theExecutableSetIsClosed(): void {
  assert.deepEqual(validateActionRegistry(), [], "the registry is internally honest");

  assert.deepEqual(
    [...EXECUTABLE_ACTION_KINDS],
    ["send-external-communication", "record-work"],
    "EXACTLY the two specifically authorized kinds — no more, and no fewer",
  );
  assert.ok(Object.isFrozen(EXECUTABLE_ACTION_POSTURES), "the set cannot be widened at runtime");
  for (const posture of EXECUTABLE_ACTION_POSTURES) {
    assert.ok(Object.isFrozen(posture), `${posture.actionKind}'s posture cannot be edited at runtime`);
  }

  /* The declared set and the DECLARING tools agree, in both directions. */
  const connected = listActionTools()
    .filter((t) => t.sideEffect !== "READ_ONLY" && t.sideEffect !== "PREPARATION_ONLY" && t.substrateConnected)
    .map((t) => t.actionKind);
  assert.deepEqual(
    [...connected].sort(),
    [...EXECUTABLE_ACTION_KINDS].sort(),
    "the tools declaring a connected mutation substrate are exactly the executable set",
  );

  /*
   * THE CARDINALITY GUARD IS GONE AND WAS NOT REPLACED BY A BIGGER NUMBER. A source-level check,
   * because "we relaxed one to two" is exactly the regression this phase must not be able to make.
   */
  const registry = codeOf(read(REGISTRY));
  assert.ok(
    !/connectedMutations\.length\s*>\s*\d/.test(registry),
    "no length comparison decides how many executors are allowed",
  );
  assert.ok(
    registry.includes("EXECUTABLE_ACTION_KINDS.includes(kind)"),
    "membership of the closed set is what the validator asks",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. EACH KIND SATISFIES ITS OWN POSTURE, AND THE TWO POSTURES DIFFER.
 * ═════════════════════════════════════════════════════════════════════════ */
function eachKindKeepsItsOwnPosture(): void {
  const send = getActionToolByKind(EXECUTABLE_ACTION_KIND)!;
  const record = getActionToolByKind(RECORD_WORK_ACTION_KIND)!;
  assert.ok(send && record, "both executable kinds are backed by a declared tool");

  /* EXTERNAL SEND — unchanged, and not weakened to accommodate a sibling. */
  assert.equal(send.sideEffect, "CONSEQUENTIAL_MUTATION");
  assert.equal(send.reversibility, "irreversible", "nobody can un-receive an email");
  assert.equal(send.authorityRequirement, "human-review-required");
  assert.equal(send.governanceGated, true);
  assert.equal(executablePostureFor(EXECUTABLE_ACTION_KIND)!.execution, "external-provider");

  /* RECORD WORK — consequential AND reversible, which is a different truth, not a cheaper one. */
  assert.equal(record.toolId, RECORD_WORK_TOOL_ID);
  assert.equal(record.sideEffect, "CONSEQUENTIAL_MUTATION", "a durable organizational record is consequential");
  assert.equal(record.reversibility, "deterministic-inverse", "`retireWork` exists and is the inverse");
  assert.equal(record.authorityRequirement, "human-review-required");
  assert.equal(record.governanceGated, true);
  assert.equal(executablePostureFor(RECORD_WORK_ACTION_KIND)!.execution, "internal-authority");
  assert.equal(record.ownerWorkspace, "command", "Command owns the Director's organization-wide routes");

  /* THE DIFFERENCE IS REAL AND STATED. A shared posture would make one of the two a lie. */
  assert.notEqual(send.reversibility, record.reversibility);
  assert.ok(
    (AUTHORIZABLE_SIDE_EFFECTS as readonly string[]).includes(record.sideEffect),
    "and the class is one R3A issues permits for",
  );

  /* THE INVERSE IS A REAL, RELEASED OPERATION — not a hope. */
  const writer = codeOf(read(WORK_WRITER));
  assert.ok(
    /export async function retireWork\(/.test(writer),
    "the deterministic inverse is an exported operation of the authority that owns the state",
  );

  /* THE HUMAN-FACING SENTENCES FOLLOW THE TOOL, NOT THE CLASS. */
  const boundary = describeActionBoundary("command").find((r) => r.actionKind === RECORD_WORK_ACTION_KIND);
  assert.ok(boundary, "the boundary surface lists it");
  assert.ok(!/irreversible/i.test(boundary!.verdict), "and never calls it irreversible");
  assert.match(boundary!.verdict, /human review/i, "while still requiring human review");
  assert.equal(boundary!.invokable, false, "and it is not invokable by Heby, ever");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. REVERSIBLE IS NOT ERASABLE, AND NOTHING ROLLS BACK AUTOMATICALLY.
 * ═════════════════════════════════════════════════════════════════════════ */
function reversibleIsNotErasable(): void {
  /* The claim is stated in code so a surface quotes it rather than inventing it. */
  const meaning = RECORD_WORK_REVERSIBILITY_MEANING.join(" ");
  assert.match(meaning, /retired/i, "reversible means the item can be retired");
  assert.match(meaning, /does not erase/i, "and it is said, in the same breath, that nothing is erased");
  assert.match(meaning, /audit event/i, "including the audit event");
  assert.match(meaning, /no automatic rollback/i, "and that none of this happens by itself");

  /* NO AUTOMATIC ROLLBACK EXISTS. The executor never calls the inverse. */
  const executor = codeOf(read(EXECUTOR));
  for (const banned of ["retireWork", "rollback", "compensate", "undo"]) {
    assert.ok(!executor.includes(banned), `the executor performs no ${banned} of its own`);
  }

  /* THE CONSEQUENCE A HUMAN READS BEFORE AUTHORIZING IS THE TOOL'S OWN TRUTH. */
  const prepared = prepareAction({
    actionKind: RECORD_WORK_ACTION_KIND,
    requestingWorkspace: "command",
    target: { kind: "record", ref: "department/11111111-2222-3333-4444-555555555555", label: "Finance" },
    proposedArguments: {
      title: "Q3 supplier audit",
      departmentRef: "department/11111111-2222-3333-4444-555555555555",
    },
    evidence: [
      {
        sourceClass: "organization",
        recordRef: "department/11111111-2222-3333-4444-555555555555",
        lifecycle: "settled",
      },
    ],
  });
  assert.equal(prepared.lifecycleState, "REQUIRES_HUMAN_REVIEW", "PREPARED != AUTHORIZED");
  const consequences = prepared.consequences.join(" ");
  assert.ok(
    !/irreversibly/i.test(consequences),
    "a human is never told this act is irreversible, because it is not",
  );
  assert.match(consequences, /deterministic inverse/i, "they are told the inverse exists");
  assert.match(consequences, /not erasure/i, "and that it is not erasure");
  assert.match(consequences, /human review/i, "and that a human decides");

  /* AND THE SEND'S OWN SENTENCE IS UNTOUCHED. */
  const sendPrepared = prepareAction({
    actionKind: EXECUTABLE_ACTION_KIND,
    requestingWorkspace: "operations",
    target: { kind: "record", ref: "external-recipient/1", label: "Ayşe" },
    proposedArguments: {
      recipientRef: "external-recipient/1",
      recipientEndpointDigest: "d",
      draftRef: "work-artifact/1@1",
      draftRevisionDigest: "d",
    },
    evidence: [
      { sourceClass: "external-recipients", recordRef: "external-recipient/1", lifecycle: "settled" },
      { sourceClass: "work-artifacts", recordRef: "work-artifact/1@1", lifecycle: "settled" },
    ],
  });
  assert.match(
    sendPrepared.consequences.join(" "),
    /irreversibly/i,
    "the send is still described as irreversible — it was not weakened to match its sibling",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE FIREWALL, IN BOTH DIRECTIONS.
 * ═════════════════════════════════════════════════════════════════════════ */
function theFirewallHoldsBothWays(): void {
  /* INTERNAL → EXTERNAL. The whole executable internal path reaches no provider adapter. */
  const internalGraph = transitiveGraph([EXECUTOR, INLET]);
  for (const file of internalGraph) {
    assert.ok(
      !file.startsWith("src/features/action-execution/"),
      `${file}: the internal act reaches no execution runtime`,
    );
    assert.ok(
      !file.startsWith("src/features/action-execution-live/"),
      `${file}: the internal act reaches no live provider transport`,
    );
    assert.ok(
      !file.startsWith("src/features/adapters/"),
      `${file}: the internal act reaches no adapter`,
    );
  }
  const internalCode = [...internalGraph].map((f) => codeOf(read(f))).join("\n");
  for (const banned of ["fetch(", "XMLHttpRequest", "https://", "ExternalSendAdapter", "resendTransport"]) {
    assert.ok(!internalCode.includes(banned), `the internal act's graph contains no ${banned}`);
  }
  /* And it names no recipient, no endpoint and no credential — an internal act has none. */
  const executor = codeOf(read(EXECUTOR));
  for (const banned of ["recipient", "endpoint", "credential", "adapter", "transport", "provider"]) {
    assert.ok(
      !executor.toLowerCase().includes(banned),
      `the executor has no representation for a ${banned}`,
    );
  }

  /* EXTERNAL → INTERNAL. The adapter contract still receives four scalars and nothing else. */
  const adapter = codeOf(read(ADAPTER_CONTRACT));
  for (const banned of [
    "ControlPlaneDatabase",
    "@/db/",
    "TenantContext",
    "tenantId",
    "recordWorkWithin",
    "workItems",
    "@/features/organizational-work",
  ]) {
    assert.ok(!adapter.includes(banned), `the external adapter contract carries no ${banned}`);
  }
  const adapterGraph = transitiveGraph([ADAPTER_CONTRACT]);
  for (const file of adapterGraph) {
    assert.ok(
      !file.startsWith("src/features/organizational-work/"),
      `${file}: the adapter reaches no internal authority`,
    );
    assert.ok(!file.startsWith("src/db/"), `${file}: the adapter reaches no database handle`);
  }

  /* AND THE EXTERNAL EXECUTOR ITSELF NEVER LEARNED THE WORK AUTHORITY. */
  const externalRuntime = codeOf(
    read("src/features/action-execution/execute-authorized-action.server.ts"),
  );
  for (const banned of ["recordWorkWithin", "workItems", "organizational-work", "governed-internal-action"]) {
    assert.ok(!externalRuntime.includes(banned), `the external runtime cannot reach ${banned}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. NOTHING SHORT OF THE WHOLE CHAIN GRANTS EXECUTION.
 * ═════════════════════════════════════════════════════════════════════════ */
function nothingShortOfTheChainExecutes(): void {
  const executor = codeOf(read(EXECUTOR));

  /*
   * A REGISTRY ENTRY AND A TOOL DESCRIPTOR GRANT NOTHING. The executor never consults either: it
   * has no import of the registry, so "declared" cannot become "performable" by declaration alone.
   */
  const executorGraph = transitiveGraph([EXECUTOR]);
  assert.ok(
    !executorGraph.has(REGISTRY),
    "the executor never reads the registry — a declaration is not a permission",
  );

  /*
   * A MANDATE GRANTS NOTHING. The executor never reads one, and the mandate authority is not in its
   * graph at all: a ceiling constrains PROPOSING, and this module is downstream of a human's
   * decision, where a mandate has no further say.
   */
  for (const file of executorGraph) {
    assert.ok(
      !file.startsWith("src/features/agent-mandate/"),
      `${file}: the executor consults no mandate — a ceiling is not an authorization`,
    );
    assert.ok(
      !file.startsWith("src/features/agent-origination/"),
      `${file}: and no origination path`,
    );
  }

  /*
   * A PROPOSAL GRANTS NOTHING, AND THE INLET CANNOT DECIDE, PERMIT OR EXECUTE.
   */
  const inlet = codeOf(read(INLET));
  for (const banned of [
    "approveActionRequest",
    "rejectActionRequest",
    "consumeActionPermit",
    "executeRecordWork",
    "recordWorkWithin",
    "recordWork(",
    "retireWork",
    "actionPermits",
    "decisionRecords",
    "workItems",
  ]) {
    assert.ok(!inlet.includes(banned), `the proposal inlet cannot reach ${banned}`);
  }
  const inletGraph = transitiveGraph([INLET]);
  assert.ok(
    !inletGraph.has("src/features/governed-internal-action/execute-record-work.server.ts"),
    "filing a proposal cannot reach the executor",
  );
  assert.ok(
    !inletGraph.has("src/features/action-authorization/consume-action-permit.server.ts"),
    "and cannot reach the permit spend",
  );
  assert.ok(
    !inletGraph.has("src/features/organizational-work/write-work.server.ts"),
    "and cannot reach the Work Authority's writer",
  );

  /*
   * A GOVERNANCE DECISION WITHOUT A SPENDABLE PERMIT GRANTS NOTHING. The executor's ONLY route into
   * a mutation is through `consumeActionPermit`'s own callback: there is no other call, and the
   * mutation happens inside it.
   */
  assert.ok(executor.includes("consumeActionPermit"), "the permit spend is the entry");
  assert.ok(executor.includes("onAuthorizedWithin"), "and the mutation runs inside its callback");
  const callbackBody = executor.slice(executor.indexOf("onAuthorizedWithin"));
  assert.ok(
    callbackBody.includes("recordWithin(tx"),
    "the Work Authority is called with the PERMIT'S OWN transaction, never a handle of its own",
  );
  assert.ok(
    !/\bdb\.transaction\(/.test(executor) && !executor.includes("getControlPlaneDb"),
    "the executor opens no transaction and takes no database handle",
  );
  assert.ok(
    !executor.includes("resolveGovernanceAuthority") && !executor.includes("governance-decision"),
    "and it resolves no authority of its own — the authorization already happened",
  );

  /*
   * THE ONLY CLIENT-CROSSING VALUE IS WHICH PERMIT. No title, no department, no tenant, no actor.
   */
  const signature = executor.slice(executor.indexOf("export async function executeRecordWork"));
  const params = signature.slice(0, signature.indexOf(")"));
  assert.ok(params.includes("permitId"), "the permit id is the one lookup key");
  for (const forbidden of ["title", "departmentId", "departmentRef", "tenantId", "actorId"]) {
    assert.ok(!params.includes(forbidden), `there is no parameter through which to supply ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. ONE INSERT PATH, ONE OWNER, ONE LEDGER.
 * ═════════════════════════════════════════════════════════════════════════ */
function theArchitectureIsUnchanged(): void {
  const writer = codeOf(read(WORK_WRITER));

  /* EXACTLY ONE PLACE CREATES A WORK ROW, and both paths go through it. */
  const inserts = [...writer.matchAll(/\.insert\((\w+)\)/g)].map((m) => m[1]);
  assert.deepEqual(
    inserts.filter((t) => t === "workItems"),
    ["workItems"],
    "there is EXACTLY ONE `work_items` insert in the whole authority",
  );
  assert.ok(
    /export async function recordWorkWithin\(/.test(writer),
    "and it lives in the transaction-joinable seam",
  );
  const humanPath = writer.slice(writer.indexOf("export async function recordWork("));
  assert.ok(
    humanPath.includes("recordWorkWithin(tx"),
    "the released human path calls the SAME seam — the two cannot drift",
  );

  /* THE WORK AUTHORITY REMAINS THE STATE OWNER. Nobody else names its table. */
  const owners = walk("src").filter(
    (f) => f !== "src/db/schema/work-item.ts" && /\binsert\(workItems\)/.test(codeOf(read(f))),
  );
  assert.deepEqual(owners, [WORK_WRITER], "only the Work Authority inserts work");

  /*
   * ATTRIBUTION: the system authored it, and the type is a closed union, never input.
   *
   * The two TYPE declarations are matched against comment-stripped source rather than the
   * string-stripped form used for bans: a closed union IS its string literals, and stripping them
   * would leave the assertion unable to tell `"human" | "system"` from `"human" | "agent"`.
   */
  assert.ok(writer.includes("createdByType: author.kind"), "the row records who performed it");
  assert.ok(writer.includes("updatedByType: author.kind"), "in both columns");
  const writerTypes = withoutComments(read(WORK_WRITER));
  assert.match(
    writerTypes,
    /export type WorkStateAuthor = \{ readonly kind: "human" \} \| \{ readonly kind: "system" \};/,
    "and the author vocabulary is a closed two-value union with no `agent`",
  );
  const auditTypes = withoutComments(read(WORK_AUDIT));
  assert.match(
    auditTypes,
    /export type WorkAuditExecutor = "human" \| "system";/,
    "the audit agrees, and admits no agent — an agent proposes, it never performs",
  );
  const auditCode = codeOf(read(WORK_AUDIT));
  assert.ok(auditCode.includes("actorType: executor"), "the audit row records who performed it");
  assert.ok(
    !/actorType:\s*(?!executor\b)[a-zA-Z]/.test(auditCode),
    "and that value is the closed parameter, never something taken from input",
  );

  /* NO SECOND EXECUTION LEDGER, AND NO GENERIC INTERNAL EXECUTION AUTHORITY. */
  const featureFiles = walk("src/features/governed-internal-action");
  assert.deepEqual(featureFiles, [EXECUTOR], "the feature is ONE file — there is no framework here");
  const executor = codeOf(read(EXECUTOR));
  for (const banned of ["pgTable", "actionExecutionAttempts", "action_execution_attempts", ".insert(", ".update(", ".delete("]) {
    assert.ok(!executor.includes(banned), `the executor declares and writes no ${banned}`);
  }
  assert.equal(
    walk("src/db/schema").filter((f) => /governed[_-]?internal|internal[_-]?action/i.test(f)).length,
    0,
    "and this phase declared no table of its own",
  );

  /* `PermitConsumptionTx` WAS NOT WIDENED, and the recording seam asks for no more than it offers. */
  assert.match(
    withoutComments(read(PERMIT)),
    /export type PermitConsumptionTx = Pick<ControlPlaneDatabase, "insert" \| "select">;/,
    "the spend transaction still exposes exactly insert and select",
  );
  assert.match(
    writerTypes,
    /export type WorkRecordingTx = Pick<ControlPlaneDatabase, "insert" \| "select">;/,
    "and the recording seam asks for exactly the same two — no widening in either direction",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE VOCABULARY GREW BY ONE, AND ONLY BY ONE.
 * ═════════════════════════════════════════════════════════════════════════ */
function theVocabularyGrewByExactlyOne(): void {
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "the origination vocabulary is the released `send` plus GIA-1's `record-work`",
  );

  /* THE MAP IS TOTAL, FROZEN, AND RESOLVES THROUGH ITSELF — never by string identity. */
  assert.deepEqual(
    Object.keys(AGENT_ORIGINABLE_REGISTRY_KIND).sort(),
    [...AGENT_ORIGINABLE_ACTION_KINDS].sort(),
    "every admitted alias declares what registry kind it denotes",
  );
  assert.equal(
    AGENT_ORIGINABLE_REGISTRY_KIND[RECORD_WORK_ORIGINATION_ALIAS],
    RECORD_WORK_ACTION_KIND,
    "and the new alias maps to the released constant itself",
  );
  assert.ok(Object.isFrozen(AGENT_ORIGINABLE_REGISTRY_KIND), "the map cannot be widened at runtime");

  /* THE STORAGE-LAYER CEILING AGREES. A CHECK cannot import TypeScript, so the two are pinned. */
  const schema = read("src/db/schema/agent-mandate.ts");
  const sqlList = /array\[([^\]]*)\]::text\[\]/.exec(schema);
  assert.ok(sqlList, "the schema states the vocabulary in SQL");
  assert.deepEqual(
    sqlList![1]!.split(",").map((s) => s.trim().replace(/^'|'$/g, "")).filter(Boolean).sort(),
    [...AGENT_ORIGINABLE_ACTION_KINDS].sort(),
    "the storage-layer CHECK admits exactly the released originable kinds",
  );

  /*
   * ORIGINABLE MEANS MANDATABLE, NOT MODEL-SELECTABLE — AND THE DIFFERENCE IS PINNED.
   *
   * GIA-1 admitted `record-work` to the mandate vocabulary and gave it an agent-originated inlet.
   * It did NOT teach the model to select it: the structured-output contract still admits `send` and
   * the abstain value only. Recording that here means the gap is a measured fact rather than a
   * silence somebody later mistakes for a capability.
   */
  const selected = parseAgentActionSelection(
    JSON.stringify({ kind: "record-work", args: { title: "x", departmentRef: "y" }, reason: "because" }),
    { recipients: [], drafts: [] },
  );
  assert.equal(selected.status, "refused", "the model cannot select `record-work` today");
  assert.equal(
    selected.status === "refused" ? selected.reason : "",
    "unsupported-action-kind",
    "and it is refused as an unsupported kind, not repaired into one",
  );

  /* NO SECOND AGENT, AND NO AUTONOMOUS PROPOSAL FRAMEWORK WAS ACTIVATED. */
  const touched = [EXECUTOR, INLET, REGISTRY, WORK_WRITER, WORK_AUDIT, APPROVALS_ACTIONS, WORK_ACTIONS];
  for (const file of touched) {
    const code = codeOf(read(file));
    for (const banned of ["agent-runtime", "autonomous", "scheduler", "worker", "queue", "cron"]) {
      assert.ok(!code.includes(banned), `${file} activates no ${banned}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE REFERENCE FAILS CLOSED, AND THE PAYLOAD IS WHAT A HUMAN SAW.
 * ═════════════════════════════════════════════════════════════════════════ */
function theReferenceFailsClosed(): void {
  /* Deliberately hex WITH LETTERS: an all-digit uuid makes the case-folding probe a no-op. */
  const id = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  assert.equal(formatDepartmentRef(id), `department/${id}`);
  assert.equal(formatDepartmentRef(id.toUpperCase()), `department/${id}`, "exactly one spelling");
  assert.deepEqual(parseDepartmentRef(`department/${id}`), { departmentId: id });
  for (const malformed of [
    id,
    `department/${id} `,
    ` department/${id}`,
    `department/${id.toUpperCase()}`,
    `Department/${id}`,
    `department/${id}/`,
    "department/not-a-uuid",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isDepartmentRef(malformed), false, `${JSON.stringify(malformed)} is not a reference`);
  }
  assert.throws(() => formatDepartmentRef("not-a-uuid"), "a malformed id never becomes a reference");

  /* THE EXECUTOR READS ONLY WHAT WAS APPROVED, and defaults nothing. */
  const executor = codeOf(read(EXECUTOR));
  const payloadReads = [...executor.matchAll(/payload\[""\]/g)].length;
  assert.ok(payloadReads >= 2, "it reads the approved payload directly");
  /*
   * The WHOLE function, to the next top-level export — not to the first `}` in the text, which is
   * the return-type annotation's closing brace and would leave the body entirely unchecked. That
   * mistake was made here first, and it made this assertion pass over nothing.
   */
  const readerStart = executor.indexOf("function workInputFrom");
  assert.ok(readerStart >= 0, "the payload reader is where this check says it is");
  const readerEnd = executor.indexOf("\nexport ", readerStart);
  assert.ok(readerEnd > readerStart, "and it is followed by the exported act, as expected");
  const reader = executor.slice(readerStart, readerEnd);
  assert.ok(reader.includes("parseDepartmentRef"), "and the body was actually captured");
  /*
   * `??` is banned because a nullish default is exactly how an unapproved value gets in. `||` is
   * NOT banned: it appears in the type guard above (`typeof title !== "string" || ...`), which is a
   * refusal, not a default — banning it would punish the check rather than the defect.
   */
  for (const invented of ["declaredState", "accountableUserId", "accountableRef", "??"]) {
    assert.ok(
      !reader.includes(invented),
      `no value is defaulted or invented while reading the approved payload (${invented})`,
    );
  }

  /* THE DISCLOSURE A HUMAN READS BEFORE FILING IS A DENIAL LIST AND A SEPARATE EFFECT LIST. */
  for (const line of RECORD_WORK_PROPOSAL_NON_EFFECTS) {
    assert.match(line, /\b(no|not|nothing)\b/i, `a NON-effect must be a denial: "${line}"`);
  }
  for (const line of RECORD_WORK_PROPOSAL_EFFECTS) {
    assert.ok(
      !/\b(no|not|nothing)\b/i.test(line),
      `an EFFECT is a positive statement and belongs in its own list: "${line}"`,
    );
  }
  const panel = read("src/components/organizational-work/work-register.tsx");
  for (const line of [...RECORD_WORK_PROPOSAL_NON_EFFECTS, ...RECORD_WORK_PROPOSAL_EFFECTS]) {
    assert.ok(
      panel.includes("RECORD_WORK_PROPOSAL_NON_EFFECTS") &&
        panel.includes("RECORD_WORK_PROPOSAL_EFFECTS"),
      `the surface quotes the contract rather than restating it (${line})`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. TWO EXECUTE ACTIONS, EACH NAMING ITS OWN EXECUTOR — NOT A DISPATCHER.
 * ═════════════════════════════════════════════════════════════════════════ */
function theSurfaceOffersTwoDeliberateActions(): void {
  const actions = codeOf(read(APPROVALS_ACTIONS));
  assert.ok(actions.includes("executeAuthorizedAction"), "the external executor keeps its action");
  assert.ok(actions.includes("executeRecordWork"), "and the internal one has its own");
  const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.deepEqual(
    exported.sort(),
    [
      "approveActionRequestAction",
      "executeAuthorizedActionAction",
      "executeGovernedInternalActionAction",
      "rejectActionRequestAction",
      "revokeActionPermitAction",
    ],
    "five deliberate server actions, and no generic execute-anything",
  );
  for (const fn of exported) {
    assert.ok(
      !/executeAction\b|dispatch|runAction/.test(fn),
      `${fn} is not a generic dispatcher`,
    );
  }

  /* NEITHER ACTION CAN BE TOLD ANYTHING BUT WHICH PERMIT. */
  const internal = actions.slice(actions.indexOf("export async function executeGovernedInternalActionAction"));
  const params = internal.slice(0, internal.indexOf("{", internal.indexOf(")")));
  assert.ok(params.includes("permitId"), "one parameter: which permit");
  for (const forbidden of ["tenantId", "title", "departmentRef", "actorId"]) {
    assert.ok(!params.includes(forbidden), `and no ${forbidden}`);
  }

  /*
   * ── THE PERMIT OUTCOME SENTENCE CANNOT CONTRADICT THE ACT (GIA-1 repair) ───
   *
   * Production acceptance found a consumed `record-work` permit rendering "Authorized, and never
   * executed." directly above the surface's own "Recorded." confirmation. The branch asked whether
   * an EXTERNAL attempt row existed; an internal act writes none, by design. The question it must
   * ask is whether the authorization was SPENT, which `consumedAt` has answered since R3A.
   *
   * Exercised with real inputs rather than pinned as a string, so the contradiction is impossible
   * rather than merely absent from the current source.
   */
  const spentInternal = permitOutcomeSentence({
    actionKind: RECORD_WORK_ACTION_KIND,
    state: "consumed",
    consumedAt: "2026-09-02T14:03:35.961Z",
  });
  assert.match(spentInternal, /Executed/, "a spent internal authorization says the act happened");
  assert.ok(
    !/never executed/i.test(spentInternal),
    "and never says it did not — that was the contradiction",
  );

  const spentExternal = permitOutcomeSentence({
    actionKind: EXECUTABLE_ACTION_KIND,
    state: "consumed",
    consumedAt: "2026-08-31T10:13:36.026Z",
  });
  assert.ok(
    !/never executed/i.test(spentExternal) && !/\bsent\b/i.test(spentExternal),
    "a spent send with no attempt row claims neither a send nor an absence of one",
  );

  assert.match(
    permitOutcomeSentence({ actionKind: RECORD_WORK_ACTION_KIND, state: "active", consumedAt: null }),
    /not executed/i,
    "an UNSPENT authorization still says it has not been executed",
  );
  assert.match(
    permitOutcomeSentence({ actionKind: RECORD_WORK_ACTION_KIND, state: "expired", consumedAt: null }),
    /never executed/i,
    "and an expired one that was never spent still says so",
  );

  /* THE WORK ROUTE'S PROPOSE ACTION RECORDS NOTHING AND REVALIDATES NO REGISTER. */
  const workActions = codeOf(read(WORK_ACTIONS));
  const propose = workActions.slice(
    workActions.indexOf("export async function proposeRecordWorkForGovernanceAction"),
  );
  assert.ok(propose.includes("fileRecordWorkProposal"), "it files a proposal");
  assert.ok(!propose.includes("recordWork("), "and never records work");
}

theExecutableSetIsClosed();
eachKindKeepsItsOwnPosture();
reversibleIsNotErasable();
theFirewallHoldsBothWays();
nothingShortOfTheChainExecutes();
theArchitectureIsUnchanged();
theVocabularyGrewByExactlyOne();
theReferenceFailsClosed();
theSurfaceOffersTwoDeliberateActions();

console.log("gia1-governed-internal-action/internal-act-firewall: OK");
