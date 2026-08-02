import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getTimelineProjection() {
  return getActiveEnterpriseProjectionProvider().getTimelineProjection();
}

export function getTimelineContextProjection() {
  return getActiveEnterpriseProjectionProvider().getTimelineContextProjection();
}
