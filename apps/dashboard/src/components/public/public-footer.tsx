import Link from "next/link";
import { PublicWordmark } from "./public-wordmark";

/*
 * The public footer — contentinfo landmark, and the site's only place where the contact address is
 * written out in full.
 *
 * No newsletter, no social row, no sitemap column, no "product / company / resources" grid: each
 * of those would need destinations that do not exist, and inventing them is how a public site
 * starts claiming a company larger than the one behind it.
 */
export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="public-inset mx-auto flex w-full max-w-[var(--container-max)] flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <PublicWordmark className="text-body" />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link
                href="/privacy"
                className="inline-flex h-11 items-center rounded-sm px-2 text-meta text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="inline-flex h-11 items-center rounded-sm px-2 text-meta text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Terms
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="inline-flex h-11 items-center rounded-sm px-2 text-meta text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Contact
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="inline-flex h-11 items-center rounded-sm px-2 text-meta text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Sign in
              </Link>
            </li>
            <li>
              <a
                href="mailto:hebuntech@gmail.com"
                className="inline-flex h-11 items-center rounded-sm px-2 text-meta text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                hebuntech@gmail.com
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
