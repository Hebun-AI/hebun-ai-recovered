/*
 * AGENT-ID-0.1 — the boundaries retirement and the authenticated creation surface must not cross.
 *
 * ── THE FOUR CLAIMS THIS FILE DEFENDS ───────────────────────────────────────
 *
 * 1. RETIREMENT IS A WITHDRAWAL, NOT A DELETION. The authority contains no DELETE, writes no
 *    `deleted_*` column, and fabricates no successor.
 * 2. THE GENESIS ONE-SHOT CANNOT BE REOPENED BY ANYTHING IN THIS PHASE. The creation predicate is
 *    still bare existence — no lifecycle filter, no soft-delete filter — and no test helper in the
 *    repository erases an agent row.
 * 3. NEITHER NEW PATH GRANTS ANYTHING. Walked import graph, not path names: no credential, session,
 *    permit, decision or execution module is reachable, and Governance is not widened.
 * 4. THE PRODUCT PRESENTS ONE DURABLE AGENT CREATION AUTHORITY. The in-memory simulation is intact
 *    and unpromoted, but no control it offers reads as creating a real Hebun agent.
 *
 * Source is read with comments STRIPPED. A firewall that reads raw text can be tripped by a comment
 * naming the very thing it forbids — this file and its subjects name several of them on purpose.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CREATE_AUTHORITY = "src/features/agent-identity/create-durable-agent-identity.server.ts";
const RETIRE_AUTHORITY = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const READ_MODULE = "src/features/agent-identity/read-durable-agent-identity.server.ts";
const ACTIONS = "src/app/(dashboard)/agents/actions.ts";
const FEATURE_DIR = "src/features/agent-identity";

const AGENTS_PAGE = "src/app/(dashboard)/agents/page.tsx";
const REGISTRY_PAGE = "src/app/(dashboard)/director/registries/agents/page.tsx";
const MOCK_WORKSPACE = "src/components/agents/agent-registry-workspace.tsx";
const DURABLE_CARD = "src/components/agents/durable-agent-identity-card.tsx";
const TRUTH_SURFACE = "src/components/agents/agents-truth-surface.tsx";
const DISCLOSURE = "src/features/agent-identity/ceremony-disclosure.ts";
const STORAGE_MANAGER = "src/features/persistence/storage-manager.ts";
const GOVERNANCE_CONTRACTS = "src/features/governance-decision/contracts.ts";
const MIGRATIONS = "src/db/migrations";

/* Modules neither new path may reach. Retirement is not authentication, authorization or runtime. */
const FORBIDDEN_REACH = [
  "src/features/auth-runtime/credential-repository.server.ts",
  "src/features/action-execution/execute-authorized-action.server.ts",
  "src/features/action-authorization/decide-action-request.server.ts",
  "src/features/governance-decision/decision-authority.server.ts",
] as const;

/* Verbs the feature must not own even now. Absent, not guarded — a missing verb cannot be called. */
const STILL_FORBIDDEN_VERBS = [
  "reinstateAgent",
  "restoreAgent",
  "unretireAgent",
  "suspendAgent",
  "archiveAgent",
  "deleteAgent",
  "renameAgent",
  "succeedAgent",
  "replaceAgent",
  "activateAgent",
  "authenticateAgent",
  "authorizeAgent",
  "executeAsAgent",
  "issueAgentCredential",
  "createAgentSession",
  "delegateToAgent",
] as const;

/** Fields the client must never be able to send. The action signatures make each unrepresentable. */
const UNREPRESENTABLE_INPUTS = [
  "tenantId",
  "humanOwnerId",
  "humanOwnerType",
  "ownerId",
  "actorId",
  "actorType",
  "createdBy",
  "createdByType",
  "updatedBy",
  "updatedByType",
  "managerActorId",
  "authorityCeiling",
  "roleId",
  "permission",
  "credential",
  "sessionContextId",
  "agentLifecycleStatus",
  "lifecycleStatus",
  "retiredAt",
  "retiredById",
  "replacedByAgentId",
  "executionPosture",
] as const;

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * The REAL import graph, walked. A path-name rule would pass while a db handle smuggled the world in.
 *
 * `cut` removes named modules from the walk WITHOUT marking them reached, so a caller can ask "what
 * would still be reachable if this authority were not in the graph?" — which is how AMA-3 proves the
 * Governance decision writer is reached THROUGH the mandate authority rather than beside it.
 */
