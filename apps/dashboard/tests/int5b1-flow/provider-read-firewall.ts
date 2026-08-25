/*
 * INT-5B1 — THE PROVIDER-READ FIREWALL. THE THIRD ROOT.
 *
 * ── WHAT CHANGED, AND WHAT DID NOT ───────────────────────────────────────────
 *
 * Heby now has three server entry points a person can reach, and they are NOT interchangeable:
 *
 *   model-answer.server.ts          the ordinary answer. Anthropic is the ONLY network module.
 *   read-commands.server.ts         Hebun's own sources. ZERO provider dispatch, unchanged.
 *   provider-read-commands.server.ts  ONE external provider, read-only, bounded. NEW.
 *
 * INT-5A pinned the first two together and reserved the third for this phase. This suite opens it
 * the way INT-5A opened its own: by SPLITTING the pin, not by relaxing it. The two existing roots
 * keep every guarantee they had — asserted here as well as there, because the value of the split is
 * that a widening of the answer path fails a suite named after the phase that would have caused it.
 *
 * It walks the REAL import graph, following import statements in comment-stripped code. It cannot be
 * satisfied by renaming a file, and a comment naming a forbidden symbol cannot trip it.
 *
 * No database, no network, no key.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ANSWER_ROOT = "src/features/heby-answer/model-answer.server.ts";
const READ_ROOT = "src/features/heby-commands/read-commands.server.ts";
const PROVIDER_READ_ROOT = "src/features/heby-commands/provider-read-commands.server.ts";
const ACTION = "src/app/(dashboard)/heby/actions.ts";

/** The one network module each root may reach — and never the other's. */
const ANTHROPIC_TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const GITHUB_TRANSPORT = "src/features/provider-github/github-transport.server.ts";
const GOOGLE_TRANSPORT = "src/features/provider-google/google-transport.server.ts";

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

/** Acts that move authorization or perform work. None may be reachable from a read. */
const EXECUTION_SYMBOLS = [
  "consumeActionPermit",
  "recordActionRequest",
  "decideActionRequest",
  "revokeActionPermit",
  "executeAction",
  "dispatchExecution",
] as const;

