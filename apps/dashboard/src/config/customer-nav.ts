/*
 * customer-nav.ts — the Customer Workspace navigation (P2 Phase 2B).
 *
 * A separate model from `workspace-nav.ts` (the Director shell's seven workspaces). Every row points
 * at a route that already exists and has a runtime behind it; nothing here creates a route.
 *
 * Visibility is convenience, never authorization: every route still enforces its own authority
 * server-side, and a hidden route hit directly is refused (or rendered honestly) below the UI.
 */

import {
  Bot,
  Briefcase,
  House,
  Network,
  Plug,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  SquarePen,
  type LucideIcon,
} from "lucide-react";

export interface ShellNavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** Extra path prefixes that mark this row current. */
  readonly match?: readonly string[];
}

export interface ShellNavGroup {
  readonly label: string;
  readonly items: readonly ShellNavItem[];
}

export const CUSTOMER_NAV: readonly ShellNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Home", href: "/home", icon: House },
      { label: "Heby", href: "/heby", icon: Sparkles },
      { label: "AI Agents", href: "/agents", icon: Bot },
    ],
  },
  {
    label: "Create & Publish",
    items: [
      /* Content preparation, media, READY packages and publication proposals. */
      { label: "Content Studio", href: "/operations", icon: SquarePen },
      { label: "Social Media", href: "/intelligence/social", icon: Share2 },
    ],
  },
  {
    label: "Business",
    items: [
      { label: "Business Management", href: "/live-map", icon: Network },
      { label: "Decisions", href: "/approvals", icon: Briefcase },
    ],
  },
  {
    label: "Security & Connections",
    items: [
      { label: "Security", href: "/director/governance/security", icon: ShieldCheck },
      { label: "Integrations", href: "/integrations", icon: Plug },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Settings", href: "/account", icon: Settings }],
  },
];

/*
 * Areas the customer product will have but that have no runtime today. They are NEVER rendered:
 * a navigation row is a promise, and a mock page shown as an active product breaks it. Each one
 * joins `CUSTOMER_NAV` in the package that ships its runtime.
 */
export const CUSTOMER_HIDDEN_AREAS: readonly string[] = [
  "Research", // no research runtime or route
  "Computer & Browser", // P10
  "Advertising", // P11
  "SEO", // P12
  "Marketing",
];

/*
 * Platform Admin navigation (P4 surfaces). PREPARED, NOT MOUNTED.
 *
 * No in-product platform operator principal exists (Master Plan V2, P4 §3): tenant provisioning
 * and lifecycle run as operator CLI ceremonies, and `/platform` and `/director/*` are tenant-side
 * surfaces, not a cross-tenant admin. So there is no trusted server-side proof to gate an admin
 * shell on, and none of these areas has a route. Nothing renders this list until P4 creates the
 * operator principal by its own design gate.
 */
export const PLATFORM_ADMIN_NAV: readonly { label: string; icon: LucideIcon }[] = [
  { label: "Overview", icon: House },
  { label: "Customers", icon: Briefcase },
  { label: "Subscriptions", icon: Settings },
  { label: "AI Operations", icon: Bot },
  { label: "Costs", icon: Network },
  { label: "Security", icon: Shield },
  { label: "Operations", icon: SquarePen },
  { label: "Settings", icon: Settings },
];

/** The row a pathname is on: longest prefix wins, `null` when none. */
export function resolveActiveNavHref(
  groups: readonly ShellNavGroup[],
  pathname: string,
): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of groups.flatMap((g) => g.items)) {
    for (const prefix of [item.href, ...(item.match ?? [])]) {
      const hit = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { href: item.href, length: prefix.length };
    }
  }
  return best?.href ?? null;
}

/**
 * Which shell the authenticated workspace renders. A deployment setting read on the server, never
 * a client value, and NOT an authority: both shells sit behind the same layout gate and every
 * route keeps its own checks. Anything but the exact word `customer` keeps the Director shell.
 */
export type ShellExperience = "director" | "customer";

export function resolveShellExperience(value: string | undefined): ShellExperience {
  return value === "customer" ? "customer" : "director";
}
