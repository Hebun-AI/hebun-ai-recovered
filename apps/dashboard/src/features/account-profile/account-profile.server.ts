/*
 * account-profile/account-profile.server.ts — V1-STAGE-4 reads and the one self-write.
 *
 * Every read is keyed by the SESSION, never by input: the viewer's own user row through their own
 * active membership in their active tenant. The team read is delegated wholesale to the released,
 * Governance-gated readers (people register, human labels, revocable invitations); a member who is
 * not the Governance authority sees their own membership and is told the team is authority-only.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import { roles } from "@/db/schema/role";
import { users } from "@/db/schema/user";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readEmailOwnershipState } from "@/features/auth-email-ownership/email-verification.server";
import { readOwnNameFields, resolveHumanLabels } from "@/features/auth-runtime/human-label-read.server";
import { readPeopleRegister } from "@/features/auth-runtime/people-register-read.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { readRevocableInvitations } from "@/features/human-onboarding/read-revocable-invitations.server";
import { recordDisplayNameChangeWithin } from "@/features/governance-audit/account-profile-audit.server";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import {
  normalizeDisplayName,
  type DisplayNameUpdate,
  type OwnProfileRead,
  type TeamRead,
} from "./contracts";

export interface AccountProfileDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
  readonly readEmailState?: typeof readEmailOwnershipState;
}

type Tx = Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];

function dbOf(deps: AccountProfileDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function serverOnly(): void {
  if (typeof window !== "undefined") throw new Error("Account profile is server-only.");
}

/** The viewer's own profile, tenant and membership — through their own active membership only. */
export async function readOwnProfile(tenant: TenantContext | null, deps: AccountProfileDeps = {}): Promise<OwnProfileRead> {
  serverOnly();
  if (!tenant?.tenantId || !tenant.userId || !tenant.membershipId) return { status: "unauthenticated" };
  const db = dbOf(deps);
  if (!db) return { status: "unavailable" };
  try {
    const rows = await db
      .select({
        email: users.email,
        version: users.version,
        tenantName: companies.name,
        tenantSlug: companies.slug,
        tenantStatus: companies.tenantStatus,
        roleName: roles.name,
        since: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(companies, eq(companies.id, memberships.tenantId))
      .leftJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.tenantId, memberships.tenantId)))
      .where(and(eq(memberships.id, tenant.membershipId), eq(memberships.tenantId, tenant.tenantId), eq(memberships.userId, tenant.userId)));
    const r = rows[0];
    if (!r) return { status: "unavailable" };
    const [authority, emailState, own] = await Promise.all([
      (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant).catch(() => ({ authorized: false })),
      (deps.readEmailState ?? readEmailOwnershipState)(tenant.authIdentityId, { getDb: () => db }).catch(() => ({ status: "unavailable" as const })),
      /* Name columns are projected by Identity only (WORK-2 provider-bound-name). */
      readOwnNameFields(tenant, { getDb: () => db }),
    ]);
    if (!own) return { status: "unavailable" };
    return {
      status: "read",
      profile: {
        email: r.email,
        emailVerified: emailState.status === "verified" ? "verified" : emailState.status === "unverified" ? "unverified" : "unknown",
        name: own.name,
        displayName: own.displayName,
        profileVersion: r.version,
        tenant: { name: r.tenantName, slug: r.tenantSlug, status: r.tenantStatus },
        membership: { roleName: r.roleName, since: r.since.toISOString() },
        viewerIsGovernanceAuthority: authority.authorized === true,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Change the viewer's OWN display name. The row is the session's user, never an input; the caller
 * names the profile version it saw. One audit row, in the same transaction, in the active tenant.
 */
export async function updateOwnDisplayName(
  tenant: TenantContext | null,
  input: { readonly displayName: unknown; readonly expectedVersion: unknown },
  deps: AccountProfileDeps = {},
): Promise<DisplayNameUpdate> {
  serverOnly();
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const normalized = normalizeDisplayName(input.displayName);
  if (!normalized.ok || !Number.isSafeInteger(input.expectedVersion)) return { status: "refused", reason: "invalid-display-name" };
  const db = dbOf(deps);
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();
  /* "Unchanged" is answered from Identity's own read; the version check below is what makes it safe. */
  const current = await readOwnNameFields(tenant, { getDb: () => db });
  if (!current) return { status: "refused", reason: "unauthenticated" };
  return db.transaction(async (tx: Tx) => {
    const [row] = await tx.select({ version: users.version }).from(users).where(eq(users.id, tenant.userId)).for("update");
    if (!row) return { status: "refused" as const, reason: "unauthenticated" as const };
    if (row.version !== input.expectedVersion) return { status: "refused" as const, reason: "stale-version" as const };
    if (current.displayName === normalized.value) return { status: "unchanged" as const };
    const version = row.version + 1;
    await tx
      .update(users)
      .set({ displayName: normalized.value, version, updatedAt: now, updatedBy: tenant.userId, updatedByType: "human" })
      .where(eq(users.id, tenant.userId));
    await recordDisplayNameChangeWithin(tx, auditActorFrom(tenant), { cleared: normalized.value === null, previousVersion: row.version, version }, now);
    return { status: "updated" as const, displayName: normalized.value, profileVersion: version };
  });
}

/**
 * The team, with role names and pending invitations — for the Governance authority only, through
 * the released gated readers. Anyone else gets `authority-only`, exactly what those readers allow.
 */
export async function readTeam(tenant: TenantContext | null, deps: AccountProfileDeps = {}): Promise<TeamRead> {
  serverOnly();
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  const db = dbOf(deps);
  if (!db) return { status: "unavailable" };
  const gated = { getDb: () => db, ...(deps.resolveAuthority ? { resolveAuthority: deps.resolveAuthority } : {}) };
  /* The released people register IS the gate (Governance authority only); no second copy of it here. */
  const people = await readPeopleRegister(tenant, gated);
  if (people.status !== "available") return people.reason === "not-authorized" ? { status: "authority-only" } : { status: "unavailable" };
  try {
    const ids = people.people.map((p) => p.membershipId);
    const roleRows = ids.length
      ? await db
          .select({ membershipId: memberships.id, roleName: roles.name })
          .from(memberships)
          .leftJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.tenantId, memberships.tenantId)))
          .where(and(eq(memberships.tenantId, tenant.tenantId), inArray(memberships.id, ids)))
      : [];
    const roleOf = new Map(roleRows.map((r) => [r.membershipId, r.roleName]));
    const labels = await resolveHumanLabels(tenant, people.people.map((p) => p.userId), gated);
    const invitations = await readRevocableInvitations(tenant, { getDb: () => db });
    return {
      status: "read",
      members: people.people.map((p) => ({
        userId: p.userId,
        label: labels.get(p.userId) ?? null,
        roleName: roleOf.get(p.membershipId) ?? null,
        since: p.membershipRecordedAt,
        isViewer: p.userId === tenant.userId,
      })),
      truncated: people.truncated,
      invitations:
        invitations.status === "read"
          ? invitations.view.revocable.map((i) => ({ invitationId: i.invitationId, issuedAt: i.issuedAt, expiresAt: i.expiresAt, expired: i.expiredByClock }))
          : [],
    };
  } catch {
    return { status: "unavailable" };
  }
}
