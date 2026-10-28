"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AgentChoiceSelect, type AgentOption } from "@/components/agents/agent-choice-select";
import { HEBUN_PREPARATION_REFUSAL_WORDING } from "@/components/operations-preparation/prepare-with-hebun";
import { assignWorkDraftAction, readWorkDraftChoicesAction, reviseWorkDraftAction } from "@/app/(dashboard)/heby/work-state-origination-actions";
import { declareWorkReferenceAction, setWorkDeclaredStateAction } from "@/app/(dashboard)/director/work/actions";
import { readRevisionChangeRequestAction } from "@/app/(dashboard)/operations/actions";
import type { CurrentRevisionChangeRequest } from "@/features/work-artifact-review/contracts";
import type {
  AssignWorkDraftRefusal,
  AssignWorkDraftResult,
  ReviseWorkDraftRefusal,
  ReviseWorkDraftResult,
  WorkDraftChoices,
  WorkDraftView,
} from "@/features/agent-work/assign-work-draft.server";
import { agentWorkCapability, type AgentWorkRole } from "@/features/agent-work/capabilities";
import type { HebyModelFallback } from "@/features/heby-runtime/contracts";
import {
  CONTENT_DESTINATION_LABELS,
  CONTENT_DESTINATIONS,
  WORK_ARTIFACT_TYPES,
  type ContentDestination,
  type StoredWorkArtifactType,
  type WorkArtifactType,
} from "@/features/work-artifacts/contracts";
import {
  ACCEPTANCE_IS_NOT_COMPLETION,
  COMPLETION_SUGGESTION_TEXT,
  COMPLETION_WITHHELD_TEXT,
  SUGGESTED_DECLARED_STATE,
} from "@/features/work-outcome/contracts";

/*
 * AGENT-EXECUTION-1 — ASSIGN AN AGENT ONE DRAFT FOR THIS WORK ITEM, AND FOLLOW IT.
 *
 * Heby lists only agents the server found responsible for this item's scope, says what the agent may
 * and may not do, and reports what the records say happened: the draft the agent wrote, whether it is
 * linked to this work, and its Governance review. Nothing here decides; the server re-checks everything.
 *
 * Linking is the person's second act, through the Work register's own human action (WEV-1). Heby offers
 * the button; it never links on the agent's behalf.
 */
const CAPABILITY = agentWorkCapability("prepare-work-draft");

export const ARTIFACT_TYPE_LABELS: Readonly<Record<StoredWorkArtifactType, string>> = {
  "operational-plan": "Plan",
  "message-draft": "Message",
  "content-draft": "Content",
  "research-report": "Research report",
};

export const ASSIGN_REFUSAL_WORDING: Readonly<Record<AssignWorkDraftRefusal, string>> = {
  unauthenticated: "You are not signed in to an organization, so nothing was asked.",
  "persistence-unavailable": "Hebun could not read this work right now. Nothing was asked.",
  "work-unresolved": "That work item could not be found in your organization. Nothing was asked.",
  "work-retired": "This work item is retired, so no agent can be assigned to it.",
  "work-not-scoped":
    "This work item was recorded without a work scope, so no agent's responsibility can be checked and none can be assigned.",
  "not-authorized":
    "Linking a draft to work needs your organization's Governance authority, which you do not hold. Nothing was asked.",
  "agent-required": "Choose an agent first. Nothing was asked.",
  "agent-not-eligible":
    "That agent is not in service, or its mandate does not cover this work's scope. Nothing was asked.",
  "eligibility-unavailable": "Hebun could not confirm which agents are responsible for this work. Nothing was asked.",
  "draft-open": "This agent already has a draft on this work waiting for review. Review or revise it in Operations first.",
  "assignment-in-progress":
    "This agent is already writing a draft for this work from another request. Wait for that result. Nothing was asked twice.",
};

export const STALE_WORDING: Readonly<Record<string, string>> = {
  "agent-no-longer-eligible": "the agent stopped being responsible for this work while it was writing",
  "work-changed": "the work item was retired or its scope changed while the agent was writing",
  "eligibility-unavailable": "Hebun could not confirm the agent's responsibility afterwards",
};

