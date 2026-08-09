import { CommandBriefings } from "@/components/command-briefings/command-briefings";
import { getCommandBriefingsModel } from "@/features/command-briefings/workspace-model";

export const metadata = { title: "Briefings — Hebun AI" };

/*
 * Command · Briefings (Phase 20B) — the executive briefing reading surface, backed by the real
 * Director Briefing contract (Organizational Intelligence Runtime, Phase 8). The Runtime is
 * contract-only, so no briefing instance exists and the surface renders an honest empty state.
 */

export default function CommandBriefingsPage() {
  return <CommandBriefings model={getCommandBriefingsModel()} />;
}
