/*
 * "What is this department?" — the three released facts about one part of an organization, composed
 * on one surface (ORG-1).
 *
 * THIS COMPONENT HOLDS NO AUTHORITY, PERFORMS NO READ, AND OFFERS NO CONTROL. It receives what the
 * page already read on the server, imports TYPES only, and every act — recording a department,
 * placing a human, recording work — is still performed by the panel that owns it.
 *
 * ── IT COMPOSES; IT OWNS NOTHING ─────────────────────────────────────────────
 *
 *   which departments exist, and who owns each   Organization Structure Authority
 *   who is recorded as working in one            Departmental Placement
 *   which work names one                         Organizational Work Authority
 *   what a human is called                       Identity (Human Legibility Reach)
 *
 * Four authorities, four answers, grouped by department. THE GROUPING IS DERIVED; every fact inside
 * it is authoritative to its owner, and this component invents no relationship between them.
 *
 * ── THE ONE INFERENCE IT REFUSES TO MAKE ─────────────────────────────────────
 *
 * A department here shows PEOPLE and WORK side by side, and the obvious wrong reading is that those
 * people do that work. WORK-1 and WORK-2 both state the opposite in their own words — a work item
 * naming a department is a reference, not an assignment, and the accountable human on a work item
 * need not be placed in that department at all. So the panel says so, on the department itself,
 * rather than leaving a reader to infer it from adjacency.
 *
 *     PLACED HERE      != DOES THIS WORK
 *     WORK NAMES A DEPARTMENT != THE DEPARTMENT'S PEOPLE PERFORM IT
 *     ACCOUNTABLE      != PLACED HERE
 *
 * ── ABSENCE IS ONLY READ AS ABSENCE WHEN IT IS SAFE TO ───────────────────────
 *
 * "Nobody is placed here" and "no work names this department" are inferred from an EMPTY SLICE of a
 * register — true only when that register actually answered AND was not truncated. When either is
 * unavailable or bounded, the panel says the answer is unknown for this department rather than
 * reporting a zero.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBlock } from "@/components/ui/state-block";
import type { OrganizationStructure } from "@/features/organization-authority/contracts";
import type { PlacementRegister } from "@/features/organization-authority/read-placement.server";
import type { WorkRegister } from "@/features/organizational-work/read-work.server";
import type { HumanLabel } from "@/features/auth-runtime/human-label-read.server";

/** Said when Identity holds no readable name. Never replaced by a guess. */
const LABEL_UNAVAILABLE = "name unavailable";

export interface DepartmentCompositionPanelProps {
  readonly structure: OrganizationStructure;
  readonly placements: PlacementRegister;
  readonly work: WorkRegister;
  /** Labels for every identifier these registers already name. May be absent for any of them. */
  readonly labels: readonly HumanLabel[];
}

