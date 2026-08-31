/*
 * HEBY DECISION QUEUE GROUNDING — THE FIREWALL, WALKED RATHER THAN ASSERTED.
 *
 * THE CLAIM THIS FILE PROVES:
 *
 *   "Nothing reachable from the decision-queue grounding module can approve, reject, authorize,
 *    issue or consume a permit, execute, retry, send, mutate a request, mutate Governance, or
 *    mutate an Agent Mandate — because no file in its real VALUE-IMPORT CLOSURE performs a durable
 *    write, and no writer is reachable from it at all."
 *
 * ── WHY A WALK AND NOT A GREP ────────────────────────────────────────────────
 *
 * G6C's defect was a module that looked clean and dragged a writer in one import away, and R6D
 * recorded that a substring check on an import LINE can pass while the graph is dirty. The risk is
 * sharper here than in any previous grounding phase: the decision WRITER, the proposal writer, the
 * permit consumer and the permit revoker are files in the SAME DIRECTORY as the projection. So the
 * closure is walked, `export … from` re-exports are followed, and the write predicate is the shared
 * one every other firewall uses.
 *
 * Pure: filesystem reads only. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";

const SRC = path.join(process.cwd(), "src");
const ENTRY = path.join(SRC, "features/action-authorization/heby-decision-queue-source.server.ts");

/** Resolve a specifier to a real file, or null when it is a package or a type-only path. */
function resolveModule(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
      try {
        if (readFileSync(candidate).length >= 0 && /\.tsx?$/.test(candidate)) return candidate;
      } catch {
        /* a directory — keep looking */
      }
    }
  }
  return null;
}

/**
 * Every specifier this file imports AS A VALUE.
 *
 * `import type { … }` and `export type { … }` are ERASED at build time, so they cannot carry a
 * writer into a runtime graph. Counting them would make the closure enormous and the claim weaker,
 * not stronger. Inline `type` members inside a value import are left alone: the module is still
 * loaded at runtime, so the file genuinely is in the closure.
 */
function valueImports(source: string): string[] {
  const code = codeOf(source);
  const out: string[] = [];
  /* import … from "x"  /  export … from "x"  — both pull the module in at runtime. */
  for (const match of code.matchAll(/(?:^|\n)\s*(import|export)\s+([\s\S]*?)from\s*"([^"]+)"/g)) {
    const clause = match[2] ?? "";
    if (/^\s*type\s/.test(clause)) continue; /* `import type X from` / `export type { … } from` */
    out.push(match[3]!);
  }
  /* Bare side-effect imports. */
  for (const match of code.matchAll(/(?:^|\n)\s*import\s*"([^"]+)"/g)) out.push(match[1]!);
  return out;
}

function closureFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const specifier of valueImports(source)) {
      const resolved = resolveModule(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

function main(): void {
  const closure = closureFrom(ENTRY);
  assert.ok(closure.size >= 2, `the closure was walked, not stubbed: ${closure.size} files`);

  /* ── 1. NOTHING IN THE CLOSURE WRITES ANYTHING DURABLE. ───────────────────── */
  const writers = [...closure].filter((file) => performsDurableWrite(readFileSync(file, "utf8")));
  assert.deepEqual(
    writers.map((f) => path.relative(SRC, f)).sort(),
    [],
    "a durable writer is reachable from decision-queue grounding",
  );

  /* ── 2. AND THE NAMED AUTHORITIES ARE NOT REACHABLE AT ALL. ───────────────── */
  const forbidden = [
    "features/action-authorization/decide-action-request.server.ts",
    "features/action-authorization/record-action-request.server.ts",
    "features/action-authorization/consume-action-permit.server.ts",
    "features/action-authorization/revoke-action-permit.server.ts",
    "features/action-execution/execute-authorized-action.server.ts",
    "features/action-execution-live/resend-email-transport.server.ts",
    "features/governance-decision/decision-authority.server.ts",
    "features/agent-mandate/establish-agent-mandate.server.ts",
    "features/agent-mandate/index.ts",
  ];
  const reachable = new Set([...closure].map((f) => path.relative(SRC, f)));
  for (const forbiddenModule of forbidden) {
    assert.equal(
      reachable.has(forbiddenModule),
      false,
      `${forbiddenModule} is reachable from the grounding module`,
    );
  }

  /*
   * ── 3. THE WALKER ACTUALLY BITES. ─────────────────────────────────────────
   *
   * A closure walk that silently resolved nothing would pass every assertion above. So the
   * decision writer is walked on its own and MUST be found to write — proving the predicate and
   * the resolver both work on this directory, which is the one that matters here.
   */
  const writerEntry = path.join(SRC, "features/action-authorization/decide-action-request.server.ts");
  assert.ok(
    performsDurableWrite(readFileSync(writerEntry, "utf8")),
    "the decision writer must be detected as a writer, or this firewall proves nothing",
  );
  assert.ok(
    closureFrom(writerEntry).size > 1,
    "the resolver must resolve real files in this directory",
  );

  console.log("heby-decision-queue/queue-firewall: OK");
}

main();
