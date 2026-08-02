import { ArrowRight, CircleAlert, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WorkspaceCard } from "@/components/director-workspace/workspace-card";
import type { EnterpriseRelationship, OrganizationRole, ResponsibilityOverlap } from "@/features/organization-domain/mock";

const coverageVariant = { Clear: "success", Shared: "warning", Gap: "error" } as const;
const relationshipVariant = { Strong: "success", Developing: "warning", "At Risk": "error" } as const;

export function RolesAndResponsibilities({ roles, overlaps }: { roles: OrganizationRole[]; overlaps: ResponsibilityOverlap[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
      <WorkspaceCard title="Roles and responsibilities" description="Who owns what, with explicit accountability coverage.">
        <div className="divide-y divide-border">{roles.map((role) => <article key={role.title} className="py-4 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-fg">{role.title}</h3><p className="mt-1 text-xs font-medium text-primary">{role.owner}</p></div><Badge variant={coverageVariant[role.coverage]}>{role.coverage}</Badge></div><p className="mt-2 text-xs leading-5 text-fg-secondary">{role.scope}</p><div className="mt-2 flex flex-wrap gap-1.5">{role.accountabilities.map((item) => <span key={item} className="rounded-full border border-border bg-surface-sunken px-2 py-1 text-[0.65rem] text-fg-secondary">{item}</span>)}</div></article>)}</div>
      </WorkspaceCard>
      <WorkspaceCard title="Responsibility overlaps" description="Shared ownership requiring coordination or clarification." action={<CircleAlert className="size-5 text-warning" />}>
        <div className="space-y-3">{overlaps.map((item) => <article key={item.responsibility} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><h3 className="text-xs font-semibold text-fg">{item.responsibility}</h3><Badge variant={item.status === "Clarify" ? "warning" : "success"}>{item.status}</Badge></div><p className="mt-2 text-[0.7rem] font-medium text-primary">{item.owners.join(" + ")}</p><p className="mt-1 text-xs leading-5 text-fg-secondary">{item.impact}</p></article>)}</div>
      </WorkspaceCard>
    </div>
  );
}

export function EnterpriseRelationshipsPanel({ items }: { items: EnterpriseRelationship[] }) {
  return (
    <WorkspaceCard title="Enterprise relationships" description="How departments and business units exchange responsibility, evidence, and outcomes." action={<Network className="size-5 text-primary" />}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={`${item.source}-${item.target}`} className="rounded-xl border border-border bg-surface-sunken/35 p-4"><div className="flex items-center justify-between gap-3"><Badge variant={relationshipVariant[item.strength]}>{item.strength}</Badge><span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Relationship</span></div><div className="mt-4 flex items-center gap-2 text-xs font-semibold text-fg"><span>{item.source}</span><ArrowRight className="size-3.5 shrink-0 text-primary" /><span>{item.target}</span></div><p className="mt-2 text-xs font-medium text-primary">{item.relationship}</p><p className="mt-2 text-[0.7rem] leading-4 text-fg-secondary">{item.context}</p></article>)}</div>
      <p className="mt-4 text-xs leading-5 text-fg-muted">Organization Domain preview only. Relationships are typed mock projections and do not represent Runtime or graph infrastructure.</p>
    </WorkspaceCard>
  );
}
