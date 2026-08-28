/*
 * AGENT-PROPOSAL-4B — the boundaries provenance may not cross. Static: no DB, no provider, no network.
 *
 * The claim under test is not "provenance is useful". It is: provenance can observe, and can do
 * NOTHING else — it cannot approve, permit, execute or send, no authority reads it to decide
 * anything, and it cannot veto a proposal that already exists.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");

/** Source with comments and string literals stripped — prose must not trip a code firewall. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function collect(rel: string): string[] {
  const base = path.join(ROOT, rel);
  const out: string[] = [];
  for (const entry of readdirSync(base)) {
    const full = path.join(base, entry);
    if (statSync(full).isDirectory()) continue;
    if (entry.endsWith(".ts")) out.push(path.join(rel, entry));
  }
  return out;
}

const PROVENANCE = "src/features/agent-origination/invocation-provenance.server.ts";
const SCHEMA = "src/db/schema/heby-origination-invocation.ts";
const REQUEST_SCHEMA = "src/db/schema/action-authorization.ts";
const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const INLET = "src/features/heby-action-inlet/send-proposal.server.ts";
const ORIGINATE = "src/features/agent-origination/originate-action.server.ts";

/* ═══ 1. PROVENANCE GRANTS NO AUTHORITY ═══ */
function provenanceGrantsNothing(): void {
  const code = codeOf(read(PROVENANCE));
  const FORBIDDEN: readonly [RegExp, string][] = [
    [/actionPermits|action_permits|issuePermit/, "a permit"],
    [/decisionRecords|governanceSessions|resolveGovernanceAuthority/, "a Governance decision"],
    [/approveActionRequest|rejectActionRequest|decideActionRequest/, "an approval"],
    [/consumeActionPermit|revokeActionPermit/, "permit consumption"],
    [/actionExecutionAttempts|executeAuthorizedAction/, "execution"],
    [/nodemailer|sendgrid|smtp|postmark|mailgun/i, "an email transport"],
    [/@\/db\/schema\/membership|@\/db\/schema\/role|@\/db\/schema\/permission/, "a principal grant"],
    [/asHumanTenantContext|asTenantContext\s*\(/, "a manufactured TenantContext"],
    [/child_process|\bexecSync|\bspawn\(/, "a shell"],
  ];
  for (const [pattern, what] of FORBIDDEN) {
    assert.equal(pattern.test(code), false, `provenance must not reach ${what}`);
  }
}

/* ═══ 2. PROVENANCE NEVER MUTATES PROPOSAL STATE ═══ */
function provenanceNeverWritesProposals(): void {
  const code = codeOf(read(PROVENANCE));
  assert.equal(
    /\.(insert|update|delete)\s*\(\s*hebyActionRequests/.test(code),
    false,
    "provenance may READ the proposal table for a causal join and may never write it",
  );
  /* Exactly one write target, and it is its own table. */
  const inserts = [...code.matchAll(/\.insert\(([A-Za-z]+)\)/g)].map((m) => m[1]);
  const updates = [...code.matchAll(/\.update\(([A-Za-z]+)\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set([...inserts, ...updates])], ["hebyOriginationInvocations"]);
}

/* ═══ 3. NO AUTHORITY READS PROVENANCE TO DECIDE ANYTHING ═══ */
function noAuthorityReadsProvenance(): void {
  const consumers = [
    ...collect("src/features/action-authorization"),
    ...collect("src/features/action-execution"),
  ];
  for (const file of consumers) {
    const code = codeOf(read(file));
    assert.equal(
      /invocation-provenance|readInvocationProvenance|finalizeInvocation|registerInvocation/.test(code),
      false,
      `${file} must not reach invocation provenance — observability may not gate authority`,
    );
    assert.equal(
      /hebyOriginationInvocations/.test(code),
      false,
      `${file} must not read the provenance table`,
    );
  }
}

/* ═══ 4. THE PROPOSAL WRITER TREATS THE ID AS A VALUE, NOT A LOOKUP ═══ */
function theLinkIsAValue(): void {
  const code = codeOf(read(WRITER));
  assert.ok(
    /originationInvocationId/.test(code),
    "the writer stores the causal link",
  );
  assert.equal(
    /hebyOriginationInvocations|readInvocationProvenance/.test(code),
    false,
    "an existence check here would recreate the veto that omitting the FK removed",
  );
  /* And the inlet only forwards it. */
  const inlet = codeOf(read(INLET));
  assert.equal(
    /hebyOriginationInvocations|registerInvocation/.test(inlet),
    false,
    "the inlet neither mints nor resolves an invocation",
  );
}

/* ═══ 5. NO FOREIGN KEY ON THE LINK ═══ */
function noForeignKey(): void {
  const schema = read(REQUEST_SCHEMA);
  const line = schema
    .split("\n")
    .find((l) => l.includes('uuid("origination_invocation_id")'));
  assert.ok(line, "the column exists");
  assert.equal(
    /references\s*\(/.test(line!),
    false,
    "an FK would make provenance existence a precondition for proposal persistence",
  );
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  const ours = migrations.filter((f) => f.includes("ap4b"));
  assert.equal(ours.length, 1, "AGENT-PROPOSAL-4B adds exactly one migration");
  const sql = read(path.join("src/db/migrations", ours[0]!));
  assert.equal(
    /origination_invocation_id[\s\S]*?REFERENCES/i.test(sql),
    false,
    "and the migration adds no foreign key on the link either",
  );
}

/* ═══ 6. NO PROMPT, NO RESPONSE, NO SECRET IS STORABLE ═══ */
function nothingSensitiveIsStorable(): void {
  const schema = read(SCHEMA);
  for (const forbidden of ["prompt", "response", "goal", "api_key", "authorization", "content"]) {
    assert.equal(
      new RegExp(`"${forbidden}"`).test(schema),
      false,
      `the table must have no ${forbidden} column`,
    );
  }
  /* No open blob for one to hide in. */
  assert.equal(/jsonb\(/.test(schema), false, "no generic JSON blob");
  /* And the writer has no parameter that could carry one. */
  const code = codeOf(read(PROVENANCE));
  assert.equal(/userPrompt|systemInstructions|rawText|responseText/.test(code), false);
}

/* ═══ 7. THE TWO AXES STAY SEPARATE ═══ */
function axesStaySeparate(): void {
  const schema = read(SCHEMA);
  /* A proposal lifecycle value must never appear in the invocation state enum. */
  const states = schema.slice(
    schema.indexOf("ORIGINATION_INVOCATION_STATES"),
    schema.indexOf("ORIGINATION_FILING_OUTCOMES"),
  );
  for (const proposalState of ["pending", "approved", "rejected", "permitted", "executed"]) {
    assert.equal(
      states.includes(`"${proposalState}"`),
      false,
      `"${proposalState}" is proposal lifecycle and may not be an invocation state`,
    );
  }
  /* The filing observation carries the released refusal vocabulary, not an invented one. */
  const originate = codeOf(read(ORIGINATE));
  assert.ok(
    /filingRefusal:\s*filed\.reason/.test(originate),
    "the inlet's own closed reason is recorded verbatim — this is what separates a duplicate " +
      "from an operational failure from a retired referent",
  );
}

/* ═══ 8. REGISTRATION IS BEFORE DISPATCH; FINALIZATION CANNOT VETO ═══ */
function orderingAndVeto(): void {
  const code = codeOf(read(ORIGINATE));
  const register = code.indexOf("registerInvocation");
  const select = code.indexOf("selectAction(");
  assert.ok(register > -1 && select > -1);
  assert.ok(register < select, "the invocation is registered BEFORE the model is called");

  /*
   * `finalizeInvocation` returns a boolean nobody branches on: a failed observation must not be
   * able to change the outcome of a request whose proposal already exists.
   *
   * The claim is about PERSISTENCE FAILURE, not about the server-only guard every server module
   * carries — that guard fires on a programming error, never on a database that is merely down.
   * So the assertion is that the durable work is caught and reported as `false`.
   */
  const provenance = codeOf(read(PROVENANCE));
  const finalizeBody = provenance.slice(
    provenance.indexOf("export async function finalizeInvocation"),
    provenance.indexOf("export interface InvocationProvenanceView"),
  );
  assert.ok(
    /catch\s*\{[\s\S]*?return false;[\s\S]*?\}/.test(finalizeBody),
    "a persistence failure is reported as false, never raised",
  );
  assert.equal(
    /catch[\s\S]*?throw/.test(finalizeBody),
    false,
    "finalization never rethrows a persistence failure",
  );
  assert.equal(
    /if\s*\(\s*!?\s*await\s+finalizeInvocation/.test(code),
    false,
    "no control flow branches on whether provenance landed",
  );
}

function main(): void {
  provenanceGrantsNothing();
  provenanceNeverWritesProposals();
  noAuthorityReadsProvenance();
  theLinkIsAValue();
  noForeignKey();
  nothingSensitiveIsStorable();
  axesStaySeparate();
  orderingAndVeto();
  console.log("PASS agent-proposal-4b boundaries and firewall");
}

main();
