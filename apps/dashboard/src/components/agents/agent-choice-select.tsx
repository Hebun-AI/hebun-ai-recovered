"use client";

/*
 * AP-5A — the ONE control a human uses to name WHICH in-service agent an act is for.
 *
 * It renders only when more than one agent is in service. With exactly one, it renders nothing and
 * the caller sends nothing — so a single-agent organization keeps the exact path it had before. With
 * several, there is no default: an empty choice names nobody, and every server seam refuses an
 * unnamed act as ambiguous.
 *
 * The options are whatever the server read from the Agent Identity Authority. This control invents
 * none, ranks none and authorizes nothing: the chosen id is a LOOKUP KEY that the server verifies
 * against the same read (this tenant, in service) before anything happens.
 */

export interface AgentOption {
  readonly agentId: string;
  readonly name: string;
}

/** True when the human must name an agent before acting. */
export function agentChoiceRequired(agents: readonly AgentOption[]): boolean {
  return agents.length > 1;
}

/**
 * The selection a caller sends: the chosen id only when a choice was required and made. With one
 * agent (or none) nothing is sent, so the server's single-agent rule answers exactly as before.
 */
export function agentSelectionFor(
  agents: readonly AgentOption[],
  chosenAgentId: string,
): { readonly agentId?: string } {
  return agentChoiceRequired(agents) && chosenAgentId !== "" ? { agentId: chosenAgentId } : {};
}

/** The display name of the agent an act is for, when the server listed exactly which one it is. */
export function agentNameFor(agents: readonly AgentOption[], chosenAgentId: string): string | null {
  if (agents.length === 1) return agents[0]!.name;
  return agents.find((agent) => agent.agentId === chosenAgentId)?.name ?? null;
}

export function AgentChoiceSelect({
  id,
  value,
  onChange,
  agents,
  disabled,
  className,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly agents: readonly AgentOption[];
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  if (!agentChoiceRequired(agents)) return null;
  return (
    <label className={className ?? "flex flex-col gap-1 text-xs text-fg-secondary"} htmlFor={id}>
      Agent — more than one is in service. You choose which one this is for.
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
      >
        <option value="">Choose an agent</option>
        {agents.map((agent) => (
          <option key={agent.agentId} value={agent.agentId}>
            {agent.name}
          </option>
        ))}
      </select>
    </label>
  );
}
