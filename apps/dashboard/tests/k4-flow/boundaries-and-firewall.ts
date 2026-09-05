/*
 * K4 — structural boundaries around Governance-backed ratification.
 *
 * These prove claims about what does NOT exist: no second authority, no self-ratifying Knowledge,
 * no Heby mutation path, no epistemic claim, and no way for a client to supply a ratification.
 *
 * Runtime behaviour lives in `ratification-postgres.ts` and `ratification-concurrency-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  RATIFICATION_EFFECT,
  RATIFICATION_NON_EFFECTS,
  RATIFICATION_SEPARATION_OF_DUTIES,
  RATIFICATION_SUBJECT_TYPE,
  RATIFICATION_VERSION_SCOPE_NOTICE,
  REJECTION_EFFECT,
  REJECTION_NON_EFFECTS,
} from "../../src/features/knowledge-ratification/contracts";
import {
  GOVERNANCE_SUBJECT_TYPES,
  SUBJECT_GOVERNANCE_DOMAIN,
} from "../../src/features/governance-decision/contracts";
import { KNOWLEDGE_MUTATION_ACTIONS } from "../../src/features/governance-audit/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: assertions are about CODE, not about what prose discusses. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function collect(dir: string, ext = /\.tsx?$/): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return collect(rel, ext);
    return e.isFile() && ext.test(e.name) ? [rel] : [];
  });
}

const CONTRACTS = "src/features/knowledge-ratification/contracts.ts";
const RATIFY = "src/features/knowledge-ratification/ratify-version.server.ts";
const ACTION = "src/app/(dashboard)/knowledge/actions.ts";
const CARD = "src/components/knowledge-workspace/knowledge-review-card.tsx";
const PAGE = "src/app/(dashboard)/knowledge/page.tsx";
const REPOSITORY = "src/features/knowledge/durable-knowledge-repository.server.ts";
const HISTORY = "src/features/knowledge/knowledge-version-history.server.ts";
const K4_ALL = [CONTRACTS, RATIFY, ACTION, CARD, PAGE];

function main(): void {
  const srcFiles = collect("src");

  /* ── T1: RATIFICATION BINDS TO A VERSION, NEVER TO A FACT ─────────────────── */
  {
    assert.equal(RATIFICATION_SUBJECT_TYPE, "knowledge_node");
    assert.deepEqual(
      GOVERNANCE_SUBJECT_TYPES,
      ["knowledge_node", "work_artifact_revision"],
      "G2's subject vocabulary must name the VERSION row; a fact-level subject cannot distinguish v2 from v3",
    );
    assert.ok(
      !GOVERNANCE_SUBJECT_TYPES.includes("knowledge_fact" as never),
      "knowledge_fact was removed, not kept alongside — a fact-level ratify decision must be unrepresentable",
    );
    assert.equal(SUBJECT_GOVERNANCE_DOMAIN.knowledge_node, "knowledge-ratification");

    // The binding predicate names the node id and its version — never the fact's active pointer.
    const ratify = codeOf(read(RATIFY));
    assert.match(ratify, /eq\(knowledgeNodes\.id, version\.nodeId\)/);
    assert.match(ratify, /eq\(knowledgeNodes\.knowledgeVersion, version\.knowledgeVersion\)/);
    assert.match(ratify, /subjectId: version\.nodeId/);
  }

  /* ── T2: NOTHING CLIENT-SUPPLIED BECOMES RATIFICATION ─────────────────────── */
  {
    const action = read(ACTION);
    // The action accepts exactly four fields, and none of them is authoritative.
    assert.match(
      action,
      /ratifyKnowledgeVersionAction\(input:\s*\{\s*factId:\s*string;\s*knowledgeNodeId:\s*string;[\s\S]*?observedKnowledgeVersion:\s*number;\s*justification:\s*string;\s*\}\)/,
    );
    for (const forgeable of [
      "tenantId",
      "actorId",
      "userId",
      "decisionId",
      "sessionId",
      "governanceSessionId",
      "ratifiedAt",
      "ratifiedBy",
      "ratificationDecisionId",
      "bootstrap",
      "roleId",
    ]) {
      assert.ok(
        !new RegExp(`input\\.${forgeable}\\b`).test(action),
        `the K4 actions must never read a client-supplied ${forgeable}`,
      );
    }
    // The server generates the ratification linkage itself.
    const ratify = codeOf(read(RATIFY));
    assert.match(ratify, /ratifiedAt: now/, "the ratification instant is server-generated");
    assert.match(ratify, /ratifiedByActorId: authenticated\.userId/);
    assert.match(ratify, /ratifiedByActorType: "human"/);
    assert.match(ratify, /ratificationDecisionId: decision\.decisionId/);
  }

  /* ── T3: KNOWLEDGE CANNOT RATIFY ITSELF ───────────────────────────────────── */
  {
    // The authority comes from the Governance resolver, in a different feature.
    const ratify = codeOf(read(RATIFY));
    assert.match(ratify, /resolveGovernanceAuthority/);
    assert.match(
      ratify,
      /if \(!authority\.authorized\) throw new RatificationAbort\("not-the-governance-authority"\)/,
    );
    // The Knowledge write authority (K2's role band) must NOT appear in the ratification path.
    for (const borrowed of [
      "resolveKnowledgeWriteAuthority",
      "KNOWLEDGE_AUTHOR_ROLE_TYPES",
      "roles",
      "authorityRank",
      "systemRole",
      "permissions",
    ]) {
      assert.ok(
        !new RegExp(`\\b${borrowed}\\b`).test(ratify),
        `ratification must not consult ${borrowed} — authoring authority is not Governance authority`,
      );
    }
    // No Knowledge module may import the ratification writer and call it for itself.
    const knowledgeFeature = srcFiles.filter((f) =>
      f.replace(/\\/g, "/").startsWith("src/features/knowledge/"),
    );
    const offenders = knowledgeFeature.filter((f) => /knowledge-ratification/.test(read(f)));
    assert.deepEqual(offenders, [], "the Knowledge feature must not reach the ratification writer");
  }

  /* ── T4: RATIFICATION NEVER EDITS CONTENT ─────────────────────────────────── */
  {
    const ratify = codeOf(read(RATIFY));

    // Exactly one update statement exists, and it targets the version row.
    const updates = [...ratify.matchAll(/\.update\((\w+)\)/g)].map((m) => m[1]);
    assert.deepEqual(updates, ["knowledgeNodes"], "one update, on the version row");

    /*
     * Assert the WRITTEN COLUMNS, not the presence of a word. `knowledgeVersion` legitimately
     * appears elsewhere in this file as a read and as audit metadata; what must never happen is
     * writing it. Extracting the `.set({ ... })` block makes the claim exact.
     */
    const setBlock = /\.update\(knowledgeNodes\)\s*\.set\(\{([\s\S]*?)\}\)/.exec(ratify);
    assert.ok(setBlock, "the ratification update sets its columns in one literal");
    const writtenColumns = [...setBlock![1]!.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort();
    assert.deepEqual(
      writtenColumns,
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
      "ratification writes the Governance linkage and the standard update attribution — nothing else",
    );
    for (const immutable of [
      "statement",
      "label",
      "knowledgeVersion",
      "supersedesKnowledgeNodeId",
      "createdBy",
      "knowledgeLifecycleStatus",
      "knowledgeAuthority",
    ]) {
      assert.ok(
        !writtenColumns.includes(immutable),
        `ratification must never write ${immutable} — it adds Governance linkage only`,
      );
    }
    assert.ok(!/\.delete\(/.test(ratify), "ratification deletes nothing");
  }

  /* ── T5: REJECTION WRITES NOTHING TO KNOWLEDGE ────────────────────────────── */
  {
    const ratify = read(RATIFY);
    const rejectBody = ratify.slice(ratify.indexOf("export async function rejectKnowledgeVersion"));
    assert.ok(rejectBody.length > 0, "the rejection path exists");
    assert.ok(
      !/\.update\(knowledgeNodes\)|\.insert\(knowledgeNodes\)/.test(codeOf(rejectBody)),
      "a rejection must not mutate Knowledge — the version stays exactly as authored",
    );
    assert.ok(
      !/recordKnowledgeMutationWithin/.test(codeOf(rejectBody)),
      "a rejection is not a Knowledge mutation, so it files no Knowledge audit event",
    );
    for (const required of [
      "does not delete the record or any version of it",
      "does not change the statement",
      "does not mark the statement false",
      "does not remove it from history",
    ]) {
      assert.ok(REJECTION_NON_EFFECTS.includes(required), `rejection must state it ${required}`);
    }
    assert.match(REJECTION_EFFECT, /unchanged and remains unratified/);
    // `knowledge.reject` is deliberately not in the Knowledge mutation vocabulary.
    assert.ok(!KNOWLEDGE_MUTATION_ACTIONS.includes("knowledge.reject" as never));
    assert.ok(KNOWLEDGE_MUTATION_ACTIONS.includes("knowledge.ratify"));
  }

  /* ── T6: "RATIFIED" REQUIRES THE GOVERNANCE LINKAGE ───────────────────────── */
  {
    for (const file of [REPOSITORY, HISTORY]) {
      const code = codeOf(read(file));
      assert.ok(
        !/ratificationDecisionId \?\? .*ratifiedAt/.test(code),
        `${file} must not treat a bare ratified_at as ratification — it needs the decision`,
      );
      assert.match(
        code,
        /ratified: Boolean\((row|node)\.ratificationDecisionId\)/,
        `${file} must derive ratified from the bound Governance decision`,
      );
    }
  }

  /* ── T7: RATIFIED IS NOT TRUE ─────────────────────────────────────────────── */
  {
    assert.match(RATIFICATION_EFFECT, /approved this exact version/);
    assert.ok(
      RATIFICATION_NON_EFFECTS.includes("does not make the statement true, verified, or accurate"),
    );
    assert.ok(
      RATIFICATION_NON_EFFECTS.includes("does not apply to any future version of this record"),
    );
    assert.match(RATIFICATION_VERSION_SCOPE_NOTICE, /only to the displayed version/);
    assert.match(RATIFICATION_VERSION_SCOPE_NOTICE, /new Governance decision/);

    /*
     * No K4 surface may claim epistemic certainty or invent a score. Comments are stripped: the
     * contracts file names these words precisely to say they are ABSENT, and JSX text survives
     * `codeOf`, so anything a user could actually read is still checked.
     */
    for (const file of K4_ALL) {
      const text = codeOf(read(file));
      for (const overclaim of [
        "confidence",
        "truthScore",
        "certainty",
        "qualityScore",
        "approvalPercentage",
        "guaranteed",
        "cannot be wrong",
        "factually correct",
      ]) {
        assert.ok(!text.includes(overclaim), `${file} must not claim ${overclaim}`);
      }
    }
    // The card says so where a reader will see it.
    assert.match(read(CARD), /organizational status, not a claim that the statement is true/);
  }

  /* ── T8: HEBY FIREWALL ───────────────────────────────────────────────────── */
  {
    const hebyFiles = srcFiles.filter(
      (file) => file.includes("heby-") || file.includes("heby/") || file.includes("/heby"),
    );
    assert.ok(hebyFiles.length > 0, "the Heby surface must exist for this test to mean anything");
    /* G6C: writer symbols, matched against code rather than comments. */
    const offenders = hebyFiles.filter((file) =>
      /ratifyKnowledgeVersion|rejectKnowledgeVersion/.test(codeOf(read(file))),
    );
    assert.deepEqual(offenders, [], "no Heby surface may reach ratification");

    const commandFiles = srcFiles.filter((file) => file.includes("heby-commands"));
    const naming = commandFiles.filter((file) => /ratif|\/reject|\/approve/i.test(read(file)));
    assert.deepEqual(naming, [], "no Heby command may name a ratification mutation");

    // And no voice surface either.
    const voiceFiles = srcFiles.filter((file) => file.includes("heby-voice"));
    const voiceOffenders = voiceFiles.filter((file) => /ratif/i.test(read(file)));
    assert.deepEqual(voiceOffenders, [], "voice may not ratify");
  }

  /* ── T9: NO EXECUTION, NO PROVIDER, NO NEW AUTHORITY ──────────────────────── */
  {
    for (const file of K4_ALL) {
      const code = codeOf(read(file));
      for (const forbidden of [
        "providerConnectivityControls",
        "directorEnabled",
        "ANTHROPIC_API_KEY",
        "computer-use",
        "child_process",
        "spawn(",
        "fetch(",
        "pgTable(",
      ]) {
        assert.ok(!code.includes(forbidden), `${file} must not reach ${forbidden}`);
      }
    }
    // K4 introduced no migration of its own.
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .filter((n) => /k4|ratif/i.test(n));
    assert.deepEqual(migrations, [], "K4 adds no migration — the ratification columns already existed");
  }

  /* ── T10: SEPARATION OF DUTIES IS A STATED LIMITATION, NOT A FABRICATION ──── */
  {
    assert.equal(RATIFICATION_SEPARATION_OF_DUTIES.authorMayRatifyOwnVersion, true);
    assert.equal(RATIFICATION_SEPARATION_OF_DUTIES.enforcedByRepository, false);
    assert.match(RATIFICATION_SEPARATION_OF_DUTIES.limitation, /did not invent one/);
    // No author-vs-ratifier comparison exists in the code.
    assert.ok(
      !/createdBy\s*[!=]==\s*(tenant|authenticated)\.userId/.test(codeOf(read(RATIFY))),
      "K4 must not fabricate a separation-of-duties rule the repository never defined",
    );
  }

  /* ── T11: STALE-REVIEW PROTECTION IS PRESENT AND CAN ONLY REFUSE ──────────── */
  {
    const ratify = codeOf(read(RATIFY));
    assert.match(
      ratify,
      /if \(version\.knowledgeVersion !== input\.observedKnowledgeVersion\)\s*\{\s*throw new RatificationAbort\("stale-review"\)/,
    );
    assert.match(ratify, /for update of n/, "the version row is locked while it is decided on");
    assert.match(
      ratify,
      /if \(row\.active_node_id !== row\.node_id\)/,
      "a superseded version is not reviewable",
    );
  }

  /* ── T12: THE SURFACE STATES CONSEQUENCES AND IS ACCESSIBLE ───────────────── */
  {
    const card = read(CARD);
    assert.match(card, /Ratify This Version/);
    assert.match(card, /Reject This Version/);
    for (const vague of [">Save<", ">Continue<", ">Confirm<", ">Approve<"]) {
      assert.ok(!card.includes(vague), `the final action must not be "${vague}"`);
    }
    assert.ok(card.includes("RATIFICATION_VERSION_SCOPE_NOTICE"));
    assert.ok(card.includes("RATIFICATION_NON_EFFECTS"));
    assert.ok(card.includes("REJECTION_NON_EFFECTS"));
    // Accessibility.
    assert.match(card, /<label\s+htmlFor=\{`\$\{ids\}-justification`\}/);
    assert.match(card, /aria-describedby=/);
    assert.match(card, /aria-invalid=/);
    assert.match(card, /role="alert"/);
    assert.match(card, /role="status"/);
    assert.match(card, /aria-hidden/);
    // The ratified state is carried by an icon and the word, not by colour.
    assert.match(card, /ShieldCheck/);
    assert.match(card, /<strong>ratified<\/strong>/);
    // The version number is always shown next to the action.
    assert.match(card, /Governance review — v\{record\.knowledgeVersion\}/);
  }

  /* ── T13: ONE WORKSPACE, NOT A SECOND GOVERNANCE SURFACE ──────────────────── */
  {
    // The review card lives in the Knowledge workspace and is rendered by the Knowledge page.
    assert.ok(CARD.startsWith("src/components/knowledge-workspace/"));
    assert.match(read(PAGE), /KnowledgeReviewCard/);
    // Knowledge does not re-implement the authority — it resolves G2's.
    assert.match(read(PAGE), /resolveGovernanceAuthority/);
    /*
     * No ratification SURFACE under /governance. The word "ratify" legitimately appears there —
     * the authority page states that a ratify decision does not mark Knowledge ratified — so the
     * check is whether anything there can CALL the ratification writer.
     */
    const governanceRoutes = collect("src/app/(dashboard)/governance").filter((f) =>
      /knowledge-ratification|ratifyKnowledgeVersion|rejectKnowledgeVersion/.test(read(f)),
    );
    assert.deepEqual(governanceRoutes, [], "no ratification surface was added under /governance");
  }

  console.log("PASS k4 boundaries and firewall");
}

main();
