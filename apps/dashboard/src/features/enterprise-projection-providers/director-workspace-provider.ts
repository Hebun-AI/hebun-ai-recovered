import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getDirectorWorkspaceProjection() {
  return getActiveEnterpriseProjectionProvider().getDirectorWorkspaceProjection();
}
