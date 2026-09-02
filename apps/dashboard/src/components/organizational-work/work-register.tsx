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
  declareWorkReferenceAction,
  proposeRecordWorkForGovernanceAction,
  readWorkItemActHistoryAction,
  recordWorkAction,
  withdrawWorkReferenceAction,
  retireWorkAction,
  retitleWorkAction,
  setWorkAccountableHumanAction,
  setWorkDeclaredStateAction,
} from "@/app/(dashboard)/director/work/actions";
import type { SubjectActHistoryResult } from "@/features/governance-activity/contracts";
import {
  RECORD_WORK_PROPOSAL_EFFECTS,
  RECORD_WORK_PROPOSAL_NON_EFFECTS,
  type RecordWorkProposalRefusal,
  type RecordWorkProposalResult,
} from "@/features/heby-action-inlet/contracts";
import { formatDepartmentRef } from "@/features/organization-authority/department-ref";
import type { WorkWriteResult } from "@/features/organizational-work/write-work.server";
import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";
import type { WorkEvidenceReferenceView } from "@/features/organizational-work/read-work-evidence.server";
import {
  WORK_DECLARED_STATES,
  WORK_DECLARED_STATE_MEANING,
  WORK_REFERENCE_NON_CLAIMS,
  WORK_REFERENCE_WITHDRAWAL_MEANING,
  type WorkReferenceKind,
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
  "referent-unresolved":
    "Nothing of this organization carries that identity, so no relationship was declared.",
  "reference-already-declared":
    "This work already declares that reference. A declaration is not repeatable, and nothing was written twice.",
  "reference-unresolved":
    "No current declaration of this organization carries that identity — it may already have been withdrawn.",
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

/*
 * GIA-1 — THE GOVERNED PATH'S OWN REFUSALS, IN THE ORGANIZATION'S WORDS.
 *
 * Separate from `REFUSAL_SENTENCE` because these are refusals to FILE A PROPOSAL, not refusals to
 * record work. "Not recorded" would be true of both and useful for neither: nothing is recorded on
 * this path even when it succeeds.
 */
const PROPOSAL_REFUSAL_SENTENCE: Record<RecordWorkProposalRefusal, string> = {
  unauthenticated: "No organization is resolved for this session, so nothing was filed.",
  "invalid-input":
    "A title must be present, unpadded, and at most 120 characters, and a department must be chosen. It was not repaired for you.",
  "persistence-unavailable":
    "Hebun could not read this organization's departments, so nothing was filed — this is not a refusal of the act itself.",
  "department-not-found":
    "No department of this organization is in service under that identity, so nothing was filed against it.",
  "department-retired":
    "That department was retired, so work cannot be filed against it and nothing was proposed.",
  "not-authorizable":
    "The proposal did not reach human review, so nothing was filed for a decision.",
  "already-pending":
    "That exact work record is already waiting for a decision. Nothing was filed again.",
};

function ProposalFeedback({ result }: { result: RecordWorkProposalResult | null }) {
  if (!result) return null;
  if (result.status === "refused") {
    return (
      <p role="alert" className="mt-2 text-xs leading-5 text-fg-secondary">
        <strong className="text-fg">Not proposed.</strong>{" "}
        {PROPOSAL_REFUSAL_SENTENCE[result.reason]}
      </p>
    );
  }
  return (
    <p role="status" className="mt-2 text-xs leading-5 text-fg-secondary">
      <strong className="text-fg">Proposed, not recorded.</strong> &ldquo;{result.receipt.title}
      &rdquo; for {result.receipt.departmentName} is waiting for a decision in Decisions. The
      register is unchanged.
    </p>
  );
}

/**
 * PROPOSE recording work, for a human to decide and Hebun to perform (GIA-1).
 *
 * ── WHY A SECOND CONTROL AND NOT A CHECKBOX ON THE FIRST ─────────────────────
 *
 * The two acts have different outcomes, different authors and different failure modes. "Record
 * work" writes a row this human authored. This one writes NOTHING: it files a proposal, a human
 * decides it at the Governance surface, and a separately-spent permit lets Hebun perform the
 * mutation with `created_by_type = system`. A modifier on one button would make the most
 * consequential difference on this page — who authored the organization's record — a toggle.
 *
 * THE DEPARTMENT IS REQUIRED HERE and optional on the direct control, deliberately. A consequential
 * act a human is asked to approve must name something that exists; a register entry a human is
 * authoring themselves may legitimately wait for that decision.
 */
function ProposeRecordWork({ structure }: { structure: OrganizationStructure }) {
  const titleId = useId();
  const departmentFieldId = useId();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [result, setResult] = useState<RecordWorkProposalResult | null>(null);
  const [pending, start] = useTransition();

  const departments = activeDepartments(structure);

  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Propose work for a decision
      </summary>
      <form
        className="border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            const outcome = await proposeRecordWorkForGovernanceAction({
              title,
              departmentRef: department === "" ? "" : formatDepartmentRef(department),
            });
            setResult(outcome);
            if (outcome.status === "proposed") {
              setTitle("");
              setDepartment("");
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
          <label className="flex-1 basis-48 text-xs text-fg-secondary" htmlFor={departmentFieldId}>
            Department
            <select
              id={departmentFieldId}
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
              disabled={departments.length === 0}
            >
              <option value="">Choose a department</option>
              {departments.map((entry) => (
                <option key={entry.departmentId} value={entry.departmentId}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/*
          * WHAT THIS DOES AND WHAT IT DOES NOT, BEFORE THE CLICK — the released
          * ceremony-disclosure rule. Both lists are quoted from the inlet's own contract rather
          * than written here, so the surface cannot say something the module does not.
          */}
        <ul className="mt-2 space-y-0.5 text-xs leading-5 text-fg-muted">
          {RECORD_WORK_PROPOSAL_EFFECTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {RECORD_WORK_PROPOSAL_NON_EFFECTS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-2">
          <Button type="submit" disabled={pending || department === ""}>
            {pending ? "Filing…" : "Propose for a decision"}
          </Button>
        </div>
        <ProposalFeedback result={result} />
      </form>
    </details>
  );
}

type ReferentOption = { readonly id: string; readonly label: string };

const REFERENT_KIND_LABEL: Record<WorkReferenceKind, string> = {
  "knowledge-fact": "Knowledge",
  "work-artifact": "Document",
};

/**
 * WHAT ONE WORK ITEM DECLARES IT CONCERNS (WEV-1).
 *
 * ── THE ONE THING THIS SURFACE MUST NOT DO ───────────────────────────────────
 *
 * Let a DECLARED RELATIONSHIP and a REFERENT'S STANDING look like one fact. They are rendered as
 * two, always, in that order and in different weights: the organization declared this relationship,
 * and separately, this is what the owning authority currently says about the thing it names. A
 * ratified fact is not an authoritative one, and a retired document is still a document this work
 * declared it was about.
 *
 * An UNRESOLVED referent is SAID to be unresolved. It is never replaced by its id, by a guess, or
 * by silence — the released Human Legibility rule, applied to a different kind of referent.
 */
/*
 * SUBJECT-ACT-HISTORY-1 — "Recorded activity" for ONE work item.
 *
 * ── WHAT THIS SECTION IS, IN ONE LINE ────────────────────────────────────────
 *
 * What HEBUN RECORDED DOING to this work item — not what happened to it.
 *
 * `Concerns` above says what a person DECLARED this work is about. `/work-activity` says what a
 * provider OBSERVES about the repository that declaration names. This is the third face and the
 * only one drawn from Hebun's own permanent record: the acts Hebun itself carried out.
 *
 *     DECLARED   the organization's own statement about its work
 *     OBSERVED   a provider's answer about the outside world
 *     RECORDED   what Hebun did, under whose authority, and when
 *
 * ── THE FOUR NON-INFERENCES, RENDERED AND NOT ASSUMED ────────────────────────
 *
 *     RECORDED ACT != WORLD EVENT != WORK PROGRESS != COMPLETION != VERIFICATION
 *
 * A work item can carry ten recorded acts and be untouched; it can carry none and be finished. The
 * declared state above is the only thing that says what a person believes about this work, and no
 * act here changes it.
 *
 * ── AND ZERO IS THE LINE THAT MATTERS ────────────────────────────────────────
 *
 * An empty history says "Hebun has no recorded acts for this work item", never "nothing happened".
 * The distinction is not pedantic: work done outside Hebun leaves no row, and a surface that
 * rendered that as inactivity would be inventing an organizational fact out of its own coverage.
 *
 * ── IT READS WHEN OPENED, AND NEVER BEFORE ───────────────────────────────────
 *
 * Closed, this section reads nothing. The register would otherwise pay one bounded read per work
 * item on every page load whether or not anybody looked.
 */
function RecordedActivitySection({ item }: { item: WorkItemView }) {
  const [history, setHistory] = useState<SubjectActHistoryResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <details
      className="mt-2 rounded-md border border-border bg-bg"
      onToggle={(event) => {
        /* Read once, on the first open. Re-opening shows what was read, not a second read. */
        if (!event.currentTarget.open || history !== null || pending) return;
        start(async () => {
          setHistory(await readWorkItemActHistoryAction({ workItemId: item.workItemId }));
        });
      }}
    >
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-fg-secondary">
        Recorded activity
      </summary>
      <div className="border-t border-border p-2.5">
        {history === null ? (
          <p className="text-xs leading-5 text-fg-muted">
            {pending ? "Reading Hebun's record…" : "Opening this reads Hebun's record for this work item."}
          </p>
        ) : history.status === "unavailable" ? (
          <p className="text-xs leading-5 text-fg-secondary">
            Hebun could not read its record of its own acts ({history.reason}). UNKNOWN, not empty —
            Hebun did not establish that nothing was recorded, only that it could not look.
          </p>
        ) : history.status === "empty" ? (
          <p className="text-xs leading-5 text-fg-muted">
            Hebun has no recorded acts for this work item. That is a statement about Hebun&rsquo;s
            record, not about the world: work done outside Hebun leaves no act here and is no less
            real.
          </p>
        ) : (
          <>
            <p className="text-xs leading-5 text-fg-secondary">
              Hebun recorded {history.page.totalRecordedActs}{" "}
              {history.page.totalRecordedActs === 1 ? "act" : "acts"} for this work item
              {history.page.truncated ? `, showing the ${history.page.acts.length} most recent` : ""}
              . Most recent first.
            </p>
            <ul className="mt-2 space-y-2">
              {history.page.acts.map((act) => (
                <li key={`${act.occurredAt}-${act.action}`} className="text-xs leading-5">
                  {/* The writer's own verb, verbatim. Never relabelled, never categorised. */}
                  <span className="text-fg">{act.action}</span>
                  <span className="text-fg-muted"> · {act.result}</span>
                  {act.simulation ? (
                    <span className="text-fg-muted"> · SIMULATED — no real effect occurred</span>
                  ) : null}
                  {/* A KIND of actor, never which person. The ledger's identifiers stay unread. */}
                  <span className="block text-fg-muted">
                    by {act.actorType} under {act.authoritySource ?? "no authority source recorded"}{" "}
                    via {act.source ?? "no source recorded"}
                  </span>
                  <span className="block text-fg-muted">{act.occurredAt}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5 text-fg-muted">
              What Hebun recorded doing. Not progress, not completion, and not verification of this
              work.
            </p>
          </>
        )}
      </div>
    </details>
  );
}

function ConcernsSection({
  item,
  references,
  readable,
  factOptions,
  artifactOptions,
}: {
  item: WorkItemView;
  references: readonly WorkEvidenceReferenceView[];
  readable: boolean;
  factOptions: readonly ReferentOption[];
  artifactOptions: readonly ReferentOption[];
}) {
  const kindId = useId();
  const referentId = useId();
  const [kind, setKind] = useState<WorkReferenceKind>("knowledge-fact");
  const [referent, setReferent] = useState("");
  const [result, setResult] = useState<WorkWriteResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const mine = references.filter((reference) => reference.workItemId === item.workItemId);
  const options = kind === "knowledge-fact" ? factOptions : artifactOptions;

  return (
    <details className="mt-2 rounded-md border border-border bg-bg">
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-fg-secondary">
        Concerns{mine.length === 0 ? "" : ` (${mine.length})`}
      </summary>
      <div className="border-t border-border p-2.5">
        {!readable ? (
          <p className="text-xs leading-5 text-fg-secondary">
            Hebun could not read what this work declares it concerns. That is a read failure, not
            work that concerns nothing.
          </p>
        ) : mine.length === 0 ? (
          <p className="text-xs leading-5 text-fg-muted">
            Nobody has declared what this work concerns.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((reference) => (
              <li key={reference.referenceId} className="text-xs leading-5">
                <span className="text-fg-muted">{REFERENT_KIND_LABEL[reference.kind]} · </span>
                {/* THE DECLARED RELATIONSHIP. */}
                <span className="text-fg">{reference.referent?.label ?? "Unresolved referent"}</span>
                {/* THE REFERENT'S STANDING, from its OWN authority — a separate line, always. */}
                <span className="block text-fg-muted">
                  {reference.referent
                    ? reference.referent.standing
                    : "Its owning authority could not answer, so its standing is unknown — not absent."}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const outcome = await withdrawWorkReferenceAction({
                        referenceId: reference.referenceId,
                      });
                      setResult(outcome);
                      if (outcome.status === "recorded") router.refresh();
                    })
                  }
                  className="mt-1 rounded-md border border-border px-2 py-0.5 text-[0.65rem] font-semibold text-fg-secondary disabled:opacity-40"
                >
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        )}

        {readable ? (
          <form
            className="mt-3 border-t border-border pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const outcome = await declareWorkReferenceAction({
                  workItemId: item.workItemId,
                  kind,
                  referentId: referent,
                });
                setResult(outcome);
                if (outcome.status === "recorded") {
                  setReferent("");
                  router.refresh();
                }
              });
            }}
          >
            <div className="flex flex-wrap gap-2">
              <label className="flex-1 basis-32 text-xs text-fg-secondary" htmlFor={kindId}>
                Kind
                <select
                  id={kindId}
                  value={kind}
                  onChange={(event) => {
                    setKind(event.target.value as WorkReferenceKind);
                    setReferent("");
                  }}
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                >
                  <option value="knowledge-fact">Knowledge</option>
                  <option value="work-artifact">Document</option>
                </select>
              </label>
              <label className="flex-1 basis-56 text-xs text-fg-secondary" htmlFor={referentId}>
                What it concerns
                <select
                  id={referentId}
                  value={referent}
                  onChange={(event) => setReferent(event.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
                  disabled={options.length === 0}
                >
                  <option value="">
                    {options.length === 0 ? "Nothing of this kind is recorded" : "Choose"}
                  </option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* The denials, quoted from the authority's own contract rather than restated here. */}
            <ul className="mt-2 space-y-0.5 text-xs leading-5 text-fg-muted">
              {WORK_REFERENCE_NON_CLAIMS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="mt-2">
              <Button type="submit" disabled={pending || referent === ""}>
                {pending ? "Declaring…" : "Declare"}
              </Button>
            </div>
          </form>
        ) : null}

        <p className="mt-2 text-xs leading-5 text-fg-muted">
          {WORK_REFERENCE_WITHDRAWAL_MEANING.join(" ")}
        </p>
        <Feedback result={result} />
      </div>
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
  evidence,
  evidenceReadable,
  factOptions,
  artifactOptions,
}: {
  register: WorkRegister;
  structure: OrganizationStructure;
  members: SelectableMembersRead;
  accountableLabels: readonly HumanLabel[];
  /** WEV-1. The DECLARED relationships. Referent standing rides on each one, never merged in. */
  evidence: readonly WorkEvidenceReferenceView[];
  evidenceReadable: boolean;
  factOptions: readonly ReferentOption[];
  artifactOptions: readonly ReferentOption[];
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
            <ProposeRecordWork structure={structure} />
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
                      <>
                        <ConcernsSection
                          item={item}
                          references={evidence}
                          readable={evidenceReadable}
                          factOptions={factOptions}
                          artifactOptions={artifactOptions}
                        />
                        <RecordedActivitySection item={item} />
                        <WorkItemControls item={item} members={members} />
                      </>
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
