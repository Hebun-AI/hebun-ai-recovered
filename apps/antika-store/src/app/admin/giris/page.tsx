import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Yönetim girişi",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ devam?: string }>;
}) {
  const { devam } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="wordmark text-[1.5rem]">MİRÂS</p>
          <p className="eyebrow mt-2">Yönetim paneli</p>
        </div>

        <div className="mt-10 border bg-paper-2/40 p-8">
          <LoginForm next={devam ?? "/admin"} />

          <p className="mt-6 border-t pt-4 text-xs leading-relaxed text-ink-faint">
            Örnek kurulumda parola <code className="text-ink">antika2026</code>. Gerçek
            kullanımda <code className="text-ink">ADMIN_PASSWORD</code> ortam değişkenini
            tanımlayın.
          </p>
        </div>

        <p className="mt-8 text-center">
          <Link href="/" className="link-underline label-caps text-ink-faint">
            ← Siteye dön
          </Link>
        </p>
      </div>
    </div>
  );
}
