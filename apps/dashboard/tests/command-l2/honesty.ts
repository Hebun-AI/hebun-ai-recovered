import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCommandInboxModel } from "../../src/features/command-attention/workspace-model";
import { getCommandBriefingsModel } from "../../src/features/command-briefings/workspace-model";
import { getOrganizationOperatingStateModel } from "../../src/features/command-operating-state/workspace-model";
import { getCommandReportsModel } from "../../src/features/command-reports/workspace-model";
import { getStrategicGoalsModel } from "../../src/features/command-goals/workspace-model";
import { getDirectorIntentModel } from "../../src/features/director-intent/workspace-model";
import { EXECUTABLE_ACTION_KINDS } from "../../src/features/heby-actions/action-registry";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { HEBY_AUTHORITY_DESCRIPTORS } from "../../src/features/heby-integration/contracts";

/*
 * Hebun UI Phase 20B — Command L2 honesty contract.
 *
 * Every retained Command surface must be honesty-compliant: no `director/mock` business data,
 * no fabricated score/percentage/count, no aggregate organization score, no Approve/Reject in
 * Command, no execution/shell/terminal, and Heby remains advisory.
 */

const hasDigit = (o: unknown): boolean => /\d/.test(JSON.stringify(o));

/* ── Retained Command surface source files ─────────────────────── */
const PAGES = [
  "src/app/(dashboard)/command/inbox/page.tsx",
  "src/app/(dashboard)/command/briefings/page.tsx",
  "src/app/(dashboard)/command/intent/page.tsx",
  "src/app/(dashboard)/director/goals/page.tsx",
  "src/app/(dashboard)/director/organization-health/page.tsx",
  "src/app/(dashboard)/director/reports/page.tsx",
];
const COMPONENTS = [
  "src/components/command-inbox/command-inbox.tsx",
  "src/components/command-briefings/command-briefings.tsx",
  "src/components/command-operating-state/organization-health.tsx",
  "src/components/command-reports/command-reports.tsx",
  "src/components/command-goals/strategic-goals.tsx",
  "src/components/director-intent/director-intent.tsx",
];
const MODELS = [
  "src/features/command-attention/workspace-model.ts",
  "src/features/command-briefings/workspace-model.ts",
  "src/features/command-operating-state/workspace-model.ts",
  "src/features/command-reports/workspace-model.ts",
  "src/features/command-goals/workspace-model.ts",
  "src/features/director-intent/workspace-model.ts",
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/* ── No synthetic mock business data on any retained Command surface ──
 * Matches real `import ... from "…/mock"` statements, not honesty comments that name
 * the retired mocks. */
function noMockImports(): void {
  const importsModule = (src: string, mod: string): boolean =>
    new RegExp(`from\\s+["'][^"']*${mod}["']`).test(src);
  for (const path of [...PAGES, ...COMPONENTS, ...MODELS]) {
    const src = read(path);
    assert.ok(!importsModule(src, "features/director/mock"), `${path} must not import director/mock`);
    assert.ok(!importsModule(src, "features/intelligence/mock"), `${path} must not import intelligence/mock`);
  }
}

/* ── Inbox: empty queue, every attention source not connected, no fabricated count ── */
function inboxHonest(): void {
  const m = getCommandInboxModel();
  assert.deepEqual(m.items, [], "no fabricated inbox items");
  assert.equal(m.sourcesConnected, false, "no attention source connected");
  assert.ok(m.kinds.length > 0 && m.kinds.every((k) => k.connected === false), "every attention kind not connected");
  assert.equal(hasDigit(m), false, "no fabricated count/timestamp in the inbox model");
}

/* ── Briefings: no instance, runtime not connected, no fabricated summary ── */
function briefingsHonest(): void {
  const m = getCommandBriefingsModel();
  assert.deepEqual(m.briefings, [], "no fabricated briefing");
  assert.equal(m.runtimeConnected, false, "briefing runtime not connected");
  assert.ok(m.contract.dependencies.every((d) => d.connected === false), "briefing inputs not connected");
  assert.equal(hasDigit(m), false, "no fabricated figure/timestamp in the briefings model");
}

/* ── Organization Health: no percentage, no aggregate score, unknown ≠ unhealthy ── */
function organizationHealthHonest(): void {
  const m = getOrganizationOperatingStateModel();
  assert.equal(m.aggregateScore, null, "no aggregate organization score");
  assert.equal(m.connected, false, "no domain operating-state source connected");
  assert.ok(m.domains.length > 0, "domains present");
  for (const d of m.domains) {
    assert.ok(d.state === "not-connected" || d.state === "unknown", `${d.domain} state is honest, not "Healthy"`);
  }
  assert.equal(hasDigit(m), false, "no percentage or numeric score anywhere in the health model");

  // The UI renders a gauge for nothing and imports no fake-health source.
  const src = read("src/components/command-operating-state/organization-health.tsx");
  assert.ok(!src.includes("HealthGauge"), "Organization Health renders no HealthGauge");
  assert.ok(!/from\s+["'][^"']*gauge/i.test(src), "Organization Health imports no gauge component");
  assert.ok(!/from\s+["'][^"']*director\/mock/.test(src), "Organization Health imports no mock");
}

/* ── Reports: no instance, no engine, export unavailable ── */
function reportsHonest(): void {
  const m = getCommandReportsModel();
  assert.deepEqual(m.reports, [], "no fabricated report");
  assert.equal(m.reportingConnected, false, "no report source connected");
  assert.equal(m.exportAvailable, false, "export honestly unavailable");
  assert.equal(hasDigit(m), false, "no fabricated period/timestamp in the reports model");
}

/* ── Strategic Goals: a compiled-in seed, contained ──
 *
 * CMD-0 REPAIR. This asserted `connected === goals.length > 0`, which was satisfied by the four
 * seeded registry rows and therefore protected nothing: the surface reported `connected: true` to
 * a real authenticated tenant over data that never left a compiled-in literal. `connected` no
 * longer exists, and what replaces it is strictly stronger — the projection is WITHHELD wherever a
 * real tenant is reachable, and what the demo shell shows is labelled seeded, never derived.
 */
function goalsHonest(): void {
  const m = getStrategicGoalsModel();
  assert.ok(Array.isArray(m.goals), "goals is a real list");
  assert.equal(m.provenance, "seeded", "the in-memory store can only return the compiled-in seed");
  assert.ok(m.source.includes("seed"), "the source names the seed");
  for (const word of ["knowledge graph", "derived", "authoritative", "authority for"]) {
    assert.ok(
      !m.source.toLowerCase().includes(word),
      `the goal source must not claim "${word}" — it is a compiled-in registry seed`,
    );
  }

  /* A real tenant is reachable -> nothing is presented at all. */
  const previous = process.env.HEBUN_AUTH_ENABLED;
  process.env.HEBUN_AUTH_ENABLED = "true";
  try {
    const guarded = getStrategicGoalsModel();
    assert.equal(guarded.withheld, true, "the projection is withheld when a real tenant is reachable");
    assert.deepEqual(guarded.goals, [], "and not one seeded goal reaches a real tenant");
  } finally {
    if (previous === undefined) delete process.env.HEBUN_AUTH_ENABLED;
    else process.env.HEBUN_AUTH_ENABLED = previous;
  }
}

/* ── Director Intent: preparation only, no execution, no live model, no "authorized" state ── */
function directorIntentHonest(): void {
  const m = getDirectorIntentModel();
  assert.equal(m.liveModelConnected, false, "no language model connected");
  /*
   * R3B REPAIR. This asserted `executionConnected === false`, which was true until an execution
   * runtime shipped. The value is now DERIVED from the registry, and what still protects the
   * reader is the NARROWER pair of claims: a substrate exists for exactly ONE action kind, and
   * free text still cannot reach it.
   */
  assert.equal(m.executionConnected, true, "one execution substrate is connected");
  /*
   * GIA-1 authorized a SECOND executable kind, so the derived count moved from one to two. The
   * protection is unchanged and is the pair around it: the number is DERIVED from the registry
   * rather than asserted, and free text still cannot reach any of it.
   */
  assert.equal(m.connectedMutationCount, 2, "exactly the two authorized kinds — never a third");
  assert.equal(m.freeTextToExecution, false, "free text is never routed to raw execution");

  // No mutation/device tool is invokable; the invokable set is read-only only.
  for (const a of m.actions) {
    const isMutationOrDevice =
      a.sideEffect === "REVERSIBLE_MUTATION" ||
      a.sideEffect === "CONSEQUENTIAL_MUTATION" ||
      a.sideEffect === "DEVICE_ACTION";
    /*
     * R3B connected one mutation substrate; GIA-1 connected the second. The assertion is narrowed
     * to the CLOSED EXECUTABLE SET rather than to a name, so every other mutation and device tool
     * must still declare `false` — which is the protection this loop was written for — and a third
     * connected kind fails here without anyone remembering to add it.
     */
    if (isMutationOrDevice && !(EXECUTABLE_ACTION_KINDS as readonly string[]).includes(a.actionKind)) {
      assert.equal(a.substrateConnected, false, `${a.actionKind} mutation must not be connected`);
    }
  }
  const invokable = m.actions.filter((a) => a.sideEffect === "READ_ONLY" && a.substrateConnected);
  assert.equal(m.invokableCount, invokable.length, "invokable count matches read-only connected tools");

  // There is no state the system can produce that means "authorized".
  assert.ok(
    !m.lifecycle.some((s) => /authorized/i.test(s.state) || /authorized/i.test(s.label)),
    "no 'authorized' lifecycle state exists",
  );

  // A presentational surface: it imports no execution/process/filesystem substrate.
  const src = read("src/components/director-intent/director-intent.tsx");
  assert.ok(
    !/from\s+["'][^"']*(child_process|node:|fs["']|shelljs)/.test(src),
    "Director Intent imports no process/filesystem/shell substrate",
  );
  assert.ok(!/\beval\s*\(/.test(src), "Director Intent uses no eval");
}

/* ── No Approve / Reject / Authorize affordance anywhere in Command ── */
function noAuthorityActsInCommand(): void {
  for (const path of COMPONENTS) {
    const src = read(path);
    assert.ok(!/\b(Approve|Reject|Authorize)\b/.test(src), `${path} must expose no Approve/Reject/Authorize control`);
  }
}

/* ── Heby remains advisory across Command and Decisions ── */
function hebyAdvisory(): void {
  assert.equal(getHebyWorkspaceProfile("command").authority, "advisory-only", "Command Heby is advisory-only");
  assert.equal(getHebyWorkspaceProfile("decisions").authority, "human-review-required", "Decisions Heby needs human review");
  for (const mode of ["advisory-only", "human-review-required", "restricted"] as const) {
    assert.equal(HEBY_AUTHORITY_DESCRIPTORS[mode].hebyMayAct, false, `Heby may not act in ${mode}`);
  }
}

function main(): void {
  noMockImports();
  inboxHonest();
  briefingsHonest();
  organizationHealthHonest();
  reportsHonest();
  goalsHonest();
  directorIntentHonest();
  noAuthorityActsInCommand();
  hebyAdvisory();
  console.log("command L2 honesty contract checks passed");
}

main();
