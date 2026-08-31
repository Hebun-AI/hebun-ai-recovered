/*
 * L4 — THE OBSERVATION-SURFACE NON-AUTHORITY GATE.
 *
 * SEC-2 attaches one closure gate to L4: "Can Live Map or the Security Center acquire write,
 * authorization or execution authority through a TRANSITIVE dependency?" That word is the whole
 * difficulty. A file-level token scan cannot answer it — a module that imports one innocent helper
 * from a writer's barrel has the writer in its graph, and the released Security Center gate says so
 * itself: it scans files and explicitly does NOT walk the import graph.
 *
 * So this walks the real graph from Live Map's entry points and asserts on what is actually
 * reachable. Two prior phases were caught by exactly this: G2 found a Heby -> Governance edge taken
 * "just for the DB handle", and R5.1 found a tenant-scoped role gating an unconfined write. Neither
 * was visible in the importing file.
 *
 * No database, no network.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const FEATURE_DIR = "src/features/live-map";
const COMPONENT_DIR = "src/components/live-map";
const PROJECTION = `${FEATURE_DIR}/read-live-map.server.ts`;
const PAGE = "src/app/(dashboard)/live-map/page.tsx";
const NAV = "src/config/workspace-nav.ts";

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/** Source with comments and string literals removed — prose must neither satisfy nor trip a ban. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/**
 * VALUE edges only, and RE-EXPORTS COUNT.
 *
 * Two traps, both previously paid for in this repository:
 *
 *   `import type` / `{ type X }` are erased at compile time and reach nothing at runtime. L1
 *   measured that a naive graph reported 52 mock-reaching routes where only 25 were real, so a
 *   census that cannot tell an erased edge from a value edge is not a census.
 *
 *   `export … from` is an edge too, and the first version of this walker missed it — which made the
 *   transitive gate silently blind to exactly the barrel problem it exists to catch. Importing one
 *   read from `@/features/agent-identity` pulls in an index that re-exports two lifecycle writers,
 *   and a walker following only `import` statements reports a clean graph.
 */
function valueEdges(file: string): string[] {
  const source = read(file);
  const specifiers: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue; // `import type … from` / `export type … from` — erased
    const clause = m[3] ?? "";
    /* A clause whose every named binding is `type X` is erased too. */
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}

/** Resolve a `@/`-aliased specifier to a repository file, or null for a package. */
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

/** Every repository file Live Map can actually reach at runtime. */
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

/* ── 1 · LIVE MAP WRITES NOTHING, AND HOLDS NO HANDLE ─────────────────────── */
function liveMapCannotWrite(): void {
  for (const file of [...walk(FEATURE_DIR), ...walk(COMPONENT_DIR), PAGE]) {
    const source = read(file);
    assert.ok(!performsDurableWrite(source), `${file}: Live Map performs no durable write`);
    const code = codeOf(source);
    for (const banned of ["getControlPlaneDb", "createControlPlaneDb", "db/schema", "db/client", "transaction("]) {
      assert.ok(!code.includes(banned), `${file}: must not contain ${banned}`);
    }
    assert.ok(!/"use server"/.test(source), `${file}: Live Map declares no server action`);
  }
}

