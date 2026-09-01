"use client";

/*
 * The Work Register (WORK-1) — a narrow enterprise register, NOT a project-management application.
 *
 * ── THE ONE THING THIS SURFACE MUST NOT DO ───────────────────────────────────
 *
 * Render "Complete" as though Hebun verified it. Every state on this page is a DECLARATION by an
 * authorized human, and that is said in words — in the section description, next to the control
 * that changes it, and in the meaning line under each state — rather than implied by styling. The
 * six words this surface holds apart:
 *
 *   DECLARED != OBSERVED != VERIFIED != SUCCESSFUL != COMPLETED IN THE WORLD != OUTCOME ACHIEVED
 *
 * ── THREE STATES, NEVER TWO ──────────────────────────────────────────────────
 *
 *   unavailable       Hebun could not read the work authority — NOT "no work"
 *   available, empty  looked, found none
 *   available, items  the recorded work
 *
 * The unavailable branch renders no form: offering a control whose outcome cannot be read back
 * would be offering an act with an invisible result. The released `department-structure.tsx` rule.
 *
 * ── ACCOUNTABILITY IS ATTRIBUTION, AND THE COPY SAYS SO ──────────────────────
 *
 * The accountable human is granted nothing — no permission, no approval right, no Governance
 * authority — and that sentence is on the surface, not only in a comment, because "accountable" is
 * the word a reader is most likely to mistake for authority.
 *
 * ── THE LABEL IS NOT THE KEY ─────────────────────────────────────────────────
 *
 * Identity resolves the readable name through the released Human Legibility Reach projection; this
 * component never performs that read and never holds it. Two rules follow and both are enforced
 * below: the IDENTIFIER is never erased — it travels to the writer and stays beside the label as
 * the thing the record actually holds — and an UNRESOLVED human is SAID to be unresolved, never
 * replaced by a guess, an initial or a blank.
 *
 * ── PROGRESSIVE DISCLOSURE ───────────────────────────────────────────────────
 *
 * The page is a list. Recording work, and every per-item control, live inside `<details>` so the
 * default read is short and nothing is hidden — a closed `<details>` still carries its content in
 * the document, which is why the released CMD-V3 milestone chose it over conditional rendering.
 *
 * ACCESSIBILITY: real <label>s, refusals in role="alert", success in role="status", retirement
 * confirmed by retyping the title rather than by one click.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import {
  recordWorkAction,
  retireWorkAction,
  retitleWorkAction,
  setWorkAccountableHumanAction,
  setWorkDeclaredStateAction,
} from "@/app/(dashboard)/director/work/actions";
import type { WorkWriteResult } from "@/features/organizational-work/write-work.server";
import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";
import {
  WORK_DECLARED_STATES,
  WORK_DECLARED_STATE_MEANING,
  type WorkDeclaredState,
  type WorkRefusal,
} from "@/features/organizational-work/work-contracts";
import type { OrganizationStructure } from "@/features/organization-authority/contracts";
import type {
  HumanLabel,
  SelectableMembersRead,
} from "@/features/auth-runtime/human-label-read.server";

/**
 * What each refusal MEANS to the person reading it. One sentence, no jargon, and never a
 * re-interpretation: each is the writer's own reason rendered for a human.
 */
const REFUSAL_SENTENCE: Record<WorkRefusal, string> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so nothing was recorded.",
  "not-authorized":
    "Recording work requires this organization's Governance authority. Nothing was recorded.",
  "authority-unavailable":
    "Hebun could not reach the work authority. Nothing was recorded — this is not a refusal of the act itself.",
  "malformed-work-title":
    "A title must be present, unpadded, and at most 120 characters. It was not repaired for you.",
  "malformed-declared-state": "That is not a state this organization can declare.",
  "work-unresolved": "No work item of this organization carries that identity.",
  "work-retired": "That work is already retired, and retirement cannot be undone here.",
  "department-unresolved":
    "No department of this organization is in service under that identity, so nothing was filed against it.",
  "accountable-not-eligible-member":
    "The person named is not a currently eligible member of this organization, so they were not recorded as accountable.",
};

const MEMBERS_UNAVAILABLE_SENTENCE: Record<
  Extract<SelectableMembersRead, { status: "unavailable" }>["reason"],
  string
> = {
  "no-authorized-tenant-context":
    "No organization is resolved for this session, so no members can be offered.",
  "not-authorized": "Naming someone accountable requires this organization's Governance authority.",
  "authority-unavailable":
    "Hebun could not reach the member list. This says nothing about who belongs to this organization.",
};

const NO_SELECTABLE_MEMBERS =
  "This organization has no currently eligible member Hebun can offer as accountable.";

/** Said when Identity returns no label for an id the record names. Never replaced by a guess. */
const LABEL_UNAVAILABLE = "name unavailable";

