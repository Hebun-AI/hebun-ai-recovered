"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { buildHebyPanelModel } from "@/features/heby-integration";
import { useHeby } from "./heby-context";

/*
 * Heby contextual panel — a slide-over with a left accent rule. It is the ambient shared
 * intelligence surface.
 *
 * PHASE 15: the panel resolves a TYPED workspace context (workspace, region, selected
 * entity, capability states, relevant sources, authority mode, and what Heby MAY explain
 * here) through the heby-integration architecture, and shows it. It then reports an
 * explicit "not connected" response — no model, provider, tool, or device is called, and
 * no answer, evidence, or provenance is fabricated. Authority stays with the human; the
 * approve/execute act never lives inside Heby.
 */

export function HebyPanel() {
  const { open, trigger, closeHeby } = useHeby();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () =>
      buildHebyPanelModel({
        pathname,
        region: trigger?.region,
        selectedEntity: trigger?.selectedEntity,
        intent: trigger?.intent,
      }),
    [pathname, trigger],
  );

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
          {/* Context Heby is aware of — typed, explicit, never DOM-scraped */}
          <section aria-label="Heby context" className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Context</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-fg-muted">Workspace</dt>
              <dd className="font-medium text-fg">{model.workspaceLabel}</dd>
              {model.regionLabel && (
                <>
                  <dt className="text-fg-muted">Region</dt>
                  <dd className="text-fg">{model.regionLabel}</dd>
                </>
              )}
              {model.entityLabel && (
                <>
                  <dt className="text-fg-muted">Selected</dt>
                  <dd className="text-fg">{model.entityLabel}</dd>
                </>
              )}
              <dt className="text-fg-muted">Authority</dt>
              <dd className="text-fg">{model.authorityLabel}</dd>
            </dl>

            {model.capabilities.length > 0 && (
              <div>
                <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-muted">
                  Capabilities here
                </p>
                <ul className="flex flex-col gap-1">
                  {model.capabilities.map((c) => (
                    <li key={c.family} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-fg-secondary">{c.family}</span>
                      <span className="shrink-0 rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[0.65rem] font-medium text-fg-muted">
                        {c.stateLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {model.mayExplain.length > 0 && (
              <div>
                <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-muted">
                  What Heby can explain here
                </p>
                <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs leading-5 text-fg-secondary">
                  {model.mayExplain.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Response — explicit not-connected; nothing fabricated */}
          <section aria-label="Heby response" className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-surface-sunken p-5 text-sm">
            <p className="font-semibold text-fg">Heby response — not connected yet</p>
            {model.responseLimitations.map((line) => (
              <p key={line} className="leading-6 text-fg-secondary">
                {line}
              </p>
            ))}
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              Heby is context-aware here, but no response runtime is connected. When it is, answers will carry
              their evidence, provenance, and what remains uncertain — never confident prose over missing
              provenance.
            </p>
          </section>

          <p className="text-xs leading-5 text-fg-muted">
            Heby advises and prepares. It never approves, rejects, authorizes, executes, or edits policy — the
            authoritative act always lives with the human, in Command or Decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
