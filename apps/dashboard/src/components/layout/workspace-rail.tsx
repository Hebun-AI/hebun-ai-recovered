"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveShellSurface, workspacesForRole } from "@/config/workspace-nav";
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
  /*
   * `aria-current="page"` is a statement of fact about where the operator is, so it is driven by
   * the resolver that may answer "none of the seven". On `/heby` it used to mark Command — a claim
   * the rail made both visually and in the accessibility tree. `null` marks nothing, which is what
   * an ambient surface deserves: every workspace stays one click away, none pretends to be current.
   */
  const active = resolveShellSurface(pathname).workspace;
  const workspaces = workspacesForRole(role);

  return (
    <aside
      aria-label="Workspaces"
      /*
       * The stylesheet's handle on the rail. Focused mode narrows it to a minimal identity and
       * navigation strip (see globals.css) — it never unmounts it, and every workspace stays one
       * click away.
       */
      data-shell="rail"
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
                /*
                 * VI-2 — the seven workspace names rendered at 9.92px, which is the primary
                 * navigation of the product below the Stage 0 reading floor. They are now at the
                 * floor, and the two extra pixels the longest of them needs come from this item's
                 * own padding (`px-1` → `px-0.5`), never from `--rail-w` and never from the icon.
                 *
                 * Measured: available label width was 92 − 16 (this item's calc) − 8 (px-1) = 68px,
                 * and "Governance" needs 68.3px at 12px with this tracking. `px-0.5` gives 72px,
                 * clearing the widest name by 3.7px; the next widest, "Intelligence", needs 64.5px.
                 */
                /*
                 * `text-xs` — 0.75rem — is EXACTLY the Stage 0 floor `--fs-label`, and it is what
                 * this must be written as today. `text-label` was the first attempt and it is a
                 * no-op: `@theme inline` cannot resolve `--text-label: var(--fs-label)` because
                 * `--fs-label` lives in an imported plain stylesheet, so Tailwind emits NO rule for
                 * `.text-label` and the element falls back to the inherited 16px. Measured in the
                 * running product: `.text-display`, `.text-title`, `.text-body`, `.text-meta` and
                 * `.text-label` all have no rule and all render at 16px. Worse for a shell class —
                 * `cn()` runs tailwind-merge, which does not know `text-label` is a font size and
                 * drops it as a colour when a `text-*` colour follows.
                 *
                 * Repairing the theme block would resize 165 elements across the canonical
                 * Knowledge workspace, which is a typography change with its own geometry proof and
                 * its own gate. VI-2 states the floor in a utility that exists.
                 */
                "group relative flex w-[calc(var(--rail-w)-16px)] flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-xs font-semibold tracking-tight transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
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
              {/*
                No `truncate`. A workspace name is the product's top-level navigation; shortening it
                silently is the one thing this rail may not do. All seven fit the 72px the item now
                gives them, and the set is closed by the seven-workspace invariant — so nothing here
                relies on a shortening rule, and the proof suite fails if a name stops fitting.
              */}
              <span data-rail-label="" className="max-w-full text-center">{workspace.label}</span>
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
