import { AgentOfficeFrame } from "@/components/live-map/agent-office-page";

/* One sentence for every absence: it never says why, so it cannot say whether anything is there. */
export default function AgentOfficeNotFound() {
  return (
    <AgentOfficeFrame>
      <h1 className="lm-office-name">Agent office not found</h1>
      <p className="lm-notice">There is no agent office at this address.</p>
    </AgentOfficeFrame>
  );
}
