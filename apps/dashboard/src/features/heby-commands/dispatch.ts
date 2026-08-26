/*
 * heby-commands/dispatch.ts — THE dispatch planner (S1). One pure function decides what a parsed
 * command does; the surfaces only execute the plan.
 *
 * THIS IS WHERE "A COMMAND CANNOT GRANT ITSELF AUTHORITY" IS ENFORCED. The planner branches on the
 * command's declared `kind`, and only the `advisory` branch can produce a `prompt`. Every other
 * branch returns a plan that carries no prompt at all — so a local, read, navigation, reserved, or
 * unavailable command has no representation in which it could reach a MODEL, and only the one kind
 * that declares external reach (`provider-read`, INT-5B1) has a plan in which it could reach a
 * PROVIDER. Both facts are properties of the registry, not of this switch. Reserved commands
 * additionally return before anything else happens: no dispatch, no execution, and no fabricated
 * "plan of what would have happened", which would be a fabricated capability.
 *
 * Availability is checked BEFORE kind. A command that this repository has no source for is refused
 * with its own reason, whatever kind it claims to be.
 *
 * Pure: no React, no server, no I/O, no authority.
 */

import { HEBY_WORKSPACE_ROUTE } from "@/features/heby-surface";
import {
  HEBY_NAV_WORKSPACE_IDS,
  getHebyWorkspaceProfile,
  isHebyWorkspaceId,
} from "@/features/heby-integration";
import type {
  CommandCapabilityView,
  HebyCommandDescriptor,
  HebyCommandResult,
} from "./contracts";
import { HEBY_CATEGORY_LABELS, HEBY_PALETTE_COMMANDS } from "./registry";
import { buildAdvisoryPrompt } from "./advisory-prompts";
import { commandUsage } from "./parser";

/** Which Heby surface the command was typed on. Affects presentation only. */
export type HebySurfaceKind = "quick-panel" | "full-workspace";

/** Everything a LOCAL command needs, supplied by the caller so the planner stays pure. */
export interface HebyCommandContext {
  readonly surface: HebySurfaceKind;
  readonly contextLabel: string;
  /** The honest `/context` body, composed server-side. */
  readonly contextDetail: readonly string[];
  /** Evidence lines from the SERVER's latest response. Empty when there is no answer yet. */
  readonly evidenceLines: readonly string[];
  /** Where leaving the Full Workspace returns to. */
  readonly returnLabel: string;
  /**
   * HEBY-CAP1 — command capability, resolved SERVER-SIDE for this tenant.
   *
   * OPTIONAL, AND ITS ABSENCE IS MEANINGFUL. A surface that resolves no tenant server-side (the
   * Quick Panel) supplies nothing, and `/help` then renders UNKNOWN. It never falls back to the
   * registry's release-time field, because that fallback IS the defect this phase removed.
   */
  readonly capabilityView?: CommandCapabilityView;
}

/**
 * What the surface must do. Note what is absent: no plan except `advisory` carries a prompt, and no
 * plan at all carries a command, a URL, a script, or an action.
 */
