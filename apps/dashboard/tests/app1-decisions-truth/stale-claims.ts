/*
 * APP-1 — the Decisions surface stops denying the queue it renders.
 *
 * ── WHAT WAS STILL WRONG AFTER APP-0 ─────────────────────────────────────────
 *
 * APP-0 removed the "Decision Act" denial. Two sibling claims survived it, both visible on the
 * authenticated surface above a connected queue:
 *
 *   decision-state-strip.tsx   "Decision queue · No source connected"
 *   pending-decisions.tsx      "No decision-request source is connected to this surface."
 *
 * and one invisible third: `decisionRecordingConnected: false` in the legacy model, a hard-coded
 * denial of the decision act with ZERO consumers — dead, but the same stale-literal shape R3B has
 * already had to repair twice elsewhere.
 *
 * ── WHY THESE GUARDS READ SOURCE, NOT MARKUP ─────────────────────────────────
 *
 * APP-0's guards render the regions, because `ActionAuthorizations` renders in a bare Node
 * harness. These two do not: both reach `next/link` or the client Heby affordance, which need
 * routing context that does not exist outside Next, so `renderToStaticMarkup` throws before it can
 * produce a sentence to assert on. Rendering them is not available, and pretending otherwise would
 * mean asserting against a stub instead of the component.
 *
 * So they are asserted at source WITH COMMENTS STRIPPED — the instrument the released
 * `director-truth-surface` suite already uses on this exact directory, and for the same reason it
 * gives: these files DISCUSS the sentences they no longer render, at length, to explain why. A
 * guard that tripped on that prose would punish the documentation that makes the repair legible.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { getDecisionWorkspaceModel } from "../../src/features/decisions/workspace-model";

const ROOT = process.cwd();
const SURFACE_DIR = "src/components/decision-workspace";
const MODEL = "src/features/decisions/workspace-model.ts";
const STRIP = `${SURFACE_DIR}/decision-state-strip.tsx`;
const PENDING = `${SURFACE_DIR}/pending-decisions.tsx`;
const ROUTE = "src/app/(dashboard)/approvals/page.tsx";

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
/** Comment-stripped, so explanatory prose about a retired sentence is not the sentence. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const surfaceFiles = (): string[] =>
  readdirSync(path.join(ROOT, SURFACE_DIR))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => `${SURFACE_DIR}/${f}`);

/* ─────────────────────────────────────────────────────────────────────────────
 * 1 + 2. NO RENDERED SENTENCE DENIES THE CONNECTED QUEUE
 * ────────────────────────────────────────────────────────────────────────── */
const DENIALS = [
  "No source connected",
  "No decision-request source is connected to this surface",
] as const;

