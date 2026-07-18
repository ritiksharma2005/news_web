import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "News.nit_iit — Poster Maker",
  description: "Generate news posters with AI-drafted headlines, summaries, and captions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