export type HebyCommandPlan =
  /** Show a locally computed result. Nothing left the browser. */
  | { readonly kind: "local"; readonly result: HebyCommandResult }
  /** Detach the conversation (never delete), then show the result. */
  | { readonly kind: "detach"; readonly result: HebyCommandResult }
  /** Close the active Heby surface. Presentation only. */
  | { readonly kind: "close" }
  /** Move to a route resolved from the CLOSED workspace registry. Never a caller-supplied URL. */
  | { readonly kind: "navigate"; readonly route: string; readonly result: HebyCommandResult }
  /** Ask the server to perform a real read. Zero provider dispatch. */
  | {
      readonly kind: "read";
      readonly commandId: string;
      readonly handler: string;
      readonly args: readonly string[];
    }
  /**
   * Ask the server to read a bounded page of records from ONE connected external provider
   * (INT-5B1). This is the ONLY plan that can result in Hebun contacting a third party.
   *
   * It carries the same three fields `read` does and NOTHING else — no provider key, no tenant, no
   * installation, no account, no credential, no repository address. A command becomes a provider
   * read by declaring `kind: "provider-read"` in the registry and in no other way, so no handler
   * string and no later `case` can quietly acquire external reach. Like `read`, it carries no
   * prompt, so this plan has no representation in which it could reach a model.
   */
  | {
      readonly kind: "provider-read";
      readonly commandId: string;
      readonly handler: string;
      readonly args: readonly string[];
    }
  /**
   * Ask the server to run a CROSS-SOURCE read (INT-5C).
   *
   * It carries the same three fields the provider-read plan does and NOTHING else — no provider key,
   * no tenant, no installation, no repository address, and no Knowledge fact id. A command becomes a
   * cross-source read by declaring `kind: "cross-source-read"` in the registry and in no other way,
   * so no handler string and no later `case` can quietly acquire either half of its reach. Like
   * `read`, it carries no prompt, so this plan has no representation in which it could reach a model.
   */
  | {
      readonly kind: "cross-source-read";
      readonly commandId: string;
      readonly handler: string;
      readonly args: readonly string[];
    }
  /**
   * Ask the server to file a durable action proposal for a human to decide on (R3A.1).
   *
   * It carries the two references the operator typed and NOTHING else — no tenant, no actor, no
   * digest, no action kind. The action kind is fixed by the handler on the server side, so a client
   * cannot select what it is proposing, and the digests are derived from what the server reads.
   * Like `read`, it carries no prompt, so this plan has no representation in which it could reach a
   * model.
   */
  | {
      readonly kind: "propose";
      readonly commandId: string;
      readonly handler: string;
      readonly args: readonly string[];
    }
  /** The ONLY plan that can reach the model, and only through the existing answer path. */
  | { readonly kind: "advisory"; readonly prompt: string }
  /** Truthfully refused. No dispatch, no execution, no fabricated preview. */
  | { readonly kind: "unavailable"; readonly result: HebyCommandResult };

const LOCAL_PROVENANCE = "Local — Heby's own interface state. No model was used.";

function result(
  command: HebyCommandDescriptor,
  title: string,
  lines: readonly string[],
  provenance = LOCAL_PROVENANCE,
): HebyCommandResult {
  return { command: command.slash, title, lines, tone: "info", provenance };
}

/**
 * The refusal. It states WHY the command cannot run, using the registry's own reason, and it is
 * rendered in an unavailable tone so it can never be mistaken for a result.
 */
function refuse(command: HebyCommandDescriptor): HebyCommandResult {
  return {
    command: command.slash,
    title: command.label,
    lines: [
      command.unavailableReason ??
        "This command is not available because Hebun does not yet have an authoritative source for it.",
    ],
    tone: "unavailable",
    provenance:
      command.kind === "reserved"
        ? "Not available — no execution or approval runtime exists. Nothing was run."
        : "Not available — no authoritative source exists. Nothing was fabricated.",
  };
}

/** The `/help` body: what runs today, grouped, with the unavailable ones honestly labelled. */
/**
 * HEBY-CAP1 — the suffix `/help` puts after a command, and where it comes from.
 *
 * BEFORE THIS PHASE this read `command.availability === "available" ? "" : " — not available yet"`,
 * which is the registry's RELEASE-TIME field. Every tenant was therefore told the same thing, and a
 * tenant with no usable GitHub connection was told `/repositories` was available — then refused by
 * the seam that actually knows. That is Hebun asserting an organizational fact it never established.
 *
 * NOW the answer comes from the server-composed capability view, which is a projection of the
 * released authorities. This function decides NOTHING: it renders whichever of the four states the
 * projection resolved, and when the projection is absent it renders `unknown` rather than falling
 * back to the static field. Falling back would reintroduce the exact defect.
 */
function capabilitySuffix(
  command: HebyCommandDescriptor,
  view: CommandCapabilityView | undefined,
): string {
  const entry = view?.entries.find((e) => e.commandId === command.id);
  if (!entry) {
    /*
     * NO RESOLVED ANSWER — for example the Quick Panel, which resolves no tenant server-side.
     *
     * UNKNOWN IS NOT APPLIED INDISCRIMINATELY, BECAUSE THAT WOULD BE ITS OWN UNTRUTH. A RELEASE
     * fact is still known here: that `/run` is reserved and that a command shipped needing a source
     * are properties of the build, and no tenant answer could change either. Only the states a
     * runtime authority owns become UNKNOWN, and they are exactly the commands that DECLARED they
     * depend on one. This mirrors the projection's own ordering rather than restating its rules.
     */
    if (command.kind === "reserved") return "  — reserved, no execution runtime";
    if (command.availability !== "available") return "  — not available yet";
    if (command.reachesProvider === true || command.requiresModel === true) {
      return "  — availability UNKNOWN for your organization right now";
    }
    return "";
  }
  switch (entry.state) {
    case "available":
      return "";
    case "reserved":
      return "  — reserved, no execution runtime";
    case "unavailable":
      return `  — not available now: ${entry.reason}`;
    default:
      return `  — UNKNOWN, not denied: ${entry.reason}`;
  }
}

