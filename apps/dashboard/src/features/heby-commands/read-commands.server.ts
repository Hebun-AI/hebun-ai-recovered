/*
 * heby-commands/read-commands.server.ts — the server execution of READ slash commands (S1).
 *
 * A READ command answers from a source this repository ALREADY HAS. It performs no provider
 * request, constructs no transport, and imports no model client — a read cannot become a model call
 * here because there is nothing in this module that could make one.
 *
 * WHAT IS ACTUALLY BEHIND EACH COMMAND (audited against the shipped code, not assumed):
 *
 *   /status /refresh /agents /workflows   the Executive Overview — a REAL derived read model that
 *                                         is explicitly non-authoritative. Every result says so.
 *   /providers /model /connectivity        the provider-ops view — the Director's durable
 *                                         permission, server configuration, credential PRESENCE,
 *                                         and which transport the config would select. It never
 *                                         carries a key, a health figure, a cost, or a latency,
 *                                         and it never collapses those states into one boolean.
 *   /usage                                 (R2F.1) recorded provider usage — the tenant's own
 *                                         durable message rows, totalled. Provider-REPORTED token
 *                                         counts only: no price, no currency, no budget, and the
 *                                         totals are stated as lower bounds because a call whose
 *                                         local record never persisted leaves no row to count.
 *   /security                              the Security Center source map — a truthful statement of
 *                                         what each security source can and cannot prove. It
 *                                         reports the ABSENCE of a live feed as the finding it is.
 *   /history                               the durable conversation the operator is actually in.
 *   /knowledge /source                     (K1) the canonical Knowledge authority — knowledge_facts
 *                                         joined to its active knowledge_nodes row, read
 *                                         tenant-scoped over the durable control-plane database. It
 *                                         reports the tenant's REAL knowledge — empty until somebody
 *                                         ingests some — and it states each Knowledge capability
 *                                         SEPARATELY rather than collapsing them into
 *                                         "Knowledge connected".
 *
 * Commands with no source never reach this module: the registry marks them unavailable and the
 * pure planner refuses them before any server call is made.
 *
 * The tenant is resolved SERVER-SIDE, exactly as the answer flow does. The client supplies only a
 * command id, its arguments, and the route it is on — never identity, tenancy, or authority.
 *
 * Server-only. Dependencies are injectable so the whole surface is provable with no database, no
 * network, and no key.
 */

import {
  resolveHebyWorkspace,
  resolveHebyWorkspaceContext,
  type HebySourceClass,
} from "@/features/heby-integration";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveSources,
  type ExecutiveOverviewLike,
  type SourceResolution,
} from "@/features/heby-runtime";
import { readServerHebyOverview } from "@/features/heby-runtime/overview-source.server";
import {
  resolveConversationRepoOrNull,
  type ConversationScope,
  type DurableConversationRepository,
} from "@/features/heby-conversation/durable-conversation-repository.server";
import {
  readProviderOpsView,
  type ProviderOpsView,
} from "@/features/heby-provider-ops/provider-connectivity-projection.server";
import { readRecordedProviderUsage } from "@/features/heby-provider-ops/provider-usage-aggregation.server";
import {
  hasNoRecordedUsage,
  type RecordedProviderUsageRead,
} from "@/features/heby-provider-ops/usage-contracts";
import { listSecuritySources, hasConnectedSecurityFeed } from "@/features/security-center/source-map";
import { listSecurityFindings } from "@/features/security-center/findings";
import {
  describeKnowledgeRecord,
  readKnowledgeAvailability,
  readKnowledgeSourceByName,
  type KnowledgeReadDeps,
} from "@/features/knowledge/knowledge-read.server";
import { KNOWLEDGE_PROVENANCE, type KnowledgeSourceRecord } from "@/features/knowledge/contracts";
import { findHebyCommandById } from "./registry";
import type { HebyCommandResult } from "./contracts";

/** The single client-controlled input. It carries NO authority. */
export interface HebyReadCommandInput {
  /** A registry command id. Anything unknown is refused. */
  readonly commandId: string;
  readonly args: readonly string[];
  /** The route the surface is on, used only to scope which read models are consulted. */
  readonly route: string;
  /** An opaque conversation reference, re-verified against the tenant server-side. */
  readonly conversationId?: string;
}

