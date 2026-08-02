export type OrganizationHealth = "Healthy" | "Watch" | "Attention";

export interface OrganizationMetric {
  label: string;
  value: string;
  detail: string;
  state: OrganizationHealth;
}

export interface OrganizationTeam {
  name: string;
  lead: string;
  responsibility: string;
}

export interface OrganizationDepartment {
  name: string;
  executive: string;
  purpose: string;
  headcount: number;
  health: OrganizationHealth;
  attention: string;
  teams: OrganizationTeam[];
}

export interface OrganizationRole {
  title: string;
  owner: string;
  scope: string;
  accountabilities: string[];
  coverage: "Clear" | "Shared" | "Gap";
}

export interface BusinessUnit {
  name: string;
  leader: string;
  mandate: string;
  departments: string[];
  readiness: number;
}

export interface ReportingLevel {
  level: string;
  members: string[];
  purpose: string;
}

export interface ResponsibilityOverlap {
  responsibility: string;
  owners: string[];
  impact: string;
  status: "Clarify" | "Coordinated";
}

export interface EnterpriseRelationship {
  source: string;
  relationship: string;
  target: string;
  context: string;
  strength: "Strong" | "Developing" | "At Risk";
}

export const organizationMetrics: OrganizationMetric[] = [
  { label: "Enterprise Structure", value: "Established", detail: "Three business units · six departments", state: "Healthy" },
  { label: "Ownership Clarity", value: "88%", detail: "Two responsibilities require clarification", state: "Watch" },
  { label: "Leadership Coverage", value: "11 / 12", detail: "Legal leadership capacity remains open", state: "Attention" },
  { label: "Cross-Domain Alignment", value: "84%", detail: "Sales and Operations handoff needs review", state: "Watch" },
  { label: "Organization Readiness", value: "86%", detail: "Enterprise launch dependency remains visible", state: "Healthy" },
];

export const organizationDepartments: OrganizationDepartment[] = [
  { name: "Finance", executive: "Elif Kaya · CFO", purpose: "Protect enterprise resources and investment confidence.", headcount: 12, health: "Healthy", attention: "Runway assumptions due for review", teams: [{ name: "Financial Planning", lead: "Mert Aydın", responsibility: "Forecasting and capital planning" }, { name: "Accounting", lead: "Derya Aksoy", responsibility: "Controls and financial record" }] },
  { name: "Operations", executive: "Can Demir · COO", purpose: "Coordinate reliable enterprise delivery.", headcount: 28, health: "Watch", attention: "Launch dependency on critical path", teams: [{ name: "Enterprise Delivery", lead: "Selin Aras", responsibility: "Cross-functional delivery" }, { name: "Business Operations", lead: "Burak Koç", responsibility: "Operating cadence and controls" }] },
  { name: "Sales", executive: "Leyla Şahin · CRO", purpose: "Create durable customer and revenue growth.", headcount: 21, health: "Healthy", attention: "$420K ARR opportunity awaiting decision", teams: [{ name: "Enterprise Sales", lead: "Eren Yılmaz", responsibility: "Strategic accounts" }, { name: "Revenue Operations", lead: "Cemre Uslu", responsibility: "Pipeline integrity and handoffs" }] },
  { name: "People", executive: "Aslı Yalçın · CPO", purpose: "Build organizational capability and leadership depth.", headcount: 9, health: "Watch", attention: "One critical leadership role uncovered", teams: [{ name: "People Experience", lead: "Naz Erdem", responsibility: "Employee lifecycle" }, { name: "Talent & Capability", lead: "Ozan Tunç", responsibility: "Hiring and organizational development" }] },
  { name: "Knowledge", executive: "İpek Çetin · CKO", purpose: "Preserve and strengthen enterprise intelligence.", headcount: 8, health: "Watch", attention: "Four domains need fresher evidence", teams: [{ name: "Enterprise Knowledge", lead: "Ada Kılıç", responsibility: "Knowledge quality and provenance" }, { name: "Research", lead: "Kerem Ekin", responsibility: "External and industry intelligence" }] },
  { name: "Risk & Legal", executive: "Interim · Director Office", purpose: "Protect enterprise trust, obligations, and decisions.", headcount: 6, health: "Attention", attention: "SOC 2 evidence gap and leadership capacity", teams: [{ name: "Compliance", lead: "Deniz Işık", responsibility: "Control evidence and readiness" }, { name: "Legal Operations", lead: "Interim", responsibility: "Contracts and legal coordination" }] },
];

