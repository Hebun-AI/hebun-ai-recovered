/*
 * S1 — what each command actually DOES, and what it provably cannot do.
 *
 * The dispatch planner is where "a command may request a capability, but can never grant itself
 * permission" is enforced. These proofs are exhaustive over the registry rather than sampled: for
 * EVERY command, the plan is checked against its declared kind, and the ONE plan that can carry a
 * model prompt is checked to be advisory-only.
 *
 * Pure planner proofs plus the real server READ flow driven with injected fakes. No network, no key,
 * no database, no Anthropic call.
 */
import assert from "node:assert/strict";
import {
  HEBY_COMMANDS,
  HEBY_GO_TARGETS,
  findHebyCommandById,
  parseHebyInput,
  planHebyCommand,
  resolveGoTarget,
  type HebyCommandContext,
  type HebyCommandPlan,
} from "../../src/features/heby-commands";
import { runHebyReadCommand } from "../../src/features/heby-commands/read-commands.server";
import { createInMemoryConversationRepo } from "../helpers/in-memory-conversation-repo";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { ExecutiveOverviewLike } from "../../src/features/heby-runtime";

const TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
} as unknown as TenantContext;

const CONTEXT: HebyCommandContext = {
  surface: "full-workspace",
  contextLabel: "Operations",
  contextDetail: ["Current context: Operations.", "It cannot act, execute, or approve anything."],
  evidenceLines: ["operations · active-agents"],
  returnLabel: "Operations",
};

/** A realistic overview: two readable operational sections plus platform state. */
const OVERVIEW: ExecutiveOverviewLike = {
  organizationHealth: "degraded",
  criticalAlertCount: 2,
  warningCount: 1,
  unavailableCount: 3,
  freshness: { state: "fresh", ageSeconds: 12 },
  sections: [
    { sectionId: "active-agents", label: "Active Agents", health: "critical", sourceState: "seeded", recordCount: 36, reasonCode: "SECTION_CRITICAL" },
    { sectionId: "active-workflows", label: "Active Workflows", health: "critical", sourceState: "seeded", recordCount: 14, reasonCode: "SECTION_CRITICAL" },
    { sectionId: "runtime-status", label: "Runtime Status", health: "healthy", sourceState: "derived", recordCount: 3, reasonCode: "SECTION_HEALTHY" },
  ],
  authoritative: false,
};

const PROVIDER_OFF = {
  providerLabel: "Anthropic / Claude",
  providerKey: "claude",
  directorEnabled: false,
  directorControl: "disabled" as const,
  configuration: "configured" as const,
  credential: "present" as const,
  model: "claude-test",
  transport: "fake" as const,
  connectivity: "not-recorded" as const,
  lastValidation: null,
};

function plan(slash: string, args: readonly string[] = []): HebyCommandPlan {
  const command = findHebyCommandById(slash)!;
  assert.ok(command, `${slash} exists`);
  return planHebyCommand(command, args, CONTEXT);
}

