"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message { id: number; role: "user" | "assistant"; content: string }

const prompts = ["What should I focus on today?", "Show me critical risks", "Summarize yesterday", "Any new insights?"];
const mockReply = "Based on this simulated workspace, focus first on the SOC 2 evidence gap, then review the enterprise launch dependency. I can prepare a draft for your review, but no action will be taken automatically.";

export function HebyAssistantPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: 1, role: "assistant", content: "Good morning, Şenol. I’m ready to help you review today’s enterprise signals." }]);

  function submitMessage(value: string) {
    const content = value.trim();
    if (!content) return;
    setMessages((current) => [...current, { id: Date.now(), role: "user", content }, { id: Date.now() + 1, role: "assistant", content: mockReply }]);
    setInput("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); submitMessage(input); }

  return (
    <aside id="heby-assistant" aria-label="Heby assistant" className="flex min-h-[36rem] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm xl:sticky xl:top-[calc(var(--topbar-h)+1.5rem)] xl:h-[calc(100dvh-var(--topbar-h)-3rem)]">
      <header className="border-b border-border p-5">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary"><Bot className="size-5" /></span><div><h2 className="font-semibold text-fg">Heby</h2><p className="flex items-center gap-1.5 text-xs text-fg-secondary"><span className="size-2 rounded-full bg-success" />Online · simulation</p></div></div>
        <p className="mt-4 rounded-lg bg-info-subtle px-3 py-2 text-xs leading-5 text-info">Responses are simulated in Phase 1 and may not reflect live enterprise data.</p>
      </header>
      <div className="border-b border-border p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-muted"><Sparkles className="size-3.5" />Suggested prompts</p>
        <div className="flex flex-wrap gap-2">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => submitMessage(prompt)} className="rounded-full border border-border px-3 py-1.5 text-left text-xs text-fg-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">{prompt}</button>)}</div>
      </div>
      <div aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-8 rounded-xl rounded-br-sm bg-primary px-3 py-2.5 text-sm leading-6 text-on-primary" : "mr-6 rounded-xl rounded-bl-sm bg-surface-sunken px-3 py-2.5 text-sm leading-6 text-fg"}>{message.content}</div>)}
      </div>
      <form onSubmit={onSubmit} className="border-t border-border p-4">
        <label htmlFor="heby-message" className="sr-only">Message Heby</label>
        <div className="flex items-end gap-2"><textarea id="heby-message" rows={2} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitMessage(input); } }} placeholder="Ask Heby…" className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-primary focus:ring-2 focus:ring-primary-ring" /><Button type="submit" aria-label="Send message" className="size-11 px-0" disabled={!input.trim()}><Send className="size-4" /></Button></div>
        <p className="mt-2 text-[0.7rem] text-fg-muted">Enter to send · Shift + Enter for a new line</p>
      </form>
    </aside>
  );
}
