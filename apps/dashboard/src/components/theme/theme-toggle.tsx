"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

/** Switches between Light and Dark. Renders nothing outside a ThemeScope. */
export function ThemeToggle() {
  const state = useTheme();
  if (!state) return null;
  const dark = state.theme === "dark";
  return (
    <button
      type="button"
      onClick={state.toggle}
      aria-pressed={dark}
      aria-label={dark ? "Dark theme on — switch to light" : "Light theme on — switch to dark"}
      className="flex size-10 items-center justify-center rounded-lg text-fg-secondary transition-colors duration-(--dur-fast) hover:bg-surface-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
    >
      {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
