import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Decision, Priority, Recommendation } from "@/features/director-workspace/mock";
import { WorkspaceCard } from "./workspace-card";

export function PrioritiesPanel({ items }: { items: Priority[] }) {
  return (
    <WorkspaceCard title="Today’s priorities" description="Ranked by urgency and enterprise impact.">
      <ol className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.rank} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">{item.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{item.title}</p>
              <p className="mt-1 text-xs text-fg-secondary">{item.domain} · {item.dueState}</p>
            </div>
            <Badge variant={item.severity === "Critical" ? "error" : item.severity === "High" ? "warning" : "neutral"}>{item.severity}</Badge>
          </li>
        ))}
      </ol>
    </WorkspaceCard>
  );
}

export function PendingDecisionsPanel({ items }: { items: Decision[] }) {
  return (
    <WorkspaceCard title="Pending decisions" description="Your review is required before anything proceeds.">
      <div className="divide-y divide-border">
        {items.map((item) => (
          <article key={item.title} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-fg">{item.title}</h3><p className="mt-1 text-xs leading-5 text-fg-secondary">{item.impact}</p></div>
              <CircleDashed className="size-4 shrink-0 text-warning" aria-label="Pending" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-fg-secondary">
              <span>{item.status} · {item.deadline}</span>
              <Button variant="ghost" size="sm" aria-label={`Review ${item.title}`} disabled>Review <ArrowRight className="size-3.5" /></Button>
            </div>
          </article>
        ))}
      </div>
    </WorkspaceCard>
  );
}

export function HebyRecommendationsPanel({ items }: { items: Recommendation[] }) {
  return (
    <WorkspaceCard title="Heby recommendations" description="Advisory only — no action is taken without your approval." action={<Badge variant="info">Advisory</Badge>}>
      <div className="divide-y divide-border">
        {items.map((item) => (
          <article key={item.recommendation} className="py-4 first:pt-0 last:pb-0">
            <div className="flex gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-sm font-medium leading-6 text-fg">{item.recommendation}</p></div>
            <div className="mt-3 flex flex-wrap items-center gap-2 pl-7 text-xs text-fg-secondary">
              <Badge variant={item.impact === "High" ? "warning" : "neutral"}>{item.impact} impact</Badge>
              <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5" />{item.evidence}</span>
              <button type="button" disabled className="ml-auto font-medium text-primary disabled:cursor-not-allowed disabled:opacity-60">Review later</button>
            </div>
          </article>
        ))}
      </div>
    </WorkspaceCard>
  );
}

export function QuickActionsPanel({ items }: { items: readonly { label: string; href: string }[] }) {
  return (
    <WorkspaceCard title="Quick actions" description="Navigate to bounded review and management surfaces.">
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => <Link key={item.label} href={item.href} className="flex min-h-11 items-center justify-between rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">{item.label}<ArrowRight className="size-4 text-fg-muted" /></Link>)}
      </div>
    </WorkspaceCard>
  );
}
