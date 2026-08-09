import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TeamsRolesModel } from "@/features/workforce/teams-roles-model";

/*
 * Teams & Roles surface (UI Phase 25C). How the workforce is logically organized — drawn only
 * from the seeded agent-definition registry. It shows SEEDED department groupings and declared
 * roles with honest provenance, and states plainly what does NOT exist: no human workforce, no
 * live staffing, no reporting hierarchy. It fabricates no org chart and claims no authoritative
 * team structure. No mutation control, no execution, no secret.
 */

export function TeamsRolesSurface({ model }: { model: TeamsRolesModel }) {
  return (
    <div className="flex flex-col gap-6">
      {/* What does not exist — stated first, honestly. */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>How the workforce is organized</CardTitle>
            <span className="text-xs text-fg-muted">{model.provenanceNote}</span>
          </div>
          <Badge variant="info">seeded groupings</Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {model.honestEmpty.map((fact) => (
            <div key={fact.concept} className="rounded-md border bg-surface-sunken p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                {fact.concept}
                <Badge variant="neutral">none</Badge>
              </p>
              <p className="text-xs leading-5 text-fg-muted">{fact.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Seeded department groupings — seed categories, not authoritative teams. */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Seeded Groupings</CardTitle>
            <span className="text-xs text-fg-muted">
              {model.groupingCount} groupings across {model.seededDefinitionCount} seeded definitions —
              seed categories, not authoritative teams.
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="ui-table-wrap">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-4 py-3 font-medium">Grouping (seeded)</th>
                  <th className="px-4 py-3 font-medium">Definitions</th>
                  <th className="px-4 py-3 font-medium">Declared roles</th>
                </tr>
              </thead>
              <tbody>
                {model.seededGroupings.map((group) => (
                  <tr key={group.department} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-fg">{group.department}</td>
                    <td className="px-4 py-3 tabular-nums text-fg-secondary">{group.definitionCount}</td>
                    <td className="px-4 py-3 tabular-nums text-fg-secondary">{group.roles.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Declared roles across seeded definitions. */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Declared Roles</CardTitle>
            <span className="text-xs text-fg-muted">
              {model.roleCount} distinct roles declared on seeded definitions. A role is not a
              headcount and not an authority grant.
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="ui-table-wrap">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-4 py-3 font-medium">Role (declared)</th>
                  <th className="px-4 py-3 font-medium">Definitions</th>
                  <th className="px-4 py-3 font-medium">Grouping</th>
                </tr>
              </thead>
              <tbody>
                {model.declaredRoles.map((role) => (
                  <tr key={role.role} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-fg">{role.role}</td>
                    <td className="px-4 py-3 tabular-nums text-fg-secondary">{role.definitionCount}</td>
                    <td className="px-4 py-3 text-fg-secondary">{role.departments.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
