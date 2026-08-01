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
  recommendation: string;
  impact: "High" | "Medium";
  evidence: "Evidence ready" | "Evidence partial";
}

export interface TimelineEvent {
  type: "Meeting" | "Decision" | "Architecture" | "Review" | "Publication";
  title: string;
  time: string;
}

export const lastUpdatedAtIso = "2026-08-01T13:45:00.000Z";

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
  { recommendation: "Prioritize the compliance evidence review before the revenue planning session.", impact: "High", evidence: "Evidence ready" },
  { recommendation: "Move one operations reviewer to the enterprise launch dependency for 48 hours.", impact: "High", evidence: "Evidence partial" },
  { recommendation: "Ask Finance to validate the updated runway model before Friday.", impact: "Medium", evidence: "Evidence ready" },
];

export const timelineEvents: TimelineEvent[] = [
  { type: "Meeting", title: "Enterprise readiness review completed", time: "09:30" },
  { type: "Decision", title: "Retention experiment moved to Director review", time: "Yesterday" },
  { type: "Architecture", title: "Product shell direction approved", time: "Yesterday" },
  { type: "Review", title: "Knowledge freshness audit published", time: "Jul 30" },
  { type: "Publication", title: "Q3 operating brief shared", time: "Jul 29" },
];

export const knowledgeEntities = [
  { label: "People", count: 42 },
  { label: "Processes", count: 18 },
  { label: "Documents", count: 286 },
  { label: "Decisions", count: 64 },
  { label: "Systems", count: 12 },
  { label: "Data Assets", count: 31 },
] as const;

export const quickActions = [
  { label: "View Strategic Goals", href: "/director/goals" },
  { label: "Ask Heby", href: "#heby-assistant" },
  { label: "Open Task Planning", href: "/director/task-planning" },
  { label: "View Reports", href: "/director/reports" },
  { label: "Review Approvals", href: "/approvals" },
  { label: "Manage Agents", href: "/agents" },
] as const;
