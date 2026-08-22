/*
 * G2 — structural boundaries around Governance decision authority.
 *
 * These prove claims about what does NOT exist: no reversal, no delegation, no Knowledge mutation,
 * no Heby reach, no client-supplied constitutional field, and no second audit sink.
 *
 * Runtime behaviour lives in `governance-postgres.ts` and `governance-concurrency-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  BOOTSTRAP_DECISION_TYPE,
  BOOTSTRAP_EFFECT,
  BOOTSTRAP_GOVERNANCE_DOMAIN,
  BOOTSTRAP_NON_EFFECTS,
  DECISION_NON_EFFECT,
  GOVERNANCE_AUDIT_ACTIONS,
  GOVERNANCE_AUDIT_BOUNDARY,
  GOVERNANCE_DECISION_ENTITY_TYPE,
  GOVERNANCE_DECISION_TYPES,
  GOVERNANCE_SUBJECT_TYPES,
  JUSTIFICATION_LIMITS,
  POST_BOOTSTRAP_AUTHORITY_MODEL,
} from "../../src/features/governance-decision/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/** Source with comments stripped: these assertions are about CODE, not about what prose discusses. */
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

const CONTRACTS = "src/features/governance-decision/contracts.ts";
const BOOTSTRAP = "src/features/governance-decision/bootstrap-authority.server.ts";
const DECISION = "src/features/governance-decision/decision-authority.server.ts";
/* G6C: authority RESOLUTION moved to a module that cannot mutate anything. Same property,
 * canonical location. */
const AUTHORITY_READ = "src/features/governance-decision/authority-read.server.ts";
const AUDIT = "src/features/governance-audit/governance-decision-audit.server.ts";
const ACTION = "src/app/(dashboard)/governance/authority/actions.ts";
const PAGE = "src/app/(dashboard)/governance/authority/page.tsx";
const CARD = "src/components/governance-authority/governance-authority-card.tsx";
const SCHEMA = "src/db/schema/governance.ts";
const MIGRATION = "src/db/migrations/20260811155831_g2_governance_bootstrap_authority.sql";

const G2_SERVER = [CONTRACTS, BOOTSTRAP, DECISION, AUDIT, ACTION];
const G2_ALL = [...G2_SERVER, PAGE, CARD];