export const organizationRoles: OrganizationRole[] = [
  { title: "Enterprise Director", owner: "Şenol Sevim", scope: "Enterprise direction and final accountable authority", accountabilities: ["Strategic direction", "Enterprise approvals", "Executive alignment"], coverage: "Clear" },
  { title: "Chief Operating Officer", owner: "Can Demir", scope: "Operating system and cross-functional delivery", accountabilities: ["Enterprise delivery", "Operating cadence", "Dependency resolution"], coverage: "Clear" },
  { title: "Chief Revenue Officer", owner: "Leyla Şahin", scope: "Revenue strategy and customer growth", accountabilities: ["Revenue performance", "Enterprise pipeline", "Customer expansion"], coverage: "Clear" },
  { title: "Compliance Executive", owner: "Director Office · Interim", scope: "Enterprise compliance and control readiness", accountabilities: ["Compliance posture", "Evidence ownership", "Regulatory coordination"], coverage: "Gap" },
  { title: "Enterprise Launch Owner", owner: "Operations + Sales", scope: "Cross-domain enterprise launch readiness", accountabilities: ["Launch dependencies", "Customer readiness", "Go-live coordination"], coverage: "Shared" },
];

export const businessUnits: BusinessUnit[] = [
  { name: "Enterprise Growth", leader: "Leyla Şahin", mandate: "Customer value, commercial growth, and market learning.", departments: ["Sales", "Knowledge"], readiness: 91 },
  { name: "Enterprise Operations", leader: "Can Demir", mandate: "Reliable delivery, organizational coordination, and scale.", departments: ["Operations", "People"], readiness: 84 },
  { name: "Enterprise Stewardship", leader: "Şenol Sevim · Interim", mandate: "Resources, trust, governance, and enterprise continuity.", departments: ["Finance", "Risk & Legal"], readiness: 78 },
];

export const reportingStructure: ReportingLevel[] = [
  { level: "Enterprise Direction", members: ["Enterprise Director"], purpose: "Final authority and enterprise direction" },
  { level: "Executive Leadership", members: ["CFO", "COO", "CRO", "CPO", "CKO"], purpose: "Domain accountability and enterprise alignment" },
  { level: "Department Leadership", members: ["12 department and team leads"], purpose: "Functional ownership and coordinated delivery" },
  { level: "Enterprise Teams", members: ["84 people across 12 teams"], purpose: "Specialist execution and organizational learning" },
];

export const responsibilityOverlaps: ResponsibilityOverlap[] = [
  { responsibility: "Enterprise launch readiness", owners: ["Operations", "Sales"], impact: "Decision latency when customer and delivery readiness diverge.", status: "Clarify" },
  { responsibility: "Compliance evidence quality", owners: ["Risk & Legal", "Knowledge"], impact: "Shared evidence standards are defined; final ownership remains interim.", status: "Clarify" },
  { responsibility: "Workforce investment planning", owners: ["People", "Finance"], impact: "Quarterly planning cadence coordinates demand and runway.", status: "Coordinated" },
];

export const enterpriseRelationships: EnterpriseRelationship[] = [
  { source: "Sales", relationship: "commits customer outcomes to", target: "Operations", context: "Enterprise launch and delivery handoff", strength: "Developing" },
  { source: "Knowledge", relationship: "provides evidence to", target: "Risk & Legal", context: "Compliance and decision provenance", strength: "At Risk" },
  { source: "Finance", relationship: "sets investment boundaries for", target: "People", context: "Hiring and capability planning", strength: "Strong" },
  { source: "People", relationship: "develops leadership capacity for", target: "All Departments", context: "Succession and organizational readiness", strength: "Developing" },
  { source: "Director Office", relationship: "aligns priorities across", target: "Business Units", context: "Enterprise direction and accountable review", strength: "Strong" },
];
