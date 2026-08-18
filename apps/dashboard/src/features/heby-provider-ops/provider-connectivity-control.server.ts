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
 * ── READ-ONLY SINCE R5.1 ─────────────────────────────────────────────────────
 *
 * This module can no longer WRITE the control, and neither can anything else under `src/`.
 *
 * The table is root-scoped — no `tenant_id`, one row per provider key for the whole deployment —
 * while every authority Hebun can resolve in-app is tenant-scoped: `roles.tenant_id` is NOT NULL and
 * the former provider authority resolver joined the role to the session's tenant. So a
 * tenant-confined authority gated a write that applied to every tenant at once. Canonical carried
 * the proof rather than the hypothesis: the live row had been moved 29 times by a human whose only
 * membership was in one tenant, and the row governed the other tenant too.
 *
 * Removing the caller would have left the seam for the next caller to find. The write CAPABILITY was
 * removed instead, so "the application cannot mutate global provider connectivity" is a property of
 * the code rather than a property of who currently calls it. The mutation now lives in
 * `scripts/lib/provider-connectivity.ts` under deployment possession, which `src/` cannot reach.
 *
 * This creates no platform operator and no platform-admin. Production consequently has NO write path
 * at all — the fail-closed direction, because `directorEnabled` defaults to false and every reader
 * below treats an absent row, an unconfigured database and a read error as disabled.
 *
 * Server-only. Not re-exported from any client-importable index.
 */
import { eq } from "drizzle-orm";
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

/**
 * The read-only durable control repository.
 *
 * There is deliberately no `setDirectorEnabled` here, and no other write method. The global control
 * is mutated exclusively by the deployment-possession ceremony in `scripts/`; see the header.
 */
export interface ProviderConnectivityControlRepository {
  /** The durable control for a provider, or null when no row exists (→ caller fails closed). */
  getControl(providerKey: string): Promise<ProviderConnectivityControl | null>;
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

/*
 * There is no `setClaudeDirectorEnabled` and no sibling writer for any other provider key.
 * The global permission is changed only by `npm run provider:connectivity`, under deployment
 * possession — see the header for why the capability was removed rather than merely uncalled.
 */
