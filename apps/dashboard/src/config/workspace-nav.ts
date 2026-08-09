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
  Inbox,
  Target,
  Compass,
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
      // Phase 20B — final Command L2 IA (Phase 20A locked): eight surfaces.
      // Alerts merged into Inbox (D2); Command Console → Director Intent (D1);
      // Approvals & Decisions → Decisions, navigation-only into the authoritative /approvals.
      { label: "Overview", href: "/command", icon: Gauge, purpose: "Executive cockpit and landing." },
      { label: "Inbox", href: "/command/inbox", icon: Inbox, purpose: "Unified Director attention queue." },
      { label: "Briefings", href: "/command/briefings", icon: Sparkles, purpose: "Executive briefing synthesis — advisory." },
      { label: "Decisions", href: "/approvals", icon: ShieldCheck, purpose: "Pending human authority — navigates to the Decisions surface.", roles: ["director"], elevated: true },
      { label: "Strategic Goals", href: "/director/goals", icon: Target, purpose: "Where the organization is going." },
      { label: "Organization Health", href: "/director/organization-health", icon: Activity, purpose: "Organizational operating state." },
      { label: "Reports", href: "/director/reports", icon: BookOpen, purpose: "Formal views of organizational state." },
      { label: "Director Intent", href: "/command/intent", icon: Compass, purpose: "Express intent — Heby prepares under authority.", roles: ["director"], elevated: true },
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
      // Phase 20C — final Intelligence L2 IA (Phase 20A locked): six surfaces, in lifecycle order.
      // Standalone Patterns removed (D3 — no runtime candidate kind maps to `pattern`); the
      // duplicate Organization Health and Learning pages are not part of the authoritative L2.
      { label: "Overview", href: "/intelligence", icon: Brain, purpose: "Intelligence lifecycle at a glance." },
      { label: "Signals & Assessments", href: "/intelligence/signals", icon: Activity, purpose: "What was observed, and how it is read." },
      { label: "Candidates", href: "/intelligence/candidates", icon: Sparkles, purpose: "Emerging intelligence under validation." },
      { label: "Insights", href: "/director/intelligence/insights", icon: Sparkles, purpose: "Validated intelligence." },
      { label: "Readiness & Pathways", href: "/intelligence/evolution", icon: Activity, purpose: "Readiness to change and transition paths." },
      { label: "Recommendations", href: "/director/intelligence/recommendations", icon: Sparkles, purpose: "Advisory — distinct from a decision." },
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
      // UI Phase 21B — the honesty-compliant Overview is the Knowledge landing; the old
      // "Knowledge Base" label is retired (Phase 21A found no document/ingestion corpus
      // behind it). Company Memory now reads the REAL Enterprise Memory authority,
      // read-only. Knowledge Graph and Registries are rebuilt in Phase 21C; their routes
      // stay in place during 21B/21C (Director decision D1).
      { label: "Overview", href: "/knowledge", icon: BookOpen, purpose: "Organizational knowledge state — availability, sources, and provenance." },
      { label: "Company Memory", href: "/director/memory", icon: Brain, purpose: "Governed durable memory — read-only inspection." },
      { label: "Knowledge Graph", href: "/director/knowledge-graph", icon: Layers, purpose: "Relationships between things." },
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
      // UI Phase 22B/22C — authoritative Operations L2 (Phase 22A IA): four honest surfaces.
      // Overview + Execution (22B); Runtime & Signals + Execution Substrate (22C). The legacy
      // detail routes (Timeline, Failures, Workflows, Orchestration, Task Planning, Events)
      // are honesty-fixed and remain reachable via `match`, but are no longer authoritative L2;
      // their redirect/retirement is Phase 22D.
      { label: "Overview", href: "/operations", icon: Activity, purpose: "What operational state Hebun can observe today." },
      { label: "Execution", href: "/director/execution-center", icon: Activity, purpose: "What has run, and what capability is available — read-only." },
      { label: "Runtime & Signals", href: "/director/runtime-signals", icon: Activity, purpose: "What the runtime observes about itself." },
      { label: "Execution Substrate", href: "/director/execution-substrate", icon: Layers, purpose: "The execution stack and what is missing — read-only." },
    ],
  },
  {
    id: "workforce",
    label: "Workforce",
    icon: UsersRound,
    href: "/workforce",
    tagline: "The AI workforce — who can perform work.",
    roles: ["director", "operator", "specialist", "admin"],
    // Departments stay in `match` so their legacy routes still resolve to Workforce and remain
    // reachable until Phase 25D disposition — they are NOT authoritative L2 destinations.
    match: ["/agents", "/finance", "/hr", "/legal", "/tickets"],
    destinations: [
      // UI Phase 25C — final authoritative Workforce L2 IA (Director-locked): exactly four surfaces,
      // all answering "who can perform work". Overview (information model) and Agents (seeded,
      // in-memory DEFINITIONS) were made honest in 25B; Teams & Roles and Capabilities are added
      // here, read only from the seeded agent-definition seam (no second source of truth, no
      // fabricated org chart, no live staffing, declaration never presented as execution). Finance /
      // HR / Legal / Customer Ops are REMOVED from the authoritative IA — they are legacy domain
      // applications / future Enterprise Domain candidates, kept reachable via `match` and made
      // honest in 25C, with route disposition (redirect / relocation / retirement) owned by 25D.
      { label: "Overview", href: "/workforce", icon: UsersRound, purpose: "Who can perform work — the workforce information model. Read-only, honest empty state." },
      { label: "Agents", href: "/agents", icon: UsersRound, purpose: "AI agent definitions — seeded, in-memory registry; runtime simulation, not a live workforce." },
      { label: "Teams & Roles", href: "/workforce/teams", icon: UsersRound, purpose: "How the workforce is organized — seeded groupings and declared roles; no live staffing." },
      { label: "Capabilities", href: "/workforce/capabilities", icon: Sparkles, purpose: "What the workforce is declared capable of — declaration is not execution." },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    icon: ShieldCheck,
    href: "/governance",
    tagline: "Guardrails, permissions, and the record.",
    roles: ["director", "operator", "admin"],
    match: ["/director/governance", "/director/policy"],
    destinations: [
      // UI Phase 23C — the final authoritative Governance L2 IA (Phase 23A target): five surfaces.
      // Overview + Policies & Rules (23B); Compliance & Risk (folds Risk) + Audit & Explainability
      // (folds Explainability) (23C); Security Center (Phase 19, protected). Phase 23D retired the
      // legacy routes: the /director/governance hub → Overview, /director/policy → Policies & Rules,
      // /director/governance/{risk → compliance, explainability → audit, permissions → policies,
      // approvals → /approvals} now permanently redirect (single hop) to their canonical surface.
      // `match` keeps those prefixes resolving to Governance for the redirect hop.
      { label: "Overview", href: "/governance", icon: ShieldCheck, purpose: "Governance capabilities and boundaries — honest availability." },
      { label: "Policies & Rules", href: "/director/governance/policies", icon: ShieldCheck, purpose: "The policy/rule engine — read-only, derived from seeded input." },
      { label: "Compliance & Risk", href: "/director/governance/compliance", icon: Activity, purpose: "Compliance and risk evaluation — derived from seeded input." },
      { label: "Audit & Explainability", href: "/director/governance/audit", icon: BookOpen, purpose: "Audit trace and explanation provenance — read-only." },
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
      "/director/runtime-activation",
      "/director/adapters",
    ],
    destinations: [
      // UI Phase 24C/24D — the final authoritative Platform L2 IA (Phase 24A target): five surfaces.
      // Overview + Providers & Models (24B); Provider Runtime + Integrations + Infrastructure & Settings
      // (24C). Every surface tells the truth over the real offline provider substrate: contract-only,
      // not-connected, in-memory, or empty — never fabricated health. Phase 24D retired the legacy
      // provider routes to single-hop redirects: /director/provider-framework → provider-matrix;
      // /director/{provider-routing, runtime, runtime-activation} → provider-invocation; /director/adapters
      // → /settings. Models & Tools / Infrastructure / Authentication are folded (auth stays external).
      // The Architecture Map route (/architecture) is retained as a reachable reference (load-bearing for
      // a dashboard widget), removed from the authoritative L2 — it is not redirected (no false equivalence).
      { label: "Overview", href: "/platform", icon: Layers, purpose: "Platform capability and what is actually connected — contract-only, offline." },
      { label: "Providers & Models", href: "/director/provider-matrix", icon: Layers, purpose: "Registered providers and models — offline descriptors, read-only, not connected." },
      { label: "Provider Runtime", href: "/director/provider-invocation", icon: Activity, purpose: "How far an invocation can progress — routing, invocation contract, live eligibility. Offline." },
      { label: "Integrations", href: "/integrations", icon: Layers, purpose: "External integrations — none connected; offline descriptors only." },
      { label: "Infrastructure & Settings", href: "/settings", icon: Layers, purpose: "Real platform configuration and runtime state — in-memory, secrets boundary." },
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
