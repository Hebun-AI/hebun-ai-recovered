/*
 * heby-provider-ops/provider-connectivity-control.server.ts — the durable Director ON/OFF
 * authority for a model provider's Hebun→provider *model-generation* connectivity (World A).
 *
 * This is the ONE legitimate source of truth for "the Director permits Claude connectivity".
 * It is read server-side BEFORE any transport is selected or dispatched, and it FAILS CLOSED:
 *  - no control-plane database  → disabled
 *  - no row for the provider     → disabled
 *  - any read error              → disabled
 * so the durable authority can never silently permit a live request.
 *
 * It never touches the API key and never claims health/reachability. `directorEnabled` is an
 * operational PERMISSION, not a connectivity guarantee. Global (one row per provider), because
 * the credential and model config are server-global for this slice.
 *
 * Server-only. Not re-exported from any client-importable index.
 */
import { eq, sql } from "drizzle-orm";
import {
  getControlPlaneDb,
  isControlPlaneConfigured,
  type ControlPlaneDatabase,
} from "@/db/client.server";
import { providerConnectivityControls } from "@/db/schema/provider-connectivity-control";

/** The provider key for Anthropic's Claude model connectivity (World A). */
export const CLAUDE_PROVIDER_KEY = "claude";

/** A truthful, secret-free projection of the durable control. Never carries a credential. */
export interface ProviderConnectivityControl {
  readonly providerKey: string;
  readonly directorEnabled: boolean;
  readonly version: number;
  readonly updatedAt: string;
  /** Actor attribution for the last change (server-resolved). Null when never set by an actor. */
  readonly updatedBy: string | null;
}

/** The minimal server-resolved actor the mutation records. Never client-supplied. */
export interface ProviderControlActor {
  readonly actorId?: string;
}

export interface ProviderConnectivityControlRepository {
  /** The durable control for a provider, or null when no row exists (→ caller fails closed). */
  getControl(providerKey: string): Promise<ProviderConnectivityControl | null>;
  /** Upsert the Director permission; bumps version and records actor attribution. */
  setDirectorEnabled(
    providerKey: string,
    enabled: boolean,
    actor?: ProviderControlActor,
  ): Promise<ProviderConnectivityControl>;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider connectivity control is server-only.");
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toControl(row: typeof providerConnectivityControls.$inferSelect): ProviderConnectivityControl {
  return {
    providerKey: row.providerKey,
    directorEnabled: row.directorEnabled,
    version: row.version,
    updatedAt: iso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

/**
 * Build a provider-connectivity-control repository over a control-plane database handle.
 * Injectable so the durable authority is provable against a disposable Postgres in tests.
 */
export function createProviderConnectivityControlRepository(
  db: ControlPlaneDatabase,
): ProviderConnectivityControlRepository {
  return {
    async getControl(providerKey) {
      const rows = await db
        .select()
        .from(providerConnectivityControls)
        .where(eq(providerConnectivityControls.providerKey, providerKey))
        .limit(1);
      return rows[0] ? toControl(rows[0]) : null;
    },

    async setDirectorEnabled(providerKey, enabled, actor) {
      const actorId = actor?.actorId ?? null;
      const rows = await db
        .insert(providerConnectivityControls)
        .values({
          providerKey,
          directorEnabled: enabled,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .onConflictDoUpdate({
          target: providerConnectivityControls.providerKey,
          set: {
            directorEnabled: enabled,
            updatedAt: new Date(),
            updatedBy: actorId,
            // Optimistic-concurrency counter advances on every change.
            version: sql`${providerConnectivityControls.version} + 1`,
          },
        })
        .returning();
      return toControl(rows[0]!);
    },
  };
}

let singleton: ProviderConnectivityControlRepository | undefined;

/** Process-level repository over the control-plane DB. Fail-closed: throws when unconfigured. */
export function getProviderConnectivityControlRepository(): ProviderConnectivityControlRepository {
  assertServerRuntime();
  if (!singleton) singleton = createProviderConnectivityControlRepository(getControlPlaneDb());
  return singleton;
}

/**
 * The production repository resolver: the durable repository when the control-plane DB is
 * configured, or an honest `null` when it is not (never an in-memory impostor).
 */
export function resolveProviderControlRepoOrNull(
  env: NodeJS.ProcessEnv = process.env,
): ProviderConnectivityControlRepository | null {
  if (!isControlPlaneConfigured(env)) return null;
  try {
    return getProviderConnectivityControlRepository();
  } catch {
    return null;
  }
}

/**
 * The kill-switch READ used before any transport is selected/dispatched. FAIL CLOSED:
 * unconfigured DB, missing row, or any error all resolve to `false`. Optionally injectable for
 * tests; production reads the durable control-plane record.
 */
export async function resolveDirectorEnabled(
  providerKey: string,
  deps: { readonly repo?: ProviderConnectivityControlRepository | null } = {},
): Promise<boolean> {
  const repo = deps.repo !== undefined ? deps.repo : resolveProviderControlRepoOrNull();
  if (!repo) return false;
  try {
    const control = await repo.getControl(providerKey);
    return control?.directorEnabled === true;
  } catch {
    return false;
  }
}

/** Convenience: the fail-closed Claude kill-switch read. */
export function resolveClaudeDirectorEnabled(): Promise<boolean> {
  return resolveDirectorEnabled(CLAUDE_PROVIDER_KEY);
}

/** Convenience: set the durable Claude Director permission. */
export function setClaudeDirectorEnabled(
  enabled: boolean,
  actor?: ProviderControlActor,
): Promise<ProviderConnectivityControl> {
  return getProviderConnectivityControlRepository().setDirectorEnabled(
    CLAUDE_PROVIDER_KEY,
    enabled,
    actor,
  );
}
