import { RoleProvider } from "./role-context";
import { WorkspaceRail } from "./workspace-rail";
import { SecondaryNav } from "./secondary-nav";
import { TopBar } from "./topbar";
import { HebySurfaceProvider } from "./heby/heby-surface-context";
import { HebyVoiceProvider } from "./heby/heby-voice-runtime";
import { HebyQuickPanelClient } from "./heby/heby-quick-panel-client";

/*
 * The Hebun App Shell (UI Phase 5).
 *
 *   Level 1  — WorkspaceRail: the seven product workspaces + Heby launcher.
 *   Level 2  — SecondaryNav: the active workspace's destinations.
 *   Content  — the routed product page.
 *
 * Responsive:
 *   desktop (lg+)   rail + persistent Level-2 column + content
 *   tablet  (md–lg) rail + Level-2 as a drawer (topbar trigger) + content
 *   mobile  (<md)   workspace/section sheet + content
 *
 * HW3 — HEBY HAS TWO PRESENTATION SURFACES, AND ONLY ONE CAN BE ACTIVE.
 *
 *   QUICK PANEL     an overlay mounted here, opened by the topbar control. The current workspace
 *                   stays visible beside it and is the context.
 *   FULL WORKSPACE  the /heby route, opened by the rail control, rendered in the main content
 *                   region like any other surface.
 *
 * `HebySurfaceProvider` holds PRESENTATION STATE ONLY and derives the active surface from the route
 * plus a single quick-panel request, so "both surfaces at once" is unrepresentable rather than
 * merely prevented: on /heby the panel container returns null and is not in the tree. The provider
 * wraps the whole shell so the state survives client navigation between workspaces.
 *
 * This is still exactly ONE Heby: both surfaces run the same shared conversation hook → the same
 * server action → server-resolved TenantContext → the R2E Director kill-switch → bounded history →
 * the one durable conversation. No second backend, no second transcript, no second provider path.
 * The pre-H1 drawer stays retired; nothing here resurrects it.
 *
 * VOICE V1 — ONE MICROPHONE OWNER, MOUNTED HERE AND NOWHERE ELSE. `HebyVoiceProvider` sits above
 * both surfaces for the same reason `HebySurfaceProvider` does: a microphone is one physical device
 * with one honest state, and a per-surface runtime would make "who closes the stream" a question of
 * unmount ordering. Mounted once, the Quick Panel and the Full Workspace share it, so switching
 * surfaces cannot create a second capture — there is no second runtime to create it with.
 *
 * Mounting it here starts NOTHING. The provider only feature-detects on mount; it opens no
 * microphone, builds no AudioContext, and starts no recognizer until the operator presses the
 * microphone control and clears the disclosure. There is no wake word and no background listening.
 *
 * Role is currently fixed to Director (the shipped single-user surface).
 * Navigation visibility is convenience only — the server enforces authority.
 */
export function HebunShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider role="director">
      <HebySurfaceProvider>
        <HebyVoiceProvider>
          <div className="min-h-dvh bg-background text-fg">
            <WorkspaceRail />
            <SecondaryNav />
            <div className="min-w-0 md:pl-(--rail-w) lg:pl-(--shell-nav-w)">
              <TopBar />
              <main className="mx-auto flex w-full min-w-0 max-w-[1800px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                {children}
              </main>
            </div>
            <HebyQuickPanelClient />
          </div>
        </HebyVoiceProvider>
      </HebySurfaceProvider>
    </RoleProvider>
  );
}
