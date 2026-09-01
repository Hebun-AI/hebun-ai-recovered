"use client";

/*
 * use-heby-conversation.ts — THE Heby conversation seam shared by BOTH presentation surfaces (HW3).
 *
 * Heby has two surfaces (Quick Panel and Full Workspace) and exactly ONE conversation. This hook is
 * that one conversation, extracted so the two surfaces cannot drift apart:
 *
 *   ONE dispatch site        `askHebyAction` is called in exactly one place, in this file.
 *   ONE submission gate      every submission from either surface is parsed here first.
 *   ONE detach primitive     `/new`, `/clear` and the New Conversation control share it.
 *   ONE transcript authority the durable server conversation. Optimistic state is ephemeral only.
 *   ONE persistence pointer  a single localStorage key, derived from the SERVER-resolved route.
 *
 * There is no `quick_panel_conversations`, no workspace-only message store, and no second
 * synchronization mechanism. Continuity between the surfaces is not a feature that was built — it
 * falls out of the architecture: both surfaces resolve the same workspace to the same canonical
 * route through the same closed registry, so they key the same durable conversation. Nothing is
 * copied between them and nothing is duplicated.
 *
 * The client sends only { prompt, route, conversationId } — never a tenant, identity, role,
 * credential, or authority. The route was resolved through the workspace allow-list, and the server
 * re-resolves it again, so nothing the client says can widen what Heby may read.
 *
 * SLASH COMMANDS ARE APPLICATION CONTROLS, NOT PROMPTS. Every submission passes through the single
 * parser before anything else. Anything beginning with "/" is handled locally and returns before the
 * server action is reached, so `/help`, `/new`, `/clear`, `/context`, `/sources` and any unknown
 * command make ZERO model requests.
 *
 * THIS SEAM EXECUTES NOTHING: no tool, no approval, no device, no browser, no shell. Its ONLY
 * crossings are the Heby server action modules.
 *
 * R3A.1 REPAIRED THE WORD "MUTATION" IN THIS SENTENCE, which used to be in that list. A `/send`
 * proposal really does write one row — a pending action request — so claiming "no mutation" became
 * false the moment it shipped. What stays true, and is the distinction that matters, is that the
 * write goes into the PENDING-REVIEW QUEUE and never into the world: no approval, no permit, no
 * execution, and no external effect. A human decides in /approvals.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  askHebyAction,
  loadHebyConversationAction,
  proposeHebyActionCommandAction,
  runHebyReadCommandAction,
  runHebyProviderReadCommandAction,
  runHebyCrossSourceCommandAction,
} from "@/app/(dashboard)/heby/actions";
import {
  findHebyCommandById,
  matchHebyCommands,
  parseHebyInput,
  planHebyCommand,
  unknownCommandLines,
  type CommandCapabilityView,
  type HebyCommandDescriptor,
  type HebyCommandResult,
  type HebySurfaceKind,
} from "@/features/heby-commands";
import { buildConversationSuggestions, deriveLatestProvenance, type ProvenanceBadge } from "./heby-provenance";
import { buildTurns, type LatestTurn } from "./heby-thread";
import type { HebyTurnView } from "./heby-turns";
import type { HebyPresenceState } from "./heby-visualizer";

type LoadResult = Awaited<ReturnType<typeof loadHebyConversationAction>>;
type DurableMessage = Extract<LoadResult, { status: "loaded" }>["view"]["messages"][number];

/**
 * Local, ephemeral output of a slash command. NEVER a Heby message and never durable. It carries
 * its own provenance, so a deterministic local or read result is never presented as something the
 * model generated.
 */
export type HebyCommandOutput = HebyCommandResult;

/**
 * The sparse peripheral facts. Every field is optional BY DESIGN: a value is present only when an
 * authoritative source produced one, and the surfaces render nothing for the rest.
 */
export interface HebyConversationFacts {
  /** Number of evidence references behind the latest answer. Undefined until an answer exists. */
  readonly evidenceCount?: number;
  /** Truthful provenance of the latest answer. Undefined until an answer exists. */
  readonly latestProvenance?: ProvenanceBadge;
}

