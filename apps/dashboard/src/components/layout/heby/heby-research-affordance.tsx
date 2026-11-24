"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  authorizeStandingResearchAction,
  readResearchChoicesAction,
  runStandingResearchNowAction,
  withdrawStandingResearchAction,
} from "@/app/(dashboard)/heby/work-state-origination-actions";
import type { ResearchChoices } from "@/features/agent-work/assign-research-report.server";
import type { RunStandingResearchResult } from "@/features/standing-research-authority/standing-research.server";
import {
  MAX_RESEARCH_BRIEF_CHARACTERS,
  MAX_RESEARCH_TITLE_CHARACTERS,
  type StandingResearchAuthorizationRecord,
  type StandingResearchRefusal,
} from "@/features/standing-research-authority/contracts";

/*
 * P6-1 / P6-2 — STANDING RESEARCH ON THIS WORK ITEM.
 *
 * Research runs only under the organization's standing research authorization: Governance writes the
 * brief, picks a responsible agent with a research mandate, and can withdraw it. "Run now" runs exactly
 * that brief. The brief is the only text sent to the model; the work item is not. What is filed is an
 * UNSOURCED RESEARCH DRAFT waiting for review in Operations; nothing is sent, published or decided.
 */

type RunRefusal = Extract<RunStandingResearchResult, { status: "refused" }>["reason"];
type NotPrepared = Extract<RunStandingResearchResult, { status: "not-prepared" }>["reason"];

export const RESEARCH_REFUSAL_WORDING: Partial<Record<RunRefusal, string>> = {
  "not-authorized": "Only your organization's Governance authority can run research.",
  "agent-not-eligible": "That agent is not in service, holds no research mandate, or is not responsible for this work.",
  "model-connectivity-disabled": "Claude connectivity is off, so no research was asked for.",
  "research-data-use-not-authorized": "Your organization has not authorized research with Anthropic, so nothing was sent.",
  "research-requires-own-key":
    "Research runs only on your organization's own Anthropic key, connected and verified. Hebun's own key is not used for research.",
  "research-in-progress": "This agent is already researching this work. Nothing was asked twice.",
  "no-active-authorization": "There is no standing research authorization in force, so nothing was asked.",
  "stale-authorization-revision": "The research authorization changed since this page loaded. Nothing was asked; reload and check it.",
};

const WRITE_REFUSAL_WORDING: Partial<Record<StandingResearchRefusal, string>> = {
  "not-the-governance-authority": "Only your organization's Governance authority can authorize or withdraw research.",
  "justification-required": "Give a reason of at least 24 characters. It is recorded with the Governance decision.",
  "invalid-brief": `Give a title (up to ${MAX_RESEARCH_TITLE_CHARACTERS} characters) and a brief (up to ${MAX_RESEARCH_BRIEF_CHARACTERS}).`,
  "agent-not-eligible": "That agent is not in service, holds no research mandate, or is not responsible for this work.",
  "stale-authorization-revision": "The research authorization changed since this page loaded. Nothing was written; reload and check it.",
  "concurrent-authorization-change": "Someone changed the research authorization at the same moment. Nothing was written; reload.",
  "already-authorized": "This exact brief is already authorized.",
  "no-active-authorization": "There is no standing research authorization in force to withdraw.",
  "plan-schedule-not-included": "Scheduled research is not included in the Free plan. Change the plan on Account → Plan.",
};

const NOT_PREPARED_WORDING: Partial<Record<NotPrepared, string>> = {
  "unsourced-link-in-output": "The agent's reply contained a web address, so it was not filed: an unsourced draft must not read as sourced.",
  "sourced-link-in-output": "The agent wrote a web address itself instead of citing a search result, so nothing was filed.",
  "sourced-answer-mismatch": "The search citations could not be matched to the agent's reply, so nothing was filed.",
  "sourced-no-sources": "The agent's reply cited no search result, so it was not filed as sourced research.",
  "research-incomplete": "The web search did not finish in one request. It was not continued, and nothing was filed.",
  "output-truncated": "The agent's reply was cut off, so nothing was filed.",
  "model-refused": "The model declined to write this report. Nothing was filed.",
  "standing-authorization-changed-while-preparing": "The research authorization was withdrawn or replaced while the agent wrote. Nothing was filed.",
};

function describeRun(result: RunStandingResearchResult): string {
  if (result.status === "prepared") {
    return result.sourcing === "web-search"
      ? `${result.agentName} filed a sourced research draft from web search. Its sources are unverified third-party pages. Review it in Operations.`
      : `${result.agentName} filed an unsourced research draft. Review it in Operations.`;
  }
  if (result.status === "refused") return RESEARCH_REFUSAL_WORDING[result.reason] ?? `Not asked (${result.reason}). Nothing was sent.`;
  return NOT_PREPARED_WORDING[result.reason] ?? `No report was filed (${result.reason}).`;
}

const field = "rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary";

