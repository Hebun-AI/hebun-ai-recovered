"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X, ArrowUpRight } from "lucide-react";
import {
  buildHebyPanelModel,
  resolveHebyWorkspace,
  HEBY_AUTHORITY_DESCRIPTORS,
} from "@/features/heby-integration";
import {
  runHebyIntent,
  runNavigation,
  type HebyRuntimeContext,
  type HebyRuntimeOutcome,
} from "@/features/heby-runtime";
import {
  describeActionBoundary,
  type HebyActionBoundaryRow,
  type ToolSideEffectClass,
} from "@/features/heby-actions";
import { useHeby } from "./heby-context";

/** A short, honest badge label for a side-effect class. */
const SIDE_EFFECT_LABEL: Record<ToolSideEffectClass, string> = {
  READ_ONLY: "Read-only",
  PREPARATION_ONLY: "Prepare-only",
  REVERSIBLE_MUTATION: "Reversible",
  CONSEQUENTIAL_MUTATION: "Consequential",
  DEVICE_ACTION: "Device",
};

/** Subtle, theme-aware tint per class — signal without alarm. Never implies an execution state. */
function sideEffectBadgeClass(sideEffect: ToolSideEffectClass): string {
  switch (sideEffect) {
    case "CONSEQUENTIAL_MUTATION":
      return "border-danger/40 text-danger";
    case "REVERSIBLE_MUTATION":
    case "DEVICE_ACTION":
      return "border-warning/40 text-warning";
    default:
      return "border-border text-fg-muted";
  }
}

/*
 * Heby contextual panel — the ambient shared intelligence surface, now connected to the
 * Phase 16 runtime.
 *
 * It resolves TYPED workspace context, then runs REAL, deterministic, evidence-grounded
 * responses through the runtime (system-state explanation, summary, evidence trace,
 * uncertainty assessment) and a READ-ONLY navigation resolver. No model runtime exists in
 * this build, so generative intents return an honest "unavailable" and the panel says so —
 * it never fakes thinking, streaming, or an answer. Evidence, provenance, uncertainty,
 * limitations, and the authority boundary are always labelled. The authoritative act never
 * lives inside Heby.
 */

const INTENT_ACTIONS = [
  { intent: "EXPLAIN", label: "Explain system state" },
  { intent: "SUMMARIZE", label: "Summarize" },
  { intent: "TRACE_EVIDENCE", label: "Trace evidence" },
  { intent: "ASSESS_UNCERTAINTY", label: "Assess uncertainty" },
] as const;