/** The consequence of retirement, stated before the control that performs it. */
const RETIREMENT_SUMMARY =
  "Retiring withdraws work from service. The record, its title, its declared state, its department " +
  "and its accountable human all survive and stay readable — nothing is deleted. There is no " +
  "un-retire.";

/** The sentence that keeps a state label from being read as a verified outcome. */
const DECLARATION_NOTICE =
  "Every state here is DECLARED by an authorized human. Hebun did not observe it, did not verify " +
  "it, and holds no record of whether the work succeeded.";

function Feedback({ result }: { result: WorkWriteResult | null }) {
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
      <strong className="text-fg">Recorded.</strong> {result.workItem.title} — declared{" "}
      {result.workItem.declaredState}.
    </p>
  );
}

/** The active departments a human may file work against. Retired ones are not offered. */
function activeDepartments(
  structure: OrganizationStructure,
): readonly { readonly departmentId: string; readonly name: string }[] {
  if (structure.status !== "available") return [];
  return structure.departments
    .filter((department) => department.inService)
    .map((department) => ({ departmentId: department.departmentId, name: department.name }));
}

function MemberOptions({ members }: { members: SelectableMembersRead }) {
  if (members.status !== "read") return null;
  return (
    <>
      {members.members.map((member) => (
        <option key={member.userId} value={member.userId}>
          {member.label}
        </option>
      ))}
    </>
  );
}

