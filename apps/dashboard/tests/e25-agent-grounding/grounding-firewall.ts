/*
 * E2-5 — DURABLE AGENT GROUNDING FIREWALL.
 *
 * Three claims the semantics test cannot make, because each is about what the module's whole import
 * closure can REACH rather than about what one call returned:
 *
 *   HEBY -/-> LIVE MAP. `live-map-agent-outcome.server.ts` sits in the SAME DIRECTORY as the seam
 *   this phase imports and produces the very numbers the authenticated map renders. Reading them
 *   from there would have been the smaller diff and would have broken E2-1's released rule: Heby's
 *   evidence would become a function of a rendering, and a future Live Map layer would enter model
 *   context through an edit made somewhere else entirely.
 *
 *   E2-5 WRITES NOTHING. The observation authority owns eight fact readers and this phase adds a
 *   ninth consumer of them. Agent lifecycle writers exist — `create-durable-agent-identity` and
 *   `retire-durable-agent-identity` — and `@/features/agent-identity` RE-EXPORTS both, so a barrel
 *   import would have put them in Heby's graph. That is why the walker follows `export … from`.
 *
 *   E2-1's ORGANIZATION CLASS STILL ADMITS NO AGENT. This phase must not make an agent reachable
 *   as a property of the organization record; it arrives under its own class or not at all.
 *
 * The bans read code with comments and string literals STRIPPED. R2F.1 and G2 both recorded the
 * trap: a guard that scans raw source is tripped by a comment mentioning the thing it forbids, and
 * this file's own header names every symbol it bans.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const AUTHORITY_DIR = "src/features/agent-outcome-observation";
const PROJECTION = `${AUTHORITY_DIR}/heby-agent-source.server.ts`;
const LIVE_MAP_SEAM = `${AUTHORITY_DIR}/live-map-agent-outcome.server.ts`;
const HEBY_ANSWER = "src/features/heby-answer/model-answer.server.ts";
const ORGANIZATION_PROJECTION =
  "src/features/organization-authority/heby-organization-source.server.ts";

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
 * Both traps are already paid for in this repository, and E2-1's firewall states why: `import type`
 * is erased and reaches nothing at runtime, so counting it over-reports; `export … from` IS an edge,
 * and a walker that misses it is blind to a barrel — precisely the shape that matters here, since
 * `@/features/agent-identity` re-exports two lifecycle writers.
 */
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
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
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

