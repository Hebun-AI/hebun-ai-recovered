"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { getWorkspace, resolveActiveWorkspace, resolveShellSurface } from "@/config/workspace-nav";
import { useRole } from "./role-context";
import { SecondaryNavContent } from "./secondary-nav";

/*
 * Tablet (md..lg): the primary rail stays, but the Level-2 column is not
 * permanent — it opens as a controlled drawer from this topbar trigger.
 * Below md this control is hidden (the mobile sheet takes over); at lg+ the
 * Level-2 column is permanent and this control is hidden.
 */

export function TabletSections() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const role = useRole();
  const drawerRef = useRef<HTMLDivElement>(null);
  /*
   * `workspace` is the navigation FALLBACK — whose Level-2 list this drawer opens. `surface` is
   * where the operator actually is, and it is what the trigger says. On `/heby` at 768px the
   * trigger read "Command", unconditionally: focused mode is desktop-only, so nothing hid it. The
   * drawer's own header names the workspace whose sections are listed, so both facts are stated.
   */
  const workspace = getWorkspace(resolveActiveWorkspace(pathname));
  const surface = resolveShellSurface(pathname);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => drawerRef.current?.focus());
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="hidden md:block lg:hidden">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg transition-colors duration-(--dur-fast) hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        {surface.label}
        <ChevronDown className="size-4 text-fg-muted" />
      </button>

      {open && (
        <div className="fixed inset-0 z-(--z-overlay)">
          <button
            type="button"
            aria-label="Close sections"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-xs"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${workspace.label} sections`}
            tabIndex={-1}
            className="absolute inset-y-0 left-(--rail-w) flex w-(--sidebar-w) max-w-[calc(100vw-var(--rail-w)-1rem)] flex-col border-r border-border/70 bg-surface shadow-lg outline-none"
          >
            <div className="flex h-(--topbar-h) shrink-0 items-center justify-end border-b border-border/70 px-3">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                <X className="size-4" />
              </button>
            </div>
            <SecondaryNavContent
              workspace={workspace}
              role={role}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
