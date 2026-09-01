"use client";

/*
 * Departmental placement — WHO WORKS WHERE, as a product surface.
 *
 * THIS COMPONENT HOLDS NO AUTHORITY AND PERFORMS NO READ. It receives what the page already read on
 * the server and calls two released server actions. It imports the placement TYPES only; a client
 * component able to call the read would be a database handle in a browser bundle.
 *
 * ── IT RENDERS WHAT HEBUN RECORDED, AND SAYS WHAT THAT IS NOT ────────────────
 *
 * A placement is a DECLARATION by an authorized human, never an observation, and it confers
 * nothing. The surface says so once, plainly, rather than leaving a reader to infer that "works in
 * Engineering" means a role, a reporting line or a permission.
 *
 * ── THE IDENTIFIER IS NEVER ERASED ──────────────────────────────────────────
 *
 * Every placed human is shown with their identifier beside whatever they are called, and a human
 * Identity cannot name reads as `name unavailable` — never as a blank, never as a guess. That is
 * the released posture of the department owner control, kept.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import {
  placeHumanInDepartmentAction,
  withdrawPlacementAction,
} from "@/app/(dashboard)/director/organization/actions";
import type { PlacementWriteResult } from "@/features/organization-authority/write-placement.server";
import type { PlacementRefusal } from "@/features/organization-authority/placement-contracts";
import type { PlacementRegister } from "@/features/organization-authority/read-placement.server";
import type { OrganizationStructure } from "@/features/organization-authority/contracts";
import type {
  HumanLabel,
  SelectableMembersRead,
} from "@/features/auth-runtime/human-label-read.server";

/** Said when Identity holds no readable name. Never replaced by a guess. */
const LABEL_UNAVAILABLE = "name unavailable";

/**
 * What each refusal MEANS to the person reading it. One sentence, no jargon, and never a
 * re-interpretation: each is the writer's own reason rendered for a human.
 */
const REFUSAL_SENTENCE: Record<PlacementRefusal, string> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so nothing was recorded.",
  "not-authorized":
    "Recording where someone works requires this organization's Governance authority. Nothing was recorded.",
  "authority-unavailable":
    "Hebun could not reach the placement authority. Nothing was recorded — this is not a refusal of the act itself.",
  "department-unresolved": "No department of this organization carries that identity.",
  "department-retired":
    "That department is retired from service, so nobody can be recorded as working in it.",
  "human-not-active-member":
    "The person named is not an active member of this organization, so no placement was recorded.",
  "already-placed": "This person is already recorded in that department. Nothing changed.",
  "not-placed": "This organization has not recorded a placement for that person.",
};

const MEMBERS_UNAVAILABLE_SENTENCE: Record<
  Extract<SelectableMembersRead, { status: "unavailable" }>["reason"],
  string
> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so no members can be offered.",
  "not-authorized": "Placing someone requires this organization's Governance authority.",
  "authority-unavailable":
    "Hebun could not reach the member list. This says nothing about who belongs to this organization.",
};

export interface DepartmentalPlacementPanelProps {
  readonly register: PlacementRegister;
  readonly structure: OrganizationStructure;
  readonly members: SelectableMembersRead;
  /** Names for the humans the REGISTER already names. Provider-safe; may be absent. */
  readonly placedNames: readonly HumanLabel[];
}

export function DepartmentalPlacementPanel({
  register,
  structure,
  members,
  placedNames,
}: DepartmentalPlacementPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<PlacementWriteResult | null>(null);
  const [userId, setUserId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const nameFor = (id: string): string | undefined =>
    placedNames.find((entry) => entry.userId === id)?.label;

  const run = (action: () => Promise<PlacementWriteResult>) => {
    startTransition(async () => {
      const result = await action();
      setOutcome(result);
      if (result.status !== "refused") {
        setUserId("");
        setDepartmentId("");
        router.refresh();
      }
    });
  };

  const inServiceDepartments =
    structure.status === "available"
      ? structure.departments.filter((department) => department.inService)
      : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who works where</CardTitle>
        <CardDescription>
          Which department this organization has recorded each person as working in. A placement is
          recorded by an authorized human — Hebun did not observe anyone working anywhere. It is not
          a role, not a job title, not a reporting line, not a manager and not a work assignment, and
          it grants no permission and no authority.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {register.status !== "available" ? (
          <StateBlock tone="unavailable" title="Placements unavailable" description={register.detail} />
        ) : (
          <>
            <p className="text-xs leading-5 text-fg-secondary">{register.detail}</p>

            {register.placements.length > 0 ? (
              <ul className="space-y-2">
                {register.placements.map((placement) => (
                  <li
                    key={placement.placementId}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-fg">
                        {nameFor(placement.userId) ?? (
                          <span className="italic">{LABEL_UNAVAILABLE}</span>
                        )}
                      </span>
                      <span className="font-mono text-xs text-fg-muted">{placement.userId}</span>
                      <span className="text-fg-secondary">works in</span>
                      <span className="font-medium text-fg">{placement.departmentName}</span>
                      <span className="font-mono text-xs text-fg-muted">
                        [{placement.departmentSlug}]
                      </span>
                    </div>
                    {!placement.currentlyActiveMember || !placement.departmentInService ? (
                      <p className="mt-1 text-xs leading-5 text-fg-secondary">
                        {!placement.currentlyActiveMember
                          ? "Recorded placed, and no longer an active member of this organization. The record still names them. "
                          : ""}
                        {!placement.departmentInService
                          ? "The department itself is retired from service."
                          : ""}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      disabled={pending}
                      onClick={() => run(() => withdrawPlacementAction({ userId: placement.userId }))}
                    >
                      Withdraw placement
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {members.status === "read" && members.members.length > 0 && inServiceDepartments.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <label className="flex-1 basis-48 text-xs text-fg-secondary">
                  Person
                  <select
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                  >
                    <option value="">Choose a member</option>
                    {members.members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex-1 basis-48 text-xs text-fg-secondary">
                  Department
                  <select
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                  >
                    <option value="">Choose a department</option>
                    {inServiceDepartments.map((department) => (
                      <option key={department.departmentId} value={department.departmentId}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || userId.trim() === "" || departmentId.trim() === ""}
                  onClick={() =>
                    run(() =>
                      placeHumanInDepartmentAction({
                        userId: userId.trim(),
                        departmentId: departmentId.trim(),
                      }),
                    )
                  }
                >
                  Record placement
                </Button>
              </div>
            ) : (
              <p className="border-t border-border pt-3 text-xs leading-5 text-fg-secondary">
                {members.status !== "read"
                  ? MEMBERS_UNAVAILABLE_SENTENCE[members.reason]
                  : inServiceDepartments.length === 0
                    ? "This organization has no department in service, so nobody can be placed yet."
                    : "This organization has no member who can be placed."}
              </p>
            )}
          </>
        )}

        {outcome ? (
          outcome.status === "refused" ? (
            <StateBlock
              tone="unavailable"
              title="Not recorded"
              description={REFUSAL_SENTENCE[outcome.reason]}
            />
          ) : (
            /*
             * A SUCCESS IS NOT A STATE BLOCK. Every `StateBlock` tone names a reason something is
             * missing; there is no success tone and inventing one here would give this surface a
             * vocabulary the design system does not have.
             */
            <p className="text-xs leading-5 text-fg-secondary">
              {outcome.status === "withdrawn"
                ? "Withdrawn. This organization no longer records that person as working in a department."
                : "Recorded. This organization now records that person as working in that department."}
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
