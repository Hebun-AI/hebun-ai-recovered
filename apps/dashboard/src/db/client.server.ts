/*
 * Control-plane database client (server-only).
 *
 * R1 — Durable Foundations. This is the FIRST live database connection in the
 * repository. It backs the identity / session / membership control plane
 * (companies, users, auth_identities, memberships, user_session_contexts) that
 * the collection-oriented `SupabasePostgresAdapter` intentionally does not cover.
 *
 * It is the SAME Drizzle schema, the SAME `pg` driver and the SAME authored
 * migrations as the persistence adapter — not a second persistence framework.
 *
 * Discipline:
 * - Server only. Never import from client code.
 * - Local-first. Refuses a non-localhost target unless the operator explicitly
 *   sets HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true (mirrors the persistence adapter).
 * - Fail closed. When DATABASE_URL is unset, `getControlPlaneDb()` throws; it
 *   NEVER silently substitutes an in-memory store.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const CONTROL_PLANE_DATABASE_URL_ENV = "DATABASE_URL";
export const CONTROL_PLANE_ALLOW_REMOTE_ENV = "HEBUN_CONTROL_PLANE_ALLOW_REMOTE";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type ControlPlaneDatabase = NodePgDatabase<typeof schema>;

export interface ControlPlaneHandle {
  readonly db: ControlPlaneDatabase;
  dispose(): Promise<void>;
}

export class ControlPlaneUnavailableError extends Error {
  readonly code = "AUTH_DATABASE_UNAVAILABLE";
  constructor(detail: string) {
    super(detail);
    this.name = "ControlPlaneUnavailableError";
  }
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new ControlPlaneUnavailableError(
      "The control-plane database client is server-only.",
    );
  }
}

function assertAllowedTarget(
  connectionString: string,
  env: NodeJS.ProcessEnv,
): void {
  let target: URL;
  try {
    target = new URL(connectionString);
  } catch {
    throw new ControlPlaneUnavailableError(
      "DATABASE_URL is not a valid connection string.",
    );
  }
  if (
    env[CONTROL_PLANE_ALLOW_REMOTE_ENV] !== "true" &&
    !LOCAL_HOSTS.has(target.hostname)
  ) {
    throw new ControlPlaneUnavailableError(
      "Control-plane database target must be localhost unless " +
        `${CONTROL_PLANE_ALLOW_REMOTE_ENV}=true is set explicitly.`,
    );
  }
}

/** True only when a control-plane connection string is present. */
export function isControlPlaneConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env[CONTROL_PLANE_DATABASE_URL_ENV]?.trim());
}

/**
 * Build an isolated control-plane handle for an explicit connection string.
 * Used by tests (disposable database) and by the process singleton below.
 */
export function createControlPlaneDb(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env,
): ControlPlaneHandle {
  assertServerRuntime();
  const trimmed = connectionString.trim();
  if (!trimmed) {
    throw new ControlPlaneUnavailableError(
      "A control-plane connection string is required.",
    );
  }
  assertAllowedTarget(trimmed, env);
  const pool = new Pool({
    connectionString: trimmed,
    max: 4,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 2000,
    application_name: "hebun-control-plane",
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    async dispose(): Promise<void> {
      await pool.end();
    },
  };
}

let singleton: ControlPlaneHandle | undefined;

/**
 * Process-level control-plane database. Fail-closed: throws when DATABASE_URL is
 * unset rather than degrading to memory. The connection is created lazily on
 * first use.
 */
export function getControlPlaneDb(
  env: NodeJS.ProcessEnv = process.env,
): ControlPlaneDatabase {
  assertServerRuntime();
  const connectionString = env[CONTROL_PLANE_DATABASE_URL_ENV]?.trim();
  if (!connectionString) {
    throw new ControlPlaneUnavailableError(
      `${CONTROL_PLANE_DATABASE_URL_ENV} is not configured; durable identity ` +
        "persistence is unavailable and must not fall back to memory.",
    );
  }
  if (!singleton) {
    singleton = createControlPlaneDb(connectionString, env);
  }
  return singleton.db;
}

/** Dispose the process singleton (test teardown / graceful shutdown). */
export async function disposeControlPlaneDb(): Promise<void> {
  if (singleton) {
    const handle = singleton;
    singleton = undefined;
    await handle.dispose();
  }
}
