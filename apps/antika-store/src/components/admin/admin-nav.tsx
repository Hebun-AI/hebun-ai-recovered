"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  children?: { href: string; label: string }[];
};

export function AdminNav({ pendingOrders, unreadMessages }: {
  pendingOrders: number;
  unreadMessages: number;
}) {
  const pathname = usePathname();

  const items: Item[] = [
    { href: "/admin", label: "Panel", icon: "◫" },
    {
      href: "/admin/urunler",
      label: "Ürünler",
      icon: "❖",
      children: [
        { href: "/admin/urunler", label: "Tüm ürünler" },
        { href: "/admin/urunler/yeni", label: "Yeni ekle" },
        { href: "/admin/kategoriler", label: "Kategoriler" },
      ],
    },
    { href: "/admin/siparisler", label: "Siparişler", icon: "▣", badge: pendingOrders },
    { href: "/admin/mesajlar", label: "Mesajlar", icon: "✉", badge: unreadMessages },
    { href: "/admin/ayarlar", label: "Ayarlar", icon: "⚙" },
  ];

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="py-3">
      {items.map((item) => {
        const active = isActive(item.href) ||
          (item.children?.some((child) => pathname.startsWith(child.href)) ?? false);

        return (
          <div key={item.href}>
            <Link href={item.href} data-active={active} className="admin-menu-item">
              <span aria-hidden className="w-4 text-center text-[0.95rem] opacity-80">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass px-1.5 text-[0.68rem] text-[#14100c]">
                  {item.badge}
                </span>
              ) : null}
            </Link>

            {active && item.children ? (
              <div className="admin-submenu pb-2">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    data-active={pathname === child.href}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
