import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Heby — Hebun AI" };

/*
 * Heby home surface. Heby is the ambient interaction layer, reachable from the
 * launcher everywhere and via this route for deeper sessions.
 *
 * PHASE 5 SCOPE: shell surface only. No model call, no Heby Core connection,
 * no fabricated conversation. The surface is explicitly marked unavailable.
 */

export default function HebyPage() {
  return (
    <>
      <PageHeader
        title="Heby"
        context="The ambient intelligence layer — briefings, grounded explanations, and advisory interaction."
        action={<Badge variant="warning">Not yet implemented</Badge>}
      />
      <EmptyState
        eyebrow="Ambient layer"
        title="Heby is not available yet"
        description="This home surface is wired into the app shell but intentionally inert in this phase. Contextual awareness, briefings, evidence, and advisory interaction arrive in a later phase. The authoritative approve/execute act always lives in Command, never here."
        icon={<Sparkles className="size-5" />}
      />
    </>
  );
}
