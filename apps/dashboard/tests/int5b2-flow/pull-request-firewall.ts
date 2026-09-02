/*
 * INT-5B2 — THE STRANDED SEAM IS CONNECTED, AND NOTHING ELSE MOVED.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The GITHUB-4 pull-request seam now travels seam -> command executor -> registry -> server
 *    action -> Heby surface, end to end. And it took nothing with it: no new kind, no new action,
 *    no new source class, no schema, no migration, no provider permission, no model reach, no
 *    Knowledge, no writer, no persistence, and no second GitHub reader."
 *
 * A RELEASED SEAM WITH NO CONSUMER IS NOT A CAPABILITY.
 * A COMMAND WITH NO SURFACE IS NOT PRODUCT REACHABILITY.
 * A PROVIDER READ THAT REACHES THE MODEL IS NOT A PROVIDER READ.
 *
 * Structural assertions run over COMMENT-STRIPPED source, so this capability's own honest prose
 * about what it refuses to do can never satisfy — or trip — a check about what it does.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { codeOf } from "../helpers/durable-write-detector";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration/contracts";
import { HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import { GITHUB_TOKEN_REQUESTED_PERMISSIONS } from "../../src/features/provider-github/github-authorized-call.server";
import { readCommandCapabilityView } from "../../src/features/heby-commands/command-capability-projection.server";
import { GITHUB_REPOSITORY_ACTIVITY_CAPABILITY } from "../../src/features/provider-github/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => codeOf(s);

const EXECUTOR = "src/features/heby-commands/provider-read-commands.server.ts";
const SEAM = "src/features/provider-github/read-repository-pull-requests.server.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";
const ACTION = "src/app/(dashboard)/heby/actions.ts";
const HOOK = "src/components/layout/heby/use-heby-conversation.ts";
const PROJECTION = "src/features/heby-commands/command-capability-projection.server.ts";
const JOURNAL = "src/db/migrations/meta/_journal.json";

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/* ── the import-graph walker, the released shape ── */
function valueEdges(file: string): string[] {
  const source = withoutComments(read(file));
  const specifiers: string[] = [];
  const re = /^\s*(import|export)\s+(type\s+)?((?:(?!\bfrom\b)[\s\S])*?)\s*from\s*["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    if (clause.includes("=")) continue;
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) continue;
    specifiers.push(m[4]!);
  }
  return specifiers;
}
function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const abs = path.join(ROOT, c);
    if (existsSync(abs) && statSync(abs).isFile()) return c;
  }
  return null;
}
function graphFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of valueEdges(file)) {
      const r = resolveSpecifier(file, spec);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. THE SEAM IS NO LONGER STRANDED — AND IT IS CONSUMED, NOT COPIED.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const consumers = walk("src")
      .filter((file) => file !== SEAM)
      .filter((file) => withoutComments(read(file)).includes("readRepositoryPullRequests"));
    assert.deepEqual(
      consumers,
      [EXECUTOR],
      "exactly ONE consumer of the released seam, and it is the command executor",
    );

    const executor = withoutComments(read(EXECUTOR));
    /*
     * IT DOES NOT RE-IMPLEMENT THE READ. The transport calls and the installation-listing proof
     * belong to the seam; the executor naming either would be a second interpreter of the rule that
     * a repository id is a claim until GitHub's listing names it.
     */
    for (const forbidden of ["listOpenPullRequests", "listInstallationRepositories", "withGitHubInstallationToken"]) {
      assert.ok(!executor.includes(forbidden), `the executor does not re-implement the read: ${forbidden}`);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. NO CONTENT CAN BE SURFACED. THE SHAPE HAS NO HOLE FOR IT.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const seam = withoutComments(read(SEAM));
    for (const field of ['"patch"', '"diff"', '"body"', '"files"', '"commits"', "head.sha"]) {
      assert.ok(!seam.includes(field), `the released seam still carries no ${field}`);
    }
    /*
     * FIELD-SHAPED, NEVER BARE WORDS. The first version of this check banned the substring `patch`
     * and tripped on `dispatch` in the executor's own dispatch switch — the substring trap this
     * repository keeps recording. What must be absent is a FIELD ACCESS or a KEY, so that is what
     * is matched.
     */
    const executor = withoutComments(read(EXECUTOR));
    for (const field of ["patch", "diff", "body", "files", "commits", "sha"]) {
      const shapes = [
        new RegExp(`\\.${field}\\b`),
        new RegExp(`["']${field}["']`),
        new RegExp(`\\b${field}\\s*:`),
      ];
      for (const shape of shapes) {
        assert.ok(!shape.test(executor), `the command surfaces no ${field} (${shape})`);
      }
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. NO NEW PROVIDER PERMISSION. THE GRANT IS THE ONE ALREADY MADE.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    assert.deepEqual(
      { ...GITHUB_TOKEN_REQUESTED_PERMISSIONS },
      { metadata: "read", pull_requests: "read" },
      "INT-5B2 widens no token permission — these two are what GITHUB-4 already asked for",
    );
    const executor = withoutComments(read(EXECUTOR));
    for (const scope in { contents: 1, issues: 1, actions: 1, administration: 1, members: 1 }) {
      assert.ok(!executor.includes(scope), `the executor asks for no ${scope} permission`);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE CAPABILITY BINDING IS THE SAME KEY, AND IT IS COMPLETE.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const view = await readCommandCapabilityView({ tenantId: "t-1", userId: "u-1" } as unknown as TenantContext, {
      readCapabilityAvailability: async () =>
        ({
          status: "available",
          capabilities: [
            { capability: GITHUB_REPOSITORY_ACTIVITY_CAPABILITY, state: "available", detail: "Usable." },
          ],
        }) as never,
      readProviderOps: async () => ({ state: "AVAILABLE" }) as never,
    });
    const entry = view.entries.find((e) => e.commandId === "pull-requests");
    assert.ok(entry, "the projection accounts for the new command — silence would read as unknown");
    assert.ok(
      withoutComments(read(PROJECTION)).includes('"pull-requests": GITHUB_REPOSITORY_ACTIVITY_CAPABILITY'),
      "and it binds the SAME capability key, never a second one implying a second grant",
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. NO MODEL, NO KNOWLEDGE, NO WRITER, NO PERSISTENCE.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const graph = graphFrom(EXECUTOR);
    for (const forbidden of [
      "src/features/heby-model-live/claude-http-transport.server.ts",
      "src/features/heby-answer/model-answer.server.ts",
    ]) {
      assert.ok(!graph.has(forbidden), `a provider read must not reach ${forbidden}`);
    }
    const knowledge = [...graph].filter((f) => /^src\/features\/knowledge/.test(f));
    assert.deepEqual(knowledge, [], "nothing this command reads can become organizational Knowledge");
    const writers = [...graph].filter((f) => /\/write-[a-z-]+\.server\.ts$/.test(f));
    assert.deepEqual(writers, [], "the executor's graph reaches no writer");

    const executor = withoutComments(read(EXECUTOR));
    for (const banned of ["fetch(", ".insert(", ".update(", ".delete(", "@/db", "next/cache", "revalidate", "Date.now("]) {
      assert.ok(!executor.includes(banned), `the executor must not contain "${banned}"`);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. ZERO SCHEMA, ZERO MIGRATION, ZERO PERSISTENCE OF A PULL REQUEST.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const journal = JSON.parse(read(JOURNAL)) as { entries: readonly { tag: string }[] };
    assert.equal(journal.entries.length, 45, "the ledger is UNCHANGED — this capability adds no migration"); /* WEV-1 grew the ledger 44 -> 45: the `work_evidence_references` table. */
    /*
     * PHASE-RELATIVE, NOT ABSOLUTE. Pinning "the newest migration is X" is falsified by the next
     * phase that authors one, and the claim this file is making is about INT-5B2: it authored
     * none. That is what is asserted, and it stays true however far the ledger grows.
     */
    assert.equal(
      journal.entries.filter((entry) => /int5b2|pull_request/i.test(entry.tag)).length,
      0,
      "no migration in the ledger bears this capability's name",
    );
    assert.ok(
      !walk("src/db/schema").some((f) => /pull_?request|pullrequest/i.test(path.basename(f))),
      "there is no table for a pull request, and there is no writer that could fill one",
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. NO NEW HEBY SOURCE CLASS. A PROVIDER READ IS A COMMAND, NOT GROUNDING.
   *
   * Deliberate, and the reason is the whole design: grounding classes carry standing organizational
   * truth into EVERY model answer. Live provider data behind one would make each answer contact
   * GitHub and would dress somebody else's records as this organization's own.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    assert.equal(HEBY_SOURCE_CLASSES.length, 20, "the source-class census is unchanged by INT-5B2");
    for (const forbidden of ["pull-requests", "pull_requests", "repositories", "github"]) {
      assert.ok(
        !(HEBY_SOURCE_CLASSES as readonly string[]).includes(forbidden),
        `no ${forbidden} source class was added`,
      );
    }
    const answer = withoutComments(read("src/features/heby-answer/model-answer.server.ts"));
    assert.ok(
      !answer.includes("readRepositoryPullRequests") && !answer.includes("pull-requests"),
      "the ordinary answer path gains no GitHub reach",
    );
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. PRODUCT REACHABILITY: REGISTRY -> ACTION -> SURFACE, AND ONE ENTRY POINT.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    assert.ok(
      withoutComments(read(REGISTRY)).includes('id: "pull-requests", slash: "/pull-requests"'),
      "the command is declared in the closed registry",
    );

    /* NO NEW SERVER ACTION. The released provider-read action is the only door. */
    const action = withoutComments(read(ACTION));
    const providerActions = [...action.matchAll(/export async function (runHeby\w*ProviderRead\w*Action)/g)];
    assert.equal(providerActions.length, 1, "exactly one provider-read server action, as released");
    assert.ok(!action.includes("PullRequest"), "INT-5B2 added no action of its own");

    /* THE SURFACE TELLS THE READER WHICH READ IS HAPPENING. */
    const hook = read(HOOK);
    assert.match(hook, /plan\.commandId === "pull-requests"/,
      "the placeholder is per command — a reader is never told the wrong thing is happening");
    assert.match(hook, /Metadata only — titles, numbers, authors and timestamps/,
      "and it says what will NOT be read, before it happens");

    /* THE CLIENT COMPOSES NO PROVIDER SENTENCE. */
    const hookCode = withoutComments(hook);
    for (const banned of ["readRepositoryPullRequests", "openPullRequests", "githubPullRequestRecordRef"]) {
      assert.ok(!hookCode.includes(banned), `the client holds no provider data shape: ${banned}`);
    }
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 9. EVERY REACHING COMMAND DECLARES ITS REACH, IN BOTH DIRECTIONS.
   * ═══════════════════════════════════════════════════════════════════════ */
  for (const command of HEBY_COMMANDS) {
    const reaches = command.kind === "provider-read" || command.kind === "cross-source-read";
    assert.equal(
      command.reachesProvider === true,
      reaches,
      `${command.id}: reachesProvider must be true exactly for provider-reaching commands`,
    );
    if (command.id === "pull-requests") {
      assert.equal(command.requiresModel, false);
      assert.equal(command.safeWhenProviderOff, true, "it uses no model, so the model switch is irrelevant to it");
    }
  }

  console.log("PASS int5b2-flow/pull-request-firewall");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
