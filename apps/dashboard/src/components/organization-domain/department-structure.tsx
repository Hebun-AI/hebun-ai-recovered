"use client";

/*
 * Departments (OSA-1) — the ONE surface on this page that both states and changes organizational
 * structure.
 *
 * ── IT IS NOT THE MOCK PANEL BELOW IT ────────────────────────────────────────
 *
 * `/director/organization` has rendered a `DepartmentsPanel` since long before this milestone, and
 * it is a compiled-in illustration. This component is the opposite, and the page keeps both with a
 * line between them: everything here is a durable row read through the Organization Authority, and
 * the disclosure under the heading says so in words rather than by styling.
 *
 * A reader must never be choosing between two affordances that both look like "create a real
 * department", so the seeded panel is left labelled exactly as it was and this one names its own
 * authority.
 *
 * ── THREE STATES, NEVER TWO ──────────────────────────────────────────────────
 *
 *   unavailable            Hebun could not read the structural authority — NOT "no departments"
 *   available, empty       looked, found none
 *   available, departments the recorded structure
 *
 * The unavailable branch renders no form: offering a control whose outcome cannot be read back
 * would be offering an act with an invisible result.
 *
 * ── OWNERSHIP IS ATTRIBUTION, AND THE COPY SAYS SO ───────────────────────────
 *
 * The owner grants nothing — no permission, no approval right, no Governance authority — and that
 * sentence is on the surface, not only in a comment, because "owner" is the word a reader is most
 * likely to mistake for authority.
 *
 * ── HUMAN LEGIBILITY REACH — THE LABEL IS NOT THE KEY ────────────────────────
 *
 * Until this milestone this comment ended: "The owner is shown as an identifier: Hebun holds a
 * member COUNT and no roster, so this surface cannot resolve an id to a person and must not imply
 * it can." The first clause is still true of the Organization Authority and the last clause is now
 * FALSE of this surface — Identity resolves the label, through a read this component never
 * performs and never holds. The sentence is corrected rather than deleted, because what changed is
 * worth reading: no roster was created, and a different authority answered.
 *
 * Two rules follow and both are enforced below.
 *
 *   THE IDENTIFIER IS NEVER ERASED. It travels to the writer, and it stays on the surface beside
 *   the label as the thing the record actually holds. A label is a rendering; it is not the key,
 *   and no control here submits one.
 *
 *   AN UNRESOLVED HUMAN IS SAID TO BE UNRESOLVED. When Identity returns no label — the person left
 *   the organization, the read was unavailable, the caller may not ask — this renders the
 *   identifier and says the name is unavailable. It never falls back to a guess, an initial, or a
 *   blank.
 *
 * A READABLE NAME STILL GRANTS NOTHING. Legibility changed who a reader can recognise, and changed
 * no authority whatsoever.
 *
 * ACCESSIBILITY: real <label>s, refusals in role="alert", success in role="status", retirement
 * confirmed by retyping the slug rather than by one click.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import {
  recordDepartmentAction,
  renameDepartmentAction,
  retireDepartmentAction,
  setDepartmentOwnerAction,
} from "@/app/(dashboard)/director/organization/actions";
import type { DepartmentWriteResult } from "@/features/organization-authority/write-structure.server";
import type { OrganizationStructure } from "@/features/organization-authority/contracts";
import type { DepartmentRefusal } from "@/features/organization-authority/structure-contracts";
import type {
  HumanLabel,
  SelectableMembersRead,
} from "@/features/auth-runtime/human-label-read.server";

/**
 * What each refusal MEANS to the person reading it. One sentence, no jargon, and never a
 * re-interpretation: each is the writer's own reason rendered for a human.
 */
const REFUSAL_SENTENCE: Record<DepartmentRefusal, string> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so nothing was recorded.",
  "not-authorized":
    "Recording structure requires this organization's Governance authority. Nothing was recorded.",
  "authority-unavailable":
    "Hebun could not reach the structural authority. Nothing was recorded — this is not a refusal of the act itself.",
  "malformed-department-name":
    "A department name must be present, unpadded, and at most 120 characters. It was not repaired for you.",
  "malformed-department-slug":
    "An identifier must be lowercase letters, digits and single hyphens — for example finance or people-ops.",
  "duplicate-active-slug":
    "Another department in service already uses that identifier. Retire it first, or choose another.",
  "department-unresolved": "No department of this organization carries that identity.",
  "department-retired": "That department is already retired, and retirement cannot be undone here.",
  "owner-not-active-member":
    "The person named is not an active member of this organization, so they were not recorded as accountable.",
};