/* ── 2 · THE TRANSITIVE GATE. NOTHING THAT MUTATES IS REACHABLE ───────────── */
function noAuthorityIsReachable(): void {
  const graph = transitiveGraph([PROJECTION, PAGE, ...walk(COMPONENT_DIR)]);
  assert.ok(graph.size > 3, "the graph walker actually resolved Live Map's imports");
  /* It must reach the authorities it consumes — otherwise the walk proves nothing. */
  assert.ok(
    graph.has("src/features/organization-authority/read-organization.server.ts"),
    "the walk reaches the Organization Authority, so it is a real graph",
  );

  /*
   * NOT A NAME BAN — A REACHABILITY BAN. Each of these is a module that can change the world.
   * Reaching one is how an observation surface acquires authority it never meant to hold.
   */
  const forbidden: ReadonlyArray<readonly [string, string]> = [
    ["src/features/organization-authority", "an organization writer"],
    ["create-durable-agent-identity", "the agent identity writer"],
    ["retire-durable-agent-identity", "the agent retirement writer"],
    ["establish-governance-authority", "the Governance authority writer"],
    ["record-governance-decision", "a Governance decision writer"],
    ["decide-action-request", "the action authorization decider"],
    ["originate-action", "the agent origination writer"],
    ["provider-connectivity-control", "the provider kill switch"],
    ["integration-credential", "credential storage"],
    ["knowledge-write-authority", "the Knowledge write authority"],
    ["heby-model", "the model boundary"],
    ["heby-model-live", "a live provider transport"],
  ];
  /*
   * SCHEMA MODULES ARE EXCLUDED, AND THAT IS NOT A LOOPHOLE.
   *
   * `db/client.server.ts` imports the schema BARREL to type the drizzle handle, so every table
   * definition in the repository is reachable from every read authority — including
   * `db/schema/provider-connectivity-control.ts`. The first version of this list matched that file
   * and reported that Live Map reaches the provider kill switch, which is false: a table definition
   * declares columns and holds no behaviour. The needles below name AUTHORITY modules under
   * `src/features/`, and the behavioural sweep after them covers what a name never could.
   */
  const behavioural = [...graph].filter((f) => !f.startsWith("src/db/schema/"));

  for (const [needle, what] of forbidden) {
    /* The Organization Authority DIRECTORY is allowed — but only its read seam. */
    const offenders = behavioural.filter((f) => f.includes(needle));
    if (needle === "src/features/organization-authority") {
      assert.deepEqual(
        offenders.sort(),
        [
          "src/features/organization-authority/contracts.ts",
          "src/features/organization-authority/read-organization.server.ts",
          /*
           * OSA-1. The structural read is reached TRANSITIVELY, through the one seam Live Map
           * already called — not by Live Map importing it. That is the milestone's own claim:
           * consumers INHERIT structure and do not learn a second way to ask. Live Map's own
           * source is unchanged, and the structure WRITER is still absent from this census.
           */
          "src/features/organization-authority/read-structure.server.ts",
        ],
        "Live Map reaches the Organization Authority's read seam — and, through it, the structural " +
          "read it delegates to. Nothing beside those, and no writer.",
      );
      continue;
    }
    assert.deepEqual(offenders, [], `Live Map must not reach ${what} (${needle})`);
  }

  /*
   * ── THE BEHAVIOURAL SWEEP: NO NEEDLE REQUIRED ───────────────────────────────
   *
   * A name list only catches modules somebody thought to name. This asserts the property directly
   * over the whole reachable graph: outside the schema definitions and the ambient session floor
   * that EVERY authenticated page stands on, nothing Live Map can reach performs a durable write.
   *
   * The floor is enumerated rather than waved away — see the block below for why it is there.
   */
  const AMBIENT_FLOOR = /^src\/(features\/auth-runtime\/|features\/auth\/|db\/client\.server\.ts)/;
  const writers = behavioural.filter((f) => !AMBIENT_FLOOR.test(f) && performsDurableWrite(read(f)));
  assert.deepEqual(
    writers,
    [],
    "outside the ambient session floor, nothing reachable from Live Map performs a durable write",
  );

  /*
   * ── WHAT *IS* REACHABLE, STATED RATHER THAN LEFT TO LOOK LIKE AN OVERSIGHT ──
   *
   * A firewall that only lists what is forbidden lets a reader assume the graph is otherwise empty.
   * It is not. Live Map reaches the control-plane handle FACTORY and the session runtime, because
   * the authorities it consumes need the first and every authenticated page needs the second —
   * `resolveTenantContext` pulls the whole session service, which legitimately owns credentials.
   *
   * That is not Live Map's authority; it is the floor every authenticated surface stands on. The
   * honest guarantee is narrower and is what the rest of this function proves: Live Map itself
   * holds no handle, and no module that MUTATES a domain is reachable from it.
   *
   * Pinning the set means a NEW sensitive edge fails here instead of arriving silently.
   */
  const sessionFloor = [...graph].filter(
    (f) => f.startsWith("src/features/auth-runtime/") || f.startsWith("src/features/auth/") || f === "src/db/client.server.ts",
  );
  assert.ok(
    sessionFloor.includes("src/db/client.server.ts"),
    "the handle factory is reachable through the authorities — stated, not hidden",
  );
  assert.ok(
    sessionFloor.every((f) => /auth-runtime|features\/auth\/|db\/client\.server/.test(f)),
    "the only ambient runtime Live Map reaches is session resolution and the handle factory",
  );

  /* And no shell, filesystem, network or device capability was acquired for a picture. */
  for (const file of graph) {
    if (!file.startsWith(FEATURE_DIR) && !file.startsWith(COMPONENT_DIR) && file !== PAGE) continue;
    const code = codeOf(read(file));
    for (const banned of ["child_process", "node:fs", "node:net", "fetch(", "navigator.", "WebSocket", "EventSource"]) {
      assert.ok(!code.includes(banned), `${file}: a projection needs no ${banned}`);
    }
  }
}