export function HebyResearchAffordance({ workItemId }: { readonly workItemId: string }) {
  const [read, setRead] = useState<{ choices: ResearchChoices; standing: StandingResearchAuthorizationRecord | null | "unavailable" } | null>(null);
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [justification, setJustification] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean; operations?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    readResearchChoicesAction({ workItemId })
      .then((next) => {
        if (!live) return;
        setRead(next);
        if (next.choices.status === "read" && next.choices.agents.length === 1) setAgentId(next.choices.agents[0]!.agentId);
      })
      .catch(() => live && setRead({ choices: { status: "unavailable" }, standing: "unavailable" }));
    return () => {
      live = false;
    };
  }, [workItemId, version]);

  if (!read) return <p className="mt-2 text-fg-muted">Reading research options…</p>;
  const { choices, standing } = read;
  if (choices.status !== "read" || standing === "unavailable") {
    return <p className="mt-2 text-fg-secondary">Research options could not be read right now. Nothing was asked.</p>;
  }

  const active = standing?.state === "active" ? standing : null;
  const here = active?.workItemId === workItemId ? active : null;
  const observed = standing?.authorizationRevision ?? null;
  const agentName = (id: string) => choices.agents.find((a) => a.agentId === id)?.name ?? "the authorized agent";
  const reasonOk = justification.trim().length >= 24;

  const act = (run: () => Promise<{ text: string; ok: boolean; operations?: boolean }>) =>
    start(async () => {
      setMessage(null);
      try {
        setMessage(await run());
      } catch {
        setMessage({ text: "The request did not complete, so Hebun cannot say what happened. Reload and check.", ok: false });
      }
      setVersion((v) => v + 1);
    });

  const authorize = () =>
    act(async () => {
      const result = await authorizeStandingResearchAction({ workItemId, agentId, title, brief, justification, observedAuthorizationRevision: observed });
      if (result.status !== "authorized") return { text: WRITE_REFUSAL_WORDING[result.reason] ?? `Not authorized (${result.reason}).`, ok: false };
      setTitle("");
      setBrief("");
      setJustification("");
      return { text: `Research authorized (revision ${result.authorization.authorizationRevision}). Nothing has run yet.`, ok: true };
    });

  const withdraw = () =>
    act(async () => {
      const result = await withdrawStandingResearchAction({ justification, observedAuthorizationRevision: observed });
      if (result.status !== "authorized") return { text: WRITE_REFUSAL_WORDING[result.reason] ?? `Not withdrawn (${result.reason}).`, ok: false };
      setJustification("");
      return { text: "Research authorization withdrawn. No further research runs under it.", ok: true };
    });

  const runNow = () =>
    act(async () => {
      const result = await runStandingResearchNowAction({ observedAuthorizationRevision: here!.authorizationRevision });
      return { text: describeRun(result), ok: result.status === "prepared", operations: result.status === "prepared" };
    });

  const reasonField = (
    <input
      value={justification}
      onChange={(event) => setJustification(event.target.value)}
      placeholder="Reason for the Governance decision (at least 24 characters)"
      aria-label="Reason"
      disabled={pending}
      className={field}
    />
  );

  return (
    <section aria-label="Research report" className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-fg">Research report</p>
      <p className="text-fg-muted">
        Research runs only on a brief your Governance authority has authorized. An agent writes a research draft from
        it. The web is searched only if your organization authorized web search for research; otherwise the draft is
        unsourced. Either way it waits for review in Operations.
      </p>

      {here ? (
        <div className="flex flex-col gap-1">
          <p className="text-fg">
            Authorized brief (revision {here.authorizationRevision}) · {agentName(here.agentId)}
          </p>
          <p className="text-fg-secondary">{here.title}</p>
          <p className="whitespace-pre-wrap text-fg-muted">{here.brief}</p>
        </div>
      ) : active ? (
        <p className="text-fg-secondary">
          Your organization&apos;s research brief is authorized on another work item. One brief is authorized at a time;
          authorizing one here replaces it.
        </p>
      ) : (
        <p className="text-fg-secondary">No research is authorized for your organization.</p>
      )}

      {!choices.mayAsk ? (
        <p className="text-fg-secondary">Only your organization&apos;s Governance authority can authorize, withdraw or run research.</p>
      ) : (
        <>
          {here ? (
            <div className="flex flex-col gap-2">
              {choices.ownKeyReady === false ? (
                <p className="text-fg-secondary">
                  {RESEARCH_REFUSAL_WORDING["research-requires-own-key"]}{" "}
                  <Link href="/integrations/anthropic" className="underline underline-offset-2">
                    Connect your key
                  </Link>
                </p>
              ) : (
                <div>
                  <Button type="button" size="sm" disabled={pending} onClick={runNow}>
                    {pending ? "Working…" : "Run research now"}
                  </Button>
                </div>
              )}
              {reasonField}
              <div>
                <Button type="button" size="sm" variant="outline" disabled={pending || !reasonOk} onClick={withdraw}>
                  Withdraw research authorization
                </Button>
              </div>
            </div>
          ) : choices.agents.length === 0 ? (
            <p className="text-fg-secondary">
              No agent in service holds a research mandate for this work’s scope. Set one on{" "}
              <Link href="/agents" className="underline underline-offset-2">
                Agents
              </Link>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {choices.agents.length > 1 ? (
                <select value={agentId} onChange={(event) => setAgentId(event.target.value)} aria-label="Research agent" disabled={pending} className={field}>
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
                maxLength={MAX_RESEARCH_TITLE_CHARACTERS}
                disabled={pending}
                className={field}
              />
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="The research brief. Only these words reach the model; this work item does not."
                aria-label="Research brief"
                rows={3}
                maxLength={MAX_RESEARCH_BRIEF_CHARACTERS}
                disabled={pending}
                className={`w-full ${field}`}
              />
              {reasonField}
              <div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending || !agentId || !title.trim() || !brief.trim() || !reasonOk}
                  onClick={authorize}
                >
                  Authorize research
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {message ? (
        <p role="status" className={message.ok ? "text-fg" : "text-fg-secondary"}>
          {message.text}{" "}
          {message.operations ? (
            <Link href="/operations" className="underline underline-offset-2">
              Open Operations
            </Link>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
