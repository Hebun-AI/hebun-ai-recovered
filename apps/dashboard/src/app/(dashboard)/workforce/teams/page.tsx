import { PageHeader } from "@/components/layout/page-header";
import { TeamsRolesSurface } from "@/components/workforce-workspace/teams-roles-surface";
import { getTeamsRolesModel } from "@/features/workforce/teams-roles-model";

export const metadata = { title: "Teams & Roles — Hebun AI" };

/*
 * Teams & Roles — authoritative Workforce surface (UI Phase 25C).
 *
 * How the workforce is logically organized, drawn only from the seeded agent-definition registry.
 * Seeded department groupings and declared roles with honest provenance; no human workforce, no
 * live staffing, no reporting hierarchy — none fabricated. No mutation, no execution, no secret.
 */

export default function TeamsRolesPage() {
  const model = getTeamsRolesModel();

  return (
    <>
      <PageHeader
        title="Teams & Roles"
        context={`${model.groupingCount} seeded groupings · ${model.roleCount} declared roles · no human workforce connected`}
      />
      <TeamsRolesSurface model={model} />
    </>
  );
}
