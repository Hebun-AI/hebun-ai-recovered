"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/*
 * Heby is an AMBIENT interaction layer, not the eighth workspace. This context
 * lets the launcher (present in the rail and the topbar) open the same
 * contextual panel from anywhere in the shell.
 *
 * PHASE 5 SCOPE: shell entry point only. No model is called, Heby Core is not
 * connected, no conversation is faked. The panel renders an explicit
 * "not yet implemented" surface.
 */

interface HebyState {
  readonly open: boolean;
  openHeby: () => void;
  closeHeby: () => void;
  toggleHeby: () => void;
}

const HebyContext = createContext<HebyState | null>(null);

export function HebyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openHeby = useCallback(() => setOpen(true), []);
  const closeHeby = useCallback(() => setOpen(false), []);
  const toggleHeby = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openHeby, closeHeby, toggleHeby }),
    [open, openHeby, closeHeby, toggleHeby],
  );

  return <HebyContext.Provider value={value}>{children}</HebyContext.Provider>;
}

export function useHeby(): HebyState {
  const context = useContext(HebyContext);
  if (!context) throw new Error("useHeby must be used within a HebyProvider");
  return context;
}
