export type DecisionStatus = "Waiting Review" | "Evidence Required" | "Deferred" | "Approved" | "Rejected";
export type DecisionPriority = "Critical" | "High" | "Medium" | "Low";
export type DecisionRisk = "Critical" | "High" | "Medium" | "Low";
export type DecisionImpact = "Transformational" | "High" | "Medium" | "Low";
export type DecisionDateRange = "All dates" | "Due today" | "Due this week" | "No deadline";

export interface DecisionOwner {
  name: string;
  role: string;
  domain: string;
}

export interface DecisionEvidence {
  title: string;
  source: string;
  trust: "Verified" | "Reviewed" | "Incomplete";
  summary: string;
}

export interface DecisionRelationship {
  kind: "Organization" | "Knowledge" | "Timeline" | "Policy" | "Project" | "Agent" | "System";
  label: string;
  relationship: string;
}

export interface Decision {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  category: string;
  priority: DecisionPriority;
  impact: DecisionImpact;
  confidence: number;
  status: DecisionStatus;
  owner: DecisionOwner;
  requestedBy: string;
  decisionDate: string;
  dueDate: string;
  dateRange: Exclude<DecisionDateRange, "All dates">;
  domains: string[];
  directorAttention: boolean;
  risk: DecisionRisk;
  expectedImpact: string;
  risks: string[];
  alternatives: string[];
  evidence: DecisionEvidence[];
  relatedOrganization: string[];
  relatedKnowledge: string[];
  relatedTimeline: string[];
  relatedPolicies: string[];
  followUp: string[];
  relationships: DecisionRelationship[];
}

export interface DecisionFilterState {
  status: DecisionStatus | "All statuses";
  priority: DecisionPriority | "All priorities";
  impact: DecisionImpact | "All impacts";
  risk: DecisionRisk | "All risks";
  domain: string;
  owner: string;
  requestedBy: string;
  attention: "Any attention" | "Director attention" | "No attention required";
  date: DecisionDateRange;
}

export interface DecisionIndicator {
  label: string;
  value: string;
  detail: string;
  state: "Healthy" | "Watch" | "Attention";
}

export interface DecisionIntelligenceSignal extends DecisionIndicator {
  type: "Missing evidence" | "Review age" | "High risk" | "Conflict" | "Duplicate" | "Ownership" | "Knowledge gap";
}

export const decisionOverview: DecisionIndicator[] = [
  { label: "Decisions Waiting", value: "3", detail: "Two require review today", state: "Watch" },
  { label: "Critical Decisions", value: "1", detail: "Compliance evidence plan", state: "Attention" },
  { label: "High Impact Decisions", value: "3", detail: "Launch, revenue, and ownership", state: "Watch" },
  { label: "Deferred Decisions", value: "1", detail: "Knowledge cadence revisits Friday", state: "Watch" },
  { label: "Recently Approved", value: "1", detail: "Q3 market expansion", state: "Healthy" },
  { label: "Recently Rejected", value: "1", detail: "Vendor automation proposal", state: "Healthy" },
  { label: "Average Review Time", value: "1.8d", detail: "Within the 2-day executive target", state: "Healthy" },
  { label: "Decision Health", value: "84%", detail: "Evidence quality needs attention", state: "Watch" },
];