export interface HebyReadCommandDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  readonly readOverview?: () => ExecutiveOverviewLike | undefined;
  readonly readProviderOps?: () => Promise<ProviderOpsView>;
  /**
   * R2F.1 — the recorded-usage aggregation seam. THE SAME function the provider matrix calls;
   * there is deliberately no second computation of a total inside command dispatch, because two
   * implementations of one number is how two surfaces come to disagree about it.
   */
  readonly readUsage?: (tenant: TenantContext) => Promise<RecordedProviderUsageRead>;
  readonly getConversationRepo?: () => DurableConversationRepository | null;
  /** K1 — the canonical Knowledge read seam. Injectable so the flow is provable with no database. */
  readonly knowledge?: KnowledgeReadDeps;
}

export type HebyReadCommandResult =
  | { readonly status: "unauthorized" }
  /** The command id was not a runnable READ command. Nothing was read. */
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "ok"; readonly result: HebyCommandResult };

const OVERVIEW_PROVENANCE =
  "Executive Overview read model — derived and non-authoritative. It is not a live execution feed.";

/**
 * K1 — the honest closing note for every Knowledge read. It states the three things an operator
 * would otherwise have to infer: how knowledge gets in and what standing it arrives with, that
 * being readable is not being findable, and that settled knowledge never speaks for the current
 * runtime.
 *
 * It once opened by saying no ingestion path existed. One does, so that line was a lie appended to
 * every Knowledge read — including reads of records somebody had just ingested.
 *
 * DELIBERATELY WORDED WITHOUT THE R-WORD — and this comment observes the same rule, because the
 * rule is about the FILE. The g2 and k4 firewalls forbid any `heby-commands` file from naming a
 * Governance approval mutation, so that Heby can never look like it offers one, and they scan the
 * raw file: a denial reads the same as an offer to a regular expression. The standing is stated
 * here as "provisional draft, stored but not reviewed"; the formal version lives where it belongs,
 * in the Knowledge capability map's `cannotProve`, which this command already renders.
 */
const KNOWLEDGE_CLOSING = [
  "Plain text is ingested through the Knowledge workspace and lands as a provisional draft — stored is not reviewed, and nobody has endorsed it by putting it there. An empty result means your organization has none stored, not that a read failed.",
  "There is no search, embedding or semantic retrieval over it: knowledge here is readable, not findable by meaning.",
  "Knowledge describes its own subject. It never states what the system is doing now; for that, the live read models remain the source.",
] as const;

/**
 * R2F.1 — the honest closing note for a recorded-usage read.
 *
 * It states the three things an operator would otherwise have to infer: that these are counts
 * the provider reported and Hebun stored rather than an account balance, that a call whose
 * record never landed is invisible here, and that no money figure exists anywhere to convert
 * them into. Written as a floor, on purpose — see the aggregation module's header.
 */
const USAGE_CLOSING = [
  "These are RECORDED totals: token counts the provider reported and Hebun durably stored. They are not a bill, not a charge, and not an account balance.",
  "They are a lower bound. A provider request that succeeded while its local record failed to persist spent real resources and left no row, and nothing here can recover it.",
  "Hebun holds no pricing for any model, so no monetary cost is shown or derivable from this. There is no budget and no limit attached to these numbers.",
] as const;

const USAGE_PROVENANCE =
  "Durable conversation records, scoped to your tenant. Provider-reported token counts only — no price, no currency, no budget.";

/** Render one Knowledge record with its own provenance and standing intact. */
function knowledgeRecordLines(record: KnowledgeSourceRecord): readonly string[] {
  const lines = [describeKnowledgeRecord(record)];
  if (record.statement) lines.push(`  ${record.statement}`);
  if (record.effectiveFrom || record.effectiveUntil) {
    lines.push(
      `  Effective: ${record.effectiveFrom ?? "not stated"} → ${record.effectiveUntil ?? "no end stated"}.`,
    );
  }
  if (record.nextReviewAt) lines.push(`  Next review: ${record.nextReviewAt}.`);
  if (record.health) lines.push(`  Declared health: ${record.health}.`);
  return lines;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Heby read commands are server-only.");
  }
}

