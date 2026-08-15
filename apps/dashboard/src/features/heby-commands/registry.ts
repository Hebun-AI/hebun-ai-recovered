/*
 * heby-commands/registry.ts — THE Heby command registry (S1).
 *
 * One place defines every command. No component, parser, palette, or handler may declare a command
 * of its own; they all read from here. That is what makes the layer extensible: a later capability
 * provider contributes DESCRIPTORS (see `HebyCommandProvider`) and nothing downstream changes.
 *
 * TRUTHFULNESS IS THE SELECTION RULE. A command is `available` only when this repository already
 * has an authoritative or derived source behind it. That was audited against the shipped code, not
 * assumed:
 *
 *   REAL, so these read:      the Executive Overview (derived, non-authoritative) backs Operations
 *                             and Platform — including the active-agents and active-workflows
 *                             sections; the provider-ops view backs provider/model/connectivity;
 *                             the security source map backs the security posture; the durable
 *                             conversation repository backs the current thread's own facts; and
 *                             (K1) the canonical Knowledge authority — knowledge_facts joined to
 *                             its active knowledge_nodes row, read tenant-scoped — backs
 *                             Knowledge listing and named-source read.
 *   NOT CONNECTED, so these   Knowledge SEARCH (no search surface, no result presentation, no
 *   are unavailable:          citation experience — ranking itself now exists, see below),
 *                             Memory retrieval, live policy evaluation, persisted audit history,
 *                             incident feed, network telemetry, per-tenant permission analysis,
 *                             usage/spend aggregation, task and activity streams. Each says
 *                             exactly which source it is missing.
 *   NO RUNTIME, so these      every execution/approval command. They are registered so the shape
 *   are inert:                of the future is visible, and they do nothing.
 *
 * An unavailable command is NOT a lie and NOT a placeholder: it is a truthful statement that Hebun
 * cannot answer this yet. Fabricating an incident count, a threat list, a permission analysis, or a
 * token total would be the alternative, and it is the thing this file exists to prevent.
 *
 * Pure. No React, no I/O, no server, no authority.
 */

import type {
  HebyCommandCategory,
  HebyCommandDescriptor,
  HebyCommandKind,
} from "./contracts";

/** Palette order. Runnable work first; the inert future last. */
export const HEBY_COMMAND_CATEGORIES: readonly HebyCommandCategory[] = [
  "conversation",
  "context",
  "analyze",
  "navigate",
  "security",
  "knowledge",
  "platform",
  "agents",
  "future",
] as const;

export const HEBY_CATEGORY_LABELS: Readonly<Record<HebyCommandCategory, string>> = Object.freeze({
  conversation: "Conversation",
  context: "Context",
  analyze: "Analyze",
  navigate: "Navigate",
  security: "Security",
  knowledge: "Knowledge",
  platform: "Platform",
  agents: "Agents",
  future: "Future capabilities",
});

/* ── Shared reasons ───────────────────────────────────────────────────────────
 * Written once so an unavailable command cannot drift into a vaguer excuse, and so the reason
 * names the missing SOURCE rather than implying the feature is merely unfinished.
 */
const NO_EXECUTION_RUNTIME =
  "This command needs Hebun's execution/approval runtime, which does not exist yet. Nothing was run.";
/*
 * K1 audited the Knowledge subsystem capability by capability, and they are NOT in the same state.
 * Listing and reading a named fact are backed by the canonical authority, so /knowledge and /source
 * read. /search stays unavailable — but KR3 changed WHY, and the reason had to be repaired rather
 * than left standing.
 *
 * THE OLD REASON IS NOW FALSE. It said there was "no ranking model, and no relevance authority
 * anywhere in this repository". KR3 built exactly that: a relevance ranking over the canonical
 * Knowledge authority, question-aware, tenant-scoped. Leaving the old sentence in place would have
 * been a true conclusion resting on a dead premise — the same record-integrity defect this codebase
 * has had to repair before, where a green suite stays green BECAUSE a stale claim survives.
 *
 * THE CONCLUSION IS UNCHANGED, and for a reason that has nothing to do with ranking: selecting
 * evidence for a question Heby is already answering is not an enterprise search PRODUCT. There is no
 * search surface, no result presentation, no citation UX, and no browse scope. Marking /search
 * available because retrieval now exists would be exactly the collapse ("Knowledge connected") that
 * K1 forbids — one capability standing in for a different one.
 */
