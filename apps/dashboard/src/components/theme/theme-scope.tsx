import { cookies } from "next/headers";
import { resolveTheme, themeCookieName, type ThemeExperience } from "@/features/theme/theme";
import { ThemeProvider } from "./theme-provider";

/*
 * Server side of the theme: reads this experience's preference cookie and renders the scope with the
 * resolved theme, so the first paint is already correct. Used only inside authenticated layouts,
 * which are request-rendered anyway; public pages never mount it and stay Light.
 */
export async function ThemeScope({
  experience,
  children,
}: {
  experience: ThemeExperience;
  children: React.ReactNode;
}) {
  const store = await cookies();
  const theme = resolveTheme(experience, store.get(themeCookieName(experience))?.value);
  return (
    <ThemeProvider experience={experience} initialTheme={theme}>
      {children}
    </ThemeProvider>
  );
}
