/*
 * E2-1 — ORGANIZATION GROUNDING SEMANTICS.
 *
 * What this proves: Heby can ground an answer in the organization this tenant IS, and cannot,
 * through this class, learn or imply anything about how that organization is ARRANGED.
 *
 * The distinction is the whole milestone. "You are in Acme Industrial, provisioned by the local
 * operator ceremony, with 4 live human members" is an identity and is what this source says.
 * "Acme has a Sales department" is an arrangement, nobody in Hebun owns it, and it must remain
 * unsayable — not filtered out, but absent from the facts that travel.
 *
 *     ORGANIZATION IDENTITY != ORGANIZATION STRUCTURE
 *     STRUCTURE UNAVAILABLE != STRUCTURE EMPTY
 *     HUMAN MEMBER COUNT    != MEMBER ROSTER
 *
 * No database, no network, no key, no model. Every seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  readOrganizationGroundingSource,
  ORGANIZATION_GROUNDING_PROVENANCE,
  ORGANIZATION_GROUNDING_UNAVAILABLE,
} from "../../src/features/organization-authority/heby-organization-source.server";
import {
  ORGANIZATION_STRUCTURE_UNAVAILABLE,
  ORGANIZATION_PROVENANCE_DETAIL,
  type AuthoritativeOrganization,
  type OrganizationAuthorityRead,
  type OrganizationUnavailableReason,
} from "../../src/features/organization-authority/contracts";
import { HEBY_SOURCE_CLASSES } from "../../src/features/heby-integration";
import { resolveHebyWorkspaceContext } from "../../src/features/heby-integration/workspace-registry";
import { resolveHebyWorkspace } from "../../src/features/heby-integration/panel-model";
import { resolveSource } from "../../src/features/heby-runtime/source-resolver";
import { buildResponse } from "../../src/features/heby-runtime/response-builder";
import { assembleEvidence } from "../../src/features/heby-runtime/evidence-assembler";
import { validateResponse } from "../../src/features/heby-runtime/response-validator";
import {
  toStoredSourceEvidence,
  fromStoredSourceEvidence,
} from "../../src/features/heby-conversation/answer-evidence";
import { answerHebyModelRequest } from "../../src/features/heby-answer/model-answer.server";
import type { ModelGenerationRequest, SourceResolution } from "../../src/features/heby-runtime";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
} as unknown as TenantContext;

/*
 * The fixture name is deliberately ordinary. `validateResponse` matches forbidden action claims by
 * bare substring against the answer body, and the body carries an item's LABEL — so an
 * organization literally named "Approved Systems" would be withheld. That is a PRE-EXISTING defect
 * of the validator (Knowledge titles already reach the same line) and is out of E2-1's scope; this
 * suite must not encode it as expected behaviour, in either direction.
 */
function organization(over: Partial<AuthoritativeOrganization> = {}): AuthoritativeOrganization {
  return {
    organizationId: TENANT.tenantId,
    name: "Acme Industrial",
    slug: "acme-industrial",
    lifecycleStatus: "active",
    tenantStatus: "active",
    provenance: "local-operator-ceremony",
    provenanceDetail: ORGANIZATION_PROVENANCE_DETAIL["local-operator-ceremony"],
    humanMemberCount: 4,
    structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,
    ...over,
  } as AuthoritativeOrganization;
}

const groundOn = (result: OrganizationAuthorityRead): Promise<SourceResolution> =>
  readOrganizationGroundingSource(TENANT, { readOrganization: async () => result });

const available = (over: Partial<AuthoritativeOrganization> = {}): OrganizationAuthorityRead => ({
  status: "available",
  organization: organization(over),
});

/** A derived source, so a mixed answer can be built without inventing a second authority. */
const derived: SourceResolution = {
  sourceClass: "operations",
  state: "resolved",
  provenance: "Executive Overview read model — derived and non-authoritative (authoritative: false).",
  authoritative: false,
  items: [{ recordRef: "active-agents", label: "Active Agents", detail: "health: unavailable", lifecycle: "unknown" }],
};

