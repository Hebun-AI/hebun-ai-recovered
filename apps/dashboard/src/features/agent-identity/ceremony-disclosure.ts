/*
 * AGENT-ID-0.1 — what a human must be able to understand BEFORE establishing a durable agent
 * identity, and before retiring one.
 *
 * ── WHY THIS IS DATA AND NOT PROSE INSIDE A COMPONENT ────────────────────────
 *
 * The disclosure is the load-bearing part of the ceremony. A sentence buried in JSX can be quietly
 * softened by anyone adjusting a layout, and no test would notice. As data it can be asserted:
 * the ladder cannot lose a rung, the persisted-field list cannot gain a column the writer does not
 * write, and the withheld list cannot lose one it declines to write.
 *
 * Nothing here decides anything. It is the vocabulary of the surface, and the authorities remain the
 * only things that produce an outcome.
 */

/**
 * THE LADDER. Five distinct states that a product is constantly tempted to collapse into one word,
 * "agent". Creating an identity reaches the FIRST rung and no other.
 *
 * The order is meaning, not presentation: each rung presupposes the one before it, and every rung
 * above the first is unreached in this repository — there is no agent authentication, no agent
 * authorization, no agent runtime and no agent execution.
 */
export const AGENT_CAPABILITY_LADDER = [
  {
    rung: "IDENTITY CREATED",
    reached: true,
    detail: "A durable row exists: a name, a tenant, a human owner, and who created it.",
  },
  {
    rung: "AUTHENTICATED",
    reached: false,
    detail: "No credential and no session is created. The agent cannot prove it is itself.",
  },
  {
    rung: "AUTHORIZED",
    reached: false,
    detail: "No role, permission or permit is granted. The agent may approve and decide nothing.",
  },
  {
    rung: "RUNTIME AVAILABLE",
    reached: false,
    detail: "No runtime is started, and no provider, model or tool is bound to this identity.",
  },
  {
    rung: "EXECUTABLE",
    reached: false,
    detail: "Nothing is dispatched. Creating an identity performs no work and executes nothing.",
  },
] as const;

/**
 * The columns `createDurableAgentIdentity` actually writes. Six, and the human sees all six before
 * confirming. This list is asserted against the writer's own `.values({...})`, so it cannot drift
 * into a promise the database does not keep.
 */
export const PERSISTED_IDENTITY_FIELDS = [
  { column: "tenant_id", meaning: "The organization this identity belongs to — from your session." },
  { column: "name", meaning: "The name you type, stored exactly as given. Never trimmed or repaired." },
  { column: "human_owner_type", meaning: "The literal 'human'. This authority owns no other kind." },
  { column: "human_owner_id", meaning: "You. Ownership is verified against a live row in `users`." },
  { column: "created_by", meaning: "You. Unlike the first human, this agent did have a creator." },
  { column: "created_by_type", meaning: "The literal 'human'." },
] as const;

/**
 * Columns deliberately left NULL. A missing fact stays missing rather than being invented — writing
 * a plausible value for any of these would be the first lie in the record.
 */
export const WITHHELD_IDENTITY_FIELDS = [
  { column: "agent_lifecycle_status", meaning: "No lifecycle is claimed. Retirement is its first writer." },
  { column: "manager_actor_type / manager_actor_id", meaning: "This agent has no manager." },
  { column: "department_id", meaning: "It belongs to no department." },
  { column: "authority_ceiling", meaning: "No authority is bounded, because none is granted." },
  { column: "agent_type / risk_level / agent_health", meaning: "Unclassified, unrated, unmeasured." },
  { column: "execution_posture / allowed_tools / tool_profile", meaning: "No execution, no tools." },
  { column: "reasoning / memory / knowledge / learning profiles", meaning: "No cognition is configured." },
  { column: "retired_at / replaced_by_agent_id", meaning: "Not retired, and not replacing anybody." },
] as const;

/**
 * The one-way door, stated in the words the surface uses.
 *
 * `genesisIsOneShot` and `retirementDoesNotReopen` are the same invariant seen from two sides, and
 * both are enforced by arithmetic rather than by this text: the creation authority counts rows for
 * the tenant with no lifecycle and no soft-delete predicate, and the retirement authority writes no
 * DELETE.
 */
export const GENESIS_DISCLOSURE = {
  genesisIsOneShot:
    "Your organization may establish a durable agent identity ONCE. After this, the creation ceremony refuses.",
  retirementIsNotDeletion:
    "Retiring an identity withdraws it from service. The row, the name, the ownership and the creation record all survive.",
  retirementDoesNotReopen:
    "A retired identity still counts. Your organization does not return to 'no agent has ever existed', and the creation ceremony stays closed.",
  noSuccession:
    "No successor is created and no replacement is recorded. Succession is a separate decision that has not been authorized.",
  retirementIsTerminal:
    "There is no reinstatement. Nothing in Hebun returns a retired identity to service.",
  /*
   * WHAT THE CEREMONY MAKES READABLE, AND NOTHING MORE.
   *
   * `canonical-read/actor-resolution.ts` selects on `id` and `tenant_id` alone — no lifecycle
   * filter and no soft-delete filter — so a row this authority writes with a NULL
   * `agent_lifecycle_status` resolves there immediately. That is a claim about a READ, not about a
   * capability: resolving as an actor is not authenticating, not being authorized, and not running.
   */
  canonicalReadBack:
    "The new identity will be readable through Hebun's canonical agent identity and actor read path, and will be listed on this page. Being readable is not being able to act.",
  /*
   * THE NAME IS PERMANENT BECAUSE NO AUTHORITY EXISTS TO CHANGE IT — not because a rule forbids it.
   * `features/agent-identity` exports no rename, no update and no replacement, and `agents` gains
   * no successor pointer at creation. A typo survives retirement, because retirement does not
   * reopen the ceremony that would let it be typed again.
   */
  noRenameOrReplacement:
    "No rename authority and no replacement authority exists in the released system. The name you type is the name this identity keeps, and a mistake cannot be corrected by retiring it and starting over.",
} as const;

/**
 * THE COUNT, BEFORE AND AFTER, IN THE WORDS THE SURFACE USES.
 *
 * A function rather than a constant because the number is a MEASUREMENT, not a slogan: the surface
 * passes what the read seam actually returned for this tenant. Hard-coding "0" would state a fact
 * this module is in no position to know, and would keep on stating it if it ever stopped being true.
 */
export function genesisCountDisclosure(currentCount: number): string {
  const identities = (count: number): string => (count === 1 ? "identity" : "identities");
  return (
    `Your organization currently holds ${currentCount} durable agent ${identities(currentCount)}. ` +
    `After this ceremony succeeds, it will hold ${currentCount + 1}.`
  );
}

/** Who may retire, in the words the surface uses. Ownership is the authority, not a role. */
export const RETIREMENT_AUTHORITY_SUMMARY =
  "Only the human who owns this identity may retire it. An agent cannot: there is no agent authentication in Hebun, so an agent has no way to reach this authority at all.";
