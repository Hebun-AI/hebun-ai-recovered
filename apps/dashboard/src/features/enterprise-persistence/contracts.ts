export interface PersistenceSuccess<T> {
  status: "Success";
  value: T;
}

export interface PersistenceNotFound {
  status: "NotFound";
  message: string;
}

export interface PersistenceConflict {
  status: "Conflict";
  message: string;
}

export interface PersistenceValidationFailure {
  status: "ValidationFailure";
  issues: readonly string[];
}

export interface PersistenceTemporaryFailure {
  status: "TemporaryFailure";
  message: string;
}

export interface PersistencePermanentFailure {
  status: "PermanentFailure";
  message: string;
}

export type PersistenceResult<T> =
  | PersistenceSuccess<T>
  | PersistenceNotFound
  | PersistenceConflict
  | PersistenceValidationFailure
  | PersistenceTemporaryFailure
  | PersistencePermanentFailure;

export function persistenceSuccess<T>(value: T): PersistenceSuccess<T> {
  return { status: "Success", value };
}