function nothingDeniesTheQueue(overrides: Readonly<Record<string, string>> = {}): void {
  for (const file of surfaceFiles()) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const denial of DENIALS) {
      assert.ok(
        !code.includes(denial),
        `${path.basename(file)} renders "${denial}" — consequential action requests ARE connected on this surface`,
      );
    }
  }

  /*
   * AND THE NARROWED SENTENCE MUST STILL SAY WHICH IS WHICH. Deleting the denial without naming
   * the connected class would leave a reader with no account of what this region is missing.
   */
  const pending = codeOf(overrides[PENDING] ?? read(PENDING));
  assert.ok(
    /Consequential action requests ARE connected and appear above/.test(pending),
    "the pending region names the class that IS connected",
  );
  assert.ok(
    /prepared review and approval material/.test(pending),
    "and names the class that is not",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. THE MODEL CARRIES NO CONNECTION FLAG, AND NO DEAD QUEUE
 * ────────────────────────────────────────────────────────────────────────── */
const RETIRED_FIELDS = ["pendingDecisions", "decisionRecordingConnected"] as const;

function theModelClaimsNoConnection(overrides: Readonly<Record<string, string>> = {}): void {
  const model = getDecisionWorkspaceModel();
  for (const field of RETIRED_FIELDS) {
    assert.ok(!(field in model), `the model must not carry "${field}" — it denied a connected seam`);
  }

  const source = codeOf(overrides[MODEL] ?? read(MODEL));
  for (const field of RETIRED_FIELDS) {
    assert.ok(!source.includes(field), `${MODEL} must not declare "${field}"`);
  }

  /* What survives is vocabulary, and every survivor has a real consumer. */
  assert.deepEqual(
    Object.keys(model).sort(),
    ["authorityChain", "decisionStates", "history", "inspectorLenses", "preparationKinds"],
    "the model is contract vocabulary only",
  );
  assert.ok(model.preparationKinds.length > 0, "preparation kinds are real contract descriptors");
  assert.ok(model.authorityChain.length > 0, "the authority chain is real contract structure");
  assert.ok(model.inspectorLenses.length > 0, "the inspector lenses are real");

  /*
   * NO BOOLEAN MAY BE REINTRODUCED UNDER ANOTHER NAME. A field whose name says "connected" and
   * whose value is a literal is the defect, whatever it is called.
   */
  assert.ok(
    !/readonly\s+\w*[Cc]onnected\w*\s*:\s*(false|true)\b/.test(source),
    "no literal connection flag may be declared in this model",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. EMPTY IS NOT UNAVAILABLE — STILL DECIDED BY THE ROUTE, FROM BOTH READS
 * ────────────────────────────────────────────────────────────────────────── */
function emptyIsNotUnavailable(): void {
  const route = codeOf(read(ROUTE));
  assert.ok(
    /connected\s*=\s*requests\.status === "read" && permits\.status === "read"/.test(route),
    "connected means both durable reads answered — not that rows exist",
  );
  const authorizations = codeOf(read(`${SURFACE_DIR}/action-authorizations.tsx`));
  assert.ok(
    /connected \? `\$\{requests\.length\} pending` : "Not connected"/.test(authorizations),
    "the badge reports the count it read, or says it did not read",
  );
  assert.ok(
    /Authorization persistence is not configured/.test(authorizations),
    "an unavailable read explains itself rather than rendering an empty queue",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 5. READING IS NOT APPROVING
 * ────────────────────────────────────────────────────────────────────────── */
function readingIsNotApproving(overrides: Readonly<Record<string, string>> = {}): void {
  const reader = codeOf(read("src/features/action-authorization/read-action-authorizations.server.ts"));
  assert.ok(!/resolveGovernanceAuthority\s*\(/.test(reader), "the reader resolves no authority");

  const decide = codeOf(read("src/features/action-authorization/decide-action-request.server.ts"));
  for (const fn of ["approveActionRequest", "rejectActionRequest"]) {
    const at = decide.indexOf(`export async function ${fn}`);
    assert.ok(at > 0, `${fn} exists`);
    const next = decide.indexOf("\nexport ", at + 1);
    const body = decide.slice(at, next === -1 ? undefined : next);
    assert.ok(/resolveGovernanceAuthority\(/.test(body), `${fn} resolves Governance authority`);
    assert.ok(/not-the-governance-authority/.test(body), `${fn} refuses when it is not the authority`);
  }

  /* No surface file may say that being able to read confers the authority to act. */
  for (const file of surfaceFiles()) {
    const code = codeOf(overrides[file] ?? read(file)).toLowerCase();
    for (const claim of ["you may approve", "you can approve", "you are authorized to approve"]) {
      assert.ok(!code.includes(claim), `${path.basename(file)} must not imply "${claim}"`);
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 6 + 7. A PERMIT IS NOT AN EXECUTION; AN EXECUTION IS NOT A SUCCESS
 * ────────────────────────────────────────────────────────────────────────── */
function permitIsNotExecution(overrides: Readonly<Record<string, string>> = {}): void {
  /*
   * The permit STATE MACHINE is proved at runtime by APP-0, which already exercises
   * `derivePermitState` across all four states. Importing it here as well would pull the schema
   * barrel in a different module order and trips a real circular initialisation in
   * `db/schema/_base.ts` — a fragility that has nothing to do with this gate's claim. What APP-1
   * owns is narrower and is a property of the SURFACE: the words it may use about a permit.
   */
  const file = `${SURFACE_DIR}/action-authorizations.tsx`;
  const code = codeOf(overrides[file] ?? read(file));
  assert.ok(/Accepted is not delivered/.test(code), "acceptance is stated as acceptance");
  assert.ok(
    /A permit exists only once a Governance decision authorized one/.test(code),
    "a permit is stated as an authorization, never as an act that happened",
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 8 + 9 + 10. ONE READER, NO WRITER IN PRESENTATION, COMMAND UNTOUCHED
 * ────────────────────────────────────────────────────────────────────────── */
const SEAM_READERS = ["readPendingActionRequests", "readActionPermits"] as const;

/**
 * Exactly the routes that own a read, plus the module that defines them.
 *
 * CMD-B1 ADDED THE THIRD ROUTE, AND THE PROPERTY IS UNCHANGED. This pin has never meant "only two
 * surfaces may read"; it means ONE READER PER SURFACE and no second copy of the queue. `/command`
 * now consumes the same seam the same way `/heby` does — tenant resolved once at its own route
 * boundary, seam taken unchanged, nothing persisted — which is the architecture CMD-A chose over
 * building a Command-side summary projection. What the pin still forbids is what it always forbade:
 * a component, model or feature module acquiring its own reader.
 */
const PERMITTED_SEAM_IMPORTERS = [
  "src/app/(dashboard)/approvals/page.tsx",
  "src/app/(dashboard)/heby/page.tsx",
  "src/app/(dashboard)/command/page.tsx",
  "src/features/action-authorization/read-action-authorizations.server.ts",
] as const;

function noSecondReader(overrides: Readonly<Record<string, string>> = {}): void {
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const importers = walk("src").filter((file) => {
    const code = codeOf(overrides[file] ?? read(file));
    return SEAM_READERS.some((fn) => code.includes(fn));
  });
  assert.deepEqual(
    importers.sort(),
    [...PERMITTED_SEAM_IMPORTERS].sort(),
    "the action-authorization seam has exactly one reader per surface — no duplicate queue",
  );
}

const FORBIDDEN_IN_PRESENTATION = [
  /"use server"/,
  /drizzle-orm/,
  /@\/db\//,
  /createRepository/,
  /\.insert\(/,
  /resolveGovernanceAuthority/,
  /resolveTenantContext/,
] as const;

function presentationAndModelHoldNoAuthority(overrides: Readonly<Record<string, string>> = {}): void {
  for (const file of [...surfaceFiles(), MODEL]) {
    const code = codeOf(overrides[file] ?? read(file));
    for (const pattern of FORBIDDEN_IN_PRESENTATION) {
      assert.ok(!pattern.test(code), `${path.basename(file)} must not contain ${pattern}`);
    }
    assert.ok(
      !/from\s+"@\/features\/command-|from\s+"@\/components\/command-(?!center\/heby-why)/.test(code),
      `${path.basename(file)} must not import a Command model or surface`,
    );
  }
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

function biteProofs(): void {
  bites("restore the state strip's 'No source connected'", () =>
    nothingDeniesTheQueue({
      [STRIP]: mutate(read(STRIP), 'Admissible state:', 'No source connected — Admissible state:'),
    }),
  );

  bites("restore 'No decision-request source is connected to this surface'", () =>
    nothingDeniesTheQueue({
      [PENDING]: mutate(
        read(PENDING),
        "Consequential action requests ARE connected and appear above",
        "No decision-request source is connected to this surface",
      ),
    }),
  );

  bites("drop the narrowed sentence entirely", () =>
    nothingDeniesTheQueue({
      [PENDING]: mutate(read(PENDING), "Consequential action requests ARE connected and appear above", "Nothing here"),
    }),
  );

  bites("re-declare decisionRecordingConnected in the model", () =>
    theModelClaimsNoConnection({
      [MODEL]: mutate(read(MODEL), "  readonly history: readonly never[];", "  readonly decisionRecordingConnected: false;\n  readonly history: readonly never[];"),
    }),
  );

  bites("re-declare the dead pendingDecisions queue", () =>
    theModelClaimsNoConnection({
      [MODEL]: mutate(read(MODEL), "  readonly history: readonly never[];", "  readonly pendingDecisions: readonly never[];\n  readonly history: readonly never[];"),
    }),
  );

  bites("smuggle the flag back under another name", () =>
    theModelClaimsNoConnection({
      [MODEL]: mutate(read(MODEL), "  readonly history: readonly never[];", "  readonly queueConnected: false;\n  readonly history: readonly never[];"),
    }),
  );

  /*
   * A COMMENT WOULD NOT HAVE BITTEN, AND THAT IS CORRECT. The first version of this mutation
   * appended `// readPendingActionRequests`, which `codeOf` strips before the guard ever sees it —
   * so the proof failed while the guard was working exactly as intended. The mutation has to be
   * real CODE, because a second reader is a second import, not a second mention.
   */
  bites("introduce a second pending-request reader in the legacy model", () =>
    noSecondReader({
      [MODEL]: mutate(
        read(MODEL),
        "export function getDecisionWorkspaceModel",
        'import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";\n\nexport function getDecisionWorkspaceModel',
      ),
    }),
  );

  bites("imply read permission is approval permission", () =>
    readingIsNotApproving({ [PENDING]: mutate(read(PENDING), "always awaits the Director", "you may approve it") }),
  );

  bites("describe a permit as an execution that happened", () =>
    permitIsNotExecution({
      [`${SURFACE_DIR}/action-authorizations.tsx`]: mutate(
        read(`${SURFACE_DIR}/action-authorizations.tsx`),
        "Accepted is not delivered",
        "Accepted means delivered",
      ),
    }),
  );

  bites("import Command into the Decisions model", () =>
    presentationAndModelHoldNoAuthority({
      [MODEL]: mutate(read(MODEL), "import {", 'import { getStrategicGoalsModel } from "@/features/command-goals/workspace-model";\nimport {'),
    }),
  );

  bites("resolve the tenant inside a presentation component", () =>
    presentationAndModelHoldNoAuthority({
      [STRIP]: mutate(read(STRIP), "import { StructuralMarker }", 'import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";\nimport { StructuralMarker }'),
    }),
  );
}

function main(): void {
  nothingDeniesTheQueue();
  theModelClaimsNoConnection();
  emptyIsNotUnavailable();
  readingIsNotApproving();
  permitIsNotExecution();
  noSecondReader();
  presentationAndModelHoldNoAuthority();
  biteProofs();
  console.log("APP-1: the Decisions surface no longer denies the queue it renders — all bite-proofs bit.");
}

main();
