/*
 * G2.1 — structural boundaries around pre-Governance entitlement.
 *
 * These are the properties a runtime test cannot prove, because they are claims about what does NOT
 * exist: no product path that nominates, no Governance decision runtime, no Knowledge ratification,
 * no Heby reach, and no way for a client value to become authority.
 *
 * Runtime behaviour is proved in `genesis-postgres.ts` and `genesis-concurrency-postgres.ts`. This
 * file proves the shape that keeps that behaviour the ONLY behaviour.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  GENESIS_ACCEPTANCE_ASSURANCE,
  GENESIS_ACCEPTANCE_EFFECT,
  GENESIS_ACCEPTANCE_NON_EFFECTS,
  GENESIS_AUDIT_BOUNDARY,
  GENESIS_NOMINATION_ACTIONS,
  GENESIS_NOMINATION_ENTITY_TYPE,
  GENESIS_OPERATOR_ROOT,
} from "../../src/features/governance-genesis/contracts";
import { NOMINATION_SOURCE_LOCAL_OPERATOR } from "../../scripts/lib/nominate-genesis-human";

/*
 * The schema module is deliberately NOT imported here. `src/db/schema/*` has a pre-existing
 * initialisation cycle (_base → company → organization → _base) that only resolves when the barrel
 * is the entry point — `membership.ts` fails the same way. This file therefore proves the
 * schema/CLI/migration agreement over the SOURCE text, which is also the stronger assertion: it
 * catches a drift in the migration that a runtime constant never would.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/**
 * Source with comments removed.
 *
 * The firewall assertions below are about what the CODE does, not about what the prose may
 * DISCUSS. These files document precisely which authorities they refuse to touch — naming
 * `decision_records` in a header to say "this never writes it" must stay legal, or the honest
 * documentation would have to be deleted to satisfy the test.
 */
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

const ACCEPTANCE = "src/features/governance-genesis/genesis-acceptance.server.ts";
const CONTRACTS = "src/features/governance-genesis/contracts.ts";
const GENESIS_AUDIT = "src/features/governance-audit/genesis-nomination-audit.server.ts";
const KNOWLEDGE_AUDIT = "src/features/governance-audit/knowledge-mutation-audit.server.ts";
const ACTION = "src/app/(dashboard)/governance/genesis/actions.ts";
const PAGE = "src/app/(dashboard)/governance/genesis/page.tsx";
const CARD = "src/components/governance-genesis/genesis-acceptance-card.tsx";
const SCHEMA = "src/db/schema/genesis-nomination.ts";
const CLI = "scripts/genesis-nominate.ts";
const CLI_LIB = "scripts/lib/nominate-genesis-human.ts";
const MIGRATION = "src/db/migrations/20260811144829_g2_1_genesis_nomination.sql";

