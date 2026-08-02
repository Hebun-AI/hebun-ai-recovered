export type KnowledgeHealth = "Healthy" | "Watch" | "Attention";
export type TrustLevel = "Verified" | "Reviewed" | "Unverified";

export interface KnowledgeMetric {
  label: string;
  value: string;
  detail: string;
  state: KnowledgeHealth;
}

export interface KnowledgeSource {
  type: "Books" | "PDFs" | "YouTube" | "Internal Documents" | "Policies" | "SOPs" | "Enterprise Wiki";
  assets: number;
  trustedPercent: number;
  freshness: string;
  state: KnowledgeHealth;
  purpose: string;
}

export interface KnowledgeCategory {
  name: string;
  assets: number;
  coverage: number;
  gap: string;
}

export interface RecentKnowledge {
  title: string;
  source: KnowledgeSource["type"];
  category: string;
  added: string;
  owner: string;
  trust: TrustLevel;
}

export interface KnowledgeRelationship {
  source: string;
  relationship: string;
  target: string;
  context: string;
  strength: "Strong" | "Developing" | "Gap";
}

export const knowledgeMetrics: KnowledgeMetric[] = [
  { label: "Knowledge Assets", value: "1,248", detail: "Across seven governed source types", state: "Healthy" },
  { label: "Trusted Knowledge", value: "82%", detail: "Verified or reviewed for enterprise use", state: "Watch" },
  { label: "Domain Coverage", value: "9 / 12", detail: "Legal, Security, and People need depth", state: "Attention" },
  { label: "Knowledge Freshness", value: "76%", detail: "58 assets require a current review", state: "Watch" },
  { label: "Recent Growth", value: "+34", detail: "New assets added in the last 30 days", state: "Healthy" },
];

export const knowledgeSources: KnowledgeSource[] = [
  { type: "Books", assets: 64, trustedPercent: 94, freshness: "12 added this quarter", state: "Healthy", purpose: "Durable external principles and specialist expertise" },
  { type: "PDFs", assets: 286, trustedPercent: 79, freshness: "18 awaiting review", state: "Watch", purpose: "Research, reports, standards, and reference material" },
  { type: "YouTube", assets: 91, trustedPercent: 68, freshness: "7 transcripts unverified", state: "Attention", purpose: "Expert talks, demonstrations, and market learning" },
  { type: "Internal Documents", assets: 312, trustedPercent: 87, freshness: "24 updated this month", state: "Healthy", purpose: "Enterprise plans, operating records, and working knowledge" },
  { type: "Policies", assets: 47, trustedPercent: 96, freshness: "3 due for review", state: "Healthy", purpose: "Governed enterprise rules and decision boundaries" },
  { type: "SOPs", assets: 126, trustedPercent: 84, freshness: "11 process gaps", state: "Watch", purpose: "Repeatable operational knowledge and responsibilities" },
  { type: "Enterprise Wiki", assets: 322, trustedPercent: 74, freshness: "29 stale pages", state: "Watch", purpose: "Shared organizational context and institutional memory" },
];

export const knowledgeCategories: KnowledgeCategory[] = [
  { name: "Strategy & Decisions", assets: 146, coverage: 92, gap: "Decision rationale is well represented" },
  { name: "Products & Customers", assets: 238, coverage: 88, gap: "Customer evidence needs regional depth" },
  { name: "Operations & Processes", assets: 312, coverage: 84, gap: "Eleven workflows lack current SOPs" },
  { name: "People & Organization", assets: 174, coverage: 71, gap: "Leadership development knowledge is incomplete" },
  { name: "Risk & Governance", assets: 201, coverage: 78, gap: "Security and legal evidence requires review" },
  { name: "Market & Research", assets: 177, coverage: 81, gap: "Competitive signals are unevenly sourced" },
];

export const recentlyAddedKnowledge: RecentKnowledge[] = [
  { title: "Enterprise launch readiness review", source: "Internal Documents", category: "Operations & Processes", added: "Today · 09:20", owner: "Operations", trust: "Verified" },
  { title: "EU AI Act executive briefing", source: "PDFs", category: "Risk & Governance", added: "Yesterday", owner: "Risk & Legal", trust: "Reviewed" },
  { title: "Customer expansion interview synthesis", source: "YouTube", category: "Products & Customers", added: "Yesterday", owner: "Sales", trust: "Unverified" },
  { title: "Knowledge governance policy v2", source: "Policies", category: "Risk & Governance", added: "Jul 31", owner: "Knowledge", trust: "Verified" },
  { title: "Quarterly planning operating procedure", source: "SOPs", category: "Operations & Processes", added: "Jul 30", owner: "Finance + Operations", trust: "Reviewed" },
];

export const knowledgeRelationships: KnowledgeRelationship[] = [
  { source: "Policies", relationship: "govern", target: "SOPs", context: "Enterprise rules become repeatable operating practice", strength: "Strong" },
  { source: "Customer Evidence", relationship: "informs", target: "Decisions", context: "Commercial evidence supports Director review", strength: "Developing" },
  { source: "Organization", relationship: "owns", target: "Internal Knowledge", context: "Every governed asset has accountable domain ownership", strength: "Strong" },
  { source: "Research", relationship: "updates", target: "Enterprise Wiki", context: "Validated external learning strengthens shared context", strength: "Developing" },
  { source: "Security Knowledge", relationship: "supports", target: "Risk Readiness", context: "Missing control evidence limits confidence", strength: "Gap" },
];
