/*
 * PHASE A — DEVELOPMENT CONTINUITY. Checks docs/MASTER-ROADMAP.md §16.1 against the repository.
 *
 * ── WHAT THIS TEST CAN AND CANNOT SEE ────────────────────────────────────────
 *
 * It sees files. It checks that every closure record carrying the §16.1 contract has every field, that
 * its reached state is one of the six, that the evidence it declares matches the state it claims (in
 * both directions), that §21 points at it with the same state, and that every deferred risk resolves
 * through §22 to a detail record that names it with the same disposition.
 *
 * It cannot see whether evidence is TRUE. A record that invents a deployment id passes. That judgement
 * is the Director's, and §16.1 says so. It also cannot run itself: there is no CI, so it runs only when
 * the test runner runs.
 *
 * ── THE LEGACY BOUNDARY ──────────────────────────────────────────────────────
 *
 * The 164 closure records written before §16.1 are legacy evidence and are never retrofitted. They are
 * pinned as a census — a count and a SHA-256 of their sorted repository paths — not as a list and not
 * as a git boundary. Git was rejected: shallow clones, worktrees and detached HEADs all change what
 * history is visible, and a check that depends on that would fail open. The census needs no git and
 * fails closed: a NEW `*-closure.md` without the contract changes it, and so does deleting or renaming
 * a legacy record (§18 rule 3). Adopting the contract on a legacy record is a deliberate act that must
 * update the census in the same change.
 *
 * The second half of this file builds disposable fixture repositories and proves each check BITES:
 * every defect must be rejected with its own code, and every valid shape must pass.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

/**
 * Legacy census at the moment §16.1 was introduced (Phase A, base 7437280e). Never edited to make a failure
 * pass. It changes only through the §16.1 legacy-maintenance procedure: `record` names the contract closure
 * record that carries the new values verbatim, so every change has an approved, reviewable owner.
 */
const LEGACY_CENSUS: Census = {
  count: 164,
  sha256: "754f7b397a6594b4e65f4a500373016db9dbe859e7c245e1cb97432f10d7d48b",
  record: "docs/product-vision/runtime/hebun-phase-a-development-continuity-closure.md",
};

const MARKER = /^## Closure Contract \(v1\)[ \t]*$/m;
const STATES = ["DESIGN ONLY", "IMPLEMENTED", "VERIFIED", "RELEASED", "DEPLOYED", "PRODUCTION-ACCEPTED"] as const;
const DISPOSITIONS = ["DEFERRED", "BLOCKED", "CLOSED"] as const;
const FIELDS = [
  "Phase",
  "Owner",
  "Reached state",
  "Implementation commit",
  "Verification level",
  "Verification evidence",
  "Test environment",
  "Deployment evidence",
  "Production acceptance evidence",
  "Deferred risks",
  "Director approvals",
] as const;
type Field = (typeof FIELDS)[number];

const rank = (state: string): number => STATES.indexOf(state as (typeof STATES)[number]);
const VERIFIED = rank("VERIFIED");
const RELEASED = rank("RELEASED");
const DEPLOYED = rank("DEPLOYED");
const ACCEPTED = rank("PRODUCTION-ACCEPTED");

const isAbsent = (value: string): boolean => /^(N\/A|UNAVAILABLE|PENDING|NONE)\b/i.test(value);
const isNotApplicable = (value: string): boolean => /^N\/A\b/.test(value);
const isHash = (value: string): boolean => /^[0-9a-f]{7,40}\b/.test(value);
const isPendingCommit = (value: string): boolean => value.startsWith("PENDING — NOT COMMITTED");
/** The commit that adds the record. Git resolves it; a record never carries its own hash (§16.1 rule 4). */
const isThisCommit = (value: string): boolean => value.startsWith("THIS COMMIT");

interface Census {
  count: number;
  sha256: string;
  record: string;
}

const censusLine = (census: { count: number; sha256: string }): string =>
  `Legacy census: ${census.count} records, sha256 ${census.sha256}`;

interface Failure {
  code: string;
  file: string;
  detail: string;
}