export const decisions: Decision[] = [
  { id: "D-310", title: "Approve the enterprise compliance evidence plan", summary: "Close the control-evidence gap before enterprise launch approval.", explanation: "Risk & Legal has proposed a bounded evidence plan that assigns temporary ownership, confirms the missing controls, and schedules Director review before launch readiness can be approved.", category: "Governance", priority: "Critical", impact: "Transformational", confidence: 94, status: "Evidence Required", owner: { name: "Şenol Sevim", role: "Enterprise Director", domain: "Director Office" }, requestedBy: "Risk & Legal", decisionDate: "Not decided", dueDate: "Today · 16:00", dateRange: "Due today", domains: ["Risk", "Operations", "Sales"], directorAttention: true, risk: "Critical", expectedImpact: "Restores enterprise launch confidence and protects the active sales cycle.", risks: ["Incomplete evidence could create audit exposure", "Delayed review may move the launch window"], alternatives: ["Delay the launch review", "Assign an external compliance reviewer", "Reduce launch scope"], evidence: [{ title: "SOC 2 evidence gap assessment", source: "Knowledge Domain", trust: "Verified", summary: "Four controls lack current accountable evidence." }, { title: "Launch dependency review", source: "Enterprise Timeline", trust: "Verified", summary: "The evidence gap is the only unresolved critical event." }], relatedOrganization: ["Risk & Legal", "Operations", "Director Office"], relatedKnowledge: ["SOC 2 evidence pack", "Enterprise readiness brief"], relatedTimeline: ["TL-207 · Compliance evidence gap escalated", "TL-208 · Readiness review completed"], relatedPolicies: ["SOC 2 evidence policy", "Enterprise launch approval policy"], followUp: ["Confirm temporary evidence owner", "Review closure evidence at 16:00"], relationships: [{ kind: "Organization", label: "Risk & Legal", relationship: "requested by" }, { kind: "Knowledge", label: "SOC 2 evidence pack", relationship: "supported by" }, { kind: "Timeline", label: "TL-207", relationship: "recorded in" }, { kind: "Policy", label: "Launch approval policy", relationship: "constrained by" }] },
  { id: "D-309", title: "Authorize the customer retention experiment", summary: "Review a $420K ARR opportunity using a bounded commercial experiment.", explanation: "Sales proposes a controlled retention offer for a high-value customer cohort. The proposal stays inside the Director review boundary and cannot release any execution.", category: "Growth", priority: "High", impact: "High", confidence: 87, status: "Waiting Review", owner: { name: "Leyla Şahin", role: "Chief Revenue Officer", domain: "Sales" }, requestedBy: "Sales", decisionDate: "Not decided", dueDate: "Tomorrow · 12:00", dateRange: "Due this week", domains: ["Sales", "Finance", "Knowledge"], directorAttention: true, risk: "Medium", expectedImpact: "Protects an estimated $420K ARR while generating reusable retention evidence.", risks: ["Discount precedent may weaken future negotiations", "Small cohort could produce incomplete evidence"], alternatives: ["Maintain current terms", "Offer service credits instead", "Limit the experiment to one account"], evidence: [{ title: "Customer retention evidence", source: "Knowledge Domain", trust: "Reviewed", summary: "Twelve interviews support the proposed offer structure." }, { title: "Revenue exposure model", source: "Finance", trust: "Verified", summary: "Downside remains within the approved commercial boundary." }], relatedOrganization: ["Sales", "Finance"], relatedKnowledge: ["Customer expansion synthesis", "Revenue exposure model"], relatedTimeline: ["TL-205 · Revenue opportunity moved to approval"], relatedPolicies: ["Commercial discount policy"], followUp: ["Record cohort outcomes", "Return findings to Director review"], relationships: [{ kind: "Project", label: "Retention experiment", relationship: "governs" }, { kind: "Agent", label: "Revenue advisor", relationship: "observed by" }, { kind: "System", label: "CRM projection", relationship: "references" }] },
  { id: "D-308", title: "Adopt a monthly knowledge publishing cadence", summary: "Define a predictable review cycle for governed enterprise knowledge.", explanation: "The Knowledge Domain recommends a monthly cadence so stale evidence becomes visible before it weakens executive decisions.", category: "Knowledge", priority: "Medium", impact: "Medium", confidence: 82, status: "Deferred", owner: { name: "İpek Çetin", role: "Chief Knowledge Officer", domain: "Knowledge" }, requestedBy: "Knowledge", decisionDate: "Deferred Jul 31", dueDate: "Friday", dateRange: "Due this week", domains: ["Knowledge", "Organization"], directorAttention: false, risk: "Low", expectedImpact: "Improves evidence freshness and makes ownership gaps visible earlier.", risks: ["Review capacity may be uneven across departments"], alternatives: ["Quarterly cadence", "Risk-based cadence", "Department-specific schedules"], evidence: [{ title: "Knowledge freshness audit", source: "Knowledge Domain", trust: "Verified", summary: "Four domains need fresher evidence." }], relatedOrganization: ["Knowledge", "All Departments"], relatedKnowledge: ["Knowledge governance policy v2", "Freshness audit"], relatedTimeline: ["TL-202 · Knowledge freshness audit published"], relatedPolicies: ["Knowledge governance policy"], followUp: ["Compare monthly and risk-based capacity"], relationships: [{ kind: "Knowledge", label: "Freshness audit", relationship: "informed by" }, { kind: "Policy", label: "Publishing cadence", relationship: "would establish" }] },
  { id: "D-307", title: "Confirm interim legal leadership ownership", summary: "Resolve overlapping accountability between Risk & Legal and the Director Office.", explanation: "The Organization Domain identified a leadership coverage gap that is slowing compliance and contract reviews.", category: "Organization", priority: "High", impact: "High", confidence: 79, status: "Waiting Review", owner: { name: "Aslı Yalçın", role: "Chief People Officer", domain: "People" }, requestedBy: "Organization Domain", decisionDate: "Not decided", dueDate: "Thursday", dateRange: "Due this week", domains: ["Organization", "People", "Risk"], directorAttention: true, risk: "High", expectedImpact: "Clarifies accountability and reduces decision latency in legal and compliance work.", risks: ["Interim ownership may become permanent by default", "Capacity remains constrained"], alternatives: ["External interim counsel", "Split legal and compliance ownership", "Delay non-critical contract work"], evidence: [{ title: "Organization responsibility map", source: "Organization Domain", trust: "Verified", summary: "One executive role remains uncovered." }], relatedOrganization: ["Risk & Legal", "Director Office", "People"], relatedKnowledge: ["Organization responsibility map"], relatedTimeline: ["TL-204 · Organization ownership gap recorded"], relatedPolicies: ["Delegated authority policy"], followUp: ["Set a 30-day ownership review", "Open permanent leadership search"], relationships: [{ kind: "Organization", label: "Risk & Legal", relationship: "changes ownership of" }, { kind: "Timeline", label: "TL-204", relationship: "responds to" }] },
  { id: "D-306", title: "Proceed with Q3 market expansion research", summary: "Approve bounded research into two priority enterprise markets.", explanation: "The Director approved a research-only expansion program. It creates knowledge but authorizes no market entry or customer commitment.", category: "Strategy", priority: "Medium", impact: "High", confidence: 91, status: "Approved", owner: { name: "Şenol Sevim", role: "Enterprise Director", domain: "Director Office" }, requestedBy: "Strategy", decisionDate: "Approved Jul 30", dueDate: "No deadline", dateRange: "No deadline", domains: ["Enterprise", "Knowledge", "Sales"], directorAttention: false, risk: "Low", expectedImpact: "Builds market evidence before any investment or entry decision.", risks: ["Research scope could expand without review"], alternatives: ["Research one market", "Use external research only"], evidence: [{ title: "Q3 market opportunity brief", source: "Knowledge Domain", trust: "Reviewed", summary: "Two markets meet the initial evidence threshold." }], relatedOrganization: ["Strategy", "Research"], relatedKnowledge: ["Q3 market opportunity brief"], relatedTimeline: ["TL-201 · Q3 operating brief published"], relatedPolicies: ["Research expenditure policy"], followUp: ["Return findings before any market-entry proposal"], relationships: [{ kind: "Project", label: "Q3 market research", relationship: "authorizes" }, { kind: "Knowledge", label: "Market opportunity brief", relationship: "supported by" }] },
  { id: "D-305", title: "Automate vendor renewal approvals", summary: "Proposal to automatically approve low-value vendor renewals.", explanation: "The proposal was rejected because it delegated Director authority without sufficient policy or evidence boundaries.", category: "Operations", priority: "Low", impact: "Low", confidence: 63, status: "Rejected", owner: { name: "Can Demir", role: "Chief Operating Officer", domain: "Operations" }, requestedBy: "Operations", decisionDate: "Rejected Jul 29", dueDate: "No deadline", dateRange: "No deadline", domains: ["Operations", "Finance"], directorAttention: false, risk: "High", expectedImpact: "Would reduce administrative effort, but the authority risk outweighs the benefit.", risks: ["Unauthorized financial commitments", "Insufficient exception handling"], alternatives: ["Director-reviewed batch approvals", "Reminder-only automation"], evidence: [{ title: "Vendor renewal analysis", source: "Operations", trust: "Incomplete", summary: "The proposal lacks exception and authority evidence." }], relatedOrganization: ["Operations", "Finance"], relatedKnowledge: ["Vendor renewal analysis"], relatedTimeline: ["TL-196 · Automation proposal reviewed"], relatedPolicies: ["Financial authority policy"], followUp: ["Redesign as a non-executing review aid"], relationships: [{ kind: "System", label: "Vendor management", relationship: "would affect" }, { kind: "Policy", label: "Financial authority", relationship: "conflicts with" }] },
];

