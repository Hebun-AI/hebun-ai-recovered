/*
 * OPERATIONAL-RELIABILITY-1 — APPROVALS-EXPIRY-HYDRATION-1.
 *
 * `/approvals` raised React #418: `PermitRow` printed the permit expiry with the runtime's locale and
 * zone, once on the server (UTC) and again in the browser (Europe/Istanbul), so the hydrated text
 * differed. Rendering the same component under two process zones is the server/browser pair in one
 * process; the markup must be identical, and the stored instant must still be the one shown.
 *
 * A negative control first proves the harness can see the defect: the old expression does differ.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PermitRow } from "../../src/components/decision-workspace/action-authorizations";
import { ExecutionLedger } from "../../src/components/decision-workspace/execution-ledger";
import { utcInstant } from "../../src/lib/format";
import type { ActionPermitView } from "../../src/features/action-authorization/read-action-authorizations.server";
import type { ExecutionLedgerEntry } from "../../src/features/action-execution/execution-ledger-projection.server";

const ROOT = path.resolve(__dirname, "../..");
const ZONES = ["UTC", "Europe/Istanbul", "America/Los_Angeles", "Asia/Kolkata"];
const EXPIRES = "2026-10-17T19:21:11.000Z";

function inZone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    process.env.TZ = previous;
  }
}

const permit: ActionPermitView = {
  permitId: "p", requestId: "r", actionKind: "record-work", toolId: "t", targetLabel: "Work", state: "active",
  issuedAt: "2026-10-16T19:21:11.000Z", expiresAt: EXPIRES, consumedAt: null, revokedAt: null,
  revocationReason: null, boundPayloadDigest: "d", executionStatus: null, providerAccepted: false, providerMessageId: null,
  proposedByActorType: "human", standingAuthorizationId: null,
};

const ledgerEntry: ExecutionLedgerEntry = {
  attemptId: "11111111-1111-4111-8111-111111111111",
  permitId: "22222222-2222-4222-8222-222222222222",
  requestId: "33333333-3333-4333-8333-333333333333",
  actionKind: "send-external-communication",
  adapterId: "resend-email-v1",
  status: "accepted",
  providerResponseClass: "accepted",
  providerMessageId: "provider-msg-1",
  failureClass: null,
  startedAt: "2026-10-17T19:20:00.000Z",
  completedAt: "2026-10-17T19:20:01.000Z",
  requiresAttention: false,
};

/* ── 0. NEGATIVE CONTROL — the harness detects a zone-dependent rendering ── */
{
  const old = ZONES.map((zone) => inZone(zone, () => new Date(EXPIRES).toLocaleString()));
  assert.ok(new Set(old).size > 1, `the old expression must differ across zones, or this test proves nothing: ${old.join(" | ")}`);
}

/* ── 1. ONE TEXT IN EVERY ZONE, NAMING ITS ZONE ── */
{
  assert.equal(utcInstant(EXPIRES), "17 Oct 2026, 19:21 UTC");
  assert.equal(new Set(ZONES.map((zone) => inZone(zone, () => utcInstant(EXPIRES)))).size, 1);
  assert.equal(utcInstant("not a date"), "not a date", "an unparseable value is shown as stored, never invented");
}

/* ── 2. THE MOUNTED ROWS HYDRATE: identical markup under every zone ── */
{
  const rows = ZONES.map((zone) => inZone(zone, () => renderToStaticMarkup(createElement(PermitRow, { item: permit }))));
  assert.equal(new Set(rows).size, 1, "PermitRow renders the same markup on a UTC server and in any browser zone");
  assert.match(rows[0]!, /expires 17 Oct 2026, 19:21 UTC/, "the expiry is the stored instant, with its zone stated");

  const ledgers = ZONES.map((zone) =>
    inZone(zone, () =>
      renderToStaticMarkup(
        createElement(ExecutionLedger, { entries: [ledgerEntry], needsAttention: [], connected: true, readAt: "2026-10-17T20:00:00.000Z" }),
      ),
    ),
  );
  assert.equal(new Set(ledgers).size, 1, "the execution ledger does not depend on the server's zone");
  assert.match(ledgers[0]!, /started 17 Oct 2026, 19:20 UTC/);
  assert.match(ledgers[0]!, /concluded 17 Oct 2026, 19:20 UTC/);
}

/* ── 3. NO AMBIENT-ZONE FORMATTING LEFT ON THE APPROVALS SURFACE ── */
{
  const files = [
    "src/components/decision-workspace/action-authorizations.tsx",
    "src/components/decision-workspace/execution-ledger.tsx",
    "src/components/approvals-dashboard/approvals-dashboard.tsx",
  ];
  for (const file of files) {
    const code = readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(code, /toLocale(Date|Time)?String\(\s*\)/, `${file} formats a time with the ambient locale and zone`);
    assert.match(code, /utcInstant\(/, `${file} uses the shared UTC formatter`);
  }
  /* The expiry is formatted, never re-derived: no clock is read where it is printed. */
  assert.doesNotMatch(readFileSync(path.join(ROOT, "src/lib/format.ts"), "utf8"), /Date\.now|new Date\(\)/);
}

console.log("operational-reliability-1 approvals time determinism: ok");