function RecordWork({
  structure,
  members,
}: {
  structure: OrganizationStructure;
  members: SelectableMembersRead;
}) {
  const titleId = useId();
  const stateId = useId();
  const departmentId = useId();
  const accountableId = useId();
  const [title, setTitle] = useState("");
  const [declaredState, setDeclaredState] = useState<WorkDeclaredState>("planned");
  const [department, setDepartment] = useState("");
  const [accountable, setAccountable] = useState("");
  const [result, setResult] = useState<WorkWriteResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const departments = activeDepartments(structure);

  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Record work
      </summary>
      <form
        className="border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const outcome = await recordWorkAction({
              title,
              declaredState,
              departmentId: department === "" ? null : department,
              accountableUserId: accountable === "" ? null : accountable,
            });
            setResult(outcome);
            if (outcome.status === "recorded") {
              setTitle("");
              setDeclaredState("planned");
              setDepartment("");
              setAccountable("");
              router.refresh();
            }
          });
        }}
      >
        <div className="flex flex-wrap gap-2">
          <label className="flex-1 basis-64 text-xs text-fg-secondary" htmlFor={titleId}>
            Title
            <input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
              placeholder="Q3 supplier audit"
            />
          </label>
          <label className="flex-1 basis-40 text-xs text-fg-secondary" htmlFor={stateId}>
            Declared state
            <select
              id={stateId}
              value={declaredState}
              onChange={(event) => setDeclaredState(event.target.value as WorkDeclaredState)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
            >
              {WORK_DECLARED_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={departmentId}>
            Department (optional)
            <select
              id={departmentId}
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
              disabled={departments.length === 0}
            >
              <option value="">No department</option>
              {departments.map((entry) => (
                <option key={entry.departmentId} value={entry.departmentId}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={accountableId}>
            Accountable human (optional)
            <select
              id={accountableId}
              value={accountable}
              onChange={(event) => setAccountable(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
              disabled={members.status !== "read" || members.members.length === 0}
            >
              <option value="">Nobody yet</option>
              <MemberOptions members={members} />
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs leading-5 text-fg-muted">{DECLARATION_NOTICE}</p>
        <div className="mt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record work"}
          </Button>
        </div>
        <Feedback result={result} />
      </form>
    </details>
  );
}

function AccountableLine({
  item,
  labels,
}: {
  item: WorkItemView;
  labels: readonly HumanLabel[];
}) {
  if (!item.accountableActorId) {
    return <span className="text-fg-muted">Nobody recorded accountable</span>;
  }
  const label = labels.find((entry) => entry.userId === item.accountableActorId);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <UserRound aria-hidden className="size-3.5 shrink-0 self-center text-fg-muted" />
      <span className="text-fg">{label ? label.label : LABEL_UNAVAILABLE}</span>
      <code className="font-mono text-[0.6875rem] text-fg-muted">{item.accountableActorId}</code>
      {item.accountableCurrentlyActiveMember === false ? (
        <span className="text-fg-muted">· no longer an active member</span>
      ) : null}
    </span>
  );
}

function WorkItemControls({
  item,
  members,
}: {
  item: WorkItemView;
  members: SelectableMembersRead;
}) {
  const titleId = useId();
  const stateId = useId();
  const accountableId = useId();
  const confirmId = useId();
  const [title, setTitle] = useState(item.title);
  const [declaredState, setDeclaredState] = useState<WorkDeclaredState>(item.declaredState);
  const [accountable, setAccountable] = useState(item.accountableActorId ?? "");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<WorkWriteResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(action: () => Promise<WorkWriteResult>) {
    start(async () => {
      const outcome = await action();
      setResult(outcome);
      if (outcome.status === "recorded") router.refresh();
    });
  }

  return (
    <details className="mt-2 rounded-md border border-border bg-bg">
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-fg-secondary">Change</summary>
      <div className="space-y-3 border-t border-border p-2.5">
        <div>
          <label className="text-xs text-fg-secondary" htmlFor={stateId}>
            Declare state
            <select
              id={stateId}
              value={declaredState}
              onChange={(event) => setDeclaredState(event.target.value as WorkDeclaredState)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
            >
              {WORK_DECLARED_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            {WORK_DECLARED_STATE_MEANING[declaredState]}
          </p>
          <Button
            type="button"
            disabled={pending}
            className="mt-2"
            onClick={() =>
              run(() => setWorkDeclaredStateAction({ workItemId: item.workItemId, declaredState }))
            }
          >
            Declare
          </Button>
        </div>

        <div>
          <label className="text-xs text-fg-secondary" htmlFor={titleId}>
            Title
            <input
              id={titleId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
            />
          </label>
          <Button
            type="button"
            disabled={pending}
            className="mt-2"
            onClick={() => run(() => retitleWorkAction({ workItemId: item.workItemId, title }))}
          >
            Retitle
          </Button>
        </div>

        <div>
          <label className="text-xs text-fg-secondary" htmlFor={accountableId}>
            Accountable human
            <select
              id={accountableId}
              value={accountable}
              onChange={(event) => setAccountable(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
              disabled={members.status !== "read"}
            >
              <option value="">Nobody</option>
              <MemberOptions members={members} />
            </select>
          </label>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            Naming someone accountable grants them nothing — no permission, no Governance authority,
            no approval right.
          </p>
          {members.status === "unavailable" ? (
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              {MEMBERS_UNAVAILABLE_SENTENCE[members.reason]}
            </p>
          ) : null}
          {members.status === "read" && members.members.length === 0 ? (
            <p className="mt-1 text-xs leading-5 text-fg-muted">{NO_SELECTABLE_MEMBERS}</p>
          ) : null}
          <Button
            type="button"
            disabled={pending}
            className="mt-2"
            onClick={() =>
              run(() =>
                setWorkAccountableHumanAction({
                  workItemId: item.workItemId,
                  accountableUserId: accountable === "" ? null : accountable,
                }),
              )
            }
          >
            Set accountable
          </Button>
        </div>

        <div>
          <p className="text-xs leading-5 text-fg-muted">{RETIREMENT_SUMMARY}</p>
          <label className="mt-2 block text-xs text-fg-secondary" htmlFor={confirmId}>
            Retype the title to retire
            <input
              id={confirmId}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
              placeholder={item.title}
            />
          </label>
          <Button
            type="button"
            disabled={pending || confirm !== item.title}
            className="mt-2"
            onClick={() => run(() => retireWorkAction({ workItemId: item.workItemId }))}
          >
            Retire
          </Button>
        </div>

        <Feedback result={result} />
      </div>
    </details>
  );
}

export function WorkRegisterPanel({
  register,
  structure,
  members,
  accountableLabels,
}: {
  register: WorkRegister;
  structure: OrganizationStructure;
  members: SelectableMembersRead;
  accountableLabels: readonly HumanLabel[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work register</CardTitle>
        <CardDescription>
          Recorded by this organization through the Organizational Work Authority. {DECLARATION_NOTICE}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {register.status === "unavailable" ? (
          <StateBlock
            tone="unavailable"
            title="Work is unknown, not absent"
            description={register.detail}
          />
        ) : (
          <>
            <p className="text-xs leading-5 text-fg-secondary">{register.detail}</p>
            <RecordWork structure={structure} members={members} />
            {register.items.length === 0 ? null : (
              <ul className="space-y-2">
                {register.items.map((item) => (
                  <li
                    key={item.workItemId}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="text-sm font-medium text-fg">{item.title}</span>
                      <span className="text-xs text-fg-secondary">
                        declared {item.declaredState}
                        {item.inService ? "" : " · retired"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-fg-secondary">
                      {item.department ? item.department.name : "No department recorded"} ·{" "}
                      <AccountableLine item={item} labels={accountableLabels} />
                    </p>
                    <p className="mt-1 text-xs leading-5 text-fg-muted">
                      {WORK_DECLARED_STATE_MEANING[item.declaredState]}
                    </p>
                    {item.inService ? (
                      <WorkItemControls item={item} members={members} />
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-fg-muted">
                        Retired work is kept and stays readable. It accepts no further change.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
