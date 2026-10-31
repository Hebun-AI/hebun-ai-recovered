import { notFound } from "next/navigation";
import { AgentOfficePage } from "@/components/live-map/agent-office-page";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readLiveMapAgentOffice } from "@/features/live-map/read-live-map.server";

export const metadata = { title: "Agent office — Hebun AI" };

/*
 * /live-map/agents/[agentId] — ONE TEMPLATE FOR EVERY REAL AGENT (PHASE 4B).
 *
 * THE TENANT IS RESOLVED HERE, ON THE SERVER, and the parameter is only ever compared against what
 * that tenant's authority returned. A caller can name an agent; a caller cannot name an organization.
 *
 * THE TITLE IS FIXED ON PURPOSE. An agent's name in it would need a second read, and would make a
 * browser tab the one place a name lives after the page that resolved it is gone.
 *
 * `not-found` covers an agent in another organization and an id nobody holds, because the seam cannot
 * tell them apart. An authority that did not answer stays on this page and says so.
 */
export default async function AgentOfficeRoute({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const office = await readLiveMapAgentOffice(await resolveTenantContext(), agentId);
  if (office.status === "not-found") notFound();
  return <AgentOfficePage office={office} />;
}