function helpLines(view: CommandCapabilityView | undefined): readonly string[] {
  const lines: string[] = [];
  for (const category of Object.keys(HEBY_CATEGORY_LABELS) as (keyof typeof HEBY_CATEGORY_LABELS)[]) {
    const commands = HEBY_PALETTE_COMMANDS.filter((command) => command.category === category);
    if (commands.length === 0) continue;
    lines.push(`${HEBY_CATEGORY_LABELS[category]}:`);
    for (const command of commands) {
      lines.push(`  ${commandUsage(command)} — ${command.description}${capabilitySuffix(command, view)}`);
    }
  }
  /*
   * THE STANDING OF THIS LIST, SAID OUT LOUD. A capability that can be attempted now may refuse a
   * second later, and a reader must not carry this away as a guarantee.
   */
  lines.push("");
  lines.push(
    view
      ? "Availability above was read for your organization just now from Hebun's own authorities. " +
          "It is a CURRENT READ, not a future guarantee — and being able to attempt something is " +
          "not the same as being authorized to do it, or as it succeeding."
      : "Availability could not be resolved for your organization here, so it is shown as UNKNOWN " +
          "rather than guessed. UNKNOWN means Hebun did not establish the answer — it does not mean no.",
  );
  return lines;
}

/** The workspaces `/go` accepts. A closed list: the seven navigable workspaces, plus Heby itself. */
export const HEBY_GO_TARGETS: readonly string[] = [...HEBY_NAV_WORKSPACE_IDS, "heby"];

/**
 * Resolve a `/go` target to a REAL route from the registry. Returns null for anything that is not
 * one of the known workspace identities — so an absolute URL, a protocol-relative URL, a
 * `javascript:` URI, a traversal, or any arbitrary path simply does not resolve and no navigation
 * happens. The route is read from the registry's own profile; the caller's text is never used as a
 * destination.
 */
export function resolveGoTarget(raw: string): { route: string; label: string } | null {
  const value = raw.trim().toLowerCase();
  if (value === "heby") return { route: HEBY_WORKSPACE_ROUTE, label: "Heby" };
  if (!isHebyWorkspaceId(value)) return null;
  if (!(HEBY_NAV_WORKSPACE_IDS as readonly string[]).includes(value)) return null;
  const profile = getHebyWorkspaceProfile(value);
  return { route: profile.defaultRoute, label: profile.label };
}

/**
 * Plan what a parsed command does. Total over the registry: every command resolves to exactly one
 * plan, and only advisory commands can produce a prompt.
 */
