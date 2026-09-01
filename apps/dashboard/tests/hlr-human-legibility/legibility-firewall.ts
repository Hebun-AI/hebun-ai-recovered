/*
 * HUMAN LEGIBILITY REACH — THIS MILESTONE CREATED NO AUTHORITY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Human legibility is a READ over rows Identity already owns. It writes nothing, persists no
 *    label, adds no table, no column and no migration, and creates no roster authority, no people
 *    authority, no directory and no paging. Organization stays authoritative for the department and
 *    for the owner IDENTIFIER; the label is a rendering and never the key. Heby is untouched — no
 *    source class, no workspace, no member name in grounding. And the dormant agent-department
 *    assignment path in the passive persistence adapter is still unreachable."
 *
 * The pins:
 *
 *   A LABEL != AN IDENTITY KEY           READABLE != AUTHORIZED
 *   UNRESOLVED != NOBODY                 OWNERSHIP CANDIDATE != DELEGATION CANDIDATE
 *   PRODUCT LEGIBILITY != MODEL GROUNDING
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this milestone's own prose about what
 * it refuses to do can never satisfy — or trip — a check about what it does.
 * Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  MAX_RESOLVABLE_LABELS,
  MAX_SELECTABLE_MEMBERS,
} from "../../src/features/auth-runtime/human-label-read.server";
import { ORGANIZATION_STRUCTURE_AUTHORITY_MODEL } from "../../src/features/organization-authority/structure-contracts";
import { ORGANIZATION_AUTHORITY_MODEL } from "../../src/features/organization-authority/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const MODULE = "src/features/auth-runtime/human-label-read.server.ts";
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";
const PANEL = "src/components/organization-domain/department-structure.tsx";
/* WORK-1 — the second pair: the Work register page and the register component. */
const WORK_PAGE = "src/app/(dashboard)/director/work/page.tsx";
const WORK_PANEL = "src/components/organizational-work/work-register.tsx";
const OSA_CONTRACTS = "src/features/organization-authority/contracts.ts";
const OSA_READER = "src/features/organization-authority/read-structure.server.ts";
const OSA_WRITER = "src/features/organization-authority/write-structure.server.ts";
const GROUNDING = "src/features/organization-authority/heby-organization-source.server.ts";
const DELEGATION = "src/features/governance-decision/authority-delegation.server.ts";
const PASSIVE_ADAPTER = "src/features/persistence/supabase-postgres-adapter.ts";
const ELIGIBILITY = "src/features/auth-runtime/member-eligibility.ts";

