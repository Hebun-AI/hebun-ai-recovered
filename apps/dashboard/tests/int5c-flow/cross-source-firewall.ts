/*
 * INT-5C — THE CROSS-SOURCE FIREWALL. THE FOURTH ROOT.
 *
 * ── WHAT CHANGED, AND WHAT DID NOT ───────────────────────────────────────────
 *
 * Heby now has four server entry points a person can reach, and they are NOT interchangeable:
 *
 *   model-answer.server.ts            the ordinary answer. Anthropic is the ONLY network module.
 *   read-commands.server.ts           Hebun's own sources. ZERO provider dispatch.
 *   provider-read-commands.server.ts  ONE external provider, read-only, bounded. ZERO Knowledge.
 *   cross-source-commands.server.ts   that same provider read, JOINED against the organization's
 *                                     own human-declared references. NEW.
 *
 * INT-5B1 opened the third root by SPLITTING INT-5A's pin rather than relaxing it. This suite opens
 * the fourth the same way, and the split matters more here than it did there: the new root is the
 * first Heby entry point that touches a provider AND Knowledge in one command, so the guarantee that
 * the OTHER three did not change is the whole reason this is safe.
 *
 * ── THE ONE THING THIS PHASE MUST NEVER HAVE DONE ────────────────────────────
 *
 * Widened `provider-read`. INT-5B1's firewall proves its root reaches no Knowledge module of any
 * kind, by path and by symbol. That file is NOT edited by this phase, and this suite re-asserts the
 * property here too — because the value of a split pin is that a later widening fails a suite named
 * after the phase that would have caused it.
 *
 * It walks the REAL import graph, following import statements in comment-stripped code. It cannot be
 * satisfied by renaming a file, and a comment naming a forbidden symbol cannot trip it.
 *
 * No database, no network, no key.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ANSWER_ROOT = "src/features/heby-answer/model-answer.server.ts";
const READ_ROOT = "src/features/heby-commands/read-commands.server.ts";
const PROVIDER_READ_ROOT = "src/features/heby-commands/provider-read-commands.server.ts";
const CROSS_SOURCE_ROOT = "src/features/heby-commands/cross-source-commands.server.ts";
const JOIN_SEAM = "src/features/knowledge/external-reference-read.server.ts";
const REFERENCE_AUTHORITY = "src/features/knowledge/external-reference-authority.server.ts";
const ACTION = "src/app/(dashboard)/heby/actions.ts";

const ANTHROPIC_TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const GITHUB_TRANSPORT = "src/features/provider-github/github-transport.server.ts";
const GOOGLE_TRANSPORT = "src/features/provider-google/google-transport.server.ts";

/** Acts that change what the organization knows. A provider observation is not Knowledge. */
const KNOWLEDGE_WRITERS = [
  "ingestKnowledgeSource",
  "createKnowledgeNode",
  "insertKnowledgeFact",
  "admitKnowledge",
  "retireKnowledgeSource",
  "recordKnowledgeMutation",
  /* INT-5C: the two acts that can create or remove a declaration. Neither may be reachable. */
  "attachExternalReference",
  "withdrawExternalReference",
  "resolveKnowledgeWriteAuthority",
] as const;

/** Acts that establish or move Governance. */
const GOVERNANCE_WRITERS = [
  "establishGovernanceAuthority",
  "recordDecision",
  "ratifyKnowledgeNode",
  "recordGovernanceDecision",
] as const;

/** Acts that mutate an integration's lifecycle, or verify one. */
const INTEGRATION_WRITERS = [
  "createConnection",
  "disconnectConnection",
  "attachCredentialToConnectionWithin",
  "holdConnectionForProviderRefreshWithin",
  "recordVerifiedConnectionWithin",
  "recordUnverifiedProviderGrantWithin",
  "recordVerificationFailureWithin",
  "verifyConnection",
  "verifyGoogleConnection",
  "verifyGitHubInstallation",
  "connectInstallation",
] as const;