function main(): void {
  /* ── 0 · THE WALKER IS NON-VACUOUS ───────────────────────────────────────── */
  {
    /*
     * A graph that resolved nothing would make every ban below pass for free. This proves the
     * walker followed real edges AND followed a `export … from` re-export, which is the edge kind
     * that has silently defeated a firewall in this repository before.
     */
    const graph = transitiveGraph([PROJECTION]);
    assert.ok(graph.size > 5, "the walker resolved the projection's imports");
    assert.ok(
      graph.has(`${AUTHORITY_DIR}/agent-outcome-projection.server.ts`),
      "the walk reaches the owner-side observation seam, so it is a real graph",
    );

    const barrel = transitiveGraph(["src/features/agent-identity/index.ts"]);
    assert.ok(
      barrel.has("src/features/agent-identity/create-durable-agent-identity.server.ts"),
      "the walker follows `export … from`, so a barrel cannot hide a writer from it",
    );
  }

  /* ── 1 · THE PROJECTION DOES NOT REACH LIVE MAP ──────────────────────────── */
  {
    const graph = transitiveGraph([PROJECTION]);
    for (const file of graph) {
      assert.ok(
        !file.startsWith("src/features/live-map/"),
        `E2-5's projection must not reach Live Map, but it reaches ${file}`,
      );
    }
    assert.ok(
      !graph.has(LIVE_MAP_SEAM),
      "the projection must not read the Live Map agent-outcome seam that sits beside it",
    );

    /* And the ban is not vacuous: that seam really is next door and really is importable. */
    assert.ok(existsSync(path.join(ROOT, LIVE_MAP_SEAM)), "the Live Map seam exists to be avoided");

    const code = codeOf(read(PROJECTION));
    for (const symbol of ["readLiveMapAgentOutcome", "LiveMapAgentOutcome", "LIVE_MAP_AGENT_OUTCOME"]) {
      assert.ok(!code.includes(symbol), `the projection must not name ${symbol}`);
    }
  }

  /* ── 2 · THE PROJECTION'S WHOLE CLOSURE WRITES NOTHING ───────────────────── */
  {
    const graph = transitiveGraph([PROJECTION]);
    for (const file of graph) {
      assert.ok(
        !performsDurableWrite(read(file)),
        `E2-5's grounding closure must contain no durable write, but ${file} performs one`,
      );
    }

    const code = codeOf(read(PROJECTION));
    for (const [symbol, what] of [
      ["createDurableAgentIdentity", "the agent identity writer"],
      ["retireDurableAgentIdentity", "the agent retirement writer"],
      ["writeImprovementHypothesis", "the improvement hypothesis writer"],
    ] as const) {
      assert.ok(!code.includes(symbol), `the projection must not reach ${what}`);
    }
  }

  /* ── 3 · THE PROJECTION HOLDS NO DATABASE HANDLE AND NO TABLE ────────────── */
  {
    const code = codeOf(read(PROJECTION));
    for (const symbol of ["getControlPlaneDb", "ControlPlaneDatabase", "drizzle", "db.select", "sql`"]) {
      assert.ok(
        !code.includes(symbol),
        `the projection must not hold ${symbol} — the authority keeps its own handle`,
      );
    }
    /*
     * The TABLE, not the word. `agents` also names the observation's own result field and this
     * class, so a bare-token ban would fail on legitimate code — the ban is on importing schema.
     */
    assert.ok(
      !/from\s*["']@\/db\/schema/.test(code),
      "the projection must not import a schema table",
    );
    /*
     * DIRECT edges only. The CLOSURE reaches the control-plane client and must — that is the
     * authority opening its own connection, which is the whole point of the projection living on
     * the authority's side. The claim is that this FILE holds no handle, not that the authority
     * beneath it has none.
     */
    assert.ok(
      !valueEdges(PROJECTION).some((specifier) => specifier.includes("db/client")),
      "the projection must not import the control-plane client itself",
    );
    assert.deepEqual(
      valueEdges(PROJECTION).sort(),
      ["./agent-outcome-projection.server"],
      "the projection's only value import is the owner-side observation seam",
    );
  }

  /* ── 4 · E2-1's ORGANIZATION CLASS STILL ADMITS NO AGENT ─────────────────── */
  {
    /*
     * Re-asserted here rather than assumed. This phase's whole argument is that E2-1's ban is
     * scoped to the `organization` class, so that ban must still hold after this phase — otherwise
     * the argument was a way of not noticing a contradiction.
     */
    const graph = transitiveGraph([ORGANIZATION_PROJECTION]);
    for (const file of graph) {
      assert.ok(
        !file.startsWith(AUTHORITY_DIR),
        `the organization projection must still admit no agent, but it reaches ${file}`,
      );
    }
    const code = codeOf(read(ORGANIZATION_PROJECTION));
    for (const symbol of ["readAgentGroundingSource", "AgentOutcomeObservation", "agentName"]) {
      assert.ok(!code.includes(symbol), `the organization class must not reference ${symbol}`);
    }
  }

  /* ── 5 · THE ANSWER FLOW IMPORTS THE PROJECTION, NOT THE AUTHORITY ───────── */
  {
    const code = codeOf(read(HEBY_ANSWER));
    assert.ok(code.includes("readAgentGroundingSource"), "the answer flow imports the projection");
    for (const symbol of [
      "readAgentOutcomeObservation",
      "readAgentProposalFacts",
      "readDurableAgentIdentityState",
    ]) {
      assert.ok(
        !code.includes(symbol),
        `Heby must hold the projection only, never ${symbol} — the authority keeps its readers`,
      );
    }
  }

  /* ── 6 · ONLY ONE MODULE PRODUCES THE CLASS ──────────────────────────────── */
  {
    /*
     * A second producer would be a second authority over the same class, free to disagree about a
     * standing or a wording. The pure resolver's honest default is the one legitimate exception.
     */
    const walk = (dir: string): string[] =>
      !existsSync(path.join(ROOT, dir))
        ? []
        : readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) return walk(p);
            return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
          });

    const producers = walk("src").filter((file) => /sourceClass:\s*"agents"/.test(read(file)));
    assert.deepEqual(
      producers.sort(),
      [PROJECTION].sort(),
      "exactly one module may construct an `agents` resolution",
    );

    /* The pure resolver produces it through its own shared helper, which is why it is not listed. */
    const resolver = read("src/features/heby-runtime/source-resolver.ts");
    assert.match(resolver, /case "agents":/, "the pure resolver still answers for the class");
  }

  console.log("e25-agent-grounding/grounding-firewall: OK");
}

main();
