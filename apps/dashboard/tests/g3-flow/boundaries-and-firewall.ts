/*
 * G3 — structural boundaries around Governance authority delegation and revocation.
 *
 * These prove claims about what does NOT exist: no second authority source of truth, no role-band
 * or permission shortcut, no path to end the genesis, no history deletion, no Heby reach, and no
 * client-supplied authority.
 *
 * Runtime behaviour lives in `delegation-postgres.ts` and `delegation-concurrency-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  AUTHORITY_DECISION_TYPES,
  AUTHORITY_REVOCATION_POLICY,
  AUTHORITY_SUBJECT_TYPES,
  DELEGATION_EFFECT,
  DELEGATION_NON_EFFECTS,
  DELEGATION_OUTCOME,
  DELEGATION_SCOPE_NOTICE,
  REVOCATION_NON_EFFECTS,
  REVOCATION_OUTCOME,
} from "../../src/features/governance-decision/delegation-contracts";
import {
  GOVERNANCE_AUDIT_ACTIONS,
  POST_BOOTSTRAP_AUTHORITY_MODEL,
} from "../../src/features/governance-decision/contracts";

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

const CONTRACTS = "src/features/governance-decision/delegation-contracts.ts";
const DELEGATION = "src/features/governance-decision/authority-delegation.server.ts";
/* G6C: authority resolution moved out of the writer-bearing module into a read-only one. */
const RESOLVER = "src/features/governance-decision/authority-read.server.ts";
const ACTION = "src/app/(dashboard)/governance/authority/actions.ts";
const PAGE = "src/app/(dashboard)/governance/authority/page.tsx";
const CARD = "src/components/governance-authority/authority-roster-card.tsx";
const G3_ALL = [CONTRACTS, DELEGATION, RESOLVER, ACTION, PAGE, CARD];

