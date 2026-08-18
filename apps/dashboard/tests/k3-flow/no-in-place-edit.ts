/*
 * K3 — the structural guarantees: correction is supersession, and nothing else.
 *
 * The real risk with versioning is not that the first implementation edits in place — it is that a
 * later one quietly does, because "just update the statement" is always the shorter patch. These
 * proofs run over the shipped source so that shortcut fails the build.
 *
 * Also pinned: no delete, no rollback, no ratification, no new slash command, no Heby write path,
 * and no fine-grained permission invented for the correction.
 *
 * Structural + injected. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { validateSupersedeKnowledge } from "../../src/features/knowledge/supersede-contracts";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { KNOWLEDGE_MUTATION_ACTIONS } from "../../src/features/governance-audit/contracts";
import { HEBY_COMMANDS } from "../../src/features/heby-commands";
import type { DurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const read = (path: string) => readFileSync(path, "utf8");

const WRITER = "src/features/knowledge/durable-knowledge-writer.server.ts";
const SUPERSEDE = "src/features/knowledge/knowledge-supersede.server.ts";
const CONTRACTS = "src/features/knowledge/supersede-contracts.ts";
const HISTORY = "src/features/knowledge/knowledge-version-history.server.ts";
const ACTION = "src/app/(dashboard)/knowledge/actions.ts";
const CONTROL = "src/components/knowledge-workspace/knowledge-version-control.tsx";
const K3_MODULES = [SUPERSEDE, CONTRACTS, HISTORY];

function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(path) ? [path] : [];
  });
}

function tenant(): TenantContext {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "33333333-3333-4333-8333-333333333333",
    sessionContextId: "44444444-4444-4444-8444-444444444444",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "req",
    authenticatedAt: "2026-08-11T00:00:00.000Z",
  };
}

const FACT_ID = "55555555-5555-4555-8555-555555555555";
const VALID = { factId: FACT_ID, title: "Corrected", statement: "Corrected statement.", observedKnowledgeVersion: 1 };

function stubWriter(overrides: Partial<DurableKnowledgeWriter> = {}): DurableKnowledgeWriter {
  return {
    async createFact() {
      throw new Error("not exercised");
    },
    async supersedeFact() {
      throw new Error("not exercised");
    },
    ...overrides,
  };
}

async function main(): Promise<void> {
  /* ── 11. THE ONLY NODE MUTATION IS AN INSERT ────────────────────────────
   * `knowledge_nodes` may be inserted and read. It may never be updated: the moment a node's
   * statement can be rewritten, "history" stops meaning anything.
   */
  {
    /*
     * ONE PRE-EXISTING EXCEPTION, AND IT IS DOUBLE-GUARDED.
     *
     * `persistence/supabase-postgres-adapter.ts` — legacy collection persistence, written long before
     * K1 — contains an `update knowledge_nodes ... set statement = ...` for the "knowledge-nodes"
     * collection. That is an in-place content edit, and if it could reach a canonical Knowledge node
     * it would destroy K3's core invariant. It cannot, for two independent reasons, and this test
     * pins BOTH so neither can quietly disappear:
     *
     *   1. NOT ROUTED. `persistence/storage-manager.ts` resolves every collection to the in-memory
     *      adapter; the postgres branch is commented out. Nothing routes "knowledge-nodes" to it.
     *   2. NOT ADDRESSABLE. Its update is keyed on `(tenant_id, ref_id)`, and canonical K1/K2/K3
     *      nodes are written with no `ref_id` at all — so the predicate cannot match one.
     *
     * This is recorded as a hazard in the K3 closure doc, not as a passing grade.
     */
    const LEGACY_ADAPTER = "src/features/persistence/supabase-postgres-adapter.ts";
    /*
     * ONE DELIBERATE EXCEPTION, ADDED BY K4 AND CONSTRAINED BY THE ASSERTION BELOW.
     *
     * `knowledge-ratification/ratify-version.server.ts` updates a node exactly once, to write the
     * Governance ratification linkage — decision id, session id, ratifying actor, ratified-at —
     * onto the exact version a Governance decision named. That is NOT an in-place content edit and
     * it does not weaken K3's invariant: the statement, the label, the version counter, the
     * supersession link and the authorship are all untouched, which the column-level assertion
     * below pins. A correction is still a NEW version, always.
     */
    const RATIFICATION_WRITER = "src/features/knowledge-ratification/ratify-version.server.ts";
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const normalized = file.replace(/\\/g, "/");
      if (normalized === LEGACY_ADAPTER || normalized === RATIFICATION_WRITER) continue;
      const code = codeOf(read(file));
      // Any drizzle update whose target is the nodes table.
      if (/\.update\(\s*knowledgeNodes\s*\)/.test(code)) offenders.push(normalized);
      // …or raw SQL doing the same.
      if (/update\s+knowledge_nodes/i.test(code)) offenders.push(normalized);
    }
    assert.deepEqual(
      offenders,
      [],
      "only the ratification writer updates a knowledge node — corrections insert a new one",
    );

    /*
     * And the exception is bounded by WHICH COLUMNS it may write. If a content column ever appears
     * in that `.set({ ... })`, K3's invariant has been broken through K4's door.
     */
    const ratifyCode = codeOf(read(RATIFICATION_WRITER));
    const setBlock = /\.update\(knowledgeNodes\)\s*\.set\(\{([\s\S]*?)\}\)/.exec(ratifyCode);
    assert.ok(setBlock, "the ratification update sets its columns in one literal");
    const written = [...setBlock![1]!.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
    assert.deepEqual(
      written,
      [
        "governanceSessionId",
        "ratificationDecisionId",
        "ratifiedAt",
        "ratifiedByActorId",
        "ratifiedByActorType",
        "updatedAt",
        "updatedBy",
        "updatedByType",
      ],
      "ratification writes Governance linkage and update attribution — never content, version, or lineage",
    );

    // GUARD 1 — the legacy adapter is not routed to any collection.
    const storage = codeOf(read("src/features/persistence/storage-manager.ts"));
    assert.ok(
      !/case\s+"postgres"\s*:/.test(storage),
      "the postgres branch stays unrouted; enabling it would expose the legacy in-place node edit",
    );
    assert.match(storage, /createMemoryAdapter<T>/, "collections resolve to the in-memory adapter");

    // GUARD 2 — the legacy update is ref_id-keyed, and canonical nodes carry no ref_id.
    const legacy = read(LEGACY_ADAPTER);
    assert.match(
      legacy,
      /update knowledge_nodes[\s\S]*?where tenant_id = \$1 and ref_id = \$2/,
      "the legacy update is addressable only by ref_id",
    );
    const writerSource = read(WRITER);
    assert.ok(!writerSource.includes("refId"), "canonical Knowledge writes set no ref_id, so they are unreachable by it");

    // The writer's ONLY update targets the fact's SELECTION, never node content.
    const writerCode = codeOf(read(WRITER));
    const updates = [...writerCode.matchAll(/\.update\(\s*(\w+)\s*\)/g)].map((m) => m[1]!);
    assert.deepEqual(updates, ["knowledgeFacts"], "the sole update moves the active selection");
    // And that update touches no content column.
    for (const contentColumn of ["statement:", "label:", "knowledgeVersion:", "supersedesKnowledgeNodeId:"]) {
      const setBlock = writerCode.slice(writerCode.indexOf(".update("), writerCode.indexOf(".where("));
      assert.ok(!setBlock.includes(contentColumn), `the selection update must not set "${contentColumn}"`);
    }
  }

  /* ── 12. THE COMPARE-AND-SWAP IS SERVER-OWNED ──────────────────────────── */
  {
    const writerCode = read(WRITER);
    assert.match(
      writerCode,
      /eq\(knowledgeFacts\.factVersion, fact\.factVersion\)/,
      "the update is conditional on the version the SERVER read",
    );
    assert.match(
      writerCode,
      /eq\(knowledgeFacts\.activeKnowledgeNodeId, prior\.id\)/,
      "and on the active node it observed",
    );
    assert.match(writerCode, /swapped\.length !== 1/, "zero matched rows is treated as a conflict");

    /*
     * The client INPUT carries no version. Scoped to the input interfaces on purpose: the READ view
     * (`KnowledgeVersionView`) legitimately reports a version number — reporting one is not the same
     * as accepting one.
     */
    const contracts = codeOf(read(CONTRACTS));
    const inputBlock = contracts.slice(
      contracts.indexOf("interface SupersedeKnowledgeInput"),
      contracts.indexOf("interface KnowledgeVersionView"),
    );
    /*
     * `observedKnowledgeVersion` is the ONE version-shaped field the input carries, and it is a
     * precondition rather than authority: it can only cause a refusal. Everything that could SELECT
     * a row or grant something stays absent.
     */
    for (const banned of [
      "expectedFactVersion", "factVersion", "activeNodeId", "priorNodeId",
      "tenantId", "actorId", "roleId",
    ]) {
      assert.ok(!inputBlock.includes(banned), `the correction input must not carry "${banned}"`);
    }
    assert.ok(inputBlock.includes("observedKnowledgeVersion"), "the observed version is a declared precondition");
    // A forged observed version can only make the request FAIL — never succeed or overwrite more.
    const forgedHigh = validateSupersedeKnowledge({ ...VALID, observedKnowledgeVersion: 999 });
    assert.equal(forgedHigh.ok, true, "it is accepted syntactically…");
    if (!forgedHigh.ok) throw new Error("unreachable");
    assert.equal(forgedHigh.value.observedKnowledgeVersion, 999, "…and carried verbatim to be compared");
    // Missing or nonsensical → refused, never assumed current.
    for (const bad of [undefined, 0, -1, 1.5, "1"]) {
      const invalid = validateSupersedeKnowledge({ ...VALID, observedKnowledgeVersion: bad });
      assert.equal(invalid.ok, false, `observedKnowledgeVersion ${String(bad)} is refused`);
    }
    const validated = validateSupersedeKnowledge({
      ...VALID,
      factVersion: 99,
      knowledgeVersion: 99,
      tenantId: "forged",
      actorId: "forged",
      supersedesKnowledgeNodeId: "forged",
      ratified: true,
    });
    assert.equal(validated.ok, true);
    if (!validated.ok) throw new Error("unreachable");
    assert.deepEqual(
      Object.keys(validated.value).sort(),
      ["factId", "observedKnowledgeVersion", "statement", "title"],
      "only the record reference, the corrected content, and the refusal precondition survive",
    );
  }

  /* ── 13. THE GATE ORDER MATCHES CREATION ────────────────────────────────── */
  {
    let writes = 0;
    const writer = stubWriter({
      async supersedeFact() {
        writes += 1;
        return { status: "stale" };
      },
    });

    const unauthenticated = await supersedeKnowledgeFact(null, VALID, { getWriter: () => writer });
    assert.equal(unauthenticated.status, "unauthorized");
    assert.equal(writes, 0);

    const forbidden = await supersedeKnowledgeFact(tenant(), VALID, {
      resolveAuthority: async () => ({ authorized: false, roleType: "member" }),
      getWriter: () => writer,
    });
    assert.equal(forbidden.status, "forbidden");
    assert.equal(writes, 0);

    // Forbidden is refused BEFORE validation, so it is not an oracle for the accepted shape.
    const forbiddenGarbage = await supersedeKnowledgeFact(tenant(), { factId: "", title: "", statement: "", observedKnowledgeVersion: 1 }, {
      resolveAuthority: async () => ({ authorized: false, roleType: "member" }),
      getWriter: () => writer,
    });
    assert.deepEqual(forbidden, forbiddenGarbage, "the refusal does not depend on the payload");

    const unconfigured = await supersedeKnowledgeFact(tenant(), VALID, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => null,
    });
    assert.equal(unconfigured.status, "unavailable");
    assert.equal(writes, 0);

    const invalid = await supersedeKnowledgeFact(tenant(), { factId: "not-a-uuid", title: "", statement: "", observedKnowledgeVersion: 1 }, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
    });
    assert.equal(invalid.status, "invalid");
    assert.equal(writes, 0, "an invalid correction never reaches the transaction");
  }

  /* ── 14. A REFUSED CORRECTION IS GOVERNANCE HISTORY ─────────────────────
   * It passed the authority gate and named a governed identity — exactly G1's boundary. A committed
   * one is NOT re-recorded here, because the transaction already did it.
   */
  {
    const appended: string[] = [];
    const recordMutation = async (
      _actor: unknown,
      event: { action: string; outcome: string; reason?: string },
    ) => {
      appended.push(`${event.action}:${event.outcome}:${event.reason ?? ""}`);
      return { recorded: true };
    };
    const deps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      recordMutation: recordMutation as never,
    };

    const stale = await supersedeKnowledgeFact(tenant(), VALID, {
      ...deps,
      getWriter: () => stubWriter({ async supersedeFact() { return { status: "stale" }; } }),
    });
    assert.equal(stale.status, "stale-version");
    assert.equal(stale.audited, true);

    const missing = await supersedeKnowledgeFact(tenant(), VALID, {
      ...deps,
      getWriter: () => stubWriter({ async supersedeFact() { return { status: "unresolvable" }; } }),
    });
    assert.equal(missing.status, "not-found");

    const failed = await supersedeKnowledgeFact(tenant(), VALID, {
      ...deps,
      getWriter: () => stubWriter({ async supersedeFact() { return { status: "failed", detail: "boom" }; } }),
    });
    assert.equal(failed.status, "unavailable");

    assert.deepEqual(appended, [
      "knowledge.supersede:rejected:stale-version",
      "knowledge.supersede:rejected:fact-unresolvable",
      "knowledge.supersede:rolled-back:write-failed",
    ], "G1's own outcome vocabulary is reused, not extended");

    // A committed correction is audited inside the transaction, never twice.
    const committedAppends: string[] = [];
    const committed = await supersedeKnowledgeFact(tenant(), VALID, {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      recordMutation: (async () => {
        committedAppends.push("outside");
        return { recorded: true };
      }) as never,
      getWriter: () =>
        stubWriter({
          async supersedeFact() {
            return {
              status: "superseded",
              identity: {
                factId: FACT_ID, factKey: "k", domainKey: "d", scope: "domain",
                priorKnowledgeNodeId: "66666666-6666-4666-8666-666666666666",
                newKnowledgeNodeId: "77777777-7777-4777-8777-777777777777",
                priorFactVersion: 1, factVersion: 2, priorKnowledgeVersion: 1, knowledgeVersion: 2,
              },
            };
          },
        }),
    });
    assert.equal(committed.status, "superseded");
    assert.deepEqual(committedAppends, [], "a committed correction is not double-recorded");
  }

  /* ── 15. NO DELETE, NO ROLLBACK ──────────────────────────────────────────
   *
   * `ratifyknowledge` left this list when K4 landed: ratification is now a real capability, and it
   * is the opposite of the ones here. Deleting, purging, rolling back, restoring and reactivating
   * all try to make a version other than what it was; a ratification adds a Governance decision's
   * linkage to a version and changes nothing about its content — enforced column-by-column above.
   *
   * The K3 MODULES themselves still must not ratify: correction and ratification stay separate
   * capabilities in separate modules, which is why the loop below still covers them.
   */
  {
    for (const file of [...K3_MODULES, WRITER, CONTROL]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of [
        "deleteknowledge", "purge", "softdelete", "rollbackknowledge", "restoreversion",
        "reactivate", "ratifyknowledge", "approveknowledge", "archiveversion",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not expose "${banned}"`);
      }
    }
    // The shared action module may ratify (K4) but still must never delete or roll back.
    {
      const code = codeOf(read(ACTION)).toLowerCase();
      for (const banned of [
        "deleteknowledge", "purge", "softdelete", "rollbackknowledge", "restoreversion",
        "reactivate", "approveknowledge", "archiveversion",
      ]) {
        assert.ok(!code.includes(banned), `${ACTION} must not expose "${banned}"`);
      }
    }
    // Nothing deletes a node or a fact.
    for (const file of walk("src")) {
      const code = codeOf(read(file));
      assert.ok(!/\.delete\(\s*knowledgeNodes\s*\)/.test(code), `${file} must not delete a node`);
      assert.ok(!/\.delete\(\s*knowledgeFacts\s*\)/.test(code), `${file} must not delete a fact`);
    }
    // The audit vocabulary gained supersede (K3), then ratify (K4). Delete and rollback remain absent.
    assert.deepEqual([...KNOWLEDGE_MUTATION_ACTIONS], [
      "knowledge.create",
      "knowledge.supersede",
      "knowledge.ratify",
    ]);

    // The action module exposes exactly one new mutation, plus a read.
    const exported = [...read(ACTION).matchAll(/export\s+async\s+function\s+(\w+)/g)].map((m) => m[1]!);
    assert.deepEqual(
      exported.sort(),
      [
        "createKnowledgeAction",
        "ingestKnowledgeAction",
        /*
         * R4C.1 — the file boundary. It reaches the SAME producer as the paste above it, so it adds
         * no correction, no deletion and no in-place edit; this list growing by one is the whole of
         * its surface.
         */
        "ingestKnowledgeFileAction",
        "ratifyKnowledgeVersionAction",
        "readKnowledgeVersionsAction",
        "rejectKnowledgeVersionAction",
        "supersedeKnowledgeAction",
      ],
      "create, ingest, ingest-a-file, correct, review, and read history — nothing else. Ingest writes many facts\n"
      + "through the same create path; it cannot edit or roll anything back.",
    );
  }

  /* ── 16. THE UI SAYS SUPERSESSION, NOT EDITING ─────────────────────────── */
  {
    const control = read(CONTROL);
    assert.ok(control.includes("Create New Version"), "the action is Create New Version");
    // Checked over CODE, not comments — the header legitimately names the words it rejects.
    const controlCode = codeOf(control);
    for (const forbidden of ["Edit<", "Save changes", "Save Changes", "Update<", "Update Knowledge", "Replace<", ">Save", ">OK<", ">Done<"]) {
      assert.ok(!controlCode.includes(forbidden), `the UI must not offer "${forbidden}"`);
    }
    // The consequence names both sides of the move and what survives.
    for (const required of ["not editing", "remains in history", "draft", "provisional", "grants no execution authority"]) {
      assert.ok(control.includes(required), `the confirmation must state "${required}"`);
    }
    // Active vs historical is distinguished by WORD, not colour alone.
    assert.ok(control.includes('"· active"') || control.includes("· active"), "active is labelled");
    assert.ok(control.includes("· historical"), "historical is labelled");
    // No fabricated quality signal.
    for (const banned of ["confidence", "diffScore", "changeSummary", "quality", "verified badge"]) {
      assert.ok(!codeOf(control).toLowerCase().includes(banned.toLowerCase()), `the UI must not show "${banned}"`);
    }
  }

  /* ── 17. NO NEW SLASH COMMAND, AND HEBY CANNOT CORRECT ─────────────────── */
  {
    // K3 introduces no command of its own.
    for (const banned of ["edit", "update", "supersede", "version", "versions"]) {
      assert.ok(
        !HEBY_COMMANDS.some((command) => command.id === banned),
        `K3 must not add a /${banned} command`,
      );
    }
    /*
     * `/rollback` and `/delete` already existed as S1 RESERVED commands — registered so the shape of
     * the future is visible, and inert. K3 must leave them exactly that: inert. In particular K3 must
     * NOT quietly give `/rollback` a Knowledge meaning, because Hebun's rollback rule is that
     * restoring older wording produces a NEW version, never a reactivation.
     */
    for (const reserved of ["rollback", "delete"]) {
      const command = HEBY_COMMANDS.find((entry) => entry.id === reserved);
      assert.ok(command, `/${reserved} remains registered`);
      assert.equal(command!.kind, "reserved", `/${reserved} stays reserved`);
      assert.equal(command!.availability, "requires-execution", `/${reserved} stays inert`);
      assert.ok(
        !command!.description.toLowerCase().includes("knowledge"),
        `/${reserved} must not acquire a Knowledge meaning`,
      );
    }
    // Nothing Heby can reach imports the correction path.
    for (const file of [
      "src/app/(dashboard)/heby/actions.ts",
      "src/features/heby-answer/model-answer.server.ts",
      "src/features/heby-answer/knowledge-evidence.server.ts",
      "src/features/heby-commands/read-commands.server.ts",
    ]) {
      const src = read(file);
      for (const banned of ["knowledge-supersede", "supersedeKnowledgeFact", "supersedeKnowledgeAction", "knowledge-version-history"]) {
        assert.ok(!src.includes(banned), `${file} must not reach "${banned}"`);
      }
    }
    // Heby's grounding reads the ACTIVE selection only — the historical chain never enters evidence.
    const evidence = read("src/features/heby-answer/knowledge-evidence.server.ts");
    assert.ok(!evidence.includes("VersionHistory"), "historical versions are not grounding evidence");
  }

  /* ── 18. THE CORRECTION CANNOT EXECUTE, AND ADDED NO PERMISSION ─────────── */
  {
    for (const file of [...K3_MODULES, WRITER]) {
      const code = codeOf(read(file)).toLowerCase();
      for (const banned of [
        "eval(", "new function(", "child_process", "execsync", "spawn(", "/bin/sh",
        "fetch(", "readfilesync", "node:fs", "puppeteer", "playwright", "computeruse",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not contain "${banned}"`);
      }
      for (const banned of ["knowledge.edit", "createpermission", "grantpermission", "permissionkey"]) {
        assert.ok(!code.includes(banned), `${file} must not invent "${banned}"`);
      }
    }
    // The correction reuses the SAME connected authority as creation.
    assert.ok(
      read(SUPERSEDE).includes("resolveKnowledgeWriteAuthority"),
      "supersession reuses the existing Knowledge write authority",
    );
    // …and never consults the provider control.
    for (const file of [SUPERSEDE, WRITER]) {
      const code = codeOf(read(file));
      assert.ok(!code.includes("resolveClaudeDirectorEnabled"), `${file} must not consult R2E`);
      assert.ok(!code.includes("heby-provider-ops"), `${file} must not reach provider ops`);
    }
  }

  /* ── 19. NO MIGRATION, NO DEPENDENCY ────────────────────────────────────── */
  {
    // Phase-scoped rather than a global count, so an unrelated later migration
    // cannot make this assertion claim K3 introduced one.
    const k3Migrations = readdirSync("src/db/migrations").filter((n) => n.endsWith(".sql"));
    assert.ok(
      k3Migrations.includes("20260711203301_knowledge_reconciliation_foundation.sql"),
      "the supersession columns came from the pre-existing reconciliation migration",
    );
    for (const name of k3Migrations) {
      assert.ok(
        !/k3|supersede|supersession|version[-_]?history/i.test(name),
        `K3 adds no migration — the supersession columns already existed (found ${name})`,
      );
    }
    /*
     * ── REPAIRED BY R4C.2 ────────────────────────────────────────────────
     *
     * This asserted `Object.keys(dependencies).length === 8`, which is a REPOSITORY-WIDE count
     * dressed up as a phase claim. K3's claim is that K3 needed no library; a global count says
     * something much stronger — that no phase ever will — and it failed the moment R4C.2 added a
     * reviewed PDF parser, for a reason that has nothing to do with supersession.
     *
     * Scoped to what K3 actually asserts: the dependencies K3 shipped against are all still here,
     * and no diffing or versioning library was ever introduced to do K3's job for it.
     */
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };
    for (const baseline of [
      "clsx",
      "drizzle-orm",
      "lucide-react",
      "next",
      "pg",
      "react",
      "react-dom",
      "tailwind-merge",
    ]) {
      assert.ok(pkg.dependencies[baseline], `${baseline} is still a dependency`);
    }
    for (const wouldHaveDoneK3sJob of ["deep-diff", "jsondiffpatch", "immer", "diff", "fast-json-patch"]) {
      assert.equal(
        pkg.dependencies[wouldHaveDoneK3sJob],
        undefined,
        `K3 adds no dependency — supersession is written here, not delegated to ${wouldHaveDoneK3sJob}`,
      );
    }
  }

  /* ── 20. THE HISTORY WALK IS BOUNDED AND CYCLE-SAFE BY CONSTRUCTION ─────── */
  {
    const history = read(HISTORY);
    assert.match(history, /new Set<string>\(\)/, "the walk carries a seen-set");
    assert.match(history, /cycle-detected/, "and reports a cycle rather than looping");
    assert.match(history, /versions\.length >= bound/, "and is hard-bounded");
    assert.match(history, /while \(cursor\)/, "the walk is an iterative loop, not recursion");
    // Every step is tenant-scoped.
    assert.match(history, /eq\(knowledgeNodes\.tenantId, tenant\.tenantId\)/, "each node read is tenant-scoped");
  }

  console.log("k3 no-in-place-edit checks passed");
}

void main();
