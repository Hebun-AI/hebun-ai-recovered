export type AgentStatus = "running" | "idle" | "paused" | "error";

export interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  status: AgentStatus;
  version: string;
  tasksToday: number;
  costToday: number; // USD
  lastActive: string;
}

export type WorkflowStatus = "running" | "idle" | "failed" | "scheduled";

export interface Workflow {
  id: string;
  name: string;
  trigger: string;
  ownerAgent: string;
  status: WorkflowStatus;
  successRate: number; // 0–100
  runsToday: number;
  lastRun: string;
}

export type EventSeverity = "info" | "success" | "warning" | "error";

export interface SystemEvent {
  id: string;
  type: string;
  source: string;
  message: string;
  severity: EventSeverity;
  timestamp: string;
}

export type ApprovalRisk = "low" | "medium" | "high" | "critical";

export interface Approval {
  id: string;
  title: string;
  summary: string;
  requestedBy: string;
  type: string;
  risk: ApprovalRisk;
  createdAt: string;
}

export type IntegrationStatus = "connected" | "pending" | "syncing" | "error";

/*
 * ── THERE IS NO `Integration` SHAPE HERE ─────────────────────────────────────
 *
 * One used to exist — id, name, description, status, lastSync, scopes, eventsToday — and it had
 * exactly one implementation anywhere in the repository: the four-element fixture in
 * `features/integrations/mock.ts` that painted the sidebar's connection dots. Deleting the fixture
 * left the shape with no producer and no consumer.
 *
 * It is not kept "for later". A connection already has a real, released shape — `IntegrationView`
 * in `features/integration-authority/contracts.ts` — which carries connection state, health,
 * granted scopes as last OBSERVED, and the verification timestamps this one invented. Leaving a
 * second, simpler shape in the shared type barrel is how a surface ends up modelling a connection
 * without ever touching the authority that owns one.
 *
 * `IntegrationStatus` above survives because `status-badge.tsx` still needs `connected`,
 * `pending` and `syncing` as display vocabulary for other domains. It is presentation vocabulary,
 * not a claim: nothing derives a connection from it.
 */

export interface Department {
  id: string;
  name: string;
  headAgent: string;
  agents: string[];
}

export type TicketStatus =
  | "open"
  | "assigned"
  | "waiting"
  | "resolved"
  | "closed";

export type SlaState = "on-track" | "warning" | "breached";

export interface Ticket {
  id: string;
  subject: string;
  customer: string;
  status: TicketStatus;
  assignee: string;
  sla: SlaState;
  updated: string;
}

export type KnowledgeCategory =
  | "Articles"
  | "Policies"
  | "Product Docs"
  | "Internal Docs";

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: KnowledgeCategory;
  updatedBy: string;
  updated: string;
}

/* ── Finance (v0.5) ─────────────────────────────── */

export type InvoiceStatus =
  | "draft"
  | "review"
  | "approved"
  | "issued"
  | "sent"
  | "paid"
  | "archived";

export interface Invoice {
  id: string;
  customer: string;
  amount: number; // USD
  status: InvoiceStatus;
  issued: string;
  due: string;
}

export type PaymentStatus =
  | "pending"
  | "processing"
  | "verified"
  | "completed"
  | "failed"
  | "refunded";

export interface Payment {
  id: string;
  counterparty: string;
  amount: number; // USD
  method: string;
  status: PaymentStatus;
  updated: string;
}

export interface Budget {
  id: string;
  department: string;
  total: number; // USD
  used: number; // USD
  forecastExhaustion: string;
}

export type ExpenseApproval = "approved" | "pending" | "rejected";

export interface Expense {
  id: string;
  vendor: string;
  category: string;
  department: string;
  amount: number; // USD
  approval: ExpenseApproval;
  budgetImpact: string;
  date: string;
}

export type FinanceAlertKind =
  | "cash-flow"
  | "budget"
  | "payment"
  | "tax"
  | "cost-anomaly";

export interface FinanceAlert {
  id: string;
  kind: FinanceAlertKind;
  title: string;
  detail: string;
  severity: EventSeverity;
  timestamp: string;
}

/* ── HR (v0.6) ──────────────────────────────────── */

export type JobStatus = "open" | "screening" | "interviewing" | "offer" | "filled";

export interface Job {
  id: string;
  title: string;
  department: string;
  status: JobStatus;
  candidates: number;
  posted: string;
}

export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export interface Candidate {
  id: string;
  name: string;
  role: string;
  stage: CandidateStage;
  technicalMatch: number; // 0–100
  experienceMatch: number; // 0–100
  domainMatch: number; // 0–100
  source: string;
}

export type InterviewStatus = "scheduled" | "completed" | "feedback-pending" | "cancelled";

export interface Interview {
  id: string;
  candidate: string;
  role: string;
  interviewer: string;
  when: string;
  status: InterviewStatus;
}

export type OnboardingStage =
  | "access"
  | "equipment"
  | "training"
  | "mentor"
  | "complete";

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  onboardingStage: OnboardingStage;
  onboardingProgress: number; // 0–100
  startDate: string;
}

export type ReviewStatus = "due" | "in-progress" | "completed";

export interface PerformanceReview {
  id: string;
  employee: string;
  reviewer: string;
  goalCompletion: number; // 0–100
  status: ReviewStatus;
  cycle: string;
}

export interface LearningPath {
  id: string;
  name: string;
  assignee: string;
  progress: number; // 0–100
  certification: string;
  skillGap: string;
}

export type HrTicketStatus = "open" | "in-progress" | "resolved";

export interface HrTicket {
  id: string;
  employee: string;
  topic: string;
  status: HrTicketStatus;
  sla: SlaState;
  updated: string;
}

export type OffboardingStep =
  | "access-revocation"
  | "asset-return"
  | "knowledge-transfer"
  | "exit-interview"
  | "complete";

export interface Offboarding {
  id: string;
  employee: string;
  role: string;
  step: OffboardingStep;
  progress: number; // 0–100
  lastDay: string;
}

/* ── Legal (v0.7) ───────────────────────────────── */

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ContractStatus =
  | "draft"
  | "review"
  | "approved"
  | "signed"
  | "rejected";

export interface Contract {
  id: string;
  title: string;
  counterparty: string;
  type: string;
  status: ContractStatus;
  risk: RiskLevel;
  value: number; // USD
  updated: string;
}

export interface Clause {
  id: string;
  name: string;
  coverage: number; // 0–100 across contract set
  status: "present" | "missing" | "review";
}

export type ViolationStatus = "open" | "remediating" | "resolved";

export interface ComplianceViolation {
  id: string;
  rule: string;
  area: string;
  severity: RiskLevel;
  status: ViolationStatus;
  detected: string;
}

export interface Risk {
  id: string;
  category: string;
  title: string;
  level: RiskLevel;
  status: "detected" | "mitigating" | "accepted" | "escalated";
  owner: string;
}

export type PolicyStatus =
  | "active"
  | "draft"
  | "pending-approval"
  | "deprecated";

export interface Policy {
  id: string;
  name: string;
  version: string;
  status: PolicyStatus;
  owner: string;
  updated: string;
}

export type RegulationImpact = "low" | "medium" | "high";

export interface Regulation {
  id: string;
  name: string;
  region: string;
  impact: RegulationImpact;
  action: string;
  updated: string;
}

export type IpStatus =
  | "registered"
  | "pending"
  | "expiring"
  | "active"
  | "filed"
  | "approved";

export interface IpAsset {
  id: string;
  name: string;
  kind: "trademark" | "domain" | "patent" | "license";
  status: IpStatus;
  detail: string;
}