/** Acts that change what the organization knows. A provider observation is not Knowledge. */
const KNOWLEDGE_WRITERS = [
  "ingestKnowledgeSource",
  "createKnowledgeNode",
  "insertKnowledgeFact",
  "admitKnowledge",
  "retireKnowledgeSource",
  "recordKnowledgeMutation",
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

/** Provider WRITE seams. None exists today; naming them is how the absence stays proved. */
const PROVIDER_WRITE_SYMBOLS = [
  "createPullRequest",
  "updateRepository",
  "writeDriveFile",
  "sendExternalCommunication",
  "postToProvider",
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

/**
 * Network reach in EXECUTABLE code, by the `fetch` IDENTITY rather than a call shape.
 *
 * INT-5A's own bite-proof exposed why: `google-transport.server.ts` never writes `fetch(` — it
 * writes `const doFetch = deps.fetchImpl ?? fetch;`. The lookarounds keep `doFetch`, `fetchImpl`
 * and `FetchLike` from matching, so a module merely ACCEPTING an injected transport is not accused
 * of reaching the network itself.
 */
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

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

function offendersIn(graph: Set<string>, names: readonly string[]): string[] {
  const offenders: string[] = [];
  for (const file of graph) {
    const hits = definesAny(file, names);
    if (hits.length > 0) offenders.push(`${file} defines ${hits.join(", ")}`);
  }
  return offenders.sort();
}

function main(): void {
  /* ── 0. THE TEST MUST BE MEASURING SOMETHING ─────────────────────────────── */
  for (const file of [ANSWER_ROOT, READ_ROOT, PROVIDER_READ_ROOT, ACTION, GITHUB_TRANSPORT]) {
    assert.ok(existsSync(path.join(ROOT, file)), `${file} must exist for this suite to mean anything`);
  }

  const providerGraph = reachableFrom(PROVIDER_READ_ROOT);
  const answerGraph = reachableFrom(ANSWER_ROOT);
  const readGraph = reachableFrom(READ_ROOT);

  /* ── 1. THE PROVIDER-READ COMMAND IS ACTUALLY WIRED ──────────────────────── */
  {
    assert.ok(
      providerGraph.has("src/features/provider-github/discover-installation-repositories.server.ts"),
      "the provider-read root must reach the released GitHub discovery seam, or this phase shipped nothing",
    );
    assert.ok(providerGraph.has(GITHUB_TRANSPORT), "and, through it, the GitHub transport");
    assert.ok(providerGraph.size > 30, `the provider-read graph should be real, got ${providerGraph.size}`);

    /* And the server action really is the way in. */
    const action = read(ACTION);
    assert.match(action, /runHebyProviderReadCommand\(/, "the fourth action calls the provider-read executor");
    assert.equal(
      (action.match(/runHebyProviderReadCommand\(/g) ?? []).length,
      1,
      "exactly one provider-read dispatch site",
    );
  }

  /* ── 2. EXACTLY ONE NETWORK MODULE PER ROOT, AND EACH IS THE RIGHT ONE ──── */
  {
    const expected: Readonly<Record<string, string>> = {
      [ANSWER_ROOT]: ANTHROPIC_TRANSPORT,
      [READ_ROOT]: ANTHROPIC_TRANSPORT,
      [PROVIDER_READ_ROOT]: GITHUB_TRANSPORT,
    };
    for (const [root, permitted] of Object.entries(expected)) {
      const network = [...reachableFrom(root)].filter(performsNetworkIo).sort();
      assert.deepEqual(
        network,
        [permitted],
        `${root} must reach EXACTLY ONE network module, and it must be ${permitted}`,
      );
    }
  }

  /* ── 3. THE ROOTS DO NOT BLEED INTO EACH OTHER ───────────────────────────── */
  {
    /*
     * THE PIN INT-5A RESERVED FOR THIS PHASE, SPLIT RATHER THAN RELAXED. The ordinary answer path
     * and the ordinary read path must remain incapable of contacting GitHub — that is the whole
     * reason provider-read is a separate kind, a separate module and a separate action.
     */
    for (const [label, graph] of [["answer", answerGraph], ["read", readGraph]] as const) {
      assert.ok(!graph.has(GITHUB_TRANSPORT), `the ${label} path must not reach the GitHub transport`);
      assert.ok(!graph.has(GOOGLE_TRANSPORT), `the ${label} path must not reach the Google transport`);
      assert.ok(
        !graph.has(PROVIDER_READ_ROOT),
        `the ${label} path must not reach the provider-read executor`,
      );
      assert.ok(
        !graph.has("src/features/provider-github/discover-installation-repositories.server.ts"),
        `the ${label} path must not reach a provider record reader`,
      );
    }

    /* And the provider-read path is not a second way to reach the model. */
    assert.ok(
      !providerGraph.has(ANTHROPIC_TRANSPORT),
      "a provider read must not reach the model transport — it is not a model request",
    );
    const providerCode = codeOf(read(PROVIDER_READ_ROOT));
    for (const banned of ["selectModelTransport", "generateHebyModelAnswer", "answerHebyModelRequest", "anthropic"]) {
      assert.ok(!providerCode.includes(banned), `the provider-read executor must not reference "${banned}"`);
    }
  }

  /* ── 4. ONE PROVIDER, NOT TWO ────────────────────────────────────────────── */
  {
    assert.ok(!providerGraph.has(GOOGLE_TRANSPORT), "INT-5B1 is GitHub only — no Google transport");
    const google = [...providerGraph].filter(
      (f) => f.startsWith("src/features/provider-google/") && !f.endsWith("/contracts.ts"),
    );
    assert.deepEqual(
      google,
      [],
      "only Google's pure contracts may appear (via the catalog); no Google behaviour is reachable",
    );
    for (const reader of ["readDriveMetadata", "discoverDriveSources", "readRepositoryPullRequests"]) {
      const offenders = offendersIn(providerGraph, [reader]);
      assert.deepEqual(offenders, [], `the provider-read graph must not reach ${reader}`);
    }
  }

  /* ── 5. NO WRITER OF ANY KIND IS REACHABLE ───────────────────────────────── */
  {
    /*
     * EVERY CROSSING AT ONCE, NOT THE FIRST ONE.
     *
     * This section used to assert boundary by boundary and stop at the first failure, and that hid
     * things twice while this phase was being built: pulling in the credential repository also
     * drags the integration repository, and the integration repository drags the lifecycle audit
     * writer. A reader saw one name and had no way to know that three boundaries had moved.
     *
     * So every violation is collected and reported together. A person reading a failure sees the
     * whole of what arrived, and a bite-proof can name the boundary it actually aimed at.
     */
    const violations: string[] = [];

    /*
     * THE INTEGRATION REPOSITORY, WHICH IS WHY THE NARROWING HAPPENED. `github-authorized-call`
     * used to take `listConnections` from the module that also exports seven lifecycle writers.
     * INT-5B1 moved that one import to the writer-free read module, and this is the assertion that
     * makes the move load-bearing rather than tidy.
     */
    if (providerGraph.has("src/features/integration-authority/integration-repository.server.ts")) {
      violations.push("must not reach the integration repository");
    }

    /*
     * BY PATH AS WELL AS BY SYMBOL. A symbol list only catches what somebody remembered to name;
     * these subsystems must not appear at all, in any form, except as pure table definitions.
     */
    const forbiddenDirectories = [
      "src/features/integration-credentials/",
      "src/features/action-execution",
      "src/features/action-authorization/",
      "src/features/knowledge/",
      "src/features/knowledge-crud/",
      "src/features/knowledge-ratification/",
      "src/features/governance-audit/",
      "src/features/heby-actions/",
      "src/features/heby-action-inlet/",
    ];
    for (const directory of forbiddenDirectories) {
      const hits = [...providerGraph].filter((f) => f.startsWith(directory));
      if (hits.length > 0) violations.push(`must not reach ${directory} (${hits.sort().join(", ")})`);
    }

    const bySymbol: readonly (readonly [string, readonly string[]])[] = [
      [
        "no integration lifecycle writer may be reachable — this is what makes 'a failed GitHub " +
          "read cannot end a tenant's grant' structural",
        INTEGRATION_WRITERS,
      ],
      ["no Knowledge writer may be reachable", KNOWLEDGE_WRITERS],
      ["no execution or permit act may be reachable", EXECUTION_SYMBOLS],
      ["no credential accessor may be reachable", CREDENTIAL_SYMBOLS],
      ["no provider write seam may be reachable", PROVIDER_WRITE_SYMBOLS],
    ];
    for (const [message, names] of bySymbol) {
      const offenders = offendersIn(providerGraph, names);
      if (offenders.length > 0) violations.push(`${message} — ${offenders.join("; ")}`);
    }

    assert.deepEqual(
      violations,
      [],
      "the provider-read subgraph crossed a boundary it may not cross",
    );

    /* The positive half: the gated read really is what it goes through. */
    assert.ok(
      providerGraph.has("src/features/integration-authority/integration-read.server.ts"),
      "it reaches the writer-free read module instead — the capability authority is still consulted",
    );
    assert.ok(
      providerGraph.has("src/features/integration-authority/capability-availability.server.ts"),
      "and the ONE normalized capability seam is in the graph, so the read is genuinely gated",
    );
  }

  /* ── 6. THE SUBGRAPH PERSISTS NOTHING ────────────────────────────────────── */
  {
    const writers = [...providerGraph]
      .filter((f) => !f.startsWith("src/db/schema/"))
      .filter((f) => performsDurableWrite(read(f)))
      .sort();
    assert.deepEqual(
      writers,
      [],
      "the provider-read subgraph must contain no durable write of any kind: no repository is " +
        "stored, cached or synchronized, and a provider read changes nothing on disk",
    );
  }

  /* ── 7. NO PROVIDER-RECORD TABLE EXISTS ANYWHERE ─────────────────────────── */
  {
    const schemaFiles = collect("src/db/schema");
    const tableNames = schemaFiles.flatMap((f) =>
      [...read(f).matchAll(/Table\(\s*"([a-z_]+)"/g)].map((m) => m[1]!),
    );
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .flatMap((f) =>
        [...read(path.join("src/db/migrations", f)).matchAll(/create table (?:if not exists )?"?([a-z_]+)"?/gi)]
          .map((m) => m[1]!),
      );
    const all = [...new Set([...tableNames, ...migrations])];
    assert.ok(all.length > 20, `the schema really is being scanned, got ${all.length} tables`);
    const providerRecordTables = all.filter((t) =>
      /repositor|pull_request|drive_file|provider_record|provider_cache|github_repo/.test(t),
    );
    assert.deepEqual(
      providerRecordTables,
      [],
      "INT-5B1 adds no persistence: there is no table for a repository, a pull request, a Drive " +
        "file, a provider record or a provider cache",
    );
  }

  /* ── 8. THE PROVIDER-READ MODULE OFFERS NO WRITE OF ITS OWN ──────────────── */
  {
    const code = codeOf(read(PROVIDER_READ_ROOT));
    for (const banned of ["fetch(", ".insert(", ".update(", ".delete(", "@/db", "next/cache", "revalidate"]) {
      assert.ok(!code.includes(banned), `the provider-read executor must not contain "${banned}"`);
    }
    const exported = [...code.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_$]+)/g)].map(
      (m) => m[1]!,
    );
    assert.deepEqual(
      exported.sort(),
      ["GITHUB_PROVIDER_READ_BUDGET", "GITHUB_REPOSITORY_READ_PROVENANCE", "githubRepositoryRecordRef", "runHebyProviderReadCommand"].sort(),
      "the module's whole public surface is one executor, one identity builder, one budget and one " +
        "provenance line — a write, a mutator or a second entry point is a deliberate edit here",
    );
  }

  /* ── 9. THE CAPABILITY AUTHORITY DECIDES, BEFORE ANYTHING IS MINTED ─────── */
  {
    /*
     * INT-5B1 does NOT re-implement the capability gate — a second interpreter of connection state
     * is the defect the availability seam exists to prevent. It consumes the released seam, whose
     * ordering IS the security property: nothing is minted until the authority has said this tenant
     * may spend the capability, so a tenant whose organization narrowed a permission cannot cause a
     * token to exist at all.
     *
     * Asserted against the FUNCTION BODY, not the module. A module-wide search would match the
     * import line and could then never fail, which is the shape of assertion this codebase has been
     * caught by before.
     */
    const AUTHORIZED_CALL = "src/features/provider-github/github-authorized-call.server.ts";
    assert.ok(
      providerGraph.has(AUTHORIZED_CALL),
      "the provider-read graph goes through the authorized-call seam",
    );
    const code = codeOf(read(AUTHORIZED_CALL));
    const body = code.slice(code.indexOf("export async function withGitHubInstallationToken"));
    assert.ok(body.length > 200, "the function body was located");

    const gateAt = body.indexOf("getCapabilityAvailability(");
    const mintAt = body.indexOf("mintInstallationAccessToken(");
    const jwtAt = body.indexOf("mintGitHubAppJwt(");
    assert.ok(gateAt > -1, "the capability authority is consulted inside the function body");
    assert.ok(mintAt > -1, "and a token is minted inside it too, or this ordering means nothing");
    assert.ok(gateAt < jwtAt, "the authority is consulted before any assertion is signed");
    assert.ok(gateAt < mintAt, "and before any installation token is minted");

    assert.match(
      body,
      /if \(!entry \|\| entry\.state !== "available" \|\| !source\) \{\s*return \{ ok: false, refusal: "capability-not-available" \};/,
      "an unavailable capability REFUSES here, before anything is spent",
    );

    /* And the connection listing it consults is the writer-free one. */
    assert.match(
      code,
      /from "@\/features\/integration-authority\/integration-read\.server"/,
      "connections are read through the writer-free module",
    );
    assert.ok(
      !code.includes("integration-repository.server"),
      "and never through the module that also exports the lifecycle writers",
    );
  }

  console.log("int5b1-flow/provider-read-firewall: OK");
}

main();
