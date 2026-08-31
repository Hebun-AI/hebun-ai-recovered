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
 * likely to mistake for authority. The owner is shown as an identifier: Hebun holds a member COUNT
 * and no roster, so this surface cannot resolve an id to a person and must not imply it can.
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
}: {
  department: Extract<OrganizationStructure, { status: "available" }>["departments"][number];
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
            Accountable: <span className="font-mono">{department.owner.actorId}</span>
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

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={ownerId}>
              Accountable member identifier
              <input
                id={ownerId}
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-fg"
                placeholder="member id"
              />
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

export function DepartmentStructurePanel({ structure }: { structure: OrganizationStructure }) {
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
                  <DepartmentRow key={department.departmentId} department={department} />
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
