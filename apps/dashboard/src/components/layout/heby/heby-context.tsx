"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  HebyProductIntent,
  HebySelectedEntity,
  HebySurfaceRegion,
} from "@/features/heby-integration";
import type { ExecutiveOverviewLike } from "@/features/heby-runtime";

/*
 * Heby is an AMBIENT interaction layer, not the eighth workspace. This context lets the
 * launcher (rail + topbar) and every in-surface "Why?" trigger open the SAME contextual
 * panel from anywhere in the shell.
 *
 * PHASE 15: the launcher opens Heby at workspace level; an in-surface trigger may carry a
 * TYPED context payload (region, selected entity, intent) so the panel knows what "this"
 * means — deterministic, explicit, never DOM-scraped. No model is called, no answer is
 * generated, no conversation is faked. The panel resolves typed context and reports an
 * explicit "not connected" response.
 */

/** The typed context an in-surface trigger hands to Heby. All fields optional. */
export interface HebyTrigger {
  readonly region?: HebySurfaceRegion;
  readonly selectedEntity?: HebySelectedEntity;
  readonly intent?: HebyProductIntent;
}

interface HebyState {
  readonly open: boolean;
  /** The typed context carried by the trigger that opened the panel, if any. */
  readonly trigger: HebyTrigger | null;
  /**
   * The real, non-authoritative Executive Overview supplied by the server shell, for the
   * Heby runtime to inspect system state. Undefined when unavailable. Never a secret.
   */
  readonly overview: ExecutiveOverviewLike | null;
  openHeby: (trigger?: HebyTrigger) => void;
  closeHeby: () => void;
  toggleHeby: () => void;
}

const HebyContext = createContext<HebyState | null>(null);

export function HebyProvider({
  children,
  overview = null,
}: {
  children: React.ReactNode;
  overview?: ExecutiveOverviewLike | null;
}) {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HebyTrigger | null>(null);

  const openHeby = useCallback((next?: HebyTrigger) => {
    setTrigger(next ?? null);
    setOpen(true);
  }, []);
  const closeHeby = useCallback(() => {
    setOpen(false);
    setTrigger(null);
  }, []);
  const toggleHeby = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, trigger, overview, openHeby, closeHeby, toggleHeby }),
    [open, trigger, overview, openHeby, closeHeby, toggleHeby],
  );

  return <HebyContext.Provider value={value}>{children}</HebyContext.Provider>;
}

export function useHeby(): HebyState {
  const context = useContext(HebyContext);
  if (!context) throw new Error("useHeby must be used within a HebyProvider");
  return context;
}