/** Acts that move authorization or perform work. */
const EXECUTION_SYMBOLS = [
  "consumeActionPermit",
  "recordActionRequest",
  "decideActionRequest",
  "revokeActionPermit",
  "executeAction",
  "dispatchExecution",
] as const;

/** Credential access of any kind. */
const CREDENTIAL_SYMBOLS = [
  "withDecryptedSecret",
  "listCredentialMetadata",
  "replaceCredential",
  "replaceCredentialFromProviderRefresh",
  "decryptCredential",
  "readIntegrationCredential",
] as const;

/** Durable conversation / answer-evidence persistence. A joined view is turn-local. */
const PERSISTENCE_SYMBOLS = [
  "toStoredSourceEvidence",
  "appendSourceEvidence",
  "appendHebyMessage",
  "persistHebyAnswer",
] as const;

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

function performsNetworkIo(file: string): boolean {
  if (file.startsWith("src/db/schema/")) return false;
  const code = codeOf(read(file));
  return /(?<![\w.$])fetch(?![\w$])/.test(code) || /globalThis\s*\.\s*fetch/.test(code);
}

function definesAny(file: string, names: readonly string[]): string[] {
  const code = codeOf(read(file));
  return names.filter((n) =>
    new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${n}\\b`).test(code),
  );
}

function offendersIn(graph: Set<string>, names: readonly string[]): string[] {
  const out: string[] = [];
  for (const file of [...graph].sort()) {
    for (const name of definesAny(file, names)) out.push(`${file}:${name}`);
  }
  return out;
}

function main(): void {
  const crossGraph = reachableFrom(CROSS_SOURCE_ROOT);
  const providerGraph = reachableFrom(PROVIDER_READ_ROOT);
  const answerGraph = reachableFrom(ANSWER_ROOT);
  const readGraph = reachableFrom(READ_ROOT);

  /* ── 1. THE NEW ROOT REACHES EXACTLY ONE NETWORK MODULE ──────────────────── */
  {
    const network = [...crossGraph].filter(performsNetworkIo).sort();
    assert.deepEqual(
      network,
      [GITHUB_TRANSPORT],
      "the cross-source root's ONLY network reach is the GitHub transport — not Anthropic, not " +
        "Google, and nothing else",
    );
    assert.ok(!crossGraph.has(ANTHROPIC_TRANSPORT), "no model transport is reachable");
    assert.ok(!crossGraph.has(GOOGLE_TRANSPORT), "no Google transport is reachable");
  }

  /* ── 2. THE KNOWLEDGE HALF IS A READ, AND ONLY A READ ────────────────────── */
  {
    /*
     * THE POSITIVE HALF FIRST. The join really does go through the writer-free seam — a firewall
     * that only forbids things cannot tell "correctly wired" from "not wired at all".
     */
    assert.ok(
      crossGraph.has(JOIN_SEAM),
      "the join goes through the writer-free Knowledge read module",
    );
    /*
     * AND THE AUTHORITY THAT CAN CREATE OR WITHDRAW A DECLARATION IS NOT IN THE GRAPH.
     *
     * This is the INT-5B1 §6 arrangement applied to Knowledge: the read moved to a module that
     * holds no write authority, and THIS is the assertion that makes the move load-bearing rather
     * than tidy. Importing the authority instead would drag `resolveKnowledgeWriteAuthority`,
     * `attachExternalReference` and `withdrawExternalReference` into a Heby root.
     */
    assert.ok(
      !crossGraph.has(REFERENCE_AUTHORITY),
      "the attach/withdraw authority is NOT reachable — a read seam may not carry write authority",
    );
  }

  /* ── 3. NO WRITER OF ANY KIND IS REACHABLE ───────────────────────────────── */
  {
    /* Every crossing at once, not the first one — INT-5B1's diagnostic lesson, kept. */
    const violations: string[] = [];

    const forbiddenDirectories = [
      "src/features/integration-credentials/",
      "src/features/action-execution",
      "src/features/action-authorization/",
      "src/features/knowledge-crud/",
      "src/features/knowledge-ratification/",
      "src/features/governance-audit/",
      "src/features/heby-actions/",
      "src/features/heby-action-inlet/",
      "src/features/heby-model-live/",
    ];
    for (const directory of forbiddenDirectories) {
      const hits = [...crossGraph].filter((f) => f.startsWith(directory));
      if (hits.length > 0) violations.push(`must not reach ${directory} (${hits.sort().join(", ")})`);
    }

    /*
     * `src/features/knowledge/` IS NOT BANNED WHOLESALE HERE, and that is deliberate rather than a
     * relaxation. This root is the one place that legitimately reads a Knowledge declaration, so
     * the ban would be false. What replaces it is stricter than a directory name: an EXACT list of
     * which files under it may appear.
     */
    const knowledgeFiles = [...crossGraph].filter((f) => f.startsWith("src/features/knowledge/")).sort();
    assert.deepEqual(
      knowledgeFiles,
      [
        "src/features/knowledge/external-reference-contracts.ts",
        "src/features/knowledge/external-reference-read.server.ts",
      ],
      "exactly two Knowledge files are reachable: the read seam and its pure contracts. Anything " +
        "else under src/features/knowledge/ is a deliberate edit here",
    );

    if (providerGraph.has("src/features/integration-authority/integration-repository.server.ts")) {
      violations.push("provider graph must not reach the integration repository");
    }
    if (crossGraph.has("src/features/integration-authority/integration-repository.server.ts")) {
      violations.push("cross-source graph must not reach the integration repository");
    }

    const bySymbol: readonly (readonly [string, readonly string[]])[] = [
      ["no Knowledge writer or write authority may be reachable", KNOWLEDGE_WRITERS],
      ["no Governance writer may be reachable", GOVERNANCE_WRITERS],
      ["no integration lifecycle writer may be reachable", INTEGRATION_WRITERS],
      ["no execution or permit act may be reachable", EXECUTION_SYMBOLS],
      ["no credential accessor may be reachable", CREDENTIAL_SYMBOLS],
      ["no answer-evidence persistence may be reachable", PERSISTENCE_SYMBOLS],
    ];
    for (const [message, names] of bySymbol) {
      const offenders = offendersIn(crossGraph, names);
      if (offenders.length > 0) violations.push(`${message} — ${offenders.join("; ")}`);
    }

    assert.deepEqual(violations, [], "the cross-source subgraph crossed a boundary it may not cross");

    /* The positive half: the gated read really is what it goes through. */
    assert.ok(
      crossGraph.has("src/features/integration-authority/capability-availability.server.ts"),
      "the ONE normalized capability seam is in the graph, so the provider read is genuinely gated",
    );
  }

  /* ── 4. THE SUBGRAPH PERSISTS NOTHING ────────────────────────────────────── */
  {
    const writers = [...crossGraph]
      .filter((f) => !f.startsWith("src/db/schema/"))
      .filter((f) => performsDurableWrite(read(f)))
      .sort();
    assert.deepEqual(
      writers,
      [],
      "no module reachable from the cross-source root performs a durable write — the joined view " +
        "is turn-local and the provider record is never stored",
    );
  }

  /* ── 5. THE THREE EXISTING ROOTS DID NOT MOVE ────────────────────────────── */
  {
    /*
     * THE PIN THIS PHASE MOST HAD TO KEEP. `provider-read` still reaches no Knowledge module of any
     * kind — asserted here as well as in INT-5B1's own suite, so that widening it later fails a
     * suite named after the phase that would have caused the widening.
     */
    const providerKnowledge = [...providerGraph]
      .filter((f) => /^src\/features\/knowledge(-|\/)/.test(f))
      .sort();
    assert.deepEqual(
      providerKnowledge,
      [],
      "INT-5B1's root still reaches NO Knowledge module — INT-5C added a sibling instead of " +
        "widening it",
    );
    assert.ok(
      !providerGraph.has(CROSS_SOURCE_ROOT),
      "and the provider-read root does not reach the cross-source root either",
    );

    /*
     * `read` AND `answer` ARE STILL ZERO PROVIDER DISPATCH.
     *
     * MEASURED AS DISPATCH, NOT AS THE WORD "provider". Both roots have always reached
     * `provider-github/contracts.ts` and `provider-google/contracts.ts` — pure catalogs of keys,
     * capability names and shapes, with no transport, no credential and no call in them. Asserting
     * "no file whose path contains provider" would fail on released, unchanged code and would say
     * nothing about dispatch. What may not be reachable is a way to CONTACT somebody: the
     * transports, and the authorized-call and discovery seams that spend one.
     */
    const DISPATCH_SEAMS = [
      GITHUB_TRANSPORT,
      GOOGLE_TRANSPORT,
      "src/features/provider-github/github-authorized-call.server.ts",
      "src/features/provider-github/discover-installation-repositories.server.ts",
    ];
    for (const [label, graph] of [
      ["read", readGraph],
      ["answer", answerGraph],
    ] as const) {
      const providerReach = DISPATCH_SEAMS.filter((f) => graph.has(f)).sort();
      assert.deepEqual(
        providerReach,
        [],
        `the ${label} root still reaches no provider dispatch seam`,
      );
      assert.ok(!graph.has(CROSS_SOURCE_ROOT), `the ${label} root does not reach the cross-source root`);
      assert.ok(!graph.has(GITHUB_TRANSPORT), `the ${label} root does not reach the GitHub transport`);
    }

    /* The answer root's own transport boundary is unchanged. */
    const answerNetwork = [...answerGraph].filter(performsNetworkIo).sort();
    assert.deepEqual(
      answerNetwork,
      [ANTHROPIC_TRANSPORT],
      "the model-answer root's only network module is still Anthropic",
    );
  }

  /* ── 6. THE JOIN SEAM ITSELF IS WRITER-FREE AND PROVIDER-FREE ────────────── */
  {
    const seamGraph = reachableFrom(JOIN_SEAM);
    const network = [...seamGraph].filter(performsNetworkIo).sort();
    assert.deepEqual(
      network,
      [],
      "the Knowledge read seam contacts NOBODY — reading a declaration is not a provider check, and " +
        "a reference may name a record that is gone",
    );
    const writers = [...seamGraph]
      .filter((f) => !f.startsWith("src/db/schema/"))
      .filter((f) => performsDurableWrite(read(f)))
      .sort();
    assert.deepEqual(writers, [], "and it performs no durable write of its own");

    const code = codeOf(read(JOIN_SEAM));
    for (const banned of [".insert(", ".update(", ".delete(", "fetch("]) {
      assert.ok(!code.includes(banned), `the join seam must not contain "${banned}"`);
    }
    /* It reads knowledge_facts and its own table, and names no other. K3 is untouched. */
    assert.ok(!/knowledgeNodes/.test(code), "the join seam never names the knowledge nodes table");
  }

  /* ── 7. EXACTLY TWO HEBY CROSSINGS MAY REACH A PROVIDER ──────────────────── */
  {
    const actions = read(ACTION);
    assert.ok(
      actions.includes("export async function runHebyCrossSourceCommandAction"),
      "the cross-source crossing exists and is its own action",
    );
    /*
     * IT IS A SEPARATE ACTION FROM THE PROVIDER-READ ONE. Sharing an entry point would mean one
     * server module served both, and the Knowledge half would then be reachable from the root
     * INT-5B1 proves it is not reachable from.
     */
    const crossImports = codeOf(read(ACTION));
    assert.ok(
      crossImports.includes("cross-source-commands.server"),
      "and it dispatches into the cross-source module",
    );
  }

  console.log("int5c-flow/cross-source-firewall: OK");
}

main();
