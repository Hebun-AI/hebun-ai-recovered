/*
 * tests/helpers/agent-mandate-seed.ts — the AMA-2 PRECONDITION, for suites that are not about
 * mandates.
 *
 * ── WHY THIS HELPER EXISTS ───────────────────────────────────────────────────
 *
 * Before AMA-2, a durable agent could propose as soon as it existed. After AMA-2 it cannot: the
 * agent-originated proposal writer refuses `no-agent-mandate` unless the organization has recorded
 * a ceiling. That is the point of the phase, and it means three released suites — AGENT-PROPOSAL-1,
 * AGENT-PROPOSAL-2 and AGENT-PROPOSAL-4B — now have a new precondition to satisfy before the thing
 * they actually prove can happen at all.
 *
 * Those suites are not weakened by this. They still assert exactly what they asserted; they just
 * have to bound the agent first, the way a real organization now must.
 *
 * ── EVERY ROW COMES FROM THE RELEASED WRITER THAT OWNS IT ────────────────────
 *
 * Nothing here inserts a mandate, a Governance decision or a Governance session by raw SQL. The
 * only raw SQL is for the two fixtures that have no writer in this repository at all — a session
 * context row and an accepted genesis nomination — which is exactly what the AMA-1 suite does.
 * Seeding a mandate directly would make these suites pass against a table shape rather than against
 * the authority, and the first schema change would turn that into a silent lie.
 *
 * ── IT BUILDS ITS OWN CONTEXT, ON PURPOSE ────────────────────────────────────
 *
 * `establishAgentMandate` writes a Governance session bound to `sessionContextId`, so it needs one
 * that really exists. Several released suites carry a placeholder session id that no row backs,
 * which is harmless for what they test and a foreign-key violation here. So this helper resolves a
 * real session row and builds the context it needs from it, and the caller's own context is left
 * exactly as it was.
 */
import assert from "node:assert/strict";
import type { Client } from "pg";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { establishAgentMandate } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

export interface MandateSeedIdentity {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

export interface MandateSeedOptions {
  /** Which kinds the ceiling admits. Defaults to the full released vocabulary. */
  readonly proposalScope?: readonly string[];
  /** Distinguishes the session-reference hash when one client seeds several tenants. */
  readonly tag?: string;
  readonly now?: Date;
}

const GOVERNANCE_JUSTIFICATION =
  "I am establishing this organization's Governance authority and I accept responsibility for it.";
const MANDATE_JUSTIFICATION =
  "I am bounding what this agent exists to do, and I accept responsibility for that bound.";
const PURPOSE =
  "Draft and propose outbound correspondence for human review. It proposes; a human decides.";

async function sessionContextRow(
  client: Client,
  identity: MandateSeedIdentity,
  tag: string,
): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      identity.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      identity.userId,
      identity.tenantId,
      identity.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

/**
 * Give ONE durable agent a recorded ceiling, through Governance, exactly as a human would.
 *
 * Returns the effective revision, so a caller that later revises it has the ordinal the writer's
 * compare-and-swap expects. It grants nothing: a mandate is a ceiling, and every downstream gate —
 * human review, the Governance decision, the permit, execution — is exactly where it was.
 */
export async function seedAgentMandate(
  client: Client,
  identity: MandateSeedIdentity,
  agentId: string,
  deps: { readonly getDb: () => unknown },
  options: MandateSeedOptions = {},
): Promise<{ readonly mandateRevision: number }> {
  const sessionContextId = await sessionContextRow(client, identity, options.tag ?? "seed");
  const ctx: TenantContext = asHumanTenantContext({
    tenantId: identity.tenantId,
    userId: identity.userId,
    authIdentityId: identity.authIdentityId,
    membershipId: identity.membershipId,
    membershipVersion: 1,
    roleId: identity.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: `mandate-seed-${options.tag ?? "seed"}`,
    authenticatedAt: (options.now ?? new Date()).toISOString(),
  });

  /*
   * The entitlement, then the authority. `governance_bootstrap` reads an ACCEPTED genesis
   * nomination and spends it; there is no writer for a nomination in this repository, so it is the
   * one row seeded by SQL — the same way the AMA-1 suite seeds it.
   */
  const alreadyGoverned = await client.query(
    `select 1 from genesis_nominations where tenant_id = $1`,
    [identity.tenantId],
  );
  if (alreadyGoverned.rowCount === 0) {
    await client.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [identity.tenantId, identity.authIdentityId, identity.userId, sessionContextId],
    );
    const governance = await establishGovernanceAuthority(
      ctx,
      { justification: GOVERNANCE_JUSTIFICATION },
      deps as never,
    );
    assert.equal(
      governance.status,
      "established",
      `mandate seed: Governance authority could not be established (${JSON.stringify(governance)})`,
    );
  }

  const established = await establishAgentMandate(
    ctx,
    {
      agentId,
      purpose: PURPOSE,
      proposalScope: options.proposalScope ?? [...AGENT_ORIGINABLE_ACTION_KINDS],
      justification: MANDATE_JUSTIFICATION,
      observedMandateRevision: null,
    },
    deps as never,
  );
  assert.equal(
    established.status,
    "established",
    `mandate seed: the ceiling could not be recorded (${JSON.stringify(established)})`,
  );
  return {
    mandateRevision:
      established.status === "established" ? established.mandate.mandateRevision : 0,
  };
}
