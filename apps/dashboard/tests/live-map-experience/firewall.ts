/*
 * LMX-1 — A PRODUCT MILESTONE THAT ACQUIRED NO AUTHORITY.
 *
 * This one is a UI milestone, which is exactly the kind that acquires authority by accident: a
 * panel needs a number, the number needs a read, the read needs a handle, and three edits later a
 * presentation surface owns a fact. So the boundary is asserted as a property of the code rather
 * than as an intention in a header.
 *
 *     UI STATE != ORGANIZATIONAL AUTHORITY        READ PROJECTION != WRITER
 *     LIVE MAP LIVE != A SECOND LIVE MAP          SECURITY LIVE != A SECURITY AUTHORITY
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const LIVE_MAP_AWARENESS = "src/features/live-map/awareness.ts";
const SECURITY_AWARENESS = "src/features/security-center/awareness.ts";
const BAND = "src/components/awareness/global-awareness.tsx";
const CANVAS = "src/components/live-map/live-map-canvas.tsx";
const COMMAND_PAGE = "src/app/(dashboard)/command/page.tsx";
const LIVE_MAP_PAGE = "src/app/(dashboard)/live-map/page.tsx";
const SECURITY_PAGE = "src/app/(dashboard)/director/governance/security/page.tsx";
const JOURNAL = "src/db/migrations/meta/_journal.json";

const OWNED = [LIVE_MAP_AWARENESS, SECURITY_AWARENESS, BAND, CANVAS] as const;

/**
 * Comments removed, STRING LITERALS KEPT.
 *
 * `codeOf` below blanks string literals, which is right for a token ban and wrong for asserting
 * that a JSX attribute is present: `name="live-map-agent"` would become `name=""` and the check
 * would pass on any file. This strips only the commentary — which is the half that made an earlier
 * version of the exclusive-selection assertion pass on the component's own header after the
 * attribute had been deleted from the markup. A bite-proof found it; the guard was measuring prose.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

function valueEdges(file: string): string[] {
  const source = read(file);
  const specifiers: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
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
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(path.join(ROOT, candidate)) && !candidate.endsWith("/")) {
      const stat = readdirSync(path.join(ROOT, path.dirname(candidate)), { withFileTypes: true }).find(
        (e) => e.name === path.basename(candidate) && e.isFile(),
      );
      if (stat) return candidate;
    }
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
    for (const specifier of valueEdges(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/* ── 1 · THE MILESTONE'S OWN FILES HOLD NOTHING THAT COULD ACT ────────────── */
function theNewCodeHoldsNoAuthority(): void {
  for (const file of OWNED) {
    const source = read(file);
    assert.ok(!performsDurableWrite(source), `${file}: performs no durable write`);
    const code = codeOf(source);
    for (const banned of [
      "getControlPlaneDb",
      "createControlPlaneDb",
      "db/schema",
      "db/client",
      "drizzle-orm",
      "transaction(",
      "pgTable",
      "fetch(",
      "child_process",
      "node:fs",
      "localStorage",
    ]) {
      assert.ok(!code.includes(banned), `${file}: must not contain ${banned}`);
    }
    assert.ok(!/"use server"/.test(source), `${file}: declares no server action`);
  }
}

/* ── 2 · THE TWO SUMMARIES ARE PURE, AND THAT IS WHY THEY CANNOT DIVERGE ──── */
function theSummariesPerformNoRead(): void {
  for (const file of [LIVE_MAP_AWARENESS, SECURITY_AWARENESS]) {
    const source = read(file);
    assert.ok(
      !/from\s+["'][^"']*\.server["']/.test(source),
      `${file}: a summary that imports a reader is a second read waiting to disagree`,
    );
    assert.ok(!/await\s/.test(codeOf(source)), `${file}: it awaits nothing — it is a pure function`);
    assert.ok(
      !/resolveTenantContext|TenantContext/.test(source),
      `${file}: it never sees a tenant; it summarises an answer somebody else resolved`,
    );
    assert.ok(!/Date\.now|new Date/.test(codeOf(source)), `${file}: no clock`);
  }

  /* Neither summary is reachable from a writer, and neither reaches one. */
  const graph = transitiveGraph([LIVE_MAP_AWARENESS, SECURITY_AWARENESS, BAND]);
  const writers = [...graph].filter((f) => !f.startsWith("src/db/schema/") && performsDurableWrite(read(f)));
  assert.deepEqual(writers, [], "nothing reachable from the awareness band performs a durable write");
}

/* ── 3 · THE BAND NAVIGATES TO ROUTES THAT EXIST ──────────────────────────── */
function theDoorwaysAreReal(): void {
  const band = read(BAND);
  assert.match(band, /href="\/live-map"/, "Live Map Live opens the released map route");
  assert.match(
    band,
    /href="\/director\/governance\/security"/,
    "Security Live opens the RELEASED Security Center route — no route was invented for prettier IA",
  );
  assert.ok(existsSync(path.join(ROOT, LIVE_MAP_PAGE)), "and /live-map is a real page");
  assert.ok(existsSync(path.join(ROOT, SECURITY_PAGE)), "and so is the Security Center");
  assert.ok(
    !/href="\/security"/.test(band),
    "no invented `/security` route: information architecture is a separate decision",
  );
}

