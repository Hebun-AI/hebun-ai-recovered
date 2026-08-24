/*
 * NAV-TRUTH BITE-PROOFS — six mutations of the REAL source, plus one correct change that must be
 * accepted.
 *
 * This phase deleted a false claim rather than repairing one, and a deletion is exactly the kind of
 * change whose guard is easy to write and easy to leave toothless. Each mutation below restores one
 * piece of the machinery that produced "Gmail ● connected" from a fixture, and the suite must
 * refuse each one for the reason it exists.
 *
 * Four conditions per proof: the mutation APPLIED, the run FAILED, it failed for the INTENDED
 * REASON, and the file came back byte-identical by sha256. Restoration runs in `finally`.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const SUITE = "tests/navtruth-integration-badges/sidebar-connection-truth.ts";

const SIDEBAR = "src/config/sidebar.config.ts";
const SIDEBAR_ITEM = "src/components/layout/sidebar-item.tsx";
const TYPES = "src/types/index.ts";
const MOCK_DIR = "src/features/integrations";
const MOCK_FILE = "src/features/integrations/mock.ts";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  assert.ok(!result.error, `the child run of ${SUITE} failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "M1 the navigation regains the ability to state a connection",
    file: SIDEBAR,
    find: 'export type SidebarBadge =\n  | { type: "count"; value: number }\n  | { type: "tag"; value: string };',
    replace:
      'export type SidebarBadge =\n  | { type: "count"; value: number }\n' +
      '  | { type: "status"; value: "connected" | "pending" }\n  | { type: "tag"; value: string };',
    expect: "must not be able to state a connection",
  },
  {
    label: "M2 a false status badge is configured on a nav item",
    file: SIDEBAR,
    find: '        items: [{ label: "Overview", href: "/integrations", icon: Plug }],',
    replace:
      "        items: [\n" +
      '          { label: "Overview", href: "/integrations", icon: Plug },\n' +
      '          { label: "Gmail", href: "/integrations/gmail", icon: Plug },\n' +
      "        ],",
    expect: "has no real page at",
  },
  {
    label: "M3 the authority-backed Overview is dropped from the navigation",
    file: SIDEBAR,
    find: '        items: [{ label: "Overview", href: "/integrations", icon: Plug }],',
    /*
     * Removing a false claim must not become removing the true one. If the honest, per-request,
     * authority-backed surface disappears from the navigation, the section states nothing at all —
     * which is not the same as stating the truth.
     */
    replace: "        items: [],",
    expect: "must keep its authority-backed Overview",
  },
  {
    label: "M4 the status renderer returns to the sidebar item",
    file: SIDEBAR_ITEM,
    find: '      {item.badge?.type === "tag" && (',
    /*
     * The replacement deliberately does NOT mention `statusDot`. A first version did, and the
     * colour-map assertion fired first — a proof that bit for the wrong reason and would have
     * reported the RENDERER as tested while it was not. A mutation must change only the thing
     * under proof.
     */
    replace:
      '      {item.badge?.type === "status" && <span className="size-2 rounded-full" />}\n' +
      '      {item.badge?.type === "tag" && (',
    expect: "still renders a status badge",
  },
  {
    label: "M5 a second connection shape returns to the shared type barrel",
    file: TYPES,
    find: "export type IntegrationStatus =",
    replace:
      "export interface Integration {\n  id: string;\n  status: string;\n  lastSync: string;\n}\n" +
      "export type IntegrationStatus =",
    expect: "connections are modelled by",
  },
  {
    label: "M6 the display vocabulary is swept away with the fixture",
    file: TYPES,
    find: "export type IntegrationStatus =",
    replace: "export type RetiredIntegrationStatus =",
    expect: "the display vocabulary is retained",
  },
];

/**
 * Behaviour-preserving. The suite must ACCEPT it, or the assertions test the spelling of the
 * source rather than the rule it encodes. Reordering two independent union members changes nothing.
 */
const ACCEPTED = {
  label: "A1 the surviving badge variants are declared in the other order",
  file: SIDEBAR,
  find: 'export type SidebarBadge =\n  | { type: "count"; value: number }\n  | { type: "tag"; value: string };',
  replace:
    'export type SidebarBadge =\n  | { type: "tag"; value: string }\n  | { type: "count"; value: number };',
} as const;

let bitten = 0;

function withMutation(
  file: string,
  edits: readonly { find: string; replace: string }[],
  body: () => void,
): void {
  const original = readFile(file);
  const before = sha(original);
  let mutated = original;
  for (const edit of edits) {
    assert.ok(
      mutated.includes(edit.find),
      `the mutation target is not present in ${file} — the proof would be vacuous:\n${edit.find}`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }
  assert.notEqual(mutated, original, `the mutation changed nothing in ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    assert.equal(sha(readFile(file)), sha(mutated), `the mutation did not reach ${file}`);
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(sha(readFile(file)), before, `${file} was not restored byte-identically`);
}

/**
 * ── THE SEVENTH PROOF NEEDS A FILE, NOT AN EDIT ──────────────────────────────
 *
 * The strongest claim this phase makes is that the seeded fixture has NO HOME TO RETURN TO. That
 * cannot be mutated with a find/replace, because the thing under test is a directory's absence. So
 * the fixture is recreated, the suite must refuse it, and it is removed again in `finally`.
 */
function theFixtureCannotComeBack(): void {
  assert.ok(!existsSync(abs(MOCK_DIR)), "the fixture directory is absent before the proof");
  try {
    mkdirSync(abs(MOCK_DIR), { recursive: true });
    writeFileSync(
      abs(MOCK_FILE),
      'export const integrations = [{ id: "gmail", status: "connected" }];\n',
      "utf8",
    );
    assert.ok(existsSync(abs(MOCK_FILE)), "the fixture was recreated");
    const run = runSuite();
    assert.equal(run.ok, false, "M7: the suite still PASSED with the seeded fixture restored");
    assert.ok(
      run.output.includes("must have no home to return to"),
      `M7: the suite failed, but not for the intended reason.\n--- actual ---\n${run.output.slice(-2000)}`,
    );
  } finally {
    rmSync(abs(MOCK_DIR), { recursive: true, force: true });
  }
  assert.ok(!existsSync(abs(MOCK_DIR)), "the fixture directory was removed again");
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation], () => {
      const run = runSuite();
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  theFixtureCannotComeBack();
  bitten += 1;
  console.log("BITE M7 the seeded fixture is recreated on disk");

  withMutation(ACCEPTED.file, [{ find: ACCEPTED.find, replace: ACCEPTED.replace }], () => {
    const run = runSuite();
    assert.ok(
      run.ok,
      `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite tests the ` +
        `spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2000)}`,
    );
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length + 1, "every mutation must have been proved to bite");
  console.log(
    `navtruth-integration-badges/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main();
