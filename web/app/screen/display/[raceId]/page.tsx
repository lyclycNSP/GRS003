import { notFound } from "next/navigation";
import { ScreenDisplayContent } from "../ScreenDisplayContent";
import { canManageRace, getAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RaceScreenDisplayPage({ params }: { params: Promise<{ raceId: string }> }) {
  const { raceId } = await params;
  const [race, ctx] = await Promise.all([
    prisma.race.findUnique({ where: { id: raceId }, select: { id: true, visibility: true, status: true } }),
    getAuthContext()
  ]);
  if (!race) notFound();
  const publicDisplay = race.visibility === "public" && race.status !== "draft";
  if (!publicDisplay && !canManageRace(ctx, race.id)) notFound();
  return <ScreenDisplayContent raceId={race.id} />;
}
