/*
 * integration-authority/integration-read.server.ts — the WRITER-FREE half of the integration
 * authority (INT-5A).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
 *
 * Every function here already existed, in `integration-repository.server.ts`, beside seven acts
 * that mutate the connection lifecycle — `createConnection`, `disconnectConnection`,
 * `attachCredentialToConnectionWithin`, `holdConnectionForProviderRefreshWithin`,
 * `recordVerifiedConnectionWithin`, `recordUnverifiedProviderGrantWithin` and
 * `recordVerificationFailureWithin` — and beside the lifecycle audit writer they call.
 *
 * That was correct while every consumer was a surface that also needed to write. It stopped being
 * correct the moment Heby needed to READ. `capability-availability.server.ts` imports
 * `listConnections`, so a Heby module importing that seam would hold a reference into a module
 * that can create a connection, attach a credential to one, and end one — and no reviewer should
 * have to check which symbol was taken.
 *
 * G6C established the remedy and this is the same one, unchanged: stop the read/write mixing at
 * the module boundary, so the consumer's import graph contains zero writers as a STRUCTURAL fact
 * rather than as a promise. `tests/int5a-flow/grounding-firewall.ts` walks the real import graph
 * from Heby's roots and proves it, exactly as G6C's does for Governance.
 *
 * ── WHAT MOVED, AND WHAT DID NOT ─────────────────────────────────────────────
 *
 * The reads moved VERBATIM. `listConnections` and `readConnection` have the same signatures, the
 * same tenant predicate, the same bound, the same column list and the same refusal shapes they had
 * when they were released. `integration-repository.server.ts` re-exports both, so its existing
 * callers — two API routes, three pages, the GitHub authorized-call seam and the verifier — import
 * exactly what they imported before. This is a relocation, not a new interpreter: there is still
 * ONE `listConnections` in this repository.
 *
 * Nothing that writes moved. The writers stay where they are, and they now import their read
 * helpers from here, which is the direction that keeps the dependency acyclic and keeps this file
 * free of them.
 *
 * Server-only.
 */
import { and, asc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { integrations } from "@/db/schema/integration";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  CONNECTION_LIMITS,
  type ConnectionHealth,
  type ConnectionListing,
  type ConnectionState,
  type IntegrationView,
  type ProviderCatalog,
} from "./contracts";

export interface IntegrationRepositoryDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /**
   * Injected so a test can exercise this module against a catalog containing a `connectable`
   * entry. Production leaves it unset.
   */
  readonly catalog?: ProviderCatalog;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Integration authority is server-only.");
  }
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveIntegrationDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/* ── THE ONE TENANT PREDICATE ───────────────────────────────────────────────── */

/**
 * Every row this tenant owns. The single expression every read and write in this authority
 * composes with — copying the clause into each call site is how one of them eventually loses it.
 */
export function ownedBy(tenant: TenantContext) {
  return eq(integrations.tenantId, tenant.tenantId);
}

/**
 * ONE row this tenant owns. The id and the tenant are in the SAME `and(...)`, so a foreign id
 * matches nothing at all rather than matching a row this module then has to decide about.
 */
export function ownedRow(tenant: TenantContext, integrationId: string) {
  return and(eq(integrations.id, integrationId), ownedBy(tenant));
}

/* ── Row → view ─────────────────────────────────────────────────────────────── */

export const COLUMNS = {
  id: integrations.id,
  name: integrations.name,
  providerKey: integrations.providerKey,
  connectionState: integrations.connectionState,
  health: integrations.health,
  scopes: integrations.scopes,
  externalAccountId: integrations.externalAccountId,
  externalAccountLabel: integrations.externalAccountLabel,
  lastVerifiedAt: integrations.lastVerifiedAt,
  lastSuccessAt: integrations.lastSuccessAt,
  lastErrorAt: integrations.lastErrorAt,
  failureReason: integrations.failureReason,
  revokedAt: integrations.revokedAt,
  createdAt: integrations.createdAt,
} as const;

export type IntegrationRow = {
  readonly id: string;
  readonly name: string;
  readonly providerKey: string | null;
  readonly connectionState: ConnectionState;
  readonly health: ConnectionHealth;
  readonly scopes: string[] | null;
  readonly externalAccountId: string | null;
  readonly externalAccountLabel: string | null;
  readonly lastVerifiedAt: Date | null;
  readonly lastSuccessAt: Date | null;
  readonly lastErrorAt: Date | null;
  readonly failureReason: string | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
};

export const iso = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

/**
 * The projection every caller receives.
 *
 * It is built from a NAMED COLUMN LIST, never from `select()` — a `SELECT *` would put whatever
 * columns the table grows next into a caller's hands automatically, which is precisely how a
 * credential column would leak the day I2 adds one to a joined table.
 */
export function toIntegrationView(row: IntegrationRow): IntegrationView {
  return {
    integrationId: row.id,
    name: row.name,
    providerKey: row.providerKey,
    connectionState: row.connectionState,
    health: row.health,
    scopes: Object.freeze([...(row.scopes ?? [])]),
    externalAccountId: row.externalAccountId,
    externalAccountLabel: row.externalAccountLabel,
    lastVerifiedAt: iso(row.lastVerifiedAt),
    lastSuccessAt: iso(row.lastSuccessAt),
    lastErrorAt: iso(row.lastErrorAt),
    failureReason: row.failureReason,
    revokedAt: iso(row.revokedAt),
    createdAt: row.createdAt.toISOString(),
  };
}

/* ── Reads ──────────────────────────────────────────────────────────────────── */

/**
 * One connection this tenant owns, or `null`.
 *
 * A foreign id and a nonexistent id both return `null`, from the same branch. There is no code
 * path that could tell them apart, so there is none that could disclose the difference.
 */
export async function readConnection(
  tenant: TenantContext | null,
  integrationId: string,
  deps: IntegrationRepositoryDeps = {},
): Promise<IntegrationView | null> {
  assertServerOnly();
  if (!tenant?.tenantId) return null;
  if (!UUID_RE.test(integrationId)) return null;

  const db = (deps.getDb ?? resolveIntegrationDbOrNull)();
  if (!db) return null;

  const [row] = await db
    .select(COLUMNS)
    .from(integrations)
    .where(ownedRow(tenant, integrationId))
    .limit(1);

  return row ? toIntegrationView(row as IntegrationRow) : null;
}

/** Every connection this tenant owns, oldest first. Bounded so a listing is never a data export. */
export async function listConnections(
  tenant: TenantContext | null,
  deps: IntegrationRepositoryDeps = {},
): Promise<ConnectionListing> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const db = (deps.getDb ?? resolveIntegrationDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  const rows = await db
    .select(COLUMNS)
    .from(integrations)
    .where(ownedBy(tenant))
    .orderBy(asc(integrations.createdAt), asc(integrations.id))
    .limit(CONNECTION_LIMITS.listLimit);

  return {
    status: "read",
    connections: rows.map((row) => toIntegrationView(row as IntegrationRow)),
  };
}
