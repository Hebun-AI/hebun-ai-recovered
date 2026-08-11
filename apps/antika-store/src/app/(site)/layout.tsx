import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getCategories, getSettings } from "@/lib/db";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={categories} settings={settings} />
      <main className="flex-1">{children}</main>
      <SiteFooter categories={categories} settings={settings} />
    </div>
  );
}
