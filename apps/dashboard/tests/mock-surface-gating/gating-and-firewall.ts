/*
 * G2 — mock surface gating.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
 *
 * Every organizational input to the Director dashboard projection is compiled-in fiction.
 * `organization-projection-builder` imports `hr/mock` (employees, reviews, tickets, interviews,
 * access requests, offboardings), `agents/mock` (departments) and `approvals/mock`; the agent and
 * workflow CRUD adapters seed themselves from `agents/mock` and `workflows/mock`. Read unguarded,
 * the projection reports `active-agents: ready, 36` and `active-workflows: ready, 14` — a
 * fictional headcount under the label "Available".
 *
 * `heby-runtime/overview-source.server.ts` reads THAT SAME adapter, so the fiction was not merely
 * displayed: it was Heby's Executive Overview grounding, and would be reasoned over and spoken as
 * organizational fact for a real tenant.
 *
 * ── WHAT MUST NOT DRIFT ──────────────────────────────────────────────────────
 *
 * The fix is one guard at one choke point, keyed to an authority that already exists. This suite
 * pins that the guard is real (it changes behaviour under both environments), that it withholds
 * rather than fabricates a zero, that Heby's grounding follows it, that the pre-auth demo shell
 * still renders its intended seeded data, and that R6 Knowledge and R7.1 Governance Activity —
 * which reach no mock at all — were not gated by association.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ADAPTER = "src/features/director-dashboard-ui/adapter.server.ts";
const GATE = "src/features/mock-surface-gating/gate.server.ts";

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/* Comment-stripped source: a prohibition proved over raw text is tripped by prose that merely
 * NAMES the thing it forbids. This file's own headers would trip several checks below. */
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

/** Static import graph over src/, used to prove reachability rather than assume it. */
function importGraph(files: string[]): Map<string, Set<string>> {
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
  const graph = new Map<string, Set<string>>();
  for (const file of files) {
    const targets = new Set<string>();
    for (const spec of codeOf(read(file)).matchAll(/from\s+["']([^"']+)["']/g)) {
      const target = resolve(spec[1]!, file);
      if (target) targets.add(target);
    }
    graph.set(file, targets);
  }
  return graph;
}

function reachable(graph: Map<string, Set<string>>, start: string, targets: Set<string>): Set<string> {
  const seen = new Set([start]);
  const stack = [start];
  const hits = new Set<string>();
  while (stack.length) {
    for (const next of graph.get(stack.pop()!) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      if (targets.has(next)) hits.add(next);
      stack.push(next);
    }
  }
  return hits;
}

