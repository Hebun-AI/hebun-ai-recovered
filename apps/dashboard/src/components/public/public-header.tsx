import Link from "next/link";
import { PublicWordmark } from "./public-wordmark";

/*
 * The public header — the site's banner landmark.
 *
 * It imports NOTHING from the authenticated shell. `workspace-rail`, `secondary-nav`, `topbar`,
 * `hebun-shell` and the state blocks are dashboard chrome that assumes a session, a tenant and a
 * workspace; a public page has none of the three, and reusing them would put product chrome around
 * a document a signed-out reader is meant to read.
 *
 * ── EVERY DESTINATION EXISTS ─────────────────────────────────────────────────
 *
 * Product, Integrations and Security are homepage ANCHORS, written absolute (`/#product`) so they
 * resolve identically from `/contact`, `/privacy` and `/terms`. No empty placeholder route was
 * created to satisfy a navigation item — a link that leads to a page with nothing on it is worse
 * than a link that leads to the section that actually says the thing.
 *
 * ── IT IS INK, AT EVERY SCROLL POSITION ──────────────────────────────────────
 *
 * The hero is an ink surface, and a near-white bar sitting on it would cut the first screen in two.
 * The alternative — transparent over the hero, solid after it — cannot be built without a scroll
 * listener, and the public site runs no JavaScript at all. So the bar is ink permanently: it reads
 * as system chrome above a document rather than as a page element that changes its mind, and it
 * carries the same treatment on `/contact`, `/privacy` and `/terms`.
 *
 * It gains NO new colour. `public-ink` re-points the same tokens every component here already
 * spends, so not one class below names a dark value.
 *
 * ── MOBILE ───────────────────────────────────────────────────────────────────
 *
 * There is no drawer and no JavaScript. Below `md` the three anchors move to a second row that
 * scrolls horizontally if it must, and the two actions stay on the first row. A disclosure widget
 * for five links would be interaction for its own sake, and it would put the primary call to
 * action behind a tap.
 */
const ANCHORS = [
  { href: "/#product", label: "Product" },
  { href: "/#integrations", label: "Integrations" },
  { href: "/#security", label: "Security" },
] as const;

export function PublicHeader() {
  return (
    <header className="public-ink sticky top-0 z-10 border-b border-border">
      <div className="public-inset mx-auto flex w-full max-w-[var(--container-max)] flex-col">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* 20px is the approved header scale for the wordmark. No 20px step exists in the type
              scale, and PUB-1 was scoped to the three approved additions — so the size is written
              here rather than a sixth token being invented for one element. */}
          <Link
            href="/"
            className="inline-flex items-center rounded-sm py-2 text-[1.25rem] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <PublicWordmark />
          </Link>

          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <ul className="hidden items-center md:flex">
              {ANCHORS.map((anchor) => (
                <li key={anchor.href}>
                  <Link
                    href={anchor.href}
                    className="inline-flex h-11 items-center rounded-sm px-3 text-body font-medium text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {anchor.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-sm px-3 text-body font-medium text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-semibold text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Request access
            </Link>
          </nav>
        </div>

        <ul className="-mx-1 flex items-center overflow-x-auto pb-1 md:hidden">
          {ANCHORS.map((anchor) => (
            <li key={anchor.href}>
              <Link
                href={anchor.href}
                className="inline-flex h-11 items-center rounded-sm px-3 text-meta font-medium whitespace-nowrap text-fg-secondary hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {anchor.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
