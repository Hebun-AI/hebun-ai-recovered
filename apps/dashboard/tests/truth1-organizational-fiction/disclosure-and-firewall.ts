/*
 * L1 — I·FOUNDATION·TRUTH-1 — Retire the Fiction.
 *
 * ── WHAT WAS MEASURED ────────────────────────────────────────────────────────
 *
 * A value-import graph over `src/` (type-only imports excluded, `export … from` re-exports
 * included) was walked from every dashboard `page.tsx`. 46 routes reach a compiled-in `mock.ts`
 * without passing through the released mock-surface gate. Of those, 25 rendered organizational
 * fiction with no honest marker of any kind:
 *
 *   21 legacy-domain sub-routes  HR (7) / Finance (6) / Legal (8). Their PARENT surfaces already
 *                               carry `LegacyDomainNotice` from UI Phase 25C; the sub-routes were
 *                               left behind, and they carry the same fixtures — employees, access
 *                               requests, interviews, reviews, budgets, invoices, payments,
 *                               contracts, policies, risk registers.
 *   /director/executions        rendered `director/mock.ts` under "Live execution runs across the
 *                               platform" and a primary "N runs" badge.
 *   /director/agents            counted a seeded registry under a green "N active agents" badge.
 *   /director/registries/memory,
 *   /director/registries/workflows
 *                               counted seeded registries under green "N active" badges.
 *
 * ── THE TREATMENT, AND WHY IT IS NOT A NEW AUTHORITY ─────────────────────────
 *
 * Nothing here is invented. This repository has already released two treatments for compiled-in
 * fiction, and TRUTH-1 extends their REACH rather than adding a third:
 *
 *   withhold   `mock-surface-gating/gate.server.ts` at its two call sites, for fiction that is
 *              CONSUMED as truth (the Director dashboard projection and Heby's grounding).
 *   disclose   `LegacyDomainNotice` (UI Phase 25C), `ProjectionSourceNotice` (/director) and the
 *              AGENT-ID-0.1 wording (/director/registries/agents), for fixture surfaces whose
 *              value is the example itself.
 *
 * The 25 repaired surfaces take the DISCLOSE treatment, because their own siblings already did:
 * withholding /hr/onboarding while /hr renders the same fixtures behind a notice would contradict a
 * released decision, not extend it.
 *
 * ── WHAT THIS SUITE PINS ─────────────────────────────────────────────────────
 *
 * That the census is real and did not shrink; that every repaired surface discloses; that no
 * unlabelled organizational mock route was left behind under the inclusion rule; that the gate was
 * not modified, widened, or joined by a second truth authority; and that TRUTH-1 added no writer,
 * no schema, no route and no authority.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GATE = "src/features/mock-surface-gating/gate.server.ts";
const ADAPTER = "src/features/director-dashboard-ui/adapter.server.ts";
const GOALS = "src/features/command-goals/workspace-model.ts";

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/* Comment-stripped source. A prohibition proved over raw text is tripped by prose that merely
 * NAMES what it forbids — this file's own header would trip several checks below. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function srcFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "migrations") walk(rel);
      } else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
  };
  walk("src");
  return out;
}

/*
 * VALUE import graph.
 *
 * `import type { X }` and `import { type X }` are erased at compile time: a route that only names a
 * mock's TYPE renders none of its data, and counting those edges would have manufactured a dozen
 * false defects. `export … from` re-exports ARE followed, because a barrel is how three of the
 * measured routes actually reach their fixtures.
 */
function valueGraph(files: string[]): Map<string, Set<string>> {
  const known = new Set(files);
  const resolve = (spec: string, from: string): string | undefined => {
    let base: string;
    if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
    else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    else return undefined;
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (known.has(candidate)) return candidate;
    }
    return undefined;
  };
  const valueClause = (clause: string): boolean => {
    const braced = [...clause.matchAll(/\{([\s\S]*?)\}/g)].map((m) => m[1]!).join(",");
    const binds = braced.split(",").map((s) => s.trim()).filter(Boolean);
    const rest = clause.replace(/\{[\s\S]*?\}/g, "").trim().replace(/,$/, "");
    return !(binds.length > 0 && rest.length === 0 && binds.every((b) => b.startsWith("type ")));
  };
  const graph = new Map<string, Set<string>>();
  for (const file of files) {
    const code = codeOf(read(file));
    const targets = new Set<string>();
    for (const m of code.matchAll(/\bimport\s+(type\s+)?([\s\S]*?)from\s+["']([^"']+)["']/g)) {
      if (m[1] || !valueClause(m[2]!)) continue;
      const target = resolve(m[3]!, file);
      if (target) targets.add(target);
    }
    for (const m of code.matchAll(/\bexport\s+(type\s+)?(\{[^}]*\}|\*[^;]*?)\s+from\s+["']([^"']+)["']/g)) {
      if (m[1] || !valueClause(m[2]!)) continue;
      const target = resolve(m[3]!, file);
      if (target) targets.add(target);
    }
    graph.set(file, targets);
  }
  return graph;
}

