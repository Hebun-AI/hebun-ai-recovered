/*
 * L-2b — the /agents identity card RENDERS the lifecycle controls a reader may use, per status.
 *
 * A static render (react-dom/server, as K4's review-card proof): it proves which controls appear for
 * which status and ownership. It does not click — the transitions themselves are proven against
 * PostgreSQL in suspension-postgres.ts, and the server actions are transport (firewall.ts F4).
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { DurableAgentIdentityCard } from "../../src/components/agents/durable-agent-identity-card";
import type { DurableAgentIdentityRecord } from "../../src/features/agent-identity/read-durable-agent-identity.server";

const INERT_ROUTER = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} } as unknown as never;
const OWNER = "00000000-0000-4000-8000-0000000000a1";

function identity(status: DurableAgentIdentityRecord["serviceStatus"], owner = OWNER): DurableAgentIdentityRecord {
  return {
    agentId: "00000000-0000-4000-8000-00000000a9e1",
    name: "Heby",
    humanOwnerId: owner,
    humanOwnerType: "human",
    createdAt: "2026-10-01T00:00:00.000Z",
    retiredAt: status === "retired" ? "2026-10-05T00:00:00.000Z" : null,
    suspendedAt: status === "suspended" || status === "retired" ? "2026-10-04T00:00:00.000Z" : null,
    inService: status === "in-service",
    serviceStatus: status,
  };
}

function render(record: DurableAgentIdentityRecord): string {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: INERT_ROUTER },
      createElement(DurableAgentIdentityCard, { actingHumanId: OWNER, tenantId: "t", identities: [record] }),
    ),
  );
}
const button = (html: string, label: string): string | null => {
  const m = html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}(?:(?!</button>).)*</button>`));
  return m ? m[0] : null;
};

/* In service, owned: Suspend and Retire, both enabled; no Reactivate. */
{
  const html = render(identity("in-service"));
  assert.ok(html.includes(">in service<"), "the badge reads in service");
  const suspend = button(html, "Suspend");
  assert.ok(suspend && !/ disabled=""/.test(suspend), "an owned in-service agent offers an enabled Suspend");
  assert.ok(button(html, "Retire this identity"), "and Retire");
  assert.equal(button(html, "Reactivate"), null, "and no Reactivate");
}

/* Suspended, owned: Reactivate and Retire; no Suspend; the status says suspended, never retired. */
{
  const html = render(identity("suspended"));
  assert.ok(html.includes(">suspended<"), "the badge reads suspended");
  assert.ok(html.includes("suspended 2026-10-04"), "with its date");
  assert.ok(!/>retired</.test(html), "a suspended agent is never labelled retired");
  const reactivate = button(html, "Reactivate");
  assert.ok(reactivate && !/ disabled=""/.test(reactivate), "an owned suspended agent offers an enabled Reactivate");
  assert.ok(button(html, "Retire this identity"), "and may still be retired");
  assert.equal(button(html, ">Suspend<"), null, "and offers no second Suspend");
}

/* Retired: no lifecycle control at all — retirement is terminal. */
{
  const html = render(identity("retired"));
  assert.ok(html.includes(">retired<"));
  for (const label of ["Suspend", "Reactivate", "Retire this identity"]) {
    assert.equal(button(html, label), null, `a retired agent offers no ${label}`);
  }
}

/* Indeterminate: no transition is offered over fields that disagree. */
{
  const html = render(identity("indeterminate"));
  assert.ok(html.includes(">status unknown<"));
  for (const label of ["Suspend", "Reactivate", "Retire this identity"]) {
    assert.equal(button(html, label), null, `an indeterminate agent offers no ${label}`);
  }
}

/* Not the owner: the controls render disabled — the writer still refuses, the UI does not pretend. */
{
  const html = render(identity("in-service", "00000000-0000-4000-8000-0000000000b2"));
  assert.ok(/ disabled=""/.test(button(html, "Suspend") ?? ""), "a non-owner sees Suspend disabled");
  const reHtml = render(identity("suspended", "00000000-0000-4000-8000-0000000000b2"));
  assert.ok(/ disabled=""/.test(button(reHtml, "Reactivate") ?? ""), "and Reactivate disabled");
}

console.log("l2b card render: ok");