function closureRecords(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile() && entry.name.endsWith("-closure.md")) found.push(rel);
    }
  };
  walk("docs");
  return found.sort();
}

function parseContract(text: string): { fields: Map<string, string>; duplicates: string[] } {
  const start = text.search(MARKER);
  const body = text.slice(start).split("\n").slice(1);
  const end = body.findIndex((line) => /^#{1,2} /.test(line));
  const fields = new Map<string, string>();
  const duplicates: string[] = [];
  for (const line of end === -1 ? body : body.slice(0, end)) {
    const match = /^- ([A-Za-z ]+): (.*)$/.exec(line);
    if (!match) continue;
    if (fields.has(match[1])) duplicates.push(match[1]);
    fields.set(match[1], match[2].trim());
  }
  return { fields, duplicates };
}

function sectionRows(roadmap: string, heading: string): string[][] | null {
  const lines = roadmap.split("\n");
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const rows = (end === -1 ? rest : rest.slice(0, end))
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  return rows.slice(1).filter((cells) => !cells.every((cell) => /^-+$/.test(cell)));
}

const unquote = (cell: string): string => cell.replace(/^`|`$/g, "");

function validate(root: string, census: Census): Failure[] {
  const failures: Failure[] = [];
  const fail = (code: string, file: string, detail: string): void => {
    failures.push({ code, file, detail });
  };

  const records = closureRecords(root);
  const text = new Map(records.map((file) => [file, readFileSync(path.join(root, file), "utf8")]));
  const marked = records.filter((file) => MARKER.test(text.get(file) ?? ""));
  const legacy = records.filter((file) => !marked.includes(file));
  const digest = createHash("sha256").update(legacy.join("\n")).digest("hex");
  if (legacy.length !== census.count || digest !== census.sha256) {
    fail(
      "LEGACY_CENSUS_CHANGED",
      "docs/**/*-closure.md",
      `pinned "${censusLine(census)}", found "${censusLine({ count: legacy.length, sha256: digest })}". ` +
        `A new closure record is missing "## Closure Contract (v1)", or a legacy record was deleted, renamed or moved. ` +
        `Locate it: git diff --name-status <base> -- 'docs/*-closure.md'. Do NOT copy the found values here: a legitimate ` +
        `change follows the §16.1 legacy-maintenance procedure.`,
    );
  }
  /* The pinned values must be owned by a contract record that states them verbatim — an unrecorded edit fails. */
  if (!marked.includes(census.record) || !(text.get(census.record) ?? "").includes(censusLine(census))) {
    fail(
      "LEGACY_CENSUS_UNRECORDED",
      census.record,
      `the pinned census must be stated as "${censusLine(census)}" in this contract closure record (§16.1 legacy maintenance)`,
    );
  }

  const roadmapPath = "docs/MASTER-ROADMAP.md";
  const roadmap = existsSync(path.join(root, roadmapPath)) ? readFileSync(path.join(root, roadmapPath), "utf8") : "";
  const pointers = sectionRows(roadmap, "## 21. Phase Closure Index");
  const risks = sectionRows(roadmap, "## 22. Deferred Risk Index");
  if (pointers === null) fail("ROADMAP_SECTION_MISSING", roadmapPath, "§21 Phase Closure Index not found");
  if (risks === null) fail("ROADMAP_SECTION_MISSING", roadmapPath, "§22 Deferred Risk Index not found");

  const contracts = new Map<string, Map<string, string>>();
  for (const file of marked) {
    const { fields, duplicates } = parseContract(text.get(file) ?? "");
    contracts.set(file, fields);
    for (const field of duplicates) fail("DUPLICATE_FIELD", file, field);
    for (const field of FIELDS) if (!fields.get(field)) fail("MISSING_FIELD", file, field);
    const get = (field: Field): string => fields.get(field) ?? "";

    const state = get("Reached state");
    const r = rank(state);
    if (r === -1) {
      fail("INVALID_STATE", file, `"${state}" is not one of ${STATES.join(" | ")}`);
      continue;
    }

    if (!/^V[0-3]\s+[—-]\s+\S/.test(get("Verification level"))) {
      fail("INVALID_VERIFICATION_LEVEL", file, "must be V0–V3 followed by — and a justification");
    }

    const commit = get("Implementation commit");
    if (r >= RELEASED && !isHash(commit)) fail("COMMIT_REQUIRED", file, `${state} requires a commit hash, found "${commit}"`);
    else if (r > rank("DESIGN ONLY") && r < RELEASED && !isHash(commit) && !isPendingCommit(commit) && !isThisCommit(commit)) {
      fail("INVALID_COMMIT", file, `${state} requires a hash, "THIS COMMIT" or "PENDING — NOT COMMITTED", found "${commit}"`);
    } else if (r === rank("DESIGN ONLY") && !isHash(commit) && !isPendingCommit(commit) && !isThisCommit(commit) && !isNotApplicable(commit)) {
      fail("INVALID_COMMIT", file, `found "${commit}"`);
    }

    if (r >= VERIFIED) {
      for (const field of ["Verification evidence", "Test environment"] as const) {
        if (isAbsent(get(field))) fail("VERIFICATION_EVIDENCE_REQUIRED", file, `${state} requires ${field}`);
      }
    }

    const deployment = get("Deployment evidence");
    if (r >= DEPLOYED && isAbsent(deployment)) fail("DEPLOYMENT_EVIDENCE_REQUIRED", file, `${state} requires a deployment identifier`);
    if (r < DEPLOYED && !isNotApplicable(deployment)) fail("CLAIM_EXCEEDS_STATE", file, `${state} must write N/A for Deployment evidence`);

    const production = get("Production acceptance evidence");
    if (r === ACCEPTED && isAbsent(production)) fail("PRODUCTION_EVIDENCE_REQUIRED", file, "PRODUCTION-ACCEPTED requires a production measurement");
    if (r < ACCEPTED && !isNotApplicable(production)) fail("CLAIM_EXCEEDS_STATE", file, `${state} must write N/A for Production acceptance evidence`);

    const rows = (pointers ?? []).filter((row) => unquote(row[2] ?? "") === file);
    if (rows.length === 0) fail("ROADMAP_POINTER_MISSING", file, "no §21 row points to this record");
    if (rows.length > 1) fail("DUPLICATE_POINTER", file, `${rows.length} §21 rows point to this record`);
    if (rows.length === 1 && rows[0][1] !== state) fail("ROADMAP_STATE_MISMATCH", file, `§21 says "${rows[0][1]}", the record says "${state}"`);
    if (rows.length === 1 && rows[0][0] !== get("Phase")) fail("ROADMAP_PHASE_MISMATCH", file, `§21 says "${rows[0][0]}", the record says "${get("Phase")}"`);

    const deferred = get("Deferred risks");
    if (deferred && !/^none$/i.test(deferred)) {
      for (const entry of deferred.split(";").map((part) => part.trim())) {
        const match = /^([A-Z][A-Z0-9-]*-\d+) \((DEFERRED|BLOCKED|CLOSED)\)$/.exec(entry);
        if (!match) {
          fail("DEFERRED_RISK_FORMAT", file, `"${entry}" must be RISK-ID-N (DEFERRED|BLOCKED|CLOSED)`);
          continue;
        }
        if (!(risks ?? []).some((row) => row[0] === match[1])) fail("DEFERRED_RISK_NOT_INDEXED", file, `${match[1]} has no §22 row`);
      }
    }
  }

  for (const row of pointers ?? []) {
    const target = unquote(row[2] ?? "");
    if (!contracts.has(target)) fail("POINTER_TARGET_INVALID", roadmapPath, `§21 row "${row[0]}" points to "${target}", which is not a contract closure record`);
  }

  const seen = new Set<string>();
  for (const row of risks ?? []) {
    const [id, , detailCell, , disposition] = row;
    if (seen.has(id)) fail("DUPLICATE_RISK", roadmapPath, id);
    seen.add(id);
    if (!DISPOSITIONS.includes(disposition as (typeof DISPOSITIONS)[number])) {
      fail("RISK_DISPOSITION_INVALID", roadmapPath, `${id}: "${disposition}"`);
    }
    const detail = unquote(detailCell ?? "");
    if (!detail || !existsSync(path.join(root, detail))) {
      fail("RISK_DETAIL_MISSING", roadmapPath, `${id} points to "${detail}", which does not exist`);
      continue;
    }
    if (!readFileSync(path.join(root, detail), "utf8").includes(id)) fail("RISK_DETAIL_LACKS_ID", roadmapPath, `${detail} does not name ${id}`);
    const owner = contracts.get(detail);
    if (owner) {
      const listed = (owner.get("Deferred risks") ?? "").split(";").map((part) => part.trim());
      if (!listed.includes(`${id} (${disposition})`)) {
        fail("RISK_DISPOSITION_MISMATCH", roadmapPath, `§22 says ${id} (${disposition}); the detail record does not`);
      }
    }
  }

  return failures;
}

/* ── 1. THE REAL REPOSITORY ────────────────────────────────────────────────── */

const real = validate(REPO_ROOT, LEGACY_CENSUS);
assert.deepEqual(real, [], `the repository violates §16.1:\n${real.map((f) => `  ${f.code} ${f.file}: ${f.detail}`).join("\n")}`);
console.log("PASS the repository satisfies §16.1 (legacy census, contract records, §21, §22)");

/* ── 2. FIXTURES: EVERY CHECK MUST BITE, EVERY VALID SHAPE MUST PASS ───────── */

type Contract = Record<Field, string>;
const RECORD = "docs/product-vision/runtime/fixture-phase-closure.md";
const LEGACY = "docs/product-vision/runtime/fixture-legacy-closure.md";
const LEGACY_B = "docs/product-vision/runtime/fixture-legacy-b-closure.md";
const LEGACY_BODY = "# Legacy closure\n\nWritten before §16.1. RELEASED.\n";

const censusOf = (legacyPaths: string[], record: string): Census => ({
  count: legacyPaths.length,
  sha256: createHash("sha256").update([...legacyPaths].sort().join("\n")).digest("hex"),
  record,
});
const FIXTURE_CENSUS = censusOf([LEGACY, LEGACY_B], RECORD);

const VALID: Record<string, Contract> = {
  "design only": {
    Phase: "FX-1",
    Owner: "fixture",
    "Reached state": "DESIGN ONLY",
    "Implementation commit": "N/A — design only",
    "Verification level": "V0 — documentation only",
    "Verification evidence": "N/A — nothing implemented",
    "Test environment": "N/A — nothing implemented",
    "Deployment evidence": "N/A — not deployed",
    "Production acceptance evidence": "N/A — not deployed",
    "Deferred risks": "none",
    "Director approvals": "design approved",
  },
  "verified, not committed": {
    Phase: "FX-1",
    Owner: "fixture",
    "Reached state": "VERIFIED",
    "Implementation commit": "PENDING — NOT COMMITTED",
    "Verification level": "V1 — one seam",
    "Verification evidence": "focused test exit 0",
    "Test environment": "local worktree",
    "Deployment evidence": "N/A — not deployed",
    "Production acceptance evidence": "N/A — not deployed",
    "Deferred risks": "FX-RISK-1 (DEFERRED)",
    "Director approvals": "implementation approved; commit not approved",
  },
  "verified, committed with this record": {
    Phase: "FX-1",
    Owner: "fixture",
    "Reached state": "VERIFIED",
    "Implementation commit": "THIS COMMIT — the commit that adds this record",
    "Verification level": "V1 — one seam",
    "Verification evidence": "focused test exit 0",
    "Test environment": "local worktree",
    "Deployment evidence": "N/A — not deployed",
    "Production acceptance evidence": "N/A — not deployed",
    "Deferred risks": "none",
    "Director approvals": "local commit approved; push not approved",
  },
  released: {
    Phase: "FX-1",
    Owner: "fixture",
    "Reached state": "RELEASED",
    "Implementation commit": "abcdef1",
    "Verification level": "V2 — shared seam",
    "Verification evidence": "suite exit 0",
    "Test environment": "local worktree",
    "Deployment evidence": "N/A — not deployed",
    "Production acceptance evidence": "N/A — not deployed",
    "Deferred risks": "none",
    "Director approvals": "commit and push approved",
  },
  "production-accepted": {
    Phase: "FX-1",
    Owner: "fixture",
    "Reached state": "PRODUCTION-ACCEPTED",
    "Implementation commit": "abcdef1 + 1234567",
    "Verification level": "V3 — execution boundary",
    "Verification evidence": "full suite exit 0",
    "Test environment": "local worktree + disposable PostgreSQL",
    "Deployment evidence": "dpl_fixture",
    "Production acceptance evidence": "read-back matched in production",
    "Deferred risks": "FX-RISK-1 (CLOSED)",
    "Director approvals": "deploy and acceptance approved",
  },
};

function renderRecord(contract: Partial<Contract>, census: Census = FIXTURE_CENSUS): string {
  const lines = FIELDS.filter((field) => contract[field] !== undefined).map((field) => `- ${field}: ${contract[field]}`);
  return `# Fixture closure\n\n${censusLine(census)}\n\n## Closure Contract (v1)\n\n${lines.join("\n")}\n\n## After\n\ntext\n`;
}

function renderRoadmap(pointers: string[][], risks: string[][]): string {
  const table = (header: string, rows: string[][]): string =>
    [header, `|${header.split("|").slice(1, -1).map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
  return [
    "# Roadmap",
    "",
    "## 21. Phase Closure Index",
    "",
    table("| Phase | Reached state | Closure record |", pointers),
    "",
    "## 22. Deferred Risk Index",
    "",
    table("| Risk ID | Owning phase | Detail record | Category | Disposition | Acceptance dependency |", risks),
    "",
  ].join("\n");
}

interface Scenario {
  records: Record<string, string>;
  pointers: string[][];
  risks: string[][];
}

function scenarioFor(contract: Contract): Scenario {
  const ids = contract["Deferred risks"] === "none" ? [] : contract["Deferred risks"].split(";").map((part) => part.trim());
  return {
    records: { [LEGACY]: LEGACY_BODY, [LEGACY_B]: LEGACY_BODY, [RECORD]: renderRecord(contract) },
    pointers: [[contract.Phase, contract["Reached state"], `\`${RECORD}\``]],
    risks: ids.map((entry) => {
      const [, id, disposition] = /^(\S+) \((\w+)\)$/.exec(entry) ?? [];
      return [id, contract.Phase, `\`${RECORD}\``, "fixture", disposition, "none"];
    }),
  };
}

