/*
 * AGENT-PROPOSAL-2 — the Director surface, structurally.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human may ask Heby for a bounded proposal, and the ONLY thing the browser may say is a
 *    sentence. Every other decision — which agent, which action, which recipient, which draft,
 *    which tenant — is made on the server, and asking cannot approve, authorize or execute
 *    anything."
 *
 * The panel is where authority would leak in if it were going to. A single extra form field —
 * "choose a recipient", "pick the action" — would flip the attribution from the agent back to the
 * human without changing a line of the server, and every proposal the surface produced would then
 * be misattributed. That is asserted here rather than trusted.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination";
import { resolveAgentProposerDisplays } from "../../src/features/action-authorization/agent-proposer-display.server";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return ext.test(e.name) ? [rel] : [];
  });
}

const PANEL = "src/components/decision-workspace/agent-proposal-request.tsx";
const PAGE = "src/app/(dashboard)/approvals/page.tsx";
const HEBY_ACTIONS = "src/app/(dashboard)/heby/actions.ts";
const APPROVALS_ACTIONS = "src/app/(dashboard)/approvals/actions.ts";
const READER = "src/features/action-authorization/read-action-authorizations.server.ts";
const DISPLAY = "src/features/action-authorization/agent-proposer-display.server.ts";

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE BROWSER MAY SAY ONE SENTENCE, AND NOTHING ELSE.
 * ═════════════════════════════════════════════════════════════════════════ */

