import type { Metadata } from "next";
import "./globals.css";

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
      className="h-full antialiased"
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