function run(scenario: Scenario, census: Census = FIXTURE_CENSUS): string[] {
  const root = mkdtempSync(path.join(tmpdir(), "closure-contract-"));
  try {
    for (const [file, body] of Object.entries(scenario.records)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), body, "utf8");
    }
    writeFileSync(path.join(root, "docs/MASTER-ROADMAP.md"), renderRoadmap(scenario.pointers, scenario.risks), "utf8");
    return validate(root, census).map((failure) => failure.code);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const [label, contract] of Object.entries(VALID)) {
  assert.deepEqual(run(scenarioFor(contract)), [], `valid shape "${label}" was rejected`);
  console.log(`PASS valid: ${label}`);
}

const base = VALID["verified, not committed"];
function bites(label: string, expected: string, mutate: (scenario: Scenario) => void): void {
  const scenario = scenarioFor({ ...base });
  mutate(scenario);
  const codes = run(scenario);
  assert.ok(codes.includes(expected), `${label}: expected ${expected}, got [${codes.join(", ")}]`);
  console.log(`PASS rejects: ${label} → ${expected}`);
}
const withContract = (changes: Partial<Contract>, omit: Field[] = []) => (scenario: Scenario): void => {
  const contract: Partial<Contract> = { ...base, ...changes };
  for (const field of omit) delete contract[field];
  scenario.records[RECORD] = renderRecord(contract);
};

