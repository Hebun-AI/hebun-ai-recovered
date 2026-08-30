import { PageHeader } from "@/components/layout/page-header";
import { StateBlock } from "@/components/ui/state-block";
import { WorkspaceSection } from "@/components/ui/workspace-section";
import { KnowledgeWorkspace } from "@/components/knowledge-workspace/knowledge-workspace";
import { KnowledgeAuthoringCard, type KnowledgeAuthoringBlock } from "@/components/knowledge-workspace/knowledge-authoring-card";
import { KnowledgeIngestionCard } from "@/components/knowledge-workspace/knowledge-ingestion-card";
import { KnowledgeRecords } from "@/components/knowledge-workspace/knowledge-records";
import { KnowledgeStanding } from "@/components/knowledge-workspace/knowledge-standing";
import { CompanyUnderstandingCard } from "@/components/knowledge-workspace/company-understanding-card";
import { KnowledgeSourcesCard } from "@/components/knowledge-workspace/knowledge-sources-card";
import { DiscoveredSourcesCard } from "@/components/knowledge-workspace/discovered-sources-card";
import { ProviderDocumentAdmissionCard } from "@/components/knowledge-workspace/provider-document-admission-card";
import { getKnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { listKnowledgeSources } from "@/features/knowledge/knowledge-read.server";
import { readCompanyUnderstanding } from "@/features/knowledge/company-understanding-read.server";
import { listIngestedSources } from "@/features/knowledge/ingested-sources-read.server";
import { discoverDriveSources } from "@/features/provider-google/discover-drive-sources.server";
import { resolveKnowledgeWriteAuthority } from "@/features/knowledge/knowledge-write-authority.server";
import { isDurableKnowledgeConfigured } from "@/features/knowledge/durable-knowledge-repository.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  KnowledgeReviewCard,
  type ReviewBlock,
} from "@/components/knowledge-workspace/knowledge-review-card";

export const metadata = { title: "Knowledge — Hebun AI" };

/*
 * Knowledge (Phase 9 honesty, refined in UI Phase 21B, extended by K1 and K2, recomposed as the
 * FIRST CANONICAL HEBUN WORKSPACE in Stage 1) — the Knowledge landing, and the surface that OWNS
 * Knowledge management.
 *
 * K1 added the real tenant-scoped read of the canonical Knowledge authority; K2 adds the governed
 * creation of a record inside it. Both live here rather than inside Heby, because authority
 * ownership decides UI ownership: Heby CONSUMES Knowledge, this workspace GOVERNS it.
 *
 * The tenant, the actor and the write authority are all resolved SERVER-SIDE. An unauthenticated
 * visitor sees an honest sign-in state; an authenticated actor without the owner/director band sees
 * a truthful refusal rather than a form that will fail.
 *
 * ── WHAT STAGE 1 CHANGED, AND WHAT IT DELIBERATELY DID NOT ───────────────────
 *
 * NOT CHANGED: every read, every action, every authority resolution and every refusal reason. The
 * six awaited calls below are the same six, in the same order, with the same arguments, resolving
 * the same two distinct authorities. No schema, no migration, no writer, no new seam.
 *
 * CHANGED: the reading order, and what each region says about itself.
 *
 *  1. THE WAY IN CAME ABOVE THE FOLD. Ten coverage rows used to open the page, so an organization
 *     holding nothing met a full viewport of "no Knowledge yet" with the authoring controls below
 *     it. The organization's own records now open the workspace, and their empty state carries the
 *     invitation; coverage — which is orientation, not the object — follows the way in.
 *
 *  2. EVERY REGION STATES ITS PROVENANCE. `WorkspaceSection` requires it. The records are
 *     AUTHORITATIVE; coverage is DERIVED and now looks it. Before, both were cards.
 *
 *  3. THE TWO AUTHORITIES BECAME TWO SECTIONS. Authoring and ingestion sit under the Knowledge
 *     authoring band; ratification sits in its own section under GOVERNANCE authority, which the
 *     section header names as a different authority in so many words. Review cards used to be
 *     interleaved with the records they judge, which is exactly where a reader stops being able to
 *     tell the two apart. The page still resolves them separately — `resolveKnowledgeWriteAuthority`
 *     and `resolveGovernanceAuthority` — and neither is ever inferred from the other.
 *
 *  4. THE VOCABULARY MODEL BECAME A DISCLOSURE. What Knowledge *is* stopped competing with what
 *     this organization *has*. It is still on the page and still reachable by keyboard.
 */