function ok(command: string, title: string, lines: readonly string[], provenance: string): HebyReadCommandResult {
  return { status: "ok", result: { command, title, lines, tone: "info", provenance } };
}

function unavailable(command: string, title: string, lines: readonly string[], provenance: string): HebyReadCommandResult {
  return { status: "ok", result: { command, title, lines, tone: "unavailable", provenance } };
}

/** Describe the freshness the overview reports about ITSELF. Never a claim of live polling. */
function freshnessLine(overview: ExecutiveOverviewLike): string {
  const age = overview.freshness.ageSeconds;
  const agePart = typeof age === "number" ? ` (about ${Math.round(age)}s old)` : "";
  return `Freshness: ${overview.freshness.state}${agePart}. Hebun reads this when you ask; it does not poll in the background.`;
}

/** Render overview sections as lines, or state honestly that none are readable. */
function sectionLines(
  overview: ExecutiveOverviewLike,
  sectionIds: readonly string[],
  emptyMessage: string,
): readonly string[] {
  const sections = overview.sections.filter((section) => sectionIds.includes(section.sectionId));
  if (sections.length === 0) return [emptyMessage];
  return sections.map(
    (section) =>
      `${section.label} — health: ${section.health} · ${section.reasonCode} · ${section.recordCount} record${section.recordCount === 1 ? "" : "s"}`,
  );
}

/** Turn resolved sources into lines that PRESERVE each source's own availability and provenance. */
function resolutionLines(resolutions: readonly SourceResolution[]): readonly string[] {
  const lines: string[] = [];
  for (const resolution of resolutions) {
    if (resolution.state === "resolved") {
      lines.push(`${resolution.sourceClass}: ${resolution.items.length} readable item${resolution.items.length === 1 ? "" : "s"}.`);
      for (const item of resolution.items) lines.push(`  ${item.label} — ${item.detail}`);
    } else {
      lines.push(`${resolution.sourceClass}: unavailable — ${resolution.unavailableReason ?? "no connected path."}`);
    }
  }
  return lines;
}

/**
 * Execute a READ command. Fail-closed at every gate: an unauthenticated caller, an unknown command
 * id, or a command that is not a runnable READ is refused without reading anything.
 */
