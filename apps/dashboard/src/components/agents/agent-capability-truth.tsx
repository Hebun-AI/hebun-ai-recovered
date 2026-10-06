/*
 * WF-2 — what Agent #1 can propose NOW, beside what its mandate permits and what it never holds.
 *
 * A server component with no client boundary and nothing that can act. It renders the pure
 * derivation of the WF-1 availability projection; it reads nothing itself. An unavailable answer
 * names its reason and makes NO capability claim — "Hebun could not confirm" is never "cannot".
 */
import { Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StateBlock } from "@/components/ui/state-block";
import {
  AGENT_HAS_NO_AUTHORITY_TO,
  type AgentCapabilityTruth,
} from "@/features/origination-availability/capability-truth";
import type { OriginationUnavailableReason } from "@/features/origination-availability/contracts";

const KIND_LABEL: Readonly<Record<string, string>> = { "record-work": "Work proposals", send: "Send proposals" };
const label = (kind: string) => KIND_LABEL[kind] ?? kind;

export const UNAVAILABLE_SENTENCE: Readonly<Record<OriginationUnavailableReason, string>> = {
  "tenant-unavailable": "Hebun could not confirm your organization for this check.",
  "no-agent": "No durable agent is in service for this organization.",
  "agent-retired": "The agent for this organization is retired.",
  "multiple-agents": "More than one agent is in service, so the proposal path cannot choose one.",
  "mandate-unavailable": "No effective mandate could be confirmed for this agent.",
  "proposal-scope-unavailable": "The mandate in effect does not include work proposals.",
  "model-unavailable": "The model is currently paused or not available.",
  "external-ai-not-authorized": "External AI use for agent proposals is not authorized for this organization.",
  "temporarily-unavailable": "Hebun could not check this right now.",
};

export function AgentCapabilityTruthCard({ truth }: { truth: AgentCapabilityTruth }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge aria-hidden className="size-4" />
          What the agent can propose now
        </CardTitle>
        <CardDescription>
          Derived from the mandate, the organization&apos;s external AI authorization and model availability.
          Every proposal still waits for a human decision.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {truth.status === "unavailable" ? (
          <StateBlock
            tone="unavailable"
            title="Proposal capability not confirmed"
            description={`${UNAVAILABLE_SENTENCE[truth.reason]} No capability is shown until it can be confirmed.`}
          />
        ) : (
          <>
            <Row heading="Can propose now">
              {truth.canProposeNow.map((kind) => (
                <Badge key={kind} variant="success">{label(kind)}</Badge>
              ))}
            </Row>
            <Row heading={`Mandate permits · revision ${truth.mandateRevision}`}>
              {truth.mandatePermits.map((kind) => (
                <Badge key={kind} variant="neutral">{label(kind)}</Badge>
              ))}
            </Row>
            {truth.permittedButNotExposed.length > 0 ? (
              <Row heading="Permitted, but not offered by the current proposal path">
                {truth.permittedButNotExposed.map((kind) => (
                  <Badge key={kind} variant="warning">{label(kind)}</Badge>
                ))}
              </Row>
            ) : null}
          </>
        )}
        <div className="rounded-md border border-border bg-surface-sunken p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">The agent itself does not</p>
          <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-fg-secondary">
            {AGENT_HAS_NO_AUTHORITY_TO.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-5 text-fg-secondary">
            People decide, authorize and carry out what it proposes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">{heading}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
