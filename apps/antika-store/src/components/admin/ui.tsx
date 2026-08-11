import Link from "next/link";
import type { ReactNode } from "react";

const NOTICES: Record<string, { text: string; error?: boolean }> = {
  olusturuldu: { text: "Ürün oluşturuldu." },
  guncellendi: { text: "Değişiklikler kaydedildi." },
  kaydedildi: { text: "Kaydedildi." },
  silindi: { text: "Kayıt silindi." },
  hata: { text: "İşlem tamamlanamadı — zorunlu alanları kontrol edin.", error: true },
};

export function Notice({ code }: { code?: string }) {
  const notice = code ? NOTICES[code] : undefined;
  if (!notice) return null;

  return (
    <div className={`notice mb-6 ${notice.error ? "notice-error" : ""}`}>{notice.text}</div>
  );
}

export function PageHeader({
  title,
  action,
  description,
}: {
  title: string;
  action?: { href: string; label: string };
  description?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <h1 className="display text-[2.1rem] leading-none">{title}</h1>
      {action ? (
        <Link href={action.href} className="admin-btn admin-btn-secondary">
          {action.label}
        </Link>
      ) : null}
      {description ? (
        <p className="w-full text-sm text-ink-soft md:w-auto md:flex-1 md:text-right">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Box({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="admin-box">
      <h2 className="admin-box-title">{title}</h2>
      <div className="admin-box-body">{children}</div>
      {footer ? (
        <div className="border-t border-[#ded2bd] bg-[#faf7f1] px-4 py-3">{footer}</div>
      ) : null}
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    yayinda: "Yayında",
    taslak: "Taslak",
    odendi: "Ödendi",
    beklemede: "Beklemede",
    iptal: "İptal",
  };
  return <span className={`badge badge-${status}`}>{labels[status] ?? status}</span>;
}
