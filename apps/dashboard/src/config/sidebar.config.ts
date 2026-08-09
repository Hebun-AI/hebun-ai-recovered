/*
 * sidebar.config.ts — the living architecture map of Hebun AI.
 *
 * The sidebar, its navigation, and every placeholder page are generated
 * from this file. Adding a module learned in the AI Systems Architect
 * Program = adding one entry here. Nothing else.
 */

import {
  LayoutDashboard,
  Terminal,
  Network,
  Inbox,
  TrendingUp,
  CheckCircle2,
  Cpu,
  Users,
  Layers,
  Shield,
  LayoutGrid,
  Brain,
  Zap,
  Lightbulb,
  Boxes,
  Grid3x3,
  Route,
  PlugZap,
  ShieldAlert,
  Workflow,
  Waypoints,
  Gauge,
  HeartPulse,
  Siren,
  Sparkles,
  Activity,
  Clock,
  Search,
  GraduationCap,
  Fingerprint,
  Store,
  Plug,
  Mail,
  GitBranch,
  Database,
  Share2,
  Triangle,
  Power,
  LifeBuoy,
  Ticket,
  BookOpen,
  Landmark,
  Wallet,
  Receipt,
  CreditCard,
  PiggyBank,
  Banknote,
  PieChart,
  Scale,
  IdCard,
  UserCog,
  UserPlus,
  UserSearch,
  CalendarClock,
  Rocket,
  Target,
  Headset,
  UserMinus,
  Gavel,
  FileSignature,
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  FileText,
  ClipboardList,
  ListTodo,
  Radar,
  Copyright,
  ScrollText,
  Globe,
  MessagesSquare,
  BrainCircuit,
  type LucideIcon,
} from "lucide-react";
import { approvals } from "@/features/approvals/mock";
import { integrations } from "@/features/integrations/mock";
import type { IntegrationStatus } from "@/types";

export type SidebarBadge =
  | { type: "count"; value: number }
  | { type: "status"; value: IntegrationStatus }
  | { type: "tag"; value: string };

export interface SidebarItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  badge?: SidebarBadge;
  /** links a module page to a mock agent card */
  agentId?: string;
  description?: string;
}

/** optional labeled subgroup inside a section (e.g. departments) */
export interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

export interface SidebarSection {
  id: string;
  label: string;
  icon: LucideIcon;
  /** section exists in the architecture but is not built yet */
  placeholder?: boolean;
  description?: string;
  groups: SidebarGroup[];
}

function integrationStatus(id: string): IntegrationStatus {
  return integrations.find((i) => i.id === id)?.status ?? "pending";
}

