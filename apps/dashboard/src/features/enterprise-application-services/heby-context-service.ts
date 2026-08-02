import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { HebyContextRepository } from "@/features/enterprise-persistence/ports";

export async function loadHebyContextProjection(repository: HebyContextRepository) {
  return requirePersistenceSuccess(await repository.loadHebyContext(), "Heby context projection");
}
