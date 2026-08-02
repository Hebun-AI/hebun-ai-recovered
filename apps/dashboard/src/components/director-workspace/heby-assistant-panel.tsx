"use client";

import { FormEvent, useState } from "react";
import { Bot, CheckCircle2, Clock3, FileText, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdvisorAwareness } from "@/features/director-workspace/mock";
import type { HebyEnterpriseContext } from "@/features/enterprise-intelligence/mock";

interface UserMessage { id: number; role: "user"; content: string }
interface AdvisorMessage {
  id: number;
  role: "assistant";
  recommendation: string;
  evidence: string[];
  confidence: number;
  affectedDomains: string[];
  relatedDecision: string;
  timelineReference: string;
}
type Message = UserMessage | AdvisorMessage;

export function HebyAssistantPanel({ awareness, context }: { awareness: AdvisorAwareness[]; context: HebyEnterpriseContext }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: "assistant", ...context }]);

  function submitMessage(value: string) {
    const content = value.trim();
    if (!content) return;
    setMessages((current) => [...current, { id: Date.now(), role: "user", content }, { id: Date.now() + 1, role: "assistant", ...context }]);
    setInput("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); submitMessage(input); }

  return (
    <aside id="heby-assistant" aria-label="Heby enterprise advisor" className="flex min-h-[44rem] flex-col overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-sm xl:sticky xl:top-[calc(var(--topbar-h)+1.5rem)] xl:h-[calc(100dvh-var(--topbar-h)-3rem)] xl:self-start">
      <header className="border-b border-border p-3">
        <div className="flex items-center gap-3"><span className="relative flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary"><Bot className="size-5" /><span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-surface bg-success" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-fg">Heby</h2><span className="text-[0.6rem] font-semibold uppercase tracking-wider text-success">Ready</span></div><p className="text-xs font-medium text-fg-secondary">Executive Copilot · Enterprise Advisor</p></div></div>
        <div className="mt-2.5 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-semibold text-success"><span className="size-2 rounded-full bg-success" />Watching enterprise</p><span className="text-[0.62rem] font-semibold uppercase tracking-wider text-fg-muted">Director authority</span></div>
        <p className="mt-2 text-[0.65rem] text-fg-muted">Simulated intelligence · no execution or approval authority.</p>
      </header>
      <section aria-labelledby="heby-greeting-title" className="px-3 pb-2 pt-3">
        <h3 id="heby-greeting-title" className="text-base font-semibold text-fg">Good evening, Şenol.</h3>
        <p className="mt-1 text-xs leading-5 text-fg-secondary">Organization, Knowledge, Timeline, and Decisions are connected for your review.</p>
      </section>
      <section aria-labelledby="executive-suggestions-title" className="border-b border-border px-3 pb-3">
        <h3 id="executive-suggestions-title" className="sr-only">Executive suggestions</h3>
        <div className="grid gap-1.5">{context.prompts.map((prompt) => <button key={prompt} type="button" onClick={() => submitMessage(prompt)} className="flex min-h-10 items-center justify-between rounded-xl border border-primary/15 bg-primary-subtle/60 px-3 py-2 text-left text-xs font-semibold text-fg transition-colors hover:border-primary hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"><span>{prompt}</span><Sparkles className="size-3.5 shrink-0 text-primary" /></button>)}</div>
      </section>
      <section aria-labelledby="advisor-awareness-title" className="border-b border-border px-3 py-2">
        <h3 id="advisor-awareness-title" className="sr-only">Enterprise awareness</h3>
        <div className="grid grid-cols-4 gap-2">
          {awareness.map((item) => <article key={item.label} className="min-w-0 text-center"><p className="truncate text-[0.56rem] font-semibold uppercase tracking-wider text-fg-muted">{item.label}</p><p className="mt-0.5 text-xs font-semibold text-fg tabular-nums">{item.value}</p></article>)}
        </div>
      </section>
      <section aria-labelledby="executive-conversation-title" className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2"><h3 id="executive-conversation-title" className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Executive conversation</h3><span className="text-[0.65rem] text-fg-muted">{messages.length} {messages.length === 1 ? "insight" : "messages"}</span></div>
        <div aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {messages.map((message) => message.role === "user" ? <div key={message.id} className="ml-8 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-6 text-on-primary">{message.content}</div> : <article key={message.id} className="rounded-xl border border-primary/20 bg-surface-sunken/40 p-3">
          <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wider text-primary"><Sparkles className="size-3.5" />Recommendation</p>
          <p className="mt-1.5 text-sm font-semibold leading-5 text-fg">{message.recommendation}</p>
          <details className="group mt-2 border-t border-border pt-2">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md text-[0.7rem] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"><span className="flex items-center gap-1.5"><FileText className="size-3" />Evidence and references</span><span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span></summary>
            <div className="pt-2"><ul className="space-y-0.5">{message.evidence.map((item) => <li key={item} className="flex gap-1.5 text-[0.7rem] leading-4 text-fg-secondary"><CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />{item}</li>)}</ul><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-2 text-[0.7rem]"><div><dt className="text-fg-muted">Confidence</dt><dd className="font-semibold text-fg">{message.confidence}%</dd></div><div><dt className="text-fg-muted">Affected domains</dt><dd className="font-semibold text-fg">{message.affectedDomains.join(" · ")}</dd></div><div className="col-span-2"><dt className="text-fg-muted">Related decision</dt><dd className="font-medium text-fg">{message.relatedDecision}</dd></div><div className="col-span-2"><dt className="flex items-center gap-1 text-fg-muted"><Clock3 className="size-3" />Timeline reference</dt><dd className="font-medium text-fg">{message.timelineReference}</dd></div></dl></div>
          </details>
          <p className="mt-2 text-[0.65rem] font-medium text-fg-muted">Ready for Director review · No execution</p>
        </article>)}
        </div>
      </section>
      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <label htmlFor="heby-message" className="sr-only">Message Heby</label>
        <div className="flex items-end gap-2"><textarea id="heby-message" rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(input); } }} placeholder="Ask Heby…" className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-primary focus:ring-2 focus:ring-primary-ring" /><Button type="submit" aria-label="Send message" className="size-11 px-0" disabled={!input.trim()}><Send className="size-4" /></Button></div>
        <p className="mt-2 text-[0.7rem] text-fg-muted">Enter to send · Shift + Enter for a new line</p>
      </form>
    </aside>
  );
}