async function main(): Promise<void> {
  /* ── EXHAUSTIVE: every command's plan matches its declared kind ───────────── */
  {
    for (const command of HEBY_COMMANDS) {
      // Supply plausible arguments so argument-bearing commands reach their real branch.
      const args = command.args.map((argument) => (argument.name === "workspace" ? "operations" : `sample-${argument.name}`));
      const result = planHebyCommand(command, args, CONTEXT);

      // 26 + 27 + 28 + 29: ONLY an advisory plan may carry a prompt. Nothing else can.
      if (result.kind === "advisory") {
        assert.equal(command.kind, "advisory", `${command.slash}: only an advisory command may produce a prompt`);
        assert.ok(result.prompt.length > 0);
      } else {
        assert.ok(!("prompt" in result), `${command.slash}: a ${result.kind} plan carries no prompt`);
      }

      // 25 + 26: a RESERVED command is always refused, and refused as unavailable.
      if (command.kind === "reserved") {
        assert.equal(result.kind, "unavailable", `${command.slash} never runs`);
        if (result.kind === "unavailable") {
          assert.equal(result.result.tone, "unavailable");
          assert.ok(/execution|approval/i.test(result.result.provenance), `${command.slash} says an execution runtime is missing`);
          // It must NOT produce a plan, a preview, or a "here is what would happen".
          const body = result.result.lines.join(" ");
          assert.ok(!/would (run|deploy|execute|send)|dry.?run|preview/i.test(body), `${command.slash} fabricates no preview`);
        }
      }

      // An unavailable command is refused whatever kind it claims to be.
      if (command.availability !== "available") {
        assert.equal(result.kind, "unavailable", `${command.slash} is refused`);
        if (result.kind === "unavailable") {
          assert.ok(result.result.lines.join(" ").length > 20, `${command.slash} explains itself`);
        }
      }

      // A READ plan only ever names a registry command; it never carries free text.
      if (result.kind === "read") {
        assert.equal(command.kind, "read");
        assert.equal(findHebyCommandById(result.commandId), command);
      }
    }
  }

  /* ── 7–10. Conversation commands ──────────────────────────────────────────── */
  {
    const newPlan = plan("new");
    assert.equal(newPlan.kind, "detach");
    if (newPlan.kind === "detach") assert.ok(/still saved/i.test(newPlan.result.lines.join(" ")), "/new keeps earlier conversations");

    const clearPlan = plan("clear");
    assert.equal(clearPlan.kind, "detach");
    if (clearPlan.kind === "detach") {
      const body = clearPlan.result.lines.join(" ");
      assert.ok(/detached/i.test(body) && /Nothing was deleted/i.test(body), "/clear detaches and says nothing was deleted");
    }

    const helpPlan = plan("help");
    assert.equal(helpPlan.kind, "local");
    if (helpPlan.kind === "local") {
      const body = helpPlan.result.lines.join("\n");
      assert.ok(body.includes("/summary"), "/help lists a runnable advisory command");
      assert.ok(body.includes("/run"), "/help lists the reserved commands too");
      assert.ok(/not available yet/.test(body), "and marks the unavailable ones");
      assert.ok(body.includes("Conversation:") && body.includes("Future capabilities:"), "grouped by category");
    }

    assert.equal(plan("close").kind, "close");
    assert.equal(plan("history").kind, "read", "/history is a server read of the durable conversation");
  }

  /* ── 11–13. Context commands ──────────────────────────────────────────────── */
  {
    const contextPlan = plan("context");
    assert.equal(contextPlan.kind, "local");
    if (contextPlan.kind === "local") assert.deepEqual(contextPlan.result.lines, CONTEXT.contextDetail);

    const sourcesPlan = plan("sources");
    assert.equal(sourcesPlan.kind, "local");
    if (sourcesPlan.kind === "local") {
      assert.deepEqual(sourcesPlan.result.lines, CONTEXT.evidenceLines);
      assert.ok(/server/i.test(sourcesPlan.result.provenance), "the evidence is the server's, not recomputed");
    }
    // With no evidence yet it says so rather than inventing a citation.
    const empty = planHebyCommand(findHebyCommandById("sources")!, [], { ...CONTEXT, evidenceLines: [] });
    assert.equal(empty.kind, "local");
    if (empty.kind === "local") assert.ok(empty.result.lines[0]!.includes("No evidence is available"));

    assert.equal(plan("status").kind, "read");
    assert.equal(plan("refresh").kind, "read");
  }

  /* ── 14–20. Advisory commands: a prompt, and an honest one ────────────────── */
  {
    for (const id of ["summary", "risks", "gaps", "why", "prioritize"]) {
      const advisory = plan(id);
      assert.equal(advisory.kind, "advisory", `/${id} is advisory`);
      if (advisory.kind === "advisory") {
        assert.ok(/grounding context/i.test(advisory.prompt), `/${id} binds the model to the grounding context`);
      }
    }
    // Each command that could invite false confidence names the honest alternative.
    const risks = plan("risks");
    if (risks.kind === "advisory") assert.ok(/cannot assess/i.test(risks.prompt), "/risks allows 'I cannot assess this'");
    const prioritize = plan("prioritize");
    if (prioritize.kind === "advisory") assert.ok(/not justified/i.test(prioritize.prompt), "/prioritize allows refusing to rank");

    const compare = plan("compare", ["alpha", "beta"]);
    assert.equal(compare.kind, "advisory");
    if (compare.kind === "advisory") {
      assert.ok(compare.prompt.includes("alpha") && compare.prompt.includes("beta"));
      assert.ok(/cannot be grounded/i.test(compare.prompt), "/compare allows refusing to compare");
    }
    const explain = plan("explain", ["active-agents"]);
    assert.equal(explain.kind, "advisory");
    if (explain.kind === "advisory") assert.ok(/does not appear in the evidence/i.test(explain.prompt));

    // A missing argument never becomes a half-built prompt.
    const incomplete = planHebyCommand(findHebyCommandById("compare")!, ["only-one"], CONTEXT);
    assert.equal(incomplete.kind, "unavailable", "an incomplete advisory command sends nothing");
  }

  /* ── 21 + 22. Navigation ──────────────────────────────────────────────────── */
  {
    for (const target of HEBY_GO_TARGETS) {
      const navigation = plan("go", [target]);
      assert.equal(navigation.kind, "navigate", `/go ${target} resolves`);
      if (navigation.kind === "navigate") {
        assert.ok(navigation.route.startsWith("/") && !navigation.route.startsWith("//"), "an in-app single-slash route");
        assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(navigation.route), "never a URL scheme");
      }
    }
    assert.equal(plan("go", ["operations"]).kind, "navigate");

    // ARBITRARY NAVIGATION IS IMPOSSIBLE: the target must be a known workspace identity.
    const hostile = [
      "https://evil.example", "//evil.example", "javascript:alert(1)", "data:text/html,<x>",
      "../", "../../etc/passwd", "/operations", "operations/../platform", "OPERATIONS extra",
      "<script>", "decisions", "nowhere", "", "   ",
    ];
    for (const value of hostile) {
      assert.equal(resolveGoTarget(value), null, `${JSON.stringify(value)} does not resolve`);
      const navigation = plan("go", [value]);
      assert.equal(navigation.kind, "unavailable", `${JSON.stringify(value)} navigates nowhere`);
      if (navigation.kind === "unavailable") {
        assert.ok(/not a Hebun workspace/i.test(navigation.result.lines[0]!), "and it says why");
        assert.ok(/No navigation happened/i.test(navigation.result.provenance));
      }
    }
  }

  /* ── 23 + 24. Security and provider families: truthful availability ───────── */
  {
    // Available because a REAL source map backs it.
    assert.equal(findHebyCommandById("security")!.availability, "available");
    assert.equal(plan("security").kind, "read");

    // Unavailable because the corresponding feed genuinely does not exist. Each names its own gap.
    const missing: Record<string, RegExp> = {
      audit: /audit history/i,
      incidents: /incident feed/i,
      threats: /telemetry|threat feed/i,
      permissions: /authorization analysis/i,
      usage: /usage-aggregation/i,
      // K1: /knowledge and /source gained a real read authority and moved to the available set
      // below. /search did NOT — search has no index, no ranking model, and no relevance
      // authority, so it stays blocked and now names that gap precisely.
      search: /no index, no ranking model, and no relevance authority/i,
      tasks: /task read model/i,
      activity: /activity stream/i,
    };
    for (const [id, reason] of Object.entries(missing)) {
      const command = findHebyCommandById(id)!;
      assert.equal(command.availability, "requires-source", `/${id} is honestly source-blocked`);
      assert.ok(reason.test(command.unavailableReason ?? ""), `/${id} names the missing source`);
      const args = command.args.map(() => "x");
      const result = planHebyCommand(command, args, CONTEXT);
      assert.equal(result.kind, "unavailable", `/${id} does not run`);
    }

    // Provider commands ARE available — a real, secret-free view backs them.
    for (const id of ["providers", "model", "connectivity"]) {
      assert.equal(findHebyCommandById(id)!.availability, "available", `/${id} is backed by a real view`);
      assert.equal(plan(id).kind, "read");
    }

    // K1: Knowledge listing and named-source read ARE available — the canonical Knowledge
    // authority (knowledge_facts → knowledge_nodes, tenant-scoped) backs them. They remain READS:
    // no model, no execution, and safe with the provider off.
    for (const [id, args] of [["knowledge", []], ["source", ["security-policy"]]] as const) {
      const command = findHebyCommandById(id)!;
      assert.equal(command.availability, "available", `/${id} is backed by the Knowledge authority`);
      assert.equal(command.kind, "read", `/${id} is a read`);
      assert.equal(command.requiresModel, false, `/${id} never requires the model`);
      assert.equal(command.safeWhenProviderOff, true, `/${id} is safe with the provider off`);
      assert.equal(planHebyCommand(command, args, CONTEXT).kind, "read");
    }
  }

  /* ── The server READ flow: real reads, zero provider dispatch ─────────────── */
  {
    const deps = {
      resolveTenant: async () => TENANT,
      readOverview: () => OVERVIEW,
      readProviderOps: async () => PROVIDER_OFF,
      getConversationRepo: () => createInMemoryConversationRepo(),
    };

    // 13. /status reads the overview and PRESERVES each source's own availability.
    const status = await runHebyReadCommand({ commandId: "status", args: [], route: "/operations" }, deps);
    assert.equal(status.status, "ok");
    if (status.status === "ok") {
      const body = status.result.lines.join("\n");
      assert.ok(body.includes("degraded"), "the real organization health is stated");
      assert.ok(body.includes("Active Agents"), "real sections are listed");
      assert.ok(/does not poll/i.test(body), "it denies background polling");
      assert.ok(/non-authoritative/i.test(status.result.provenance), "and labels the read model honestly");
    }

    // /agents and /workflows read the overview and refuse to imply live execution.
    for (const [id, marker] of [["agents", "Active Agents"], ["workflows", "Active Workflows"]] as const) {
      const read = await runHebyReadCommand({ commandId: id, args: [], route: "/operations" }, deps);
      assert.equal(read.status, "ok");
      if (read.status === "ok") {
        const body = read.result.lines.join("\n");
        assert.ok(body.includes(marker), `/${id} reports the real section`);
        assert.ok(/not a live execution feed|not live runs/i.test(body), `/${id} denies live execution`);
      }
    }

    // /connectivity keeps the four states DISTINCT and leaks no secret.
    const connectivity = await runHebyReadCommand({ commandId: "connectivity", args: [], route: "/platform" }, deps);
    assert.equal(connectivity.status, "ok");
    if (connectivity.status === "ok") {
      const body = connectivity.result.lines.join("\n");
      assert.ok(body.includes("Director permission: disabled"));
      assert.ok(body.includes("Configuration: configured"));
      assert.ok(body.includes("Credential: present"));
      assert.ok(body.includes("not-recorded"), "connectivity health is never invented");
      assert.ok(/four separate facts/i.test(body), "and the states are not collapsed");
      assert.ok(!/sk-[a-z0-9-]{6,}/i.test(body), "no key-shaped value");
    }

    // /security reports the ABSENCE of a feed as the finding it is.
    const security = await runHebyReadCommand({ commandId: "security", args: [], route: "/governance" }, deps);
    assert.equal(security.status, "ok");
    if (security.status === "ok") {
      const body = security.result.lines.join("\n");
      assert.ok(/No live security feed is connected/i.test(body), "it states there is no feed");
      assert.ok(/Findings: 0/.test(body), "and reports zero findings rather than inventing one");
      assert.ok(/incident-feed/.test(body), "the not-connected classes are named");
      // Honest DENIALS legitimately contain words like "attack" and "breach", so the guard targets
      // AFFIRMATIVE claims instead — the shapes that would assert something Hebun cannot know.
      assert.ok(
        !/\b(detected|under attack|active (attack|threat|incident)|compromised|breach confirmed|ongoing (attack|intrusion))\b/i.test(body),
        "no affirmative threat claim",
      );
    }

    // Fail-closed gates: unauthenticated, unknown, non-read, and unavailable are all refused.
    const unauth = await runHebyReadCommand({ commandId: "status", args: [], route: "/operations" }, { ...deps, resolveTenant: async () => null });
    assert.equal(unauth.status, "unauthorized");
    for (const [commandId, reason] of [["nope", "unknown-command"], ["summary", "not-a-read-command"], ["run", "not-a-read-command"], ["incidents", "not-available"]] as const) {
      const refused = await runHebyReadCommand({ commandId, args: [], route: "/operations" }, deps);
      assert.equal(refused.status, "rejected", `${commandId} is refused`);
      if (refused.status === "rejected") assert.equal(refused.reason, reason);
    }
  }

  /* ── 30. R2E: an advisory command is a PROMPT, not a bypass ───────────────── */
  {
    // The planner produces only a prompt — it selects no transport, reads no Director permission,
    // and carries no provider instruction. The kill-switch therefore still runs where it always
    // has: inside the existing answer flow, which the R2E suite proves separately.
    const advisory = plan("summary");
    assert.equal(advisory.kind, "advisory");
    if (advisory.kind === "advisory") {
      assert.ok(!/transport|provider|api|key|director/i.test(advisory.prompt), "the prompt asks for nothing operational");
    }
    // And every advisory command declares that it is safe while the provider is off.
    for (const command of HEBY_COMMANDS.filter((c) => c.kind === "advisory")) {
      assert.equal(command.safeWhenProviderOff, true, `${command.slash} degrades honestly when the Director is off`);
      assert.equal(command.requiresExecution, false, `${command.slash} executes nothing`);
    }
  }

  /* ── The parser and the planner agree end to end ──────────────────────────── */
  {
    const parsed = parseHebyInput("/go platform");
    assert.equal(parsed.kind, "command");
    if (parsed.kind === "command") {
      const result = planHebyCommand(parsed.command, parsed.args, CONTEXT);
      assert.equal(result.kind, "navigate");
      if (result.kind === "navigate") assert.equal(result.route, "/platform");
    }
  }

  console.log("s1 dispatch + availability + read flow passed");
}

void main();
