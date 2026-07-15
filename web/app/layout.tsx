import type { Metadata } from "next";
import { HashRedirect } from "@/app/components/HashRedirect";
import { SiteChrome } from "@/app/components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARY Integrated MVP",
  description: "ARY high-fidelity frontend integrated with server-side race domain actions."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <HashRedirect />
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
