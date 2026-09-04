/*
 * heby-commands/command-capability-projection.server.ts — HEBY-CAP1. WHAT CAN THIS TENANT ACTUALLY
 * DO RIGHT NOW?
 *
 * ── THE DEFECT THIS EXISTS TO REMOVE ─────────────────────────────────────────
 *
 * `HebyCommandDescriptor.availability` is a RELEASE-TIME claim. It says whether a command shipped
 * in a runnable state — it has never known anything about the tenant asking. `/help` rendered that
 * field directly, so every organization was told the same thing, and a tenant with no usable GitHub
 * connection was told `/repositories` was available, ran it, and received `capability-not-available`
 * from the seam that actually knows.
 *
 * Telling somebody a capability is available and then refusing it is not a UI blemish. It is Hebun
 * asserting an organizational fact it never established, which is the one thing this codebase
 * spends its firewalls preventing everywhere else.
 *
 * ── WHAT THIS MODULE IS, AND WHAT IT IS EMPHATICALLY NOT ─────────────────────
 *
 * IT IS A PROJECTION. It composes authorities that already exist and owns no capability state of
 * its own. It is not a capability authority, not a registry, not a catalog, and not a cache. Delete
 * it and no truth is lost — only the composition.
 *
 * There are already three authorities and this module adds no fourth:
 *
 *   provider capability   `integration-authority/capability-availability.server.ts` (I1) — the one
 *                         normalized seam, tenant-scoped, which already owns that `unverified` is
 *                         not `connected`, that health does not move the lifecycle, and that a
 *                         capability requires a covering scope subset.
 *   model availability    `heby-provider-ops/provider-connectivity-projection.server.ts`, whose
 *                         `availability` field is itself derived from the released
 *                         `evaluateModelAvailability`. GLOBAL, not tenant-scoped, because the
 *                         Director's connectivity control is a global row (R5.1).
 *   release vocabulary    the command registry — what a command IS, never whether you may run it.
 *
 * NOTHING HERE RE-DERIVES ANY OF THAT. This module does not read `integrations`, does not read a
 * scope list, does not look at a credential, and does not decide what `degraded` means.
 *
 * ── WHAT AVAILABILITY MAY NEVER BE DERIVED FROM ──────────────────────────────
 *
 * Not from a credential existing — a stored secret is not a connection, and `ProviderOpsView`
 * carries `credential: "present" | "missing"` precisely so a reader can be tempted; this module
 * reads `availability` and never `credential`. Not from a provider descriptor or a catalog entry —
 * being connectABLE is a fact about the build, not about the tenant. Not from a UI surface
 * existing. Not from `NODE_ENV`, a mock, or seeded state. Not from the registry's own
 * `availability` field for anything a runtime authority governs. And never from the ABSENCE of
 * data, which is the failure mode this whole phase is named after.
 *
 * ── UNKNOWN IS A REAL ANSWER AND IT FAILS CLOSED ─────────────────────────────
 *
 * An authority that does not answer produces `unknown`. It may never produce `available`, and it
 * may equally never produce ordinary `unavailable` — "you cannot do this" and "Hebun could not find
 * out" are different sentences and an operator must be able to tell them apart. This is the same
 * distinction INT-5C drew between a resolved absence and an unavailable lookup, applied one layer up.
 *
 * ── IT PERFORMS NO PROVIDER I/O AND NO WRITE ─────────────────────────────────
 *
 * The capability seam reads the control plane and nothing else, so asking "may I run
 * /repositories?" can never become a request to GitHub, can never spend a rate limit, and can never
 * make `/help` depend on a provider being up. There is no writer of any kind in this module's graph
 * and no code path here mutates anything.
 *
 * ── ONE HONEST CAVEAT, STATED RATHER THAN ENGINEERED AWAY ────────────────────
 *
 * The model authority is `readProviderOpsView`, and that function calls `selectModelTransport` to
 * learn which transport the current configuration WOULD select. A transport selector necessarily
 * imports the transport it can construct, so `claude-http-transport.server.ts` is present in this
 * module's transitive import graph and a firewall asserting otherwise would be a lie.
 *
 * THE HONEST GUARANTEE IS NOT "THE TRANSPORT IS UNREACHABLE" — IT IS "NO CALL IS MADE", and that is
 * what the suite proves, behaviourally: `readCommandCapabilityView` is executed with a global
 * `fetch` that throws, and it must still resolve. A graph assertion cannot express that; an
 * exploding network can. The alternative — a second model-availability evaluator that avoids the
 * selector — was rejected outright, because duplicating an authority to make a firewall look
 * tidier is how two answers to one question get born.
 *
 * Server-only.
 */
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import type { CapabilityAvailabilityView } from "@/features/integration-authority/contracts";
import { readProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";
import type { ProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";
import { GITHUB_REPOSITORY_ACTIVITY_CAPABILITY } from "@/features/provider-github/contracts";
import { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY } from "@/features/provider-youtube/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { HEBY_COMMANDS } from "./registry";
import type {
  CommandCapabilityEntry,
  CommandCapabilityState,
  CommandCapabilityView,
  HebyCommandDescriptor,
} from "./contracts";

/**
 * Which capability key a provider-reaching command consults.
 *
 * THIS IS A BINDING, NOT A CATALOG. The keys are the released provider constants, imported rather
 * than spelled, so this map cannot drift from what the executors actually ask for. It exists
 * because the registry describes that a command REACHES a provider without naming which capability
 * — and inventing a fourth registry to hold that would be worse than one map whose completeness is
 * asserted by a test against the registry itself.
 */
const PROVIDER_CAPABILITY_BY_HANDLER: Readonly<Record<string, string>> = Object.freeze({
  repositories: GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  "repository-knowledge": GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  /*
   * INT-5B2. The SAME capability key, and that is the point rather than an oversight: reading a
   * repository's open pull requests is what `github.repository.activity.read` has meant since
   * GITHUB-4 declared it, and the minted token already asks for `pull_requests: read`. A second key
   * would imply a second grant an organization never made.
   */
  "pull-requests": GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  /*
   * THE SAME KEY AGAIN, for the reason stated directly above about `pull-requests`.
   *
   * `/work-activity` follows a work item's own declarations out to the GitHub repository they name,
   * and it reads that repository through `readRepositoryPullRequests` — the identical released seam
   * `/pull-requests` uses, spending the identical token. It therefore consults the capability an
   * organization has already granted and asks for nothing further; a key of its own would imply a
   * second grant nobody made.
   *
   * IT WAS MISSING, AND THE OMISSION WAS THE DEFECT. `/work-activity` declares provider reach and
   * ships as `available`, so an absent binding resolved it to UNKNOWN through
   * `noCapabilityBinding` — the surface advertising a command while the authority could not say
   * whether it may run. That is the exact failure this projection was built to end, and the
   * completeness assertion in `hebycap1-flow` had been reporting it rather than a test defect.
   */
  "work-activity": GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  /* CGO-5. The YouTube public read; the same authority answers whether it may be attempted. */
  "youtube-channel": YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
});

export interface CommandCapabilityDeps {
  readonly readCapabilityAvailability?: (
    tenant: TenantContext | null,
  ) => Promise<CapabilityAvailabilityView>;
  readonly readProviderOps?: () => Promise<ProviderOpsView>;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Command capability projection is server-only.");
  }
}

/** The reason an operator sees when Hebun could not establish the answer. Never a denial. */
const UNKNOWN_REASONS = Object.freeze({
  noTenant: "No organization is resolved for this request, so Hebun did not establish what you can run.",
  capabilityAuthority:
    "Hebun could not read your organization's connections, so whether this can run is UNKNOWN — not denied.",
  modelAuthority:
    "Hebun could not establish the model's availability, so whether this can run is UNKNOWN — not denied.",
  noCapabilityBinding:
    "This command reaches a provider that Hebun has no capability binding for, so its state is UNKNOWN.",
  notAnswered:
    "The capability authority returned no answer for this capability, so its state is UNKNOWN — not denied.",
});

/**
 * One `CapabilityState` from the I1 seam, translated — never reinterpreted.
 *
 * `available` is the seam's ONLY affirmative value and stays the only one here. Every other state
 * it can produce is a real, established denial, so it becomes `unavailable` carrying the seam's own
 * sentence. A state this function does not recognize becomes `unknown` rather than being guessed
 * at, so widening the seam's enum can never silently produce a false affirmative here.
 */
function fromCapabilityState(
  state: string,
  reason: string | null | undefined,
): { readonly state: CommandCapabilityState; readonly reason: string } {
  if (state === "available") {
    return { state: "available", reason: reason ?? "The capability authority reports this is usable now." };
  }
  if (
    state === "not-connected" ||
    state === "unverified" ||
    state === "degraded" ||
    state === "revoked"
  ) {
    return { state: "unavailable", reason: reason ?? "The capability authority reports this cannot run now." };
  }
  return { state: "unknown", reason: UNKNOWN_REASONS.notAnswered };
}

/**
 * Resolve one command against whatever the authorities said.
 *
 * THE ORDER IS THE DOCTRINE. Reserved outranks everything, because an execution command stays
 * reserved no matter how positively any other authority answers — HEBY-CAP1 activates nothing. A
 * command whose registry availability is already NOT `available` keeps that release-time answer,
 * because "this shipped needing a source" is a truthful statement about the build that no tenant
 * fact overrides. Only then do the runtime authorities speak, and they speak only for the commands
 * that DECLARED they depend on them.
 */
function resolveCommand(
  command: HebyCommandDescriptor,
  capability: CapabilityAvailabilityView | null,
  ops: ProviderOpsView | null,
  hasTenant: boolean,
): CommandCapabilityEntry {
  const base = { commandId: command.id, slash: command.slash } as const;

  /* 1 · RESERVED IS TERMINAL. No authority can un-reserve an execution command. */
  if (command.kind === "reserved") {
    return {
      ...base,
      state: "reserved",
      reason:
        command.unavailableReason ??
        "This command is registered and inert. No execution runtime exists for it.",
      governedBy: "release",
    };
  }

  /* 2 · A RELEASE-TIME REFUSAL STANDS. It is a fact about the build, not about the tenant. */
  if (command.availability !== "available") {
    return {
      ...base,
      state: "unavailable",
      reason: command.unavailableReason ?? "This command did not ship in a runnable state.",
      governedBy: "release",
    };
  }

  /* 3 · NO TENANT — FAIL CLOSED for anything a runtime authority governs. */
  const runtimeGoverned = command.reachesProvider === true || command.requiresModel === true;
  if (runtimeGoverned && !hasTenant) {
    return { ...base, state: "unknown", reason: UNKNOWN_REASONS.noTenant, governedBy: "unresolved" };
  }

  /* 4 · PROVIDER-REACHING — the I1 capability authority answers, or nobody does. */
  if (command.reachesProvider === true) {
    const key = PROVIDER_CAPABILITY_BY_HANDLER[command.handler];
    if (!key) {
      return {
        ...base,
        state: "unknown",
        reason: UNKNOWN_REASONS.noCapabilityBinding,
        governedBy: "provider-capability",
      };
    }
    if (!capability) {
      return {
        ...base,
        state: "unknown",
        reason: UNKNOWN_REASONS.capabilityAuthority,
        governedBy: "provider-capability",
      };
    }
    const entry = capability.capabilities.find((c) => c.capability === key);
    if (!entry) {
      /*
       * THE AUTHORITY ANSWERED, AND SAID NOTHING ABOUT THIS CAPABILITY. That happens when the build
       * ships no connectable definition covering it. It is not a denial about the tenant, so it is
       * not rendered as one.
       */
      return {
        ...base,
        state: "unknown",
        reason: UNKNOWN_REASONS.notAnswered,
        governedBy: "provider-capability",
      };
    }
    const resolved = fromCapabilityState(entry.state, entry.reason);
    return { ...base, ...resolved, governedBy: "provider-capability" };
  }

  /*
   * 5 · MODEL-REQUIRING — the released dispatch classification answers, and only that field.
   *
   * THE FIELD READ HERE IS `dispatch`, NOT `availability` (L2). `availability` is pure config and
   * transport presence; it cannot see the Director's durable connectivity control, which at request
   * time is the FIRST gate and blocks before a transport is selected. Reading `availability` here
   * told a tenant that `/summary` could be attempted while the Director's kill switch was off and
   * the runtime would dispatch nothing — the exact defect class this whole module exists to remove,
   * on the model axis instead of the provider axis. `dispatch` is the composition of both, made once
   * by the authority that already holds both, so this projection still combines nothing itself.
   */
  if (command.requiresModel === true) {
    if (!ops) {
      return {
        ...base,
        state: "unknown",
        reason: UNKNOWN_REASONS.modelAuthority,
        governedBy: "model-availability",
      };
    }
    if (ops.dispatch === "permitted") {
      return {
        ...base,
        state: "available",
        /* `permitted` means an attempt is PERMITTED. It was never a promise that a call succeeds. */
        reason: "A model request may currently be attempted. That is permission to try, not a guarantee.",
        governedBy: "model-availability",
      };
    }
    /*
     * A DENIAL NAMES THE AUTHORITY THAT MADE IT. "The Director turned it off" and "this deployment
     * is not configured for it" are different facts, and an operator acts on them differently.
     */
    return {
      ...base,
      state: "unavailable",
      reason:
        ops.dispatch === "blocked-by-director"
          ? "The Director's connectivity control is off, so no model request may be dispatched and this command cannot run."
          : `The model is not currently usable (${ops.availability}), so this command cannot run.`,
      governedBy: "model-availability",
    };
  }

  /*
   * 6 · NO RUNTIME AUTHORITY GOVERNS IT. Local, navigation, ordinary reads of Hebun's own sources
   * and the proposal inlet. The release-time answer is the whole truth for these, and pretending a
   * tenant fact applies would be inventing one.
   */
  return {
    ...base,
    state: "available",
    reason: "This command reads Hebun's own surfaces and needs no provider and no model.",
    governedBy: "release",
  };
}

/**
 * THE WHOLE VIEW, FOR ONE TENANT, AS OF NOW.
 *
 * Each authority is awaited independently and a failure of either is contained: the commands that
 * authority governs become `unknown` while every other command keeps its real answer. One
 * unreachable authority must not blank out the map.
 */
export async function readCommandCapabilityView(
  tenant: TenantContext | null,
  deps: CommandCapabilityDeps = {},
): Promise<CommandCapabilityView> {
  assertServerOnly();

  const readCapability = deps.readCapabilityAvailability ?? getCapabilityAvailability;
  const readOps = deps.readProviderOps ?? (() => readProviderOpsView());
  const hasTenant = Boolean(tenant?.tenantId);

  let capability: CapabilityAvailabilityView | null = null;
  let ops: ProviderOpsView | null = null;

  if (hasTenant) {
    /*
     * A THROWN AUTHORITY IS AN UNANSWERED AUTHORITY, NEVER AN EMPTY ONE. Swallowing this into a
     * default view would let a database outage render as "your organization has connected nothing".
     */
    try {
      capability = await readCapability(tenant);
    } catch {
      capability = null;
    }
    try {
      ops = await readOps();
    } catch {
      ops = null;
    }
  }

  const entries = HEBY_COMMANDS.map((command) => resolveCommand(command, capability, ops, hasTenant));

  return Object.freeze({
    resolvedAt: "now" as const,
    tenantResolved: hasTenant,
    entries: Object.freeze(entries),
  });
}