bites("missing required field", "MISSING_FIELD", withContract({}, ["Director approvals"]));
bites("state outside the six", "INVALID_STATE", (s) => {
  withContract({ "Reached state": "COMPLETE" })(s);
  s.pointers[0][1] = "COMPLETE";
});
bites("verification level without justification", "INVALID_VERIFICATION_LEVEL", withContract({ "Verification level": "V1" }));
bites("Era I milestone used as a level", "INVALID_VERIFICATION_LEVEL", withContract({ "Verification level": "L1 — focused" }));
bites("VERIFIED with no verification evidence", "VERIFICATION_EVIDENCE_REQUIRED", withContract({ "Verification evidence": "UNAVAILABLE — not run" }));
bites("RELEASED while the commit is pending", "COMMIT_REQUIRED", (s) => {
  withContract({ "Reached state": "RELEASED" })(s);
  s.pointers[0][1] = "RELEASED";
});
bites("RELEASED that names only THIS COMMIT", "COMMIT_REQUIRED", (s) => {
  withContract({ "Reached state": "RELEASED", "Implementation commit": "THIS COMMIT" })(s);
  s.pointers[0][1] = "RELEASED";
});
bites("VERIFIED with an unrecognised commit value", "INVALID_COMMIT", withContract({ "Implementation commit": "committed somewhere" }));
bites("PRODUCTION-ACCEPTED with unavailable production evidence", "PRODUCTION_EVIDENCE_REQUIRED", (s) => {
  withContract({ ...VALID["production-accepted"], "Production acceptance evidence": "UNAVAILABLE — not measured", "Deferred risks": "none" })(s);
  s.pointers[0][1] = "PRODUCTION-ACCEPTED";
  s.risks = [];
});
bites("DEPLOYED with no deployment identifier", "DEPLOYMENT_EVIDENCE_REQUIRED", (s) => {
  withContract({ ...VALID.released, "Reached state": "DEPLOYED", "Deployment evidence": "PENDING — deploy later", "Deferred risks": "none" })(s);
  s.pointers[0][1] = "DEPLOYED";
  s.risks = [];
});
bites("production evidence declared by a VERIFIED record", "CLAIM_EXCEEDS_STATE", withContract({ "Production acceptance evidence": "tests passed" }));
bites("deployment evidence declared by a VERIFIED record", "CLAIM_EXCEEDS_STATE", withContract({ "Deployment evidence": "dpl_fixture" }));
bites("no §21 pointer", "ROADMAP_POINTER_MISSING", (s) => {
  s.pointers = [];
});
bites("§21 state disagrees with the record", "ROADMAP_STATE_MISMATCH", (s) => {
  s.pointers[0][1] = "RELEASED";
});
bites("§21 phase disagrees with the record", "ROADMAP_PHASE_MISMATCH", (s) => {
  s.pointers[0][0] = "FX-OTHER";
});
bites("§21 points at a record that does not exist", "POINTER_TARGET_INVALID", (s) => {
  s.pointers.push(["FX-2", "VERIFIED", "`docs/product-vision/runtime/missing-closure.md`"]);
});
bites("deferred risk missing from §22", "DEFERRED_RISK_NOT_INDEXED", (s) => {
  s.risks = [];
});
bites("deferred risk written without a disposition", "DEFERRED_RISK_FORMAT", withContract({ "Deferred risks": "FX-RISK-1" }));
bites("§22 detail record does not exist", "RISK_DETAIL_MISSING", (s) => {
  s.risks[0][2] = "`docs/nowhere.md`";
});
bites("§22 detail record does not name the risk", "RISK_DETAIL_LACKS_ID", (s) => {
  s.risks[0][2] = `\`${LEGACY}\``;
});
bites("§22 disposition differs from the detail record", "RISK_DISPOSITION_MISMATCH", (s) => {
  s.risks[0][4] = "CLOSED";
});
bites("§22 disposition outside the vocabulary", "RISK_DISPOSITION_INVALID", (s) => {
  s.risks[0][4] = "WONTFIX";
});
bites("new closure record without the contract marker", "LEGACY_CENSUS_CHANGED", (s) => {
  s.records["docs/product-vision/runtime/forgot-the-contract-closure.md"] = "# A new phase\n\nPRODUCTION-ACCEPTED.\n";
});
bites("legacy record deleted", "LEGACY_CENSUS_CHANGED", (s) => {
  delete s.records[LEGACY];
});

