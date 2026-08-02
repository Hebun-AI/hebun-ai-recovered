import { Building2, GitBranch, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WorkspaceCard } from "@/components/director-workspace/workspace-card";
import type { BusinessUnitProjection as BusinessUnit, DepartmentProjection as OrganizationDepartment, ReportingRelationshipProjection as ReportingLevel } from "@/features/enterprise-projections";

const healthVariant = { Healthy: "success", Watch: "warning", Attention: "error" } as const;

export function DepartmentsPanel({ items }: { items: OrganizationDepartment[] }) {
  return (
    <WorkspaceCard title="Departments and teams" description="Department purpose, accountable leadership, teams, and current attention.">
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{items.map((department) => <article key={department.name} className="rounded-xl border border-border bg-surface-sunken/35 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-fg">{department.name}</h3><p className="mt-1 text-xs font-medium text-primary">{department.executive}</p></div><Badge variant={healthVariant[department.health]}>{department.health}</Badge></div><p className="mt-3 text-xs leading-5 text-fg-secondary">{department.purpose}</p><div className="mt-3 flex items-center gap-2 text-xs text-fg-muted"><UsersRound className="size-3.5" />{department.headcount} people · {department.teams.length} teams</div><div className="mt-3 space-y-2 border-t border-border pt-3">{department.teams.map((team) => <div key={team.name}><p className="text-xs font-semibold text-fg">{team.name} · {team.lead}</p><p className="mt-0.5 text-[0.7rem] text-fg-secondary">{team.responsibility}</p></div>)}</div><p className="mt-3 rounded-lg bg-warning-subtle px-3 py-2 text-[0.7rem] leading-4 text-warning"><span className="font-semibold">Attention:</span> {department.attention}</p></article>)}</div>
    </WorkspaceCard>
  );
}

export function ReportingAndBusinessUnits({ reporting, units }: { reporting: ReportingLevel[]; units: BusinessUnit[] }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <WorkspaceCard title="Reporting structure" description="How accountability moves from enterprise direction to teams." action={<GitBranch className="size-5 text-primary" />}>
        <ol className="space-y-2">{reporting.map((level, index) => <li key={level.level} className="relative rounded-lg border border-border p-3 pl-11"><span className="absolute left-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">{index + 1}</span><p className="text-xs font-semibold text-fg">{level.level}</p><p className="mt-1 text-xs text-primary">{level.members.join(" · ")}</p><p className="mt-1 text-[0.7rem] leading-4 text-fg-secondary">{level.purpose}</p></li>)}</ol>
      </WorkspaceCard>
      <WorkspaceCard title="Business units" description="The strategic groupings through which departments create enterprise value." action={<Building2 className="size-5 text-primary" />}>
        <div className="space-y-3">{units.map((unit) => <article key={unit.name} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-semibold text-fg">{unit.name}</h3><p className="mt-1 text-[0.7rem] font-medium text-primary">{unit.leader}</p></div><span className="text-sm font-semibold text-fg tabular-nums">{unit.readiness}%</span></div><p className="mt-2 text-xs leading-5 text-fg-secondary">{unit.mandate}</p><p className="mt-2 text-[0.7rem] text-fg-muted">Departments: {unit.departments.join(" · ")}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-label={`${unit.name} readiness`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={unit.readiness}><div className="h-full rounded-full bg-primary" style={{ width: `${unit.readiness}%` }} /></div></article>)}</div>
      </WorkspaceCard>
    </div>
  );
}
