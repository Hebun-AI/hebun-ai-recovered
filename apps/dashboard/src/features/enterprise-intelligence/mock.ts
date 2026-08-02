import { decisionIntelligence, decisionOverview, decisions } from "@/features/decision-domain/mock";
import { knowledgeCategories, knowledgeMetrics } from "@/features/knowledge-domain/mock";
import { organizationDepartments, organizationMetrics, organizationRoles, responsibilityOverlaps } from "@/features/organization-domain/mock";
import { timelineEvents, timelineIntegrity, timelineOverview } from "@/features/timeline-domain/mock";

export type IntelligenceState = "Healthy" | "Watch" | "Attention";

export interface EnterpriseIntelligenceMetric {
  domain: "Organization" | "Knowledge" | "Timeline" | "Decision";
  label: string;
  value: string;
  detail: string;
  relationship: string;
  state: IntelligenceState;
  href: string;
}

export interface CrossDomainContext {
  title: string;
  organization: string;
  knowledge: string;
  timeline: string;
  decision: string;
  outcome: string;
}

export interface EnterpriseIntelligenceSignal {
  label: string;
  value: string;
  explanation: string;
  domains: string[];
  state: IntelligenceState;
}

export interface UnifiedHealthItem {
  domain: string;
  value: string;
  contribution: string;
  relationship: string;
  state: IntelligenceState;
}

export interface HebyEnterpriseContext {
  prompts: readonly string[];
  recommendation: string;
  evidence: string[];
  confidence: number;
  affectedDomains: string[];
  relatedDecision: string;
  timelineReference: string;
}

function metricValue(items: Array<{ label: string; value: string }>, label: string) {
  return items.find((item) => item.label === label)?.value ?? "Unavailable";
}

const organizationAttention = organizationDepartments.filter((item) => item.health !== "Healthy").length;
const knowledgeGaps = knowledgeCategories.filter((item) => item.coverage < 80).length;
const timelineAttention = timelineEvents.filter((item) => item.directorAttention).length;
const pendingDecisions = decisions.filter((item) => item.status === "Waiting Review" || item.status === "Evidence Required").length;
const weakOwnership = organizationRoles.filter((item) => item.coverage !== "Clear").length;

export const enterpriseIntelligenceOverview: EnterpriseIntelligenceMetric[] = [
  { domain: "Organization", label: "Enterprise Readiness", value: metricValue(organizationMetrics, "Organization Readiness"), detail: `${organizationAttention} departments require attention`, relationship: "Ownership shapes knowledge quality and accountable decisions.", state: "Watch", href: "/director/organization" },
  { domain: "Knowledge", label: "Knowledge Health", value: metricValue(knowledgeMetrics, "Trusted Knowledge"), detail: `${knowledgeGaps} categories remain below 80% coverage`, relationship: "Trusted evidence explains timeline events and strengthens decisions.", state: "Watch", href: "/knowledge" },
  { domain: "Timeline", label: "Timeline Activity", value: metricValue(timelineOverview, "Events Today"), detail: `${timelineAttention} events need Director attention`, relationship: "Attributed events reveal change and preserve decision context.", state: "Attention", href: "/events" },
  { domain: "Decision", label: "Decision Health", value: metricValue(decisionOverview, "Decision Health"), detail: `${pendingDecisions} decisions await evidence or review`, relationship: "Decisions consume organization, knowledge, and timeline context.", state: "Attention", href: "/approvals" },
];

export const overallEnterpriseIntelligence: { label: string; value: string; detail: string; state: IntelligenceState } = {
  label: "Overall Enterprise Intelligence Status",
  value: "Attention required",
  detail: "The enterprise is coherent, but evidence ownership and two review bottlenecks reduce readiness.",
  state: "Attention",
};

