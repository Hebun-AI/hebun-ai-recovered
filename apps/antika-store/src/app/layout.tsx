import type { Metadata } from "next";

import { CartProvider } from "@/components/cart/cart-context";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MİRÂS — Antika & Koleksiyon Evi",
    template: "%s · MİRÂS",
  },
  description:
    "Çukurcuma'dan seçilmiş antika mobilya, halı, gümüş ve koleksiyon parçaları. Her parça ekspertizli, künyeli ve tek.",
  openGraph: {
    title: "MİRÂS — Antika & Koleksiyon Evi",
    description: "Ekspertizli antika parçalar, künyesiyle birlikte.",
    locale: "tr_TR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Jost:wght@200;300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
