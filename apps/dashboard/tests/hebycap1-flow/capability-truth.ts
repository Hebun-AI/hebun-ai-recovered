/*
 * HEBY-CAP1 — CAPABILITY TRUTH.
 *
 * The defect: `/help` rendered `HebyCommandDescriptor.availability`, a RELEASE-TIME field, as if it
 * were a statement about the tenant asking. A tenant with no usable GitHub connection was told
 * `/repositories` was available and then refused by the seam that actually knows.
 *
 * This suite pins the replacement. Every assertion is about one of four things: that a runtime
 * authority answers for the commands that declared they need one, that an authority which does NOT
 * answer produces `unknown` rather than either neighbour, that reserved stays reserved whatever any
 * authority says, and that resolving all of this touches no network.
 *
 * No database, no provider, no key, no model.
 */
import assert from "node:assert/strict";

import {
  readCommandCapabilityView,
} from "../../src/features/heby-commands/command-capability-projection.server";
import { HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import type { CommandCapabilityView } from "../../src/features/heby-commands/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { CapabilityAvailabilityView } from "../../src/features/integration-authority/contracts";
import type { ProviderOpsView } from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const GITHUB_CAPABILITY = "github.repository.activity.read";

const TENANT_A: TenantContext = asHumanTenantContext({
  tenantId: "10000000-0000-4000-8000-00000000ca01",
  userId: "20000000-0000-4000-8000-00000000ca01",
  authIdentityId: "identity-a", membershipId: "membership-a", membershipVersion: 1,
  roleId: "role-a", sessionContextId: "session-a", provider: "local",
  assuranceLevel: "aal1", mfaVerified: false, requestId: "cap1-a",
  authenticatedAt: "2026-08-26T09:00:00.000Z",
});
const TENANT_B: TenantContext = {
  ...TENANT_A,
  tenantId: "10000000-0000-4000-8000-00000000ca02",
  userId: "20000000-0000-4000-8000-00000000ca02",
  requestId: "cap1-b",
};

function capabilityView(state: string, reason: string): CapabilityAvailabilityView {
  return {
    readiness: "catalog-ready",
    capabilities: [
      { capability: GITHUB_CAPABILITY, state, reason, sources: [] },
      /* CGO-5: the YouTube public read is a fourth reaching command; the same fake authority answers it. */
      { capability: "youtube.channel.public.read", state, reason, sources: [] },
    ],
  } as unknown as CapabilityAvailabilityView;
}

/**
 * A provider-ops view with the model AVAILABLE — and `credential: "missing"` on purpose.
 *
 * The two fields disagree deliberately. `availability` is the released dispatch classification and
 * the ONLY field that answers "may a request be attempted"; `credential` is presence, and presence
 * is not authentication. A projection that read `credential` would get this case backwards, which
 * is exactly what M2 mutates.
 */
/*
 * L2 — THE FIXTURE GAINED THE DIRECTOR DIMENSION, BECAUSE THE ANSWER DEPENDS ON IT.
 *
 * `availability` is pure server config and transport presence; it cannot see the Director's durable
 * connectivity control, which at request time is the FIRST gate. `dispatch` is the composition of
 * the two, in that order — restated here only so an injected view is internally coherent. The real
 * composition is made once, in the provider-ops projection, and is pinned against it in
 * `tests/l2-heby-core/model-dispatch-truth.ts`.
 */
function ops(
  availability: string,
  credential: "present" | "missing" = "missing",
  directorEnabled = true,
): ProviderOpsView {
  return {
    providerLabel: "Claude", providerKey: "claude", directorEnabled,
    directorControl: directorEnabled ? "enabled" : "disabled",
    configuration: "configured", credential,
    model: "claude-test", transport: "live", connectivity: "not-recorded",
    lastValidation: null, availability,
    dispatch: !directorEnabled
      ? "blocked-by-director"
      : availability === "AVAILABLE"
        ? "permitted"
        : "blocked-by-availability",
  } as unknown as ProviderOpsView;
}

const entryFor = (view: CommandCapabilityView, id: string) => {
  const found = view.entries.find((e) => e.commandId === id);
  assert.ok(found, `${id} must appear in the capability view`);
  return found!;
};

async function main(): Promise<void> {
  /* ── 1 · THE PROVIDER AUTHORITY ANSWERS FOR PROVIDER-REACHING COMMANDS ───── */
  {
    const usable = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable now."),
      readProviderOps: async () => ops("AVAILABLE"),
    });
    for (const id of ["repositories", "repository-knowledge"]) {
      const entry = entryFor(usable, id);
      assert.equal(entry.state, "available", `${id} is available when the capability authority says so`);
      assert.equal(entry.governedBy, "provider-capability", `${id} is governed by the capability authority`);
    }

    /*
     * THE SAME BUILD, THE SAME REGISTRY, A DIFFERENT TENANT ANSWER. Nothing about the command
     * changed — only what the authority said — and that is the entire point of the phase.
     */
    const notConnected = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () =>
        capabilityView("not-connected", "No GitHub installation is connected."),
      readProviderOps: async () => ops("AVAILABLE"),
    });
    for (const id of ["repositories", "repository-knowledge"]) {
      const entry = entryFor(notConnected, id);
      assert.equal(entry.state, "unavailable", `${id} is unavailable when nothing is connected`);
      assert.ok(
        entry.reason.includes("No GitHub installation is connected."),
        "and it carries the AUTHORITY'S OWN sentence, not a sentence this module invented",
      );
    }

    /* Every non-available state the seam can produce is an ESTABLISHED denial, never `unknown`. */
    for (const state of ["unverified", "degraded", "revoked"]) {
      const view = await readCommandCapabilityView(TENANT_A, {
        readCapabilityAvailability: async () => capabilityView(state, `state ${state}`),
        readProviderOps: async () => ops("AVAILABLE"),
      });
      assert.equal(entryFor(view, "repositories").state, "unavailable", `${state} is a real denial`);
    }
  }

  /* ── 2 · STATIC REGISTRY AVAILABILITY IS NOT RUNTIME TRUTH ───────────────── */
  {
    /*
     * `/repositories` and `/repository-knowledge` are `availability: "available"` IN THE REGISTRY.
     * If that field were still driving the answer, this assertion could not fail — so it is the
     * assertion that proves the field stopped driving it.
     */
    const repositories = HEBY_COMMANDS.find((c) => c.id === "repositories")!;
    assert.equal(repositories.availability, "available", "the registry still ships it as available");

    const view = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("not-connected", "Nothing connected."),
      readProviderOps: async () => ops("AVAILABLE"),
    });
    assert.equal(
      entryFor(view, "repositories").state,
      "unavailable",
      "a command the REGISTRY calls available is unavailable when the tenant's authority says so",
    );
  }

  /* ── 3 · CREDENTIAL PRESENCE IS NOT CAPABILITY ───────────────────────────── */
  {
    /* Credential PRESENT, dispatch classification NOT available. Presence must lose. */
    const view = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable."),
      readProviderOps: async () => ops("DISABLED", "present"),
    });
    const summary = entryFor(view, "summary");
    assert.equal(summary.state, "unavailable", "a present credential does not make the model usable");
    assert.equal(summary.governedBy, "model-availability", "and the model authority is what answered");

    /* Credential MISSING, dispatch classification available. Presence must lose here too. */
    const inverse = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable."),
      readProviderOps: async () => ops("AVAILABLE", "missing"),
    });
    assert.equal(
      entryFor(inverse, "summary").state,
      "available",
      "and an absent credential does not make it unusable — only `dispatch` decides",
    );
  }

  /* ── 3b · THE DIRECTOR OUTRANKS A PERFECT CONFIGURATION (L2) ─────────────── */
  {
    /*
     * THE DEFECT L2 REMOVED, PINNED WHERE IT LIVED.
     *
     * `availability` is AVAILABLE, the credential is present, the transport is live — every gate
     * this projection used to consult reads healthy. The Director's durable control is off, so the
     * request path will select no transport and dispatch nothing. Offering the command here is
     * Hebun asserting a runtime capability it does not have, which is the exact thing HEBY-CAP1
     * exists to prevent — on the model axis rather than the provider axis.
     */
    const view = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable."),
      readProviderOps: async () => ops("AVAILABLE", "present", false),
    });
    const summary = entryFor(view, "summary");
    assert.equal(
      summary.state,
      "unavailable",
      "a model command is not offered while the Director's connectivity control is off",
    );
    assert.equal(summary.governedBy, "model-availability");
    assert.match(
      summary.reason,
      /Director's connectivity control is off/,
      "and the denial names the Director rather than blaming the configuration",
    );

    /* A provider-read command uses no model, so the SAME view must leave it untouched. */
    assert.equal(
      entryFor(view, "repositories").state,
      "available",
      "the model kill switch does not deny a command that needs no model",
    );
  }

  /* ── 4 · AN UNANSWERED AUTHORITY IS `unknown`, AND FAILS CLOSED ──────────── */
  {
    const thrown = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => {
        throw new Error("control plane unreachable");
      },
      readProviderOps: async () => {
        throw new Error("config unreadable");
      },
    });
    const repositories = entryFor(thrown, "repositories");
    assert.equal(repositories.state, "unknown", "a thrown capability authority produces UNKNOWN");
    assert.notEqual(repositories.state, "available", "never available");
    assert.notEqual(repositories.state, "unavailable", "and never an ordinary denial");
    assert.ok(
      /UNKNOWN — not denied/.test(repositories.reason),
      "the sentence says it was not established, not that it was refused",
    );
    assert.equal(entryFor(thrown, "summary").state, "unknown", "the model authority behaves the same");

    /*
     * ONE UNREACHABLE AUTHORITY MUST NOT BLANK THE MAP. Commands no runtime authority governs keep
     * their real answer while the governed ones go UNKNOWN.
     */
    assert.equal(entryFor(thrown, "help").state, "available", "/help itself still resolves");

    /* The authority ANSWERED but said nothing about this capability — still UNKNOWN, not a denial. */
    const silent = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () =>
        ({ readiness: "catalog-ready", capabilities: [] }) as unknown as CapabilityAvailabilityView,
      readProviderOps: async () => ops("AVAILABLE"),
    });
    assert.equal(
      entryFor(silent, "repositories").state,
      "unknown",
      "an authority that answered without covering this capability leaves it UNKNOWN",
    );
  }

  /* ── 5 · NO TENANT FAILS CLOSED ──────────────────────────────────────────── */
  {
    let capabilityAsked = false;
    const view = await readCommandCapabilityView(null, {
      readCapabilityAvailability: async () => {
        capabilityAsked = true;
        return capabilityView("available", "Usable.");
      },
      readProviderOps: async () => ops("AVAILABLE"),
    });
    assert.equal(view.tenantResolved, false, "the view says no organization was resolved");
    assert.equal(
      capabilityAsked,
      false,
      "and no authority is even consulted — there is nobody to ask about",
    );
    assert.equal(entryFor(view, "repositories").state, "unknown", "provider commands are UNKNOWN");
    assert.equal(entryFor(view, "summary").state, "unknown", "model commands are UNKNOWN");
    assert.equal(entryFor(view, "repositories").governedBy, "unresolved", "and it says why");
  }

  /* ── 6 · RESERVED IS TERMINAL ────────────────────────────────────────────── */
  {
    /*
     * Every authority answers as positively as it can. Not one reserved command may move, because
     * HEBY-CAP1 activates nothing: `NO_EXECUTION_RUNTIME` is still the truth.
     */
    const view = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable."),
      readProviderOps: async () => ops("AVAILABLE", "present"),
    });
    const reserved = HEBY_COMMANDS.filter((c) => c.kind === "reserved");
    assert.ok(reserved.length >= 10, "the reserved set is still registered");
    for (const command of reserved) {
      const entry = entryFor(view, command.id);
      assert.equal(entry.state, "reserved", `${command.slash} stays reserved`);
      assert.notEqual(entry.state as string, "available", `${command.slash} is never available`);
    }
    for (const id of ["run", "execute", "deploy", "approve", "reject", "delete"]) {
      assert.equal(entryFor(view, id).state, "reserved", `/${id} is not activated by this phase`);
    }
  }

  /* ── 7 · TENANT ISOLATION ────────────────────────────────────────────────── */
  {
    /*
     * Two organizations, two answers, from ONE build. The tenant reaching the authority is the one
     * that was passed in — there is no other channel, because the projection accepts no tenant id
     * and `resolveTenantContext()` takes no argument.
     */
    const seen: string[] = [];
    const byTenant = async (tenant: TenantContext | null): Promise<CapabilityAvailabilityView> => {
      seen.push(tenant?.tenantId ?? "none");
      return tenant?.tenantId === TENANT_A.tenantId
        ? capabilityView("available", "A is connected.")
        : capabilityView("not-connected", "B has connected nothing.");
    };

    const a = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: byTenant,
      readProviderOps: async () => ops("AVAILABLE"),
    });
    const b = await readCommandCapabilityView(TENANT_B, {
      readCapabilityAvailability: byTenant,
      readProviderOps: async () => ops("AVAILABLE"),
    });

    assert.deepEqual(seen, [TENANT_A.tenantId, TENANT_B.tenantId], "each read carried its own tenant");
    assert.equal(entryFor(a, "repositories").state, "available", "A can run it");
    assert.equal(entryFor(b, "repositories").state, "unavailable", "B cannot");
    assert.ok(
      !JSON.stringify(b).includes(TENANT_A.tenantId),
      "and B's view carries no trace of A",
    );
  }

  /* ── 8 · RESOLVING CAPABILITY TOUCHES NO NETWORK ─────────────────────────── */
  {
    /*
     * THE GUARANTEE THAT MATTERS, PROVED BEHAVIOURALLY RATHER THAN BY IMPORT GRAPH.
     *
     * The model authority calls `selectModelTransport` to learn which transport the configuration
     * WOULD select, so the Claude transport module is genuinely present in the import graph and a
     * firewall claiming otherwise would be false. What must be true is that no CALL happens — so
     * the global fetch is replaced with one that throws, and the whole resolution must still work.
     */
    const realFetch = globalThis.fetch;
    let attempted = false;
    (globalThis as { fetch: unknown }).fetch = (...args: unknown[]) => {
      attempted = true;
      throw new Error(`HEBY-CAP1 made a network call: ${String(args[0])}`);
    };
    try {
      const view = await readCommandCapabilityView(TENANT_A, {
        readCapabilityAvailability: async () => capabilityView("available", "Usable."),
        readProviderOps: async () => ops("AVAILABLE"),
      });
      assert.equal(attempted, false, "no fetch was attempted while resolving capability");
      assert.ok(view.entries.length > 0, "and the view still resolved");
    } finally {
      (globalThis as { fetch: unknown }).fetch = realFetch;
    }
  }

  /* ── 9 · THE VIEW IS NEVER PERSISTED AND CLAIMS NO DURABILITY ────────────── */
  {
    const view = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable."),
      readProviderOps: async () => ops("AVAILABLE"),
    });
    assert.equal(view.resolvedAt, "now", "the view claims no durable timestamp");
    assert.equal(
      view.entries.length,
      HEBY_COMMANDS.length,
      "every registered command is accounted for — silence about one would read as unknown-by-omission",
    );
    /* A capability that may be attempted is not one that is authorized, executed, or successful. */
    const summary = entryFor(view, "summary");
    assert.ok(
      /not a guarantee/.test(summary.reason),
      "an affirmative model answer says out loud that it is permission to try",
    );
  }

  /* ── 10 · THE PROVIDER-CAPABILITY BINDING IS COMPLETE, IN BOTH DIRECTIONS ── */
  {
    /*
     * The binding from a provider-reaching command to its capability key is a MAP, and a map can
     * rot. Every command that declares provider reach must resolve through the capability
     * authority — never fall through to `unknown` because somebody forgot an entry.
     */
    const view = await readCommandCapabilityView(TENANT_A, {
      readCapabilityAvailability: async () => capabilityView("available", "Usable."),
      readProviderOps: async () => ops("AVAILABLE"),
    });
    const reaching = HEBY_COMMANDS.filter((c) => c.reachesProvider === true);
    assert.ok(reaching.length >= 2, "there are provider-reaching commands to bind");
    for (const command of reaching) {
      const entry = entryFor(view, command.id);
      assert.equal(
        entry.governedBy,
        "provider-capability",
        `${command.slash} declares provider reach, so the capability authority must answer for it`,
      );
      assert.notEqual(
        entry.state,
        "unknown",
        `${command.slash} has a capability binding — an unbound reaching command is a rotted map`,
      );
    }
  }

  console.log("hebycap1-flow/capability-truth: OK");
}

main();
