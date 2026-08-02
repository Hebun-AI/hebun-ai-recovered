import type { PersistenceResult } from "@/features/enterprise-persistence/contracts";

export function requirePersistenceSuccess<T>(result: PersistenceResult<T>, subject: string): T {
  if (result.status === "Success") return result.value;

  throw new Error(`Unable to load ${subject}: ${result.status}`);
}
