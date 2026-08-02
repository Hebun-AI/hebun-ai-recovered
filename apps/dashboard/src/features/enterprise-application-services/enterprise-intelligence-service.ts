import { enterpriseIntelligenceOverview, enterpriseIntelligenceProjection, unifiedEnterpriseHealth } from "@/features/enterprise-intelligence/mock";
import type { EnterpriseHealthProjection, EnterpriseIntelligenceOverviewProjection } from "@/features/enterprise-projections";

type EnterpriseIntelligenceMetric = EnterpriseHealthProjection & {
  domain: "Organization" | "Knowledge" | "Timeline" | "Decision";
  label: string;
  detail: string;
  href: string;
};

type UnifiedHealthItem = EnterpriseHealthProjection & {
  contribution: string;
};

export interface EnterpriseIntelligenceApplicationProjection extends EnterpriseIntelligenceOverviewProjection {
  domainHealth: EnterpriseIntelligenceMetric[];
  unifiedHealth: UnifiedHealthItem[];
}

export function loadEnterpriseIntelligenceProjection(): EnterpriseIntelligenceApplicationProjection {
  return {
    ...enterpriseIntelligenceProjection,
    domainHealth: enterpriseIntelligenceOverview,
    unifiedHealth: unifiedEnterpriseHealth,
  };
}
