export type EntityId = string;
export type CreatedAt = string;
export type UpdatedAt = string;
export type Version = number;
export type ConcurrencyToken = string;

export interface EntityMetadata {
  entityId: EntityId;
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
  version: Version;
  concurrencyToken: ConcurrencyToken;
}
