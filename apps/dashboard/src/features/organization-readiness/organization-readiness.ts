/*
 * ORGANIZATION-READINESS-1 — what this organization still needs before Hebun can do real work for it,
 * read from the authorities that already decide each part. Pure: facts in, rows out.
 *
 * Each row is ONE existing authority's answer, worded, plus who can take the next step. Nothing here
 * decides anything: a row is `ready` only when the owning authority already says so, `unknown` when
 * it could not be read (never "no"), and `not-ready` otherwise. Steps that only a platform operator
 * can take today are named as such rather than offered as a control.
 */

export type ReadinessState = "ready" | "not-ready" | "unknown";

/** Who can take the next step. `platform-operator` means it is not available in the app today. */
export type ReadinessActor = "you" | "governance-authority" | "platform-operator";

export interface ReadinessRow {
  readonly key: "governance" | "external-ai" | "integrations" | "publishing" | "work-domains";
  readonly label: string;
  readonly state: ReadinessState;
  readonly facts: string;
  readonly next: { readonly actor: ReadinessActor; readonly text: string; readonly href?: string } | null;
}

export interface OrganizationReadinessFacts {
  readonly governance:
    | {
        readonly status: "read";
        readonly established: boolean;
        readonly viewerIsAuthority: boolean;
        /**
         * TENANT-ACTIVATION-1: a self-service organization with no genesis nomination yet. Only `true`
         * changes the wording; absent or `false` (including "could not be read") keeps the released row.
         */
        readonly awaitingPlatformReview?: boolean;
      }
    | { readonly status: "unavailable" };
  /** This organization's external-AI data-use authorization for the configured model processor. */
  readonly externalAi:
    | { readonly status: "absent" }
    | { readonly status: "withdrawn" }
    | { readonly status: "active"; readonly purposes: readonly string[] }
    | { readonly status: "unavailable" };
  /** The platform half: whether a model request may be attempted at all (global, not per organization). */
  readonly modelDispatch: "permitted" | "blocked-by-director" | "blocked-by-availability" | "unknown";
  readonly capabilities:
    | { readonly status: "read"; readonly available: readonly string[]; readonly unavailableCount: number }
    | { readonly status: "unavailable" };
  /** The executor's own composition for this organization: tenant arming AND platform control. */
  readonly publishing:
    | {
        readonly status: "read";
        readonly tenantArming: "armed" | "never-armed" | "withdrawn" | "not-established";
        readonly effectiveSend: "reachable" | "blocked";
      }
    | { readonly status: "unavailable" };
  readonly workDomains: { readonly status: "read"; readonly count: number } | { readonly status: "unavailable" };
}

const UNREADABLE = "Could not be read right now. That is unknown, not “no”.";
const OPERATOR = "A platform operator ceremony; not available in the app today.";
/*
 * EA1-KIND-ARMING-1, said where it matters. Arming has no act-kind dimension: one arming opens email
 * sending, Instagram publication and YouTube publication together. A reader who sees only "Armed"
 * would reasonably assume it covers the one kind they asked for.
 */
const ARMING_SCOPE_FACTS =
  "Armed for this organization. One arming covers email sending, Instagram publication and YouTube publication together; it is not granted per kind.";

