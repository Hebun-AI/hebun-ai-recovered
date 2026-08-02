import { hebyEnterpriseContext } from "@/features/enterprise-intelligence/mock";
import type { HebyEnterpriseContextProjection } from "@/features/enterprise-projections";

export function loadHebyContextProjection(): HebyEnterpriseContextProjection {
  return hebyEnterpriseContext;
}
