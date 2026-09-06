/*
 * L3 — ORGANIZATION AUTHORITY. THE ARCHITECTURE, NOT THE HAPPY PATH.
 *
 * These assertions are the milestone. The read seam could be rewritten tomorrow and still be
 * correct; what must not change is that exactly one subsystem answers "what organization exists?",
 * that it cannot write, that it cannot authorize, and that nothing else quietly becomes a second
 * answer.
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const AUTHORITY_DIR = "src/features/organization-authority";
const READER = `${AUTHORITY_DIR}/read-organization.server.ts`;
const CONTRACTS = `${AUTHORITY_DIR}/contracts.ts`;
/* E2-1. The authority's own Heby-facing projection — inside the authority, per G6C/INT-5A. */
const HEBY_SOURCE = `${AUTHORITY_DIR}/heby-organization-source.server.ts`;
const HEBY_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const PAGE = "src/app/(dashboard)/director/organization/page.tsx";
const PANEL = "src/components/organization-domain/authoritative-organization.tsx";
const LIVE_MAP_PROJECTION = "src/features/live-map/read-live-map.server.ts";
/* WORK-1 — the Work register page, the third consumer of this one seam. */
const RECORD_WORK_INLET = "src/features/heby-action-inlet/record-work-proposal.server.ts";
const WORK_PAGE = "src/app/(dashboard)/director/work/page.tsx";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/** Source with comments and string literals removed — a comment must never satisfy or trip a ban. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/* ── 1 · THE ORGANIZATION READ HOLDS NO WRITER, AND EXACTLY ONE FILE WRITES ── */
/*
 * ── WHAT OSA-1 CHANGED HERE, AND WHAT IT DID NOT ─────────────────────────────
 *
 * L3's claim was "no file in this directory performs a durable write", and OSA-1 makes that
 * sentence FALSE: the Organization Structure Authority lives here, and it writes `departments`.
 *
 * The claim is REPAIRED, not weakened, and the repaired form is STRICTER than a directory sweep:
 * the writer is pinned BY NAME, so a second one appearing anywhere in this directory fails this
 * test rather than silently joining an allowed class. L3's own read seam, its contracts and its
 * grounding source are all still held to the original bar, unchanged.
 *
 *   ORGANIZATION IDENTITY (read-only)  !=  ORGANIZATION STRUCTURE (one writer, pinned by name)
 */
const STRUCTURE_WRITER = `${AUTHORITY_DIR}/write-structure.server.ts`;
/*
 * THE SECOND WRITER, ADDED BY DEPARTMENTAL PLACEMENT AND PINNED BY NAME LIKE THE FIRST.
 *
 * It writes `department_placements` and nothing else — in particular NOT `departments`, which is
 * why the structural writer above is untouched by it, and NOT `memberships`, which is the boundary
 * that made placement a table rather than a column on the session's own row.
 *
 * The census grew by exactly one, by name. A THIRD writer appearing in this directory still fails
 * here rather than joining an allowed class, which is the whole point of pinning names over
 * counting files.
 */
const PLACEMENT_WRITER = `${AUTHORITY_DIR}/write-placement.server.ts`;

