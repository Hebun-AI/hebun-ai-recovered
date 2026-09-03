/*
 * CGO-5 — THE PROVIDER-OBSERVATION FIREWALL. Walks the REAL import graph from the new root.
 *
 * The root may reach the credential READ seams — that is why it exists as a separate kind — and
 * must reach nothing that writes, decides, executes, admits, or talks to another provider. The
 * released provider-read root must not have gained YouTube by accident either.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import { YOUTUBE_FORBIDDEN_FRAGMENTS } from "../../src/features/provider-youtube/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const OBSERVATION_ROOT = "src/features/heby-commands/provider-observation-commands.server.ts";
const PROVIDER_READ_ROOT = "src/features/heby-commands/provider-read-commands.server.ts";
const CROSS_SOURCE_ROOT = "src/features/heby-commands/cross-source-commands.server.ts";
const READ_ROOT = "src/features/heby-commands/read-commands.server.ts";
const ACTION = "src/app/(dashboard)/heby/actions.ts";
const YOUTUBE_TRANSPORT = "src/features/provider-youtube/youtube-transport.server.ts";
const GITHUB_TRANSPORT = "src/features/provider-github/github-transport.server.ts";
const GOOGLE_TRANSPORT = "src/features/provider-google/google-transport.server.ts";
const ANTHROPIC_TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const CREDENTIAL_REPO = "src/features/integration-credentials/credential-repository.server.ts";

const INTEGRATION_WRITERS = [
  "createConnection", "disconnectConnection", "attachCredentialToConnectionWithin",
  "holdConnectionForProviderRefreshWithin", "recordVerifiedConnectionWithin",
  "recordUnverifiedProviderGrantWithin", "recordVerificationFailureWithin", "verifyConnection",
  "verifyGoogleConnection", "verifyGitHubInstallation", "connectInstallation", "verifyYouTubeConnection",
] as const;
const CREDENTIAL_WRITERS = ["storeCredential", "replaceCredential", "replaceCredentialFromProviderRefresh", "revokeCredential", "destroyCredential"] as const;
const KNOWLEDGE_WRITERS = ["ingestKnowledgeSource", "createKnowledgeNode", "insertKnowledgeFact", "admitKnowledge", "retireKnowledgeSource", "recordKnowledgeMutation", "attachExternalReference"] as const;
const EXECUTION_SYMBOLS = ["consumeActionPermit", "recordActionRequest", "decideActionRequest", "revokeActionPermit", "executeAction", "dispatchExecution"] as const;
const WORK_ARTIFACT_WRITERS = ["createWorkArtifactFromHebyPreparation", "reviseWorkArtifactFromHebyPreparation", "prepareWorkArtifact"] as const;

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? path.join("src", spec.slice(2)) : spec.startsWith(".") ? path.join(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) return candidate;
  }
  return null;
}
/**
 * Walk the import graph. `stopAt` names files that are ENTERED but not traversed: the released
 * credential authority is one module that defines both the read seams this root needs and the
 * writers it must never use, so the honest statement is "every writer reachable from here is
 * reachable only THROUGH that authority" — proved by walking everything except its own imports.
 */
function reachableFrom(entry: string, stopAt: readonly string[] = []): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (stopAt.includes(file)) continue;
    for (const match of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}
