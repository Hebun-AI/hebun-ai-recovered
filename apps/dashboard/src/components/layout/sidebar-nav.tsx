"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bot, BriefcaseBusiness, Building2, CalendarClock, CircleDollarSign, FileCheck2, Gauge, Landmark, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const navigationGroups = [
  { label: "Workspace", items: [{ label: "Overview", href: "/director", icon: Gauge }] },
  { label: "Enterprise", items: [
    { label: "Organization", href: "/director/organization", icon: Building2 },
    { label: "Finance", href: "/finance", icon: CircleDollarSign },
    { label: "Sales", icon: BarChart3, unavailable: true },
    { label: "Operations", href: "/dashboard", icon: BriefcaseBusiness },
    { label: "People", href: "/hr", icon: UsersRound },
  ] },
  { label: "Knowledge", items: [
    { label: "Knowledge", href: "/knowledge", icon: BookOpen },
    { label: "Decisions", href: "/approvals", icon: FileCheck2 },
  ] },
  { label: "Execution", items: [{ label: "Agents", href: "/agents", icon: Bot }] },
  { label: "History", items: [
    { label: "Timeline", href: "/events", icon: CalendarClock },
    { label: "Reports", href: "/director/reports", icon: Landmark },
  ] },
  { label: "Administration", items: [{ label: "Risk & Compliance", href: "/director/governance/risk", icon: ShieldCheck }] },
] as const;

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {navigationGroups.map((group) => <div key={group.label} className="mb-3 last:mb-0">
          <p className="px-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-fg-muted">{group.label}</p>
          <div className="space-y-0.5">{group.items.map(({ label, icon: Icon, ...destination }) => {
          if ("unavailable" in destination) {
            return <span key={label} role="link" aria-disabled="true" className="flex min-h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium text-fg-muted"><Icon className="size-4 shrink-0" />{label}<span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-wider">Soon</span></span>;
          }
          const href = destination.href;
          const active = href === "/director" ? pathname === href : pathname.startsWith(href);
          return <Link key={label} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring", active ? "bg-primary-subtle text-primary" : "text-fg-secondary hover:bg-surface-raised hover:text-fg")}><Icon className="size-4 shrink-0" />{label}</Link>;
          })}</div>
        </div>)}
      </nav>
      <div className="border-t border-border px-3 py-4"><Link href="/settings" className={cn("flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring", pathname === "/settings" ? "bg-primary-subtle text-primary" : "text-fg-secondary hover:bg-surface-raised hover:text-fg")}><Settings className="size-4" />Settings</Link></div>
    </div>
  );
}
