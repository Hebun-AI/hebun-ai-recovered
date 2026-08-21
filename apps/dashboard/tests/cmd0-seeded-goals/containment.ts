/*
 * CMD-0 — seeded strategic goals, contained.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 *
 * `/director/goals` reported `connected: true` over four compiled-in rows and described them as
 * "derived from the knowledge graph (Goal Registry)". The rows come from a literal array; the
 * store behind `goal-runtime` is the MEMORY adapter, whose entire content is `seed()`; no tenant
 * appears anywhere on the path. A real authenticated tenant was told their organization holds four
 * strategic goals, one of them archived.
 *
 * ── WHY THIS SUITE IS NOT A LIST OF FORBIDDEN FILENAMES ──────────────────────
 *
 * The released firewall banned `features/director/mock` and `features/intelligence/mock` BY IMPORT
 * PATH, and the seed walked past it because its file is called `records.ts`. A longer list of
 * names would fail the same way for the next innocent filename.
 *
 * So the load-bearing property here is an OUTCOME, measured by executing the real model:
 *
 *     WHILE A REAL TENANT IS REACHABLE, THE STRATEGIC GOALS SURFACE PRESENTS NO GOAL AT ALL.
 *
 * That sentence contains no path, no module name and no file. Rename `records.ts`, move it, route
 * it through three intermediate modules, or introduce a completely different seed — the rows still
 * arrive through the same projection and the same assertion still fails. Both are proved below by
 * injecting goal rows that never touch `records.ts`.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { getStrategicGoalsModel } from "../../src/features/command-goals/workspace-model";
import { GoalRuntimeService } from "../../src/features/goal-runtime";
import {
  getNodeSnapshot,
  knowledgeNodeAdapter,
  resetNodeStore,
} from "../../src/features/knowledge-crud/node-adapter";
import { runtimeProjectionRegistry } from "../../src/features/runtime-projection";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";

const ROOT = process.cwd();
const MODEL = "src/features/command-goals/workspace-model.ts";
const COMPONENT = "src/components/command-goals/strategic-goals.tsx";
const OWNED = [MODEL, COMPONENT] as const;

/** The released migration ledger, pinned so "no schema change" is a measurement. */
const LEDGER_COUNT = 32;
const LEDGER_DIGEST = "a54ab468e15c816f";
/** Every server-action module in the repository today. A new writer anywhere moves this. */
const USE_SERVER_MODULES = 9;

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * Run `body` with a real tenant reachable.
 *
 * `HEBUN_AUTH_ENABLED=true` makes the auth environment resolve to `configured` or `invalid`; the
 * G2 gate withholds for both, and for a resolution error too. Every branch that is not the
 * explicit pre-auth demo shell is a branch where a real tenant may be looking.
 */
function withRealTenantReachable<T>(body: () => T): T {
  const previous = process.env.HEBUN_AUTH_ENABLED;
  process.env.HEBUN_AUTH_ENABLED = "true";
  try {
    return body();
  } finally {
    if (previous === undefined) delete process.env.HEBUN_AUTH_ENABLED;
    else process.env.HEBUN_AUTH_ENABLED = previous;
  }
}