function theBrowserSuppliesOnlyAGoal(): void {
  const actions = read(HEBY_ACTIONS);
  const entry = actions.slice(actions.indexOf("export async function originateHebyActionProposalAction("));
  const signature = entry.slice(0, entry.indexOf("{", entry.indexOf(")")) + 1);

  /*
   * THE FIELDS THAT WOULD FLIP THE ATTRIBUTION, ASSERTED FIRST. If any of these were accepted from
   * the client, the human would be choosing the act and the proposer would have to be recorded as
   * human. It comes before the shape check on purpose: adding a field also changes the shape, and a
   * shape assertion placed above would report a formatting defect rather than the ATTRIBUTION
   * defect it actually is.
   */
  const body = entry.slice(0, entry.indexOf("\n}\n") + 3);
  for (const forbidden of [
    "agentId",
    "actorType",
    "actorId",
    "tenantId",
    "actionKind",
    "recipientRef",
    "draftRef",
    "permitId",
    "proposer",
  ]) {
    assert.ok(
      !body.includes(forbidden),
      `the origination action must not accept "${forbidden}" from the browser`,
    );
  }

  /* Only then: the contract really is that one field and no more. */
  assert.ok(
    /input:\s*\{\s*readonly goal:\s*string;?\s*\}/.test(signature.replace(/\s+/g, " ")),
    "the server action accepts exactly one field: the human's goal",
  );

  /* And the panel has no control that could produce one. */
  const panel = codeOf(read(PANEL));
  for (const forbidden of [
    "agentId",
    "actorType",
    "tenantId",
    "actionKind",
    "recipientRef",
    "draftRef",
    "permitId",
    "<select",
    "listActiveRecipients",
    "listWorkArtifacts",
  ]) {
    assert.ok(
      !panel.includes(forbidden),
      `the panel must offer no way to choose "${forbidden}" — that is the agent's job, not the browser's`,
    );
  }
  /* One input, and it is prose. */
  assert.ok(panel.includes("<textarea"), "the one input is free text");
  assert.equal(
    (panel.match(/<textarea/g) ?? []).length,
    1,
    "exactly one input — a second would be a second decision the browser was making",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE SURFACE APPROVES, AUTHORIZES AND EXECUTES NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */

function theSurfaceGrantsNothing(): void {
  const panel = codeOf(read(PANEL));
  for (const forbidden of [
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "executeAuthorizedAction",
    "consumeActionPermit",
    "approvals/actions",
    "@/db/",
    "drizzle-orm",
    "fetch(",
    "heby-model",
    "setInterval",
    "setTimeout",
  ]) {
    assert.ok(!panel.includes(forbidden), `the panel must not reach "${forbidden}"`);
  }

  /*
   * BOTH SIDES OF THE RELEASED BOUNDARY STILL HOLD. `approvals/actions.ts` says it has no propose
   * action and that Heby cannot reach it; that is why origination was exported from Heby's module
   * instead. Asserted from both directions so neither sentence can quietly become false.
   */
  const approvals = codeOf(read(APPROVALS_ACTIONS));
  for (const forbidden of [
    "originateAgentAction",
    "agent-origination",
    "recordActionRequest",
    "recordAgentOriginatedActionRequest",
    "heby-action-inlet",
  ]) {
    assert.ok(
      !approvals.includes(forbidden),
      `approvals/actions.ts must still have no propose action ("${forbidden}")`,
    );
  }
  const heby = codeOf(read(HEBY_ACTIONS));
  for (const forbidden of [
    "approveActionRequest",
    "rejectActionRequest",
    "revokeActionPermit",
    "executeAuthorizedAction",
    "decide-action-request",
    "action-execution",
    'from "next/cache"',
  ]) {
    assert.ok(!heby.includes(forbidden), `the Heby boundary must still not reach "${forbidden}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE UI NEVER CLAIMS AN ACT OCCURRED.
 * ═════════════════════════════════════════════════════════════════════════ */

function theWordingStaysTruthful(): void {
  const panel = read(PANEL);
  for (const forbidden of [
    "will send",
    "has sent",
    "was sent",
    "Heby sent",
    "executed",
    "approved automatically",
    "on your behalf",
  ]) {
    assert.ok(!panel.includes(forbidden), `the panel must not say "${forbidden}"`);
  }
  assert.ok(
    panel.includes("nothing has been authorized"),
    "success wording says explicitly that nothing was authorized",
  );
  assert.ok(
    /Heby proposes\. A human authorizes\. Execution is a separate, later act\./.test(panel),
    "the ladder is stated on the surface itself",
  );
  assert.ok(
    panel.includes("it cannot") || panel.includes("cannot\n"),
    "and the panel states what asking cannot do",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. EVERY OUTCOME IS ITS OWN SENTENCE.
 *
 * The requirement is not "handle errors" — it is that a Director can tell an agent that does not
 * exist from a model that is down from a model that answered off-contract from a proposal that is
 * already waiting. Collapsing any pair of these hides a refusal that is working correctly.
 * ═════════════════════════════════════════════════════════════════════════ */

function outcomesAreDistinguishable(): void {
  const panel = read(PANEL);
  const wording = panel.slice(panel.indexOf("REFUSAL_WORDING"), panel.indexOf("type Outcome"));

  const REQUIRED = [
    "no-action-proposed",
    "no-candidates",
    "model-unavailable",
    "goal-rejected",
    "unauthenticated",
    "no-authorized-tenant-context",
    "no-durable-agent-identity",
    "durable-agent-identity-retired",
    "ambiguous-durable-agent-identity",
    "agent-identity-authority-unavailable",
    "not-a-structured-object",
    "unexpected-shape",
    "unsupported-action-kind",
    "invalid-arguments",
    "malformed-reference",
    "reference-not-offered",
    "invalid-reason",
    "proposal-refused",
  ] as const;
  for (const reason of REQUIRED) {
    /* Either spelling of the key — `unauthenticated` needs no quotes to be a valid one. */
    assert.ok(
      wording.includes(`"${reason}"`) || new RegExp(`^\\s*${reason}:`, "m").test(wording),
      `"${reason}" has its own wording`,
    );
  }

  /* Distinct STRINGS, not merely distinct keys — a shared sentence is a collapsed outcome. */
  const sentences = [...wording.matchAll(/"[a-z-]+":\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]!);
  const shared = sentences.filter((s, i) => sentences.indexOf(s) !== i && s !== "Sign in to ask Heby for a proposal.");
  assert.deepEqual(shared, [], "no two distinct failures share one sentence");

  /* The duplicate is called a duplicate, not a failure to file. */
  assert.ok(
    panel.includes("already, and it is still waiting for your review"),
    "an already-pending proposal is described as already pending, never as a broken write",
  );

  /* And nothing collapses into a generic apology. */
  for (const generic of ["Something went wrong", "An error occurred", "Try again later", "Unknown error"]) {
    assert.ok(!panel.includes(generic), `the panel must not say "${generic}"`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE IDENTITY DISPLAY SEAM READS, AND OWNS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */

function theDisplaySeamIsARead(): void {
  const display = codeOf(read(DISPLAY));
  for (const banned of [
    "@/db/schema/agent",
    "getControlPlaneDb",
    "resolveGovernanceDbOrNull",
    "drizzle-orm",
    ".select(",
    ".insert(",
    ".update(",
    ".delete(",
    "agent-runtime",
    "agent-crud",
    "@/features/agents",
  ]) {
    assert.ok(
      !display.includes(banned),
      `${DISPLAY} must contain no store of its own ("${banned}")`,
    );
  }
  assert.ok(
    display.includes("readDurableAgentIdentityState"),
    "it reads through the released AGENT-ID-0.1 seam and nothing else",
  );

  /* It takes a tenant, so it cannot be asked about another organization's agent. */
  assert.equal(
    resolveAgentProposerDisplays.length,
    2,
    "it requires a tenant and the ids — never a tenant-free lookup",
  );

  /* No UI file queries the agents table directly. */
  for (const file of collect("src/components/decision-workspace")) {
    const code = codeOf(read(file));
    for (const banned of ["@/db/", "drizzle-orm", "agents", "getControlPlaneDb"]) {
      if (banned === "agents") {
        assert.ok(
          !/@\/db\/schema\/agent|from "drizzle/.test(code),
          `${path.basename(file)} must not query agents directly`,
        );
        continue;
      }
      assert.ok(!code.includes(banned), `${path.basename(file)} must not reach "${banned}"`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. NO NEW ROUTE, NO SECOND HEBY UI, NO SECOND PROPOSAL DASHBOARD.
 * ═════════════════════════════════════════════════════════════════════════ */

function noSurfaceProliferation(): void {
  const routes = collect("src/app/(dashboard)", /page\.tsx$/).length;
  assert.ok(routes > 0, "routes are discoverable");

  /* The panel is mounted inside the EXISTING slot on the EXISTING route. */
  const page = codeOf(read(PAGE));
  assert.ok(page.includes("<AgentProposalRequest />"), "the panel is mounted on /approvals");
  assert.ok(page.includes("<ActionAuthorizations"), "beside the queue it feeds, not instead of it");

  /* Exactly one component renders the pending queue, and exactly one asks for a proposal. */
  const askers = collect("src").filter((f) =>
    codeOf(read(f)).includes("originateHebyActionProposalAction("),
  );
  assert.deepEqual(
    askers.sort(),
    [PANEL, HEBY_ACTIONS].sort(),
    "one panel asks, through one action — no second entry point",
  );

  /* No conversation UI was duplicated: the panel holds no thread, history or message list. */
  const panel = codeOf(read(PANEL));
  for (const banned of ["askHebyAction", "useHebyConversation", "conversationId", "messages"]) {
    assert.ok(!panel.includes(banned), `the panel must not become a second Heby conversation ("${banned}")`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE CAPABILITY IS STILL BOUNDED, AND STILL NOT MULTI-AGENT.
 * ═════════════════════════════════════════════════════════════════════════ */

function theCapabilityDidNotWiden(): void {
  /*
   * AGENT-PROPOSAL-2 ADMITTED NO ACTION KIND, and it still has not. GIA-1 admitted `record-work`,
   * which is why this value moved; the claim this file makes is about ITS OWN phase, and the
   * surface below is still the same single-kind ask control it released.
   */
  assert.deepEqual(
    [...AGENT_ORIGINABLE_ACTION_KINDS],
    ["send", "record-work"],
    "the released vocabulary is `send` (AGENT-PROPOSAL-1) plus `record-work` (GIA-1), and nothing else",
  );

  /*
   * MULTI-AGENT SELECTION IS STILL DEFERRED, AND THE SURFACE SAYS SO RATHER THAN GUESSING. The
   * ambiguity refusal is rendered as its own sentence; a surface that silently picked an agent
   * would be inventing the answer this phase deliberately did not build.
   */
  const panel = read(PANEL);
  assert.ok(
    panel.includes("Explicit agent selection does not exist yet"),
    "the ambiguous-agent case tells the truth about what is missing",
  );
  for (const banned of ["agents[0]", "first agent", "identities[0]"]) {
    assert.ok(!panel.includes(banned), `the surface must not select an agent ("${banned}")`);
  }

  /* No literal uuid anywhere in the new surface or seam. */
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  for (const file of [PANEL, DISPLAY, HEBY_ACTIONS]) {
    assert.equal(UUID_RE.test(codeOf(read(file))), false, `${file} contains no literal uuid`);
  }
  /* And no hard-coded agent name in the seam that resolves one. */
  assert.equal(/["'`]Heby["'`]/.test(codeOf(read(DISPLAY))), false, "the display seam names no agent");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. ZERO SCHEMA, ZERO MIGRATION.
 * ═════════════════════════════════════════════════════════════════════════ */

function schemaIsUntouched(): void {
  const sql = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  /*
   * RE-PINNED BY AGENT-PROPOSAL-4B, WHICH APPENDED MIGRATION 37.
   *
   * This states "AGENT-PROPOSAL-2 adds no migration" the same way it always did — by pinning the
   * total. A filename filter for this phase's own tag was considered and rejected: no migration
   * here is named after its phase, so such a filter is empty for every possible repository state
   * and could never fail. An absolute pin can rot, but it cannot lie.
   */
  assert.equal(sql.length, 44, "AGENT-PROPOSAL-2 adds no migration"); /* GIA-1 grew the ledger 43 -> 44: the `record-work` mandate-scope CHECK. */
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(journal.entries.length, 44, "and the ledger is unchanged by this phase");
  /* And the ledger still agrees with the files on disk — an integrity check that cannot rot. */
  assert.equal(journal.entries.length, sql.length, "the ledger and the migration files agree");

  for (const file of [PANEL, DISPLAY, HEBY_ACTIONS, READER]) {
    assert.equal(/pgTable\s*\(/.test(codeOf(read(file))), false, `${file} declares no table`);
  }

  /* The human-only CHECKs are still declared, untouched by a UI phase. */
  const schema = read("src/db/schema/action-authorization.ts");
  assert.ok(schema.includes("heby_action_requests_human_approver_chk"));
  assert.ok(schema.includes("action_permits_human_authorizer_chk"));
}

function main(): void {
  theBrowserSuppliesOnlyAGoal();
  theSurfaceGrantsNothing();
  theWordingStaysTruthful();
  outcomesAreDistinguishable();
  theDisplaySeamIsARead();
  noSurfaceProliferation();
  theCapabilityDidNotWiden();
  schemaIsUntouched();
  console.log("PASS agent-proposal-2 surface and firewall");
}

main();