export function HebyPanel() {
  const { open, trigger, overview, closeHeby } = useHeby();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // A single session keyed by the current context. When the key changes (new workspace,
  // region, or entity), the derived `session` resets to empty WITHOUT an effect, a ref
  // write, or a conditional setState — so a stale answer never shows against a new context.
  const contextKey = `${pathname}|${trigger?.region?.key ?? ""}|${trigger?.selectedEntity?.ref ?? ""}`;
  const [rawSession, setSession] = useState<{
    key: string;
    outcome: HebyRuntimeOutcome | null;
    nav: string;
  }>({ key: contextKey, outcome: null, nav: "" });
  const session = rawSession.key === contextKey ? rawSession : { key: contextKey, outcome: null, nav: "" };
  const outcome = session.outcome;
  const navQuery = session.nav;
  const setOutcome = (next: HebyRuntimeOutcome | null) =>
    setSession({ key: contextKey, outcome: next, nav: session.nav });
  const setNavQuery = (next: string) =>
    setSession({ key: contextKey, outcome: session.outcome, nav: next });

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

  const runtimeContext: HebyRuntimeContext = useMemo(
    () => ({
      workspace: resolveHebyWorkspace(pathname),
      route: pathname,
      regionLabel: trigger?.region?.label,
      entityLabel: trigger?.selectedEntity?.label,
      overview: overview ?? undefined,
    }),
    [pathname, trigger, overview],
  );

  // The declared actions Heby OWNS in this workspace — an honest, arg-free boundary view. It
  // shows what each action would do and why it can/cannot run; it never runs or approves anything.
  const actionBoundary: readonly HebyActionBoundaryRow[] = useMemo(
    () => describeActionBoundary(resolveHebyWorkspace(pathname)),
    [pathname],
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

  const response = outcome?.response;

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
            <span id="heby-panel-title" className="text-sm font-bold tracking-tight text-fg">Heby</span>
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
          {/* Context — typed, explicit */}
          <section aria-label="Heby context" className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Context</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-fg-muted">Workspace</dt>
              <dd className="font-medium text-fg">{model.workspaceLabel}</dd>
              {model.regionLabel && (<><dt className="text-fg-muted">Region</dt><dd className="text-fg">{model.regionLabel}</dd></>)}
              {model.entityLabel && (<><dt className="text-fg-muted">Selected</dt><dd className="text-fg">{model.entityLabel}</dd></>)}
              <dt className="text-fg-muted">Authority</dt>
              <dd className="text-fg">{model.authorityLabel}</dd>
            </dl>
          </section>

          {/* Ask — bounded, real actions */}
          <section aria-label="Ask Heby" className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Ask Heby</p>
            <div className="flex flex-wrap gap-1.5">
              {INTENT_ACTIONS.map((action) => (
                <button
                  key={action.intent}
                  type="button"
                  onClick={() => setOutcome(runHebyIntent(action.intent, runtimeContext))}
                  className="rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 text-xs font-medium text-fg-secondary transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
                >
                  {action.label}
                </button>
              ))}
            </div>
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (navQuery.trim()) setOutcome(runNavigation(navQuery, runtimeContext));
              }}
            >
              <input
                type="text"
                value={navQuery}
                onChange={(event) => setNavQuery(event.target.value)}
                placeholder="Resolve navigation (e.g. governance)"
                aria-label="Resolve an in-app navigation target"
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus-visible:border-highlight/50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-highlight"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 text-xs font-medium text-fg-secondary hover:border-highlight/40 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
              >
                Resolve
              </button>
            </form>
            <p className="text-[0.7rem] leading-5 text-fg-muted">
              Generative answers are unavailable — no model runtime is connected. Answers above are assembled
              deterministically from real read models.
            </p>
          </section>

          {/* Response — typed, labelled, honest */}
          {response ? (
            <section aria-label="Heby response" className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-fg">{response.title}</p>
                <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
                  {response.kind}
                </span>
              </div>
              <ul className="flex flex-col gap-1 text-xs leading-5 text-fg-secondary">
                {response.body.map((line, i) => (<li key={i}>{line}</li>))}
              </ul>

              {response.navigationTarget && (
                <Link
                  href={response.navigationTarget.route}
                  onClick={closeHeby}
                  className="inline-flex w-fit items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                >
                  Go to {response.navigationTarget.label}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              )}

              {response.evidence.length > 0 && (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Evidence</p>
                  <ul className="mt-0.5 flex flex-col gap-0.5 text-[0.7rem] text-fg-secondary">
                    {response.evidence.map((e) => (<li key={`${e.sourceClass}-${e.recordRef}`}>{e.sourceClass} · {e.recordRef}</li>))}
                  </ul>
                </div>
              )}
              {response.provenance.length > 0 && (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Provenance</p>
                  <ul className="mt-0.5 flex flex-col gap-0.5 text-[0.7rem] text-fg-muted">
                    {response.provenance.map((p) => (<li key={p}>{p}</li>))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-fg-muted">
                <span>Uncertainty: <span className="text-fg-secondary">{response.uncertainty}</span></span>
                <span>Authority: <span className="text-fg-secondary">{response.authority}</span></span>
              </div>
              {response.limitations.length > 0 && (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Limitations</p>
                  <ul className="mt-0.5 flex flex-col gap-0.5 text-[0.7rem] text-fg-muted">
                    {response.limitations.map((l) => (<li key={l}>{l}</li>))}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <section aria-label="Heby response" className="rounded-lg border border-dashed border-border bg-surface-sunken p-4 text-xs leading-5 text-fg-secondary">
              Choose an action above. Heby answers from real read models where connected, and says so honestly
              where nothing is connected.
            </section>
          )}

          {/* Action boundary — honest, arg-free: what Heby may prepare here and why it can't run */}
          <section aria-label="Heby action boundary" className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">Action boundary</p>
            {actionBoundary.length === 0 ? (
              <p className="text-[0.7rem] leading-5 text-fg-muted">
                Heby owns no declared actions in this workspace. Here it advises and prepares only.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {actionBoundary.map((row) => (
                  <li key={row.actionKind} className="rounded-lg border border-border bg-surface-sunken p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-fg">{row.label}</span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${sideEffectBadgeClass(row.sideEffect)}`}
                      >
                        {SIDE_EFFECT_LABEL[row.sideEffect]}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.7rem] leading-5 text-fg-secondary">{row.verdict}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.65rem] text-fg-muted">
                      <span>Reversibility: <span className="text-fg-secondary">{row.reversibility}</span></span>
                      <span>Authority: <span className="text-fg-secondary">{HEBY_AUTHORITY_DESCRIPTORS[row.authorityRequirement].label}</span></span>
                      <span className={row.invokable ? "text-primary" : "text-fg-muted"}>
                        {row.invokable ? "Invokable (read-only)" : "Not executable"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