export const sidebarConfig: SidebarSection[] = [
  {
    id: "director",
    label: "Director",
    icon: LayoutDashboard,
    description: "The CEO layer — the executive operating console.",
    groups: [
      // ── Observe: the daily executive cockpit ──────────────────────
      {
        label: "Command Center",
        items: [
          { label: "Executive Overview", href: "/director", icon: Gauge },
          { label: "Director Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { label: "Strategic Goals", href: "/director/goals", icon: Target },
          { label: "Organization Health", href: "/director/organization-health", icon: HeartPulse },
          { label: "Critical Alerts", href: "/director/alerts", icon: Siren },
          { label: "Executive Insights", href: "/director/insights", icon: Sparkles },
          { label: "AI Recommendations", href: "/director/recommendations", icon: Lightbulb },
          { label: "Executive Reports", href: "/director/reports", icon: FileText },
        ],
      },
      // ── Monitor: running work ─────────────────────────────────────
      {
        label: "Execution",
        items: [
          { label: "Execution Center", href: "/director/execution-center", icon: Activity },
          { label: "Active Executions", href: "/director/executions", icon: Activity },
          { label: "Execution Timeline", href: "/director/execution-center/timeline", icon: Clock },
          { label: "Execution Graphs", href: "/director/execution-center/graphs", icon: Waypoints },
          { label: "Execution Failures", href: "/director/execution-center/failures", icon: AlertTriangle },
        ],
      },
      // ── Understand & Learn: organizational intelligence ───────────
      {
        label: "Intelligence",
        items: [
          { label: "Intelligence Center", href: "/director/intelligence", icon: Brain },
          { label: "Pattern Discovery", href: "/director/intelligence/patterns", icon: Search },
          { label: "Organization Intelligence", href: "/director/intelligence/organization-health", icon: HeartPulse },
          { label: "Learning Center", href: "/director/intelligence/learning", icon: GraduationCap },
        ],
      },
      // ── Knowledge & data foundation ───────────────────────────────
      {
        label: "Knowledge & Data",
        items: [
          { label: "Registry Center", href: "/director/registries", icon: Database },
          { label: "Knowledge Graph", href: "/director/knowledge-graph", icon: Share2 },
          { label: "Company Memory", href: "/director/memory", icon: BookOpen },
        ],
      },
      // ── The deterministic cognitive → control pipeline ────────────
      {
        label: "Cognitive & Control Chain",
        items: [
          { label: "Reasoning Engine", href: "/director/reasoning", icon: Zap },
          { label: "Policy & Governance", href: "/director/policy", icon: Shield },
          { label: "Planning Engine", href: "/director/planning", icon: ClipboardList },
          { label: "Task Planning", href: "/director/task-planning", icon: ListTodo },
          { label: "Orchestration Engine", href: "/director/orchestration", icon: Network },
          { label: "Execution Engine", href: "/director/execution", icon: Activity },
          { label: "Adapter SDK", href: "/director/adapters", icon: Boxes },
        ],
      },
      // ── Execute: provider infrastructure ──────────────────────────
      {
        label: "Providers & Runtime",
        items: [
          { label: "Provider Framework", href: "/director/provider-framework", icon: Layers },
          { label: "Provider Matrix", href: "/director/provider-matrix", icon: Grid3x3 },
          { label: "Provider Routing", href: "/director/provider-routing", icon: Route },
          { label: "Provider Invocation", href: "/director/provider-invocation", icon: PlugZap },
          { label: "Runtime Boundary", href: "/director/runtime", icon: ShieldAlert },
          { label: "Runtime Activation", href: "/director/runtime-activation", icon: Power },
          { label: "Offline Execution", href: "/director/offline-execution", icon: Workflow },
          { label: "Claude Provider", href: "/director/providers/claude", icon: Brain },
          { label: "Claude Live", href: "/director/providers/claude-live", icon: BrainCircuit },
          { label: "Codex Provider", href: "/director/providers/codex", icon: Brain },
          { label: "GitHub Provider", href: "/director/providers/github", icon: GitBranch },
          { label: "Browser Provider", href: "/director/providers/browser", icon: Globe },
          { label: "Computer Use Provider", href: "/director/providers/computer-use", icon: Cpu },
          { label: "Communication Provider", href: "/director/providers/communication", icon: MessagesSquare },
        ],
      },
      // ── Approve & Control: governance ─────────────────────────────
      {
        label: "Governance",
        items: [
          { label: "Governance Center", href: "/director/governance", icon: Shield },
          { label: "Approval Center", href: "/director/governance/approvals", icon: CheckCircle2 },
          { label: "Policy Center", href: "/director/governance/policies", icon: FileText },
          { label: "Compliance Center", href: "/director/governance/compliance", icon: ShieldCheck },
          { label: "Risk Center", href: "/director/governance/risk", icon: AlertTriangle },
          { label: "Permission Center", href: "/director/governance/permissions", icon: Fingerprint },
          { label: "Audit Center", href: "/director/governance/audit", icon: Radar },
          { label: "Explainability Center", href: "/director/governance/explainability", icon: BookOpen },
        ],
      },
      // ── Registries: master data objects ───────────────────────────
      {
        label: "Registries",
        items: [
          { label: "Agent Registry", href: "/director/registries/agents", icon: Users },
          { label: "Goal Registry", href: "/director/registries/goals", icon: Target },
          { label: "Plan Registry", href: "/director/registries/plans", icon: LayoutGrid },
          { label: "Execution Registry", href: "/director/registries/executions", icon: Activity },
          { label: "Experience Registry", href: "/director/registries/experience", icon: BookOpen },
          { label: "Learning Registry", href: "/director/registries/learning", icon: GraduationCap },
          { label: "Tool Registry", href: "/director/registries/tools", icon: Boxes },
          { label: "Model Registry", href: "/director/registries/models", icon: Cpu },
          { label: "Capability Registry", href: "/director/registries/capabilities", icon: Sparkles },
          { label: "Event Registry", href: "/director/registries/events", icon: Radar },
          { label: "Workflow Registry", href: "/director/registries/workflows", icon: GitBranch },
          { label: "Memory Registry", href: "/director/registries/memory", icon: BookOpen },
          { label: "Business Entity Registry", href: "/director/registries/entities", icon: Landmark },
          { label: "Governance Registry", href: "/director/registries/governance", icon: ShieldCheck },
          { label: "Risk Registry", href: "/director/registries/risk", icon: ScrollText },
        ],
      },
      // ── Director workspace ────────────────────────────────────────
      {
        label: "Workspace",
        items: [
          { label: "Command Console", href: "/director/command-center", icon: Terminal },
          { label: "Live Organization", href: "/director/organization", icon: Network },
          { label: "Director Inbox", href: "/director/inbox", icon: Inbox },
          { label: "Weekly Insights", href: "/director/weekly-insights", icon: TrendingUp },
          {
            label: "Approvals",
            href: "/approvals",
            icon: CheckCircle2,
            badge: { type: "count", value: approvals.length },
          },
        ],
      },
    ],
  },
  {
    id: "architecture",
    label: "Architecture & Orchestration",
    icon: Cpu,
    description: "The visual control layer for the Hebun AI Operating System v1.0.",
    groups: [
      {
        label: "AI Operating System",
        items: [
          { label: "Overview", href: "/architecture", icon: LayoutGrid },
          { label: "Cognitive Core", href: "/architecture/cognitive-core", icon: Brain },
          { label: "Execution Core", href: "/architecture/execution-core", icon: Zap },
          { label: "Intelligence Core", href: "/architecture/intelligence-core", icon: Lightbulb },
          { label: "Governance Core", href: "/architecture/governance-core", icon: ShieldCheck },
          { label: "Engines", href: "/architecture/engines", icon: Boxes },
          { label: "Registries", href: "/architecture/registries", icon: Database },
          { label: "System Flow", href: "/architecture/system-flow", icon: Waypoints },
        ],
      },
      {
        label: "Runtime",
        items: [
          { label: "Director", href: "/architecture/director" },
          { label: "Planner", href: "/architecture/planner" },
          { label: "Orchestrator", href: "/architecture/orchestrator" },
          { label: "Workflow Engine", href: "/workflows" },
          { label: "Event Bus", href: "/events" },
          { label: "State Management", href: "/architecture/state-management" },
          { label: "Memory Service", href: "/architecture/memory-service" },
          { label: "Agent Runtime", href: "/architecture/agent-runtime" },
          { label: "Lifecycle Manager", href: "/architecture/lifecycle-manager" },
          { label: "Context Engine", href: "/architecture/context-engine" },
        ],
      },
    ],
  },
  {
    id: "workforce",
    label: "AI Workforce",
    icon: Users,
    description: "Digital employees, organized by department.",
    groups: [
      {
        label: "Sales Department",
        items: [
          {
            label: "Lead Qualifier Agent",
            href: "/workforce/sales/lead-qualifier-agent",
            agentId: "agent-lead-qualifier",
          },
          {
            label: "Sales Agent",
            href: "/workforce/sales/sales-agent",
            agentId: "agent-sales",
          },
          {
            label: "Proposal Agent",
            href: "/workforce/sales/proposal-agent",
            agentId: "agent-proposal",
          },
          {
            label: "Negotiation Agent",
            href: "/workforce/sales/negotiation-agent",
            agentId: "agent-negotiation",
          },
          {
            label: "Customer Success Agent",
            href: "/workforce/sales/customer-success-agent",
            agentId: "agent-customer-success",
          },
          {
            label: "Renewal Agent",
            href: "/workforce/sales/renewal-agent",
            agentId: "agent-renewal",
          },
        ],
      },
      {
        label: "Operations Department",
        items: [
          {
            label: "Support Agent",
            href: "/workforce/operations/support-agent",
            agentId: "agent-support",
          },
          {
            label: "Ticket Management Agent",
            href: "/workforce/operations/ticket-management-agent",
            agentId: "agent-ticket-management",
          },
          {
            label: "Knowledge Base Agent",
            href: "/workforce/operations/knowledge-base-agent",
            agentId: "agent-knowledge-base",
          },
        ],
      },
      {
        label: "Finance Department",
        items: [
          { label: "Finance Agent", href: "/workforce/finance/finance-agent", agentId: "agent-finance" },
          { label: "Invoice Agent", href: "/workforce/finance/invoice-agent", agentId: "agent-invoice" },
          { label: "Payment Agent", href: "/workforce/finance/payment-agent", agentId: "agent-payment" },
          { label: "Budget Agent", href: "/workforce/finance/budget-agent", agentId: "agent-budget" },
          { label: "Expense Agent", href: "/workforce/finance/expense-agent", agentId: "agent-expense" },
          { label: "Cash Flow Agent", href: "/workforce/finance/cash-flow-agent", agentId: "agent-cash-flow" },
          {
            label: "Financial Analytics Agent",
            href: "/workforce/finance/financial-analytics-agent",
            agentId: "agent-financial-analytics",
          },
          { label: "Tax Agent", href: "/workforce/finance/tax-agent", agentId: "agent-tax" },
        ],
      },
      {
        label: "HR Department",
        items: [
          { label: "HR Agent", href: "/workforce/hr/hr-agent", agentId: "agent-hr" },
          { label: "Recruiting Agent", href: "/workforce/hr/recruiting-agent", agentId: "agent-recruiting" },
          {
            label: "Candidate Screening Agent",
            href: "/workforce/hr/candidate-screening-agent",
            agentId: "agent-candidate-screening",
          },
          {
            label: "Interview Scheduling Agent",
            href: "/workforce/hr/interview-scheduling-agent",
            agentId: "agent-interview-scheduling",
          },
          { label: "Onboarding Agent", href: "/workforce/hr/onboarding-agent", agentId: "agent-onboarding" },
          {
            label: "Performance Review Agent",
            href: "/workforce/hr/performance-review-agent",
            agentId: "agent-performance-review",
          },
          {
            label: "Learning & Development Agent",
            href: "/workforce/hr/learning-development-agent",
            agentId: "agent-learning-development",
          },
          {
            label: "Employee Support Agent",
            href: "/workforce/hr/employee-support-agent",
            agentId: "agent-employee-support",
          },
          { label: "Offboarding Agent", href: "/workforce/hr/offboarding-agent", agentId: "agent-offboarding" },
        ],
      },
      {
        label: "Legal Department",
        items: [
          { label: "Legal Agent", href: "/workforce/legal/legal-agent", agentId: "agent-legal" },
          {
            label: "Contract Review Agent",
            href: "/workforce/legal/contract-review-agent",
            agentId: "agent-contract-review",
          },
          {
            label: "Contract Generation Agent",
            href: "/workforce/legal/contract-generation-agent",
            agentId: "agent-contract-generation",
          },
          { label: "Compliance Agent", href: "/workforce/legal/compliance-agent", agentId: "agent-compliance" },
          {
            label: "Risk Assessment Agent",
            href: "/workforce/legal/risk-assessment-agent",
            agentId: "agent-risk-assessment",
          },
          {
            label: "Policy Management Agent",
            href: "/workforce/legal/policy-management-agent",
            agentId: "agent-policy-management",
          },
          {
            label: "Regulatory Monitoring Agent",
            href: "/workforce/legal/regulatory-monitoring-agent",
            agentId: "agent-regulatory-monitoring",
          },
          {
            label: "IP & Trademark Agent",
            href: "/workforce/legal/ip-trademark-agent",
            agentId: "agent-ip-trademark",
          },
        ],
      },
      {
        label: "Research Department",
        items: [
          {
            label: "Research Agent",
            href: "/workforce/research/research-agent",
            agentId: "agent-research",
          },
          { label: "Research Hub", href: "/workforce/research/research-hub" },
        ],
      },
      {
        label: "Quality Department",
        items: [
          { label: "Critic Agent", href: "/workforce/quality/critic-agent" },
          { label: "Reflection Agent", href: "/workforce/quality/reflection-agent" },
        ],
      },
    ],
  },
  {
    id: "customer-ops",
    label: "Customer Operations",
    icon: LifeBuoy,
    description: "Tickets, SLAs, and the knowledge that answers them.",
    groups: [
      {
        items: [
          { label: "Ticket Center", href: "/tickets", icon: Ticket },
          { label: "Knowledge Base Center", href: "/knowledge", icon: BookOpen },
        ],
      },
    ],
  },
  {
    id: "finance",
    label: "Finance Center",
    icon: Landmark,
    description: "Invoices, payments, budgets, cash flow, and tax — the money layer.",
    groups: [
      {
        items: [
          { label: "Finance Overview", href: "/finance", icon: Wallet },
          { label: "Invoice Center", href: "/finance/invoices", icon: Receipt },
          { label: "Payment Center", href: "/finance/payments", icon: CreditCard },
          { label: "Budget Center", href: "/finance/budgets", icon: PiggyBank },
          { label: "Expense Center", href: "/finance/expenses", icon: Banknote },
          { label: "Cash Flow Center", href: "/finance/cash-flow", icon: TrendingUp },
          { label: "Financial Analytics", href: "/finance/analytics", icon: PieChart },
          { label: "Tax & Compliance", href: "/finance/tax-compliance", icon: Scale },
        ],
      },
    ],
  },
  {
    id: "hr",
    label: "HR Center",
    icon: IdCard,
    description: "Recruiting, interviews, onboarding, performance, and people ops.",
    groups: [
      {
        items: [
          { label: "HR Overview", href: "/hr", icon: UserCog },
          { label: "Recruiting Center", href: "/hr/recruiting", icon: UserPlus },
          { label: "Candidate Screening", href: "/hr/candidate-screening", icon: UserSearch },
          { label: "Interview Center", href: "/hr/interviews", icon: CalendarClock },
          { label: "Onboarding Center", href: "/hr/onboarding", icon: Rocket },
          { label: "Performance Center", href: "/hr/performance", icon: Target },
          { label: "Learning Center", href: "/hr/learning", icon: GraduationCap },
          { label: "Employee Support", href: "/hr/employee-support", icon: Headset },
          { label: "Offboarding Center", href: "/hr/offboarding", icon: UserMinus },
        ],
      },
    ],
  },
  {
    id: "legal",
    label: "Legal Center",
    icon: Gavel,
    description: "Contracts, compliance, risk, policy, regulation, and IP.",
    groups: [
      {
        items: [
          { label: "Legal Overview", href: "/legal", icon: Gavel },
          { label: "Contract Center", href: "/legal/contracts", icon: FileSignature },
          { label: "Contract Review", href: "/legal/contract-review", icon: FileCheck },
          { label: "Contract Generation", href: "/legal/contract-generation", icon: FileText },
          { label: "Compliance Center", href: "/legal/compliance", icon: ShieldCheck },
          { label: "Risk Center", href: "/legal/risk", icon: AlertTriangle },
          { label: "Policy Center", href: "/legal/policies", icon: Scale },
          { label: "Regulatory Monitoring", href: "/legal/regulatory", icon: Radar },
          { label: "IP & Trademark", href: "/legal/ip-trademark", icon: Copyright },
        ],
      },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: Layers,
    description: "The plumbing — tools, models, auth, and observability.",
    groups: [
      {
        items: [
          { label: "Tool Layer", href: "/infrastructure/tool-layer" },
          { label: "MCP Servers", href: "/infrastructure/mcp-servers" },
          { label: "External APIs", href: "/infrastructure/external-apis" },
          { label: "Computer Use", href: "/infrastructure/computer-use" },
          { label: "Model Router", href: "/infrastructure/model-router" },
          { label: "Authentication", href: "/infrastructure/authentication" },
          { label: "Authorization", href: "/infrastructure/authorization" },
          { label: "Observability", href: "/infrastructure/observability" },
          { label: "Cost Engine", href: "/infrastructure/cost-engine" },
          { label: "Storage", href: "/infrastructure/storage" },
        ],
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: Shield,
    placeholder: true,
    description: "Policies, permissions, and human oversight. Not built yet.",
    groups: [
      {
        items: [
          { label: "Human Approval", href: "/governance/human-approval" },
          { label: "Approval Center", href: "/approvals" },
          { label: "Policy Engine", href: "/governance/policy-engine" },
          { label: "Agent Governance", href: "/governance/agent-governance" },
          { label: "Permission Management", href: "/governance/permission-management" },
          { label: "Audit Logs", href: "/governance/audit-logs" },
        ],
      },
    ],
  },
  {
    id: "learning",
    label: "Learning",
    icon: GraduationCap,
    description: "How the organization gets smarter over time.",
    groups: [
      {
        items: [
          { label: "Learning Engine", href: "/learning/learning-engine" },
          { label: "Reflection Service", href: "/learning/reflection-service" },
          { label: "Insight Engine", href: "/learning/insight-engine" },
          { label: "Organizational Learning", href: "/learning/organizational-learning" },
          { label: "Weekly Reports", href: "/learning/weekly-reports" },
        ],
      },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    icon: Store,
    placeholder: true,
    description: "Installable departments, employees, and packs. Not built yet.",
    groups: [
      {
        items: [
          { label: "Digital Departments", href: "/marketplace/digital-departments" },
          { label: "AI Employees", href: "/marketplace/ai-employees" },
          { label: "Workflow Packs", href: "/marketplace/workflow-packs" },
          { label: "Templates", href: "/marketplace/templates" },
          { label: "Connectors", href: "/marketplace/connectors" },
        ],
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    description: "External services wired into the event bus.",
    groups: [
      {
        items: [
          { label: "Overview", href: "/integrations", icon: Plug },
          {
            label: "Gmail",
            href: "/integrations/gmail",
            icon: Mail,
            badge: { type: "status", value: integrationStatus("gmail") },
          },
          {
            label: "GitHub",
            href: "/integrations/github",
            icon: GitBranch,
            badge: { type: "status", value: integrationStatus("github") },
          },
          {
            label: "Supabase",
            href: "/integrations/supabase",
            icon: Database,
            badge: { type: "status", value: integrationStatus("supabase") },
          },
          {
            label: "Vercel",
            href: "/integrations/vercel",
            icon: Triangle,
            badge: { type: "status", value: integrationStatus("vercel") },
          },
        ],
      },
    ],
  },
];

/* ── Lookup helpers (used by the catch-all module page) ─────────── */

export interface ResolvedModule {
  section: SidebarSection;
  group: SidebarGroup;
  item: SidebarItem;
}

const moduleIndex = new Map<string, ResolvedModule>();
for (const section of sidebarConfig) {
  for (const group of section.groups) {
    for (const item of group.items) {
      if (!moduleIndex.has(item.href)) {
        moduleIndex.set(item.href, { section, group, item });
      }
    }
  }
}

export function resolveModulePath(path: string): ResolvedModule | undefined {
  return moduleIndex.get(path);
}

/** routes that have a real page — everything else falls to the placeholder */
export const staticRoutes = new Set([
  "/dashboard",
  "/director",
  "/director/goals",
  "/director/memory",
  "/director/knowledge-graph",
  "/director/organization-health",
  "/director/executions",
  "/director/insights",
  "/director/recommendations",
  "/director/alerts",
  "/director/reports",
  "/director/organization",
  "/director/execution-center",
  "/director/execution-center/graphs",
  "/director/execution-center/failures",
  "/director/execution-center/timeline",
  "/director/runtime-signals",
  "/director/execution-substrate",
  "/director/intelligence",
  "/director/intelligence/patterns",
  "/director/intelligence/recommendations",
  "/director/intelligence/organization-health",
  "/director/intelligence/learning",
  "/director/intelligence/insights",
  "/director/adapters",
  "/director/provider-framework",
  "/director/provider-matrix",
  "/director/provider-routing",
  "/director/provider-invocation",
  "/director/runtime",
  "/director/offline-execution",
  "/director/governance",
  "/director/governance/approvals",
  "/director/governance/policies",
  "/director/governance/compliance",
  "/director/governance/audit",
  "/director/governance/permissions",
  "/director/governance/explainability",
  "/director/governance/risk",
  "/director/registries",
  "/director/registries/agents",
  "/director/registries/goals",
  "/director/registries/plans",
  "/director/registries/executions",
  "/director/registries/experience",
  "/director/registries/learning",
  "/director/registries/tools",
  "/director/registries/models",
  "/director/registries/capabilities",
  "/director/registries/events",
  "/director/registries/workflows",
  "/director/registries/entities",
  "/director/registries/governance",
  "/director/registries/risk",
  "/architecture",
  "/architecture/cognitive-core",
  "/architecture/execution-core",
  "/architecture/intelligence-core",
  "/architecture/governance-core",
  "/architecture/engines",
  "/architecture/registries",
  "/architecture/system-flow",
  "/agents",
  "/workflows",
  "/events",
  "/approvals",
  "/integrations",
  "/settings",
  "/tickets",
  "/knowledge",
  "/finance",
  "/finance/invoices",
  "/finance/payments",
  "/finance/budgets",
  "/finance/expenses",
  "/finance/cash-flow",
  "/finance/analytics",
  "/finance/tax-compliance",
  "/hr",
  "/hr/recruiting",
  "/hr/candidate-screening",
  "/hr/interviews",
  "/hr/onboarding",
  "/hr/performance",
  "/hr/learning",
  "/hr/employee-support",
  "/hr/offboarding",
  "/legal",
  "/legal/contracts",
  "/legal/contract-review",
  "/legal/contract-generation",
  "/legal/compliance",
  "/legal/risk",
  "/legal/policies",
  "/legal/regulatory",
  "/legal/ip-trademark",
]);

export function placeholderPaths(): string[] {
  return [...moduleIndex.keys()].filter((href) => !staticRoutes.has(href));
}

/** which section owns a pathname (for auto-opening the accordion) */
export function sectionIdForPath(pathname: string): string | undefined {
  for (const section of sidebarConfig) {
    for (const group of section.groups) {
      for (const item of group.items) {
        if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
          return section.id;
        }
      }
    }
  }
  return undefined;
}
