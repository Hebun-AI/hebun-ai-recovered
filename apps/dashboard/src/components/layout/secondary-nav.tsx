"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  destinationsForRole,
  getWorkspace,
  resolveActiveWorkspace,
  type NavDestination,
  type Workspace,
} from "@/config/workspace-nav";
import { useRole } from "./role-context";
import type { UiRole } from "@/config/workspace-nav";

function isDestinationActive(destination: NavDestination, pathname: string): boolean {
  if (!destination.href) return false;
  return pathname === destination.href || pathname.startsWith(`${destination.href}/`);
}

/** The inner Level-2 list — reused by the desktop column, tablet drawer, and mobile sheet. */
export function SecondaryNavContent({
  workspace,
  role,
  pathname,
  onNavigate,
}: {
  workspace: Workspace;
  role: UiRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  const destinations = destinationsForRole(workspace, role);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-2 pt-4">
        <p className="text-sm font-semibold text-fg">{workspace.label}</p>
        <p className="mt-0.5 text-xs leading-5 text-fg-muted">{workspace.tagline}</p>
      </div>
      <nav aria-label={`${workspace.label} sections`} className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          if (destination.unavailable || !destination.href) {
            return (
              <span
                key={destination.label}
                role="link"
                aria-disabled="true"
                className="flex min-h-10 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-fg-muted"
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{destination.label}</span>
                <span className="ml-auto text-[0.6rem] font-semibold uppercase tracking-wider">Soon</span>
              </span>
            );
          }
          const active = isDestinationActive(destination, pathname);
          return (
            <Link
              key={destination.label}
              href={destination.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
                active
                  ? "bg-primary-subtle text-primary"
                  : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{destination.label}</span>
              {destination.elevated && (
                <Lock className="ml-auto size-3.5 shrink-0 text-fg-muted" aria-label="Requires elevated authority" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Fixed Level-2 column, persistent on desktop (lg+). */
export function SecondaryNav() {
  const pathname = usePathname();
  const role = useRole();
  const workspace = getWorkspace(resolveActiveWorkspace(pathname));

  return (
    <aside
      aria-label="Workspace navigation"
      className="fixed inset-y-0 left-(--rail-w) z-(--z-sticky) hidden w-(--secondary-w) flex-col border-r border-border/70 bg-surface lg:flex"
    >
      <SecondaryNavContent workspace={workspace} role={role} pathname={pathname} />
    </aside>
  );
}