/* ── 3 · IT CONSUMES AUTHORITIES RATHER THAN REACHING PAST THEM ───────────── */
function itConsumesTheSeams(): void {
  const projection = read(PROJECTION);
  assert.match(projection, /readOrganizationAuthority/, "organization truth comes from L3");
  assert.match(projection, /readDurableAgentIdentityState/, "agent identity comes from its own authority");

  /*
   * IMPORTED BY FILE, NOT BY BARREL. `@/features/agent-identity` re-exports two lifecycle writers;
   * importing the barrel would put both in Live Map's graph for the sake of one read.
   */
  assert.ok(
    !/from\s+["']@\/features\/agent-identity["']/.test(projection),
    "the agent read is imported by file, never through the barrel that re-exports its writers",
  );
  assert.match(
    projection,
    /from\s+"@\/features\/agent-identity\/read-durable-agent-identity\.server"/,
    "and it names the read module explicitly",
  );
}

/* ── 4 · NO CALLER CAN NAME ANOTHER ORGANIZATION ──────────────────────────── */
function tenantIsUnrepresentableAsAnArgument(): void {
  const source = read(PROJECTION);
  const start = source.indexOf("export async function readLiveMapProjection");
  assert.ok(start > 0, "the projection is exported");
  const signature = source.slice(start, source.indexOf("{", source.indexOf(")", start)));
  assert.match(signature, /tenant:\s*TenantContext\s*\|\s*null/, "the tenant is the trusted context");
  for (const name of ["organizationId", "tenantId", "slug", "filter", "scope"]) {
    assert.ok(!new RegExp(`${name}\\s*[?:]`).test(signature), `no ${name} parameter`);
  }

  const page = read(PAGE);
  assert.match(
    page,
    /readLiveMapProjection\(await resolveTenantContext\(\)\)/,
    "the page resolves its tenant server-side and passes no identifier",
  );
  assert.ok(!/searchParams/.test(page), "no query parameter reaches the projection");
}

/* ── 5 · MOCK AND SEEDED FICTION CANNOT ENTER THE MAP ─────────────────────── */
function fictionCannotBeLaundered(): void {
  const graph = transitiveGraph([PROJECTION, PAGE, ...walk(COMPONENT_DIR)]);
  const mocks = [...graph].filter((f) => /\/mock(\.|\/)|\/mock$|fixtures?\//.test(f));
  assert.deepEqual(mocks, [], "no compiled-in fixture is reachable from Live Map");

  /*
   * AND IT IS UNREPRESENTABLE, NOT MERELY UNREACHED. `LiveMapTruth` has one member, so a derived,
   * seeded or mock node cannot be constructed at all — the strongest form this guarantee has.
   */
  const contracts = read(`${FEATURE_DIR}/contracts.ts`);
  const union = contracts.slice(
    contracts.indexOf("export type LiveMapTruth"),
    contracts.indexOf(";", contracts.indexOf("export type LiveMapTruth")),
  );
  assert.match(union, /=\s*"authoritative"\s*$/, "LiveMapTruth admits exactly one value");
  for (const banned of ["derived", "seeded", "mock", "inferred", "simulated"]) {
    assert.ok(!union.includes(banned), `LiveMapTruth must not admit "${banned}"`);
  }
}

/* ── 6 · THE SURFACE OFFERS NAVIGATION, NEVER CONTROL ─────────────────────── */
function theSurfaceCannotAct(): void {
  for (const file of walk(COMPONENT_DIR)) {
    const code = codeOf(read(file));
    for (const banned of ["onClick", "onSubmit", "<form", "<button", "useState", "action="]) {
      assert.ok(
        !code.includes(banned),
        `${file}: Live Map Core offers navigation only — "${banned}" implies a control it does not have`,
      );
    }
  }
}

/* ── 7 · IT IS A DESTINATION, AND THE SEVEN WORKSPACES DID NOT GROW ───────── */
function navigationIsTruthful(): void {
  const nav = read(NAV);
  assert.match(nav, /href: "\/live-map"/, "Live Map is a canonical destination");
  assert.match(nav, /"\/live-map"/, "and the route resolves under a workspace by match");
  assert.ok(existsSync(path.join(ROOT, PAGE)), "the destination leads to a real page");
  /* The top level is closed at seven; L4 added a Level-2 destination, not an eighth workspace. */
  assert.equal(
    (nav.match(/^\s{4}id: "/gm) ?? []).length,
    7,
    "still exactly seven workspaces — Live Map did not become an eighth",
  );
}

function main(): void {
  liveMapCannotWrite();
  noAuthorityIsReachable();
  itConsumesTheSeams();
  tenantIsUnrepresentableAsAnArgument();
  fictionCannotBeLaundered();
  theSurfaceCannotAct();
  navigationIsTruthful();
  console.log("l4 live map — firewall checks passed");
}

main();
