import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export default async function ConsolePage({ searchParams }: { searchParams?: Promise<{ raceId?: string; action?: string; entityId?: string; actionMessage?: string; actionError?: string }> }) {
  const query = await searchParams;
  const ctx = await getAuthContext();
  if (!ctx) {
    const requested = new URLSearchParams();
    if (query?.raceId) requested.set("raceId", query.raceId);
    if (query?.action) requested.set("action", query.action);
    if (query?.entityId) requested.set("entityId", query.entityId);
    if (query?.actionMessage) requested.set("actionMessage", query.actionMessage);
    if (query?.actionError) requested.set("actionError", query.actionError);
    const next = `/console${requested.size ? `?${requested.toString()}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!ctx.profileCompleted) redirect("/profile");
  if (!ctx.availableRoles.length) redirect("/onboarding/role");
  if (!ctx.activeRole) redirect("/role-switch");
  const next = new URLSearchParams();
  if (query?.raceId) next.set("raceId", query.raceId);
  if (query?.action) next.set("action", query.action);
  if (query?.entityId) next.set("entityId", query.entityId);
  if (query?.actionMessage) next.set("actionMessage", query.actionMessage);
  if (query?.actionError) next.set("actionError", query.actionError);
  redirect(`/console/${ctx.activeRole}${next.size ? `?${next.toString()}` : ""}`);
}
