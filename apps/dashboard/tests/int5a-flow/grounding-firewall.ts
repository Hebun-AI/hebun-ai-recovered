/*
 * INT-5A — THE GROUNDING FIREWALL.
 *
 * ── THE PROPERTY ─────────────────────────────────────────────────────────────
 *
 * Heby gained a source that reports what can be read from connected systems. It must NOT thereby
 * have gained the ability to read them, to re-verify them, or to change them.
 *
 * Three facts, proved structurally rather than promised in prose:
 *
 *   1. NO MODULE REACHABLE FROM HEBY'S GROUNDING ROOTS PERFORMS PROVIDER I/O.
 *      Before INT-5A, exactly one module in Heby's graph could reach the network — the Anthropic
 *      transport. That must still be exactly one. If it ever becomes two, an ordinary Heby answer
 *      has started depending on a third party being up, and that is INT-5B's gate to open, not
 *      this one's.
 *
 *   2. NO MODULE REACHABLE FROM HEBY'S GROUNDING ROOTS WRITES AN INTEGRATION.
 *      This is the reason `integration-read.server.ts` exists. `capability-availability.server.ts`
 *      used to import `listConnections` from the repository, which also exports seven acts that
 *      mutate the connection lifecycle — including the one that attaches a credential.
 *
 *   3. THE INTEGRATION GROUNDING PATH REACHES NO PROVIDER RECORD READER.
 *      A capability state is not a Drive file. The modules that read provider records exist, are
 *      released, and are reachable from pages — and must remain unreachable from Heby.
 *
 * It walks the REAL import graph, following import statements in comment-stripped code, exactly as
 * `tests/g6c-flow/authority-reachability.ts` does. It cannot be satisfied by renaming a file, and a
 * comment that names a forbidden symbol cannot trip it.
 *
 * No database, no network, no key.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Heby's server entry points — everything a user message can reach. */
const HEBY_ROOTS = [
  "src/features/heby-answer/model-answer.server.ts",
  "src/features/heby-commands/read-commands.server.ts",
];

const GROUNDING = "src/features/integration-authority/heby-integration-source.server.ts";
const SEAM = "src/features/integration-authority/capability-availability.server.ts";
const READ_MODULE = "src/features/integration-authority/integration-read.server.ts";
const REPOSITORY = "src/features/integration-authority/integration-repository.server.ts";

/**
 * The ONE module in Heby's graph that is allowed to reach the network, and the reason the count is
 * pinned rather than the paths pattern-matched: a second one arriving is the event this asserts on.
 */
const PERMITTED_NETWORK_MODULE = "src/features/heby-model-live/claude-http-transport.server.ts";

/** Acts that mutate an integration's lifecycle, or read a provider record. */
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

