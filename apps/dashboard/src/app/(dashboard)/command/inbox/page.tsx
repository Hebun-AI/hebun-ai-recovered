import { CommandInbox } from "@/components/command-inbox/command-inbox";
import { getCommandInboxModel } from "@/features/command-attention/workspace-model";

export const metadata = { title: "Inbox — Hebun AI" };

/*
 * Command · Inbox (Phase 20B) — the unified Director attention surface (absorbs the former
 * standalone Alerts, Phase 20A decision D2). No unified attention source is connected, so the
 * queue renders an honest empty state; no alert, decision, failure, or count is fabricated.
 */

export default function CommandInboxPage() {
  return <CommandInbox model={getCommandInboxModel()} />;
}
