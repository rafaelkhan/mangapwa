import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/nav";

export const metadata: Metadata = {
  title: "MangaPWA",
  description: "Self-hosted manga reader. Bring your own sources.",
  applicationName: "MangaPWA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MangaPWA",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <Providers>
          <main className="flex flex-1 flex-col pb-16">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
