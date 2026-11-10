"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  THEME_COOKIE_MAX_AGE_SECONDS,
  nextTheme,
  themeCookieName,
  type Theme,
  type ThemeExperience,
} from "@/features/theme/theme";

interface ThemeState {
  readonly theme: Theme;
  readonly toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Null outside a ThemeScope — a control that needs it renders nothing rather than guessing. */
export function useTheme(): ThemeState | null {
  return useContext(ThemeContext);
}

/*
 * The scope element carries `data-hebun-theme`. `theme-dark.css` re-points the design tokens on
 * `:root` while such an element says "dark", so the page ground, portals and native dialogs all
 * follow without one component knowing about themes. `display: contents` keeps the wrapper out of
 * layout, so the shell renders exactly as it did before the wrapper existed.
 */
export function ThemeProvider({
  experience,
  initialTheme,
  children,
}: {
  experience: ThemeExperience;
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = nextTheme(current);
      const secure = window.location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${themeCookieName(experience)}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax${secure}`;
      return next;
    });
  }, [experience]);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      <div data-hebun-theme={theme} data-theme-experience={experience} className="contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