/**
 * What each reason for an unusable member list MEANS. Rendered instead of a picker, never instead
 * of the recorded owner: a department whose owner cannot be re-chosen still says who owns it.
 */
const MEMBERS_UNAVAILABLE_SENTENCE: Record<
  Extract<SelectableMembersRead, { status: "unavailable" }>["reason"],
  string
> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so no members can be offered.",
  "not-authorized":
    "Naming someone accountable requires this organization's Governance authority.",
  "authority-unavailable":
    "Hebun could not reach the member list. This says nothing about who belongs to this organization.",
};

/** An authorized caller with an empty list. Measured, and never rendered as a failed read. */
const NO_SELECTABLE_MEMBERS =
  "This organization has no active member Hebun can offer as accountable.";

/** Said when Identity returns no label for an id the record names. Never replaced by a guess. */
const LABEL_UNAVAILABLE = "name unavailable";

/** The consequence of retirement, stated before the control that performs it. */
const RETIREMENT_SUMMARY =
  "Retiring withdraws a department from service. The record, its name, its identifier and its " +
  "ownership all survive and stay readable — nothing is deleted. The identifier becomes available " +
  "again. There is no un-retire.";

function Feedback({ result }: { result: DepartmentWriteResult | null }) {
  if (!result) return null;
  if (result.status === "refused") {
    return (
      <p role="alert" className="mt-2 text-xs leading-5 text-fg-secondary">
        <strong className="text-fg">Not recorded.</strong> {REFUSAL_SENTENCE[result.reason]}
      </p>
    );
  }
  return (
    <p role="status" className="mt-2 text-xs leading-5 text-fg-secondary">
      <strong className="text-fg">Recorded.</strong> {result.department.name} (
      {result.department.slug}).
    </p>
  );
}

function CreateDepartment() {
  const nameId = useId();
  const slugId = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [result, setResult] = useState<DepartmentWriteResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      className="rounded-lg border border-border bg-surface p-3"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const outcome = await recordDepartmentAction({ name, slug });
          setResult(outcome);
          if (outcome.status === "recorded") {
            setName("");
            setSlug("");
            router.refresh();
          }
        });
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Record a department
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={nameId}>
          Name
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
            placeholder="Finance"
          />
        </label>
        <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={slugId}>
          Identifier
          <input
            id={slugId}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-fg"
            placeholder="finance"
          />
        </label>
      </div>
      <div className="mt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Recording…" : "Record department"}
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  );
}

