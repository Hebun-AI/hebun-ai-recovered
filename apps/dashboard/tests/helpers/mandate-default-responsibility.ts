/*
 * AP-4B — the five-value mandate call the pre-AP-4B suites were written against, mapped onto the ONE
 * remaining contract. Release B deleted `establishAgentMandate`; these suites test the ceiling, the
 * history and the Governance coupling, not responsibility, so a scope naming `record-work` is given
 * organization-level responsibility (the authority requires a non-empty one) and any other scope none.
 * Suites that test responsibility itself call `establishAgentMandateWithResponsibility` directly.
 */
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";

type Args = Parameters<typeof establishAgentMandateWithResponsibility>;

export function establishAgentMandateWithDefaultResponsibility(
  tenant: Args[0],
  input: Omit<Args[1], "responsibility">,
  deps?: Args[2],
): ReturnType<typeof establishAgentMandateWithResponsibility> {
  const scope: unknown = (input as { proposalScope?: unknown } | null)?.proposalScope;
  const scoped = Array.isArray(scope) && scope.includes("record-work");
  return establishAgentMandateWithResponsibility(
    tenant,
    { ...input, responsibility: scoped ? [{ kind: "organization" }] : [] },
    deps,
  );
}
