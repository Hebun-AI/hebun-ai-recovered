"use client";

/*
 * AP-4B — the ONE control a human uses to state WHAT KIND of work something is.
 *
 * Organization-level, or one in-service work domain. There is no default: an empty choice submits
 * nothing, and every inlet refuses an unstated scope. The options are whatever the server read from
 * the Work Domain Authority; this control invents none and decides nothing.
 */
import type { WorkScope } from "@/features/work-domain/work-scope";

export interface WorkScopeChoice {
  /** "organization", or a work domain id. */
  readonly value: string;
  readonly label: string;
  /** Shown but not choosable — e.g. no eligible agent for this scope. */
  readonly disabled?: boolean;
}

export const ORGANIZATION_SCOPE_VALUE = "organization";

/** The scope a choice names, or `null` for no choice. */
export function workScopeFromChoice(value: string): WorkScope | null {
  if (value === "") return null;
  if (value === ORGANIZATION_SCOPE_VALUE) return { kind: "organization" };
  return { kind: "domain", workDomainId: value };
}

/** The choice value for a scope. */
export function choiceFromWorkScope(scope: WorkScope): string {
  return scope.kind === "organization" ? ORGANIZATION_SCOPE_VALUE : scope.workDomainId;
}

export function WorkScopeSelect({
  id,
  value,
  onChange,
  choices,
  disabled,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly choices: readonly WorkScopeChoice[];
  readonly disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-fg"
      disabled={disabled || choices.length === 0}
    >
      <option value="">Choose a work scope</option>
      {choices.map((choice) => (
        <option key={choice.value} value={choice.value} disabled={choice.disabled}>
          {choice.label}
        </option>
      ))}
    </select>
  );
}
