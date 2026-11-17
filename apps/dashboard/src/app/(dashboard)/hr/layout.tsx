import { RetiredDomainNotice } from "@/components/legacy-domain/retired-domain-notice";

/* COMMERCIAL-ACTIVATION-1 — every /hr route shows the retired-domain notice, never its mock data. */
export default function PeopleLayout() {
  return <RetiredDomainNotice domain="People" />;
}
