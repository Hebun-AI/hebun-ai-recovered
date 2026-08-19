/*
 * G6C — THE AUTHORITY REACHABILITY FIREWALL.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Every released firewall protecting "Heby may explain Governance but never exercise it" was
 * expressed as: no file whose PATH contains `heby-` may mention certain module names. Measured
 * against reality, that heuristic failed in both directions:
 *
 *   TOO WEAK   — R3W's `work-artifacts/work-artifact-evidence.server.ts` imported
 *                `bootstrap-authority.server.ts` for a database handle. That module also exports
 *                `establishGovernanceAuthority`. Heby's answer path therefore had the act that
 *                creates a government in its module graph, and every path-based firewall passed,
 *                because the offending file's path says `work-artifacts`.
 *
 *   TOO STRONG — a file whose COMMENT named a writer in order to promise it was not imported
 *                tripped two firewalls, while importing nothing.
 *
 * A filename is a proxy for "is this Heby's code". This file tests the property directly instead:
 *
 *   NO MODULE REACHABLE FROM HEBY'S GROUNDING ROOTS MAY DEFINE A GOVERNANCE WRITER.
 *
 * It walks the real import graph from Heby's entry points and inspects every module it can reach.
 * It cannot be satisfied by renaming a file, and it does not care where a module lives.
 *
 * ── WHAT THIS DOES NOT REPLACE ───────────────────────────────────────────────
 *
 * The path heuristics in g2/g3/k4 remain, now matching writer SYMBOLS against comment-stripped
 * code. Two independent mechanisms, one structural and one lexical.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * Every act that mutates Governance, authority, onboarding, Knowledge ratification, provider state
 * or execution. Reaching ANY of these from Heby is the thing this file forbids.
 */
const WRITERS = [
  "establishGovernanceAuthority",
  "recordGovernanceDecision",
  "writeGovernanceDecisionWithin",
  "delegateGovernanceAuthority",
  "revokeGovernanceAuthority",
  "provisionMemberRole",
  "authorizeMembership",
  "issueInvitation",
  "revokeInvitation",
  "decideIdentityEnrollment",
  "ratifyKnowledgeVersion",
  "rejectKnowledgeVersion",
  "consumeActionPermit",
  "executeAuthorizedAction",
] as const;