/* ── 3. LEGACY MAINTENANCE: the census guards the SET of legacy records and changes only when recorded ── */

const NEW = "docs/product-vision/runtime/fixture-new-phase-closure.md";
const RENAMED = "docs/product-vision/runtime/fixture-legacy-renamed-closure.md";
const MAINTENANCE = "docs/product-vision/runtime/fixture-legacy-maintenance-closure.md";
const moveLegacy = (to: string) => (s: Scenario): void => {
  s.records[to] = s.records[LEGACY];
  delete s.records[LEGACY];
};
const addContract = (file: string, contract: Partial<Contract>, census: Census = FIXTURE_CENSUS) => (s: Scenario): void => {
  s.records[file] = renderRecord(contract, census);
  s.pointers.push([contract.Phase ?? "", contract["Reached state"] ?? "", `\`${file}\``]);
};
function maintenance(label: string, expected: string[], mutate: (scenario: Scenario) => void, census: Census = FIXTURE_CENSUS): void {
  const scenario = scenarioFor({ ...VALID.released });
  mutate(scenario);
  const codes = run(scenario, census);
  if (expected.length === 0) assert.deepEqual(codes, [], `${label}: expected acceptance, got [${codes.join(", ")}]`);
  for (const code of expected) assert.ok(codes.includes(code), `${label}: expected ${code}, got [${codes.join(", ")}]`);
  console.log(`PASS maintenance ${label} → ${expected.length === 0 ? "accepted" : expected.join(", ")}`);
}

