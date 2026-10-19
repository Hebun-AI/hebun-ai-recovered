/*
 * KNOWLEDGE-EVIDENCE-STANDING-1 — Heby's Knowledge evidence (Knowledge, Intelligence and Governance
 * workspaces) states ratification as Governance holds it, in the model grounding and on the card alike.
 *
 *   A. Forged `ratification_decision_id` → "not confirmed" in model grounding and on the card.
 *   B. Genuine Governance ratification → ratified, confirmed by Governance.
 *   C. No claim → none / no ratification recorded.
 *   D. Governance standing unreadable or throwing → Knowledge unavailable; no record in either view.
 *   E. Two tenants: each sees only its own records, and Governance is asked in the asking tenant only.
 *   F. Historical evidence (stored rows, no Governance reading) is never shown as Governance-confirmed.
 *   G. The card's summary counts equal the items it shows; the two limits are stated.
 *   H. `/heby` stays ratified-only, and its items now say "confirmed by Governance".
 *
 * Released writers seed Knowledge. Disposable database, dropped on exit; no network, no model.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { ratifyKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import {
  resolveKnowledgeEvidenceDetailed,
  resolveRatifiedKnowledgeEvidence,
} from "../../src/features/heby-answer/knowledge-evidence.server";
import { modelGroundingLines } from "../../src/features/heby-answer/model-facing-projection";
import { fromStoredEvidence, toStoredEvidence } from "../../src/features/heby-conversation/answer-evidence";
import { HebyEvidencePanel } from "../../src/components/layout/heby/heby-evidence";
import {
  EVIDENCE_ABSENCE_IS_NOT_NONEXISTENCE,
  EVIDENCE_CONFLICTS_NOT_EVALUATED,
  summarizeEvidenceStanding,
  type RetrievalEvidenceSet,
} from "../../src/features/knowledge-retrieval";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-19T09:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";
const RATIFIED = "MARK-RATIFIED";
const DRAFT = "MARK-DRAFT";
const FORGED = "MARK-FORGED";
const BOB = "MARK-GLOBEX";

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "kes1-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

const card = (set: RetrievalEvidenceSet, historical = false) =>
  renderToStaticMarkup(createElement(HebyEvidencePanel, { set, historical }));
/** One card's markup, located by its title. */
function cardOf(markup: string, title: string): string {
  const at = markup.indexOf(`>${title}<`);
  assert.ok(at >= 0, `${title} is rendered`);
  const start = markup.lastIndexOf("<li", at);
  return markup.slice(start, markup.indexOf("</details></li>", at));
}
/** The model-visible grounding line for one fact key. */
const groundingFor = (lines: readonly string[], factKey: string) => {
  const line = lines.find((l) => l.includes(factKey));
  assert.ok(line, `${factKey} reaches the grounding`);
  return line!;
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_kes1_standing");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const realFetch = globalThis.fetch;
  let strayNetwork = 0;
  globalThis.fetch = (async () => {
    strayNetwork += 1;
    throw new Error("no network in this suite");
  }) as typeof fetch;

  try {
    harness.migrateDatabase();
    await setup.connect();
    process.env.DATABASE_URL = harness.dbUrl;

    const writer = createDurableKnowledgeWriter(handle.db);
    const knowledgeRepo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => knowledgeRepo,
      getRepository: () => knowledgeRepo,
      now: () => NOW,
    } as never;
    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-kes1", email: "alice@kes1.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-kes1", email: "bob@kes1.test", password: "bob-correct-password-4Lm" });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "b"));

    for (const [seeded, ctx] of [[alice, aliceCtx], [bob, bobCtx]] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal((await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority so Knowledge can be reviewed." }, deps)).status, "established");
    }
    const create = async (ctx: TenantContext, factKey: string, title: string, marker: string) => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey: "policies", scope: "company-wide", title, statement: `Return policy: ${marker}.` }, knowledgeDeps);
      assert.equal(created.status, "created", JSON.stringify(created));
      if (created.status !== "created") throw new Error("unreachable");
      return { factId: created.identity.factId, nodeId: created.identity.newKnowledgeNodeId! };
    };
    const ratify = async (ctx: TenantContext, fact: { factId: string; nodeId: string }) =>
      assert.equal((await ratifyKnowledgeVersion(ctx, { factId: fact.factId, knowledgeNodeId: fact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps)).status, "ratified");

    await ratify(aliceCtx, await create(aliceCtx, "returns.ratified", "Return policy ratified", RATIFIED));
    await create(aliceCtx, "returns.draft", "Return policy draft", DRAFT);
    const forged = await create(aliceCtx, "returns.forged", "Return policy forged", FORGED);
    const genuine = (await setup.query<{ d: string }>("select ratification_decision_id::text d from knowledge_nodes where statement like $1", [`%${RATIFIED}%`])).rows[0]!.d;
    assert.equal((await setup.query("update knowledge_nodes set ratification_decision_id = $1, ratified_at = now() where id = $2", [genuine, forged.nodeId])).rowCount, 1, "the forged claim is really in the row");
    await ratify(bobCtx, await create(bobCtx, "returns.globex", "Return policy globex", BOB));

    const ask = (ctx: TenantContext, extra: Record<string, unknown> = {}) =>
      resolveKnowledgeEvidenceDetailed(ctx, "return policy", { now: () => NOW, ...extra });

    /* ── A–C and G. one reading, two views, and the summary ─────────────────────────────── */
    const live = await ask(aliceCtx);
    assert.equal(live.resolution.state, "resolved");
    assert.equal(live.evidence.status, "matched");
    const grounding = modelGroundingLines([live.resolution]);
    assert.match(groundingFor(grounding, "returns.forged"), /ratified: not confirmed by Governance/, "A: the model is told the claim is not confirmed");
    assert.ok(!/ratified: yes/.test(groundingFor(grounding, "returns.forged")), "A: …and never that it is ratified");
    assert.match(groundingFor(grounding, "returns.ratified"), /ratified: yes/, "B");
    assert.match(groundingFor(grounding, "returns.draft"), /ratified: no/, "C");

    const byKey = new Map(live.evidence.items.map((item) => [item.factKey, item]));
    assert.equal(byKey.get("returns.forged")!.ratificationStanding, "unconfirmed");
    assert.equal(byKey.get("returns.ratified")!.ratificationStanding, "ratified");
    assert.equal(byKey.get("returns.draft")!.ratificationStanding, "none");
    assert.equal(byKey.get("returns.forged")!.ratified, true, "the record's own claim is kept as the claim it is");

    const markup = card(live.evidence);
    const forgedCard = cardOf(markup, "Return policy forged");
    assert.match(forgedCard, /ratification claimed, NOT confirmed by Governance/, "A: the card says not confirmed");
    assert.ok(!/confirmed by Governance<\/span>/.test(forgedCard.replace("NOT confirmed by Governance", "")), "A: no confirmation chip on the forged card");
    assert.match(forgedCard, /Ratification date stated by the record: .* \(not confirmed by Governance here\)/, "A: its date is the record's, not Governance's");
    assert.match(cardOf(markup, "Return policy ratified"), /ratified — confirmed by Governance/, "B");
    assert.match(cardOf(markup, "Return policy draft"), /no ratification recorded/, "C");

    const summary = summarizeEvidenceStanding(live.evidence);
    assert.deepEqual(summary, { shown: 3, ratifiedConfirmed: 1, withoutRatification: 1, unconfirmedClaims: 1, verificationNotEstablished: 0, excludedNotCurrent: 0 }, "G");
    assert.equal(summary.shown, live.evidence.items.length, "G: the summary counts the items shown, nothing else");
    assert.match(markup, /3 record\(s\) shown: 1 ratified and confirmed by Governance · 1 without ratification · 1 with a ratification claim Governance does not confirm\./);
    assert.ok(markup.includes(EVIDENCE_CONFLICTS_NOT_EVALUATED) && markup.includes(EVIDENCE_ABSENCE_IS_NOT_NONEXISTENCE), "G: both limits are stated");
    assert.ok(!/excluded as not current/.test(markup), "G: no exclusion count is invented when the retrieval reported none");

    /* ── D. fail closed ──────────────────────────────────────────────────────────────────── */
    for (const read of [
      async () => ({ status: "unavailable" as const }),
      async () => {
        throw new Error("connection reset");
      },
    ]) {
      const blind = await ask(aliceCtx, { readRatificationDecisions: read });
      assert.equal(blind.resolution.state, "unavailable", "D: the Knowledge source is unavailable");
      assert.equal(blind.resolution.items.length, 0);
      assert.equal(blind.evidence.status, "unavailable");
      assert.equal(blind.evidence.items.length, 0);
      const wire = modelGroundingLines([blind.resolution]).join("\n") + card(blind.evidence);
      for (const marker of [RATIFIED, DRAFT, FORGED, "returns."]) assert.ok(!wire.includes(marker), `D: no ${marker} in either view`);
    }

    /* ── E. tenant isolation ─────────────────────────────────────────────────────────────── */
    {
      const b = await ask(bobCtx);
      assert.deepEqual(b.evidence.items.map((i) => [i.factKey, i.ratificationStanding]), [["returns.globex", "ratified"]]);
      const bWire = modelGroundingLines([b.resolution]).join("\n") + card(b.evidence);
      for (const marker of [RATIFIED, DRAFT, FORGED]) assert.ok(!bWire.includes(marker), `E: Acme's ${marker} never reaches Globex`);
      assert.ok(!JSON.stringify(live).includes(BOB), "E: Globex never reaches Acme");
      /* Governance is asked in the asking tenant: Acme's genuine decision means nothing to Globex. */
      const asked: string[] = [];
      await ask(aliceCtx, {
        readRatificationDecisions: async (t: { tenantId: string }) => {
          asked.push(t.tenantId);
          return { status: "read" as const, ratifyDecisionIds: new Set<string>() };
        },
      });
      assert.ok(asked.length > 0 && asked.every((t) => t === alice.tenantId), "E: every Governance read is scoped to the asking tenant");
    }

    /* ── F. historical compatibility ─────────────────────────────────────────────────────── */
    {
      const replayed = fromStoredEvidence({ ...toStoredEvidence(live.evidence), id: randomUUID() } as never);
      assert.ok(replayed.items.every((item) => item.ratificationStanding === undefined), "F: no Governance reading is persisted or invented");
      const old = card(replayed, true);
      assert.match(cardOf(old, "Return policy forged"), /ratification claimed — Governance verification not established/);
      assert.match(cardOf(old, "Return policy ratified"), /ratification claimed — Governance verification not established/, "F: even a genuine one is not re-promoted from the stored claim");
      assert.ok(!/confirmed by Governance<\/span>/.test(old.replace(/NOT confirmed by Governance|not confirmed by Governance here/g, "")), "F: nothing historical is shown as Governance-confirmed");
      assert.match(old, /3 record\(s\) shown: 1 without ratification · 2 whose Governance verification was not established\./);
    }

    /* ── H. /heby is unchanged in policy, and now says what its check established ─────────── */
    {
      const heby = await resolveRatifiedKnowledgeEvidence(aliceCtx, "return policy", { now: () => NOW });
      assert.deepEqual(heby.evidence.items.map((i) => [i.factKey, i.ratificationStanding]), [["returns.ratified", "ratified"]], "H: ratified-only, confirmed");
      assert.match(card(heby.evidence), /1 record\(s\) shown: 1 ratified and confirmed by Governance\./);
    }

    assert.equal(strayNetwork, 0, "no network call was attempted");
    console.log("knowledge-evidence-standing-1 postgres checks passed");
  } finally {
    globalThis.fetch = realFetch;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
