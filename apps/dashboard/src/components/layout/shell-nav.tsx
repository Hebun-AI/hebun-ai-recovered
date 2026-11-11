"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/modal";
import { resolveActiveNavHref, type ShellNavGroup } from "@/config/customer-nav";

/*
 * Grouped shell navigation (P2 Phase 2B/2C), driven by a config so the Customer Workspace — and
 * later the Platform Admin shell — share one implementation.
 *
 *   ≥1280px      full sidebar: group headings and labels
 *   768–1279px   collapsed icon rail: labels stay in the accessibility tree (sr-only); a tooltip
 *                shows the label on hover AND keyboard focus, and Escape dismisses it
 *   <768px       `ShellNavSheet`: a menu button opening a native <dialog> drawer with every row
 *
 * `spacing="compact"` is the Platform Admin presentation (denser rows, tighter groups). Nothing
 * mounts it yet: the admin shell waits for P4's operator principal.
 */

export type ShellNavSpacing = "comfortable" | "compact";

/** A label to show beside a collapsed row, positioned in the viewport so the rail's scroll box cannot clip it. */
interface Peek {
  readonly label: string;
  readonly top: number;
  readonly left: number;
}

const FULL_SIDEBAR = "(min-width: 1280px)";

function NavList({
  groups,
  pathname,
  variant,
  spacing = "comfortable",
  onNavigate,
  onPeek,
}: {
  groups: readonly ShellNavGroup[];
  pathname: string;
  variant: "rail" | "sheet";
  spacing?: ShellNavSpacing;
  onNavigate?: () => void;
  onPeek?: (peek: Peek | null) => void;
}) {
  const active = resolveActiveNavHref(groups, pathname);
  const rail = variant === "rail";
  const compact = spacing === "compact";
  /* In the rail, labels and headings leave the screen (not the accessibility tree) below 1280px. */
  const railOnly = rail ? "sr-only xl:not-sr-only" : "";

  const peek = (event: React.SyntheticEvent<HTMLElement>, label: string) => {
    if (!rail || !onPeek || window.matchMedia(FULL_SIDEBAR).matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onPeek({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
  };
  const unpeek = () => onPeek?.(null);

  return (
    <div className={cn("flex flex-col", compact ? "gap-3" : "gap-5")}>
      {groups.map((group) => (
        <section
          key={group.label}
          aria-label={group.label}
          /* Collapsed rail: a hairline stands in for the hidden heading between groups. */
          className={cn(rail && "md:max-xl:border-t md:max-xl:border-border md:max-xl:pt-3 md:max-xl:first:border-t-0 md:max-xl:first:pt-0")}
        >
          <h2 className={cn("mb-1.5 px-3 text-xs font-medium text-fg-muted", railOnly)}>{group.label}</h2>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === active;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      unpeek();
                      onNavigate?.();
                    }}
                    onPointerEnter={(event) => peek(event, item.label)}
                    onPointerLeave={unpeek}
                    onFocus={(event) => peek(event, item.label)}
                    onBlur={unpeek}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") unpeek();
                    }}
                    className={cn(
                      "group/row flex items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-(--dur-fast)",
                      /* Inset ring: the rail is a scroll box and would clip an outset one. */
                      "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring",
                      variant === "sheet" ? "min-h-11" : compact ? "min-h-8" : "min-h-10",
                      rail && "justify-center xl:justify-start",
                      isActive
                        ? "bg-primary-subtle font-semibold text-primary"
                        : "font-medium text-fg-secondary hover:bg-fg/5 hover:text-fg",
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "size-4.5 shrink-0",
                        isActive ? "text-primary" : "text-fg-muted group-hover/row:text-fg",
                      )}
                    />
                    <span className={cn("min-w-0 truncate", railOnly)}>{item.label}</span>
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

function Brand() {
  return (
    <Link
      href="/home"
      aria-label="Hebun AI — Home"
      className="flex h-(--topbar-h) shrink-0 items-center justify-center gap-2.5 border-b border-border px-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-ring xl:justify-start xl:px-6"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(image:--gradient-primary) text-on-primary shadow-xs">
        <Sparkles className="size-4.5" aria-hidden="true" />
      </span>
      <span className="hidden text-sm font-semibold tracking-tight text-fg xl:inline">Hebun AI</span>
    </Link>
  );
}

/** Tablet and desktop sidebar. Hidden below md, where `ShellNavSheet` takes over. */
export function ShellNavRail({
  groups,
  spacing = "comfortable",
}: {
  groups: readonly ShellNavGroup[];
  spacing?: ShellNavSpacing;
}) {
  const pathname = usePathname();
  const [peek, setPeek] = useState<Peek | null>(null);

  /* The rail scrolls and the window resizes; a stale tooltip would float beside the wrong row. */
  useEffect(() => {
    if (!peek) return;
    const hide = () => setPeek(null);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [peek]);

  return (
    <aside
      aria-label="Workspace navigation"
      data-shell="shell-nav"
      className="fixed inset-y-0 left-0 z-(--z-sticky) hidden w-(--rail-w) flex-col border-r border-border bg-surface md:flex"
    >
      <Brand />
      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        <NavList groups={groups} pathname={pathname} variant="rail" spacing={spacing} onPeek={setPeek} />
      </nav>
      {peek && (
        /* Visual only: the row already carries this label as its accessible name. */
        <span
          aria-hidden="true"
          style={{ top: peek.top, left: peek.left }}
          className="pointer-events-none fixed z-(--z-tooltip) -translate-y-1/2 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs font-medium whitespace-nowrap text-fg shadow-md"
        >
          {peek.label}
        </span>
      )}
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
        className="-ml-2 flex size-11 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        <Menu className="size-5" />
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Hebun AI"
        className="mr-auto ml-0 max-w-[calc(100vw-2.5rem)] border-r border-l-0 sm:max-w-xs"
      >
        <nav aria-label="Primary" className="-mx-2">
          <NavList groups={groups} pathname={pathname} variant="sheet" onNavigate={() => setOpen(false)} />
        </nav>
      </Drawer>
    </div>
  );
}