export function planHebyCommand(
  command: HebyCommandDescriptor,
  args: readonly string[],
  context: HebyCommandContext,
): HebyCommandPlan {
  // 1. RESERVED FIRST, and unconditionally. An execution-shaped command never reaches any other
  //    branch, whatever else it declares.
  if (command.kind === "reserved") {
    return { kind: "unavailable", result: refuse(command) };
  }

  // 2. Availability. No source, no capability — no run, and the operator is told which is missing.
  if (command.availability !== "available") {
    return { kind: "unavailable", result: refuse(command) };
  }

  /*
   * 3. PROPOSE, before the handler switch (R3A.1). Branching on the declared KIND rather than on
   *    the handler name is what keeps this closed: a command becomes a write by declaring
   *    `kind: "propose"` in the registry and in no other way, so no handler string and no later
   *    `case` can quietly acquire the ability to persist a proposal.
   *
   *    Every required argument must be present before the server is asked to do anything. A
   *    `/send` with a missing half is a usage error, and answering it locally means the server
   *    never opens a connection to discover that.
   */
  /*
   * 3. PROVIDER-READ, before the handler switch (INT-5B1), for the same reason `propose` is: the
   *    branch is reached by the declared KIND, so external reach is a registry property rather
   *    than a consequence of which `case` a handler happens to land in.
   *
   *    It is checked BEFORE `propose` and before the handler switch, and AFTER availability — a
   *    command with no source never causes a provider request, and a provider-read command can
   *    never fall through into the `read` branch at the bottom of this function.
   */
  if (command.kind === "provider-read") {
    return { kind: "provider-read", commandId: command.id, handler: command.handler, args };
  }

  /*
   * INT-5C. Checked beside the provider-read branch and for the same reason: a cross-source command
   * can never fall through into the `read` branch at the bottom of this function, and a command with
   * no source never causes either a provider request or a Knowledge query.
   */
  if (command.kind === "cross-source-read") {
    return { kind: "cross-source-read", commandId: command.id, handler: command.handler, args };
  }

  if (command.kind === "propose") {
    const refuseLocally = (lines: readonly string[]): HebyCommandPlan => ({
      kind: "unavailable",
      result: {
        command: command.slash,
        title: "Nothing was prepared",
        lines: [...lines, `Usage: ${commandUsage(command)}`],
        tone: "unavailable",
        provenance: LOCAL_PROVENANCE,
      },
    });

    const required = command.args.filter((argument) => argument.required);
    if (args.length < required.length) {
      return refuseLocally([
        "This command needs an exact reference for each argument. Nothing was prepared, and nothing was sent.",
      ]);
    }

    /*
     * SHAPE, NOT JUST COUNT. Dictation turns an ordinary sentence into "/send the invoice", which
     * has the right number of arguments and names nothing at all. Refusing that here means a spoken
     * or mistyped command never reaches a seam that could write a row — the check is local, pure,
     * and happens before any server call exists.
     */
    for (const [index, argument] of required.entries()) {
      const value = args[index] ?? "";
      if (argument.pattern && !argument.pattern.test(value)) {
        return refuseLocally([
          `"${value}" is not a ${argument.name} reference, so there is nothing to prepare.`,
          "An action must name records that already exist; approval happens in /approvals.",
        ]);
      }
    }

    return { kind: "propose", commandId: command.id, handler: command.handler, args };
  }

  switch (command.handler) {
    /* ── Conversation ─────────────────────────────────────────────────── */
    case "new":
      return {
        kind: "detach",
        result: result(command, "New conversation", [
          "Started a new conversation. Your earlier conversations are still saved.",
        ]),
      };
    case "clear":
      return {
        kind: "detach",
        result: result(command, "Cleared", [
          "Cleared this view and detached the current conversation.",
          "Nothing was deleted — your saved conversation history is intact.",
        ]),
      };
    case "help":
      return { kind: "local", result: result(command, "Heby commands", helpLines(context.capabilityView)) };
    case "close":
      return { kind: "close" };

    /* ── Context ──────────────────────────────────────────────────────── */
    case "context":
      return { kind: "local", result: result(command, "Current context", context.contextDetail) };
    case "sources":
      return {
        kind: "local",
        result: result(
          command,
          "Evidence behind the latest response",
          context.evidenceLines.length > 0
            ? context.evidenceLines
            : ["No evidence is available for the latest response."],
          "Evidence returned by the server with Heby's latest response. Not recomputed here.",
        ),
      };

    /* ── Navigation ───────────────────────────────────────────────────── */
    case "go": {
      const target = resolveGoTarget(args[0] ?? "");
      if (!target) {
        return {
          kind: "unavailable",
          result: {
            command: command.slash,
            title: "Unknown workspace",
            lines: [
              `“${args[0] ?? ""}” is not a Hebun workspace, so nothing was opened.`,
              `Workspaces: ${HEBY_GO_TARGETS.join(", ")}.`,
            ],
            tone: "unavailable",
            provenance: "Local — resolved against Hebun's own workspace registry. No navigation happened.",
          },
        };
      }
      return {
        kind: "navigate",
        route: target.route,
        result: result(command, `Opening ${target.label}`, [`Moved to ${target.label} (${target.route}).`]),
      };
    }

    /* ── Advisory — the ONLY branch that can produce a prompt ──────────── */
    default: {
      if (command.kind === "advisory") {
        const prompt = buildAdvisoryPrompt(command.handler, args);
        if (prompt === null) {
          return {
            kind: "unavailable",
            result: {
              command: command.slash,
              title: command.label,
              lines: [`${command.slash} needs ${command.args.map((a) => `<${a.name}>`).join(" and ")}. Nothing was sent.`],
              tone: "unavailable",
              provenance: "Local — the command was incomplete, so no request was made.",
            },
          };
        }
        return { kind: "advisory", prompt };
      }

      /*
       * Everything remaining is a READ: it is performed by the server against a real read model,
       * and it makes no provider request.
       *
       * That sentence is still exactly true after INT-5B1, and it is this function's ordering that
       * keeps it true: `provider-read` returned above, so a command that reaches outside Hebun can
       * never arrive here and be planned as a `read`.
       */
      return { kind: "read", commandId: command.id, handler: command.handler, args };
    }
  }
}
