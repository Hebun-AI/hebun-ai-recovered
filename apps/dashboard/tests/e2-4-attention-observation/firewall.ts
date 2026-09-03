/*
 * E2-4 — THE STRUCTURAL FIREWALL.
 *
 * Every claim this milestone makes about what it did NOT do, asserted mechanically:
 *
 *   no schema, no migration, no durable writer, no new Live Map node or edge kind, no provider
 *   capability, no execution or Governance authority, no bound on the aggregate, no urgency
 *   vocabulary, and no timestamp read from a column outside the closed basis union.
 *
 *     AGE != IMPORTANCE     WAITING != LATE     NO THRESHOLD IS A POLICY
 *
 * Structural. It reads source and asserts properties; it never renders and never connects.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  FORBIDDEN_ATTENTION_VOCABULARY,
  TIMESTAMP_BASES,
} from "../../src/features/attention-observation/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
/** Comments removed, string literals KEPT — for asserting what the code actually does. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Comments AND string literals removed — for token bans that honest prose would trip. */
const tokensOf = (s: string): string =>
  codeOf(s).replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

/** Everything E2-4 wrote or widened. The ban lists below apply to exactly these files. */
const E24_FILES = [
  "src/features/attention-observation/contracts.ts",
  "src/features/attention-observation/read-attention-observation.server.ts",
  "src/features/attention-observation/heby-attention-source.server.ts",
  "src/features/action-authorization/awaiting-decision-aggregate.server.ts",
];

const AGGREGATE = "src/features/action-authorization/awaiting-decision-aggregate.server.ts";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    return entry.isDirectory() ? collect(rel) : /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

