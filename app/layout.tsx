import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archana Caps Inventory",
  description: "Inventory dan laporan penjualan Archana Caps",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