function main(): void {
  const srcFiles = collect("src");

  /* ── T1: THE DECISION AUTHORITY IS APPEND-ONLY ────────────────────────────
   * No product code path can rewrite an actor, a justification, a bootstrap flag, or a decision.
   */
  {
    for (const file of G2_ALL) {
      const code = codeOf(read(file));
      for (const banned of [
        ".update(decisionRecords)",
        ".delete(decisionRecords)",
        ".update(governanceSessions)",
        ".delete(governanceSessions)",
        "onConflictDoUpdate",
        "onConflictDoNothing",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not contain ${banned}`);
      }
    }
    // And no exported function even OFFERS a reversal.
    const exported = G2_ALL.map((f) => read(f)).join("\n");
    for (const banned of [
      "updateDecision",
      "deleteDecision",
      "rewriteDecision",
      "changeActor",
      "changeJustification",
      "changeBootstrap",
      "supersedeDecision",
      "revokeDecision",
      "delegateAuthority",
      "escalateAuthority",
    ]) {
      assert.ok(
        !new RegExp(`(export\\s+(async\\s+)?function|export\\s+const)\\s+${banned}`).test(exported),
        `G2 must export no ${banned} — reversal is itself a Governance decision, and has no runtime`,
      );
    }
  }

  /* ── T2: THE CLIENT SUPPLIES NO CONSTITUTIONAL FIELD ──────────────────────── */
  {
    const source = read(ACTION);
    // The bootstrap action's ONLY input is a justification.
    assert.match(
      source,
      /establishGovernanceAuthorityAction\(input:\s*\{\s*justification:\s*string;\s*\}\)/,
      "the bootstrap action accepts a justification and nothing else",
    );
    for (const forgeable of [
      "tenantId",
      "actorId",
      "authIdentityId",
      "membershipId",
      "roleId",
      "authorityRank",
      "bootstrap",
      "sessionId",
      "decisionId",
      "decidedAt",
      "outcome",
      "authoritySource",
    ]) {
      assert.ok(
        !new RegExp(`input\\.${forgeable}\\b`).test(source),
        `the Governance actions must never read a client-supplied ${forgeable}`,
      );
    }
    // The server modules fix the constitutional fields themselves.
    const bootstrap = codeOf(read(BOOTSTRAP));
    assert.match(bootstrap, /bootstrap:\s*true/, "the genesis sets bootstrap itself");
    assert.match(bootstrap, /actorType:\s*"human"/, "the genesis actor type is fixed, never passed");
    assert.match(
      bootstrap,
      /actorId:\s*tenant\.userId/,
      "the genesis actor comes from the session, never from input",
    );
    assert.match(
      codeOf(read(DECISION)),
      /bootstrap:\s*false/,
      "an ordinary decision can never claim to be a genesis",
    );
  }

  /* ── T3: K4 FIREWALL — NO KNOWLEDGE MUTATION IS EVEN AVAILABLE ───────────── */
  {
    for (const file of G2_ALL) {
      const code = codeOf(read(file));
      /*
       * `governance_session_id` is deliberately NOT in this list. It is a column on BOTH
       * `knowledge_nodes` (K4's, forbidden) and nothing else G2 writes — and G2's own audit
       * metadata legitimately carries a field of that name for the session it just created.
       * The rule that actually protects K4 is the pair below: no Knowledge schema import, and no
       * write to any Knowledge table. A bare token match would only forbid a word.
       */
      /*
       * `knowledge_nodes` is no longer forbidden outright: G2's subject existence check reads it
       * (see below), because K4 corrected the subject to the version row. What must never appear
       * in G2 is a RATIFICATION column — binding a decision to a version is K4's job, in K4's
       * module, and G2 must remain unable to do it.
       */
      for (const forbidden of [
        "knowledgeNodes",
        "ratified_at",
        "ratifiedAt",
        "ratification_decision_id",
        "ratificationDecisionId",
      ]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must not touch ${forbidden} — binding a ratification is K4's job`,
        );
      }
      assert.ok(
        !/insert into public\.knowledge|update public\.knowledge|delete from public\.knowledge/i.test(
          code,
        ),
        `${file} must never write any Knowledge table`,
      );
      assert.ok(
        !code.includes('@/db/schema/knowledge'),
        `${file} must not import the Knowledge schema at all`,
      );
    }
    /*
     * The one Knowledge touchpoint is a READ-ONLY existence check on the subject, and it is a
     * tenant-scoped parameterised SELECT. It names `knowledge_nodes` because K4 corrected the
     * subject vocabulary from the fact to the VERSION — a decision must bind to the exact version a
     * human reviewed, and a fact-level subject could not distinguish v2 from v3. Reading a row to
     * confirm it exists is not mutating Knowledge; the assertion below is what forbids that.
     */
    const decision = read(DECISION);
    assert.match(
      decision,
      /select 1 from public\.knowledge_nodes where id = \$\{subjectId\}::uuid and tenant_id = \$\{tenantId\}::uuid/,
      "the subject check is a tenant-scoped, parameterised SELECT on the VERSION row",
    );
    assert.ok(
      !/update\s+public\.knowledge|insert\s+into\s+public\.knowledge|delete\s+from\s+public\.knowledge/i.test(
        decision,
      ),
      "G2 must never write any Knowledge table",
    );
  }

  /* ── T4: SUBJECT BINDING IS A CLOSED VOCABULARY, SERVER-VALIDATED ────────── */
  {
    assert.deepEqual(GOVERNANCE_SUBJECT_TYPES, ["knowledge_node"]);
    assert.deepEqual(GOVERNANCE_DECISION_TYPES, ["ratify", "reject"]);
    const decision = codeOf(read(DECISION));
    // The table name is chosen by a switch over a union, never interpolated from input.
    assert.match(decision, /switch \(subjectType\)/, "subject tables are chosen, not interpolated");
    assert.ok(
      !/from\s+\$\{|sql\.raw\(|sql\.identifier\(/.test(decision),
      "no table or identifier may be built from a caller value",
    );
    // No URL / path / command shaped subject can be represented.
    assert.ok(!/https?:\/\//.test(codeOf(read(CONTRACTS))), "no URL subject vocabulary");
  }

  /* ── T5: R2E AND EXECUTION FIREWALL ─────────────────────────────────────── */
  {
    for (const file of G2_ALL) {
      const code = codeOf(read(file));
      for (const forbidden of [
        "providerConnectivityControls",
        "provider_connectivity_controls",
        "directorEnabled",
        "ANTHROPIC_API_KEY",
        "heby-model",
        "heby-runtime",
        "computer-use",
        "child_process",
        "exec(",
        "spawn(",
        "fetch(",
      ]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must not reach ${forbidden} — Governance is independent of providers and execution`,
        );
      }
    }
  }

  /* ── T6: HEBY FIREWALL ───────────────────────────────────────────────────── */
  {
    const hebyFiles = srcFiles.filter(
      (file) => file.includes("heby-") || file.includes("heby/") || file.includes("/heby"),
    );
    assert.ok(hebyFiles.length > 0, "the Heby surface must exist for this test to mean anything");
    /*
     * G6C. MECHANISM, NOT PROSE — matched against `codeOf`, so a comment that NAMES a writer in
     * order to promise it is not imported can no longer trip a firewall. What is banned is the
     * WRITER SYMBOLS, not module names: reading Governance through `authority-read.server` is
     * legitimate and must stay legitimate, while every act that mutates Governance stays
     * unreachable. The import-graph reachability proof in tests/g6c-flow is the primary defence;
     * this path heuristic is kept as an additive second one.
     */
    const offenders = hebyFiles.filter((file) =>
      /establishGovernanceAuthority|recordGovernanceDecision|writeGovernanceDecisionWithin/.test(
        codeOf(read(file)),
      ),
    );
    assert.deepEqual(offenders, [], "no Heby surface may reach a Governance decision WRITER");

    const commandFiles = srcFiles.filter((file) => file.includes("heby-commands"));
    const naming = commandFiles.filter((file) =>
      /bootstrap|ratify|governance\.decision|establish.?governance/i.test(read(file)),
    );
    assert.deepEqual(naming, [], "no Heby command may name a Governance mutation");
  }

  /* ── T7: THE AUDIT SINK HAS FIVE DECLARED OWNERS, NO MORE ───────────────── */
  {
    /*
     * I1.2 added the fourth and I2 the fifth, on the same terms as every earlier sibling: its own
     * boundary constant, its own entity type, its own actions, and no reference to another domain's
     * boundary. Adding a sixth is a deliberate edit here, never an accident somewhere in
     * `src/features`.
     */
    /*
     * R7.1 repair: WRITING is asked by the write verbs, not by importing the schema.
     *
     * This census matched `from "@/db/schema/audit-log"` and called the result `owners` that
     * "write the sink". That held only while every importer happened to be a writer. R7.1 added the
     * sink's first READER — it counts rows and writes none — and a write firewall flagged it. The
     * claim in the message is the one now proved; the import census follows it, because "nothing
     * else reaches the sink" is a real guarantee and is simply a different one.
     */
    const AUDIT_SINK_WRITERS = [
      "src/features/governance-audit/action-authorization-audit.server.ts",
      "src/features/governance-audit/action-execution-audit.server.ts",
      "src/features/governance-audit/genesis-nomination-audit.server.ts",
      "src/features/governance-audit/governance-decision-audit.server.ts",
      "src/features/governance-audit/human-onboarding-audit.server.ts",
      "src/features/governance-audit/identity-enrollment-audit.server.ts",
      "src/features/governance-audit/integration-credential-audit.server.ts",
      "src/features/governance-audit/integration-lifecycle-audit.server.ts",
      "src/features/governance-audit/knowledge-mutation-audit.server.ts",
    ];
    const candidates = srcFiles
      .filter((f) => !f.replace(/\\/g, "/").startsWith("src/db/schema/"))
      .map((f) => f.replace(/\\/g, "/"));

    assert.deepEqual(
      candidates
        .filter((f) => /\.(insert|update|delete)\(\s*auditLog\s*\)/.test(codeOf(read(f))))
        .sort(),
      AUDIT_SINK_WRITERS,
      "six declared sibling owners write the sink — and nothing else does",
    );

    assert.deepEqual(
      candidates.filter((f) => read(f).includes('from "@/db/schema/audit-log"')).sort(),
      [...AUDIT_SINK_WRITERS, "src/features/governance-activity/read.server.ts"].sort(),
      "and the sink is reached only by those writers plus R7.1's declared read seam",
    );
    // Each domain owns a DISTINCT entity type, so no domain can file under another's history.
    assert.equal(GOVERNANCE_DECISION_ENTITY_TYPE, "governance_decision");
    for (const other of ["knowledge_fact", "genesis_nomination"]) {
      assert.notEqual(GOVERNANCE_DECISION_ENTITY_TYPE, other);
    }
    // And no sibling references another's boundary constant.
    const g2Audit = codeOf(read(AUDIT));
    assert.ok(!g2Audit.includes("KNOWLEDGE_AUDIT_BOUNDARY"));
    assert.ok(!g2Audit.includes("GENESIS_AUDIT_BOUNDARY"));
    for (const banned of [".update(auditLog)", ".delete(auditLog)", "onConflict"]) {
      assert.ok(!g2Audit.includes(banned), `the audit writer must contain no ${banned}`);
    }
  }

  /* ── T8: THE JUSTIFICATION IS OWNED BY THE DECISION, NOT DUPLICATED ─────── */
  {
    assert.equal(GOVERNANCE_AUDIT_BOUNDARY.duplicatesJustification, false);
    const audit = codeOf(read(AUDIT));
    assert.ok(
      !/justification/.test(audit),
      "the audit writer must not carry the justification — decision_records owns it",
    );
    /*
     * G3 added the two authority-movement actions; I1 added membership authorization; I1.1 added
     * role provisioning; I1.2 added the identity-enrollment second key, approved and refused as two
     * separate actions. The list's job is unchanged and still asserted: it stays closed to actions a
     * real capability performs. `governance.authority.escalated`, `.suspended` and `.appealed` are
     * still absent because those runtimes do not exist.
     */
    assert.deepEqual(GOVERNANCE_AUDIT_ACTIONS, [
      "governance.bootstrap.established",
      "governance.decision.recorded",
      "governance.authority.delegated",
      "governance.authority.revoked",
      "governance.membership.authorized",
      "governance.role.provisioned",
      "governance.identity.enrollment.approved",
      "governance.identity.enrollment.rejected",
    ]);
    for (const notYet of [
      "governance.authority.escalated",
      "governance.authority.suspended",
      "governance.authority.appealed",
    ]) {
      assert.ok(
        !GOVERNANCE_AUDIT_ACTIONS.includes(notYet as never),
        `${notYet} must not be declared before it exists`,
      );
    }
    assert.equal(GOVERNANCE_AUDIT_BOUNDARY.recordsCommittedDecisions, true);
    assert.equal(GOVERNANCE_AUDIT_BOUNDARY.recordsRefusedAuthorizedAttempts, true);
    assert.equal(GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts, false);
    assert.equal(GOVERNANCE_AUDIT_BOUNDARY.recordsUnauthorizedAttempts, false);
  }

  /* ── T9: NO CREDENTIAL OR BEARER MATERIAL ───────────────────────────────── */
  {
    for (const file of G2_ALL) {
      const code = codeOf(read(file));
      for (const forbidden of ["secretHash", "secret_hash", "salt", "SESSION_COOKIE_NAME"]) {
        assert.ok(!code.includes(forbidden), `${file} must never mention ${forbidden}`);
      }
    }
  }

  /* ── T10: THE POST-BOOTSTRAP RULE BORROWS NO OTHER AUTHORITY ─────────────── */
  {
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.kind, "bootstrap-established-human");
    /*
     * `transferable` and `delegationRuntimeConnected` flipped to true when G3 connected the
     * delegation runtime — the model must describe the system as it is, and a stale `false` here
     * would be the constant lying about itself. What this test exists to protect is unchanged and
     * still asserted below: authority comes from a Governance decision and from nothing else.
     * A2-a keeps the genesis itself out of reach.
     */
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.transferable, true);
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.delegationRuntimeConnected, true);
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.bootstrapAuthorityRevocable, false);
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.roleBandGrantsAuthority, false);
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.permissionRuntimeConnected, false);

    // The resolver reads decision_records and NOTHING that grants authority elsewhere.
    const decision = codeOf(read(AUTHORITY_READ));
    for (const borrowed of [
      "roles",
      "rolePermissions",
      "role_permissions",
      "permissions",
      "authorityScope",
      "authority_scope",
      "systemRole",
      "authorityRank",
    ]) {
      assert.ok(
        !new RegExp(`\\b${borrowed}\\b`).test(decision),
        `the authority resolver must not consult ${borrowed} — none of it was established by a decision`,
      );
    }
    assert.match(
      decision,
      /eq\(decisionRecords\.bootstrap, true\)/,
      "authority is resolved from the bootstrap decision itself",
    );
  }

  /* ── T11: THE GENESIS USES ONLY EXISTING GOVERNANCE VOCABULARY ───────────── */
  {
    const enums = read("src/db/schema/_enums.ts");
    assert.ok(
      enums.includes(`"${BOOTSTRAP_GOVERNANCE_DOMAIN}"`),
      "the bootstrap domain must be an existing governance_domain value",
    );
    assert.ok(
      enums.includes(`"${BOOTSTRAP_DECISION_TYPE}"`),
      "the bootstrap decision type must be an existing governance_decision_type value",
    );
    for (const type of GOVERNANCE_DECISION_TYPES) {
      assert.ok(enums.includes(`"${type}"`), `${type} must be an existing decision type`);
    }
    // G2 introduced no governance enum value of its own.
    assert.ok(
      !/g2|bootstrap/i.test(
        (enums.match(/governanceDecisionTypeEnum[\s\S]*?\]\);/) ?? [""])[0],
      ),
      "G2 added no decision type — bootstrap is a boolean column, not a type",
    );
  }

  /* ── T12: THE MIGRATION CARRIES BOTH CONSTITUTIONAL INVARIANTS ───────────── */
  {
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /CREATE UNIQUE INDEX "decision_records_one_bootstrap_per_tenant_uq" ON "decision_records" USING btree \("tenant_id"\) WHERE "decision_records"\."bootstrap"/,
      "one bootstrap per tenant must be a PARTIAL UNIQUE INDEX",
    );
    assert.match(
      migration,
      /"decision_records_bootstrap_human_chk" CHECK \("decision_records"\."bootstrap" = false or "decision_records"\."actor_type" = 'human'\)/,
      "a genesis actor must be human, enforced by CHECK",
    );
    assert.match(
      migration,
      /"genesis_nominations_consumed_requires_accepted_chk"/,
      "only an accepted entitlement can be spent",
    );
    assert.ok(!migration.includes("$1"), "a migration must contain no bind parameters");
    // Scope discipline: G2 touched exactly two tables.
    const altered = [...migration.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]);
    const indexed = [...migration.matchAll(/INDEX "[^"]+" ON "([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      [...new Set([...altered, ...indexed])].sort(),
      ["decision_records", "genesis_nominations"],
      "the G2 migration touches only decision_records and genesis_nominations",
    );
    assert.ok(!/CREATE TABLE/.test(migration), "G2 creates no table");
    assert.ok(!/CREATE TYPE/.test(migration), "G2 creates no enum");

    // The schema file is the source of truth the migration was generated from, so both invariants
    // must be declared there too — otherwise a later `generate` would silently drop them.
    const schema = read(SCHEMA);
    assert.match(schema, /decision_records_one_bootstrap_per_tenant_uq/);
    assert.match(schema, /decision_records_bootstrap_human_chk/);
    assert.match(
      schema,
      /uniqueIndex\("decision_records_one_bootstrap_per_tenant_uq"\)\s*\.on\(t\.tenantId\)\s*\.where\(sql`\$\{t\.bootstrap\}`\)/,
      "the bootstrap uniqueness must be PARTIAL — ordinary decisions stay unconstrained",
    );
  }

  /* ── T13: THE SURFACE TELLS THE TRUTH ───────────────────────────────────── */
  {
    const card = read(CARD);
    assert.match(card, /Establish Governance Authority/, "the final action is constitutional");
    for (const vague of [">Save<", ">Continue<", ">Confirm<", ">Enable Governance<", ">Approve<"]) {
      assert.ok(!card.includes(vague), `the final action must not be "${vague}"`);
    }
    assert.ok(card.includes("BOOTSTRAP_NON_EFFECTS"));
    assert.ok(card.includes("BOOTSTRAP_EFFECT"));
    for (const required of [
      "does not ratify any Knowledge",
      "does not grant administrative rights",
      "does not grant Knowledge write access",
      "does not enable providers or the model kill-switch",
      "does not grant execution, Computer Use, or terminal authority",
      "does not change your application role",
      "does not create permissions",
      "does not delegate authority to anyone else",
    ]) {
      assert.ok(
        BOOTSTRAP_NON_EFFECTS.includes(required),
        `the surface must state that establishing ${required}`,
      );
    }
    assert.match(BOOTSTRAP_EFFECT, /Governance authority for this tenant now exists/);
    // The page states that recording a decision does not mutate the subject.
    assert.ok(read(PAGE).includes("DECISION_NON_EFFECT"));
    assert.match(DECISION_NON_EFFECT, /does not mark Knowledge ratified/);
  }

  /* ── T14: ACCESSIBILITY IS WIRED, NOT ASSUMED ───────────────────────────── */
  {
    const card = read(CARD);
    assert.match(card, /<label\s+htmlFor=\{`\$\{ids\}-justification`\}/, "the field has a real label");
    assert.match(card, /aria-describedby=/, "help and error text are associated");
    assert.match(card, /aria-invalid=/, "invalid state is announced");
    assert.match(card, /role="alert"/, "refusals are announced");
    assert.match(card, /role="status"/, "success is announced");
    assert.match(card, /aria-hidden/, "decorative icons are hidden from assistive tech");
    // The established state is distinguished by an icon and words, not by colour alone.
    assert.match(card, /ShieldCheck/);
    assert.match(card, /resides in you/);
  }

  /* ── T15: JUSTIFICATION IS MANDATORY AND INERT ──────────────────────────── */
  {
    assert.ok(JUSTIFICATION_LIMITS.minimumLength >= 24);
    const bootstrap = codeOf(read(BOOTSTRAP));
    assert.match(
      bootstrap,
      /if \(!justification\) return refused\("justification-required"\)/,
      "an absent or too-short justification refuses the genesis",
    );
    // Inert: never parsed, never rendered as markup, never given to a model.
    assert.ok(
      !/dangerouslySetInnerHTML/.test(read(CARD)),
      "the justification must never be rendered as markup",
    );
    assert.match(
      read(CARD),
      /whitespace-pre-wrap break-words/,
      "the stored reason is rendered as text",
    );
    for (const file of [BOOTSTRAP, DECISION]) {
      const code = codeOf(read(file));
      assert.ok(!/JSON\.parse\(justification|eval\(|new Function\(/.test(code));
    }
  }

  console.log("PASS g2 boundaries and firewall");
}

main();