/** Run `body` with HEBUN_AUTH_ENABLED set/unset, restoring the previous value exactly. */
function withAuthEnabled<T>(enabled: boolean, body: () => T): T {
  const key = "HEBUN_AUTH_ENABLED";
  const previous = process.env[key];
  if (enabled) process.env[key] = "true";
  else delete process.env[key];
  try {
    return body();
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

async function main(): Promise<void> {
  const files = srcFiles();
  const graph = importGraph(files);
  const mocks = new Set(files.filter((f) => path.posix.basename(f) === "mock.ts"));

  const { getDirectorDashboardUiModel } = await import(
    "../../src/features/director-dashboard-ui/adapter.server"
  );
  const { readServerHebyOverview } = await import(
    "../../src/features/heby-runtime/overview-source.server"
  );
  const { resolveMockSurfaceGate } = await import("../../src/features/mock-surface-gating/gate.server");

  /* ── The census this phase acted on, pinned so it cannot silently grow ───── */
  {
    /*
     * ── FLOOR LOWERED 19 -> 18, WITH THE REASON ─────────────────────────────
     *
     * This is an ANTI-SHRINK floor, not a count: it proves the walker genuinely found the census
     * this phase reasoned about, so nobody can satisfy the firewall below by quietly emptying the
     * mock tree. A legitimate deletion must therefore lower it explicitly rather than silently.
     *
     * `features/integrations/mock.ts` was deleted by the nav-truth phase. It seeded the sidebar's
     * Integrations status dots — Gmail `connected`, GitHub `pending` — from a four-element fixture
     * that had never consulted a connection. Its only consumer, the `status` badge in
     * `sidebar.config.ts`, was removed with it, so the module had nothing left to serve.
     */
    assert.ok(mocks.size >= 18, `expected the known mock modules, found ${mocks.size}`);
    const organizationBuilder = codeOf(read("src/features/runtime-projection/builders/organization-projection-builder.ts"));
    for (const source of ["@/features/hr/mock", "@/features/agents/mock", "@/features/approvals/mock"]) {
      assert.ok(
        organizationBuilder.includes(source),
        `the organization projection still seeds from ${source}; if that changed, this phase's ` +
          "premise changed with it and the gate must be re-derived",
      );
    }
  }

  /* ── 1 + 2: a real tenant receives no mock organizational projection ─────── */
  const gated = withAuthEnabled(true, () => getDirectorDashboardUiModel());
  {
    assert.equal(gated.snapshot, undefined, "no dashboard snapshot may be built for a real tenant");
    assert.ok(gated.overview.sections.length > 0, "the overview still describes its sections");
    for (const section of gated.overview.sections) {
      assert.equal(
        section.sourceState,
        "unavailable",
        `${section.sectionId} must be unavailable, not ${section.sourceState}`,
      );
    }
    /* The specific fictions that used to render. */
    const counts = new Map(gated.overview.sections.map((s) => [s.sectionId, s.recordCount]));
    assert.equal(counts.get("active-agents"), 0, "the fictional agent headcount must be gone");
    assert.equal(counts.get("active-workflows"), 0, "the fictional workflow count must be gone");
  }

  /* ── 6: unavailable is not zero ──────────────────────────────────────────── */
  {
    /* Every gated section reports recordCount 0 — which is only honest because it is paired with
     * `unavailable`. If any section were to report `empty`, the UI would render "No records",
     * which is a claim about the tenant's organization that Hebun cannot make. */
    for (const section of gated.overview.sections) {
      assert.notEqual(
        section.sourceState,
        "empty",
        `${section.sectionId} claims "No records"; Hebun does not know that`,
      );
    }
    assert.equal(
      gated.overview.unavailableCount,
      gated.overview.sections.length,
      "every section is counted as unavailable",
    );
    /* The distinction exists in the rendered vocabulary, not only in the type. */
    const labels = read("src/features/platform/workspace-model.ts");
    assert.match(labels, /unavailable:\s*"Unavailable"/);
    assert.match(labels, /empty:\s*"No records"/);
  }

  /* ── 3: Heby grounding carries no mock organizational value ─────────────── */
  {
    const overview = withAuthEnabled(true, () => readServerHebyOverview());
    assert.ok(overview, "Heby still receives an overview shape");
    assert.equal(overview.authoritative, false, "the overview was never authoritative and still is not");
    for (const section of overview.sections) {
      assert.equal(section.recordCount, 0, `${section.sectionId} leaked a record count into grounding`);
      assert.equal(section.sourceState, "unavailable", `${section.sectionId} is not disclosed as unavailable`);
    }
    /* Heby reaches the mocks ONLY through this adapter — so the choke point is the whole fix. */
    const hebyOverviewSource = "src/features/heby-runtime/overview-source.server.ts";
    assert.ok(
      reachable(graph, hebyOverviewSource, new Set([ADAPTER])).size === 1,
      "Heby's overview source must read the gated adapter",
    );
  }

  /* ── 7: the pre-auth demo shell keeps its intended seeded behaviour ──────── */
  {
    const demo = withAuthEnabled(false, () => getDirectorDashboardUiModel());
    assert.ok(demo.snapshot, "the demo shell still builds its snapshot");
    const ready = demo.overview.sections.filter((s) => s.sourceState === "ready");
    assert.ok(ready.length > 0, "the demo shell still renders seeded sections");
    const agents = demo.overview.sections.find((s) => s.sectionId === "active-agents");
    assert.ok((agents?.recordCount ?? 0) > 0, "the demo shell still shows its reference data");
    assert.equal(resolveMockSurfaceGate().permitted, true, "auth disabled permits the demo surfaces");
  }

  /* ── The gate fails closed ───────────────────────────────────────────────── */
  {
    assert.equal(withAuthEnabled(true, () => resolveMockSurfaceGate()).permitted, false);
    assert.equal(withAuthEnabled(true, () => resolveMockSurfaceGate()).reason, "real-tenant-reachable");
    const gate = codeOf(read(GATE));
    assert.match(gate, /status === "disabled"/, "only an explicitly disabled environment permits");
    assert.match(gate, /catch/, "an unresolvable environment must withhold, not throw or permit");
  }

  /* ── 4 + 5: R6 Knowledge and R7.1 Governance were not gated by association ─ */
  {
    for (const route of ["src/app/(dashboard)/knowledge/page.tsx", "src/app/(dashboard)/governance/page.tsx"]) {
      assert.ok(existsSync(path.join(ROOT, route)), `${route} still exists`);
      assert.equal(
        reachable(graph, route, mocks).size,
        0,
        `${route} must reach no mock module — it is live data and must stay ungated`,
      );
      assert.equal(
        reachable(graph, route, new Set([ADAPTER, GATE])).size,
        0,
        `${route} must not depend on the dashboard adapter or the gate`,
      );
    }
  }

  /* ── 9 + 12: the gate is presentation, never authority, never tenant-aware ─ */
  {
    const gate = codeOf(read(GATE));
    for (const forbidden of [
      "tenantId", "tenant_id", "slug", "provisioningSource", "provisioning_source",
      "roles", "memberships", "permission", "authorize", "NODE_ENV",
    ]) {
      assert.ok(!gate.includes(forbidden), `the gate must not read ${forbidden}`);
    }
    /* It reads exactly one authority, and it is an existing one. */
    const imports = [...codeOf(read(GATE)).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    assert.deepEqual(
      imports,
      ["@/features/auth-runtime/request-session.server"],
      "the gate reads the existing auth environment and nothing else",
    );
  }

  /* ── 8: no database is touched by the gate or by the gated path ──────────── */
  {
    const gate = codeOf(read(GATE));
    for (const forbidden of ["db/client", "drizzle", "insert(", "update(", "delete(", "pg"]) {
      assert.ok(!gate.includes(forbidden), `the gate must not reach ${forbidden}`);
    }
    /*
     * The gate imports `request-session.server`, which ALSO exports session resolution and is
     * therefore transitively database-capable — asserting "reaches no schema module" would be
     * false, and satisfying it would mean refactoring the auth runtime to suit a test. What
     * actually matters is which function the gate calls, so that is what is pinned: the single
     * symbol it imports, and that symbol's env-only implementation.
     */
    const imported = [...gate.matchAll(/import\s*\{([^}]*)\}\s*from/g)].flatMap((m) =>
      m[1]!.split(",").map((s) => s.trim()).filter(Boolean),
    );
    assert.deepEqual(imported, ["getAuthEnvironment"], "the gate calls exactly one auth function");
    const authRuntime = codeOf(read("src/features/auth-runtime/request-session.server.ts"));
    assert.match(
      authRuntime,
      /export function getAuthEnvironment\(\): AuthenticationEnvironmentResolution \{\s*return resolveAuthenticationEnvironment\(process\.env\);/,
      "getAuthEnvironment resolves the environment only — no cookie, no session, no database",
    );
  }

  /* ── 10: no new route was added ──────────────────────────────────────────── */
  {
    const routes = files.filter((f) => f.startsWith("src/app/") && /\/(page|route)\.tsx?$/.test(f));
    assert.ok(!routes.some((r) => /mock-surface|gating/i.test(r)), "G2 introduces no route");
  }

  /* ── 11: no schema or migration change ───────────────────────────────────── */
  {
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const PHASE_BOUNDARY = "20260818172455_production_provenance_vocabulary.sql";
    const upToBoundary = migrations.filter((f) => f <= PHASE_BOUNDARY);
    assert.equal(upToBoundary.at(-1), PHASE_BOUNDARY, "the migration G2 inherited is intact");
    assert.equal(upToBoundary.length, 31, "no migration was inserted at or before G2's boundary");
    for (const file of migrations.filter((f) => f > PHASE_BOUNDARY)) {
      assert.ok(
        !/mock|gating|demo/i.test(file),
        `no migration bears this phase's name — found ${file}`,
      );
    }
  }

  console.log("G2 mock surface gating: all assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
