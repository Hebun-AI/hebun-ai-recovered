/*
 * governed-machine-execution/contracts.ts — the frozen machine action vocabulary.
 *
 * ── WHY IT LIVES HERE AND NOT BESIDE THE EXECUTOR ───────────────────────────
 *
 * It used to live in `execute-record-work-as-machine.server.ts`, which is where it is consulted.
 * The RUNG 2 prerequisite needs the same set in the reachability composition — and the executor
 * calls that composition — so leaving the constant in the executor would have made the two modules
 * import each other. A cycle that TypeScript compiles and ESM resolves to `undefined` at runtime is
 * exactly the kind of defect a frozen allowlist must never have: `undefined.has(...)` throws, and a
 * throw on the arming path is a worse failure than a refusal.
 *
 * So the VOCABULARY moved to a module that imports nothing of its own, and the EXECUTOR still
 * re-exports it. Every released import path keeps working and there is still exactly one
 * definition.
 */
import { RECORD_WORK_ACTION_KIND } from "@/features/heby-action-inlet/contracts";

/**
 * THE ALLOWLIST. One entry, frozen, and consulted rather than assumed.
 *
 * A `Set` of one looks like overengineering until the alternative is read: an `=== RECORD_WORK`
 * comparison invites the next author to write `|| === SOMETHING_ELSE`, whereas adding a member here
 * is a visible decision in a diff a reviewer reads as one.
 *
 * NO ENVIRONMENT VARIABLE, CONFIG VALUE OR DATABASE ROW CAN WIDEN IT — including a tenant's own
 * Governance decision to participate in machine execution, which grants participation in what this
 * set already admits and never adds a member to it.
 */
export const MACHINE_EXECUTABLE_ACTION_KINDS: ReadonlySet<string> = Object.freeze(
  new Set<string>([RECORD_WORK_ACTION_KIND]),
) as ReadonlySet<string>;