export default async function KnowledgePage() {
  const tenant = await resolveTenantContext();

  const [listing, understanding, sources, discovery, authority, governance] = await Promise.all([
    listKnowledgeSources(tenant),
    /*
     * R6B. A SECOND read of the same authority, not a second authority: the listing is bounded at
     * 50 and ordered by domain, so counting over it would lose the alphabetically last domains
     * first and report a covered area as missing. Coverage therefore comes from its own uncapped
     * per-domain aggregate. Read-only, and it resolves no authority of its own — showing counts of
     * records this viewer can already see needs no gate the listing does not have.
     */
    readCompanyUnderstanding(tenant),
    /*
     * R6D. Which ingestion sources the tenant still holds live Knowledge from — a read, gated only
     * on the tenant. The AUTHORITY to withdraw one is the authoring band resolved just below and
     * shared with this card: whatever stops you adding a source stops you withdrawing one.
     */
    listIngestedSources(tenant),
    /*
     * INT-4's Drive metadata capability, consumed for the first time by a real product surface.
     * PROVIDER-OWNED: the seam lives in `provider-google` because I1 forbids any Knowledge module
     * from reading connection or capability state. This page is a composition point — it renders
     * the provider's answer and derives no connection truth of its own.
     */
    discoverDriveSources(tenant),
    tenant ? resolveKnowledgeWriteAuthority(tenant) : Promise.resolve(null),
    // K4: Governance authority is a DIFFERENT authority from Knowledge authoring. Resolved
    // separately, and never inferred from the role band above.
    tenant ? resolveGovernanceAuthority(tenant) : Promise.resolve(null),
  ]);

  /*
   * The review block states the REAL reason, in resolution order. A Knowledge author who is not
   * the Governance authority sees a truthful refusal rather than a control that will fail.
   */
  const reviewBlock: ReviewBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : !governance?.bootstrapDecisionId
      ? { kind: "no-governance-authority" }
      : !governance.authorized
        ? { kind: "not-the-governance-authority" }
        : undefined;

  const reviewable = listing.status === "read" ? listing.records : [];

  // The authoring block states the REAL reason the form is unusable, in resolution order.
  const block: KnowledgeAuthoringBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : !isDurableKnowledgeConfigured()
      ? { kind: "persistence-unavailable" }
      : !authority?.authorized
        ? { kind: "forbidden", roleType: authority?.roleType ?? null }
        : undefined;

  /* Named once, used by both write sections, so the two can never drift into different words. */
  const authoringBand = "the Knowledge authoring band (owner or director role)";

  return (
    <>
      <PageHeader
        title="Knowledge"
        context="What this organization has settled as true, where each record came from, and who may change it. Heby reads exactly what is listed here — nothing more."
      />

      <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
        <KnowledgeStanding
          listing={listing}
          understanding={understanding}
          persistenceConfigured={isDurableKnowledgeConfigured()}
        />

        <WorkspaceSection
          id="records"
          title="Your organization's Knowledge"
          question="What has this organization settled as true?"
          provenance="authoritative"
          provenanceDetail="canonical Knowledge, scoped to this tenant"
          authority={authoringBand}
        >
          <KnowledgeRecords listing={listing} canAuthor={block === undefined} />
        </WorkspaceSection>

        <WorkspaceSection
          id="add"
          title="Add Knowledge"
          question="How does something become part of what this organization knows?"
          provenance="authoritative"
          provenanceDetail="writes the canonical Knowledge authority"
          authority={authoringBand}
        >
          {/*
            Two scales of the SAME act under the SAME authority — one sentence, or one document —
            which is why they share `block`: whatever stops you authoring stops you ingesting.
          */}
          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <KnowledgeAuthoringCard block={block} />
            <KnowledgeIngestionCard block={block} />
          </div>
        </WorkspaceSection>

        <WorkspaceSection
          id="coverage"
          title="Coverage across declared areas"
          question="Which parts of this organization does Hebun hold evidence about, and which does it not?"
          provenance="derived"
          provenanceDetail="per-domain aggregate over the same records"
        >
          <CompanyUnderstandingCard result={understanding} />
        </WorkspaceSection>

        <WorkspaceSection
          id="review"
          title="Governance review"
          question="Which records has the organization's Governance authority ratified as settled truth?"
          provenance="authoritative"
          provenanceDetail="writes a Governance decision"
          /*
            NAMED AS A DIFFERENT AUTHORITY, IN WORDS, ON THE SURFACE ITSELF. Ratification is not a
            larger version of authoring — it is a Governance act over a Knowledge record, and a
            reader who believes an author can ratify has misunderstood the constitution the whole
            governance chain exists to hold. The page resolves the two separately; this line is
            where that separation becomes visible.
          */
          authority="the tenant's Governance authority — a different authority from authoring"
        >
          {reviewable.length > 0 ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              {reviewable.map((record) => (
                <KnowledgeReviewCard key={record.factId} record={record} block={reviewBlock} />
              ))}
            </div>
          ) : listing.status === "unavailable" ? (
            <StateBlock
              tone="unavailable"
              title="There is nothing to review because the records could not be read"
              description="Ratification acts on records. The canonical read did not answer, so this section has no subject — which is not the same as this organization having nothing to ratify."
            />
          ) : (
            <StateBlock
              tone="empty"
              title="Nothing is waiting for Governance review"
              description="Ratification applies to records that already exist. Add Knowledge above, and each record becomes reviewable here by the Governance authority."
            />
          )}
        </WorkspaceSection>

        <WorkspaceSection
          id="sources"
          title="Ingested sources"
          question="Which documents is this organization's Knowledge still standing on, and how is one withdrawn?"
          provenance="authoritative"
          provenanceDetail="source-level withdrawal of canonical records"
          authority={authoringBand}
        >
          <KnowledgeSourcesCard listing={sources} block={block} />
        </WorkspaceSection>

        {/*
          DISCOVERED, NOT ADMITTED. The section above lists sources this organization's Knowledge
          already stands on. This one lists documents that merely EXIST somewhere it has connected.
          Separate sections because they are separate facts, and the provenance says so: the records
          above are `authoritative`, these are read live from a provider and are not Knowledge at
          all. When no usable connection exists the section reads `not-connected` rather than
          showing an empty list, because "nothing granted" and "nothing there" are different answers.
        */}
        <WorkspaceSection
          id="external-sources"
          title="Discovered in connected providers"
          question="What documents exist in a connected provider that could one day become Knowledge?"
          provenance={discovery.status === "discovered" || discovery.status === "empty" ? "derived" : "not-connected"}
          provenanceDetail="read live from the provider — provider-derived, never stored, not Knowledge"
        >
          <DiscoveredSourcesCard discovery={discovery} />
        </WorkspaceSection>

        {/*
          KID-2. THE DELIBERATE STEP ACROSS THE LINE THE SECTION ABOVE DRAWS.

          It is a SEPARATE section from discovery, and the separation is the point: listing what
          exists somewhere else is provider-derived and admits nothing, while this writes canonical
          Knowledge and is `authoritative` for exactly that reason. Its authority is the SAME
          authoring band as the two write sections higher up the page — `block` is shared, so
          whatever stops you authoring stops you admitting — and it is not the provider's
          authorization: the organization's Google grant is resolved separately inside the released
          content seam, and neither ever stands in for the other.

          One document, chosen by a person, classified by that person. There is no import-all, no
          folder, no schedule and no sync behind it, because none of those exist.
        */}
        <WorkspaceSection
          id="provider-admission"
          title="Admit a provider document"
          question="How does a document in a connected provider become Knowledge this organization holds?"
          provenance="authoritative"
          provenanceDetail="writes the canonical Knowledge authority, and records the provider record it came from"
          authority={authoringBand}
        >
          <ProviderDocumentAdmissionCard block={block} discovery={discovery} />
        </WorkspaceSection>

        {/*
          What Knowledge MEANS in Hebun — the frozen Phase 21B vocabulary model. It is reference,
          not this organization's state, so it stops competing with the sections above. Closed by
          default, present in the document, reachable by keyboard, and unchanged inside.
        */}
        <details className="group min-w-0 rounded-xl border border-border bg-surface-sunken">
          <summary className="cursor-pointer list-none px-4 py-3 text-body font-medium text-fg-secondary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring">
            What “Knowledge” means in Hebun
            <span className="ml-2 text-meta font-normal text-fg-muted">
              reference — describes the model, not this organization
            </span>
          </summary>
          <div className="border-t border-border p-4">
            <KnowledgeWorkspace model={getKnowledgeWorkspaceModel()} />
          </div>
        </details>
      </div>
    </>
  );
}
