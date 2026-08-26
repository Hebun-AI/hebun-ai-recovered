/*
 * heby-commands/contracts.ts — the type vocabulary of Heby's slash-command layer (S1).
 *
 * A slash command is an INTERACTION affordance. It is not an authority.
 *
 * A command may REQUEST a capability; it can never grant itself permission to use one. That rule is
 * expressed structurally here rather than left to discipline:
 *
 *   - `kind` fixes what a command is allowed to touch. Only `advisory` may reach the model at all,
 *     and the dispatch planner can only ever emit a model prompt for that kind.
 *   - `availability` states the truth about whether the command can run TODAY, and why not.
 *   - `requiresExecution` / `requiresCapability` / `requiresModel` describe what the command would
 *     need. Declaring a requirement never satisfies it.
 *
 * Pure types. No React, no I/O, no server, no authority.
 */

/**
 * What a command is permitted to do. These classes do not mix: a command has exactly one, and the
 * planner branches on it, so "a local command accidentally called the provider" is not a bug that
 * has to be caught — it is unrepresentable.
 *
 *   local         UI/conversation behaviour only.      ZERO provider dispatch.
 *   read          reads an existing authoritative or derived Hebun source, server-side.
 *                                                      ZERO provider dispatch, ZERO execution.
 *   provider-read reads a bounded page of records from ONE connected external provider, server-side
 *                 and tenant-scoped, after the integration capability authority has allowed it.
 *                 READ-ONLY external I/O, and nothing else — see below.
 *   cross-source-read
 *                 joins a bounded provider-read against the organization's own DURABLE declarations
 *                 about those same records. Provider I/O plus one writer-free Knowledge read, and
 *                 nothing else — see below.
 *   advisory      may reach the model through the EXISTING Heby answer path, with the existing
 *                 tenant, evidence, validator, kill-switch and persistence rules. Text only.
 *   navigation    moves within Hebun via the closed workspace registry. ZERO provider dispatch.
 *   reserved      a known future capability. Inert: it neither executes nor dispatches anything.
 */
/**
 * `provider-read` (INT-5B1) is the ONE class permitted to perform external provider I/O.
 *
 * IT IS A SIBLING OF `read`, NOT A WIDENING OF IT. `read` is permanently ZERO provider dispatch and
 * every existing read command keeps that guarantee; widening it would have removed the property
 * from ten commands that never needed it. This is the R3A.1 arrangement exactly — `propose` became
 * its own kind, with its own server module, so that "a read can never become a write by changing
 * one field". Here: a read can never become a provider call by changing one field.
 *
 * WHAT THE NAME MEANS, EXACTLY:
 *
 *   IT DOES mean   bounded, tenant-scoped, READ-ONLY external provider access, executed by the
 *                  server inside one explicit command contract with a declared record and call
 *                  budget, gated by the integration capability authority.
 *
 *   IT DOES NOT    a provider write · tool execution · agent execution · Governance authorization ·
 *      mean        Knowledge admission · general network access · a model request. None of those is
 *                  reachable from the provider-read server module, and a firewall walks the real
 *                  import graph to prove it rather than trusting this paragraph.
 *
 * A provider-read result is a PROVIDER-DERIVED OBSERVATION: non-authoritative, ephemeral, never
 * persisted, and never promotable into organizational Knowledge.
 */
/**
 * `cross-source-read` (INT-5C) reads a provider page and asks the organization's own records what it
 * has DECLARED about those same provider records.
 *
 * IT IS A SIBLING OF `provider-read`, NOT A WIDENING OF IT — the third time this repository makes
 * that move, after `propose` (R3A.1) and `provider-read` (INT-5B1). `provider-read` keeps its
 * property that no Knowledge module of any kind is reachable from it, and INT-5B1's firewall over
 * that root is untouched: widening it would have removed a guarantee from a command that never
 * needed one. A provider read can never acquire a Knowledge read by changing one field, because the
 * kinds do not mix and the planner branches on the kind.
 *
 * WHAT THE NAME MEANS, EXACTLY:
 *
 *   IT DOES mean   the released bounded provider read, plus ONE batched, tenant-scoped, read-only
 *                  lookup of the organization's own human-declared external references, joined in
 *                  memory on the provider's immutable record id.
 *
 *   IT DOES NOT    a Knowledge write · a Knowledge admission · Knowledge WORDING · a provider write ·
 *      mean        a model request · an inferred relationship · persistence of anything. None is
 *                  reachable from the cross-source server module, and a firewall walks the real
 *                  import graph to prove it rather than trusting this paragraph.
 *
 * THE JOIN IS EXACT AND DETERMINISTIC. It is SQL equality on `(provider_key, capability,
 * record_type, record_id)` — the provider's own identifier — and never a name comparison, a
 * similarity score, or anything a model produced. The relationship it reports was authored by a
 * human; this command only finds it.
 *
 * A cross-source result carries TWO standings and never merges them: the provider half stays a
 * non-authoritative ephemeral observation, and the Knowledge half is authoritative only for the
 * fact that the organization recorded the relationship.
 */
/**
 * `propose` (R3A.1) files a durable action request for a human to decide on. It is NOT execution
 * and it is deliberately not `reserved`: a reserved command dispatches nothing, while a proposal
 * really does write a row — it just writes it into the pending-review queue rather than into the
 * world. The separate kind exists so a `read` can never become a write by changing one field, and
 * so the planner can refuse to give a proposal a model prompt.
 */