function definesAny(file: string, names: readonly string[]): string[] {
  const code = codeOf(read(file));
  return names.filter((n) => new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+${n}\\b`).test(code));
}
function offendersIn(graph: Set<string>, names: readonly string[]): string[] {
  const out: string[] = [];
  for (const file of graph) {
    const hits = definesAny(file, names);
    if (hits.length > 0) out.push(`${file} defines ${hits.join(", ")}`);
  }
  return out;
}
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.isFile() && /\.tsx?$/.test(p) ? [p] : [];
  });
}

function main(): void {
  const full = reachableFrom(OBSERVATION_ROOT);
  /* The graph with the credential authority's OWN imports excluded — see `reachableFrom`. */
  const graph = reachableFrom(OBSERVATION_ROOT, [CREDENTIAL_REPO]);
  const violations: string[] = [];

  /* ── 1. IT REACHES YOUTUBE, AND ONLY YOUTUBE ── */
  assert.ok(graph.has(YOUTUBE_TRANSPORT), "the observation root reaches the YouTube transport");
  for (const [label, file] of [["GitHub", GITHUB_TRANSPORT], ["Google", GOOGLE_TRANSPORT], ["Anthropic", ANTHROPIC_TRANSPORT]] as const) {
    if (graph.has(file)) violations.push(`must not reach the ${label} transport`);
  }
  assert.ok(full.has(CREDENTIAL_REPO), "it MAY reach the credential authority — that is why it is a separate kind");
  /*
   * WHAT THE CREDENTIAL AUTHORITY BRINGS WITH IT IS ITS OWN. `credential-repository.server.ts`
   * imports the lifecycle repository (to demote a connection when a secret is supplied) and the
   * audit writer. Those are reachable from here ONLY through it, and this root calls none of
   * them: the token scan in section 5 proves no writer name appears in any file this phase owns.
   * Splitting the authority's read seams into a writer-free module (the INT-5B1 shape) is
   * recorded debt, not done here — it is the encrypted credential store, and 23 released tests
   * pin it by path.
   */
  const throughCredentialAuthorityOnly = [...full].filter((f) => !graph.has(f));
  for (const f of throughCredentialAuthorityOnly) {
    assert.ok(
      f.startsWith("src/features/integration-authority/") || f.startsWith("src/features/governance-audit/") || f.startsWith("src/db/") || f.startsWith("src/features/secret-encryption/") || f.startsWith("src/features/integration-credentials/") || f.startsWith("src/features/auth/") || f.startsWith("src/features/provider-catalog/") || f.startsWith("src/features/provider-github/") || f.startsWith("src/features/provider-google/"),
      `${f} is reachable only through the credential authority and is not a module this phase should have pulled in`,
    );
  }

  /* ── 2. NO WRITER OF ANY KIND ── */
  for (const [message, names] of [
    ["no integration lifecycle writer", INTEGRATION_WRITERS],
    ["no credential writer", CREDENTIAL_WRITERS],
    ["no Knowledge writer", KNOWLEDGE_WRITERS],
    ["no execution or permit act", EXECUTION_SYMBOLS],
    ["no work-artifact writer", WORK_ARTIFACT_WRITERS],
  ] as const) {
    /* The credential authority itself is entered (its read seams are used) but it defines the
     * credential writers; it is excluded here and covered by the token scan in section 5. */
    const offenders = offendersIn(new Set([...graph].filter((f) => f !== CREDENTIAL_REPO)), names);
    if (offenders.length > 0) violations.push(`${message} — ${offenders.join("; ")}`);
  }
  for (const directory of [
    "src/features/action-execution", "src/features/action-authorization/", "src/features/knowledge/",
    "src/features/knowledge-crud/", "src/features/knowledge-ratification/", "src/features/governance-audit/",
    "src/features/heby-actions/", "src/features/heby-action-inlet/", "src/features/heby-model-live/",
    "src/features/heby-answer/", "src/features/work-artifacts/", "src/features/agent-origination/",
  ]) {
    const hits = [...graph].filter((f) => f.startsWith(directory));
    if (hits.length > 0) violations.push(`must not reach ${directory} (${hits.sort().join(", ")})`);
  }
  if (graph.has("src/features/integration-authority/integration-repository.server.ts")) {
    violations.push("must not reach the integration lifecycle repository (the writer-free read module is enough)");
  }
  assert.deepEqual(violations, [], "provider-observation firewall");

  /* ── 3. THE RELEASED ROOTS DID NOT GAIN YOUTUBE ── */
  for (const root of [PROVIDER_READ_ROOT, CROSS_SOURCE_ROOT, READ_ROOT]) {
    const g = reachableFrom(root);
    /* The catalog names every provider's PURE contracts; that is data, not reach. The transport,
     * the key seam, the verifier and the observation read must stay unreachable from them. */
    const reached = [...g].filter((f) => f.startsWith("src/features/provider-youtube/") && f !== "src/features/provider-youtube/contracts.ts");
    assert.deepEqual(reached, [], `${root} does not reach provider-youtube beyond its pure contracts`);
  }

  /* ── 4. THE TRANSPORT IS LIST-ONLY, GET-ONLY, AND SILENT ── */
  {
    const transport = codeOf(read(YOUTUBE_TRANSPORT));
    for (const fragment of YOUTUBE_FORBIDDEN_FRAGMENTS) {
      assert.ok(!transport.includes(`"${fragment}"`) && !transport.includes(`'${fragment}'`), `the transport names no "${fragment}"`);
    }
    assert.ok(!/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(transport), "no non-GET method");
    assert.ok(!/console\./.test(transport), "the transport logs nothing — a URL carries the key");
    assert.ok(!/JSON\.stringify\(url|url\.toString\(\)\s*[,)]\s*$/m.test(transport), "the URL is never serialised into a value that leaves");
    for (const file of walk("src/features/provider-youtube")) {
      const code = codeOf(read(file));
      assert.ok(!/console\./.test(code), `${file} logs nothing`);
      assert.ok(!/\.insert\(|\.update\(|\.delete\(|@\/db\/schema/.test(code), `${file} touches no table`);
      assert.ok(!/process\.env\.HEBUN_YOUTUBE_API_KEY|HEBUN_YOUTUBE/.test(code), `${file} reads no key from the environment — the store is the only source`);
    }
  }

  /* ── 5. THE EXECUTOR OFFERS NO WRITE AND NO SECOND ENTRY POINT ── */
  {
    /* No file this phase owns names a writer, as a token — string literals stripped first. */
    const owned = [OBSERVATION_ROOT, ...walk("src/features/provider-youtube")];
    const stripped = (src: string) => codeOf(src).replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
    for (const file of owned) {
      const code = stripped(read(file));
      for (const name of [...INTEGRATION_WRITERS.filter((n) => n !== "verifyYouTubeConnection"), ...CREDENTIAL_WRITERS, ...KNOWLEDGE_WRITERS, ...EXECUTION_SYMBOLS, ...WORK_ARTIFACT_WRITERS]) {
        assert.ok(!new RegExp(`\\b${name}\\b`).test(code), `${file} names the writer ${name}`);
      }
    }
    /* The verifier is the one owned file that names a lifecycle concept, and it names none of the writers either. */
    const verifier = stripped(read("src/features/provider-youtube/verify-youtube-connection.server.ts"));
    assert.ok(!/recordVerifiedConnectionWithin|recordVerificationFailureWithin/.test(verifier), "the verifier produces facts; the ceremony records them");
    const code = codeOf(read(OBSERVATION_ROOT));
    for (const banned of ["fetch(", ".insert(", ".update(", ".delete(", "@/db", "next/cache", "revalidate", "withDecryptedSecret", "listCredentialMetadata"]) {
      assert.ok(!code.includes(banned), `the observation executor must not contain "${banned}"`);
    }
    const exported = [...code.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]!).sort();
    assert.deepEqual(exported, [
      "OBSERVATION_FAILURE_LINES",
      "OBSERVATION_REFUSAL_LINES",
      "YOUTUBE_OBSERVATION_BUDGET",
      "YOUTUBE_PUBLIC_OBSERVATION_PROVENANCE",
      "runHebyProviderObservationCommand",
      "youtubeChannelRecordRef",
      "youtubeVideoRecordRef",
    ]);
    const action = codeOf(read(ACTION));
    assert.match(action, /runHebyProviderObservationCommand\(/, "the action calls the observation executor");
  }

  /* ── 6. EXACTLY ONE OBSERVATION COMMAND, AND IT DECLARES ITS REACH ── */
  {
    const observation = HEBY_COMMANDS.filter((c) => c.kind === "provider-observation");
    assert.deepEqual(observation.map((c) => c.id), ["youtube-channel"], "one provider-observation command ships");
    assert.equal(observation[0]!.reachesProvider, true);
    assert.equal(observation[0]!.requiresModel, false);
    assert.equal(observation[0]!.requiresExecution, false);
    assert.equal(observation[0]!.args.length, 1, "the handle is the one argument");
    assert.ok(observation[0]!.args[0]!.pattern, "and it is shape-checked before any server call");
    assert.equal(HEBY_COMMANDS.filter((c) => c.kind === "provider-read").length, 2, "the two GitHub reads are untouched");
  }

  /* ── 7. NO PERSISTENCE ARRIVED: no table for a channel, a video, or an observation ── */
  {
    const schema = walk("src/db/schema").map((f) => path.basename(f));
    assert.ok(!schema.some((f) => /youtube|channel|video|observation/i.test(f)), "no YouTube table");
    assert.equal(readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).length, 47, "ledger unchanged at 47");
  }

  console.log("PASS cgo5 provider-observation firewall");
}

main();
