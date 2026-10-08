/*
 * L-2a — service status from the real identity seam, and every surface that renders it.
 * Real PostgreSQL, disposable database.
 *
 * Suspension has NO writer (L-2a adds none), so the suspended and conflicting rows are set by this
 * fixture with plain SQL; retirement goes through the released (L-1b) authority.
 *
 *  1 the identity seam reports in-service / suspended / retired / indeterminate, and keeps the
 *    released `inService` boolean unchanged
 *  2 tenant isolation: another organization's agents never appear
 *  3 Live Map: label, tone and detail per status; a suspended agent is never "Retired"
 *  4 Heby mandate source: a suspended agent is described as suspended, never retired
 *  5 Heby agent source (SIA-1 projection): same, and lifecycle "retired" only for a retirement
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { readDurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import { readAgentMandateGroundingSource } from "../../src/features/agent-mandate/heby-mandate-source.server";
import { readAgentGroundingSource } from "../../src/features/agent-outcome-observation/heby-agent-source.server";
import { readAgentOutcomeObservationIndexed } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const REGISTER = "Register this agent for the L-2a service status proof organization.";
const RETIRE = "Retire this agent for the L-2a service status proof organization.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day',
             now() + interval '1 day')
     returning id`,
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_l2a_service_status");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  try {
    await setup.connect();
    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-l2a", email: "director@acme-l2a.test" })) as Seeded;
    const beta = (await seedLocalIdentity(setup, { companyName: "Beta", companySlug: "beta-l2a", email: "director@beta-l2a.test" })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "d2a1"), "l2a-acme");
    const betaCtx = contextFor(beta, await sessionRowFor(setup, beta, "d2b1"), "l2a-beta");
    await seedGovernanceAuthority(setup, acme, deps, { tag: "0da1" });
    await seedGovernanceAuthority(setup, beta, deps, { tag: "0db1" });

    const register = async (who: TenantContext, name: string): Promise<string> => {
      const r = await createDurableAgentIdentity(who, { name, justification: REGISTER }, deps);
      assert.equal(r.status, "established", JSON.stringify(r));
      return r.status === "established" ? r.identity.agentId : "";
    };
    const legacy = await register(ctx, "Legacy");
    const active = await register(ctx, "Active");
    const paused = await register(ctx, "Paused");
    const retired = await register(ctx, "Retired");
    const conflict = await register(ctx, "Conflict");
    const foreign = await register(betaCtx, "Foreign");

    await setup.query(`update agents set agent_lifecycle_status = 'active' where id = $1`, [active]);
    await setup.query(`update agents set suspended_at = now(), agent_lifecycle_status = 'suspended' where id = $1`, [paused]);
    assert.equal((await retireDurableAgentIdentity(ctx, { agentId: retired, justification: RETIRE }, deps)).status, "retired");
    await setup.query(`update agents set suspended_at = now() where id = $1`, [conflict]); /* suspended_at without the lifecycle */

    /* ── 1 · THE IDENTITY SEAM ── */
    const state = await readDurableAgentIdentityState(ctx, deps);
    assert.equal(state.status, "known");
    const byId = new Map(state.status === "known" ? state.identities.map((i) => [i.agentId, i]) : []);
    const expect: [string, string, boolean][] = [
      [legacy, "in-service", true],
      [active, "in-service", true],
      [paused, "suspended", false],
      [retired, "retired", false],
      [conflict, "indeterminate", false],
    ];
    for (const [id, status, inService] of expect) {
      const identity = byId.get(id)!;
      assert.equal(identity.serviceStatus, status, `${identity.name} reads as ${status}`);
      assert.equal(identity.inService, inService, `${identity.name}: the released inService boolean is unchanged`);
    }
    assert.ok(byId.get(paused)!.suspendedAt, "a suspension's instant is read");
    assert.equal(byId.get(paused)!.retiredAt, null, "a suspended agent carries no retirement");
    assert.ok(byId.get(retired)!.retiredAt);

    /* ── 2 · TENANT ISOLATION ── */
    assert.equal(byId.has(foreign), false, "another organization's agent never appears");
    const betaState = await readDurableAgentIdentityState(betaCtx, deps);
    assert.deepEqual(betaState.status === "known" ? betaState.identities.map((i) => [i.name, i.serviceStatus]) : [], [["Foreign", "in-service"]]);

    /* ── 3 · LIVE MAP ── */
    const map = await readLiveMapProjection(ctx, {
      readOrganization: async () => ({ status: "unavailable" }) as never,
      readAgentIdentity: async () => state,
    });
    const agentNodes = map.domains.find((d) => d.domainId === "agents")!;
    assert.equal(agentNodes.state.status, "available");
    const nodes = agentNodes.state.status === "available" ? agentNodes.state.nodes : [];
    const node = (name: string) => nodes.find((n) => n.label === name)!;
    assert.deepEqual(node("Legacy").status, { label: "In service", tone: "active" });
    assert.deepEqual(node("Paused").status, { label: "Suspended", tone: "suspended" }, "a suspended agent is drawn as suspended");
    assert.match(node("Paused").detail[0]!, /^Suspended since .*Reversible/);
    assert.doesNotMatch(node("Paused").detail.join(" "), /retired/i, "and never described as retired");
    assert.deepEqual(node("Retired").status, { label: "Retired", tone: "retired" });
    assert.deepEqual(node("Conflict").status, { label: "Status unknown", tone: "indeterminate" });
    assert.match(node("Conflict").detail[0]!, /undetermined/);
    assert.doesNotMatch(node("Conflict").detail.join(" "), /retired/i);

    /* ── 4 · HEBY MANDATE SOURCE ── */
    const mandateFor = (agentId: string) => ({
      mandateId: `m-${agentId}`,
      agentId,
      mandateRevision: 1,
      purpose: "A recorded purpose.",
      proposalScope: ["record-work"],
      effectiveFrom: "2026-10-01T00:00:00.000Z",
      governanceDecisionId: "d-1",
      governanceSessionId: "s-1",
      establishedByActorId: acme.userId,
      supersedesMandateId: null,
      responsibility: [],
    });
    const mandateSource = await readAgentMandateGroundingSource(ctx, {
      readIdentities: async () => state,
      readEffective: (async (_t: unknown, agentId: string) => ({ status: "known", mandate: mandateFor(agentId) })) as never,
      readHistory: (async (_t: unknown, agentId: string) => ({ status: "known", revisions: [mandateFor(agentId)], limit: 50 })) as never,
    });
    const mandateDetail = (name: string) => mandateSource.items.find((i) => i.label.startsWith(`${name} —`))?.detail ?? "";
    assert.match(mandateDetail("Legacy"), /The agent is in service\./);
    assert.match(mandateDetail("Paused"), /The agent is suspended from service since .*reversible/);
    assert.doesNotMatch(mandateDetail("Paused"), /retired/i, "Heby is never told a suspended agent is retired");
    assert.match(mandateDetail("Retired"), /The agent is retired from service at /);
    assert.match(mandateDetail("Conflict"), /undetermined service status/);

    /* ── 5 · HEBY AGENT SOURCE (through the real SIA-1 projection) ── */
    const agentSource = await readAgentGroundingSource(ctx, {
      readOutcome: (t) => readAgentOutcomeObservationIndexed(t, deps),
    });
    assert.equal(agentSource.state, "resolved");
    const item = (id: string) => agentSource.items.find((i) => i.recordRef === `agent/${id}`)!;
    assert.match(item(paused).detail, /^suspended from service since /);
    assert.doesNotMatch(item(paused).detail, /retired/i);
    assert.equal(item(paused).lifecycle, "settled", "a suspended agent's record is current, not retired");
    assert.match(item(retired).detail, /^retired from service at /);
    assert.equal(item(retired).lifecycle, "retired");
    assert.match(item(legacy).detail, /^in service/);
    assert.match(item(conflict).detail, /^of undetermined service status/);

    console.log("l2a status postgres: ok");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
