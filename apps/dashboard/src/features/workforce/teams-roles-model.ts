/*
 * workforce/teams-roles-model.ts — the authoritative Teams & Roles read model (UI Phase 25C).
 *
 * Workforce answers WHO can perform work; Teams & Roles answers HOW that workforce is logically
 * organized. The only structural material in the repository is the seeded agent-definition
 * registry (agent-crud), whose records carry a `department` grouping and a declared `role`. This
 * model surfaces exactly that — as SEEDED groupings and declared roles — and nothing more.
 *
 * Honesty contract (no-fake-data):
 *   - There is NO human workforce, NO live staffing, NO real reporting hierarchy, NO availability,
 *     utilization, headcount, or performance. Those render as explicit honest-empty facts.
 *   - The department groupings are SEED CATEGORIES on agent definitions — NOT an authoritative
 *     organizational team structure. They are never presented as real teams.
 *   - It reads the same single seam as the Agents truth surface (agent-crud snapshot); it never
 *     creates a second source of truth and never reads the simulated runtime projection.
 */

import { getSnapshot } from "@/features/agent-crud/agent-adapter";
import type { AgentCrudRecord } from "@/features/agent-crud/types";

export interface SeededGroupingView {
  /** The seeded department grouping label. */
  readonly department: string;
  /** How many active seeded definitions carry this grouping. */
  readonly definitionCount: number;
  /** Distinct declared roles inside the grouping. */
  readonly roles: readonly string[];
}

export interface DeclaredRoleView {
  readonly role: string;
  readonly definitionCount: number;
  readonly departments: readonly string[];
}

export interface HonestEmptyFact {
  readonly concept: string;
  readonly detail: string;
}

export interface TeamsRolesModel {
  /** Always false — no human workforce identity is connected. */
  readonly humanWorkforceConnected: boolean;
  /** Always false — no live staffing/availability exists. */
  readonly liveStaffing: boolean;
  /** Always false — no real reporting hierarchy exists. */
  readonly reportingHierarchy: boolean;
  readonly seededDefinitionCount: number;
  readonly groupingCount: number;
  readonly roleCount: number;
  /** SEEDED department groupings — seed categories, not authoritative teams. */
  readonly seededGroupings: readonly SeededGroupingView[];
  /** Declared roles across the seeded definitions. */
  readonly declaredRoles: readonly DeclaredRoleView[];
  /** What deliberately does NOT exist here. */
  readonly honestEmpty: readonly HonestEmptyFact[];
  readonly provenanceNote: string;
}

const HONEST_EMPTY: readonly HonestEmptyFact[] = [
  { concept: "Human workforce", detail: "No human employee or identity model is connected." },
  { concept: "Live staffing", detail: "No team is staffed, available, or on-call — none is fabricated." },
  { concept: "Reporting hierarchy", detail: "No real reporting or management hierarchy exists." },
  { concept: "Headcount & utilization", detail: "No headcount, utilization, productivity, or performance is tracked." },
];

export function getTeamsRolesModel(): TeamsRolesModel {
  const active = getSnapshot().filter((record: AgentCrudRecord) => record.lifecycleStatus === "active");

  const byDepartment = new Map<string, { count: number; roles: Set<string> }>();
  const byRole = new Map<string, { count: number; departments: Set<string> }>();

  for (const record of active) {
    const dep = byDepartment.get(record.department) ?? { count: 0, roles: new Set<string>() };
    dep.count += 1;
    dep.roles.add(record.role);
    byDepartment.set(record.department, dep);

    const role = byRole.get(record.role) ?? { count: 0, departments: new Set<string>() };
    role.count += 1;
    role.departments.add(record.department);
    byRole.set(record.role, role);
  }

  const seededGroupings: SeededGroupingView[] = [...byDepartment.entries()]
    .map(([department, value]) => ({
      department,
      definitionCount: value.count,
      roles: [...value.roles].sort(),
    }))
    .sort((a, b) => a.department.localeCompare(b.department));

  const declaredRoles: DeclaredRoleView[] = [...byRole.entries()]
    .map(([role, value]) => ({
      role,
      definitionCount: value.count,
      departments: [...value.departments].sort(),
    }))
    .sort((a, b) => a.role.localeCompare(b.role));

  return {
    humanWorkforceConnected: false,
    liveStaffing: false,
    reportingHierarchy: false,
    seededDefinitionCount: active.length,
    groupingCount: seededGroupings.length,
    roleCount: declaredRoles.length,
    seededGroupings,
    declaredRoles,
    honestEmpty: HONEST_EMPTY,
    provenanceNote:
      "Groupings and roles are SEEDED categories declared on agent definitions — not an authoritative organizational team structure, and not a human workforce.",
  };
}
