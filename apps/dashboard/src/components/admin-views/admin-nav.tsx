"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, Gauge, LayoutDashboard, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Platform Admin navigation. Every entry is a read-only view behind grant + MFA. */
export const ADMIN_NAV: readonly { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Organizations", href: "/admin/organizations", icon: Building2 },
  { label: "AI Usage", href: "/admin/usage", icon: Gauge },
  { label: "Platform Status", href: "/admin/status", icon: Activity },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Vertical on large screens, a scrollable row on small ones. */
export function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Platform Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ADMIN_NAV.map(({ label, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary-subtle font-medium text-fg"
                : "text-fg-secondary hover:bg-surface-sunken hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
