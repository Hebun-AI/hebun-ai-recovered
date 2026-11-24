"use client";

/*
 * P5-5 — weekly agent tasks on /agents. One row per template: what is in force, and a form to authorize
 * (or replace) it, or withdraw it. Each is a Governance decision with the person's reason. The card decides
 * nothing; every refusal is the writer's. The run itself is off until the platform switch is turned on.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { authorizeStandingAgentTaskAction, withdrawStandingAgentTaskAction } from "@/app/(dashboard)/agents/actions";
import {
  AGENT_TASK_TEMPLATE_LABELS,
  STANDING_AGENT_TASK_TEMPLATES,
  type StandingAgentTaskAuthorizationRecord,
  type StandingAgentTaskRefusal,
  type StandingAgentTaskTemplate,
} from "@/features/standing-agent-task/contracts";

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const REFUSAL: Partial<Record<StandingAgentTaskRefusal, string>> = {
  "not-the-governance-authority": "Only your organization's Governance authority can authorize or withdraw a weekly task.",
  "justification-required": "Give a reason. It is recorded with the Governance decision.",
  "invalid-brief": "Choose a work item and an agent, and give a title (up to 200 characters) and a brief (up to 4,000).",
  "agent-not-eligible": "That agent is not in service, holds no draft mandate, or is not responsible for this work.",
  "work-unavailable": "That work item could not be read for this organization.",
  "stale-authorization-revision": "This weekly task changed since the page loaded. Nothing was written; reload.",
  "concurrent-authorization-change": "Someone changed this weekly task at the same moment. Nothing was written; reload.",
  "already-authorized": "This exact weekly task is already authorized.",
  "no-active-authorization": "There is no weekly task in force to withdraw.",
  "plan-schedule-not-included": "Weekly tasks are not included in the Free plan. Change the plan on Account → Plan.",
};

interface Option {
  readonly id: string;
  readonly label: string;
}

export function AgentTaskScheduleCard({
  authorizations,
  workItems,
  agents,
}: {
  readonly authorizations: Readonly<Record<StandingAgentTaskTemplate, StandingAgentTaskAuthorizationRecord | null>> | null;
  readonly workItems: readonly Option[];
  readonly agents: readonly Option[];
}) {
  const ids = useId();
  const router = useRouter();
  const [template, setTemplate] = useState<StandingAgentTaskTemplate>("weekly-content-plan");
  const [workItemId, setWorkItemId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [justification, setJustification] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = authorizations?.[template] ?? null;
  const observed = current?.authorizationRevision ?? null;
  const nameOf = (list: readonly Option[], id: string) => list.find((o) => o.id === id)?.label ?? id.slice(0, 8);

  const done = (result: { status: string; reason?: string }, ok: string) => {
    setMessage(result.status === "authorized" ? ok : REFUSAL[result.reason as StandingAgentTaskRefusal] ?? `Nothing was written: ${result.reason}.`);
    if (result.status === "authorized") {
      setJustification("");
      router.refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly agent tasks</CardTitle>
        <CardDescription>
          Every Monday at 08:00 (Istanbul) the authorized agent prepares one internal draft for review, on your
          organization&apos;s own Anthropic key. It sends and publishes nothing.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {authorizations === null ? (
          <p className="text-xs text-fg-muted">Weekly tasks could not be read. Nothing is shown rather than a guess.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs">
            {STANDING_AGENT_TASK_TEMPLATES.map((t) => {
              const a = authorizations[t];
              return (
                <li key={t} className="rounded-md border bg-surface-sunken p-3">
                  <span className="font-medium text-fg">{AGENT_TASK_TEMPLATE_LABELS[t]}: </span>
                  {a?.state === "active"
                    ? `authorized (revision ${a.authorizationRevision}) — ${nameOf(agents, a.agentId)} on “${nameOf(workItems, a.workItemId)}”: ${a.title}`
                    : a
                      ? `withdrawn (revision ${a.authorizationRevision})`
                      : "not authorized"}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-template`} className="text-xs font-medium text-fg">Task</label>
          <select id={`${ids}-template`} value={template} onChange={(e) => { setTemplate(e.target.value as StandingAgentTaskTemplate); setMessage(null); }} className={FIELD}>
            {STANDING_AGENT_TASK_TEMPLATES.map((t) => <option key={t} value={t}>{AGENT_TASK_TEMPLATE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-work`} className="text-xs font-medium text-fg">Work item</label>
            <select id={`${ids}-work`} value={workItemId} onChange={(e) => setWorkItemId(e.target.value)} className={FIELD}>
              <option value="">Choose…</option>
              {workItems.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${ids}-agent`} className="text-xs font-medium text-fg">Agent</label>
            <select id={`${ids}-agent`} value={agentId} onChange={(e) => setAgentId(e.target.value)} className={FIELD}>
              <option value="">Choose…</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-title`} className="text-xs font-medium text-fg">Title</label>
          <input id={`${ids}-title`} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-brief`} className="text-xs font-medium text-fg">Brief — what the agent should cover each week</label>
          <textarea id={`${ids}-brief`} rows={3} maxLength={4000} value={brief} onChange={(e) => setBrief(e.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${ids}-why`} className="text-xs font-medium text-fg">Reason (recorded with the Governance decision)</label>
          <textarea id={`${ids}-why`} rows={2} value={justification} onChange={(e) => setJustification(e.target.value)} className={FIELD} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || !justification.trim()}
            onClick={() =>
              startTransition(async () =>
                done(
                  await authorizeStandingAgentTaskAction({ template, workItemId, agentId, title, brief, justification, observedAuthorizationRevision: observed }),
                  `${AGENT_TASK_TEMPLATE_LABELS[template]} authorized. It runs on Mondays once the platform switch is on.`,
                ),
              )
            }
          >
            {current?.state === "active" ? "Replace weekly task" : "Authorize weekly task"}
          </Button>
          {current?.state === "active" ? (
            <Button
              variant="outline"
              disabled={pending || !justification.trim()}
              onClick={() =>
                startTransition(async () =>
                  done(await withdrawStandingAgentTaskAction({ template, justification, observedAuthorizationRevision: observed }), `${AGENT_TASK_TEMPLATE_LABELS[template]} withdrawn.`),
                )
              }
            >
              Withdraw
            </Button>
          ) : null}
        </div>
        {message ? <p className="text-xs leading-5 text-fg" role="status">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
