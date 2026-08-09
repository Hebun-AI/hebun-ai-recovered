/*
 * workspace-nav.ts — the product navigation model for the Hebun App Shell.
 *
 * This encodes the PRODUCT WORKSPACES (Navigation Architecture, UI Phase 3),
 * NOT the underlying software architecture. Seven stable Level-1 workspaces
 * plus the ambient Heby layer. Level-2 destinations are compact per workspace.
 *
 * Rules honoured here (see docs/product-vision/ui/hebun-navigation-architecture.md):
 *   - Top level is exactly 7 workspaces + Heby launcher. It does not grow.
 *   - Heby is NOT a workspace; it is an ambient layer (see heby/).
 *   - Visibility (role filtering) is CONVENIENCE, never authorization.
 *     The server enforces authority via TenantContext. Hiding ≠ denying.
 *   - Level-2 hrefs point at real, working routes so navigation is usable
 *     today. Not-yet-built destinations are marked `unavailable` (no link).
 *     No destructive migration of the ~110 existing routes happens here.
 */

import {
  Gauge,
  Brain,
  BookOpen,
  Activity,
  UsersRound,
  ShieldCheck,
  Layers,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** The four documented roles. Visibility only — authorization is server-side. */
export type UiRole = "director" | "operator" | "specialist" | "admin";

export const ALL_ROLES: readonly UiRole[] = [
  "director",
  "operator",
  "specialist",
  "admin",
];

export type WorkspaceId =
  | "command"
  | "intelligence"
  | "knowledge"
  | "operations"
  | "workforce"
  | "governance"
  | "platform";

export interface NavDestination {
  /** Level-2 label. */
  readonly label: string;
  /** Route the destination points at. Absent when `unavailable`. */
  readonly href?: string;
  readonly icon: LucideIcon;
  /** Short purpose line, used on landing surfaces. */
  readonly purpose?: string;
  /** Roles that may see this row. Defaults to the workspace roles. */
  readonly roles?: readonly UiRole[];
  /** Destination exists in the architecture but has no product route yet. */
  readonly unavailable?: boolean;
  /** Marks an elevated act (surfaced as a hint; server still enforces). */
  readonly elevated?: boolean;
}

export interface Workspace {
  readonly id: WorkspaceId;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Workspace landing route (Level-2 "Overview"/landing). */
  readonly href: string;
  readonly tagline: string;
  /** Roles that see this workspace in the rail. Convenience only. */
  readonly roles: readonly UiRole[];
  /** Extra path prefixes that should activate this workspace (legacy routes). */
  readonly match?: readonly string[];
  readonly destinations: readonly NavDestination[];
}

export const WORKSPACES: readonly Workspace[] = [
  {
    id: "command",
    label: "Command",
    icon: Gauge,
    href: "/command",
    tagline: "Executive operating surface — situational overview and the human decision.",
    roles: ["director", "operator", "specialist", "admin"],
    match: ["/dashboard", "/director", "/approvals"],
    destinations: [
      { label: "Overview", href: "/command", icon: Gauge, purpose: "Executive cockpit and landing." },
      { label: "Briefings", icon: Sparkles, purpose: "Heby-assembled advisory synthesis.", unavailable: true },
      { label: "Approvals & Decisions", href: "/approvals", icon: ShieldCheck, purpose: "The human authority act.", roles: ["director"], elevated: true },
      { label: "Strategic Goals", href: "/director/goals", icon: Gauge, purpose: "Goals and objectives." },
      { label: "Organization Health", href: "/director/organization-health", icon: Activity, purpose: "Health signals." },
      { label: "Alerts", href: "/director/alerts", icon: Activity, purpose: "Critical attention." },
      { label: "Reports", href: "/director/reports", icon: BookOpen, purpose: "Executive reports." },
      { label: "Command Console", icon: Gauge, purpose: "Issue governed action.", roles: ["director"], elevated: true, unavailable: true },
      { label: "Inbox", icon: BookOpen, purpose: "What needs the Director.", unavailable: true },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    icon: Brain,
    href: "/intelligence",
    tagline: "Make sense of what the organization is learning.",
    roles: ["director", "operator", "specialist", "admin"],
    match: ["/director/intelligence", "/director/insights", "/director/recommendations"],
    destinations: [
      { label: "Overview", href: "/intelligence", icon: Brain, purpose: "Intelligence at a glance." },
      { label: "Insights", href: "/director/intelligence/insights", icon: Sparkles, purpose: "Derived insight." },
      { label: "Signals & Assessments", icon: Activity, purpose: "Signals and assessments.", unavailable: true },
      { label: "Candidates", icon: Sparkles, purpose: "Candidate hypotheses.", unavailable: true },
      { label: "Readiness & Pathways", icon: Activity, purpose: "Readiness and pathways.", unavailable: true },
      { label: "Patterns", href: "/director/intelligence/patterns", icon: Brain, purpose: "Recurring patterns." },
      { label: "Recommendations", href: "/director/intelligence/recommendations", icon: Sparkles, purpose: "Advisory recommendations." },
    ],
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: BookOpen,
    href: "/knowledge",
    tagline: "Reference the settled truth.",
    roles: ["director", "operator", "specialist", "admin"],
    match: ["/memory", "/director/memory", "/director/knowledge-graph", "/director/registries"],
    destinations: [
      { label: "Company Memory", href: "/director/memory", icon: Brain, purpose: "Institutional memory." },
      { label: "Knowledge Graph", href: "/director/knowledge-graph", icon: Layers, purpose: "Relationships between things." },
      { label: "Knowledge Base", href: "/knowledge", icon: BookOpen, purpose: "The canonical knowledge foundation." },
      { label: "Registries", href: "/director/registries", icon: Layers, purpose: "Registry hub — 15 registries as Level-3." },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Activity,
    href: "/operations",
    tagline: "Run and watch live work.",
    roles: ["director", "operator", "specialist", "admin"],
    match: [
      "/workflows",
      "/events",
      "/director/execution-center",
      "/director/executions",
      "/director/execution",
      "/director/offline-execution",
      "/director/orchestration",
      "/director/task-planning",
    ],
    destinations: [
      { label: "Executions", href: "/director/execution-center", icon: Activity, purpose: "Live execution monitor." },
      { label: "Timeline", href: "/director/execution-center/timeline", icon: Activity, purpose: "Execution timeline." },
      { label: "Failures", href: "/director/execution-center/failures", icon: Activity, purpose: "Failed runs." },
      { label: "Workflows", href: "/workflows", icon: Layers, purpose: "Workflow definitions and runs." },
      { label: "Orchestration", href: "/director/orchestration", icon: Layers, purpose: "Orchestration surface." },
      { label: "Task Planning", href: "/director/task-planning", icon: Activity, purpose: "Planned work." },
      { label: "Events", href: "/events", icon: Activity, purpose: "Event stream." },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    icon: UsersRound,
    href: "/workforce",
    tagline: "The AI workforce and the departments that do the work.",
    roles: ["director", "operator", "specialist", "admin"],
    match: ["/agents", "/finance", "/hr", "/legal", "/tickets"],
    destinations: [
      { label: "Overview", href: "/workforce", icon: UsersRound, purpose: "Workforce roster." },
      { label: "Agents", href: "/agents", icon: UsersRound, purpose: "The AI agents." },
      { label: "Finance", href: "/finance", icon: Layers, purpose: "Finance department." },
      { label: "HR", href: "/hr", icon: UsersRound, purpose: "People operations." },
      { label: "Legal", href: "/legal", icon: ShieldCheck, purpose: "Legal department." },
      { label: "Customer Ops", href: "/tickets", icon: Activity, purpose: "Customer operations." },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: ShieldCheck,
    href: "/governance",
    tagline: "Guardrails, permissions, and the record.",
    roles: ["director", "operator", "admin"],
    match: ["/director/governance"],
    destinations: [
      { label: "Overview", href: "/governance", icon: ShieldCheck, purpose: "Governance at a glance." },
      { label: "Policies", href: "/director/governance/policies", icon: ShieldCheck, purpose: "Policy set." },
      { label: "Compliance", href: "/director/governance/compliance", icon: ShieldCheck, purpose: "Compliance posture." },
      { label: "Risk", href: "/director/governance/risk", icon: Activity, purpose: "Risk register." },
      { label: "Permissions", href: "/director/governance/permissions", icon: ShieldCheck, purpose: "Access and roles.", roles: ["admin", "director"] },
      { label: "Audit", href: "/director/governance/audit", icon: BookOpen, purpose: "The immutable record." },
      { label: "Explainability", href: "/director/governance/explainability", icon: Brain, purpose: "Why the system acted." },
      { label: "Security Center", href: "/director/governance/security", icon: ShieldCheck, purpose: "Security intelligence, evidence, and the response boundary." },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    icon: Layers,
    href: "/platform",
    tagline: "Providers, integrations, and administration.",
    roles: ["director", "admin"],
    match: [
      "/integrations",
      "/architecture",
      "/settings",
      "/director/provider-matrix",
      "/director/provider-framework",
      "/director/provider-routing",
      "/director/provider-invocation",
      "/director/providers",
      "/director/runtime",
      "/director/adapters",
    ],
    destinations: [
      { label: "Overview", href: "/platform", icon: Layers, purpose: "Platform at a glance." },
      { label: "Providers & Runtime", href: "/director/provider-matrix", icon: Layers, purpose: "Model/tool providers and runtime." },
      { label: "Integrations", href: "/integrations", icon: Layers, purpose: "External integrations." },
      { label: "Infrastructure", icon: Layers, purpose: "Infrastructure surface.", unavailable: true },
      { label: "Models & Tools", icon: Layers, purpose: "Model and tool catalogue.", unavailable: true },
      { label: "Authentication", icon: ShieldCheck, purpose: "Auth administration.", roles: ["admin", "director"], unavailable: true },
      { label: "Architecture Map", href: "/architecture", icon: Layers, purpose: "Advanced architecture map." },
      { label: "Settings", href: "/settings", icon: Layers, purpose: "Platform settings." },
    ],
  },
];

/** The ambient Heby layer. NOT one of the seven workspaces. */
export const HEBY = {
  label: "Heby",
  href: "/heby",
  icon: Sparkles,
} as const;

export function getWorkspace(id: WorkspaceId): Workspace {
  const workspace = WORKSPACES.find((w) => w.id === id);
  if (!workspace) throw new Error(`Unknown workspace: ${id}`);
  return workspace;
}

/** Workspaces visible to a role. Convenience filtering — not a security gate. */
export function workspacesForRole(role: UiRole): readonly Workspace[] {
  return WORKSPACES.filter((w) => w.roles.includes(role));
}

/** Level-2 destinations of a workspace visible to a role. */
export function destinationsForRole(
  workspace: Workspace,
  role: UiRole,
): readonly NavDestination[] {
  return workspace.destinations.filter((d) =>
    (d.roles ?? workspace.roles).includes(role),
  );
}

/**
 * Resolve which workspace a pathname belongs to, by longest-prefix match
 * across every workspace's landing, Level-2 hrefs, and legacy `match` prefixes.
 * Legacy deep links (e.g. /director/goals, /finance) resolve to the right
 * workspace without any route migration.
 */
export function resolveActiveWorkspace(pathname: string): WorkspaceId {
  let best: { id: WorkspaceId; length: number } | null = null;

  for (const workspace of WORKSPACES) {
    const prefixes = [
      workspace.href,
      ...workspace.destinations.map((d) => d.href).filter((h): h is string => Boolean(h)),
      ...(workspace.match ?? []),
    ];
    for (const prefix of prefixes) {
      const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (matches && (!best || prefix.length > best.length)) {
        best = { id: workspace.id, length: prefix.length };
      }
    }
  }

  return best?.id ?? "command";
}
