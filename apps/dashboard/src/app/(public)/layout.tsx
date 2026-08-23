import type { Metadata } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/config/public-site";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";

/*
 * The PUBLIC surface layout.
 *
 * ── IT IS NOT A SECOND DOCUMENT ROOT ─────────────────────────────────────────
 *
 * `src/app/layout.tsx` remains the sole authority for <html> and <body>: it owns the language, the
 * theme attribute, the self-hosted typeface and the base classes. This layout returns a fragment.
 * A second <html>/<body> here would fight the root for the document and duplicate the font link.
 *
 * ── IT IMPORTS NOTHING FROM THE AUTHENTICATED SHELL ──────────────────────────
 *
 * No `HebunShell`, no workspace rail, no secondary navigation, no topbar, no state block. Those
 * assume a session, a tenant and a workspace, and this surface has none of the three — reusing
 * them would wrap a document a signed-out reader must be able to open in product chrome that
 * cannot resolve. The public header and footer are this layout's own, and they are the only
 * chrome it owns.
 *
 * ── IT RESOLVES NO SESSION AND READS NO TENANT ───────────────────────────────
 *
 * There is no auth call here, no database handle, no cookie read and no redirect. A signed-in
 * reader sees exactly the same page a signed-out one does; the authenticated product stays at its
 * own routes. That is why `/` can be static: nothing about it varies per request or per reader.
 *
 * ── THE SKIP LINK ────────────────────────────────────────────────────────────
 *
 * The header carries up to five links before the content starts. The skip link is the first
 * focusable element in the document and is visible the moment it takes focus.
 */
/*
 * ── PUBLIC METADATA, AND WHY THERE IS NO SOCIAL IMAGE ────────────────────────
 *
 * `metadataBase` lives here rather than in the root layout, so resolving relative canonical and
 * Open Graph URLs is a property of the PUBLIC surface and never leaks onto authenticated routes.
 *
 * NO `openGraph.images` AND NO `twitter.card` IMAGE IS DECLARED. There is no legitimate social
 * image: producing one would mean either a screenshot of a product surface (which would carry real
 * organizational data or invented data pretending to be real) or a decorative graphic asserting
 * something the product does not do. A link preview without an image is a smaller preview; a link
 * preview with a fabricated one is a false claim rendered at a larger size. The title and
 * description alone are true, so the title and description alone are published.
 */
export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  /* Public pages set their own title through this template; the dashboard's title is unaffected. */
  title: {
    default: "Hebun AI",
    template: "%s — Hebun AI",
  },
  applicationName: "Hebun AI",
  openGraph: {
    type: "website",
    siteName: "Hebun AI",
    locale: "en",
  },
};

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:inline-flex focus:h-11 focus:items-center focus:rounded-md focus:bg-fg focus:px-4 focus:text-meta focus:font-semibold focus:text-fg-inverse"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