export const LINK_REFUSAL_WORDING: Readonly<Record<string, string>> = {
  "not-authorized": "Linking needs your organization's Governance authority.",
  "reference-already-declared": "This draft is already linked to this work.",
  "work-retired": "The work item was retired, so nothing can be linked to it.",
  "referent-unresolved": "The draft could not be found in your organization.",
};

export const REVIEW_WORDING: Readonly<Record<WorkDraftView["review"], string>> = {
  "awaiting-review": "waiting for review",
  "changes-requested": "changes requested",
  /* WORK-OUTCOME-CLOSURE-1 — the agent's task ends at acceptance; the WORK does not (AE-1 wording corrected). */
  accepted: "accepted for the next internal step — the agent's task is done; the work is complete only when a person declares it",
  unknown: "review state could not be read",
};

/** One sentence per fact the records hold about a draft linked to this work. */
export function describeWorkDraft(draft: WorkDraftView): string {
  const author =
    draft.author.kind === "agent" ? `written by ${draft.author.name ?? "an agent no longer listed"}` : "written by a person";
  const state = draft.retired ? "retired" : REVIEW_WORDING[draft.review];
  return `${ARTIFACT_TYPE_LABELS[draft.artifactType]} “${draft.title}” · revision ${draft.revisionNo} · ${author} · ${state}`;
}

/*
 * AGENT-EXECUTION-2 — how Heby names an agent's place in this work, from the server's role. A specialist
 * is responsible for this kind of work only; the coordinator is organization-wide.
 */
export const ROLE_WORDING: Readonly<Record<AgentWorkRole, string>> = {
  specialist: "specialist for this kind of work",
  coordinator: "organization-wide",
};

/** Heby's one sentence for its recommendation, or `null` when the server recommended no one. */
export function describeRecommendation(read: Extract<WorkDraftChoices, { status: "read" }>): string | null {
  const agent = read.agents.find((candidate) => candidate.agentId === read.recommendedAgentId);
  if (!agent) return null;
  /* AE2-RECOMMENDATION-WORDING-1 — the role decides who is offered and named as author; the model is not told it. */
  return `Heby recommends ${agent.name}: it is the only agent responsible for this kind of work and not organization-wide. That decides who is offered and recorded as the draft's author; the model is not told the agent's specialty. You decide who is assigned.`;
}

/** The model answered and Hebun's response checks withheld it, with no check named (a result from before AOR-1a). */
export const WITHHELD_WORDING =
  "No draft was written. The model answered, but Hebun's response checks withheld the answer, so nothing was filed. Which check withheld it is not recorded; rewording the instruction may help.";

/**
 * AOR-1a — which check withheld the answer, by class. Built only from the validator's closed codes: an
 * action verb is a literal from its fixed list, never a word from the reply, and the reply is never shown.
 */
export function describeWithheld(fallback: Extract<HebyModelFallback, { kind: "withheld" }>): string {
  const codes = fallback.issueCodes ?? [];
  if (codes.length === 0) return WITHHELD_WORDING;
  const verbs = codes.flatMap((code) => (code.startsWith("action-claim:") ? [code.slice("action-claim:".length)] : []));
  const reasons = [
    ...(verbs.length > 0 ? [`it described an act as having happened (${verbs.map((v) => `“${v}”`).join(", ")})`] : []),
    ...(codes.includes("unsupported-evidence") ? ["it cited a source Hebun did not give it"] : []),
    ...(codes.some((code) => !code.startsWith("action-claim:") && code !== "unsupported-evidence") ? ["it failed Hebun's format checks"] : []),
  ];
  return `No draft was written. The model answered, but Hebun's response checks withheld the answer because ${reasons.join(" and ")}, so nothing was filed. Rewording the instruction may help.`;
}

