"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AgentChoiceSelect, type AgentOption } from "@/components/agents/agent-choice-select";
import { HEBUN_PREPARATION_REFUSAL_WORDING } from "@/components/operations-preparation/prepare-with-hebun";
import { assignWorkDraftAction, readWorkDraftChoicesAction } from "@/app/(dashboard)/heby/work-state-origination-actions";
import { declareWorkReferenceAction } from "@/app/(dashboard)/director/work/actions";
import type {
  AssignWorkDraftRefusal,
  AssignWorkDraftResult,
  WorkDraftChoices,
  WorkDraftView,
} from "@/features/agent-work/assign-work-draft.server";
import { agentWorkCapability } from "@/features/agent-work/capabilities";
import {
  CONTENT_DESTINATION_LABELS,
  CONTENT_DESTINATIONS,
  WORK_ARTIFACT_TYPES,
  type ContentDestination,
  type WorkArtifactType,
} from "@/features/work-artifacts/contracts";

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
  accepted: "accepted — this task is complete",
  unknown: "review state could not be read",
};

/** One sentence per fact the records hold about a draft linked to this work. */
export function describeWorkDraft(draft: WorkDraftView): string {
  const author =
    draft.author.kind === "agent" ? `written by ${draft.author.name ?? "an agent no longer listed"}` : "written by a person";
  const state = draft.retired ? "retired" : REVIEW_WORDING[draft.review];
  return `${ARTIFACT_TYPE_LABELS[draft.artifactType]} “${draft.title}” · revision ${draft.revisionNo} · ${author} · ${state}`;
}

export function describeAssignment(result: AssignWorkDraftResult, agentName: string): string {
  switch (result.status) {
    case "prepared":
      return `${result.agentName} wrote the draft (revision ${result.revisionNo}). It is not yet this work's evidence: link it below if it belongs to this work. It waits for review in Operations; nothing was sent, published or changed.`;
    case "prepared-stale":
      return `${agentName} wrote the draft (revision ${result.revisionNo}), but ${
        STALE_WORDING[result.reason] ?? result.reason
      }, so Heby does not offer it as this work's evidence. The draft is in Operations.`;
    case "not-prepared":
      return `No draft was written. ${HEBUN_PREPARATION_REFUSAL_WORDING[result.reason] ?? `(${result.reason})`}`;
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
    name: agent.name,
    ...(agent.openDraftId ? { unavailableNote: "has a draft on this work waiting for review" } : {}),
  }));
  /* One responsible agent is chosen for the person; with several, nobody is chosen by default. */
  const selectable = agents.filter((agent) => agent.unavailableNote === undefined);
  const agentId = agents.length === 1 ? (selectable[0]?.agentId ?? "") : chosenAgentId;
  const agentName = (agents.length === 1 ? agents[0]?.name : agents.find((agent) => agent.agentId === agentId)?.name) ?? "The agent";
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
                  {pending ? `${agentName} is writing…` : `Assign to ${agentName}`}
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
