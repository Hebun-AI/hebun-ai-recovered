import { RetiredDomainNotice } from "@/components/legacy-domain/retired-domain-notice";

/* COMMERCIAL-ACTIVATION-1 — every /finance route shows the retired-domain notice, never its mock data. */
export default function FinanceLayout() {
  return <RetiredDomainNotice domain="Finance" />;
}
