import type { Metadata } from "next";
import { HashRedirect } from "@/app/components/HashRedirect";
import { SiteChrome, type ChromeAuth } from "@/app/components/SiteChrome";
import { getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARY Integrated MVP",
  description: "ARY high-fidelity frontend integrated with server-side race domain actions."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  const shellUser = ctx ? await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      slug: true,
      displayName: true,
      avatarUrl: true,
      roleApplications: {
        where: { status: "pending" },
        select: { requestedRole: true }
      }
    }
  }) : null;
  const auth: ChromeAuth | null = ctx && shellUser ? {
    userId: shellUser.id,
    slug: shellUser.slug,
    displayName: shellUser.displayName,
    avatarUrl: shellUser.avatarUrl,
    activeRole: ctx.activeRole,
    availableRoles: ctx.availableRoles,
    pendingRoles: shellUser.roleApplications.map((item) => item.requestedRole)
  } : null;
  return (
    <html lang="zh-CN">
      <body>
        <HashRedirect />
        <SiteChrome auth={auth} debugLoginEnabled={process.env.ENABLE_DEBUG_LOGIN === "true" && process.env.NODE_ENV !== "production"}>{children}</SiteChrome>
      </body>
    </html>
  );
}