export async function runHebyReadCommand(
  input: HebyReadCommandInput,
  deps: HebyReadCommandDeps,
): Promise<HebyReadCommandResult> {
  assertServerRuntime();

  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "unauthorized" };

  // The command must exist in the registry, be a READ, and be available. The client's id is a
  // lookup key into a closed set — it can never select behaviour the registry does not declare.
  const command = findHebyCommandById(input.commandId);
  if (!command) return { status: "rejected", reason: "unknown-command" };
  if (command.kind !== "read") return { status: "rejected", reason: "not-a-read-command" };
  if (command.availability !== "available") return { status: "rejected", reason: "not-available" };

  const slash = command.slash;

  switch (command.handler) {
    /* ── Context status ───────────────────────────────────────────────── */
    case "status":
    case "refresh": {
      const overview = (deps.readOverview ?? readServerHebyOverview)();
      if (!overview) {
        return unavailable(slash, "Context status", [
          "The Executive Overview read model could not be built, so Heby has no system state to report.",
          "Nothing was substituted for it.",
        ], "No read model was available. Nothing was fabricated.");
      }
      const workspace = resolveHebyWorkspace(input.route);
      const resolved = resolveHebyWorkspaceContext({ workspace, route: input.route });
      const sourceClasses = resolved.sources.map((source) => source.sourceClass as HebySourceClass);
      const resolutions = resolveSources(sourceClasses, overview);
      const verb = command.handler === "refresh" ? "Re-read" : "Read";
      return ok(
        slash,
        `${verb} just now — ${resolved.workspaceLabel}`,
        [
          `Organization health: ${overview.organizationHealth}.`,
          `Critical: ${overview.criticalAlertCount} · Warnings: ${overview.warningCount} · Unavailable: ${overview.unavailableCount}.`,
          freshnessLine(overview),
          "",
          ...resolutionLines(resolutions),
        ],
        OVERVIEW_PROVENANCE,
      );
    }

    /* ── Agents / workflows ───────────────────────────────────────────── */
    case "agents":
    case "workflows": {
      const overview = (deps.readOverview ?? readServerHebyOverview)();
      if (!overview) {
        return unavailable(slash, command.label, [
          "The Executive Overview read model could not be built, so there is nothing to read.",
        ], "No read model was available. Nothing was fabricated.");
      }
      const isAgents = command.handler === "agents";
      const lines = sectionLines(
        overview,
        isAgents ? ["active-agents"] : ["active-workflows"],
        isAgents
          ? "No agent section is readable in the current read models."
          : "No workflow section is readable in the current read models.",
      );
      return ok(
        slash,
        command.label,
        [
          ...lines,
          "",
          isAgents
            ? "This is the agent section of a derived read model. It is not a live execution feed, and it does not mean an agent is running."
            : "This is the workflow section of a derived read model. It describes seeded, non-authoritative workflow state — not live runs.",
        ],
        OVERVIEW_PROVENANCE,
      );
    }

    /* ── Provider / platform ──────────────────────────────────────────── */
    case "providers":
    case "model":
    case "connectivity": {
      const view = await (deps.readProviderOps ?? (() => readProviderOpsView()))();
      const shared = [
        `Provider: ${view.providerLabel}.`,
        `Director permission: ${view.directorControl}.`,
        `Configuration: ${view.configuration}.`,
        `Credential: ${view.credential} (presence only — the value is never read here).`,
        `Model: ${view.model ?? "not configured"}.`,
        `Transport the current configuration would select: ${view.transport}.`,
        `Connectivity: ${view.connectivity} — Hebun performs no live check, so it reports no health.`,
        `Last validation: ${view.lastValidation === null ? "none recorded" : String(view.lastValidation)}.`,
      ];
      const closing =
        command.handler === "connectivity"
          ? "These are four separate facts. Enabled is not configured, configured is not credentialled, and none of them means connected."
          : "Enabled, configured, credentialled and connected are different things, and none of them is asserted beyond what is shown.";
      return ok(
        slash,
        command.handler === "model" ? "Configured model" : command.label,
        [...shared, "", closing],
        "Durable Director control + server configuration. No secret, no health figure, no cost, no latency.",
      );
    }

    /* ── Recorded provider usage (R2F.1) ──────────────────────────────────
     * Reads durable rows and nothing else: no transport is constructed, no provider is
     * contacted, and the Director's connectivity permission is not consulted at all. The kill
     * switch governs FUTURE dispatch; it does not retract usage that already happened, so this
     * command keeps working while Claude is off — which is exactly when somebody is most likely
     * to ask what was used.
     *
     * Every number is labelled RECORDED. Hebun cannot observe what the provider actually
     * charged, and it cannot even observe every call it made: a provider request that succeeded
     * while local persistence failed left no row anywhere. The totals are therefore a floor, and
     * the closing lines say so rather than letting a floor be read as a fact.
     */
    case "usage": {
      const read = await (deps.readUsage ?? ((t: TenantContext) => readRecordedProviderUsage(t)))(
        tenant,
      );
      if (read.status === "unavailable") {
        return unavailable(slash, "Recorded provider usage", [
          read.reason === "persistence-not-configured"
            ? "Durable storage is not configured, so no provider usage has ever been recorded to read."
            : "Recorded provider usage could not be read, and nothing was substituted for it.",
          `Reason: ${read.reason}.`,
        ], USAGE_PROVENANCE);
      }

      const { totals, byModel, byDay } = read.usage;
      if (hasNoRecordedUsage(read.usage)) {
        return ok(slash, "Recorded provider usage", [
          "Your organization has no recorded provider usage.",
          "That is the real state, not a read failure — no model request from this organization has been durably recorded, so there is nothing to total.",
          "",
          ...USAGE_CLOSING,
        ], USAGE_PROVENANCE);
      }

      const n = (value: number) => value.toLocaleString("en-US");
      return ok(
        slash,
        "Recorded provider usage",
        [
          `Recorded provider calls: ${n(totals.recordedCalls)}.`,
          `Recorded input tokens: ${n(totals.inputTokens)}.`,
          `Recorded output tokens: ${n(totals.outputTokens)}.`,
          `Recorded tokens in total: ${n(totals.totalTokens)}.`,
          totals.unknownTokenRows === 0
            ? `Calls whose token counts the provider did not fully report: 0. Every recorded call carries both counts.`
            : `Calls whose token counts the provider did not fully report: ${n(totals.unknownTokenRows)}. They are counted here and deliberately left out of the token sums — an unreported count is not a zero.`,
          "",
          `By model (${byModel.length}):`,
          ...byModel.map(
            (group) =>
              `  ${group.key} — ${n(group.recordedCalls)} call${group.recordedCalls === 1 ? "" : "s"}, ${n(group.totalTokens)} recorded token${group.totalTokens === 1 ? "" : "s"}`,
          ),
          "",
          `Days with recorded usage: ${n(byDay.length)} (most recent: ${byDay[0]?.key ?? "none"}, UTC).`,
          "",
          ...USAGE_CLOSING,
        ],
        USAGE_PROVENANCE,
      );
    }

    /* ── Security posture ─────────────────────────────────────────────── */
    case "security": {
      const sources = listSecuritySources();
      const connected = hasConnectedSecurityFeed();
      const findings = listSecurityFindings(tenant.tenantId);
      const derived = sources.filter((source) => source.state === "derived");
      const notConnected = sources.filter((source) => source.state !== "derived");
      return ok(
        slash,
        "Security posture",
        [
          connected
            ? "A live security feed is connected."
            : "No live security feed is connected. Hebun cannot observe an attack, an intrusion, or a breach.",
          `Findings: ${findings.length}. Hebun produces no finding it cannot support with evidence, and it never confirms a breach.`,
          "",
          `Derived technical state Hebun CAN read (${derived.length}):`,
          ...derived.map((source) => `  ${source.sourceClass} — can show: ${source.canProve} Cannot show: ${source.cannotProve}`),
          "",
          `Not connected (${notConnected.length}):`,
          ...notConnected.map((source) => `  ${source.sourceClass} — ${source.detail}`),
        ],
        "Security Center source map — a statement about Hebun's own sources, not a threat assessment.",
      );
    }

    /* ── Knowledge (K1) ───────────────────────────────────────────────────
     * A truthful view of the Knowledge the tenant actually holds, plus each Knowledge
     * capability stated SEPARATELY. It never says "Knowledge connected": listing, named-source
     * read and plain-text ingestion are connected, search, semantic retrieval and embeddings are
     * not, and collapsing those into one word would be the lie this command exists to avoid.
     */
    case "knowledge": {
      const report = await readKnowledgeAvailability(tenant, deps.knowledge);
      const connected = report.capabilities.filter((entry) => entry.state === "connected");
      const missing = report.capabilities.filter((entry) => entry.state !== "connected");

      const stateLines: string[] = [];
      if (report.listing.status === "unavailable") {
        stateLines.push(
          `Your organization's knowledge could not be read — ${report.listing.reason}.`,
          report.listing.detail ?? "Nothing was substituted for it.",
        );
      } else {
        const { records, incomplete, truncated } = report.listing;
        stateLines.push(
          records.length === 0
            ? "Your organization holds no knowledge records. That is the real state, not a read failure — nothing is stored, and nothing was invented to fill the gap."
            : `Knowledge records your organization holds: ${records.length}${truncated ? " (showing the first page; more exist)" : ""}.`,
        );
        for (const record of records) stateLines.push(...knowledgeRecordLines(record));
        if (incomplete.length > 0) {
          stateLines.push(
            "",
            `Facts whose selected content is unreadable: ${incomplete.length}. They are listed apart from readable records rather than merged into them.`,
            ...incomplete.map((stub) => `  ${stub.factKey} — ${stub.domainKey} · ${stub.scope} · ${stub.reason}`),
          );
        }
      }

      return ok(
        slash,
        "Knowledge",
        [
          ...stateLines,
          "",
          `Connected Knowledge capabilities (${connected.length}):`,
          ...connected.map((entry) => `  ${entry.label} — can show: ${entry.canProve} Cannot show: ${entry.cannotProve}`),
          "",
          `Not connected (${missing.length}):`,
          ...missing.map((entry) => `  ${entry.label} — ${entry.authority}`),
          "",
          ...KNOWLEDGE_CLOSING,
        ],
        KNOWLEDGE_PROVENANCE,
      );
    }

    /* ── Named source read (K1) ───────────────────────────────────────────
     * The argument is a LOOKUP KEY into the tenant's own canonical facts — never a path, a URL,
     * or a location. Nothing is opened, fetched, or executed: an unmatched string simply does not
     * resolve. An ambiguous key returns every candidate rather than silently picking one.
     */
    case "source": {
      const name = (input.args[0] ?? "").trim();
      if (!name) {
        return unavailable(slash, "Inspect a source", [
          "/source needs the canonical fact key of the source to read. Nothing was read.",
        ], "Local — the command was incomplete, so no read was performed.");
      }

      const result = await readKnowledgeSourceByName(tenant, name, deps.knowledge);
      switch (result.status) {
        case "found":
          return ok(slash, `Knowledge source — ${result.record.factKey}`, [
            ...knowledgeRecordLines(result.record),
            "",
            ...KNOWLEDGE_CLOSING,
          ], KNOWLEDGE_PROVENANCE);

        case "ambiguous":
          return ok(slash, `Knowledge source — ${name}`, [
            `“${name}” matches ${result.candidates.length} facts across different domains or scopes, so none was chosen for you.`,
            "",
            ...result.candidates.flatMap((candidate) => knowledgeRecordLines(candidate)),
            "",
            "Name the domain you mean.",
          ], KNOWLEDGE_PROVENANCE);

        case "incomplete":
          return unavailable(slash, `Knowledge source — ${name}`, [
            `The fact “${result.stub.factKey}” exists in ${result.stub.domainKey} · ${result.stub.scope}, but its selected content is unreadable (${result.stub.reason}).`,
            "Its identity is real; its content is not available, and none was substituted.",
          ], KNOWLEDGE_PROVENANCE);

        case "not-found":
          return unavailable(slash, `Knowledge source — ${name}`, [
            `No knowledge source named “${name}” exists for your organization.`,
            "A source belonging to another organization is indistinguishable from one that does not exist — Heby cannot see across that boundary.",
            "",
            ...KNOWLEDGE_CLOSING,
          ], KNOWLEDGE_PROVENANCE);

        default:
          return unavailable(slash, `Knowledge source — ${name}`, [
            `Knowledge could not be read — ${result.reason}.`,
            result.detail ?? "Nothing was substituted for it.",
          ], KNOWLEDGE_PROVENANCE);
      }
    }

    /* ── Conversation history ─────────────────────────────────────────── */
    case "history": {
      const repo = (deps.getConversationRepo ?? resolveConversationRepoOrNull)();
      if (!repo) {
        return unavailable(slash, "Conversation history", [
          "Durable conversation storage is not configured, so nothing is being saved right now.",
        ], "Durable conversation authority — not configured.");
      }
      if (!input.conversationId) {
        return ok(slash, "Conversation history", [
          "This view is not attached to a saved conversation yet. The next message will start one.",
          "Hebun has no cross-conversation browser yet, so Heby can only report the conversation you are in.",
        ], "Durable conversation authority.");
      }
      const scope: ConversationScope = { tenantId: tenant.tenantId, actorId: tenant.userId };
      // Ownership is re-checked by the repository, so a foreign or unknown id simply resolves to
      // nothing rather than exposing another tenant's thread.
      const conversation = await repo.getConversation(scope, input.conversationId);
      if (!conversation) {
        return unavailable(slash, "Conversation history", [
          "That conversation is not available for your account.",
        ], "Durable conversation authority — ownership re-checked server-side.");
      }
      const messages = await repo.listConversationMessages(scope, input.conversationId);
      const fromUser = messages.filter((message) => message.role === "user").length;
      const fromHeby = messages.length - fromUser;
      const modelBacked = messages.filter((message) => message.origin === "model").length;
      return ok(
        slash,
        "Conversation history",
        [
          `Subject: ${conversation.subject ?? "(none recorded)"}.`,
          `Started: ${conversation.createdAt}.`,
          `Messages: ${messages.length} — ${fromUser} from you, ${fromHeby} from Heby.`,
          `Model-generated Heby messages: ${modelBacked}. The rest were answered deterministically.`,
          "",
          "Hebun has no cross-conversation browser yet, so this reports only the conversation you are in.",
        ],
        "Durable conversation authority, scoped to your tenant.",
      );
    }

    default:
      return { status: "rejected", reason: "no-read-handler" };
  }
}
