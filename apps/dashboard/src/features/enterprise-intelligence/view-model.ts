import type { EnterpriseHealthProjection } from "@/features/enterprise-projections";

export type EnterpriseIntelligenceMetric = EnterpriseHealthProjection & {
  domain: "Organization" | "Knowledge" | "Timeline" | "Decision";
  label: string;
  detail: string;
  href: string;
};

export type UnifiedHealthItem = EnterpriseHealthProjection & {
  contribution: string;
};
