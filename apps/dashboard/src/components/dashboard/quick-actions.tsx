import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  Workflow,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Plug,
} from "lucide-react";
import { ActionStateBadge, type ActionState } from "@/components/dashboard/action-state-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const actions = [
  {
    /*
     * AGENT-ID-0.1 made this entry's old copy false.
     *
     * It used to read "Coming Soon — visible but intentionally disabled until live creation flows
     * exist", and that was TRUE for as long as no writer could establish a durable agent identity.
     * A durable, human-owned creation ceremony now exists and is deployed, so a disabled tile
     * telling a Director that live creation does not exist is a stale claim on the surface that
     * Director uses most.
     *
     * It routes, and it promises nothing beyond routing: clicking opens Agents, where the ceremony
     * states its own consequences and is confirmed. This tile creates nothing.
     */
    label: "Create Agent",
    icon: Bot,
    href: "/agents",
    state: "opensPage" as ActionState,
    description:
      "Opens Agents, where a human owner can establish this organization's durable agent identity. Creation is a one-shot ceremony, confirmed there.",
  },
  {
    label: "New Workflow",
    icon: Workflow,
    href: "/workflows",
    state: "opensPage" as ActionState,
    description: "Routes to the workflow surface for inspection and setup.",
  },
  {
    label: "Review Approvals",
    icon: CheckCircle2,
    href: "/approvals",
    state: "opensPage" as ActionState,
    description: "Takes you to the current approval queue.",
  },
  {
    label: "Sync Integrations",
    icon: Plug,
    href: "/integrations",
    state: "simulation" as ActionState,
    description: "Inspection only. No real sync runs from the dashboard.",
  },
  {
    label: "Replay Event",
    icon: RefreshCw,
    href: "/events",
    state: "simulation" as ActionState,
    description: "Historical review only. Event replay is not live.",
  },
  {
    label: "Open Docs",
    icon: BookOpen,
    href: "/knowledge",
    state: "opensPage" as ActionState,
    description: "Opens the knowledge surface for deeper reference.",
  },
];

export function QuickActions() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;

          if (!action.href) {
            return (
              <button
                key={action.label}
                type="button"
                disabled
                className="flex min-h-32 cursor-not-allowed flex-col items-start gap-3 rounded-md border bg-surface-sunken p-4 text-left opacity-60"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <Icon className="size-4 text-primary" />
                  <ActionStateBadge state={action.state} />
                </div>
                <div className="space-y-1">
                  <span className="block text-sm font-medium text-fg">{action.label}</span>
                  <p className="text-xs leading-5 text-fg-secondary">{action.description}</p>
                </div>
              </button>
            );
          }

          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex min-h-32 flex-col items-start gap-3 rounded-md border bg-surface-sunken p-4 text-left transition-colors duration-(--dur-fast) hover:border-border-strong hover:bg-surface-raised"
            >
              <div className="flex w-full items-start justify-between gap-3">
                <Icon className="size-4 text-primary" />
                <ActionStateBadge state={action.state} />
              </div>
              <div className="space-y-1">
                <span className="block text-sm font-medium text-fg">{action.label}</span>
                <p className="text-xs leading-5 text-fg-secondary">{action.description}</p>
              </div>
              <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                Open page
                <ArrowUpRight className="size-3.5" />
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