/** Reachability with cut points: a path that passes through a cut stops there. */
function reaches(
  graph: Map<string, Set<string>>,
  start: string,
  targets: Set<string>,
  cuts: Set<string> = new Set(),
): Set<string> {
  const seen = new Set([start]);
  const stack = [start];
  const hits = new Set<string>();
  while (stack.length) {
    const node = stack.pop()!;
    if (targets.has(node)) { hits.add(node); continue; }
    if (cuts.has(node) && node !== start) continue;
    for (const next of graph.get(node) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(next);
    }
  }
  return hits;
}

const HR_SUBS = ["candidate-screening", "employee-support", "interviews", "learning", "offboarding", "onboarding", "performance"];
const FINANCE_SUBS = ["analytics", "budgets", "expenses", "invoices", "payments", "tax-compliance"];
const LEGAL_SUBS = ["compliance", "contract-generation", "contract-review", "contracts", "ip-trademark", "policies", "regulatory", "risk"];

const NOTICED: ReadonlyArray<{ route: string; domain: string }> = [
  ...HR_SUBS.map((s) => ({ route: `hr/${s}`, domain: "HR" })),
  ...FINANCE_SUBS.map((s) => ({ route: `finance/${s}`, domain: "Finance" })),
  ...LEGAL_SUBS.map((s) => ({ route: `legal/${s}`, domain: "Legal" })),
];

/** The four surfaces repaired by relabelling rather than by the shared notice. */
const RELABELLED = [
  "director/executions",
  "director/agents",
  "director/registries/memory",
  "director/registries/workflows",
];

const pageOf = (route: string): string => `src/app/(dashboard)/${route}/page.tsx`;

