import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getKnowledgeProjection() {
  return getActiveEnterpriseProjectionProvider().getKnowledgeProjection();
}