function main(): void {
  const srcFiles = collect("src");

  /* ── T1: NOTHING in the product can create a nomination ───────────────────── */
  {
    // The only insert into genesis_nominations in the entire repository lives in the operator CLI
    // library. If a second one appears, self-nomination has become representable.
    const offenders = srcFiles.filter((file) =>
      /insert\s*\(\s*genesisNominations|insert\s+into\s+genesis_nominations/i.test(read(file)),
    );
    assert.deepEqual(
      offenders,
      [],
      "no file under src/ may insert a genesis nomination — nominating is the operator ceremony's job",
    );
    assert.match(
      read(CLI_LIB),
      /insert into genesis_nominations/,
      "the operator library is the one place that writes a nomination",
    );
  }

  /* ── T2: src/ never imports the operator tooling ──────────────────────────── */
  {
    const offenders = srcFiles.filter((file) =>
      /from\s+["'][^"']*scripts\/(lib\/)?(nominate-genesis-human|genesis-nominate)/.test(read(file)),
    );
    assert.deepEqual(
      offenders,
      [],
      "operator tooling must stay out of the application tree",
    );
  }

  /* ── T3: the acceptance action takes no arguments ─────────────────────────── */
  {
    const source = read(ACTION);
    assert.match(
      source,
      /export async function acceptGenesisNominationAction\(\)\s*:/,
      "the acceptance action must take NO parameters — forged ids need a shape to arrive in",
    );
    for (const forgeable of [
      "tenantId",
      "userId",
      "authIdentityId",
      "membershipId",
      "roleId",
      "authorityRank",
      "bootstrap",
      "decisionId",
      "acceptedAt",
    ]) {
      assert.ok(
        !new RegExp(`input\\.${forgeable}|input:\\s*\\{[^}]*${forgeable}`).test(source),
        `the acceptance action must never read a client-supplied ${forgeable}`,
      );
    }
  }

  /* ── T4: G2 firewall — no Governance decision RUNTIME anywhere in G2.1 ─────
   *
   * The schema file is exempted from the reference ban, and only from that: G2 added
   * `consumed_by_decision_id`, a foreign key to `decision_records`, so the entitlement's own
   * lifecycle can say which genesis decision spent it. Naming a table in a foreign key is not
   * creating a decision. Every G2.1 RUNTIME file is still forbidden from touching either
   * Governance table, which is the claim that actually keeps the phases apart — and the schema
   * file is separately asserted below to contain no insert, update, or delete of its own.
   */
  {
    const runtimeFiles = [ACCEPTANCE, CONTRACTS, GENESIS_AUDIT, ACTION, PAGE, CARD, CLI, CLI_LIB];
    for (const file of runtimeFiles) {
      const code = codeOf(read(file));
      for (const forbidden of [
        "governanceSessions",
        "governance_sessions",
        "decisionRecords",
        "decision_records",
      ]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} must not touch ${forbidden} — creating the genesis DECISION is G2, not G2.1`,
        );
      }
    }
    // A schema file declares columns; it never performs a write.
    const schemaCode = codeOf(read(SCHEMA));
    assert.ok(!/\.insert\(|\.update\(|\.delete\(/.test(schemaCode), "the schema file writes nothing");
    assert.match(
      schemaCode,
      /consumedByDecisionId/,
      "the entitlement lifecycle records which decision spent it, rather than inferring it",
    );

    // `bootstrap` may be discussed in prose, but never written as a column or field.
    for (const file of [...runtimeFiles, SCHEMA]) {
      assert.ok(
        !/bootstrap\s*[:=]/.test(codeOf(read(file))),
        `${file} must never set a bootstrap field`,
      );
    }
  }

  /* ── T5: K4 firewall — no Knowledge ratification field is written ─────────── */
  {
    for (const file of [ACCEPTANCE, GENESIS_AUDIT, ACTION, CLI, CLI_LIB]) {
      const source = read(file);
      for (const forbidden of [
        "ratified_at",
        "ratifiedAt",
        "ratification_decision_id",
        "ratificationDecisionId",
        "governance_session_id",
        "governanceSessionId",
      ]) {
        assert.ok(
          !source.includes(forbidden),
          `${file} must not write ${forbidden} — K4 stays blocked behind G2`,
        );
      }
    }
  }

  /* ── T6: Heby firewall ─────────────────────────────────────────────────────── */
  {
    // No Heby surface may import the genesis modules, in either direction.
    const hebyFiles = srcFiles.filter(
      (file) => file.includes("heby-") || file.includes("heby/") || file.includes("/heby"),
    );
    assert.ok(hebyFiles.length > 0, "the Heby feature surface must exist for this test to mean anything");
    const offenders = hebyFiles.filter((file) =>
      /governance-genesis|genesis-nomination-audit|genesis-acceptance/.test(read(file)),
    );
    assert.deepEqual(offenders, [], "no Heby surface may reach genesis entitlement");

    // And no slash command, voice command, or tool names the ceremony.
    const commandFiles = srcFiles.filter((file) => file.includes("heby-commands"));
    const naming = commandFiles.filter((file) =>
      /genesis|nominat/i.test(read(file)),
    );
    assert.deepEqual(naming, [], "no Heby command may name the genesis ceremony");
  }

  /* ── T7: the audit boundary is a SIBLING of G1's, never an extension ──────── */
  {
    assert.equal(GENESIS_NOMINATION_ENTITY_TYPE, "genesis_nomination");
    assert.notEqual(
      GENESIS_NOMINATION_ENTITY_TYPE,
      "knowledge_fact",
      "genesis history must not be filed under Knowledge's entity type",
    );
    assert.ok(
      !codeOf(read(GENESIS_AUDIT)).includes("KNOWLEDGE_AUDIT_BOUNDARY"),
      "the genesis writer must not reference, and therefore cannot widen, G1's boundary",
    );
    assert.ok(
      !codeOf(read(KNOWLEDGE_AUDIT)).includes("GENESIS"),
      "G1's writer must stay unaware of genesis — neither may silently move the other",
    );
    // The honest limitation: the operator ceremony is NOT audited, because it has no truthful actor.
    assert.equal(GENESIS_AUDIT_BOUNDARY.recordsAcceptance, true);
    assert.equal(GENESIS_AUDIT_BOUNDARY.recordsOperatorNomination, false);
    assert.equal(GENESIS_AUDIT_BOUNDARY.recordsUnauthenticatedAttempts, false);
    assert.equal(GENESIS_AUDIT_BOUNDARY.recordsRefusedAttempts, false);
    assert.deepEqual(GENESIS_NOMINATION_ACTIONS, ["governance.genesis-nomination.accepted"]);
  }

  /* ── T8: the audit writer is append-only ──────────────────────────────────── */
  {
    const source = read(GENESIS_AUDIT);
    for (const forbidden of [".update(auditLog)", ".delete(auditLog)", "onConflict"]) {
      assert.ok(
        !source.includes(forbidden),
        `the genesis audit writer must contain no ${forbidden} — history is append-only`,
      );
    }
  }

  /* ── T9: no credential or bearer material may reach genesis code ──────────── */
  {
    for (const file of [ACCEPTANCE, GENESIS_AUDIT, CONTRACTS, ACTION, PAGE, CARD, CLI, CLI_LIB]) {
      const source = read(file);
      for (const forbidden of ["secretHash", "secret_hash", "salt", "SESSION_COOKIE_NAME"]) {
        assert.ok(
          !source.includes(forbidden),
          `${file} must never mention ${forbidden}`,
        );
      }
    }
  }

  /* ── T10: `revoked` is declared but no G2.1 code path can produce it ──────── */
  {
    // Reading the status to REFUSE a revoked nomination is required; WRITING it is not owned by
    // this phase. Only the second shape is forbidden.
    for (const file of [ACCEPTANCE, ACTION, CLI, CLI_LIB]) {
      const code = codeOf(read(file));
      assert.ok(
        !/status:\s*["']revoked["']/.test(code),
        `${file} must not write the revoked status — replacement semantics are not owned by G2.1`,
      );
    }
    // The drizzle-based half writes columns by camelCase name, so naming these at all would be a
    // write. (The operator library legitimately READS `m.revoked_at is null` to require a live
    // membership — reading somebody else's revocation is not writing the nomination's.)
    for (const file of [ACCEPTANCE, ACTION]) {
      const code = codeOf(read(file));
      assert.ok(
        !/revokedAt|revocationReason/.test(code),
        `${file} must not write revocation evidence`,
      );
    }
    // The operator INSERT names its columns explicitly; revocation is not among them.
    const insert = /insert into genesis_nominations\s*\(([^)]*)\)/i.exec(read(CLI_LIB));
    assert.ok(insert, "the operator library must insert with an explicit column list");
    assert.ok(
      !/revoked/.test(insert![1]!),
      "the operator INSERT must not write revocation columns",
    );
    assert.match(insert![1]!, /status/, "the INSERT names status explicitly");
    assert.match(
      read(CLI_LIB),
      /values \(\$1, \$2, \$3, 'pending', \$4\)/,
      "the operator INSERT hard-codes 'pending' — it has no parameter for another status",
    );
    // The status must still be READ, or a revoked nomination could be accepted.
    assert.match(
      codeOf(read(ACCEPTANCE)),
      /=== "revoked"/,
      "acceptance must refuse a revoked nomination",
    );
  }

  /* ── T11: the source constant, the schema CHECK and the CLI agree ─────────── */
  {
    assert.equal(NOMINATION_SOURCE_LOCAL_OPERATOR, "local-operator-ceremony");
    assert.match(
      read(SCHEMA),
      /GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony"/,
      "the schema's exported source constant must carry the same literal as the CLI's",
    );
    // The schema writes the literal inline (drizzle-kit renders an interpolated value as a bind
    // parameter, which is invalid inside a CHECK). This asserts the two never drift apart.
    assert.match(
      read(SCHEMA),
      /nominationSource\} = 'local-operator-ceremony'/,
      "the schema CHECK must carry the same literal as the exported constant",
    );
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /"nomination_source" = 'local-operator-ceremony'/,
      "the migration CHECK must carry the literal, never a bind parameter",
    );
    assert.ok(!migration.includes("$1"), "a migration must contain no bind parameters");
  }

  /* ── T12: the migration carries the constitutional invariant ──────────────── */
  {
    const migration = read(MIGRATION);
    assert.match(
      migration,
      /CREATE UNIQUE INDEX "genesis_nominations_one_active_per_tenant_uq"[\s\S]*?WHERE "genesis_nominations"\."status" <> 'revoked'/,
      "one active genesis nomination per tenant must be a PARTIAL UNIQUE INDEX, not an app check",
    );
    assert.match(
      migration,
      /"genesis_nominations_tenant_member_fk" FOREIGN KEY \("tenant_id","nominated_user_id"\) REFERENCES "public"\."memberships"\("tenant_id","user_id"\)/,
      "tenant binding must be structural, reusing the existing memberships unique index",
    );
  }

  /* ── T13: the surface tells the truth about consequences ──────────────────── */
  {
    const card = read(CARD);
    assert.match(card, /Accept Genesis Nomination/, "the final action must be constitutionally worded");
    for (const vague of [">Save<", ">Continue<", ">Confirm<"]) {
      assert.ok(!card.includes(vague), `the final action must not be a vague "${vague}"`);
    }
    // The consequence lists are rendered from frozen values, so the wording cannot drift.
    assert.ok(card.includes("GENESIS_ACCEPTANCE_NON_EFFECTS"));
    assert.ok(card.includes("GENESIS_ACCEPTANCE_EFFECT"));
    assert.ok(GENESIS_ACCEPTANCE_NON_EFFECTS.length >= 8);
    for (const required of [
      "does not create a Governance decision",
      "does not ratify Knowledge",
      "does not grant execution authority",
      "does not enable Computer Use",
      "does not enable providers",
      "does not change your application role",
      "does not create permissions",
    ]) {
      assert.ok(
        GENESIS_ACCEPTANCE_NON_EFFECTS.includes(required),
        `the surface must state that acceptance ${required}`,
      );
    }
    assert.match(GENESIS_ACCEPTANCE_EFFECT, /eligible to establish/);
  }

  /* ── T14: assurance and operator-root claims stay honest ──────────────────── */
  {
    assert.equal(GENESIS_ACCEPTANCE_ASSURANCE.acceptedAssuranceLevel, "aal1");
    assert.equal(GENESIS_ACCEPTANCE_ASSURANCE.mfaRequired, false);
    assert.equal(GENESIS_ACCEPTANCE_ASSURANCE.stepUpImplemented, false);
    assert.match(GENESIS_ACCEPTANCE_ASSURANCE.limitation, /aal1/);

    assert.equal(GENESIS_OPERATOR_ROOT.operatorIdentityVerified, false);
    assert.equal(GENESIS_OPERATOR_ROOT.isPlatformAdminAuthority, false);
    assert.equal(GENESIS_OPERATOR_ROOT.isGovernanceAuthority, false);

    // No file may claim an assurance the system does not provide.
    for (const file of [ACCEPTANCE, CONTRACTS, PAGE, CARD, CLI]) {
      const source = read(file);
      for (const overclaim of ["aal2", "aal3", "phishing-resistant", "MFA verified"]) {
        assert.ok(
          !source.includes(overclaim),
          `${file} must not claim ${overclaim} — D1 proves aal1 only`,
        );
      }
    }
  }

  /* ── T15: the CLI cannot accept, and the product cannot nominate ──────────── */
  {
    const cli = `${read(CLI)}\n${read(CLI_LIB)}`;
    assert.ok(
      !/'accepted'|"accepted"/.test(cli.replace(/already-nominated/g, "")),
      "the operator ceremony must have no way to write the accepted status",
    );
    assert.ok(
      !/user_session_contexts|setSessionCookie/.test(cli),
      "the operator ceremony must never mint a session",
    );
    assert.ok(
      !/insert into roles|insert into permissions|insert into memberships|insert into companies/.test(cli),
      "the operator ceremony must not create tenants, roles, permissions, or memberships",
    );
    // And the product half has no insert at all — proved in T1.
    assert.ok(
      !read(ACCEPTANCE).includes(".insert("),
      "the acceptance module must contain no insert into the nomination table",
    );
  }

  console.log("PASS g2-1 boundaries and firewall");
}

main();
