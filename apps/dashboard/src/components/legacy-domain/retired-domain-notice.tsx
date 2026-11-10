import { PageHeader } from "@/components/layout/page-header";

/*
 * COMMERCIAL-ACTIVATION-1 — Finance and People are not Hebun features. Their legacy pages render
 * illustrative mock numbers, and a paying customer must never be shown invented finance or people
 * data as if it were theirs. The `finance/` and `hr/` route layouts render THIS instead of their
 * children: the routes stay reachable (Phase 25C/25D keep them resolvable) but show no fiction.
 */
export function RetiredDomainNotice({ domain }: { readonly domain: string }) {
  return (
    <>
      <PageHeader title={domain} context="Not part of Hebun today." />
      <p className="max-w-2xl text-sm leading-6 text-fg-secondary">
        {domain} is not a Hebun feature, and Hebun is not connected to any {domain.toLowerCase()} system for your
        organization, so there is nothing real to show here. Nothing on this page is your organization&apos;s data.
      </p>
    </>
  );
}