export const decisionIntelligence: DecisionIntelligenceSignal[] = [
  { type: "Missing evidence", label: "Blocked by evidence", value: "1", detail: "Compliance plan awaits closure evidence", state: "Attention" },
  { type: "Review age", label: "Waiting too long", value: "1", detail: "Legal ownership exceeds the target", state: "Watch" },
  { type: "High risk", label: "High-risk approvals", value: "2", detail: "Compliance and legal ownership", state: "Attention" },
  { type: "Conflict", label: "Conflicting decisions", value: "1", detail: "Launch timing conflicts with evidence readiness", state: "Watch" },
  { type: "Duplicate", label: "Duplicate proposals", value: "0", detail: "No likely duplicates detected", state: "Healthy" },
  { type: "Ownership", label: "Missing ownership", value: "1", detail: "Interim legal accountability", state: "Attention" },
  { type: "Knowledge gap", label: "Missing knowledge", value: "2", detail: "Control closure and leadership capacity", state: "Watch" },
];

export const decisionDomainConnections: DecisionRelationship[] = [
  { kind: "Organization", label: "Accountable owners", relationship: "owns and requests decisions" },
  { kind: "Knowledge", label: "Evidence assets", relationship: "supports confidence" },
  { kind: "Timeline", label: "Enterprise events", relationship: "records context and outcomes" },
  { kind: "Policy", label: "Authority boundaries", relationship: "constrains choices" },
  { kind: "Project", label: "Strategic work", relationship: "is directed by decisions" },
  { kind: "Agent", label: "Advisory signals", relationship: "may inform but never decide" },
  { kind: "System", label: "Enterprise systems", relationship: "provide attributed evidence" },
];

export const hebyDecisionSuggestions = ["Summarize pending decisions", "Explain this recommendation", "Show missing evidence", "Compare alternatives"] as const;
