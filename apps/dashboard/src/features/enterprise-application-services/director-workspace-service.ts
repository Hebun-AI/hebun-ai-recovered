import { directorWorkspaceProjection } from "@/features/director-workspace/mock";
import type { DirectorWorkspaceProjection } from "@/features/enterprise-projections";

export function loadDirectorWorkspaceProjection(): DirectorWorkspaceProjection {
  return directorWorkspaceProjection;
}
