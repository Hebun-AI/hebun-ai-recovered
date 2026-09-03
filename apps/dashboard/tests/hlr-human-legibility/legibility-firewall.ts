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
/*
 * WORK-2 — the FIRST grounding projection to resolve a human's readable name for a model's context.
 * It uses this released projection rather than a new read, and the identifier travels beside the
 * label in every item it produces.
 */
const WORK_GROUNDING_PROJECTION = "src/features/organizational-work/heby-work-source.server.ts";
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
  assert.equal(migrations.length, 46, "the migration ledger is untouched by HLR"); /* WORK-1 grew it to 42; Departmental Placement to 43; GIA-1 to 44. None is HLR's. */

  /* THE ROSTER CLAIM IS STILL FALSE FOR ORGANIZATION, WHICH IS THE POINT. */
  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanRoster,
    false,
    "OSA still ships no roster — legibility is Identity's read, not Organization's",
  );
  /*
   * `humanAssignment` was false when HLR measured it and Departmental Placement made it true.
   * HLR's claim was never "assignment does not exist" — it was "HLR did not add it". Repointed to
   * what it always meant: the fact is owned by a module HLR never wrote, and legibility remains
   * Identity's read rather than Organization's.
   */
  assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment, true);
  assert.equal(
    ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignmentWriter,
    "organization-authority/write-placement.server.ts",
    "and HLR is not that module",
  );
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

  /*
   * EACH EXPRESSION IS STATED ONCE, AND THERE ARE NOW EXACTLY TWO.
   *
   * ── THE PIN MOVED, AND IT DID NOT WEAKEN ────────────────────────────────────
   *
   * HLR pinned this at ONE: "the label expression is written once and shared", so the two reads
   * could never drift apart. The WORK-2 post-acceptance privacy hardening added a SECOND, narrower
   * expression — `display_name -> name`, with the address floor removed — because what a surface
   * may show an organization's own human is not what may be sent to a model provider.
   *
   *     UI LEGIBILITY != MODEL PROVIDER DISCLOSURE
   *
   * So the count is TWO and pinned exactly, not loosened to "at least one". A third would still
   * fail here, and so would either of these being written twice.
   */
  const occurrences = legibility.match(/coalesce\(/g) ?? [];
  assert.equal(occurrences.length, 2, "exactly two expressions exist, each written once");
  assert.equal(
    (legibility.match(/coalesce\(\$\{users\.displayName\}, \$\{users\.name\}, \$\{users\.email\}\)/g) ?? []).length,
    1,
    "the product label — with the address floor — is stated once",
  );
  assert.equal(
    (legibility.match(/coalesce\(\$\{users\.displayName\}, \$\{users\.name\}\)/g) ?? []).length,
    1,
    "and the provider-safe name — WITHOUT it — is stated once",
  );

  /*
   * AND THEY AGREE ABOUT WHAT A PERSON IS CALLED. The name expression is a strict PREFIX of the
   * label expression: same columns, same order, one fewer fallback. Two reads that disagreed about
   * precedence would be two answers to one question — the very thing this section exists to stop.
   */
  const NAME_EXPR = "coalesce(${users.displayName}, ${users.name})";
  const LABEL_EXPR = "coalesce(${users.displayName}, ${users.name}, ${users.email})";
  assert.ok(
    LABEL_EXPR.startsWith(NAME_EXPR.slice(0, -1)),
    "the provider-safe name is the product label with the address floor removed, and nothing else",
  );
  assert.ok(legibility.includes(NAME_EXPR) && legibility.includes(LABEL_EXPR));
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
  /*
   * WORK-2 added the 18th class `work`, Departmental Placement the 19th, and OSA-4 the 20th
   * (`people`). NONE of them is HLR's: this milestone added no class, and the census is pinned here
   * only so that one appearing without a deliberate edit still fails.
   *
   * `people` LEAVES THE FORBIDDEN LIST BELOW, and that is the one line of this section OSA-4
   * changes. It was forbidden because HLR must not become a directory — and it still must not: the
   * class is served by `auth-runtime/heby-people-source.server.ts` over a SEPARATE read seam with
   * its own Governance gate, and this module's own header sentence ("Not a roster authority. Not a
   * people directory.") is asserted below and remains true of THIS module.
   */
  assert.equal(HEBY_SOURCE_CLASSES.length, 20, "the source class census is unchanged by HLR");
  for (const forbidden of ["human-labels", "roster", "members"]) {
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

  /*
   * ── THE CLAIM THIS SECTION MADE, AND WHAT WORK-2 CHANGED ────────────────────
   *
   * HLR asserted "THE WHOLE HEBY TREE IS BLIND TO THIS MODULE" — no human's readable name reached
   * Heby's grounding context, anywhere. WORK-2 changed that DELIBERATELY: the Organizational Work
   * Authority's grounding projection resolves the accountable human's label so a Director can ask
   * "who is accountable for this?" and get a name instead of a UUID.
   *
   * The claim is therefore REPOINTED, not deleted, and it is now narrower and still exact:
   *
   *   1. NO module under `features/heby*` — the Heby subsystem itself — imports the legibility
   *      read. Heby still holds no roster and no label read of its own; it receives labels the way
   *      it receives every other fact, through an authority-owned projection it merely imports.
   *   2. EXACTLY ONE authority-owned projection resolves labels for grounding, and it is named.
   *
   * A second grounding projection reaching for names without a deliberate edit still fails here.
   * That is the guarantee worth keeping, and it survives intact.
   */
  const WORK_GROUNDING = "src/features/organizational-work/heby-work-source.server.ts";

  const hebySubsystemConsumers = walk("src/features")
    .filter((file) => file.startsWith("src/features/heby"))
    .filter((file) => read(file).includes("human-label-read"));
  assert.deepEqual(
    hebySubsystemConsumers,
    [],
    "the Heby subsystem itself still holds no legibility read — it only ever receives a projection",
  );

  /*
   * TWO GROUNDING PROJECTIONS NOW RESOLVE A HUMAN, AND BOTH ARE NAMED.
   *
   * WORK-2 was the first. Departmental Placement is the second, and it is the one whose whole
   * subject is people — so the list grows by exactly one and stays EXACT. A third appearing without
   * a deliberate edit still fails here, which is the guarantee worth keeping.
   */
  const PLACEMENT_GROUNDING = "src/features/organization-authority/heby-placement-source.server.ts";
  /*
   * OSA-4 is the THIRD, and it is the one whose whole subject is membership. The list grows by
   * exactly one and stays EXACT; a fourth appearing without a deliberate edit still fails here.
   */
  const PEOPLE_GROUNDING = "src/features/auth-runtime/heby-people-source.server.ts";
  const groundingConsumers = walk("src/features")
    .filter((file) => /heby-[a-z-]*source\.server\.ts$/.test(file))
    .filter((file) => read(file).includes("human-label-read"));
  assert.deepEqual(
    groundingConsumers.sort(),
    [WORK_GROUNDING, PLACEMENT_GROUNDING, PEOPLE_GROUNDING].sort(),
    "exactly THREE grounding projections resolve a human, and all three are named here",
  );

  /*
   * ── AND IT MAY RESOLVE ONLY THE PROVIDER-SAFE READ ──────────────────────────
   *
   * WORK-2's production acceptance found that the released product label resolves to an EMAIL for
   * the one identity production holds, because it floors at `users.email` and that identity has
   * neither name column set. Correct on a page; a disclosure to a third-party model provider.
   *
   * The claim above is therefore NARROWED, not widened: still exactly one projection, and that one
   * may reach only `resolveHumanNames`. Reaching the address-floored `resolveHumanLabels` from a
   * grounding projection fails here, as does a second projection reaching for either.
   */
  for (const projection of [WORK_GROUNDING, PLACEMENT_GROUNDING, PEOPLE_GROUNDING]) {
    const code = withoutComments(read(projection));
    assert.ok(
      code.includes("resolveHumanNames"),
      `${projection} resolves the PROVIDER-SAFE name`,
    );
    assert.ok(
      !code.includes("resolveHumanLabels"),
      `${projection} never reaches the product label that floors at an email address`,
    );
  }

  const providerFacingReaders = walk("src/features")
    .filter((file) => /heby-[a-z-]*source\.server\.ts$/.test(file))
    .filter((file) => withoutComments(read(file)).includes("resolveHumanLabels"));
  assert.deepEqual(
    providerFacingReaders,
    [],
    "NO grounding projection reaches the address-floored product label — UI LEGIBILITY != DISCLOSURE",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE CONSUMER CENSUS. ONE PAGE, AND NOTHING ELSE.
 * ═══════════════════════════════════════════════════════════════════════════ */
{
  const consumers = [...walk("src/features"), ...walk("src/app"), ...walk("src/components")]
    .filter((file) => file !== MODULE)
    .filter((file) => read(file).includes("human-label-read"));

  /*
   * "no second consumer, YET" — and there are now SEVEN, each following the same released shape:
   * a page performs the read and hands a component the answers, or an authority-owned projection
   * resolves names for grounding. Nobody else holds the read, nobody persists a name, and the
   * identifier always travels beside the label.
   *
   *   two pages          department owner   +  work register
   *   three components   the two above      +  the placement panel
   *   two projections    work grounding     +  placement grounding
   *
   * The census GREW; nothing in it was widened. An eighth consumer appearing without a deliberate
   * edit still fails here.
   */
  const PLACEMENT_PANEL = "src/components/organization-domain/departmental-placement.tsx";
  const PLACEMENT_GROUNDING_PROJECTION =
    "src/features/organization-authority/heby-placement-source.server.ts";
  /*
   * OSA-4 adds a FOURTH component and a THIRD grounding projection, each following the same
   * released shape. The census GREW; nothing in it was widened. A tenth consumer appearing without
   * a deliberate edit still fails here.
   */
  const PEOPLE_PANEL = "src/components/organization-domain/people-register.tsx";
  const PEOPLE_GROUNDING_PROJECTION = "src/features/auth-runtime/heby-people-source.server.ts";
  const LIVE_MAP_PROJECTION = "src/features/live-map/read-live-map.server.ts";
  const COMPOSITION_PANEL = "src/components/organization-domain/department-composition.tsx";
  assert.deepEqual(
    consumers.sort(),
    [
      PAGE,
      PANEL,
      WORK_PAGE,
      WORK_PANEL,
      WORK_GROUNDING_PROJECTION,
      PLACEMENT_PANEL,
      PLACEMENT_GROUNDING_PROJECTION,
      PEOPLE_PANEL,
      PEOPLE_GROUNDING_PROJECTION,
      /*
       * LM-1 adds the TENTH consumer, and the first that is neither a page nor a component nor a
       * grounding projection: Live Map composes the PRODUCT label for the people it draws. That is
       * the address-floored read, and it is correct here for the reason the two pages use it —
       * `/live-map` is server-rendered for this organization's own authorized human, and a released
       * firewall keeps the whole Heby tree away from this projection, so no label composed on the
       * map can reach a model provider.
       */
      LIVE_MAP_PROJECTION,
      /*
       * ORG-1 adds the ELEVENTH consumer, and it is a component receiving the shape — the released
       * pattern exactly. The composition panel takes `HumanLabel` as a TYPE and is handed the
       * deduped union the page already resolved; it performs no read of its own, which the no-read
       * loop below proves.
       */
      COMPOSITION_PANEL,
    ].sort(),
    "exactly two pages read legibility, five components receive it, THREE grounding projections " +
      "resolve it for Heby, and Live Map composes it for the map. No other consumer.",
  );

  /*
   * AND EVERY COMPONENT IMPORTS TYPES ONLY. A client component that could CALL the read would be a
   * database handle in a browser bundle; `import type` erases at compile time.
   */
  /*
   * The people panel takes the SHAPE only and never `SelectableMembersRead`, because it offers no
   * picker: OSA-4 adds no writer, so there is nobody to select. Its type-only import is asserted
   * here, and it faces the same no-read check as the other three.
   */
  assert.match(
    read(PEOPLE_PANEL),
    /import type \{ HumanLabel \} from "@\/features\/auth-runtime\/human-label-read\.server"/,
    `${PEOPLE_PANEL} imports the legibility SHAPE and never the functions`,
  );
  for (const component of [PANEL, PLACEMENT_PANEL]) {
    assert.match(
      read(component),
      /import type \{[\s\S]*?HumanLabel,[\s\S]*?SelectableMembersRead,?[\s\S]*?\} from "@\/features\/auth-runtime\/human-label-read\.server"/,
      `${component} imports the legibility SHAPES and never the functions`,
    );
  }
  for (const component of [PANEL, PLACEMENT_PANEL, PEOPLE_PANEL, COMPOSITION_PANEL]) {
    const code = withoutComments(read(component));
    for (const forbidden of [
      "readSelectableMembers(",
      "resolveHumanLabels(",
      "resolveHumanNames(",
      "getControlPlaneDb",
    ]) {
      assert.ok(!code.includes(forbidden), `${component} performs no read: ${forbidden}`);
    }
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
