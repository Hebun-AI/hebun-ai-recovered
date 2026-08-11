"use client";

/*
 * heby-surface-context.tsx — the thin adapter between the pure Heby surface model and the router
 * (HW3).
 *
 * It owns PRESENTATION STATE ONLY: which Heby surface is showing, and where closing the Full
 * Workspace returns to. It resolves no tenant, holds no conversation, selects no provider, and
 * touches no runtime. Every decision it makes is delegated to `planHebyTransition`, so the six
 * required transitions live in one provable pure function rather than in scattered click handlers;
 * this file merely executes the returned command.
 *
 * MUTUAL EXCLUSIVITY IS STRUCTURAL. The active surface is a single derived value — the route wins,
 * so while the operator is on `/heby` the Quick Panel is not merely hidden, it is not mounted. Two
 * Heby surfaces cannot be represented at once.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HEBY_FALLBACK_ROUTE,
  planHebyTransition,
  resolveHebySurfaceState,
  type HebySurfaceControl,
  type HebySurfaceState,
} from "@/features/heby-surface";

interface HebySurfaceValue {
  /** The one active surface. Never two. */
  readonly surface: HebySurfaceState;
  /** Operate a Heby control. The transition is decided by the pure planner. */
  readonly operate: (control: HebySurfaceControl) => void;
  /** Close the Quick Panel (its own X / Escape). Never navigates, never touches the conversation. */
  readonly closeQuickPanel: () => void;
  /** Where closing the Full Workspace returns to — SERVER-validated, registered by /heby. */
  readonly returnRoute: string;
  readonly returnLabel: string;
  /**
   * Register the Full Workspace's server-resolved return target. Called by /heby on mount so the
   * return survives a direct load or a reload; the value came from the server's closed allow-list,
   * never from a client-parsed URL.
   */
  readonly registerWorkspaceReturn: (route: string, label: string) => void;
}

const SurfaceContext = createContext<HebySurfaceValue | null>(null);

export function HebySurfaceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [quickPanelRequested, setQuickPanelRequested] = useState(false);
  const [workspaceReturn, setWorkspaceReturn] = useState<{ route: string; label: string }>({
    route: HEBY_FALLBACK_ROUTE,
    label: "Command",
  });

  const surface = resolveHebySurfaceState({ pathname, quickPanelRequested });

  const operate = useCallback(
    (control: HebySurfaceControl) => {
      const command = planHebyTransition({
        state: resolveHebySurfaceState({ pathname, quickPanelRequested }),
        control,
        pathname,
        returnRoute: workspaceReturn.route,
      });
      switch (command.kind) {
        case "open-quick":
          setQuickPanelRequested(true);
          return;
        case "close-quick":
          setQuickPanelRequested(false);
          return;
        case "enter-workspace":
          // Opening the Full Workspace closes the Quick Panel by the same command — never stacked.
          setQuickPanelRequested(false);
          router.push(command.href);
          return;
        case "leave-workspace":
          setQuickPanelRequested(command.openQuick);
          router.push(command.href);
          return;
      }
    },
    [pathname, quickPanelRequested, router, workspaceReturn.route],
  );

  const registerWorkspaceReturn = useCallback((route: string, label: string) => {
    setWorkspaceReturn((prev) => (prev.route === route && prev.label === label ? prev : { route, label }));
  }, []);

  const value = useMemo<HebySurfaceValue>(
    () => ({
      surface,
      operate,
      closeQuickPanel: () => setQuickPanelRequested(false),
      returnRoute: workspaceReturn.route,
      returnLabel: workspaceReturn.label,
      registerWorkspaceReturn,
    }),
    [surface, operate, workspaceReturn.route, workspaceReturn.label, registerWorkspaceReturn],
  );

  return <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>;
}

export function useHebySurface(): HebySurfaceValue {
  const value = useContext(SurfaceContext);
  if (!value) throw new Error("useHebySurface must be used inside HebySurfaceProvider");
  return value;
}
