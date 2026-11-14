"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { assignResearchReportAction, readResearchChoicesAction } from "@/app/(dashboard)/heby/work-state-origination-actions";
import type { AssignResearchReportResult, ResearchChoices } from "@/features/agent-work/assign-research-report.server";

/*
 * P6-1 — ASK A RESPONSIBLE AGENT FOR ONE RESEARCH REPORT ON THIS WORK ITEM ("run now").
 *
 * Heby lists only agents the server found holding `prepare-research` and responsible for this item's
 * scope. The question is the only thing sent to the model; the work item is not. What is filed is an
 * UNSOURCED RESEARCH DRAFT waiting for review in Operations; nothing is sent, published or decided.
 */

type Refusal = Extract<AssignResearchReportResult, { status: "refused" }>["reason"];
type NotPrepared = Extract<AssignResearchReportResult, { status: "not-prepared" }>["reason"];

export const RESEARCH_REFUSAL_WORDING: Partial<Record<Refusal, string>> = {
  "not-authorized": "Only your organization's Governance authority can ask for research.",
  "agent-not-eligible": "That agent is not in service, holds no research mandate, or is not responsible for this work.",
  "model-connectivity-disabled": "Claude connectivity is off, so no research was asked for.",
  "research-data-use-not-authorized": "Your organization has not authorized research with Anthropic, so nothing was sent.",
  "research-requires-own-key":
    "Research runs only on your organization's own Anthropic key, connected and verified. Hebun's own key is not used for research.",
  "research-in-progress": "This agent is already researching this work. Nothing was asked twice.",
  "invalid-input": "Give the report a title and a question.",
};

const NOT_PREPARED_WORDING: Partial<Record<NotPrepared, string>> = {
  "unsourced-link-in-output": "The agent's reply contained a web address, so it was not filed: an unsourced draft must not read as sourced.",
  "output-truncated": "The agent's reply was cut off, so nothing was filed.",
  "model-refused": "The model declined to write this report. Nothing was filed.",
};

function describe(result: AssignResearchReportResult): string {
  if (result.status === "prepared") return `${result.agentName} filed an unsourced research draft. Review it in Operations.`;
  if (result.status === "refused") return RESEARCH_REFUSAL_WORDING[result.reason] ?? `Not asked (${result.reason}). Nothing was sent.`;
  return NOT_PREPARED_WORDING[result.reason] ?? `No report was filed (${result.reason}).`;
}

export function HebyResearchAffordance({ workItemId }: { readonly workItemId: string }) {
  const [choices, setChoices] = useState<ResearchChoices | null>(null);
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    readResearchChoicesAction({ workItemId })
      .then((read) => {
        if (!live) return;
        setChoices(read);
        if (read.status === "read" && read.agents.length === 1) setAgentId(read.agents[0]!.agentId);
      })
      .catch(() => live && setChoices({ status: "unavailable" }));
    return () => {
      live = false;
    };
  }, [workItemId]);

  if (!choices) return <p className="mt-2 text-fg-muted">Reading research options…</p>;
  if (choices.status !== "read") {
    return <p className="mt-2 text-fg-secondary">Research options could not be read right now. Nothing was asked.</p>;
  }

  const ready = choices.mayAsk && choices.ownKeyReady !== false && agentId !== "" && title.trim() !== "" && question.trim() !== "";

  return (
    <section aria-label="Research report" className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-fg">Research report</p>
      <p className="text-fg-muted">
        An agent writes an unsourced research draft from your question. No source is searched yet; the draft waits for
        review in Operations.
      </p>
      {choices.agents.length === 0 ? (
        <p className="text-fg-secondary">
          No agent in service holds a research mandate for this work’s scope. Set one on{" "}
          <Link href="/agents" className="underline underline-offset-2">
            Agents
          </Link>
          .
        </p>
      ) : !choices.mayAsk ? (
        <p className="text-fg-secondary">{RESEARCH_REFUSAL_WORDING["not-authorized"]}</p>
      ) : choices.ownKeyReady === false ? (
        <p className="text-fg-secondary">
          {RESEARCH_REFUSAL_WORDING["research-requires-own-key"]}{" "}
          <Link href="/integrations/anthropic" className="underline underline-offset-2">
            Connect your key
          </Link>
        </p>
      ) : (
        <>
          {choices.agents.length > 1 ? (
            <select
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              aria-label="Research agent"
              disabled={pending}
              className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
            >
              <option value="">Choose an agent</option>
              {choices.agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-fg">Agent: {choices.agents[0]!.name}</p>
          )}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Report title"
            aria-label="Report title"
            disabled={pending}
            className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
          />
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Your research question. Only these words reach the model; this work item does not."
            aria-label="Research question"
            rows={3}
            disabled={pending}
            className="w-full rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
          />
          <div>
            <Button
              type="button"
              size="sm"
              disabled={pending || !ready}
              onClick={() =>
                start(async () => {
                  setMessage(null);
                  try {
                    const result = await assignResearchReportAction({ workItemId, agentId, question, title });
                    setMessage({ text: describe(result), ok: result.status === "prepared" });
                    if (result.status === "prepared") {
                      setTitle("");
                      setQuestion("");
                    }
                  } catch {
                    setMessage({ text: "The request did not complete, so Hebun cannot say whether a report was filed. Check Operations.", ok: false });
                  }
                })
              }
            >
              {pending ? "Researching…" : "Run research now"}
            </Button>
          </div>
        </>
      )}
      {message ? (
        <p role="status" className={message.ok ? "text-fg" : "text-fg-secondary"}>
          {message.text}{" "}
          {message.ok ? (
            <Link href="/operations" className="underline underline-offset-2">
              Open Operations
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