const withoutApprovals: Partial<Contract> = { ...VALID.released, Phase: "FX-NEW" };
delete withoutApprovals["Director approvals"];
const renamedCensus = censusOf([RENAMED, LEGACY_B], MAINTENANCE);

maintenance("1 legacy records unchanged", [], () => {});
maintenance("2 legacy record renamed", ["LEGACY_CENSUS_CHANGED"], moveLegacy(RENAMED));
maintenance("2b legacy record renamed out of *-closure.md", ["LEGACY_CENSUS_CHANGED"], moveLegacy("docs/product-vision/runtime/fixture-legacy-record.md"));
maintenance("3 legacy record moved to another directory", ["LEGACY_CENSUS_CHANGED"], moveLegacy("docs/architecture/fixture-legacy-closure.md"));
maintenance("4 legacy record removed", ["LEGACY_CENSUS_CHANGED"], (s) => {
  delete s.records[LEGACY];
});
maintenance("5 new closure without the contract marker", ["LEGACY_CENSUS_CHANGED"], (s) => {
  s.records[NEW] = "# A new phase\n\nPRODUCTION-ACCEPTED.\n";
});
maintenance("6 new closure with a valid contract", [], addContract(NEW, { ...VALID.released, Phase: "FX-NEW" }));
maintenance("7 new closure with an invalid contract", ["MISSING_FIELD"], addContract(NEW, withoutApprovals));
maintenance(
  "8 legitimate rename: census updated and stated by an approved maintenance record",
  [],
  (s) => {
    moveLegacy(RENAMED)(s);
    addContract(MAINTENANCE, { ...VALID.released, Phase: "FX-MAINT", "Director approvals": "legacy rename approved" }, renamedCensus)(s);
  },
  renamedCensus,
);
maintenance(
  "8b census values edited but stated by no record",
  ["LEGACY_CENSUS_UNRECORDED"],
  moveLegacy(RENAMED),
  { ...renamedCensus, record: RECORD },
);
maintenance("8c census owned by a legacy record", ["LEGACY_CENSUS_UNRECORDED"], () => {}, { ...FIXTURE_CENSUS, record: LEGACY });

console.log(
  "\nPASS closure contract: repository valid; 5 valid shapes pass; 24 defects rejected, each by its own code; " +
    "11 legacy-maintenance scenarios behave as §16.1 requires",
);