function theAuthorityCannotWrite(): void {
  const writers = walk(AUTHORITY_DIR).filter((file) => performsDurableWrite(read(file)));
  assert.deepEqual(
    writers.sort(),
    [STRUCTURE_WRITER, PLACEMENT_WRITER].sort(),
    "exactly TWO files in this directory may perform a durable write — the structure authority " +
      "and the placement authority, both by name. A third is a new authority and must be a " +
      "deliberate edit here.",
  );

  for (const file of walk(AUTHORITY_DIR)) {
    if (file === STRUCTURE_WRITER || file === PLACEMENT_WRITER) continue;
    const code = codeOf(read(file));
    for (const banned of ["transaction(", "delete(", "insert(", "update("]) {
      assert.ok(!code.includes(banned), `${file}: must not contain ${banned}`);
    }
  }

  /* And NEITHER writer deletes anything, anywhere: both retire in place. */
  for (const writer of [STRUCTURE_WRITER, PLACEMENT_WRITER]) {
    assert.ok(
      !codeOf(read(writer)).includes("delete("),
      `${writer} retires in place and deletes nothing`,
    );
  }

  /*
   * AND THE SECOND WRITER'S REACH IS PINNED BY TABLE, NOT ONLY BY FILENAME. Being allowed to write
   * is not being allowed to write ANYTHING — the boundary that made placement its own table is that
   * this directory must never hold a handle on the session's own row.
   */
  const placementCode = codeOf(read(PLACEMENT_WRITER));
  for (const forbidden of [".update(memberships", ".insert(memberships", ".update(departments", ".insert(departments"]) {
    assert.ok(
      !placementCode.includes(forbidden),
      `the placement authority must never write that table: ${forbidden}`,
    );
  }
}