/** Force the goal projection to rebuild, so an injected row is actually observed. */
function invalidateGoalProjection(): void {
  runtimeProjectionRegistry.clear("goal-runtime");
  runtimeProjectionRegistry.refresh("goal-runtime");
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. NOT ONE SEEDED GOAL REACHES A REAL TENANT
 * ────────────────────────────────────────────────────────────────────────── */
function withheldFromARealTenant(): void {
  withRealTenantReachable(() => {
    const model = getStrategicGoalsModel();
    assert.equal(model.withheld, true, "the projection is withheld while a real tenant is reachable");
    assert.deepEqual(model.goals, [], "and it carries no goal — withheld, never a partial list");
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. WHAT THE DEMO SHELL SHOWS IS LABELLED SEEDED, NEVER DERIVED
 * ────────────────────────────────────────────────────────────────────────── */
function demoShellStaysTruthful(): void {
  const model = getStrategicGoalsModel();
  assert.equal(model.withheld, false, "the pre-auth demo shell still shows its seeded goals");
  assert.ok(model.goals.length > 0, "and the seed is still there to show — this gate deleted nothing");
  assert.equal(model.provenance, "seeded", "an in-memory store can only return the compiled-in seed");

  const claim = model.source.toLowerCase();
  assert.ok(claim.includes("seed"), "the stated source names the seed");
  for (const word of ["knowledge graph", "derived", "authoritative", "goal authority —"]) {
    assert.ok(!claim.includes(word), `the stated source must not claim "${word}"`);
  }

  /* And no member of the type may ever mean "this organization declared these". */
  const modelSource = codeOf(read(MODEL));
  assert.ok(
    !/GoalProvenance\s*=[^;]*"authoritative"/.test(modelSource),
    "no goal provenance member may mean authoritative",
  );

  /* The surface must render the seeded word, and must not badge a count as "derived". */
  const component = codeOf(read(COMPONENT));
  assert.ok(/seeded/i.test(component), "the surface says seeded");
  assert.ok(!/\bderived\b/i.test(component), "and never says derived");
  /*
   * And it does not lend a seeded row the knowledge-node status vocabulary. "VERIFIED" beside a
   * compiled-in goal reads as an authority's verdict on an organizational commitment.
   */
  assert.ok(
    /provenance !== "seeded" && goal\.status/.test(component),
    "a seeded row's status word is withheld — it would read as a verdict",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. THE ROWS REALLY ARE SEED ROWS — PROVED FROM THE DATA, NOT FROM A FILENAME
 * ────────────────────────────────────────────────────────────────────────── */
function theRowsCarrySeedProvenance(): void {
  const goalIds = new Set(GoalRuntimeService.listGoals().map((goal) => goal.id));
  assert.ok(goalIds.size > 0, "the seeded projection has rows to inspect");
  const nodes = getNodeSnapshot().filter((node) => goalIds.has(node.id));
  assert.equal(nodes.length, goalIds.size, "every listed goal traces to a store node");
  for (const node of nodes) {
    assert.equal(node.createdBy, "Seed", `${node.id} was created by the seeder`);
    assert.equal(node.updatedBy, "Seed", `${node.id} was last written by the seeder`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. CONTAINMENT IS INDEPENDENT OF WHERE A ROW CAME FROM
 *
 * Two injections that never touch `registries/records.ts`: one arriving with an innocent-looking
 * source string (the "renamed seed" case), one written straight through the adapter's public API
 * (the "intermediate module" case). Neither may reach a real tenant.
 * ────────────────────────────────────────────────────────────────────────── */
function anyOriginIsContained(): void {
  const original = getNodeSnapshot();
  const template = original.find((node) => node.nodeType === "Goal");
  assert.ok(template, "there is a goal node to model an injection on");

  const inject = (id: string, source: string): void => {
    knowledgeNodeAdapter.save([
      ...getNodeSnapshot(),
      { ...template!, id, slug: id, title: `Injected ${id}`, source, createdBy: "elsewhere", updatedBy: "elsewhere" },
    ]);
    invalidateGoalProjection();
  };

  try {
    /* 4a — the same seed, arriving from an innocently named place. */
    inject("goals:INJ-1", "company-data registry");
    assert.ok(
      getNodeSnapshot().some((n) => n.id === "goals:INJ-1"),
      "injection 4a applied — otherwise it would prove nothing",
    );
    /*
     * AND IT IS OBSERVABLE THROUGH THE PROJECTION. Without this the containment assertion below
     * would pass over a cached snapshot that never saw the injected row, and would be proving
     * that a stale cache is empty rather than that a new origin is contained.
     */
    assert.ok(
      getStrategicGoalsModel().goals.some((g) => g.id === "goals:INJ-1"),
      "the injected goal reaches the demo surface — the injection is observable, not cached away",
    );
    withRealTenantReachable(() => {
      const model = getStrategicGoalsModel();
      assert.deepEqual(model.goals, [], "a differently-named source is contained exactly the same");
      assert.equal(model.withheld, true, "and still reported as withheld");
    });

    /* 4b — written through the adapter directly, as an intermediate module would. */
    inject("goals:INJ-2", "an intermediate module");
    assert.ok(
      getNodeSnapshot().some((n) => n.id === "goals:INJ-2"),
      "injection 4b applied — otherwise it would prove nothing",
    );
    assert.ok(
      getStrategicGoalsModel().goals.some((g) => g.id === "goals:INJ-2"),
      "the second injection is observable through the projection too",
    );
    withRealTenantReachable(() => {
      assert.deepEqual(getStrategicGoalsModel().goals, [], "an indirect origin is contained too");
    });
  } finally {
    resetNodeStore();
    invalidateGoalProjection();
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. THIS GATE ESTABLISHED NO AUTHORITY
 * ────────────────────────────────────────────────────────────────────────── */
function noAuthorityWasCreated(overrides: Readonly<Record<string, string>> = {}): void {
  const FORBIDDEN = [
    /createRepository/,
    /knowledge-canonical-repository/,
    /knowledge-read-facade/,
    /canonical-repository/,
    /drizzle-orm/,
    /@\/db\//,
    /\.insert\(/,
    /\.update\(/,
    /\.delete\(/,
    /"use server"/,
  ];
  for (const file of OWNED) {
    const source = overrides[file] ?? read(file);
    for (const pattern of FORBIDDEN) {
      assert.ok(
        !pattern.test(source),
        `${file} must not contain ${pattern} — CMD-0 creates no authority, repository, or writer`,
      );
    }
    /* The single server module it may reach is the existing demo gate. */
    for (const match of codeOf(source).matchAll(/from\s+"([^"]*\.server)"/g)) {
      assert.equal(
        match[1],
        "@/features/mock-surface-gating/gate.server",
        `${file} may reach no server module other than the released demo gate`,
      );
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6. NOTHING ELSE MOVED — SCHEMA, WRITERS, COMMAND IA
 * ────────────────────────────────────────────────────────────────────────── */
function nothingElseMoved(): void {
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  assert.equal(migrations.length, LEDGER_COUNT, "no migration was added or removed");
  const digest = createHash("sha256")
    .update(migrations.map((f) => read(`src/db/migrations/${f}`)).join(""))
    .digest("hex")
    .slice(0, 16);
  assert.equal(digest, LEDGER_DIGEST, "and no released migration was edited");

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const writers = walk("src").filter((f) => read(f).includes('"use server"'));
  assert.equal(writers.length, USE_SERVER_MODULES, `no server-action module was added; found ${writers.join(", ")}`);

  /* Command's information architecture was CMD-A's subject, not this gate's — and CMD-B2's since.
   *
   * CMD-B2 removed Strategic Goals from the canonical menu while keeping `/director/goals` alive,
   * so the nav-membership form of this check had to go. It was always a PROXY for the property
   * CMD-0 actually owns: the goals surface still exists, still belongs to Command, and is still the
   * place the containment applies. That is now asserted directly, which is both truer and immune to
   * the next navigation phase.
   */
  assert.equal(WORKSPACES.length, 7, "still seven workspaces");
  const command = getWorkspace("command");
  assert.deepEqual(
    command.destinations.map((d) => d.label),
    ["Overview", "Decisions", "Director Intent"],
    "Command L2 is the CMD-B2 canonical three",
  );
  assert.ok(
    existsSync(path.join(ROOT, "src/app/(dashboard)/director/goals/page.tsx")),
    "the goals surface this gate contains still exists",
  );
  assert.equal(
    resolveActiveWorkspace("/director/goals"),
    "command",
    "and it still lives under Command, menu entry or not",
  );

  /* Canonical Knowledge owns its own surface and this gate did not go near it. */
  assert.ok(existsSync(path.join(ROOT, "src/app/(dashboard)/knowledge/page.tsx")), "Knowledge is where it was");
  assert.ok(
    statSync(path.join(ROOT, "src/features/knowledge-canonical-repository")).isDirectory(),
    "and the canonical repository is untouched by this gate",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * BITE-PROOFS
 * ────────────────────────────────────────────────────────────────────────── */
function mutate(source: string, from: string | RegExp, to: string): string {
  const after = source.replace(from, to);
  assert.notEqual(after, source, "bite-proof mutation did not APPLY — it would prove nothing");
  return after;
}

function bites(label: string, run: () => void): void {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert.ok(threw, `bite-proof "${label}" did not bite — the assertion does not guard it`);
}

/**
 * The behavioural guards (1–4) are proved by mutating the RUNTIME rather than a source string:
 * a text mutation of the model cannot be re-imported inside one process, and a bite-proof that
 * cannot execute the mutated code proves nothing about it.
 */
function biteProofs(): void {
  /* 1. Restore the released behaviour: no gate, and `connected` from row count. */
  bites("restore the released un-gated model over seed rows", () => {
    const released = () => {
      const goals = GoalRuntimeService.listGoals();
      return { goals, withheld: false, connected: goals.length > 0 };
    };
    withRealTenantReachable(() => {
      const model = released();
      assert.equal(model.connected, false, "the released model reported connected over a seed");
      assert.deepEqual(model.goals, [], "and handed the seeded goals to a real tenant");
    });
  });

  /* 2. Remove the real-tenant gate — present the projection unconditionally. */
  bites("remove the real-tenant gate", () => {
    const ungated = () => ({ goals: GoalRuntimeService.listGoals(), withheld: false });
    withRealTenantReachable(() => {
      const model = ungated();
      assert.equal(model.withheld, true, "withheld");
      assert.deepEqual(model.goals, [], "no goal reaches a real tenant");
    });
  });

  /* 3. Relabel the seed as derived from the knowledge graph. */
  bites("relabel the seeded source as derived", () => {
    const claim = "goal-runtime — derived from the knowledge graph (Goal Registry)".toLowerCase();
    assert.ok(claim.includes("seed"), "the stated source names the seed");
    for (const word of ["knowledge graph", "derived"]) {
      assert.ok(!claim.includes(word), `the stated source must not claim "${word}"`);
    }
  });

  /* 3b. Relabel through the type: add an "authoritative" provenance member. */
  bites("add an authoritative provenance member", () => {
    const mutated = mutate(
      read(MODEL),
      'export type GoalProvenance = "seeded" | "unverified";',
      'export type GoalProvenance = "seeded" | "unverified" | "authoritative";',
    );
    assert.ok(
      !/GoalProvenance\s*=[^;]*"authoritative"/.test(mutated),
      "no goal provenance member may mean authoritative",
    );
  });

  /* 3c. Let the surface badge its rows "derived" again. */
  bites("let the surface say derived again", () => {
    const mutated = codeOf(mutate(read(COMPONENT), "seeded</Badge>", "derived</Badge>"));
    assert.ok(!/\bderived\b/i.test(mutated), "and never says derived");
  });

  /* 6. Reach canonical Knowledge from the owned files. */
  bites("import the canonical Knowledge repository into the model", () =>
    noAuthorityWasCreated({
      [MODEL]: mutate(
        read(MODEL),
        'import { GoalRuntimeService',
        'import { x } from "@/features/knowledge-canonical-repository";\nimport { GoalRuntimeService',
      ),
    }),
  );

  /* 7. Introduce a repository/writer in the owned files. */
  bites("introduce a repository in the model", () =>
    noAuthorityWasCreated({
      [MODEL]: mutate(read(MODEL), "import { GoalRuntimeService", "import { createRepository } from \"@/features/persistence\";\nimport { GoalRuntimeService"),
    }),
  );
  bites("turn the surface into a server action", () =>
    noAuthorityWasCreated({ [COMPONENT]: mutate(read(COMPONENT), "import { Target }", '"use server";\nimport { Target }') }),
  );
  bites("reach a second server module from the model", () =>
    noAuthorityWasCreated({
      [MODEL]: mutate(
        read(MODEL),
        'import { organizationalDemoDataPermitted } from "@/features/mock-surface-gating/gate.server";',
        'import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";',
      ),
    }),
  );
}

function main(): void {
  withheldFromARealTenant();
  demoShellStaysTruthful();
  theRowsCarrySeedProvenance();
  anyOriginIsContained();
  noAuthorityWasCreated();
  nothingElseMoved();
  biteProofs();
  /* The containment survives everything above having run. */
  withheldFromARealTenant();
  demoShellStaysTruthful();
  console.log("CMD-0: seeded strategic goals are contained — all bite-proofs bit.");
}

main();
