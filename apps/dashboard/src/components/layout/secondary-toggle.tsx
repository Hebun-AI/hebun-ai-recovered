"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/*
 * Secondary-navigation collapse toggle (desktop only). Widens the Director's
 * canvas by collapsing the Level-2 column, without removing Level-2 navigation:
 * the column can always be restored from here, and tablet/mobile drawers are
 * untouched. State is persisted; the toggle sets a root data attribute that a
 * single CSS rule reacts to (see globals.css). Reusable across all workspaces.
 */

const STORAGE_KEY = "hebun.secondary.collapsed";

export function SecondaryToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) === "1";
    // Set the DOM attribute synchronously so there is no layout flash; defer the
    // React state (icon) update to avoid a synchronous setState in the effect.
    document.documentElement.dataset.secondary = stored ? "collapsed" : "expanded";
    const timer = window.setTimeout(() => setCollapsed(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = () => {
    setCollapsed((previous) => {
      const next = !previous;
      document.documentElement.dataset.secondary = next ? "collapsed" : "expanded";
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable — state stays for this session only
      }
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={collapsed}
      aria-label={collapsed ? "Show workspace navigation" : "Hide workspace navigation"}
      title={collapsed ? "Show navigation" : "Hide navigation"}
      className="hidden size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring lg:flex"
    >
      {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
    </button>
  );
}