/** WORK-OUTCOME-CLOSURE-1 — the Work Authority's refusals of a completion declaration, for a person. */
export const DECLARE_REFUSAL_WORDING: Readonly<Record<string, string>> = {
  "not-authorized": "Declaring a work's state needs your organization's Governance authority, which you do not hold.",
  "work-retired": "This work is retired, so its state cannot change.",
  "authority-unavailable": "Hebun could not reach the work authority. Nothing was declared.",
  "no-authorized-tenant-context": "No organization is resolved for this session, so nothing was declared.",
};

export function describeAssignment(result: AssignWorkDraftResult, agentName: string): string {
  switch (result.status) {
    case "prepared":
      return `${result.agentName} wrote the draft (revision ${result.revisionNo}) and is recorded as its author${result.agentRole === "specialist" ? ", chosen as this work's specialist" : ""}. It is not yet this work's evidence: link it below if it belongs to this work. It waits for review in Operations; nothing was sent, published or changed.`;
    case "prepared-stale":
      return `${agentName} wrote the draft (revision ${result.revisionNo}), but ${
        STALE_WORDING[result.reason] ?? result.reason
      }, so Heby does not offer it as this work's evidence. The draft is in Operations.`;
    case "not-prepared":
      /* AE1-ASSIGN-UI-WORDING-1 — a withheld answer is said as such, not as the generic "no model answer". */
      return result.modelFallback?.kind === "withheld"
        ? describeWithheld(result.modelFallback)
        : `No draft was written. ${HEBUN_PREPARATION_REFUSAL_WORDING[result.reason] ?? `(${result.reason})`}`;
    case "refused":
      return ASSIGN_REFUSAL_WORDING[result.reason] ?? `Nothing was asked (${result.reason}).`;
  }
}

/* ═══ HEBY-WORKFLOW-1 — revise after a change request ═══════════════════════════════════════════════ */

export const REVISE_REFUSAL_WORDING: Readonly<Record<ReviseWorkDraftRefusal, string>> = {
  unauthenticated: ASSIGN_REFUSAL_WORDING.unauthenticated,
  "persistence-unavailable": ASSIGN_REFUSAL_WORDING["persistence-unavailable"],
  "work-unresolved": ASSIGN_REFUSAL_WORDING["work-unresolved"],
  "work-retired": "This work item is retired, so no agent can revise its drafts.",
  "work-not-scoped": ASSIGN_REFUSAL_WORDING["work-not-scoped"],
  "not-authorized": "Revising from a change request needs your organization's Governance authority, which you do not hold. Nothing was asked.",
  "agent-required": "Choose an agent first. Nothing was asked.",
  "agent-not-eligible": ASSIGN_REFUSAL_WORDING["agent-not-eligible"],
  "eligibility-unavailable": ASSIGN_REFUSAL_WORDING["eligibility-unavailable"],
  "draft-not-on-this-work": "That draft is not linked to this work, so it cannot be revised from here. Nothing was asked.",
  "no-change-request": "This draft's current revision no longer has a standing change request. Nothing was asked.",
  "review-basis-required": "Read the change request first; the revision is prepared from it. Nothing was asked.",
  "revision-in-progress": "An agent is already revising this draft from another request. Wait for that result. Nothing was asked twice.",
};

/**
 * Who Heby suggests for the revision: the current revision's author, while it is still responsible for this
 * work. A suggestion only — the person chooses, and nothing is asked until they do.
 */
export function revisionSuggestion(
  draft: WorkDraftView,
  agents: readonly { readonly agentId: string; readonly name: string }[],
): { readonly agentId: string | null; readonly text: string } {
  if (draft.author.kind !== "agent") {
    return { agentId: null, text: "A person wrote the current revision. Choose a responsible agent to revise it." };
  }
  const authorId = draft.author.agentId;
  const author = agents.find((agent) => agent.agentId === authorId);
  return author
    ? { agentId: author.agentId, text: `Heby suggests ${author.name}, who wrote the current revision. You decide who revises it.` }
    : {
        agentId: null,
        text: `${draft.author.name ?? "The agent that wrote it"} is no longer responsible for this work. Choose another responsible agent to revise it.`,
      };
}