function reachableFrom(entry: string, cut: ReadonlySet<string> = new Set()): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file) || cut.has(file)) continue;
    seen.add(file);
    const code = codeOf(read(file));
    for (const match of code.matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function allSourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return allSourceFiles(rel);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

/** True when the caller-supplied `input` shape of the retirement authority names `field`. */
function retireSignatureContains(code: string, field: string): boolean {
  const start = code.indexOf("export async function retireDurableAgentIdentity");
  const end = code.indexOf("): Promise<RetireDurableAgentIdentityResult>");
  return start >= 0 && end > start && code.slice(start, end).includes(field);
}

/** The body of one exported function, so an assertion cannot be satisfied by an import line. */
function bodyOf(code: string, fn: string): string {
  const start = code.indexOf(`export async function ${fn}`);
  assert.ok(start >= 0, `\`${fn}\` was located in the module under inspection`);
  return code.slice(start);
}

function main(): void {
  const retire = codeOf(read(RETIRE_AUTHORITY));
  const create = codeOf(read(CREATE_AUTHORITY));
  const readCode = codeOf(read(READ_MODULE));
  const actions = codeOf(read(ACTIONS));
  const featureCode = allSourceFiles(FEATURE_DIR)
    .map((f) => codeOf(read(f)))
    .join("\n");

  /* ── 1. RETIREMENT IS A WITHDRAWAL, NOT A DELETION ────────────────────────── */
  assert.ok(
    !/\.delete\(/.test(retire),
    "the retirement authority performs no `.delete(` — a withdrawal removes nothing",
  );
  assert.ok(
    !/delete\s+from/i.test(retire),
    "the retirement authority issues no raw `delete from` either",
  );
  const updateTargets = [...retire.matchAll(/\.update\((\w+)\)/g)].map((m) => m[1]);
  assert.deepEqual(
    updateTargets,
    ["agents"],
    "the authority performs exactly one update, into `agents`, and nothing else",
  );
  assert.ok(
    !/\.insert\(/.test(retire),
    "retirement inserts nothing — no successor row, no audit row it has no contract for",
  );

  /*
   * THE SET CLAUSE IS THE WHOLE PROMISE. Six keys, named exactly. A seventh — `deletedAt`,
   * `replacedByAgentId`, `lifecycleStatus`, `suspendedAt` — would be a different act wearing
   * retirement's name, and it would pass a test that only counted columns.
   */
  const setClause = retire.slice(retire.indexOf(".set({"), retire.indexOf("})\n      .where"));
  assert.ok(setClause.length > 0, "the retirement `set` clause was located");
  assert.deepEqual(
    [...setClause.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]).sort(),
    [
      "agentLifecycleStatus",
      "retiredAt",
      "updatedAt",
      "updatedBy",
      "updatedByType",
      "version",
    ],
    "retirement writes exactly these six keys — the lifecycle, the stamp, the actor pair and the bookkeeping",
  );
  for (const untouched of [
    "deletedAt",
    "deletedBy",
    "deletedByType",
    "replacedByAgentId",
    "suspendedAt",
    "lifecycleStatus:",
    "name:",
    "humanOwnerId",
    "humanOwnerType",
    "createdBy",
  ]) {
    assert.ok(
      !setClause.includes(untouched),
      `\`${untouched}\` is never written by retirement — the record, the name, the ownership and ` +
        `the creation attribution all survive, and no successor is fabricated`,
    );
  }

  /*
   * BOTH-OR-NEITHER. `agents` carries no CHECK enforcing the actor-pair doctrine, so the doctrine is
   * upheld here or nowhere: an id with no type, or a type with no id, is false provenance.
   */
  assert.ok(
    setClause.includes("updatedBy: tenant.userId") && setClause.includes('updatedByType: "human"'),
    "the actor pair is written together, and the id is the resolved human — not a caller's claim",
  );

  /* ── 2. THE GENESIS ONE-SHOT IS STILL BARE EXISTENCE ──────────────────────── */
  const oneShot = create.slice(create.indexOf("const [existing]"), create.indexOf("6 ·") >= 0 ? create.indexOf("6 ·") : create.length);
  assert.ok(
    oneShot.includes("eq(agents.tenantId, tenant.tenantId)"),
    "the one-shot predicate is still the tenant, and only the tenant",
  );
  for (const narrowing of [
    "isNull(agents.deletedAt)",
    "agents.retiredAt",
    "agents.agentLifecycleStatus",
    "agents.lifecycleStatus",
    "deleted_at",
    "retired_at",
  ]) {
    assert.ok(
      !oneShot.includes(narrowing),
      `the one-shot count is NOT narrowed by \`${narrowing}\` — a retired or soft-deleted identity ` +
        `must still spend genesis, or retirement would silently reopen the ceremony`,
    );
  }

  /*
   * NOTHING IN THE FEATURE CAN ERASE HISTORICAL EXISTENCE. Not the writers, and not a helper.
   * A hard delete anywhere here would make "retired agent != never existed" untrue by another route.
   */
  assert.ok(
    !/\.delete\(|delete\s+from/i.test(featureCode),
    "no file in the agent-identity feature deletes anything — historical existence cannot be erased",
  );

  /* ── 3. THE READ GRANTS NOTHING AND DECIDES NOTHING ───────────────────────── */
  for (const mutating of [".insert(", ".update(", ".delete(", ".transaction("]) {
    assert.ok(
      !readCode.includes(mutating),
      `the identity read performs no \`${mutating}\` — it is diagnostic, with no authority effect`,
    );
  }
  assert.ok(
    bodyOf(readCode, "readDurableAgentIdentityState").includes(
      "eq(agents.tenantId, tenant.tenantId)",
    ),
    "the read is tenant-scoped inside its own body — no caller can widen it",
  );

  /* ── 4. NEITHER NEW PATH GRANTS AUTHORITY ─────────────────────────────────── */

  /*
   * THE AUTHORITIES REACH NONE OF THE FOUR. This is the load-bearing claim: whatever the surface
   * above them does, the modules that actually write cannot issue a credential, open a session,
   * decide an authorization, record a governance decision or execute an action.
   */
  for (const entry of [CREATE_AUTHORITY, RETIRE_AUTHORITY, READ_MODULE]) {
    const reach = reachableFrom(entry);
    for (const forbidden of FORBIDDEN_REACH) {
      assert.ok(
        !reach.has(forbidden),
        `${entry} must not reach ${forbidden} — retiring or creating an identity grants no ` +
          `credential, permit, decision or execution`,
      );
    }
  }

  /*
   * THE ACTION BOUNDARY IS NARROWER THAN THE PRECEDENT IT FOLLOWS — but not zero, and pretending
   * otherwise would be false. `resolveTenantContext` AUTHENTICATES THE HUMAN, and authenticating a
   * human means reading that human's credential, so every server action in this repository reaches
   * `credential-repository.server.ts` through the session runtime. Knowledge's action reaches it too.
   *
   * What matters is that reaching the session runtime is the ONLY thing it buys. The three modules
   * that could actually grant or execute something stay unreachable — and Knowledge's own action
   * reaches one of them (`decision-authority`, because ratification is a governance act), so this
   * boundary is strictly narrower than the released precedent rather than merely equal to it.
   */
  /*
   * ── AMA-3 MOVED THIS BOUNDARY FROM "NARROWER THAN THE PRECEDENT" TO "EQUAL TO IT" ──────────
   *
   * The comment above already named the shape: Knowledge's action reaches `decision-authority`
   * BECAUSE RATIFICATION IS A GOVERNANCE ACT. AMA-3 gave `/agents` a third authority whose act is
   * governance in exactly the same way — AMA-1's design is that Governance authorizes every mandate
   * transition, in the mandate writer's own transaction. So this boundary now reaches the decision
   * writer for the same reason the released precedent does, and asserting otherwise would be
   * asserting that a mandate needs no human authorization.
   *
   * IT IS REACHED THROUGH THE MANDATE AUTHORITY, NEVER DIRECTLY, and that is asserted below rather
   * than assumed. The other three forbidden modules stay unreachable: this boundary still issues no
   * credential, decides no action request and executes nothing.
   *
   *     GOVERNANCE AUTHORIZES A MANDATE != GOVERNANCE OWNS A MANDATE
   */
  const GOVERNANCE_DECISION = "src/features/governance-decision/decision-authority.server.ts";
  const actionReach = reachableFrom(ACTIONS);
  for (const forbidden of FORBIDDEN_REACH.filter(
    (f) =>
      f !== "src/features/auth-runtime/credential-repository.server.ts" &&
      f !== GOVERNANCE_DECISION,
  )) {
    assert.ok(
      !actionReach.has(forbidden),
      `${ACTIONS} must not reach ${forbidden} — the boundary authenticates a human and calls ` +
        `named authorities; it issues no credential, decides no action request and executes nothing`,
    );
  }

  /*
   * AND THE GOVERNANCE REACH IS THE MANDATE AUTHORITY'S, NOT THE BOUNDARY'S. Removing the mandate
   * writer from the graph must remove the decision writer with it — otherwise this action would
   * have acquired a direct path to Governance, which is a different and much worse fact.
   */
  assert.ok(
    actionReach.has(GOVERNANCE_DECISION),
    "the boundary reaches the Governance decision writer, because recording a mandate is a governance act",
  );
  assert.ok(
    !reachableFrom(ACTIONS, new Set(["src/features/agent-mandate/establish-agent-mandate.server.ts"])).has(
      GOVERNANCE_DECISION,
    ),
    "and it reaches it ONLY through the mandate authority — no direct Governance door was opened",
  );
  assert.ok(
    reachableFrom("src/app/(dashboard)/knowledge/actions.ts").has(
      "src/features/governance-decision/decision-authority.server.ts",
    ),
    "the released Knowledge boundary does reach the governance authority — so the comparison above " +
      "is measured against the real precedent, not an imagined stricter one",
  );

  /*
   * THE ACTION MODULE'S OWN IMPORTS ARE ENUMERATED. Everything it can reach, it reaches through
   * the session resolver or through a named authority — there is no unnamed door.
   *
   * ── EXTENDED BY SIA-3.1, AND EXTENDED RATHER THAN RELAXED ─────────────────
   *
   * The `/agents` boundary gained a THIRD authority: the released SIA-3 hypothesis writer, so an
   * authenticated human can file an evidence-backed question about an agent's selection behaviour.
   * It is the same shape as the two above it — one authority, called with the resolved tenant, no
   * gate held here — and it appears TWICE because its result type is declared in the same module
   * (SIA-3 put the type beside the writer rather than in a contracts file, so the value import and
   * the `import type` name the same specifier).
   *
   * ── EXTENDED AGAIN BY AMA-3, AND AGAIN EXTENDED RATHER THAN RELAXED ──────
   *
   * A FOURTH authority: the released AMA-1 mandate writer, so an authenticated human holding
   * Governance authority can record what a durable agent is FOR. Same shape as the three above it —
   * one authority, called with the resolved tenant, no gate held here — and its result TYPE comes
   * from the mandate feature's own `contracts` module, which declares types and refusal codes and
   * holds no database handle, no query and no authority.
   *
   * The census stays EXACT, which is the whole value of it: a fifth authority still fails here.
   * Loosening this to a prefix rule would let any future agent-side capability arrive silently,
   * which is precisely what this assertion exists to stop.
   */
  assert.deepEqual(
    [...actions.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!).sort(),
    [
      "@/features/agent-identity/contracts",
      "@/features/agent-identity/create-durable-agent-identity.server",
      "@/features/agent-identity/retire-durable-agent-identity.server",
      "@/features/agent-identity/retirement-contracts",
      "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server",
      "@/features/agent-improvement-hypothesis/write-improvement-hypothesis.server",
      "@/features/agent-mandate/contracts",
      "@/features/agent-mandate/establish-agent-mandate.server",
      "@/features/auth-runtime/request-session.server",
      "next/cache",
    ],
    "the boundary imports exactly the session resolver, the FOUR authorities, their type-only " +
      "contracts modules, and revalidation — nothing else has a door here",
  );

  for (const entry of [CREATE_AUTHORITY, RETIRE_AUTHORITY, READ_MODULE, ACTIONS]) {
    const reach = reachableFrom(entry);
    assert.ok(
      ![...reach].some((f) => f.startsWith("src/features/persistence/")),
      `${entry} reaches no persistence-adapter module — the memory substrate is not durable authority`,
    );
    assert.ok(
      ![...reach].some((f) => f.startsWith("src/features/agent-crud/")),
      `${entry} reaches no agent-crud module — the durable authority never depends on the simulation`,
    );
  }
  for (const banned of ["auth_credentials", "user_session_contexts", "action_permits", "decision_records", "role_permissions"]) {
    assert.ok(
      !retire.includes(banned),
      `the retirement authority never names \`${banned}\` — it writes one table`,
    );
  }

  /*
   * THE PROOF SEAM IS TEST-ONLY. `afterRead` exists so the concurrency guarantee can be proved at a
   * real interleaving; it must never be reachable from the product. It is on the DEPS object, which
   * no action constructs, and the surface never names it.
   */
  assert.ok(
    retire.includes("readonly afterRead?: () => Promise<void>;"),
    "the barrier seam is declared on the deps object, not on the caller-supplied input",
  );
  assert.ok(
    !retireSignatureContains(retire, "afterRead"),
    "`afterRead` is not a field of the caller-supplied input — a client cannot hold a transaction open",
  );
  for (const surface of [ACTIONS, DURABLE_CARD, AGENTS_PAGE]) {
    assert.ok(
      !codeOf(read(surface)).includes("afterRead"),
      `${surface} never supplies \`afterRead\` — production passes no deps at all`,
    );
  }
  assert.ok(
    /createDurableAgentIdentity\(tenant, \{ name: input\?\.name \}\);/.test(actions) &&
      /retireDurableAgentIdentity\(tenant, \{ agentId: input\?\.agentId \}\);/.test(actions),
    "both actions call their authority with two arguments — no deps object crosses the boundary",
  );

  /* ── 5. THE CALLER CANNOT NAME A TENANT, A HUMAN, OR A TIMESTAMP ──────────── */
  const retireSignature = retire.slice(
    retire.indexOf("export async function retireDurableAgentIdentity"),
    retire.indexOf("): Promise<RetireDurableAgentIdentityResult>"),
  );
  assert.ok(retireSignature.length > 0, "the retirement signature was located");
  assert.ok(
    /input:\s*\{\s*readonly agentId: unknown\s*\}/.test(retireSignature),
    "the only caller-supplied field is the identity reference — there is no tenant, actor or clock parameter",
  );
  assert.ok(
    retire.includes("tenant.tenantId") && retire.includes("tenant.userId"),
    "tenant and acting human are read from the resolved context",
  );
  /*
   * THE TENANT PREDICATE IS PART OF THE LOOKUP, NOT A CHECK AFTER IT. If it were a post-hoc
   * comparison, a cross-tenant identifier would already have been read before being rejected.
   */
  const lookup = retire.slice(retire.indexOf("const [row]"), retire.indexOf("if (!row)"));
  assert.ok(
    lookup.includes("eq(agents.tenantId, tenant.tenantId)") && lookup.includes('.for("update")'),
    "the row is located BY tenant and locked in the same statement — another organization's row is never selected",
  );

  /* ── 6. THE ACTION BOUNDARY IS THIN, SERVER-RESOLVED AND FAIL-CLOSED ──────── */
  assert.ok(actions.trimStart().startsWith('"use server"'), "the boundary is a server-action module");
  /*
   * DERIVED FROM THE NUMBER OF ACTIONS, NOT PINNED TO IT (repaired by SIA-3.1).
   *
   * This read `=== 2`, which said "each action resolves the tenant for itself" while actually
   * asserting "there are two actions". SIA-3.1 added a third and the pin failed for a reason that
   * had nothing to do with what it was defending — the tenant is still resolved exactly once per
   * action, which is the claim.
   *
   * Tying the two counts together says the real thing and cannot rot: an action added WITHOUT its
   * own resolution fails, an action that resolves twice fails, and a helper that resolved once and
   * shared the context across actions fails. A bare number could catch none of those.
   */
  const exportedActions = (actions.match(/export async function/g) ?? []).length;
  assert.ok(exportedActions >= 2, "the boundary exports actions to check");
  assert.equal(
    (actions.match(/resolveTenantContext\(\)/g) ?? []).length,
    exportedActions,
    "each action resolves the tenant server-side, exactly once, for itself",
  );
  for (const smuggled of UNREPRESENTABLE_INPUTS) {
    assert.ok(
      !new RegExp(`input:\\s*\\{[^}]*\\b${smuggled}\\b`, "s").test(actions),
      `no action accepts \`${smuggled}\` — tenant, human, actor, clock and lifecycle are server-resolved`,
    );
  }
  /*
   * ── EXTENDED BY SIA-3.1, WITH THE REAL CLAIM SPLIT OUT ────────────────────
   *
   * This enumerated two actions and carried "there is no reinstate" inside the MESSAGE, so the
   * absence of a reinstate was implied by a count rather than asserted. SIA-3.1 added a third
   * action — filing a hypothesis, which is not an identity act at all — and the count would have
   * had to move whatever the third action was.
   *
   * So the enumeration is extended (still exact: a fourth fails) AND the reinstate ban is now
   * asserted by name, immediately below. The claim that mattered is now the one being made.
   */
  assert.deepEqual(
    [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]).sort(),
    [
      "createDurableAgentIdentityAction",
      /*
       * AMA-3. Recording or revising what a durable agent is FOR. ONE action for both, because
       * both are the same released transition: a new revision. There is deliberately no
       * `withdrawAgentMandateAction` — withdrawal is a revision whose scope is empty, and a
       * separate action would imply a second transition this authority does not have.
       */
      "establishAgentMandateAction",
      "fileImprovementHypothesisAction",
      "retireDurableAgentIdentityAction",
    ],
    "the boundary exposes exactly four actions: establish an identity, withdraw one, record a mandate, and file a hypothesis",
  );
  /*
   * AND THERE IS STILL NO REINSTATE — nor any other verb that would undo a retirement. Retirement
   * is terminal because no authority was written to reverse it, and none may arrive here quietly.
   */
  for (const forbidden of ["reinstate", "restore", "unretire", "revive", "reactivate"]) {
    assert.ok(
      !new RegExp(`export async function \\w*${forbidden}`, "i").test(actions),
      `the boundary exposes no \`${forbidden}\` action — retirement is terminal`,
    );
  }
  /* FAIL CLOSED: the null from an unauthenticated request is PASSED THROUGH, never substituted. */
  for (const fallback of ["?? {", "|| {", "tenantId:", "userId:"]) {
    assert.ok(
      !actions.includes(fallback),
      `the boundary never constructs a fallback identity (\`${fallback}\`) — an unauthenticated ` +
        `request reaches the authority as null and is refused there`,
    );
  }

  /* ── 7. ONE DURABLE AGENT CREATION AUTHORITY IN THE PRODUCT ───────────────── */
  const mock = read(MOCK_WORKSPACE);
  const durableCard = read(DURABLE_CARD);

  /*
   * THE SIMULATION IS INTACT. Its capability was the thing worth protecting, so it is asserted
   * present — this phase relabelled a control, it did not delete a subsystem.
   */
  for (const verb of ["createAgent", "updateAgent", "archiveAgent", "restoreAgent", "deleteAgent"]) {
    assert.ok(
      codeOf(mock).includes(verb),
      `the simulation still offers \`${verb}\` — no capability was destroyed to resolve the contradiction`,
    );
  }
  assert.ok(
    /const ACTIVE_PROVIDER: StorageProvider = "memory";/.test(codeOf(read(STORAGE_MANAGER))),
    "the simulation is still memory-backed — it was not promoted to durable truth",
  );

  /*
   * AND IT NAMES ITSELF AT EVERY CONTROL. The defect was never that a simulation existed; it was
   * that its controls said "Create Agent" — the same sentence a real authority would say.
   */
  assert.ok(
    !/>\s*Create Agent\s*</.test(mock) && !mock.includes('"Create Agent"'),
    "no control in the simulation reads `Create Agent` — that sentence belongs to a real authority",
  );
  assert.ok(
    !mock.includes('"Edit Agent"'),
    "the simulation's drawer does not read `Edit Agent` either — the control and its drawer agree",
  );
  assert.ok(
    mock.includes("Create simulated definition"),
    "the simulation's creation control names what it actually creates",
  );

  /*
   * THE DIRECTOR REGISTRY PAGE NO LONGER PRESENTS THE SIMULATION AS ORGANIZATIONAL TRUTH.
   *
   * Read with comments STRIPPED, and for the reason this file's header gives: the page's own comment
   * QUOTES the wording it stopped using, in order to record what was corrected. A raw-text rule
   * failed here on the honest explanation rather than on a live claim — which is the defect this
   * repository has hit before, not a reason to delete the explanation.
   */
  const registryPage = codeOf(read(REGISTRY_PAGE));
  assert.ok(
    /simulated/i.test(registryPage),
    "the director registry page names the simulation as simulated",
  );
  assert.ok(
    !/first-class agent definitions/i.test(registryPage),
    "the director registry page no longer calls in-memory rows `first-class agent definitions`",
  );
  assert.ok(
    !/variant="success"/.test(registryPage),
    "the simulated count no longer carries a success badge, which read as live organizational health",
  );
  assert.ok(
    codeOf(registryPage).includes("AgentRegistryWorkspace"),
    "the director registry page still renders the workspace — the surface was corrected, not removed",
  );

  /* EXACTLY ONE DURABLE CREATION CONTROL EXISTS, AND IT IS THE CARD. */
  const durableActionUsers = [
    ...allSourceFiles("src/components"),
    ...allSourceFiles("src/app"),
  ].filter((f) => f !== ACTIONS && codeOf(read(f)).includes("createDurableAgentIdentityAction"));
  assert.deepEqual(
    durableActionUsers,
    [DURABLE_CARD],
    "exactly one component calls the durable creation action — there is no second durable creation control",
  );
  assert.ok(
    !codeOf(mock).includes("createDurableAgentIdentityAction") &&
      !codeOf(mock).includes("agent-identity"),
    "the simulation cannot reach the durable authority — routing it there would promote memory CRUD to truth",
  );
  assert.ok(
    !codeOf(durableCard).includes("@/features/agent-crud") &&
      !codeOf(durableCard).includes("getPersistenceTelemetry"),
    "the durable card infers nothing from the in-memory registry — durable state is never derived from mock state",
  );

  /* THE DURABLE SURFACE IS RENDERED, AND IT IS RENDERED FIRST. */
  const page = codeOf(read(AGENTS_PAGE));
  assert.ok(
    page.includes("DurableAgentIdentityCard") && page.includes("AgentsTruthSurface"),
    "the agents page renders both the durable ceremony and the existing truth surface",
  );
  assert.ok(
    page.indexOf("<DurableAgentIdentityCard") < page.indexOf("<AgentsTruthSurface"),
    "the durable authority is presented BEFORE the simulation, not beneath it",
  );
  assert.ok(
    page.includes("resolveTenantContext()"),
    "the page resolves the tenant server-side; the card is passed identifiers, never authority",
  );
  assert.ok(
    codeOf(read(TRUTH_SURFACE)).includes("AgentRegistryWorkspace"),
    "the existing truth surface still embeds the simulation — its framing is unchanged by this phase",
  );

  /* ── 8. THE DISCLOSURE CANNOT LOSE A RUNG OR GAIN A PROMISE ───────────────── */
  const disclosure = codeOf(read(DISCLOSURE));
  for (const rung of [
    "IDENTITY CREATED",
    "AUTHENTICATED",
    "AUTHORIZED",
    "RUNTIME AVAILABLE",
    "EXECUTABLE",
  ]) {
    assert.ok(disclosure.includes(rung), `the ladder still names the \`${rung}\` rung`);
  }
  assert.equal(
    (disclosure.match(/reached: true/g) ?? []).length,
    1,
    "exactly one rung is reached — creating an identity reaches the first and no other",
  );
  assert.equal(
    (disclosure.match(/reached: false/g) ?? []).length,
    4,
    "the four rungs above identity are all explicitly UNREACHED",
  );
  /*
   * THE PERSISTED-FIELD LIST IS THE WRITER'S OWN `.values({...})`. A disclosure that drifts from
   * the writer is a promise the database does not keep, in either direction.
   */
  const values = create.slice(create.indexOf(".values({"), create.indexOf("})\n      .returning"));
  /*
   * BOTH SPELLINGS. The writer uses the SHORTHAND `name,` because the validated local is already
   * called `name`; a `key:`-only regex silently dropped it and made the equivalence check compare a
   * five-column writer against a six-column disclosure. A property is a property either way.
   */
  const written = [...values.matchAll(/^\s{8}(\w+)\s*[:,]/gm)].map((m) => m[1]!);
  assert.ok(
    written.includes("name"),
    "the shorthand property `name` is counted as written — a key/value regex would drop it",
  );
  const snake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  /*
   * SCOPED TO THE PERSISTED LIST. The withheld list names columns too — that is its whole job — so a
   * module-wide match would compare the writer against both lists at once and could never pass.
   */
  const persistedBlock = disclosure.slice(
    disclosure.indexOf("PERSISTED_IDENTITY_FIELDS"),
    disclosure.indexOf("WITHHELD_IDENTITY_FIELDS"),
  );
  assert.ok(persistedBlock.length > 0, "the persisted-field disclosure block was located");
  assert.deepEqual(
    written.map(snake).sort(),
    [...persistedBlock.matchAll(/column: "([a-z_]+)", meaning/g)].map((m) => m[1]!).sort(),
    "the disclosed persisted fields are EXACTLY the columns the writer writes — no promise drifts",
  );
  /*
   * AND THE TWO LISTS MAY NOT OVERLAP. A column cannot be disclosed as both written and withheld;
   * that would let the disclosure be true whichever way the writer changed.
   */
  const withheldBlock = disclosure.slice(disclosure.indexOf("WITHHELD_IDENTITY_FIELDS"));
  const withheld = [...withheldBlock.matchAll(/column: "([a-z_ /]+)", meaning/g)].flatMap((m) =>
    m[1]!.split(" / ").map((c) => c.trim()),
  );
  assert.deepEqual(
    withheld.filter((column) => written.map(snake).includes(column)),
    [],
    "no column is disclosed as both persisted and withheld",
  );
  for (const promised of ["agent_lifecycle_status", "retired_at", "replaced_by_agent_id"]) {
    assert.ok(
      withheld.includes(promised),
      `\`${promised}\` is disclosed as deliberately empty at creation — retirement is its first writer`,
    );
  }

  /* ── 9. NO SCHEMA CHANGE, NO MIGRATION ────────────────────────────────────── */
  const sqlCount = readdirSync(path.join(ROOT, MIGRATIONS)).filter((f) => f.endsWith(".sql")).length;
  assert.equal(sqlCount, 40, "AGENT-ID-0.1 authored no migration — retirement needed none");
  const journal = JSON.parse(read(path.join(MIGRATIONS, "meta/_journal.json")));
  assert.equal(journal.entries.length, sqlCount, "and the journal agrees with the files on disk");
  assert.ok(
    !featureCode.includes("pgEnum") && !featureCode.includes("alter table"),
    "the feature declares no enum and alters no table — `retired` already existed and gains its first writer",
  );

  /* ── 10. GOVERNANCE IS NOT WIDENED ────────────────────────────────────────── */
  assert.ok(
    /GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType\[\] = \["knowledge_node"\];/.test(
      codeOf(read(GOVERNANCE_CONTRACTS)),
    ),
    'governance subject types are still exactly ["knowledge_node"] — retiring an agent is not a governance decision',
  );

  /* ── 11. THE FEATURE STILL OWNS NO LIFECYCLE BEYOND ITS TWO TRANSITIONS ───── */
  for (const verb of STILL_FORBIDDEN_VERBS) {
    assert.ok(
      !featureCode.includes(verb),
      `\`${verb}\` must not exist in ${FEATURE_DIR} — retirement is terminal and succession is unauthorized`,
    );
  }

  console.log(
    "agent-id-0-1/boundaries-and-firewall: withdrawal not deletion, genesis still spent, one durable authority",
  );
}

main();