export const crossDomainContexts: CrossDomainContext[] = [
  { title: "Enterprise launch readiness", organization: "Risk & Legal ownership remains interim", knowledge: "SOC 2 evidence pack is incomplete", timeline: "Evidence gap escalated today at 08:45", decision: "Compliance evidence plan awaits review", outcome: "Resolve evidence ownership before launch readiness can advance." },
  { title: "Customer retention opportunity", organization: "Sales owns the commercial proposal", knowledge: "Twelve customer interviews support the offer", timeline: "$420K ARR opportunity entered review today", decision: "Retention experiment awaits Director review", outcome: "Evidence supports a bounded experiment; Director authority remains final." },
  { title: "Knowledge governance", organization: "Knowledge owns enterprise publication standards", knowledge: "Two categories remain below 80% coverage", timeline: "Governance policy was published today", decision: "Publishing cadence remains deferred", outcome: "Clarify cadence and ownership to improve evidence freshness." },
];

export const enterpriseIntelligenceSignals: EnterpriseIntelligenceSignal[] = [
  { label: "Missing Knowledge", value: String(knowledgeGaps), explanation: "People and governance knowledge remain below the executive coverage threshold.", domains: ["Knowledge", "Organization"], state: "Watch" },
  { label: "Organization Risk", value: String(organizationAttention), explanation: "Legal capacity and the Sales–Operations handoff need attention.", domains: ["Organization", "Decision"], state: "Attention" },
  { label: "Decision Bottlenecks", value: String(pendingDecisions), explanation: "Evidence and ownership prevent two decisions from progressing to Director review.", domains: ["Decision", "Knowledge"], state: "Attention" },
  { label: "Timeline Gaps", value: metricValue(timelineIntegrity, "Missing relationships"), explanation: "Low-impact events need additional enterprise context.", domains: ["Timeline", "Knowledge"], state: "Watch" },
  { label: "Weak Ownership", value: String(weakOwnership), explanation: "One shared responsibility and one leadership gap reduce accountability clarity.", domains: ["Organization", "Decision"], state: "Attention" },
  { label: "High Enterprise Attention", value: String(timelineAttention), explanation: "Compliance, revenue, and leadership events require Director awareness.", domains: ["Timeline", "Decision"], state: "Attention" },
  { label: "Cross-Domain Conflicts", value: String(responsibilityOverlaps.filter((item) => item.status === "Clarify").length + decisionIntelligence.filter((item) => item.type === "Conflict").length), explanation: "Ownership and launch timing conflict with current evidence readiness.", domains: ["Organization", "Knowledge", "Timeline", "Decision"], state: "Watch" },
];

export const unifiedEnterpriseHealth: UnifiedHealthItem[] = [
  { domain: "Organization", value: metricValue(organizationMetrics, "Organization Readiness"), contribution: "Defines accountable ownership and enterprise capacity.", relationship: "Organization → owns Knowledge and requests Decisions", state: "Watch" },
  { domain: "Knowledge", value: metricValue(knowledgeMetrics, "Trusted Knowledge"), contribution: "Provides evidence, provenance, and operating context.", relationship: "Knowledge → explains Timeline and supports Decisions", state: "Watch" },
  { domain: "Timeline", value: metricValue(timelineOverview, "Timeline Health"), contribution: "Preserves attributed enterprise change and follow-up.", relationship: "Timeline → records Organization, Knowledge, and Decision events", state: "Healthy" },
  { domain: "Decision", value: metricValue(decisionOverview, "Decision Health"), contribution: "Turns connected context into Director-led review.", relationship: "Decision → consumes every completed Domain", state: "Attention" },
  { domain: "Executive Readiness", value: "86%", contribution: "Reflects the quality of relationships across all four Domains.", relationship: "Connected context → informs Heby → remains under Director authority", state: "Watch" },
];

export const hebyEnterpriseContext: HebyEnterpriseContext = {
  prompts: ["Summarize today’s enterprise situation", "Which departments require attention?", "Which decisions lack evidence?"],
  recommendation: "Resolve compliance evidence ownership before reviewing the retention opportunity.",
  evidence: ["Organization shows interim Risk & Legal ownership", "Knowledge identifies an incomplete SOC 2 evidence pack", "Timeline records the escalation at 08:45", "Decision Center marks the evidence plan as required"],
  confidence: 94,
  affectedDomains: ["Organization", "Knowledge", "Timeline", "Decision"],
  relatedDecision: "D-310 · Enterprise compliance evidence plan",
  timelineReference: "Today · 08:45 evidence gap escalation",
};