async function main(): Promise<void> {
  /* ── 1 · THE CLASS EXISTS, AND COMMAND DECLARES IT ────────────────────────── */
  {
    assert.ok(
      HEBY_SOURCE_CLASSES.includes("organization"),
      "the organization source class must be part of the closed vocabulary",
    );

    const command = resolveHebyWorkspaceContext({ workspace: "command" });
    assert.ok(
      command.sources.some((s) => s.sourceClass === "organization"),
      "the Command workspace must declare the organization source class",
    );

    /*
     * AND ONLY COMMAND. A class that quietly appeared everywhere would put the organization record
     * into answers about Knowledge, Governance and Decisions, where it is not the referent.
     */
    for (const workspace of [
      "knowledge",
      "governance",
      "decisions",
      "operations",
      "platform",
      "intelligence",
      "workforce",
    ] as const) {
      const context = resolveHebyWorkspaceContext({ workspace });
      assert.ok(
        !context.sources.some((s) => s.sourceClass === "organization"),
        `${workspace} must not declare the organization source class`,
      );
    }

    /*
     * THE ROUTES THAT REACH IT. Heby's own surface, the map, and the organization page all resolve
     * to Command — which is WHY Command is the right and only declaration site. Asserted rather
     * than assumed, because a routing change elsewhere would silently move this capability.
     */
    for (const route of ["/heby", "/live-map", "/director/organization"]) {
      assert.equal(resolveHebyWorkspace(route), "command", `${route} resolves to Command`);
    }
  }

  /* ── 2 · THE PURE RESOLVER STAYS PURE ─────────────────────────────────────── */
  {
    /*
     * G6D's rule: a class with a server seam explains the seam; it does not claim non-connection.
     * This resolution is also `withOrganization`'s fallback when the real read throws, so "no
     * organization is connected" would report a transient failure as a permanent absence.
     */
    const pure = resolveSource("organization");
    assert.equal(pure.state, "unavailable");
    assert.equal(pure.items.length, 0);
    assert.match(String(pure.unavailableReason), /tenant-scoped on the server/i);
    assert.ok(
      !/not connected|no connected/i.test(String(pure.unavailableReason)),
      "the pure resolution must not claim the organization is unconnected",
    );
  }

  /* ── 3 · (A) AN AVAILABLE ORGANIZATION BECOMES ONE AUTHORITATIVE ITEM ─────── */
  {
    const resolution = await groundOn(available());
    assert.equal(resolution.sourceClass, "organization");
    assert.equal(resolution.state, "resolved");
    assert.equal(resolution.authoritative, true, "(I) the organization is an authoritative record");
    assert.equal(resolution.provenance, ORGANIZATION_GROUNDING_PROVENANCE);

    /* ONE ITEM, ALWAYS — the bound is the shape of the fact, not a limit somebody chose. */
    assert.equal(resolution.items.length, 1, "an organization is one record and one item");

    const [item] = resolution.items;
    assert.equal(item!.label, "Acme Industrial");
    assert.equal(item!.lifecycle, "settled");

    /*
     * THE REFERENCE IS THE SLUG, NOT THE TENANT ID. `organizationId` IS the tenant id; printing it
     * as a citation would publish tenant identity into the answer body, a durable evidence row and
     * a model request for no reader benefit.
     */
    assert.equal(item!.recordRef, "acme-industrial");
    assert.ok(
      !JSON.stringify(resolution).includes(TENANT.tenantId),
      "the tenant id must never travel as an organizational reference",
    );

    /* Every clause is read off the authority. */
    assert.match(item!.detail, /lifecycle active/);
    assert.match(item!.detail, /tenant status active/);
    assert.match(item!.detail, /human members 4/);
    assert.ok(item!.detail.includes(ORGANIZATION_PROVENANCE_DETAIL["local-operator-ceremony"]));

    /* No verbatim source text: the organization has no statement to quote. */
    assert.equal(item!.content, undefined);
  }

  /* ── 4 · (B) STRUCTURE UNAVAILABLE TRAVELS VERBATIM ───────────────────────── */
  {
    const resolution = await groundOn(available());
    const detail = resolution.items[0]!.detail;

    /*
     * EQUALITY TO THE AUTHORITY'S OWN FROZEN SENTENCE, not a word ban.
     *
     * A word ban would be the obvious guard and would be wrong in both directions: the sentence
     * ITSELF contains "departments", "teams" and "reporting lines", so a ban would trip on the
     * product's own honest denial — the exact failure INT-3 recorded — while still admitting any
     * other sentence about structure. Equality admits exactly one sentence: the authority's.
     */
    assert.ok(
      detail.includes(ORGANIZATION_STRUCTURE_UNAVAILABLE.detail),
      "the authority's structure-unavailable sentence must travel verbatim, not be re-worded",
    );
    assert.equal(ORGANIZATION_STRUCTURE_UNAVAILABLE.status, "unavailable");
    assert.equal(ORGANIZATION_STRUCTURE_UNAVAILABLE.reason, "no-structural-authority");

    /*
     * AND IT IS NEVER RENDERED AS A KNOWN ZERO. `[]`, `0`, "none" and "no departments" are all
     * claims that Hebun looked and found nothing. Hebun did not look; there is nowhere to look.
     */
    for (const zero of ["no departments", "0 departments", "departments: none", "no teams"]) {
      assert.ok(
        !detail.toLowerCase().includes(zero),
        `structure must never be reported as a known zero (${zero})`,
      );
    }

    /*
     * AND THE DENIALS ARE THE ONLY STRUCTURAL CLAUSES THERE ARE.
     *
     * TWO of them are stripped before the structural vocabulary is banned, and both had to be found
     * the hard way: the authority's `structure.detail`, and this source's own provenance sentence,
     * which says outright that no department, team, reporting line or roster is carried. A bare ban
     * fails on BOTH — the product's honest denial contains every word the ban forbids, which is the
     * failure INT-3 recorded and this suite reproduced on its first run.
     *
     * Stripping them and then banning is what makes the assertion mean "no OTHER sentence here
     * mentions structure" rather than "the words do not appear", which would be unsatisfiable.
     */
    const denials = [ORGANIZATION_STRUCTURE_UNAVAILABLE.detail, ORGANIZATION_GROUNDING_PROVENANCE];
    let remainder = JSON.stringify(resolution);
    for (const denial of denials) {
      const encoded = JSON.stringify(denial).slice(1, -1);
      assert.ok(remainder.includes(encoded), "the denial being stripped must actually be present");
      remainder = remainder.split(encoded).join("");
    }
    for (const word of ["department", "team", "reporting", "manager", "hierarchy", "roster"]) {
      assert.ok(
        !remainder.toLowerCase().includes(word),
        `outside its own denials, the organization source must not mention "${word}"`,
      );
    }
  }

  /* ── 5 · (E)(G) FOUR UNAVAILABLE REASONS, FOUR DISTINCT SENTENCES ─────────── */
  {
    const reasons: readonly OrganizationUnavailableReason[] = [
      "no-tenant",
      "persistence-not-configured",
      "organization-not-found",
      "read-failed",
    ];

    const sentences = new Set<string>();
    for (const reason of reasons) {
      const resolution = await groundOn({ status: "unavailable", reason });
      assert.equal(
        resolution.state,
        "unavailable",
        `${reason}: an absent organization is never resolved — UNAVAILABLE != EMPTY`,
      );
      assert.equal(resolution.items.length, 0, `${reason}: nothing is fabricated`);
      assert.equal(
        resolution.unavailableReason,
        ORGANIZATION_GROUNDING_UNAVAILABLE[reason],
        `${reason} maps to its own sentence`,
      );
      sentences.add(String(resolution.unavailableReason));
    }
    assert.equal(sentences.size, 4, "the four reasons must remain distinguishable");

    /*
     * THE TWO THAT MUST NEVER MERGE. "The store is not configured" is a fact about the deployment;
     * "this session names an organization Hebun cannot find" is a fact about the lookup. Collapsing
     * them would turn an infrastructure state into a claim about the customer's organization.
     */
    assert.notEqual(
      ORGANIZATION_GROUNDING_UNAVAILABLE["persistence-not-configured"],
      ORGANIZATION_GROUNDING_UNAVAILABLE["organization-not-found"],
    );
    for (const reason of reasons) {
      assert.ok(
        !/no organization exists/i.test(ORGANIZATION_GROUNDING_UNAVAILABLE[reason]),
        `${reason} must not be reported as "no organization exists"`,
      );
    }

    /* (G) No tenant → the authority's own refusal, reached through the real seam. */
    const noTenant = await readOrganizationGroundingSource(null, {
      readOrganization: async (t) =>
        t?.tenantId ? available() : { status: "unavailable", reason: "no-tenant" },
    });
    assert.equal(noTenant.state, "unavailable");
    assert.equal(noTenant.unavailableReason, ORGANIZATION_GROUNDING_UNAVAILABLE["no-tenant"]);
  }

  /* ── 6 · (K) NO CALLER CAN NAME ANOTHER ORGANIZATION ──────────────────────── */
  {
    const source = read("src/features/organization-authority/heby-organization-source.server.ts");
    const start = source.indexOf("export async function readOrganizationGroundingSource");
    assert.ok(start > 0, "the grounding seam is exported");
    const signature = source.slice(start, source.indexOf("{", source.indexOf(")", start)));

    /* The tenant is the only subject. There is no id, slug, name or filter to widen it with. */
    for (const parameter of ["organizationId", "slug", "organizationSlug", "name", "filter", "where"]) {
      assert.ok(
        !signature.includes(parameter),
        `a caller must not be able to name ${parameter} — cross-organization reads are unrepresentable, not refused`,
      );
    }
    assert.match(signature, /tenant:\s*TenantContext \| null/, "the tenant arrives as resolved server context");
  }

  /* ── 7 · (I)(M) A MIXED ANSWER STAYS MIXED ───────────────────────────────── */
  {
    const organizationResolution = await groundOn(available());
    const resolutions = [derived, organizationResolution];

    const response = buildResponse("INVESTIGATE", { workspace: "command", route: "/heby" }, resolutions);
    const body = response.body.join(" ");
    assert.match(
      body,
      /authoritative organizational records and derived read models/i,
      "an answer citing both must say so rather than rounding to one",
    );
    assert.equal(response.uncertainty, "known", "an authoritative source raises coverage to known");
    assert.match(body, /Acme Industrial/, "the organization reaches the reader's answer");

    /* The derived source is NOT promoted, and keeps its own provenance beside the authority's. */
    assert.ok(response.provenance.includes(ORGANIZATION_GROUNDING_PROVENANCE));
    assert.ok(response.provenance.some((p) => /non-authoritative/.test(p)));

    /* (M) Existing sources still contribute their own evidence identities, unchanged. */
    const evidence = assembleEvidence(resolutions);
    assert.deepEqual(
      evidence.map((e) => `${e.sourceClass}/${e.recordRef}`).sort(),
      ["operations/active-agents", "organization/acme-industrial"].sort(),
    );
  }

  /* ── 8 · (J) A MODEL MAY NOT INVENT AN ORGANIZATIONAL CITATION ────────────── */
  {
    const resolutions = [await groundOn(available())];
    const assembled = assembleEvidence(resolutions);

    const forged = {
      ...buildResponse("INVESTIGATE", { workspace: "command", route: "/heby" }, resolutions),
      origin: "model" as const,
      modelUsed: true,
      evidence: [
        { sourceClass: "organization" as const, recordRef: "acme-sales-department", lifecycle: "settled" as const },
      ],
    };
    const validation = validateResponse(forged, assembled, "advisory-only");
    assert.equal(validation.valid, false, "an invented organizational record must not validate");
    assert.ok(
      validation.issues.some((i) => /organization\/acme-sales-department/.test(i)),
      "the rejection names the unsupported reference",
    );
  }

  /* ── 9 · (N) IT PERSISTS AND REPLAYS THROUGH THE EXISTING EVIDENCE PATH ───── */
  {
    const resolutions = [derived, await groundOn(available())];
    const rows = toStoredSourceEvidence(resolutions);

    const organizationRow = rows.find((r) => r.sourceClass === "organization");
    assert.ok(organizationRow, "the organization citation is stored by the released projection");
    assert.equal(organizationRow!.recordRef, "acme-industrial");
    assert.equal(organizationRow!.authoritative, true, "the standing is snapshotted, not re-derived");

    /* A MIXED ANSWER REPLAYS MIXED. Two groups, two standings — never rounded to one. */
    const replayed = fromStoredSourceEvidence(
      rows.map((row) => ({
        sourceClass: row.sourceClass,
        recordRef: row.recordRef,
        label: row.label,
        detail: row.detail,
        authoritative: row.authoritative,
        ordinal: row.ordinal,
      })),
    );
    const organizationGroup = replayed.find((g) => g.sourceClass === "organization");
    assert.ok(organizationGroup);
    assert.equal(organizationGroup!.authoritative, true);
    assert.equal(replayed.find((g) => g.sourceClass === "operations")!.authoritative, false);

    /* The structure denial survives the round trip — a reload must not lose the limitation. */
    assert.ok(organizationGroup!.items[0]!.detail.includes(ORGANIZATION_STRUCTURE_UNAVAILABLE.detail));
  }

  /* ── 10 · (O) NO SCHEMA AND NO MIGRATION WERE REQUIRED ────────────────────── */
  {
    const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
      entries: readonly unknown[];
    };
    assert.equal(journal.entries.length, 39, "E2-1 adds no migration");

    /*
     * AND THIS IS WHY IT NEEDS NONE: `source_class` is generic `text` whose only constraint excludes
     * Knowledge, so a new class stores and replays with no DDL. Asserted against the schema rather
     * than trusted, because a future narrowing of that column would silently make E2-1 unstorable.
     */
    const schema = read("src/db/schema/heby-answer-source-evidence.ts");
    assert.match(schema, /sourceClass:\s*text\("source_class"\)\.notNull\(\)/);
    assert.match(schema, /sql`\$\{t\.sourceClass\} <> 'knowledge'`/);
  }

  /* ── 11 · (A) END TO END: IT REACHES THE SERVER-BUILT MODEL REQUEST ───────── */
  {
    /*
     * `answerHebyModelRequest` is driven on the Heby route with a fake transport, and the
     * SERVER-BUILT grounding context is captured from the model request it composes. No database,
     * no network, no key: the tenant resolver, the transport and the organization read are injected.
     */
    let captured: ModelGenerationRequest | undefined;
    await answerHebyModelRequest(
      { prompt: "Which organization am I in, and what does Hebun know about it?", route: "/heby" },
      {
        resolveTenant: async () => TENANT,
        readOverview: () => undefined,
        getConversationRepo: () => null,
        resolveDirectorEnabled: async () => true,
        env: {
          HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
          HEBUN_MODEL_PROVIDER: "claude",
          HEBUN_MODEL_ID: "synthetic-test-model",
          HEBUN_MODEL_CREDENTIAL: "synthetic-not-a-real-key",
          HEBUN_MODEL_TRANSPORT: "fake",
        },
        resolveOrganization: async () => groundOn(available()),
        generate: async (request) => {
          captured = request;
          return {
            status: "unavailable" as const,
            state: "TRANSPORT_UNAVAILABLE" as const,
            modelStatus: { available: false, reason: "provider-unavailable" as const, detail: "test" },
          };
        },
      },
    );

    assert.ok(captured, "the answer flow must have composed a model request");
    const grounding = captured!.evidence.join("\n");
    assert.match(
      grounding,
      /\[organization\/acme-industrial\]/,
      "the organization must reach the model's grounding context — if this fails, withOrganization is not wired",
    );
    assert.match(grounding, /Acme Industrial/, "the organization's name travels with it");
    assert.match(grounding, /human members 4/, "the member COUNT travels; a roster does not");
    assert.ok(
      grounding.includes(ORGANIZATION_STRUCTURE_UNAVAILABLE.detail),
      "the structure denial reaches the model too, so a generated answer is grounded in the limitation",
    );

    /*
     * (C) AGENTS ARE NOT ADMITTED BY E2-1. Live Map projects a durable agent beside the
     * organization; this class does not, and must not start to merely because the map does.
     * Durable agent identity is the Agents product line and needs its own admitted class.
     */
    assert.ok(!/\[agent/i.test(grounding), "no agent citation enters through E2-1");

    /* CONTEXT BUDGET: the organization contributes exactly one line. */
    const organizationLines = captured!.evidence.filter((line) => line.startsWith("[organization/"));
    assert.equal(organizationLines.length, 1, "one organization, one grounding line");
  }

  /* ── 12 · (D) THE AGENT POPULATION CANNOT MOVE ORGANIZATION SEMANTICS ─────── */
  {
    /*
     * There is no agent input to this class at all — which is the strongest form of the claim, and
     * why it is asserted structurally rather than by running the flow twice with different agent
     * fixtures. A resolution built from the same organization is byte-identical regardless of what
     * the agent authority would have said, because it never asks.
     */
    const first = await groundOn(available());
    const second = await groundOn(available());
    assert.deepEqual(first, second, "the organization resolution is a function of the organization alone");

    const source = read("src/features/organization-authority/heby-organization-source.server.ts");
    for (const symbol of ["agentId", "identities", "genesisSpent", "readDurableAgentIdentityState"]) {
      assert.ok(!source.includes(symbol), `the organization source must not reference ${symbol}`);
    }
  }

  console.log("e21-organization-grounding/organization-grounding: OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
