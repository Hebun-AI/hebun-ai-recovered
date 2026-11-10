"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/modal";
import { resolveActiveNavHref, type ShellNavGroup } from "@/config/customer-nav";

/*
 * Grouped shell navigation (P2 Phase 2B), driven by a config so the Customer Workspace — and later
 * the Platform Admin shell — share one implementation.
 *
 *   ≥1280px      full sidebar: group headings and labels
 *   768–1279px   collapsed icon rail: labels stay in the accessibility tree (sr-only) and in `title`
 *   <768px       `ShellNavSheet`: a menu button opening a native <dialog> drawer with every row
 */

function NavList({
  groups,
  pathname,
  collapsible,
  onNavigate,
}: {
  groups: readonly ShellNavGroup[];
  pathname: string;
  collapsible: boolean;
  onNavigate?: () => void;
}) {
  const active = resolveActiveNavHref(groups, pathname);
  const hideAtTablet = collapsible ? "sr-only xl:not-sr-only" : "";
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className={cn("mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-fg-muted", hideAtTablet)}>
            {group.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsible ? item.label : undefined}
                    aria-current={isActive ? "page" : undefined}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
                      collapsible && "justify-center xl:justify-start",
                      isActive
                        ? "bg-primary-subtle text-primary"
                        : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full",
                        isActive ? "bg-primary" : "bg-transparent",
                      )}
                    />
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className={cn("min-w-0 truncate", hideAtTablet)}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Brand({ collapsible }: { collapsible: boolean }) {
  return (
    <Link
      href="/command"
      aria-label="Hebun AI — Home"
      className={cn(
        "flex h-(--topbar-h) shrink-0 items-center gap-2.5 border-b border-border px-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring",
        collapsible && "justify-center xl:justify-start",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(image:--gradient-primary) text-on-primary">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <span className={cn("text-sm font-semibold text-fg", collapsible && "hidden xl:inline")}>Hebun AI</span>
    </Link>
  );
}

/** Tablet and desktop sidebar. Hidden below md, where `ShellNavSheet` takes over. */
export function ShellNavRail({ groups }: { groups: readonly ShellNavGroup[] }) {
  const pathname = usePathname();
  return (
    <aside
      aria-label="Workspace navigation"
      data-shell="shell-nav"
      className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-(--rail-w) flex-col border-r border-border bg-surface md:flex"
    >
      <Brand collapsible />
      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
        <NavList groups={groups} pathname={pathname} collapsible />
      </nav>
    </aside>
  );
}

/** Mobile (<md) menu button + drawer listing every row. */
export function ShellNavSheet({ groups }: { groups: readonly ShellNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  /* A route change closes the sheet (also covers browser back/forward). */
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open navigation"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        <Menu className="size-5" />
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Hebun AI"
        className="mr-auto ml-0 max-w-[calc(100vw-2.5rem)] border-r border-l-0 sm:max-w-xs"
      >
        <nav aria-label="Primary">
          <NavList groups={groups} pathname={pathname} collapsible={false} onNavigate={() => setOpen(false)} />
        </nav>
      </Drawer>
    </div>
  );
}
