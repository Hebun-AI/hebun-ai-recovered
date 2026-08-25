"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveShellSurface, workspacesForRole } from "@/config/workspace-nav";
import { useRole } from "./role-context";
import { HebyLauncher } from "./heby/heby-launcher";
import { SecondaryNavContent } from "./secondary-nav";

/*
 * Level-1 primary rail: the seven product workspaces + the ambient Heby launcher. At tablet and
 * desktop widths the active workspace exposes its Level-2 destinations directly beneath its
 * Level-1 row. The URL remains the one expansion authority.
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
      className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-(--rail-w) flex-col border-r border-border/70 bg-surface-sunken md:flex"
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

      {/*
        THE NAVIGATION IS EXACTLY AS WIDE AS THE RAIL. It was `w-[min(20rem,100vw)]` — 320px of
        navigation inside a 156px rail — with `pointer-events-none` here and `pointer-events-auto`
        on the list, so the 164px of overhang would not swallow clicks. That is the defect: the
        overhang still PAINTED, and an active Level-2 row rendered a solid surface across the
        workspace canvas. Nothing inside a navigation column may be wider than the column; the
        width now comes from the rail token, and `overflow-x-hidden` is a backstop rather than the
        mechanism.
      */}
      <nav
        aria-label="Primary"
        className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2 py-3"
      >
        <ul className="flex w-full min-w-0 flex-col gap-0.5">
          {workspaces.map((workspace) => {
            const Icon = workspace.icon;
            const isActive = workspace.id === active;
            const sectionsId = `workspace-${workspace.id}-sections`;
            return (
              <li key={workspace.id} className="min-w-0">
                <Link
                  href={workspace.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-expanded={isActive}
                  aria-controls={isActive ? sectionsId : undefined}
                  title={workspace.label}
                  className={cn(
                    "group relative flex min-h-9 w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
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
                  <Icon className="size-4 shrink-0" />
                  <span data-rail-label="" className="min-w-0 text-left leading-snug">
                    {workspace.label}
                  </span>
                </Link>
                                  {/*
                    IN FLOW, AT THE RAIL'S WIDTH, ON THE RAIL'S LAYER. This carried `w-max` — an
                    intrinsic width with no ceiling — plus `min-w-[calc(100%-1rem)]` and
                    `z-(--z-dropdown)`, so the longest destination decided how far the block
                    reached and the z-index put it above the canvas it reached into. All three are
                    gone: the block is an ordinary indented child, it fills the width it is given
                    and never asks for more, and it stacks with the rail rather than above the page.

                    `ml-3` rather than `ml-4`: the indent still reads, and the 4px it returns is
                    part of the 71px chrome budget the rail width is derived from.
                  */}
                {isActive ? (
                  <div
                    id={sectionsId}
                    data-l2-presentation="inline"
                    className="ml-3 mt-1 min-w-0 border-l border-border/70 pl-1"
                  >
                    <SecondaryNavContent
                      workspace={workspace}
                      role={role}
                      pathname={pathname}
                      density="inline"
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="w-full shrink-0 border-t border-border/70 p-2">
        <HebyLauncher variant="rail" />
      </div>
    </aside>
  );
}
