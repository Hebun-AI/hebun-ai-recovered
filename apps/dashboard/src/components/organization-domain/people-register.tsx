/*
 * The Organizational People Register — WHO IS IN THIS ORGANIZATION, as a product surface (OSA-4).
 *
 * THIS COMPONENT HOLDS NO AUTHORITY AND PERFORMS NO READ. It receives what the page already read on
 * the server. It imports TYPES only, and there is no action to call: OSA-4 adds no writer, because
 * membership is written by the released Membership Authority through invitation and revocation, and
 * this milestone gives nobody a second way to do it.
 *
 *     A REGISTER IS NOT AN AUTHORITY.        LISTED != AUTHORIZED.
 *
 * ── IT COMPOSES TWO AUTHORITIES AND MERGES NEITHER ──────────────────────────
 *
 * Identity says who is a member. The placement authority says who works where. Both answers arrive
 * here separately and are rendered side by side, exactly as this page already composes department
 * owners with their labels. No record gains a field, and nothing is persisted.
 *
 * ── AND ABSENCE IS ONLY EVER READ AS ABSENCE WHEN IT IS SAFE TO ─────────────
 *
 * "This person is not placed anywhere" is inferred from their ABSENCE in the placement register,
 * which is only true when that register actually answered AND was not truncated. When it is
 * unavailable, or bounded, the surface says placement is unknown for this person rather than
 * saying they are placed nowhere.
 *
 *     UNAVAILABLE != NONE      TRUNCATED != COMPLETE      UNPLACED != NOT A MEMBER
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBlock } from "@/components/ui/state-block";
import type { PeopleRegister } from "@/features/auth-runtime/people-register-read.server";
import type { HumanLabel } from "@/features/auth-runtime/human-label-read.server";
import type { PlacementRegister } from "@/features/organization-authority/read-placement.server";

/** Said when Identity holds no readable name. Never replaced by a guess. */
const LABEL_UNAVAILABLE = "name unavailable";

export interface PeopleRegisterPanelProps {
  readonly register: PeopleRegister;
  /** Names for the humans the REGISTER already names. May be absent for any of them. */
  readonly names: readonly HumanLabel[];
  /** The placement authority's own answer, composed here and never merged into the register. */
  readonly placements: PlacementRegister;
}

export function PeopleRegisterPanel({ register, names, placements }: PeopleRegisterPanelProps) {
  const nameFor = (id: string): string | undefined =>
    names.find((entry) => entry.userId === id)?.label;

  /*
   * Placement may only be reported as ABSENT when the placement register both answered and listed
   * everything it holds. Anything else is unknown, and says so.
   */
  const placementKnown = placements.status === "available" && !placements.truncated;
  const placementFor = (id: string): { name: string; inService: boolean } | null => {
    if (placements.status !== "available") return null;
    const found = placements.placements.find((placement) => placement.userId === id);
    return found ? { name: found.departmentName, inService: found.departmentInService } : null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who is in this organization</CardTitle>
        <CardDescription>
          The people whose membership of this organization Hebun records as in force. Membership in
          Hebun is not employment — Hebun holds no contract, no start date and no HR record of any
          kind, and the date shown is when Hebun&rsquo;s membership record was created. Being listed
          here grants nobody anything: no permission, no role, no authority and no approval right.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {register.status !== "available" ? (
          <StateBlock tone="unavailable" title="People unavailable" description={register.detail} />
        ) : (
          <>
            <p className="text-xs leading-5 text-fg-secondary">{register.detail}</p>

            {register.people.length > 0 ? (
              <ul className="space-y-2">
                {register.people.map((person) => {
                  const department = placementFor(person.userId);
                  return (
                    <li
                      key={person.membershipId}
                      className="rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium text-fg">
                          {nameFor(person.userId) ?? (
                            <span className="italic">{LABEL_UNAVAILABLE}</span>
                          )}
                        </span>
                        <span className="font-mono text-xs text-fg-muted">{person.userId}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-fg-secondary">
                        {department !== null ? (
                          <>
                            Recorded as working in{" "}
                            <span className="font-medium text-fg">{department.name}</span>.
                            {department.inService
                              ? ""
                              : " That department is retired from service; the placement is kept so the record survives."}
                          </>
                        ) : placementKnown ? (
                          "This organization has recorded no department for this person. They are a member; where they work is simply not recorded."
                        ) : (
                          "Where this person works is unknown — Hebun could not read the full placement register, so this is not a statement that they are placed nowhere."
                        )}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-fg-muted">
                        Membership record created {person.membershipRecordedAt}. Not a hire date.
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
