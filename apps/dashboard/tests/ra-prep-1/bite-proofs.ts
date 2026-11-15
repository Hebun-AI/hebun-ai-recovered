/*
 * RA-PREP-1 — bite-proofs: each mutation removes ONE guard of the research preparation seam, and the
 * Postgres suite must fail for that guard's own reason.
 *
 *   B1 the reviser no longer refuses a research report                  (R2, RA-AUTH-1-HUMAN-REVISE-1)
 *   B2 research grounds on the workspace's sources                      (R1: the gate refuses the wider request)
 *   B3 the gateway declares assistance whatever the seam declared       (R1: a research grant is not assistance)
 *   B4 the preflight asks the assistance purpose                        (R3: assistance does not stand in)
 *   B5 the research data-use preflight is skipped                       (R3: refused before the model)
 *   B6 a reply carrying a link is filed                                 (R5)
 *   B7 the filing transaction no longer pins the dispatch's mandate revision (R8c)
 *   B9 the filing condition asks nothing and records nothing            (R1 provenance)
 *   B10 Governance authority is not asked again before filing           (R9a)
 *   B11 the writer ignores the filing condition                         (R1 provenance)
 *   B8 the general validator admits research-report                     (R2)
 *   B12 P6 D4 — a live deployment without an own key is not refused        (R10a)
 *   B13 P6-1 — the per-(work, agent) research lock is not honoured         (R9b)
 *   B14 P6-2 — research runs with no standing authorization in force        (R11c)
 *   B15 P6-2 — the filing transaction does not re-read the authorization    (R11g)
 *   B16 P6-2 — the writer does not ask for Governance authority             (R11a)
 *   B17 P6-2 — the lineage read is not tenant-scoped                        (R11e)
 *   B18 P6-2 — the scheduled gate ignores the research-schedule kill switch (R11i)
 *   B19 P6-3 — research is sourced without its own web-search decision       (R12b)
 *   B20 P6-3 — the generator asks the authority about an undeclared search   (W3)
 *   B21 P6-3 — the generator sends a search the decision did not authorize   (W3)
 *   B22 P6-3 — the live transport sends any search cap                       (W2)
 *   B23 P6-3 — a sourced report carrying a model-written link is composed    (W4)
 *   B24 P6-3 — a paused searching turn is filed                              (R12e)
 *
 * SOURCE-MUTATING: run only in a disposable copy of the tree, never in a worktree someone works in, and
 * never in parallel with another suite. Each file is restored byte-identically after its proof.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string): string => path.join(ROOT, f);
const read = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const WRITER = "src/features/work-artifacts/write-work-artifacts.server.ts";
const VALIDATION = "src/features/work-artifacts/validation.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const SEAM = "src/features/agent-work/assign-research-report.server.ts";
const PG_SUITE = "tests/ra-prep-1/research-preparation-postgres.ts";
const STANDING = "src/features/standing-research-authority/standing-research.server.ts";
const GENERATOR = "src/features/heby-model/heby-model-generation.server.ts";
const TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const COMPOSER = "src/features/agent-work/sourced-research-report.ts";
const WEB_SUITE = "tests/p6-3-web-research/web-research.ts";
const CHILD_TIMEOUT_MS = 300_000;

interface Run {
  readonly ok: boolean;
  readonly void: boolean;
  readonly output: string;
}

function runSuite(suite: string): Run {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  /* A kill leaves `signal` set and `status` null. Neither is an assertion result. */
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Edit {
  readonly find: string;
  readonly replace: string;
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly edits: readonly Edit[];
  /** A PRODUCT REASON CODE or an EXPLICIT assertion message — never a bare English word. */
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 the reviser no longer refuses a research report",
    file: WRITER,
    suite: PG_SUITE,
    edits: [{ find: '      if (!isWorkArtifactType(artifact.artifactType)) return refused("artifact-type-not-revisable");\n', replace: "" }],
    because: "RA-AUTH-1-HUMAN-REVISE-1",
  },
  {
    label: "B2 research grounds on the workspace's sources",
    file: ANSWER,
    suite: PG_SUITE,
    edits: [{ find: 'options.dataUsePurpose === "research" ? [] : workspaceSourceClasses(context)', replace: "workspaceSourceClasses(context)" }],
    because: "DATA_USE_NOT_AUTHORIZED",
  },
  {
    label: "B3 the gateway declares assistance whatever the seam declared",
    file: ANSWER,
    suite: PG_SUITE,
    edits: [{ find: 'purpose: options.dataUsePurpose ?? "assistance",', replace: 'purpose: "assistance",' }],
    because: "DATA_USE_NOT_AUTHORIZED",
  },
  {
    label: "B4 the preflight asks the assistance purpose",
    file: SEAM,
    suite: PG_SUITE,
    /* P6-3 — both preflight asks (sourced and unsourced) now go through one `ask`, which declares the purpose here. */
    edits: [{ find: "purpose: DATA_USE.purpose, dataClasses }", replace: 'purpose: "assistance" as const, dataClasses }' }],
    because: "assistance-only tenant",
  },
  {
    label: "B5 the research data-use preflight is skipped",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: '  if (decision?.disposition !== "authorized") return { status: "refused", reason: "research-data-use-not-authorized" };\n', replace: "" }],
    because: "research scope missing (nothing granted)",
  },
  {
    label: "B6 a reply carrying a link is filed",
    file: SEAM,
    suite: PG_SUITE,
    /* P6-3 — the unsourced link guard is now the `else` branch after the sourced composition. */
    edits: [{ find: "    } else if (LINK.test(content)) {", replace: "    } else if (false && LINK.test(content)) {" }],
    because: "R5: a reply carrying a link is not filed",
  },
  {
    label: "B7 the filing transaction no longer pins the dispatch's mandate revision",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: "      if (now.status !== \"known\" || now.mandate?.mandateId !== mandateRevision.mandateId) return false;\n", replace: "" }],
    because: "R8c: a report is filed only under the revision its dispatch rested on",
  },
  {
    label: "B9 the filing condition asks nothing and records nothing",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: "    async (tx, created) => {\n", replace: "    async (tx, created) => {\n      if (tx !== null) return Boolean(created);\n" }],
    because: "R1: exactly one filing row",
  },
  {
    label: "B10 Governance authority is not asked again before filing",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: "  if (!(await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant)).authorized) {", replace: "  if (tenant === null) {" }],
    because: "governance-authority-changed-while-preparing",
  },
  {
    label: "B11 the writer ignores the filing condition",
    file: WRITER,
    suite: PG_SUITE,
    edits: [{ find: "      if (filingCondition && !(await filingCondition(", replace: "      if (filingCondition && false && !(await filingCondition(" }],
    because: "R1: exactly one filing row",
  },
  {
    label: "B12 P6 D4 — a live deployment without an own key is not refused",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: '    if (credential.kind !== "tenant") return { status: "refused", reason: "research-requires-own-key" };', replace: '    if (credential.kind === "refused") return { status: "refused", reason: "research-requires-own-key" };' }],
    because: "live, no own key",
  },
  {
    label: "B13 P6-1 — the per-(work, agent) research lock is not honoured",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: "    if ((locked.rows[0] as { locked?: unknown } | undefined)?.locked !== true) {", replace: "    if (false && (locked.rows[0] as { locked?: unknown } | undefined)?.locked !== true) {" }],
    because: "research-in-progress",
  },
  {
    label: "B14 P6-2 — research runs with no standing authorization in force",
    file: STANDING,
    suite: PG_SUITE,
    edits: [{ find: '  if (!effective || effective.state !== "active") {\n    return refuse({ status: "refused", reason: "no-active-authorization" }', replace: '  if (!effective) {\n    return refuse({ status: "refused", reason: "no-active-authorization" }' }],
    because: "R11h withdrawn run",
  },
  {
    label: "B15 P6-2 — the filing transaction does not re-read the authorization",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: "        if (deps.standingAuthorizationHolds && !(await deps.standingAuthorizationHolds(tx))) {", replace: "        if (false && deps.standingAuthorizationHolds && !(await deps.standingAuthorizationHolds(tx))) {" }],
    because: "R11g",
  },
  {
    label: "B16 P6-2 — the writer does not ask for Governance authority",
    file: STANDING,
    suite: PG_SUITE,
    edits: [{ find: '  if (!authority.authorized) return refuse("not-the-governance-authority");', replace: "" }],
    because: "R11a",
  },
  {
    label: "B17 P6-2 — the lineage read is not tenant-scoped",
    file: STANDING,
    suite: PG_SUITE,
    edits: [{ find: "    .where(eq(standingResearchAuthorizations.tenantId, tenantId))\n", replace: "    .where(undefined)\n" }],
    because: "R11e",
  },
  {
    label: "B18 P6-2 — the scheduled gate ignores the research-schedule kill switch",
    file: STANDING,
    suite: PG_SUITE,
    edits: [{ find: '  if (on !== true) return { status: "refused", reason: "research-schedule-disabled" };', replace: "" }],
    because: "R11i",
  },
  {
    label: "B19 P6-3 — research is sourced without its own web-search decision",
    file: SEAM,
    suite: PG_SUITE,
    /* The seam stops asking web-search: the dispatch then declares a class no decision covered, and the generator refuses it. */
    edits: [
      { find: "  const sourcedDecision = await ask([...DATA_USE.dataClasses, DATA_USE.webSearchDataClass]);", replace: "  const sourcedDecision = await ask(DATA_USE.dataClasses);" },
      { find: " && sourcedDecision.authorizedDataClasses.includes(DATA_USE.webSearchDataClass);", replace: ";" },
    ],
    because: '"state":"DATA_USE_NOT_AUTHORIZED"',
  },
  {
    label: "B20 P6-3 — the generator asks the authority about an undeclared search",
    file: GENERATOR,
    suite: WEB_SUITE,
    edits: [{ find: "      request.webSearch &&\n      (!declaration?.dataClasses.includes(\"web-search\")", replace: "      false &&\n      (!declaration?.dataClasses.includes(\"web-search\")" }],
    because: "W3: refused before the data-use authority is asked",
  },
  {
    label: "B21 P6-3 — the generator sends a search the decision did not authorize",
    file: GENERATOR,
    suite: WEB_SUITE,
    edits: [{ find: "    if (request.webSearch && !decision.authorizedDataClasses.includes(\"web-search\")) {", replace: "    if (false) {" }],
    because: "W3: a decision that did not authorize web-search",
  },
  {
    label: "B22 P6-3 — the live transport sends any search cap",
    file: TRANSPORT,
    suite: WEB_SUITE,
    edits: [{ find: "        webSearch !== undefined &&\n        !(Number.isInteger(webSearch.maxUses)", replace: "        false &&\n        !(Number.isInteger(webSearch.maxUses)" }],
    because: "W2: cap 0 refused",
  },
  {
    label: "B23 P6-3 — a sourced report carrying a model-written link is composed",
    file: COMPOSER,
    suite: WEB_SUITE,
    edits: [{ find: "  if (LINK.test(modelText)) return { status: \"refused\", reason: \"link-in-output\" };", replace: "" }],
    because: "W4: a model-written link refuses",
  },
  {
    label: "B24 P6-3 — a paused searching turn is filed",
    file: SEAM,
    suite: PG_SUITE,
    edits: [{ find: "    if (answer.modelStopReason === \"pause_turn\") return notPrepared(\"research-incomplete\");", replace: "" }],
    because: "R12e",
  },
  {
    label: "B8 the general validator admits research-report",
    file: VALIDATION,
    suite: PG_SUITE,
    edits: [{ find: "  if (!isWorkArtifactType(input.artifactType)) {", replace: '  if (!isWorkArtifactType(input.artifactType) && input.artifactType !== "research-report") {' }],
    because: "R2: the general human writer refuses research-report",
  },
];

