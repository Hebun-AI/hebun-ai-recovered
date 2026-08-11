import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { logout } from "@/app/admin/(panel)/actions";
import { getMessages, getOrders, getSettings } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [orders, messages, settings] = await Promise.all([
    getOrders(),
    getMessages(),
    getSettings(),
  ]);

  const pendingOrders = orders.filter((order) => order.status === "beklemede").length;
  const unreadMessages = messages.filter((message) => !message.read).length;

  return (
    <div className="admin-shell">
      {/* üst çubuk */}
      <div className="admin-bar sticky top-0 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <span className="wordmark text-[0.9rem] text-brass-light">
            {settings.siteTitle}
          </span>
          <Link href="/" target="_blank" className="opacity-80">
            ↗ Siteyi görüntüle
          </Link>
          <Link href="/admin/urunler/yeni" className="hidden opacity-80 sm:inline">
            + Yeni ürün
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden opacity-60 sm:inline">Merhaba, Yönetici</span>
          <form action={logout}>
            <button type="submit" className="opacity-80 hover:opacity-100">
              Çıkış
            </button>
          </form>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-40px)]">
        <aside className="admin-sidebar hidden shrink-0 md:block">
          <div className="sticky top-10">
            <AdminNav pendingOrders={pendingOrders} unreadMessages={unreadMessages} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* dar ekranda menü yatay şeride düşer */}
          <div className="admin-sidebar w-full md:hidden">
            <AdminNav pendingOrders={pendingOrders} unreadMessages={unreadMessages} />
          </div>

          <div className="p-5 lg:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
