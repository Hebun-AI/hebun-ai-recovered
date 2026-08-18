/*
 * Genesis nomination — KEY 1 of the two-key ceremony (G2.1), separated from the CLI so a real
 * database can prove its semantics without driving an interactive prompt.
 *
 * This lives under `scripts/` on purpose, exactly like D1.1's credential provisioning. It writes the
 * tenant's pre-Governance root, which is OPERATOR tooling, not product behaviour: nothing in `src/`
 * may import it, and a test enforces that. Keeping it out of the application tree is what makes
 * "nominate yourself" unrepresentable in the product rather than merely forbidden.
 *
 * WHAT IT WRITES: one `genesis_nominations` row with status `pending`. Nothing else.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - accept the nomination (only the nominated human can, in-product, under a verified D1 session)
 *   - create a Governance decision, a governance session, or set `bootstrap` anywhere
 *   - mint a session, a cookie, or a credential
 *   - create or change a membership, a role, a permission, or a tenant
 *   - touch Knowledge, providers, or execution
 *   - run against a non-local database (refused)
 *   - be driven by an environment variable that silently names the genesis human
 *
 * THE ROOT OF TRUST, STATED HONESTLY. Authority to run this is possession of the local deployment —
 * the same assumption D1.1 already rests on. Hebun cannot cryptographically identify the human at
 * the terminal, so the row records WHICH ROOT produced it (`nomination_source`) and never claims WHO
 * operated it. This is not a platform-admin authority and not a Governance authority.
 */
import type { Client } from "pg";
import type { CeremonySource } from "./production-possession";

/** Mirrors the value the schema's CHECK constraint permits. */
export const NOMINATION_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony";

export interface NominationTarget {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly tenantSlug: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly email: string;
  readonly membershipId: string;
}

export interface ExistingNomination {
  readonly nominationId: string;
  readonly status: string;
  readonly nominatedUserId: string;
}

/**
 * Resolve the nomination target: an ACTIVE tenant, an ACTIVE human identity, and a live ACTIVE
 * membership joining them. Returns undefined rather than throwing so the CLI owns the wording.
 *
 * MEMBERSHIP IS VERIFIED HERE AND ENFORCED AGAIN BY THE DATABASE. The composite foreign key
 * `(tenant_id, nominated_user_id) → memberships (tenant_id, user_id)` makes a cross-tenant
 * nomination a constraint violation even if this query were wrong. This check adds what a foreign
 * key cannot express: that the membership is currently ACTIVE, not suspended or revoked.
 */
export async function resolveNominationTarget(
  client: Client,
  tenantSlug: string,
  email: string,
): Promise<NominationTarget | undefined> {
  const result = await client.query<{
    tenant_id: string;
    tenant_name: string;
    tenant_slug: string;
    user_id: string;
    auth_identity_id: string;
    email: string;
    membership_id: string;
  }>(
    `select c.id            as tenant_id,
            c.name          as tenant_name,
            c.slug          as tenant_slug,
            u.id            as user_id,
            i.id            as auth_identity_id,
            u.email         as email,
            m.id            as membership_id
       from companies c
       join memberships m on m.tenant_id = c.id
       join users u       on u.id = m.user_id
       join auth_identities i on i.user_id = u.id
      where lower(c.slug) = $1
        and lower(u.email) = $2
        and c.lifecycle_status = 'active'
        and (c.tenant_status is null or c.tenant_status = 'active')
        and c.authentication_disabled_at is null
        and u.lifecycle_status = 'active'
        and i.status = 'active'
        and i.lifecycle_status = 'active'
        and i.revoked_at is null
        and m.status = 'active'
        and m.revoked_at is null
        and m.lifecycle_status = 'active'
      order by i.created_at asc
      limit 1`,
    [tenantSlug.trim().toLowerCase(), email.trim().toLowerCase()],
  );
  const row = result.rows[0];
  return row
    ? {
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        tenantSlug: row.tenant_slug,
        userId: row.user_id,
        authIdentityId: row.auth_identity_id,
        email: row.email,
        membershipId: row.membership_id,
      }
    : undefined;
}

/**
 * The nomination already occupying this tenant's genesis slot, if any.
 *
 * Reported so the operator gets a truthful message instead of a raw constraint error. It is NOT the
 * protection: the partial unique index is, and a concurrent ceremony that slips past this read is
 * still refused by Postgres.
 */
export async function findExistingNomination(
  client: Client,
  tenantId: string,
): Promise<ExistingNomination | undefined> {
  const result = await client.query<{
    id: string;
    status: string;
    nominated_user_id: string;
  }>(
    `select id, status, nominated_user_id
       from genesis_nominations
      where tenant_id = $1 and status <> 'revoked'
      limit 1`,
    [tenantId],
  );
  const row = result.rows[0];
  return row
    ? { nominationId: row.id, status: row.status, nominatedUserId: row.nominated_user_id }
    : undefined;
}

export type NominationOutcome =
  | { readonly status: "nominated"; readonly nominationId: string }
  /** The tenant's genesis slot is already occupied — by this human or another one. */
  | { readonly status: "already-nominated"; readonly existing: ExistingNomination };

/**
 * Write the PENDING nomination.
 *
 * `status` is not a parameter. This function has no expressible way to write `accepted` or
 * `revoked`, so the operator half of the ceremony cannot complete the human half — which is the
 * entire point of splitting the keys.
 *
 * A unique-violation (23505) is translated into `already-nominated` rather than thrown: the database
 * refusing a second root is the expected, correct outcome of a race, not an error condition.
 */
export async function nominateGenesisHuman(
  client: Client,
  target: NominationTarget,
  /*
   * G4. The root, derived from deployment possession by `resolveCeremonyPosture()` and never
   * expressible as a command-line argument. Defaults to the local root, so every released caller
   * and test keeps its exact prior behaviour. `status` is still not a parameter.
   */
  nominationSource: CeremonySource = NOMINATION_SOURCE_LOCAL_OPERATOR,
): Promise<NominationOutcome> {
  const existing = await findExistingNomination(client, target.tenantId);
  if (existing) return { status: "already-nominated", existing };

  try {
    const inserted = await client.query<{ id: string }>(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source)
       values ($1, $2, $3, 'pending', $4)
       returning id`,
      [
        target.tenantId,
        target.authIdentityId,
        target.userId,
        nominationSource,
      ],
    );
    return { status: "nominated", nominationId: inserted.rows[0]!.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const winner = await findExistingNomination(client, target.tenantId);
      if (winner) return { status: "already-nominated", existing: winner };
    }
    throw error;
  }
}

/** Postgres unique_violation. The database enforcing one genesis root per tenant. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