export function describeRevision(result: ReviseWorkDraftResult, agentName: string): string {
  switch (result.status) {
    case "prepared":
      return `${result.agentName} wrote revision ${result.revisionNo} and is recorded as its author. Earlier revisions are unchanged. It is already linked to this work and now waits for Governance review in Operations; nothing was sent, published or changed.`;
    case "prepared-stale":
      return `${agentName} wrote revision ${result.revisionNo}, but ${
        STALE_WORDING[result.reason] ?? result.reason
      }. It waits for Governance review in Operations.`;
    case "not-prepared":
      return result.modelFallback?.kind === "withheld"
        ? describeWithheld(result.modelFallback)
        : `No revision was written; the current revision and its change request are unchanged. ${HEBUN_PREPARATION_REFUSAL_WORDING[result.reason] ?? `(${result.reason})`}`;
    case "refused":
      return REVISE_REFUSAL_WORDING[result.reason] ?? `Nothing was asked (${result.reason}).`;
  }
}

function ReviseWorkDraft({
  workItemId,
  draft,
  agents,
  onDone,
}: {
  readonly workItemId: string;
  readonly draft: WorkDraftView;
  readonly agents: readonly { readonly agentId: string; readonly name: string; readonly role: AgentWorkRole }[];
  readonly onDone: () => Promise<void>;
}) {
  const [reason, setReason] = useState<CurrentRevisionChangeRequest | null>(null);
  const [instruction, setInstruction] = useState("");
  /* Never preselected: an empty choice asks nothing (D2). */
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const suggestion = revisionSuggestion(draft, agents);
  const agentName = agents.find((agent) => agent.agentId === agentId)?.name ?? "the agent";
  const basis = reason?.status === "requested" && reason.revisionNo === draft.revisionNo ? reason : null;
  const ready = basis !== null && agentId !== "" && instruction.trim().length > 0;

  return (
    <div data-heby-workflow-1="revise" className="mt-1 space-y-1.5 rounded border border-border bg-surface p-2">
      {basis ? (
        <>
          <p className="text-fg">Change request on revision {basis.revisionNo}:</p>
          <p className="whitespace-pre-wrap text-fg-secondary">{basis.justification}</p>
          {/*
            * EAI-SYSTEM-COPY-INTO-CONVERSATION-1 — the reason is shown, never copied into the instruction:
            * it is Governance's record, and in the textarea it would leave as `conversation`.
            */}
          <p className="text-fg-muted">Write your own instruction below; the reason is not sent to the agent.</p>
          <p className="text-fg-muted">
            {suggestion.text}{" "}
            {suggestion.agentId && agentId !== suggestion.agentId ? (
              <button type="button" className="underline underline-offset-2" disabled={pending} onClick={() => setAgentId(suggestion.agentId!)}>
                Choose {agents.find((agent) => agent.agentId === suggestion.agentId)?.name}
              </button>
            ) : null}
          </p>
          <select
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            aria-label="Agent to revise this draft"
            disabled={pending}
            className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
          >
            <option value="">Choose an agent</option>
            {agents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.name} ({ROLE_WORDING[agent.role]})
              </option>
            ))}
          </select>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="What should change in the next revision? Your words and the current revision reach the model."
            aria-label="Revision instruction for the agent"
            rows={3}
            disabled={pending}
            className="w-full rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
          />
          <Button
            type="button"
            size="sm"
            disabled={pending || !ready}
            onClick={() =>
              start(async () => {
                if (!ready) return;
                setMessage(null);
                try {
                  const result = await reviseWorkDraftAction({
                    workItemId,
                    artifactId: draft.artifactId,
                    agentId,
                    prompt: instruction,
                    expectedRevisionNo: basis.revisionNo,
                    reviewBasisDecisionId: basis.decisionId,
                  });
                  setMessage(describeRevision(result, agentName));
                  if (result.status === "prepared") setInstruction("");
                } catch {
                  setMessage("The request did not complete, so Hebun cannot say whether a revision was written. Check Operations before asking again.");
                }
                await onDone();
              })
            }
          >
            {pending ? `${agentName} is revising…` : agentId ? `Ask ${agentName} to revise` : "Choose an agent to revise"}
          </Button>
        </>
      ) : reason && reason.status !== "requested" ? (
        <p className="text-fg-muted">
          {reason.status === "unavailable"
            ? "The change request could not be read just now. This is unknown, not absent."
            : reason.status === "not-authorized"
              ? "Change requests are shown only to a Governance authority of this organization."
              : "There is no standing change request on the current revision."}
        </p>
      ) : (
        <button
          type="button"
          className="underline underline-offset-2"
          disabled={pending}
          onClick={() =>
            start(async () => {
              try {
                setReason(await readRevisionChangeRequestAction({ artifactId: draft.artifactId, revisionNo: draft.revisionNo }));
              } catch {
                setReason({ status: "unavailable" });
              }
            })
          }
        >
          Show the change request and ask an agent to revise
        </button>
      )}
      {message ? (
        <p className="text-fg" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function HebyWorkDraftAffordance({ workItemId }: { readonly workItemId: string }) {
  const [choices, setChoices] = useState<WorkDraftChoices | null>(null);
  const [chosenAgentId, setChosenAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [artifactType, setArtifactType] = useState<WorkArtifactType>("operational-plan");
  const [destination, setDestination] = useState<ContentDestination | "">("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  /* The draft just prepared for THIS work, which the person may now link. Cleared once linked. */
  const [linkable, setLinkable] = useState<{ artifactId: string } | null>(null);
  const [pending, start] = useTransition();

  const load = () =>
    readWorkDraftChoicesAction({ workItemId })
      .then(setChoices)
      .catch(() => setChoices({ status: "unavailable" }));
  useEffect(() => {
    let live = true;
    readWorkDraftChoicesAction({ workItemId })
      .then((read) => {
        if (live) setChoices(read);
      })
      .catch(() => {
        if (live) setChoices({ status: "unavailable" });
      });
    return () => {
      live = false;
    };
  }, [workItemId]);

  const read = choices?.status === "read" ? choices : null;
  const agents: AgentOption[] = (read?.agents ?? []).map((agent) => ({
    agentId: agent.agentId,
    name: `${agent.name} (${ROLE_WORDING[agent.role]})`,
    ...(agent.openDraftId ? { unavailableNote: "has a draft on this work waiting for review" } : {}),
  }));
  /* One responsible agent is chosen for the person; with several, nobody is chosen by default. */
  const selectable = agents.filter((agent) => agent.unavailableNote === undefined);
  const agentId = agents.length === 1 ? (selectable[0]?.agentId ?? "") : chosenAgentId;
  const agentName = read?.agents.find((agent) => agent.agentId === agentId)?.name ?? "the agent";
  const recommendation = read ? describeRecommendation(read) : null;
  /* A prepared draft waiting for the person's link blocks another assignment: link it (or leave) first. */
  const ready =
    linkable === null &&
    read !== null &&
    read.mayAssign &&
    selectable.some((agent) => agent.agentId === agentId) &&
    title.trim().length > 0 &&
    prompt.trim().length > 0 &&
    (artifactType !== "content-draft" || destination !== "");

  return (
    <details className="mt-2 rounded-md border border-border bg-bg">
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-fg-secondary">{CAPABILITY.label}</summary>
      <div className="space-y-2 border-t border-border p-2.5 text-xs leading-5">
        <p className="text-fg-muted">
          {CAPABILITY.objective} The agent is given {CAPABILITY.input.join("; ")}. It cannot{" "}
          {CAPABILITY.cannot.join("; ")}. No approval is needed to write a draft. {CAPABILITY.completion}
        </p>

        {choices === null ? (
          <p className="text-fg-muted">Checking which agents are responsible for this work…</p>
        ) : choices.status === "unavailable" ? (
          <p className="text-fg-secondary">Hebun could not read this work’s agents and drafts right now. Nothing was asked.</p>
        ) : choices.status === "refused" ? (
          <p className="text-fg-secondary">{ASSIGN_REFUSAL_WORDING[choices.reason]}</p>
        ) : (
          <>
            {/*
              * WORK-OUTCOME-CLOSURE-1 — the work's outcome as the records hold it, and a suggestion only when
              * every linked draft's current revision is accepted. The declaration is the Work register's own
              * human action, on the person's click; Heby never declares, and acceptance never declares.
              */}
            <div data-work-outcome={choices.completion.offered ? "suggested" : choices.completion.reason}>
              <p className="text-fg">This work is declared {choices.declaredState}.</p>
              {choices.completion.offered ? (
                <>
                  <p className="text-fg-secondary">{COMPLETION_SUGGESTION_TEXT}</p>
                  {choices.mayAssign ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-1"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          try {
                            const declared = await setWorkDeclaredStateAction({ workItemId, declaredState: SUGGESTED_DECLARED_STATE });
                            setMessage(
                              declared.status === "recorded"
                                ? { text: "You declared this work complete. Hebun recorded what you said; it verified nothing.", ok: true }
                                : { text: `Not declared. ${DECLARE_REFUSAL_WORDING[declared.reason] ?? `(${declared.reason})`}`, ok: false },
                            );
                          } catch {
                            setMessage({ text: "The request did not complete, so Hebun cannot say whether the work was declared complete. Check the work register.", ok: false });
                          }
                          await load();
                        })
                      }
                    >
                      Declare this work complete
                    </Button>
                  ) : (
                    <p className="text-fg-secondary">{DECLARE_REFUSAL_WORDING["not-authorized"]}</p>
                  )}
                </>
              ) : (
                <p className="text-fg-muted">{COMPLETION_WITHHELD_TEXT[choices.completion.reason]}</p>
              )}
              {choices.drafts.some((draft) => draft.review === "accepted") ? (
                <p className="text-fg-muted">{ACCEPTANCE_IS_NOT_COMPLETION}</p>
              ) : null}
            </div>

            {choices.drafts.length > 0 ? (
              <div>
                <p className="text-fg">Drafts linked to this work</p>
                <ul className="mt-1 list-disc pl-4 text-fg-secondary">
                  {choices.drafts.map((draft) => (
                    <li key={draft.artifactId}>
                      {describeWorkDraft(draft)}
                      {/* HEBY-WORKFLOW-1 — Governance asked for changes: the way forward stays on this work. */}
                      {draft.review === "changes-requested" && !draft.retired && choices.mayAssign ? (
                        <ReviseWorkDraft workItemId={workItemId} draft={draft} agents={choices.agents} onDone={load} />
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Link href="/operations" className="underline underline-offset-2">
                  Review drafts in Operations
                </Link>
              </div>
            ) : null}

            {agents.length === 0 ? (
              <p className="text-fg-secondary">
                No agent in service is responsible for this work’s scope
                {choices.notResponsible > 0 ? ` (${choices.notResponsible} in service, none responsible)` : ""}, so none
                can be assigned. An agent’s responsibility is set in its mandate on{" "}
                <Link href="/agents" className="underline underline-offset-2">
                  Agents
                </Link>
                .
              </p>
            ) : !choices.mayAssign ? (
              <p className="text-fg-secondary">{ASSIGN_REFUSAL_WORDING["not-authorized"]}</p>
            ) : selectable.length === 0 ? (
              <p className="text-fg-secondary">
                Every agent responsible for this work already has a draft on it waiting for review. Review or revise it in
                Operations before assigning another.
              </p>
            ) : (
              <>
                {recommendation && agents.length > 1 ? (
                  <p className="text-fg">
                    {recommendation}{" "}
                    {chosenAgentId !== read!.recommendedAgentId ? (
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        disabled={pending}
                        onClick={() => setChosenAgentId(read!.recommendedAgentId!)}
                      >
                        Choose {read!.agents.find((agent) => agent.agentId === read!.recommendedAgentId)?.name}
                      </button>
                    ) : null}
                  </p>
                ) : null}
                {agents.length > 1 ? (
                  <AgentChoiceSelect
                    id={`heby-work-draft-agent-${workItemId}`}
                    value={chosenAgentId}
                    onChange={setChosenAgentId}
                    agents={agents}
                    disabled={pending}
                  />
                ) : (
                  <p className="text-fg">
                    Agent: {agents[0]!.name}
                    {agents[0]!.unavailableNote ? ` — ${agents[0]!.unavailableNote}` : " — responsible for this work"}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={artifactType}
                    onChange={(event) => setArtifactType(event.target.value as WorkArtifactType)}
                    className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
                    aria-label="Draft type"
                    disabled={pending}
                  >
                    {WORK_ARTIFACT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ARTIFACT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  {artifactType === "content-draft" ? (
                    <select
                      value={destination}
                      onChange={(event) => setDestination(event.target.value as ContentDestination | "")}
                      className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
                      aria-label="Where the content is meant to go"
                      disabled={pending}
                    >
                      <option value="">Choose where it goes</option>
                      {CONTENT_DESTINATIONS.map((value) => (
                        <option key={value} value={value}>
                          {CONTENT_DESTINATION_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Draft title"
                    aria-label="Draft title"
                    disabled={pending}
                    className="min-w-[12rem] flex-1 rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
                  />
                </div>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="What should the agent write? Your words reach the model; this work item does not."
                  aria-label="Instruction for the agent"
                  rows={3}
                  disabled={pending}
                  className="w-full rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !ready}
                  onClick={() =>
                    start(async () => {
                      if (!ready) return;
                      setMessage(null);
                      try {
                        const result = await assignWorkDraftAction({
                          workItemId,
                          agentId,
                          prompt,
                          title,
                          artifactType,
                          ...(artifactType === "content-draft" ? { intendedDestination: destination } : {}),
                        });
                        setMessage({ text: describeAssignment(result, agentName), ok: result.status === "prepared" });
                        setLinkable(result.status === "prepared" ? { artifactId: result.artifactId } : null);
                        if (result.status === "prepared") {
                          setPrompt("");
                          setTitle("");
                        }
                      } catch {
                        setMessage({
                          text: "The request did not complete, so Hebun cannot say whether a draft was written. Check Operations before asking again.",
                          ok: false,
                        });
                      }
                      await load();
                    })
                  }
                >
                  {/* AE1-ASSIGN-UI-WORDING-1 — before a choice the button names no agent. */}
                  {pending ? `${agentName} is writing…` : agentId ? `Assign to ${agentName}` : "Choose an agent to assign"}
                </Button>
              </>
            )}
          </>
        )}

        {linkable ? (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const linked = await declareWorkReferenceAction({ workItemId, kind: "work-artifact", referentId: linkable.artifactId });
                  setMessage(
                    linked.status === "recorded"
                      ? { text: "You linked the draft to this work as its evidence. It waits for review in Operations.", ok: true }
                      : { text: `Not linked. ${LINK_REFUSAL_WORDING[linked.reason] ?? `(${linked.reason})`}`, ok: false },
                  );
                  if (linked.status === "recorded" || linked.reason === "reference-already-declared") setLinkable(null);
                } catch {
                  setMessage({ text: "The request did not complete, so Hebun cannot say whether the draft was linked. Check the work register.", ok: false });
                }
                await load();
              })
            }
          >
            Link this draft to the work
          </Button>
        ) : null}
        {message ? (
          <p className={message.ok ? "text-fg" : "text-fg-secondary"} role="status">
            {message.text}{" "}
            <Link href="/operations" className="underline underline-offset-2">
              Operations
            </Link>
            {" · "}
            <Link href="/director/work" className="underline underline-offset-2">
              Work register
            </Link>
          </p>
        ) : null}
      </div>
    </details>
  );
}