/** Every module reachable from `entry`, following `import … from` AND `export … from`. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function main(): void {
  /* ── 1. SCHEMA DELTA = 0 ─────────────────────────────────────────────────── */
  {
    for (const file of E24_FILES) {
      const code = codeOf(read(file));
      assert.ok(!/pgTable\s*\(/.test(code), `${file} must define no table`);
      assert.ok(!/from\s+"@\/db\/schema/.test(code), `${file} must import no schema module`);
    }
    /* The authored ledger is unchanged, and the journal and the directory still agree. */
    const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
      entries: { idx: number; tag: string }[];
    };
    const files = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
    assert.equal(journal.entries.length, 47, "MIGRATION DELTA = 0 for E2-4 — the ledger moved for other phases, never for this one"); /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). */
    assert.equal(files.length, 47, "no `.sql` was added by E2-4");
  }

  /* ── 2. AUTHORITATIVE WRITER DELTA = 0 ───────────────────────────────────── */
  {
    for (const file of E24_FILES) {
      const code = codeOf(read(file));
      for (const forbidden of [".insert(", ".delete(", ".transaction(", "BEGIN", "for update"]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must contain no durable write or lock (${forbidden})`,
        );
      }
      /* `.update(` is banned too — the only legitimate use here would be a write. */
      assert.ok(!/\.\s*update\s*\(/.test(code), `${file} must contain no UPDATE`);
    }
    /*
     * AND NO WRITER IS REACHABLE FROM E2-4 AT ANY DEPTH. This is the G6C property, applied to this
     * milestone's own roots rather than to Heby's — a file can be clean while importing one that
     * is not.
     */
    const WRITERS = [
      "establishGovernanceAuthority", "recordGovernanceDecision", "writeGovernanceDecisionWithin",
      "delegateGovernanceAuthority", "revokeGovernanceAuthority", "provisionMemberRole",
      "authorizeMembership", "issueInvitation", "revokeInvitation", "decideIdentityEnrollment",
      "ratifyKnowledgeVersion", "rejectKnowledgeVersion", "consumeActionPermit",
      "executeAuthorizedAction",
      /* E2-4 additionally may not reach the proposal lifecycle writers. */
      "recordActionRequest", "decideActionRequest", "revokeActionPermit",
    ];
    for (const root of [
      "src/features/attention-observation/heby-attention-source.server.ts",
      "src/features/attention-observation/read-attention-observation.server.ts",
    ]) {
      const graph = reachableFrom(root);
      assert.ok(graph.size > 40, `the ${root} graph should be substantial, got ${graph.size}`);
      const offenders: string[] = [];
      for (const file of graph) {
        const code = codeOf(read(file));
        for (const writer of WRITERS) {
          if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${writer}\\b`).test(code)) {
            offenders.push(`${writer} <- ${file}`);
          }
        }
      }
      assert.deepEqual(offenders.sort(), [], `no module reachable from ${root} may define a writer`);
    }
  }

  /* ── 3. HEBY REACHES NO NEW DURABLE WRITER ───────────────────────────────── */
  {
    /*
     * The released G6C firewall already asserts this for Governance writers. E2-4 proves the
     * stronger property for the modules IT added: the whole closure of the new grounding source
     * contains no `.insert(`, `.update(` or `.delete(` on a database handle at all.
     */
    const graph = reachableFrom("src/features/attention-observation/heby-attention-source.server.ts");
    const writing = [...graph].filter((file) => {
      const code = codeOf(read(file));
      return /\.\s*insert\s*\(/.test(code) || /\bdb\.\s*update\s*\(/.test(code) ||
        /\btx\.\s*update\s*\(/.test(code) || /\.\s*delete\s*\(\s*\)/.test(code);
    });
    assert.deepEqual(writing, [], "E2-4's Heby grounding closure must contain zero durable writes");
  }

  /* ── 4. THE AGGREGATE CARRIES NO BOUND ───────────────────────────────────── */
  {
    const code = codeOf(read(AGGREGATE));
    for (const bound of [".limit(", ".offset(", "fetch first", "LIMIT "]) {
      assert.ok(
        !code.includes(bound),
        `${AGGREGATE} must contain no bound (${bound}) — an aggregate that can acquire one is R6B's defect`,
      );
    }
    /*
     * TENANT PREDICATE COUNT, EXACTLY. E2-2 and E2-3 both established that a floor pin cannot tell
     * a removed predicate from a statement that never had one: with two statements each carrying
     * one binding, `>= 1` still passes when one `where` is deleted. Two is the number.
     */
    const bindings = code.match(/\$\{resolved\.tenantId\}/g) ?? [];
    assert.equal(
      bindings.length,
      4,
      "three statements bind the session tenant, and the correlated subquery binds it a fourth time",
    );
    /* Both sides of the `not exists` are tenant-scoped: a neighbour's attempt may not suppress a row. */
    assert.match(code, /not exists[\s\S]*action_execution_attempts[\s\S]*tenant_id[\s\S]*resolved\.tenantId/);
  }

  /* ── 5. LIVE MAP NODE-KIND AND EDGE-KIND DELTA = 0 ───────────────────────── */
  {
    /*
     * REPAIRED: THE CLAIM IS PHASE-RELATIVE, BECAUSE THE ABSOLUTE ONE WAS FALSIFIED.
     *
     * These pinned the unions to `"organization" | "agent"` and `"belongs-to"`, which was the whole
     * of Live Map when E2-4 shipped. LM-1 later DREW this organization's departments and people and
     * added `department`, `human` and `works-in` — so the pins were failing on somebody else's
     * released work while still claiming to be about E2-4.
     *
     * What E2-4 actually claims is that IT added no node kind and no edge kind: it annotates nodes
     * that already exist. That is asserted directly — no attention or intelligence concept is a
     * node kind or a relation — and it stays true however far Live Map grows.
     */
    const contracts = read("src/features/live-map/contracts.ts");
    const nodeKinds = /export type LiveMapNodeKind = ([^;]+);/.exec(contracts);
    const relations = /export type LiveMapRelation = ([^;]+);/.exec(contracts);
    assert.ok(nodeKinds && relations, "the unions are declared where this check says they are");
    for (const forbidden of ["attention", "observation", "intelligence", "attends", "observes"]) {
      assert.ok(
        !nodeKinds![1]!.includes(forbidden),
        `E2-4 adds no node kind — it annotates nodes that already exist (${forbidden})`,
      );
      assert.ok(
        !relations![1]!.includes(forbidden),
        `E2-4 adds no edge kind — an annotation is not a relation (${forbidden})`,
      );
    }
    /* The annotation is its OWN field, never merged into the outcome block. */
    const projection = codeOf(read("src/features/live-map/read-live-map.server.ts"));
    assert.match(projection, /attention: agentAttention\(/);
    assert.match(projection, /intelligence: agentIntelligence\(/);
  }

  /* ── 6. NO PROVIDER CAPABILITY, SCOPE OR CONNECTION ──────────────────────── */
  {
    for (const file of E24_FILES) {
      const code = codeOf(read(file));
      for (const forbidden of ["provider-google", "provider-github", "oauth", "scope", "credential", "fetch("]) {
        assert.ok(
          !code.toLowerCase().includes(forbidden.toLowerCase()),
          `${file} must not reach a provider concern (${forbidden})`,
        );
      }
    }
  }

  /* ── 7. NO URGENCY VOCABULARY IN THE CODE E2-4 PRODUCES ──────────────────── */
  {
    /*
     * SCOPED AND TOKEN-ONLY. Comments and string literals are stripped, because this milestone's
     * own honest prose necessarily contains the words it forbids — "no definition of late" is the
     * denial, and a guard that reads prose fails on the denial while a prose-BLIND guard is the one
     * that catches a real identifier. The rendered prose is banned separately, on word boundaries,
     * in `observation-and-boundaries.ts`.
     */
    for (const file of [...E24_FILES, "src/features/live-map/read-live-map.server.ts"]) {
      const tokens = tokensOf(read(file)).toLowerCase();
      for (const word of ["urgent", "urgency", "priority", "overdue", "severity", "escalate", "sla", "threshold"]) {
        assert.ok(
          !new RegExp(`\\b${word}\\b`).test(tokens),
          `${file} must define no ${word} identifier — that would be a classification E2-4 cannot own`,
        );
      }
    }
    assert.ok(FORBIDDEN_ATTENTION_VOCABULARY.length >= 20, "the ban list is substantive");
  }

  /* ── 8. AGE MAY NOT FEED THE RELEASED `requiresAttention` PREDICATE ──────── */
  {
    /*
     * `ExecutionLedgerEntry.requiresAttention` is a RELEASED concept, derived from status alone.
     * E2-4 introduces durations onto the same surfaces, so the one edit that would quietly turn
     * this milestone into a policy authority is age leaking into that predicate. It does not.
     */
    const ledger = codeOf(read("src/features/action-execution/execution-ledger-projection.server.ts"));
    assert.ok(
      !/attention-observation|elapsedSince|remainingUntil|ElapsedObservation/.test(ledger),
      "the released attention predicate must stay status-derived — no elapsed input may reach it",
    );
    /*
     * AND E2-4 DOES NOT READ THE EXECUTION LEDGER AT ALL. GE-1 pins `readExecutionLedger` to
     * exactly one caller — the `/approvals` route — so the durable record of irreversible acts is
     * read at one place. An earlier draft of this milestone derived an attempt duration from it and
     * broke that pin; the observation was dropped rather than the pin widened.
     */
    for (const file of E24_FILES) {
      assert.ok(
        !codeOf(read(file)).includes("readExecutionLedger"),
        `${file} must not read the execution ledger — GE-1 pins it to the approvals route`,
      );
    }
  }

  /* ── 9. EVERY TIMESTAMP READ NAMES A COLUMN IN THE CLOSED UNION ──────────── */
  {
    const composition = codeOf(read("src/features/attention-observation/read-attention-observation.server.ts"));
    const used = new Set<string>();
    for (const basis of TIMESTAMP_BASES) if (composition.includes(`"${basis}"`)) used.add(basis);
    assert.equal(used.size, 6, "all six bases are used, and no duration is produced without one");
    /* And no elapsed call exists anywhere in E2-4 without a basis argument. */
    for (const file of E24_FILES) {
      const code = codeOf(read(file));
      for (const match of code.matchAll(/(?:elapsedSince|remainingUntil)\(([^;]*?)\)/g)) {
        assert.ok(
          /"[a-z-]+\.[a-z_]+"/.test(match[1]!) || match[1]!.includes("basis") || match[1]!.includes("evaluatedAt,\n"),
          `every duration in ${file} must name its authoritative column`,
        );
      }
    }
  }

  /* ── 10. THE TEST CAN ACTUALLY SEE A VIOLATION ───────────────────────────── */
  {
    /*
     * A firewall that cannot detect the thing it forbids proves nothing. These two assertions fail
     * loudly if the detectors above are looking at the wrong text.
     */
    assert.ok(/\bpgTable\s*\(/.test(codeOf(read("src/db/schema/agent.ts"))), "the schema detector works");
    assert.ok(
      /\.\s*insert\s*\(/.test(codeOf(read("src/features/action-authorization/record-action-request.server.ts"))),
      "the writer detector works",
    );
    assert.ok(collect("src/features/attention-observation").length === 3, "E2-4 owns exactly three new modules");
  }

  console.log("E2-4 firewall: OK");
}

main();
