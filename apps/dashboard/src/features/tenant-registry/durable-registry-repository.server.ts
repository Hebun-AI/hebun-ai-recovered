/*
 * Durable tenant-scoped registry repository (R1 proof slice, server-only).
 *
 * Registries were chosen as the narrowest valid proof: they already have schema,
 * a codec, and first-class support in the real `SupabasePostgresAdapter`; they
 * are configuration/definition records (not execution, governance, decisions, or
 * anything that reaches a provider or device); and their tenant ownership is
 * unambiguous (registries.tenant_id -> companies.id).
 *
 * Fail-closed: when the Postgres persistence URL is absent this repository throws
 * rather than silently degrading to the in-memory adapter. A durable read must
 * never be answered by process-local memory.
 */

import type { RegistryCrudRecord } from "@/features/registry-crud/types";
import type { PersistenceContext } from "@/features/persistence/types";

/**
 * Public record shape for durable registries. Re-exported here so dashboard
 * surfaces can type the proof slice without importing the CRUD layer directly
 * (which the runtime-projection boundary reserves for mutation workspaces).
 */
export type { RegistryCrudRecord as DurableRegistryRecord } from "@/features/registry-crud/types";
import {
  createPostgresAdapter,
  PERSISTENCE_POSTGRES_DATABASE_URL_ENV,
  type SupabasePostgresAdapter,
} from "@/features/persistence/supabase-postgres-adapter";

export class DurablePersistenceUnavailableError extends Error {
  readonly code = "DURABLE_PERSISTENCE_UNAVAILABLE";
  constructor(detail: string) {
    super(detail);
    this.name = "DurablePersistenceUnavailableError";
  }
}

/** Minimal server-side authority projection the repository needs. */
export interface RegistryTenantScope {
  readonly tenantId: string;
  readonly actorId?: string;
}

export interface CreateRegistryInput {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly owner: string;
  readonly health?: number;
  readonly totalRecords?: number;
}

export function isDurableRegistryConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env[PERSISTENCE_POSTGRES_DATABASE_URL_ENV]?.trim());
}

export interface DurableRegistryRepository {
  create(
    scope: RegistryTenantScope,
    input: CreateRegistryInput,
    now?: Date,
  ): Promise<RegistryCrudRecord>;
  list(scope: RegistryTenantScope): Promise<RegistryCrudRecord[]>;
  get(
    scope: RegistryTenantScope,
    slug: string,
  ): Promise<RegistryCrudRecord | undefined>;
  dispose(): Promise<void>;
}

function persistenceContext(scope: RegistryTenantScope): PersistenceContext {
  return { tenantId: scope.tenantId, actorId: scope.actorId };
}

/**
 * Build a durable registry repository. Throws immediately when durable
 * persistence is not configured — the caller must handle the closed state, not
 * receive a memory-backed impostor.
 */
export function createDurableRegistryRepository(
  env: NodeJS.ProcessEnv = process.env,
): DurableRegistryRepository {
  if (!isDurableRegistryConfigured(env)) {
    throw new DurablePersistenceUnavailableError(
      `${PERSISTENCE_POSTGRES_DATABASE_URL_ENV} is not configured; durable ` +
        "registry persistence is unavailable and must not fall back to memory.",
    );
  }

  const adapter: SupabasePostgresAdapter<RegistryCrudRecord> =
    createPostgresAdapter<RegistryCrudRecord>({
      collection: "registries",
      seed: () => [],
      env,
    });

  return {
    async create(scope, input, now = new Date()) {
      const timestamp = now.toISOString();
      const record: RegistryCrudRecord = {
        id: input.slug,
        title: input.title,
        description: input.description,
        owner: input.owner,
        health: input.health ?? 100,
        totalRecords: input.totalRecords ?? 0,
        lifecycleStatus: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return adapter.create(record, persistenceContext(scope));
    },
    async list(scope) {
      return adapter.list(persistenceContext(scope));
    },
    async get(scope, slug) {
      const all = await adapter.list(persistenceContext(scope));
      return all.find((record) => record.id === slug);
    },
    async dispose() {
      await adapter.dispose();
    },
  };
}

let singleton: DurableRegistryRepository | undefined;

/** Process-level durable registry repository (one connection pool per process). */
export function getDurableRegistryRepository(): DurableRegistryRepository {
  if (!singleton) singleton = createDurableRegistryRepository();
  return singleton;
}

/** Dispose the process singleton (test teardown / graceful shutdown). */
export async function disposeDurableRegistryRepository(): Promise<void> {
  if (singleton) {
    const repo = singleton;
    singleton = undefined;
    await repo.dispose();
  }
}
