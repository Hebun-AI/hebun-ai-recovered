import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getHebyContextProjection() {
  return getActiveEnterpriseProjectionProvider().getHebyContextProjection();
}