export type HebyCommandKind =
  | "local"
  | "read"
  | "provider-read"
  | "cross-source-read"
  | "advisory"
  | "navigation"
  | "propose"
  | "reserved";

/** Palette grouping. Presentation only — it grants nothing. */
export type HebyCommandCategory =
  | "conversation"
  | "context"
  | "analyze"
  | "navigate"
  | "security"
  | "knowledge"
  | "platform"
  | "agents"
  /* R3A.1 — commands that FILE a proposal for a human to decide on. Never execution. */
  | "actions"
  | "future";

/**
 * Whether the command can run today, and — when it cannot — WHY. The distinction matters: a command
 * blocked for want of a data source is a different promise from one blocked for want of an
 * execution runtime, and the operator is told which.
 *
 *   available            it runs now.
 *   requires-source      no authoritative/derived Hebun source exists for it yet.
 *   requires-capability  it needs a capability no installed integration provides.
 *   requires-execution   it needs Hebun's execution/approval runtime, which does not exist.
 */
export type HebyCommandAvailability =
  | "available"
  | "requires-source"
  | "requires-capability"
  | "requires-execution";

/** One positional argument. Deliberately minimal: this is not a shell. */
export interface HebyCommandArgument {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
  /**
   * The exact shape this argument must have, checked by the PLANNER before any server call.
   *
   * Added by R3A.1 for a specific reason. A `propose` command writes a durable row, and counting
   * arguments is not enough to decide whether to ask the server for one: "/send the invoice" —
   * which is what dictation produces from an ordinary sentence — supplies two arguments and neither
   * one names anything. Without a shape check the planner would happily open a database connection
   * to discover that.
   *
   * Local, pure, and total: a pattern that does not match refuses in the browser, so a spoken or
   * mistyped command never reaches a write seam at all.
   */
  readonly pattern?: RegExp;
}

export interface HebyCommandDescriptor {
  /** Stable identity. Handlers switch on this, never on the typed text. */
  readonly id: string;
  /** What the operator types, including the leading slash. */
  readonly slash: string;
  readonly label: string;
  /** One honest line. It must not imply a capability the command does not have. */
  readonly description: string;
  readonly category: HebyCommandCategory;
  readonly kind: HebyCommandKind;
  readonly availability: HebyCommandAvailability;
  /** Positional arguments, in order. Empty for most commands. */
  readonly args: readonly HebyCommandArgument[];
  /**
   * The handler identity. Aliases share a handler with their canonical command, so an alias can
   * never drift into a second implementation of the same behaviour.
   */
  readonly handler: string;
  /** True only for `advisory`. Enforced by a registry invariant. */
  readonly requiresModel: boolean;
  /**
   * True exactly for `provider-read`. Enforced by a registry invariant (INT-5B1).
   *
   * Declaring it never grants it: the capability authority still decides, per tenant, on every
   * call. This field exists so that "which commands can reach outside Hebun at all" is a question
   * answerable from the registry alone, without walking an import graph.
   */
  readonly reachesProvider?: boolean;
  /** True only for `reserved`. Enforced by a registry invariant. */
  readonly requiresExecution: boolean;
  /** A capability id this command would need from a future capability provider, if any. */
  readonly requiresCapability?: string;
  /**
   * Whether the command still behaves correctly while the Director has provider connectivity OFF.
   * Every non-advisory command is; advisory commands are too, because they degrade to the existing
   * deterministic answer rather than failing.
   */
  readonly safeWhenProviderOff: boolean;
  /** The canonical command this one is an alias of. Aliases stay out of the palette. */
  readonly aliasOf?: string;
  /**
   * Why this command is unavailable, in the operator's words. Required whenever availability is not
   * "available" — an unavailable command must always be able to say why.
   */
  readonly unavailableReason?: string;
}

/**
 * The result of a command that did NOT come from the model. It is rendered as a command result, not
 * as a Heby turn, and it carries its own provenance line — so a deterministic local read is never
 * presented as something Heby generated.
 */
export interface HebyCommandResult {
  /** The command that produced this, e.g. "/context". */
  readonly command: string;
  readonly title: string;
  readonly lines: readonly string[];
  /** `unavailable` renders in a restrained warning tone; it never looks runnable. */
  readonly tone: "info" | "unavailable";
  /** Where this came from. Never "generated" and never a claim of authority. */
  readonly provenance: string;
}

/**
 * A capability provider's contribution seam (S1 designs it; nothing loads through it yet).
 *
 * A future Integration, agent, or Marketplace item declares commands as DESCRIPTORS — the same
 * shape the built-in registry uses — so the parser, the palette, and the dispatch planner never
 * need to change to accept them. What a provider can NEVER do is grant itself authority: a
 * contributed descriptor still has to declare a `kind`, and a contributed `reserved`/execution
 * command stays inert until a real execution runtime and authority check exist to back it.
 *
 * Deliberately not implemented: there is no loader, no dynamic import, no registration call. This
 * is the shape a later phase fills, not a mechanism S1 ships.
 */
export interface HebyCommandProvider {
  /** Stable provider identity, e.g. an integration or marketplace item id. */
  readonly providerId: string;
  readonly label: string;
  /** The commands this provider would contribute. */
  readonly commands: readonly HebyCommandDescriptor[];
}
