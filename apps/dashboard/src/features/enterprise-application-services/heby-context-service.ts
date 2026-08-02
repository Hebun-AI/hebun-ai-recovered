import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { HebyContextRepository } from "@/features/enterprise-persistence/ports";

export function loadHebyContextProjection(repository: HebyContextRepository) {
  return requirePersistenceSuccess(repository.loadHebyContext(), "Heby context projection");
}
