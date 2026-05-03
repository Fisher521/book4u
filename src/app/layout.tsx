import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "逢书 · A Book to Meet You",
  description: "此刻，与这本书不期而遇。基于你的情绪、心境、品味，给你一份恰好的书单。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