/* ── 4 · ONE TENANT RESOLUTION FEEDS ALL THREE READS ──────────────────────── */
function theCommandRouteResolvesOnce(): void {
  const page = read(COMMAND_PAGE);
  assert.equal(
    (page.match(/resolveTenantContext\(/g) ?? []).length,
    1,
    "the landing route resolves the tenant exactly once — N resolutions could describe N instants",
  );
  assert.match(page, /readLiveMapProjection\(tenant\)/, "and hands that tenant to the map projection");
  assert.match(
    page,
    /readSecurityRecordedActObservation\(tenant\)/,
    "and to the released recorded-act seam",
  );
  /* No caller-supplied scope reaches either read. */
  const code = codeOf(page);
  for (const banned of ["searchParams", "tenantId", "organizationId", "slug"]) {
    assert.ok(!code.includes(banned), `the landing route accepts no ${banned}`);
  }
}

/* ── 5 · THE MAP STILL OFFERS NAVIGATION AND NOTHING ELSE ─────────────────── */
function theMapCannotAct(): void {
  const code = codeOf(read(CANVAS));
  for (const banned of ["onClick", "onSubmit", "onChange", "<form", "<button", "useState", "action=", "useEffect"]) {
    assert.ok(!code.includes(banned), `the map discloses, it does not act — "${banned}"`);
  }
  /* Selection is the platform's, not this surface's: one exclusive `<details>` group. */
  assert.match(
    withoutComments(read(CANVAS)),
    /<details className="lm-agent" name="live-map-agent">/,
    "agents share one exclusive disclosure group, so exactly one is ever selected",
  );
  assert.ok(!/"use client"/.test(read(CANVAS)), "the map is a server component");
}

/* ── 6 · NO MOCK, NO SEED, NO INFERRED STRUCTURE ──────────────────────────── */
function noFictionEnters(): void {
  const graph = transitiveGraph([BAND, CANVAS, COMMAND_PAGE, LIVE_MAP_PAGE]);
  const mocks = [...graph].filter((f) => /\/mock(\.|\/)|\/mock$|fixtures?\//.test(f));
  assert.deepEqual(mocks, [], "no compiled-in fixture is reachable from the new surfaces");

  for (const file of OWNED) {
    const code = codeOf(read(file));
    for (const banned of ["mockOrganization", "seedDepartments", "inferDepartment", "agents/mock"]) {
      assert.ok(!code.includes(banned), `${file}: no seeded organizational fiction (${banned})`);
    }
  }

  /* No new entity vocabulary entered the map's own component. */
  const canvas = codeOf(read(CANVAS));
  for (const banned of ["department", "team", "reportingLine", "roster", "headcount"]) {
    assert.ok(!canvas.includes(banned), `the map invents no ${banned} entity`);
  }
}

/* ── 7 · NO SCHEMA, NO MIGRATION, NO PERSISTENCE ──────────────────────────── */
function nothingWasPersisted(): void {
  const journal = JSON.parse(read(JOURNAL)) as { entries: readonly unknown[] };
  assert.equal(journal.entries.length, 39, "the migration ledger is unchanged at 39");
  const sqlFiles = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  assert.equal(sqlFiles.length, 39, "and no migration file was added");
}

/* ── 8 · THE GLOBAL SEARCH WAS REDUCED, NOT SILENTLY DELETED ──────────────── */
function searchWasReducedNotRemoved(): void {
  const topbar = read("src/components/layout/topbar.tsx");
  assert.match(topbar, /aria-label="Global search/, "the affordance is still announced by name");
  assert.match(topbar, /disabled/, "and still honestly disabled — it indexes nothing");
  /*
   * SCANNED AGAINST CODE, NOT PROSE. The header that explains the reduction NAMES the class it
   * removed, so a raw scan fails on the explanation of the very change it is checking — the same
   * trap this milestone hit twice already. Comments and string literals are stripped first.
   */
  assert.ok(
    !/max-w-sm/.test(codeOf(topbar)),
    "and no longer spends the widest slot in the global chrome on a control nobody can use",
  );
  /* It never did anything, which is why reducing it broke nothing. */
  const repo = transitiveGraph(["src/components/layout/topbar.tsx"]);
  assert.ok(repo.size > 1, "the topbar graph resolved");
}

function main(): void {
  theNewCodeHoldsNoAuthority();
  theSummariesPerformNoRead();
  theDoorwaysAreReal();
  theCommandRouteResolvesOnce();
  theMapCannotAct();
  noFictionEnters();
  nothingWasPersisted();
  searchWasReducedNotRemoved();
  console.log("live-map-experience — firewall checks passed");
}

main();
