"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { resolveActiveWorkspace, getWorkspace } from "@/config/workspace-nav";
import { useHeby } from "./heby-context";

/*
 * Heby contextual panel — a slide-over with a left accent rule. It is
 * workspace-aware (the header names the current workspace) so the architecture
 * is ready for contextual, object-aware interaction later.
 *
 * PHASE 5 SCOPE: this is a shell surface ONLY. It does not call a model, does
 * not connect Heby Core, and does not fabricate a conversation. The body says
 * so explicitly rather than faking intelligence.
 */

export function HebyPanel() {
  const { open, closeHeby } = useHeby();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const workspace = getWorkspace(resolveActiveWorkspace(pathname));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => panelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHeby();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeHeby]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-(--z-overlay)">
      <button
        type="button"
        aria-label="Close Heby"
        onClick={closeHeby}
        className="absolute inset-0 bg-background/60 backdrop-blur-xs"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="heby-panel-title"
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l-4 border-highlight bg-surface shadow-lg outline-none motion-safe:animate-none sm:max-w-[420px]"
      >
        <div className="flex h-(--topbar-h) shrink-0 items-center justify-between border-b border-border px-5">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-highlight/15 text-highlight">
              <Sparkles className="size-4" />
            </span>
            <span id="heby-panel-title" className="text-sm font-bold tracking-tight text-fg">
              Heby
            </span>
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={closeHeby}
            className="flex size-9 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">
            Context · {workspace.label}
          </p>
          <div className="rounded-lg border border-dashed border-border bg-surface-sunken p-5 text-sm">
            <p className="font-semibold text-fg">Heby is not yet available</p>
            <p className="mt-1.5 leading-6 text-fg-secondary">
              This is the ambient Heby entry point in the app shell. Contextual
              awareness, grounded explanations, briefings, and advisory
              interaction are not implemented in this phase — the surface is
              wired but intentionally inert. No response is generated here.
            </p>
          </div>
          <p className="text-xs leading-5 text-fg-muted">
            The authoritative approve/execute act always lives in Command, never
            inside Heby.
          </p>
        </div>
      </div>
    </div>
  );
}
