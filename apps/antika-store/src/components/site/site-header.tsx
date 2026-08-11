"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCart } from "@/components/cart/cart-context";
import type { Category, Settings } from "@/lib/types";

type Props = {
  categories: Category[];
  settings: Settings;
};

export function SiteHeader({ categories, settings }: Props) {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const links = [
    { href: "/kategori", label: "Katalog" },
    { href: "/kategori/hali-kilim", label: "Halı & Kilim" },
    { href: "/kategori/mobilya-ahsap", label: "Mobilya" },
    { href: "/iletisim", label: "İletişim" },
  ];

  return (
    <header className="sticky top-0 z-50">
      <div className="bg-ink text-paper">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-2 md:px-10">
          <p className="label-caps opacity-70">{settings.tagline}</p>
          <div className="label-caps hidden items-center gap-6 opacity-70 md:flex">
            <span className="tnum">{settings.phone}</span>
            <span aria-hidden>·</span>
            <span>{settings.instagram}</span>
          </div>
        </div>
      </div>

      <div
        className={`border-b bg-paper/95 backdrop-blur transition-shadow duration-500 ${
          scrolled ? "shadow-[0_18px_40px_-38px_rgba(24,19,16,0.9)]" : ""
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-4 md:px-10">
          <nav className="hidden flex-1 items-center gap-8 lg:flex">
            {links.slice(0, 3).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-active={pathname === link.href}
                className="link-underline label-caps text-ink-soft hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Menü"
            className="label-caps flex items-center gap-2 lg:hidden"
          >
            <span className="flex flex-col gap-[3px]">
              <span className="block h-px w-5 bg-ink" />
              <span className="block h-px w-5 bg-ink" />
              <span className="block h-px w-5 bg-ink" />
            </span>
            Menü
          </button>

          <Link href="/" className="shrink-0 text-center">
            <span className="wordmark block text-[1.35rem] md:text-[1.65rem]">
              {settings.siteTitle}
            </span>
            <span className="eyebrow mt-1 block text-[0.55rem] tracking-[0.4em]">
              Est. 1974 · İstanbul
            </span>
          </Link>

          <div className="flex flex-1 items-center justify-end gap-6">
            <Link
              href="/iletisim"
              className="link-underline label-caps hidden text-ink-soft hover:text-ink lg:inline-block"
            >
              İletişim
            </Link>
            <Link href="/sepet" className="label-caps group flex items-center gap-2">
              Sepet
              <span className="tnum inline-flex h-6 min-w-6 items-center justify-center border border-ink/40 px-1 text-[0.7rem] transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                {ready ? count : 0}
              </span>
            </Link>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t bg-paper-2/70 lg:hidden">
            <nav className="mx-auto flex max-w-[1400px] flex-col px-5 py-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="label-caps border-b border-ink/10 py-3 last:border-none"
                >
                  {link.label}
                </Link>
              ))}
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/kategori/${category.slug}`}
                  className="label-caps border-b border-ink/10 py-3 text-ink-faint last:border-none"
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
