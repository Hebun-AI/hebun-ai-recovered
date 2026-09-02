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
  "actions",
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
  actions: "Actions",
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
): Pick<
  HebyCommandDescriptor,
  "args" | "requiresModel" | "requiresExecution" | "reachesProvider" | "safeWhenProviderOff"
> {
  return {
    args: [],
    requiresModel: kind === "advisory",
    requiresExecution: kind === "reserved",
    /*
     * INT-5B1. Derived from the KIND, never hand-written per command, so a descriptor cannot claim
     * external reach it does not have — or, worse, hide reach it does.
     */
    reachesProvider: kind === "provider-read" || kind === "cross-source-read",
    /*
     * Still true for a provider-read command. "Provider off" is the Director's connectivity control
     * over the MODEL provider, and a provider-read command uses no model at all, so it behaves
     * identically whether that control is on or off.
     */
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
    id: "audit", slash: "/audit", label: "Recorded act history", category: "security", kind: "read",
    /*
     * R7.1.1 made this real, exactly as R2F.1 made `/usage` real. It was `requires-source` because
     * nothing read `audit_log` as a chronology; R7.1 then made the ledger countable and named the
     * remaining gap ("the counts do not link to the individual acts behind them"), and the bounded
     * drill-through now closes it. The old reason would be a false statement about a capability
     * that shipped.
     *
     * THE LABEL AND DESCRIPTION CHANGED, AND THAT IS THE HONEST HALF OF THE OLD REFUSAL KEPT.
     * `audit_log` records what AUTHORIZED actors did; unauthenticated and forbidden attempts are
     * never written to it. So this is not, and can never become, a security-audit or intrusion
     * history, and calling it one would trade a false absence for a false presence. It says what
     * the ledger IS — Hebun's own record of the acts it carried out — and the surface states the
     * limit rather than leaving a reader to infer completeness.
     */
    /*
     * ── SUBJECT-ACT-HISTORY-1 · THE OPTIONAL SUBJECT ─────────────────────────
     *
     * `/audit` with no argument is R7.1.1's command, unchanged. `/audit work-item/<uuid>` asks the
     * same authority the narrower question a person actually has in front of one thing: what has
     * this organization actually DONE to this?
     *
     * IT IS AN ARGUMENT, NOT A NEW COMMAND, because it is not a new capability — it is the same
     * ledger, the same authority, the same projection and the same three outcomes with one more
     * equality in the predicate. A second slash command would have implied a second thing to learn
     * and a second place for the recorded-act vocabulary to drift.
     *
     * The pattern admits ONLY the reference spellings `ACT_SUBJECT_REFERENCE_KINDS` maps, which is
     * why it is enumerated here rather than written as a generic `<kind>/<uuid>`: a caller must not
     * be able to name an entity type no surface has ever addressed. The two lists are asserted to
     * agree, so the duplication cannot drift.
     */
    description:
      "Show the acts Hebun has durably recorded for your organization, or for one subject.",
    availability: "available", handler: "audit", ...base("read"),
    args: [
      {
        name: "subject",
        required: false,
        description: "Optional. One subject reference: work-item/<uuid> or department/<uuid>",
        pattern:
          /^(work-item|department)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      },
    ],
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
    /*
     * R2F.1 made this real. It was `requires-source` because individual exchanges recorded
     * their own token counts and nothing totalled them; the aggregation seam now exists, so
     * the old reason would be a false statement about a capability that shipped.
     *
     * The description says RECORDED, and says tokens rather than spend, because that is the
     * whole of what this reads: durably persisted provider-REPORTED counts. No price, no
     * currency and no budget exists anywhere in Hebun, so none is offered here.
     */
    description: "Show recorded provider token totals for your organization.",
    availability: "available", handler: "usage", ...base("read"),
  },

  /* ── The first provider-read command (INT-5B1) ─────────────────────────────
   *
   * `/repositories` is the ONLY command in this registry that reaches outside Hebun. It reads one
   * bounded page of the repositories the organization's own GitHub installation covers.
   *
   * WHY IT IS NOT `kind: "read"`. Every other command in the `platform` category reads a Hebun read
   * model and contacts nobody; `read` is contractually ZERO provider dispatch and stays that way.
   * This command genuinely leaves the building, so it declares a kind that says so — and gets its
   * own server module, its own server action and its own firewall root as a consequence.
   *
   * WHY IT IS `available`. The registry's selection rule is that a command is available only when
   * this repository already has the source behind it. It does: GITHUB-2 built the verifier and
   * GITHUB-4 built `discoverInstallationRepositories` against the real GitHub API. Availability
   * here is a statement about the BUILD, never about a tenant — an organization that has connected
   * no GitHub installation gets a truthful refusal from the capability authority at run time, which
   * is a different sentence from "Hebun cannot do this".
   *
   * IT TAKES NO ARGUMENTS, deliberately. A repository name or id would be a caller-supplied address,
   * and the released seam accepts none: the installation itself decides what is visible. There is
   * no argument here for a tenant, an installation, an account, a token, or a repository.
   */
  {
    id: "repositories", slash: "/repositories", label: "Repositories", category: "platform",
    kind: "provider-read",
    description:
      "Read one bounded page of the repositories your connected GitHub installation covers. Reads only.",
    availability: "available", handler: "repositories", ...base("provider-read"),
  },

  /* ── The second provider-read command (INT-5B2) ────────────────────────────
   *
   * `/pull-requests` answers the question `/repositories` cannot: not which repositories exist, but
   * WHAT IS CHANGING IN THEM. It reads open pull-request METADATA for the repositories the
   * organization's own installation covers.
   *
   * WHY IT IS `provider-read` AND NOT A NEW KIND. That kind's contract is a bounded read from one
   * connected external provider and nothing else, and this is exactly that — the same provider, the
   * same capability key, the same authority gate, the same firewall root. INT-5C needed a sibling
   * kind because it also reads Knowledge; this one reads nothing Hebun owns, so inventing a kind
   * would add a plumbing axis without adding a boundary.
   *
   * WHY IT IS `available`. GITHUB-4 built `readRepositoryPullRequests` against the real GitHub API
   * and NOTHING had ever consumed it — the seam existed, proven and stranded. Availability is a
   * statement about the BUILD, never about a tenant: an organization with no connected installation
   * gets a truthful refusal from the capability authority at run time.
   *
   * IT NEEDS NO NEW PERMISSION. `pull_requests: read` is already one of the two permissions every
   * minted installation token is asked to carry, and has been since GITHUB-4.
   *
   * IT TAKES NO ARGUMENTS, like `/repositories` and for the stronger half of the same reason. The
   * released seam WOULD accept a repository id and prove it against a live listing — but a command
   * that accepts no address cannot be pointed anywhere at all, and no repository address then
   * crosses the client boundary.
   */
  {
    id: "pull-requests", slash: "/pull-requests", label: "Open pull requests", category: "platform",
    kind: "provider-read",
    description:
      "Read the open pull requests in the repositories your connected GitHub installation covers. Metadata only, reads only.",
    availability: "available", handler: "pull-requests", ...base("provider-read"),
  },

  /* ── The first cross-source command (INT-5C) ──────────────────────────────
   *
   * `/repository-knowledge` answers one narrow question: for the repositories this organization's
   * GitHub installation covers, which ones has the organization RECORDED a Knowledge relationship
   * for, and which ones has it not.
   *
   * WHY IT IS NOT `kind: "provider-read"`. That kind is contractually a provider read and NOTHING
   * else — INT-5B1's firewall proves no Knowledge module of any kind is reachable from its root,
   * and this command needs exactly that. Widening `provider-read` would have deleted that guarantee
   * from `/repositories`, which never needed a Knowledge read. So this is a sibling kind with its
   * own server module and its own firewall root, exactly as `provider-read` was a sibling of `read`
   * and `propose` was a sibling of the write path.
   *
   * WHY IT IS `available`. Both halves are already released and neither is new: `/repositories`
   * (INT-5B1) reads the provider page, and KR-EXT1 built the declaration table, its human-only
   * CHECK constraint, and the exact index this join reads. INT-5C is the first reader of that
   * index — it adds no schema, no migration and no provider permission.
   *
   * IT TAKES NO ARGUMENTS, for the same reason `/repositories` takes none. A repository id or name
   * would be a caller-supplied address, and neither the provider seam nor the Knowledge lookup
   * accepts one: the installation decides which records exist, and the server context decides which
   * organization's declarations are read.
   *
   * IT ASKS THE MODEL NOTHING. The relationship is SQL equality on the provider's immutable record
   * id. A model cannot select, invent, rank or explain a link here, because no model client is
   * reachable from the module that runs it.
   */
  {
    id: "repository-knowledge", slash: "/repository-knowledge", label: "Repository knowledge",
    category: "platform", kind: "cross-source-read",
    description:
      "For the repositories your GitHub installation covers, show which ones your organization has " +
      "recorded a Knowledge relationship for. Reads only.",
    availability: "available", handler: "repository-knowledge", ...base("cross-source-read"),
  },

  /*
   * WORK-ACTIVITY-1 — THE SECOND CROSS-SOURCE COMMAND, AND IT RUNS THE CHAIN THE OTHER WAY.
   *
   * `/repository-knowledge` starts at a PROVIDER PAGE and asks what the organization declared about
   * it. This one starts at the ORGANIZATION'S OWN WORK and follows what people declared out to one
   * provider record:
   *
   *   work item → what it declares it concerns → the Knowledge fact's external reference
   *     → that repository's live open pull requests
   *
   * IT TAKES ONE ARGUMENT, AND IT IS A WORK REFERENCE. That is the point of the capability: the
   * Director names the WORK, and Hebun walks a chain humans already built. Nobody has to know a
   * Knowledge fact id, a GitHub repository id, the external-reference mapping, or which provider
   * command to type. A repository id is NOT accepted here — the only address this command follows is
   * one a person recorded.
   *
   * IT ASKS THE MODEL NOTHING, and it is not `/pull-requests` with extra steps: that command reads
   * a repository a human named, and this one reads the repository the organization's own
   * declarations lead to. Both halves keep their own standing, and observed activity never becomes
   * a statement about declared work.
   */
  {
    id: "work-activity", slash: "/work-activity", label: "Work activity",
    category: "platform", kind: "cross-source-read",
    description:
      "For one recorded work item, show what your organization declared it concerns and what GitHub " +
      "currently reports about the repository that concern names. Reads only; observes nothing about " +
      "whether the work is progressing.",
    availability: "available", handler: "work-activity",
    ...base("cross-source-read"),
    /*
     * AFTER the spread, deliberately: `base` supplies an empty `args`, and this command is the first
     * cross-source one that takes any. The pattern mirrors the released `work-item/<uuid>` reference
     * the Work grounding source publishes, anchored and lowercase-only for the reason
     * `artifact-ref.ts` paid for — several spellings of one id are several different addresses.
     */
    args: [
      {
        name: "work",
        required: true,
        description: "A recorded work reference: work-item/<uuid>",
        pattern: /^work-item\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      },
    ],
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

  /* ── Action proposal (R3A.1) ──────────────────────────────────────────────
   *
   * `/send` LEFT THE RESERVED BLOCK, and the description changed with it. It used to read "Send a
   * message on your behalf", which was honest only while the command did nothing at all — the
   * moment it does something, that sentence would be a lie, because this command still sends
   * exactly nothing. It PREPARES a proposal and a human decides in /approvals.
   *
   * It is `available` rather than `requires-execution` because filing a proposal genuinely does not
   * need an execution runtime. `send-external-communication` still declares
   * `substrateConnected: false`, so approval mints a permit that no consumer can spend — which is
   * the honest state of the system and not something this command papers over.
   *
   * BOTH ARGUMENTS ARE REFERENCES. Not an address, not a body. A raw address would make the model
   * or the operator the recipient authority instead of R3R; raw text would do the same to R3W.
   */
  {
    id: "send", slash: "/send", label: "Prepare a send", category: "actions", kind: "propose",
    description: "Prepare an external message for Director approval. Sends nothing.",
    availability: "available", handler: "send",
    /*
     * The patterns mirror `recipient-ref.ts` and `artifact-ref.ts` — lowercase, anchored, exactly
     * one spelling each. They are duplicated rather than imported because this module is the pure
     * registry and must not depend on the R3R/R3W feature graphs; a test asserts the two agree, so
     * the duplication cannot drift.
     */
    args: [
      {
        name: "recipient",
        required: true,
        description: "A recorded recipient reference: external-recipient/<uuid>",
        pattern: /^external-recipient\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      },
      {
        name: "draft",
        required: true,
        description: "An exact draft revision reference: work-artifact/<uuid>@<n>",
        pattern: /^work-artifact\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@[1-9][0-9]{0,8}$/,
      },
    ],
    requiresModel: false,
    requiresExecution: false,
    safeWhenProviderOff: true,
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
    /*
     * INT-5B1, EXTENDED BY INT-5C — external reach is declared by kind, in both directions.
     *
     * WHAT ARRIVED: a SECOND kind that genuinely leaves the building. `cross-source-read` performs
     * the same released provider read and then joins it against the organization's own records, so
     * it reaches a provider and must say so. The invariant is not loosened by naming it — it is
     * still an exact biconditional, and it still refuses a command of any OTHER kind that claims
     * reach, and any reaching command that omits the claim.
     *
     * The set is spelled out rather than replaced by a truthy check, so adding a third reaching kind
     * has to be a deliberate edit here rather than a side effect somewhere else.
     *
     * The `!== true` spelling matters: the field is optional, so `undefined` must read as "no
     * reach". A reaching command that omitted it would otherwise pass by accident.
     */
    const reachingKinds: readonly HebyCommandKind[] = ["provider-read", "cross-source-read"];
    if ((command.reachesProvider === true) !== reachingKinds.includes(command.kind)) {
      problems.push(
        `${command.id}: reachesProvider must be true exactly for provider-reaching commands`,
      );
    }
    /* A command that reaches a provider may never also claim the model or an execution runtime. */
    if (reachingKinds.includes(command.kind) && (command.requiresModel || command.requiresExecution)) {
      problems.push(`${command.id}: a provider-reaching command needs neither the model nor execution`);
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