function main(): void {
  const files = srcFiles();
  const graph = valueGraph(files);
  const mocks = new Set(files.filter((f) => path.posix.basename(f) === "mock.ts"));
  const gateCallSites = new Set([ADAPTER, GOALS]);

  /* ── 1: the census is real ───────────────────────────────────────────────── */
  {
    /* Anti-shrink floor, not a count: nobody may satisfy the firewall below by deleting the mock
     * tree. A legitimate deletion lowers this line explicitly. */
    assert.ok(mocks.size >= 18, `expected the known mock modules, found ${mocks.size}`);

    /* Every repaired route must still actually reach a mock by VALUE. A repair whose premise has
     * evaporated is a stale disclosure, and this suite would otherwise never notice. */
    for (const { route } of NOTICED) {
      assert.ok(
        reaches(graph, pageOf(route), mocks, gateCallSites).size > 0,
        `/${route} no longer reaches a mock; its notice is now a false statement`,
      );
    }
    for (const route of RELABELLED) {
      assert.ok(
        reaches(graph, pageOf(route), mocks, gateCallSites).size > 0,
        `/${route} no longer reaches a mock; its disclosure is now a false statement`,
      );
    }
  }

  /* ── 2: every legacy-domain sub-route discloses, through the EXISTING owner ─ */
  {
    for (const { route, domain } of NOTICED) {
      const source = read(pageOf(route));
      const code = codeOf(source);
      assert.ok(
        code.includes('from "@/components/workforce-workspace/legacy-domain"'),
        `/${route} must disclose through the released Phase 25C primitive, not a local one`,
      );
      assert.ok(
        code.includes(`<LegacyDomainNotice domain="${domain}" />`),
        `/${route} must render the ${domain} legacy-domain notice`,
      );
      /* Rendered BEFORE the fiction, not buried under it: a marker below the fold is a marker the
       * reader meets after already believing the numbers. */
      const notice = code.indexOf("<LegacyDomainNotice");
      const header = code.indexOf("<PageHeader");
      assert.ok(header >= 0 && notice > header, `/${route} renders the notice after its header`);
      const grid = code.indexOf('<div className="grid');
      if (grid >= 0) assert.ok(notice < grid, `/${route} renders the notice above its content`);
    }
    /* The parents that established the treatment still carry it. */
    for (const parent of ["hr", "finance", "legal", "tickets"]) {
      assert.ok(
        codeOf(read(pageOf(parent))).includes("<LegacyDomainNotice"),
        `/${parent} must keep the released Phase 25C notice`,
      );
    }
  }

  /* ── 3: the notice says what it must, and cannot be dismissed away ───────── */
  {
    const primitive = read("src/components/workforce-workspace/legacy-domain.tsx");
    for (const phrase of ["not authoritative", "not connected to any live enterprise system", "illustrative"]) {
      assert.ok(primitive.includes(phrase), `the legacy-domain notice must still say "${phrase}"`);
    }
    const code = codeOf(primitive);
    /* `hidden` is NOT in this list: the notice legitimately marks its icon `aria-hidden`, and
     * banning the substring would fail on the accessibility attribute rather than on an escape
     * hatch. What must not exist is a way for the reader to make the notice go away. */
    for (const escape of ["useState", "onClick", "dismiss", "collapse"]) {
      assert.ok(!code.includes(escape), `the notice must not become dismissible (${escape})`);
    }
  }

  /* ── 4: the relabelled surfaces stopped claiming live organizational truth ─ */
  {
    const executions = codeOf(read(pageOf("director/executions")));
    assert.ok(
      !executions.includes("Live execution runs across the platform"),
      "/director/executions must not describe compiled-in fixtures as live runs",
    );
    assert.ok(
      !/variant="(primary|success)">\{executions\.length\}/.test(executions),
      "/director/executions must not badge a fixture count in a confident tone",
    );
    assert.match(executions, /example runs/, "/director/executions must name the fixture as an example");

    for (const route of ["director/agents", "director/registries/memory", "director/registries/workflows"]) {
      const code = codeOf(read(pageOf(route)));
      assert.ok(
        !/variant="success">\{\w+\} active/.test(code),
        `/${route} must not count a seeded registry as live "active" state`,
      );
      assert.match(code, /simulated definitions/, `/${route} must name what it is showing`);
    }

    /* The released sibling that set this wording is untouched and still says it. */
    const releasedSibling = codeOf(read(pageOf("director/registries/agents")));
    assert.match(releasedSibling, /simulated definitions/, "AGENT-ID-0.1's disclosure is preserved");
  }

  /* ── 5: no unlabelled organizational-mock route was left behind ──────────── */
  {
    /*
     * The inclusion rule, executed rather than asserted: every dashboard route that reaches a mock
     * by value WITHOUT passing the gate must carry SOME honest marker. The known-safe categories
     * are listed with their reason, so adding a route to this list is a visible decision.
     */
    const DISCLOSURE = [
      "LegacyDomainNotice",        // Phase 25C legacy domains
      "ProjectionSourceNotice",    // /director enterprise projections
      "simulated definitions",     // AGENT-ID-0.1 registries + TRUTH-1
      "example runs",              // TRUTH-1 /director/executions
      "Mock projection",           // /director/organization
      "No live execution",         // /director/offline-execution — the marker is its own
                                   // first sentence; the phrase "Simulation enforced" wraps
                                   // across two source lines and is not a contiguous match.
    ];
    /*
     * OUT OF SCOPE, with the reason each is out — not a suppression list.
     *
     *  architecture/*  claims about HEBUN'S OWN product structure (cores, engines, registries,
     *                  platform health), not about the reader's organization. Real, and outside
     *                  the L1 contract, which is organizational truth. Recorded, not repaired.
     *  agents,
     *  workforce/*     UI Phase 25B already classifies every value it shows with an explicit
     *                  provenance class (structural / seeded / derived-from-seeded / simulated /
     *                  unavailable). Stronger than a banner, and released.
     *  [...slug]       reaches `approvals/mock` only through `sidebar.config.ts`'s badge, and that
     *                  config's navigation tree has NO renderer: `sidebarConfig` has zero value
     *                  importers and `SidebarSection` is never mounted. Unreachable, so it states
     *                  nothing to anybody. Pinned below rather than repaired.
     *  director/memory Company Memory reads the real Enterprise Memory authority; its mock edge is
     *                  the composition root's in-memory fallback, not what the surface renders.
     */
    const OUT_OF_SCOPE = new Set([
      "architecture", "architecture/cognitive-core", "architecture/engines", "architecture/execution-core",
      "architecture/governance-core", "architecture/intelligence-core", "architecture/registries",
      "architecture/system-flow",
      "agents", "workforce/capabilities", "workforce/teams",
      "[...slug]", "director/memory",
    ]);

    const routes = files.filter((f) => f.startsWith("src/app/(dashboard)/") && f.endsWith("/page.tsx"));
    const undisclosed: string[] = [];
    for (const file of routes) {
      const route = file.slice("src/app/(dashboard)/".length, -"/page.tsx".length);
      if (OUT_OF_SCOPE.has(route)) continue;
      if (reaches(graph, file, mocks, gateCallSites).size === 0) continue;
      const code = codeOf(read(file));
      if (!DISCLOSURE.some((marker) => code.includes(marker))) undisclosed.push(route);
    }
    assert.deepEqual(
      undisclosed,
      [],
      `these routes render compiled-in organizational fiction with no honest marker: ${undisclosed.join(", ")}`,
    );
  }

  /* ── 6: the dead sidebar badge really is unreachable ─────────────────────── */
  {
    const importers = files.filter(
      (f) => f !== "src/config/sidebar.config.ts" && /\bsidebarConfig\b/.test(codeOf(read(f))),
    );
    assert.deepEqual(importers, [], "sidebarConfig gained a consumer; its mock badge is now visible");
    const shell = codeOf(read("src/components/layout/hebun-shell.tsx"));
    assert.ok(!shell.includes("SidebarSection"), "the shell must not mount the legacy sidebar tree");
  }

  /* ── 7: the gate is the ONE truth authority, unchanged and unwidened ─────── */
  {
    const gate = codeOf(read(GATE));
    const imports = [...gate.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    assert.deepEqual(
      imports,
      ["@/features/auth-runtime/request-session.server"],
      "the gate still reads exactly one existing authority",
    );
    assert.match(gate, /status === "disabled"/, "the gate still permits only an explicitly disabled environment");
    for (const forbidden of ["tenantId", "tenant_id", "slug", "roles", "memberships", "permission", "authorize", "NODE_ENV"]) {
      assert.ok(!gate.includes(forbidden), `the gate must not read ${forbidden}`);
    }
    /* Its call sites are the released two. TRUTH-1 neither added nor removed one. */
    const callers = files.filter((f) => f !== GATE && codeOf(read(f)).includes("mock-surface-gating/gate.server"));
    assert.deepEqual(callers.sort(), [ADAPTER, GOALS].sort(), "the gate's call sites are unchanged");
    /* And no second truth authority appeared beside it. */
    const rivals = files.filter(
      (f) => f !== GATE && /\b(mockRegistry|fictionDetector|truthGate|productTruth|environmentTruth)\b/.test(codeOf(read(f))),
    );
    assert.deepEqual(rivals, [], "TRUTH-1 must not introduce a second truth authority");
  }

  /* ── 8: unavailable is still not zero, and not empty ─────────────────────── */
  {
    /* TRUTH-1 fabricates nothing and zeroes nothing: no repaired surface replaced a fixture with a
     * synthesised 0 or an empty list, and the released vocabulary that keeps the two apart is
     * intact. */
    const labels = read("src/features/platform/workspace-model.ts");
    assert.match(labels, /unavailable:\s*"Unavailable"/);
    assert.match(labels, /empty:\s*"No records"/);
    for (const { route } of NOTICED) {
      const code = codeOf(read(pageOf(route)));
      assert.ok(!/=\s*\[\]\s*;?\s*\/\/\s*unavailable/i.test(code), `/${route} must not fake an empty list`);
    }
  }

  /* ── 9: TRUTH-1 wrote nothing — no schema, no writer, no route, no ceremony ─ */
  {
    const touched = [...NOTICED.map((n) => pageOf(n.route)), ...RELABELLED.map(pageOf)];
    for (const file of touched) {
      const code = codeOf(read(file));
      for (const forbidden of ["db/client", "drizzle", "insert(", "update(", "delete(", '"use server"', "revalidatePath"]) {
        assert.ok(!code.includes(forbidden), `${file} must not gain a writer (${forbidden})`);
      }
      assert.ok(!/tenantId|tenant_id/.test(code), `${file} must not read tenant identity`);
    }
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
    /*
     * PHASE-RELATIVE, NOT ABSOLUTE (repaired at OSA-1). An exact count is a claim about every
     * later phase rather than about this one; the claim being made is that TRUTH-1 added none.
     */
    assert.deepEqual(
      migrations.filter((f) => /truth|fiction/i.test(f)),
      [],
      "TRUTH-1 adds no migration",
    );
    for (const file of migrations) {
      assert.ok(!/truth1|truth-1|fiction/i.test(file), `no migration bears this phase's name — found ${file}`);
    }
    const routes = files.filter((f) => f.startsWith("src/app/") && /\/(page|route)\.tsx?$/.test(f));
    assert.ok(!routes.some((r) => /truth1|truth-1|fiction/i.test(r)), "TRUTH-1 introduces no route");
    assert.ok(existsSync(path.join(ROOT, GATE)), "the released gate still exists");
  }

  console.log("L1 TRUTH-1 organizational fiction: all assertions passed.");
}

main();
