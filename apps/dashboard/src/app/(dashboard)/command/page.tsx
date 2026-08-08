import { WorkspaceLanding } from "@/components/layout/workspace-landing";

export const metadata = { title: "Command — Hebun AI" };

/*
 * Command landing — the default authenticated surface (/ → /command).
 * This establishes the boundary where the future Command Center will live.
 * The full executive dashboard is a later UI phase; no operational data is
 * fabricated here.
 */

export default function CommandPage() {
  return (
    <WorkspaceLanding id="command">
      <div className="mb-6 rounded-lg border border-dashed border-border bg-surface-sunken p-4">
        <p className="text-sm font-semibold text-fg">Command Center — coming in a later phase</p>
        <p className="mt-1 text-xs leading-5 text-fg-secondary">
          This is the executive operating surface and the default landing. The
          full command dashboard (attention, briefings, health, live activity)
          is built in a follow-up phase. The destinations below route to the
          existing operating surfaces today.
        </p>
      </div>
    </WorkspaceLanding>
  );
}
