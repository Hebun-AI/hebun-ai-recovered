import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

/*
 * Stage 0 — THE BRAND TYPEFACE IS LOADED, NOT DECLARED.
 *
 * `globals.css` has always resolved the sans stack as `var(--font-jakarta, ui-sans-serif)`, and
 * `--font-jakarta` was defined nowhere in the repository. The product therefore shipped in the
 * system UI font while its own token declared Plus Jakarta Sans — the typeface named as the single
 * typeface in `07 - Design System/00 - North Star UI.md`.
 *
 * This defines that variable and nothing else. No token is renamed, no utility changes meaning, and
 * no component is touched: every `font-sans` consumer keeps resolving through the same chain it
 * already used, and the chain now finds the face it was written for. The system stack remains the
 * fallback, so a failed font load degrades to exactly today's rendering rather than to a serif.
 *
 * `next/font` self-hosts the files at build time, so the running product makes no request to a font
 * CDN and the strict-CSP and privacy posture is unchanged. The network cost is a build-time
 * download, not a runtime one.
 *
 * IT REACHES HEBY, AND THAT IS INTENDED RATHER THAN OVERLOOKED. Heby renders inside this body and
 * inherits the sans stack like every other surface; it hardcodes no typeface of its own. Loading
 * the declared face changes no Heby token, rule, geometry or component — G7/G7.1 own colour, space
 * and motion, never the typeface — and the frozen surface was measured before and after.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Hebun AI — Dashboard",
  description: "The AI Operating System control plane.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-scroll-behavior="smooth"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
