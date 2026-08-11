import type { PersistenceProviderKey } from "@/features/persistence";

export interface CanonicalRepositoryCapabilities {
  readonly read: boolean;
  readonly write: boolean;
  readonly shadow: boolean;
}

export interface CanonicalRepositoryDescriptor {
  readonly repository: string;
  readonly provider: PersistenceProviderKey;
  readonly capabilities: CanonicalRepositoryCapabilities;
  /**
   * DUAL-READ ROUTING ROLE — **not** a statement about organizational truth.
   *
   * `true` marks the participant whose result the read router RETURNS; `false` marks a shadow
   * participant, whose result is compared and discarded. That is the only thing this flag has ever
   * meant here, and it is the reason the knowledge dual-read pair reads
   * `memory: true` / `postgres: false` — during that migration the in-memory implementation is the
   * one answering, and Postgres is the one being compared against it.
   *
   * It does NOT mean "source of organizational truth", "persistent system of record", or "product
   * read path". A seeded fixture can legitimately carry `true` here while owning no truth at all.
   * Read it as: *primary participant of this read router*, nothing more.
   *
   * Nothing in `src/` branches on this value — it is descriptive metadata surfaced through
   * `CanonicalRepositoryDiagnosticsView` on the gated `/_internal/canonical-read` page. Do not add
   * a runtime branch on it: the question "who owns this concept's truth?" is answered by the
   * subsystem that owns the concept, never by a routing flag.
   */
  readonly authoritative: boolean;
}

export interface ReadRepository<Query, Result> {
  readonly kind: "read";
  readonly descriptor: CanonicalRepositoryDescriptor;
  findOne(query: Query): Promise<Result>;
}

export interface WriteRepository<Record, CreateInput = Record, UpdateInput = Partial<Record>> {
  readonly kind: "write";
  readonly descriptor: CanonicalRepositoryDescriptor;
  create(input: CreateInput): Promise<Record>;
  update(id: string, input: UpdateInput): Promise<Record | undefined>;
  archive(id: string): Promise<Record | undefined>;
  restore(id: string): Promise<Record | undefined>;
  softDelete(id: string): Promise<Record | undefined>;
}

export interface ShadowRepository<Query, Result> {
  readonly kind: "shadow";
  readonly descriptor: CanonicalRepositoryDescriptor;
  isAvailable(): Promise<boolean>;
  findShadow(query: Query): Promise<Result>;
}

export interface CanonicalRepositoryDiagnosticsView {
  readonly repository: string;
  readonly authoritativeProvider: PersistenceProviderKey;
  readonly authoritativeCapabilities: CanonicalRepositoryCapabilities;
  readonly shadowProvider: PersistenceProviderKey;
  readonly shadowCapabilities: CanonicalRepositoryCapabilities;
  readonly readSource: PersistenceProviderKey;
  readonly shadowAvailable: boolean;
}