/**
 * localStorage key for the durable conversation in a given Heby context. Keyed by the SERVER-
 * resolved canonical route, which is why the Quick Panel on Operations and the Full Workspace
 * opened from Operations continue the SAME durable conversation without any transfer mechanism.
 */
function conversationKey(route: string): string {
  return `heby:conversation:${route}`;
}

interface ConversationSession {
  /** The context route this session belongs to. A different context starts empty. */
  readonly key: string;
  readonly conversationId: string | null;
  readonly messages: readonly DurableMessage[];
  readonly latest: LatestTurn | null;
  readonly pending: string | null;
  readonly notice: { readonly tone: "warn"; readonly text: string } | null;
  readonly commandOutput: HebyCommandOutput | null;
  readonly composer: string;
  /** False once the surface has proven it cannot take a question (not signed in). */
  readonly available: boolean;
}

function emptySession(key: string): ConversationSession {
  return {
    key,
    conversationId: null,
    messages: [],
    latest: null,
    pending: null,
    notice: null,
    commandOutput: null,
    composer: "",
    available: true,
  };
}

export interface UseHebyConversationInput {
  /** Context route, resolved through the workspace allow-list. The client never invents one. */
  readonly contextRoute: string;
  readonly contextLabel: string;
  /** The honest `/context` body for this context. */
  readonly contextDetail: readonly string[];
  /**
   * HEBY-CAP1 — server-composed command capability for this tenant. OPTIONAL: a surface that
   * resolves no tenant server-side supplies nothing, and `/help` then renders UNKNOWN rather than
   * falling back to the registry's release-time claim.
   */
  readonly capabilityView?: CommandCapabilityView;
  /** Which surface this seam is driving. Affects command PRESENTATION only. */
  readonly surface: HebySurfaceKind;
  /** Where the Full Workspace returns to, for `/close` copy. */
  readonly returnLabel?: string;
  /** Close the active Heby surface (`/close`). Presentation only — it ends no conversation. */
  readonly onCloseSurface?: () => void;
  /**
   * Move to a route the PURE planner resolved from the closed workspace registry (`/go`). The
   * planner never emits a caller-supplied string here, so this cannot become an open redirect.
   */
  readonly onNavigate?: (route: string) => void;
}

/** Everything a Heby presentation surface needs. Values only — no authority is handed out. */
export interface HebyConversationModel {
  readonly turns: readonly HebyTurnView[];
  readonly pending: string | null;
  /** A MODEL request is in flight. Drives the presence field and the "responding" turn. */
  readonly asking: boolean;
  /**
   * The seam is busy with anything — a model request or a server read. Only the composer's disabled
   * state uses this; presence never does, because a read is not a model call.
   */
  readonly busy: boolean;
  readonly presence: HebyPresenceState;
  readonly notice: { readonly tone: "warn"; readonly text: string } | null;
  readonly commandOutput: HebyCommandOutput | null;
  readonly facts: HebyConversationFacts;
  readonly composerValue: string;
  readonly suggestions: readonly string[];
  readonly paletteItems: readonly HebyCommandDescriptor[];
  readonly paletteIndex: number;
  readonly onComposerChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onNewConversation: () => void;
  readonly onSuggestion: (value: string) => void;
  readonly onPaletteMove: (delta: number) => void;
  /** Select a palette entry by command id. Commands needing arguments are typed in, not run. */
  readonly onPaletteSelect: (commandId: string) => void;
  readonly onPaletteClose: () => void;
  readonly onDismissCommandOutput: () => void;
}