function main(): void {
  const srcFiles = collect("src");

  /* ── T1: THE DIRECTOR'S GATE A ANSWERS ARE THE POLICY, VERBATIM ──────────── */
  {
    assert.equal(AUTHORITY_REVOCATION_POLICY.bootstrapMayRevokeAnyDelegation, true, "A1-c");
    assert.equal(AUTHORITY_REVOCATION_POLICY.delegateMayRevokeOwnGrantsOnly, true, "A1-c");
    assert.equal(AUTHORITY_REVOCATION_POLICY.delegateMayRevokePeerGrants, false, "A1-c");
    assert.equal(AUTHORITY_REVOCATION_POLICY.bootstrapAuthorityRevocable, false, "A2-a");
    assert.equal(AUTHORITY_REVOCATION_POLICY.bootstrapAuthorityTransferable, false, "A2-a");
    assert.equal(AUTHORITY_REVOCATION_POLICY.zeroAuthorityTenantReachable, false, "A3-a");

    // And the code implements A1-c where it is decided, not somewhere it could be forgotten.
    assert.match(
      codeOf(read(DELEGATION)),
      /if \(revoking\.via !== "bootstrap" && target\.actor_id !== tenant\.userId\)\s*\{\s*throw new AuthorityAbort\("not-the-grantor"\)/,
      "a delegate may revoke only grants they made; the bootstrap human may revoke any",
    );
  }

  /* ── T2: NO SECOND SOURCE OF TRUTH ───────────────────────────────────────── */
  {
    /*
     * G3 adds no migration at all. The count is pinned rather than pattern-matched: G2's
     * `..._g2_governance_bootstrap_authority.sql` legitimately contains the word "authority", so a
     * name filter would either miss a G3 migration or flag G2's. If this number changes, a phase
     * added schema and must have gone through Gate B first.
     *
     * I1 and I1.1 are those cases: each went through Gate B and added exactly one migration, for a
     * different subsystem. The assertion keeps its meaning by naming every migration that may exist
     * beyond G2's, so a future phase still cannot add schema silently.
     */
    const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((n) =>
      n.endsWith(".sql"),
    );
    const G2_MIGRATION = "20260811155831_g2_governance_bootstrap_authority.sql";
    const beyondG2 = migrations.filter((n) => n > G2_MIGRATION).sort();
    assert.deepEqual(
      beyondG2,
      [
        "20260812090301_i1_membership_authorization.sql",
        "20260812105312_i1_1_tenant_role_baseline.sql",
        "20260812130555_i1_2_identity_enrollment.sql",
        /*
         * Membership–Role Tenant Integrity. Added by Gate B, for a different subsystem: one composite
         * foreign key binding a membership's tenant to its role's, on `memberships`. It touches no
         * Governance table and grants no authority — this allowlist is exactly the mechanism that
         * required it to be declared here rather than appear silently.
         */
        "20260813090642_membership_role_tenant_integrity.sql",
        /*
         * KR5 historical answer evidence. Added by Gate B, for a different subsystem: two tables
         * recording which Knowledge evidence was shown with one Heby answer, plus the composite
         * unique on `messages` their tenant-safe foreign key requires. It writes no Governance
         * table, creates no authority and grants none — declaring it here is exactly the review
         * this allowlist exists to force.
         */
        "20260815202736_heby_answer_evidence.sql",
        "20260816063156_r3a_action_authorization.sql",
        /*
         * R3W durable work artifacts. Added by Gate B, for a different subsystem: two tables
         * holding prepared work and its immutable revisions. It writes no Governance table, creates
         * no authority, grants none, and carries no approval column at all — declaring it here is
         * exactly the review this allowlist exists to force.
         */
        "20260816085245_r3w_durable_work_artifacts.sql", "20260816105458_r3r_durable_recipient_authority.sql", "20260816194116_r3b_action_execution_attempts.sql",
        /* R4A tenant bootstrap ceremony — a later Gate-B phase, declared rather than silent. */
        "20260817195446_r4a_tenant_provisioning_source.sql",
        "20260818172455_production_provenance_vocabulary.sql",
        /* G6D generic answer-source evidence — a declared later phase, not this one's. */
        "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql",
      /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one CREATE TABLE,
       * two foreign keys and three indexes, zero DROP, and `knowledge_nodes` untouched. */
      "20260826064423_kr_ext1_knowledge_external_references.sql",
      "20260828071500_ap4b_origination_invocation_provenance.sql",
      "20260828173456_sia26_origination_agent_attribution.sql",
      "20260828190630_sia3_agent_improvement_hypothesis.sql",
      /* AMA-1 — the Agent Mandate Authority table. A declared later phase, not this one's. */
      "20260831110423_ama1_agent_mandate_authority.sql",
      /* OSA-1 — the departments additive hardening. A declared later phase, not this one's. */
      "20260831212454_osa1_department_structure_authority.sql",
      /* WORK-1 — the Organizational Work Authority table. A declared later phase, not this one's. */
      "20260901122013_work1_organizational_work_authority.sql",
      ],
      "G3 adds no migration — authority is derived from decisions; only Gate-B migrations for other subsystems follow G2",
    );
    assert.deepEqual(
      migrations.filter((n) => /_g3_|deleg/i.test(n)),
      [],
      "no G3-named migration exists",
    );
    for (const file of G3_ALL) {
      assert.ok(!codeOf(read(file)).includes("pgTable("), `${file} must not define a table`);
    }
    // Authority is computed from decision_records, with revocation as a `not exists`.
    const resolver = codeOf(read(RESOLVER));
    assert.match(resolver, /decision_type = 'delegate-authority'/);
    assert.match(
      resolver,
      /not exists \(\s*select 1 from public\.decision_records r/,
      "a revoked delegation stops resolving because of a NOT EXISTS, not a status column",
    );
    // No "active authority" cache/table/materialisation anywhere.
    for (const banned of ["activeAuthorities", "authority_cache", "governance_authorities"]) {
      const offenders = srcFiles.filter((f) => read(f).includes(banned));
      assert.deepEqual(offenders, [], `no ${banned} projection may exist`);
    }
  }

  /* ── T3: THE BOOTSTRAP ROW IS THE MUTEX ──────────────────────────────────── */
  {
    const delegation = codeOf(read(DELEGATION));
    assert.match(
      delegation,
      /where tenant_id = \$\{tenantId\}::uuid and bootstrap = true\s*for update/,
      "every authority mutation serializes on the tenant's bootstrap decision row",
    );
    // Both ceremonies take it, and both re-resolve authority INSIDE the lock.
    const lockCalls = [...delegation.matchAll(/lockTenantGovernance\(/g)].length;
    assert.ok(lockCalls >= 3, "delegate and revoke both take the mutex (plus its definition)");
    const reResolve = [...delegation.matchAll(/requireAuthorityWithinLock\(/g)].length;
    assert.ok(reResolve >= 3, "both ceremonies re-resolve authority inside the lock");
  }

  /* ── T4: A2-a — NO PATH ENDS THE GENESIS ─────────────────────────────────── */
  {
    const delegation = codeOf(read(DELEGATION));
    assert.match(
      delegation,
      /if \(target\.bootstrap\) throw new AuthorityAbort\("bootstrap-not-revocable"\)/,
      "a revocation naming the genesis is refused explicitly",
    );
    assert.match(
      delegation,
      /if \(target\.decision_type !== "delegate-authority"\)/,
      "only a delegation decision can be revoked",
    );
    // No transfer ceremony was smuggled in.
    for (const banned of ["transferAuthority", "transferGovernance", "replaceBootstrap", "deposeBootstrap"]) {
      assert.ok(
        !srcFiles.some((f) => read(f).includes(banned)),
        `${banned} must not exist — authority transfer is a separate Director phase`,
      );
    }
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.bootstrapAuthorityRevocable, false);
  }

  /* ── T5: HISTORY IS NEVER MUTATED OR DELETED ─────────────────────────────── */
  {
    for (const file of G3_ALL) {
      const code = codeOf(read(file));
      for (const banned of [
        ".update(decisionRecords)",
        ".delete(decisionRecords)",
        ".update(governanceSessions)",
        ".delete(governanceSessions)",
        "delete from public.decision_records",
        "update public.decision_records",
      ]) {
        assert.ok(!code.includes(banned), `${file} must not contain ${banned}`);
      }
    }
    // Revocation writes a NEW decision naming the old one; it never touches the old row.
    assert.match(
      codeOf(read(DELEGATION)),
      /decisionType: "revoke",\s*subjectType: "governance_decision",\s*subjectId: delegationId/,
      "revocation names the delegation as its subject rather than editing it",
    );
  }

  /* ── T6: NO ROLE-BAND OR PERMISSION SHORTCUT ─────────────────────────────── */
  {
    for (const file of [RESOLVER, DELEGATION]) {
      const code = codeOf(read(file));
      for (const borrowed of [
        "roles",
        "rolePermissions",
        "role_permissions",
        "permissions",
        "authorityScope",
        "authority_scope",
        "authorityRank",
        "authority_rank",
        "systemRole",
        "system_role",
        "roleType",
      ]) {
        assert.ok(
          !new RegExp(`\\b${borrowed}\\b`).test(code),
          `${file} must not consult ${borrowed} — none of it was established by a Governance decision`,
        );
      }
    }
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.roleBandGrantsAuthority, false);
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.permissionRuntimeConnected, false);
    // G3 connected the delegation runtime, so this constant must now say so — a stale `false`
    // here would be the model lying about itself.
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.delegationRuntimeConnected, true);
    assert.equal(POST_BOOTSTRAP_AUTHORITY_MODEL.transferable, true);
  }

  /* ── T7: THE CLIENT SUPPLIES NO AUTHORITY ────────────────────────────────── */
  {
    const action = read(ACTION);
    assert.match(
      action,
      /delegateGovernanceAuthorityAction\(input:\s*\{\s*toUserId:\s*string;\s*justification:\s*string;\s*\}\)/,
      "delegation accepts a target and a reason — nothing else",
    );
    assert.match(
      action,
      /revokeGovernanceAuthorityAction\(input:\s*\{\s*delegationDecisionId:\s*string;\s*justification:\s*string;\s*\}\)/,
      "revocation accepts a delegation id and a reason — nothing else",
    );
    for (const forgeable of [
      "tenantId",
      "actorId",
      "authIdentityId",
      "roleId",
      "authorityRank",
      "authoritySource",
      "decisionType",
      "bootstrap",
      "sessionId",
      "status",
      "decidedAt",
    ]) {
      assert.ok(
        !new RegExp(`input\\.${forgeable}\\b`).test(action),
        `the G3 actions must never read a client-supplied ${forgeable}`,
      );
    }
    // The server fixes the decision type and actor itself.
    const delegation = codeOf(read(DELEGATION));
    assert.match(delegation, /decisionType: "delegate-authority"/);
    assert.match(delegation, /decisionType: "revoke"/);
  }

  /* ── T8: HEBY FIREWALL ───────────────────────────────────────────────────── */
  {
    const hebyFiles = srcFiles.filter(
      (file) => file.includes("heby-") || file.includes("heby/") || file.includes("/heby"),
    );
    assert.ok(hebyFiles.length > 0, "the Heby surface must exist for this test to mean anything");
    /* G6C: writer symbols, matched against code rather than comments. */
    const offenders = hebyFiles.filter((file) =>
      /delegateGovernanceAuthority|revokeGovernanceAuthority/.test(codeOf(read(file))),
    );
    assert.deepEqual(offenders, [], "no Heby surface may reach authority delegation");

    /*
     * Checked over CODE, not comments: the Heby command headers legitimately say "a command cannot
     * grant itself authority", which is the invariant, not a violation of it.
     */
    const commandFiles = srcFiles.filter((file) => file.includes("heby-commands"));
    const naming = commandFiles.filter((file) =>
      /deleg|revoke.*author|grant.*author/i.test(codeOf(read(file))),
    );
    assert.deepEqual(naming, [], "no Heby command may name an authority mutation");

    const voiceFiles = srcFiles.filter((file) => file.includes("heby-voice"));
    const voiceOffenders = voiceFiles.filter((file) => /deleg|revoke/i.test(codeOf(read(file))));
    assert.deepEqual(voiceOffenders, [], "voice may not move authority");
  }

  /* ── T9: NO PROVIDER, EXECUTION, OR KNOWLEDGE COUPLING ─────────────────────
   *
   * The RESOLVER is exempt from the bare Knowledge-token check and only from that: it is shared
   * G2/K4 code whose subject existence check reads `knowledge_nodes` to confirm a ratify decision's
   * subject exists. That read predates G3, is asserted by G2's own firewall, and is not a write —
   * the write-ban below still covers every file including the resolver.
   */
  {
    for (const file of G3_ALL) {
      const code = codeOf(read(file));
      for (const forbidden of [
        "providerConnectivityControls",
        "directorEnabled",
        "ANTHROPIC_API_KEY",
        "computer-use",
        "child_process",
        "spawn(",
        "fetch(",
      ]) {
        assert.ok(!code.includes(forbidden), `${file} must not reach ${forbidden}`);
      }
      assert.ok(
        !/insert into public\.knowledge|update public\.knowledge|delete from public\.knowledge/i.test(
          code,
        ),
        `${file} must never write any Knowledge table`,
      );
      assert.ok(
        !code.includes('@/db/schema/knowledge'),
        `${file} must not import the Knowledge schema — Knowledge consumes Governance, not the reverse`,
      );
    }
    // The G3-only files may not even name a Knowledge table.
    for (const file of [CONTRACTS, DELEGATION, CARD]) {
      const code = codeOf(read(file));
      for (const forbidden of ["knowledgeNodes", "knowledge_nodes", "ratificationDecisionId"]) {
        assert.ok(!code.includes(forbidden), `${file} must not reach ${forbidden}`);
      }
    }
  }

  /* ── T10: THE VOCABULARY IS EXISTING SCHEMA, NOT INVENTED ────────────────── */
  {
    const enums = read("src/db/schema/_enums.ts");
    for (const type of AUTHORITY_DECISION_TYPES) {
      assert.ok(enums.includes(`"${type}"`), `${type} must be an existing governance_decision_type`);
    }
    assert.ok(enums.includes('"authority-delegation"'), "the domain is an existing enum value");
    assert.deepEqual([...AUTHORITY_DECISION_TYPES], ["delegate-authority", "revoke"]);
    assert.deepEqual([...AUTHORITY_SUBJECT_TYPES], ["user", "governance_decision"]);
    // Still unbuilt, and still not claimed.
    for (const notYet of ["escalate-authority", "suspend", "appeal"]) {
      assert.ok(
        !AUTHORITY_DECISION_TYPES.includes(notYet as never),
        `${notYet} has no runtime and must not be declared`,
      );
    }
    assert.equal(DELEGATION_OUTCOME, "authority-delegated");
    assert.equal(REVOCATION_OUTCOME, "authority-revoked");
  }

  /* ── T11: AUDIT USES THE GOVERNANCE SIBLING, NOT KNOWLEDGE'S ─────────────── */
  {
    /* I1, I1.1 and I1.2 added their own actions — different subsystems using the same sibling sink,
     * which is exactly what this assertion is meant to allow and to keep visible. */
    assert.deepEqual([...GOVERNANCE_AUDIT_ACTIONS], [
      "governance.bootstrap.established",
      "governance.decision.recorded",
      "governance.authority.delegated",
      "governance.authority.revoked",
      "governance.membership.authorized",
      "governance.role.provisioned",
      "governance.identity.enrollment.approved",
      "governance.identity.enrollment.rejected",
    ]);
    const delegation = codeOf(read(DELEGATION));
    assert.match(delegation, /action: "governance\.authority\.delegated"/);
    assert.match(delegation, /action: "governance\.authority\.revoked"/);
    assert.ok(
      !delegation.includes("KNOWLEDGE_AUDIT_BOUNDARY"),
      "G3 must not widen Knowledge's audit boundary",
    );
    assert.ok(
      !delegation.includes("recordKnowledgeMutationWithin"),
      "moving authority is not a Knowledge mutation",
    );
    // The audit carries references, never the justification — the decision owns that.
    const auditBlocks = delegation.match(/metadata: \{[\s\S]*?\}/g) ?? [];
    for (const block of auditBlocks) {
      assert.ok(!/justification/.test(block), "audit metadata must not carry the justification");
    }
  }

  /* ── T12: THE SURFACE STATES CONSEQUENCES AND IS ACCESSIBLE ──────────────── */
  {
    const card = read(CARD);
    for (const required of [
      "Delegate Governance Authority",
      "Revoke Governance Authority",
      "Active Governance Authorities",
      "Authority Provenance",
    ]) {
      assert.ok(card.includes(required), `the surface must use the phrase "${required}"`);
    }
    // Checked over CODE: the header legitimately lists the words it refuses to use.
    const cardCode = codeOf(card);
    for (const vague of [">Enable<", "Turn on", "Promote<", "Make admin", "Approve user"]) {
      assert.ok(!cardCode.includes(vague), `the surface must not say "${vague}"`);
    }
    assert.ok(card.includes("DELEGATION_NON_EFFECTS"));
    assert.ok(card.includes("REVOCATION_NON_EFFECTS"));
    for (const required of [
      "does not change their authentication or password",
      "does not change their membership",
      "does not change their organizational role",
      "does not grant Knowledge ownership or authoring rights",
      "does not grant provider access or change the model kill-switch",
      "does not grant execution, Computer Use, or terminal authority",
      "does not grant platform administration",
      "does not grant authority in any other tenant",
    ]) {
      assert.ok(DELEGATION_NON_EFFECTS.includes(required), `delegation must state it ${required}`);
    }
    assert.ok(
      REVOCATION_NON_EFFECTS.includes("does not delete the original delegation decision"),
    );
    assert.match(DELEGATION_EFFECT, /within this tenant only/);
    assert.match(DELEGATION_SCOPE_NOTICE, /no narrower scopes|no partial Governance permissions/);

    // Accessibility.
    assert.match(card, /<label\s+htmlFor=\{`\$\{ids\}-justification`\}/);
    assert.match(card, /<label\s+htmlFor=\{`\$\{ids\}-target`\}/);
    assert.match(card, /aria-describedby=/);
    assert.match(card, /aria-invalid=/);
    assert.match(card, /role="alert"/);
    assert.match(card, /role="status"/);
    assert.match(card, /aria-hidden/);
    // Authority state is carried by words + icon, not colour.
    assert.match(card, /ShieldCheck/);
    assert.match(card, /genesis authority, established by this tenant's bootstrap decision/);
  }

  /* ── T13: ONE GOVERNANCE WORKSPACE, ONE RESOLVER ─────────────────────────── */
  {
    // The roster card lives beside the genesis card under the existing Governance route.
    assert.ok(CARD.startsWith("src/components/governance-authority/"));
    assert.match(read(PAGE), /AuthorityRosterCard/);
    // Exactly one function resolves Governance authority, and everything else calls it.
    const definitions = srcFiles.filter((f) =>
      /export async function resolveGovernanceAuthority\b/.test(read(f)),
    );
    assert.deepEqual(
      definitions,
      ["src/features/governance-decision/authority-read.server.ts"],
      "one resolver, extended in place — never a parallel one",
    );
    // K4 still consumes it rather than owning authority.
    const k4 = read("src/features/knowledge-ratification/ratify-version.server.ts");
    assert.match(k4, /resolveGovernanceAuthority/);
    assert.ok(
      !/delegate-authority|AUTHORITY_REVOCATION_POLICY/.test(k4),
      "Knowledge must not know how authority is granted, only whether the caller holds it",
    );
  }

  console.log("PASS g3 boundaries and firewall");
}

main();
