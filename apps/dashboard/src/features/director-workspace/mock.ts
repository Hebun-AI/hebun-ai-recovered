export type HealthStatus = "Healthy" | "Watch" | "Stable";

export interface HealthSummary {
  label: string;
  status: HealthStatus;
  value: string;
  supportingText: string;
  progress: number;
  trend: string;
}

export interface Priority {
  rank: number;
  title: string;
  domain: string;
  dueState: string;
  severity: "Critical" | "High" | "Medium";
}

export interface Decision {
  title: string;
  impact: string;
  deadline: string;
  status: "Review today" | "Due soon" | "Draft";
}

export interface Recommendation {
  priority: "Critical" | "High" | "Medium";
  recommendation: string;
  reason: string;
  businessImpact: string;
  affectedDomains: string[];
  confidence: number;
  directorAction: string;
}

export interface TimelineEvent {
  type: "Meeting" | "Decision" | "Architecture" | "Review" | "Publication";
  title: string;
  time: string;
  impact: string;
  status: "Complete" | "Review" | "Published";
  source: string;
}

export interface ExecutiveIntelligenceItem {
  label: "Critical Today" | "Enterprise Risks" | "Top Opportunity" | "Pending Approvals" | "Knowledge Changes" | "Recent Decisions" | "Strategic Recommendation";
  value: string;
  insight: string;
  tone: "critical" | "attention" | "positive" | "neutral";
}

export interface ExecutiveStatusMetric {
  label: string;
  value: string;
  context: string;
  state: "Healthy" | "Attention" | "Ready" | "Pending";
}

export interface DailyBriefItem {
  label: string;
  value: string;
  detail: string;
  direction: "positive" | "neutral" | "attention";
}

export interface AdvisorAwareness {
  label: string;
  value: string;
  detail: string;
}

export interface KnowledgeEntity {
  label: "Decision" | "Policy" | "Department" | "Document" | "Workflow" | "Agent" | "Knowledge";
  value: string;
  relationship: string;
}

export const lastUpdatedAtIso = "2026-08-01T13:45:00.000Z";

export const executiveStatus: ExecutiveStatusMetric[] = [
  { label: "Enterprise Status", value: "Stable", context: "Operating within expected range", state: "Healthy" },
  { label: "Critical Issues", value: "1", context: "Compliance evidence requires review", state: "Attention" },
  { label: "Pending Decisions", value: "3", context: "Two require attention today", state: "Pending" },
  { label: "Organization Readiness", value: "86%", context: "Enterprise launch dependency open", state: "Ready" },
  { label: "Enterprise Health Score", value: "92", context: "+2.4 points this month", state: "Healthy" },
];

export const dailyBrief: DailyBriefItem[] = [
  { label: "Decisions completed", value: "4", detail: "2 strategic · 2 operational", direction: "positive" },
  { label: "Risks resolved", value: "3", detail: "1 critical risk remains", direction: "attention" },
  { label: "Revenue movement", value: "+2.8%", detail: "$46K net expansion", direction: "positive" },
  { label: "Customer activity", value: "18", detail: "6 enterprise conversations", direction: "neutral" },
  { label: "Knowledge growth", value: "+12", detail: "New verified sources", direction: "positive" },
  { label: "Critical alerts", value: "1", detail: "SOC 2 evidence gap", direction: "attention" },
];

export const advisorAwareness: AdvisorAwareness[] = [
  { label: "Signals", value: "12", detail: "5 domains" },
  { label: "Reviews", value: "3", detail: "Director required" },
  { label: "Knowledge", value: "+12", detail: "Since yesterday" },
  { label: "Reasoning", value: "16:42", detail: "Posture refreshed" },
];

export const executiveIntelligence: ExecutiveIntelligenceItem[] = [
  { label: "Critical Today", value: "1 issue", insight: "SOC 2 evidence gap blocks readiness", tone: "critical" },
  { label: "Enterprise Risks", value: "3 open", insight: "Compliance risk carries highest exposure", tone: "attention" },
  { label: "Top Opportunity", value: "$420K ARR", insight: "Retention experiment awaits approval", tone: "positive" },
  { label: "Pending Approvals", value: "3", insight: "Two decisions need review today", tone: "attention" },
  { label: "Knowledge Changes", value: "+12", insight: "Four domains still need fresh evidence", tone: "neutral" },
  { label: "Recent Decisions", value: "4 complete", insight: "Two strategic decisions recorded", tone: "positive" },
  { label: "Strategic Recommendation", value: "Act before 14:00", insight: "Resolve compliance evidence first", tone: "critical" },
];

