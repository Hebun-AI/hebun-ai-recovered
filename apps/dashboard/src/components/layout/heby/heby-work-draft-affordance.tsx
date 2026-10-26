"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AgentChoiceSelect, type AgentOption } from "@/components/agents/agent-choice-select";
import { HEBUN_PREPARATION_REFUSAL_WORDING } from "@/components/operations-preparation/prepare-with-hebun";
import { assignWorkDraftAction, readWorkDraftChoicesAction } from "@/app/(dashboard)/heby/work-state-origination-actions";
import { declareWorkReferenceAction, setWorkDeclaredStateAction } from "@/app/(dashboard)/director/work/actions";
import type {
  AssignWorkDraftRefusal,
  AssignWorkDraftResult,
  WorkDraftChoices,
  WorkDraftView,
} from "@/features/agent-work/assign-work-draft.server";
import { agentWorkCapability, type AgentWorkRole } from "@/features/agent-work/capabilities";
import {
  CONTENT_DESTINATION_LABELS,
  CONTENT_DESTINATIONS,
  WORK_ARTIFACT_TYPES,
  type ContentDestination,
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

export const ARTIFACT_TYPE_LABELS: Readonly<Record<WorkArtifactType, string>> = {
  "operational-plan": "Plan",
  "message-draft": "Message",
  "content-draft": "Content",
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

/** The model answered and Hebun's response checks withheld it. The checks' reasons are not recorded (AE1-WITHHELD-DIAGNOSABILITY-1). */
export const WITHHELD_WORDING =
  "No draft was written. The model answered, but Hebun's response checks withheld the answer, so nothing was filed. Which check withheld it is not recorded; rewording the instruction may help.";

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
        ? WITHHELD_WORDING
        : `No draft was written. ${HEBUN_PREPARATION_REFUSAL_WORDING[result.reason] ?? `(${result.reason})`}`;
    case "refused":
      return ASSIGN_REFUSAL_WORDING[result.reason] ?? `Nothing was asked (${result.reason}).`;
  }
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
                    <li key={draft.artifactId}>{describeWorkDraft(draft)}</li>
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