function DepartmentRow({
  department,
  members,
  labelFor,
}: {
  department: Extract<OrganizationStructure, { status: "available" }>["departments"][number];
  members: SelectableMembersRead;
  /** Identity's answer for one id, or `undefined`. `undefined` is rendered, never smoothed over. */
  labelFor: (userId: string) => string | undefined;
}) {
  const renameId = useId();
  const ownerId = useId();
  const confirmId = useId();
  const [name, setName] = useState(department.name);
  const [owner, setOwner] = useState(department.owner?.actorId ?? "");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<DepartmentWriteResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (action: () => Promise<DepartmentWriteResult>) =>
    start(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.status === "recorded") router.refresh();
    });

  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-fg">{department.name}</span>
        <span className="font-mono text-xs text-fg-muted">{department.slug}</span>
        <span className="text-xs text-fg-secondary">
          {department.inService ? "in service" : "retired"}
        </span>
      </div>
      <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-fg-secondary">
        <UserRound className="mt-0.5 size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
        {department.owner ? (
          <span>
            {/*
              * THE LABEL LEADS, THE IDENTIFIER STAYS. Both are shown because they are different
              * facts: the record holds the identifier, and Identity says what it is called. When
              * Identity has no answer the identifier stands alone and is SAID to be unlabelled —
              * this branch never renders a blank where a name would be.
              */}
            Accountable:{" "}
            {labelFor(department.owner.actorId) ? (
              <span className="font-medium text-fg">{labelFor(department.owner.actorId)}</span>
            ) : (
              <span className="italic">{LABEL_UNAVAILABLE}</span>
            )}{" "}
            <span className="font-mono text-fg-muted">{department.owner.actorId}</span>
            {department.owner.currentlyActiveMember ? "" : " — no longer an active member"}
          </span>
        ) : (
          <span>No accountable human recorded.</span>
        )}
      </p>

      {department.inService ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={renameId}>
              Rename
              <input
                id={renameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() => renameDepartmentAction({ departmentId: department.departmentId, name }))
              }
            >
              Rename
            </Button>
          </div>

          {/*
            * THE OWNER CONTROL. It offers people, and it submits an identifier.
            *
            * `value` and every `<option value>` is a `users.id`; the label is the option's TEXT and
            * is never read back out. So the writer receives exactly what it received before this
            * milestone, and a renamed human changes no record.
            *
            * A recorded owner who is not in the offered set — they left the organization — still
            * appears, as a DISABLED option carrying whatever Identity could say about them. Without
            * it the select would fall back to its first option and a department with an owner would
            * silently read as one without.
            *
            * No picker is rendered when there is nothing honest to put in it, and the reason is
            * shown instead of an empty control. The owner line above is unaffected either way.
            */}
          {members.status === "read" && members.members.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={ownerId}>
                Accountable member
                <select
                  id={ownerId}
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                >
                  <option value="">No accountable human</option>
                  {members.members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.label}
                    </option>
                  ))}
                  {department.owner &&
                  !members.members.some((member) => member.userId === department.owner!.actorId) ? (
                    <option value={department.owner.actorId} disabled>
                      {labelFor(department.owner.actorId) ?? department.owner.actorId} — no longer
                      selectable
                    </option>
                  ) : null}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setDepartmentOwnerAction({
                      departmentId: department.departmentId,
                      ownerUserId: owner.trim() === "" ? null : owner.trim(),
                    }),
                  )
                }
              >
                Set accountable
              </Button>
            </div>
          ) : (
            <p className="text-xs leading-5 text-fg-secondary">
              {members.status === "read"
                ? NO_SELECTABLE_MEMBERS
                : MEMBERS_UNAVAILABLE_SENTENCE[members.reason]}
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={confirmId}>
              Retire — retype <span className="font-mono">{department.slug}</span> to confirm
              <input
                id={confirmId}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-fg"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={pending || confirm !== department.slug}
              onClick={() =>
                run(() => retireDepartmentAction({ departmentId: department.departmentId }))
              }
            >
              Retire
            </Button>
          </div>
        </div>
      ) : null}

      <Feedback result={result} />
    </li>
  );
}

export function DepartmentStructurePanel({
  structure,
  members,
  ownerLabels,
}: {
  structure: OrganizationStructure;
  /**
   * Identity's answer to "who may be made accountable", read by the page and passed in. This
   * component performs no read and holds no database handle — the two authorities meet on this
   * surface and nowhere else.
   */
  members: SelectableMembersRead;
  /** Labels for the owner ids this structure already names. A SUBSET: absence is normal. */
  ownerLabels: readonly HumanLabel[];
}) {
  const labels = new Map(ownerLabels.map((entry) => [entry.userId, entry.label]));
  const labelFor = (userId: string) => labels.get(userId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Departments</CardTitle>
        <CardDescription>
          Recorded through the Organization Structure Authority. Every row is a durable record.
          Naming someone accountable grants them nothing — no permission, no approval right, and no
          Governance authority.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {structure.status === "unavailable" ? (
          <StateBlock
            tone="unavailable"
            title="Structure is unavailable"
            description={structure.detail}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-fg-secondary">{structure.detail}</p>
            {structure.departments.length > 0 ? (
              <ul className="space-y-2">
                {structure.departments.map((department) => (
                  <DepartmentRow
                    key={department.departmentId}
                    department={department}
                    members={members}
                    labelFor={labelFor}
                  />
                ))}
              </ul>
            ) : null}
            <CreateDepartment />
            <p className="text-xs leading-5 text-fg-secondary">{RETIREMENT_SUMMARY}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