/* ── 2 · IT CANNOT AUTHORIZE, AND CANNOT REACH SOMETHING THAT DOES ─────────── */
function theAuthorityGrantsNothing(): void {
  const code = codeOf(read(READER)) + codeOf(read(CONTRACTS));

  /*
   * Import-level, not word-level: the contracts file DISCUSSES governance and permissions at length
   * and must be free to, because the SEC-2 gate answer belongs beside the code it constrains. What
   * is forbidden is reaching them.
   */
  const forbiddenImports = [
    "governance-decision",
    "action-authorization",
    "agent-origination",
    "membership-authority",
    "knowledge-write-authority",
    "tenant-role-baseline",
    "identity-enrollment",
    "schema/permission",
    "schema/role-permission",
    "schema/role",
    "schema/organization",
    "schema/department",
  ];
  for (const specifier of forbiddenImports) {
    assert.ok(
      !new RegExp(`from\\s+["'][^"']*${specifier}`).test(read(READER)),
      `the Organization Authority must not import ${specifier}`,
    );
  }

  /*
   * E2-1 — THE HEBY PROJECTION INHERITS EVERY ONE OF THOSE BANS, AND ADDS THREE.
   *
   * It lives inside the authority, so sections 1 and 4 already cover it; this makes the reach bans
   * cover it too, and names the three that are specific to being Heby's supplier: it must not go
   * through Live Map (a presentation projection is not a domain seam), must not admit agent
   * identity (a different product line, needing its own class), and must not touch a mock.
   */
  const projectionForbidden = [
    ...forbiddenImports,
    "live-map",
    "agent-identity",
    "director-dashboard",
    "runtime-projection",
    "/mock",
  ];
  for (const specifier of projectionForbidden) {
    assert.ok(
      !new RegExp(`from\\s+["'][^"']*${specifier}`).test(read(HEBY_SOURCE)),
      `the Heby organization projection must not import ${specifier}`,
    );
  }

  /* And it holds no handle of its own: the authority it consumes holds one, which is the point. */
  for (const name of ["getControlPlaneDb", "db/schema", "db/client"]) {
    assert.ok(
      !codeOf(read(HEBY_SOURCE)).includes(name),
      `the Heby organization projection must not contain ${name}`,
    );
  }

  /*
   * The permission tables — and the SECOND ORGANIZATION HIERARCHY — stay exactly as unactivated as
   * L3 found them. `organizations` is still dead, and OSA-1 made it unrepresentable rather than
   * merely unused: `departments_no_second_parent_chk` fails any row that populates it.
   */
  for (const symbol of ["rolePermissions", "permissions", "organizations"]) {
    assert.ok(!code.includes(symbol), `the Organization Authority must not reference ${symbol}`);
  }

  /*
   * `departments` WAS on that list, and OSA-1 makes its absence FALSE — that is the whole
   * milestone. The pin is repaired to the stricter thing it was really protecting: L3's own read
   * still holds NO department query. It delegates to the structure authority through one call, so
   * there is still exactly ONE Organization read system and this seam did not become a second one.
   */
  const readerCode = codeOf(read(READER));
  assert.ok(
    !/from\s+["'][^"']*db\/schema\/department/.test(read(READER)),
    "the L3 read must hold no department table import — it delegates, it does not query",
  );
  assert.ok(
    readerCode.includes("readOrganizationStructure"),
    "and it does delegate to the structure authority",
  );
}

/* ── 3 · THE TENANT IS UNREPRESENTABLE AS AN ARGUMENT ──────────────────────── */
function noCallerCanNameAnotherOrganization(): void {
  const source = read(READER);
  const start = source.indexOf("export async function readOrganizationAuthority");
  assert.ok(start > 0, "the read seam is exported");
  const signature = source.slice(start, source.indexOf("{", source.indexOf(")", start)));

  /* Exactly two parameters: the trusted context and injectable deps. Nothing else. */
  assert.match(signature, /tenant:\s*TenantContext\s*\|\s*null/, "the tenant is the trusted context");
  assert.match(signature, /deps:\s*OrganizationAuthorityDeps/, "the only other parameter is deps");
  for (const name of ["organizationId", "slug", "companyId", "where", "filter"]) {
    assert.ok(
      !new RegExp(`${name}\\s*[?:]`).test(signature),
      `the read seam must take no ${name} parameter`,
    );
  }

  /* Both reads are predicated on the tenant id, and it comes from the context alone. */
  const body = codeOf(source.slice(start));
  assert.equal(
    (body.match(/eq\(companies\.id,\s*tenantId\)/g) ?? []).length,
    1,
    "the company read is predicated on the session's tenant",
  );
  assert.equal(
    (body.match(/eq\(memberships\.tenantId,\s*tenantId\)/g) ?? []).length,
    1,
    "the member count is predicated on the same tenant",
  );
  assert.match(body, /tenant\?\.tenantId\?\.trim\(\)/, "the tenant id has exactly one source");
}

/* ── 4 · EXACTLY ONE SUBSYSTEM ANSWERS THE QUESTION ────────────────────────── */
function thereIsOnlyOneAnswer(): void {
  /*
   * L4 ADDED THE SECOND CONSUMER, AND THE LIST IS WHY THAT IS SAFE. An enumeration names every
   * caller, so a third one fails here and has to argue for itself — which is the point. Live Map
   * consumes the authority; it does not reach past it.
   */
  const callers = walk("src").filter(
    (file) => !file.startsWith(AUTHORITY_DIR) && read(file).includes("readOrganizationAuthority"),
  );
  /*
   * WORK-1 added the third: `/director/work` reads structure through THIS seam rather than through
   * `readOrganizationStructure` directly, which is the behaviour the L3 boundary was built to
   * produce — a new consumer learns no second way to ask. The census GREW; nothing in it widened.
   */
  /*
   * GIA-1 added the fourth, and for the same reason WORK-1 added the third: the `record-work`
   * proposal inlet resolves the department it is about through THIS seam rather than reaching
   * `readOrganizationStructure` directly. The census GREW; nothing in it widened, and a fifth
   * consumer still fails here and has to argue for itself.
   */
  assert.deepEqual(
    callers.sort(),
    [PAGE, LIVE_MAP_PROJECTION, WORK_PAGE, RECORD_WORK_INLET].sort(),
    "the Organization Authority's consumers are exactly the Organization page, the Live Map " +
      "projection, the Work register page, and the record-work proposal inlet",
  );

  /*
   * E2-1 — AND HEBY IS NOT A THIRD ONE, WHICH IS A CLAIM AND NOT AN OMISSION.
   *
   * The enumeration above did not grow when Heby gained organizational evidence, and a reader is
   * entitled to ask whether that is truth or blindness. It is truth, and the three assertions below
   * are what make it checkable rather than assumed:
   *
   *   Heby imports the authority's own PROJECTION, which lives inside the authority (G6C/INT-5A:
   *   a projection belongs to the authority that owns the facts, and the consumer imports it). So
   *   the seam's caller set genuinely did not change — the answer to "who reads the authority?" is
   *   still the page and the map, and Heby reads what the authority hands out.
   *
   *   The projection is the ONLY module Heby imports from this directory. Without this, Heby could
   *   later import the reader directly and the census would catch it — but a reviewer reading this
   *   file would not know the boundary had ever been stated.
   *
   *   And the directory is enumerated, so a fourth file cannot appear inside the authority — where
   *   sections 1 and 4 exclude it from the caller census — without somebody stating it here.
   */
  /*
   * OSA-1 adds THREE files and the census is extended by exactly three, deliberately: the
   * structural contracts, the structural read, and the ONE structural writer.
   *
   * DEPARTMENTAL PLACEMENT ADDS FOUR MORE, and the same rule applies to them: contracts, a read
   * seam, a writer and a Heby projection — the identical four-part shape, for a different fact. The
   * enumeration is the point. An eleventh file cannot appear in this directory without somebody
   * stating it here, and each of these four is separately constrained above: only the writer may
   * write, it may write only its own table, and the projection may resolve only provider-safe names.
   */
  assert.deepEqual(
    walk(AUTHORITY_DIR).sort(),
    [
      CONTRACTS,
      HEBY_SOURCE,
      READER,
      `${AUTHORITY_DIR}/structure-contracts.ts`,
      `${AUTHORITY_DIR}/read-structure.server.ts`,
      STRUCTURE_WRITER,
      `${AUTHORITY_DIR}/placement-contracts.ts`,
      `${AUTHORITY_DIR}/read-placement.server.ts`,
      `${AUTHORITY_DIR}/heby-placement-source.server.ts`,
      PLACEMENT_WRITER,
      /*
       * GIA-1 adds an ELEVENTH, and it is the smallest kind of addition this enumeration exists to
       * make somebody state: a PURE reference formatter/parser, `department/<uuid>`, with no I/O,
       * no table, no clock and no authority. It exists because a governed proposal must freeze a
       * department by reference and the executor must parse that reference back — a bare uuid names
       * nothing a reader can resolve. It is separately constrained below like every other file
       * here: it is not a writer, and it reaches no database.
       */
      `${AUTHORITY_DIR}/department-ref.ts`,
      /*
       * TRH-16 adds a TWELFTH, of exactly the same kind as the eleventh and for exactly the same
       * reason one level up: a PURE reference formatter/parser, `organization/<uuid>`, with no I/O,
       * no table, no clock and no authority.
       *
       * It exists because governed `record-work` gained an organization-level branch — work an
       * organization holds itself, naming no department — and `requiredEvidenceCount` for a
       * CONSEQUENTIAL_MUTATION is 1. That rule asks "does this action refer to anything real?", and
       * the honest answer for organization-level work is the organization. THE EVIDENCE RULE WAS
       * NOT LOWERED; IT WAS ANSWERED, and answering it needed a way to name the organization.
       *
       * NAMED RATHER THAN COUNTED. This enumeration exists so an addition to the Organization
       * Authority has to be stated and justified, not absorbed by incrementing a number. It is
       * separately constrained below like every other file here: it is not a writer, and it reaches
       * no database.
       */
      `${AUTHORITY_DIR}/organization-ref.ts`,
    ].sort(),
    "the Organization Authority is exactly its contracts, its read seam, its Heby projection, " +
      "OSA-1's structural trio, Departmental Placement's four, and the two pure reference modules — and nothing else. Formerly: " +
      "OSA-1's structural contracts, structural read and single structural writer",
  );

  const hebyImportsFromAuthority = [
    ...read(HEBY_ANSWER).matchAll(/from\s+["']@\/features\/organization-authority\/([^"']+)["']/g),
  ].map((match) => match[1]);
  /*
   * TWO PROJECTIONS, AND STILL NOTHING ELSE. The guarantee was never "exactly one import" — it is
   * that Heby reaches the authority's PROJECTIONS and never its writers, its read seams or its
   * tables. Departmental Placement adds a second projection, so the list grows by exactly one and
   * stays exact: a writer or a read seam appearing here still fails.
   */
  assert.deepEqual(
    hebyImportsFromAuthority.sort(),
    ["heby-organization-source.server", "heby-placement-source.server"].sort(),
    "Heby imports the authority's PROJECTIONS and nothing else from the authority",
  );
  for (const forbidden of ["write-structure", "write-placement", "read-structure", "read-placement"]) {
    assert.ok(
      !hebyImportsFromAuthority.some((imported) => imported.includes(forbidden)),
      `and never its ${forbidden} seam`,
    );
  }

  /*
   * THE PROJECTION DOES CONSUME THE SEAM — otherwise the sentence above would be satisfied by a
   * projection that read `companies` itself, which is the failure the whole census exists to catch.
   */
  assert.ok(
    read(HEBY_SOURCE).includes("readOrganizationAuthority"),
    "the Heby projection consumes the Organization Authority rather than re-reading companies",
  );

  /*
   * NOBODY ELSE MAY BECOME THE ANSWER. Heby, Live Map and the provider adapters are named because
   * they are the three the pins forbid; the assertion is that none of them writes the tables L3
   * refuses to write either.
   */
  const forbiddenWriterRoots = [
    "src/features/heby-answer",
    "src/features/heby-runtime",
    "src/features/heby-commands",
    "src/features/provider-github",
    "src/features/provider-google",
  ];
  for (const root of forbiddenWriterRoots) {
    for (const file of walk(root)) {
      const code = codeOf(read(file));
      for (const table of ["companies", "organizations", "departments"]) {
        assert.ok(
          !new RegExp(`(insert|update|delete)\\(${table}\\)`).test(code),
          `${file}: must never write ${table}`,
        );
      }
    }
  }

  /*
   * LIVE MAP EXISTS NOW, SO THE CLAIM BECOMES A REAL ONE.
   *
   * This assertion used to be `Live Map has no module in src`. Absence is the weakest possible form
   * of this guarantee and it expires the moment somebody builds the thing — so it is replaced by
   * what actually matters: Live Map reaches organization truth ONLY through the L3 seam, and never
   * through the tables beneath it.
   */
  const liveMapFiles = walk("src").filter((f) => /live-?map/i.test(f));
  assert.ok(liveMapFiles.length > 0, "Live Map exists, so this claim is about a real subsystem");
  for (const file of liveMapFiles) {
    const source = read(file);
    assert.ok(
      !/from\s+["'][^"']*db\/schema/.test(source),
      `${file}: Live Map must not reach a schema module — organization truth comes through L3`,
    );
    assert.ok(
      !/from\s+["'][^"']*db\/client/.test(source),
      `${file}: Live Map must hold no database handle`,
    );
    assert.ok(
      !performsDurableWrite(source),
      `${file}: Live Map is a projection and must perform no durable write`,
    );
  }
  assert.ok(
    read(LIVE_MAP_PROJECTION).includes("readOrganizationAuthority"),
    "the Live Map projection consumes the Organization Authority rather than re-reading companies",
  );
}

/* ── 5 · THE UI RENDERS AND CANNOT MUTATE ──────────────────────────────────── */
function theSurfaceIsNotTheAuthority(): void {
  for (const file of [PAGE, PANEL]) {
    const source = read(file);
    assert.ok(!performsDurableWrite(source), `${file}: a surface may not write organizational state`);
    const code = codeOf(source);
    for (const name of ["use server", "getControlPlaneDb", "db/schema"]) {
      assert.ok(!code.includes(name), `${file}: must not contain ${name}`);
    }
  }

  /*
   * The page resolves its own tenant server-side and passes no identifier to any seam.
   *
   * ── REPAIRED AT HUMAN LEGIBILITY REACH, AND STRICTER THAN WHAT IT REPLACES ──
   *
   * This was `readOrganizationAuthority(await resolveTenantContext())` — one literal call shape.
   * That milestone gave the page two more server reads and had to bind the resolved tenant to a
   * name to share it, which the literal could not survive. The claim it was making, though, was
   * never about the syntax: it was "the tenant comes from the session and from nothing else".
   *
   * So the pin now asserts that claim about EVERY read on this page rather than about one of them.
   * A page that resolved its tenant correctly for the authority read and then handed a different
   * value to a legibility read would have satisfied the old assertion and does not satisfy this one.
   */
  const page = read(PAGE);
  assert.match(
    page,
    /const tenant = await resolveTenantContext\(\);/,
    "the tenant is resolved once, server-side, from the session",
  );
  assert.ok(
    !/resolveTenantContext\(\s*[^)\s]/.test(page),
    "and resolveTenantContext is never handed an argument — a browser cannot name an organization",
  );

  /*
   * EVERY server read on this page takes the resolved tenant and nothing else. Listed by name so a
   * NEW read added later without the same discipline fails this assertion instead of slipping past
   * a pattern that only knew about the reads that existed when it was written.
   */
  for (const seam of ["readOrganizationAuthority", "readSelectableMembers", "resolveHumanLabels"]) {
    assert.ok(page.includes(`${seam}(`), `${seam} is called on this page`);
    assert.ok(
      new RegExp(`${seam}\\(tenant[,)]`).test(page),
      `${seam} receives the session-resolved tenant, never a value from anywhere else`,
    );
  }

  /* L1's disclosure is untouched, and the authoritative panel is separated from the mock. */
  assert.ok(page.includes("Mock projection"), "L1's disclosure badge is preserved");
  /*
   * SCOPED TO THE RENDERED BODY, NOT THE MODULE. Measuring ordering with a module-wide `indexOf`
   * matches the import block first, which makes the claim about the import order rather than about
   * what a reader sees. This repository has been bitten by that exact substitution before.
   */
  const body = page.slice(page.indexOf("return ("));
  assert.ok(body.length > 0, "the page has a render body");

  /*
   * PRESENCE BEFORE ORDER. `indexOf` returns -1 for something that is not there, and -1 is less
   * than every real position — so an ordering check alone is SATISFIED by deleting the element it
   * is supposed to protect. The bite-proof found this by removing the panel and watching the
   * firewall stay green.
   */
  const authoritativeAt = body.indexOf("<AuthoritativeOrganizationPanel");
  const mockAt = body.indexOf("<OrganizationOverview");
  assert.ok(authoritativeAt >= 0, "the authoritative section is rendered at all");
  assert.ok(mockAt >= 0, "the mock projection is still rendered, disclosed, exactly as L1 left it");
  assert.ok(
    authoritativeAt < mockAt,
    "the authoritative section is rendered before the mock projection",
  );
}

/* ── 6 · UNAVAILABLE IS RENDERED AS A SENTENCE, NEVER AS AN EMPTY ORG ─────── */
function unavailableIsNeverAnEmptyOrganization(): void {
  const panel = read(PANEL);
  for (const reason of [
    "no-tenant",
    "persistence-not-configured",
    "organization-not-found",
    "read-failed",
  ]) {
    assert.ok(panel.includes(`"${reason}"`), `the panel states the ${reason} case`);
  }
  /* The unavailable branch renders no field grid — a zero count would read as an empty company. */
  const unavailableBranch = panel.slice(
    panel.indexOf('read.status === "unavailable"'),
    panel.indexOf(") : ("),
  );
  assert.ok(
    !unavailableBranch.includes("humanMemberCount") && !unavailableBranch.includes("<Field"),
    "an unavailable read renders no organization fields",
  );
}

function main(): void {
  theAuthorityCannotWrite();
  theAuthorityGrantsNothing();
  noCallerCanNameAnotherOrganization();
  thereIsOnlyOneAnswer();
  theSurfaceIsNotTheAuthority();
  unavailableIsNeverAnEmptyOrganization();
  console.log("l3 organization authority — firewall checks passed");
}

main();
