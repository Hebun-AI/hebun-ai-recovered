"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getWorkspace,
  resolveActiveWorkspace,
  workspacesForRole,
  type WorkspaceId,
} from "@/config/workspace-nav";
import { useRole } from "./role-context";
import { SecondaryNavContent } from "./secondary-nav";
import { HebyLauncher } from "./heby/heby-launcher";

/*
 * Mobile navigation (below md). NOT a re-rendered desktop tree. Two views:
 *   1. Workspace switcher — the seven workspaces as rows.
 *   2. Sections — the chosen workspace's Level-2 destinations.
 * Heby is reachable from the sheet footer.
 */

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WorkspaceId | null>(null);
  const pathname = usePathname();
  const role = useRole();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const workspaces = workspacesForRole(role);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const drawer = drawerRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
    window.requestAnimationFrame(() => focusable()[0]?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  const activeWorkspace = resolveActiveWorkspace(pathname);
  const shownWorkspace = getWorkspace(selected ?? activeWorkspace);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open navigation"
        aria-haspopup="dialog"
        onClick={() => {
          setSelected(null);
          setOpen(true);
        }}
        className="flex size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-(--z-overlay)">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-xs"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-nav-title"
            className="absolute inset-y-0 left-0 flex w-(--sidebar-w) max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden border-r border-border/70 bg-surface-sunken shadow-lg"
          >
            <div className="flex h-(--topbar-h) shrink-0 items-center justify-between border-b border-border/70 px-4">
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1.5 rounded-lg text-sm font-semibold text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                >
                  <ChevronLeft className="size-4" />
                  Workspaces
                </button>
              ) : (
                <span id="mobile-nav-title" className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-md bg-(image:--gradient-primary) text-xs font-bold text-on-primary">
                    H
                  </span>
                  <span className="text-sm font-bold tracking-tight">Hebun AI</span>
                </span>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                <X className="size-4" />
              </button>
            </div>

            {selected === null ? (
              <nav aria-label="Workspaces" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
                {workspaces.map((workspace) => {
                  const Icon = workspace.icon;
                  const isActive = workspace.id === activeWorkspace;
                  return (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => setSelected(workspace.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring",
                        isActive ? "bg-primary-subtle text-primary" : "text-fg-secondary hover:bg-surface-raised hover:text-fg",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{workspace.label}</span>
                      <ChevronRight className="size-4 shrink-0 text-fg-muted" />
                    </button>
                  );
                })}
              </nav>
            ) : (
              <SecondaryNavContent
                workspace={shownWorkspace}
                role={role}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            )}

            <div className="shrink-0 border-t border-border/70 p-3">
              <HebyLauncher variant="topbar" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