/** Heby's server entry points — everything a user message can reach. */
const HEBY_ROOTS = [
  "src/features/heby-answer/model-answer.server.ts",
  "src/features/heby-commands/read-commands.server.ts",
];

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null; // bare package specifier — not our source
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** Every module reachable from `entry`, following real import statements in comment-stripped code. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = codeOf(read(file));
    for (const match of code.matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function definesWriter(file: string): string[] {
  const code = codeOf(read(file));
  return WRITERS.filter((w) => new RegExp(`export\\s+(?:async\\s+)?function\\s+${w}\\b`).test(code));
}

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

function main(): void {
  /* ── 1. THE PROPERTY: NO WRITER IS REACHABLE FROM HEBY ───────────────────── */
  {
    for (const root of HEBY_ROOTS) {
      assert.ok(existsSync(path.join(ROOT, root)), `${root} must exist for this test to mean anything`);
      const graph = reachableFrom(root);
      assert.ok(graph.size > 50, `the ${root} graph should be substantial, got ${graph.size}`);

      const offenders: string[] = [];
      for (const file of graph) {
        for (const writer of definesWriter(file)) offenders.push(`${writer} <- ${file}`);
      }
      assert.deepEqual(
        offenders.sort(),
        [],
        `no module reachable from ${root} may define a Governance writer`,
      );
    }
  }

  /* ── 2. THE TEST CAN ACTUALLY SEE WRITERS ────────────────────────────────── */
  {
    /*
     * A reachability test that cannot detect a writer anywhere proves nothing. Every symbol in
     * WRITERS must be defined by exactly one module in the repository, so a renamed or deleted
     * writer fails here loudly instead of silently emptying the ban list.
     */
    const all = collect("src");
    for (const writer of WRITERS) {
      const definers = all.filter((f) =>
        new RegExp(`export\\s+(?:async\\s+)?function\\s+${writer}\\b`).test(codeOf(read(f))),
      );
      assert.equal(definers.length, 1, `${writer} must be defined exactly once, found ${definers.length}`);
    }
  }

  /* ── 2b. PROVIDER AND EXECUTION SUBSTRATE STAY OUT OF REACH ──────────────── */
  {
    /*
     * `setDirectorEnabled` is deliberately NOT in WRITERS: R5.1 removed the provider-arming
     * capability from `src/` entirely, so banning the symbol would ban nothing and read as
     * coverage. The released property is stronger and is asserted directly — no module reachable
     * from Heby writes the provider control table or the execution tables.
     */
    const SUBSTRATE = [
      "providerConnectivityControls",
      "actionPermits",
      "actionExecutionAttempts",
      "executions",
    ];
    for (const root of HEBY_ROOTS) {
      const graph = reachableFrom(root);
      const offenders: string[] = [];
      for (const file of graph) {
        const code = codeOf(read(file));
        for (const table of SUBSTRATE) {
          if (new RegExp(`\\.(insert|update|delete)\\(\\s*${table}\\b`).test(code)) {
            offenders.push(`${table} <- ${file}`);
          }
        }
      }
      assert.deepEqual(offenders.sort(), [], `nothing reachable from ${root} may write provider or execution state`);
    }
  }

  /* ── 3. THE READ MODULES CANNOT MUTATE ───────────────────────────────────── */
  {
    const READ_MODULES = [
      "src/features/governance-decision/authority-read.server.ts",
      "src/features/governance-decision/persistence.server.ts",
      "src/features/tenant-role-baseline/role-baseline-read.server.ts",
    ];
    for (const file of READ_MODULES) {
      const code = codeOf(read(file));
      for (const banned of [".insert(", ".update(", ".delete(", ".transaction(", "transaction("]) {
        assert.ok(!code.includes(banned), `${file} is a READ module and must not contain ${banned}`);
      }
      for (const writer of WRITERS) {
        assert.ok(!code.includes(writer), `${file} must not reference the writer ${writer}`);
      }
      assert.deepEqual(definesWriter(file), [], `${file} must define no writer`);
    }
  }

  /* ── 4. STILL EXACTLY ONE AUTHORITY RESOLVER, AND IT IS IN A READ MODULE ─── */
  {
    const definitions = collect("src/features").filter((f) =>
      /export async function resolveGovernanceAuthority\b/.test(codeOf(read(f))),
    );
    assert.deepEqual(
      definitions,
      ["src/features/governance-decision/authority-read.server.ts"],
      "one resolver — moved into a module that cannot mutate, never duplicated",
    );
  }

  /* ── 5. THE WRITERS STILL DEPEND ON THE READ, NOT THE REVERSE ────────────── */
  {
    const writerModules = [
      "src/features/governance-decision/bootstrap-authority.server.ts",
      "src/features/governance-decision/decision-authority.server.ts",
      "src/features/tenant-role-baseline/provision-member-role.server.ts",
    ];
    for (const file of writerModules) {
      const code = codeOf(read(file));
      assert.ok(
        /from "\.\/persistence\.server"|from "@\/features\/governance-decision\/persistence\.server"/.test(code),
        `${file} must take its infrastructure from the shared module, not redefine it`,
      );
    }
    /* And the read module imports none of them — the direction cannot invert. */
    const readCode = codeOf(read("src/features/governance-decision/authority-read.server.ts"));
    for (const writerModule of ["bootstrap-authority.server", "decision-authority.server", "provision-member-role.server"]) {
      assert.ok(!readCode.includes(writerModule), `the read module must not import ${writerModule}`);
    }
  }

  console.log("PASS g6c authority reachability firewall");
}

main();