export function useHebyConversation(input: UseHebyConversationInput): HebyConversationModel {
  const { contextRoute, contextLabel, contextDetail, capabilityView, surface, onCloseSurface, onNavigate } =
    input;
  const returnLabel = input.returnLabel ?? "your workspace";

  const [raw, setRaw] = useState<ConversationSession>(() => emptySession(contextRoute));
  const [asking, setAsking] = useState(false);
  /**
   * A server READ is in flight. Deliberately SEPARATE from `asking`: a read is not a model request,
   * so it must not drive the presence field into "responding", which is a claim about the model.
   */
  const [reading, setReading] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  // Escape closes the palette without destroying what the operator typed.
  const [paletteDismissed, setPaletteDismissed] = useState(false);
  // Context-scoped derivation: a different context resets the session WITHOUT an effect.
  const session = raw.key === contextRoute ? raw : emptySession(contextRoute);

  const patch = useCallback(
    (next: Partial<ConversationSession>) =>
      setRaw((prev) => {
        const base = prev.key === contextRoute ? prev : emptySession(contextRoute);
        return { ...base, key: contextRoute, ...next };
      }),
    [contextRoute],
  );

  // Restore the durable conversation for this context. Only ASYNC setState — the derived `session`
  // already handles the reset, so the effect body writes no state synchronously.
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(conversationKey(contextRoute)) : null;
    if (!stored) return;
    let active = true;
    loadHebyConversationAction({ conversationId: stored }).then((result) => {
      if (!active) return;
      if (result.status === "loaded") {
        setRaw({
          ...emptySession(contextRoute),
          conversationId: result.view.conversationId,
          messages: result.view.messages,
        });
      } else {
        if (typeof window !== "undefined") window.localStorage.removeItem(conversationKey(contextRoute));
        setRaw(emptySession(contextRoute));
      }
    });
    return () => {
      active = false;
    };
  }, [contextRoute]);

  /*
   * THE single detach primitive. Both the "New conversation" control and the `/new` and `/clear`
   * commands call THIS — there is no second code path and no second meaning. It drops the local
   * conversation pointer and clears the view; the durable conversation is NOT deleted, so the next
   * message simply starts a fresh server-owned conversation. No delete authority exists here.
   */
  const detachConversation = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(conversationKey(contextRoute));
    setRaw(emptySession(contextRoute));
  }, [contextRoute]);

  /** Evidence for `/sources`: the SERVER-returned evidence of the latest response, or nothing. */
  const evidenceLines = useMemo(
    () => (session.latest?.response.evidence ?? []).map((item) => `${item.sourceClass} · ${item.recordRef}`),
    [session.latest],
  );

  /** A local refusal block. Used for input that is not a command and must never become a prompt. */
  const refusal = (command: string, title: string, lines: readonly string[]): HebyCommandResult => ({
    command,
    title,
    lines,
    tone: "unavailable",
    provenance: "Local — nothing was sent, run, or interpreted.",
  });

  /*
   * THE single submission gate, shared by both surfaces.
   *
   * Parse first, PLAN second, dispatch last. Every "/"-prefixed input is classified by the one
   * parser and then resolved by the one pure planner, and only a `prompt` — either ordinary typed
   * text or the prompt an ADVISORY command's plan produced — can reach `askHebyAction`. Local,
   * read, navigation, reserved, unknown, malformed and shell-shaped input all return before it,
   * so none of them has any path to a provider.
   */
  async function submitInput(override?: string): Promise<void> {
    if (asking || reading) return;
    const parsed = parseHebyInput(override ?? session.composer);

    if (parsed.kind === "empty") return;

    if (parsed.kind === "unknown-command") {
      patch({
        composer: "",
        commandOutput: refusal(parsed.typed, "Unknown command", unknownCommandLines(parsed.typed)),
      });
      return;
    }
    if (parsed.kind === "invalid-arguments") {
      patch({
        composer: "",
        commandOutput: refusal(parsed.command.slash, "Wrong arguments", [parsed.message, "Nothing was sent."]),
      });
      return;
    }
    if (parsed.kind === "unsafe-input") {
      patch({
        composer: "",
        commandOutput: refusal(parsed.typed, "Refused", [parsed.message]),
      });
      return;
    }

    /** The ONE prompt variable. It is set on exactly two paths, and nothing else can fill it. */
    let prompt: string;

    if (parsed.kind === "command") {
      const plan = planHebyCommand(parsed.command, parsed.args, {
        surface,
        contextLabel,
        contextDetail,
        capabilityView,
        evidenceLines,
        returnLabel,
      });

      switch (plan.kind) {
        case "local":
        case "unavailable":
          patch({ composer: "", commandOutput: plan.result });
          return;
        case "detach":
          detachConversation();
          setRaw((prev) => ({
            ...emptySession(contextRoute),
            key: contextRoute,
            available: prev.available,
            commandOutput: plan.result,
          }));
          return;
        case "close":
          patch({ composer: "" });
          onCloseSurface?.();
          return;
        case "navigate":
          patch({ composer: "", commandOutput: plan.result });
          onNavigate?.(plan.route);
          return;
        case "read": {
          // A server READ. It reaches no provider: the read action imports no model client and
          // never selects a transport.
          patch({
            composer: "",
            commandOutput: {
              command: parsed.command.slash,
              title: "Reading…",
              lines: ["Reading Hebun's current read models. No model request is made."],
              tone: "info",
              provenance: "Read in progress.",
            },
          });
          setReading(true);
          try {
            const read = await runHebyReadCommandAction({
              commandId: plan.commandId,
              args: plan.args,
              route: contextRoute,
              conversationId: session.conversationId ?? undefined,
            });
            if (read.status === "ok") {
              patch({ commandOutput: read.result });
            } else if (read.status === "unauthorized") {
              patch({
                commandOutput: refusal(parsed.command.slash, "Sign in required", [
                  "Sign in to read this.",
                ]),
                available: false,
              });
            } else {
              patch({
                commandOutput: refusal(parsed.command.slash, "Not available", [
                  `That command could not be run (${read.reason}). Nothing was read.`,
                ]),
              });
            }
          } finally {
            setReading(false);
          }
          return;
        }
        case "provider-read": {
          /*
           * INT-5B1. The ONE branch in this hook that can result in Hebun contacting a third party.
           *
           * It is a SEPARATE action from the read one, so a read has no way to acquire external
           * reach by an edit here, and the placeholder says plainly what is about to happen —
           * a reader must never discover after the fact that a command left the building.
           *
           * Every line rendered below is server data. The client composes no sentence about what
           * GitHub holds, and it never turns a refusal or a fault into an empty list.
           */
          /*
           * INT-5B2. The placeholder is PER COMMAND, because two provider-read commands ask GitHub
           * for different things and a reader must be told which one is happening. A single
           * sentence covering both would describe neither, and telling somebody Hebun is listing
           * repositories while it reads their pull requests is a small lie with no upside.
           */
          patch({
            composer: "",
            commandOutput: {
              command: parsed.command.slash,
              title: "Reading from GitHub…",
              lines:
                plan.commandId === "pull-requests"
                  ? [
                      "Asking GitHub which repositories your installation covers, then what is open in them.",
                      "Metadata only — titles, numbers, authors and timestamps. No diff, no file, no comment.",
                      "Reads only. Nothing is changed, sent or stored.",
                    ]
                  : [
                      "Asking GitHub for one bounded page of the repositories your installation covers.",
                      "Reads only. Nothing is changed, sent or stored.",
                    ],
              tone: "info",
              provenance: "Provider read in progress.",
            },
          });
          setReading(true);
          try {
            const outcome = await runHebyProviderReadCommandAction({
              commandId: plan.commandId,
              args: plan.args,
            });
            if (outcome.status === "ok") {
              patch({ commandOutput: outcome.result });
            } else if (outcome.status === "unauthorized") {
              patch({
                commandOutput: refusal(parsed.command.slash, "Sign in required", [
                  "Sign in to read this.",
                ]),
                available: false,
              });
            } else {
              patch({
                commandOutput: refusal(parsed.command.slash, "Not available", [
                  `That command could not be run (${outcome.reason}). No provider was contacted.`,
                ]),
              });
            }
          } finally {
            setReading(false);
          }
          return;
        }
        case "cross-source-read": {
          /*
           * INT-5C. The second branch that can result in Hebun contacting a third party, and the
           * only one that also reads the organization's own declarations.
           *
           * It is a SEPARATE action from the provider-read one, so `/repositories` cannot acquire a
           * Knowledge read by an edit here and this command cannot lose its Knowledge half by one
           * either. The placeholder says BOTH halves out loud before either happens — a reader must
           * never discover after the fact what a command consulted.
           *
           * Every line rendered below is server data. The client composes no sentence about what
           * GitHub holds or about what the organization declared, it never turns a refusal or a
           * fault into an empty list, and it never turns an unavailable Knowledge lookup into
           * "no declaration recorded".
           */
          patch({
            composer: "",
            commandOutput: {
              command: parsed.command.slash,
              title: "Reading GitHub and your declarations…",
              lines: [
                "Asking GitHub for one bounded page of the repositories your installation covers.",
                "Then asking your organization's own records which of those repositories it has " +
                  "recorded a Knowledge relationship for.",
                "Reads only. Nothing is changed, sent or stored, and no Knowledge is written.",
              ],
              tone: "info",
              provenance: "Cross-source read in progress.",
            },
          });
          setReading(true);
          try {
            const outcome = await runHebyCrossSourceCommandAction({
              commandId: plan.commandId,
              args: plan.args,
            });
            if (outcome.status === "ok") {
              patch({ commandOutput: outcome.result });
            } else if (outcome.status === "unauthorized") {
              patch({
                commandOutput: refusal(parsed.command.slash, "Sign in required", [
                  "Sign in to read this.",
                ]),
                available: false,
              });
            } else {
              patch({
                commandOutput: refusal(parsed.command.slash, "Not available", [
                  `That command could not be run (${outcome.reason}). No provider was contacted and ` +
                    "nothing was read.",
                ]),
              });
            }
          } finally {
            setReading(false);
          }
          return;
        }
        case "propose": {
          /*
           * R3A.1. A durable action proposal. Like `read`, it reaches no provider — the propose
           * action imports no model client. Unlike `read`, it writes: one pending request that a
           * human decides on in /approvals.
           *
           * Every line below is runtime data or a fixed sentence. Heby never says approved,
           * authorized, sent, scheduled or successful about a proposal, because filing one moves no
           * authority whatsoever.
           */
          patch({
            composer: "",
            commandOutput: {
              command: parsed.command.slash,
              title: "Preparing…",
              lines: ["Resolving the recipient and the draft. Nothing is sent."],
              tone: "info",
              provenance: "Preparation in progress.",
            },
          });
          setReading(true);
          try {
            const outcome = await proposeHebyActionCommandAction({
              commandId: plan.commandId,
              args: plan.args,
            });
            if (outcome.status === "unauthorized") {
              patch({
                commandOutput: refusal(parsed.command.slash, "Sign in required", [
                  "Sign in to prepare an action.",
                ]),
                available: false,
              });
            } else if (outcome.status === "refused") {
              patch({
                commandOutput: refusal(parsed.command.slash, "Not available", [
                  `That command could not be prepared (${outcome.reason}). Nothing was filed.`,
                ]),
              });
            } else if (outcome.result.status === "proposed") {
              const { receipt } = outcome.result;
              patch({
                commandOutput: {
                  command: parsed.command.slash,
                  title: "Prepared for Director approval",
                  lines: [
                    `Request ${receipt.requestId}`,
                    `Action: ${receipt.actionKind}`,
                    `Recipient: ${receipt.recipientLabel} (${receipt.recipientRef})`,
                    `Draft: ${receipt.draftTitle} (${receipt.draftRef})`,
                    "Status: pending review",
                    "Nothing was sent. A human decides in /approvals.",
                  ],
                  tone: "info",
                  provenance: "Durable action request — pending Director review.",
                },
              });
            } else {
              patch({
                commandOutput: refusal(parsed.command.slash, "Not prepared", [
                  outcome.result.detail,
                ]),
              });
            }
          } finally {
            setReading(false);
          }
          return;
        }
        case "advisory":
          // The ONLY branch that produces a prompt from a command.
          prompt = plan.prompt;
          break;
      }
    } else {
      // Ordinary conversational text.
      prompt = parsed.prompt;
    }

    patch({ pending: prompt, composer: "", notice: null, commandOutput: null });
    setAsking(true);
    try {
      const prior =
        session.conversationId ??
        (typeof window !== "undefined"
          ? window.localStorage.getItem(conversationKey(contextRoute)) ?? undefined
          : undefined);
      // The ONLY client-crossing payload: prompt + allow-listed route + opaque conversation id.
      const result = await askHebyAction({ prompt, route: contextRoute, conversationId: prior });
      if (result.status === "answered") {
        const durable = result.persistence.durable;
        if (durable) {
          const id = result.persistence.conversationId;
          if (typeof window !== "undefined") window.localStorage.setItem(conversationKey(contextRoute), id);
          const reload = await loadHebyConversationAction({ conversationId: id });
          const messages = reload.status === "loaded" ? reload.view.messages : session.messages;
          patch({
            conversationId: id,
            messages,
            latest: { userText: prompt, response: result.outcome.response, durable: true },
            pending: null,
          });
        } else {
          patch({
            latest: { userText: prompt, response: result.outcome.response, durable: false },
            pending: null,
          });
        }
      } else if (result.status === "rejected") {
        patch({ notice: { tone: "warn", text: `That question can’t be sent (${result.reason}).` }, pending: null });
      } else {
        patch({
          notice: { tone: "warn", text: "Sign in to ask Heby a question." },
          pending: null,
          available: false,
        });
      }
    } finally {
      setAsking(false);
    }
  }

  const turns = useMemo(() => buildTurns(session.messages, session.latest), [session.messages, session.latest]);
  const suggestions = useMemo(() => buildConversationSuggestions(contextLabel), [contextLabel]);
  const paletteItems = useMemo(
    () => (paletteDismissed ? [] : matchHebyCommands(session.composer)),
    [paletteDismissed, session.composer],
  );

  // Presence is derived from REAL state only: an in-flight request, actual composer content, or a
  // proven unavailable surface. Nothing here runs on a timer or simulates activity.
  const presence: HebyPresenceState = !session.available
    ? "unavailable"
    : asking
      ? "responding"
      : session.composer.trim().length > 0
        ? "composing"
        : "idle";

  const boundedIndex = paletteItems.length === 0 ? 0 : Math.min(paletteIndex, paletteItems.length - 1);

  /*
   * The sparse peripheral facts. BOTH fields come from the server's own latest response and are
   * simply ABSENT until one exists — no placeholder, no dash, no zero. There is deliberately no
   * health, memory, reasoning, agent, event or approval figure here: no authoritative read seam
   * exists for any of them, so the surfaces say nothing rather than something plausible.
   */
  const facts: HebyConversationFacts = useMemo(() => {
    const latest = session.latest;
    if (!latest) return {};
    return {
      evidenceCount: latest.response.evidence.length,
      latestProvenance: deriveLatestProvenance(latest.response),
    };
  }, [session.latest]);

  return {
    turns,
    pending: session.pending,
    asking,
    busy: asking || reading,
    presence,
    notice: session.notice,
    commandOutput: session.commandOutput,
    facts,
    composerValue: session.composer,
    suggestions,
    paletteItems,
    paletteIndex: boundedIndex,
    onComposerChange: (value: string) => {
      setPaletteIndex(0);
      setPaletteDismissed(false);
      patch({ composer: value });
    },
    onSubmit: () => void submitInput(),
    onNewConversation: detachConversation,
    onSuggestion: (suggestion: string) => void submitInput(suggestion),
    onPaletteMove: (delta: number) =>
      setPaletteIndex((index) => {
        const count = paletteItems.length;
        if (count === 0) return 0;
        return (Math.min(index, count - 1) + delta + count) % count;
      }),
    /*
     * Selecting a command that NEEDS arguments types it into the composer instead of running it —
     * running it would only produce a "wrong arguments" refusal. Everything else runs immediately.
     */
    onPaletteSelect: (commandId: string) => {
      const command = findHebyCommandById(commandId);
      if (command && command.args.some((argument) => argument.required)) {
        setPaletteDismissed(true);
        patch({ composer: `${command.slash} ` });
        return;
      }
      void submitInput(`/${commandId}`);
    },
    onPaletteClose: () => setPaletteDismissed(true),
    onDismissCommandOutput: () => patch({ commandOutput: null }),
  };
}