/** Comment-stripped source. String literals are kept: the assertions below never ban a word. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...walk(rel));
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE READ IS A READ. PROVABLY, NOT BY PROMISE.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const code = withoutComments(read(MODULE));

  for (const forbidden of [
    /\.insert\(/,
    /\.update\(/,
    /\.delete\(/,
    /\.transaction\(/,
    /\binsert into\b/i,
    /\bupdate\s+\w+\s+set\b/i,
  ]) {
    assert.ok(!forbidden.test(code), `the legibility read performs no write: ${forbidden}`);
  }

  assert.match(code, /Human label reads are server-only/, "it refuses to run in a browser");

  /*
   * NO SECRET, NO CREDENTIAL, NO AUTH INTERNAL is projected. `auth_identities` is not joined at all
   * and `auth_id` is never selected — a label read has no business knowing how somebody signs in.
   */
  for (const forbidden of ["authId", "auth_identities", "authIdentities", "secretHash", "password"]) {
    assert.ok(!code.includes(forbidden), `the projection never reaches ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE GATE IS THE ONE THAT ALREADY EXISTED. NO NEW GOVERNANCE SEMANTICS.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const code = withoutComments(read(MODULE));
  assert.match(code, /resolveGovernanceAuthority/, "the released authority resolver is the gate");
  assert.match(
    code,
    /if \(!authority\.authorized\) return \{ ok: false, reason: "not-authorized" \}/,
    "and an unauthorized caller is refused, fail-closed",
  );

  /* No new Governance vocabulary of any kind was introduced by this milestone. */
  for (const forbidden of [
    "decisionRecords",
    "decision_records",
    "governanceSessions",
    "actionPermits",
    "governance_domain",
    "recordDecision",
  ]) {
    assert.ok(!code.includes(forbidden), `no Governance record is created or read: ${forbidden}`);
  }

  /*
   * ORDER IS THE GUARANTEE. Authorization is resolved BEFORE any subject is looked at, so a refusal
   * cannot be used as an oracle for who belongs to a tenant. Asserted against the gate's body.
   */
  const gateBody = code.slice(code.indexOf("async function gate("));
  const authorityAt = gateBody.indexOf("resolveGovernanceAuthority");
  const dbAt = gateBody.indexOf("resolveDbOrNull");
  assert.ok(authorityAt > 0 && dbAt > 0, "both steps are present");
  assert.ok(authorityAt < dbAt, "authority is resolved before the database is even reached");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. NOT A DIRECTORY. NOT A ROSTER AUTHORITY. NOT A PAGE.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const code = withoutComments(read(MODULE));

  /* BOUNDED, and the bounds are constants a reader can see rather than magic numbers. */
  assert.equal(typeof MAX_SELECTABLE_MEMBERS, "number");
  assert.equal(typeof MAX_RESOLVABLE_LABELS, "number");
  assert.match(code, /\.limit\(MAX_SELECTABLE_MEMBERS\)/, "the member read is bounded");

  /* NO PAGING ARCHITECTURE. No offset, no cursor, no page token — by construction, not by policy. */
  for (const forbidden of [/\.offset\(/, /\bcursor\b/i, /\bpageToken\b/, /\bafter\b\s*[:=]/]) {
    assert.ok(!forbidden.test(code), `this is a selection control, not a directory: ${forbidden}`);
  }

  /* NO SEARCH. Neither read accepts a term, a filter or a predicate from its caller. */
  for (const forbidden of [/\bilike\b/i, /\blike\b\s*`/, /\bsearch\b/i, /\bquery\s*:/]) {
    assert.ok(!forbidden.test(code), `no search parameter exists: ${forbidden}`);
  }

  /* NO NEW SCHEMA, NO NEW MIGRATION, NO NEW PERSISTENCE. */
  assert.ok(
    !existsSync(path.join(ROOT, "src/db/schema/human-label.ts")),
    "no table was introduced for labels",
  );
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  assert.equal(migrations.length, 42, "the migration ledger is untouched by HLR"); /* WORK-1 grew the ledger 41 -> 42: the Organizational Work Authority table. */

  /* THE ROSTER CLAIM IS STILL FALSE FOR ORGANIZATION, WHICH IS THE POINT. */
  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanRoster,
    false,
    "OSA still ships no roster — legibility is Identity's read, not Organization's",
  );
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment, false);
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.agentAssignmentWriter, false);
  assert.equal(ORGANIZATION_AUTHORITY_MODEL.writerCreated, false);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE DIFFERENCE FROM DELEGATION IS DELIBERATE, AND BOTH SIDES ARE PINNED.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const legibility = withoutComments(read(MODULE));
  const delegation = withoutComments(read(DELEGATION));

  /*
   * THE SELF-EXCLUSION. Delegation carries it because self-delegation is invalid; ownership must
   * NOT, because a Director may be accountable for their own department — which OSA-2 recorded in
   * production. Asserted on BOTH files: a change to either one has to be deliberate.
   */
  assert.match(
    delegation,
    /u\.id <> \$\{authority\.authorityActorId\}::uuid/,
    "the delegation read still excludes the caller",
  );
  assert.ok(
    !/authorityActorId/.test(legibility),
    "OWNERSHIP CANDIDATE != DELEGATION CANDIDATE — the legibility read never excludes the caller",
  );

  /*
   * THE LABEL PRECEDENCE IS THE SAME ONE, REUSED RATHER THAN RE-DECIDED. Two places rendering the
   * same human differently would be two answers to one question.
   */
  assert.match(
    delegation,
    /coalesce\(u\.display_name, u\.name, u\.email\)/,
    "delegation's released precedence",
  );
  assert.match(
    legibility,
    /coalesce\(\$\{users\.displayName\}, \$\{users\.name\}, \$\{users\.email\}\)/,
    "and legibility uses the same one",
  );

  /* Stated ONCE in the new module, so the two reads can never drift apart from each other. */
  const occurrences = legibility.match(/coalesce\(/g) ?? [];
  assert.equal(occurrences.length, 1, "the label expression is written once and shared");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. ORGANIZATION IS UNCHANGED. NO LABEL ENTERS ITS CONTRACT OR ITS READ.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const contracts = withoutComments(read(OSA_CONTRACTS));
  const reader = withoutComments(read(OSA_READER));
  const writer = withoutComments(read(OSA_WRITER));

  /* `DepartmentView.owner` gained NO label field. The record holds an identifier and a flag. */
  const ownerShape = contracts.slice(contracts.indexOf("readonly owner: {"));
  const ownerBlock = ownerShape.slice(0, ownerShape.indexOf("} | null;"));
  for (const forbidden of ["label", "displayName", "name", "email"]) {
    assert.ok(
      !ownerBlock.includes(forbidden),
      `the recorded owner carries no ${forbidden} — a label is not part of the record`,
    );
  }

  /* OSA's own read still cannot reach `users` at all — the L3 claim OSA-1 pinned, re-measured. */
  assert.ok(
    !/\busers\b/.test(reader),
    "the structure read names `users` nowhere, so no name can travel with a department",
  );

  /* Neither the reader nor the writer learned about legibility. The composition happens above them. */
  for (const [file, code] of [
    [OSA_READER, reader],
    [OSA_WRITER, writer],
  ] as const) {
    assert.ok(
      !code.includes("human-label-read"),
      `${file} does not import the legibility read — Organization did not absorb Identity`,
    );
  }

  /*
   * The writer still verifies the identifier ITSELF, not against any label.
   *
   * REPAIRED AT THE OWNER-ELIGIBILITY HARDENING. `.from(memberships)` was a literal that died when
   * the owner check began joining `users`; the claim survives and is now asserted by the shared rule
   * the writer calls, which is a stronger statement than which table it selects from.
   */
  assert.match(writer, /\.innerJoin\(memberships/, "the writer still checks membership itself");
  assert.ok(
    !/label/i.test(writer),
    "and no label reaches the writer — there is no parameter through which one could",
  );

  /*
   * PICKER AND WRITER SHARE ONE DEFINITION, so they cannot drift. Before the hardening they did:
   * the picker required an unrevoked membership and a live identity, the writer required neither,
   * and a control that offers somebody the authority refuses produces a refusal no human can
   * explain. Asserted on BOTH files by name.
   */
  const eligibility = withoutComments(read(ELIGIBILITY));
  for (const [file, code] of [
    [MODULE, withoutComments(read(MODULE))],
    [OSA_WRITER, writer],
  ] as const) {
    assert.ok(
      code.includes("member-eligibility"),
      `${file} takes its eligibility rule from the shared module rather than re-typing it`,
    );
  }
  for (const condition of [
    "eq(memberships.tenantId, tenantId)",
    "eq(memberships.status, ACTIVE_MEMBERSHIP_STATUS)",
    "eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE)",
    "isNull(memberships.revokedAt)",
    "eq(users.lifecycleStatus, ACTIVE_LIFECYCLE)",
    "isNull(users.deletedAt)",
  ]) {
    assert.ok(
      eligibility.includes(condition),
      `the shared eligibility rule carries ${condition} — each closes a different way to stop being eligible`,
    );
  }

  /*
   * THE SHARED RULE IS A PREDICATE, NOT AN AUTHORITY. No handle, no query, no writer — which is also
   * why it may be imported by a writer whose reachable server modules are pinned to a list.
   */
  for (const forbidden of [
    ".insert(",
    ".update(",
    ".delete(",
    ".transaction(",
    ".select(",
    "getControlPlaneDb",
    "ControlPlaneDatabase",
  ]) {
    assert.ok(
      !eligibility.includes(forbidden),
      `the eligibility rule holds no database access: ${forbidden}`,
    );
  }
  assert.ok(
    !/\.server\.ts$/.test(ELIGIBILITY),
    "and it is deliberately not a .server module, because it is pure",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. HEBY IS UNTOUCHED. PRODUCT LEGIBILITY != MODEL GROUNDING.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  /* No source class was added, renamed or removed. */
  assert.equal(HEBY_SOURCE_CLASSES.length, 17, "the source class census is unchanged at 17");
  for (const forbidden of ["human-labels", "people", "roster", "members"]) {
    assert.ok(
      !HEBY_SOURCE_CLASSES.includes(forbidden as never),
      `no ${forbidden} source class was added`,
    );
  }

  const grounding = withoutComments(read(GROUNDING));
  assert.ok(
    !grounding.includes("human-label-read"),
    "Heby's Organization grounding does not import the legibility read",
  );
  for (const forbidden of ["displayName", "display_name", "readSelectableMembers", "resolveHumanLabels"]) {
    assert.ok(!grounding.includes(forbidden), `no member name reaches grounding: ${forbidden}`);
  }

  /*
   * THE RELEASED SENTENCE OSA-2 PRODUCTION-ACCEPTED IS PRESERVED VERBATIM. Heby answers with an
   * identifier and says why. This milestone changed a product surface and deliberately not this.
   */
  const groundingSource = read(GROUNDING);
  assert.match(
    groundingSource,
    /The owner is an IDENTIFIER/,
    "Heby's contract still says the owner is an identifier, and this milestone did not widen it",
  );

  /* No workspace profile changed. */
  const registry = withoutComments(read("src/features/heby-integration/workspace-registry.ts"));
  assert.ok(
    !registry.includes("human-label") && !registry.includes("roster"),
    "no workspace gained a legibility capability",
  );

  /* THE WHOLE HEBY TREE IS BLIND TO THIS MODULE. Measured, not assumed. */
  const hebyConsumers = walk("src/features")
    .filter((file) => file.includes("heby"))
    .filter((file) => read(file).includes("human-label-read"));
  assert.deepEqual(hebyConsumers, [], "nothing under a Heby feature imports the legibility read");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE CONSUMER CENSUS. ONE PAGE, AND NOTHING ELSE.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const consumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((file) => file !== MODULE)
    .filter((file) => read(file).includes("human-label-read"));

  /*
   * "no second consumer, YET" — and WORK-1 is it. The Work register names an accountable human, so
   * it faces exactly the problem this projection exists to solve, and it solves it the same way:
   * the page reads the labels and the component receives them. Neither holds the read, neither
   * persists a name, and the identifier still travels beside the label.
   *
   * The census GREW; nothing in it was widened. A third pair appearing without a deliberate edit
   * still fails here.
   */
  assert.deepEqual(
    consumers.sort(),
    [PAGE, PANEL, WORK_PAGE, WORK_PANEL].sort(),
    "exactly two pages read legibility and two components receive it — the department owner and " +
      "the accountable human, and no other consumer",
  );

  /*
   * AND THE COMPONENT IMPORTS TYPES ONLY. A client component that could CALL the read would be a
   * database handle in a browser bundle; `import type` erases at compile time.
   */
  const panel = read(PANEL);
  assert.match(
    panel,
    /import type \{\s*HumanLabel,\s*SelectableMembersRead,?\s*\} from "@\/features\/auth-runtime\/human-label-read\.server"/,
    "the panel imports the legibility SHAPES and never the functions",
  );
  const panelCode = withoutComments(panel);
  for (const forbidden of ["readSelectableMembers(", "resolveHumanLabels(", "getControlPlaneDb"]) {
    assert.ok(!panelCode.includes(forbidden), `the surface performs no read: ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THE SURFACE: THE IDENTIFIER IS NEVER ERASED, AND NO NAME IS INVENTED.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const panel = read(PANEL);
  const code = withoutComments(panel);

  /* THE FREE-TEXT UUID CONTROL IS GONE. That is the defect this milestone exists to remove. */
  assert.ok(
    !code.includes("Accountable member identifier"),
    "the free-text identifier field is gone from the ownership control",
  );
  assert.ok(
    !/placeholder="member id"/.test(code),
    "and so is the prompt that asked a human to type a uuid",
  );

  /* A SELECT, WHOSE VALUES ARE IDENTIFIERS AND WHOSE TEXT IS THE LABEL. */
  assert.match(code, /<select/, "the ownership control is a selection control");
  assert.match(
    code,
    /<option key=\{member\.userId\} value=\{member\.userId\}>\s*\{member\.label\}/,
    "each option SUBMITS the identifier and DISPLAYS the label — the label is never the key",
  );
  assert.match(
    code,
    /ownerUserId: owner\.trim\(\) === "" \? null : owner\.trim\(\)/,
    "and the writer still receives an identifier, exactly as before this milestone",
  );

  /* THE IDENTIFIER STAYS ON THE SURFACE beside the label, as the thing the record holds. */
  assert.match(
    code,
    /className="font-mono text-fg-muted">\{department\.owner\.actorId\}/,
    "the recorded identifier is still rendered — a label does not replace it",
  );

  /*
   * UNRESOLVED IS SAID, NEVER GUESSED.
   *
   * REPAIRED AFTER SURVIVING ITS OWN BITE-PROOF. This first asserted only that `LABEL_UNAVAILABLE`
   * appeared somewhere in the file — which a DECLARATION satisfies. A mutation that replaced the
   * rendered constant with an invented `"Unknown"` left the declaration untouched and passed. The
   * assertion now names the rendering position, so the guard is about what a reader sees rather
   * than about which constants happen to exist.
   */
  assert.match(
    code,
    /<span className="italic">\{LABEL_UNAVAILABLE\}<\/span>/,
    "an unresolved human is RENDERED as unresolved, from the declared constant",
  );

  /*
   * And no literal may stand in that position. Scoped to the owner line so the ban cannot trip on
   * ordinary copy elsewhere in the surface — the failure INT-3 recorded, where a word-ban fired on
   * the product's own honest prose.
   */
  const ownerLine = code.slice(code.indexOf("Accountable:"), code.indexOf("No accountable human recorded."));
  assert.ok(
    !/<span className="italic">\{"[^"]*"\}<\/span>/.test(ownerLine),
    "no placeholder name is ever substituted for a missing label",
  );
  assert.ok(
    !/\.split\(""\)\[0\]|\.charAt\(0\)|\bInitials\b/.test(ownerLine),
    "and no initial is derived from an identifier to stand in for a person",
  );

  /* A RECORDED OWNER WHO IS NO LONGER SELECTABLE IS STILL SHOWN IN THE CONTROL. */
  assert.match(
    code,
    /no longer\s*\n?\s*selectable/,
    "an owner outside the offered set still appears, so a select cannot silently drop them",
  );

  /* OWNERSHIP STILL GRANTS NOTHING, AND THE SURFACE STILL SAYS SO. */
  assert.match(panel, /grants them nothing/, "the surface still states that ownership grants nothing");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. THE DORMANT ASSIGNMENT PATH IS STILL DORMANT.
 *
 * `supabase-postgres-adapter.ts` contains a real `insert into agents (… department_id …)` and an
 * `update … set department_id`, resolving a department BY NAME. Before OSA it always threw, because
 * `departments` was empty; a real department now exists, so the question "is it reachable" has a new
 * answer and had to be re-asked. It is NOT reachable, and this milestone neither activates nor
 * normalizes it — the file is left exactly as it was.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const adapter = withoutComments(read(PASSIVE_ADAPTER));
  assert.match(adapter, /set department_id/, "the dormant writer is still there, unchanged");

  /* IT IS THE PASSIVE PROVIDER. The active one is in-memory and writes no row. */
  const registry = read("src/features/persistence/provider-registry.ts");
  assert.match(registry, /key: "memory",\s*\n\s*label: "Memory",\s*\n\s*status: "active"/, "memory is the active provider");
  assert.match(registry, /Passive provider/, "and postgres is the passive one");

  /*
   * NO PRODUCT PATH REACHES THE AGENT WRITE. Agent CRUD — the only feature that mutates agent
   * definitions — reaches its in-memory adapter and never this file. Measured by import, not assumed.
   */
  const crudFiles = walk("src/features/agent-crud");
  for (const file of crudFiles) {
    assert.ok(
      !read(file).includes("supabase-postgres-adapter"),
      `${file} does not reach the passive adapter`,
    );
  }
  assert.match(
    read("src/features/agent-crud/agent-repository.ts"),
    /from "\.\/agent-adapter"/,
    "the agent repository binds to the in-memory adapter",
  );

  /*
   * AND THIS MILESTONE ADDED NO CALLER. The census is exactly what it was: a health probe, a
   * registry repository for a different collection, and a comment in the durable identity writer
   * saying it does NOT use this adapter.
   */
  const adapterConsumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((file) => file !== PASSIVE_ADAPTER)
    .filter((file) => withoutComments(read(file)).includes("supabase-postgres-adapter"));
  assert.deepEqual(
    adapterConsumers.sort(),
    [
      "src/features/persistence/provider-registry.ts",
      "src/features/tenant-registry/durable-registry-repository.server.ts",
    ].sort(),
    "the passive adapter's consumers are unchanged, and neither writes an agent",
  );

  /* Neither consumer names the agents collection for a WRITE — one probes health, one is registries. */
  assert.match(
    read("src/features/tenant-registry/durable-registry-repository.server.ts"),
    /collection: "registries"/,
    "the registry repository is bound to registries, not agents",
  );
}

console.log("HLR legibility (firewall): all assertions passed.");
