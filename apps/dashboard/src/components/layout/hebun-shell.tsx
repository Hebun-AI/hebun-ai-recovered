import { RoleProvider } from "./role-context";
import { HebyProvider } from "./heby/heby-context";
import { WorkspaceRail } from "./workspace-rail";
import { SecondaryNav } from "./secondary-nav";
import { TopBar } from "./topbar";
import { HebyPanel } from "./heby/heby-panel";

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

export function HebunShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider role="director">
      <HebyProvider>
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