const NO_SEARCH_AUTHORITY =
  "Hebun has no search product: there is no search surface, no result presentation, and no citation " +
  "experience — enabling one is a separate product phase. Knowledge retrieval does exist, but it " +
  "selects evidence for a question Heby is already answering; it is not a place to go searching. " +
  "/knowledge lists what your organization actually holds, and /source reads one of them by name.";

/** Local defaults for a plain, argument-free command. */
function base(
  kind: HebyCommandKind,
): Pick<HebyCommandDescriptor, "args" | "requiresModel" | "requiresExecution" | "safeWhenProviderOff"> {
  return {
    args: [],
    requiresModel: kind === "advisory",
    requiresExecution: kind === "reserved",
    safeWhenProviderOff: true,
  };
}

export const HEBY_COMMANDS: readonly HebyCommandDescriptor[] = Object.freeze([
  /* ── Conversation (LOCAL) ─────────────────────────────────────────────── */
  {
    id: "new", slash: "/new", label: "New conversation", category: "conversation", kind: "local",
    description: "Start a new conversation. Earlier conversations are kept.",
    availability: "available", handler: "new", ...base("local"),
  },
  {
    id: "clear", slash: "/clear", label: "Clear this view", category: "conversation", kind: "local",
    description: "Clear this view and detach the conversation. Saved history is not deleted.",
    availability: "available", handler: "clear", ...base("local"),
  },
  {
    id: "help", slash: "/help", label: "Help", category: "conversation", kind: "local",
    description: "List the commands Heby supports, and which are unavailable.",
    availability: "available", handler: "help", ...base("local"),
  },
  {
    id: "close", slash: "/close", label: "Close Heby", category: "conversation", kind: "local",
    description: "Close the Heby panel, or leave the Heby workspace and return.",
    availability: "available", handler: "close", ...base("local"),
  },
  {
    id: "history", slash: "/history", label: "Conversation history", category: "conversation", kind: "read",
    description: "Show what is saved for the conversation you are in.",
    availability: "available", handler: "history", ...base("read"),
  },

  /* ── Context (LOCAL + READ) ───────────────────────────────────────────── */
  {
    id: "context", slash: "/context", label: "Current context", category: "context", kind: "local",
    description: "Show the context Heby is actually working in.",
    availability: "available", handler: "context", ...base("local"),
  },
  {
    id: "sources", slash: "/sources", label: "Evidence sources", category: "context", kind: "local",
    description: "Show the evidence behind Heby's latest response.",
    availability: "available", handler: "sources", ...base("local"),
  },
  {
    id: "evidence", slash: "/evidence", label: "Evidence sources", category: "context", kind: "local",
    description: "Show the evidence behind Heby's latest response.",
    availability: "available", handler: "sources", aliasOf: "sources", ...base("local"),
  },
  {
    id: "status", slash: "/status", label: "Context status", category: "context", kind: "read",
    description: "Read the current context's own read models and state their freshness.",
    availability: "available", handler: "status", ...base("read"),
  },
  {
    id: "refresh", slash: "/refresh", label: "Re-read context", category: "context", kind: "read",
    description: "Re-read the current context's read models now. Hebun does not poll in the background.",
    availability: "available", handler: "refresh", ...base("read"),
  },

  /* ── Analyze (ADVISORY — the ONLY kind that may reach the model) ───────── */
  {
    id: "summary", slash: "/summary", label: "Summarize", category: "analyze", kind: "advisory",
    description: "Summarize the current context from the evidence Heby has.",
    availability: "available", handler: "summary", ...base("advisory"),
  },
  {
    id: "summarize", slash: "/summarize", label: "Summarize", category: "analyze", kind: "advisory",
    description: "Summarize the current context from the evidence Heby has.",
    availability: "available", handler: "summary", aliasOf: "summary", ...base("advisory"),
  },
  {
    id: "risks", slash: "/risks", label: "Risks", category: "analyze", kind: "advisory",
    description: "Identify risks the current evidence actually supports.",
    availability: "available", handler: "risks", ...base("advisory"),
  },
  {
    id: "gaps", slash: "/gaps", label: "Gaps", category: "analyze", kind: "advisory",
    description: "Identify what is missing, unknown, or insufficient in the current evidence.",
    availability: "available", handler: "gaps", ...base("advisory"),
  },
  {
    id: "why", slash: "/why", label: "Why this view", category: "analyze", kind: "advisory",
    description: "Explain what the current view rests on.",
    availability: "available", handler: "why", ...base("advisory"),
  },
  {
    id: "compare", slash: "/compare", label: "Compare", category: "analyze", kind: "advisory",
    description: "Compare two items, or say plainly when one of them cannot be grounded.",
    availability: "available", handler: "compare",
    ...base("advisory"),
    args: [
      { name: "first", required: true, description: "The first item to compare." },
      { name: "second", required: true, description: "The second item to compare." },
    ],
  },
  {
    id: "prioritize", slash: "/prioritize", label: "Prioritize", category: "analyze", kind: "advisory",
    description: "Rank only when the evidence supports ranking; otherwise say it does not.",
    availability: "available", handler: "prioritize", ...base("advisory"),
  },
  {
    id: "explain", slash: "/explain", label: "Explain", category: "analyze", kind: "advisory",
    description: "Explain an item from the current context.",
    availability: "available", handler: "explain",
    ...base("advisory"),
    args: [{ name: "item", required: true, description: "What to explain." }],
  },

  /* ── Navigate (NAVIGATION) ────────────────────────────────────────────── */
  {
    id: "go", slash: "/go", label: "Go to workspace", category: "navigate", kind: "navigation",
    description: "Move to a Hebun workspace. Only known workspaces resolve.",
    availability: "available", handler: "go",
    ...base("navigation"),
    args: [{ name: "workspace", required: true, description: "command · intelligence · knowledge · operations · workforce · governance · platform · heby" }],
  },

  /* ── Security ─────────────────────────────────────────────────────────────
   * `/security` IS available, because the Security Center's SOURCE MAP is real: it states, per
   * source class, what Hebun can and cannot prove. Reading that is honest. Reading an incident,
   * a threat, an audit trail, or a permission analysis is not — none of those feeds is connected,
   * and each of these commands names the exact one it is missing.
   */
  {
    id: "security", slash: "/security", label: "Security posture", category: "security", kind: "read",
    description: "Read which security sources Hebun actually has, and what each can and cannot prove.",
    availability: "available", handler: "security", ...base("read"),
  },
  {
    id: "audit", slash: "/audit", label: "Security audit history", category: "security", kind: "read",
    description: "Show persisted security audit history.",
    availability: "requires-source", handler: "audit", ...base("read"),
    unavailableReason:
      "No persisted security audit history exists. Runtime provenance is not a forensic trail, so there is nothing authoritative to show.",
  },
  {
    id: "incidents", slash: "/incidents", label: "Incidents", category: "security", kind: "read",
    description: "List security incidents.",
    availability: "requires-source", handler: "incidents", ...base("read"),
    unavailableReason:
      "No incident feed is connected. Hebun holds no incident, attack, or breach record, and will not infer one.",
  },
  {
    id: "threats", slash: "/threats", label: "Threats", category: "security", kind: "read",
    description: "List active threats.",
    availability: "requires-source", handler: "threats", ...base("read"),
    unavailableReason:
      "No network telemetry or threat feed is connected. A degraded technical state is not an attack, and Hebun will not present it as one.",
  },
  {
    id: "permissions", slash: "/permissions", label: "Permission analysis", category: "security", kind: "read",
    description: "Analyze effective permissions and authority.",
    availability: "requires-source", handler: "permissions", ...base("read"),
    unavailableReason:
      "No live authorization analysis is connected. Hebun has a structural authority model, but no seam that can evaluate effective permissions or detect escalation.",
  },

  /* ── Knowledge (K1) ───────────────────────────────────────────────────────
   * `/knowledge` and `/source` READ the canonical Knowledge authority — knowledge_facts joined
   * to its active knowledge_nodes row, tenant-scoped over the durable control-plane database.
   * That path is real, so these commands run; what they report is the tenant's REAL state, which
   * is empty until somebody ingests plain text through the Knowledge workspace. Reporting an empty
   * organization honestly is the point. `/search` stays unavailable because search has no
   * authority at all — being readable is not being findable — see NO_SEARCH_AUTHORITY.
   */
  {
    id: "knowledge", slash: "/knowledge", label: "Knowledge", category: "knowledge", kind: "read",
    description: "Read what organizational knowledge your organization holds, and which Knowledge capabilities Hebun actually has.",
    availability: "available", handler: "knowledge", ...base("read"),
  },
  {
    id: "search", slash: "/search", label: "Search knowledge", category: "knowledge", kind: "read",
    description: "Search organizational knowledge.",
    availability: "requires-source", handler: "search", ...base("read"),
    args: [{ name: "query", required: true, description: "What to search for." }],
    unavailableReason: NO_SEARCH_AUTHORITY,
  },
  {
    id: "source", slash: "/source", label: "Inspect a source", category: "knowledge", kind: "read",
    description: "Read one named knowledge source your organization owns, with its provenance and standing.",
    availability: "available", handler: "source", ...base("read"),
    args: [{ name: "name", required: true, description: "The canonical fact key of the source to read." }],
  },

  /* ── Platform / provider ──────────────────────────────────────────────── */
  {
    id: "providers", slash: "/providers", label: "Providers", category: "platform", kind: "read",
    description: "Read the registered model provider's real configuration state.",
    availability: "available", handler: "providers", ...base("read"),
  },
  {
    id: "model", slash: "/model", label: "Model", category: "platform", kind: "read",
    description: "Show the configured model and how an answer would be produced right now.",
    availability: "available", handler: "model", ...base("read"),
  },
  {
    id: "connectivity", slash: "/connectivity", label: "Connectivity", category: "platform", kind: "read",
    description: "Show the Director permission, configuration, credential presence and transport — kept distinct.",
    availability: "available", handler: "connectivity", ...base("read"),
  },
  {
    id: "usage", slash: "/usage", label: "Usage", category: "platform", kind: "read",
    description: "Show token or spend totals.",
    availability: "requires-source", handler: "usage", ...base("read"),
    unavailableReason:
      "No usage-aggregation authority exists. Individual exchanges record their own token counts, but Hebun has no seam that totals them, and an invented total would be worse than none.",
  },

  /* ── Agents / workforce ───────────────────────────────────────────────────
   * `/agents` and `/workflows` read the Executive Overview's own sections. That data is DERIVED and
   * non-authoritative, and the result says so — it is never presented as live execution.
   */
  {
    id: "agents", slash: "/agents", label: "Agents", category: "agents", kind: "read",
    description: "Read the agent section of the current read models, labelled with what it actually is.",
    availability: "available", handler: "agents", ...base("read"),
  },
  {
    id: "workflows", slash: "/workflows", label: "Workflows", category: "agents", kind: "read",
    description: "Read the workflow section of the current read models, labelled with what it actually is.",
    availability: "available", handler: "workflows", ...base("read"),
  },
  {
    id: "tasks", slash: "/tasks", label: "Tasks", category: "agents", kind: "read",
    description: "Read the task queue.",
    availability: "requires-source", handler: "tasks", ...base("read"),
    unavailableReason:
      "No task read model is exposed to Heby. The operational task queue is seeded in-memory, and Hebun will not present seeded data as work in progress.",
  },
  {
    id: "activity", slash: "/activity", label: "Activity", category: "agents", kind: "read",
    description: "Read a live activity stream.",
    availability: "requires-source", handler: "activity", ...base("read"),
    unavailableReason:
      "No activity stream is connected. The event projection has no connected source, so there is no chronology to read.",
  },

  /* ── Future capabilities (RESERVED — registered, inert) ───────────────────
   * These exist so the shape of Hebun's future is visible and honest, and so a later phase adds a
   * runtime rather than a vocabulary. In S1 they dispatch nothing: no model call, no execution, and
   * deliberately no "plan" either — a fabricated plan is a fabricated capability.
   */
  ...(
    [
      ["run", "Run", "Run a workflow or job."],
      ["execute", "Execute", "Execute a prepared action."],
      ["deploy", "Deploy", "Deploy a change."],
      ["rollback", "Rollback", "Roll a change back."],
      ["browser", "Browser", "Control a browser."],
      ["computer-use", "Computer Use", "Control a computer."],
      ["terminal", "Terminal", "Run a terminal command."],
      ["send", "Send", "Send a message on your behalf."],
      ["approve", "Approve", "Approve a pending decision."],
      ["reject", "Reject", "Reject a pending decision."],
      ["delete", "Delete", "Delete a record."],
    ] as const
  ).map(([id, label, description]) => ({
    id, slash: `/${id}`, label, description,
    category: "future" as const, kind: "reserved" as const,
    availability: "requires-execution" as const, handler: id,
    ...base("reserved"),
    unavailableReason: NO_EXECUTION_RUNTIME,
  })),
]);