export function describeOrganizationReadiness(facts: OrganizationReadinessFacts): readonly ReadinessRow[] {
  const g = facts.governance;
  const governance: ReadinessRow =
    g.status === "unavailable"
      ? { key: "governance", label: "Governance authority", state: "unknown", facts: UNREADABLE, next: null }
      : g.established
        ? {
            key: "governance",
            label: "Governance authority",
            state: "ready",
            facts: g.viewerIsAuthority ? "Established. You hold it." : "Established.",
            next: null,
          }
        : g.awaitingPlatformReview === true
          ? {
              key: "governance",
              label: "Governance authority",
              state: "not-ready",
              facts:
                "Not established. This organization was created through sign-up and is awaiting platform review. Inviting people, ratifying Knowledge, creating agents and recording work all wait on it.",
              next: {
                actor: "platform-operator",
                text: "A Hebun platform operator reviews new organizations and nominates their first Governance holder; it is not available in the app today. You then accept on the genesis page and establish it on this page.",
                href: "/governance/genesis",
              },
            }
          : {
            key: "governance",
            label: "Governance authority",
            state: "not-ready",
            facts: "Not established. Inviting people, ratifying Knowledge, creating agents and recording work all wait on it.",
            next: {
              actor: "platform-operator",
              text: `Nominating the first human is ${OPERATOR} The nominated person then accepts and establishes it on this page.`,
              href: "/governance/genesis",
            },
          };

  const ai = facts.externalAi;
  const platform =
    facts.modelDispatch === "permitted"
      ? "The platform model is available."
      : facts.modelDispatch === "unknown"
        ? "Whether the platform model is available could not be read."
        : "The platform model is switched off or not configured.";
  const externalAi: ReadinessRow =
    ai.status === "unavailable"
      ? { key: "external-ai", label: "AI processing of this organization’s data", state: "unknown", facts: UNREADABLE, next: null }
      : ai.status === "active"
        ? {
            key: "external-ai",
            label: "AI processing of this organization’s data",
            state: facts.modelDispatch === "permitted" ? "ready" : "not-ready",
            facts: `Authorized for: ${ai.purposes.join(", ")}. ${platform}`,
            next: facts.modelDispatch === "permitted" ? null : { actor: "platform-operator", text: OPERATOR },
          }
        : {
            key: "external-ai",
            label: "AI processing of this organization’s data",
            state: "not-ready",
            facts: `${ai.status === "withdrawn" ? "Authorization withdrawn" : "Not authorized"}. Heby and content preparation send nothing to the model until this organization’s Governance authorizes it. ${platform}`,
            next: {
              actor: "governance-authority",
              text: "This organization’s Governance authority decides it in AI assistance data use below.",
            },
          };

  const c = facts.capabilities;
  const integrations: ReadinessRow =
    c.status === "unavailable"
      ? { key: "integrations", label: "Connected providers", state: "unknown", facts: UNREADABLE, next: null }
      : {
          key: "integrations",
          label: "Connected providers",
          state: c.available.length > 0 ? "ready" : "not-ready",
          facts:
            c.available.length > 0
              ? `Available: ${c.available.join(", ")}.${c.unavailableCount > 0 ? ` ${c.unavailableCount} more not available.` : ""}`
              : "No provider capability is available yet.",
          next: { actor: "you", text: "Connect only the providers this organization needs.", href: "/integrations" },
        };

  const p = facts.publishing;
  const publishing: ReadinessRow =
    p.status === "unavailable"
      ? { key: "publishing", label: "Executing approved sends and posts", state: "unknown", facts: UNREADABLE, next: null }
      : p.effectiveSend === "reachable"
        ? {
            key: "publishing",
            label: "Executing approved sends and posts",
            state: "ready",
            facts: ARMING_SCOPE_FACTS,
            next: null,
          }
        : {
            key: "publishing",
            label: "Executing approved sends and posts",
            state: "not-ready",
            facts:
              p.tenantArming === "armed"
                ? "Armed for this organization, but switched off for the platform."
                : p.tenantArming === "withdrawn"
                  ? "Arming withdrawn for this organization. Proposals can still be filed and approved; nothing is executed."
                  : "Not armed for this organization. Proposals can still be filed and approved; nothing is executed.",
            next: { actor: "platform-operator", text: `Arming is ${OPERATOR}` },
          };

  const w = facts.workDomains;
  const workDomains: ReadinessRow =
    w.status === "unavailable"
      ? { key: "work-domains", label: "Work domains", state: "unknown", facts: UNREADABLE, next: null }
      : w.count > 0
        ? { key: "work-domains", label: "Work domains", state: "ready", facts: `${w.count} recorded.`, next: null }
        : {
            key: "work-domains",
            label: "Work domains",
            state: "not-ready",
            facts: "None recorded. Work can still be recorded for the whole organization.",
            next: { actor: "platform-operator", text: `Recording work domains is ${OPERATOR}` },
          };

  return [governance, externalAi, integrations, publishing, workDomains];
}
