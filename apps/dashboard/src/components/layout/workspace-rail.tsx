"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveActiveWorkspace, workspacesForRole } from "@/config/workspace-nav";
import { useRole } from "./role-context";
import { HebyLauncher } from "./heby/heby-launcher";

/*
 * Level-1 primary rail: the seven product workspaces + the ambient Heby
 * launcher. Icon rail with labels, active = accent + left-rule + aria-current.
 * Fixed on tablet and desktop; replaced by the mobile sheet below md.
 */

export function WorkspaceRail() {
  const pathname = usePathname();
  const role = useRole();
  const active = resolveActiveWorkspace(pathname);
  const workspaces = workspacesForRole(role);

  return (
    <aside
      aria-label="Workspaces"
      className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-(--rail-w) flex-col items-center border-r border-border/70 bg-surface-sunken md:flex"
    >
      <Link
        href="/command"
        aria-label="Hebun AI — Command"
        className="flex h-(--topbar-h) w-full shrink-0 items-center justify-center border-b border-border/70"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-(image:--gradient-primary) text-sm font-bold text-on-primary">
          H
        </span>
      </Link>

      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-3">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          const isActive = workspace.id === active;
          return (
            <Link
              key={workspace.id}
              href={workspace.href}
              aria-current={isActive ? "page" : undefined}
              title={workspace.label}
              className={cn(
                "group relative flex w-[calc(var(--rail-w)-16px)] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.62rem] font-semibold tracking-tight transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
                isActive
                  ? "bg-primary-subtle text-primary"
                  : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full",
                  isActive ? "bg-primary" : "bg-transparent",
                )}
              />
              <Icon className="size-5 shrink-0" />
              <span className="max-w-full truncate leading-tight">{workspace.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="w-full shrink-0 border-t border-border/70 p-2">
        <HebyLauncher variant="rail" />
      </div>
    </aside>
  );
}
