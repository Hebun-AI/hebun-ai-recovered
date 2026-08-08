import { RoleProvider } from "./role-context";
import { HebyProvider } from "./heby/heby-context";
import { WorkspaceRail } from "./workspace-rail";
import { SecondaryNav } from "./secondary-nav";
import { TopBar } from "./topbar";
import { HebyPanel } from "./heby/heby-panel";
import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";
import type { ExecutiveOverviewLike } from "@/features/heby-runtime";

/*
 * The Hebun App Shell (UI Phase 5).
 *
 *   Level 1  — WorkspaceRail: the seven product workspaces + Heby launcher.
 *   Level 2  — SecondaryNav: the active workspace's destinations.
 *   Content  — the routed product page.
 *   Ambient  — Heby launcher (rail + topbar) and its contextual panel.
 *
 * Responsive:
 *   desktop (lg+)   rail + persistent Level-2 column + content
 *   tablet  (md–lg) rail + Level-2 as a drawer (topbar trigger) + content
 *   mobile  (<md)   workspace/section sheet + full Heby panel + content
 *
 * Role is currently fixed to Director (the shipped single-user surface).
 * Navigation visibility is convenience only — the server enforces authority.
 */

/*
 * Read the REAL, non-authoritative Executive Overview once, server-side, and hand a minimal
 * serializable projection to the ambient Heby runtime (UI Phase 16). Only derived health,
 * counts, freshness, and section state are passed — no secret, no credential, no
 * authoritative record. When the overview cannot be built, Heby simply has no system state
 * to inspect and says so honestly.
 */
function readHebyOverview(): ExecutiveOverviewLike | undefined {
  const { overview } = getDirectorDashboardUiModel();
  if (!overview) return undefined;
  return {
    organizationHealth: overview.organizationHealth,
    criticalAlertCount: overview.criticalAlertCount,
    warningCount: overview.warningCount,
    unavailableCount: overview.unavailableCount,
    freshness: { state: overview.freshness.state, ageSeconds: overview.freshness.ageSeconds },
    sections: overview.sections.map((section) => ({
      sectionId: section.sectionId,
      label: section.label,
      health: section.health,
      sourceState: section.sourceState,
      recordCount: section.recordCount,
      reasonCode: section.reasonCode,
    })),
    authoritative: false,
  };
}

export function HebunShell({ children }: { children: React.ReactNode }) {
  const hebyOverview = readHebyOverview();
  return (
    <RoleProvider role="director">
      <HebyProvider overview={hebyOverview}>
        <div className="min-h-dvh bg-background text-fg">
          <WorkspaceRail />
          <SecondaryNav />
          <div className="min-w-0 md:pl-(--rail-w) lg:pl-(--shell-nav-w)">
            <TopBar />
            <main className="mx-auto flex w-full min-w-0 max-w-[1800px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
              {children}
            </main>
          </div>
          <HebyPanel />
        </div>
      </HebyProvider>
    </RoleProvider>
  );
}