const voided: string[] = [];
let bitten = 0;

function withMutation(
  label: string,
  file: string,
  edits: readonly Edit[],
  body: () => void,
): void {
  const original = read(file);
  const before = sha(original);

  /* EVERY ANCHOR MUST BE UNIQUE. `replace` takes the first match; two matches is a different proof. */
  let mutated = original;
  for (const edit of edits) {
    const occurrences = mutated.split(edit.find).length - 1;
    assert.equal(
      occurrences,
      1,
      `${label}: the mutation anchor must appear exactly once in ${file}, found ${occurrences} — ` +
        `a non-unique anchor mutates a line the proof did not choose`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }

  try {
    writeFileSync(abs(file), mutated, "utf8");
    assert.notEqual(
      sha(read(file)),
      before,
      `${label}: the mutation did not reach ${file} — the proof would be vacuous`,
    );
    /* EVERY edit landed, by exact content — a partial application is a different proof. */
    assert.equal(
      read(file),
      mutated,
      `${label}: ${file} on disk is not the text this proof composed — the mutation is partial`,
    );
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: ${file} was not restored byte-identically`);
  }
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.label, mutation.file, mutation.edits, () => {
      const run = runSuite(mutation.suite);
      if (run.void) {
        voided.push(mutation.label);
        return;
      }
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
      assert.ok(
        run.output.includes(mutation.because),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.because}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    if (!voided.includes(mutation.label)) {
      bitten += 1;
      console.log(`BITE ${mutation.label}`);
    }
  }

  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`ra-prep-1/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
