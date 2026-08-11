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
 *   /security                              the Security Center source map — a truthful statement of
 *                                         what each security source can and cannot prove. It
 *                                         reports the ABSENCE of a live feed as the finding it is.
 *   /history                               the durable conversation the operator is actually in.
 *   /knowledge /source                     (K1) the canonical Knowledge authority — knowledge_facts
 *                                         joined to its active knowledge_nodes row, read
 *                                         tenant-scoped over the durable control-plane database. It
 *                                         reports the tenant's REAL knowledge, which stays empty
 *                                         until an ingestion path exists, and it states each
 *                                         Knowledge capability SEPARATELY rather than collapsing
 *                                         them into "Knowledge connected".
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
 * K1 — the honest closing note for every Knowledge read. It states the two things an operator
 * would otherwise have to infer: nothing can ADD knowledge to Hebun today, and settled
 * knowledge never speaks for the current runtime.
 */
const KNOWLEDGE_CLOSING = [
  "No ingestion path exists, so nothing can add knowledge to Hebun yet — an empty result means your organization has none stored, not that a read failed.",
  "Knowledge describes its own subject. It never states what the system is doing now; for that, the live read models remain the source.",
] as const;

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
     * capability stated SEPARATELY. It never says "Knowledge connected": listing and named-source
     * read are connected, search, semantic retrieval, ingestion and embeddings are not, and
     * collapsing those into one word would be the lie this command exists to avoid.
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