export const healthSummaries: HealthSummary[] = [
  { label: "Enterprise Health", status: "Healthy", value: "92%", supportingText: "Core business signals remain strong.", progress: 92, trend: "+2.4% this month" },
  { label: "Organization Health", status: "Watch", value: "86%", supportingText: "Legal capacity needs attention.", progress: 86, trend: "−1.2% this week" },
  { label: "Runtime Health", status: "Stable", value: "98.2%", supportingText: "All critical services are available.", progress: 98, trend: "+0.4% this week" },
  { label: "Financial Health", status: "Healthy", value: "$1.8M", supportingText: "Available operating runway: 18 months.", progress: 90, trend: "+6.8% revenue" },
  { label: "Knowledge Health", status: "Watch", value: "78%", supportingText: "Four domains need fresher evidence.", progress: 78, trend: "+12 sources added" },
];

export const priorities: Priority[] = [
  { rank: 1, title: "Close the SOC 2 evidence gap", domain: "Risk & Compliance", dueState: "Due today", severity: "Critical" },
  { rank: 2, title: "Resolve enterprise launch dependency", domain: "Operations", dueState: "Due tomorrow", severity: "High" },
  { rank: 3, title: "Review Q3 runway assumptions", domain: "Finance", dueState: "Due Friday", severity: "Medium" },
];

export const decisions: Decision[] = [
  { title: "Add contract review capacity", impact: "Unblocks enterprise launch readiness", deadline: "Today · 16:00", status: "Review today" },
  { title: "Approve retention experiment", impact: "Protects an estimated $420K ARR", deadline: "Tomorrow", status: "Due soon" },
  { title: "Adopt knowledge publishing cadence", impact: "Improves decision evidence freshness", deadline: "No deadline", status: "Draft" },
];

export const recommendations: Recommendation[] = [
  { priority: "Critical", recommendation: "Close the compliance evidence gap before the revenue planning session.", reason: "The unresolved control blocks enterprise readiness and increases audit exposure.", businessImpact: "Restores launch confidence and protects the current enterprise sales cycle.", affectedDomains: ["Risk", "Sales", "Operations"], confidence: 94, directorAction: "Review evidence plan" },
  { priority: "High", recommendation: "Assign temporary review capacity to the enterprise launch dependency.", reason: "The current owner is constrained and the dependency is now on the critical path.", businessImpact: "Protects the launch window and reduces cross-team delay.", affectedDomains: ["Operations", "People"], confidence: 87, directorAction: "Review capacity option" },
  { priority: "Medium", recommendation: "Validate the updated runway assumptions before Friday.", reason: "Revenue expansion improved, but the hiring model still uses the prior forecast.", businessImpact: "Improves confidence in Q3 investment and hiring decisions.", affectedDomains: ["Finance", "People"], confidence: 82, directorAction: "Review finance brief" },
];

export const timelineEvents: TimelineEvent[] = [
  { type: "Meeting", title: "Enterprise readiness review completed", time: "09:30", impact: "One launch blocker confirmed", status: "Complete", source: "Operations" },
  { type: "Decision", title: "Retention experiment moved to Director review", time: "Yesterday", impact: "$420K ARR opportunity", status: "Review", source: "Customer Success" },
  { type: "Architecture", title: "Product shell direction approved", time: "Yesterday", impact: "Phase 2 identity preserved", status: "Complete", source: "Product" },
  { type: "Review", title: "Knowledge freshness audit published", time: "Jul 30", impact: "Four domains need updates", status: "Published", source: "Knowledge" },
  { type: "Publication", title: "Q3 operating brief shared", time: "Jul 29", impact: "Leadership context aligned", status: "Published", source: "Director Office" },
];

export const knowledgeEntities: KnowledgeEntity[] = [
  { label: "Decision", value: "D-204", relationship: "governs" },
  { label: "Policy", value: "SOC 2", relationship: "constrains" },
  { label: "Department", value: "Operations", relationship: "owns" },
  { label: "Document", value: "Evidence plan", relationship: "supports" },
  { label: "Workflow", value: "Control review", relationship: "implements" },
  { label: "Agent", value: "Risk advisor", relationship: "observes" },
  { label: "Knowledge", value: "12 sources", relationship: "informs" },
];

export const quickActions = [
  { label: "View Strategic Goals", href: "/director/goals" },
  { label: "Ask Heby", href: "#heby-assistant" },
  { label: "Open Task Planning", href: "/director/task-planning" },
  { label: "View Reports", href: "/director/reports" },
  { label: "Review Approvals", href: "/approvals" },
  { label: "Manage Agents", href: "/agents" },
] as const;