/* ── Lookup ───────────────────────────────────────────────────────────────── */

const BY_SLASH = new Map(HEBY_COMMANDS.map((command) => [command.slash, command] as const));

/** The commands the palette offers. Aliases are parseable but stay out of the list. */
export const HEBY_PALETTE_COMMANDS: readonly HebyCommandDescriptor[] = HEBY_COMMANDS.filter(
  (command) => command.aliasOf === undefined,
);

export function findHebyCommandBySlash(slash: string): HebyCommandDescriptor | undefined {
  return BY_SLASH.get(slash.toLowerCase());
}

export function findHebyCommandById(id: string): HebyCommandDescriptor | undefined {
  return HEBY_COMMANDS.find((command) => command.id === id);
}

/** True when the command can actually run today. */
export function isHebyCommandRunnable(command: HebyCommandDescriptor): boolean {
  return command.availability === "available";
}

/* ── Registry invariants ──────────────────────────────────────────────────────
 * These are the rules that keep a command from quietly acquiring reach. They are exported as a
 * check rather than thrown at import time, so a test can state them as findings rather than as a
 * crash — but a violation is a defect, not a warning.
 */
export function validateHebyCommandRegistry(): readonly string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const slashes = new Set<string>();

  for (const command of HEBY_COMMANDS) {
    if (ids.has(command.id)) problems.push(`duplicate command id: ${command.id}`);
    ids.add(command.id);
    if (slashes.has(command.slash)) problems.push(`duplicate slash: ${command.slash}`);
    slashes.add(command.slash);

    if (command.slash !== `/${command.id}`) problems.push(`${command.id}: slash must be /<id>`);
    if (!HEBY_COMMAND_CATEGORIES.includes(command.category)) problems.push(`${command.id}: unknown category`);

    // Only advisory may reach the model; only reserved may claim execution.
    if (command.requiresModel !== (command.kind === "advisory")) {
      problems.push(`${command.id}: requiresModel must be true exactly for advisory commands`);
    }
    if (command.requiresExecution !== (command.kind === "reserved")) {
      problems.push(`${command.id}: requiresExecution must be true exactly for reserved commands`);
    }
    // A reserved command can never be runnable, whatever else it declares.
    if (command.kind === "reserved" && command.availability !== "requires-execution") {
      problems.push(`${command.id}: reserved commands must be requires-execution`);
    }
    // Every command must keep working, or degrade honestly, while the Director has the provider off.
    if (!command.safeWhenProviderOff) problems.push(`${command.id}: must be safe when the provider is off`);
    // An unavailable command must always be able to say why.
    if (command.availability !== "available" && !command.unavailableReason) {
      problems.push(`${command.id}: unavailable commands must state a reason`);
    }
    if (command.availability === "available" && command.unavailableReason) {
      problems.push(`${command.id}: an available command must not carry an unavailable reason`);
    }
    // An alias must point at a real command and share its handler, so it cannot become a second
    // implementation of the same behaviour.
    if (command.aliasOf) {
      const canonical = HEBY_COMMANDS.find((other) => other.id === command.aliasOf);
      if (!canonical) problems.push(`${command.id}: aliasOf points at an unknown command`);
      else if (canonical.handler !== command.handler) problems.push(`${command.id}: alias must share its canonical handler`);
      else if (canonical.kind !== command.kind) problems.push(`${command.id}: alias must share its canonical kind`);
    }
    // Required arguments must precede optional ones.
    let seenOptional = false;
    for (const arg of command.args) {
      if (!arg.required) seenOptional = true;
      else if (seenOptional) problems.push(`${command.id}: required argument after an optional one`);
    }
  }

  return problems;
}
