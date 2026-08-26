/*
 * HEBY-CAP1 — THE CAPABILITY PROJECTION FIREWALL.
 *
 * The projection composes three released authorities and owns no capability state. This suite walks
 * the REAL import graph from its root, in comment-stripped code, and pins both directions: what it
 * MUST reach (so a later edit cannot quietly stop consulting an authority and start guessing) and
 * what it must NEVER reach.
 *
 * ── ONE PIN IS DELIBERATELY NOT MADE, AND SAYING SO IS THE POINT ─────────────
 *
 * `claude-http-transport.server.ts` IS reachable, because the model authority calls
 * `selectModelTransport` to learn which transport the configuration would select, and a selector
 * necessarily imports what it constructs. Asserting the transport is unreachable would be a false
 * pin, and the honest guarantee — that no CALL is made — is proved behaviourally in
 * `capability-truth.ts` §8 by resolving the whole view with a global fetch that throws.
 *
 * Nothing here runs a command, opens a database, or contacts anything.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PROJECTION = "src/features/heby-commands/command-capability-projection.server.ts";
const DISPATCH = "src/features/heby-commands/dispatch.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";
const HEBY_PAGE = "src/app/(dashboard)/heby/page.tsx";

const CAPABILITY_AUTHORITY = "src/features/integration-authority/capability-availability.server.ts";
const MODEL_AUTHORITY = "src/features/heby-provider-ops/provider-connectivity-projection.server.ts";

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

/** The transitive closure, following `import … from` AND `export … from`. */
function closure(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    let source: string;
    try {
      source = codeOf(read(file));
    } catch {
      continue;
    }
    for (const match of source.matchAll(/(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1]!, file);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

/**
 * Roots the capability projection may never reach.
 *
 * `knowledge/` and `provider-github/` are absent from this list ON PURPOSE and pinned separately
 * below: the projection legitimately reaches their pure `contracts.ts` for capability KEYS, and a
 * blanket directory ban would forbid the constant while permitting nothing useful. What is banned
 * there is the writer and the transport, by file.
 */
const FORBIDDEN_ROOTS: readonly string[] = [
  "src/features/knowledge-crud/",
  "src/features/knowledge-ratification/",
  "src/features/governance-decision/",
  "src/features/governance-audit/",
  "src/features/action-authorization/",
  "src/features/action-execution/",
  "src/features/action-execution-live/",
  "src/features/integration-credentials/",
  "src/features/heby-actions/",
  "src/features/heby-action-inlet/",
  /* The simulated subsystems. A capability answer may never be derived from seeded state. */
  "src/features/agent-runtime/",
  "src/features/workflow-runtime/",
  "src/features/orchestration/",
  "src/features/planning/",
  "src/features/task-planning/",
  "src/features/execution-engine/",
];

/** Individual modules banned by file, where the sibling directory is legitimately reachable. */
const FORBIDDEN_FILES: readonly string[] = [
  "src/features/integration-authority/integration-repository.server.ts",
  "src/features/auth-runtime/credential-repository.server.ts",
  "src/features/provider-github/github-transport.server.ts",
  "src/features/provider-google/google-transport.server.ts",
  "src/features/knowledge/external-reference-authority.server.ts",
];

function main(): void {
  const graph = closure(PROJECTION);
  const files = [...graph].sort();

  /* ── 1 · IT REACHES THE AUTHORITIES IT CLAIMS TO COMPOSE ─────────────────── */
  {
    assert.ok(
      graph.has(CAPABILITY_AUTHORITY),
      "the projection reaches the I1 normalized capability seam — it must ASK, never guess",
    );
    assert.ok(
      graph.has(MODEL_AUTHORITY),
      "and the released model dispatch classification",
    );
    assert.ok(graph.has(REGISTRY), "and the registry, for release vocabulary only");
  }

  /* ── 2 · IT REACHES NO FORBIDDEN ROOT ────────────────────────────────────── */
  {
    const violations: string[] = [];
    for (const root of FORBIDDEN_ROOTS) {
      const hits = files.filter((f) => f.startsWith(root));
      if (hits.length > 0) violations.push(`must not reach ${root} (${hits.sort().join(", ")})`);
    }
    for (const file of FORBIDDEN_FILES) {
      if (graph.has(file)) violations.push(`must not reach ${file}`);
    }
    assert.deepEqual(violations, [], violations.join(" · "));
  }

  /* ── 3 · NOTHING IN THE GRAPH WRITES ─────────────────────────────────────── */
  {
    const writers = files.filter((f) => performsDurableWrite(read(f)));
    assert.deepEqual(
      writers,
      [],
      `the capability projection's graph performs a durable write: ${writers.join(", ")}`,
    );
  }

  /* ── 4 · THE PROJECTION READS `availability` FROM AUTHORITIES, NOT PRESENCE ─ */
  {
    const source = codeOf(read(PROJECTION));
    assert.ok(
      source.includes("getCapabilityAvailability"),
      "the capability authority is called by name",
    );
    assert.ok(source.includes("readProviderOpsView"), "and so is the model authority");
    /*
     * `credential` is the field a reader is tempted by: `ProviderOpsView` carries
     * `credential: "present" | "missing"`, and presence is not authentication. The projection must
     * never consult it — bite M2 puts it back.
     */
    assert.ok(
      !/\bops\.credential\b/.test(source),
      "capability is never derived from credential presence",
    );
    assert.ok(
      !/\bops\.transport\b/.test(source),
      "nor from which transport would be selected — presence is not reachability",
    );
    assert.ok(
      !/process\.env|NODE_ENV/.test(source),
      "nor from the environment",
    );
    /*
     * NOR FROM UI PRESENCE. A command being in the palette is a presentation fact. The projection
     * imports no component and no palette, so "it is on screen" can never become "you may run it".
     */
    assert.ok(
      !/PALETTE|components\/|\.tsx/.test(source),
      "capability is never derived from UI presence",
    );
    /*
     * AND IT DOES NOT RE-DERIVE THE NORMALIZATION — which is how a SECOND capability authority gets
     * born. The rules that `unverified` is not `connected`, that health does not move the lifecycle,
     * and that a capability needs a covering scope subset live in the I1 seam and nowhere else. The
     * projection must translate that seam's answer, never recompute it from raw connection facts.
     */
    for (const rule of ["connectionState", "connection_state", ".scopes", "\"healthy\"", "lastVerifiedAt"]) {
      assert.ok(
        !source.includes(rule),
        `the projection must not re-derive capability from \`${rule}\` — that is the I1 seam's job`,
      );
    }
    /*
     * THE REGISTRY'S RELEASE-TIME FIELD MAY ONLY GATE, NEVER AFFIRM. It appears exactly once, in
     * the branch that keeps a NOT-available release statement — never as a source of `available`
     * for a runtime-governed command.
     */
    const availabilityReads = source.match(/command\.availability/g) ?? [];
    assert.equal(
      availabilityReads.length,
      1,
      "the registry's static availability is consulted exactly once, and only to keep a refusal",
    );
    assert.ok(
      /command\.availability !== "available"/.test(source),
      "and that single read is the NOT-available gate, not an affirmative",
    );
  }

  /* ── 5 · `/help` MAKES NO SERVER CALL AND NO PROVIDER CALL ───────────────── */
  {
    const registry = codeOf(read(REGISTRY));
    assert.ok(
      /id: "help", slash: "\/help"[\s\S]{0,200}kind: "local"/.test(registry),
      "/help is still a LOCAL command — it renders a value the server already composed",
    );

    const dispatch = codeOf(read(DISPATCH));
    assert.ok(
      dispatch.includes("helpLines(context.capabilityView)"),
      "/help renders the server-composed view",
    );
    /*
     * THE FALLBACK IS THE DEFECT — AND THE ASSERTION IS SCOPED TO THE RENDERER, NOT THE MODULE.
     *
     * A module-wide ban would be FALSE and would have deleted a released guarantee: the planner
     * still gates on `command.availability !== "available"` before dispatching, because a command
     * this repository never shipped runnable must be refused whatever any tenant authority says.
     * That check is correct and untouched. What may never read the release-time field again is the
     * `/help` RENDERING, so the assertion is taken against those two function bodies alone.
     *
     * The first draft of this suite banned it module-wide, failed on the planner's own correct
     * gate, and would have been "fixed" by weakening a released guarantee. It is recorded here so
     * the next reader scopes rather than relaxes.
     */
    const rendererStart = dispatch.indexOf("function capabilitySuffix");
    const rendererEnd = dispatch.indexOf("const HEBY_GO_TARGETS");
    assert.ok(rendererStart > 0 && rendererEnd > rendererStart, "the /help renderer is locatable");
    const renderer = dispatch.slice(rendererStart, rendererEnd);
    assert.ok(
      renderer.includes("helpLines"),
      "and the slice really contains both rendering functions",
    );
    /*
     * THE RELEASE FIELD MAY GATE, IT MAY NEVER AFFIRM — the same doctrine §4 pins in the projection.
     *
     * A blanket ban was tried and was WRONG in both directions: it failed on the planner's correct
     * pre-dispatch gate, and it would also have forbidden the renderer's honest no-view fallback,
     * where "this command did not ship runnable" and "this command is reserved" are RELEASE facts
     * that no tenant answer could change. What must never happen is the affirmative: the release
     * field concluding that a runtime-governed command is available. That is the original defect,
     * and it is what M1 puts back.
     */
    assert.ok(
      !/command\.availability\s*===\s*"available"/.test(renderer),
      "the /help renderer never reads the registry's release-time availability field to AFFIRM",
    );
    assert.ok(
      /command\.availability\s*!==\s*"available"/.test(renderer),
      "it may only consult that field to keep a release-time refusal",
    );
    /* With no resolved view, a runtime-governed command is UNKNOWN — never quietly available. */
    assert.ok(
      /reachesProvider === true \|\| command\.requiresModel === true/.test(renderer),
      "and with no resolved view it marks exactly the runtime-governed commands UNKNOWN",
    );
    assert.ok(
      /entry\.state/.test(renderer),
      "it renders the resolved runtime state instead",
    );
    /* Absence of a resolved answer renders UNKNOWN — never the static field, never available. */
    assert.ok(
      /UNKNOWN/.test(renderer),
      "and an unresolved view renders UNKNOWN rather than falling back",
    );
    /* The planner is pure: no server module, no authority, no I/O. */
    assert.ok(
      !/\.server["']/.test(dispatch),
      "and the pure planner imports no server module",
    );
  }

  /* ── 6 · THE TENANT COMES FROM THE SESSION AND NOWHERE ELSE ──────────────── */
  {
    const page = codeOf(read(HEBY_PAGE));
    assert.ok(
      page.includes("readCommandCapabilityView(await resolveTenantContext())"),
      "the page resolves the tenant from the session seam and passes it straight through",
    );
    /*
     * `resolveTenantContext()` TAKES NO ARGUMENT, so a caller-supplied tenant is unrepresentable
     * rather than merely rejected. The projection likewise accepts a TenantContext, never an id.
     */
    const projection = codeOf(read(PROJECTION));
    assert.ok(
      !/tenantId\s*:\s*string/.test(projection),
      "the projection accepts no tenant id parameter",
    );
    assert.ok(
      !/searchParams|params\./.test(projection),
      "and reads nothing from the request's query string",
    );
  }

  /* ── 7 · NO RESERVED COMMAND CAN BE AFFIRMED ─────────────────────────────── */
  {
    const source = codeOf(read(PROJECTION));
    const reservedBranch = source.indexOf('command.kind === "reserved"');
    assert.ok(reservedBranch > 0, "the reserved branch exists");
    const providerBranch = source.indexOf("command.reachesProvider === true");
    const modelBranch = source.indexOf("command.requiresModel === true");
    assert.ok(
      reservedBranch < providerBranch && reservedBranch < modelBranch,
      "and it is checked BEFORE any authority can answer, so reserved is terminal",
    );
  }

  console.log("hebycap1-flow/capability-firewall: OK");
}

main();