export function DepartmentCompositionPanel({
  structure,
  placements,
  work,
  labels,
}: DepartmentCompositionPanelProps) {
  const nameFor = (id: string): string | undefined =>
    labels.find((entry) => entry.userId === id)?.label;

  /*
   * A SLICE MAY ONLY BE READ AS COMPLETE WHEN ITS REGISTER ANSWERED IN FULL. A truncated register
   * holds rows this page never saw, so an empty slice from one proves nothing about a department.
   */
  const placementsComplete = placements.status === "available" && !placements.truncated;
  const workComplete = work.status === "available" && !work.truncated;

  if (structure.status !== "available") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>What each department is</CardTitle>
        </CardHeader>
        <CardContent>
          <StateBlock
            tone="unavailable"
            title="Structure unavailable"
            description={structure.detail}
          />
        </CardContent>
      </Card>
    );
  }

  const departments = structure.departments;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What each department is</CardTitle>
        <CardDescription>
          Each part of this organization with the three things Hebun records about it: who is
          accountable for it, who is recorded as working in it, and which work names it. These are
          four separate authorities shown together — the grouping is composed here and owns nothing.
          Work naming a department is a reference, not an assignment: it does not say the people
          placed here perform it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {departments.length === 0 ? (
          <p className="text-xs leading-5 text-fg-secondary">
            This organization has recorded no departments. Hebun looked and found none — a measured
            answer, not an unread one.
          </p>
        ) : (
          <ul className="space-y-3">
            {departments.map((department) => {
              const placedHere =
                placements.status === "available"
                  ? placements.placements.filter((p) => p.departmentId === department.departmentId)
                  : [];
              const workHere =
                work.status === "available"
                  ? work.items.filter(
                      (item) => item.department?.departmentId === department.departmentId,
                    )
                  : [];
              const liveWorkHere = workHere.filter((item) => item.inService);

              return (
                <li
                  key={department.departmentId}
                  className="rounded-md border border-border px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-fg">{department.name}</span>
                    <span className="font-mono text-xs text-fg-muted">[{department.slug}]</span>
                    {!department.inService ? (
                      <span className="text-xs text-fg-secondary">retired from service</span>
                    ) : null}
                  </div>

                  {/* ── ACCOUNTABLE ───────────────────────────────────────── */}
                  <p className="mt-1 text-xs leading-5 text-fg-secondary">
                    {department.owner ? (
                      <>
                        Accountable:{" "}
                        <span className="text-fg">
                          {nameFor(department.owner.actorId) ?? LABEL_UNAVAILABLE}
                        </span>{" "}
                        <span className="font-mono text-fg-muted">{department.owner.actorId}</span>
                        {department.owner.currentlyActiveMember
                          ? ""
                          : " — recorded accountable, and no longer an active member of this organization. The record still names them."}
                      </>
                    ) : (
                      "Nobody has been made accountable for this department yet."
                    )}
                  </p>

                  {/* ── PLACED HERE ───────────────────────────────────────── */}
                  <p className="mt-1 text-xs leading-5 text-fg-secondary">
                    {placements.status !== "available" ? (
                      "Who works here is unknown — Hebun could not read the placement register. That is not a statement that nobody works here."
                    ) : placedHere.length > 0 ? (
                      <>
                        Recorded as working here:{" "}
                        <span className="text-fg">
                          {placedHere
                            .map((p) => nameFor(p.userId) ?? LABEL_UNAVAILABLE)
                            .join(", ")}
                          .
                        </span>
                        {placementsComplete
                          ? ""
                          : " The placement register is bounded, so others may be placed here and not listed."}
                      </>
                    ) : placementsComplete ? (
                      "This organization has recorded nobody as working here."
                    ) : (
                      "The placement register is bounded, so whether anybody is placed here is unknown."
                    )}
                  </p>

                  {/* ── WORK NAMING IT ────────────────────────────────────── */}
                  <p className="mt-1 text-xs leading-5 text-fg-secondary">
                    {work.status !== "available" ? (
                      "Which work names this department is unknown — Hebun could not read the work register. That is not a statement that it carries none."
                    ) : liveWorkHere.length > 0 ? (
                      <>
                        Work naming this department:{" "}
                        <span className="text-fg">
                          {liveWorkHere.map((item) => item.title).join("; ")}.
                        </span>{" "}
                        Every state is declared by a human — Hebun observed nothing.
                        {workComplete
                          ? ""
                          : " The work register is bounded, so more may name it."}
                      </>
                    ) : workComplete ? (
                      "No work in service names this department."
                    ) : (
                      "The work register is bounded, so whether any work names this department is unknown."
                    )}
                  </p>

                  {/*
                    * THE DENIAL, ON THE DEPARTMENT ITSELF. Rendered only where both halves are
                    * present, because that is the only place the wrong inference is available.
                    */}
                  {placedHere.length > 0 && liveWorkHere.length > 0 ? (
                    <p className="mt-1 text-xs leading-5 text-fg-muted">
                      People and work are shown together and are not connected: Hebun does not record
                      that the people placed here perform this work, and a work item&rsquo;s
                      accountable human need not be placed in this department at all.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
