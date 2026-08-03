/**
 * Enterprise Memory Persistence — composition helpers.
 *
 * Assembles a MemoryRepository behind a UnitOfWork for each backing store. The
 * PostgreSQL variant owns its pool lifecycle explicitly; the in-memory variant is
 * process-local. Selection stays centralized in the Runtime Composition Root —
 * there is no service locator and no runtime registration here.
 */

import { Pool } from "pg";
import type { EventPublisher } from "@/features/enterprise-event-bus";
import { createPostgresUnitOfWork } from "@/features/enterprise-unit-of-work";
import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import {
  createInMemoryMemoryRepository,
  createInMemoryMemoryUnitOfWork,
} from "@/features/enterprise-memory-persistence/in-memory";
import { createPostgresMemoryRepository } from "@/features/enterprise-memory-persistence/postgresql";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence/port";

export interface MemoryPersistenceComposition {
  readonly unitOfWork: UnitOfWork<MemoryRepository>;
  close(): Promise<void>;
}

export function createInMemoryMemoryPersistence(eventPublisher: EventPublisher): MemoryPersistenceComposition {
  const repository = createInMemoryMemoryRepository();
  return Object.freeze({
    unitOfWork: createInMemoryMemoryUnitOfWork(repository, eventPublisher),
    close: async () => undefined,
  });
}

export function createPostgresMemoryPersistence(
  connectionString: string,
  eventPublisher: EventPublisher,
): MemoryPersistenceComposition {
  const pool = new Pool({
    connectionString,
    application_name: "hebun-enterprise-memory-persistence",
    max: 4,
    idleTimeoutMillis: 1000,
  });
  const unitOfWork = createPostgresUnitOfWork(
    pool,
    (client) => createPostgresMemoryRepository(client),
    eventPublisher,
  );
  return Object.freeze({ unitOfWork, close: () => pool.end() });
}
