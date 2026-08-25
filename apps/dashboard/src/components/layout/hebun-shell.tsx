import { RoleProvider } from "./role-context";
import { WorkspaceRail } from "./workspace-rail";
import { TopBar } from "./topbar";
import { HebySurfaceProvider } from "./heby/heby-surface-context";
import { HebyVoiceProvider } from "./heby/heby-voice-runtime";
import { HebyQuickPanelClient } from "./heby/heby-quick-panel-client";
import { HebyFocusProvider } from "./heby/heby-focus-mode";

/*
 * The Hebun App Shell (UI Phase 5).
 *
 *   Level 1  — WorkspaceRail: the seven product workspaces + Heby launcher.
 *   Level 2  — the active workspace's destinations, inline beneath its Level-1 row.
 *   Content  — the routed product page.
 *
 * Responsive:
 *   tablet/desktop  one integrated rail with inline Level-2 presentation + content
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
 * FOCUSED HEBY MODE — PRESENTATION ONLY, AND STILL EXACTLY ONE SHELL. `HebyFocusProvider` sits
 * inside the surface provider because the mode it derives is a function of the surface, which is a
 * function of the route. It mounts no navigation of its own and takes none away: `WorkspaceRail`
 * and its canonical `SecondaryNavContent` are rendered unconditionally below, on every route. The mode is
 * one root data attribute and one stylesheet block (see globals.css), so there is no second shell
 * to keep in agreement with this one, and nothing here is persisted into a preference that could
 * outlive the route it came from.
 *
 * Role is currently fixed to Director (the shipped single-user surface).
 * Navigation visibility is convenience only — the server enforces authority.
 */
export function HebunShell({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider role="director">
      <HebySurfaceProvider>
        <HebyVoiceProvider>
          <HebyFocusProvider>
            <div className="min-h-dvh bg-background text-fg">
              {/* One route-derived navigation rail; focused mode only changes its presentation. */}
              <WorkspaceRail />
              <div className="min-w-0 md:pl-(--rail-w) lg:pl-(--shell-nav-w)">
                <TopBar />
                <main className="mx-auto flex w-full min-w-0 max-w-[1800px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
                  {children}
                </main>
              </div>
              <HebyQuickPanelClient />
            </div>
          </HebyFocusProvider>
        </HebyVoiceProvider>
      </HebySurfaceProvider>
    </RoleProvider>
  );
}