const PROVIDER_RECORD_READERS = [
  "readDriveMetadata",
  "discoverDriveSources",
  "readRepositoryPullRequests",
  "discoverInstallationRepositories",
  "googleAuthorizedCall",
  "githubAuthorizedCall",
  "listDriveFiles",
  "fetchInstallation",
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
    const code = codeOf(read(file));
    for (const match of code.matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

/**
 * Network reach in EXECUTABLE code. Schema modules are table definitions and carry no behaviour.
 *
 * ── WHY THIS IS NOT `fetch\s*\(` ────────────────────────────────────────────
 *
 * It was, and INT-5A's own bite-proof M9 caught it. `provider-google/google-transport.server.ts`
 * never writes `fetch(`: it writes `const doFetch = deps.fetchImpl ?? fetch;` and then calls
 * `doFetch(...)`. A call-shaped pattern therefore reported the single most network-capable module
 * in the provider stack as inert, and the firewall would have let a live Google transport into
 * Heby's graph while passing.
 *
 * The test is now the IDENTITY `fetch`, however it is used — called, aliased, or passed. The
 * lookarounds are what keep `doFetch`, `fetchImpl` and `FetchLike` from matching, so a module that
 * merely accepts an injected transport is not accused of reaching the network itself.
 */
function performsNetworkIo(file: string): boolean {
  if (file.startsWith("src/db/schema/")) return false;
  const code = codeOf(read(file));
  return /(?<![\w.$])fetch(?![\w$])/.test(code) || /globalThis\s*\.\s*fetch/.test(code);
}

function definesAny(file: string, names: readonly string[]): string[] {
  const code = codeOf(read(file));
  return names.filter((n) => new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${n}\\b`).test(code));
}

function writesDatabase(file: string): boolean {
  if (file.startsWith("src/db/schema/")) return false;
  return /\.insert\(|\.update\(|\.delete\(/.test(codeOf(read(file)));
}

function main(): void {
  /* ── 0. THE TEST MUST BE MEASURING SOMETHING ─────────────────────────────── */
  for (const file of [GROUNDING, SEAM, READ_MODULE, REPOSITORY, ...HEBY_ROOTS]) {
    assert.ok(existsSync(path.join(ROOT, file)), `${file} must exist for this test to mean anything`);
  }

  /* ── 1. THE GROUNDING MODULE IS ACTUALLY WIRED ───────────────────────────── */
  {
    const answerGraph = reachableFrom(HEBY_ROOTS[0]!);
    assert.ok(
      answerGraph.has(GROUNDING),
      "the integration grounding source must be reachable from the Heby answer path, or this phase shipped nothing",
    );
    assert.ok(answerGraph.size > 50, `the Heby graph should be substantial, got ${answerGraph.size}`);
  }

  /* ── 2. EXACTLY ONE NETWORK MODULE IN HEBY'S GRAPH, AND IT IS ANTHROPIC ──── */
  {
    for (const root of HEBY_ROOTS) {
      const graph = reachableFrom(root);
      const network = [...graph].filter(performsNetworkIo).sort();
      const permitted = network.filter((f) => f === PERMITTED_NETWORK_MODULE);
      const offenders = network.filter((f) => f !== PERMITTED_NETWORK_MODULE);
      assert.deepEqual(
        offenders,
        [],
        `no module reachable from ${root} may perform network I/O except the Anthropic transport. ` +
          `INT-5A grounds on control-plane state and must never contact a provider.`,
      );
      assert.ok(
        permitted.length <= 1,
        `at most one network module may be reachable from ${root}`,
      );
    }
  }

  /* ── 3. NO INTEGRATION WRITER, AND NO PROVIDER RECORD READER, FROM HEBY ──── */
  {
    for (const root of HEBY_ROOTS) {
      const graph = reachableFrom(root);
      const writerOffenders: string[] = [];
      const readerOffenders: string[] = [];
      const dbWriters: string[] = [];
      for (const file of graph) {
        const w = definesAny(file, INTEGRATION_WRITERS);
        if (w.length > 0) writerOffenders.push(`${file} defines ${w.join(", ")}`);
        const r = definesAny(file, PROVIDER_RECORD_READERS);
        if (r.length > 0) readerOffenders.push(`${file} defines ${r.join(", ")}`);
      }
      assert.deepEqual(writerOffenders, [], `no integration lifecycle writer may be reachable from ${root}`);
      assert.deepEqual(readerOffenders, [], `no provider record reader may be reachable from ${root}`);
      assert.deepEqual(dbWriters, [], "unreachable by construction");
    }
  }

  /* ── 4. THE GROUNDING SUBGRAPH ITSELF WRITES NOTHING ─────────────────────── */
  {
    /*
     * Narrower than (3) and worth stating separately: the whole subgraph under the grounding
     * source — not merely the parts Heby happens to reach — must contain no INSERT, UPDATE or
     * DELETE at all. This is what makes "a Heby answer cannot change an integration" structural.
     */
    const graph = reachableFrom(GROUNDING);
    const writers = [...graph].filter(writesDatabase).sort();
    assert.deepEqual(
      writers,
      [],
      "the integration grounding subgraph must contain no database write of any kind",
    );
    assert.ok(
      !graph.has(REPOSITORY),
      "the grounding path must not reach the integration repository — that is why the reads were split out",
    );
  }

  /* ── 5. THE READ MODULE IS GENUINELY WRITER-FREE ─────────────────────────── */
  {
    const code = codeOf(read(READ_MODULE));
    for (const forbidden of [".insert(", ".update(", ".delete(", "fetch("]) {
      assert.ok(!code.includes(forbidden), `the writer-free read module must not contain "${forbidden}"`);
    }
    for (const writer of INTEGRATION_WRITERS) {
      assert.ok(
        !new RegExp(`export\\s+(?:async\\s+)?function\\s+${writer}\\b`).test(code),
        `the read module must not define ${writer}`,
      );
    }
    /*
     * AND IT IS STILL THE ONLY LISTING. The split relocated the reads; it did not fork them. A
     * second `listConnections` would be the two-interpreters bug the availability seam exists to
     * delete, one layer down.
     */
    assert.ok(
      /export\s+async\s+function\s+listConnections\b/.test(code),
      "the read module owns listConnections",
    );
    assert.ok(
      !/export\s+async\s+function\s+listConnections\b/.test(codeOf(read(REPOSITORY))),
      "the repository must re-export the listing, never redefine it",
    );
  }

  /* ── 6. NO CREDENTIAL ACCESSOR ANYWHERE UNDER THE GROUNDING PATH ─────────── */
  {
    const graph = reachableFrom(GROUNDING);
    const offenders: string[] = [];
    for (const file of graph) {
      const code = codeOf(read(file));
      for (const secret of [
        "ANTHROPIC_API_KEY",
        "EXTERNAL_SEND_API_KEY",
        "GOOGLE_OAUTH_CLIENT_SECRET",
        "HEBUN_INTEGRATION_ENCRYPTION_KEYS",
        "decryptCredential",
        "readIntegrationCredential",
      ]) {
        if (code.includes(secret)) offenders.push(`${file} references ${secret}`);
      }
    }
    assert.deepEqual(offenders, [], "the grounding path must reach no credential accessor and no secret env key");
  }

  /* ── 7. AND NO AUTHORIZATION OR EXECUTION REACH ──────────────────────────── */
  {
    const graph = reachableFrom(GROUNDING);
    const offenders = [...graph].filter((f) =>
      f.startsWith("src/features/action-execution") ||
      f.startsWith("src/features/action-authorization") ||
      f.startsWith("src/features/heby-model-live"),
    );
    assert.deepEqual(
      offenders,
      [],
      "capability is not permission: the grounding path may reach neither authorization, nor execution, nor a model transport",
    );
  }

  console.log("int5a-flow/grounding-firewall: OK");
}

main();
