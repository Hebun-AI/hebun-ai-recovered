/*
 * AP-4A — the Work Domain Authority and mandate responsibility, against a disposable PostgreSQL.
 *
 * WORK DOMAIN AUTHORITY
 *   W1 create: one row, one audit event carrying slug + name; malformed name/slug refused, nothing written.
 *   W2 gate: no tenant / a member without Governance authority is refused; nothing written.
 *   W3 lifetime uniqueness: a used slug is refused, retired or not ("slugs are never reused");
 *      another tenant may use the same slug; concurrent creation of one slug commits once.
 *   W4 rename changes the NAME only — "the slug does not change" — and audits the previous name;
 *      an unchanged name is refused.
 *   W5 retire: once, permanent; touches no work item or mandate; a retired domain cannot be renamed.
 *   W6 tenant isolation: another tenant's domain is unresolved to every writer.
 *   W7 the database refuses cross-tenant references (23503), malformed scope/slug (23514), and
 *      deleting a referenced domain (23503).
 * MANDATE (ONE AUTHORITY, TWO CONTRACTS)
 *   M1 the released 5-value contract writes no responsibility; "legacy decision evidence is
 *      byte-identical" and its audit metadata carries no responsibility key.
 *   M2 the responsibility-aware contract: "record-work needs a responsibility"; responsibility for a
 *      scope without record-work is not admitted; malformed/repeated grants are invalid; another
 *      tenant's or an unknown domain is "work-domain-unresolvable"; "retired domain is never granted";
 *      a refused write leaves no revision and no rows.
 *   M3 a valid grant writes ONE revision, "two responsibility rows", and binds them into the decision
 *      evidence and audit metadata; the reader reports them.
 *   M4 a later legacy revision is undeclared again; the earlier rows are history, untouched.
 *   M5 retiring a granted domain leaves the row and reports it retired.
 *   M6 concurrent responsibility-aware writes on one observed revision: one wins, rows only for it.
 * WORK ITEMS
 *   P1 the released WORK-1 writer records work with work_scope_kind / work_domain_id NULL (legacy).
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import {
  establishAgentMandate,
  establishAgentMandateWithResponsibility,
} from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { readEffectiveMandateResponsibility } from "../../src/features/agent-mandate/read-agent-mandate-responsibility.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import { readWorkDomains } from "../../src/features/work-domain/read-work-domains.server";
import { recordWorkDomain, renameWorkDomain, retireWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION = "Establishing Governance for the AP-4A fixture organization, and I accept responsibility.";
const MANDATE_JUSTIFICATION = "I am bounding what this agent exists to do, and I accept responsibility for that bound.";
const PURPOSE = "Record organizational work for a human to review. It proposes; a human decides.";
const LEGACY_EVIDENCE_KEYS = ["agentId", "authorityFromBootstrapDecisionId", "mandateRevision", "proposalScope", "supersedesMandateId"];
const LEGACY_AUDIT_KEYS = ["agentId", "enforced", "governanceDecisionId", "governanceSessionId", "mandateRevision", "proposalScope", "supersedesMandateId"];

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRowFor(client: Client, s: Seeded, tag: string): Promise<string> {
  return (
    await client.query<{ id: string }>(
      `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
         user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
         issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
       values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour') returning id`,
      [s.authIdentityId, tag.repeat(64).slice(0, 64), s.userId, s.tenantId, s.membershipId],
    )
  ).rows[0]!.id;
}

function contextFor(s: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId, membershipVersion: 1,
    roleId: s.roleId, sessionContextId, provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap4a_foundation");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };
  const n = async (sql: string, params: unknown[] = []) => Number(Object.values((await setup.query(sql, params)).rows[0] as object)[0]);
  const code = async (sql: string, params: unknown[]) => {
    await setup.query("begin");
    try {
      await setup.query(sql, params);
      return "none";
    } catch (e) {
      return (e as { code?: string }).code ?? "unknown";
    } finally {
      await setup.query("rollback");
    }
  };

  try {
    const a = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-ap4a", email: "director@acme.test" })) as Seeded;
    const b = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-ap4a", email: "director@globex.test" })) as Seeded;
    const aCtx = contextFor(a, await sessionRowFor(setup, a, "a"), "ap4a-a");
    const bCtx = contextFor(b, await sessionRowFor(setup, b, "b"), "ap4a-b");
    for (const [s, ctx] of [[a, aCtx], [b, bCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source, accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, deps)).status, "established");
    }
    /* A colleague in A with an active membership and NO Governance authority. */
    const colleagueUser = (await setup.query<{ id: string }>(`insert into users (email, name) values ('colleague@acme.test','colleague@acme.test') returning id`)).rows[0]!.id;
    const colleagueIdentity = (
      await setup.query<{ id: string }>(
        `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at) values ($1,'local','hebun-local','local:colleague@acme.test','active',true, now()) returning id`,
        [colleagueUser],
      )
    ).rows[0]!.id;
    const colleagueMembership = (
      await setup.query<{ id: string }>(`insert into memberships (tenant_id, user_id, role_id, status) values ($1,$2,$3,'active') returning id`, [a.tenantId, colleagueUser, a.roleId])
    ).rows[0]!.id;
    const colleague: Seeded = { tenantId: a.tenantId, userId: colleagueUser, authIdentityId: colleagueIdentity, membershipId: colleagueMembership, roleId: a.roleId };
    const colleagueCtx = contextFor(colleague, await sessionRowFor(setup, colleague, "c"), "ap4a-colleague");

    const domains = () => n(`select count(*) from work_domains`);
    const domainAudit = (action: string) => n(`select count(*) from audit_log where action = $1`, [action]);

    /* ═══ W1 · create ══════════════════════════════════════════════════════ */
    const security = await recordWorkDomain(aCtx, { slug: "security", name: "Security" }, deps);
    assert.equal(security.status, "recorded");
    if (security.status !== "recorded") throw new Error("unreachable");
    assert.equal(security.workDomain.inService, true);
    const created = (await setup.query(`select metadata, entity_type, source from audit_log where action = 'work-domain.created'`)).rows;
    assert.equal(created.length, 1, "W1: one audit event");
    assert.deepEqual(created[0].metadata, { slug: "security", name: "Security" });
    for (const [input, reason] of [
      [{ slug: "Security", name: "x" }, "malformed-work-domain-slug"],
      [{ slug: "legal review", name: "x" }, "malformed-work-domain-slug"],
      [{ slug: "ok", name: " Padded" }, "malformed-work-domain-name"],
      [{ slug: "ok", name: "" }, "malformed-work-domain-name"],
      [{ slug: "ok", name: "two\nlines" }, "malformed-work-domain-name"],
    ] as const) {
      assert.deepEqual(await recordWorkDomain(aCtx, input, deps), { status: "refused", reason }, `W1: ${JSON.stringify(input)}`);
    }
    assert.equal(await domains(), 1, "W1: refusals write nothing");

    /* ═══ W2 · gate ════════════════════════════════════════════════════════ */
    assert.deepEqual(await recordWorkDomain(null, { slug: "content", name: "Content" }, deps), { status: "refused", reason: "no-authorized-tenant-context" });
    assert.deepEqual(await recordWorkDomain(colleagueCtx, { slug: "content", name: "Content" }, deps), { status: "refused", reason: "not-authorized" }, "W2: a member without Governance authority is refused");
    assert.deepEqual(await retireWorkDomain(colleagueCtx, { workDomainId: security.workDomain.workDomainId }, deps), { status: "refused", reason: "not-authorized" });
    assert.equal(await domains(), 1);

    /* ═══ W4 · rename ══════════════════════════════════════════════════════ */
    const renamed = await renameWorkDomain(aCtx, { workDomainId: security.workDomain.workDomainId, name: "Security Review" }, deps);
    assert.equal(renamed.status, "recorded");
    if (renamed.status !== "recorded") throw new Error("unreachable");
    assert.equal(renamed.workDomain.slug, "security", "W4: the slug does not change");
    assert.equal(renamed.workDomain.workDomainId, security.workDomain.workDomainId);
    assert.deepEqual(
      (await setup.query(`select metadata from audit_log where action = 'work-domain.renamed'`)).rows[0].metadata,
      { slug: "security", name: "Security Review", previousName: "Security" },
      "W4: the previous name is history",
    );
    assert.deepEqual(
      await renameWorkDomain(aCtx, { workDomainId: security.workDomain.workDomainId, name: "Security Review" }, deps),
      { status: "refused", reason: "work-domain-name-unchanged" },
    );

    /* ═══ W6 · tenant isolation ════════════════════════════════════════════ */
    assert.deepEqual(
      await renameWorkDomain(bCtx, { workDomainId: security.workDomain.workDomainId, name: "Stolen" }, deps),
      { status: "refused", reason: "work-domain-unresolved" },
      "W6: another tenant's domain is unresolved",
    );
    assert.deepEqual(await retireWorkDomain(bCtx, { workDomainId: security.workDomain.workDomainId }, deps), { status: "refused", reason: "work-domain-unresolved" });
    const bListed = await readWorkDomains(bCtx, deps);
    assert.deepEqual(bListed, { status: "read", workDomains: [] }, "W6: the reader is tenant-scoped");

    /* ═══ W3 · lifetime uniqueness, per tenant, concurrent ═════════════════ */
    assert.deepEqual(await recordWorkDomain(aCtx, { slug: "security", name: "Again" }, deps), { status: "refused", reason: "work-domain-slug-taken" });
    assert.equal((await recordWorkDomain(bCtx, { slug: "security", name: "Security" }, deps)).status, "recorded", "W3: slugs are per tenant");
    const handles = Array.from({ length: 6 }, () => createControlPlaneDb(harness.dbUrl));
    try {
      const raced = await Promise.all(handles.map((h) => recordWorkDomain(aCtx, { slug: "legal-review", name: "Legal Review" }, { getDb: () => h.db })));
      assert.equal(raced.filter((r) => r.status === "recorded").length, 1, "W3: concurrent creation of one slug commits once");
      assert.ok(raced.filter((r) => r.status === "refused").every((r) => r.status === "refused" && r.reason === "work-domain-slug-taken"));
    } finally {
      await Promise.all(handles.map((h) => h.dispose()));
    }

    /* ═══ M1 · the released contract ═══════════════════════════════════════ */
    const agentResult = await createDurableAgentIdentity(aCtx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    const bAgentResult = await createDurableAgentIdentity(bCtx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    if (agentResult.status !== "established" || bAgentResult.status !== "established") throw new Error("agent fixture");
    const agentId = agentResult.identity.agentId;
    const legacy = await establishAgentMandate(
      aCtx,
      { agentId, purpose: PURPOSE, proposalScope: ["record-work", "send"], justification: MANDATE_JUSTIFICATION, observedMandateRevision: null },
      deps,
    );
    assert.equal(legacy.status, "established");
    if (legacy.status !== "established") throw new Error("unreachable");
    assert.ok(!("responsibility" in legacy), "M1: the released result shape is unchanged");
    const rows = () => n(`select count(*) from agent_mandate_responsibilities`);
    assert.equal(await rows(), 0, "M1: the released contract writes no responsibility");
    const legacyDecision = (await setup.query<{ evidence: Record<string, unknown> }>(`select evidence from decision_records where id = $1`, [legacy.mandate.governanceDecisionId])).rows[0];
    assert.deepEqual(Object.keys(legacyDecision.evidence).sort(), LEGACY_EVIDENCE_KEYS, "M1: legacy decision evidence is byte-identical");
    const legacyAudit = (await setup.query<{ metadata: Record<string, unknown> }>(`select metadata from audit_log where entity_type = 'agent_mandate' and entity_id = $1`, [legacy.mandate.mandateId])).rows[0];
    assert.deepEqual(Object.keys(legacyAudit.metadata).sort(), LEGACY_AUDIT_KEYS, "M1: legacy audit metadata is unchanged");

    /* ═══ M2 · the responsibility-aware contract refuses ═══════════════════ */
    const revisions = () => n(`select count(*) from agent_mandates where agent_id = $1`, [agentId]);
    const write = (scope: readonly string[], responsibility: unknown, observed = 1) =>
      establishAgentMandateWithResponsibility(
        aCtx,
        { agentId, purpose: PURPOSE, proposalScope: scope, justification: MANDATE_JUSTIFICATION, observedMandateRevision: observed, responsibility },
        deps,
      );
    const domainIdOf = async (ctx: TenantContext, slug: string): Promise<string> => {
      const listed = await readWorkDomains(ctx, deps);
      if (listed.status !== "read") throw new Error("work domains unreadable");
      return listed.workDomains.find((d) => d.slug === slug)!.workDomainId;
    };
    const bSecurity = await domainIdOf(bCtx, "security");
    const unknown = "00000000-0000-4000-8000-00000000a404";
    const sec = security.workDomain.workDomainId;
    for (const [label, scope, responsibility, reason] of [
      ["record-work needs a responsibility", ["record-work"], [], "responsibility-required"],
      ["not admitted without record-work", ["send"], [{ kind: "organization" }], "responsibility-not-admitted"],
      ["not an array", ["record-work"], "organization", "responsibility-invalid"],
      ["unknown kind", ["record-work"], [{ kind: "department", workDomainId: sec }], "responsibility-invalid"],
      ["repeated domain", ["record-work"], [{ kind: "domain", workDomainId: sec }, { kind: "domain", workDomainId: sec }], "responsibility-invalid"],
      ["second organization", ["record-work"], [{ kind: "organization" }, { kind: "organization" }], "responsibility-invalid"],
      ["extra field", ["record-work"], [{ kind: "organization", workDomainId: sec }], "responsibility-invalid"],
      ["unknown domain", ["record-work"], [{ kind: "domain", workDomainId: unknown }], "work-domain-unresolvable"],
      ["another tenant's domain", ["record-work"], [{ kind: "domain", workDomainId: bSecurity }], "work-domain-unresolvable"],
    ] as const) {
      assert.deepEqual(await write(scope, responsibility), { status: "refused", reason }, `M2: ${label}`);
    }
    assert.equal(await revisions(), 1, "M2: a refused write leaves no revision");
    assert.equal(await rows(), 0, "M2: and no rows");

    /* ═══ M3 · a valid grant ═══════════════════════════════════════════════ */
    const legalId = await domainIdOf(aCtx, "legal-review");
    const granted = await write(["send", "record-work"], [{ kind: "domain", workDomainId: sec }, { kind: "organization" }]);
    assert.equal(granted.status, "established");
    if (granted.status !== "established") throw new Error("unreachable");
    assert.equal(granted.mandate.mandateRevision, 2);
    assert.deepEqual(granted.responsibility, [{ kind: "organization" }, { kind: "domain", workDomainId: sec }], "M3: canonical order");
    assert.equal(await rows(), 2, "M3: two responsibility rows");
    const grantedDecision = (await setup.query<{ evidence: Record<string, unknown> }>(`select evidence from decision_records where id = $1`, [granted.mandate.governanceDecisionId])).rows[0];
    assert.deepEqual(grantedDecision.evidence.responsibility, [{ kind: "organization" }, { kind: "domain", workDomainId: sec }], "M3: Governance decided the responsibility");
    const grantedAudit = (await setup.query<{ metadata: { responsibility: unknown[] } }>(`select metadata from audit_log where entity_type = 'agent_mandate' and entity_id = $1`, [granted.mandate.mandateId])).rows[0];
    assert.equal(grantedAudit.metadata.responsibility.length, 2);
    const read3 = await readEffectiveMandateResponsibility(aCtx, agentId, deps);
    assert.equal(read3.status, "read");
    if (read3.status !== "read") throw new Error("unreachable");
    assert.deepEqual([...(read3.mandate?.proposalScope ?? [])].sort(), ["record-work", "send"], "M3: scope as granted");
    assert.deepEqual(
      read3.responsibility.map((r) => [r.kind, r.slug, r.inService]),
      [["organization", null, null], ["domain", "security", true]],
    );

    /* ═══ M4 · a later legacy revision is undeclared ═══════════════════════ */
    const legacy3 = await establishAgentMandate(
      aCtx,
      { agentId, purpose: PURPOSE, proposalScope: ["record-work"], justification: MANDATE_JUSTIFICATION, observedMandateRevision: 2 },
      deps,
    );
    assert.equal(legacy3.status, "established");
    const read4 = await readEffectiveMandateResponsibility(aCtx, agentId, deps);
    assert.ok(read4.status === "read" && read4.mandate?.mandateRevision === 3 && read4.responsibility.length === 0, "M4: undeclared again");
    assert.equal(await rows(), 2, "M4: the earlier rows are history, untouched");

    /* ═══ M6 · concurrent responsibility-aware writes ══════════════════════ */
    {
      const hs = Array.from({ length: 4 }, () => createControlPlaneDb(harness.dbUrl));
      try {
        const raced = await Promise.all(
          hs.map((h) =>
            establishAgentMandateWithResponsibility(
              aCtx,
              { agentId, purpose: PURPOSE, proposalScope: ["record-work"], justification: MANDATE_JUSTIFICATION, observedMandateRevision: 3, responsibility: [{ kind: "domain", workDomainId: legalId }] },
              { getDb: () => h.db },
            ),
          ),
        );
        assert.equal(raced.filter((r) => r.status === "established").length, 1, "M6: one concurrent write wins");
      } finally {
        await Promise.all(hs.map((h) => h.dispose()));
      }
      assert.equal(await rows(), 3, "M6: rows only for the winner");
      assert.equal(await revisions(), 4);
    }

    /* ═══ W5 / M5 · retire ═════════════════════════════════════════════════ */
    {
      const before = [await n(`select count(*) from work_items`), await n(`select count(*) from agent_mandates`), await rows()];
      const retired = await retireWorkDomain(aCtx, { workDomainId: sec }, deps);
      assert.equal(retired.status, "recorded");
      if (retired.status !== "recorded") throw new Error("unreachable");
      assert.equal(retired.workDomain.inService, false);
      assert.equal(await domainAudit("work-domain.retired"), 1);
      assert.deepEqual([await n(`select count(*) from work_items`), await n(`select count(*) from agent_mandates`), await rows()], before, "W5: retiring touches nothing else");
      assert.deepEqual(await retireWorkDomain(aCtx, { workDomainId: sec }, deps), { status: "refused", reason: "work-domain-retired" });
      assert.deepEqual(await renameWorkDomain(aCtx, { workDomainId: sec, name: "Revived" }, deps), { status: "refused", reason: "work-domain-retired" });
      assert.deepEqual(await recordWorkDomain(aCtx, { slug: "security", name: "Security" }, deps), { status: "refused", reason: "work-domain-slug-taken" }, "W3: slugs are never reused");
      assert.deepEqual(await write(["record-work"], [{ kind: "domain", workDomainId: sec }], 4), { status: "refused", reason: "work-domain-retired" }, "M2: retired domain is never granted");
      const history = await setup.query(`select r.mandate_id from agent_mandate_responsibilities r where r.work_domain_id = $1`, [sec]);
      assert.equal(history.rows.length, 1, "M5: the granted row stays as history");
    }

    /* ═══ W7 · the database ════════════════════════════════════════════════ */
    {
      const mandateId = granted.mandate.mandateId;
      assert.equal(await code(`insert into agent_mandate_responsibilities (tenant_id, mandate_id, responsibility_kind, work_domain_id, created_by) values ($1,$2,'domain',$3,$4)`, [a.tenantId, mandateId, bSecurity, a.userId]), "23503", "W7: a cross-tenant domain grant is refused");
      assert.equal(await code(`insert into agent_mandate_responsibilities (tenant_id, mandate_id, responsibility_kind, work_domain_id, created_by) values ($1,$2,'organization',$3,$4)`, [a.tenantId, mandateId, legalId, a.userId]), "23514");
      assert.equal(await code(`insert into agent_mandate_responsibilities (tenant_id, mandate_id, responsibility_kind, created_by) values ($1,$2,'domain',$3)`, [a.tenantId, mandateId, a.userId]), "23514");
      assert.equal(await code(`insert into agent_mandate_responsibilities (tenant_id, mandate_id, responsibility_kind, created_by) values ($1,$2,'organization',$3)`, [b.tenantId, legacy.mandate.mandateId, a.userId]), "23503", "W7: a cross-tenant mandate is refused");
      assert.equal(await code(`insert into work_items (tenant_id, title, work_scope_kind, work_domain_id) values ($1,'x','domain',$2)`, [a.tenantId, bSecurity]), "23503", "W7: cross-tenant work domain on work");
      assert.equal(await code(`insert into work_items (tenant_id, title, work_scope_kind) values ($1,'x','domain')`, [a.tenantId]), "23514");
      assert.equal(await code(`insert into work_items (tenant_id, title, work_domain_id) values ($1,'x',$2)`, [a.tenantId, legalId]), "23514", "W7: a domain without a kind is refused");
      assert.equal(await code(`insert into work_items (tenant_id, title, work_scope_kind, work_domain_id) values ($1,'x','organization',$2)`, [a.tenantId, legalId]), "23514");
      assert.equal(await code(`insert into work_items (tenant_id, title, work_scope_kind) values ($1,'x','department')`, [a.tenantId]), "23514");
      assert.equal(await code(`insert into work_items (tenant_id, title, work_scope_kind) values ($1,'x','organization')`, [a.tenantId]), "none");
      assert.equal(await code(`insert into work_domains (tenant_id, name, slug) values ($1,'Bad','Bad Slug')`, [a.tenantId]), "23514");
      assert.equal(await code(`update work_domains set lifecycle_status = 'deleted', deleted_at = now() where id = $1`, [legalId]), "23514");
      assert.equal(await code(`delete from work_domains where id = $1`, [legalId]), "23001", "W7: a referenced domain cannot be deleted (restrict)");
    }

    /* ═══ P1 · released WORK-1 writes legacy scope ═════════════════════════ */
    {
      const recorded = await recordWork(aCtx, { title: "Quarterly security review" }, deps);
      assert.equal(recorded.status, "recorded");
      const row = (await setup.query(`select work_scope_kind, work_domain_id from work_items where tenant_id = $1 and title = 'Quarterly security review'`, [a.tenantId])).rows[0];
      assert.deepEqual(row, { work_scope_kind: null, work_domain_id: null }, "P1: legacy/unknown scope");
    }

    console.log("ap4a-work-domain-foundation/foundation-postgres: passed");
  } finally {
    await setup.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
