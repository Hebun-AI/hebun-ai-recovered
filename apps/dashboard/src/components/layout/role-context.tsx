"use client";

import { createContext, useContext } from "react";
import type { UiRole } from "@/config/workspace-nav";
import type { ShellExperience } from "@/config/customer-nav";

/*
 * RoleContext — the UI's view of the current role, used ONLY to filter which
 * navigation is shown. This is a convenience layer, never an authorization
 * mechanism: the server enforces authority via TenantContext (roleId /
 * permissionSummary / assuranceLevel). A hidden route hit directly is still
 * refused below the UI.
 *
 * The dashboard currently ships as a single Director surface, so the default
 * role is "director". When the shell is later wired to real membership data,
 * pass the resolved role into <RoleProvider>. No permission behaviour is
 * fabricated here.
 */

const RoleContext = createContext<UiRole>("director");
/* Which navigation the shell renders (P2 Phase 2B). Presentation only, like the role above. */
const ExperienceContext = createContext<ShellExperience>("director");

export function RoleProvider({
  role = "director",
  experience = "director",
  children,
}: {
  role?: UiRole;
  experience?: ShellExperience;
  children: React.ReactNode;
}) {
  return (
    <RoleContext.Provider value={role}>
      <ExperienceContext.Provider value={experience}>{children}</ExperienceContext.Provider>
    </RoleContext.Provider>
  );
}

export function useShellExperience(): ShellExperience {
  return useContext(ExperienceContext);
}

export function useRole(): UiRole {
  return useContext(RoleContext);
}
